const axios = require('axios');
const Notification = require('../models/Notification');
const EmailJob = require('../models/EmailJob');

const MAX_EMAIL_ATTEMPTS = 5;
const CLERK_MANAGED_EMAIL_TYPES = new Set(['EMAIL_VERIFICATION']);

async function notify(type, recipientEmail, data) {
  const serviceUrl = process.env.NOTIFICATION_SERVICE_URL;
  if (!serviceUrl || !recipientEmail) {
    console.error('Email notification skipped:', {
      type,
      reason: !serviceUrl ? 'NOTIFICATION_SERVICE_URL is not configured' : 'recipient email is missing'
    });
    return { delivered: false };
  }

  try {
    const response = await axios.post(`${serviceUrl.replace(/\/$/, '')}/notify`,
      { type, recipientEmail, data },
      {
        timeout: Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS || 10000),
        headers: { 'X-Notification-Key': process.env.NOTIFICATION_SERVICE_API_KEY || '' }
      }
    );
    if (!response.data?.delivered) throw new Error(response.data?.reason || 'provider did not confirm delivery');
    return response.data;
  } catch (error) {
    console.error('Email notification delivery failed:', {
      type,
      recipientEmail,
      status: error.response?.status,
      detail: error.response?.data?.message || error.message
    });
    return { delivered: false, error: error.message };
  }
}

async function queueEmail(type, recipientEmail, data) {
  if (CLERK_MANAGED_EMAIL_TYPES.has(type)) {
    console.warn('Email notification was not queued:', { type, reason: 'Clerk manages email verification' });
    return null;
  }
  if (!recipientEmail) {
    console.error('Email notification was not queued:', { type, reason: 'recipient email is missing' });
    return null;
  }
  try {
    return await EmailJob.create({ type, recipientEmail, data });
  } catch (error) {
    console.error('Email notification queue failed:', { type, recipientEmail, detail: error.message });
    return null;
  }
}

async function processNextEmailJob() {
  const job = await EmailJob.findOneAndUpdate(
    { $or: [
      { status: 'pending', nextAttemptAt: { $lte: new Date() } },
      { status: 'processing', updatedAt: { $lte: new Date(Date.now() - 10 * 60 * 1000) } }
    ] },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, new: true }
  );
  if (!job) return false;

  const result = await notify(job.type, job.recipientEmail, job.data);
  if (result.delivered) {
    job.status = 'sent';
    job.sentAt = new Date();
    job.lastError = '';
  } else if (job.attempts >= MAX_EMAIL_ATTEMPTS) {
    job.status = 'dead';
    job.lastError = result.error || 'Delivery failed';
    console.error('Email notification permanently failed:', { jobId: job.id, type: job.type, recipientEmail: job.recipientEmail });
  } else {
    job.status = 'pending';
    job.lastError = result.error || 'Delivery failed';
    job.nextAttemptAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 30000 * (2 ** (job.attempts - 1))));
  }
  await job.save();
  return true;
}

function startEmailWorker() {
  const intervalMs = Number(process.env.EMAIL_WORKER_INTERVAL_MS || 5000);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      while (await processNextEmailJob()) { /* drain all ready jobs */ }
    } catch (error) {
      console.error('Email worker failed:', { detail: error.message });
    } finally {
      running = false;
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

async function createInAppNotification({ userId, type, message, relatedId }) {
  try {
    return await Notification.create({ userId, type, message, relatedId });
  } catch (error) {
    console.error('In-app notification creation failed:', { userId, type, relatedId, detail: error.message });
    return null;
  }
}

module.exports = { notify, queueEmail, processNextEmailJob, startEmailWorker, createInAppNotification };
