"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callLlm = callLlm;
exports.tarotReading = tarotReading;
/** Z.ai GLM API 클라이언트 */
const config_1 = require("./config");
/** Z.ai GLM API 호출 */
async function callLlm(messages, maxTokens = 2000, temperature = 0.8) {
    const response = await fetch(config_1.config.zaiApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config_1.config.zaiApiKey}`,
        },
        body: JSON.stringify({
            model: config_1.config.zaiModel,
            messages,
            max_tokens: maxTokens,
            temperature,
        }),
    });
    if (!response.ok) {
        throw new Error(`Z.ai API 오류: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}
/** 타로 해석 */
async function tarotReading(systemPrompt, userPrompt) {
    return callLlm([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ], 2000, 0.85);
}
