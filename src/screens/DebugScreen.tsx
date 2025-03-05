import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, Divider, List, ActivityIndicator } from 'react-native-paper';
import { database } from '../database/Database';

const DebugScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dbInfo, setDbInfo] = useState<{
    version: number;
    tables: string[];
    interactionTypesColumns: { name: string, type: string }[];
    interactionsColumns: { name: string, type: string }[];
  } | null>(null);

  useEffect(() => {
    loadDatabaseInfo();
  }, []);

  const loadDatabaseInfo = async () => {
    try {
      setLoading(true);
      const info = await database.getDatabaseInfo();
      setDbInfo(info);
      console.log('Database info:', info);
    } catch (error) {
      console.error('Error loading database info:', error);
      Alert.alert('Error', 'Failed to load database information');
    } finally {
      setLoading(false);
    }
  };

  const resetDatabase = async (version: number) => {
    Alert.alert(
      'Confirm Reset',
      `Are you sure you want to reset the database to version ${version}? This will force migrations to run again. The app will need to be restarted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await database.resetDatabaseVersion(version);
              await loadDatabaseInfo();
              Alert.alert('Success', 'Database version reset. Please restart the app for migrations to run.');
            } catch (error) {
              console.error('Error resetting database:', error);
              Alert.alert('Error', 'Failed to reset database version');
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Loading database information...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Card.Title title="Database Information" />
        <Card.Content>
          <Text style={styles.version}>Version: {dbInfo?.version}</Text>
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Tables</Text>
          {dbInfo?.tables.map((table, index) => (
            <Text key={index} style={styles.item}>{table}</Text>
          ))}
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Interaction Types Columns</Text>
          {dbInfo?.interactionTypesColumns.map((column, index) => (
            <Text key={index} style={styles.item}>
              {column.name} ({column.type})
            </Text>
          ))}
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Interactions Columns</Text>
          {dbInfo?.interactionsColumns.map((column, index) => (
            <Text key={index} style={styles.item}>
              {column.name} ({column.type})
            </Text>
          ))}
        </Card.Content>
      </Card>
      
      <Card style={styles.card}>
        <Card.Title title="Database Management" />
        <Card.Content>
          <Text style={styles.warningText}>
            Warning: These actions are for debugging purposes only.
            Resetting the database version will force migrations to run again on restart.
          </Text>
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="outlined" 
              onPress={() => resetDatabase(0)}
              style={styles.resetButton}
            >
              Reset to v0 (All Migrations)
            </Button>
            
            <Button 
              mode="outlined" 
              onPress={() => resetDatabase(3)}
              style={styles.resetButton}
            >
              Reset to v3 (Only Junction Table)
            </Button>
            
            <Button 
              mode="contained" 
              onPress={loadDatabaseInfo}
              style={styles.refreshButton}
            >
              Refresh Info
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginBottom: 16,
  },
  version: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  item: {
    fontSize: 14,
    marginLeft: 8,
    marginBottom: 4,
  },
  divider: {
    marginVertical: 12,
  },
  warningText: {
    color: '#d32f2f',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 8,
  },
  resetButton: {
    marginBottom: 8,
    borderColor: '#d32f2f',
  },
  refreshButton: {
    marginTop: 8,
  },
});

export default DebugScreen; 