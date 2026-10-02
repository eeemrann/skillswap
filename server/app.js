const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { clerkMiddleware } = require('@clerk/express');

const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const creditRoutes = require('./routes/creditRoutes');
const matchRoutes = require('./routes/matchRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const billingRoutes = require('./routes/billingRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const { webhook } = require('./controllers/billingController');
const { apiLimiter } = require('./middleware/rateLimits');
const { configuredOrigins } = require('./config');
const { HttpError } = require('./utils/transaction');

const app = express();

if (!process.env.CLERK_SECRET_KEY) {
  console.warn('[Clerk] CLERK_SECRET_KEY is not configured; token verification will fail.');
}

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

const devOrigins = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:8080'];
const allowedOrigins = [...new Set([...devOrigins, ...configuredOrigins()])];
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // same-origin, curl, Stripe webhooks
    return callback(null, allowedOrigins.includes(origin.replace(/\/+$/, '')));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count']
};
app.use(helmet());
app.use(cors(corsOptions));
// Express 5 requires a named wildcard parameter for a catch-all route.
app.options('/{*splat}', cors(corsOptions));

// Stripe signs the exact bytes it sends, so this route needs the raw body and must precede express.json().
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhook);

app.use(express.json({ limit: '100kb' }));
app.use(clerkMiddleware(process.env.CLERK_SECRET_KEY ? { secretKey: process.env.CLERK_SECRET_KEY } : {}));
app.use('/api', apiLimiter);

app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/catalog', catalogRoutes);
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
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message, ...err.extra });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large' });
  console.error('Unhandled request error:', { method: req.method, path: req.originalUrl, detail: err.message });
  return res.status(500).json({ message: 'Request could not be completed' });
});

module.exports = app;
module.exports.allowedOrigins = allowedOrigins;
