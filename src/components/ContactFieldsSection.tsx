import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Linking, 
  Platform, 
  ScrollView, 
  Alert 
} from 'react-native';
import { 
  Text, 
  Card, 
  IconButton, 
  Button, 
  List, 
  Dialog, 
  Portal, 
  TextInput, 
  Menu,
  Divider
} from 'react-native-paper';
import { PhoneNumber, EmailAddress, PhysicalAddress } from '../types';
import { database } from '../database/Database';

// Contact field label options
const PHONE_LABELS = ['Mobile', 'Home', 'Work', 'Other'];
const EMAIL_LABELS = ['Personal', 'Work', 'Other'];
const ADDRESS_LABELS = ['Home', 'Work', 'Other'];

interface ContactFieldsSectionProps {
  entityId: string;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
  physicalAddresses: PhysicalAddress[];
  onUpdate: () => void;
}

const ContactFieldsSection: React.FC<ContactFieldsSectionProps> = ({
  entityId,
  phoneNumbers,
  emailAddresses,
  physicalAddresses,
  onUpdate
}) => {
  // State for managing dialogs
  const [isPhoneDialogVisible, setPhoneDialogVisible] = useState(false);
  const [isEmailDialogVisible, setEmailDialogVisible] = useState(false);
  const [isAddressDialogVisible, setAddressDialogVisible] = useState(false);
  
  // State for new contact fields
  const [newPhone, setNewPhone] = useState({ value: '', label: 'Mobile', isPrimary: false });
  const [newEmail, setNewEmail] = useState({ value: '', label: 'Personal', isPrimary: false });
  const [newAddress, setNewAddress] = useState({ 
    street: '', 
    city: '', 
    state: '', 
    postalCode: '', 
    country: '', 
    label: 'Home', 
    isPrimary: false 
  });
  
  // Label menu state
  const [isPhoneLabelMenuVisible, setPhoneLabelMenuVisible] = useState(false);
  const [isEmailLabelMenuVisible, setEmailLabelMenuVisible] = useState(false);
  const [isAddressLabelMenuVisible, setAddressLabelMenuVisible] = useState(false);

  // Phone related functions
  const handleCallPhone = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleTextPhone = (phoneNumber: string) => {
    if (Platform.OS === 'ios') {
      Linking.openURL(`sms:${phoneNumber}`);
    } else {
      Linking.openURL(`sms:${phoneNumber}`);
    }
  };

  const handleAddPhone = async () => {
    if (!newPhone.value) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      await database.addPhoneNumber(entityId, newPhone);
      setNewPhone({ value: '', label: 'Mobile', isPrimary: false });
      setPhoneDialogVisible(false);
      onUpdate();
    } catch (error) {
      console.error('Error adding phone number:', error);
      Alert.alert('Error', 'Failed to add phone number');
    }
  };

  const handleDeletePhone = async (phoneId: string) => {
    try {
      await database.removeContactField(entityId, 'phoneNumber', phoneId);
      onUpdate();
    } catch (error) {
      console.error('Error removing phone number:', error);
      Alert.alert('Error', 'Failed to remove phone number');
    }
  };

  // Email related functions
  const handleEmailPress = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleAddEmail = async () => {
    if (!newEmail.value) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      await database.addEmailAddress(entityId, newEmail);
      setNewEmail({ value: '', label: 'Personal', isPrimary: false });
      setEmailDialogVisible(false);
      onUpdate();
    } catch (error) {
      console.error('Error adding email address:', error);
      Alert.alert('Error', 'Failed to add email address');
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    try {
      await database.removeContactField(entityId, 'emailAddress', emailId);
      onUpdate();
    } catch (error) {
      console.error('Error removing email address:', error);
      Alert.alert('Error', 'Failed to remove email address');
    }
  };

  // Address related functions
  const handleAddressPress = (address: PhysicalAddress) => {
    const formattedAddress = address.formattedAddress || 
      [address.street, address.city, address.state, address.postalCode, address.country]
        .filter(Boolean)
        .join(', ');
        
    const encodedAddress = encodeURIComponent(formattedAddress);
    
    // Open in maps app
    if (Platform.OS === 'ios') {
      Linking.openURL(`http://maps.apple.com/?q=${encodedAddress}`);
    } else {
      Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.street) {
      Alert.alert('Error', 'Please enter a street address');
      return;
    }

    try {
      await database.addPhysicalAddress(entityId, newAddress);
      setNewAddress({ 
        street: '', 
        city: '', 
        state: '', 
        postalCode: '', 
        country: '', 
        label: 'Home', 
        isPrimary: false 
      });
      setAddressDialogVisible(false);
      onUpdate();
    } catch (error) {
      console.error('Error adding address:', error);
      Alert.alert('Error', 'Failed to add address');
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await database.removeContactField(entityId, 'physicalAddress', addressId);
      onUpdate();
    } catch (error) {
      console.error('Error removing address:', error);
      Alert.alert('Error', 'Failed to remove address');
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Title title="Contact Information" />
      <Card.Content>
        {/* Phone Numbers Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>Phone Numbers</Text>
            <Button 
              mode="text" 
              onPress={() => setPhoneDialogVisible(true)}
              icon="plus"
              compact
            >
              Add
            </Button>
          </View>
          
          {phoneNumbers.length === 0 ? (
            <Text style={styles.emptyText}>No phone numbers</Text>
          ) : (
            <View>
              {phoneNumbers.map(phone => (
                <View key={phone.id} style={styles.contactItemContainer}>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemLabel}>{phone.label}</Text>
                    <Text style={styles.contactItemValue}>{phone.value}</Text>
                    {phone.isPrimary && <Text style={styles.primaryTag}>Primary</Text>}
                  </View>
                  <View style={styles.contactItemActions}>
                    <IconButton 
                      icon="phone" 
                      size={20} 
                      onPress={() => handleCallPhone(phone.value)} 
                    />
                    <IconButton 
                      icon="message-text" 
                      size={20} 
                      onPress={() => handleTextPhone(phone.value)} 
                    />
                    <IconButton 
                      icon="delete" 
                      size={20} 
                      onPress={() => handleDeletePhone(phone.id)} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <Divider style={styles.divider} />
        
        {/* Email Addresses Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>Email Addresses</Text>
            <Button 
              mode="text" 
              onPress={() => setEmailDialogVisible(true)}
              icon="plus"
              compact
            >
              Add
            </Button>
          </View>
          
          {emailAddresses.length === 0 ? (
            <Text style={styles.emptyText}>No email addresses</Text>
          ) : (
            <View>
              {emailAddresses.map(email => (
                <View key={email.id} style={styles.contactItemContainer}>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemLabel}>{email.label}</Text>
                    <Text style={styles.contactItemValue}>{email.value}</Text>
                    {email.isPrimary && <Text style={styles.primaryTag}>Primary</Text>}
                  </View>
                  <View style={styles.contactItemActions}>
                    <IconButton 
                      icon="email" 
                      size={20} 
                      onPress={() => handleEmailPress(email.value)} 
                    />
                    <IconButton 
                      icon="delete" 
                      size={20} 
                      onPress={() => handleDeleteEmail(email.id)} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <Divider style={styles.divider} />
        
        {/* Physical Addresses Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>Addresses</Text>
            <Button 
              mode="text" 
              onPress={() => setAddressDialogVisible(true)}
              icon="plus"
              compact
            >
              Add
            </Button>
          </View>
          
          {physicalAddresses.length === 0 ? (
            <Text style={styles.emptyText}>No addresses</Text>
          ) : (
            <View>
              {physicalAddresses.map(address => (
                <View key={address.id} style={styles.contactItemContainer}>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemLabel}>{address.label}</Text>
                    <Text style={styles.contactItemValue}>
                      {address.formattedAddress || 
                        [address.street, address.city, address.state, address.postalCode, address.country]
                          .filter(Boolean)
                          .join(', ')}
                    </Text>
                    {address.isPrimary && <Text style={styles.primaryTag}>Primary</Text>}
                  </View>
                  <View style={styles.contactItemActions}>
                    <IconButton 
                      icon="map-marker" 
                      size={20} 
                      onPress={() => handleAddressPress(address)} 
                    />
                    <IconButton 
                      icon="delete" 
                      size={20} 
                      onPress={() => handleDeleteAddress(address.id)} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </Card.Content>
      
      {/* Add Phone Dialog */}
      <Portal>
        <Dialog visible={isPhoneDialogVisible} onDismiss={() => setPhoneDialogVisible(false)}>
          <Dialog.Title>Add Phone Number</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Phone Number"
              value={newPhone.value}
              onChangeText={(value) => setNewPhone({...newPhone, value})}
              keyboardType="phone-pad"
              style={styles.dialogInput}
            />
            
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Label:</Text>
              <Menu
                visible={isPhoneLabelMenuVisible}
                onDismiss={() => setPhoneLabelMenuVisible(false)}
                anchor={
                  <Button 
                    mode="outlined" 
                    onPress={() => setPhoneLabelMenuVisible(true)}
                    style={styles.labelButton}
                  >
                    {newPhone.label} <IconButton icon="menu-down" size={16} />
                  </Button>
                }
              >
                {PHONE_LABELS.map(label => (
                  <Menu.Item 
                    key={label}
                    onPress={() => {
                      setNewPhone({...newPhone, label});
                      setPhoneLabelMenuVisible(false);
                    }} 
                    title={label} 
                  />
                ))}
              </Menu>
            </View>
            
            <View style={styles.switchContainer}>
              <Text>Set as primary number</Text>
              <IconButton
                icon={newPhone.isPrimary ? "checkbox-marked" : "checkbox-blank-outline"}
                onPress={() => setNewPhone({...newPhone, isPrimary: !newPhone.isPrimary})}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPhoneDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddPhone}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Add Email Dialog */}
      <Portal>
        <Dialog visible={isEmailDialogVisible} onDismiss={() => setEmailDialogVisible(false)}>
          <Dialog.Title>Add Email Address</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Email Address"
              value={newEmail.value}
              onChangeText={(value) => setNewEmail({...newEmail, value})}
              keyboardType="email-address"
              style={styles.dialogInput}
            />
            
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>Label:</Text>
              <Menu
                visible={isEmailLabelMenuVisible}
                onDismiss={() => setEmailLabelMenuVisible(false)}
                anchor={
                  <Button 
                    mode="outlined" 
                    onPress={() => setEmailLabelMenuVisible(true)}
                    style={styles.labelButton}
                  >
                    {newEmail.label} <IconButton icon="menu-down" size={16} />
                  </Button>
                }
              >
                {EMAIL_LABELS.map(label => (
                  <Menu.Item 
                    key={label}
                    onPress={() => {
                      setNewEmail({...newEmail, label});
                      setEmailLabelMenuVisible(false);
                    }} 
                    title={label} 
                  />
                ))}
              </Menu>
            </View>
            
            <View style={styles.switchContainer}>
              <Text>Set as primary email</Text>
              <IconButton
                icon={newEmail.isPrimary ? "checkbox-marked" : "checkbox-blank-outline"}
                onPress={() => setNewEmail({...newEmail, isPrimary: !newEmail.isPrimary})}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEmailDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddEmail}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Add Address Dialog */}
      <Portal>
        <Dialog visible={isAddressDialogVisible} onDismiss={() => setAddressDialogVisible(false)}>
          <Dialog.Title>Add Address</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogScrollContent}>
              <TextInput
                label="Street"
                value={newAddress.street}
                onChangeText={(street) => setNewAddress({...newAddress, street})}
                style={styles.dialogInput}
              />
              
              <TextInput
                label="City"
                value={newAddress.city}
                onChangeText={(city) => setNewAddress({...newAddress, city})}
                style={styles.dialogInput}
              />
              
              <TextInput
                label="State/Province"
                value={newAddress.state}
                onChangeText={(state) => setNewAddress({...newAddress, state})}
                style={styles.dialogInput}
              />
              
              <TextInput
                label="Postal Code"
                value={newAddress.postalCode}
                onChangeText={(postalCode) => setNewAddress({...newAddress, postalCode})}
                style={styles.dialogInput}
              />
              
              <TextInput
                label="Country"
                value={newAddress.country}
                onChangeText={(country) => setNewAddress({...newAddress, country})}
                style={styles.dialogInput}
              />
              
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Label:</Text>
                <Menu
                  visible={isAddressLabelMenuVisible}
                  onDismiss={() => setAddressLabelMenuVisible(false)}
                  anchor={
                    <Button 
                      mode="outlined" 
                      onPress={() => setAddressLabelMenuVisible(true)}
                      style={styles.labelButton}
                    >
                      {newAddress.label} <IconButton icon="menu-down" size={16} />
                    </Button>
                  }
                >
                  {ADDRESS_LABELS.map(label => (
                    <Menu.Item 
                      key={label}
                      onPress={() => {
                        setNewAddress({...newAddress, label});
                        setAddressLabelMenuVisible(false);
                      }} 
                      title={label} 
                    />
                  ))}
                </Menu>
              </View>
              
              <View style={styles.switchContainer}>
                <Text>Set as primary address</Text>
                <IconButton
                  icon={newAddress.isPrimary ? "checkbox-marked" : "checkbox-blank-outline"}
                  onPress={() => setNewAddress({...newAddress, isPrimary: !newAddress.isPrimary})}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddressDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddAddress}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#757575',
    marginVertical: 8,
  },
  contactItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  contactItemInfo: {
    flex: 1,
  },
  contactItemLabel: {
    fontSize: 12,
    color: '#757575',
  },
  contactItemValue: {
    fontSize: 16,
  },
  contactItemActions: {
    flexDirection: 'row',
  },
  primaryTag: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  dialogInput: {
    marginBottom: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelText: {
    marginRight: 8,
  },
  labelButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dialogScrollContent: {
    paddingVertical: 16,
  },
});

export default ContactFieldsSection; 