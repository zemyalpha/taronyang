/** Z.ai GLM API 클라이언트 */
import { config } from './config';

const LLM_TIMEOUT_MS = 45000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLlm(messages: ChatMessage[], maxTokens = 2000, temperature = 0.8): Promise<string> {
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
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Z.ai API 응답 형식 오류');
    }
    return data.choices[0].message.content;
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
    2000,
    0.85
  );
}
