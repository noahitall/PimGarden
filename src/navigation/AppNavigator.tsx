import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

// Import screens (we'll create these next)
import HomeScreen from '../screens/HomeScreen';
import EntityDetailScreen from '../screens/EntityDetailScreen';
import EditEntityScreen from '../screens/EditEntityScreen';
import ContactImportScreen from '../screens/ContactImportScreen';

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
          options={{ title: 'My Entities' }} 
        />
        <Stack.Screen 
          name="EntityDetail" 
          component={EntityDetailScreen} 
          options={{ title: 'Entity Details' }} 
        />
        <Stack.Screen 
          name="EditEntity" 
          component={EditEntityScreen} 
          options={({ route }) => ({ 
            title: route.params?.id ? 'Edit Entity' : 'Create Entity' 
          })} 
        />
        <Stack.Screen 
          name="ContactImport" 
          component={ContactImportScreen} 
          options={{ title: 'Import Contacts' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
} 