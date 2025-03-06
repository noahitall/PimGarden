import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, DefaultTheme, ActivityIndicator, Text } from 'react-native-paper';
import { View, StyleSheet, Alert, Platform, Linking } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { database } from './src/database/Database';

// Define the theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6200ee',
    accent: '#03dac4',
  },
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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Starting up...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
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
      </View>
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
