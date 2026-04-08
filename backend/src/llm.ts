/** Z.ai GLM API 클라이언트 */
import { config } from './config';

const LLM_TIMEOUT_MS = 60000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLlm(messages: ChatMessage[], maxTokens = 4000, temperature = 0.8): Promise<string> {
  if (!config.zaiApiKey) {
    throw new Error('ZAI_API_KEY가 설정되지 않았습니다');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(config.zaiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.zaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.zaiModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Z.ai API 오류: ${response.status} ${response.statusText} ${body.slice(0, 200)}`);
    }

    const data = await response.json() as any;
    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error('Z.ai API 응답 형식 오류');
    }
    const content = message.content;
    if (content === undefined || content === null) {
      throw new Error('Z.ai API 응답 형식 오류');
    }
    if (typeof content === 'string' && content.length > 0) {
      return content;
    }
    const reasoning = message.reasoning_content;
    if (typeof reasoning === 'string' && reasoning.length > 0) {
      return reasoning;
    }
    throw new Error('Z.ai API 응답 형식 오류: content와 reasoning_content 모두 비어있음');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Z.ai API 타임아웃 (${LLM_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 타로 해석 */
export async function tarotReading(systemPrompt: string, userPrompt: string): Promise<string> {
  return callLlm(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    4000,
    0.85
  );
}
