import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert, TouchableOpacity, FlatList, Dimensions, TextInput, SafeAreaView, Pressable, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator, List, Title, Paragraph, Chip, SegmentedButtons, Menu, Dialog, Portal, Modal, Switch } from 'react-native-paper';
import Slider from '@react-native-community/slider';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, Entity, PhoneNumber, EmailAddress, PhysicalAddress } from '../types';
import { database, EntityType, InteractionType, BirthdayReminder } from '../database/Database';
import { debounce } from 'lodash';
import ContactFieldsSection from '../components/ContactFieldsSection';
import SafeDateTimePicker from '../components/SafeDateTimePicker';
import GroupMembersSection from '../components/GroupMembersSection';
import EditInteractionModal from '../components/EditInteractionModal';
import { isFeatureEnabledSync } from '../config/FeatureFlags';
import { eventEmitter } from '../utils/EventEmitter';
import { notificationService } from '../services/NotificationService';
import { format, parseISO, isValid } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

// Define the InteractionLog interface
interface InteractionLog {
  id: string;
  timestamp: number;
  formattedDate: string;
  type: string;
}

// Define the EntityPhoto interface 
interface EntityPhoto {
  id: string;
  entity_id: string;
  uri: string;
  caption: string | null;
  timestamp: number;
}

// Define the Tag interface
interface Tag {
  id: string;
  name: string;
  count: number;
}

// Interface for EditInteractionModal
interface EditInteractionModalProps {
  visible: boolean;
  onDismiss: () => void;
  interaction: InteractionLog | null;
  interactionTypes: InteractionType[];
  onSave: (interactionId: string, updates: { timestamp: number; type: string }) => Promise<void>;
}

type EntityDetailScreenRouteProp = RouteProp<RootStackParamList, 'EntityDetail'>;
type EntityDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EntityDetail'>;

// Tab values for swipeable area
type TabValue = 'interactions' | 'photos';

const EntityDetailScreen: React.FC = () => {
  const route = useRoute<EntityDetailScreenRouteProp>();
  const navigation = useNavigation<EntityDetailScreenNavigationProp>();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [interactionLogs, setInteractionLogs] = useState<InteractionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [logsOffset, setLogsOffset] = useState(0);
  const INITIAL_LOGS_LIMIT = 6;  // Initial number of logs to display
  const LOGS_LIMIT = 20;         // Number of logs to load on "View More"
  
  // Photo gallery state
  const [photos, setPhotos] = useState<EntityPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [hasMorePhotos, setHasMorePhotos] = useState(false);
  const [photosOffset, setPhotosOffset] = useState(0);
  const PHOTOS_LIMIT = 20;
  
  // Options menu state
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<TabValue>('interactions');
  
  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagDialogVisible, setTagDialogVisible] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<Tag[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [topTags, setTopTags] = useState<Tag[]>([]);
  const [loadingTopTags, setLoadingTopTags] = useState(false);
  
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [interactionMenuVisible, setInteractionMenuVisible] = useState(false);
  const [selectedInteractionType, setSelectedInteractionType] = useState<InteractionType | null>(null);
  const [loadingInteractionTypes, setLoadingInteractionTypes] = useState(false);
  
  const [contactData, setContactData] = useState<{
    phoneNumbers: PhoneNumber[];
    emailAddresses: EmailAddress[];
    physicalAddresses: PhysicalAddress[];
  }>({
    phoneNumbers: [],
    emailAddresses: [],
    physicalAddresses: []
  });
  
  const [editInteractionModalVisible, setEditInteractionModalVisible] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState<InteractionLog | null>(null);
  
  const [birthday, setBirthday] = useState<string | null>(null);
  const [birthdayReminder, setBirthdayReminder] = useState<BirthdayReminder | null>(null);
  const [reminderDialogVisible, setReminderDialogVisible] = useState(false);
  const [reminderDaysInAdvance, setReminderDaysInAdvance] = useState(1);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [selectedBirthday, setSelectedBirthday] = useState<Date | undefined>(undefined);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  
  // State for birthday picker - moved from renderBirthdayPicker to component level to avoid hook errors
  const defaultDate = selectedBirthday || new Date(new Date().getFullYear() - 30, 0, 1);
  const [tempMonth, setTempMonth] = useState(defaultDate.getMonth());
  const [tempDay, setTempDay] = useState(defaultDate.getDate() - 1); // 0-indexed for array
  const [tempYear, setTempYear] = useState<number | null>(null); // Default to null (empty year)
  
  // Update temp values when selectedBirthday changes
  useEffect(() => {
    if (selectedBirthday) {
      setTempMonth(selectedBirthday.getMonth());
      setTempDay(selectedBirthday.getDate() - 1);
      // Only set year if it seems intentionally set (not default year)
      const currentYear = new Date().getFullYear();
      if (selectedBirthday.getFullYear() !== currentYear && 
          selectedBirthday.getFullYear() !== currentYear - 30) {
        setTempYear(selectedBirthday.getFullYear());
      } else {
        setTempYear(null); // Reset to empty if it appears to be a default year
      }
    }
  }, [selectedBirthday]);
  
  // Load entity data
  useEffect(() => {
    loadEntityData();
  }, [route.params.id]);

  // Load entity data if editing
  useEffect(() => {
    if (route.params?.id) {
      loadEntityData();
    }
  }, [route.params?.id]);
  
  // Load top tags when tag dialog is opened
  useEffect(() => {
    if (tagDialogVisible) {
      loadTopTags();
    }
  }, [tagDialogVisible]);
  
  // Reload entity data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (route.params?.id) {
        console.log("EntityDetailScreen is focused - reloading entity data");
        loadEntityData();
      }
      
      return () => {
        // Clean up if needed
      };
    }, [route.params?.id])
  );

  // Load entity data from database
  const loadEntityData = async () => {
    if (!route.params.id) return;
    
    setLoading(true);
    try {
      const data = await database.getEntityById(route.params.id);
      if (data) {
        // Convert the database entity to the correct type
        const typedEntity: Entity = {
          ...data,
          type: data.type as EntityType,
          details: data.details || undefined,
          image: data.image || undefined
        };
        setEntity(typedEntity);
        
        // Check if entity is a favorite
        const favoriteStatus = await database.isFavorite(data.id);
        setIsFavorite(favoriteStatus);
        
        // Get hidden status
        const hiddenStatus = await database.isHidden(data.id);
        setIsHidden(hiddenStatus);
        
        // Load interaction logs
        await loadInteractionLogs(data.id);
        
        // Load entity photos
        await loadEntityPhotos(data.id);
        
        // Load entity tags
        await loadEntityTags(data.id);
        
        // Load interaction types
        await loadInteractionTypes(data.id);
        
        // Calculate photos count and set loading states
        const photoCount = await database.getEntityPhotoCount(data.id);
        setHasMorePhotos(photoCount > photos.length);
        
        // Load person data for person entities
        if (data.type === EntityType.PERSON) {
          await loadContactData(data.id);
          
          // Simply get the birthday directly without separate function
          const birthdayDate = await database.getBirthdayForPerson(data.id);
          setBirthday(birthdayDate);
          if (birthdayDate) {
            setSelectedBirthday(new Date(birthdayDate));
          }
          
          // Load birthday reminder if there is one
          const reminder = await database.getBirthdayReminderForEntity(data.id);
          setBirthdayReminder(reminder);
          if (reminder) {
            setReminderDaysInAdvance(reminder.days_in_advance);
            setReminderEnabled(reminder.is_enabled);
            if (reminder.reminder_time) {
              setReminderTime(new Date(reminder.reminder_time));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading entity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInteractionLogs = async (entityId: string, reset: boolean = true, limit: number = LOGS_LIMIT) => {
    try {
      setLoadingLogs(true);
      
      // Reset offset if requested
      if (reset) {
        setLogsOffset(0);
      }
      
      const currentOffset = reset ? 0 : logsOffset;
      
      // Get logs with current offset and specified limit
      const logs = await database.getInteractionLogs(entityId, limit, currentOffset);
      
      // If reset, replace logs, otherwise append to existing logs
      if (reset) {
        setInteractionLogs(logs);
      } else {
        setInteractionLogs(prevLogs => [...prevLogs, ...logs]);
      }
      
      // Update offset for next load
      setLogsOffset(currentOffset + logs.length);
      
      // Check if there are more logs
      const totalCount = await database.getInteractionCount(entityId);
      setHasMoreLogs(totalCount > currentOffset + logs.length);
    } catch (error) {
      console.error('Error loading interaction logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Generate 20 random historical interactions over the past year
  const generateHistoricalInteractions = async () => {
    if (!entity) return;
    
    try {
      setLoadingLogs(true);
      const entityId = entity.id;
      
      // Load interaction types appropriate for this entity
      const availableTypes = await database.getAllInteractionTypesForEntity(entityId);
      if (!availableTypes || availableTypes.length === 0) {
        Alert.alert('Error', 'No interaction types available for this entity');
        return;
      }
      
      // Current time
      const now = Date.now();
      // One year ago
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
      
      // Generate 20 random timestamps between one year ago and now
      const timestamps: number[] = [];
      for (let i = 0; i < 20; i++) {
        const randomTimestamp = oneYearAgo + Math.random() * (now - oneYearAgo);
        timestamps.push(randomTimestamp);
      }
      
      // Sort timestamps chronologically
      timestamps.sort();
      
      // Add each interaction
      let successCount = 0;
      for (const timestamp of timestamps) {
        // Select a random interaction type
        const randomTypeIndex = Math.floor(Math.random() * availableTypes.length);
        const randomType = availableTypes[randomTypeIndex].name;
        
        // Add the historical interaction
        const interactionId = await database.addHistoricalInteraction(
          entityId,
          timestamp,
          randomType
        );
        
        if (interactionId) {
          successCount++;
        }
      }
      
      // Reload interaction logs to show the new historical interactions
      await loadInteractionLogs(entityId, true);
      await loadEntityData(); // Reload entity data to update the score
      
      Alert.alert(
        'Success', 
        `Generated ${successCount} random historical interactions over the past year.`
      );
    } catch (error) {
      console.error('Error generating historical interactions:', error);
      Alert.alert('Error', 'Failed to generate historical interactions');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Load entity photos
  const loadEntityPhotos = async (entityId: string, reset: boolean = true) => {
    try {
      setLoadingPhotos(true);
      
      // Reset offset if requested
      if (reset) {
        setPhotosOffset(0);
      }
      
      const currentOffset = reset ? 0 : photosOffset;
      
      // Get photos with current offset
      const entityPhotos = await database.getEntityPhotos(entityId, PHOTOS_LIMIT, currentOffset);
      
      // If reset, replace photos, otherwise append to existing photos
      if (reset) {
        setPhotos(entityPhotos);
      } else {
        setPhotos(prevPhotos => [...prevPhotos, ...entityPhotos]);
      }
      
      // Update offset for next load
      setPhotosOffset(currentOffset + entityPhotos.length);
      
      // Check if there are more photos
      const totalCount = await database.getEntityPhotoCount(entityId);
      setHasMorePhotos(totalCount > currentOffset + entityPhotos.length);
    } catch (error) {
      console.error('Error loading entity photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Load entity tags
  const loadEntityTags = async (entityId: string) => {
    try {
      setLoadingTags(true);
      const entityTags = await database.getEntityTags(entityId);
      setTags(entityTags);
    } catch (error) {
      console.error('Error loading entity tags:', error);
    } finally {
      setLoadingTags(false);
    }
  };
  
  // Load top tags by usage count
  const loadTopTags = async () => {
    try {
      setLoadingTopTags(true);
      // Get all tags and sort them by count
      const allTags = await database.getAllTags();
      const sortedTags = allTags.sort((a, b) => b.count - a.count);
      // Take the top 3 tags with count > 0
      const topThreeTags = sortedTags.filter(tag => tag.count > 0).slice(0, 3);
      setTopTags(topThreeTags);
    } catch (error) {
      console.error('Error loading top tags:', error);
    } finally {
      setLoadingTopTags(false);
    }
  };
  
  // Load interaction types for the entity
  const loadInteractionTypes = async (entityId: string) => {
    try {
      setLoadingInteractionTypes(true);
      // Use the new getAllInteractionTypesForEntity method to get all possible interaction types
      // This will show more interaction types in the menu regardless of tags
      const types = await database.getAllInteractionTypesForEntity(entityId);
      setInteractionTypes(types);
    } catch (error) {
      console.error('Error loading interaction types:', error);
    } finally {
      setLoadingInteractionTypes(false);
    }
  };
  
  // Handle tag input change
  const handleTagInputChange = (text: string) => {
    setTagInput(text);
    
    // Clear suggestions if text is empty
    if (!text.trim()) {
      setSuggestedTags([]);
      setIsFetchingSuggestions(false);
      // When input is cleared, we don't show search results 
      // but we'll show top tags in the suggestions area
      return;
    }
    
    // Start fetching suggestions
    setIsFetchingSuggestions(true);
    
    // Perform the search with debounce
    debouncedSearchTags(text);
  };
  
  // Debounced search function
  const debouncedSearchTags = debounce(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSuggestedTags([]);
      setIsFetchingSuggestions(false);
      return;
    }
    
    try {
      const allTags = await database.getAllTags(searchTerm);
      // Filter out tags that the entity already has
      const filteredTags = allTags.filter(
        tag => !tags.some(existingTag => existingTag.id === tag.id)
      );
      setSuggestedTags(filteredTags);
    } catch (error) {
      console.error('Error searching tags:', error);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, 300);
  
  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearchTags.cancel();
    };
  }, []);
  
  // Add tag to entity
  const handleAddTag = async (tagName: string) => {
    if (!entity || !tagName.trim()) return;
    
    try {
      // Add tag to entity
      await database.addTagToEntity(entity.id, tagName);
      
      // Reload tags
      await loadEntityTags(entity.id);
      
      // Reload interaction types to include tag-specific actions
      await loadInteractionTypes(entity.id);
      
      // Emit tag change event to update cards
      eventEmitter.emitEvent('tagChange');
      
      // Clear input
      setTagInput('');
      setSuggestedTags([]);
      
      // Close dialog if adding was successful
      setTagDialogVisible(false);
    } catch (error) {
      console.error('Error adding tag:', error);
      Alert.alert('Error', 'Failed to add tag. Please try again.');
    }
  };
  
  // Select suggested tag
  const handleSelectTag = async (tag: Tag) => {
    if (!entity) return;
    
    try {
      // Add tag to entity
      await database.addTagToEntity(entity.id, tag.name);
      
      // Reload tags
      await loadEntityTags(entity.id);
      
      // Reload interaction types to include tag-specific actions
      await loadInteractionTypes(entity.id);
      
      // Emit tag change event to update cards
      eventEmitter.emitEvent('tagChange');
      
      // Clear input
      setTagInput('');
      setSuggestedTags([]);
    } catch (error) {
      console.error('Error adding tag:', error);
      Alert.alert('Error', 'Failed to add tag');
    }
  };
  
  // Remove tag from entity
  const handleRemoveTag = async (tagId: string) => {
    if (!entity) return;
    
    try {
      await database.removeTagFromEntity(entity.id, tagId);
      
      // Reload tags
      await loadEntityTags(entity.id);
      
      // Reload interaction types to update available actions
      await loadInteractionTypes(entity.id);
      
      // Emit tag change event to update cards
      eventEmitter.emitEvent('tagChange');
    } catch (error) {
      console.error('Error removing tag:', error);
      Alert.alert('Error', 'Failed to remove tag');
    }
  };
  
  // Submit tag from input
  const handleSubmitTag = () => {
    if (!tagInput.trim() || !entity) return;
    
    // Prevent duplicates
    const tagExists = tags.some(
      tag => tag.name.toLowerCase() === tagInput.trim().toLowerCase()
    );
    
    if (tagExists) {
      Alert.alert('Tag exists', 'This entity already has this tag');
      return;
    }
    
    // Add the tag
    handleAddTag(tagInput.trim());
  };

  // Handle interaction button press
  const handleInteraction = async () => {
    if (!entity) return;
    
    // If we're still loading interaction types, show a message
    if (loadingInteractionTypes) {
      Alert.alert('Loading', 'Please wait while we load available actions.');
      return;
    }
    
    setInteractionMenuVisible(true);
  };
  
  // Handle interaction type selection
  const handleSelectInteractionType = async (type: InteractionType) => {
    if (!entity) return;
    
    setInteractionMenuVisible(false);
    setSelectedInteractionType(type);
    
    try {
      await database.incrementInteractionScore(entity.id, type.name);
      // Reload entity data and interaction logs
      loadEntityData();
    } catch (error) {
      console.error('Error recording interaction:', error);
      Alert.alert('Error', 'Failed to record interaction.');
    }
  };
  
  // Dismiss interaction menu
  const dismissInteractionMenu = () => {
    setInteractionMenuVisible(false);
  };

  // Handle edit button press
  const handleEdit = () => {
    if (!entity) return;
    navigation.navigate('EditEntity', { id: entity.id, type: entity.type });
  };

  // Handle image selection
  const handleImageSelection = async () => {
    if (!entity) return;
    
    // Request permissions
    const { status: cameraPermission } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryPermission } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraPermission !== 'granted' || libraryPermission !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and photo library permissions are required to select or take photos.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Show action sheet for image source selection
    Alert.alert(
      'Select Photo',
      'Choose a photo source',
      [
        {
          text: 'Camera',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Photo Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  // Pick image from camera or library
  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });
      }
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Update entity with new image
        const success = await database.updateEntity(entity!.id, {
          image: imageUri,
        });
        
        if (success) {
          // Reload entity data to show the new image
          loadEntityData();
        } else {
          Alert.alert('Error', 'Failed to update image');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'An error occurred while selecting the image');
    }
  };

  // Handle delete button press
  const handleDelete = () => {
    if (!entity) return;
    
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${entity.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await database.deleteEntity(entity.id);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting entity:', error);
              Alert.alert('Error', 'Failed to delete entity');
            }
          }
        },
      ]
    );
  };

  // Get icon based on entity type
  const getTypeIcon = (type: EntityType) => {
    switch (type) {
      case EntityType.PERSON:
        return 'account';
      case EntityType.GROUP:
        return 'account-group';
      case EntityType.TOPIC:
        return 'tag';
      default:
        return 'help-circle';
    }
  };

  // Handle view more logs
  const handleViewMoreLogs = async () => {
    if (!entity) return;
    
    // Load more logs without resetting the current list
    await loadInteractionLogs(entity.id, false, LOGS_LIMIT);
  };
  
  // Load more photos
  const handleViewMorePhotos = async () => {
    if (!entity) return;
    
    // Load more photos without resetting the current list
    await loadEntityPhotos(entity.id, false);
  };
  
  // Take a photo using the camera
  const handleTakePhoto = async () => {
    if (!entity) return;
    
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera access is required to take photos');
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoUri = result.assets[0].uri;
        await savePhoto(photoUri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };
  
  // Pick a photo from the library
  const handlePickPhoto = async () => {
    if (!entity) return;
    
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Media library access is required to select photos');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoUri = result.assets[0].uri;
        await savePhoto(photoUri);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };
  
  // Save photo to database
  const savePhoto = async (uri: string) => {
    if (!entity) return;
    
    try {
      // In a real app, you would implement a modal for caption input
      // For simplicity, we'll just save without a caption for now
      await database.addEntityPhoto(entity.id, uri);
      
      // Reload photos
      await loadEntityPhotos(entity.id, true);
      
      // Switch to photos tab
      setActiveTab('photos');
      
      // Notify user
      Alert.alert(
        'Success',
        'Photo saved successfully',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  };
  
  // Delete a photo
  const handleDeletePhoto = async (photoId: string) => {
    try {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to delete this photo?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (!entity) return;
              
              await database.deleteEntityPhoto(photoId);
              // Reload photos
              await loadEntityPhotos(entity.id, true);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting photo:', error);
      Alert.alert('Error', 'Failed to delete photo');
    }
  };

  // Handle tag selection toggle
  const handleTagPress = (tagId: string) => {
    if (selectedTagId === tagId) {
      // If already selected, remove it
      handleRemoveTag(tagId);
      setSelectedTagId(null);
    } else {
      // Otherwise, select it
      setSelectedTagId(tagId);
    }
  };

  // Render an interaction log item
  const renderInteractionLog = (item: InteractionLog) => {
    // Find the interaction type to get its icon and score
    const interactionType = interactionTypes.find(type => type.name === item.type);
    const iconName = interactionType?.icon || 'account-check';
    const score = interactionType?.score || 1;
    
    return (
      <List.Item
        key={item.id}
        title={item.type}
        description={item.formattedDate}
        left={props => <List.Icon {...props} icon={iconName} color="#6200ee" />}
        right={props => (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>{score}</Text>
            <Text style={styles.scoreLabel}>pts</Text>
          </View>
        )}
        style={styles.interactionLogItem}
        onPress={() => {
          setSelectedInteraction(item);
          setEditInteractionModalVisible(true);
        }}
      />
    );
  };

  // Load contact data for person entities
  const loadContactData = async (entityId: string) => {
    try {
      const personData = await database.getPersonWithContactData(entityId);
      
      if (personData && personData.contactData) {
        setContactData({
          phoneNumbers: personData.contactData.phoneNumbers || [],
          emailAddresses: personData.contactData.emailAddresses || [],
          physicalAddresses: personData.contactData.physicalAddresses || []
        });
      } else {
        // Reset contact data
        setContactData({
          phoneNumbers: [],
          emailAddresses: [],
          physicalAddresses: []
        });
      }
    } catch (error) {
      console.error('Error loading contact data:', error);
      // Reset contact data on error
      setContactData({
        phoneNumbers: [],
        emailAddresses: [],
        physicalAddresses: []
      });
    }
  };

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!entity) return;
    
    try {
      if (isFavorite) {
        // Confirm before removing from favorites
        Alert.alert(
          'Remove from Favorites',
          `Are you sure you want to remove ${entity.name} from your favorites?`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Remove',
              onPress: async () => {
                const success = await database.removeFromFavorites(entity.id);
                if (success) {
                  setIsFavorite(false);
                }
              }
            }
          ]
        );
      } else {
        // Add to favorites without confirmation
        const success = await database.addToFavorites(entity.id);
        if (success) {
          setIsFavorite(true);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  // Set the header options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon={isFavorite ? "star" : "star-outline"}
            size={24}
            onPress={handleToggleFavorite}
            iconColor={isFavorite ? "#FFD700" : undefined}
          />
          <IconButton
            icon="dots-vertical"
            size={24}
            onPress={() => setOptionsMenuVisible(true)}
          />
          <Menu
            visible={optionsMenuVisible}
            onDismiss={() => setOptionsMenuVisible(false)}
            anchor={{ x: Dimensions.get('window').width - 24, y: 0 }}
          >
            <Menu.Item
              title={isHidden ? "Unhide from lists" : "Hide from lists"}
              leadingIcon={isHidden ? "eye" : "eye-off"}
              onPress={() => {
                setOptionsMenuVisible(false);
                handleToggleHidden();
              }}
            />
            <Menu.Item
              title="Edit"
              leadingIcon="pencil"
              onPress={() => {
                setOptionsMenuVisible(false);
                handleEdit();
              }}
            />
            <Menu.Item
              title="Delete"
              leadingIcon="delete"
              onPress={() => {
                setOptionsMenuVisible(false);
                handleDelete();
              }}
            />
          </Menu>
        </View>
      ),
    });
  }, [navigation, isFavorite, isHidden, optionsMenuVisible]);

  // Save interaction updates
  const handleSaveInteraction = async (interactionId: string, updates: { timestamp: number; type: string }) => {
    try {
      const success = await database.updateInteraction(interactionId, updates);
      
      if (success && entity) {
        // Reload interaction logs to reflect changes
        await loadInteractionLogs(entity.id, true);
        
        // Reload entity data to refresh its score in the UI
        await loadEntityData();
        
        setEditInteractionModalVisible(false);
        setSelectedInteraction(null);
        
        // Show simpler success message
        Alert.alert('Updated');
      } else {
        Alert.alert(
          'Update Failed',
          'Could not update the interaction.'
        );
      }
    } catch (error) {
      console.error('Error updating interaction:', error);
      Alert.alert(
        'Error',
        'An error occurred while updating the interaction.'
      );
    }
  };

  // Initialize notification service
  useEffect(() => {
    notificationService.init();
  }, []);
  
  // Handle birthday change with a more flexible approach for birth years
  const handleBirthdayChange = (event: any, date?: Date) => {
    setBirthdayPickerVisible(false);
    if (date && event.type !== 'dismissed') {
      setSelectedBirthday(date);
      saveBirthday(date, false);
    }
  };

  // Custom month-day picker modal for birthdays
  const renderBirthdayPicker = () => {
    // Generate month options (1-12)
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Generate day options (1-31)
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    
    // Generate year options (100 years in the past to today)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - 99 + i);
    
    return (
      <Portal>
        <Modal 
          visible={birthdayPickerVisible} 
          onDismiss={() => setBirthdayPickerVisible(false)}
          contentContainerStyle={styles.birthdayModal}
        >
          <Card>
            <Card.Title title="Select Birthday" />
            <Card.Content>
              <Text style={styles.birthdayPickerLabel}>For birthdays, we only need month and day. Year is optional.</Text>
              
              <View style={styles.birthdayPickerContainer}>
                <View style={styles.birthdayPickerColumn}>
                  <Text style={styles.birthdayPickerHeader}>Month</Text>
                  <ScrollView 
                    style={styles.birthdayPickerScroll}
                    showsVerticalScrollIndicator={true}
                  >
                    {months.map((month, index) => (
                      <TouchableOpacity
                        key={`month-${index}`}
                        style={[
                          styles.birthdayPickerItem,
                          tempMonth === index && styles.birthdayPickerItemSelected
                        ]}
                        onPress={() => setTempMonth(index)}
                      >
                        <Text 
                          style={[
                            styles.birthdayPickerItemText,
                            tempMonth === index && styles.birthdayPickerItemTextSelected
                          ]}
                        >
                          {month}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.birthdayPickerColumn}>
                  <Text style={styles.birthdayPickerHeader}>Day</Text>
                  <ScrollView 
                    style={styles.birthdayPickerScroll}
                    showsVerticalScrollIndicator={true}
                  >
                    {days.map((day, index) => (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[
                          styles.birthdayPickerItem,
                          tempDay === index && styles.birthdayPickerItemSelected
                        ]}
                        onPress={() => setTempDay(index)}
                      >
                        <Text 
                          style={[
                            styles.birthdayPickerItemText,
                            tempDay === index && styles.birthdayPickerItemTextSelected
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                
                <View style={styles.birthdayPickerColumn}>
                  <Text style={styles.birthdayPickerHeader}>Year (Optional)</Text>
                  <ScrollView 
                    style={styles.birthdayPickerScroll}
                    showsVerticalScrollIndicator={true}
                  >
                    <TouchableOpacity
                      key="year-none"
                      style={[
                        styles.birthdayPickerItem,
                        tempYear === null && styles.birthdayPickerItemSelected
                      ]}
                      onPress={() => setTempYear(null)}
                    >
                      <Text 
                        style={[
                          styles.birthdayPickerItemText,
                          tempYear === null && styles.birthdayPickerItemTextSelected
                        ]}
                      >
                        Not specified
                      </Text>
                    </TouchableOpacity>
                    {years.map((year) => (
                      <TouchableOpacity
                        key={`year-${year}`}
                        style={[
                          styles.birthdayPickerItem,
                          tempYear === year && styles.birthdayPickerItemSelected
                        ]}
                        onPress={() => setTempYear(year)}
                      >
                        <Text 
                          style={[
                            styles.birthdayPickerItemText,
                            tempYear === year && styles.birthdayPickerItemTextSelected
                          ]}
                        >
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              
              <View style={styles.birthdayPickerPreview}>
                <Text style={styles.birthdayPickerPreviewText}>
                  {months[tempMonth]} {days[tempDay]}{tempYear ? `, ${tempYear}` : ''}
                </Text>
              </View>
              
              <View style={styles.birthdayPickerButtons}>
                <Button onPress={() => setBirthdayPickerVisible(false)}>Cancel</Button>
                <Button 
                  mode="contained"
                  onPress={() => {
                    // Use current year as placeholder if year is not specified
                    // This keeps the date format valid while focusing on month/day
                    const yearToUse = tempYear || new Date().getFullYear();
                    const newDate = new Date(yearToUse, tempMonth, days[tempDay]);
                    setSelectedBirthday(newDate);
                    saveBirthday(newDate, tempYear === null);
                    setBirthdayPickerVisible(false);
                  }}
                >
                  Save
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    );
  };
  
  // Save birthday data with option to ignore year
  const saveBirthday = async (date: Date | null, ignoreYear: boolean = false) => {
    if (!entity) return;
    
    try {
      let isoDate = date ? date.toISOString() : null;
      
      // If we want to ignore the year, we store it with special format: MM-DD
      // This allows us to focus just on the month and day
      if (ignoreYear && date) {
        // Extract just month and day (MM-DD)
        const monthDay = format(date, 'MM-dd');
        // Store with special prefix to indicate no year
        isoDate = `NOYR:${monthDay}`;
      }
      
      const result = await database.setBirthdayForPerson(entity.id, isoDate);
      
      if (result) {
        setBirthday(isoDate);
        
        // Show feedback on success
        Alert.alert(
          "Birthday Saved",
          "The birthday has been saved successfully."
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to save birthday. Please try again."
        );
      }
    } catch (error) {
      console.error('Error saving birthday:', error);
      Alert.alert(
        "Error",
        "Failed to save birthday. Please try again."
      );
    }
  };
  
  // Format birthday for display
  const formatBirthday = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    
    try {
      // Check if this is a special no-year format
      if (dateString.startsWith('NOYR:')) {
        // Extract the MM-DD part
        const monthDay = dateString.substring(5);
        const [month, day] = monthDay.split('-').map(Number);
        
        // Create a temporary date to format (year doesn't matter)
        const tempDate = new Date();
        tempDate.setMonth(month - 1); // Month is 0-indexed in JS
        tempDate.setDate(day);
        
        // Format the date without year
        return format(tempDate, 'MMMM d');
      }
      
      // Regular date with year
      const date = new Date(dateString);
      const formatted = format(date, 'MMMM d, yyyy');
      return formatted;
    } catch (error) {
      console.error(`[DEBUG UI] Error formatting birthday:`, error);
      return 'Invalid date';
    }
  };

  // Handle reminder dialog
  const showReminderDialog = () => {
    if (!birthday) {
      // Ask to set birthday first if not set
      Alert.alert(
        'Birthday Required',
        'Please set a birthday first before setting up a reminder.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setReminderDialogVisible(true);
  };
  
  // Handle reminder delete
  const handleDeleteReminder = async () => {
    if (!birthdayReminder) return;
    
    try {
      if (birthdayReminder.notification_id) {
        await notificationService.cancelNotification(birthdayReminder.notification_id);
      }
      
      await database.deleteBirthdayReminder(birthdayReminder.id);
      setBirthdayReminder(null);
      setReminderDialogVisible(false);
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };
  
  // Render birthday section (only for persons)
  const renderBirthdaySection = () => {
    if (!entity || entity.type !== EntityType.PERSON) return null;
    
    return (
      <Card style={styles.sectionCard}>
        <Card.Title title="Birthday & Reminders" />
        <Card.Content>
          <List.Item
            title="Birthday"
            description={formatBirthday(birthday)}
            right={props => <IconButton {...props} icon="calendar" onPress={() => setBirthdayPickerVisible(true)} />}
          />
          
          {birthday && (
            <List.Item
              title="Birthday Reminder"
              description={birthdayReminder 
                ? `${reminderEnabled ? 'Enabled' : 'Disabled'}, ${birthdayReminder.days_in_advance} day(s) before`
                : 'Not set'}
              right={props => <IconButton {...props} icon="bell" onPress={showReminderDialog} />}
            />
          )}
        </Card.Content>
        
        {/* Birthday Picker - Custom month/day scroller */}
        {renderBirthdayPicker()}
        
        {/* Reminder Dialog */}
        <Portal>
          <Dialog visible={reminderDialogVisible} onDismiss={() => setReminderDialogVisible(false)}>
            <Dialog.Title>Birthday Reminder</Dialog.Title>
            <Dialog.Content>
              <Paragraph style={styles.reminderInfo}>
                Reminders will be sent annually at 5:00 PM Eastern Time.
              </Paragraph>
              
              <List.Item
                title="Enable Reminder"
                right={props => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
                  </View>
                )}
              />
              
              <List.Item
                title="Days Before Birthday"
                description={`${reminderDaysInAdvance} day(s) before`}
                disabled={!reminderEnabled}
                right={props => (
                  <View style={{ width: 100, marginRight: 8 }}>
                    <Slider
                      style={{ width: 100 }}
                      value={reminderDaysInAdvance}
                      onValueChange={(value: number) => setReminderDaysInAdvance(value)}
                      minimumValue={1}
                      maximumValue={14}
                      step={1}
                      disabled={!reminderEnabled}
                    />
                  </View>
                )}
              />
            </Dialog.Content>
            <Dialog.Actions>
              {birthdayReminder && (
                <Button color="red" onPress={handleDeleteReminder}>Delete</Button>
              )}
              <Button onPress={() => setReminderDialogVisible(false)}>Cancel</Button>
              <Button onPress={saveReminder}>Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </Card>
    );
  };

  // Save birthday reminder
  const saveReminder = async () => {
    if (!entity || !birthday) return;
    
    try {
      // Use 5:00 PM as the standard time for all reminders
      const standardReminderTime = new Date();
      standardReminderTime.setHours(17, 0, 0, 0);
      const reminderTimeIso = standardReminderTime.toISOString();
      
      if (birthdayReminder) {
        await database.updateBirthdayReminder(birthdayReminder.id, {
          birthdayDate: birthday,
          reminderTime: reminderTimeIso,
          daysInAdvance: reminderDaysInAdvance,
          isEnabled: reminderEnabled
        });
      } else {
        const reminderId = await database.addBirthdayReminder(
          entity.id,
          birthday,
          reminderTimeIso,
          reminderDaysInAdvance,
          reminderEnabled
        );
        
        const newReminder = await database.getBirthdayReminder(reminderId);
        setBirthdayReminder(newReminder);
      }
      
      // Schedule notification
      if (reminderEnabled) {
        const notificationId = await notificationService.scheduleBirthdayReminder({
          id: birthdayReminder?.notification_id || '',
          entityId: entity.id,
          entityName: entity.name,
          birthdayDate: birthday,
          reminderTime: reminderTimeIso,
          daysInAdvance: reminderDaysInAdvance,
          isEnabled: reminderEnabled
        });
        
        if (birthdayReminder) {
          await database.updateBirthdayReminder(birthdayReminder.id, {
            notificationId: notificationId
          });
        }
      } else if (birthdayReminder?.notification_id) {
        // Cancel existing notification if reminder is disabled
        await notificationService.cancelNotification(birthdayReminder.notification_id);
        await database.updateBirthdayReminder(birthdayReminder.id, {
          notificationId: null
        });
      }
      
      setReminderDialogVisible(false);
      
      // Show confirmation
      Alert.alert(
        "Reminder Saved",
        "The birthday reminder has been saved successfully."
      );
    } catch (error) {
      console.error('Error saving reminder:', error);
      Alert.alert(
        "Error",
        "Failed to save reminder. Please try again."
      );
    }
  };

  // Handle toggling hidden state
  const handleToggleHidden = async () => {
    if (!entity) return;
    
    try {
      const success = await database.toggleHidden(entity.id);
      
      if (success) {
        // Update local state
        setIsHidden(!isHidden);
        
        // Show feedback
        Alert.alert(
          isHidden ? 'Entity Unhidden' : 'Entity Hidden',
          isHidden 
            ? `${entity.name} will now appear in your normal views.` 
            : `${entity.name} is now hidden from the main view.`
        );
      } else {
        Alert.alert('Error', 'Failed to update visibility');
      }
    } catch (error) {
      console.error('Error toggling hidden state:', error);
      Alert.alert('Error', 'Failed to update visibility');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  if (!entity) {
    return (
      <View style={styles.container}>
        <Text>Entity not found</Text>
      </View>
    );
  }

  // Render a photo item
  const renderPhotoItem = (item: EntityPhoto) => (
    <TouchableOpacity
      key={item.id}
      style={styles.photoItem}
      onPress={() => {
        // Show photo in full screen or with more details
        Alert.alert(
          'Photo',
          item.caption || 'No caption',
          [
            { text: 'Close' },
            { 
              text: 'Delete',
              onPress: () => handleDeletePhoto(item.id),
              style: 'destructive'
            }
          ]
        );
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.photoImage} />
      {item.caption && (
        <View style={styles.photoCaptionContainer}>
          <Text numberOfLines={1} style={styles.photoCaption}>
            {item.caption}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render tag chip
  const renderTagChip = (tag: Tag) => (
    <Chip
      key={tag.id}
      style={styles.tagChip}
      onClose={selectedTagId === tag.id ? () => handleRemoveTag(tag.id) : undefined}
      onPress={() => handleTagPress(tag.id)}
      mode="outlined"
    >
      {tag.name}
    </Chip>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} nestedScrollEnabled={true}>
        <Card style={styles.card}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleImageSelection} style={styles.imageContainer}>
              {entity.image ? (
                <Image source={{ uri: entity.image }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>{entity.name.charAt(0)}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.headerInfo}>
              <View style={styles.titleContainer}>
                <Title style={styles.title}>{entity.name}</Title>
                <IconButton
                  icon={isFavorite ? 'star' : 'star-outline'}
                  iconColor={isFavorite ? '#FFD700' : '#757575'}
                  size={28}
                  onPress={handleToggleFavorite}
                  style={styles.favoriteButton}
                />
              </View>
              <View style={styles.entityInfoRow}>
                {isHidden && (
                  <View style={styles.hiddenBadge}>
                    <MaterialCommunityIcons name="eye-off" size={14} color="#fff" />
                    <Text style={styles.hiddenText}>Hidden</Text>
                  </View>
                )}
                <View style={styles.scoreIndicator}>
                  <Text style={styles.scoreValue}>{Math.round(entity.interaction_score)}</Text>
                  <Text style={styles.scoreLabel}>Interaction Score</Text>
                </View>
              </View>
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <Card.Content>
            {/* Tags section */}
            <View style={styles.tagsSectionContainer}>
              <View style={styles.tagsSectionHeader}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <IconButton
                  icon="plus"
                  size={20}
                  onPress={() => setTagDialogVisible(true)}
                />
              </View>
              
              {loadingTags ? (
                <ActivityIndicator size="small" color="#6200ee" style={styles.tagsLoading} />
              ) : tags.length === 0 ? (
                <Text style={styles.noTagsText}>No tags yet</Text>
              ) : (
                <View style={styles.tagsContainer}>
                  {tags.map(renderTagChip)}
                </View>
              )}
            </View>
            
            <Divider style={styles.divider} />
            
            {entity.details && (
              <Paragraph style={styles.details}>{entity.details}</Paragraph>
            )}
          </Card.Content>
          
          <Card.Actions style={styles.actionsContainer}>
            <Button 
              mode="contained" 
              icon="account-plus"
              onPress={handleInteraction}
              style={[styles.button, styles.interactionButton]}
            >
              Record Interaction
            </Button>
            <Button 
              mode="outlined" 
              icon="pencil" 
              onPress={handleEdit}
              style={styles.button}
            >
              Edit
            </Button>
            <Button 
              mode="outlined" 
              icon="delete" 
              onPress={handleDelete}
              style={[styles.button, styles.deleteButton]}
            >
              Delete
            </Button>
          </Card.Actions>
        </Card>

        {/* Group Members Section - Only for Group entities */}
        {entity && entity.type === EntityType.GROUP && (
          <Card style={styles.card}>
            <Card.Title title="Group Members" />
            <GroupMembersSection groupId={entity.id} groupName={entity.name} navigation={navigation} />
          </Card>
        )}

        {/* Contact Fields Section - Only for Person entities */}
        {entity && entity.type === EntityType.PERSON && (
          <ContactFieldsSection
            entityId={entity.id}
            phoneNumbers={contactData.phoneNumbers}
            emailAddresses={contactData.emailAddresses}
            physicalAddresses={contactData.physicalAddresses}
            onUpdate={() => loadContactData(entity.id)}
          />
        )}

        {/* Tabbed content for Interactions and Photos */}
        <Card style={styles.tabContentCard}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabValue)}
            buttons={[
              { value: 'interactions', label: 'Interactions' },
              { value: 'photos', label: 'Photos' }
            ]}
            style={styles.segmentedButtons}
          />
          
          {/* Interaction History Tab */}
          {activeTab === 'interactions' && (
            <Card style={styles.sectionCard}>
              <Card.Title title="Interaction History" />
              <Card.Content>
                {interactionLogs.length === 0 ? (
                  <Text style={styles.noDataText}>No interactions recorded yet.</Text>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 300 }}
                    nestedScrollEnabled={true}
                  >
                    {interactionLogs.map(item => renderInteractionLog(item))}
                  </ScrollView>
                )}
                {hasMoreLogs && (
                  <Button 
                    mode="outlined" 
                    onPress={handleViewMoreLogs}
                    disabled={loadingLogs}
                    loading={loadingLogs}
                    style={styles.viewMoreButton}
                  >
                    View More
                  </Button>
                )}
                
                {/* Generate Historical Interactions button - Only visible if feature flag is enabled */}
                {isFeatureEnabledSync('ENABLE_HISTORICAL_INTERACTIONS') && (
                  <Button 
                    mode="outlined" 
                    onPress={generateHistoricalInteractions}
                    disabled={loadingLogs}
                    loading={loadingLogs}
                    style={[styles.viewMoreButton, { marginTop: 8 }]}
                    icon="clock-time-four-outline"
                  >
                    Generate Historical Data
                  </Button>
                )}
              </Card.Content>
            </Card>
          )}
          
          {/* Photo gallery */}
          {activeTab === 'photos' && (
            <Card style={styles.sectionCard}>
              <Card.Title title="Photo Gallery" />
              <Card.Content>
                <View style={styles.photoActions}>
                  <Button 
                    mode="contained" 
                    icon="camera" 
                    onPress={handleTakePhoto}
                    style={styles.photoButton}
                  >
                    Take Photo
                  </Button>
                  <Button 
                    mode="contained" 
                    icon="image" 
                    onPress={handlePickPhoto}
                    style={styles.photoButton}
                  >
                    Add Photo
                  </Button>
                </View>
                
                {photos.length === 0 ? (
                  <Text style={styles.noDataText}>No photos added yet.</Text>
                ) : (
                  <View style={styles.photoGrid}>
                    {photos.map(item => renderPhotoItem(item))}
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
        </Card>
        
        {/* Tag dialog */}
        <Portal>
          <Dialog
            visible={tagDialogVisible}
            onDismiss={() => {
              Keyboard.dismiss();
              setTagDialogVisible(false);
              setTagInput('');
              setSuggestedTags([]);
            }}
            style={styles.tagDialog}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <View style={styles.tagDialogHeader}>
                  <Dialog.Title style={styles.tagDialogTitle}>Add Tags</Dialog.Title>
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => {
                      Keyboard.dismiss();
                      setTagDialogVisible(false);
                      setTagInput('');
                      setSuggestedTags([]);
                    }}
                    style={styles.closeButton}
                  />
                </View>
                <Dialog.Content style={styles.tagDialogContent}>
                  <View style={styles.tagInputContainer}>
                    <TextInput
                      style={styles.tagInput}
                      placeholder="Enter tag name"
                      value={tagInput}
                      onChangeText={handleTagInputChange}
                      onSubmitEditing={() => {
                        Keyboard.dismiss();
                        handleSubmitTag();
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <IconButton
                      icon="plus"
                      size={20}
                      onPress={() => {
                        Keyboard.dismiss();
                        handleSubmitTag();
                      }}
                      disabled={!tagInput.trim()}
                      style={styles.addTagButton}
                    />
                  </View>
                  
                  {isFetchingSuggestions ? (
                    <ActivityIndicator size="small" color="#6200ee" style={styles.suggestionsLoading} />
                  ) : suggestedTags.length > 0 ? (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsTitle}>Suggestions:</Text>
                      <ScrollView style={styles.suggestionsScrollView}>
                        {suggestedTags.map(tag => (
                          <TouchableOpacity
                            key={tag.id}
                            style={styles.suggestionItem}
                            onPress={() => {
                              Keyboard.dismiss();
                              handleSelectTag(tag);
                            }}
                          >
                            <Text style={styles.suggestionText}>{tag.name}</Text>
                            <Text style={styles.suggestionCount}>({tag.count})</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : tagInput.trim() ? (
                    <Text style={styles.newTagText}>
                      Press + to add "{tagInput.trim()}" as a new tag
                    </Text>
                  ) : topTags.length > 0 ? (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsTitle}>Popular Tags:</Text>
                      <ScrollView style={styles.suggestionsScrollView}>
                        {topTags.map(tag => (
                          <TouchableOpacity
                            key={tag.id}
                            style={styles.suggestionItem}
                            onPress={() => {
                              Keyboard.dismiss();
                              handleSelectTag(tag);
                            }}
                          >
                            <Text style={styles.suggestionText}>{tag.name}</Text>
                            <Text style={styles.suggestionCount}>({tag.count})</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </Dialog.Content>
                <Dialog.Actions style={styles.tagDialogActions}>
                  <Button 
                    mode="text" 
                    onPress={() => {
                      Keyboard.dismiss();
                      setTagDialogVisible(false);
                      setTagInput('');
                      setSuggestedTags([]);
                    }}
                    style={styles.doneButton}
                    labelStyle={styles.doneButtonLabel}
                  >
                    Done
                  </Button>
                </Dialog.Actions>
              </View>
            </TouchableWithoutFeedback>
          </Dialog>
        </Portal>
        
        {/* Interaction Type Selection Dialog */}
        <Portal>
          <Dialog
            visible={interactionMenuVisible}
            onDismiss={dismissInteractionMenu}
            style={styles.dialog}
          >
            <Dialog.Title>Select Interaction Type</Dialog.Title>
            <Dialog.Content>
              {loadingInteractionTypes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" />
                  <Text style={styles.loadingText}>Loading available actions...</Text>
                </View>
              ) : (
                <ScrollView style={styles.interactionTypeList}>
                  {interactionTypes.map(item => (
                    <List.Item
                      key={item.id}
                      title={item.name}
                      left={props => <List.Icon {...props} icon={item.icon} />}
                      onPress={() => handleSelectInteractionType(item)}
                    />
                  ))}
                </ScrollView>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={dismissInteractionMenu}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        {/* Add birthday section for person entities */}
        {entity?.type === EntityType.PERSON && renderBirthdaySection()}
      </ScrollView>
      
      {/* Edit Interaction Modal */}
      <EditInteractionModal
        visible={editInteractionModalVisible}
        onDismiss={() => {
          setEditInteractionModalVisible(false);
          setSelectedInteraction(null);
        }}
        interaction={selectedInteraction}
        interactionTypes={interactionTypes}
        onSave={handleSaveInteraction}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    margin: 16,
    elevation: 4,
    borderRadius: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 24,
    padding: 0,
  },
  type: {
    fontSize: 16,
    color: '#666',
    textTransform: 'capitalize',
  },
  divider: {
    marginVertical: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  details: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionsContainer: {
    justifyContent: 'space-around',
    padding: 8,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  interactionButton: {
    backgroundColor: '#6200ee',
  },
  deleteButton: {
    borderColor: '#f44336',
    color: '#f44336',
  },
  interactionLogsCard: {
    margin: 16,
    elevation: 4,
    borderRadius: 8,
    marginTop: 0,
  },
  logsList: {
    maxHeight: 300,
  },
  logsLoading: {
    margin: 20,
  },
  noLogsText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  editImageBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#6200ee',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  editImageIcon: {
    margin: 0,
    padding: 0,
  },
  viewMoreButton: {
    marginTop: 16,
    borderColor: '#6200ee',
    alignSelf: 'center',
  },
  tabContentCard: {
    margin: 16,
    elevation: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  segmentedButtons: {
    margin: 16,
  },
  photoHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoActionsContainer: {
    flexDirection: 'row',
  },
  photoActionButton: {
    margin: 0,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  photoItem: {
    width: '32%',
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCaptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
  },
  photoCaption: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  noPhotosContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noPhotosSubtext: {
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  photoActionsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  photoButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  tagsSectionContainer: {
    marginVertical: 8,
  },
  tagsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagChip: {
    margin: 4,
  },
  tagsLoading: {
    marginVertical: 8,
  },
  noTagsText: {
    fontStyle: 'italic',
    color: '#666',
    marginTop: 8,
  },
  tagDialog: {
    maxHeight: '80%',
    borderRadius: 14,
    backgroundColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  tagDialogHeader: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tagDialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 12,
  },
  topTagsContainer: {
    marginBottom: 16,
  },
  topTagsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  topTagsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topTagChip: {
    margin: 4,
  },
  tagDialogContent: {
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#F9F9F9',
  },
  tagInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  addTagButton: {
    margin: 0,
  },
  suggestionsContainer: {
    marginTop: 12,
    maxHeight: 300,
  },
  suggestionsScrollView: {
    maxHeight: 250,
  },
  suggestionsTitle: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 15,
    color: '#333',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 16,
  },
  suggestionCount: {
    color: '#757575',
    fontSize: 15,
  },
  suggestionsLoading: {
    marginTop: 20,
    marginBottom: 20,
  },
  newTagText: {
    marginTop: 16,
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    paddingBottom: 16,
  },
  tagDialogActions: {
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 0,
  },
  doneButton: {
    minWidth: 100,
    borderRadius: 20,
  },
  doneButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  interactionTypeList: {
    maxHeight: 300,
  },
  dialog: {
    paddingBottom: 10,
  },
  sectionCard: {
    margin: 16,
    elevation: 4,
    borderRadius: 8,
    marginTop: 0,
  },
  noDataText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  interactionLogItem: {
    padding: 8,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  favoriteButton: {
    margin: 0,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalContent: {
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateSelector: {
    marginBottom: 20,
  },
  dateDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginTop: 5,
  },
  typeSelector: {
    marginBottom: 20,
  },
  typeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginTop: 5,
  },
  fieldLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    margin: 5,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  entityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  scoreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
    marginRight: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  datePickerCard: {
    marginTop: 10,
    marginHorizontal: 16,
  },
  datePickerContainer: {
    paddingVertical: 10,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  birthdayModal: {
    margin: 20,
    padding: 0,
  },
  birthdayPickerLabel: {
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
    color: '#666',
  },
  birthdayPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  birthdayPickerColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
  birthdayPickerHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  birthdayPickerScroll: {
    height: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  birthdayPickerItem: {
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  birthdayPickerItemSelected: {
    backgroundColor: '#e0f7fa',
    borderLeftWidth: 3,
    borderLeftColor: '#6200ee',
  },
  birthdayPickerItemText: {
    fontSize: 16,
  },
  birthdayPickerItemTextSelected: {
    color: '#6200ee',
    fontWeight: 'bold',
  },
  birthdayPickerPreview: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  birthdayPickerPreviewText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  birthdayPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  reminderInfo: {
    fontStyle: 'italic',
    marginBottom: 10,
  },
  hiddenStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  hiddenStatusText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6200ee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  typeText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 12,
  },
  hiddenText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default EntityDetailScreen; 