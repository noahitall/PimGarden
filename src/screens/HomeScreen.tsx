import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, FlatList, Dimensions, RefreshControl, Animated, Alert, TouchableOpacity, ScrollView, SafeAreaView, Keyboard, ActivityIndicator } from 'react-native';
import { FAB, Appbar, Chip, Button, Snackbar, Banner, Menu, IconButton, Divider, Text, Surface, Dialog, Portal, Searchbar } from 'react-native-paper';
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
  const [menuAnchorPosition, setMenuAnchorPosition] = useState({ x: 0, y: 0 });
  const windowWidth = Dimensions.get('window').width;
  
  // Search functionality
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add state variables for pagination
  const [visibleEntities, setVisibleEntities] = useState<Entity[]>([]);
  const [entityListLimit, setEntityListLimit] = useState<number>(50); // Default to 50
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreToLoad, setHasMoreToLoad] = useState<boolean>(false);
  
  // Feature banner state
  const [showFeatureBanner, setShowFeatureBanner] = useState(true);
  
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
        
        const savedShowBirthdays = await AsyncStorage.getItem('showBirthdays');
        if (savedShowBirthdays !== null) {
          setShowBirthdays(savedShowBirthdays === 'true');
        }
        
        const savedShowHidden = await AsyncStorage.getItem('showHidden');
        if (savedShowHidden !== null) {
          setShowHidden(savedShowHidden === 'true');
        }
        
        const savedShowSearchBar = await AsyncStorage.getItem('showSearchBar');
        if (savedShowSearchBar !== null) {
          setShowSearchBar(savedShowSearchBar === 'true');
        }
        
        const savedShowFeatureBanner = await AsyncStorage.getItem('showFeatureBanner');
        if (savedShowFeatureBanner !== null) {
          setShowFeatureBanner(savedShowFeatureBanner === 'true');
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
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
    newShowHidden?: boolean,
    newShowSearchBar?: boolean,
    newShowFeatureBanner?: boolean
  ) => {
    try {
      // Save sort preferences
      if (newSortBy) {
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
        await AsyncStorage.setItem('compactMode', String(newCompactMode));
        setIsCompactMode(newCompactMode);
        setNumColumns(newCompactMode ? 3 : 2);
      }
      
      // Save birthday section visibility
      if (newShowBirthdays !== undefined) {
        await AsyncStorage.setItem('showBirthdays', String(newShowBirthdays));
        setShowBirthdays(newShowBirthdays);
      }
      
      // Save hidden entities visibility
      if (newShowHidden !== undefined) {
        await AsyncStorage.setItem('showHidden', String(newShowHidden));
        setShowHidden(newShowHidden);
      }
      
      // Save search bar visibility
      if (newShowSearchBar !== undefined) {
        await AsyncStorage.setItem('showSearchBar', String(newShowSearchBar));
        setShowSearchBar(newShowSearchBar);
        // Clear search query if hiding search bar
        if (!newShowSearchBar) {
          setSearchQuery('');
        }
      }
      
      // Save feature banner state
      if (newShowFeatureBanner !== undefined) {
        await AsyncStorage.setItem('showFeatureBanner', String(newShowFeatureBanner));
        setShowFeatureBanner(newShowFeatureBanner);
      }
      
      // Force reload of data
      loadEntities();
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  };
  
  // Load entities from the database
  const loadEntities = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Use any for data initially since we need to handle multiple entity source formats
      let data: any[] = [];
      
      if (showFavorites) {
        // Get only favorite entities
        data = await database.getFavorites();
      } else {
        const options: {
          sortBy?: 'name' | 'recent_interaction';
          keepFavoritesFirst?: boolean;
          showHidden?: boolean;
        } = {
          showHidden: showHidden,
          keepFavoritesFirst: keepFavoritesFirst
        };
        
        // Set sortBy with the correct type
        if (sortBy === 'name') {
          options.sortBy = 'name';
        } else if (sortBy === 'recent_interaction') {
          options.sortBy = 'recent_interaction';
        }
        
        // Get all entities or filtered by type
        data = await database.getAllEntities(filter, options);
      }
      
      // Ensure data is an array before proceeding
      if (!data || !Array.isArray(data)) {
        console.warn('No entities returned from database or invalid format');
        data = [];
      }
      
      // Apply search query filter if needed
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        data = data.filter(entity => 
          entity.name.toLowerCase().includes(query) || 
          (entity.details && entity.details.toLowerCase().includes(query))
        );
      }
      
      // Apply sorting
      if (Array.isArray(data) && data.length > 0) {
        data.sort((a, b) => {
          // First apply favorites sorting if enabled
          if (keepFavoritesFirst) {
            const aFavorite = (a as any).is_favorite || false;
            const bFavorite = (b as any).is_favorite || false;
            
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
      }
      
      // Set the entities with proper typing
      const typedData = data.map(entity => ({
        ...entity,
        type: entity.type as EntityType
      }));
      
      setEntities(typedData as any);
      setAllEntities(typedData as any);
    } catch (error) {
      console.error('Error loading entities:', error);
      // Set empty arrays to avoid undefined
      setEntities([]);
      setAllEntities([]);
    } finally {
      setRefreshing(false);
    }
  }, [filter, showFavorites, sortBy, keepFavoritesFirst, showHidden, searchQuery]);
  
  // Load entity data when screen is in focus
  useFocusEffect(
    useCallback(() => {
      if (isFocused) {
        loadEntities();

        // Set up listener for refreshEntities event
        const refreshListener = () => {
          loadEntities();
        };
        
        eventEmitter.addEventListener('refreshEntities', refreshListener);
        
        // Clean up listener when component unmounts
        return () => {
          eventEmitter.removeEventListener('refreshEntities', refreshListener);
        };
      }
    }, [isFocused, loadEntities])
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
  }, [loadEntities]);
  
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
    // Toggle filter or set new filter
    if (filter === type) {
      // Call loadEntities before setting state to get current state
      loadEntities().then(() => {
        setFilter(undefined);
      });
    } else {
      // Set filter first, then call loadEntities with the new filter value directly
      setFilter(type);
      
      // We need to manually filter for the new type since loadEntities will use the state
      // which hasn't been updated yet
      (async () => {
        setRefreshing(true);
        try {
          let data;
          
          if (showFavorites) {
            // Get only favorite entities
            data = await database.getFavorites();
          } else {
            // Get all entities
            data = await database.getAllEntities(showHidden as any);
          }
          
          // Apply the new filter immediately (use the parameter, not the state)
          data = data.filter(entity => entity.type === type);
          
          // Apply sorting
          data.sort((a, b) => {
            // First apply favorites sorting if enabled
            if (keepFavoritesFirst) {
              const aFavorite = (a as any).is_favorite || false;
              const bFavorite = (b as any).is_favorite || false;
              
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
          
          setEntities(typedData as any);
          setAllEntities(typedData as any);
        } catch (error) {
          console.error('Error filtering entities:', error);
        } finally {
          setRefreshing(false);
        }
      })();
    }
  };
  
  // Handle clearing the filter (All option)
  const handleClearFilter = () => {
    // Clear filter
    setFilter(undefined);
    
    // Immediately load all entities
    (async () => {
      setRefreshing(true);
      try {
        let data;
        
        if (showFavorites) {
          // Get only favorite entities
          data = await database.getFavorites();
        } else {
          // Get all entities
          data = await database.getAllEntities(showHidden as any);
        }
        
        // No filter to apply
        
        // Apply sorting
        data.sort((a, b) => {
          // First apply favorites sorting if enabled
          if (keepFavoritesFirst) {
            const aFavorite = (a as any).is_favorite || false;
            const bFavorite = (b as any).is_favorite || false;
            
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
        
        setEntities(typedData as any);
        setAllEntities(typedData as any);
      } catch (error) {
        console.error('Error loading all entities:', error);
      } finally {
        setRefreshing(false);
      }
    })();
  };

  // Render filter chips
  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
      <View style={styles.filterRow}>
        <Chip
          selected={filter === undefined}
          onPress={handleClearFilter}
          style={styles.filterChip}
        >
          All
        </Chip>
        <Chip
          selected={filter === EntityType.PERSON}
          onPress={() => handleFilterChange(EntityType.PERSON)}
          style={styles.filterChip}
        >
          People
        </Chip>
        <Chip
          selected={filter === EntityType.GROUP}
          onPress={() => handleFilterChange(EntityType.GROUP)}
          style={styles.filterChip}
        >
          Groups
        </Chip>
        <Chip
          selected={filter === EntityType.TOPIC}
          onPress={() => handleFilterChange(EntityType.TOPIC)}
          style={styles.filterChip}
        >
          Topics
        </Chip>
        <IconButton
          icon={showFavorites ? 'star' : 'star-outline'}
          selected={showFavorites}
          onPress={handleFavoritesToggle}
          style={styles.favoriteChip}
          iconColor={showFavorites ? '#FFD700' : undefined}
        />
      </View>
    </View>
  );
  
  // Memoize the renderItem function to avoid unnecessary re-renders
  const renderItem = useCallback(({ item }: { item: Entity }) => {
    // Compute the selected state properly to avoid null/undefined type errors
    const isSelected = mergeMode && sourceEntity ? sourceEntity.id === item.id : false;
    
    return (
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
          selected={isSelected}
          isCompact={isCompactMode}
        />
      </View>
    );
  }, [isCompactMode, numColumns, mergeMode, sourceEntity, handleCardPress, handleCardLongPress]);
  
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
      anchor={menuAnchorPosition}
    >
      <Menu.Item
        onPress={() => {
          handleSortChange();
          dismissMenuWithDelay();
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
      <Menu.Item
        onPress={() => {
          savePreferences(undefined, undefined, undefined, undefined, undefined, !showSearchBar);
          dismissMenuWithDelay();
        }}
        title={`${showSearchBar ? 'Hide' : 'Show'} Search`}
        leadingIcon="magnify"
      />
    </Menu>
  );
  
  // Set navigation options with settings and dots menu buttons
  React.useLayoutEffect(() => {
    // Create debounced handlers to prevent double-tap issues
    const debouncedNavigateToSettings = debounce(() => {
      navigation.navigate('Settings');
    }, 300, { leading: true, trailing: false });
    
    const debouncedOpenMenu = debounce(() => {
      // Position the menu under the three-dot icon in the header
      setMenuAnchorPosition({ x: windowWidth - 56, y: 56 });
      setMenuVisible(true);
    }, 300, { leading: true, trailing: false });

    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtonsContainer}>
          <Appbar.Action 
            icon="dots-vertical" 
            color="white" 
            onPress={debouncedOpenMenu}
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
  }, [navigation, menuVisible]);

  // Handle new entity creation
  const handleAddEntity = () => {
    navigation.navigate('EditEntity', { type: filter });
  };

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
  
  // Reset pagination when filter/sort changes
  useEffect(() => {
    setCurrentPage(1);
    // Don't call loadEntities here - it will be called by the handler functions
  }, [filter, showFavorites, sortBy, keepFavoritesFirst, showHidden]);
  
  // Handle sort/preferences changes
  const handleSortChange = () => {
    const newSortBy = getNextSortOption();
    savePreferences(newSortBy);
    // Wait for state update, then reload entities
    setTimeout(() => loadEntities(), 0);
  };

  // Function to load more entities
  const handleLoadMore = () => {
    setCurrentPage(currentPage + 1);
  };
  
  // Render footer with load more button if needed
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

  // Add key extractor function for FlatList to optimize performance
  const keyExtractor = useCallback((item: Entity) => item.id, []);

  // Toggle favorites only filter
  const handleFavoritesToggle = () => {
    // Toggle favorites and immediately load updated data
    const newShowFavorites = !showFavorites;
    setShowFavorites(newShowFavorites);
    
    (async () => {
      setRefreshing(true);
      try {
        let data;
        
        if (newShowFavorites) {
          // Get only favorite entities with the new setting
          data = await database.getFavorites();
        } else {
          // Get all entities with the new setting
          data = await database.getAllEntities(showHidden as any);
        }
        
        // Apply current filter
        if (filter) {
          data = data.filter(entity => entity.type === filter);
        }
        
        // Apply sorting
        data.sort((a, b) => {
          // First apply favorites sorting if enabled
          if (keepFavoritesFirst) {
            const aFavorite = (a as any).is_favorite || false;
            const bFavorite = (b as any).is_favorite || false;
            
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
        
        setEntities(typedData as any);
        setAllEntities(typedData as any);
      } catch (error) {
        console.error('Error toggling favorites filter:', error);
      } finally {
        setRefreshing(false);
      }
    })();
  };

  // Dismiss feature banner
  const handleDismissFeatureBanner = () => {
    savePreferences(undefined, undefined, undefined, undefined, undefined, undefined, false);
  };

  // Render the feature banner highlighting interaction tracking
  const renderFeatureBanner = () => {
    if (!showFeatureBanner || entities.length === 0) {
      return null;
    }
    
    return (
      <Banner
        visible={true}
        actions={[
          {
            label: 'Learn More',
            onPress: () => {
              // Navigate to a help page or show a dialog with more information
              Alert.alert(
                'Interaction Tracking',
                'PimGarden helps you maintain relationships by tracking your interactions with people, groups, and topics.\n\n' +
                '• Record different types of interactions (calls, meetings, emails)\n' +
                '• View interaction history and frequency\n' +
                '• Get insights into your relationship strength\n' +
                '• Set reminders for follow-ups and birthdays\n\n' +
                'Try it out by adding an entity and tracking your interactions!'
              );
            },
          },
          {
            label: 'Dismiss',
            onPress: handleDismissFeatureBanner,
          },
        ]}
        icon="chart-timeline-variant"
      >
        Track your interactions with people, groups, and topics to strengthen relationships and never lose touch.
      </Banner>
    );
  };

  // Render empty state when there are no entities
  const renderEmptyState = () => {
    if (entities.length > 0 || refreshing) {
      return null;
    }

    return (
      <View style={styles.emptyStateContainer}>
        <IconButton
          icon="account-group"
          size={60}
          iconColor="#6200ee"
        />
        <Text style={styles.emptyStateTitle}>Welcome to PimGarden</Text>
        <Text style={styles.emptyStateText}>
          Track interactions with people, groups, and topics to strengthen relationships.
        </Text>
        <View style={styles.emptyStateFeatures}>
          <View style={styles.featureItem}>
            <IconButton icon="history" size={24} iconColor="#6200ee" />
            <Text>Record interactions with customizable types</Text>
          </View>
          <View style={styles.featureItem}>
            <IconButton icon="calendar-clock" size={24} iconColor="#6200ee" />
            <Text>Track interaction frequency and history</Text>
          </View>
          <View style={styles.featureItem}>
            <IconButton icon="chart-line" size={24} iconColor="#6200ee" />
            <Text>Monitor relationship strength over time</Text>
          </View>
          <View style={styles.featureItem}>
            <IconButton icon="bell-ring" size={24} iconColor="#6200ee" />
            <Text>Set reminders for follow-ups and birthdays</Text>
          </View>
        </View>
        <Button
          mode="contained"
          icon="plus"
          onPress={handleAddEntity}
          style={styles.emptyStateButton}
        >
          Add Your First Entity
        </Button>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Only render menu when it's visible */}
      {menuVisible && renderOptionsMenu()}
      
      {/* Feature banner highlighting interaction tracking */}
      {renderFeatureBanner()}
      
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
      {showBirthdays && <UpcomingBirthdays showHidden={showHidden} />}
      
      {/* Filter chips */}
      {renderFilterChips()}
      
      {/* Search bar */}
      {showSearchBar && (
        <View style={styles.searchBarContainer}>
          <Searchbar
            placeholder="Search entities..."
            onChangeText={(text) => {
              setSearchQuery(text);
            }}
            value={searchQuery}
            style={styles.searchBar}
            onClearIconPress={() => setSearchQuery('')}
            icon="magnify"
            clearIcon="close-circle"
          />
          {searchQuery.trim() && (
            <View style={styles.searchCountContainer}>
              <Text style={styles.searchCountText}>
                {entities.length} {entities.length === 1 ? 'match' : 'matches'}
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* Empty state when there are no entities */}
      {renderEmptyState()}
      
      {entities.length > 0 && (
        <FlatList
          data={visibleEntities}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          key={`list-${numColumns}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadEntities}
              colors={['#6200ee']}
              progressViewOffset={20}
              progressBackgroundColor="#ffffff"
            />
          }
          onScroll={(event) => {
            // Empty onScroll handler to prevent errors
          }}
          scrollEventThrottle={16}
          ListFooterComponent={renderFooter}
        />
      )}
      
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
  searchBarContainer: {
    padding: 8,
  },
  searchBar: {
    backgroundColor: '#fff',
  },
  searchCountContainer: {
    position: 'absolute',
    top: 8,
    right: 16,
    padding: 4,
    backgroundColor: '#6200ee',
    borderRadius: 8,
    margin: 4,
  },
  searchCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  emptyStateFeatures: {
    marginVertical: 16,
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  emptyStateButton: {
    marginTop: 24,
  },
});

export default HomeScreen; 