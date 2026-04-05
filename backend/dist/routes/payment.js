"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
/** 결제 API 라우터 */
const express_1 = require("express");
const config_1 = require("../config");
const database_1 = require("../database");
const auth_1 = require("./auth");
exports.paymentRouter = (0, express_1.Router)();
/** 포트원 API 토큰 발급 (임시 구현) */
async function getPortOneToken() {
    if (!config_1.config.portOneImpKey || !config_1.config.portOneImpSecret) {
        throw new Error('포트원 API 키가 설정되지 않았습니다');
    }
    const res = await fetch('https://api.iamport.kr/users/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imp_key: config_1.config.portOneImpKey, imp_secret: config_1.config.portOneImpSecret }),
    });
    const data = await res.json();
    if (data.code !== 0)
        throw new Error(`포트원 토큰 발급 실패: ${data.message}`);
    return data.response.access_token;
}
/** 요금 정보 */
exports.paymentRouter.get('/price', (_req, res) => {
    res.json({ premium_price: config_1.config.premiumPrice, currency: 'KRW', interval: 'monthly' });
});
/** 결제 검증 + 프리미엄 활성화 */
exports.paymentRouter.post('/verify', auth_1.authMiddleware, async (req, res) => {
    const { imp_uid } = req.body;
    if (!imp_uid) {
        res.status(400).json({ detail: 'imp_uid가 필요합니다' });
        return;
    }
    try {
        // 포트원 결제 검증
        const token = await getPortOneToken();
        const payRes = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const payData = await payRes.json();
        if (payData.code !== 0) {
            res.status(400).json({ detail: `결제 조회 실패: ${payData.message}` });
            return;
        }
        if (payData.response.status !== 'paid') {
            res.status(400).json({ detail: '결제가 완료되지 않았습니다' });
            return;
        }
        if (payData.response.amount !== config_1.config.premiumPrice) {
            res.status(400).json({ detail: `결제 금액 불일치: ${payData.response.amount} != ${config_1.config.premiumPrice}` });
            return;
        }
        // 프리미엄 활성화
        const db = (0, database_1.getDb)();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare("UPDATE users SET subscription_status = 'premium', subscription_expires_at = ? WHERE id = ?")
            .run(expires, req.user.id);
        res.json({ ok: true, message: '프리미엄이 활성화되었습니다! ✨' });
    }
    catch (err) {
        res.status(400).json({ detail: String(err) });
    }
});
/** 구독 상태 */
exports.paymentRouter.get('/status', auth_1.authMiddleware, (req, res) => {
    const user = (0, database_1.getUserById)(req.user.id);
    if (!user) {
        res.status(401).json({ detail: '사용자를 찾을 수 없습니다' });
        return;
    }
    let status = user.subscription_status;
    if (status === 'premium' && user.subscription_expires_at) {
        if (new Date(user.subscription_expires_at) < new Date()) {
            const db = (0, database_1.getDb)();
            db.prepare("UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?")
                .run(user.id);
            status = 'free';
        }
    }
    res.json({ status, expires_at: user.subscription_expires_at });
});
/** 구독 취소 */
exports.paymentRouter.post('/cancel', auth_1.authMiddleware, (req, res) => {
    const db = (0, database_1.getDb)();
    db.prepare("UPDATE users SET subscription_status = 'cancelling' WHERE id = ?")
        .run(req.user.id);
    res.json({ ok: true, message: '구독이 만료 후 취소됩니다.' });
});
