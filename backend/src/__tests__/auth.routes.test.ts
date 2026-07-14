import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authRouter } from '../routes/auth';
import { initDb, getDb, createUser, User } from '../database';
import { config } from '../config';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, config.jwtSecret, { expiresIn: '7d' });
}

function createTestUser(email: string, password: string, nickname?: string): User {
  const user = createUser(email, password, nickname);
  if (!user) throw new Error(`Failed to create test user: ${email}`);
  return user;
}

describe('auth routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    const db = getDb();
    db.prepare('DELETE FROM users').run();
    app = createApp();
  });

  // --- POST /api/auth/signup ---

  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns a token (200)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'newuser@test.com', password: 'password123', nickname: 'newbie' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('newuser@test.com');
      expect(res.body.user.nickname).toBe('newbie');
    });

    it('rejects duplicate email (409)', async () => {
      createUser('dup@test.com', 'password123');
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@test.com', password: 'password123' });

      expect(res.status).toBe(409);
    });

    it('rejects invalid email (400)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('rejects short password (400)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'short@test.com', password: '123' });

      expect(res.status).toBe(400);
    });
  });

  // --- POST /api/auth/login ---

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials (200)', async () => {
      createUser('login@test.com', 'password123', 'loginer');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@test.com');
    });

    it('rejects wrong password (401)', async () => {
      createUser('wrongpw@test.com', 'password123');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrongpw@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('rejects non-existent user (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noexist@test.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('rejects invalid email format (400)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad', password: 'password123' });

      expect(res.status).toBe(400);
    });
  });

  // --- GET /api/auth/me ---

  describe('GET /api/auth/me', () => {
    it('returns user info when authenticated (200)', async () => {
      const user = createTestUser('me@test.com', 'password123', 'meuser');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken(user.id)}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@test.com');
      expect(res.body.nickname).toBe('meuser');
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // --- PUT /api/auth/me ---

  describe('PUT /api/auth/me', () => {
    it('updates nickname (200)', async () => {
      const user = createTestUser('nick@test.com', 'password123');
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ nickname: 'newnick' });

      expect(res.status).toBe(200);
      expect(res.body.nickname).toBe('newnick');
    });

    it('updates birth_date and calculates zodiac sign (200)', async () => {
      const user = createTestUser('birth@test.com', 'password123');
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ birth_date: '1995-04-15' });

      expect(res.status).toBe(200);
      const db = getDb();
      const row = db.prepare('SELECT zodiac_sign FROM users WHERE id = ?').get(user.id) as { zodiac_sign: string };
      expect(row.zodiac_sign).toBe('양자리');
    });

    it('rejects invalid date format (400)', async () => {
      const user = createTestUser('baddate@test.com', 'password123');
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken(user.id)}`)
        .send({ birth_date: 'not-a-date' });

      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated request (401)', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .send({ nickname: 'test' });

      expect(res.status).toBe(401);
    });
  });

  // --- GET /api/auth/oauth/urls ---

  describe('GET /api/auth/oauth/urls', () => {
    it('returns an object of OAuth URLs (200)', async () => {
      const res = await request(app).get('/api/auth/oauth/urls');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Object);
    });
  });
});
