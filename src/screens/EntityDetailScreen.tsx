import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';

type EntityDetailScreenRouteProp = RouteProp<RootStackParamList, 'EntityDetail'>;
type EntityDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EntityDetail'>;

const EntityDetailScreen: React.FC = () => {
  const route = useRoute<EntityDetailScreenRouteProp>();
  const navigation = useNavigation<EntityDetailScreenNavigationProp>();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);

  // Load entity data
  useEffect(() => {
    loadEntityData();
  }, [route.params.id]);

  // Load entity data from database
  const loadEntityData = async () => {
    try {
      setLoading(true);
      const data = await database.getEntityById(route.params.id);
      setEntity(data);
    } catch (error) {
      console.error('Error loading entity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle interaction button press
  const handleInteraction = async () => {
    if (!entity) return;
    
    await database.incrementInteractionScore(entity.id);
    // Reload entity data to update the score
    loadEntityData();
  };

  // Handle edit button press
  const handleEdit = () => {
    if (!entity) return;
    navigation.navigate('EditEntity', { id: entity.id, type: entity.type });
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
          {entity.image ? (
            <Image source={{ uri: entity.image }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>{entity.name.charAt(0)}</Text>
            </View>
          )}
          
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
});

export default EntityDetailScreen; 