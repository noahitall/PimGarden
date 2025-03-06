import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, Platform } from 'react-native';
import { Text, Button, Card, Divider, List, ActivityIndicator, TextInput, Chip } from 'react-native-paper';
import { database, EntityType, InteractionType } from '../database/Database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { isFeatureEnabledSync } from '../config/FeatureFlags';

const DebugScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dbInfo, setDbInfo] = useState<{
    version: number;
    tables: string[];
    interactionTypesColumns: { name: string, type: string }[];
    interactionsColumns: { name: string, type: string }[];
  } | null>(null);

  // State for historical interactions feature
  const [entities, setEntities] = useState<Array<{id: string, name: string, type: string}>>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [selectedInteractionType, setSelectedInteractionType] = useState<string>('General Contact');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntities, setFilteredEntities] = useState<Array<{id: string, name: string, type: string}>>([]);
  const [showEntitiesList, setShowEntitiesList] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    loadDatabaseInfo();
    if (isFeatureEnabledSync('ENABLE_HISTORICAL_INTERACTIONS')) {
      loadEntities();
      loadInteractionTypes();
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredEntities(entities);
    } else {
      const filtered = entities.filter(entity => 
        entity.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEntities(filtered);
    }
  }, [searchQuery, entities]);

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

  const loadEntities = async () => {
    try {
      setLoadingEntities(true);
      const allEntities = await database.getAllEntities();
      // Convert to simpler format for the dropdown
      const entityOptions = allEntities.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type
      }));
      
      setEntities(entityOptions);
      setFilteredEntities(entityOptions);
    } catch (error) {
      console.error('Error loading entities:', error);
      Alert.alert('Error', 'Failed to load entities');
    } finally {
      setLoadingEntities(false);
    }
  };
  
  const loadInteractionTypes = async () => {
    try {
      const types = await database.getInteractionTypes();
      setInteractionTypes(types);
    } catch (error) {
      console.error('Error loading interaction types:', error);
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
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };
  
  const handleAddHistoricalInteraction = async () => {
    if (!selectedEntityId) {
      Alert.alert('Error', 'Please select an entity');
      return;
    }
    
    try {
      // Get the timestamp from the selected date
      const timestamp = date.getTime();
      
      // Add historical interaction
      const interactionId = await database.addHistoricalInteraction(
        selectedEntityId,
        timestamp,
        selectedInteractionType
      );
      
      if (interactionId) {
        Alert.alert('Success', 'Historical interaction added successfully');
      } else {
        Alert.alert('Error', 'Failed to add historical interaction');
      }
    } catch (error) {
      console.error('Error adding historical interaction:', error);
      Alert.alert('Error', 'Failed to add historical interaction');
    }
  };
  
  const handleEntitySelect = (id: string) => {
    const entity = entities.find(e => e.id === id);
    if (entity) {
      setSelectedEntityId(id);
      setSearchQuery(entity.name);
    }
    setShowEntitiesList(false);
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
      
      {/* Historical Interactions Section - Only visible if feature flag is enabled */}
      {isFeatureEnabledSync('ENABLE_HISTORICAL_INTERACTIONS') && (
        <Card style={styles.card}>
          <Card.Title title="Add Historical Interaction" subtitle="Debug Feature" />
          <Card.Content>
            <Text style={styles.warningText}>
              This feature allows adding interactions with custom dates in the past.
              Use for testing or data restoration purposes only.
            </Text>
            
            <View style={styles.formField}>
              <Text style={styles.label}>Entity:</Text>
              <TextInput
                value={searchQuery}
                onChangeText={text => {
                  setSearchQuery(text);
                  setShowEntitiesList(true);
                }}
                placeholder="Search for an entity..."
                onFocus={() => setShowEntitiesList(true)}
                style={styles.input}
              />
              
              {showEntitiesList && (
                <View style={styles.dropdownList}>
                  {loadingEntities ? (
                    <ActivityIndicator size="small" color="#6200ee" style={{padding: 10}} />
                  ) : filteredEntities.length > 0 ? (
                    filteredEntities.slice(0, 5).map(entity => (
                      <List.Item
                        key={entity.id}
                        title={entity.name}
                        description={entity.type}
                        onPress={() => handleEntitySelect(entity.id)}
                        left={props => <List.Icon {...props} icon={
                          entity.type === EntityType.PERSON ? 'account' :
                          entity.type === EntityType.GROUP ? 'account-group' : 'tag'
                        } />}
                      />
                    ))
                  ) : (
                    <List.Item title="No entities found" />
                  )}
                </View>
              )}
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.label}>Interaction Type:</Text>
              <View style={styles.chipContainer}>
                {interactionTypes.map(type => (
                  <Chip
                    key={type.id}
                    selected={selectedInteractionType === type.name}
                    onPress={() => setSelectedInteractionType(type.name)}
                    style={[styles.chip, selectedInteractionType === type.name && styles.selectedChip]}
                  >
                    {type.name}
                  </Chip>
                ))}
              </View>
            </View>
            
            <View style={styles.formField}>
              <Text style={styles.label}>Date & Time:</Text>
              <Button 
                mode="outlined" 
                onPress={() => setShowDatePicker(true)}
                style={styles.datePickerButton}
              >
                {date.toLocaleString()}
              </Button>
              
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>
            
            <Button 
              mode="contained" 
              onPress={handleAddHistoricalInteraction}
              style={styles.addButton}
              disabled={!selectedEntityId}
            >
              Add Historical Interaction
            </Button>
          </Card.Content>
        </Card>
      )}
      
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
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#fff',
    height: 50,
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginTop: 4,
    maxHeight: 200,
    elevation: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  selectedChip: {
    backgroundColor: '#6200ee',
  },
  datePickerButton: {
    height: 50,
    justifyContent: 'center',
  },
  addButton: {
    marginTop: 16,
  }
});

export default DebugScreen; 