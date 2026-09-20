const axios = require('axios');
const Notification = require('../models/Notification');

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
      { timeout: Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS || 30000) }
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

async function createInAppNotification({ userId, type, message, relatedId }) {
  try {
    return await Notification.create({ userId, type, message, relatedId });
  } catch (error) {
    console.error('In-app notification creation failed:', { userId, type, relatedId, detail: error.message });
    return null;
  }
}

module.exports = { notify, createInAppNotification };
