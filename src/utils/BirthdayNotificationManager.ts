import { database, BirthdayReminder } from '../database/Database';
import { notificationService } from '../services/NotificationService';

class BirthdayNotificationManagerClass {
  /**
   * Initialize all birthday reminders
   * Should be called at app startup
   */
  async init(): Promise<void> {
    try {
      console.log('BirthdayNotificationManager: Initializing notifications');
      
      // Initialize notification permissions
      const notificationPermissionGranted = await notificationService.init();
      if (!notificationPermissionGranted) {
        console.log('BirthdayNotificationManager: Notification permissions not granted');
        return;
      }
      
      // Get all birthday reminders from database
      const reminders = await database.getAllBirthdayReminders();
      console.log(`BirthdayNotificationManager: Found ${reminders.length} birthday reminders`);
      
      // Schedule each reminder
      for (const reminder of reminders) {
        if (reminder.is_enabled) {
          await this.scheduleReminder(reminder);
        }
      }
      
      console.log('BirthdayNotificationManager: Initialization complete');
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
        console.log(`BirthdayNotificationManager: Entity ${reminder.entity_id} not found, skipping reminder`);
        return;
      }
      
      // Get the birthday from the entity
      const birthday = await database.getBirthdayForPerson(reminder.entity_id);
      if (!birthday) {
        console.log(`BirthdayNotificationManager: No birthday set for entity ${entity.name}, skipping reminder`);
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
        console.log(`BirthdayNotificationManager: Scheduled reminder for ${entity.name}'s birthday`);
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
        console.log(`BirthdayNotificationManager: Reminder ${reminderId} not found`);
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