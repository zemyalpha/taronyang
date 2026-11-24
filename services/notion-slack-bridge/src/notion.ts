/**
 * Notion API 클라이언트 (런타임 의존성 없음 — 네이티브 fetch 사용).
 * 고객 DB를 created_time 기준으로 조회해 신규 페이지를 반환한다.
 */
import { NotionPageSummary, NotionPropertyValue } from './types';

export class NotionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}

interface NotionPropertySchema {
  id?: string;
  name?: string;
  type?: string;
}

interface NotionRichTextItem {
  plain_text?: string;
}

interface NotionPageObject {
  object?: string;
  id?: string;
  url?: string;
  created_time?: string;
  properties?: Record<string, unknown>;
}

interface NotionQueryResponse {
  object?: string;
  results?: NotionPageObject[];
  has_more?: boolean;
  next_cursor?: string | null;
}

/** 페이지 속성 값(basic 타입 위주)을 표시용 문자열로 변환 */
export function extractPropertyValue(prop: unknown): string | null {
  if (prop === null || typeof prop !== 'object') return null;
  const p = prop as Record<string, unknown>;
  const type = typeof p.type === 'string' ? p.type : '';

  switch (type) {
    case 'title': {
      const items = (p.title as NotionRichTextItem[]) || [];
      const text = items.map((t) => t.plain_text || '').join('');
      return text || null;
    }
    case 'rich_text': {
      const items = (p.rich_text as NotionRichTextItem[]) || [];
      const text = items.map((t) => t.plain_text || '').join('');
      return text || null;
    }
    case 'select': {
      const sel = p.select as { name?: string } | null;
      return sel?.name || null;
    }
    case 'status': {
      const st = p.status as { name?: string } | null;
      return st?.name || null;
    }
    case 'people': {
      const people = (p.people as { name?: string }[]) || [];
      const names = people.map((x) => x.name).filter(Boolean);
      return names.length > 0 ? names.join(', ') : null;
    }
    case 'date': {
      const d = p.date as { start?: string; end?: string } | null;
      if (!d?.start) return null;
      return d.end ? `${d.start} ~ ${d.end}` : d.start;
    }
    case 'email': {
      return typeof p.email === 'string' ? p.email : null;
    }
    case 'phone_number': {
      return typeof p.phone_number === 'string' ? p.phone_number : null;
    }
    case 'number': {
      return typeof p.number === 'number' ? String(p.number) : null;
    }
    case 'checkbox': {
      return typeof p.checkbox === 'boolean' ? String(p.checkbox) : null;
    }
    case 'url': {
      return typeof p.url === 'string' ? p.url : null;
    }
    default:
      return null;
  }
}

/** Notion 페이지 객체를 Slack 메시지용 요약으로 변환 */
export function summarizePage(page: NotionPageObject): NotionPageSummary {
  const properties: Record<string, unknown> = page.properties || {};

  let title = '';
  const propSummaries: NotionPropertyValue[] = [];
  for (const rawName of Object.keys(properties)) {
    const prop = properties[rawName] as NotionPropertySchema | undefined;
    const name = prop?.name || rawName;
    const value = extractPropertyValue(prop);
    if (value === null) continue;
    if (!title && prop?.type === 'title') {
      title = value;
    } else {
      propSummaries.push({ name, value });
    }
  }

  return {
    id: page.id || '',
    url: page.url || '',
    createdTime: page.created_time || new Date(0).toISOString(),
    title: title || '제목 없음',
    properties: propSummaries,
  };
}

export interface NotionClientOptions {
  token: string;
  databaseId: string;
  apiBase?: string;
  notionVersion?: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}

export class NotionClient {
  private readonly token: string;
  private readonly databaseId: string;
  private readonly apiBase: string;
  private readonly notionVersion: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxPages: number;

  constructor(options: NotionClientOptions) {
    this.token = options.token;
    this.databaseId = options.databaseId;
    this.apiBase = (options.apiBase || 'https://api.notion.com/v1').replace(
      /\/$/,
      ''
    );
    this.notionVersion = options.notionVersion || '2022-06-28';
    this.fetchImpl = options.fetchImpl || fetch;
    this.maxPages = options.maxPages || 500;
  }

  /**
   * `sinceIso`보다 나중에 생성된 페이지를 created_time 오름차순으로 반환.
   * 커서 기반 페이지네이션을 모두 순회한다.
   */
  async queryPagesCreatedAfter(sinceIso: string): Promise<NotionPageSummary[]> {
    const summaries: NotionPageSummary[] = [];
    let cursor: string | undefined;

    do {
      const body: Record<string, unknown> = {
        filter: {
          timestamp: 'created_time',
          created_time: { after: sinceIso },
        },
        sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
        page_size: 100,
      };
      if (cursor) body.start_cursor = cursor;

      const res = await this.fetchImpl(
        `${this.apiBase}/databases/${this.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Notion-Version': this.notionVersion,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let code = 'unknown';
        let message = `Notion API error ${res.status}`;
        try {
          const errJson = (await res.json()) as {
            code?: string;
            message?: string;
          };
          code = errJson.code || code;
          message = errJson.message || message;
        } catch {
          // 응답 본문 파싱 실패 시 상태 코드 기반 메시지 유지
        }
        throw new NotionApiError(message, res.status, code);
      }

      const data = (await res.json()) as NotionQueryResponse;
      for (const page of data.results || []) {
        summaries.push(summarizePage(page));
      }

      const hasMore = Boolean(data.has_more);
      cursor = data.next_cursor || undefined;
      if (hasMore && summaries.length >= this.maxPages) break;
      if (!hasMore) break;
    } while (cursor);

    return summaries;
  }
}
