import { callLlm, RateLimitError, tarotReading } from '../llm';
import { config } from '../config';

describe('RateLimitError', () => {
  it('should set name and message correctly', () => {
    const err = new RateLimitError('too many requests');
    expect(err.message).toBe('too many requests');
    expect(err.name).toBe('RateLimitError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('callLlm', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('missing API key — should throw', async () => {
    const savedKey = config.zaiApiKey;
    (config as { zaiApiKey: string }).zaiApiKey = '';

    try {
      await expect(callLlm([])).rejects.toThrow('ZAI_API_KEY');
    } finally {
      (config as { zaiApiKey: string }).zaiApiKey = savedKey;
    }
  });

  it('successful response with content — should return content string', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '타로 해석 결과입니다' } }],
      }),
    }) as unknown as typeof fetch;

    const result = await callLlm([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);

    expect(result).toBe('타로 해석 결과입니다');
  });

  it('successful response with reasoning_content fallback — should return reasoning', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '', reasoning_content: '추론 내용' } }],
      }),
    }) as unknown as typeof fetch;

    const result = await callLlm([{ role: 'user', content: 'test' }]);
    expect(result).toBe('추론 내용');
  });

  it('non-retryable error (400) — should throw immediately without retry', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'invalid request',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(callLlm([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'Z.ai API 오류: 400'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('non-retryable error (404) — should throw immediately', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'not found',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(callLlm([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'Z.ai API 오류: 404'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rate limit (429) — should throw RateLimitError after exhausting retries', async () => {
    jest.useFakeTimers();

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'rate limited',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const promise = callLlm([{ role: 'user', content: 'test' }]);
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow(RateLimitError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('server error (500) — should retry then throw generic Error', async () => {
    jest.useFakeTimers();

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'server error',
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const promise = callLlm([{ role: 'user', content: 'test' }]);
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Z.ai API 오류: 500');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('network error — should retry then throw', async () => {
    jest.useFakeTimers();

    const mockFetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const promise = callLlm([{ role: 'user', content: 'test' }]);
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow('fetch failed');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('succeeds on retry after initial 500 — should return content', async () => {
    jest.useFakeTimers();

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'error',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '재시도 성공' } }],
        }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    const promise = callLlm([{ role: 'user', content: 'test' }]);
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('재시도 성공');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('custom maxTokens and temperature — should pass to API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'result' } }],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await callLlm([{ role: 'user', content: 'test' }], 2000, 0.5);

    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.max_tokens).toBe(2000);
    expect(callBody.temperature).toBe(0.5);
  });

  it('response with empty choices array — should throw format error (after retries)', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    }) as unknown as typeof fetch;

    const promise = callLlm([{ role: 'user', content: 'test' }]);
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Z.ai API 응답 형식 오류');
  });

  it('response with null content and reasoning — should throw (after retries)', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: null, reasoning_content: null } }],
      }),
    }) as unknown as typeof fetch;

    const promise = callLlm([{ role: 'user', content: 'test' }]);
    promise.catch(() => {});

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Z.ai API 응답 형식 오류');
  });
});

describe('tarotReading', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should delegate to callLlm with system + user messages', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '타로 결과' } }],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await tarotReading('system prompt', 'user question');
    expect(result).toBe('타로 결과');

    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user question' },
    ]);
    expect(callBody.max_tokens).toBe(4000);
    expect(callBody.temperature).toBe(0.85);
  });
});
