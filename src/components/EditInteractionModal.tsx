import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Modal, Pressable, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, BackHandler, ScrollView } from 'react-native';
import { Text, TextInput, Button, List, Menu } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
// @ts-ignore
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// The interface for the component props
interface EditInteractionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updates: { timestamp: number; type: string; notes?: string | null }) => void;
  interaction: {
    id: string;
    timestamp: number;
    type: string;
    notes?: string | null;
  };
  supportedInteractionTypes: string[];
}

const EditInteractionModal: React.FC<EditInteractionModalProps> = ({
  visible,
  onClose,
  onSave,
  interaction,
  supportedInteractionTypes,
}) => {
  // State for the form inputs
  const [timestamp, setTimestamp] = useState(interaction?.timestamp || Date.now());
  const [type, setType] = useState(interaction?.type || supportedInteractionTypes[0]);
  const [notes, setNotes] = useState(interaction?.notes || '');
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  
  // Refs for original values to avoid re-renders
  const originalTimestampRef = useRef(interaction?.timestamp || Date.now());
  const originalTypeRef = useRef(interaction?.type || supportedInteractionTypes[0]);
  const originalNotesRef = useRef(interaction?.notes || '');
  const notesRef = useRef(interaction?.notes || '');
  
  // State for the date/time picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reset form when interaction changes
  useEffect(() => {
    if (interaction) {
      setTimestamp(interaction.timestamp);
      setType(interaction.type);
      setNotes(interaction.notes || '');
      
      // Update refs
      originalTimestampRef.current = interaction.timestamp;
      originalTypeRef.current = interaction.type;
      originalNotesRef.current = interaction.notes || '';
      notesRef.current = interaction.notes || '';
    }
  }, [interaction]);

  // Function to check if there are unsaved changes
  const isDirty = useCallback(() => {
    const currentNotes = notesRef.current;
    return (
      timestamp !== originalTimestampRef.current ||
      type !== originalTypeRef.current ||
      currentNotes !== originalNotesRef.current
    );
  }, [timestamp, type]);

  // Handle notes change - update both state and ref
  const handleNotesChange = (text: string) => {
    setNotes(text);
    notesRef.current = text;
  };

  // Handle the date picker change
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const currentDate = new Date(timestamp);
      selectedDate.setHours(currentDate.getHours());
      selectedDate.setMinutes(currentDate.getMinutes());
      setTimestamp(selectedDate.getTime());
    }
  };

  // Handle the time picker change
  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const currentDate = new Date(timestamp);
      currentDate.setHours(selectedTime.getHours());
      currentDate.setMinutes(selectedTime.getMinutes());
      setTimestamp(currentDate.getTime());
    }
  };

  // Function to handle saving the interaction
  const handleSave = () => {
    // Trim and validate notes before saving
    const trimmedNotes = notes.trim();
    
    if (trimmedNotes === '') {
      onSave({ timestamp, type, notes: null });
    } else {
      onSave({ timestamp, type, notes: trimmedNotes });
    }
  };

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      if (visible) {
        if (isDirty()) {
          Alert.alert(
            'Unsaved Changes',
            'You have unsaved changes. Are you sure you want to discard them?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => {} },
              { text: 'Discard', style: 'destructive', onPress: onClose }
            ]
          );
          return true;
        }
        onClose();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [visible, onClose, isDirty]);

  // Function to handle modal close with confirmation if there are changes
  const handleCloseWithConfirmation = () => {
    if (isDirty()) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {} },
          { text: 'Discard', style: 'destructive', onPress: onClose }
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={handleCloseWithConfirmation}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCloseWithConfirmation} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Interaction</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Date</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={styles.input}>
                <Text>{format(new Date(timestamp), 'MMMM d, yyyy')}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(timestamp)}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Time</Text>
              <Pressable onPress={() => setShowTimePicker(true)} style={styles.input}>
                <Text>{format(new Date(timestamp), 'h:mm a')}</Text>
              </Pressable>
              {showTimePicker && (
                <DateTimePicker
                  value={new Date(timestamp)}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Interaction Type</Text>
              <Pressable 
                style={styles.input}
                onPress={() => setTypeMenuVisible(true)}
              >
                <View style={styles.typeSelector}>
                  <Text>{type}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#333" />
                </View>
              </Pressable>
              <Menu
                visible={typeMenuVisible}
                onDismiss={() => setTypeMenuVisible(false)}
                anchor={{ x: 20, y: 0 }}
                style={styles.typeMenu}
              >
                <ScrollView style={{ maxHeight: 300 }}>
                  {supportedInteractionTypes.map((interactionType) => (
                    <Menu.Item
                      key={interactionType}
                      title={interactionType}
                      onPress={() => {
                        setType(interactionType);
                        setTypeMenuVisible(false);
                      }}
                    />
                  ))}
                </ScrollView>
              </Menu>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="Add notes about this interaction"
                value={notes}
                onChangeText={handleNotesChange}
                mode="outlined"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeMenu: {
    width: '85%',
    marginTop: 40,
  },
  textArea: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 120,
  },
});

export default EditInteractionModal; 