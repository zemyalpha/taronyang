/** Slack Block Kit 타입 (사용하는 최소 집합) */
export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface SlackSectionBlock {
  type: 'section';
  text: SlackTextObject;
}

export interface SlackHeaderBlock {
  type: 'header';
  text: SlackTextObject;
}

export interface SlackContextBlock {
  type: 'context';
  elements: SlackTextObject[];
}

export interface SlackDividerBlock {
  type: 'divider';
}

export type SlackBlock =
  | SlackSectionBlock
  | SlackHeaderBlock
  | SlackContextBlock
  | SlackDividerBlock;

/** Notion 페이지 속성에서 추출한 요약 값 */
export interface NotionPropertyValue {
  name: string;
  value: string;
}

/** 처리 대상이 되는 Notion 페이지의 요약 */
export interface NotionPageSummary {
  id: string;
  url: string;
  createdTime: string;
  title: string;
  properties: NotionPropertyValue[];
}

/** 중복 방지용 커서 + 처리 완료 페이지 ID 목록 */
export interface BridgeState {
  cursor: string;
  processedIds: string[];
}
