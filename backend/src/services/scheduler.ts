import cron from 'node-cron';
import { generateAndSendDailyHoroscopes } from './dailyHoroscope';

export function startNotificationScheduler(): void {
  cron.schedule('0 22 * * *', async () => {
    console.log('[Scheduler] Daily horoscope generation started:', new Date().toISOString());
    try {
      const count = await generateAndSendDailyHoroscopes();
      console.log(`[Scheduler] Generated ${count} horoscopes`);
    } catch (err) {
      console.error('[Scheduler] Generation failed:', err);
    }
  });
  console.log('[Notification] Daily horoscope scheduler registered (07:00 KST)');
}
