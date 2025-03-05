import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator, List, Title, Paragraph, Chip, SegmentedButtons } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';

// Define the InteractionLog interface
interface InteractionLog {
  id: string;
  timestamp: number;
  formattedDate: string;
}

// Define the EntityPhoto interface 
interface EntityPhoto {
  id: string;
  entity_id: string;
  uri: string;
  caption: string | null;
  timestamp: number;
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
  
  // Load entity data
  useEffect(() => {
    loadEntityData();
  }, [route.params.id]);

  // Load entity data from database
  const loadEntityData = async () => {
    try {
      setLoading(true);
      
      // Get entity ID from route params
      const entityId = route.params?.id || '123';
      
      // Get entity from database
      const data = await database.getEntityById(entityId);
      
      if (data) {
        // Convert the database entity to the correct type
        const typedEntity: Entity = {
          ...data,
          type: data.type as EntityType,
          details: data.details || undefined,
          image: data.image || undefined
        };
        setEntity(typedEntity);
        
        // Reset logs when loading a new entity
        setLogsOffset(0);
        await loadInteractionLogs(data.id, true, INITIAL_LOGS_LIMIT);
        
        // Load photos
        setPhotosOffset(0);
        await loadEntityPhotos(data.id, true);
      }
    } catch (error) {
      console.error('Error loading entity:', error);
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

  // Handle interaction button press
  const handleInteraction = async () => {
    if (!entity) return;
    
    await database.incrementInteractionScore(entity.id);
    // Reload entity data and interaction logs
    loadEntityData();
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  if (!entity) {
    return (
      <View style={styles.errorContainer}>
        <Text>Entity not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
          Go Back
        </Button>
      </View>
    );
  }

  // Render a photo item
  const renderPhotoItem = ({ item }: { item: EntityPhoto }) => (
    <View style={styles.photoItem}>
      <TouchableOpacity 
        onPress={() => {
          // Display photo full screen or with caption
          Alert.alert(
            item.caption || 'Photo',
            'Photo taken on ' + new Date(item.timestamp).toLocaleDateString(),
            [{ text: 'Close' }]
          );
        }}
        onLongPress={() => handleDeletePhoto(item.id)}
      >
        <Image source={{ uri: item.uri }} style={styles.photoThumbnail} />
        {item.caption && (
          <Text numberOfLines={1} style={styles.photoCaption}>
            {item.caption}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView 
      style={styles.container}
      nestedScrollEnabled={true}
    >
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
            <Title style={styles.title}>{entity.name}</Title>
            <Text style={styles.type}>{getTypeIcon(entity.type)} {entity.type}</Text>
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <Card.Content>
          {entity.details && (
            <Paragraph style={styles.details}>{entity.details}</Paragraph>
          )}
        </Card.Content>
        
        <Card.Actions style={styles.actionsContainer}>
          <Button 
            mode="contained" 
            icon="handshake" 
            onPress={handleInteraction}
            style={[styles.button, styles.interactionButton]}
          >
            Interact
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
          <Card.Content>
            <Card.Title title="Interaction History" />
            <Divider style={styles.divider} />
            
            {loadingLogs && interactionLogs.length === 0 ? (
              <ActivityIndicator size="small" color="#6200ee" style={styles.logsLoading} />
            ) : interactionLogs.length === 0 ? (
              <Text style={styles.noLogsText}>No interactions recorded yet</Text>
            ) : (
              <View>
                <ScrollView 
                  style={styles.logsList}
                  nestedScrollEnabled={true}
                >
                  {interactionLogs.map(item => (
                    <List.Item
                      key={item.id}
                      title={item.formattedDate}
                      left={props => <List.Icon {...props} icon="star" color="#6200ee" />}
                    />
                  ))}
                </ScrollView>
                
                {hasMoreLogs && (
                  <Button 
                    mode="outlined" 
                    onPress={handleViewMoreLogs}
                    style={styles.viewMoreButton}
                    loading={loadingLogs}
                    disabled={loadingLogs}
                  >
                    View More
                  </Button>
                )}
              </View>
            )}
          </Card.Content>
        )}
        
        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <Card.Content>
            <View style={styles.photoHeaderContainer}>
              <Card.Title title="Photos" />
              <View style={styles.photoActionsContainer}>
                <IconButton
                  icon="camera"
                  size={24}
                  onPress={handleTakePhoto}
                  style={styles.photoActionButton}
                />
                <IconButton
                  icon="image"
                  size={24}
                  onPress={handlePickPhoto}
                  style={styles.photoActionButton}
                />
              </View>
            </View>
            <Divider style={styles.divider} />
            
            {loadingPhotos && photos.length === 0 ? (
              <ActivityIndicator size="small" color="#6200ee" style={styles.logsLoading} />
            ) : photos.length === 0 ? (
              <View style={styles.noPhotosContainer}>
                <Text style={styles.noLogsText}>No photos yet</Text>
                <Text style={styles.noPhotosSubtext}>
                  Add photos using the camera or gallery icons above
                </Text>
                <View style={styles.photoActionsRowContainer}>
                  <Button
                    mode="outlined"
                    icon="camera"
                    onPress={handleTakePhoto}
                    style={styles.photoButton}
                  >
                    Take Photo
                  </Button>
                  <Button
                    mode="outlined"
                    icon="image"
                    onPress={handlePickPhoto}
                    style={styles.photoButton}
                  >
                    Upload Photo
                  </Button>
                </View>
              </View>
            ) : (
              <View>
                <FlatList
                  data={photos}
                  renderItem={renderPhotoItem}
                  keyExtractor={item => item.id}
                  numColumns={3}
                  scrollEnabled={false} // We don't need scrolling here as it's inside a ScrollView
                  contentContainerStyle={styles.photoGrid}
                />
                
                {hasMorePhotos && (
                  <Button 
                    mode="outlined" 
                    onPress={handleViewMorePhotos}
                    style={styles.viewMoreButton}
                    loading={loadingPhotos}
                    disabled={loadingPhotos}
                  >
                    View More Photos
                  </Button>
                )}
              </View>
            )}
          </Card.Content>
        )}
      </Card>
    </ScrollView>
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
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
    padding: 4,
  },
  photoItem: {
    flex: 1/3,
    aspectRatio: 1,
    margin: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: 'white',
    padding: 4,
    fontSize: 12,
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
    margin: 8,
  },
});

export default EntityDetailScreen; 