import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Chip, Divider, List, IconButton, SegmentedButtons, Dialog, Portal, RadioButton, Menu, Checkbox, HelperText } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { database, EntityType } from '../database/Database';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import eventEmitter from '../utils/EventEmitter';
import { styles } from '../styles/EditEntityScreen.styles';

type EditEntityScreenRouteProp = RouteProp<RootStackParamList, 'EditEntity'>;
type EditEntityScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditEntity'>;

type TabValue = 'entity' | 'action';

// Available icon options for interaction types
const iconOptions = [
  { icon: 'account-check', label: 'Account Check' },
  { icon: 'message-text', label: 'Message' },
  { icon: 'phone', label: 'Phone' },
  { icon: 'account-group', label: 'Group' },
  { icon: 'email', label: 'Email' },
  { icon: 'coffee', label: 'Coffee' },
  { icon: 'cake', label: 'Birthday' },
  { icon: 'home', label: 'Home' },
  { icon: 'chat', label: 'Chat' },
  { icon: 'gift', label: 'Gift' },
  { icon: 'calendar', label: 'Calendar' },
  { icon: 'presentation', label: 'Presentation' },
  { icon: 'clipboard-text', label: 'Notes' },
  { icon: 'phone-in-talk', label: 'Phone Call' },
  { icon: 'arrow-right-circle', label: 'Follow-up' },
  { icon: 'file-document', label: 'Document' },
  { icon: 'calendar-check', label: 'Appointment' },
  { icon: 'stethoscope', label: 'Medical' },
  { icon: 'book-open-page-variant', label: 'Book' },
  { icon: 'forum', label: 'Discussion' },
  { icon: 'run', label: 'Activity' },
  { icon: 'star', label: 'Star' }
];

const EditEntityScreen: React.FC = () => {
  const route = useRoute<EditEntityScreenRouteProp>();
  const navigation = useNavigation<EditEntityScreenNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Entity form state
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [type, setType] = useState<EntityType>(route.params?.type || EntityType.PERSON);
  const [isHidden, setIsHidden] = useState(false);
  
  // Determine if we're editing or creating an entity
  const isEditing = !!route.params?.id;
  
  // Load entity data if editing
  useEffect(() => {
    if (isEditing) {
      loadEntityData();
    }
  }, [isEditing]);
  
  // Load entity data for editing
  const loadEntityData = async () => {
    try {
      setLoading(true);
      
      const entity = await database.getEntityById(route.params?.id || '');
      
      if (entity) {
        setName(entity.name);
        if (entity.details) setDetails(entity.details);
        if (entity.type) setType(entity.type as EntityType);
        
        // Load hidden state
        const hiddenState = await database.isHidden(entity.id);
        setIsHidden(hiddenState);
      } else {
        Alert.alert('Error', 'Entity not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading entity data:', error);
      Alert.alert('Error', 'Failed to load entity data');
    } finally {
      setLoading(false);
    }
  };
  
  // Save entity data
  const saveEntity = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    
    try {
      setSaving(true);
      
      if (isEditing) {
        // Update existing entity
        await database.updateEntity(
          route.params?.id || '',
          {
            name: name.trim(),
            details: details.trim() || undefined
          }
        );
        
        // Update hidden state
        await database.setHidden(route.params?.id || '', isHidden);
        
        Alert.alert('Success', 'Entity updated successfully');
      } else {
        // Create new entity
        const id = await database.createEntity(
          name.trim(),
          type,
          details.trim() || undefined
        );
        
        if (id) {
          // Set hidden state if needed
          if (isHidden) {
            await database.setHidden(id, true);
          }
          
          // No success dialog for entity creation - just return to previous screen
          // Trigger a refresh of the entity list
          eventEmitter.emit('refreshEntities');
        } else {
          throw new Error('Failed to create entity');
        }
      }
      
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
    if (!isEditing) return;
    
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this entity? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await database.deleteEntity(route.params?.id || '');
              Alert.alert('Success', 'Entity deleted successfully');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting entity:', error);
              Alert.alert('Error', 'Failed to delete entity');
              setSaving(false);
            }
          }
        }
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
            </View>
          )}
          
          {/* Import Contacts button - only show for new PERSON entities */}
          {!isEditing && type === EntityType.PERSON && (
            <Button
              mode="outlined"
              icon="import"
              onPress={() => navigation.navigate('ContactImport')}
              style={styles.importButton}
            >
              Import Contacts
            </Button>
          )}
          
          {/* Entity form fields */}
          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            disabled={saving}
          />
          <TextInput
            label="Details (Optional)"
            value={details}
            onChangeText={setDetails}
            style={styles.input}
            multiline
            numberOfLines={4}
            disabled={saving}
          />
          
          {/* Hidden toggle */}
          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              onPress={() => setIsHidden(!isHidden)}
              style={styles.checkboxRow}
            >
              <Checkbox
                status={isHidden ? 'checked' : 'unchecked'}
                onPress={() => setIsHidden(!isHidden)}
                disabled={saving}
              />
              <Text style={styles.checkboxLabel}>
                Hide from main view
              </Text>
            </TouchableOpacity>
            <HelperText type="info" style={styles.helperText}>
              Hidden entities won't appear in the main list until you choose to show hidden entities.
            </HelperText>
          </View>
          
          {type === EntityType.GROUP && !isEditing && (
            <Text style={styles.helperText}>
              You can add people and topics as members after creating this group.
            </Text>
          )}
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={saveEntity}
              style={styles.button}
              disabled={saving || !name.trim()}
              loading={saving}
            >
              {isEditing ? 'Update' : 'Create'}
            </Button>
            
            {isEditing && (
              <Button 
                mode="outlined" 
                onPress={deleteEntity}
                style={styles.button}
                disabled={saving}
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

export default EditEntityScreen; 