import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Card, Text, IconButton, Chip, ActivityIndicator } from 'react-native-paper';
import { database, EntityType } from '../database/Database';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { format, differenceInYears } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface BirthdayItem {
  entity: {
    id: string;
    name: string;
    image: string | null;
  };
  birthday: string;
  daysUntil: number;
}

const UpcomingBirthdays: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [birthdays, setBirthdays] = useState<BirthdayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadUpcomingBirthdays();
  }, []);

  const loadUpcomingBirthdays = async () => {
    setLoading(true);
    try {
      const upcomingBirthdays = await database.getUpcomingBirthdays(30);
      console.log('Loaded upcoming birthdays:', upcomingBirthdays.length);
      upcomingBirthdays.forEach((item, index) => {
        console.log(`Birthday ${index + 1}: ${item.entity.name}, birthday: ${item.birthday}, days: ${item.daysUntil}`);
      });
      setBirthdays(upcomingBirthdays);
    } catch (error) {
      console.error('Error loading upcoming birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonPress = (personId: string) => {
    navigation.navigate('EntityDetail', { id: personId });
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Calculate age for upcoming birthday
  const getUpcomingAge = (birthdayStr: string): number | null => {
    // Skip year calculation for NOYR format
    if (birthdayStr.startsWith('NOYR:')) {
      return null;
    }
    
    try {
      const birthdate = new Date(birthdayStr);
      const now = new Date();
      return differenceInYears(now, birthdate) + 1; // Add 1 for upcoming birthday
    } catch (error) {
      return null;
    }
  };

  // Format date for display
  const formatBirthdayDate = (birthdayStr: string): string => {
    try {
      // Handle special no-year format
      if (birthdayStr.startsWith('NOYR:')) {
        // Extract the MM-DD part
        const monthDay = birthdayStr.substring(5);
        const [month, day] = monthDay.split('-').map(Number);
        
        // Create a temporary date to format (year doesn't matter)
        const tempDate = new Date();
        tempDate.setMonth(month - 1); // Month is 0-indexed in JS
        tempDate.setDate(day);
        
        // Format as "Month Day" without year
        return format(tempDate, 'MMM d');
      }
      
      // Regular date with year - still display without year for consistency
      const birthdate = new Date(birthdayStr);
      return format(birthdate, 'MMM d');
    } catch (error) {
      console.error('Error formatting birthday date:', error, birthdayStr);
      return 'Unknown';
    }
  };

  // Get a message based on how many days until birthday
  const getDaysMessage = (days: number): string => {
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow!';
    return `${days}d`;
  };

  if (loading) {
    return (
      <Card style={styles.compactCard}>
        <Card.Content style={styles.loadingContainer}>
          <ActivityIndicator animating={true} size="small" />
        </Card.Content>
      </Card>
    );
  }

  if (birthdays.length === 0) {
    return (
      <Card style={styles.compactCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Upcoming Birthdays</Text>
            <IconButton icon="refresh" size={16} onPress={loadUpcomingBirthdays} />
          </View>
          <Text style={styles.noDataText}>No upcoming birthdays</Text>
        </Card.Content>
      </Card>
    );
  }

  // Limit displayed birthdays
  const displayedBirthdays = expanded ? birthdays : birthdays.slice(0, 3);

  return (
    <Card style={styles.compactCard}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Upcoming Birthdays</Text>
          <IconButton icon="refresh" size={16} onPress={loadUpcomingBirthdays} />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {displayedBirthdays.map((item) => (
            <TouchableOpacity 
              key={item.entity.id}
              style={styles.horizontalBirthdayItem} 
              onPress={() => handlePersonPress(item.entity.id)}
            >
              <View style={styles.birthdayInfo}>
                <Text style={styles.personName} numberOfLines={1} ellipsizeMode="tail">
                  {item.entity.name}
                </Text>
                <View style={styles.dateRow}>
                  <Text style={styles.dateText}>{formatBirthdayDate(item.birthday)}</Text>
                  <Chip mode="outlined" style={styles.daysChip} textStyle={styles.daysChipText}>
                    {getDaysMessage(item.daysUntil)}
                  </Chip>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {birthdays.length > 3 && !expanded && (
          <TouchableOpacity style={styles.expandButton} onPress={toggleExpanded}>
            <Text style={styles.expandButtonText}>
              Show {birthdays.length - 3} more
            </Text>
          </TouchableOpacity>
        )}
        
        {expanded && (
          <TouchableOpacity style={styles.expandButton} onPress={toggleExpanded}>
            <Text style={styles.expandButtonText}>
              Show less
            </Text>
          </TouchableOpacity>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  compactCard: {
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noDataText: {
    fontStyle: 'italic',
    fontSize: 12,
    color: '#666',
    padding: 4,
  },
  horizontalBirthdayItem: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: 16,
    width: 100,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  birthdayInfo: {
    alignItems: 'center',
    width: '100%',
  },
  personName: {
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    marginRight: 4,
  },
  daysChip: {
    height: 20,
    backgroundColor: '#e0f7fa',
  },
  daysChipText: {
    fontSize: 8,
    margin: 0,
    padding: 0,
  },
  expandButton: {
    alignItems: 'center',
    padding: 4,
    marginTop: 4,
  },
  expandButtonText: {
    color: '#6200ee',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default UpcomingBirthdays; 