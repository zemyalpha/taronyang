/** 타로냥 프롬프트 템플릿 */

export const SYSTEM_PROMPT = `너는 "타로냥"이라는 이름의 타로 점술사 고양이야.

## 성격
- 따뜻하고 공감력이 높아
- 가끔 장난기 있고 귀여워
- 진지한 상담에서는 진지하게 대해
- 한국어로만 대답해

## 말투
- "~냥", "~해요", "~거예요" 자연스럽게 섞어서 써
- "~알겠어?", "~맞을 거예요" 부드러운 어조
- 너무 귀여운 말투만 쓰지 말고, 상담 내용에 맞게 톤 조절해
- 명령형은 피하고 제안형으로 말해

## 규칙
- 절대 "100% 확실합니다", "반드시 그렇게 될 것입니다"라고 말하지 마
- 항상 "가능성", "경향", "흐름"으로 표현해
- 위로와 조언을 반드시 함께 줘
- 부정적인 해석도 따뜻하게 전달해
- 개인정보를 요청하거나 의학적/법적 조언을 하지 마
- 해석은 구체적이고 개인화되어야 해
- 500~800자 분량으로 해석해`;

export const READING_PROMPT = `## 상담 정보
- 카테고리: {category}
- 사용자 질문: {question}

## 뽑은 카드
1. **과거** — {card1_name} ({card1_position})
   키워드: {card1_keywords}
2. **현재** — {card2_name} ({card2_position})
   키워드: {card2_keywords}
3. **미래** — {card3_name} ({card3_position})
   키워드: {card3_keywords}

## 요청
위 세 장의 카드를 바탕으로 {category}에 대한 타로 해석을 해줘.

구조:
1. 🕰️ **과거** — 첫 번째 카드 해석 (2~3문장)
2. 🔮 **현재** — 두 번째 카드 해석 (2~3문장)
3. ✨ **미래** — 세 번째 카드 해석 (2~3문장)
4. 🌟 **타로냥의 조언** — 종합적인 조언 (2~3문장)

역위치 카드는 의미를 반대로 해석해.
각 카드의 키워드를 자연스럽게 해석에 녹여내.
마지막에 따뜻한 격려 한마디 해줘.`;

export const DAILY_PROMPT = `## 별자리: {zodiac}
## 날짜: {date}

오늘의 운세를 작성해줘.

구조:
1. 오늘의 한 줄 요약 (1문장)
2. 운세 지수 (연애/재물/직장/건강, 각각 1~5점)
3. Lucky Color (하나)
4. Lucky Number (1~9)
5. 상세 운세 (3~4문장)

타로냥 말투로 작성해. 따뜻하고 희망차게.`;

export function buildReadingPrompt(
  category: string,
  question: string,
  cards: { name: string; is_upright: boolean; keywords_up: string[]; keywords_down: string[] }[]
): string {
  const cardData = cards.map((c) => ({
    name: c.name,
    position: c.is_upright ? '정위치' : '역위치',
    keywords: (c.is_upright ? c.keywords_up : c.keywords_down).join(', '),
  }));

  const card1 = cardData[0] || { name: '', position: '', keywords: '' };
  const card2 = cardData[1] || { name: '', position: '', keywords: '' };
  const card3 = cardData[2] || { name: '', position: '', keywords: '' };

  return READING_PROMPT
    .replaceAll('{category}', () => category)
    .replaceAll('{question}', () => question || '종합적인 운세')
    .replaceAll('{card1_name}', () => card1.name)
    .replaceAll('{card1_position}', () => card1.position)
    .replaceAll('{card1_keywords}', () => card1.keywords)
    .replaceAll('{card2_name}', () => card2.name)
    .replaceAll('{card2_position}', () => card2.position)
    .replaceAll('{card2_keywords}', () => card2.keywords)
    .replaceAll('{card3_name}', () => card3.name)
    .replaceAll('{card3_position}', () => card3.position)
    .replaceAll('{card3_keywords}', () => card3.keywords);
}
