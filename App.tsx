// Import SafeLogger first to override console methods early
import './src/utils/SafeLogger';

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, DefaultTheme, ActivityIndicator, Text } from 'react-native-paper';
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

// Define the theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6200ee',
    accent: '#03dac4',
  },
};

// Create a safe wrapper for loading and error views
const SafeView: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return <View style={styles.container}>{ensureTextWrapped(children)}</View>;
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the database and handle any errors
    const initializeApp = async () => {
      try {
        // Try connecting to the database to verify it works
        await database.getDatabaseInfo();
        
        // Initialize the interaction config manager
        console.log('App: Initializing InteractionConfigManager...');
        await InteractionConfigManager.init();
        console.log('App: InteractionConfigManager initialized');
        
        // Initialize birthday notifications
        console.log('App: Initializing BirthdayNotificationManager...');
        await BirthdayNotificationManager.init();
        console.log('App: BirthdayNotificationManager initialized');
        
        // Register background task for notifications
        console.log('App: Registering background notification task...');
        await registerBackgroundNotificationTask();
        console.log('App: Background notification task registered');
        
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
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Starting up...</Text>
      </SafeView>
    );
  }

  if (error) {
    return (
      <SafeView>
        <Text style={styles.errorText}>Something went wrong</Text>
        <Text style={styles.errorDetails}>{error}</Text>
        <Text style={styles.helpText}>Try restarting the app with "expo start --clear"</Text>
        {Platform.OS === 'android' && (
          <Text 
            style={styles.linkText}
            onPress={() => Linking.openURL('https://docs.expo.dev/troubleshooting/native-modules-and-new-architecture/')}
          >
            Learn more about Expo Go and native modules
          </Text>
        )}
      </SafeView>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="auto" />
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'red',
  },
  errorDetails: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});
