import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, FlatList, Dimensions, RefreshControl, Animated, Alert, TouchableOpacity, ScrollView, SafeAreaView, Keyboard, ActivityIndicator } from 'react-native';
import { FAB, Appbar, Chip, Searchbar, Button, Snackbar, Banner, Menu, IconButton, Divider, Text, Surface, Dialog, Portal } from 'react-native-paper';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';
import EntityCard from '../components/EntityCard';
import UpcomingBirthdays from '../components/UpcomingBirthdays';
import { isFeatureEnabledSync, updateFeatureFlag } from '../config/FeatureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';
import { eventEmitter } from '../utils/EventEmitter';
import { notificationService } from '../services/NotificationService';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Sort options type
type SortOption = 'updated' | 'name' | 'recent_interaction';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [entityCount, setEntityCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [filter, setFilter] = useState<EntityType | undefined>(undefined);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [keepFavoritesFirst, setKeepFavoritesFirst] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [numColumns, setNumColumns] = useState(2);
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [sourceEntity, setSourceEntity] = useState<Entity | null>(null);
  const [mergeMessage, setMergeMessage] = useState('');
  const [mergeDialogVisible, setMergeDialogVisible] = useState(false);
  const [targetEntity, setTargetEntity] = useState<Entity | null>(null);
  const [loadingMerge, setLoadingMerge] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  const searchInputRef = useRef<any>(null);
  const searchBarHeight = useRef(new Animated.Value(0)).current;
  
  // Add state variables for pagination
  const [visibleEntities, setVisibleEntities] = useState<Entity[]>([]);
  const [entityListLimit, setEntityListLimit] = useState<number>(50); // Default to 50
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreToLoad, setHasMoreToLoad] = useState<boolean>(false);
  
  // Calculate number of columns based on screen width and view mode
  const screenWidth = Dimensions.get('window').width;
  const numColumnsMemo = useMemo(() => {
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
        if (savedSortBy) {
          setSortBy(savedSortBy as SortOption);
        }
        
        const savedKeepFavoritesFirst = await AsyncStorage.getItem('keepFavoritesFirst');
        if (savedKeepFavoritesFirst !== null) {
          setKeepFavoritesFirst(savedKeepFavoritesFirst === 'true');
        }
        
        const savedCompactMode = await AsyncStorage.getItem('compactMode');
        if (savedCompactMode !== null) {
          setIsCompactMode(savedCompactMode === 'true');
          setNumColumns(savedCompactMode === 'true' ? 3 : 2);
        }
        
        // Instead of using a separate state, now we check the feature flag
        setShowBirthdays(isFeatureEnabledSync('ENABLE_BIRTHDAY_DISPLAY'));
        
        const savedShowHidden = await AsyncStorage.getItem('showHidden');
        if (savedShowHidden !== null) {
          setShowHidden(savedShowHidden === 'true');
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
    newShowBirthdays?: boolean,
    newShowHidden?: boolean
  ) => {
    try {
      // Handle sortBy
      if (newSortBy !== undefined) {
        await AsyncStorage.setItem('sortBy', newSortBy);
        setSortBy(newSortBy);
      }
      
      // Handle keepFavoritesFirst
      if (newKeepFavoritesFirst !== undefined) {
        await AsyncStorage.setItem('keepFavoritesFirst', String(newKeepFavoritesFirst));
        setKeepFavoritesFirst(newKeepFavoritesFirst);
      }
      
      // Handle compactMode
      if (newCompactMode !== undefined) {
        await AsyncStorage.setItem('compactMode', String(newCompactMode));
        setIsCompactMode(newCompactMode);
        setNumColumns(newCompactMode ? 3 : 2);
      }
      
      // Handle showBirthdays - now updates the feature flag
      if (newShowBirthdays !== undefined) {
        await updateFeatureFlag('ENABLE_BIRTHDAY_DISPLAY', newShowBirthdays);
        setShowBirthdays(newShowBirthdays);
      }
      
      // Handle showHidden
      if (newShowHidden !== undefined) {
        await AsyncStorage.setItem('showHidden', String(newShowHidden));
        setShowHidden(newShowHidden);
      }
      
      // Force reload of data
      loadEntities();
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  };
  
  // Load entities from the database
  const loadEntities = useCallback(async () => {
    setRefreshing(true);
    try {
      let data;
      
      if (showFavorites) {
        // Get only favorite entities
        data = await database.getFavorites();
      } else {
        // Get all entities
        data = await database.getAllEntities(showHidden);
      }
      
      // Apply filter if set
      if (filter) {
        data = data.filter(entity => entity.type === filter);
      }
      
      // Apply search filter if query exists
      if (searchQuery.trim()) {
        data = data.filter(entity => 
          entity.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Apply sorting
      data.sort((a, b) => {
        // First apply favorites sorting if enabled
        if (keepFavoritesFirst) {
          const aFavorite = a.is_favorite || false;
          const bFavorite = b.is_favorite || false;
          
          if (aFavorite && !bFavorite) return -1;
          if (!aFavorite && bFavorite) return 1;
        }
        
        // Then apply the selected sort
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'recent_interaction':
            return b.interaction_score - a.interaction_score;
          case 'updated':
          default:
            return b.updated_at - a.updated_at;
        }
      });
      
      // Set the entities with proper typing
      const typedData = data.map(entity => ({
        ...entity,
        type: entity.type as EntityType
      }));
      setEntities(typedData);
      setAllEntities(typedData);
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setRefreshing(false);
    }
  }, [filter, searchQuery, showFavorites, sortBy, keepFavoritesFirst, showHidden]);
  
  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadEntities();
    }, [loadEntities])
  );
  
  // Listen for the 'tagChange' event to refresh interaction types
  useEffect(() => {
    const handleTagChange = () => {
      loadEntities();
    };
    
    // Add event listener
    eventEmitter.addEventListener('tagChange', handleTagChange);
    
    return () => {
      eventEmitter.removeEventListener('tagChange', handleTagChange);
    };
  }, []);
  
  // Handle card press - normal mode opens entity, merge mode selects target
  const handleCardPress = (id: string) => {
    if (mergeMode && sourceEntity) {
      handleMergeConfirmation(id);
    } else {
      navigation.navigate('EntityDetail', { id });
    }
  };
  
  // Handle card long press - trigger merge mode
  const handleCardLongPress = (id: string) => {
    // Find the entity that was long-pressed
    const entity = entities.find(e => e.id === id);
    if (!entity) return;
    
    // Set merge mode
    setMergeMode(true);
    setSourceEntity(entity);
    setMergeMessage(`Select a destination ${entity.type} to merge "${entity.name}" into`);
    setMergeDialogVisible(true);
  };
  
  // Handle merge confirmation
  const handleMergeConfirmation = (targetId: string) => {
    if (!sourceEntity || !targetId) {
      // Can't merge without both entities
      setMergeMode(false);
      setMergeDialogVisible(false);
      return;
    }
    
    // Check if types match
    if (sourceEntity.type !== targetId) {
      Alert.alert(
        'Type Mismatch',
        `Cannot merge a ${sourceEntity.type} with a ${targetId}. Please select a ${sourceEntity.type} as the destination.`,
        [{ text: 'OK' }]
      );
      setMergeMode(false);
      setMergeDialogVisible(false);
      return;
    }
    
    // Confirm merge operation
    Alert.alert(
      'Confirm Merge',
      `Are you sure you want to merge "${sourceEntity.name}" into "${targetId}"? This action cannot be undone.`,
      [
        { 
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {} // Keep merge mode active
        },
        {
          text: 'Merge',
          style: 'default',
          onPress: () => performMerge(sourceEntity.id, targetId)
        },
        {
          text: 'Exit Merge Mode',
          style: 'destructive',
          onPress: () => {
            setMergeMode(false);
            setMergeDialogVisible(false);
          }
        }
      ]
    );
  };
  
  // Perform the actual merge
  const performMerge = async (sourceId: string, targetId: string) => {
    try {
      setLoadingMerge(true);
      const success = await database.mergeEntities(sourceId, targetId);
      
      if (success) {
        // Reload entities and show success message
        await loadEntities();
        setMergeMessage('Entities merged successfully!');
      } else {
        // Show error message
        setMergeMessage('Failed to merge entities. Please try again.');
      }
      
      // Exit merge mode
      setMergeMode(false);
      setMergeDialogVisible(false);
    } catch (error) {
      console.error('Error merging entities:', error);
      setMergeMessage('An error occurred while merging entities.');
      setMergeMode(false);
      setMergeDialogVisible(false);
    } finally {
      setLoadingMerge(false);
    }
  };
  
  // Handle filter selection
  const handleFilterChange = (type: EntityType) => {
    if (filter === type) {
      setFilter(undefined);
    } else {
      setFilter(type);
    }
  };
  
  // Toggle favorites only filter
  const handleFavoritesToggle = () => {
    setShowFavorites(!showFavorites);
  };
  
  // Toggle search bar visibility
  const toggleSearchBar = (show: boolean) => {
    if (show) {
      // First make component visible
      setSearchVisible(true);
      // Then start animation
      Animated.timing(searchBarHeight, {
        toValue: 60,
        duration: 250,
        useNativeDriver: false
      }).start();
    } else {
      // If hiding, animate first, then hide the component
      Animated.timing(searchBarHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false
      }).start(() => {
        setSearchVisible(false);
        setSearchQuery('');
        // Ensure menu is closed
        setMenuVisible(false);
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
          icon={showFavorites ? 'star' : 'star-outline'}
          selected={showFavorites}
          onPress={() => setShowFavorites(!showFavorites)}
          style={styles.favoriteChip}
          iconColor={showFavorites ? '#FFD700' : undefined}
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
        onLongPress={() => handleCardLongPress(item.id)}
        selected={mergeMode && sourceEntity && sourceEntity.id === item.id}
        isCompact={isCompactMode}
        forceRefresh={Date.now()}
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
  
  // Helper to dismiss menu with a small delay
  const dismissMenuWithDelay = () => {
    // Short delay to ensure the action completes before dismissing
    setTimeout(() => setMenuVisible(false), 100);
  };

  // Toggle birthdays section
  const toggleBirthdaysSection = async () => {
    const newValue = !isFeatureEnabledSync('ENABLE_BIRTHDAY_DISPLAY');
    await updateFeatureFlag('ENABLE_BIRTHDAY_DISPLAY', newValue);
    setShowBirthdays(newValue);
    dismissMenuWithDelay(); // Use the delayed dismiss
  };
  
  // Meatball menu for more options
  const renderOptionsMenu = () => (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchor={{ x: windowWidth - 56, y: 56 }}
    >
      <Menu.Item
        onPress={() => {
          const newSortBy = getNextSortOption();
          savePreferences(newSortBy);
          dismissMenuWithDelay(); // Use the delayed dismiss
        }}
        title={`Sort By: ${getSortByText()}`}
        leadingIcon="sort"
      />
      <Menu.Item
        onPress={() => {
          savePreferences(undefined, !keepFavoritesFirst);
          dismissMenuWithDelay(); // Use the delayed dismiss
        }}
        title={`${keepFavoritesFirst ? 'Disable' : 'Enable'} Favorites First`}
        leadingIcon={keepFavoritesFirst ? 'star' : 'star-outline'}
      />
      <Menu.Item
        onPress={() => {
          savePreferences(undefined, undefined, !isCompactMode);
          dismissMenuWithDelay(); // Use the delayed dismiss
        }}
        title={`${isCompactMode ? 'Standard' : 'Compact'} View`}
        leadingIcon={isCompactMode ? 'view-grid-outline' : 'view-grid'}
      />
      <Menu.Item
        onPress={toggleBirthdaysSection}
        title={`${showBirthdays ? 'Hide' : 'Show'} Birthdays`}
        leadingIcon={showBirthdays ? 'cake-variant' : 'cake-variant-outline'}
      />
      <Menu.Item
        onPress={() => {
          savePreferences(undefined, undefined, undefined, undefined, !showHidden);
          dismissMenuWithDelay(); // Use the delayed dismiss
        }}
        title={`${showHidden ? 'Hide' : 'Show'} Hidden Entities`}
        leadingIcon={showHidden ? 'eye-off' : 'eye'}
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

  // Handle new entity creation
  const handleAddEntity = () => {
    navigation.navigate('EditEntity', { type: filter });
  };

  // This is just a placeholder for the animation reference
  const searchAnimationRef = useRef(new Animated.Value(0));

  // Show upcoming birthdays section if enabled
  useEffect(() => {
    // Check if birthdays should be shown based on feature flag
    setShowBirthdays(isFeatureEnabledSync('ENABLE_BIRTHDAY_DISPLAY'));
  }, [isFocused]); // Re-check when screen comes into focus

  // Load entity list limit preference
  useEffect(() => {
    const loadEntityListLimit = async () => {
      try {
        const savedLimit = await AsyncStorage.getItem('entityListLimit');
        if (savedLimit !== null) {
          setEntityListLimit(Number(savedLimit));
        }
      } catch (error) {
        console.error('Error loading entity list limit preference:', error);
      }
    };
    
    loadEntityListLimit();
  }, []);
  
  // Update visibleEntities whenever entities, currentPage, or entityListLimit changes
  useEffect(() => {
    const totalItems = entityListLimit * currentPage;
    setVisibleEntities(entities.slice(0, totalItems));
    setHasMoreToLoad(entities.length > totalItems);
  }, [entities, currentPage, entityListLimit]);
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, showFavorites, sortBy, keepFavoritesFirst, showHidden]);
  
  // Function to load more entities
  const handleLoadMore = () => {
    setCurrentPage(currentPage + 1);
  };
  
  // Render footer with Load More button
  const renderFooter = () => {
    if (!hasMoreToLoad) return null;
    
    return (
      <View style={styles.footerContainer}>
        <Button 
          mode="contained" 
          onPress={handleLoadMore}
          style={styles.loadMoreButton}
        >
          Load More ({entities.length - visibleEntities.length} remaining)
        </Button>
      </View>
    );
  };

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
              inputStyle={{ 
                textAlignVertical: 'center', 
                height: 40, 
                paddingTop: 0,
                paddingBottom: 0,
                margin: 0
              }}
              theme={{ colors: { placeholder: '#666666' } }}
              icon="magnify"
              onIconPress={() => {}}
              ref={searchInputRef}
            />
            <Appbar.Action 
              icon="dots-vertical" 
              color="#333"
              onPress={() => setMenuVisible(true)}
              style={styles.menuButton}
            />
          </View>
          {/* Only render menu when it's visible */}
          {menuVisible && renderOptionsMenu()}
        </Animated.View>
      )}
      
      {/* Banner for merge mode */}
      {mergeMode && sourceEntity && (
        <Banner
          visible={true}
          actions={[
            {
              label: 'Cancel',
              onPress: () => {
                setMergeMode(false);
                setMergeDialogVisible(false);
              },
            },
          ]}
          icon="merge"
        >
          Select a target to merge "{sourceEntity.name}" into.
        </Banner>
      )}
      
      {/* Show upcoming birthdays section if enabled */}
      {isFeatureEnabledSync('ENABLE_BIRTHDAY_DISPLAY') && <UpcomingBirthdays showHidden={showHidden} />}
      
      {/* Filter chips */}
      {renderFilterChips()}
      
      <FlatList
        key={`grid-${numColumns}`}
        data={visibleEntities}
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
        ListFooterComponent={renderFooter}
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
        onPress={handleAddEntity}
      />
      
      {/* Merge result snackbar */}
      <Snackbar
        visible={mergeMessage !== '' && !mergeMode}
        onDismiss={() => {
          setMergeMessage('');
          setMergeMode(false);
          setMergeDialogVisible(false);
        }}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => {
            setMergeMessage('');
            setMergeMode(false);
            setMergeDialogVisible(false);
          },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBar: {
    flex: 1,
    elevation: 0,
    backgroundColor: '#f0f0f0',
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    paddingVertical: 0,
    alignItems: 'center',
    paddingTop: 0,
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
  menuButton: {
    margin: 0,
    marginLeft: 8,
  },
  footerContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    width: '80%',
    marginBottom: 16,
  },
});

export default HomeScreen; 