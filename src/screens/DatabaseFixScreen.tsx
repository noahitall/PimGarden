import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Button, Card, Title, Paragraph, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { database } from '../database/Database';

const DatabaseFixScreen: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const checkBirthdayField = async () => {
    setIsRunning(true);
    addLog('Checking for birthday column...');
    
    try {
      // Check if the column exists using the public method
      const birthdayColumnExists = await database.checkBirthdayColumnExists();
      
      if (birthdayColumnExists) {
        addLog('✅ Birthday column exists in entities table.');
      } else {
        addLog('❌ Birthday column is MISSING from entities table!');
      }
    } catch (error) {
      addLog(`Error checking birthday column: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const fixBirthdayField = async () => {
    setIsRunning(true);
    addLog('Attempting to add birthday column to entities table...');
    
    try {
      const result = await database.forceBirthdayFieldMigration();
      
      if (result) {
        addLog('✅ Successfully added birthday column to entities table!');
      } else {
        addLog('❌ Failed to add birthday column.');
      }
      
      // Verify the column now exists
      await checkBirthdayField();
    } catch (error) {
      addLog(`Error fixing birthday column: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetDb = async () => {
    setIsRunning(true);
    addLog('Resetting database version to force migrations...');
    
    try {
      await database.resetDatabaseVersion(8); // Reset to before birthday migration
      addLog('Database version reset to 8. Please restart the app for migrations to run.');
    } catch (error) {
      addLog(`Error resetting database: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Title style={styles.title}>Database Fixes</Title>
      
      <Card style={styles.card}>
        <Card.Content>
          <Title>Birthday Field Fix</Title>
          <Paragraph>
            This will check for and add the birthday column to the entities table if it's missing.
            Use this if you're getting errors about the birthday column not existing.
          </Paragraph>
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={checkBirthdayField}
              disabled={isRunning}
              style={styles.button}
            >
              Check Birthday Column
            </Button>
            
            <Button 
              mode="contained" 
              onPress={fixBirthdayField}
              disabled={isRunning}
              style={styles.button}
            >
              Fix Birthday Column
            </Button>
          </View>
        </Card.Content>
      </Card>
      
      <Card style={styles.card}>
        <Card.Content>
          <Title>Reset Database Version</Title>
          <Paragraph>
            This will reset the database version to force migrations to run again.
            Use this as a last resort if other fixes don't work.
          </Paragraph>
          
          <Button 
            mode="contained" 
            color="#FF3B30"
            onPress={resetDb}
            disabled={isRunning}
            style={styles.button}
          >
            Reset Database Version
          </Button>
        </Card.Content>
      </Card>
      
      <Divider style={styles.divider} />
      
      <Title>Logs</Title>
      <ScrollView style={styles.logs}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.placeholder}>Run an action to see logs</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    marginVertical: 8,
  },
  divider: {
    marginVertical: 16,
  },
  logs: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default DatabaseFixScreen; 