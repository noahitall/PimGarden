import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Chip } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { database, EntityType } from '../database/Database';

type EditEntityScreenRouteProp = RouteProp<RootStackParamList, 'EditEntity'>;
type EditEntityScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditEntity'>;

const EditEntityScreen: React.FC = () => {
  const route = useRoute<EditEntityScreenRouteProp>();
  const navigation = useNavigation<EditEntityScreenNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [type, setType] = useState<EntityType>(route.params?.type || EntityType.PERSON);
  
  // Determine if we're editing or creating
  const isEditing = !!route.params?.id;
  
  // Load entity data if editing
  useEffect(() => {
    if (isEditing) {
      loadEntityData();
    }
  }, [isEditing]);
  
  // Load entity data from database
  const loadEntityData = async () => {
    if (!route.params?.id) return;
    
    try {
      setLoading(true);
      const entity = await database.getEntityById(route.params.id);
      
      if (entity) {
        setName(entity.name);
        setDetails(entity.details || '');
        setType(entity.type as EntityType);
      }
    } catch (error) {
      console.error('Error loading entity:', error);
      Alert.alert('Error', 'Failed to load entity data');
    } finally {
      setLoading(false);
    }
  };
  
  // Save entity
  const saveEntity = async () => {
    // Validate form
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    
    try {
      setSaving(true);
      
      if (isEditing && route.params?.id) {
        // Update existing entity
        await database.updateEntity(route.params.id, {
          name,
          details,
        });
      } else {
        // Create new entity
        console.log('Creating entity with type:', type);
        await database.createEntity(
          name,
          type,
          details
        );
      }
      
      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error saving entity:', error);
      Alert.alert('Error', 'Failed to save entity');
    } finally {
      setSaving(false);
    }
  };
  
  // Delete entity
  const deleteEntity = async () => {
    if (!isEditing || !route.params?.id) return;
    
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await database.deleteEntity(route.params.id!);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'Failed to delete');
              setSaving(false);
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
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          {/* Entity Type Selection (only for new entities) */}
          {!isEditing && (
            <View style={styles.typeContainer}>
              <View style={styles.chipContainer}>
                <Chip 
                  selected={type === EntityType.PERSON} 
                  onPress={() => {
                    console.log('Selected type:', EntityType.PERSON);
                    setType(EntityType.PERSON);
                  }}
                  style={styles.chip}
                >
                  Person
                </Chip>
                <Chip 
                  selected={type === EntityType.GROUP} 
                  onPress={() => {
                    console.log('Selected type:', EntityType.GROUP);
                    setType(EntityType.GROUP);
                  }}
                  style={styles.chip}
                >
                  Group
                </Chip>
                <Chip 
                  selected={type === EntityType.TOPIC} 
                  onPress={() => {
                    console.log('Selected type:', EntityType.TOPIC);
                    setType(EntityType.TOPIC);
                  }}
                  style={styles.chip}
                >
                  Topic
                </Chip>
              </View>
              
              {/* Import Contacts button - only show for new entities of type PERSON */}
              {type === EntityType.PERSON && (
                <Button
                  mode="outlined"
                  icon="import"
                  onPress={() => navigation.navigate('ContactImport')}
                  style={styles.importButton}
                >
                  Import Contacts
                </Button>
              )}
            </View>
          )}
          
          {/* Name Field */}
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            mode="outlined"
          />
          
          {/* Details Field */}
          <TextInput
            label="Details"
            value={details}
            onChangeText={setDetails}
            style={styles.input}
            mode="outlined"
            multiline
            numberOfLines={5}
          />
          
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={saveEntity}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            >
              {isEditing ? 'Update' : 'Create'}
            </Button>
            
            {isEditing && (
              <Button
                mode="outlined"
                onPress={deleteEntity}
                disabled={saving}
                style={styles.deleteButton}
                textColor="#f44336"
              >
                Delete
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 16,
  },
  typeContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  chip: {
    margin: 4,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#6200ee',
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: '#f44336',
  },
  importButton: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'center',
  },
});

export default EditEntityScreen; 