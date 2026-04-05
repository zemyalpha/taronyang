"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
/** 관리자 API 라우터 */
const express_1 = require("express");
const database_1 = require("../database");
const auth_1 = require("./auth");
exports.adminRouter = (0, express_1.Router)();
/** 대시보드 통계 */
exports.adminRouter.get('/stats', auth_1.authMiddleware, auth_1.adminMiddleware, (_req, res) => {
    const db = (0, database_1.getDb)();
    const totalUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get();
    const premiumUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE subscription_status = 'premium'").get();
    const todayUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE date(created_at) = date('now')").get();
    const totalReadings = db.prepare('SELECT COUNT(*) AS total FROM readings').get();
    const todayReadings = db.prepare("SELECT COUNT(*) AS total FROM readings WHERE date(created_at) = date('now')").get();
    res.json({
        total_users: totalUsers.total,
        premium_users: premiumUsers.total,
        free_users: totalUsers.total - premiumUsers.total,
        today_new_users: todayUsers.total,
        total_readings: totalReadings.total,
        today_readings: todayReadings.total,
    });
});
/** 사용자 목록 */
exports.adminRouter.get('/users', auth_1.authMiddleware, auth_1.adminMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const users = db.prepare('SELECT id, email, nickname, provider, subscription_status, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) AS total FROM users').get();
    res.json({
        users,
        total: total.total,
        page,
        pages: Math.ceil(total.total / limit),
    });
});
/** 전체 상담 기록 */
exports.adminRouter.get('/readings', auth_1.authMiddleware, auth_1.adminMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const readings = db.prepare('SELECT r.id, r.category, r.question, r.created_at, u.email, u.nickname FROM readings r LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) AS total FROM readings').get();
    res.json({
        readings,
        total: total.total,
        page,
        pages: Math.ceil(total.total / limit),
    });
});
/** 사용자 삭제 */
exports.adminRouter.delete('/users/:id', auth_1.authMiddleware, auth_1.adminMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM daily_horoscopes WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM readings WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});
