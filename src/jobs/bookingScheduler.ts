import { AppDataSource } from '../db/datasource';
import { Booking, BookingStatus } from '../controllers/src-entity/bookingEntity';
import { LessThanOrEqual } from 'typeorm';

export const startBookingStatusScheduler = () => {
  const checkInterval = 60 * 60 * 1000; // Run once every hour

  console.log('[Scheduler] Background Booking Status Updater initialized.');

  setInterval(async () => {
    try {
      const now = new Date();
      const bookingRepo = AppDataSource.getRepository(Booking);

      // 1. Transition PAID -> ACTIVE (when start date has arrived)
      const activatedResult = await bookingRepo.update(
        {
          status: BookingStatus.PAID,
          startDate: LessThanOrEqual(now),
        },
        {
          status: BookingStatus.ACTIVE,
        }
      );

      if (activatedResult.affected && activatedResult.affected > 0) {
        console.log(`[Scheduler] Activated ${activatedResult.affected} bookings.`);
      }

      // 2. Transition ACTIVE -> COMPLETED (when end date has passed)
      const completedResult = await bookingRepo.update(
        {
          status: BookingStatus.ACTIVE,
          endDate: LessThanOrEqual(now),
        },
        {
          status: BookingStatus.COMPLETED,
        }
      );

      if (completedResult.affected && completedResult.affected > 0) {
        console.log(`[Scheduler] Completed ${completedResult.affected} bookings.`);
      }

    } catch (error) {
      console.error('[Scheduler] Error processing automatic status updates:', error);
    }
  }, checkInterval);
};