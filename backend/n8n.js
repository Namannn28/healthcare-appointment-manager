const axios = require('axios');
const db = require('./db');

// In a real environment, this is your n8n webhook URL
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/healthcare-events';

const triggerN8nWebhook = async (eventType, payload) => {
  // Store the job in the database for tracking/retry purposes
  const result = await db.query(
    'INSERT INTO notifications_job (type, payload) VALUES ($1, $2) RETURNING id',
    [eventType, payload]
  );
  const jobId = result.rows[0].id;

  try {
    // Send data to n8n Webhook which handles the email/calendar API
    await axios.post(N8N_WEBHOOK_URL, {
      jobId,
      eventType,
      ...payload
    });
    
    // Mark as handed off to n8n
    await db.query("UPDATE notifications_job SET status = 'sent' WHERE id = $1", [jobId]);
  } catch (error) {
    console.error(`n8n Webhook failed for job ${jobId}:`, error.message);
    // Mark as failed. In a full production app, a cron job would retry these 'failed' status jobs.
    await db.query("UPDATE notifications_job SET status = 'failed', attempts = attempts + 1 WHERE id = $1", [jobId]);
  }
};

module.exports = { triggerN8nWebhook };
