import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Button, TextInput, Divider, Card, Title } from 'react-native-paper';
// @ts-ignore
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Conditionally import DateTimePicker for iOS
let DateTimePickerComponent: any = null;
if (Platform.OS === 'ios') {
  try {
    DateTimePickerComponent = require('@react-native-community/datetimepicker').default;
  } catch (error) {
    console.warn('DateTimePicker not available:', error);
  }
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
  // State for custom date picker
  const [year, setYear] = useState(value.getFullYear().toString());
  const [month, setMonth] = useState((value.getMonth() + 1).toString());
  const [day, setDay] = useState(value.getDate().toString());
  const [hours, setHours] = useState(value.getHours().toString());
  const [minutes, setMinutes] = useState(value.getMinutes().toString());
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');

  // Generate array of years (current year - 10 to current year + 10)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
  
  // Generate months (abbreviations)
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  // Full month names for display
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Generate days (1-31)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  
  // Generate hours (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  
  // Generate minutes (0-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

  // Handle setting date
  const handleDateSubmit = () => {
    try {
      // Parse values from state
      const parsedYear = parseInt(year);
      const parsedMonth = parseInt(month) - 1; // Months are 0-indexed in JS Date
      const parsedDay = parseInt(day);
      const parsedHours = parseInt(hours);
      const parsedMinutes = parseInt(minutes);
      
      // Create new date object
      const newDate = new Date(value);
      
      // Only update date parts if mode includes date
      if (mode === 'date' || mode === 'datetime') {
        newDate.setFullYear(parsedYear);
        newDate.setMonth(parsedMonth);
        newDate.setDate(parsedDay);
      }
      
      // Only update time parts if mode includes time
      if (mode === 'time' || mode === 'datetime') {
        newDate.setHours(parsedHours);
        newDate.setMinutes(parsedMinutes);
      }
      
      // Call onChange with the new date
      onChange({ type: 'set' }, newDate);
      
      // Close if needed
      if (onClose) {
        onClose();
      }
    } catch (e) {
      console.error('Error setting date:', e);
    }
  };

  // Format a number to be two digits (e.g., 1 -> "01")
  const formatTwoDigits = (num: number): string => {
    return num < 10 ? `0${num}` : `${num}`;
  };

  // Handle selection of a month
  const handleMonthSelect = (index: number) => {
    setMonth((index + 1).toString());
  };

  // Handle selection of a day
  const handleDaySelect = (d: number) => {
    setDay(d.toString());
  };

  // Handle selection of a year
  const handleYearSelect = (y: number) => {
    setYear(y.toString());
  };

  // Handle selection of an hour
  const handleHourSelect = (h: number) => {
    setHours(h.toString());
  };

  // Handle selection of minutes
  const handleMinuteSelect = (m: number) => {
    setMinutes(m.toString());
  };

  // If we're on iOS and DateTimePicker is available, use that
  if (Platform.OS === 'ios' && DateTimePickerComponent) {
    return (
      <DateTimePickerComponent
        value={value}
        mode={mode}
        display={display}
        onChange={onChange}
      />
    );
  }
  
  // On Android or if DateTimePicker is not available, use our custom UI
  return (
    <Card style={styles.container}>
      <Card.Content>
        <Title style={styles.title}>Select {mode === 'datetime' ? 'Date & Time' : mode}</Title>
        
        {(mode === 'date' || mode === 'datetime') && (
          <View style={styles.tabButtons}>
            <Button 
              mode={activeTab === 'date' ? 'contained' : 'outlined'}
              onPress={() => setActiveTab('date')}
              style={styles.tabButton}
            >
              Date
            </Button>
            {mode === 'datetime' && (
              <Button 
                mode={activeTab === 'time' ? 'contained' : 'outlined'}
                onPress={() => setActiveTab('time')}
                style={styles.tabButton}
              >
                Time
              </Button>
            )}
          </View>
        )}
        
        {/* Date selection UI */}
        {(activeTab === 'date' && (mode === 'date' || mode === 'datetime')) && (
          <>
            <View style={styles.dateContainer}>
              <View style={styles.dateSection}>
                <Text style={styles.label}>Month</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {months.map((m, index) => (
                    <TouchableOpacity
                      key={`month-${index}`}
                      style={[
                        styles.pickerItem,
                        parseInt(month) === index + 1 && styles.pickerItemSelected
                      ]}
                      onPress={() => handleMonthSelect(index)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        parseInt(month) === index + 1 && styles.pickerItemTextSelected
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <View style={styles.dateSection}>
                <Text style={styles.label}>Day</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {days.map(d => (
                    <TouchableOpacity
                      key={`day-${d}`}
                      style={[
                        styles.pickerItem,
                        parseInt(day) === d && styles.pickerItemSelected
                      ]}
                      onPress={() => handleDaySelect(d)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        parseInt(day) === d && styles.pickerItemTextSelected
                      ]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <View style={styles.dateSection}>
                <Text style={styles.label}>Year</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {years.map(y => (
                    <TouchableOpacity
                      key={`year-${y}`}
                      style={[
                        styles.pickerItem,
                        parseInt(year) === y && styles.pickerItemSelected
                      ]}
                      onPress={() => handleYearSelect(y)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        parseInt(year) === y && styles.pickerItemTextSelected
                      ]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            
            <View style={styles.currentSelection}>
              <Text style={styles.currentSelectionText}>
                Selected Date: {fullMonthNames[parseInt(month) - 1]} {day}, {year}
              </Text>
            </View>
          </>
        )}
        
        {/* Time selection UI */}
        {(activeTab === 'time' || mode === 'time') && (
          <>
            <View style={styles.timeContainer}>
              <View style={styles.timeSection}>
                <Text style={styles.label}>Hour</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {hourOptions.map(h => (
                    <TouchableOpacity
                      key={`hour-${h}`}
                      style={[
                        styles.pickerItem,
                        parseInt(hours) === h && styles.pickerItemSelected
                      ]}
                      onPress={() => handleHourSelect(h)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        parseInt(hours) === h && styles.pickerItemTextSelected
                      ]}>
                        {formatTwoDigits(h)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <View style={styles.timeSeparator}>
                <Text style={styles.timeSeparatorText}>:</Text>
              </View>
              
              <View style={styles.timeSection}>
                <Text style={styles.label}>Minute</Text>
                <ScrollView style={styles.pickerScrollView}>
                  {minuteOptions.map(m => (
                    <TouchableOpacity
                      key={`minute-${m}`}
                      style={[
                        styles.pickerItem,
                        parseInt(minutes) === m && styles.pickerItemSelected
                      ]}
                      onPress={() => handleMinuteSelect(m)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        parseInt(minutes) === m && styles.pickerItemTextSelected
                      ]}>
                        {formatTwoDigits(m)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            
            <View style={styles.currentSelection}>
              <Text style={styles.currentSelectionText}>
                Selected Time: {formatTwoDigits(parseInt(hours))}:{formatTwoDigits(parseInt(minutes))}
              </Text>
            </View>
          </>
        )}
        
        <View style={styles.buttonContainer}>
          <Button 
            mode="outlined" 
            onPress={onClose}
            style={styles.button}
          >
            Cancel
          </Button>
          <Button 
            mode="contained" 
            onPress={handleDateSubmit}
            style={styles.button}
          >
            Confirm
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    elevation: 4,
    borderRadius: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 18,
  },
  tabButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  tabButton: {
    marginHorizontal: 5,
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateSection: {
    flex: 1,
    marginHorizontal: 5,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  timeSection: {
    flex: 2,
  },
  timeSeparator: {
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 25,
  },
  timeSeparatorText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  pickerScrollView: {
    height: 150,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  pickerItemSelected: {
    backgroundColor: '#e8f0fe',
    borderLeftWidth: 3,
    borderLeftColor: '#6200ee',
  },
  pickerItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    minWidth: 120,
    marginHorizontal: 5,
  },
  currentSelection: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 5,
  },
  currentSelectionText: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  }
});

export default SafeDateTimePicker; 