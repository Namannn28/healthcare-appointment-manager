const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');
const { triggerN8nWebhook } = require('./n8n');
const { analyzeSymptoms, generatePostVisitSummary } = require('./llm');

const app = express();
app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
  next();
};

// --- Routes ---

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, name, phone, specialization } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, role]
    );
    const userId = userResult.rows[0].id;

    if (role === 'doctor') {
      await db.query('INSERT INTO doctors (user_id, name, specialization) VALUES ($1, $2, $3)', [userId, name, specialization]);
    } else if (role === 'patient') {
      await db.query('INSERT INTO patients (user_id, name, phone) VALUES ($1, $2, $3)', [userId, name, phone]);
    }

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    let profileId = null;
    if (user.role === 'patient') {
      const p = await db.query('SELECT id FROM patients WHERE user_id = $1', [user.id]);
      profileId = p.rows[0]?.id;
    } else if (user.role === 'doctor') {
      const d = await db.query('SELECT id FROM doctors WHERE user_id = $1', [user.id]);
      profileId = d.rows[0]?.id;
    }

    const token = jwt.sign({ id: user.id, role: user.role, profileId }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: user.role, profileId });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Patients: Book slot (Hold mechanism)
app.post('/api/appointments/hold', authenticateToken, requireRole('patient'), async (req, res) => {
  const { doctorId, slotStart, slotEnd, symptoms } = req.body;
  const patientId = req.user.profileId;

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Attempt to hold the slot (unique index will reject if already booked/held)
    const holdQuery = `
      INSERT INTO appointments (patient_id, doctor_id, slot_start, slot_end, status, expires_at, symptoms)
      VALUES ($1, $2, $3, $4, 'held', NOW() + INTERVAL '5 minutes', $5)
      RETURNING id
    `;
    const result = await client.query(holdQuery, [patientId, doctorId, slotStart, slotEnd, symptoms]);
    
    await client.query('COMMIT');
    res.status(201).json({ appointmentId: result.rows[0].id, message: 'Slot held for 5 minutes' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Slot already booked or held by another user' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to hold slot' });
  } finally {
    client.release();
  }
});

// Patients: Confirm slot (with SELECT FOR UPDATE)
app.post('/api/appointments/:id/confirm', authenticateToken, requireRole('patient'), async (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.user.profileId;

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Row-level lock
    const lockResult = await client.query(
      'SELECT status, expires_at, symptoms FROM appointments WHERE id = $1 AND patient_id = $2 FOR UPDATE',
      [appointmentId, patientId]
    );

    const appt = lockResult.rows[0];
    if (!appt) throw new Error('Appointment not found');
    if (appt.status !== 'held') throw new Error('Appointment is not in held state');
    if (new Date() > new Date(appt.expires_at)) {
       throw new Error('Hold period expired');
    }

    // Confirm booking
    await client.query("UPDATE appointments SET status = 'booked' WHERE id = $1", [appointmentId]);

    // Send async request to LLM for pre-visit summary
    if (appt.symptoms) {
      analyzeSymptoms(appointmentId, appt.symptoms).catch(console.error);
    }

    // Trigger n8n webhook for automation (calendar, email)
    await triggerN8nWebhook('booking_confirmed', { appointmentId });

    await client.query('COMMIT');
    res.json({ message: 'Appointment confirmed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Admin: Mark Leave (Cancels overlapping appointments)
app.post('/api/admin/leave', authenticateToken, requireRole('admin'), async (req, res) => {
  const { doctorId, date } = req.body;
  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Find affected appointments
    const affected = await client.query(`
      SELECT id FROM appointments 
      WHERE doctor_id = $1 AND DATE(slot_start) = $2 AND status = 'booked'
    `, [doctorId, date]);

    // Mark as cancelled
    if (affected.rows.length > 0) {
      await client.query(`
        UPDATE appointments SET status = 'cancelled_leave' 
        WHERE doctor_id = $1 AND DATE(slot_start) = $2 AND status = 'booked'
      `, [doctorId, date]);
      
      // Enqueue cancellation emails via n8n
      for (const row of affected.rows) {
        await triggerN8nWebhook('leave_cancellation', { appointmentId: row.id });
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Leave marked and affected appointments cancelled', cancelledCount: affected.rows.length });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to mark leave' });
  } finally {
    client.release();
  }
});

// Doctors: Submit Post-visit Notes
app.post('/api/appointments/:id/post-visit', authenticateToken, requireRole('doctor'), async (req, res) => {
  const appointmentId = req.params.id;
  const { clinicalNotes, prescription } = req.body;
  const doctorId = req.user.profileId;

  try {
    // Save notes
    await db.query(
      "UPDATE appointments SET post_visit_notes = $1, prescription = $2, status = 'completed' WHERE id = $3 AND doctor_id = $4",
      [clinicalNotes, prescription, appointmentId, doctorId]
    );

    // Generate patient-friendly post-visit summary via LLM
    const summary = await generatePostVisitSummary(appointmentId, clinicalNotes);
    
    // Send to n8n to handle medication reminders and sending summary to patient
    await triggerN8nWebhook('post_visit_complete', { appointmentId, prescription, summary });

    res.json({ message: 'Post-visit notes saved successfully', summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save post-visit notes' });
  }
});

// Doctors: Get today's appointments
app.get('/api/appointments/today', authenticateToken, requireRole('doctor'), async (req, res) => {
  const doctorId = req.user.profileId;
  try {
    const result = await db.query(`
      SELECT a.*, p.name as patient_name, p.phone as patient_phone 
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = $1 AND DATE(a.slot_start) = CURRENT_DATE
      ORDER BY a.slot_start ASC
    `, [doctorId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
