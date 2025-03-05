import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Surface, Badge, IconButton } from 'react-native-paper';
import { Entity } from '../types';
import { database } from '../database/Database';

// Custom SparkLine component
const SparkLine: React.FC<{ data: number[] }> = ({ data }) => {
  if (!data.length) return null;
  
  // Normalize data to fit in the available space
  const max = Math.max(...data, 1); // Ensure max is at least 1 to avoid division by zero
  const normalizedData = data.map(value => value / max);
  
  return (
    <View style={styles.sparkLineContainer}>
      {normalizedData.map((value, index) => (
        <View 
          key={index} 
          style={[
            styles.sparkLineBar, 
            { 
              height: Math.max(value * 20, 1), // Min height of 1
              backgroundColor: value > 0 ? '#6200ee' : '#e0e0e0' 
            }
          ]} 
        />
      ))}
    </View>
  );
};

interface EntityCardProps {
  entity: Entity;
  onPress: (id: string) => void;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, onPress }) => {
  const [interactionData, setInteractionData] = useState<number[]>([]);
  
  // Load interaction data
  useEffect(() => {
    const loadInteractionData = async () => {
      try {
        const countsByDay = await database.getInteractionCountsByDay(entity.id);
        // Get the last 14 days of data for the spark chart
        const last14Days = countsByDay.slice(-14).map(item => item.count);
        setInteractionData(last14Days);
      } catch (error) {
        console.error('Error loading interaction data:', error);
        setInteractionData(Array(14).fill(0));
      }
    };
    
    loadInteractionData();
  }, [entity.id, entity.interaction_score]);

  // Function to handle interaction when photo is clicked
  const handleInteraction = async () => {
    await database.incrementInteractionScore(entity.id);
    // Reload interaction data after incrementing
    const countsByDay = await database.getInteractionCountsByDay(entity.id);
    const last14Days = countsByDay.slice(-14).map(item => item.count);
    setInteractionData(last14Days);
  };

  // Function to get the icon based on entity type
  const getTypeIcon = () => {
    switch (entity.type) {
      case 'person':
        return 'account';
      case 'group':
        return 'account-group';
      case 'topic':
        return 'tag';
      default:
        return 'help-circle';
    }
  };

  // Function to get background color based on entity type
  const getTypeColor = () => {
    switch (entity.type) {
      case 'person':
        return '#E3F2FD'; // Light blue
      case 'group':
        return '#E8F5E9'; // Light green
      case 'topic':
        return '#FFF3E0'; // Light orange
      default:
        return '#F5F5F5'; // Light grey
    }
  };

  // Generate initials from name (up to 2 characters)
  const getInitials = () => {
    const nameParts = entity.name.split(' ');
    if (nameParts.length > 1) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return entity.name.substring(0, 2).toUpperCase();
  };

  // Return the full entity name
  const getEntityName = () => {
    // Return the full name without abbreviation
    return entity.name;
  };

  return (
    <View style={styles.cardWrapper}>
      <Surface style={[styles.card, { backgroundColor: getTypeColor() }]}>
        <TouchableOpacity 
          style={styles.touchable} 
          onPress={() => onPress(entity.id)}
          activeOpacity={0.7}
        >
          <View style={styles.nameContainer}>
            <Text style={styles.nameText} numberOfLines={2}>
              {getEntityName()}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={(e) => {
              e.stopPropagation();
              handleInteraction();
            }}
          >
            {entity.image ? (
              <Image source={{ uri: entity.image }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderText}>{getInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.textContent}>
            {entity.details && (
              <Text numberOfLines={1} style={styles.details}>
                {entity.details}
              </Text>
            )}
          </View>
          
          <View style={styles.spacer} />
          
          <View style={styles.sparkLineWrapper}>
            <SparkLine data={interactionData} />
          </View>
        </TouchableOpacity>
      </Surface>
    </View>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = Math.min(width / 2 - 16, 180); // Responsive width with max of 180

const styles = StyleSheet.create({
  cardWrapper: {
    margin: 8,
    borderRadius: 16,
  },
  card: {
    width: cardWidth,
    borderRadius: 16,
    elevation: 3,
  },
  touchable: {
    padding: 12,
    minHeight: 200,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative', // For absolute positioning of spark chart
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    marginTop: 12,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'white',
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  placeholderText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  textContent: {
    minHeight: 20,
    alignItems: 'center',
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    paddingHorizontal: 4,
    flexShrink: 1,
    width: '100%',
  },
  details: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  spacer: {
    height: 30, // Space for spark chart
  },
  sparkLineWrapper: {
    height: 24,
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
  },
  sparkLineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 20,
  },
  sparkLineBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
  },
});

export default EntityCard; 