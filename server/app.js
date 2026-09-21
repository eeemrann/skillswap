const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { clerkMiddleware } = require('@clerk/express');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const creditRoutes = require('./routes/creditRoutes');
const matchRoutes = require('./routes/matchRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
const allowedOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:8080,https://skillswap-rho-five.vercel.app')
  .split(',').map((value) => value.trim()).filter(Boolean);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  }
}));
app.use(express.json({ limit: '100kb' }));
app.use(clerkMiddleware());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts, please try again later' }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.send('SkillSwap API is running!');
});

app.get('/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({ status: databaseConnected ? 'ok' : 'degraded', databaseConnected });
});

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', { method: req.method, path: req.originalUrl, detail: err.message });
  if (res.headersSent) return next(err);
  return res.status(err.message === 'Origin is not allowed' ? 403 : 500).json({ message: 'Request could not be completed' });
});

module.exports = app;
