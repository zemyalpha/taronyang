/** 타로 API 라우터 */
import { Router, Request, Response } from 'express';
import { ALL_CARDS, getCard, CATEGORY_NAMES } from '../tarotData';
import { SYSTEM_PROMPT, buildReadingPrompt } from '../tarotPrompt';
import { tarotReading, callLlm } from '../llm';
import { saveReading } from './readings';
import { authMiddleware } from './auth';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const tarotRouter = Router();

/** 카테고리 목록 */
tarotRouter.get('/categories', (_req: Request, res: Response) => {
  res.json({ categories: CATEGORY_NAMES });
});

/** 카드 셔플 */
tarotRouter.get('/shuffle', (req: Request, res: Response) => {
  const count = Math.min(Math.max(parseInt(req.query.count as string) || 10, 3), 20);
  // Fisher-Yates 셔플 (편향 없는 무작위)
  const deck = [...ALL_CARDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const shuffled = deck.slice(0, count);
  const cards = shuffled.map((c) => {
    const is_upright = Math.random() > 0.5;
    return {
      id: c.id,
      name: c.name,
      name_en: c.name_en,
      symbol: c.symbol,
      is_upright,
      position: is_upright ? '정위치' : '역위치',
    };
  });
  res.json({ cards });
});

/** 타로 해석 */
tarotRouter.post('/read', async (req: Request, res: Response) => {
  const { category, question, cards: selectedCards } = req.body;

  let userId: string | null = null;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), config.jwtSecret) as { user_id: string };
      userId = payload.user_id;
    } catch { /* 비회원 */ }
  }

  if (!category || !CATEGORY_NAMES[category]) {
    res.status(400).json({ detail: `잘못된 카테고리: ${category}` });
    return;
  }
  if (!selectedCards || selectedCards.length !== 3) {
    res.status(400).json({ detail: '카드를 3장 선택해주세요' });
    return;
  }

  // 카드 데이터 조회
  let cards: any[];
  try {
    cards = selectedCards.map((s: { id: number; is_upright: boolean }) => {
      const card = getCard(s.id);
      if (!card) throw new Error(`카드 없음: ${s.id}`);
      return { ...card, is_upright: s.is_upright };
    });
  } catch (err) {
    res.status(400).json({ detail: String(err) });
    return;
  }

  // 프롬프트 생성
  const prompt = buildReadingPrompt(CATEGORY_NAMES[category], question || '', cards);

  try {
    const interpretation = await tarotReading(SYSTEM_PROMPT, prompt);

    // 기록 저장 (비회원도)
    try {
      saveReading(userId, category, question || '', cards, interpretation);
    } catch {
      /* 기록 저장 실패는 무시 */
    }

    res.json({
      cards: cards.map((c: any) => ({
        id: c.id,
        name: c.name,
        name_en: c.name_en,
        symbol: c.symbol,
        is_upright: c.is_upright,
        position: c.is_upright ? '정위치' : '역위치',
      })),
      interpretation,
    });
  } catch (err) {
    console.error('AI 해석 실패:', err);
    res.status(500).json({ detail: 'AI 해석에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
});

/** 추가 대화 */
tarotRouter.post('/chat', async (req: Request, res: Response) => {
  const { question, chat_history, category, cards_summary, previous_reading } = req.body;

  if (!question || question.length > 500) {
    res.status(400).json({ detail: '질문은 500자 이내로 입력해주세요' });
    return;
  }
  if (chat_history && chat_history.length >= 10) {
    res.status(400).json({ detail: '대화 횟수를 초과했어요' });
    return;
  }

  const allowedRoles = new Set(['user', 'assistant']);
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `이전 상담: 카테고리=${category}, 카드=${cards_summary}, 해석=${previous_reading}`,
    },
  ];

  if (chat_history) {
    for (const m of chat_history) {
      if (m && typeof m.role === 'string' && allowedRoles.has(m.role) && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content.substring(0, 1000) });
      }
    }
  }
  messages.push({ role: 'user', content: question });

  try {
    const reply = await callLlm(messages, 1000, 0.8);
    res.json({ reply });
  } catch (err) {
    console.error('AI 응답 실패:', err);
    res.status(500).json({ detail: 'AI 응답에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
});
