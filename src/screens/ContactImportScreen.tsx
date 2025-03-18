import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Alert, RefreshControl, Platform, Linking } from 'react-native';
import { List, Checkbox, Button, Divider, Snackbar, ActivityIndicator, Text, Chip, Searchbar, IconButton, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Contacts from 'expo-contacts';
import * as IntentLauncher from 'expo-intent-launcher';
import { RootStackParamList } from '../types';
import { contactService } from '../services/ContactService';
import { database, EntityType } from '../database/Database';
import eventEmitter from '../utils/EventEmitter';

type ContactImportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ContactImport'>;

// Helper function to try to extract contactId from encrypted data
const extractContactId = (encryptedData: string | null): string => {
  if (!encryptedData) return '';
  
  try {
    // In a real app, you would decrypt the data properly
    // For this example, we'll just look for a pattern that might be a contact ID
    const match = encryptedData.match(/[A-Za-z0-9-]{10,}/);
    return match ? match[0] : '';
  } catch (e) {
    return '';
  }
};

const ContactImportScreen: React.FC = () => {
  const navigation = useNavigation<ContactImportScreenNavigationProp>();
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [importedContactIds, setImportedContactIds] = useState<Set<string>>(new Set());
  const [showImported, setShowImported] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  // Load contacts when component mounts
  useEffect(() => {
    loadContacts();
    // Load already imported contacts from database
    loadImportedContacts();
  }, []);

  // Load already imported contacts from database
  const loadImportedContacts = async () => {
    try {
      // Query the database for all person entities
      const persons = await database.getAllEntities(EntityType.PERSON);
      
      // Ensure we have a valid array of persons before proceeding
      if (!persons || !Array.isArray(persons)) {
        console.warn('No persons returned from database or invalid data format');
        return;
      }
      
      // Extract the contactId from the encrypted_data if available
      const importedIds = new Set<string>();
      persons.forEach(person => {
        if (person && person.encrypted_data) {
          const contactId = extractContactId(person.encrypted_data);
          if (contactId) {
            importedIds.add(contactId);
          }
        }
      });
      
      setImportedContactIds(importedIds);
    } catch (error) {
      console.error('Error loading imported contacts:', error);
      // Set empty set to avoid undefined
      setImportedContactIds(new Set<string>());
    }
  };

  // Load contacts from device
  const loadContacts = async () => {
    try {
      setLoading(true);
      const hasPermission = await contactService.requestPermission();
      
      if (hasPermission) {
        const deviceContacts = await contactService.getContacts();
        // Sort contacts by name
        deviceContacts.sort((a, b) => {
          const nameA = a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || '';
          const nameB = b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || '';
          return nameA.localeCompare(nameB);
        });
        setContacts(deviceContacts);
      } else {
        Alert.alert(
          'Permission Required',
          'This app needs access to your contacts to import them.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setSnackbarMessage('Error loading contacts');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh contacts
  const handleRefresh = () => {
    setRefreshing(true);
    loadContacts();
    loadImportedContacts();
  };

  // Open contact permissions settings
  const openContactPermissions = async () => {
    try {
      if (Platform.OS === 'ios') {
        // For iOS, we can only direct to app settings
        await Linking.openURL('app-settings:');
      } else if (Platform.OS === 'android') {
        // For Android, we can open the specific permission settings
        const pkg = IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS;
        const data = 'package:com.pimgarden';
        await IntentLauncher.startActivityAsync(pkg, { data });
      }
      
      // Show instructions to the user
      Alert.alert(
        'Contact Permissions',
        'Please enable contact permissions in your device settings, then return to the app and pull down to refresh the contact list.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error opening settings:', error);
      setSnackbarMessage('Could not open settings');
      setSnackbarVisible(true);
    }
  };

  // Run deduplication process
  const runDeduplication = async () => {
    try {
      setDeduplicating(true);
      setSnackbarMessage('Deduplicating contacts...');
      setSnackbarVisible(true);
      
      // Run the deduplication process
      const removedCount = await database.removeDuplicates();
      
      // Reload imported contacts to reflect changes
      await loadImportedContacts();
      
      // Show results
      setSnackbarMessage(`Deduplication complete: ${removedCount} duplicate(s) removed`);
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error during deduplication:', error);
      setSnackbarMessage('Error during deduplication');
      setSnackbarVisible(true);
    } finally {
      setDeduplicating(false);
    }
  };

  // Toggle contact selection
  const toggleContactSelection = (id: string) => {
    const newSelectedContacts = new Set(selectedContacts);
    if (newSelectedContacts.has(id)) {
      newSelectedContacts.delete(id);
    } else {
      newSelectedContacts.add(id);
    }
    setSelectedContacts(newSelectedContacts);
  };

  // Import selected contacts
  const importSelectedContacts = async () => {
    if (selectedContacts.size === 0) {
      setSnackbarMessage('Please select at least one contact');
      setSnackbarVisible(true);
      return;
    }

    try {
      setImporting(true);
      let importedCount = 0;
      let skippedCount = 0;
      const newImportedIds = new Set(importedContactIds);

      for (const contactId of selectedContacts) {
        // Skip if already imported
        if (importedContactIds.has(contactId)) {
          skippedCount++;
          continue;
        }

        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          const result = await contactService.importContact(contact);
          if (result) {
            importedCount++;
            newImportedIds.add(contactId);
          }
        }
      }

      setImportedContactIds(newImportedIds);
      
      let message = `Successfully imported ${importedCount} contacts`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} already imported)`;
      }
      
      // Navigate back to home screen after successful import
      if (importedCount > 0) {
        // Trigger a refresh of the entity list
        eventEmitter.emit('refreshEntities');
        // Reset navigation stack with Home as the only screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        // Only show a snackbar if we're not navigating away
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }
      
      // Clear selection after import
      setSelectedContacts(new Set());
      
    } catch (error) {
      console.error('Error importing contacts:', error);
      setSnackbarMessage('Error importing contacts');
      setSnackbarVisible(true);
    } finally {
      setImporting(false);
    }
  };

  // Filter and search contacts
  const filteredContacts = contacts
    .filter(contact => {
      // Filter by import status if needed
      if (!showImported && importedContactIds.has(contact.id || '')) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const name = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      
      return true;
    });

  // Render contact item
  const renderContactItem = ({ item }: { item: Contacts.Contact }) => {
    const contactId = item.id || '';
    const contactName = item.name || 
                      `${item.firstName || ''} ${item.lastName || ''}`.trim() || 
                      'Unknown Contact';
    
    const contactDetails = item.phoneNumbers && item.phoneNumbers.length > 0 
      ? item.phoneNumbers[0].number 
      : (item.emails && item.emails.length > 0 ? item.emails[0].email : '');
    
    const isImported = importedContactIds.has(contactId);
    
    return (
      <List.Item
        title={contactName}
        description={contactDetails || ''}
        left={props => (
          <Checkbox
            status={selectedContacts.has(contactId) ? 'checked' : 'unchecked'}
            onPress={() => toggleContactSelection(contactId)}
          />
        )}
        onPress={() => toggleContactSelection(contactId)}
        right={props => 
          isImported ? (
            <List.Icon {...props} icon="check-circle" color="#4CAF50" />
          ) : null
        }
        style={isImported ? styles.importedItem : undefined}
      />
    );
  };

  // Get all contacts for "Select All" functionality
  const getSelectableContacts = () => {
    return filteredContacts
      .map(contact => contact.id || '')
      .filter(id => id !== '');
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
        </View>
      ) : (
        <>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search contacts"
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
            />
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={24}
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item 
                onPress={() => {
                  setMenuVisible(false);
                  openContactPermissions();
                }} 
                title="Add Contact Permission" 
                leadingIcon="account-plus"
              />
              <Menu.Item 
                onPress={() => {
                  setMenuVisible(false);
                  runDeduplication();
                }} 
                title="Remove Duplicates" 
                disabled={deduplicating}
                leadingIcon="content-duplicate"
              />
            </Menu>
          </View>
          
          <View style={styles.headerContainer}>
            <Button 
              mode="contained" 
              onPress={() => setSelectedContacts(new Set(getSelectableContacts()))}
              style={styles.selectButton}
              disabled={importing || filteredContacts.length === 0}
            >
              Select All
            </Button>
            <Button 
              mode="outlined" 
              onPress={() => setSelectedContacts(new Set())}
              style={styles.selectButton}
              disabled={importing || selectedContacts.size === 0}
            >
              Clear
            </Button>
          </View>
          
          <Divider />
          
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {importedContactIds.size} contacts imported • {contacts.length - importedContactIds.size} remaining
            </Text>
            <Chip 
              selected={showImported} 
              onPress={() => setShowImported(!showImported)}
              style={styles.filterChip}
            >
              {showImported ? "Hide Imported" : "Show All"}
            </Chip>
          </View>
          
          <Divider />
          
          <FlatList
            data={filteredContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            ItemSeparatorComponent={() => <Divider />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? "No contacts match your search" 
                    : (showImported 
                      ? "No contacts found" 
                      : "No new contacts to import")}
                </Text>
              </View>
            }
          />
          
          <View style={styles.footerContainer}>
            <View style={styles.infoContainer}>
              <MaterialCommunityIcons name="information" size={20} color="#555" />
              <Text style={styles.infoText}>
                All contact fields will be imported, including phone numbers, email addresses, and physical addresses.
              </Text>
            </View>
            
            <Button 
              mode="contained" 
              onPress={importSelectedContacts}
              loading={importing}
              disabled={importing || deduplicating || selectedContacts.size === 0}
              style={styles.importButton}
            >
              Import Selected ({selectedContacts.size})
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => {
                // Trigger a refresh of the entity list
                eventEmitter.emit('refreshEntities');
                // Reset navigation stack with Home as the only screen
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }}
              style={styles.doneButton}
              disabled={importing || deduplicating}
            >
              Done
            </Button>
          </View>
        </>
      )}
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 8,
  },
  searchBar: {
    flex: 1,
    elevation: 0,
    marginRight: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    padding: 8,
    justifyContent: 'space-between',
  },
  selectButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  importButton: {
    backgroundColor: '#6200ee',
    marginBottom: 8,
  },
  doneButton: {
    borderColor: '#6200ee',
  },
  importedItem: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  statsContainer: {
    padding: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  filterChip: {
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
});

export default ContactImportScreen; 