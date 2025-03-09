import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
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

interface UpcomingBirthdaysProps {
  showHidden?: boolean; // Whether to show hidden entities
}

const UpcomingBirthdays: React.FC<UpcomingBirthdaysProps> = ({ showHidden = false }) => {
  const navigation = useNavigation<NavigationProp>();
  const [birthdays, setBirthdays] = useState<BirthdayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpcomingBirthdays();
  }, [showHidden]); // Re-fetch when showHidden changes

  const loadUpcomingBirthdays = async () => {
    setLoading(true);
    try {
      // Get all person entities first based on showHidden parameter
      const entities = await database.getAllEntities(
        EntityType.PERSON,
        { showHidden }
      );
      
      // Manually process entities to get their birthdays
      const result: BirthdayItem[] = [];
      const today = new Date();
      
      for (const entity of entities) {
        const birthday = await database.getBirthdayForPerson(entity.id);
        if (birthday) {
          let birthdayDate: Date;
          
          // Handle birthday format without year (NOYR:MM-DD)
          if (birthday.startsWith('NOYR:')) {
            const monthDay = birthday.substring(5);
            const [month, day] = monthDay.split('-').map(Number);
            
            // Create a temporary date with today's year
            birthdayDate = new Date(today.getFullYear(), month - 1, day);
          } else {
            // Regular date with year
            birthdayDate = new Date(birthday);
          }
          
          const thisYearBirthday = new Date(
            today.getFullYear(),
            birthdayDate.getMonth(),
            birthdayDate.getDate()
          );
          
          // If the birthday has already passed this year, use next year
          if (thisYearBirthday < today) {
            thisYearBirthday.setFullYear(thisYearBirthday.getFullYear() + 1);
          }
          
          // Calculate days until birthday
          const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Only include birthdays in the next 14 days
          if (daysUntil <= 14) {
            result.push({
              entity,
              birthday,
              daysUntil
            });
          }
        }
      }
      
      // Sort by days until birthday
      setBirthdays(result.sort((a, b) => a.daysUntil - b.daysUntil));
    } catch (error) {
      console.error('Error loading upcoming birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonPress = (personId: string) => {
    navigation.navigate('EntityDetail', { id: personId });
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
        <Card.Content>
          <Text style={styles.headerText}>Upcoming Birthdays</Text>
        </Card.Content>
      </Card>
    );
  }

  if (birthdays.length === 0) {
    return (
      <Card style={styles.compactCard}>
        <Card.Content>
          <Text style={styles.headerText}>Upcoming Birthdays</Text>
          <Text style={styles.noDataText}>No birthdays in the next 2 weeks</Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.compactCard}>
      <Card.Content>
        <Text style={styles.headerText}>Upcoming Birthdays</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {birthdays.map((item) => (
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
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
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
  }
});

export default UpcomingBirthdays; 