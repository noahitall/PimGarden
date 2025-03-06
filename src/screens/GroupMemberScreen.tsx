import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Appbar, Text, Searchbar, Card, Checkbox, Button, FAB, Divider, Chip } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Entity } from '../types';
import { database, EntityType } from '../database/Database';
// @ts-ignore
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type GroupMemberScreenRouteProp = RouteProp<RootStackParamList, 'GroupMembers'>;
type GroupMemberScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroupMembers'>;

type EntityItem = {
  id: string;
  name: string;
  type: EntityType;
  details?: string;
  isMember: boolean;
};

const GroupMemberScreen: React.FC = () => {
  const navigation = useNavigation<GroupMemberScreenNavigationProp>();
  const route = useRoute<GroupMemberScreenRouteProp>();
  const { groupId, groupName } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [members, setMembers] = useState<Entity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntities, setFilteredEntities] = useState<EntityItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<EntityType | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load entities and group members
  useEffect(() => {
    loadData();
  }, []);

  // Filter entities when search query or type filter changes
  useEffect(() => {
    filterEntities();
  }, [searchQuery, typeFilter, entities]);

  // Check for unsaved changes
  useEffect(() => {
    if (!entities.length) return;

    // Check if any membership has changed
    const memberIds = new Set(members.map(m => m.id));
    const currentMemberIds = new Set(
      entities.filter(e => e.isMember).map(e => e.id)
    );

    // Check for differences
    let changed = memberIds.size !== currentMemberIds.size;
    
    if (!changed) {
      // Check if the sets have different contents
      for (const id of memberIds) {
        if (!currentMemberIds.has(id)) {
          changed = true;
          break;
        }
      }
      
      // Also check if there are new members selected that weren't in the original set
      if (!changed) {
        for (const id of currentMemberIds) {
          if (!memberIds.has(id)) {
            changed = true;
            break;
          }
        }
      }
    }

    setHasUnsavedChanges(changed);
  }, [members, entities]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get all entities that are not the current group
      const allEntities = await database.getAllEntities();
      const filteredEntities = allEntities.filter(e => e.id !== groupId);

      // Get current group members
      const groupMembers = await database.getGroupMembers(groupId);
      const memberIds = new Set(groupMembers.map(m => m.id));

      // Mark entities that are already members
      const entitiesWithMemberStatus: EntityItem[] = filteredEntities.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type as EntityType,
        details: entity.details || undefined,
        isMember: memberIds.has(entity.id)
      }));

      setEntities(entitiesWithMemberStatus);
      setMembers(groupMembers as any);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load entities and members');
    } finally {
      setLoading(false);
    }
  };

  const filterEntities = () => {
    let filtered = [...entities];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(entity => 
        entity.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter(entity => entity.type === typeFilter);
    }

    setFilteredEntities(filtered);
  };

  const toggleMembership = (entity: EntityItem) => {
    // Update local state immediately for UI responsiveness
    setEntities(prev => 
      prev.map(e => 
        e.id === entity.id ? { ...e, isMember: !e.isMember } : e
      )
    );
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      // Get all selected members
      const selectedMembers = entities.filter(entity => entity.isMember);
      const selectedMemberIds = selectedMembers.map(m => m.id);

      // Update group members in the database
      const success = await database.updateGroupMembers(groupId, selectedMemberIds);

      if (success) {
        Alert.alert('Success', 'Group members updated successfully');
        // Navigate back to trigger the useFocusEffect in GroupMembersSection
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Failed to update group members');
      }
    } catch (error) {
      console.error('Error saving group members:', error);
      Alert.alert('Error', 'Failed to update group members');
    } finally {
      setSaving(false);
    }
  };

  // Handle back button press
  const handleBackPress = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const renderEntity = ({ item }: { item: EntityItem }) => {
    // Determine if this entity's membership state has changed
    const hasChanged = (() => {
      const memberInOriginalState = members.find(m => m.id === item.id);
      return (!!memberInOriginalState) !== item.isMember;
    })();

    return (
      <Card 
        style={[
          styles.card,
          item.isMember && styles.selectedCard,
          hasChanged && styles.changedCard
        ]}
        onPress={() => toggleMembership(item)}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.entityInfo}>
            <Text style={styles.entityName}>{item.name}</Text>
            <Chip style={styles.typeChip}>
              {item.type === EntityType.PERSON ? 'Person' : 
               item.type === EntityType.TOPIC ? 'Topic' : 'Group'}
            </Chip>
          </View>
          <Checkbox
            status={item.isMember ? 'checked' : 'unchecked'}
            onPress={() => toggleMembership(item)}
            color={hasChanged ? '#E91E63' : '#6200ee'}
          />
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={handleBackPress} />
        <Appbar.Content title={`${groupName} Members`} />
        <Appbar.Action icon="check" onPress={saveChanges} disabled={saving} />
      </Appbar.Header>

      {hasUnsavedChanges && (
        <View style={styles.unsavedChangesIndicator}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#f57c00" />
          <Text style={styles.unsavedChangesText}>Unsaved changes</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search entities..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      <View style={styles.filterContainer}>
        <Chip 
          selected={typeFilter === null} 
          onPress={() => setTypeFilter(null)}
          style={styles.filterChip}
        >
          All
        </Chip>
        <Chip 
          selected={typeFilter === EntityType.PERSON} 
          onPress={() => setTypeFilter(EntityType.PERSON)}
          style={styles.filterChip}
        >
          People
        </Chip>
        <Chip 
          selected={typeFilter === EntityType.TOPIC} 
          onPress={() => setTypeFilter(EntityType.TOPIC)}
          style={styles.filterChip}
        >
          Topics
        </Chip>
        <Chip 
          selected={typeFilter === EntityType.GROUP} 
          onPress={() => setTypeFilter(EntityType.GROUP)}
          style={styles.filterChip}
        >
          Groups
        </Chip>
      </View>

      <FlatList
        data={filteredEntities}
        renderItem={renderEntity}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <Divider />}
      />

      <FAB
        style={styles.fab}
        icon="check"
        label={hasUnsavedChanges ? "Save Changes" : "No Changes"}
        onPress={saveChanges}
        loading={saving}
        disabled={!hasUnsavedChanges || saving}
      />
    </View>
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
  searchContainer: {
    padding: 10,
  },
  searchbar: {
    elevation: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    margin: 4,
  },
  listContent: {
    padding: 8,
  },
  card: {
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: '#e8f5e9',
    borderLeftColor: '#4caf50',
  },
  changedCard: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#ffc107',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  typeChip: {
    alignSelf: 'flex-start',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#4caf50',
  },
  unsavedChangesIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff8e1',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 3,
  },
  unsavedChangesText: {
    marginLeft: 8,
    color: '#f57c00',
  }
});

export default GroupMemberScreen; 