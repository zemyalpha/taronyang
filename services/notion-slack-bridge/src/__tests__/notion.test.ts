import {
  extractPropertyValue,
  summarizePage,
  NotionClient,
  NotionApiError,
} from '../notion';

function makePage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    object: 'page',
    id: 'page-1',
    url: 'https://notion.so/page-1',
    created_time: '2026-11-24T10:00:00.000Z',
    properties: {
      Name: {
        id: 'title',
        name: 'Name',
        type: 'title',
        title: [{ plain_text: 'Acme Corp' }],
      },
      Email: {
        name: 'Email',
        type: 'email',
        email: 'contact@acme.com',
      },
      Status: {
        name: 'Status',
        type: 'status',
        status: { name: 'Lead' },
      },
      Plan: { name: 'Plan', type: 'select', select: { name: 'Pro' } },
      Hidden: { name: 'Hidden', type: 'rollup', rollup: {} },
    },
    ...overrides,
  };
}

describe('extractPropertyValue', () => {
  it('extracts title text', () => {
    expect(
      extractPropertyValue({
        type: 'title',
        title: [{ plain_text: 'Hello' }, { plain_text: ' World' }],
      })
    ).toBe('Hello World');
  });

  it('extracts select/status/people/date/number/email/url values', () => {
    expect(extractPropertyValue({ type: 'select', select: { name: 'A' } })).toBe('A');
    expect(extractPropertyValue({ type: 'status', status: { name: 'B' } })).toBe('B');
    expect(
      extractPropertyValue({ type: 'people', people: [{ name: 'Kim' }, { name: 'Lee' }] })
    ).toBe('Kim, Lee');
    expect(
      extractPropertyValue({ type: 'date', date: { start: '2026-01-01' } })
    ).toBe('2026-01-01');
    expect(
      extractPropertyValue({ type: 'date', date: { start: '2026-01-01', end: '2026-02-01' } })
    ).toBe('2026-01-01 ~ 2026-02-01');
    expect(extractPropertyValue({ type: 'number', number: 42 })).toBe('42');
    expect(extractPropertyValue({ type: 'email', email: 'a@b.c' })).toBe('a@b.c');
    expect(extractPropertyValue({ type: 'url', url: 'https://x.dev' })).toBe('https://x.dev');
  });

  it('returns null for unsupported or empty types', () => {
    expect(extractPropertyValue({ type: 'rollup', rollup: {} })).toBeNull();
    expect(extractPropertyValue({ type: 'rich_text', rich_text: [] })).toBeNull();
    expect(extractPropertyValue(null)).toBeNull();
  });
});

describe('summarizePage', () => {
  it('builds summary with title and non-title properties', () => {
    const summary = summarizePage(makePage());
    expect(summary.id).toBe('page-1');
    expect(summary.title).toBe('Acme Corp');
    expect(summary.url).toBe('https://notion.so/page-1');
    expect(summary.properties).toEqual([
      { name: 'Email', value: 'contact@acme.com' },
      { name: 'Status', value: 'Lead' },
      { name: 'Plan', value: 'Pro' },
    ]);
  });

  it('falls back to 제목 없음 when no title property', () => {
    const summary = summarizePage(makePage({ properties: {} }));
    expect(summary.title).toBe('제목 없음');
  });
});

describe('NotionClient.queryPagesCreatedAfter', () => {
  function makeClient(
    responses: Array<{ status: number; body: unknown }>,
    calls: Array<{ url: string; body: Record<string, unknown> }> = []
  ) {
    let index = 0;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const res = responses[Math.min(index, responses.length - 1)];
      index++;
      calls.push({ url, body: JSON.parse(init?.body as string) });
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        headers: { get: () => null },
        json: async () => res.body,
      } as unknown as Response;
    }) as typeof fetch;
    return new NotionClient({
      token: 'secret-t',
      databaseId: 'db-1',
      fetchImpl,
    });
  }

  it('sends correct filter and sorts, returns summaries', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const client = makeClient(
      [{ status: 200, body: { results: [makePage()], has_more: false } }],
      calls
    );
    const pages = await client.queryPagesCreatedAfter('2026-11-24T00:00:00.000Z');

    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Acme Corp');
    expect(calls[0].url).toBe('https://api.notion.com/v1/databases/db-1/query');
    expect(calls[0].body.filter).toEqual({
      timestamp: 'created_time',
      created_time: { after: '2026-11-24T00:00:00.000Z' },
    });
    expect(calls[0].body.sorts).toEqual([
      { timestamp: 'created_time', direction: 'ascending' },
    ]);
  });

  it('follows pagination via next_cursor', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const client = makeClient(
      [
        {
          status: 200,
          body: { results: [makePage()], has_more: true, next_cursor: 'c2' },
        },
        {
          status: 200,
          body: {
            results: [makePage({ id: 'page-2', created_time: '2026-11-24T11:00:00.000Z' })],
            has_more: false,
          },
        },
      ],
      calls
    );
    const pages = await client.queryPagesCreatedAfter('2026-01-01T00:00:00.000Z');

    expect(pages).toHaveLength(2);
    expect(calls[1].body.start_cursor).toBe('c2');
  });

  it('throws NotionApiError with code on API failure', async () => {
    const client = makeClient([
      {
        status: 401,
        body: { code: 'unauthorized', message: 'API token is invalid.' },
      },
    ]);
    await expect(
      client.queryPagesCreatedAfter('2026-01-01T00:00:00.000Z')
    ).rejects.toThrow(NotionApiError);
    await expect(
      client.queryPagesCreatedAfter('2026-01-01T00:00:00.000Z')
    ).rejects.toThrow(/unauthorized|invalid/i);
  });
});
