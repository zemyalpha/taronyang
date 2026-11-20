import express, { Express } from 'express';
import request from 'supertest';
import { initDb, getDb, createUser } from '../database';
import { authRouter } from '../routes/auth';
import { readingsRouter, saveReading } from '../routes/readings';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-key';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/readings', readingsRouter);
  return app;
}

function makeToken(userId: string): string {
  return jwt.sign({ user_id: userId }, TEST_SECRET, { expiresIn: '7d' });
}

describe('readings routes', () => {
  let app: Express;

  beforeEach(() => {
    initDb();
    app = createApp();
  });

  describe('GET /readings', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/readings');
      expect(res.status).toBe(401);
    });

    it('returns empty list for new user', async () => {
      const user = createUser('reader1@test.com', 'pass123');
      const res = await request(app)
        .get('/readings')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('returns saved readings ordered by newest first', async () => {
      const user = createUser('reader2@test.com', 'pass123');
      saveReading(user!.id, 'love', '질문1', [], '해석1');
      saveReading(user!.id, 'career', '질문2', [], '해석2');

      const res = await request(app)
        .get('/readings')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('only returns own readings', async () => {
      const user1 = createUser('reader3@test.com', 'pass123');
      const user2 = createUser('reader4@test.com', 'pass123');
      saveReading(user1!.id, 'love', 'private', [], '비공개');

      const res = await request(app)
        .get('/readings')
        .set('Authorization', `Bearer ${makeToken(user2!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /readings/:readingId', () => {
    it('returns 404 for non-existent reading', async () => {
      const user = createUser('reader5@test.com', 'pass123');
      const res = await request(app)
        .get('/readings/nonexistent-id')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(404);
    });

    it('returns reading detail for own reading', async () => {
      const user = createUser('reader6@test.com', 'pass123');
      const id = saveReading(user!.id, 'love', '테스트 질문', [], '테스트 해석');

      const res = await request(app)
        .get(`/readings/${id}`)
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.category).toBe('love');
    });

    it('returns 404 for other user reading', async () => {
      const user1 = createUser('reader7@test.com', 'pass123');
      const user2 = createUser('reader8@test.com', 'pass123');
      const id = saveReading(user1!.id, 'love', '비공개', [], '비공개 해석');

      const res = await request(app)
        .get(`/readings/${id}`)
        .set('Authorization', `Bearer ${makeToken(user2!.id)}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /readings/:readingId', () => {
    it('deletes own reading', async () => {
      const user = createUser('reader9@test.com', 'pass123');
      const id = saveReading(user!.id, 'love', '삭제할 질문', [], '삭제할 해석');

      const res = await request(app)
        .delete(`/readings/${id}`)
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const verify = await request(app)
        .get(`/readings/${id}`)
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(verify.status).toBe(404);
    });

    it('returns 404 when deleting non-existent reading', async () => {
      const user = createUser('reader10@test.com', 'pass123');
      const res = await request(app)
        .delete('/readings/nonexistent-id')
        .set('Authorization', `Bearer ${makeToken(user!.id)}`);
      expect(res.status).toBe(404);
      expect(res.body.detail).toBeDefined();
    });

    it('returns 404 when deleting other user reading', async () => {
      const user1 = createUser('reader11@test.com', 'pass123');
      const user2 = createUser('reader12@test.com', 'pass123');
      const id = saveReading(user1!.id, 'love', '비공개', [], '비공개 해석');

      const res = await request(app)
        .delete(`/readings/${id}`)
        .set('Authorization', `Bearer ${makeToken(user2!.id)}`);
      expect(res.status).toBe(404);

      const stillThere = await request(app)
        .get(`/readings/${id}`)
        .set('Authorization', `Bearer ${makeToken(user1!.id)}`);
      expect(stillThere.status).toBe(200);
    });
  });
});
