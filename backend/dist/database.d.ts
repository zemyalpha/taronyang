/** SQLite 데이터베이스 초기화 및 사용자 CRUD */
import Database from 'better-sqlite3';
/** DB 연결 반환 */
export declare function getDb(): Database.Database;
/** 테이블 생성 */
export declare function initDb(): void;
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
export declare function createUser(email: string, password: string, nickname?: string): User | null;
/** 이메일/비밀번호 확인 */
export declare function verifyUser(email: string, password: string): User | null;
/** ID로 사용자 조회 */
export declare function getUserById(id: string): User | null;
/** 이메일로 사용자 조회 */
export declare function getUserByEmail(email: string): User | null;
/** 소셜 계정으로 찾기 또는 생성 */
export declare function findOrCreateOAuthUser(info: {
    provider: string;
    provider_id: string;
    email?: string;
    nickname?: string;
}): User;
