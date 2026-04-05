/** 일운 생성 (LLM) */
export declare function generateDailyHoroscope(zodiacSign: string, date: string): Promise<string>;
/** 12별자리 전체 일운 생성 */
export declare function generateAllHoroscopes(): Promise<Record<string, string>>;
/** 구독자 전체에게 일운 발송 */
export declare function sendDailyNotifications(): Promise<void>;
/** 스케줄러 시작 */
export declare function startDailyScheduler(): void;
