import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { format, addYears, isValid, parseISO, addHours } from 'date-fns';
import { database } from '../database/Database';

// Interface for birthday reminder
export interface BirthdayReminder {
  id: string;
  entityId: string;
  entityName: string;
  birthdayDate: string; // ISO format string
  reminderTime: string; // ISO format string, represents time of day for reminder
  daysInAdvance: number; // Days before birthday to send reminder
  isEnabled: boolean;
}

class NotificationService {
  // Initialize notifications
  async init(): Promise<boolean> {
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('birthdays', {
        name: 'Birthday Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Request permission
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for notifications!');
        return false;
      }
      
      return true;
    } else {
      console.log('Must use physical device for notifications');
      return false;
    }
  }

  // Get the time set to 5:15pm Eastern Time in local device time
  private get515pmEasternTimeInLocal(date: Date): Date {
    // Clone the date to avoid modifying the original
    const reminderDate = new Date(date);
    
    // First, set the time to midnight in the local timezone
    reminderDate.setHours(0, 0, 0, 0);
    
    // Calculate the offset from local time to Eastern Time (ET)
    // Eastern Time is UTC-5 (standard) or UTC-4 (daylight savings)
    
    // Get the local timezone offset in minutes
    const localOffset = reminderDate.getTimezoneOffset();
    
    // Eastern Time offsets in minutes:
    // Standard time (EST): UTC-5 = 300 minutes
    // Daylight time (EDT): UTC-4 = 240 minutes
    
    // Determine if Eastern Time is currently observing daylight savings
    // This is a simplified approach - in a production app, use a library like moment-timezone
    const easternDate = new Date(date.getTime());
    const jan = new Date(easternDate.getFullYear(), 0, 1);
    const jul = new Date(easternDate.getFullYear(), 6, 1);
    
    // If Eastern is in DST, use EDT offset, otherwise use EST offset
    const isDST = 
      Math.min(jan.getTimezoneOffset(), jul.getTimezoneOffset()) < 
      Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    
    const easternOffset = isDST ? 240 : 300; // EDT or EST offset in minutes
    
    // Calculate the difference between local timezone and Eastern Time
    const diffMinutes = localOffset - easternOffset;
    
    // Set the time to 5:15pm (17:15) Eastern Time by adjusting for the difference
    reminderDate.setHours(17, 15, 0, 0);
    reminderDate.setMinutes(reminderDate.getMinutes() + diffMinutes);
    
    return reminderDate;
  }

  // Send a test notification immediately (for debugging)
  async sendTestNotification(): Promise<string> {
    try {
      console.log('Sending test notification...');
      
      // Make sure permissions are granted first
      const permissionGranted = await this.init();
      if (!permissionGranted) {
        console.log('Cannot send test notification - permissions not granted');
        return '';
      }
      
      // Create notification to be delivered in 5 seconds
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'PimGarden Test Notification',
          body: 'If you see this, notifications are working! 🎉 Sent at: ' + new Date().toLocaleTimeString(),
          data: { type: 'test' },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: { 
          seconds: 5,  // Show notification after 5 seconds
          channelId: 'birthdays',
        },
      });
      
      console.log(`Test notification scheduled with ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return '';
    }
  }

  // Schedule a birthday reminder
  async scheduleBirthdayReminder(reminder: BirthdayReminder): Promise<string> {
    if (!reminder.isEnabled) {
      return '';
    }

    let birthdayDate: Date;
    let noYear = false;

    // Handle special no-year format
    if (reminder.birthdayDate.startsWith('NOYR:')) {
      // Extract the MM-DD part
      const monthDay = reminder.birthdayDate.substring(5);
      const [month, day] = monthDay.split('-').map(Number);
      
      // Create a date using current year
      birthdayDate = new Date();
      birthdayDate.setMonth(month - 1); // Month is 0-indexed in JS
      birthdayDate.setDate(day);
      noYear = true;
    } else {
      // Regular date with year
      birthdayDate = parseISO(reminder.birthdayDate);
      if (!isValid(birthdayDate)) {
        throw new Error('Invalid birthday date');
      }
    }

    // Calculate the next birthday date
    const today = new Date();
    let nextBirthday = new Date(
      today.getFullYear(),
      birthdayDate.getMonth(),
      birthdayDate.getDate()
    );
    
    // If the birthday has already passed this year, set it for next year
    if (nextBirthday < today) {
      nextBirthday = addYears(nextBirthday, 1);
    }

    // Ensure we're not scheduling more than 1 year in advance
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (nextBirthday > oneYearFromNow) {
      return '';
    }

    // Calculate reminder date (days in advance)
    const reminderDate = new Date(nextBirthday);
    reminderDate.setDate(reminderDate.getDate() - reminder.daysInAdvance);
    
    // Set the reminder to 5:15pm Eastern Time
    const reminderTime = this.get515pmEasternTimeInLocal(reminderDate);
    
    // Don't schedule if the reminder date is in the past
    const now = new Date();
    if (reminderTime < now) {
      // If today's 5:15pm ET has already passed, set it for the same time tomorrow
      if (reminderDate.getDate() === now.getDate()) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      } else {
        // Skip scheduling if it would be more than a year away
        return '';
      }
    }

    // Calculate age for the upcoming birthday (only if year is specified)
    let agePart = '';
    if (!noYear) {
      const age = nextBirthday.getFullYear() - birthdayDate.getFullYear();
      if (age > 0) {
        agePart = ` (turning ${age})`;
      }
    }
    
    // Cancel existing notification if there is one
    if (reminder.id) {
      await this.cancelNotification(reminder.id);
    }

    // Create notification content
    const notificationContent = {
      title: `${reminder.entityName}'s Birthday Reminder`,
      body: `${reminder.entityName}'s birthday is ${reminder.daysInAdvance === 0 ? 'today' : 
        `in ${reminder.daysInAdvance} day${reminder.daysInAdvance > 1 ? 's' : ''}`} on ${format(nextBirthday, 'MMMM d')}${agePart}.`,
      data: { 
        entityId: reminder.entityId,
        type: 'birthday',
        recurring: true
      },
      sound: 'default', // Add sound to ensure notification gets attention
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };

    // Schedule for first occurrence (Expo does not support yearly triggers directly)
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: reminderTime,
        channelId: 'birthdays',
      },
    });

    return notificationId;
  }

  // Cancel a scheduled notification
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Get all scheduled notifications
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }
  
  // For testing: Schedule a notification for today at 5:15pm ET
  async scheduleTestBirthdayToday(personName: string = "Test Person"): Promise<string> {
    // Calculate today's date at 5:15pm Eastern
    const today = new Date();
    const reminderTime = this.get515pmEasternTimeInLocal(today);
    
    // If 5:15pm already passed, add 2 minutes from now for testing
    const now = new Date();
    if (reminderTime < now) {
      reminderTime.setTime(now.getTime() + 2 * 60 * 1000); // 2 minutes from now
    }
    
    console.log(`Scheduling test birthday reminder for today at ${format(reminderTime, 'h:mm a')}`);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${personName}'s Birthday Reminder (TEST)`,
        body: `This is a test birthday reminder for ${personName}. If you see this, notifications are working correctly!`,
        data: { 
          type: 'birthday-test',
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        date: reminderTime,
        channelId: 'birthdays',
      },
    });
    
    console.log(`Test birthday reminder scheduled with ID: ${notificationId}`);
    return notificationId;
  }
}

export const notificationService = new NotificationService(); 