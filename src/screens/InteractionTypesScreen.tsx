import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { 
  ActivityIndicator, 
  Button, 
  Card, 
  Checkbox, 
  Dialog, 
  Divider, 
  IconButton, 
  List, 
  Text, 
  TextInput,
  Portal,
  HelperText,
  Chip
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { database, EntityType, InteractionType, Tag } from '../database/Database';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type InteractionTypesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'InteractionTypes'>;

// Array of Material Community Icons to choose from
const iconOptions = [
  { icon: 'account-check' },
  { icon: 'phone' },
  { icon: 'message-text' },
  { icon: 'email' },
  { icon: 'video' },
  { icon: 'calendar' },
  { icon: 'food' },
  { icon: 'coffee' },
  { icon: 'glass-mug' },
  { icon: 'cards' },
  { icon: 'gamepad-variant' },
  { icon: 'ticket' },
  { icon: 'bus' },
  { icon: 'car' },
  { icon: 'airplane' },
  { icon: 'briefcase' },
  { icon: 'cash' },
  { icon: 'gift' },
  { icon: 'home' },
  { icon: 'hammer' },
  { icon: 'wrench' },
  { icon: 'medical-bag' },
  { icon: 'heart' },
  { icon: 'star' },
  { icon: 'book-open-variant' },
  { icon: 'school' },
  { icon: 'account-group' },
  { icon: 'music' },
  { icon: 'movie' },
  { icon: 'basketball' },
  { icon: 'football' },
  { icon: 'tennis' },
  { icon: 'bike' },
  { icon: 'swim' },
  { icon: 'walk' },
  { icon: 'run' },
  { icon: 'hiking' },
  { icon: 'church' },
  { icon: 'mosque' },
  { icon: 'synagogue' },
  { icon: 'bank' },
  { icon: 'store' },
  { icon: 'shopping' },
  { icon: 'camera' },
  { icon: 'palette' },
  { icon: 'piano' },
  { icon: 'guitar' },
  { icon: 'microphone' },
  { icon: 'headphones' },
  { icon: 'television' },
];

const InteractionTypesScreen: React.FC = () => {
  const navigation = useNavigation<InteractionTypesScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Interaction types list state
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  
  // Dialog state for creating/editing interaction types
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  
  // Form state for interaction type details
  const [actionName, setActionName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('account-check');
  const [actionScore, setActionScore] = useState<number>(1);
  const [actionColor, setActionColor] = useState<string>('#666666');
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  
  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [actionTagsMap, setActionTagsMap] = useState<Record<string, Tag[]>>({});
  const [loadingActionTags, setLoadingActionTags] = useState(false);

  // Load interaction types and tags when the screen mounts
  useEffect(() => {
    loadInteractionTypes();
    loadTags();
  }, []);

  // Load interaction types from the database
  const loadInteractionTypes = async () => {
    try {
      setLoading(true);
      const types = await database.getInteractionTypes();
      setInteractionTypes(types || []);
      
      // Load tags for these actions
      const tagsMap: Record<string, Tag[]> = {};
      setLoadingActionTags(true);
      
      if (types && types.length > 0) {
        for (const action of types) {
          if (!action || !action.id) continue;
          
          try {
            const tags = await database.getInteractionTypeTags(action.id);
            tagsMap[action.id] = tags || [];
            console.log(`Loaded ${tags?.length || 0} tags for action ${action.id}`);
          } catch (err) {
            console.error(`Error loading tags for action ${action.id}:`, err);
            tagsMap[action.id] = [];
          }
        }
      }
      
      setActionTagsMap(tagsMap);
    } catch (error) {
      console.error('Error loading interaction types:', error);
      Alert.alert('Error', 'Failed to load interaction types');
    } finally {
      setLoading(false);
      setLoadingActionTags(false);
    }
  };
  
  // Load all tags
  const loadTags = async () => {
    try {
      const allTags = await database.getAllTags();
      
      // Sort the tags so default tags appear at the top
      const sortedTags = [...allTags].sort((a, b) => {
        const defaultTags = ['family', 'friend', 'pet', 'book'];
        const isADefault = defaultTags.includes(a.name.toLowerCase());
        const isBDefault = defaultTags.includes(b.name.toLowerCase());
        
        if (isADefault && !isBDefault) return -1;
        if (!isADefault && isBDefault) return 1;
        return a.name.localeCompare(b.name); // alphabetical for same category
      });
      
      setTags(sortedTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  // Get formatted entity types string
  const getEntityTypesString = (entityTypeValue: string | null): string => {
    if (!entityTypeValue) return 'All Types';
    
    try {
      // Check if it's a JSON array
      const types = JSON.parse(entityTypeValue);
      if (Array.isArray(types)) {
        if (types.length === 0) return 'All Types';
        return types.map(t => t && typeof t === 'string' ? t.charAt(0).toUpperCase() + t.slice(1) : '').filter(Boolean).join(', ');
      }
    } catch (e) {
      // Not a JSON string, just a single type
      return entityTypeValue.charAt(0).toUpperCase() + entityTypeValue.slice(1);
    }
    
    return entityTypeValue.charAt(0).toUpperCase() + entityTypeValue.slice(1);
  };
  
  // Get readable tag summary for an action
  const getActionTagsSummary = (actionId: string): string => {
    if (!actionId) return 'Global (All Entities)';
    
    // Get tags from the junction table first
    const actionTags = actionTagsMap[actionId];
    if (actionTags && actionTags.length > 0) {
      const tagNames = actionTags.map(tag => tag?.name || 'Unknown').filter(Boolean);
      return tagNames.join(', ');
    }
    
    // If no junction table tags, check the tag_id field for backward compatibility
    const action = interactionTypes.find(a => a?.id === actionId);
    if (action && action.tag_id) {
      const tag = tags.find(t => t?.id === action.tag_id);
      return tag?.name || 'Unknown Tag';
    }
    
    return 'Global (All Entities)';
  };
  
  // Show action creation dialog
  const showCreateActionDialog = () => {
    setActionName('');
    setSelectedIcon('account-check');
    setSelectedTagIds([]);
    setSelectedEntityTypes([]);
    setActionScore(1);
    setActionColor('#666666');
    setEditingActionId(null);
    setDialogVisible(true);
  };
  
  // Handle editing an action
  const handleEditAction = async (action: InteractionType) => {
    if (!action || !action.id) {
      console.error('Invalid action data for editing');
      Alert.alert('Error', 'Cannot edit this action due to missing data');
      return;
    }

    try {
      // Show loading state
      setSaving(true);
      
      setActionName(action.name || '');
      setSelectedIcon(action.icon || 'account-check');
      setActionScore(action.score || 1);
      setActionColor(action.color || '#666666');
      
      // Parse entity_type if it's a JSON string
      let entityTypes: string[] = [];
      
      if (action.entity_type) {
        try {
          const parsedTypes = JSON.parse(action.entity_type);
          if (Array.isArray(parsedTypes)) {
            entityTypes = parsedTypes.filter(t => t && typeof t === 'string');
          } else if (typeof action.entity_type === 'string') {
            entityTypes = [action.entity_type];
          }
        } catch (e) {
          // If not JSON, it's a single type
          if (typeof action.entity_type === 'string') {
            entityTypes = [action.entity_type];
          }
        }
      }
      
      setSelectedEntityTypes(entityTypes);
      
      // Load tags associated with this action
      try {
        const typeTags = await database.getInteractionTypeTags(action.id);
        console.log(`Loaded ${typeTags.length} tags for editing action ${action.id}`);
        setSelectedTagIds(typeTags.filter(tag => tag && tag.id).map(tag => tag.id));
      } catch (tagError) {
        console.error('Error loading tags for action:', tagError);
        // Continue despite tag loading error
        setSelectedTagIds([]);
      }
      
      setEditingActionId(action.id);
      setDialogVisible(true);
    } catch (error) {
      console.error('Error editing action:', error);
      Alert.alert('Error', 'Failed to load action details for editing');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle deleting an action
  const handleDeleteAction = async (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this action?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await database.deleteInteractionType(id);
              loadInteractionTypes();
              Alert.alert('Success', 'Action deleted');
            } catch (error) {
              console.error('Error deleting action:', error);
              Alert.alert('Error', 'Failed to delete action');
            }
          }
        },
      ]
    );
  };
  
  // Handle creating or updating an action (interaction type)
  const handleSaveAction = async () => {
    if (!actionName.trim()) {
      Alert.alert('Error', 'Action name is required');
      return;
    }
    
    try {
      // Show a loading indicator
      setSaving(true);
      
      // Determine entity type value (null if all types selected or none selected)
      const entityType = selectedEntityTypes.length === 0 || 
                        selectedEntityTypes.length === Object.values(EntityType).length 
                        ? null 
                        : selectedEntityTypes.length === 1 
                          ? selectedEntityTypes[0] 
                          : JSON.stringify(selectedEntityTypes);
      
      console.log(`Saving action with entity type: ${entityType}`);
      console.log(`Selected tag IDs: ${selectedTagIds.join(', ')}`);
      
      if (editingActionId) {
        // Update existing action
        await database.updateInteractionType(
          editingActionId, 
          actionName, 
          selectedIcon, 
          entityType,
          actionColor,
          actionScore
        );
        await database.associateInteractionTypeWithMultipleTags(editingActionId, selectedTagIds);
        
        // Reset form
        setActionName('');
        setSelectedIcon('account-check');
        setSelectedTagIds([]);
        setSelectedEntityTypes([]);
        setActionScore(1);
        setActionColor('#666666');
        setEditingActionId(null);
        setDialogVisible(false);
        Alert.alert('Success', 'Action updated successfully');
        console.log('Action updated successfully');
      } else {
        // Create new action with no initial tag (we'll add them after)
        const newTypeId = await database.addInteractionType(
          actionName, 
          selectedIcon, 
          null, 
          entityType,
          actionColor,
          actionScore
        );
        console.log(`Created new action with ID: ${newTypeId}`);
        
        // Associate with selected tags
        if (selectedTagIds.length > 0) {
          await database.associateInteractionTypeWithMultipleTags(newTypeId, selectedTagIds);
          console.log(`Associated action ${newTypeId} with ${selectedTagIds.length} tags`);
        }
        
        // Reset form
        setActionName('');
        setSelectedIcon('account-check');
        setSelectedTagIds([]);
        setSelectedEntityTypes([]);
        setActionScore(1);
        setActionColor('#666666');
        setDialogVisible(false);
        Alert.alert('Success', 'Action created successfully');
        console.log('Action created successfully');
      }
      
      // Reload interaction types
      await loadInteractionTypes();
    } catch (error) {
      console.error('Error saving action:', error);
      Alert.alert('Error', 'Failed to save action. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Toggle a tag selection
  const toggleTagSelection = (tagId: string) => {
    if (!tagId) return;
    
    setSelectedTagIds(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };
  
  // Toggle an entity type selection
  const toggleEntityTypeSelection = (type: string) => {
    if (!type) return;
    
    setSelectedEntityTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  // Get readable summary of selected tags
  const getSelectedTagsSummary = (): string => {
    if (selectedTagIds.length === 0) {
      return 'Global (All Entities)';
    } else {
      const tagNames = selectedTagIds.map(id => {
        const tag = tags.find(t => t.id === id);
        return tag ? tag.name : 'Unknown';
      });
      return tagNames.join(', ');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Loading interaction types...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Card.Title 
              title="Interaction Types" 
              subtitle="Manage custom interaction types" 
            />
            <Card.Content>
              <Text style={styles.description}>
                Create and manage interaction types that can be used when recording interactions.
                Customize icons, colors, and which entity types they apply to.
              </Text>
              
              <Button
                mode="contained"
                icon="plus"
                onPress={showCreateActionDialog}
                style={styles.button}
                disabled={saving}
              >
                Create New Action
              </Button>
              
              <Divider style={styles.divider} />
              
              <Text style={styles.sectionTitle}>Existing Actions</Text>
              
              {interactionTypes.length === 0 ? (
                <Text style={styles.emptyText}>No interaction types defined yet.</Text>
              ) : (
                <>
                  {interactionTypes.map(action => (
                    <List.Item
                      key={action.id}
                      title={action.name || 'Unnamed Action'}
                      description={() => (
                        <View>
                          <Text>
                            Entity Types: {getEntityTypesString(action.entity_type)}
                          </Text>
                          <Text style={styles.tagText}>
                            Tags: {getActionTagsSummary(action.id)}
                          </Text>
                        </View>
                      )}
                      left={props => <List.Icon {...props} icon={action.icon || 'help-circle'} color={action.color} />}
                      right={props => (
                        <View style={styles.actionButtons}>
                          <IconButton
                            {...props}
                            icon="pencil"
                            onPress={() => handleEditAction(action)}
                            disabled={saving}
                          />
                          <IconButton
                            {...props}
                            icon="delete"
                            onPress={() => handleDeleteAction(action.id)}
                            disabled={saving}
                          />
                        </View>
                      )}
                      onPress={() => !saving && handleEditAction(action)}
                    />
                  ))}
                </>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
      
      {/* Dialog for creating/editing an action */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => !saving && setDialogVisible(false)}>
          <Dialog.Title>{editingActionId ? 'Edit Action' : 'New Action'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              <TextInput
                label="Action Name"
                value={actionName}
                onChangeText={setActionName}
                style={[styles.input, { marginTop: 8 }]}
                mode="outlined"
                disabled={saving}
              />
              
              <Text style={styles.label}>Score Value: {actionScore}</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>0</Text>
                <Slider
                  value={actionScore}
                  onValueChange={(value: number) => setActionScore(value)}
                  minimumValue={0}
                  maximumValue={10}
                  step={1}
                  style={styles.slider}
                />
                <Text style={styles.sliderLabel}>10</Text>
              </View>
              <HelperText type="info">
                Higher scores have more impact on interaction rankings
              </HelperText>
              
              <Text style={styles.label}>Icon:</Text>
              <ScrollView 
                horizontal 
                style={{ marginBottom: 16 }}
                contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
              >
                {iconOptions.map(option => (
                  <TouchableOpacity
                    key={option.icon}
                    style={[
                      styles.iconOption,
                      selectedIcon === option.icon && styles.selectedIconOption
                    ]}
                    onPress={() => setSelectedIcon(option.icon)}
                  >
                    <MaterialCommunityIcons 
                      // @ts-ignore - icon names are valid but TypeScript doesn't recognize them
                      name={option.icon} 
                      size={24} 
                      color={selectedIcon === option.icon ? '#fff' : '#000'} 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <Text style={styles.label}>Entity Types</Text>
              <Text style={styles.helperText}>
                Select which entity types this action applies to. If none are selected, it will apply to all types.
              </Text>
              <View style={styles.checkboxContainer}>
                {Object.values(EntityType).map(type => (
                  <Checkbox.Item
                    key={type}
                    label={type.charAt(0).toUpperCase() + type.slice(1)}
                    status={selectedEntityTypes.includes(type) ? 'checked' : 'unchecked'}
                    onPress={() => !saving && toggleEntityTypeSelection(type)}
                    disabled={saving}
                  />
                ))}
              </View>
              
              <Text style={styles.label}>Associated Tags</Text>
              <Text style={styles.helperText}>
                Associate this action with specific tags. If no tags are selected, the action will be available for all entities.
              </Text>
              
              {loadingActionTags ? (
                <View style={styles.actionLoadingContainer}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>Loading tags...</Text>
                </View>
              ) : (
                <>
                  {selectedTagIds.length > 0 && (
                    <Chip
                      mode="outlined"
                      style={styles.selectedTagsChip}
                    >
                      {getSelectedTagsSummary()}
                    </Chip>
                  )}
                  <View style={styles.tagSelectContainer}>
                    <Checkbox.Item
                      label="Global (All Entities)"
                      status={selectedTagIds.length === 0 ? 'checked' : 'unchecked'}
                      onPress={() => !saving && setSelectedTagIds([])}
                      disabled={saving}
                    />
                    
                    <Divider style={styles.sectionDivider} />
                    <Text style={styles.sectionHeader}>Default Tags</Text>
                    
                    {tags.map(tag => {
                      // Check if this is one of the default tags
                      const isDefaultTag = ['family', 'friend', 'pet', 'book'].includes(tag.name.toLowerCase());
                      
                      // Skip non-default tags - they'll be shown in the next section
                      if (!isDefaultTag) return null;
                      
                      // Customize label to highlight default tags
                      const label = `${tag.name} ${tag.count > 0 ? `(${tag.count} entities)` : '(Default)'}`;
                      
                      return (
                        <Checkbox.Item
                          key={tag.id}
                          label={label}
                          status={selectedTagIds.includes(tag.id) ? 'checked' : 'unchecked'}
                          onPress={() => !saving && toggleTagSelection(tag.id)}
                          disabled={saving}
                        />
                      );
                    })}
                    
                    <Divider style={styles.sectionDivider} />
                    <Text style={styles.sectionHeader}>Custom Tags</Text>
                    
                    {tags.map(tag => {
                      // Check if this is one of the default tags
                      const isDefaultTag = ['family', 'friend', 'pet', 'book'].includes(tag.name.toLowerCase());
                      
                      // Skip default tags - they were shown in the previous section
                      if (isDefaultTag) return null;
                      
                      return (
                        <Checkbox.Item
                          key={tag.id}
                          label={`${tag.name} (${tag.count} entities)`}
                          status={selectedTagIds.includes(tag.id) ? 'checked' : 'unchecked'}
                          onPress={() => !saving && toggleTagSelection(tag.id)}
                          disabled={saving}
                        />
                      );
                    })}
                  </View>
                </>
              )}
              
              {/* Add padding at the bottom to ensure content is scrollable */}
              <View style={styles.dialogBottomPadding} />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => !saving && setDialogVisible(false)} disabled={saving}>Cancel</Button>
            <Button onPress={handleSaveAction} loading={saving} disabled={saving}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  description: {
    marginBottom: 16,
    color: '#666',
  },
  button: {
    marginTop: 16,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  tagText: {
    marginTop: 4,
    color: '#666',
  },
  dialogScrollArea: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  input: {
    marginBottom: 16,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 10,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    width: 20,
    fontSize: 12,
    color: '#666',
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedIconOption: {
    backgroundColor: '#6200ee',
    borderColor: '#6200ee',
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  tagSelectContainer: {
    marginBottom: 16,
  },
  selectedTagsChip: {
    marginBottom: 10,
  },
  actionLoadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  dialogBottomPadding: {
    height: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
  sectionHeader: {
    fontWeight: 'bold',
    marginBottom: 5,
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default InteractionTypesScreen;
