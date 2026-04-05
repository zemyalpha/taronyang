"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initDb = initDb;
exports.createUser = createUser;
exports.verifyUser = verifyUser;
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.findOrCreateOAuthUser = findOrCreateOAuthUser;
/** SQLite 데이터베이스 초기화 및 사용자 CRUD */
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const config_1 = require("./config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
let db;
/** DB 연결 반환 */
function getDb() {
    if (!db) {
        db = new better_sqlite3_1.default(config_1.config.databasePath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}
/** 테이블 생성 */
function initDb() {
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

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_horoscopes(date, zodiac_sign);
  `);
}
/** 이메일 사용자 생성 */
function createUser(email, password, nickname) {
    const db = getDb();
    const userId = randomUUID();
    const hashed = bcryptjs_1.default.hashSync(password, 10);
    const nick = nickname || email.split('@')[0];
    try {
        db.prepare('INSERT INTO users (id, provider, email, password_hash, nickname) VALUES (?, ?, ?, ?, ?)').run(userId, 'email', email, hashed, nick);
        return getUserById(userId);
    }
    catch (err) {
        console.error('사용자 생성 실패:', err);
        return null;
    }
}
/** 이메일/비밀번호 확인 */
function verifyUser(email, password) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ? AND provider = ?').get(email, 'email');
    if (!row)
        return null;
    if (bcryptjs_1.default.compareSync(password, row.password_hash || ''))
        return row;
    return null;
}
/** ID로 사용자 조회 */
function getUserById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}
/** 이메일로 사용자 조회 */
function getUserByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}
/** 소셜 계정으로 찾기 또는 생성 */
function findOrCreateOAuthUser(info) {
    const db = getDb();
    // provider + provider_id로 찾기
    const existing = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(info.provider, info.provider_id);
    if (existing)
        return existing;
    // 이메일로 기존 계정 찾기 (병합)
    if (info.email) {
        const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(info.email);
        if (byEmail) {
            db.prepare('UPDATE users SET provider = ?, provider_id = ? WHERE id = ?').run(info.provider, info.provider_id, byEmail.id);
            return getUserById(byEmail.id);
        }
    }
    // 새 사용자 생성
    const userId = randomUUID();
    const nickname = info.nickname || info.email?.split('@')[0] || '사용자';
    db.prepare('INSERT INTO users (id, provider, provider_id, email, nickname) VALUES (?, ?, ?, ?, ?)').run(userId, info.provider, info.provider_id, info.email || null, nickname);
    return getUserById(userId);
}
function randomUUID() {
    return crypto_1.default.randomUUID();
}
