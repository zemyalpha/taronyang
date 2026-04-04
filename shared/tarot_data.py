"""
타로카드 78장 데이터
메이저 아르카나 22장 + 마이너 아르카나 56장
"""

MAJOR_ARCANA = [
    {"id": 0, "name": "바보", "name_en": "The Fool", "symbol": "🃏",
     "keywords_up": ["새시작", "자유", "모험", "순수", "무한한가능성"],
     "keywords_down": ["무모함", "경솔", "미숙", "판단부족"],
     "meaning_up": "새로운 시작과 무한한 가능성이 열려있어요. 두려움 없이 한 걸음 내디뎌보세요.",
     "meaning_down": "너무 서두르고 있을 수 있어요. 한 박자 쉬어가며 신중하게 결정하세요."},
    {"id": 1, "name": "마법사", "name_en": "The Magician", "symbol": "🧙",
     "keywords_up": ["창조", "기술", "의지력", "집중", "성공"],
     "keywords_down": ["조작", "기만", "재능낭비", "자신감부족"],
     "meaning_up": "당신에게 필요한 모든 것이 이미 갖춰져 있어요. 능력을 믿고 행동하세요.",
     "meaning_down": "재능을 제대로 활용하지 못하고 있어요. 자신감을 되찾을 시간이에요."},
    {"id": 2, "name": "여사제", "name_en": "The High Priestess", "symbol": "🌙",
     "keywords_up": ["직관", "지혜", "신비", "내면의목소리", "은비적지식"],
     "keywords_down": ["비밀", "거리낌", "내면무시", "감정억압"],
     "meaning_up": "내면의 목소리에 귀를 기울이세요. 답은 이미 당신 안에 있어요.",
     "meaning_down": "직감을 무시하고 있어요. 마음의 소리를 외면하지 마세요."},
    {"id": 3, "name": "여황제", "name_en": "The Empress", "symbol": "👑",
     "keywords_up": ["풍요", "모성", "창조", "자연", "성장"],
     "keywords_down": ["과잉보호", "의존", "창조력부족", "나태"],
     "meaning_up": "풍요와 성장의 에너지가 가득해요. 당신의 노력이 열매를 맺을 거예요.",
     "meaning_down": "스스로를 돌보는 것을 소홀히 하고 있어요. 자신에게도 너그러워지세요."},
    {"id": 4, "name": "황제", "name_en": "The Emperor", "symbol": "🏛️",
     "keywords_up": ["권위", "안정", "리더십", "구조", "아버지상"],
     "keywords_down": ["독재", "완고함", "통제력과도", "유연성부족"],
     "meaning_up": "질서와 안정이 필요한 시기예요. 체계적으로 계획을 세워보세요.",
     "meaning_down": "너무 경직되어 있어요. 조금 더 유연해질 필요가 있어요."},
    {"id": 5, "name": "교황", "name_en": "The Hierophant", "symbol": "⛪",
     "keywords_up": ["전통", "가르침", "신앙", "의식", "멘토"],
     "keywords_down": ["구습", "권위주의", "반항", "비전통적"],
     "meaning_up": "좋은 스승이나 멘토를 만날 수 있는 시기예요. 배움에 열려있으세요.",
     "meaning_down": "전통에 얽매여 있어요. 때로는 새로운 방식을 시도해보세요."},
    {"id": 6, "name": "연인", "name_en": "The Lovers", "symbol": "💕",
     "keywords_up": ["사랑", "선택", "조화", "매력", "결합"],
     "keywords_down": ["갈등", "선택의어려움", "불화", "가치관충돌"],
     "meaning_up": "중요한 선택의 순간이에요. 마음이 이끄는 대로 선택하세요.",
     "meaning_down": "마음과 이성이 충돌하고 있어요. 진정으로 원하는 것을 스스로에게 물어보세요."},
    {"id": 7, "name": "전차", "name_en": "The Chariot", "symbol": "⚡",
     "keywords_up": ["승리", "결단", "전진", "의지", "성취"],
     "keywords_down": ["패배감", "방향상실", "조급함", "통제력상실"],
     "meaning_up": "강한 의지로 목표를 향해 전진할 때예요. 승리는 가까워요.",
     "meaning_down": "방향을 잃은 것 같아요. 잠시 멈춰서 목표를 재정립하세요."},
    {"id": 8, "name": "힘", "name_en": "Strength", "symbol": "🦁",
     "keywords_up": ["용기", "인내", "내면의힘", "자제력", "연민"],
     "keywords_down": ["나약함", "자신감결핍", "분노", "두려움"],
     "meaning_up": "부드러운 힘이 필요한 시기예요. 인내와 용기로 극복할 수 있어요.",
     "meaning_down": "자신감이 떨어져 있어요. 작은 성공부터 다시 쌓아가세요."},
    {"id": 9, "name": "은둔자", "name_en": "The Hermit", "symbol": "🏔️",
     "keywords_up": ["성찰", "고독", "지혜", "내면탐구", "안내자"],
     "keywords_down": ["고립", "회피", "외로움", "과도한은둔"],
     "meaning_up": "혼자만의 시간이 필요해요. 내면을 깊이 들여다보며 답을 찾으세요.",
     "meaning_down": "세상과 너무 단절되어 있어요. 적당한 교류도 필요해요."},
    {"id": 10, "name": "운명의수레바퀴", "name_en": "Wheel of Fortune", "symbol": "🎡",
     "keywords_up": ["변화", "전환", "운", "기회", "순환"],
     "keywords_down": ["역경", "불운", "저항", "변화에대한두려움"],
     "meaning_up": "운이 바뀌고 있어요. 좋은 흐름이 오고 있으니 기회를 잡으세요.",
     "meaning_down": "지금은 흔들리는 시기예요. 변화를 받아들이면 곧 좋아질 거예요."},
    {"id": 11, "name": "정의", "name_en": "Justice", "symbol": "⚖️",
     "keywords_up": ["공정", "진실", "균형", "책임", "인과응보"],
     "keywords_down": ["불공정", "편견", "책임회피", "불균형"],
     "meaning_up": "정의로운 결과가 따를 거예요. 정직하게 행동하면 좋은 결실이 있어요.",
     "meaning_down": "불공정한 상황에 있을 수 있어요. 균형을 되찾기 위해 노력하세요."},
    {"id": 12, "name": "매달린사람", "name_en": "The Hanged Man", "symbol": "🔄",
     "keywords_up": ["희생", "새관점", "기다림", "내려놓음", "깨달음"],
     "keywords_down": ["지연", "희생강요", "우유부단", "희망고문"],
     "meaning_up": "다르게 바라볼 시간이에요. 기다림 속에서 새로운 깨달음을 얻을 거예요.",
     "meaning_down": "너무 오래 머뭇거리고 있어요. 결단을 내릴 때가 왔어요."},
    {"id": 13, "name": "죽음", "name_en": "Death", "symbol": "🦋",
     "keywords_up": ["끝과시작", "변환", "해방", "탈바꿈", "재탄생"],
     "keywords_down": ["저항", "변화거부", "집착", "두려움"],
     "meaning_up": "하나의 장이 끝나고 새로운 장이 시작돼요. 과거를 내려놓고 변화를 받아들이세요.",
     "meaning_down": "변화를 두려워하고 있어요. 놓아야 할 것을 놓아주세요."},
    {"id": 14, "name": "절제", "name_en": "Temperance", "symbol": "🏺",
     "keywords_up": ["균형", "조화", "인내", "중용", "치유"],
     "keywords_down": ["과잉", "불균형", "급진", "극단"],
     "meaning_up": "모든 것의 균형이 필요한 시기예요. 극단을 피하고 중용을 지키세요.",
     "meaning_down": "모든 것을 너무 몰아가고 있어요. 템포를 조절하세요."},
    {"id": 15, "name": "악마", "name_en": "The Devil", "symbol": "🔗",
     "keywords_up": ["집착", "유혹", "속박", "그림자", "물질주의"],
     "keywords_down": ["해방", "깨어남", "속박에서벗어남", "자유"],
     "meaning_up": "무언가에 지나치게 집착하고 있을 수 있어요. 스스로를 옭아매는 것에서 벗어나세요.",
     "meaning_down": "속박에서 벗어날 힘이 생기고 있어요. 자유가 가까워요."},
    {"id": 16, "name": "탑", "name_en": "The Tower", "symbol": "⚡",
     "keywords_up": ["급변", "파괴", "진실노출", "해방", "각성"],
     "keywords_down": ["재난회피", "변화지연", "거부", "공포"],
     "meaning_up": "갑작스러운 변화가 찾아올 수 있어요. 하지만 무너진 자리에 더 강한 것이 세워질 거예요.",
     "meaning_down": "피할 수 없는 변화를 거부하고 있어요. 받아들이면 오히려 성장의 기회가 돼요."},
    {"id": 17, "name": "별", "name_en": "The Star", "symbol": "⭐",
     "keywords_up": ["희망", "영감", "치유", "신앙", "밝은미래"],
     "keywords_down": ["절망", "신뢰상실", "방향감각상실", "희망고문"],
     "meaning_up": "희망의 빛이 비치고 있어요. 어려움 속에서도 빛은 항상 있어요.",
     "meaning_down": "희망을 잃지 마세요. 가장 어두운 밤이 지나면 새벽이 와요."},
    {"id": 18, "name": "달", "name_en": "The Moon", "symbol": "🌕",
     "keywords_up": ["환상", "직관", "무의식", "불안", "신비"],
     "keywords_down": ["혼란해소", "진실노출", "두려움극복", "명확해짐"],
     "meaning_up": "상황이 불명확하고 혼란스러울 수 있어요. 시간이 지나면 진실이 드러날 거예요.",
     "meaning_down": "혼란이 걷히고 있어요. 진실을 마주할 준비가 되셨나요?"},
    {"id": 19, "name": "해", "name_en": "The Sun", "symbol": "☀️",
     "keywords_up": ["성공", "기쁨", "활력", "긍정", "명확함"],
     "keywords_down": ["일시적침체", "자만", "과도한낙관", "에너지저하"],
     "meaning_up": "밝은 에너지가 가득해요! 지금 하는 일이 좋은 결과를 맺을 거예요.",
     "meaning_down": "조금 지쳐있을 수 있어요. 에너지를 재충전할 시간이 필요해요."},
    {"id": 20, "name": "심판", "name_en": "Judgement", "symbol": "📯",
     "keywords_up": ["부활", "각성", "소명", "자기평가", "새출발"],
     "keywords_down": ["자기의심", "후회", "과거집착", "변화거부"],
     "meaning_up": "인생의 전환점이에요. 과거를 되돌아보고 새로운 소명을 따르세요.",
     "meaning_down": "과거에 얽매여 있어요. 자신을 용서하고 앞으로 나아가세요."},
    {"id": 21, "name": "세계", "name_en": "The World", "symbol": "🌍",
     "keywords_up": ["완성", "성취", "통합", "여행", "순환완료"],
     "keywords_down": ["미완성", "지연", "마무리부족", "결핍감"],
     "meaning_up": "하나의 큰 순환이 완성되고 있어요. 지금까지의 노력이 아름답게 완성될 거예요.",
     "meaning_down": "아직 끝내지 못한 일이 있어요. 마지막 한 걸음을 내디뎌보세요."},
]

SUITS = {
    "wands": {"name": "완드", "name_en": "Wands", "element": "불", "symbol": "🔥", "theme": "행동, 열정, 창조"},
    "cups": {"name": "컵", "name_en": "Cups", "element": "물", "symbol": "💧", "theme": "감정, 관계, 사랑"},
    "swords": {"name": "검", "name_en": "Swords", "element": "공기", "symbol": "🗡️", "theme": "사고, 갈등, 진실"},
    "pentacles": {"name": "펜타클", "name_en": "Pentacles", "element": "흙", "symbol": "🪙", "theme": "물질, 돈, 현실"},
}

NUMBERS = {
    1: ("에이스", "새로운 시작"),
    2: ("투", "균형과 선택"),
    3: ("쓰리", "성장과 협력"),
    4: ("포", "안정과 기반"),
    5: ("파이브", "갈등과 변화"),
    6: ("식스", "조화와 베풂"),
    7: ("세븐", "성찰과 재평가"),
    8: ("에이트", "역경과 극복"),
    9: ("나인", "성숙과 성취"),
    10: ("텐", "완성과 전환"),
}

COURT = {
    "page": ("시종", "학습과 호기심"),
    "knight": ("기사", "행동과 추진"),
    "queen": ("여왕", "성숙과 내면"),
    "king": ("왕", "통찰과 지혜"),
}

# 마이너 아르카나 56장 자동 생성
MINOR_ARCANA = []
for suit_key, suit_info in SUITS.items():
    # 숫자 카드 (1-10)
    for num in range(1, 11):
        num_name, num_theme = NUMBERS[num]
        MINOR_ARCANA.append({
            "id": f"{suit_key}_{num}",
            "name": f"{suit_info['name']} {num_name}",
            "name_en": f"{num} of {suit_info['name_en']}",
            "suit": suit_key,
            "symbol": suit_info["symbol"],
            "number": num,
            "keywords_up": [num_theme, suit_info["theme"].split(", ")[0], "발전"],
            "keywords_down": ["지연", "역경", "방해"],
            "meaning_up": f"{suit_info['element']}의 에너지와 함께 {num_theme}의 시기가 찾아왔어요.",
            "meaning_down": f"{suit_info['element']}의 에너지가 원활하지 않아요. {num_theme}에 집중해보세요.",
        })
    # 코트 카드 (시종, 기사, 여왕, 왕)
    for court_key, (court_name, court_theme) in COURT.items():
        MINOR_ARCANA.append({
            "id": f"{suit_key}_{court_key}",
            "name": f"{suit_info['name']} {court_name}",
            "name_en": f"{court_key.capitalize()} of {suit_info['name_en']}",
            "suit": suit_key,
            "symbol": suit_info["symbol"],
            "court": court_key,
            "keywords_up": [court_theme, suit_info["theme"].split(", ")[0], "인물"],
            "keywords_down": ["과잉", "부족", "극단"],
            "meaning_up": f"{suit_info['element']} 에너지를 가진 사람이나 {court_theme}의 시기예요.",
            "meaning_down": f"{suit_info['element']}의 에너지가 불균형해요. {court_theme}을 되돌아보세요.",
        })

# 전체 카드
ALL_CARDS = MAJOR_ARCANA + MINOR_ARCANA
CARD_COUNT = len(ALL_CARDS)  # 78

def get_card(card_id):
    for card in ALL_CARDS:
        if isinstance(card["id"], str) and card["id"] == card_id:
            return card
        elif isinstance(card["id"], int) and card["id"] == card_id:
            return card
    return None

def get_random_cards(count=10):
    import random
    return random.sample(ALL_CARDS, min(count, CARD_COUNT))
