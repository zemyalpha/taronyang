import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../routes/auth';
import { initDb, createUser } from '../database';
import { config } from '../config';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ ok: true, user_id: req.user!.id });
  });
  return app;
}

describe('authMiddleware', () => {
  let app: express.Application;

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeEach(() => {
    const { getDb } = require('../database');
    getDb().prepare('DELETE FROM users').run();
  });

  function makeToken(userId: string, secret?: string): string {
    return jwt.sign({ user_id: userId }, secret ?? config.jwtSecret, { expiresIn: '7d' });
  }

  it('rejects request without Authorization header (401)', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.detail).toBeDefined();
  });

  it('rejects request with malformed token (401)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });

  it('rejects request signed with wrong secret (401)', async () => {
    const user = createUser('wrong-secret@example.com', 'password123', 'wrongsecret')!;
    const token = makeToken(user.id, 'a-completely-different-secret');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and populates req.user (200)', async () => {
    const user = createUser('valid@example.com', 'password123', 'validuser')!;
    const token = makeToken(user.id);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(user.id);
  });
});
