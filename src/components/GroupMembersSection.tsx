import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator } from 'react-native';
import { Card, Text, Button, Avatar, Divider, List } from 'react-native-paper';
import { database, EntityType } from '../database/Database';
import { Entity } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useFocusEffect } from '@react-navigation/native';

interface GroupMembersSectionProps {
  groupId: string;
  groupName: string;
  navigation: NativeStackNavigationProp<RootStackParamList, 'EntityDetail'>;
}

const GroupMembersSection: React.FC<GroupMembersSectionProps> = ({ groupId, groupName, navigation }) => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Entity[]>([]);

  // Use this effect on first mount
  useEffect(() => {
    loadMembers();
  }, []);

  // Use this effect whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("GroupMembersSection is now focused - reloading members");
      loadMembers();
      return () => {
        // Cleanup if needed
      };
    }, [groupId])
  );

  const loadMembers = async () => {
    try {
      setLoading(true);
      const groupMembers = await database.getGroupMembers(groupId);
      setMembers(groupMembers as any);
    } catch (error) {
      console.error('Error loading group members:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToMember = (memberId: string) => {
    navigation.push('EntityDetail', { id: memberId });
  };

  const getEntityTypeIcon = (type: string) => {
    switch(type) {
      case EntityType.PERSON:
        return 'account';
      case EntityType.GROUP:
        return 'account-group';
      case EntityType.TOPIC:
        return 'tag';
      default:
        return 'help-circle';
    }
  };

  if (loading) {
    return (
      <Card.Content style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6200ee" />
      </Card.Content>
    );
  }

  if (members.length === 0) {
    return (
      <Card.Content>
        <Text style={styles.emptyMessage}>No members in this group yet</Text>
        <Button 
          mode="contained" 
          icon="account-group"
          onPress={() => navigation.navigate('GroupMembers', { 
            groupId, 
            groupName 
          })}
          style={styles.manageButton}
        >
          Add Members
        </Button>
      </Card.Content>
    );
  }

  return (
    <Card.Content>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            left={(props) => <List.Icon {...props} icon={getEntityTypeIcon(item.type)} />}
            onPress={() => navigateToMember(item.id)}
            style={styles.memberItem}
          />
        )}
        ItemSeparatorComponent={() => <Divider />}
        style={styles.membersList}
        scrollEnabled={false}
        ListFooterComponent={() => (
          <Button 
            mode="contained" 
            icon="account-group"
            onPress={() => navigation.navigate('GroupMembers', { 
              groupId, 
              groupName 
            })}
            style={styles.manageButton}
          >
            Manage Members
          </Button>
        )}
      />
    </Card.Content>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
    color: '#777',
  },
  membersList: {
    marginTop: 10,
    marginBottom: 10,
  },
  memberItem: {
    paddingVertical: 8,
  },
  manageButton: {
    marginTop: 15,
    marginBottom: 5,
  },
});

export default GroupMembersSection; 