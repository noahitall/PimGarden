import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert, TouchableOpacity, FlatList, Dimensions, TextInput, SafeAreaView, Pressable, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator, List, Title, Paragraph, Chip, SegmentedButtons, Menu, Dialog, Portal, Modal } from 'react-native-paper';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, Entity, PhoneNumber, EmailAddress, PhysicalAddress } from '../types';
import { database, EntityType, InteractionType } from '../database/Database';
import { debounce } from 'lodash';
import ContactFieldsSection from '../components/ContactFieldsSection';
import SafeDateTimePicker from '../components/SafeDateTimePicker';
import GroupMembersSection from '../components/GroupMembersSection';
import EditInteractionModal from '../components/EditInteractionModal';

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
        
        // Load contact data for person entities
        if (data.type === EntityType.PERSON) {
          await loadContactData(data.id);
        }
      }
    } catch (error) {
      console.error('Error loading entity data:', error);
      Alert.alert('Error', 'Failed to load entity data');
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
      const types = await database.getEntityInteractionTypes(entityId);
      setInteractionTypes(types);
    } catch (error) {
      console.error('Error loading interaction types:', error);
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
    
    // Show interaction type selection menu
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
      // Don't show error alert to user as it would disrupt their experience
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

  // Set the favorite star in the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      // Remove the favorite star from the header
      headerRight: () => null,
    });
  }, [navigation]);

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
              <View style={styles.editImageBadge}>
                <IconButton icon="camera" size={16} style={styles.editImageIcon} />
              </View>
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
                <View style={styles.scoreIndicator}>
                  <Text style={styles.scoreValue}>{entity.interaction_score}</Text>
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
                
                {hasMorePhotos && (
                  <Button 
                    mode="outlined" 
                    onPress={handleViewMorePhotos}
                    disabled={loadingPhotos}
                    loading={loadingPhotos}
                    style={styles.viewMoreButton}
                  >
                    View More
                  </Button>
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
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={dismissInteractionMenu}>Cancel</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
});

export default EntityDetailScreen; 