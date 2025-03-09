import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

// Import screens (we'll create these next)
import HomeScreen from '../screens/HomeScreen';
import EntityDetailScreen from '../screens/EntityDetailScreen';
import EditEntityScreen from '../screens/EditEntityScreen';
import ContactImportScreen from '../screens/ContactImportScreen';
import DebugScreen from '../screens/DebugScreen';
import SettingsScreen from '../screens/SettingsScreen';
import GroupMemberScreen from '../screens/GroupMemberScreen';
import InteractionTypesScreen from '../screens/InteractionTypesScreen';
import NotificationManagerScreen from '../screens/NotificationManagerScreen';
import DatabaseFixScreen from '../screens/DatabaseFixScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6200ee',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'My Garden' }} 
        />
        <Stack.Screen 
          name="EntityDetail" 
          component={EntityDetailScreen} 
          options={{ title: 'Details' }} 
        />
        <Stack.Screen 
          name="EditEntity" 
          component={EditEntityScreen} 
          options={({ route }) => ({ 
            title: route.params?.id ? 'Edit' : 'Create' 
          })} 
        />
        <Stack.Screen 
          name="ContactImport" 
          component={ContactImportScreen} 
          options={{ title: 'Import Contacts' }} 
        />
        <Stack.Screen 
          name="Debug" 
          component={DebugScreen} 
          options={{ title: 'Database Debug' }} 
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ title: 'Settings' }} 
        />
        <Stack.Screen 
          name="GroupMembers" 
          component={GroupMemberScreen} 
          options={({ route }) => ({ 
            title: `${route.params.groupName} Members` 
          })} 
        />
        <Stack.Screen 
          name="InteractionTypes" 
          component={InteractionTypesScreen} 
          options={{ title: 'Interaction Types' }} 
        />
        <Stack.Screen 
          name="NotificationManager" 
          component={NotificationManagerScreen} 
          options={{ title: 'Notification Manager' }} 
        />
        <Stack.Screen 
          name="DatabaseFix" 
          component={DatabaseFixScreen} 
          options={{ title: 'Database Fix' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
} 