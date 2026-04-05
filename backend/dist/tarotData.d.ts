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
export declare const MAJOR_ARCANA: TarotCard[];
export declare const ALL_CARDS: TarotCard[];
/** 카드 ID로 조회 */
export declare function getCard(id: number): TarotCard | undefined;
/** 카테고리 이름 매핑 */
export declare const CATEGORY_NAMES: Record<string, string>;
