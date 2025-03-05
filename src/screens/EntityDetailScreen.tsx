import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator, List, Title, Paragraph } from 'react-native-paper';
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

type EntityDetailScreenRouteProp = RouteProp<RootStackParamList, 'EntityDetail'>;
type EntityDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EntityDetail'>;

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
        await loadInteractionLogs(data.id, true, INITIAL_LOGS_LIMIT);  // Pass initial limit
      }
    } catch (error) {
      console.error('Error loading entity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load interaction logs
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

  return (
    <ScrollView style={styles.container}>
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
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.name}>{entity.name}</Text>
            <View style={styles.typeContainer}>
              <IconButton icon={getTypeIcon(entity.type)} size={16} style={styles.typeIcon} />
              <Text style={styles.type}>{entity.type}</Text>
            </View>
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Interaction Score</Text>
            <Text style={styles.statValue}>{entity.interaction_score}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Created</Text>
            <Text style={styles.statValue}>
              {new Date(entity.created_at).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Last Updated</Text>
            <Text style={styles.statValue}>
              {new Date(entity.updated_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <Card.Content>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.details}>{entity.details || 'No details available'}</Text>
        </Card.Content>
        
        <Card.Actions style={styles.actionsContainer}>
          <Button 
            mode="contained" 
            icon="star" 
            onPress={handleInteraction}
            style={[styles.button, styles.interactionButton]}
          >
            Interaction
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

      <Card style={styles.interactionLogsCard}>
        <Card.Title title="Interaction History" />
        <Divider style={styles.divider} />
        <Card.Content>
          {loadingLogs && interactionLogs.length === 0 ? (
            <ActivityIndicator size="small" color="#6200ee" style={styles.logsLoading} />
          ) : interactionLogs.length === 0 ? (
            <Text style={styles.noLogsText}>No interactions recorded yet</Text>
          ) : (
            <>
              <FlatList
                style={styles.logsList}
                data={interactionLogs}
                renderItem={({ item }) => (
                  <List.Item
                    key={item.id}
                    title={item.formattedDate}
                    left={props => <List.Icon {...props} icon="star" color="#6200ee" />}
                  />
                )}
                keyExtractor={item => item.id}
                scrollEnabled={true}
                nestedScrollEnabled={true}
              />
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
            </>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    margin: 16,
    elevation: 4,
    borderRadius: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
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
  headerTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  typeIcon: {
    margin: 0,
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
});

export default EntityDetailScreen; 