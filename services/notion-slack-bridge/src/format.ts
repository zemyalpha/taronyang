/**
 * Slack Block Kit 메시지 포맷터.
 */
import { NotionPageSummary, SlackBlock } from './types';

const MAX_FIELDS = 10;

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 신규 고객 페이지를 Slack 알림 블록으로 변환 */
export function formatNewClientMessage(page: NotionPageSummary): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎉 신규 고객 등록', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${page.url}|${escapeText(page.title)}>*`,
      },
    },
  ];

  if (page.properties.length > 0) {
    const fields = page.properties.slice(0, MAX_FIELDS);
    const lines = fields.map(
      (p) => `• *${escapeText(p.name)}*: ${escapeText(p.value)}`
    );
    const omitted = page.properties.length - MAX_FIELDS;
    if (omitted > 0) {
      lines.push(`… 외 ${omitted}개 항목`);
    }
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Notion에서 생성됨: ${page.createdTime}`,
      },
    ],
  });

  return blocks;
}
