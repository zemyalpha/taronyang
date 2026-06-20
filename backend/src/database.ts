/** SQLite 데이터베이스 초기화 및 사용자 CRUD */
import Database from 'better-sqlite3';
import { config } from './config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from './logger';

let db: Database.Database;

/** DB 연결 반환 */
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/** 테이블 생성 */
export function initDb(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'email',
      provider_id TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      nickname TEXT,
      birth_date TEXT,
      zodiac_sign TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      free_count_today INTEGER NOT NULL DEFAULT 0,
      free_reset_date TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'free',
      subscription_expires_at TEXT,
      settings TEXT NOT NULL DEFAULT '{}',
      is_admin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      category TEXT NOT NULL,
      question TEXT,
      cards_drawn TEXT NOT NULL,
      card_positions TEXT NOT NULL,
      interpretation TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      rating INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_horoscopes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      date TEXT NOT NULL,
      zodiac_sign TEXT NOT NULL,
      card_name TEXT,
      summary TEXT,
      scores TEXT,
      lucky_color TEXT,
      lucky_number INTEGER,
      full_reading TEXT,
      email_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS processed_payments (
      imp_uid TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_horoscopes(date, zodiac_sign);
  `);
}

// --- 사용자 타입 ---
export interface User {
  id: string;
  provider: string;
  provider_id: string | null;
  email: string | null;
  password_hash: string | null;
  nickname: string | null;
  birth_date: string | null;
  zodiac_sign: string | null;
  created_at: string;
  free_count_today: number;
  free_reset_date: string | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  settings: string;
  is_admin: number;
}

/** 이메일 사용자 생성 */
export function createUser(email: string, password: string, nickname?: string): User | null {
  const db = getDb();
  const userId = randomUUID();
  const hashed = bcrypt.hashSync(password, 10);
  const nick = nickname || email.split('@')[0];

  try {
    db.prepare(
      'INSERT INTO users (id, provider, email, password_hash, nickname) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'email', email, hashed, nick);
    return getUserById(userId);
  } catch (err) {
    logger.error('사용자 생성 실패', { error: String(err) });
    return null;
  }
}

/** 이메일/비밀번호 확인 */
export function verifyUser(email: string, password: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ? AND provider = ?').get(email, 'email') as User | undefined;
  if (!row) return null;
  if (bcrypt.compareSync(password, row.password_hash || '')) return row;
  return null;
}

/** ID로 사용자 조회 */
export function getUserById(id: string): User | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User) || null;
}

/** 이메일로 사용자 조회 */
export function getUserByEmail(email: string): User | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User) || null;
}

/** 소셜 계정으로 찾기 또는 생성 */
export function findOrCreateOAuthUser(info: { provider: string; provider_id: string; email?: string; nickname?: string }): User {
  const db = getDb();

  // provider + provider_id로 찾기
  const existing = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(info.provider, info.provider_id) as User | undefined;
  if (existing) return existing;

  // 이메일로 기존 계정 찾기 (병합)
  if (info.email) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(info.email) as User | undefined;
    if (byEmail) {
      db.prepare('UPDATE users SET provider = ?, provider_id = ? WHERE id = ?').run(info.provider, info.provider_id, byEmail.id);
      return getUserById(byEmail.id)!;
    }
  }

  // 새 사용자 생성
  const userId = randomUUID();
  const nickname = info.nickname || info.email?.split('@')[0] || '사용자';
  db.prepare('INSERT INTO users (id, provider, provider_id, email, nickname) VALUES (?, ?, ?, ?, ?)').run(userId, info.provider, info.provider_id, info.email || null, nickname);
  return getUserById(userId)!;
}

function randomUUID(): string {
  return crypto.randomUUID();
}
