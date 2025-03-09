import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { database } from '../database/Database';
import { notificationService } from './NotificationService';

// Task name for background notification check
const BACKGROUND_NOTIFICATION_TASK = 'background-notification-check';

// Register the task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    // Get all enabled birthday reminders
    const reminders = await database.getAllBirthdayReminders();
    const enabledReminders = reminders.filter(r => r.is_enabled);
    
    // Check if any notifications need to be rescheduled
    let rescheduled = 0;
    for (const reminder of enabledReminders) {
      // Get entity and birthday info
      const entity = await database.getEntityById(reminder.entity_id);
      if (!entity) {
        continue;
      }
      
      const birthday = await database.getBirthdayForPerson(reminder.entity_id);
      if (!birthday) {
        continue;
      }
      
      // Reschedule the notification - this will ensure notifications stay scheduled
      // even when the app has been closed for an extended period
      const notificationId = await notificationService.scheduleBirthdayReminder({
        id: reminder.notification_id || '',
        entityId: reminder.entity_id,
        entityName: entity.name,
        birthdayDate: birthday,
        reminderTime: reminder.reminder_time,
        daysInAdvance: reminder.days_in_advance,
        isEnabled: true
      });
      
      if (notificationId) {
        rescheduled++;
      }
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in background notification task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundNotificationTask() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
      minimumInterval: 60 * 60, // Run once per hour (in seconds)
      stopOnTerminate: false,    // Keep running after app is closed
      startOnBoot: true,         // Run task when device is restarted
    });
  } catch (error) {
    console.error('Error registering background task:', error);
  }
}

export async function unregisterBackgroundNotificationTask() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (error) {
    console.error('Error unregistering background task:', error);
  }
} 