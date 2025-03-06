import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, FlatList, Dimensions, RefreshControl, Animated, Alert } from 'react-native';
import { FAB, Appbar, Chip, Searchbar, Button, Snackbar, Banner, Menu, IconButton, Divider } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';
import EntityCard from '../components/EntityCard';
import { isFeatureEnabledSync } from '../config/FeatureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  
  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get('window').width;
  const numColumns = useMemo(() => Math.max(2, Math.floor(screenWidth / 200)), [screenWidth]);
  
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
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // Save preferences when they change
  const savePreferences = async (newSortBy?: SortOption, newKeepFavoritesFirst?: boolean) => {
    try {
      if (newSortBy) {
        await AsyncStorage.setItem('sortBy', newSortBy);
      }
      if (newKeepFavoritesFirst !== undefined) {
        await AsyncStorage.setItem('keepFavoritesFirst', String(newKeepFavoritesFirst));
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
    setSearchVisible(show);
    Animated.timing(searchBarHeight, {
      toValue: show ? 60 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    if (!show) {
      setSearchQuery('');
    }
  };
  
  // Handle search query changes
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  // Handle scroll events to show/hide search bar
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    if (scrollY < -50 && !searchVisible) {
      toggleSearchBar(true);
    } else if (scrollY > 50 && searchVisible) {
      toggleSearchBar(false);
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
    <View style={styles.cardContainer}>
      <EntityCard 
        entity={item} 
        onPress={handleCardPress} 
        onLongPress={handleCardLongPress}
        selected={mergeMode && sourceEntityId === item.id}
      />
    </View>
  );
  
  // Set navigation options with settings button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Appbar.Action 
          icon="cog" 
          color="white" 
          onPress={() => navigation.navigate('Settings')} 
        />
      ),
    });
  }, [navigation]);
  
  return (
    <View style={styles.container}>
      {/* Merge mode banner */}
      {mergeMode && (
        <Banner
          visible={true}
          icon="merge"
          actions={[
            {
              label: 'Cancel',
              onPress: cancelMergeMode,
            },
          ]}
        >
          {mergeMessage}
        </Banner>
      )}
      
      {renderFilterChips()}
      
      <Animated.View style={[styles.searchBarContainer, { height: searchBarHeight }]}>
        <View style={styles.searchRow}>
          <Menu
            visible={sortMenuVisible}
            onDismiss={() => setSortMenuVisible(false)}
            anchor={
              <IconButton
                icon="sort"
                size={24}
                onPress={() => setSortMenuVisible(true)}
                style={styles.sortButton}
              />
            }
          >
            <Menu.Item
              title="Sort by Last Updated"
              onPress={() => {
                setSortBy('updated');
                savePreferences('updated');
                setSortMenuVisible(false);
                loadEntities();
              }}
              leadingIcon={sortBy === 'updated' ? 'check' : undefined}
            />
            <Menu.Item
              title="Sort by Name"
              onPress={() => {
                setSortBy('name');
                savePreferences('name');
                setSortMenuVisible(false);
                loadEntities();
              }}
              leadingIcon={sortBy === 'name' ? 'check' : undefined}
            />
            <Menu.Item
              title="Sort by Recent Interaction"
              onPress={() => {
                setSortBy('recent_interaction');
                savePreferences('recent_interaction');
                setSortMenuVisible(false);
                loadEntities();
              }}
              leadingIcon={sortBy === 'recent_interaction' ? 'check' : undefined}
            />
            <Divider />
            <Menu.Item
              title="Keep Favorites First"
              onPress={() => {
                const newValue = !keepFavoritesFirst;
                setKeepFavoritesFirst(newValue);
                savePreferences(undefined, newValue);
                setSortMenuVisible(false);
                loadEntities();
              }}
              leadingIcon={keepFavoritesFirst ? 'check' : undefined}
            />
          </Menu>
          <Searchbar
            placeholder="Search by name, phone, email, or address"
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            autoCapitalize="none"
          />
        </View>
      </Animated.View>
      
      <FlatList
        key={`grid-${numColumns}`}
        data={entities}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadEntities} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '50%',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
  searchBarContainer: {
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,
    zIndex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sortButton: {
    margin: 0,
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    elevation: 0,
    backgroundColor: '#fff',
  },
  debugButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    opacity: 0.7,
  },
});

export default HomeScreen; 