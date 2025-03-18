// Import SafeLogger first to override console methods early
import './src/utils/SafeLogger';

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, DefaultTheme, ActivityIndicator, Text, ProgressBar } from 'react-native-paper';
import { View, StyleSheet, Alert, Platform, Linking } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { database } from './src/database/Database';
import { InteractionConfigManager } from './src/utils/InteractionConfigManager';
import { BirthdayNotificationManager } from './src/utils/BirthdayNotificationManager';
import * as Notifications from 'expo-notifications';
import { registerBackgroundNotificationTask } from './src/services/NotificationTaskManager';
import { ensureTextWrapped } from './src/components/SafeTouchableOpacity';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Safe area view component for loading screen
const SafeView = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.container}>
    {children}
  </View>
);

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initializationStep, setInitializationStep] = useState('Preparing database...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the database and handle any errors
    const initializeApp = async () => {
      try {
        // Step 1: Initialize database schema
        setInitializationStep('Initializing database schema...');
        setProgress(0.2);
        
        // Check if database is already initialized
        const dbInfo = await database.getDatabaseStatus();
        const needsInitialization = !dbInfo.isInitialized;
        
        if (needsInitialization) {
          // Wait for database structure to be created
          setInitializationStep('Creating database structure...');
          setProgress(0.4);
          await database.initializeDatabaseSchema();
        }
        
        // Step 2: Run any pending migrations
        setInitializationStep('Checking for database updates...');
        setProgress(0.6);
        await database.ensureMigrationsComplete();
        
        // Step 3: Initialize interaction config manager
        setInitializationStep('Loading configuration...');
        setProgress(0.8);
        await InteractionConfigManager.init();
        
        // Step 4: Complete remaining initialization
        setInitializationStep('Finalizing setup...');
        setProgress(0.9);
        await BirthdayNotificationManager.init();
        await registerBackgroundNotificationTask();
        
        setProgress(1.0);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize app:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // Check for the specific DatePicker error
        if (errorMessage.includes('RNCMaterialDatePicker') || 
            errorMessage.includes('TurboModuleRegistry')) {
          setError('DatePicker module error: This is a known issue with the new React Native architecture in Expo Go. ' +
                  'The app has been updated to handle this gracefully. Please restart with "expo start --clear".');
        } else {
          setError(`Error initializing: ${errorMessage}`);
        }
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return (
      <SafeView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>{initializationStep}</Text>
          <ProgressBar 
            progress={progress} 
            color="#6200ee" 
            style={styles.progressBar} 
          />
        </View>
      </SafeView>
    );
  }

  if (error) {
    return (
      <SafeView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Initialization Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.buttonContainer}>
            <Text 
              style={styles.restartButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.location.reload();
                } else {
                  // For native, we can only suggest restarting
                  Alert.alert(
                    'Restart Required',
                    'Please close and restart the app to try again.'
                  );
                }
              }}
            >
              Restart App
            </Text>
          </View>
        </View>
      </SafeView>
    );
  }

  return (
    <PaperProvider theme={DefaultTheme}>
      <SafeAreaProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    width: '80%',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  progressBar: {
    marginTop: 20,
    height: 6,
    width: '100%',
    borderRadius: 3,
  },
  errorContainer: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#ffebee',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#c62828',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 10,
  },
  restartButton: {
    fontSize: 16,
    color: '#2196f3',
    padding: 10,
  }
});
