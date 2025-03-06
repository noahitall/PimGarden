import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Chip, Divider, List, IconButton, SegmentedButtons, Dialog, Portal, RadioButton, Menu, Checkbox, HelperText } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { database, EntityType, InteractionType, Tag } from '../database/Database';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';

type EditEntityScreenRouteProp = RouteProp<RootStackParamList, 'EditEntity'>;
type EditEntityScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditEntity'>;

type TabValue = 'entity' | 'action';

// Available icon options for interaction types
const iconOptions = [
  { icon: 'account-check', label: 'Account Check' },
  { icon: 'message-text', label: 'Message' },
  { icon: 'phone', label: 'Phone' },
  { icon: 'account-group', label: 'Group' },
  { icon: 'email', label: 'Email' },
  { icon: 'coffee', label: 'Coffee' },
  { icon: 'cake', label: 'Birthday' },
  { icon: 'home', label: 'Home' },
  { icon: 'chat', label: 'Chat' },
  { icon: 'gift', label: 'Gift' },
  { icon: 'calendar', label: 'Calendar' },
  { icon: 'presentation', label: 'Presentation' },
  { icon: 'clipboard-text', label: 'Notes' },
  { icon: 'phone-in-talk', label: 'Phone Call' },
  { icon: 'arrow-right-circle', label: 'Follow-up' },
  { icon: 'file-document', label: 'Document' },
  { icon: 'calendar-check', label: 'Appointment' },
  { icon: 'stethoscope', label: 'Medical' },
  { icon: 'book-open-page-variant', label: 'Book' },
  { icon: 'forum', label: 'Discussion' },
  { icon: 'run', label: 'Activity' },
  { icon: 'star', label: 'Star' }
];

const EditEntityScreen: React.FC = () => {
  const route = useRoute<EditEntityScreenRouteProp>();
  const navigation = useNavigation<EditEntityScreenNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>('entity');
  
  // Entity form state
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [type, setType] = useState<EntityType>(route.params?.type || EntityType.PERSON);
  
  // Action (Interaction Type) form state
  const [interactionTypes, setInteractionTypes] = useState<InteractionType[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; count: number }[]>([]);
  const [actionName, setActionName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('account-check');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const [iconMenuVisible, setIconMenuVisible] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionScore, setActionScore] = useState<number>(1);
  const [actionColor, setActionColor] = useState<string>('#666666');
  
  // State to track loaded tags for each action
  const [actionTagsMap, setActionTagsMap] = useState<Record<string, Tag[]>>({});
  const [loadingActionTags, setLoadingActionTags] = useState(false);
  
  // Determine if we're editing or creating an entity
  const isEditing = !!route.params?.id;
  
  // Load entity data if editing
  useEffect(() => {
    if (isEditing) {
      loadEntityData();
    }
  }, [isEditing]);
  
  // Load interaction types and tags
  useEffect(() => {
    loadInteractionTypes();
    loadTags();
  }, []);
  
  // Load entity data from database
  const loadEntityData = async () => {
    if (!route.params?.id) return;
    
    try {
      setLoading(true);
      const entity = await database.getEntityById(route.params.id);
      
      if (entity) {
        setName(entity.name);
        setDetails(entity.details || '');
        setType(entity.type as EntityType);
      }
    } catch (error) {
      console.error('Error loading entity:', error);
      Alert.alert('Error', 'Failed to load entity data');
    } finally {
      setLoading(false);
    }
  };
  
  // Load interaction types
  const loadInteractionTypes = async () => {
    try {
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
      setLoadingActionTags(false);
    }
  };
  
  // Load all tags
  const loadTags = async () => {
    try {
      const allTags = await database.getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };
  
  // Load interaction type tags when editing
  const loadInteractionTypeTags = async (typeId: string) => {
    try {
      const typeTags = await database.getInteractionTypeTags(typeId);
      setSelectedTagIds(typeTags.map(tag => tag.id));
    } catch (error) {
      console.error('Error loading interaction type tags:', error);
    }
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
  
  // Save entity
  const saveEntity = async () => {
    // Validate form
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    
    try {
      setSaving(true);
      
      if (isEditing && route.params?.id) {
        // Update existing entity
        await database.updateEntity(route.params.id, {
          name,
          details,
        });
      } else {
        // Create new entity
        console.log('Creating entity with type:', type);
        await database.createEntity(
          name,
          type,
          details
        );
      }
      
      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error saving entity:', error);
      Alert.alert('Error', 'Failed to save entity');
    } finally {
      setSaving(false);
    }
  };
  
  // Delete entity
  const deleteEntity = async () => {
    if (!isEditing || !route.params?.id) return;
    
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await database.deleteEntity(route.params.id!);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'Failed to delete');
              setSaving(false);
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
  
  // Show action creation dialog
  const showCreateActionDialog = () => {
    setActionName('');
    setSelectedIcon('account-check');
    setSelectedTagIds([]);
    setSelectedEntityTypes([]);
    setEditingActionId(null);
    setDialogVisible(true);
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
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <SegmentedButtons
        value={activeTab}
        onValueChange={value => setActiveTab(value as TabValue)}
        buttons={[
          { value: 'entity', label: 'Entity' },
          { value: 'action', label: 'Action' }
        ]}
        style={styles.tabs}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'entity' && (
          <View style={styles.formContainer}>
            {/* Entity Type Selection (only for new entities) */}
            {!isEditing && (
              <View style={styles.typeContainer}>
                <View style={styles.chipContainer}>
                  <Chip 
                    selected={type === EntityType.PERSON} 
                    onPress={() => {
                      console.log('Selected type:', EntityType.PERSON);
                      setType(EntityType.PERSON);
                    }}
                    style={styles.chip}
                  >
                    Person
                  </Chip>
                  <Chip 
                    selected={type === EntityType.GROUP} 
                    onPress={() => {
                      console.log('Selected type:', EntityType.GROUP);
                      setType(EntityType.GROUP);
                    }}
                    style={styles.chip}
                  >
                    Group
                  </Chip>
                  <Chip 
                    selected={type === EntityType.TOPIC} 
                    onPress={() => {
                      console.log('Selected type:', EntityType.TOPIC);
                      setType(EntityType.TOPIC);
                    }}
                    style={styles.chip}
                  >
                    Topic
                  </Chip>
                </View>
                
                {/* Import Contacts button - only show for new entities of type PERSON */}
                {type === EntityType.PERSON && (
                  <Button
                    mode="outlined"
                    icon="import"
                    onPress={() => navigation.navigate('ContactImport')}
                    style={styles.importButton}
                  >
                    Import Contacts
                  </Button>
                )}
              </View>
            )}
            
            {/* Name Field */}
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              mode="outlined"
            />
            
            {/* Details Field */}
            <TextInput
              label="Details"
              value={details}
              onChangeText={setDetails}
              style={styles.input}
              mode="outlined"
              multiline
              numberOfLines={5}
            />
            
            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={saveEntity}
                loading={saving}
                disabled={saving}
                style={styles.saveButton}
              >
                {isEditing ? 'Update' : 'Create'}
              </Button>
              
              {isEditing && (
                <Button
                  mode="outlined"
                  onPress={deleteEntity}
                  disabled={saving}
                  style={styles.deleteButton}
                  textColor="#f44336"
                >
                  Delete
                </Button>
              )}
            </View>
          </View>
        )}
        
        {activeTab === 'action' && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Interaction Types</Text>
            <Text style={styles.sectionSubtitle}>
              Create and manage interaction types that can be used when recording interactions.
              Assign them to tags to make them appear only for entities with those tags.
            </Text>
            
            <Button
              mode="contained"
              icon="plus"
              onPress={showCreateActionDialog}
              style={styles.createButton}
              disabled={saving || loadingActionTags}
            >
              Create New Action
            </Button>
            
            <Divider style={styles.divider} />
            
            <Text style={styles.listTitle}>Existing Actions</Text>
            
            {loadingActionTags ? (
              <View style={styles.actionLoadingContainer}>
                <ActivityIndicator size="small" color="#6200ee" />
                <Text style={styles.loadingText}>Loading actions...</Text>
              </View>
            ) : interactionTypes.length === 0 ? (
              <Text style={styles.emptyText}>No actions defined yet</Text>
            ) : (
              <>
                {interactionTypes.map(action => {
                  if (!action || !action.id) return null;
                  
                  return (
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
                      left={props => <List.Icon {...props} icon={action.icon || 'help-circle'} />}
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
                      style={styles.actionItem}
                      disabled={saving}
                    />
                  );
                })}
              </>
            )}
          </View>
        )}
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
                    
                    {tags.map(tag => (
                      <Checkbox.Item
                        key={tag.id}
                        label={`${tag.name} (${tag.count} entities)`}
                        status={selectedTagIds.includes(tag.id) ? 'checked' : 'unchecked'}
                        onPress={() => !saving && toggleTagSelection(tag.id)}
                        disabled={saving}
                      />
                    ))}
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    padding: 16,
  },
  typeContainer: {
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  chip: {
    margin: 4,
  },
  importButton: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: '#f44336',
  },
  tabs: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  createButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  iconMenu: {
    marginTop: 40,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  tagText: {
    marginTop: 4,
  },
  actionItem: {
    backgroundColor: '#fff',
    marginVertical: 4,
    borderRadius: 8,
  },
  selectedTagsChip: {
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  tagSelectContainer: {
    marginBottom: 8,
  },
  dialogScrollArea: {
    paddingHorizontal: 24,
    maxHeight: '80%', // Limit height to 80% of screen to ensure buttons are visible
  },
  dialogBottomPadding: {
    height: 20,
  },
  actionLoadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    width: 20,
    textAlign: 'center',
  },
  iconOption: {
    padding: 8,
  },
  selectedIconOption: {
    backgroundColor: '#666',
  },
});

export default EditEntityScreen; 