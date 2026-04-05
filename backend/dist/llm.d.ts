interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
/** Z.ai GLM API 호출 */
export declare function callLlm(messages: ChatMessage[], maxTokens?: number, temperature?: number): Promise<string>;
/** 타로 해석 */
export declare function tarotReading(systemPrompt: string, userPrompt: string): Promise<string>;
export {};
