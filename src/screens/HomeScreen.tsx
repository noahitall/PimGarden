import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, FlatList, Dimensions, RefreshControl, Animated, Alert } from 'react-native';
import { FAB, Appbar, Chip, Searchbar, Button, Snackbar, Banner, Menu, IconButton, Divider } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';
import EntityCard from '../components/EntityCard';
import UpcomingBirthdays from '../components/UpcomingBirthdays';
import { isFeatureEnabledSync } from '../config/FeatureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';
import { eventEmitter } from '../utils/EventEmitter';
import { notificationService } from '../services/NotificationService';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Sort options type
type SortOption = 'updated' | 'name' | 'recent_interaction';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<EntityType | undefined>(undefined);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBarHeight] = useState(new Animated.Value(0));
  const [mergeMode, setMergeMode] = useState(false);
  const [sourceEntityId, setSourceEntityId] = useState<string | null>(null);
  const [sourceEntity, setSourceEntity] = useState<Entity | null>(null);
  const [mergeMessage, setMergeMessage] = useState('');
  const [showMergeSnackbar, setShowMergeSnackbar] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [keepFavoritesFirst, setKeepFavoritesFirst] = useState(true);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());
  const [showBirthdays, setShowBirthdays] = useState(true);
  
  // Calculate number of columns based on screen width and view mode
  const screenWidth = Dimensions.get('window').width;
  const numColumns = useMemo(() => {
    if (isCompactMode) {
      // For compact mode, show more columns (3-4 depending on screen width)
      return Math.max(3, Math.floor(screenWidth / 140));
    }
    // For regular mode, show 2-3 columns depending on screen width
    return Math.max(2, Math.floor(screenWidth / 200));
  }, [screenWidth, isCompactMode]);

  // Calculate column width percentage based on number of columns
  const columnWidth = useMemo(() => {
    switch (numColumns) {
      case 2: return '50%';
      case 3: return '33.33%';
      case 4: return '25%';
      default: return `${Math.floor(100 / numColumns)}%`;
    }
  }, [numColumns]);
  
  // Dynamic styles based on screen width and view mode
  const dynamicStyles = useMemo(() => ({
    compactCardContainer: {
      maxWidth: 100 / numColumns + '%',
      padding: 2,
    }
  }), [numColumns]);
  
  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedSortBy = await AsyncStorage.getItem('sortBy');
        if (savedSortBy) setSortBy(savedSortBy as SortOption);
        
        const savedKeepFavoritesFirst = await AsyncStorage.getItem('keepFavoritesFirst');
        if (savedKeepFavoritesFirst !== null) {
          setKeepFavoritesFirst(savedKeepFavoritesFirst === 'true');
        }

        const savedViewMode = await AsyncStorage.getItem('isCompactMode');
        if (savedViewMode !== null) {
          setIsCompactMode(savedViewMode === 'true');
        }
        
        const savedShowBirthdays = await AsyncStorage.getItem('showBirthdays');
        if (savedShowBirthdays !== null) {
          setShowBirthdays(savedShowBirthdays === 'true');
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Save user preferences
  const savePreferences = async (
    newSortBy?: SortOption, 
    newKeepFavoritesFirst?: boolean, 
    newCompactMode?: boolean,
    newShowBirthdays?: boolean
  ) => {
    try {
      // Save sort preference
      if (newSortBy !== undefined) {
        await AsyncStorage.setItem('sortBy', newSortBy);
        setSortBy(newSortBy);
      }
      
      // Save favorites first preference
      if (newKeepFavoritesFirst !== undefined) {
        await AsyncStorage.setItem('keepFavoritesFirst', String(newKeepFavoritesFirst));
        setKeepFavoritesFirst(newKeepFavoritesFirst);
      }
      
      // Save compact mode preference
      if (newCompactMode !== undefined) {
        await AsyncStorage.setItem('isCompactMode', String(newCompactMode));
        setIsCompactMode(newCompactMode);
      }
      
      // Save show birthdays preference
      if (newShowBirthdays !== undefined) {
        await AsyncStorage.setItem('showBirthdays', String(newShowBirthdays));
        setShowBirthdays(newShowBirthdays);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };
  
  // Load entities from database
  const loadEntities = useCallback(async () => {
    try {
      setRefreshing(true);
      let data;
      
      if (favoritesOnly) {
        // Get only favorite entities
        data = await database.getFavorites();
        
        // Apply additional type filter if needed
        if (filter) {
          data = data.filter(entity => entity.type === filter);
        }
        
        // Apply search filter if needed
        if (searchQuery.trim()) {
          data = await database.searchEntities(searchQuery, filter);
          // Filter favorites from search results
          const favoriteIds = new Set((await database.getFavorites()).map(entity => entity.id));
          data = data.filter(entity => favoriteIds.has(entity.id));
        }
      } else if (searchQuery.trim()) {
        data = await database.searchEntities(searchQuery, filter);
      } else {
        data = await database.getAllEntities(filter, {
          sortBy: sortBy === 'updated' ? undefined : sortBy,
          keepFavoritesFirst: keepFavoritesFirst
        });
      }
      
      // Ensure the data matches the Entity type from types/index.ts
      const typedData = data.map(item => ({
        ...item,
        type: item.type as EntityType,
        details: item.details || undefined,
        image: item.image || undefined
      }));
      setEntities(typedData);
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setRefreshing(false);
    }
  }, [filter, searchQuery, favoritesOnly, sortBy, keepFavoritesFirst]);
  
  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadEntities();
    }, [loadEntities])
  );
  
  // Listen for the 'tagChange' event to refresh interaction types
  useEffect(() => {
    const handleTagChange = () => {
      console.log('Tag change detected, refreshing interaction types in all cards');
      setRefreshTimestamp(Date.now());
    };
    
    // Add event listener
    eventEmitter.addEventListener('tagChange', handleTagChange);
    
    return () => {
      eventEmitter.removeEventListener('tagChange', handleTagChange);
    };
  }, []);
  
  // Handle card press - normal mode opens entity, merge mode selects target
  const handleCardPress = (id: string) => {
    if (!mergeMode) {
      // Normal mode - navigate to entity detail
      navigation.navigate('EntityDetail', { id });
    } else {
      // Merge mode - confirm merge operation if types match
      handleMergeConfirmation(id);
    }
  };
  
  // Handle card long press - trigger merge mode
  const handleCardLongPress = (id: string) => {
    // Find the entity that was long-pressed
    const entity = entities.find(e => e.id === id);
    if (!entity) return;
    
    // Set merge mode
    setMergeMode(true);
    setSourceEntityId(id);
    setSourceEntity(entity);
    setMergeMessage(`Select a destination ${entity.type} to merge "${entity.name}" into`);
    setShowMergeSnackbar(true);
  };
  
  // Handle merge confirmation
  const handleMergeConfirmation = (targetId: string) => {
    if (!sourceEntityId || sourceEntityId === targetId) {
      // Can't merge with self, cancel merge mode
      cancelMergeMode();
      return;
    }
    
    // Find target entity
    const targetEntity = entities.find(e => e.id === targetId);
    if (!targetEntity || !sourceEntity) {
      cancelMergeMode();
      return;
    }
    
    // Check if types match
    if (targetEntity.type !== sourceEntity.type) {
      Alert.alert(
        'Type Mismatch',
        `Cannot merge a ${sourceEntity.type} with a ${targetEntity.type}. Please select a ${sourceEntity.type} as the destination.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Confirm merge operation
    Alert.alert(
      'Confirm Merge',
      `Are you sure you want to merge "${sourceEntity.name}" into "${targetEntity.name}"? This action cannot be undone.`,
      [
        { 
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {} // Keep merge mode active
        },
        {
          text: 'Merge',
          style: 'default',
          onPress: () => performMerge(sourceEntityId, targetId)
        },
        {
          text: 'Exit Merge Mode',
          style: 'destructive',
          onPress: cancelMergeMode
        }
      ]
    );
  };
  
  // Perform the actual merge
  const performMerge = async (sourceId: string, targetId: string) => {
    try {
      const success = await database.mergeEntities(sourceId, targetId);
      
      if (success) {
        // Reload entities and show success message
        await loadEntities();
        setMergeMessage('Entities merged successfully!');
        setShowMergeSnackbar(true);
      } else {
        // Show error message
        setMergeMessage('Failed to merge entities. Please try again.');
        setShowMergeSnackbar(true);
      }
      
      // Exit merge mode
      cancelMergeMode();
    } catch (error) {
      console.error('Error merging entities:', error);
      setMergeMessage('An error occurred while merging entities.');
      setShowMergeSnackbar(true);
      cancelMergeMode();
    }
  };
  
  // Cancel merge mode
  const cancelMergeMode = () => {
    setMergeMode(false);
    setSourceEntityId(null);
    setSourceEntity(null);
  };
  
  // Handle filter selection
  const handleFilterChange = (type: EntityType) => {
    setFilter(type === filter ? undefined : type);
  };
  
  // Toggle favorites only filter
  const handleFavoritesToggle = () => {
    setFavoritesOnly(!favoritesOnly);
  };
  
  // Toggle search bar visibility
  const toggleSearchBar = (show: boolean) => {
    // Only proceed if there's an actual change
    if (show === searchVisible) return;
    
    // If showing, first set visibility to true, then animate height
    if (show) {
      setSearchVisible(true);
      // Then start animation
      Animated.timing(searchBarHeight, {
        toValue: 60,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else {
      // If hiding, animate first, then hide the component
      Animated.timing(searchBarHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        // Only set visibility to false after animation completes
        setSearchVisible(false);
        // Clear search when hiding
        setSearchQuery('');
        // Ensure menu is closed
        setSortMenuVisible(false);
      });
    }
  };
  
  // Handle search query changes
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  // Handle scroll events to show/hide search bar
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Only show search bar when user pulls down significantly
    if (scrollY < -50 && !searchVisible) {
      toggleSearchBar(true);
    }
  };
  
  // Render filter chips
  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
      <View style={styles.filterRow}>
        <Chip
          selected={filter === undefined}
          onPress={() => setFilter(undefined)}
          style={styles.filterChip}
        >
          All
        </Chip>
        <Chip
          selected={filter === EntityType.PERSON}
          onPress={() => setFilter(EntityType.PERSON)}
          style={styles.filterChip}
        >
          People
        </Chip>
        <Chip
          selected={filter === EntityType.GROUP}
          onPress={() => setFilter(EntityType.GROUP)}
          style={styles.filterChip}
        >
          Groups
        </Chip>
        <Chip
          selected={filter === EntityType.TOPIC}
          onPress={() => setFilter(EntityType.TOPIC)}
          style={styles.filterChip}
        >
          Topics
        </Chip>
        <IconButton
          icon={favoritesOnly ? 'star' : 'star-outline'}
          selected={favoritesOnly}
          onPress={() => setFavoritesOnly(!favoritesOnly)}
          style={styles.favoriteChip}
          iconColor={favoritesOnly ? '#FFD700' : undefined}
        />
      </View>
    </View>
  );
  
  // Render entity card
  const renderItem = ({ item }: { item: Entity }) => (
    <View style={[
      styles.cardContainer,
      isCompactMode && {
        width: `${100 / numColumns}%`,
        padding: 2,
      }
    ]}>
      <EntityCard 
        entity={item} 
        onPress={handleCardPress} 
        onLongPress={handleCardLongPress}
        selected={mergeMode && sourceEntityId === item.id}
        isCompact={isCompactMode}
        forceRefresh={refreshTimestamp}
      />
    </View>
  );
  
  // Get readable text for current sort option
  const getSortByText = (): string => {
    switch (sortBy) {
      case 'name':
        return 'Name (A-Z)';
      case 'recent_interaction':
        return 'Recent Interaction';
      case 'updated':
      default:
        return 'Recently Updated';
    }
  };

  // Get the next sort option in rotation
  const getNextSortOption = (): SortOption => {
    switch (sortBy) {
      case 'updated':
        return 'name';
      case 'name':
        return 'recent_interaction';
      case 'recent_interaction':
      default:
        return 'updated';
    }
  };

  // Computed sort by text
  const sortByText = getSortByText();
  
  // Toggle birthdays section
  const toggleBirthdaysSection = () => {
    savePreferences(undefined, undefined, undefined, !showBirthdays);
  };
  
  // Meatball menu for more options
  const renderOptionsMenu = () => (
    <Menu
      visible={sortMenuVisible}
      onDismiss={() => setSortMenuVisible(false)}
      anchor={
        <IconButton 
          icon="dots-vertical" 
          size={24} 
          onPress={() => setSortMenuVisible(true)}
        />
      }
    >
      <Menu.Item
        title={`Sort by ${sortByText}`}
        onPress={() => {
          const newSortBy = getNextSortOption();
          savePreferences(newSortBy);
          setSortMenuVisible(false);
        }}
        leadingIcon="sort"
      />
      <Menu.Item
        title={`${keepFavoritesFirst ? 'Don\'t keep' : 'Keep'} favorites at top`}
        onPress={() => {
          savePreferences(undefined, !keepFavoritesFirst);
          setSortMenuVisible(false);
        }}
        leadingIcon={keepFavoritesFirst ? 'star' : 'star-outline'}
      />
      <Menu.Item
        title={`${isCompactMode ? 'Normal' : 'Compact'} view`}
        onPress={() => {
          savePreferences(undefined, undefined, !isCompactMode);
          setSortMenuVisible(false);
        }}
        leadingIcon={isCompactMode ? 'view-grid-outline' : 'view-grid'}
      />
      <Menu.Item
        title={`${showBirthdays ? 'Hide' : 'Show'} Birthdays`}
        onPress={() => {
          toggleBirthdaysSection();
          setSortMenuVisible(false);
        }}
        leadingIcon={showBirthdays ? 'cake-variant' : 'cake-variant-outline'}
      />
    </Menu>
  );
  
  // Set navigation options with search and settings buttons
  React.useLayoutEffect(() => {
    // Create debounced handlers to prevent double-tap issues
    const debouncedToggleSearch = debounce(() => {
      toggleSearchBar(!searchVisible);
    }, 300, { leading: true, trailing: false });
    
    const debouncedNavigateToSettings = debounce(() => {
      navigation.navigate('Settings');
    }, 300, { leading: true, trailing: false });

    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtonsContainer}>
          <Appbar.Action 
            icon="magnify" 
            color="white" 
            onPress={debouncedToggleSearch}
            style={styles.headerButton}
            // Add hitSlop to increase touch area
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          />
          <Appbar.Action 
            icon="cog" 
            color="white" 
            onPress={debouncedNavigateToSettings}
            style={styles.headerButton}
            // Add hitSlop to increase touch area
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          />
        </View>
      ),
    });
  }, [navigation, searchVisible]);

  return (
    <View style={styles.container}>
      {/* Only render search section when searchVisible is true to ensure it's hidden by default */}
      {searchVisible && (
        <Animated.View style={[styles.searchSection, { height: searchBarHeight, overflow: 'hidden' }]}>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search"
              onChangeText={handleSearch}
              value={searchQuery}
              style={styles.searchBar}
              icon="magnify"
              onIconPress={() => {}}
            />
          </View>
          {renderOptionsMenu()}
        </Animated.View>
      )}
      
      {/* Banner for merge mode */}
      {mergeMode && sourceEntity && (
        <Banner
          visible={true}
          actions={[
            {
              label: 'Cancel',
              onPress: cancelMergeMode,
            },
          ]}
          icon="merge"
        >
          Select a target to merge "{sourceEntity.name}" into.
        </Banner>
      )}
      
      {/* Show upcoming birthdays section if enabled */}
      {showBirthdays && <UpcomingBirthdays />}
      
      {/* Filter chips */}
      {renderFilterChips()}
      
      <FlatList
        key={`grid-${numColumns}`}
        data={entities}
        numColumns={numColumns}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadEntities}
            colors={['#6200ee']}
          />
        }
        onScroll={handleScroll}
      />
      
      {/* Debug button (only show if feature flag is enabled) */}
      {__DEV__ && isFeatureEnabledSync('SHOW_DEBUG_BUTTON') && (
        <Button
          mode="text"
          onPress={() => navigation.navigate('Debug')}
          style={styles.debugButton}
        >
          Database Debug
        </Button>
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('EditEntity', { type: filter })}
      />
      
      {/* Merge result snackbar */}
      <Snackbar
        visible={showMergeSnackbar && !mergeMode}
        onDismiss={() => setShowMergeSnackbar(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setShowMergeSnackbar(false),
        }}
      >
        {mergeMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchContainer: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
    height: 40,
    borderRadius: 20,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
  },
  headerButton: {
    margin: 0,
    marginRight: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    flexWrap: 'wrap',
    zIndex: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  filterChip: {
    marginHorizontal: 4,
  },
  favoriteChip: {
    margin: 0,
    marginLeft: 4,
  },
  listContent: {
    padding: 4,
    paddingTop: 8,
    paddingBottom: 80, // Space for FAB
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '50%', // Default for regular mode (2 columns)
    padding: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
  debugButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    opacity: 0.7,
  },
});

export default HomeScreen; 