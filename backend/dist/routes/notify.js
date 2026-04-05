"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyRouter = void 0;
exports.getKstDate = getKstDate;
/** 알림 설정 API 라우터 */
const express_1 = require("express");
const database_1 = require("../database");
const auth_1 = require("./auth");
const dailyNotify_1 = require("../dailyNotify");
exports.notifyRouter = (0, express_1.Router)();
function getSettings(user) {
    try {
        return JSON.parse(user.settings || '{}');
    }
    catch {
        return {};
    }
}
/** 알림 설정 조회 */
exports.notifyRouter.get('/settings', auth_1.authMiddleware, (req, res) => {
    const user = req.user;
    const settings = getSettings(user);
    res.json({
        daily_email: settings.daily_email !== 0,
        notify_time: settings.notify_time || '07:00',
        notify_channel: settings.notify_channel || 'email',
        zodiac_sign: user.zodiac_sign || '',
    });
});
/** 알림 설정 변경 (json_set + 트랜잭션) */
exports.notifyRouter.put('/settings', auth_1.authMiddleware, (req, res) => {
    const user = req.user;
    const { daily_email, notify_time, notify_channel } = req.body;
    const db = (0, database_1.getDb)();
    const update = db.transaction(() => {
        if (daily_email !== undefined) {
            db.prepare("UPDATE users SET settings = json_set(COALESCE(settings, '{}'), '$.daily_email', ?) WHERE id = ?")
                .run(daily_email ? 1 : 0, user.id);
        }
        if (notify_time !== undefined) {
            db.prepare("UPDATE users SET settings = json_set(COALESCE(settings, '{}'), '$.notify_time', ?) WHERE id = ?")
                .run(notify_time, user.id);
        }
        if (notify_channel !== undefined) {
            db.prepare("UPDATE users SET settings = json_set(COALESCE(settings, '{}'), '$.notify_channel', ?) WHERE id = ?")
                .run(notify_channel, user.id);
        }
    });
    update();
    res.json({ ok: true });
});
/** 별자리 변경 */
exports.notifyRouter.put('/zodiac', auth_1.authMiddleware, (req, res) => {
    const validSigns = [
        '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
        '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
    ];
    const sign = req.body.zodiac_sign;
    if (!sign || !validSigns.includes(sign)) {
        res.status(400).json({ detail: `유효하지 않은 별자리: ${sign}` });
        return;
    }
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE users SET zodiac_sign = ? WHERE id = ?').run(sign, req.user.id);
    res.json({ ok: true });
});
/** 오늘의 운세 조회 (공개) */
exports.notifyRouter.get('/horoscope/:sign', async (req, res) => {
    const sign = req.params.sign;
    const validSigns = [
        '양자리', '황소자리', '쌍둥이자리', '게자리', '사자자리', '처녀자리',
        '천칭자리', '전갈자리', '사수자리', '염소자리', '물병자리', '물고기자리',
    ];
    if (!validSigns.includes(sign)) {
        res.status(400).json({ detail: '유효하지 않은 별자리입니다' });
        return;
    }
    const today = getKstDate();
    try {
        const horoscope = await (0, dailyNotify_1.generateDailyHoroscope)(sign, today);
        res.json({ zodiac_sign: sign, date: today, horoscope });
    }
    catch (err) {
        res.status(500).json({ detail: '운세 생성에 실패했습니다' });
    }
});
/** KST 기준 오늘 날짜 반환 */
function getKstDate() {
    return new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}
