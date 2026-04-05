/** 상담 기록 저장 서비스 */
import { getDb } from '../database';

export function saveReading(userId: string | null, category: string, question: string, cards: any[], interpretation: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO readings (id, user_id, category, question, cards_drawn, card_positions, interpretation) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, category, question, JSON.stringify(cards), '[]', interpretation);
  return id;
}
