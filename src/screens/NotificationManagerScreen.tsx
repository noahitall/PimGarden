import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Card, Text, Button, IconButton, Divider, Dialog, Portal } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/NotificationService';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { database } from '../database/Database';

interface EnhancedNotification extends Notifications.NotificationRequest {
  entityName: string;
  formattedDate: string;
  timeUntilSeconds: number;  // Add field to store time until notification in seconds
}

const NotificationManagerScreen: React.FC = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<EnhancedNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<EnhancedNotification | null>(null);
  
  // Load all scheduled notifications
  const loadNotifications = async () => {
    try {
      setRefreshing(true);
      const scheduledNotifications = await notificationService.getAllScheduledNotifications();
      
      console.log('Loaded notifications:', JSON.stringify(scheduledNotifications, null, 2));
      
      // Enhance notification data with entity info if possible
      const enhancedNotifications = await Promise.all(
        scheduledNotifications.map(async (notification) => {
          let entityName = 'Unknown';
          let entityId = notification.content.data?.entityId as string | undefined;
          
          if (entityId) {
            try {
              const entity = await database.getEntityById(entityId);
              if (entity) {
                entityName = entity.name;
              }
            } catch (error) {
              console.error('Error fetching entity details:', error);
            }
          }
          
          // Format the trigger date if it exists
          let formattedDate = 'Unknown date';
          // Default value for time until notification (very large for unknown times)
          let timeUntilSeconds = Number.MAX_SAFE_INTEGER;
          
          // Debug logging to understand the notification structure
          console.log('Notification trigger:', JSON.stringify(notification.trigger));
          
          try {
            if (notification.trigger) {
              // Different ways the date might be stored depending on trigger type
              if ('date' in notification.trigger && notification.trigger.date) {
                const triggerDate = notification.trigger.date as Date | number | string;
                const dateObject = new Date(triggerDate);
                formattedDate = format(dateObject, 'MMM d, yyyy h:mm a');
                // Calculate seconds until notification
                timeUntilSeconds = Math.max(0, (dateObject.getTime() - Date.now()) / 1000);
              } else if ('seconds' in notification.trigger && notification.trigger.seconds) {
                // For notifications with seconds trigger, calculate the date
                const seconds = Math.round(notification.trigger.seconds); // Round to nearest second
                timeUntilSeconds = seconds;
                const futureDate = new Date(Date.now() + seconds * 1000);
                formattedDate = `In ${seconds} seconds (${format(futureDate, 'h:mm a')})`;
              } else if ('dateComponents' in notification.trigger && notification.trigger.dateComponents) {
                // For repeating notifications with date components
                const components = notification.trigger.dateComponents;
                // Use safe access with nullish coalescing
                const month = components.month ?? '--';
                const day = components.day ?? '--';
                const hour = components.hour ?? '--';
                const minute = components.minute ?? '--';
                const dateStr = `${month}/${day} at ${hour}:${minute}`;
                formattedDate = `Repeats on: ${dateStr}`;
                
                // Try to estimate time until notification
                if (typeof month === 'number' && typeof day === 'number') {
                  const now = new Date();
                  const year = now.getFullYear();
                  const targetDate = new Date(year, month - 1, day);
                  if (targetDate < now) {
                    // If date has passed this year, use next year
                    targetDate.setFullYear(year + 1);
                  }
                  timeUntilSeconds = Math.max(0, (targetDate.getTime() - Date.now()) / 1000);
                }
              } else if ('channelId' in notification.trigger && notification.trigger.channelId) {
                // For notifications without specific time, show channelId
                formattedDate = `Channel: ${notification.trigger.channelId}`;
              }
            }
          } catch (error) {
            console.error('Error formatting date:', error);
            formattedDate = 'Date format error';
          }
          
          return {
            ...notification,
            entityName,
            formattedDate,
            timeUntilSeconds
          };
        })
      );
      
      // Sort notifications by time until they appear (smallest first)
      const sortedNotifications = enhancedNotifications.sort((a, b) => 
        a.timeUntilSeconds - b.timeUntilSeconds
      );
      
      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load scheduled notifications');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Load notifications when the screen mounts
  useEffect(() => {
    loadNotifications();
  }, []);
  
  // Cancel a notification
  const cancelNotification = async (id: string) => {
    try {
      await notificationService.cancelNotification(id);
      Alert.alert('Success', 'Notification cancelled successfully');
      // Refresh the list
      loadNotifications();
    } catch (error) {
      console.error('Error cancelling notification:', error);
      Alert.alert('Error', 'Failed to cancel notification');
    }
  };
  
  // Schedule a test notification
  const scheduleTestNotification = async () => {
    try {
      await notificationService.sendTestNotification();
      Alert.alert('Success', 'Test notification scheduled for 5 seconds from now');
      // Refresh the list after a short delay to include the new notification
      setTimeout(loadNotifications, 1000);
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      Alert.alert('Error', 'Failed to schedule test notification');
    }
  };
  
  // Schedule a test birthday notification
  const scheduleTestBirthday = async () => {
    try {
      await notificationService.scheduleTestBirthdayToday();
      Alert.alert('Success', 'Test birthday reminder scheduled');
      // Refresh the list after a short delay
      setTimeout(loadNotifications, 1000);
    } catch (error) {
      console.error('Error scheduling test birthday reminder:', error);
      Alert.alert('Error', 'Failed to schedule test birthday reminder');
    }
  };
  
  // Confirm notification deletion
  const confirmCancelNotification = (notification: EnhancedNotification) => {
    setSelectedNotification(notification);
    setDialogVisible(true);
  };
  
  // Helper function to format time until notification in a readable way
  const formatTimeUntil = (seconds: number): string => {
    // Round to the nearest integer to hide precision beyond seconds
    seconds = Math.round(seconds);
    
    if (seconds >= 86400) { // More than a day
      return `${Math.floor(seconds / 86400)} day(s)`;
    } else if (seconds >= 3600) { // More than an hour
      return `${Math.floor(seconds / 3600)} hour(s)`;
    } else if (seconds >= 60) { // More than a minute
      return `${Math.floor(seconds / 60)} minute(s)`;
    } else {
      return `${seconds} second(s)`;
    }
  };
  
  // Render each notification card
  const renderNotification = ({ item }: { item: EnhancedNotification }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={styles.title}>
            {item.content.title || 'No Title'}
          </Text>
          <IconButton
            icon="delete"
            size={20}
            onPress={() => confirmCancelNotification(item)}
          />
        </View>
        
        <Text variant="bodyMedium">{item.content.body || 'No message body'}</Text>
        
        <View style={styles.detailsRow}>
          <Text variant="bodySmall" style={styles.dateText}>Scheduled for: {item.formattedDate}</Text>
        </View>
        
        <View style={styles.detailsRow}>
          <Text variant="bodySmall" style={styles.highlightText}>
            Time until: {formatTimeUntil(item.timeUntilSeconds)}
          </Text>
        </View>
        
        {item.content.data?.entityId && (
          <View style={styles.detailsRow}>
            <Text variant="bodySmall">Related to: {item.entityName}</Text>
          </View>
        )}
        
        <View style={styles.detailsRow}>
          <Text variant="bodySmall">Type: {item.content.data?.type || 'Unknown'}</Text>
          <Text variant="bodySmall">ID: {item.identifier.substring(0, 8)}...</Text>
        </View>
      </Card.Content>
    </Card>
  );
  
  // Display message when no notifications
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text variant="bodyLarge">No scheduled notifications</Text>
      <Text variant="bodyMedium" style={styles.emptyDescription}>
        Use the buttons below to create test notifications
      </Text>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.identifier}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadNotifications}
            colors={['#6200ee']}
          />
        }
      />
      
      <View style={styles.buttonRow}>
        <Button 
          mode="contained" 
          icon="bell"
          onPress={scheduleTestNotification}
          style={styles.button}
        >
          Test (5s)
        </Button>
        <Button 
          mode="contained" 
          icon="cake-variant"
          onPress={scheduleTestBirthday}
          style={styles.button}
        >
          Birthday (5:15pm)
        </Button>
      </View>
      
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Cancel Notification</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to cancel this notification?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={() => {
                if (selectedNotification) {
                  cancelNotification(selectedNotification.identifier);
                  setDialogVisible(false);
                }
              }}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 8,
    marginHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dateText: {
    flex: 1,
    flexWrap: 'wrap',
  },
  highlightText: {
    color: '#6200ee',
    fontWeight: 'bold',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 100, // Add space for the buttons at the bottom
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyDescription: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
});

export default NotificationManagerScreen; 