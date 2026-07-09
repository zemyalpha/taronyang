/** Z.ai GLM API 클라이언트 */
import { config } from './config';

const LLM_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 2000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callLlm(messages: ChatMessage[], maxTokens = 4000, temperature = 0.8): Promise<string> {
  if (!config.zaiApiKey) {
    throw new Error('ZAI_API_KEY가 설정되지 않았습니다');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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

      if (response.status === 429) {
        const body = await response.text().catch(() => '');
        lastError = new RateLimitError(`Z.ai API 오류: 429 Too Many Requests ${body.slice(0, 200)}`);
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Z.ai API 오류: ${response.status} ${response.statusText} ${body.slice(0, 200)}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }> };
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
    } catch (err: unknown) {
      if (err instanceof RateLimitError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Z.ai API 타임아웃 (${LLM_TIMEOUT_MS}ms)`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('Z.ai API 호출 실패 (알 수 없는 오류)');
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
