import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Text, Surface, Badge, IconButton, Dialog, Portal, Button, List, Avatar } from 'react-native-paper';
import { Entity } from '../types';
import { database, InteractionType } from '../database/Database';

// Custom SparkLine component for regular cards
const SparkLine: React.FC<{ 
  data: number[]; 
  timespan: 'month' | 'year';
}> = ({ data, timespan }) => {
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
              backgroundColor: value > 0 ? '#6200ee' : '#e0e0e0',
              width: timespan === 'year' ? 9 : 3, // Wider bars for yearly data
              marginHorizontal: timespan === 'year' ? 0 : 1, // Adjust spacing
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
  onLongPress?: (id: string) => void;
  selected?: boolean;
  isCompact?: boolean;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, onPress, onLongPress, selected = false, isCompact = false }) => {
  const [interactionData, setInteractionData] = useState<number[]>([]);
  const [interactionTimespan, setInteractionTimespan] = useState<'month' | 'year'>('month');
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [interactionMenuVisible, setInteractionMenuVisible] = useState(false);
  
  // Load interaction data
  useEffect(() => {
    const loadInteractionData = async () => {
      try {
        // Get the daily data for the last month
        const countsByDay = await database.getInteractionCountsByDay(entity.id);
        const dailyData = countsByDay.slice(-30).map(item => item.count);
        
        // Check if there's any activity in the last month
        const hasRecentActivity = dailyData.some(count => count > 0);
        
        if (hasRecentActivity) {
          // If there's recent activity, show the last 14 days
          setInteractionData(dailyData.slice(-14));
          setInteractionTimespan('month');
        } else {
          // If no recent activity, get yearly data
          const countsByMonth = await database.getInteractionCountsByMonth(entity.id);
          const monthlyData = countsByMonth.map(item => item.count);
          setInteractionData(monthlyData);
          setInteractionTimespan('year');
        }
      } catch (error) {
        console.error('Error loading interaction data:', error);
        setInteractionData(Array(14).fill(0));
        setInteractionTimespan('month');
      }
    };
    
    loadInteractionData();
  }, [entity.id, entity.interaction_score]);
  
  // Load interaction types
  useEffect(() => {
    const loadInteractionTypes = async () => {
      try {
        const types = await database.getEntityInteractionTypes(entity.id);
        setInteractionTypes(types);
      } catch (error) {
        console.error('Error loading interaction types:', error);
      }
    };
    
    loadInteractionTypes();
  }, [entity.id]);

  // Function to handle interaction when photo is clicked
  const handleInteraction = async () => {
    // Show interaction type selection menu
    setInteractionMenuVisible(true);
  };
  
  // Handle interaction type selection
  const handleSelectInteractionType = async (type: InteractionType) => {
    setInteractionMenuVisible(false);
    
    try {
      await database.incrementInteractionScore(entity.id, type.name);
      // Reload interaction data after incrementing
      const countsByDay = await database.getInteractionCountsByDay(entity.id);
      const last14Days = countsByDay.slice(-14).map(item => item.count);
      setInteractionData(last14Days);
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };
  
  // Dismiss interaction menu
  const dismissInteractionMenu = () => {
    setInteractionMenuVisible(false);
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
    return entity.name;
  };

  // Render the appropriate card based on isCompact prop
  const renderCard = () => {
    if (isCompact) {
      // COMPACT CARD DESIGN
      return (
        <View style={styles.compactWrapper}>
          <Surface style={[
            styles.compactCard, 
            { backgroundColor: getTypeColor() },
            selected && styles.selectedCard
          ]}>
            <View style={styles.compactTouchable}>
              {/* Left side: Avatar with interaction trigger */}
              <TouchableOpacity
                style={styles.compactAvatarContainer}
                onPress={() => {
                  // Explicitly set the interaction menu to visible
                  setInteractionMenuVisible(true);
                }}
                activeOpacity={0.7}
              >
                {entity.image ? (
                  <Avatar.Image 
                    size={36} 
                    source={{ uri: entity.image }} 
                  />
                ) : (
                  <Avatar.Text 
                    size={36} 
                    label={getInitials()} 
                    color="white"
                    style={{ backgroundColor: '#9E9E9E' }}
                  />
                )}
              </TouchableOpacity>
              
              {/* Center: Name - now takes the rest of the space */}
              <TouchableOpacity 
                style={styles.compactContent}
                onPress={() => onPress(entity.id)}
                onLongPress={() => onLongPress && onLongPress(entity.id)}
                delayLongPress={600}
                activeOpacity={0.7}
              >
                <Text style={styles.compactNameText} numberOfLines={1}>
                  {entity.name}
                </Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </View>
      );
    }
    
    // REGULAR CARD DESIGN
    return (
      <View style={styles.cardWrapper}>
        <Surface style={[styles.card, { backgroundColor: getTypeColor() }, selected && styles.selectedCard]}>
          <TouchableOpacity
            style={styles.touchable}
            onPress={() => onPress(entity.id)}
            onLongPress={() => onLongPress && onLongPress(entity.id)}
            delayLongPress={600}
            activeOpacity={0.7}
          >
            <View style={styles.nameContainer}>
              <Text style={styles.nameText} numberOfLines={2}>
                {entity.name}
              </Text>
            </View>
            
            <View style={styles.imageContainer}>
              <TouchableOpacity
                onPress={() => {
                  setInteractionMenuVisible(true);
                }}
              >
                {entity.image ? (
                  <Image source={{ uri: entity.image }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderText}>
                      {getInitials()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.sparkLineWrapper}>
              <View style={styles.timespanIndicator}>
                <Text style={styles.timespanText}>
                  {interactionTimespan === 'month' ? 'Last 14 days' : 'Last 12 months'}
                </Text>
              </View>
              <SparkLine data={interactionData} timespan={interactionTimespan} />
            </View>
          </TouchableOpacity>
        </Surface>
      </View>
    );
  };

  // Main render with both the card and the portal dialog
  return (
    <>
      {renderCard()}
      
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
    </>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = Math.min(width / 2 - 16, 180); // Responsive width with max of 180
const compactCardWidth = Math.min(width / 3 - 8, 150); // Slightly wider for compact cards

const styles = StyleSheet.create({
  // Regular card styles
  cardWrapper: {
    margin: 8,
    borderRadius: 16,
  },
  card: {
    width: cardWidth,
    borderRadius: 16,
    elevation: 2,
  },
  touchable: {
    padding: 16,
    minHeight: 200,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    justifyContent: 'space-between',
  },
  nameContainer: {
    marginBottom: 12,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: '#9E9E9E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#6200ee',
  },
  sparkLineWrapper: {
    marginTop: 8,
  },
  sparkLineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 20,
  },
  sparkLineBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  timespanIndicator: {
    alignItems: 'center',
    marginBottom: 4,
  },
  timespanText: {
    fontSize: 10,
    color: '#757575',
  },
  
  // Compact card styles
  compactWrapper: {
    margin: 4,
  },
  compactCard: {
    height: 48,
    width: compactCardWidth,
    borderRadius: 8,
    elevation: 1,
  },
  compactTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    height: '100%',
  },
  compactAvatarContainer: {
    marginRight: 8,
  },
  compactContent: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  compactNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  
  // Dialog styles
  dialog: {
    maxHeight: '80%',
  },
  interactionTypeList: {
    maxHeight: 300,
  },
});

export default EntityCard; 