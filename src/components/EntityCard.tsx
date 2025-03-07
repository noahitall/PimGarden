import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Surface, Badge, IconButton, Dialog, Portal, Button, List, Avatar } from 'react-native-paper';
import { Entity } from '../types';
import { database, InteractionType } from '../database/Database';

// Custom SparkLine component with compact mode support
const SparkLine: React.FC<{ 
  data: number[]; 
  timespan: 'month' | 'year';
  isCompact?: boolean;
}> = ({ data, timespan, isCompact }) => {
  if (!data.length) return null;
  
  // Normalize data to fit in the available space
  const max = Math.max(...data, 1); // Ensure max is at least 1 to avoid division by zero
  const normalizedData = data.map(value => value / max);
  
  return (
    <View style={[
      styles.sparkLineContainer,
      isCompact && styles.compactSparkLineContainer
    ]}>
      {normalizedData.map((value, index) => (
        <View 
          key={index} 
          style={[
            styles.sparkLineBar, 
            { 
              height: Math.max(value * (isCompact ? 10 : 20), 1), // Smaller height for compact
              backgroundColor: value > 0 ? '#6200ee' : '#e0e0e0',
              width: isCompact ? 2 : (timespan === 'year' ? 9 : 3), // Thinner bars for compact
              marginHorizontal: isCompact ? 0.5 : (timespan === 'year' ? 0 : 1), // Less spacing
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
  forceRefresh?: number; // Timestamp to force refresh when changed
}

const EntityCard: React.FC<EntityCardProps> = ({ 
  entity, 
  onPress, 
  onLongPress, 
  selected = false, 
  isCompact = false,
  forceRefresh = 0
}) => {
  const [interactionData, setInteractionData] = useState<number[]>([]);
  const [interactionTimespan, setInteractionTimespan] = useState<'month' | 'year'>('month');
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [interactionMenuVisible, setInteractionMenuVisible] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [loadingInteractionTypes, setLoadingInteractionTypes] = useState(false);
  
  // Function to refresh interaction data
  const refreshInteractionData = useCallback(async () => {
    try {
      console.log(`Refreshing interaction data for entity ${entity.id} (updated_at: ${new Date(entity.updated_at).toISOString()})`);
      
      // Get the daily data for the last month
      const countsByDay = await database.getInteractionCountsByDay(entity.id);
      const dailyData = countsByDay.slice(-30).map(item => item.count);
      
      // Check if there's any activity in the last month
      const hasRecentActivity = dailyData.some(count => count > 0);
      
      if (hasRecentActivity) {
        // If there's recent activity, show the last 30 days
        setInteractionData(dailyData.slice(-30));
        setInteractionTimespan('month');
      } else {
        // If no recent activity, get yearly data
        const countsByMonth = await database.getInteractionCountsByMonth(entity.id);
        const monthlyData = countsByMonth.map(item => item.count);
        setInteractionData(monthlyData);
        setInteractionTimespan('year');
      }
      
      // Update last refresh timestamp
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error loading interaction data:', error);
      setInteractionData(Array(14).fill(0));
      setInteractionTimespan('month');
    }
  }, [entity.id, entity.updated_at]);
  
  // Load interaction data on mount and when entity changes
  useEffect(() => {
    refreshInteractionData();
    
    // Set up a periodic refresh every 60 minutes instead of 30 seconds
    const refreshTimer = setInterval(() => {
      refreshInteractionData();
    }, 3600000); // 60 minutes = 3600000 ms
    
    return () => clearInterval(refreshTimer);
  }, [entity.id, entity.interaction_score, entity.updated_at, refreshInteractionData]);
  
  // Force refresh when forceRefresh prop changes
  useEffect(() => {
    if (forceRefresh > 0) {
      refreshInteractionData();
    }
  }, [forceRefresh, refreshInteractionData]);
  
  // Separate loadInteractionTypes into a named function that can be called elsewhere
  const loadInteractionTypes = async () => {
    try {
      setLoadingInteractionTypes(true);
      console.log(`Loading interaction types for entity ${entity.id} in EntityCard`);
      
      // Use the new getAllInteractionTypesForEntity method to get all possible interaction types
      // This will show more interaction types in the menu regardless of tags
      const types = await database.getAllInteractionTypesForEntity(entity.id);
      setInteractionTypes(types);
    } catch (error) {
      console.error('Error loading interaction types:', error);
    } finally {
      setLoadingInteractionTypes(false);
    }
  };
  
  // Load interaction types
  useEffect(() => {
    loadInteractionTypes();
  }, [entity.id, entity.updated_at, forceRefresh]); // Include entity.updated_at and forceRefresh to update when tags change

  // Function to handle interaction when photo is clicked
  const handleInteraction = async () => {
    // If we're still loading interaction types, show a loading indicator
    if (loadingInteractionTypes) {
      return; // We'll show a loading indicator in the menu instead
    }
    
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
              
              {/* Center/Right: Content area with name and spark chart */}
              <View style={styles.compactContentWrapper}>
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
                  
                  {/* Compact spark chart */}
                  <View style={styles.compactSparkLineWrapper}>
                    <SparkLine 
                      data={interactionData.slice(-15)} // Show only last 15 data points
                      timespan={interactionTimespan}
                      isCompact={true}
                    />
                  </View>
                </TouchableOpacity>
              </View>
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
                  {interactionTimespan === 'month' ? 'Last 30 days' : 'Last 12 months'}
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
    height: 58, // Increased height to accommodate the spark line
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
  compactContentWrapper: {
    flex: 1,
    height: '100%',
  },
  compactContent: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  compactNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  compactSparkLineContainer: {
    height: 10,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  compactSparkLineWrapper: {
    height: 14,
    paddingTop: 4,
  },
  
  // Dialog styles
  dialog: {
    maxHeight: '80%',
  },
  interactionTypeList: {
    maxHeight: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default EntityCard; 