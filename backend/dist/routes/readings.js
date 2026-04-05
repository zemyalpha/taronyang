"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readingsRouter = void 0;
exports.saveReading = saveReading;
/** 상담 기록 저장 서비스 및 라우터 */
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const database_1 = require("../database");
const auth_1 = require("./auth");
/** 상담 기록 저장 */
function saveReading(userId, category, question, cards, interpretation) {
    const db = (0, database_1.getDb)();
    const id = crypto_1.default.randomUUID();
    db.prepare('INSERT INTO readings (id, user_id, category, question, cards_drawn, card_positions, interpretation) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, userId, category, question, JSON.stringify(cards), '[]', interpretation);
    return id;
}
exports.readingsRouter = (0, express_1.Router)();
/** 내 상담 기록 목록 */
exports.readingsRouter.get('/', auth_1.authMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json(rows);
});
/** 상담 기록 상세 */
exports.readingsRouter.get('/:readingId', auth_1.authMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    const row = db.prepare('SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE id = ? AND user_id = ?').get(req.params.readingId, req.user.id);
    if (!row) {
        res.status(404).json({ detail: '기록을 찾을 수 없습니다' });
        return;
    }
    res.json(row);
});
/** 상담 기록 삭제 */
exports.readingsRouter.delete('/:readingId', auth_1.authMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM readings WHERE id = ? AND user_id = ?').run(req.params.readingId, req.user.id);
    res.json({ ok: true });
});
