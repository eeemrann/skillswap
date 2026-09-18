const axios = require('axios');

function notify(type, recipientEmail, data) {
  const serviceUrl = process.env.NOTIFICATION_SERVICE_URL;
  if (!serviceUrl || !recipientEmail) return;

  axios.post(`${serviceUrl}/notify`, { type, recipientEmail, data }, { timeout: 3000 })
    .catch((error) => console.error('Notification delivery failed:', error.message));
}

module.exports = { notify };
