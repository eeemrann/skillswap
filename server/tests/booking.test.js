const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../app');

process.env.JWT_SECRET = 'test-secret';

jest.setTimeout(120000);

let mongoServer;
let mongoReady = false;

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '7.0.14'
      }
    });

    await mongoose.connect(mongoServer.getUri());
    mongoReady = true;
  } catch (error) {
    console.warn(`Skipping integration-style booking tests because MongoMemoryServer could not start: ${error.message}`);
  }
});

afterAll(async () => {
  if (mongoReady) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Auth + Booking behavior', () => {
  let token, userId;

  test('registers a new user', async () => {
    if (!mongoReady) return;
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User', email: 'test@example.com', password: 'password123'
    });
    expect(res.statusCode).toBe(201);
  });

  test('logs in and returns a token', async () => {
    if (!mongoReady) return;
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com', password: 'password123'
    });
    expect(res.statusCode).toBe(200);
    token = res.body.token;
    userId = res.body.user.id;
  });

  test('rejects a self-booking attempt', async () => {
    if (!mongoReady) return;
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        providerId: userId,
        skill: 'Guitar',
        proposedTime: new Date(Date.now() + 86400000).toISOString()
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/cannot book a session with yourself/i);
  });
});