import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, Portal, Modal, Button, Menu, List } from 'react-native-paper';
// @ts-ignore
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { InteractionType } from '../database/Database';
import SafeDateTimePicker from './SafeDateTimePicker';

interface InteractionLog {
  id: string;
  timestamp: number;
  formattedDate: string;
  type: string;
}

interface EditInteractionModalProps {
  visible: boolean;
  onDismiss: () => void;
  interaction: InteractionLog | null;
  interactionTypes: InteractionType[];
  onSave: (interactionId: string, updates: { timestamp: number; type: string }) => Promise<void>;
}

const EditInteractionModal = ({
  visible,
  onDismiss,
  interaction,
  interactionTypes,
  onSave,
}: EditInteractionModalProps) => {
  // Only initialize state when we have an interaction
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    interaction ? new Date(interaction.timestamp) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(interaction?.type || '');
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // Update state when interaction changes
  useEffect(() => {
    if (interaction) {
      setSelectedDate(new Date(interaction.timestamp));
      setSelectedType(interaction.type);
    }
  }, [interaction]);

  // Can't render anything meaningful without an interaction
  if (!interaction) {
    return null;
  }

  const handleSave = async () => {
    if (selectedDate && selectedType && interaction) {
      await onSave(interaction.id, {
        timestamp: selectedDate.getTime(),
        type: selectedType,
      });
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Interaction</Text>
          
          <Pressable 
            style={styles.dateSelector} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.fieldLabel}>Date & Time:</Text>
            <View style={styles.dateDisplay}>
              <Text>{selectedDate ? formatDate(selectedDate) : 'Select date'}</Text>
              <MaterialCommunityIcons name="calendar" size={20} color="#6200ee" />
            </View>
          </Pressable>
          
          {showDatePicker && (
            <SafeDateTimePicker
              value={selectedDate || new Date()}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setSelectedDate(selectedDate);
              }}
              onClose={() => setShowDatePicker(false)}
            />
          )}
          
          <View style={styles.typeSelector}>
            <Text style={styles.fieldLabel}>Interaction Type:</Text>
            <Menu
              visible={typeMenuVisible}
              onDismiss={() => setTypeMenuVisible(false)}
              anchor={
                <Pressable 
                  style={styles.typeDisplay} 
                  onPress={() => setTypeMenuVisible(true)}
                >
                  <Text>{selectedType || 'Select type'}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#6200ee" />
                </Pressable>
              }
            >
              {interactionTypes.map((type) => (
                <Menu.Item
                  key={type.id}
                  onPress={() => {
                    setSelectedType(type.name);
                    setTypeMenuVisible(false);
                  }}
                  title={type.name}
                  leadingIcon={props => <List.Icon {...props} icon={type.icon} />}
                />
              ))}
            </Menu>
          </View>
          
          <View style={styles.modalButtons}>
            <Button mode="outlined" onPress={onDismiss} style={styles.modalButton}>
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleSave} 
              style={styles.modalButton}
              disabled={!selectedDate || !selectedType}
            >
              Save
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalContent: {
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateSelector: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
  },
  typeSelector: {
    marginBottom: 20,
  },
  typeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default EditInteractionModal; 