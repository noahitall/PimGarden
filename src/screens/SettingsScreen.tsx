import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert, Share, Platform, Clipboard } from 'react-native';
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
  RadioButton,
  TextInput,
  ActivityIndicator,
  HelperText,
  IconButton
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { FeatureFlags, updateFeatureFlag, FEATURE_FLAGS_STORAGE_KEY, isFeatureEnabledSync } from '../config/FeatureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database, AppSettings } from '../database/Database';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { generatePassphrase, isValidPassphrase as validatePassphraseFormat } from '../utils/WordDictionary';
import { debounce } from 'lodash';
import { format } from 'date-fns';
import * as Crypto from 'expo-crypto';
import { InteractionConfigManager } from '../utils/InteractionConfigManager';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({...FeatureFlags});
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  
  // Reset all data dialog state
  const [resetDataDialogVisible, setResetDataDialogVisible] = useState(false);
  const [resetDataConfirmDialogVisible, setResetDataConfirmDialogVisible] = useState(false);
  
  // Regenerate defaults dialog state
  const [regeneratingDefaults, setRegeneratingDefaults] = useState(false);
  const [regenerateSuccessDialogVisible, setRegenerateSuccessDialogVisible] = useState(false);
  
  // Feature flags visibility state
  const [showFeatureFlags, setShowFeatureFlags] = useState(false);
  
  // Backup and restore state
  const [backupDialogVisible, setBackupDialogVisible] = useState(false);
  const [restoreDialogVisible, setRestoreDialogVisible] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [backupFilePath, setBackupFilePath] = useState<string | null>(null);
  const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showRestorePassphrase, setShowRestorePassphrase] = useState(false);
  const [generatedPassphrase, setGeneratedPassphrase] = useState('');
  const [isPassphraseValid, setIsPassphraseValid] = useState(false);
  const [isRestorePassphraseValid, setIsRestorePassphraseValid] = useState(false);
  
  // Interaction score settings
  const [scoreSettings, setScoreSettings] = useState<AppSettings>({
    decayFactor: 0,
    decayType: 'linear'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Add error state variables
  const [passphraseError, setPassphraseError] = useState<string>('');
  const [restoreError, setRestoreError] = useState<string>('');
  
  // Create debounced validation functions
  const debouncedValidatePassphrase = useCallback(
    debounce((text: string, generated: string) => {
      setIsPassphraseValid(text === generated);
    }, 300),
    []
  );
  
  const debouncedValidateRestorePassphrase = useCallback(
    debounce((text: string) => {
      setIsRestorePassphraseValid(validatePassphraseFormat(text));
    }, 300),
    []
  );
  
  // Handle passphrase input changes with debounce
  const handlePassphraseChange = (text: string) => {
    setPassphrase(text);
    debouncedValidatePassphrase(text, generatedPassphrase);
  };
  
  // Handle restore passphrase input changes with debounce
  const handleRestorePassphraseChange = (text: string) => {
    setRestorePassphrase(text);
    debouncedValidateRestorePassphrase(text);
  };
  
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
      // Set reloadDefaultInteractions to true to include default interactions after reset
      const deletedRecords = await database.clearAllData(true);
      
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
  
  // Handle regenerating default tags and interaction types
  const handleRegenerateDefaults = async () => {
    // Confirm that the user wants to regenerate defaults and potentially override customized interaction types
    Alert.alert(
      'Regenerate Defaults',
      'This will add any missing default tags and RESET ALL interaction types to their default values. Any customized interaction types will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Regenerate',
          onPress: async () => {
            try {
              setRegeneratingDefaults(true);
              await database.regenerateDefaultTagsAndInteractions();
              // Show success dialog
              setRegenerateSuccessDialogVisible(true);
            } catch (error) {
              console.error('Error regenerating defaults:', error);
              Alert.alert('Error', 'Failed to regenerate default tags and interactions.');
            } finally {
              setRegeneratingDefaults(false);
            }
          }
        }
      ]
    );
  };
  
  // Show backup dialog and generate initial passphrase
  const showBackupDialog = async () => {
    const newPassphrase = await generatePassphrase();
    setGeneratedPassphrase(newPassphrase);
    setPassphrase('');
    setIsPassphraseValid(false);
    setShowPassphrase(false);
    setBackupDialogVisible(true);
  };
  
  // Show restore dialog
  const showRestoreDialog = () => {
    setSelectedBackupFile(null);
    setRestorePassphrase('');
    setIsRestorePassphraseValid(false);
    setShowRestorePassphrase(false);
    setRestoreDialogVisible(true);
  };

  // Validate 6-word passphrase format
  const isValidPassphrase = (phrase: string): boolean => {
    return validatePassphraseFormat(phrase);
  };

  // Generate a new passphrase for export
  const handleGeneratePassphrase = async () => {
    const newPassphrase = await generatePassphrase();
    setGeneratedPassphrase(newPassphrase);
    setPassphrase('');
    setIsPassphraseValid(false);
  };

  // Check if user has correctly typed in the passphrase
  const isPassphraseMatching = (): boolean => {
    return passphrase === generatedPassphrase;
  };

  // Share backup file
  const shareBackupFile = async (filePath: string, filename: string): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        // Web platform handling
        Alert.alert(
          'Backup Ready',
          'Your encrypted backup has been created. On web platform, please manually download the file.'
        );
        return true;
      } else {
        // Native platform sharing
        const result = await Share.share({
          title: 'Contact Manager Backup',
          message: 'Please keep this backup file secure. You will need your passphrase to restore it.',
          url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
        });
        
        // Check if user completed the sharing action
        if (result.action === Share.sharedAction) {
          return true;
        } else if (result.action === Share.dismissedAction) {
          // User dismissed the share sheet without sharing
          console.log('Share dismissed by user');
          return false;
        }
        return false;
      }
    } catch (error: any) {
      console.error('Sharing error:', error);
      Alert.alert(
        'Sharing Error',
        error.message || 'Failed to share backup file.'
      );
      return false;
    }
  };
  
  // Export data as encrypted backup
  const handleExportData = async () => {
    if (!isValidPassphrase(passphrase)) {
      Alert.alert('Error', 'Please enter a valid passphrase (at least 8 characters)');
      return;
    }

    setIsProcessing(true);
    try {
      // Show a message about photo inclusion
      Alert.alert(
        'Photo Inclusion',
        'This backup will include all contact photos and uploaded images. This may increase the backup file size significantly.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsProcessing(false) },
          { 
            text: 'Continue', 
            onPress: async () => {
              try {
                const data = await database.exportEncryptedData(passphrase);
                
                // Generate a filename with the date
                const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
                const filename = `contact_manager_backup_${timestamp}.cmb`;
                
                // Save to temporary file
                const tempDir = FileSystem.cacheDirectory + 'backups/';
                const dirInfo = await FileSystem.getInfoAsync(tempDir);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
                }
                
                const filePath = tempDir + filename;
                await FileSystem.writeAsStringAsync(filePath, data);
                
                // Get file size info
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'unknown';
                
                // Share the file
                const shareSuccess = await shareBackupFile(filePath, filename);
                
                // Only show success message if sharing completed successfully
                if (shareSuccess) {
                  // Show success message with file size
                  Alert.alert('Backup Created', `Backup file size: ${fileSize} MB\n\nRemember your passphrase! You will need it to restore this backup.`);
                }
                
                setBackupDialogVisible(false);
                setPassphrase('');
              } catch (error: any) {
                console.error('Export error:', error);
                Alert.alert('Export Error', error.message || 'Failed to create backup');
              } finally {
                setIsProcessing(false);
              }
            }
          }
        ],
        { cancelable: true, onDismiss: () => setIsProcessing(false) }
      );
    } catch (error: any) {
      console.error('Error initiating export:', error);
      Alert.alert('Error', error.message || 'Failed to start export process');
      setIsProcessing(false);
    }
  };
  
  // Pick a backup file to restore
  const pickBackupFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        return;
      }
      
      // Get the first selected asset
      const file = result.assets[0];
      
      if (file) {
        // Validate file extension - allow .json and .cmb files
        const fileExtension = file.uri.split('.').pop()?.toLowerCase();
        
        if (fileExtension !== 'json' && fileExtension !== 'cmb') {
          Alert.alert(
            'Invalid File Type', 
            'Please select a Contact Manager backup file (.cmb or .json)'
          );
          return;
        }
        
        setSelectedBackupFile(file.uri);
      } else {
        Alert.alert('File Selection Error', 'No file was selected.');
      }
    } catch (error: any) {
      console.error('File picking error:', error);
      Alert.alert('Error', 'Could not select the backup file.');
    }
  };
  
  // Import and restore data from backup
  const handleImportData = async () => {
    try {
      if (!selectedBackupFile) {
        Alert.alert('No File Selected', 'Please select a backup file to restore.');
        return;
      }
      
      if (!isValidPassphrase(restorePassphrase)) {
        Alert.alert(
          'Invalid Passphrase', 
          'Please enter a valid passphrase (at least 8 characters).'
        );
        return;
      }
      
      setIsProcessing(true);
      
      // Read file content
      let fileContent;
      try {
        fileContent = await FileSystem.readAsStringAsync(selectedBackupFile);
        console.log(`Read backup file: ${selectedBackupFile.split('/').pop()}, size: ${fileContent.length} bytes`);
      } catch (readError: any) {
        console.error('Error reading backup file:', readError);
        Alert.alert('File Error', `Could not read the backup file: ${readError.message}`);
        setIsProcessing(false);
        return;
      }
      
      try {
        // Validate basic file format for CMB files
        const fileExtension = selectedBackupFile.split('.').pop()?.toLowerCase();
        if (fileExtension === 'cmb') {
          try {
            const packageCheck = JSON.parse(fileContent);
            if (!packageCheck.salt || !packageCheck.iv || !packageCheck.data) {
              Alert.alert(
                'Invalid Backup Format', 
                'The selected file does not appear to be a valid encrypted backup. Please ensure you selected a .cmb file created by this app.'
              );
              setIsProcessing(false);
              return;
            }
          } catch (parseError) {
            Alert.alert(
              'Invalid Backup Format', 
              'The selected file could not be parsed as a valid backup. Please ensure you selected a .cmb file created by this app.'
            );
            setIsProcessing(false);
            return;
          }
        }
        
        // Import the encrypted backup
        await database.importEncryptedData(fileContent, restorePassphrase);
        
        // Reset state
        setRestoreDialogVisible(false);
        setSelectedBackupFile(null);
        setRestorePassphrase('');
        
        Alert.alert(
          'Restore Successful', 
          'Your data has been restored successfully. The app will now restart.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Restart app or reload data
                navigation.navigate('Home');
              } 
            }
          ]
        );
      } catch (importError: any) {
        console.error('Import error:', importError);
        
        // Provide more specific error messages
        let errorMessage = importError.message || 'An unknown error occurred';
        
        if (errorMessage.includes('Invalid backup format')) {
          errorMessage = 'The backup file format is invalid. Please ensure you selected the correct file.';
        } else if (errorMessage.includes('integrity check failed') || 
                  errorMessage.includes('Incorrect passphrase') ||
                  errorMessage.includes('invalid data')) {
          // Offer emergency recovery option
          Alert.alert(
            'Decryption Failed',
            'The backup cannot be decrypted. The most likely cause is that the passphrase is incorrect, or the backup was created with a different version of the app.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Try Emergency Recovery', 
                style: 'destructive',
                onPress: () => handleEmergencyRecovery(fileContent, restorePassphrase)
              }
            ]
          );
          setIsProcessing(false);
          return;
        }
        
        Alert.alert('Restore Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('Restore process error:', error);
      Alert.alert('Restore Failed', error.message || 'An unexpected error occurred during the restore process.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle emergency recovery
  const handleEmergencyRecovery = async (fileContent: string, passphrase: string) => {
    try {
      Alert.alert(
        'Emergency Recovery',
        'This will attempt to recover your data by bypassing integrity checks. This may result in corrupted data if the passphrase is incorrect. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            style: 'destructive',
            onPress: async () => {
              setIsProcessing(true);
              try {
                // Try emergency recovery
                await database.recoverBackupEmergency(fileContent, passphrase);
                
                // Reset state
                setRestoreDialogVisible(false);
                setSelectedBackupFile(null);
                setRestorePassphrase('');
                
                Alert.alert(
                  'Recovery Successful', 
                  'Your data has been recovered. Please check that everything was restored correctly. The app will now restart.',
                  [
                    { 
                      text: 'OK', 
                      onPress: () => {
                        // Restart app or reload data
                        navigation.navigate('Home');
                      } 
                    }
                  ]
                );
              } catch (recoveryError: any) {
                console.error('Emergency recovery error:', recoveryError);
                Alert.alert(
                  'Recovery Failed',
                  recoveryError.message || 'Emergency recovery failed. The backup may be severely corrupted or the passphrase is incorrect.'
                );
              } finally {
                setIsProcessing(false);
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error setting up emergency recovery:', error);
      Alert.alert('Error', 'Failed to set up emergency recovery');
    }
  };
  
  // Export unencrypted data for troubleshooting
  const handleExportUnencryptedData = async () => {
    try {
      // Show a message about photo inclusion
      Alert.alert(
        'Photo Inclusion Warning',
        'This unencrypted backup will include all contact photos and uploaded images. This increases backup file size and exposes private photos. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            style: 'destructive',
            onPress: async () => {
              try {
                const data = await database.exportUnencryptedData();
                
                // Generate a filename with the date
                const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
                const filename = `contact_manager_unencrypted_backup_${timestamp}.json`;
                
                // Save to temporary file
                const tempDir = FileSystem.cacheDirectory + 'backups/';
                const dirInfo = await FileSystem.getInfoAsync(tempDir);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
                }
                
                const filePath = tempDir + filename;
                await FileSystem.writeAsStringAsync(filePath, data);
                
                // Get file size info
                const fileInfo = await FileSystem.getInfoAsync(filePath);
                const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'unknown';
                
                // Share the file
                const shareSuccess = await shareBackupFile(filePath, filename);
                
                // Only show success message if sharing completed successfully
                if (shareSuccess) {
                  // Show success message with file size info
                  Alert.alert(
                    'Unencrypted Backup Created',
                    `Backup file size: ${fileSize} MB\n\nCAUTION: This file contains all your data in plain text format, including photos. Store it securely.`
                  );
                }
              } catch (error: any) {
                console.error('Unencrypted export error:', error);
                Alert.alert('Export Error', error.message || 'Failed to create unencrypted backup');
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error initiating unencrypted export:', error);
      Alert.alert('Error', error.message || 'Failed to start unencrypted export process');
    }
  };
  
  // Import unencrypted data for troubleshooting
  const handleImportUnencryptedData = async () => {
    try {
      // Pick file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        return;
      }
      
      // Get the selected file
      const file = result.assets[0];
      
      if (!file) {
        Alert.alert('File Selection Error', 'No file was selected.');
        return;
      }
      
      // Validate file extension - only allow JSON files for unencrypted backups
      const fileExtension = file.uri.split('.').pop()?.toLowerCase();
      
      if (fileExtension !== 'json') {
        Alert.alert(
          'Invalid File Type', 
          'Please select a JSON backup file (.json) for unencrypted import'
        );
        return;
      }
      
      // Confirm import
      Alert.alert(
        'Unencrypted Import Confirmation', 
        'This will replace ALL your data with the contents of the selected backup file. This cannot be undone. Continue?',
        [
          { 
            text: 'Cancel', 
            style: 'cancel' 
          },
          { 
            text: 'Import', 
            style: 'destructive',
            onPress: async () => {
              setIsProcessing(true);
              try {
                // Read file content
                const fileContent = await FileSystem.readAsStringAsync(file.uri);
                
                // Import the data
                await database.importUnencryptedData(fileContent);
                
                Alert.alert(
                  'Import Successful', 
                  'Your data has been restored from the unencrypted backup. The app will now restart.',
                  [
                    { 
                      text: 'OK', 
                      onPress: () => navigation.navigate('Home')
                    }
                  ]
                );
              } catch (error: any) {
                console.error('Unencrypted import error:', error);
                Alert.alert('Import Failed', error.message || 'An unknown error occurred.');
              } finally {
                setIsProcessing(false);
              }
            } 
          }
        ]
      );
    } catch (error: any) {
      console.error('File selection error:', error);
      Alert.alert('Error', 'Failed to select or process the backup file.');
    }
  };
  
  // Create test encrypted backup file (for debugging purposes only)
  const createTestBackup = async () => {
    try {
      setIsProcessing(true);
      
      // Create a very simple backup content
      const simpleBackupData = {
        test: true,
        message: 'This is a test backup file',
        timestamp: Date.now()
      };
      
      // Generate a simple passphrase for testing
      const testPassphrase = 'testpassphrase123';
      
      // Generate salt and IV
      const salt = Array.from(new Uint8Array(16).map(() => Math.floor(Math.random() * 256)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      const iv = Array.from(new Uint8Array(16).map(() => Math.floor(Math.random() * 256)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Simple "encryption" via XOR with the passphrase
      const dataBytes = new TextEncoder().encode(JSON.stringify(simpleBackupData));
      const keyBytes = new TextEncoder().encode(testPassphrase);
      const encryptedBytes = new Uint8Array(dataBytes.length);
      
      for (let i = 0; i < dataBytes.length; i++) {
        encryptedBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      
      // Convert to hex string
      const encryptedHex = Array.from(encryptedBytes)
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Create the encrypted package
      const encryptedPackage = {
        salt,
        iv,
        data: encryptedHex,
        // Add a proper HMAC as we do in the actual export
        hmac: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          testPassphrase + dataBytes.join(',')
        )
      };
      
      // Create file
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const filename = `test_backup_${timestamp}.cmb`;
      const tempDir = FileSystem.cacheDirectory + 'backups/';
      const dirInfo = await FileSystem.getInfoAsync(tempDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      }
      
      const filePath = tempDir + filename;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(encryptedPackage));
      
      // Save the test passphrase and file path for easy testing
      setTestBackupInfo({
        passphrase: testPassphrase,
        filePath
      });
      
      // Share the file for testing
      const shareSuccess = await shareBackupFile(filePath, filename);
      
      Alert.alert(
        'Test Backup Created',
        `A simple test backup has been created with passphrase: "${testPassphrase}"\n\nUse this file to test the restore functionality.`,
        [
          {
            text: 'Test Import Now',
            onPress: () => {
              // Set up for immediate testing
              setSelectedBackupFile(filePath);
              setRestorePassphrase(testPassphrase);
              setRestoreDialogVisible(true);
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      console.error('Error creating test backup:', error);
      Alert.alert('Test Failed', error.message || 'Failed to create test backup');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Add state for test backup info
  const [testBackupInfo, setTestBackupInfo] = useState<{passphrase: string, filePath: string} | null>(null);

  // Test import function
  const testImportNow = () => {
    if (testBackupInfo) {
      setSelectedBackupFile(testBackupInfo.filePath);
      setRestorePassphrase(testBackupInfo.passphrase);
      setRestoreDialogVisible(true);
    } else {
      Alert.alert('No Test Backup', 'Please create a test backup first');
    }
  };
  
  // Reset interaction types from YAML configuration
  const handleResetInteractionTypes = async () => {
    Alert.alert(
      'Reset Interaction Types',
      'This will reset all interaction types to the configuration defined in the YAML file. Any custom interaction types will be lost. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const success = await InteractionConfigManager.resetInteractionTypes();
              
              if (success) {
                Alert.alert(
                  'Reset Successful',
                  'All interaction types have been reset according to the YAML configuration.'
                );
              } else {
                Alert.alert(
                  'Reset Failed',
                  'Failed to reset interaction types. Check logs for details.'
                );
              }
            } catch (error: any) {
              console.error('Error resetting interaction types:', error);
              Alert.alert('Error', 'An error occurred while resetting interaction types: ' + error.message);
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };
  
  // Add a state variable for entity list limit
  const [entityListLimit, setEntityListLimit] = useState<number>(50); // Default to 50
  const [entityLimitDialogVisible, setEntityLimitDialogVisible] = useState(false);
  
  // Load entity list limit preference on mount
  useEffect(() => {
    const loadEntityListLimit = async () => {
      try {
        const savedLimit = await AsyncStorage.getItem('entityListLimit');
        if (savedLimit !== null) {
          setEntityListLimit(Number(savedLimit));
        }
      } catch (error) {
        console.error('Error loading entity list limit preference:', error);
      }
    };
    
    loadEntityListLimit();
  }, []);
  
  // Save entity list limit preference
  const saveEntityListLimit = async (limit: number) => {
    try {
      await AsyncStorage.setItem('entityListLimit', String(limit));
      setEntityListLimit(limit);
      setEntityLimitDialogVisible(false);
    } catch (error) {
      console.error('Error saving entity list limit preference:', error);
    }
  };
  
  // Render the entity list limit dialog
  const renderEntityLimitDialog = () => (
    <Portal>
      <Dialog
        visible={entityLimitDialogVisible}
        onDismiss={() => setEntityLimitDialogVisible(false)}
      >
        <Dialog.Title>Entity List Limit</Dialog.Title>
        <Dialog.Content>
          <RadioButton.Group 
            onValueChange={(value) => saveEntityListLimit(Number(value))} 
            value={String(entityListLimit)}
          >
            <RadioButton.Item label="20 entities" value="20" />
            <RadioButton.Item label="50 entities" value="50" />
            <RadioButton.Item label="100 entities" value="100" />
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setEntityLimitDialogVisible(false)}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* User Interface Section - Moved to the top */}
        <List.Section>
          <List.Subheader>User Interface</List.Subheader>
          <List.Item
            title="Entity List Limit"
            description={`Display ${entityListLimit} entities at a time`}
            left={props => <List.Icon {...props} icon="format-list-numbered" />}
            onPress={() => setEntityLimitDialogVisible(true)}
          />
        </List.Section>
        
        {/* Notification Section */}
        <List.Section>
          <List.Subheader>Notifications</List.Subheader>
          <List.Item
            title="Notification Manager"
            description="View and manage scheduled notifications"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate('NotificationManager')}
          />
        </List.Section>
        
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
        
        {/* Interaction Types Management Card */}
        <Card style={styles.card}>
          <Card.Title 
            title="Interaction Types" 
            subtitle="Manage custom interaction types" 
          />
          <Card.Content>
            <Text style={styles.sectionDescription}>
              Create and manage interaction types that can be used when recording interactions.
              Customize icons, colors, and which entity types they apply to.
            </Text>
            
            <Button 
              mode="contained"
              icon="lightning-bolt"
              onPress={() => navigation.navigate('InteractionTypes')}
              style={styles.button}
            >
              Manage Interaction Types
            </Button>
          </Card.Content>
        </Card>
        
        {/* Feature Flags Toggle */}
        <Card style={styles.card}>
          <Card.Title title="Advanced Settings" subtitle="Manage advanced and experimental features" />
          <Card.Content>
            <List.Item
              title="Enable Feature Flags"
              description="Show experimental and development features"
              left={props => <List.Icon {...props} icon="flag-variant" />}
              right={props => (
                <Switch
                  value={showFeatureFlags}
                  onValueChange={setShowFeatureFlags}
                />
              )}
            />
          </Card.Content>
        </Card>
        
        {/* Feature Flags Section - Only visible if toggled */}
        {showFeatureFlags && (
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
                  description="Show button to generate random historical interactions on entity detail screen"
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
                      onValueChange={() => {
                        toggleFeatureFlag('ENABLE_DATA_RESET');
                        // If enabling, show message
                        if (!featureFlags.ENABLE_DATA_RESET) {
                          Alert.alert(
                            "Feature Enabled",
                            "Please close and reopen the Settings screen to access the reset all data option.",
                            [{ text: "OK" }]
                          );
                        }
                      }}
                    />
                  )}
                />
                
                <List.Item
                  title="Unencrypted Backup"
                  description="Allow unencrypted backups (security risk)"
                  left={props => <List.Icon {...props} icon="shield-alert" />}
                  right={props => (
                    <Switch
                      value={featureFlags.ENABLE_UNENCRYPTED_BACKUP}
                      onValueChange={() => toggleFeatureFlag('ENABLE_UNENCRYPTED_BACKUP')}
                    />
                  )}
                />
                
                <List.Item
                  title="Interaction Config Reset"
                  description="Allow resetting interaction types from YAML config"
                  left={props => <List.Icon {...props} icon="database-refresh" />}
                  right={props => (
                    <Switch
                      value={featureFlags.ENABLE_INTERACTION_CONFIG_RESET}
                      onValueChange={() => toggleFeatureFlag('ENABLE_INTERACTION_CONFIG_RESET')}
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
                  title="Birthday Display"
                  description="Show upcoming birthdays section on home screen"
                  left={props => <List.Icon {...props} icon="cake-variant" />}
                  right={props => (
                    <Switch
                      value={featureFlags.ENABLE_BIRTHDAY_DISPLAY}
                      onValueChange={() => toggleFeatureFlag('ENABLE_BIRTHDAY_DISPLAY')}
                    />
                  )}
                />
                
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
        )}
        
        {/* Backup and Restore Card */}
        <Card style={styles.card}>
          <Card.Title 
            title="Data Backup & Restore" 
            subtitle="Securely export and import your data" 
          />
          <Card.Content>
            <Text style={styles.description}>
              Export your data with encryption or import from a previous backup.
              A 6-word passphrase is required to protect your data.
            </Text>
            
            <Button 
              mode="contained" 
              onPress={showBackupDialog}
              style={[styles.button, { marginTop: 16 }]}
              icon="cloud-upload"
            >
              Export Encrypted Backup
            </Button>
            
            <Button 
              mode="outlined" 
              onPress={showRestoreDialog}
              style={[styles.button, { marginTop: 8 }]}
              icon="cloud-download"
            >
              Restore From Backup
            </Button>
          </Card.Content>
        </Card>
        
        {/* Data Management Card - Only visible if ENABLE_DATA_RESET is enabled */}
        {isFeatureEnabledSync('ENABLE_DATA_RESET') && (
          <Card style={styles.card}>
            <Card.Title 
              title="Data Management" 
              subtitle="Advanced options" 
            />
            <Card.Content>
              <Text style={styles.description}>
                These actions permanently affect your data. Please use with caution.
              </Text>
              
              <Button 
                mode="outlined" 
                onPress={handleRegenerateDefaults}
                style={styles.actionButton}
                loading={regeneratingDefaults}
                disabled={isProcessing || regeneratingDefaults}
                icon="refresh"
              >
                Reset to Default Actions
              </Button>
              <Text style={styles.helperText}>
                This will reset ALL interaction types to their defaults. Any customizations will be lost.
              </Text>
              
              <Divider style={{marginVertical: 16}} />
              
              <Text style={styles.description}>
                Encrypted backup and restore options:
              </Text>
              
              <Button 
                mode="contained" 
                onPress={showBackupDialog}
                style={[styles.button, { marginTop: 8 }]}
                icon="cloud-upload"
                disabled={isProcessing}
              >
                Export Encrypted Backup
              </Button>
              
              <Button 
                mode="outlined" 
                onPress={showRestoreDialog}
                style={[styles.button, { marginTop: 8 }]}
                icon="cloud-download"
                disabled={isProcessing}
              >
                Restore From Backup
              </Button>
              
              <Divider style={{marginVertical: 16}} />
              
              <Text style={styles.dangerText}>
                Danger zone - actions below cannot be undone.
              </Text>
              
              <Button 
                mode="outlined" 
                onPress={() => setResetDataDialogVisible(true)}
                style={styles.dangerButton}
                labelStyle={{color: '#d32f2f'}}
                icon="delete-forever"
                disabled={isProcessing}
              >
                Reset All Data
              </Button>
            </Card.Content>
          </Card>
        )}
        
        {/* Troubleshooting Card - Only visible if ENABLE_UNENCRYPTED_BACKUP is enabled */}
        {isFeatureEnabledSync('ENABLE_UNENCRYPTED_BACKUP') && (
          <Card style={styles.card}>
            <Card.Title 
              title="Troubleshooting" 
              subtitle="Unencrypted backup options" 
            />
            <Card.Content>
              <Text style={styles.description}>
                Use these options only for troubleshooting backup and restore issues.
                <Text style={{fontWeight: 'bold', color: '#d32f2f'}}> Warning: Data is not encrypted!</Text>
              </Text>
              
              <Button 
                mode="outlined" 
                onPress={handleExportUnencryptedData}
                style={[styles.button, { marginTop: 8 }]}
                icon="file-export"
                disabled={isProcessing}
              >
                Export Unencrypted Backup
              </Button>
              
              <Button 
                mode="outlined" 
                onPress={handleImportUnencryptedData}
                style={[styles.button, { marginTop: 8 }]}
                icon="file-import"
                disabled={isProcessing}
              >
                Import Unencrypted Backup
              </Button>

              <Divider style={{marginVertical: 16}} />

              {__DEV__ && (
                <>
                  <Button 
                    mode="outlined" 
                    onPress={createTestBackup}
                    style={[styles.button, { marginTop: 8 }]}
                    icon="bug"
                    disabled={isProcessing}
                  >
                    Create Test Backup
                  </Button>
                  
                  {testBackupInfo && (
                    <Button 
                      mode="outlined" 
                      onPress={testImportNow}
                      style={[styles.button, { marginTop: 8 }]}
                      icon="database-import"
                      disabled={isProcessing}
                    >
                      Test Import (Uses Test Backup)
                    </Button>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        )}
        
        {isFeatureEnabledSync('ENABLE_INTERACTION_CONFIG_RESET') && (
          <Card style={styles.card}>
            <Card.Title 
              title="Interaction Configuration" 
              subtitle="Manage interaction types from YAML"
            />
            <Card.Content>
              <Text style={styles.description}>
                Reset interaction types according to the YAML configuration file. 
                This is useful for development and testing.
              </Text>
              
              <Button 
                mode="outlined" 
                onPress={handleResetInteractionTypes}
                style={styles.actionButton}
                loading={isProcessing}
                disabled={isProcessing}
                icon="database-refresh"
              >
                Reset Interaction Types from YAML
              </Button>
            </Card.Content>
          </Card>
        )}
        
        <Card style={styles.card}>
          <Card.Title title="About" />
          <Card.Content>
            <Text style={styles.aboutText}>
              PimGarden v1.0.0
            </Text>
            <Text style={styles.aboutText}>
              Developed by Noah Zitsman
            </Text>
            <Text style={styles.aboutText}>
              Privacy-focused contact management for modern life.
            </Text>
            <Text style={[styles.aboutText, { marginTop: 8 }]}>
              PimGarden respects your privacy:
            </Text>
            <Text style={[styles.aboutText, { marginLeft: 8 }]}>
              • No spyware or tracking
            </Text>
            <Text style={[styles.aboutText, { marginLeft: 8 }]}>
              • All data stays on your device
            </Text>
            <Text style={[styles.aboutText, { marginLeft: 8 }]}>
              • Data only leaves your device when you explicitly export it
            </Text>
          </Card.Content>
        </Card>
        
        {renderEntityLimitDialog()}
        
        <Portal>
          <Dialog visible={resetDialogVisible} onDismiss={() => setResetDialogVisible(false)}>
            <Dialog.Title>Reset Feature Flags</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to reset all feature flags to their default values? This cannot be undone.</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setResetDialogVisible(false)}>Cancel</Button>
              <Button onPress={resetFeatureFlags}>Reset</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        <Portal>
          <Dialog visible={resetDataDialogVisible} onDismiss={() => setResetDataDialogVisible(false)}>
            <Dialog.Title>Reset All Data</Dialog.Title>
            <Dialog.Content>
              <Text style={{ marginBottom: 10 }}>Are you absolutely sure you want to reset all data? This will delete all your contacts, entities, interactions, and settings.</Text>
              <Text style={{ color: '#d32f2f', fontWeight: 'bold' }}>This action CANNOT be undone!</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setResetDataDialogVisible(false)}>Cancel</Button>
              <Button 
                onPress={() => {
                  setResetDataDialogVisible(false);
                  setResetDataConfirmDialogVisible(true);
                }}
                color="#d32f2f"
              >
                Continue
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        <Portal>
          <Dialog 
            visible={resetDataConfirmDialogVisible} 
            onDismiss={() => setResetDataConfirmDialogVisible(false)}
          >
            <Dialog.Title>Final Confirmation</Dialog.Title>
            <Dialog.Content>
              <Text style={{ marginBottom: 10 }}>
                This is your final warning.
              </Text>
              <Text style={{ marginBottom: 10 }}>
                All data will be permanently deleted and cannot be recovered unless you have created a backup.
              </Text>
              <Text style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                Are you absolutely sure you want to continue?
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setResetDataConfirmDialogVisible(false)}>
                Cancel
              </Button>
              <Button 
                onPress={resetAllData}
                color="#d32f2f"
              >
                Reset All Data
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        <Portal>
          <Dialog
            visible={regenerateSuccessDialogVisible}
            onDismiss={() => setRegenerateSuccessDialogVisible(false)}
          >
            <Dialog.Title>Success</Dialog.Title>
            <Dialog.Content>
              <Text>Default interaction types have been regenerated successfully.</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setRegenerateSuccessDialogVisible(false)}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        <Portal>
          <Dialog
            visible={backupDialogVisible}
            onDismiss={() => {
              if (!isProcessing) setBackupDialogVisible(false);
            }}
          >
            <Dialog.Title>Create Encrypted Backup</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogDescription}>
                Enter a passphrase to encrypt your backup. 
                This is required to restore your data later.
              </Text>
              
              <TextInput
                label="Passphrase"
                value={passphrase}
                onChangeText={handlePassphraseChange}
                secureTextEntry={true}
                style={styles.input}
                disabled={isProcessing}
              />
              
              <View style={styles.passphraseHintContainer}>
                <Text style={styles.passphraseHintText}>
                  Use a strong 6-word passphrase for better security or generate one automatically.
                </Text>
                <Button 
                  mode="text" 
                  onPress={handleGeneratePassphrase}
                  disabled={isProcessing}
                  compact
                >
                  Generate Passphrase
                </Button>
              </View>
              
              <HelperText type="error" visible={!!passphraseError}>
                {passphraseError}
              </HelperText>
              
              {isProcessing && (
                <ActivityIndicator 
                  animating={true} 
                  size="large" 
                  style={styles.activityIndicator} 
                />
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button 
                onPress={() => setBackupDialogVisible(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                onPress={handleExportData}
                disabled={isProcessing || !isValidPassphrase(passphrase)}
              >
                Export
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        <Portal>
          <Dialog
            visible={restoreDialogVisible}
            onDismiss={() => {
              if (!isProcessing) setRestoreDialogVisible(false);
            }}
          >
            <Dialog.Title>Restore from Backup</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.dialogDescription}>
                Select a backup file and enter the passphrase you used when creating the backup.
              </Text>
              
              <View style={styles.filePickerContainer}>
                <Text style={styles.filePickerLabel}>
                  {selectedBackupFile 
                    ? `Selected: ${selectedBackupFile.split('/').pop()}` 
                    : 'No file selected'}
                </Text>
                <Button 
                  mode="outlined" 
                  onPress={pickBackupFile}
                  disabled={isProcessing}
                  style={styles.filePickerButton}
                >
                  Select File
                </Button>
              </View>
              
              <TextInput
                label="Passphrase"
                value={restorePassphrase}
                onChangeText={handleRestorePassphraseChange}
                secureTextEntry={true}
                style={styles.input}
                disabled={isProcessing}
              />
              
              <HelperText type="error" visible={!!restoreError}>
                {restoreError}
              </HelperText>
              
              {isProcessing && (
                <ActivityIndicator 
                  animating={true} 
                  size="large" 
                  style={styles.activityIndicator} 
                />
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button 
                onPress={() => setRestoreDialogVisible(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                onPress={handleImportData}
                disabled={isProcessing || !selectedBackupFile || !restorePassphrase}
              >
                Restore
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
    paddingTop: 20,
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
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
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
  actionButton: {
    marginTop: 10,
    marginBottom: 4,
    borderColor: '#2196F3',
  },
  input: {
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  selectedFile: {
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    color: '#666666',
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeButton: {
    margin: 0,
  },
  passphraseDisplay: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  generatedPassphrase: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2196F3',
  },
  filePathText: {
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  helperText: {
    marginTop: 8,
    marginBottom: 16,
    color: '#666',
  },
  dialogDescription: {
    marginBottom: 16,
  },
  passphraseHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passphraseHintText: {
    marginRight: 8,
  },
  filePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filePickerLabel: {
    flex: 1,
  },
  filePickerButton: {
    marginLeft: 8,
  },
  activityIndicator: {
    marginTop: 16,
  },
});

export default SettingsScreen; 