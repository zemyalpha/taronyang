"""데이터베이스 모델 및 연결"""
import os
import sqlite3
import uuid
import bcrypt

DB_PATH = os.getenv("DATABASE_PATH", "./taronyang.db")


def get_db():
    """DB 연결 반환"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """테이블 생성"""
    conn = get_db()
    conn.executescript("""
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
    """)
    conn.commit()
    conn.close()


# --- 사용자 함수 ---

def create_user(email: str, password: str, nickname: str = None) -> dict:
    """이메일 사용자 생성"""
    user_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    if not nickname:
        nickname = email.split("@")[0]

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (id, provider, email, password_hash, nickname) VALUES (?, ?, ?, ?, ?)",
            (user_id, "email", email, hashed, nickname)
        )
        conn.commit()
        return get_user_by_id(user_id)
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def verify_user(email: str, password: str) -> dict | None:
    """이메일/비밀번호 확인"""
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ? AND provider = 'email'", (email,)).fetchone()
    conn.close()
    if not row:
        return None
    if bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        return dict(row)
    return None


def get_user_by_id(user_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_email(email: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None
