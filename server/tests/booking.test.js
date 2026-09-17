const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app'); // now testable without starting a real server

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth + Booking behavior', () => {
  let token, userId;

  test('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User', email: 'test@example.com', password: 'password123'
    });
    expect(res.statusCode).toBe(201);
  });

  test('logs in and returns a token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com', password: 'password123'
    });
    expect(res.statusCode).toBe(200);
    token = res.body.token;
    userId = res.body.user.id;
  });

  test('rejects a self-booking attempt', async () => {
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