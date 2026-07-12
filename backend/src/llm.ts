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

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
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

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const status = response.status;
        const errorMsg = `Z.ai API 오류: ${status} ${response.statusText} ${body.slice(0, 200)}`;

        if (isRetryableStatus(status) && attempt < MAX_RETRIES) {
          lastError = status === 429 ? new RateLimitError(errorMsg) : new Error(errorMsg);
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        throw status === 429
          ? new RateLimitError(errorMsg)
          : isRetryableStatus(status)
            ? new Error(errorMsg)
            : new NonRetryableError(errorMsg);
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
      if (err instanceof RateLimitError || err instanceof NonRetryableError) {
        throw err;
      }

      const isAbort = err instanceof Error && err.name === 'AbortError';
      const error = isAbort
        ? new Error(`Z.ai API 타임아웃 (${LLM_TIMEOUT_MS}ms)`)
        : (err instanceof Error ? err : new Error(String(err)));

      if (attempt < MAX_RETRIES) {
        lastError = error;
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      throw error;
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
