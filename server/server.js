require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { startEmailWorker } = require('./services/notificationService');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const stopEmailWorker = startEmailWorker();
    const server = app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
    const shutdown = (signal) => {
      console.log(`${signal} received; shutting down`);
      stopEmailWorker();
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
