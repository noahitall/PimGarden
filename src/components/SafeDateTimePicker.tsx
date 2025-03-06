import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Button } from 'react-native-paper';

// Conditionally import DateTimePicker
let DateTimePickerComponent: any = null;
try {
  DateTimePickerComponent = require('@react-native-community/datetimepicker').default;
} catch (error) {
  console.warn('DateTimePicker not available:', error);
}

interface SafeDateTimePickerProps {
  value: Date;
  mode?: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'calendar' | 'clock';
  onChange: (event: any, date?: Date) => void;
  onClose?: () => void;
}

const SafeDateTimePicker: React.FC<SafeDateTimePickerProps> = ({
  value,
  mode = 'date',
  display = 'default',
  onChange,
  onClose
}) => {
  // If DateTimePicker is available, use it
  if (DateTimePickerComponent) {
    return (
      <DateTimePickerComponent
        value={value}
        mode={mode}
        display={display}
        onChange={onChange}
      />
    );
  }
  
  // Fallback UI when DateTimePicker is not available
  return (
    <View style={styles.fallbackContainer}>
      <Text style={styles.errorText}>
        DateTimePicker is not available in this environment.
      </Text>
      <Text style={styles.infoText}>
        This is a known issue with the new React Native architecture in Expo Go.
      </Text>
      <Text style={styles.valueText}>
        Current value: {value.toLocaleString()}
      </Text>
      <Button 
        mode="contained" 
        onPress={() => onClose?.()}
        style={styles.closeButton}
      >
        Close
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  valueText: {
    marginBottom: 16,
  },
  closeButton: {
    width: '100%',
  }
});

export default SafeDateTimePicker; 