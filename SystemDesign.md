# System Design Document

## 1. Double-Booking Prevention
The system leverages **PostgreSQL constraints** and **Row-Level Locking**.
1. **Slot Hold Mechanism**: When a patient attempts to book, we `INSERT` a row with `status='held'` and an `expires_at` timestamp 5 minutes into the future. 
2. **Partial Unique Constraint**: A database index `CREATE UNIQUE INDEX doc_slot_idx ON appointments (doctor_id, slot_start) WHERE status IN ('held', 'booked')` strictly rejects any overlapping insertions instantly at the database level.
3. **Confirmation (SELECT FOR UPDATE)**: When the user confirms the booking, a transaction runs `SELECT ... FOR UPDATE` ensuring no other process can modify the held slot while the status is flipped to `'booked'`.

## 2. Doctor Leave Conflict Handling
When an Admin marks a leave on a specific date for a doctor:
1. We run an `UPDATE` on the `appointments` table where `DATE(slot_start) = LeaveDate`.
2. The status is changed to `cancelled_leave`.
3. For each affected appointment, an asynchronous `email` notification job is pushed into the `notifications_job` table and picked up by BullMQ.

## 3. Notification & Failure Handling
All external communications (Emails, Google Calendar, LLM) are fragile and prone to latency/timeouts.
- **Reliability via BullMQ**: The Express request handler doesn't block waiting for an email to send. Instead, it inserts a job row into PostgreSQL and adds it to the Redis queue. 
- **Retry Strategy**: The BullMQ worker implements exponential backoff retries (up to 3 attempts). If it continuously fails, the database job row is marked `failed` for manual intervention.
- **LLM Failure Degradation**: The Anthropic API call is wrapped in a `try/catch`. On failure, the AI summary is marked as `failed`, allowing the React UI to degrade gracefully and show the raw symptoms/notes instead.
