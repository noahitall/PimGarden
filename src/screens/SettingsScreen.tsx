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
  Portal,
  RadioButton
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { FeatureFlags, updateFeatureFlag, FEATURE_FLAGS_STORAGE_KEY, isFeatureEnabledSync } from '../config/FeatureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database, AppSettings } from '../database/Database';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({...FeatureFlags});
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  
  // Reset all data dialog state
  const [resetDataDialogVisible, setResetDataDialogVisible] = useState(false);
  const [resetDataConfirmDialogVisible, setResetDataConfirmDialogVisible] = useState(false);
  
  // Interaction score settings
  const [scoreSettings, setScoreSettings] = useState<AppSettings>({
    decayFactor: 0,
    decayType: 'linear'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Load saved feature flags and score settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load feature flags
        const savedFlags = await AsyncStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
        if (savedFlags) {
          const parsedFlags = JSON.parse(savedFlags);
          setFeatureFlags({...FeatureFlags, ...parsedFlags});
        }
        
        // Load score settings
        const settings = await database.getSettings();
        if (settings) {
          setScoreSettings(settings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
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
  
  // Reset all data in the app
  const resetAllData = async () => {
    try {
      // Use the clearAllData method to actually delete all data from the database
      const deletedRecords = await database.clearAllData();
      
      // Clear feature flags
      await AsyncStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
      setFeatureFlags({...FeatureFlags});
      
      // Reset dialogs
      setResetDataDialogVisible(false);
      setResetDataConfirmDialogVisible(false);
      
      // Show success message with count of deleted records
      Alert.alert(
        'Data Reset Complete', 
        `All data has been erased:\n\n` +
        `• ${deletedRecords.entities} entities\n` +
        `• ${deletedRecords.interactions} interactions\n` +
        `• ${deletedRecords.photos} photos\n` +
        `• ${deletedRecords.tags} tags\n` +
        `• ${deletedRecords.favorites} favorites\n\n` +
        `Total: ${deletedRecords.total} records`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error resetting data:', error);
      Alert.alert('Error', 'Failed to reset data');
    }
  };
  
  // Save score settings
  const saveScoreSettings = async () => {
    try {
      setIsSavingSettings(true);
      await database.updateSettings(scoreSettings);
      Alert.alert('Settings Saved', 'Interaction score settings have been updated.');
    } catch (error) {
      console.error('Error saving score settings:', error);
      Alert.alert('Error', 'Failed to save interaction score settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };
  
  // Run database migrations manually (for development/testing)
  const runDatabaseMigrations = async () => {
    try {
      // Set database version to 0 to force all migrations to run
      await database.resetDatabaseVersion(0);
      Alert.alert('Success', 'Database migrations have been triggered. Restart the app to complete the process.');
    } catch (error) {
      console.error('Error triggering database migrations:', error);
      Alert.alert('Error', 'Failed to trigger database migrations.');
    }
  };
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        {/* Interaction Score Settings Card */}
        <Card style={styles.card}>
          <Card.Title 
            title="Interaction Score Settings" 
            subtitle="Configure how interaction scores are calculated" 
          />
          <Card.Content>
            <Text style={styles.sectionDescription}>
              These settings control how interaction scores decay over time. 
              Higher decay factors cause older interactions to contribute less to the total score.
            </Text>
            
            <Text style={styles.sliderLabel}>
              Decay Factor: {scoreSettings.decayFactor.toFixed(2)}
            </Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderEndLabel}>No Decay</Text>
              <Slider
                value={scoreSettings.decayFactor}
                onValueChange={(value: number) => setScoreSettings({...scoreSettings, decayFactor: value})}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                style={styles.slider}
              />
              <Text style={styles.sliderEndLabel}>Fast Decay</Text>
            </View>
            
            <Text style={styles.radioLabel}>Decay Type:</Text>
            <RadioButton.Group
              onValueChange={(value: string) => setScoreSettings({...scoreSettings, decayType: value})}
              value={scoreSettings.decayType}
            >
              <View style={styles.radioOption}>
                <RadioButton value="linear" />
                <Text>Linear (Constant Rate)</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="exponential" />
                <Text>Exponential (Accelerating)</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="logarithmic" />
                <Text>Logarithmic (Slowing)</Text>
              </View>
            </RadioButton.Group>
            
            <Button 
              mode="contained"
              onPress={saveScoreSettings}
              disabled={isSavingSettings}
              style={styles.button}
              loading={isSavingSettings}
            >
              Save Score Settings
            </Button>
          </Card.Content>
        </Card>
        
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer Options</Text>
            <Button 
              mode="outlined"
              onPress={runDatabaseMigrations}
              style={[styles.button, {marginTop: 10}]}
              color="#FF5722"
            >
              Reset DB Version & Run Migrations
            </Button>
          </View>
        )}
        
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
              
              <List.Item
                title="Enable Historical Interactions"
                description="Allow adding interactions with custom dates"
                left={props => <List.Icon {...props} icon="clock-time-four-outline" />}
                right={props => (
                  <Switch
                    value={featureFlags.ENABLE_HISTORICAL_INTERACTIONS}
                    onValueChange={() => toggleFeatureFlag('ENABLE_HISTORICAL_INTERACTIONS')}
                  />
                )}
              />
              
              <List.Item
                title="Enable Data Reset"
                description="Allow resetting all app data (dangerous)"
                left={props => <List.Icon {...props} icon="delete-forever" />}
                right={props => (
                  <Switch
                    value={featureFlags.ENABLE_DATA_RESET}
                    onValueChange={() => toggleFeatureFlag('ENABLE_DATA_RESET')}
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
        
        {/* Data Management Card - Only visible if ENABLE_DATA_RESET is enabled */}
        {isFeatureEnabledSync('ENABLE_DATA_RESET') && (
          <Card style={styles.card}>
            <Card.Title 
              title="Data Management" 
              subtitle="Danger zone" 
            />
            <Card.Content>
              <Text style={styles.dangerText}>
                These actions permanently affect your data and cannot be undone.
                Please use with extreme caution.
              </Text>
              
              <Button 
                mode="outlined" 
                onPress={() => setResetDataDialogVisible(true)}
                style={styles.dangerButton}
                labelStyle={{color: '#d32f2f'}}
                icon="delete-forever"
              >
                Reset All Data
              </Button>
            </Card.Content>
          </Card>
        )}
        
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
      
      {/* Reset all data first confirmation dialog */}
      <Portal>
        <Dialog visible={resetDataDialogVisible} onDismiss={() => setResetDataDialogVisible(false)}>
          <Dialog.Title>Reset All Data</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogWarningText}>
              Warning: This action will permanently delete ALL your data, including:
            </Text>
            <Text style={styles.dialogBulletPoint}>• All contacts and entities</Text>
            <Text style={styles.dialogBulletPoint}>• All interaction records</Text>
            <Text style={styles.dialogBulletPoint}>• All photos and tags</Text>
            <Text style={styles.dialogBulletPoint}>• All settings and preferences</Text>
            <Text style={styles.dialogText}>
              This action cannot be undone. Are you sure you want to proceed?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetDataDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={() => {
                setResetDataDialogVisible(false);
                setResetDataConfirmDialogVisible(true);
              }}
              textColor="#d32f2f"
            >
              Yes, I'm Sure
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Reset all data second confirmation dialog */}
      <Portal>
        <Dialog visible={resetDataConfirmDialogVisible} onDismiss={() => setResetDataConfirmDialogVisible(false)}>
          <Dialog.Title>Final Confirmation</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogWarningText}>
              Warning: This is your final confirmation
            </Text>
            <Text style={{marginTop: 15}}>
              This will permanently erase all data. Are you absolutely sure?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetDataConfirmDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={resetAllData}
              textColor="#d32f2f"
            >
              Reset Everything
            </Button>
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
  dangerText: {
    marginBottom: 16,
    color: '#d32f2f',
    fontStyle: 'italic',
  },
  dangerButton: {
    borderColor: '#d32f2f',
  },
  dialogWarningText: {
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  dialogText: {
    marginTop: 12,
  },
  dialogBulletPoint: {
    marginLeft: 8,
    marginTop: 4,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    marginTop: 10,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  sliderEndLabel: {
    width: 70,
    fontSize: 12,
    color: '#666',
  },
  radioLabel: {
    marginTop: 10,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    marginTop: 20,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

export default SettingsScreen; 