import { database, BirthdayReminder } from '../database/Database';
import { notificationService } from '../services/NotificationService';

class BirthdayNotificationManagerClass {
  /**
   * Initialize all birthday reminders
   * Should be called at app startup
   */
  async init(): Promise<void> {
    try {
      // Initialize notification permissions
      const notificationPermissionGranted = await notificationService.init();
      if (!notificationPermissionGranted) {
        return;
      }
      
      // Get all birthday reminders from database
      const reminders = await database.getAllBirthdayReminders();
      
      // Schedule each reminder
      for (const reminder of reminders) {
        if (reminder.is_enabled) {
          await this.scheduleReminder(reminder);
        }
      }
    } catch (error) {
      console.error('BirthdayNotificationManager: Error initializing reminders:', error);
    }
  }
  
  /**
   * Schedule a single birthday reminder
   */
  private async scheduleReminder(reminder: BirthdayReminder): Promise<void> {
    try {
      const entity = await database.getEntityById(reminder.entity_id);
      if (!entity) {
        return;
      }
      
      // Get the birthday from the entity
      const birthday = await database.getBirthdayForPerson(reminder.entity_id);
      if (!birthday) {
        return;
      }
      
      // Schedule the notification
      const notificationId = await notificationService.scheduleBirthdayReminder({
        id: reminder.notification_id || '',
        entityId: reminder.entity_id,
        entityName: entity.name,
        birthdayDate: birthday,
        reminderTime: reminder.reminder_time,
        daysInAdvance: reminder.days_in_advance,
        isEnabled: reminder.is_enabled
      });
      
      // Update the reminder in the database with the new notification ID
      if (notificationId !== reminder.notification_id) {
        await database.updateBirthdayReminder(reminder.id, {
          notificationId: notificationId
        });
      }
    } catch (error) {
      console.error(`BirthdayNotificationManager: Error scheduling reminder:`, error);
    }
  }
  
  /**
   * Reschedule a reminder after changes
   */
  async rescheduleReminder(reminderId: string): Promise<void> {
    try {
      const reminder = await database.getBirthdayReminder(reminderId);
      if (!reminder) {
        return;
      }
      
      // Cancel existing notification if there is one
      if (reminder.notification_id) {
        await notificationService.cancelNotification(reminder.notification_id);
      }
      
      // Schedule the new notification if enabled
      if (reminder.is_enabled) {
        await this.scheduleReminder(reminder);
      }
    } catch (error) {
      console.error('BirthdayNotificationManager: Error rescheduling reminder:', error);
    }
  }
}

export const BirthdayNotificationManager = new BirthdayNotificationManagerClass(); 