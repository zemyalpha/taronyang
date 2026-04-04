"""
타로 API 테스트
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from tarot_data import ALL_CARDS, CARD_COUNT, get_card, get_random_cards


def test_card_count():
    assert CARD_COUNT == 78
    assert len(ALL_CARDS) == 78


def test_major_arcana():
    majors = [c for c in ALL_CARDS if isinstance(c["id"], int)]
    assert len(majors) == 22
    assert majors[0]["name"] == "바보"
    assert majors[-1]["name"] == "세계"


def test_minor_arcana():
    minors = [c for c in ALL_CARDS if isinstance(c["id"], str)]
    assert len(minors) == 56


def test_get_card():
    card = get_card(0)
    assert card is not None
    assert card["name"] == "바보"

    card = get_card("wands_1")
    assert card is not None
    assert "완드" in card["name"]


def test_get_random_cards():
    cards = get_random_cards(10)
    assert len(cards) == 10
    # 중복 없음
    ids = [c["id"] for c in cards]
    assert len(ids) == len(set(ids))


def test_card_fields():
    for card in ALL_CARDS:
        assert "name" in card
        assert "name_en" in card
        assert "keywords_up" in card
        assert "keywords_down" in card
        assert "meaning_up" in card
        assert "meaning_down" in card
