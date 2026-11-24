import { formatNewClientMessage } from '../format';
import { NotionPageSummary } from '../types';

const page: NotionPageSummary = {
  id: 'p1',
  url: 'https://notion.so/p1',
  createdTime: '2026-11-24T10:00:00.000Z',
  title: 'Acme <Corp>',
  properties: [
    { name: 'Email', value: 'a@b.c' },
    { name: 'Plan', value: 'Pro' },
  ],
};

describe('formatNewClientMessage', () => {
  it('builds header, linked title, fields, divider, context', () => {
    const blocks = formatNewClientMessage(page);

    expect(blocks[0]).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: '🎉 신규 고객 등록', emoji: true },
    });
    const section = blocks[1] as { type: string; text: { text: string } };
    expect(section.text.text).toBe(
      '*<https://notion.so/p1|Acme &lt;Corp&gt;>*'
    );
    const fields = blocks[2] as { type: string; text: { text: string } };
    expect(fields.text.text).toContain('• *Email*: a@b.c');
    expect(fields.text.text).toContain('• *Plan*: Pro');
    expect(blocks.some((b) => b.type === 'divider')).toBe(true);
    const context = blocks[blocks.length - 1] as {
      elements: { text: string }[];
    };
    expect(context.elements[0].text).toContain('2026-11-24T10:00:00.000Z');
  });

  it('caps fields at 10 with omission note', () => {
    const many: NotionPageSummary = {
      ...page,
      properties: Array.from({ length: 13 }, (_, i) => ({
        name: `f${i}`,
        value: `v${i}`,
      })),
    };
    const blocks = formatNewClientMessage(many);
    const fields = blocks[2] as { text: { text: string } };
    expect(fields.text.text).toContain('… 외 3개 항목');
    expect(fields.text.text).not.toContain('v12');
  });

  it('omits field section when no properties', () => {
    const blocks = formatNewClientMessage({ ...page, properties: [] });
    expect(blocks[2].type).toBe('divider');
  });
});
