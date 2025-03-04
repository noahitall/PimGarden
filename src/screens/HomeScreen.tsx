import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, FlatList, Dimensions, RefreshControl } from 'react-native';
import { FAB, Appbar, Chip } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';
import EntityCard from '../components/EntityCard';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<EntityType | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  
  // Calculate number of columns based on screen width
  const screenWidth = Dimensions.get('window').width;
  const numColumns = useMemo(() => Math.max(2, Math.floor(screenWidth / 200)), [screenWidth]);
  
  // Load entities from database
  const loadEntities = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await database.getAllEntities(filter);
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
  }, [filter]);
  
  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadEntities();
    }, [loadEntities])
  );
  
  // Handle card press
  const handleCardPress = (id: string) => {
    navigation.navigate('EntityDetail', { id });
  };
  
  // Handle filter selection
  const handleFilterChange = (type: EntityType) => {
    setFilter(type === filter ? undefined : type);
  };
  
  // Render filter chips
  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
      <Chip 
        selected={filter === EntityType.PERSON} 
        onPress={() => handleFilterChange(EntityType.PERSON)}
        style={styles.chip}
      >
        People
      </Chip>
      <Chip 
        selected={filter === EntityType.GROUP} 
        onPress={() => handleFilterChange(EntityType.GROUP)}
        style={styles.chip}
      >
        Groups
      </Chip>
      <Chip 
        selected={filter === EntityType.TOPIC} 
        onPress={() => handleFilterChange(EntityType.TOPIC)}
        style={styles.chip}
      >
        Topics
      </Chip>
    </View>
  );
  
  // Render entity card
  const renderItem = ({ item }: { item: Entity }) => (
    <View style={styles.cardContainer}>
      <EntityCard entity={item} onPress={handleCardPress} />
    </View>
  );
  
  return (
    <View style={styles.container}>
      {renderFilterChips()}
      
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
      />
      
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('EditEntity', {})}
      />
      
      <FAB
        style={styles.importFab}
        icon="import"
        label="Import Contacts"
        onPress={() => navigation.navigate('ContactImport')}
        small
      />
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
  },
  chip: {
    margin: 4,
  },
  listContent: {
    padding: 4,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '50%', // Ensure cards don't get too wide on larger screens
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 80,
    backgroundColor: '#6200ee',
  },
  importFab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#03dac4',
  },
});

export default HomeScreen; 