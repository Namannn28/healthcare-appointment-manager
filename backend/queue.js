const { Queue, Worker } = require('bullmq');
const db = require('./db');

const connection = {
  host: 'localhost',
  port: 6379,
};

const notificationQueue = new Queue('notifications', { connection });

const addNotificationJob = async (type, payload) => {
  // Store in DB for reliability
  const result = await db.query(
    'INSERT INTO notifications_job (type, payload) VALUES ($1, $2) RETURNING id',
    [type, payload]
  );
  
  // Add to BullMQ with retries
  await notificationQueue.add('process_notification', 
    { jobId: result.rows[0].id, type, payload }, 
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
};

// Worker definition
const worker = new Worker('notifications', async job => {
  const { jobId, type, payload } = job.data;
  try {
    if (type === 'email') {
      console.log(`Sending email for job ${jobId}`, payload);
      // Implement Nodemailer logic here
    } else if (type === 'calendar') {
      console.log(`Updating calendar for job ${jobId}`, payload);
      // Implement Google Calendar logic here
    }
    
    await db.query("UPDATE notifications_job SET status = 'sent' WHERE id = $1", [jobId]);
  } catch (error) {
    await db.query("UPDATE notifications_job SET attempts = attempts + 1 WHERE id = $1", [jobId]);
    throw error; // Let BullMQ retry
  }
}, { connection });

worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await db.query("UPDATE notifications_job SET status = 'failed' WHERE id = $1", [job.data.jobId]);
  }
  console.error(`Job ${job.id} failed:`, err.message);
});

module.exports = { addNotificationJob };
