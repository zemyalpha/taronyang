/** 타로카드 78장 데이터 (TypeScript) */

export interface TarotCard {
  id: number;
  name: string;
  name_en: string;
  symbol: string;
  keywords_up: string[];
  keywords_down: string[];
  meaning_up: string;
  meaning_down: string;
}

export const MAJOR_ARCANA: TarotCard[] = [
  { id: 0, name: '바보', name_en: 'The Fool', symbol: '🃏', keywords_up: ['새시작', '자유', '모험', '순수', '무한한가능성'], keywords_down: ['무모함', '경솔', '미숙', '판단부족'], meaning_up: '새로운 시작과 무한한 가능성이 열려있어요. 두려움 없이 한 걸음 내디뎌보세요.', meaning_down: '너무 서두르고 있을 수 있어요. 한 박자 쉬어가며 신중하게 결정하세요.' },
  { id: 1, name: '마법사', name_en: 'The Magician', symbol: '🧙', keywords_up: ['창조', '기술', '의지력', '집중', '성공'], keywords_down: ['조작', '기만', '재능낭비', '자신감부족'], meaning_up: '당신에게 필요한 모든 것이 이미 갖춰져 있어요. 능력을 믿고 행동하세요.', meaning_down: '재능을 제대로 활용하지 못하고 있어요. 자신감을 되찾을 시간이에요.' },
  { id: 2, name: '여사제', name_en: 'The High Priestess', symbol: '🌙', keywords_up: ['직관', '지혜', '신비', '내면의목소리', '은비적지식'], keywords_down: ['비밀', '거리낌', '내면무시', '감정억압'], meaning_up: '내면의 목소리에 귀를 기울이세요. 답은 이미 당신 안에 있어요.', meaning_down: '직감을 무시하고 있어요. 마음의 소리를 외면하지 마세요.' },
  { id: 3, name: '여황제', name_en: 'The Empress', symbol: '👑', keywords_up: ['풍요', '모성', '창조', '자연', '성장'], keywords_down: ['과잉보호', '의존', '창조력부족', '나태'], meaning_up: '풍요와 성장의 에너지가 가득해요. 당신의 노력이 열매를 맺을 거예요.', meaning_down: '스스로를 돌보는 것을 소홀히 하고 있어요. 자신에게도 너그러워지세요.' },
  { id: 4, name: '황제', name_en: 'The Emperor', symbol: '🏛️', keywords_up: ['권위', '안정', '리더십', '구조', '아버지상'], keywords_down: ['독재', '완고함', '통제력과도', '유연성부족'], meaning_up: '질서와 안정이 필요한 시기예요. 체계적으로 계획을 세워보세요.', meaning_down: '너무 경직되어 있어요. 조금 더 유연해질 필요가 있어요.' },
  { id: 5, name: '교황', name_en: 'The Hierophant', symbol: '⛪', keywords_up: ['전통', '가르침', '신앙', '의식', '멘토'], keywords_down: ['구습', '권위주의', '반항', '비전통적'], meaning_up: '좋은 스승이나 멘토를 만날 수 있는 시기예요. 배움에 열려있으세요.', meaning_down: '전통에 얽매여 있어요. 때로는 새로운 방식을 시도해보세요.' },
  { id: 6, name: '연인', name_en: 'The Lovers', symbol: '💕', keywords_up: ['사랑', '선택', '조화', '매력', '결합'], keywords_down: ['갈등', '선택의어려움', '불화', '가치관충돌'], meaning_up: '중요한 선택의 순간이에요. 마음이 이끄는 대로 선택하세요.', meaning_down: '마음과 이성이 충돌하고 있어요. 진정으로 원하는 것을 스스로에게 물어보세요.' },
  { id: 7, name: '전차', name_en: 'The Chariot', symbol: '⚡', keywords_up: ['승리', '결단', '전진', '의지', '성취'], keywords_down: ['패배감', '방향상실', '조급함', '통제력상실'], meaning_up: '강한 의지로 목표를 향해 전진할 때예요. 승리는 가까워요.', meaning_down: '방향을 잃은 것 같아요. 잠시 멈춰서 목표를 재정립하세요.' },
  { id: 8, name: '힘', name_en: 'Strength', symbol: '🦁', keywords_up: ['용기', '인내', '내면의힘', '자제력', '연민'], keywords_down: ['나약함', '자신감결핍', '분노', '두려움'], meaning_up: '부드러운 힘이 필요한 시기예요. 인내와 용기로 극복할 수 있어요.', meaning_down: '자신감이 떨어져 있어요. 작은 성공부터 다시 쌓아가세요.' },
  { id: 9, name: '은둔자', name_en: 'The Hermit', symbol: '🏔️', keywords_up: ['성찰', '고독', '지혜', '내면탐구', '안내자'], keywords_down: ['고립', '회피', '외로움', '과도한은둔'], meaning_up: '혼자만의 시간이 필요해요. 내면을 깊이 들여다보며 답을 찾으세요.', meaning_down: '혼자 있기보다 사람들과 연결되는 것도 필요해요.' },
  { id: 10, name: '운명의 수레바퀴', name_en: 'Wheel of Fortune', symbol: '🎡', keywords_up: ['운명', '전환', '행운', '순환', '기회'], keywords_down: ['불운', '저항', '변화두려움', '역류'], meaning_up: '운명의 바퀴가 돌아가고 있어요. 좋은 변화가 다가오고 있어요.', meaning_down: '흐름을 거스르지 마세요. 변화를 받아들이는 것이 답이에요.' },
  { id: 11, name: '정의', name_en: 'Justice', symbol: '⚖️', keywords_up: ['공정', '진실', '균형', '책임', '법'], keywords_down: ['불공정', '편견', '불균형', '회피'], meaning_up: '공정한 결과가 따를 거예요. 정직하게 행동하세요.', meaning_down: '불균형한 상태예요. 양쪽을 모두 살펴보세요.' },
  { id: 12, name: '매달린 사람', name_en: 'The Hanged Man', symbol: '🙃', keywords_up: ['희생', '새시각', '기다림', '깨달음', '관점전환'], keywords_down: ['지연', '우유부단', '희생과도', '회피'], meaning_up: '다른 관점에서 바라보세요. 새로운 깨달음이 있을 거예요.', meaning_down: '너무 오래 기다리고 있어요. 때가 되면 행동하세요.' },
  { id: 13, name: '죽음', name_en: 'Death', symbol: '🦋', keywords_up: ['변환', '끝과시작', '해방', '재탄생', '성장'], keywords_down: ['저항', '집착', '변화거부', '두려움'], meaning_up: '하나의 장이 끝나고 새로운 장이 시작돼요. 변화를 받아들이세요.', meaning_down: '변화를 두려워하고 있어요. 놓아야 할 것은 놓아주세요.' },
  { id: 14, name: '절제', name_en: 'Temperance', symbol: '🏺', keywords_up: ['균형', '조화', '인내', '중용', '치유'], keywords_down: ['과잉', '불균형', '급진', '극단'], meaning_up: '균형과 조화가 필요한 시기예요. 중용을 지키세요.', meaning_down: '극단으로 치우치고 있어요. 가운데 지점을 찾으세요.' },
  { id: 15, name: '악마', name_en: 'The Devil', symbol: '😈', keywords_up: ['유혹', '집착', '물질', '속박', '그림자'], keywords_down: ['해방', '깨달음', '자유', '결단'], meaning_up: '무언가에 집착하고 있을 수 있어요. 스스로를 돌아보세요.', meaning_down: '사슬을 끊을 힘이 있어요. 자유로워질 수 있어요.' },
  { id: 16, name: '탑', name_en: 'The Tower', symbol: '🗼', keywords_up: ['격변', '깨달음', '해방', '진실', '파괴와재건'], keywords_down: ['재앙회피', '작은변화', '저항', '두려움'], meaning_up: '갑작스러운 변화가 올 수 있어요. 하지만 더 나은 것을 위한 무너짐이에요.', meaning_down: '작은 변화로 큰 충격을 피할 수 있어요. 미리 준비하세요.' },
  { id: 17, name: '별', name_en: 'The Star', symbol: '⭐', keywords_up: ['희망', '영감', '치유', '평화', '신뢰'], keywords_down: ['절망', '신뢰상실', '방향상실', '체념'], meaning_up: '희망의 빛이 비치고 있어요. 밝은 미래를 믿으세요.', meaning_down: '희망을 잃지 마세요. 어둠이 깊을수록 별은 더 밝게 빛나요.' },
  { id: 18, name: '달', name_en: 'The Moon', symbol: '🌕', keywords_up: ['환상', '직관', '불안', '꿈', '무의식'], keywords_down: ['진실노출', '명확함', '환상깨기', '현실직시'], meaning_up: '마음이 혼란스러울 수 있어요. 직관을 믿고 기다려보세요.', meaning_down: '안개가 걷히고 있어요. 진실이 곧 드러날 거예요.' },
  { id: 19, name: '태양', name_en: 'The Sun', symbol: '☀️', keywords_up: ['성공', '기쁨', '활력', '명확', '풍요'], keywords_down: ['일시적저하', '자만', '과도한낙관', '에너지과잉'], meaning_up: '밝고 행복한 시기예요! 모든 것이 잘 풀릴 거예요.', meaning_down: '조금 주의가 필요해요. 너무 자만하지 마세요.' },
  { id: 20, name: '심판', name_en: 'Judgement', symbol: '📯', keywords_up: ['부활', '각성', '소명', '결정', '새출발'], keywords_down: ['미해결', '회피', '자기비판', '후회'], meaning_up: '중요한 결정의 순간이에요. 내면의 소명에 귀 기울이세요.', meaning_down: '과거를 정리하지 못했어요. 미해결 문제를 먼저 처리하세요.' },
  { id: 21, name: '세계', name_en: 'The World', symbol: '🌍', keywords_up: ['완성', '성취', '통합', '여행', '성공'], keywords_down: ['미완성', '지연', '마무리부족', '순환미완'], meaning_up: '하나의 여정이 완성되고 있어요. 축하해요! ✨', meaning_down: '아직 마무리가 안 됐어요. 끝까지 밀고 나가세요.' },
];

// ===== 마이너 아르카나 56장 (컵 14 + 펜타클 14 + 소드 14 + 완드 14) =====

// --- 컵 (Cups) : 감정 · 사랑 · 관계 ---
export const MINOR_ARCANA: TarotCard[] = [
  { id: 22, name: '컵 에이스', name_en: 'Ace of Cups', symbol: '💕', keywords_up: ['새로운사랑', '감정의홍수', '영적각성', '창조적영감', '은총'], keywords_down: ['감정억제', '사랑거부', '공허함', '창조력막힘'], meaning_up: '가슴이 벅차오르는 새로운 감정이 시작되고 있어요. 사랑과 영감의 문이 열렸어요.', meaning_down: '감정을 닫아두고 있어요. 마음의 문을 열 용기가 필요해요.' },
  { id: 23, name: '컵 2', name_en: 'Two of Cups', symbol: '💕', keywords_up: ['파트너십', '상호이해', '매력', '화해', '결합'], keywords_down: ['관계갈등', '이해부족', '이별', '불화'], meaning_up: '서로의 마음이 통하는 아름운 만남이에요. 진정한 파트너십이 시작될 수 있어요.', meaning_down: '관계에서 균형이 깨졌어요. 서로의 마음을 다시 들여다볼 시간이에요.' },
  { id: 24, name: '컵 3', name_en: 'Three of Cups', symbol: '💕', keywords_up: ['축하', '우정', '기쁨', '협력', '소통'], keywords_down: ['과도한즐김', '뒷담화', '배신', '소외감'], meaning_up: '좋은 사람들과 함께 기쁨을 나눌 시기예요. 우정과 축하가 가득해요.', meaning_down: '관계에서 소외감을 느낄 수 있어요. 진정한 친구에게 먼저 다가가 보세요.' },
  { id: 25, name: '컵 4', name_en: 'Four of Cups', symbol: '💕', keywords_up: ['명상', '내성', '재고', '망설임', '무관심'], keywords_down: ['기회포착', '각성', '새로운관심', '결단'], meaning_up: '현재에 만족하지 못하고 무언가 더 바라고 있어요. 잠시 마음을 가라앉히고 진짜 원하는 것을 찾아보세요.', meaning_down: '외면했던 기회가 눈에 들어오기 시작했어요. 지금 눈을 뜨면 새로운 가능성이 보여요.' },
  { id: 26, name: '컵 5', name_en: 'Five of Cups', symbol: '💕', keywords_up: ['상실', '후회', '슬픔', '실망', '과거집착'], keywords_down: ['수용', '회복', '전진', '남은것감사'], meaning_up: '잃어버린 것 때문에 슬퍼하고 있어요. 하지만 아직 남아있는 소중한 것들을 바라봐요.', meaning_down: '슬픔에서 서서히 벗어나고 있어요. 앞을 향해 나아갈 힘이 생기고 있어요.' },
  { id: 27, name: '컵 6', name_en: 'Six of Cups', symbol: '💕', keywords_up: ['추억', '순수', '향수', '과거인연', '어린시절'], keywords_down: ['과거집착', '현실도피', '미련', '성장지연'], meaning_up: '따뜻한 추억과 순수한 마음이 당신을 감싸요. 과거의 좋은 인연이 다시 이어질 수 있어요.', meaning_down: '과거에 너무 머물러 있어요. 아름다운 추억은 간직하되 지금을 살아가세요.' },
  { id: 28, name: '컵 7', name_en: 'Seven of Cups', symbol: '💕', keywords_up: ['선택', '환상', '꿈', '상상력', '다양한기회'], keywords_down: ['현실직시', '명확함', '결단', '환상깨기'], meaning_up: '너무 많은 선택지 앞에서 헤매고 있어요. 마음이 진정으로 원하는 것을 구별해내세요.', meaning_down: '환상의 안개가 걷히고 있어요. 현실을 직시하고 명확한 결정을 내릴 때예요.' },
  { id: 29, name: '컵 8', name_en: 'Eight of Cups', symbol: '💕', keywords_up: ['이별', '더깊은의미', '내면탐구', '떠남', '성찰'], keywords_down: ['회피중단', '복귀', '현실수용', '용기'], meaning_up: '더 이상 의미 없는 것을 뒤로하고 떠날 때예요. 내면이 원하는 더 깊은 곳을 향해 가세요.', meaning_down: '도망치고 있는 것인지 스스로에게 물어보세요. 현실에서 답을 찾을 수도 있어요.' },
  { id: 30, name: '컵 9', name_en: 'Nine of Cups', symbol: '💕', keywords_up: ['만족', '소원성취', '감정적풍요', '행복', '자기애'], keywords_down: ['자만', '만족지연', '이기심', '과도한욕심'], meaning_up: '마음이 바라던 것이 이루어지는 시기예요. 감정적으로 충만하고 만족스러운 시간이에요.', meaning_down: '원하는 것이 채워지지 않아 답답할 수 있어요. 작은 것에 감사하는 연습이 필요해요.' },
  { id: 31, name: '컵 10', name_en: 'Ten of Cups', symbol: '💕', keywords_up: ['가족', '완전한행복', '조화', '영원한사랑', '안식'], keywords_down: ['가족갈등', '가치충돌', '불화', '이상과현실괴리'], meaning_up: '사랑하는 사람들과 깊은 행복을 나누는 시기예요. 마음의 고향을 찾은 듯한 안정감이에요.', meaning_down: '관계에서 이상과 현실의 괴리를 느낄 수 있어요. 서로의 다름을 인정하는 대화가 필요해요.' },
  { id: 32, name: '컵 시종', name_en: 'Page of Cups', symbol: '💕', keywords_up: ['직관', '감성', '예술적재능', '순수한메시지', '로맨틱'], keywords_down: ['감정미숙', '변덕', '현실감부족', '과몽상'], meaning_up: '예상치 못한 감정의 메시지가 찾아와요. 순수한 마음으로 직관을 따라가 보세요.', meaning_down: '감정적으로 아직 미숙해요. 느끼는 것과 행동하는 것 사이의 균형이 필요해요.' },
  { id: 33, name: '컵 기사', name_en: 'Knight of Cups', symbol: '💕', keywords_up: ['로맨스', '매력', '이상주의', '예술', '제안'], keywords_down: ['비현실적', '기분파', '허세', '실천력부족'], meaning_up: '마음을 따라 움직이는 아름다운 기사가 다가와요. 로맨틱한 제안이나 영감이 찾아올 거예요.', meaning_down: '꿈만 크고 행동이 부족해요. 이상을 현실로 옮기는 실천이 필요해요.' },
  { id: 34, name: '컵 여왕', name_en: 'Queen of Cups', symbol: '💕', keywords_up: ['공감', '따뜻함', '직관적지혜', '치유', '헌신'], keywords_down: ['감정기복', '의존성', '과잉흡수', '경계흐림'], meaning_up: '따뜻한 공감과 직관의 에너지가 강해요. 누군가에게 큰 위로가 되어줄 수 있어요.', meaning_down: '타인의 감정에 너무 깊이 빠져들어요. 자신과 타인의 경계를 구분하세요.' },
  { id: 35, name: '컵 왕', name_en: 'King of Cups', symbol: '💕', keywords_up: ['감정적성숙', '평온', '외교술', '지혜', '균형'], keywords_down: ['감정억압', '조종', '냉담함', '무책임'], meaning_up: '감정을 다스리는 성숙함을 갖추고 있어요. 평온함으로 상황을 풀어나갈 수 있어요.', meaning_down: '감정을 억누르고 있어요. 솔직한 마음을 표현하는 것이 오히려 도움이 될 거예요.' },

  // --- 펜타클 (Pentacles) : 물질 · 돈 · 현실 ---
  { id: 36, name: '펜타클 에이스', name_en: 'Ace of Pentacles', symbol: '💰', keywords_up: ['새기회', '풍요의시작', '투자', '번영', '실현'], keywords_down: ['기회상실', '재무지연', '나태', '계획부족'], meaning_up: '물질적 풍요의 새로운 기회가 찾아왔어요. 지금 뿌린 씨앗이 훌륭한 열매를 맺을 거예요.', meaning_down: '좋은 기회를 놓칠 수 있어요. 준비가 되어 있는지 점검해보세요.' },
  { id: 37, name: '펜타클 2', name_en: 'Two of Pentacles', symbol: '💰', keywords_up: ['균형', '융통성', '우선순위', '변화적응', '재주'], keywords_down: ['과부하', '혼란', '우유부단', '조직력부족'], meaning_up: '여러 일을 동시에 처리해야 하는 시기예요. 유연하게 균형을 잡으며 해내고 있어요.', meaning_down: '너무 많은 것을 한꺼번에 하려고 해요. 우선순위를 정해 하나씩 해나가세요.' },
  { id: 38, name: '펜타클 3', name_en: 'Three of Pentacles', symbol: '💰', keywords_up: ['협력', '팀워크', '실력인정', '건설', '전문성'], keywords_down: ['협력부족', '소통문제', '실력과외부평가괴리', '불협화음'], meaning_up: '다른 사람들과 협력하여 훌륭한 결과를 만들어낼 수 있어요. 당신의 실력이 인정받는 시기예요.', meaning_down: '팀 내에서 의견 충돌이 있을 수 있어요. 서로를 존중하는 대화가 필요해요.' },
  { id: 39, name: '펜타클 4', name_en: 'Four of Pentacles', symbol: '💰', keywords_up: ['안정추구', '절약', '통제', '소유', '보호'], keywords_down: ['이완', '공유', '변화수용', '집착해소'], meaning_up: '가진 것을 지키고 안정을 추구하는 시기예요. 자산을 관리하는 데 집중하고 있어요.', meaning_down: '무언가에 너무 집착하고 있어요. 조금은 마음을 놓고 유연해질 필요가 있어요.' },
  { id: 40, name: '펜타클 5', name_en: 'Five of Pentacles', symbol: '💰', keywords_up: ['어려움', '결핍', '외로움', '위기', '도움의필요'], keywords_down: ['회복', '도움수용', '회복시작', '희망'], meaning_up: '힘든 시기를 지나고 있어요. 하지만 당신을 도울 손길이 가까이에 있으니 주위를 둘러보세요.', meaning_down: '어려움에서 서서히 벗어나고 있어요. 도움을 받아들이는 용기가 필요해요.' },
  { id: 41, name: '펜타클 6', name_en: 'Six of Pentacles', symbol: '💰', keywords_up: ['관대함', '나눔', '균형', '수여와수용', '공정'], keywords_down: ['불공정', '부채', '조종', '일방적희생'], meaning_up: '주고받는 균형이 아름다운 시기예요. 넉넉한 마음으로 나누면 더 큰 풍요가 돌아와요.', meaning_down: '주고받는 관계가 불균형해요. 공정한 관계를 위해 경계를 정하세요.' },
  { id: 42, name: '펜타클 7', name_en: 'Seven of Pentacles', symbol: '💰', keywords_up: ['인내', '투자결과', '성찰', '장기계획', '보상'], keywords_down: ['조급함', '포기유혹', '결과지연', '비생산적'], meaning_up: '오랫동안 가꾼 노력이 서서히 결실을 맺고 있어요. 조금만 더 기다리면 풍성한 수확이 있을 거예요.', meaning_down: '결과가 더디게 와서 답답할 수 있어요. 하지만 지금까지 쌓아온 것은 헛되지 않아요.' },
  { id: 43, name: '펜타클 8', name_en: 'Eight of Pentacles', symbol: '💰', keywords_up: ['근면', '숙련', '장인정신', '집중', '전문성향상'], keywords_down: ['과로', '완벽주의', '세부몰입과도', '틀깨기'], meaning_up: '열심히 몰두하여 실력을 키워가고 있어요. 꾸준한 노력이 전문성으로 이어질 거예요.', meaning_down: '너무 디테일에 매몰되어 있어요. 때로는 큰 그림을 보는 것도 필요해요.' },
  { id: 44, name: '펜타클 9', name_en: 'Nine of Pentacles', symbol: '💰', keywords_up: ['풍요', '자급자족', '독립', '성취', '여유'], keywords_down: ['과시', '허영', '물질집착', '위장된풍요'], meaning_up: '스스로 이룬 성취를 누리는 시기예요. 독립적이고 여유로운 삶을 가꾸고 있어요.', meaning_down: '겉모습에 너무 신경 쓰고 있어요. 진정한 풍요는 마음에서 와요.' },
  { id: 45, name: '펜타클 10', name_en: 'Ten of Pentacles', symbol: '💰', keywords_up: ['가족부', '유산', '안정', '장기적성공', '전통'], keywords_down: ['유산분쟁', '가족갈등', '안정위협', '전통충돌'], meaning_up: '가족과 함께 누리는 깊은 안정감이 찾아왔어요. 오랜 노력이 대를 이어 이어질 거예요.', meaning_down: '가족 내 재정이나 가치관 갈등이 있을 수 있어요. 대화로 풀어가세요.' },
  { id: 46, name: '펜타클 시종', name_en: 'Page of Pentacles', symbol: '💰', keywords_up: ['새로운학습', '야망', '기회인식', '근면한시작', '현실적꿈'], keywords_down: ['게으름', '진지함부족', '계획실행지연', '산만함'], meaning_up: '새로운 것을 배우고자 하는 의지가 샘솟아요. 현실적인 목표를 향해 첫걸음을 내디디세요.', meaning_down: '아이디어만 있고 행동이 없어요. 작게라도 시작하는 것이 중요해요.' },
  { id: 47, name: '펜타클 기사', name_en: 'Knight of Pentacles', symbol: '💰', keywords_up: ['성실', '신뢰', '인내', '꾸준함', '루틴'], keywords_down: ['고집', '진부함', '느림', '변화거부'], meaning_up: '한결같이 성실하게 목표를 향해 나아가고 있어요. 느리지만 확실한 신뢰의 상징이에요.', meaning_down: '너무 경직된 방식에 갇혀 있어요. 유연성을 조금 더 발휘해보세요.' },
  { id: 48, name: '펜타클 여왕', name_en: 'Queen of Pentacles', symbol: '💰', keywords_up: ['돌봄', '실용성', '안정감', '자연친화', '풍요'], keywords_down: ['과잉보호', '물질집착', '자기돌봄소홀', '불안'], meaning_up: '현실을 탄탄하게 다지며 주변을 따뜻하게 돌보고 있어요. 풍요로운 안정감의 상징이에요.', meaning_down: '남을 돌보느라 자신을 소홀히 하고 있어요. 스스로를 먼저 챙기세요.' },
  { id: 49, name: '펜타클 왕', name_en: 'King of Pentacles', symbol: '💰', keywords_up: ['부', '사업성공', '안정', '후원', '권위와풍요'], keywords_down: ['탐욕', '물질만능', '통제과도', '인색함'], meaning_up: '물질적 성취와 안정을 누리는 위치에 있어요. 당신의 든든함이 주변에 큰 힘이 돼요.', meaning_down: '돈과 권력에 너무 집착하고 있어요. 진정한 풍요는 균형에서 와요.' },

  // --- 소드 (Swords) : 사고 · 갈등 · 지성 ---
  { id: 50, name: '소드 에이스', name_en: 'Ace of Swords', symbol: '⚔️', keywords_up: ['명석함', '돌파', '진실', '새로운아이디어', '결단'], keywords_down: ['혼란', '오해', '잘못된판단', '지연'], meaning_up: '선명한 통찰력으로 난관을 돌파할 수 있는 순간이에요. 진실을 향한 칼을 뽑아들었어요.', meaning_down: '생각이 정리되지 않아 혼란스러워요. 서두르지 말고 다시 한 번 생각해보세요.' },
  { id: 51, name: '소드 2', name_en: 'Two of Swords', symbol: '⚔️', keywords_up: ['선택의딜레마', '균형', '교착상태', '방어', '블라인드'], keywords_down: ['결단', '정보해금', '막힘해소', '명확한선택'], meaning_up: '어려운 선택 앞에서 마음의 눈을 가리고 있어요. 두려움을 내려놓으면 답이 보일 거예요.', meaning_down: '외면하던 결정을 내릴 때가 왔어요. 정보를 모두 열어보면 길이 보여요.' },
  { id: 52, name: '소드 3', name_en: 'Three of Swords', symbol: '⚔️', keywords_up: ['심장아픔', '슬픔', '상처', '이별', '실망'], keywords_down: ['회복', '상처치유', '용서', '전진'], meaning_up: '마음이 아프고 깊은 상처를 받을 수 있어요. 하지만 이 아픔이 당신을 더 강하게 만들 거예요.', meaning_down: '상처가 서서히 아물고 있어요. 스스로를 다독이며 회복해가는 중이에요.' },
  { id: 53, name: '소드 4', name_en: 'Four of Swords', symbol: '⚔️', keywords_up: ['휴식', '회복', '명상', '준비', '잠시멈춤'], keywords_down: ['무기력', '회피', '지연', '각성필요'], meaning_up: '잠시 멈춰 쉬어가야 할 시기예요. 충분한 휴식이 다음 도약을 위한 에너지가 돼요.', meaning_down: '너무 오래 쉬고 있어요. 때가 되었으니 다시 일어설 시간이에요.' },
  { id: 54, name: '소드 5', name_en: 'Five of Swords', symbol: '⚔️', keywords_up: ['갈등', '패배', '승리의대가', '불화', '자기이익'], keywords_down: ['화해', '용서', '갈등종식', '반성'], meaning_up: '갈등 속에서 이기는 것만이 전부는 아니라는 것을 깨닫게 돼요. 진정한 승리는 화해에 있어요.', meaning_down: '싸움을 멈추고 화해할 준비가 되었어요. 양보하는 것이 더 큰 성과를 가져와요.' },
  { id: 55, name: '소드 6', name_en: 'Six of Swords', symbol: '⚔️', keywords_up: ['이동', '전환', '잔잔한물살', '회복의이동', '새로운곳'], keywords_down: ['회피', '미해결과거', '저항', '이동지연'], meaning_up: '거친 물살을 지나 잔잔한 곳으로 이동하고 있어요. 더 나은 곳을 향한 전환이에요.', meaning_down: '과거의 문제를 충분히 해결하지 않고 떠나려 해요. 먼저 마음을 정리하세요.' },
  { id: 56, name: '소드 7', name_en: 'Seven of Swords', symbol: '⚔️', keywords_up: ['전략', '기만', '은밀함', '지혜로운회피', '독립'], keywords_down: ['솔직함', '고백', '계획포기', '정직'], meaning_up: '때로는 물러서는 것이 지혜로운 전략이에요. 에너지를 아껴 더 좋은 타이밍을 기다리세요.', meaning_down: '숨기고 있는 것이 있다면 솔직해질 때예요. 진실이 더 빠른 해결책이에요.' },
  { id: 57, name: '소드 8', name_en: 'Eight of Swords', symbol: '⚔️', keywords_up: ['속박', '자기제한', '갇힌느낌', '무력감', '두려움'], keywords_down: ['해방', '자각', '용기', '제한해제'], meaning_up: '스스로 만든 생각의 틀에 갇혀 있다고 느껴요. 눈을 가린 끈을 풀면 나갈 수 있는 길이 보여요.', meaning_down: '제한이 생각보다 약하다는 것을 깨닫고 있어요. 작은 용기가 큰 해방을 가져와요.' },
  { id: 58, name: '소드 9', name_en: 'Nine of Swords', symbol: '⚔️', keywords_up: ['불안', '악몽', '걱정', '수면부족', '공포'], keywords_down: ['불안해소', '희망', '현실확인', '회복'], meaning_up: '밤새 걱정에 시달리고 있어요. 하지만 두려움의 대부분은 현실보다 과장되어 있어요.', meaning_down: '불안의 안개가 걷히고 있어요. 현실을 확인하면 생각보다 괜찮다는 걸 알게 될 거예요.' },
  { id: 59, name: '소드 10', name_en: 'Ten of Swords', symbol: '⚔️', keywords_up: ['끝', '바닥', '고통의종결', '전환점', '해방'], keywords_down: ['회복', '재기', '최악지남', '재출발'], meaning_up: '가장 힘든 순간을 지나고 있어요. 하지만 이것이 끝이면 새로운 시작이에요. 더 이상 내려갈 곳은 없어요.', meaning_down: '최악의 시기를 넘겼어요. 이제는 오르막길뿐이에요. 희망을 가지세요.' },
  { id: 60, name: '소드 시종', name_en: 'Page of Swords', symbol: '⚔️', keywords_up: ['호기심', '새로운아이디어', '경계심', '지적탐구', '기민함'], keywords_down: ['가벼움', '실행력부족', '말과행동괴리', '분산'], meaning_up: '새로운 지식에 대한 호기심이 샘솟아요. 날카로운 관찰력으로 상황을 파악하고 있어요.', meaning_down: '아이디어는 많지만 실행이 부족해요. 하나를 정해 끝까지 밀고 나가보세요.' },
  { id: 61, name: '소드 기사', name_en: 'Knight of Swords', symbol: '⚔️', keywords_up: ['추진력', '야망', '직선적행동', '용기', '속도'], keywords_down: ['무모함', '충동', '경솔', '과도한경쟁'], meaning_up: '목표를 향해 맹렬하게 돌진하는 에너지가 가득해요. 결단력 있게 행동하면 빠른 성과가 있어요.', meaning_down: '너무 빨리 달리고 있어요. 속도를 조절하지 않으면 넘어질 수 있어요.' },
  { id: 62, name: '소드 여왕', name_en: 'Queen of Swords', symbol: '⚔️', keywords_up: ['독립', '통찰', '객관성', '직설적', '지혜'], keywords_down: ['냉정함', '비판적', '고립', '감정차단'], meaning_up: '명석한 이성과 날카로운 통찰로 상황을 판단하고 있어요. 독립적인 사고가 힘이 돼요.', meaning_down: '너무 차갑고 비판적일 수 있어요. 따뜻함도 함께 품으면 더 완벽해져요.' },
  { id: 63, name: '소드 왕', name_en: 'King of Swords', symbol: '⚔️', keywords_up: ['권위', '진실', '지성', '공정한판단', '리더십'], keywords_down: ['독단', '냉혹함', '조종', '권위주의'], meaning_up: '명석한 두뇌와 공정한 판단력으로 상황을 주도하고 있어요. 지적 권위가 인정받는 시기예요.', meaning_down: '자신의 생각만 옳다고 고집하고 있어요. 타인의 의견에도 귀 기울이세요.' },

  // --- 완드 (Wands) : 행동 · 열정 · 창조 ---
  { id: 64, name: '완드 에이스', name_en: 'Ace of Wands', symbol: '🔥', keywords_up: ['영감', '새로운도전', '창조적불꽃', '열정', '시작'], keywords_down: ['열정식음', '지연', '기회주저', '동력상실'], meaning_up: '가슴 속에서 불꽃이 타오르는 새로운 영감이 찾아왔어요. 이 열정을 행동으로 옮길 때예요.', meaning_down: '열정이 꺼지려 하고 있어요. 다시 불을 지필 수 있는 새로운 자극이 필요해요.' },
  { id: 65, name: '완드 2', name_en: 'Two of Wands', symbol: '🔥', keywords_up: ['계획', '미래선택', '시야확장', '결심', '지도'], keywords_down: ['우유부단', '두려움', '계획실행괴리', '안주함'], meaning_up: '더 넓은 세상을 바라보며 미래를 계획하고 있어요. 용기 있게 첫걸음을 내디디세요.', meaning_down: '계획만 세우고 행동으로 옮기지 못하고 있어요. 작게라도 시작하세요.' },
  { id: 66, name: '완드 3', name_en: 'Three of Wands', symbol: '🔥', keywords_up: ['확장', '전망', '진전', '대기', '해외기회'], keywords_down: ['지연', '기대저하', '방해', '단기근시'], meaning_up: '앞에 펼쳐진 가능성의 지평이 넓어지고 있어요. 뿌린 씨앗이 싹트기를 기다리는 시기예요.', meaning_down: '결과가 예상보다 늦어질 수 있어요. 조급해하지 말고 더 넓은 시야를 가지세요.' },
  { id: 67, name: '완드 4', name_en: 'Four of Wands', symbol: '🔥', keywords_up: ['축하', '안정', '가족모임', '성취인정', '터전'], keywords_down: ['불안정', '축하지연', '소속감결핍', '갈등'], meaning_up: '이루어 낸 성과를 축하하며 안정감을 느끼는 시기예요. 사랑하는 사람들과 기쁨을 나누세요.', meaning_down: '안정감이 흔들릴 수 있어요. 소속감을 다시 확인하는 노력이 필요해요.' },
  { id: 68, name: '완드 5', name_en: 'Five of Wands', symbol: '🔥', keywords_up: ['경쟁', '갈등', '의견충돌', '긴장', '훈련'], keywords_down: ['갈등해소', '협력', '타협', '평화'], meaning_up: '치열한 경쟁이나 의견 충돌이 있는 시기예요. 하지만 이 과정이 당신을 더 강하게 단련시켜요.', meaning_down: '갈등이 잦아들고 있어요. 서로의 의견을 존중하며 타협점을 찾으세요.' },
  { id: 69, name: '완드 6', name_en: 'Six of Wands', symbol: '🔥', keywords_up: ['승리', '인정', '명예', '성공', '자신감'], keywords_down: ['인하하락', '자만', '인정결핍', '지나친기대'], meaning_up: '노력이 결실을 맺어 승리와 인정을 받는 시기예요. 당당하게 성과를 누리세요.', meaning_down: '자만심이 생길 수 있어요. 겸손함을 잃지 않아야 더 오래 성공할 수 있어요.' },
  { id: 70, name: '완드 7', name_en: 'Seven of Wands', symbol: '🔥', keywords_up: ['방어', '의지', '독립수호', '용기', '끝까지버틈'], keywords_down: ['양보', '압도당함', '포기', '지침'], meaning_up: '자신의 자리를 끝까지 사수해야 하는 시기예요. 당신의 신념에 용기를 가지세요.', meaning_down: '혼자서 감당하기 벅찰 수 있어요. 도움을 요청하는 것도 지혜예요.' },
  { id: 71, name: '완드 8', name_en: 'Eight of Wands', symbol: '🔥', keywords_up: ['속도', '신속한행동', '소통', '진전', '메시지'], keywords_down: ['지연', '오해', '마비', '정체'], meaning_up: '빠르게 진행되는 변화와 소통의 흐름 속에 있어요. 흐름을 타면 빠른 성과를 얻을 수 있어요.', meaning_down: '흐름이 멈추거나 지연될 수 있어요. 조급해하지 말고 다음 바람을 기다리세요.' },
  { id: 72, name: '완드 9', name_en: 'Nine of Wands', symbol: '🔥', keywords_up: ['끈기', '인내', '마지막방어', '경계', '회복력'], keywords_down: ['포기', '번아웃', '지침', '회피'], meaning_up: '오랜 투쟁 끝에 마지막 고비에 서 있어요. 조금만 더 버티면 당신의 것이 될 거예요.', meaning_down: '체력이 한계에 다다랐어요. 잠시 쉬어가며 에너지를 보충할 필요가 있어요.' },
  { id: 73, name: '완드 10', name_en: 'Ten of Wands', symbol: '🔥', keywords_up: ['부담', '책임과다', '무거운짐', '고군분투', '임박한해방'], keywords_down: ['짐내려놓기', '위임', '휴식', '부담해소'], meaning_up: '너무 많은 책임을 짊어지고 있어요. 무거운 짐이지만 곧 내려놓을 수 있는终点가 가까워요.', meaning_down: '모든 것을 혼자 하려 하지 마세요. 짐을 나누면 훨씬 가벼워질 거예요.' },
  { id: 74, name: '완드 시종', name_en: 'Page of Wands', symbol: '🔥', keywords_up: ['탐험', '열정', '자유영혼', '새로운모험', '영감'], keywords_down: ['산만함', '실행지연', '변덕', '인내부족'], meaning_up: '새로운 세계를 향한 호기심과 열정이 넘쳐요. 두려움 없이 모험을 시작해보세요.', meaning_down: '이것저것 시작하고 마무리를 못 해요. 하나에 집중하는 훈련이 필요해요.' },
  { id: 75, name: '완드 기사', name_en: 'Knight of Wands', symbol: '🔥', keywords_up: ['에너지', '열정', '추진력', '모험심', '카리스마'], keywords_down: ['충동', '경솔', '실행착오', '과도한경쟁'], meaning_up: '불타는 열정으로 앞으로 나아가는 에너지가 가득해요. 자신감을 가지고 도전하세요.', meaning_down: '충동적으로 움직이고 있어요. 한 박자 쉬어가는 것이 더 나은 결과를 가져와요.' },
  { id: 76, name: '완드 여왕', name_en: 'Queen of Wands', symbol: '🔥', keywords_up: ['자신감', '카리스마', '독립성', '따뜻한리더십', '결단력'], keywords_down: ['질투', '독선', '과도한지배욕', '불안'], meaning_up: '당당하고 매력적인 에너지로 주변을 이끄는 시기예요. 자신감이 가장 큰 무기예요.', meaning_down: '자존심이 너무 센 나머지 관계가 틀어질 수 있어요. 조금은 부드러워질 필요가 있어요.' },
  { id: 77, name: '완드 왕', name_en: 'King of Wands', symbol: '🔥', keywords_up: ['리더십', '비전', '대담함', '카리스마', '창조적권위'], keywords_down: ['무모함', '독단', '성급함', '과도한통제'], meaning_up: '비전을 품고 사람들을 이끄는 자연스러운 리더의 자리에 있어요. 대담하게 앞장서세요.', meaning_down: '독단적으로 이끌고 있어요. 팀의 목소리에 귀 기울이면 더 위대한 성과가 나와요.' },
];

export const ALL_CARDS: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];

/** 카드 ID로 조회 */
export function getCard(id: number): TarotCard | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}

/** 카테고리 이름 매핑 */
export const CATEGORY_NAMES: Record<string, string> = {
  love: '💕 연애운',
  money: '💰 재물운',
  career: '💼 직장운',
  general: '🌟 종합운',
  newyear: '🎯 신년운',
  compatibility: '🤝 궁합',
};
