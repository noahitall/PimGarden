import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Chip, Divider, List, IconButton, SegmentedButtons, Dialog, Portal, RadioButton, Menu, Checkbox } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { database, EntityType, InteractionType } from '../database/Database';

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
      setInteractionTypes(types);
    } catch (error) {
      console.error('Error loading interaction types:', error);
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
      // Determine entity type value (null if all types selected or none selected)
      const entityType = selectedEntityTypes.length === 0 || 
                        selectedEntityTypes.length === Object.values(EntityType).length 
                        ? null 
                        : selectedEntityTypes.length === 1 
                          ? selectedEntityTypes[0] 
                          : JSON.stringify(selectedEntityTypes);
      
      if (editingActionId) {
        // Update existing action
        await database.associateInteractionTypeWithEntityType(editingActionId, entityType);
        await database.associateInteractionTypeWithMultipleTags(editingActionId, selectedTagIds);
        
        // Reset form
        setActionName('');
        setSelectedIcon('account-check');
        setSelectedTagIds([]);
        setSelectedEntityTypes([]);
        setEditingActionId(null);
        setDialogVisible(false);
        Alert.alert('Success', 'Action updated');
      } else {
        // Create new action with no initial tag (we'll add them after)
        const newTypeId = await database.addInteractionType(actionName, selectedIcon, null, entityType);
        
        // Associate with selected tags
        if (selectedTagIds.length > 0) {
          await database.associateInteractionTypeWithMultipleTags(newTypeId, selectedTagIds);
        }
        
        // Reset form
        setActionName('');
        setSelectedIcon('account-check');
        setSelectedTagIds([]);
        setSelectedEntityTypes([]);
        setDialogVisible(false);
        Alert.alert('Success', 'Action created');
      }
      
      // Reload interaction types
      loadInteractionTypes();
    } catch (error) {
      console.error('Error saving action:', error);
      Alert.alert('Error', 'Failed to save action');
    }
  };
  
  // Handle editing an action
  const handleEditAction = (action: InteractionType) => {
    setActionName(action.name);
    setSelectedIcon(action.icon);
    
    // Parse entity_type if it's a JSON string
    if (action.entity_type) {
      try {
        const parsedTypes = JSON.parse(action.entity_type);
        if (Array.isArray(parsedTypes)) {
          setSelectedEntityTypes(parsedTypes);
        } else {
          setSelectedEntityTypes([action.entity_type]);
        }
      } catch (e) {
        // If not JSON, it's a single type
        setSelectedEntityTypes([action.entity_type]);
      }
    } else {
      setSelectedEntityTypes([]);
    }
    
    // Load tags associated with this action
    loadInteractionTypeTags(action.id);
    
    setEditingActionId(action.id);
    setDialogVisible(true);
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
    setSelectedTagIds(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };
  
  // Toggle an entity type selection
  const toggleEntityTypeSelection = (type: string) => {
    setSelectedEntityTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
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
            >
              Create New Action
            </Button>
            
            <Divider style={styles.divider} />
            
            <Text style={styles.listTitle}>Existing Actions</Text>
            
            {interactionTypes.length === 0 ? (
              <Text style={styles.emptyText}>No actions defined yet</Text>
            ) : (
              <>
                {interactionTypes.map(action => {
                  // Find tag name if action has a tag_id
                  const tagName = action.tag_id 
                    ? tags.find(t => t.id === action.tag_id)?.name || 'Unknown Tag'
                    : 'Global (All Entities)';
                    
                  return (
                    <List.Item
                      key={action.id}
                      title={action.name}
                      description={`Tag: ${tagName}`}
                      left={props => <List.Icon {...props} icon={action.icon} />}
                      right={props => (
                        <View style={styles.actionButtons}>
                          <IconButton
                            {...props}
                            icon="pencil"
                            onPress={() => handleEditAction(action)}
                          />
                          <IconButton
                            {...props}
                            icon="delete"
                            onPress={() => handleDeleteAction(action.id)}
                          />
                        </View>
                      )}
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
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{editingActionId ? 'Edit Action' : 'New Action'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Action Name"
              value={actionName}
              onChangeText={setActionName}
              style={[styles.input, { marginTop: 8 }]}
              mode="outlined"
            />
            
            <Text style={styles.label}>Action Icon</Text>
            <View style={styles.iconSelector}>
              <List.Icon icon={selectedIcon} />
              <Button 
                mode="outlined" 
                onPress={() => setIconMenuVisible(true)}
                style={{ flex: 1 }}
              >
                {iconOptions.find(i => i.icon === selectedIcon)?.label || 'Select Icon'}
              </Button>
              
              <Menu
                visible={iconMenuVisible}
                onDismiss={() => setIconMenuVisible(false)}
                anchor={{ x: 0, y: 0 }}
                style={styles.iconMenu}
              >
                <ScrollView style={{ maxHeight: 300 }}>
                  {iconOptions.map(option => (
                    <Menu.Item
                      key={option.icon}
                      onPress={() => {
                        setSelectedIcon(option.icon);
                        setIconMenuVisible(false);
                      }}
                      title={option.label}
                      leadingIcon={option.icon}
                    />
                  ))}
                </ScrollView>
              </Menu>
            </View>
            
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
                  onPress={() => toggleEntityTypeSelection(type)}
                />
              ))}
            </View>
            
            <Text style={styles.label}>Associated Tags</Text>
            <Text style={styles.helperText}>
              Select which tags this action is associated with. If none are selected, it will be available for all entities.
            </Text>
            <ScrollView style={styles.tagScrollView}>
              <Checkbox.Item
                label="Global (All Entities)"
                status={selectedTagIds.length === 0 ? 'checked' : 'unchecked'}
                onPress={() => setSelectedTagIds([])}
              />
              
              {tags.map(tag => (
                <Checkbox.Item
                  key={tag.id}
                  label={`${tag.name} (${tag.count} entities)`}
                  status={selectedTagIds.includes(tag.id) ? 'checked' : 'unchecked'}
                  onPress={() => toggleTagSelection(tag.id)}
                />
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveAction}>Save</Button>
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
  iconSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconMenu: {
    marginTop: 40,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  tagScrollView: {
    maxHeight: 200,
  },
});

export default EditEntityScreen; 