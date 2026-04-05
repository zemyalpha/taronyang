/** 상담 기록 저장 */
export declare function saveReading(userId: string | null, category: string, question: string, cards: any[], interpretation: string): string;
export declare const readingsRouter: import("express-serve-static-core").Router;
