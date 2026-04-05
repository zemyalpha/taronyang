/** Z.ai GLM API 클라이언트 */
import { config } from './config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Z.ai GLM API 호출 */
export async function callLlm(messages: ChatMessage[], maxTokens = 2000, temperature = 0.8): Promise<string> {
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
  });

  if (!response.ok) {
    throw new Error(`Z.ai API 오류: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
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
