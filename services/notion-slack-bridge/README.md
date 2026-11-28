# notion-slack-bridge

Notion 고객(Client) 데이터베이스에 새 항목이 생성되면 Slack 채널에 자동으로 알림을 보내는 브리지 서비스.

## 동작 방식

- Notion API로 `NOTION_CLIENTS_DATABASE_ID` 데이터베이스를 `POLL_INTERVAL_MS`(기본 60초) 간격으로 폴링한다.
- 커서(마지막 처리 `created_time`) 이후 생성된 페이지만 조회하고, 처리된 페이지 ID 목록으로 중복 알림을 방지한다.
- 신규 페이지를 Slack Block Kit 메시지(고객명 + 주요 속성 + Notion 링크)로 전송한다.
- 전송 실패 시 커서를 진행하지 않아 다음 사이클에 자동 재시도한다.
- 첫 실행 시 기존 항목은 스킵하고 새 항목만 알린다(`--backfill`로 전체 재알림 가능).

런타임 의존성 없음 — Node 20+ 네이티브 `fetch` 사용.

## 설정

| 환경 변수 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `NOTION_TOKEN` | ✅ | - | Notion integration token (`secret_...`) |
| `NOTION_CLIENTS_DATABASE_ID` | ✅ | - | 고객 DB(32자리 ID). integration에 공유되어 있어야 함 |
| `SLACK_WEBHOOK_URL` | ✅* | - | Slack Incoming Webhook URL |
| `SLACK_BOT_TOKEN` | ✅* | - | webhook 대신 `xoxb-...` 토큰 사용 시 |
| `SLACK_CHANNEL` | ✅* | - | `SLACK_BOT_TOKEN` 사용 시 채널 (예: `#clients`) |
| `POLL_INTERVAL_MS` | - | `60000` | 폴링 간격(ms) |
| `NOTION_API_BASE` | - | `https://api.notion.com/v1` | Notion API base URL |
| `NOTION_VERSION` | - | `2022-06-28` | Notion-Version 헤더 |
| `BRIDGE_STATE_PATH` | - | `./data/bridge-state.json` | 커서/처리 ID 상태 파일 경로 |

\* Slack 전송 방식: `SLACK_WEBHOOK_URL` 단독, 또는 `SLACK_BOT_TOKEN` + `SLACK_CHANNEL` 조합 중 하나는 반드시 필요.

## 실행

```bash
cd services/notion-slack-bridge
npm install
npm run build

# 데몬 (폴링 반복)
NOTION_TOKEN=... NOTION_CLIENTS_DATABASE_ID=... SLACK_WEBHOOK_URL=... npm start

# 1회 실행 (cron/launchd용)
node dist/index.js --once

# 전송 없이 동작 확인
node dist/index.js --once --dry-run
```

## 테스트 / 린트

```bash
npm test        # jest + coverage (32 tests)
npm run lint    # eslint
npm run build   # tsc
```

## 운영 참고

- 상태 파일(`data/bridge-state.json`)이 삭제되면 첫 실행 정책이 다시 적용된다(기존 항목 스킵).
- Slack 429는 `Retry-After` 헤더를 존중해 재시도하고, Notion 429/5xx 및 일시 오류는 다음 폴링 사이클에서 자연 재시도된다.
- SIGINT/SIGTERM 시 진행 중 사이클 이후 안전 종료.
