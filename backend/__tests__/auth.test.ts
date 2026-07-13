import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/routes/auth';
import { initDb, createUser, getDb } from '../src/database';

beforeAll(() => {
  initDb();
});

afterEach(() => {
  const db = getDb();
  db.prepare('DELETE FROM users').run();
});

describe('authMiddleware', () => {
  it('rejects requests without an Authorization header (401)', () => {
    const req = { headers: {} } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with a malformed Bearer token (401)', () => {
    const req = {
      headers: { authorization: 'Bearer not-a-valid-token' },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret (401)', () => {
    const wrongToken = jwt.sign({ user_id: 'some-id' }, 'wrong-secret');
    const req = {
      headers: { authorization: `Bearer ${wrongToken}` },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token and attaches the user to the request', () => {
    const user = createUser('test@example.com', 'password123', 'tester')!;
    const token = jwt.sign({ user_id: user.id }, 'test-secret-key');

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).user).toBeDefined();
    expect((req as any).user.id).toBe(user.id);
    expect(res.status).not.toHaveBeenCalled();
  });
});
