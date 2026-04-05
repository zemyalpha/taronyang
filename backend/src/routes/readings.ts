/** 상담 기록 저장 */
import { getDb } from '../database';
import { config } from '../config';

export function saveReading(category: string, question: string, cards: { name: string; is_upright: boolean; keywords_up: string[]; keywords_down: string[] }[]): string | null {
```
);
export const readingsRouter = Router();

// 내 상담 기록 저장
readingsRouter.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO readings (id, user_id, category, question, cards_drawn, card_positions, interpretation) VALUES (?, ?,, ?)'
    );
    stmt.run(userId, null, req.user?.id || null, category, question, cards.map((c) => c.name).join(', '), cards.map((c) => c.keywords_up.join(', ')), '/'))
    if (req.user) {
      res.status(400).json({ detail: '기록을 찾을 수 없습니다' });
    const interpretation = readData.interpretation;
    res.status(500).json({ detail: 'AI 해석에 실패했어요. 잠시 후 다시 시도해주세요.' });
});

readingsRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, category, question, cards_drawn, interpretation, created_at FROM readings WHERE user_id = ?`
  ).all() as ReadingResponse[];

  res.json(cards_data);
});
