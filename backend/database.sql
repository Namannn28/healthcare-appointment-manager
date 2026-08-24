CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255) NOT NULL,
    slot_duration INTEGER DEFAULT 30, -- in minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    doctor_id INTEGER REFERENCES doctors(id),
    slot_start TIMESTAMP NOT NULL,
    slot_end TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('held', 'booked', 'cancelled', 'completed', 'cancelled_leave')),
    expires_at TIMESTAMP, -- for held slots
    symptoms TEXT,
    pre_visit_summary TEXT,
    pre_visit_status VARCHAR(50), -- e.g., 'pending', 'completed', 'failed'
    post_visit_notes TEXT,
    post_visit_summary TEXT,
    prescription TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial Unique Index to prevent double booking
CREATE UNIQUE INDEX IF NOT EXISTS doc_slot_idx 
ON appointments (doctor_id, slot_start) 
WHERE status IN ('held', 'booked');

CREATE TABLE IF NOT EXISTS notifications_job (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'email', 'calendar', 'medication'
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
