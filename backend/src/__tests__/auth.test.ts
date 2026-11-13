import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { authMiddleware, authRouter } from '../routes/auth';
import { initDb, createUser } from '../database';
import { config } from '../config';

function createTestApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ ok: true, user_id: req.user!.id });
  });
  app.use(authRouter);
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

  it('accepts a valid token from the HttpOnly cookie (GitHub #296)', async () => {
    const user = createUser('cookie-user@example.com', 'password123', 'cookieuser')!;
    const token = makeToken(user.id);
    const res = await request(app)
      .get('/protected')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(user.id);
  });

  it('rejects an invalid cookie token (401)', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Cookie', ['token=not-a-valid-token']);
    expect(res.status).toBe(401);
  });

  it('prefers the Authorization header when both Bearer and cookie are present', async () => {
    const bearerUser = createUser('bearer@example.com', 'password123', 'bearer')!;
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${makeToken(bearerUser.id)}`)
      .set('Cookie', ['token=not-a-valid-token']);
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(bearerUser.id);
  });

  it('login sets an HttpOnly auth cookie and still returns the token in the body (GitHub #296)', async () => {
    createUser('login-cookie@example.com', 'password123', 'logincookie');
    const res = await request(app)
      .post('/login')
      .send({ email: 'login-cookie@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = setCookies.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
    expect(tokenCookie).toMatch(/Path=\//);
  });

  it('logout clears the auth cookie (GitHub #296)', async () => {
    const res = await request(app).post('/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const setCookies = res.headers['set-cookie'] as unknown as string[];
    const cleared = setCookies.find((c: string) => /^token=;/.test(c));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Thu, 01 Jan 1970/);
  });
});
