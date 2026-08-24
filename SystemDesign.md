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
- **Reliability via n8n Automation**: The Express request handler doesn't block waiting for an email to send. Instead, it fires an HTTP POST request to an **n8n Webhook**, which handles the actual email and calendar API interactions via its visual node workflow. We log the job in `notifications_job` before calling the webhook so we have an audit trail.
- **Retry Strategy**: n8n workflows can be configured to retry failed nodes. If the webhook call itself fails (e.g. n8n is down), the backend increments an `attempts` counter in the database.
- **LLM Failure Degradation**: The Anthropic API call for both Pre-visit and Post-visit summaries is wrapped in a `try/catch`. On failure, the AI summary is marked as `failed`, allowing the React UI to degrade gracefully and show the raw symptoms/notes instead.
