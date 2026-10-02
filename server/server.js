require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { syncIndexes } = require('./models');
const { attachSockets } = require('./sockets');
const { startEmailWorker } = require('./services/notificationService');
const { startSessionWorker } = require('./services/sessionWorker');
const { startPayoutWorker } = require('./services/payoutService');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await syncIndexes().catch((error) => console.error('Index sync failed:', error.message));

    const server = http.createServer(app);
    const io = attachSockets(server, { origins: app.allowedOrigins });
    const stopEmailWorker = startEmailWorker();
    const stopSessionWorker = startSessionWorker();
    const stopPayoutWorker = startPayoutWorker();

    const port = Number(process.env.PORT || 5000);
    server.listen(port, () => console.log(`Server running on port ${port}`));

    const shutdown = (signal) => {
      console.log(`${signal} received; shutting down`);
      stopEmailWorker();
      stopSessionWorker();
      stopPayoutWorker();
      io.close();
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exitCode = 1;
  });
