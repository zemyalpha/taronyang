"use strict";
/** 타로카드 78장 데이터 (TypeScript) */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_NAMES = exports.ALL_CARDS = exports.MAJOR_ARCANA = void 0;
exports.getCard = getCard;
exports.MAJOR_ARCANA = [
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
// 마이너 아르카나 생성 함수
function generateMinorArcana() {
    const suits = [
        { suit: '컵', suit_en: 'Cups', symbol: '💕', theme: '감정' },
        { suit: '펜타클', suit_en: 'Pentacles', symbol: '💰', theme: '물질' },
        { suit: '소드', suit_en: 'Swords', symbol: '⚔️', theme: '사고' },
        { suit: '완드', suit_en: 'Wands', symbol: '🔥', theme: '행동' },
    ];
    const numbers = ['에이스', '2', '3', '4', '5', '6', '7', '8', '9', '10', '시종', '기사', '여왕', '왕'];
    const cards = [];
    let id = 22;
    for (const s of suits) {
        for (let i = 0; i < 14; i++) {
            cards.push({
                id: id++,
                name: `${s.suit} ${numbers[i]}`,
                name_en: `${numbers[i]} of ${s.suit_en}`,
                symbol: s.symbol,
                keywords_up: [s.theme, i < 10 ? `${i + 1}의에너지` : `${numbers[i]}의자질`],
                keywords_down: [`${s.theme}역행`, '불균형'],
                meaning_up: `${s.suit} ${numbers[i]}의 긍정적 에너지가 당신을 감싸고 있어요.`,
                meaning_down: `${s.suit} ${numbers[i]}의 에너지가 막혀있어요. 균형을 찾으세요.`,
            });
        }
    }
    return cards;
}
exports.ALL_CARDS = [...exports.MAJOR_ARCANA, ...generateMinorArcana()];
/** 카드 ID로 조회 */
function getCard(id) {
    return exports.ALL_CARDS.find((c) => c.id === id);
}
/** 카테고리 이름 매핑 */
exports.CATEGORY_NAMES = {
    love: '💕 연애운',
    money: '💰 재물운',
    career: '💼 직장운',
    general: '🌟 종합운',
    newyear: '🎯 신년운',
    compatibility: '🤝 궁합',
};
