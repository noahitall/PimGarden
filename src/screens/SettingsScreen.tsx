import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { 
  Appbar, 
  List, 
  Switch, 
  Divider, 
  Button, 
  Text,
  Card,
  Dialog,
  Portal
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { FeatureFlags, updateFeatureFlag, FEATURE_FLAGS_STORAGE_KEY } from '../config/FeatureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({...FeatureFlags});
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  
  // Load saved feature flags on mount
  useEffect(() => {
    const loadFeatureFlags = async () => {
      try {
        const savedFlags = await AsyncStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
        if (savedFlags) {
          const parsedFlags = JSON.parse(savedFlags);
          setFeatureFlags({...FeatureFlags, ...parsedFlags});
        }
      } catch (error) {
        console.error('Error loading feature flags:', error);
      }
    };
    
    loadFeatureFlags();
  }, []);
  
  // Toggle a feature flag
  const toggleFeatureFlag = async (flag: keyof typeof FeatureFlags) => {
    const newValue = !featureFlags[flag];
    
    // Update state
    setFeatureFlags({
      ...featureFlags,
      [flag]: newValue
    });
    
    // Update feature flag in storage
    await updateFeatureFlag(flag, newValue);
  };
  
  // Reset all feature flags to defaults
  const resetFeatureFlags = async () => {
    // Reset state
    setFeatureFlags({...FeatureFlags});
    
    // Reset all feature flags in storage
    for (const flag in FeatureFlags) {
      await updateFeatureFlag(flag as keyof typeof FeatureFlags, 
        FeatureFlags[flag as keyof typeof FeatureFlags]);
    }
    
    setResetDialogVisible(false);
  };
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Title title="Feature Flags" subtitle="Toggle experimental features" />
          <Card.Content>
            <Text style={styles.sectionDescription}>
              These settings control which features are enabled in the app.
              Some features are experimental and may not work as expected.
            </Text>
            
            <List.Section>
              <List.Subheader>Development Features</List.Subheader>
              
              <List.Item
                title="Show Debug Button"
                description="Display the database debug button on the home screen"
                left={props => <List.Icon {...props} icon="bug" />}
                right={props => (
                  <Switch
                    value={featureFlags.SHOW_DEBUG_BUTTON}
                    onValueChange={() => toggleFeatureFlag('SHOW_DEBUG_BUTTON')}
                  />
                )}
              />
              
              <Divider />
              
              <List.Subheader>Core Features</List.Subheader>
              
              <List.Item
                title="Entity Merging"
                description="Enable merging of duplicate entities"
                left={props => <List.Icon {...props} icon="merge" />}
                right={props => (
                  <Switch
                    value={featureFlags.ENABLE_MERGE_FEATURE}
                    onValueChange={() => toggleFeatureFlag('ENABLE_MERGE_FEATURE')}
                  />
                )}
              />
              
              <List.Item
                title="Contact Import"
                description="Enable importing contacts from device"
                left={props => <List.Icon {...props} icon="import" />}
                right={props => (
                  <Switch
                    value={featureFlags.ENABLE_CONTACT_IMPORT}
                    onValueChange={() => toggleFeatureFlag('ENABLE_CONTACT_IMPORT')}
                  />
                )}
              />
              
              <Divider />
              
              <List.Subheader>Experimental Features</List.Subheader>
              
              <List.Item
                title="Yearly Sparklines"
                description="Show yearly data when no recent activity"
                left={props => <List.Icon {...props} icon="chart-timeline-variant" />}
                right={props => (
                  <Switch
                    value={featureFlags.ENABLE_YEARLY_SPARKLINES}
                    onValueChange={() => toggleFeatureFlag('ENABLE_YEARLY_SPARKLINES')}
                  />
                )}
              />
            </List.Section>
            
            <Button 
              mode="outlined" 
              onPress={() => setResetDialogVisible(true)}
              style={styles.resetButton}
            >
              Reset to Defaults
            </Button>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Title title="About" />
          <Card.Content>
            <Text style={styles.aboutText}>
              Contact Manager v1.0.0
            </Text>
            <Text style={styles.aboutText}>
              A simple app to manage your contacts and interactions.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
      
      {/* Reset confirmation dialog */}
      <Portal>
        <Dialog visible={resetDialogVisible} onDismiss={() => setResetDialogVisible(false)}>
          <Dialog.Title>Reset Feature Flags</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to reset all feature flags to their default values?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetDialogVisible(false)}>Cancel</Button>
            <Button onPress={resetFeatureFlags}>Reset</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionDescription: {
    marginBottom: 16,
    color: '#666',
  },
  resetButton: {
    marginTop: 16,
  },
  aboutText: {
    marginBottom: 8,
  },
});

export default SettingsScreen; 