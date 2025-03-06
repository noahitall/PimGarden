/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags that can be toggled to enable/disable
 * certain features in the application. This is useful for:
 * - Development features that shouldn't be visible in production
 * - A/B testing different features
 * - Gradually rolling out new features
 * - Quickly disabling problematic features without code changes
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for feature flags
export const FEATURE_FLAGS_STORAGE_KEY = 'contact_manager_feature_flags';

// Default feature flag configuration
export const FeatureFlags = {
  // Development features
  SHOW_DEBUG_BUTTON: false, // Keep disabled for production builds
  ENABLE_HISTORICAL_INTERACTIONS: false, // Controls the button to generate random historical interactions on entity detail screen
  ENABLE_DATA_RESET: false, // Debug feature for resetting all data
  
  // Feature toggles - enable stable features for production
  ENABLE_MERGE_FEATURE: true,
  ENABLE_CONTACT_IMPORT: true,
  
  // Experimental features - consider if these are ready for production
  ENABLE_YEARLY_SPARKLINES: true, // This feature is stable enough for production
};

// Cache for runtime feature flag values
let runtimeFeatureFlags: Record<string, boolean> | null = null;

// Helper function to check if a feature is enabled
export const isFeatureEnabled = async (featureName: keyof typeof FeatureFlags): Promise<boolean> => {
  // Try to load runtime flags if not already loaded
  if (runtimeFeatureFlags === null) {
    try {
      const savedFlags = await AsyncStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
      if (savedFlags) {
        runtimeFeatureFlags = {...FeatureFlags, ...JSON.parse(savedFlags)};
      } else {
        runtimeFeatureFlags = {...FeatureFlags};
      }
    } catch (error) {
      console.error('Error loading feature flags:', error);
      runtimeFeatureFlags = {...FeatureFlags};
    }
  }
  
  // Always enable all features in development mode if not explicitly disabled
  if (__DEV__ && runtimeFeatureFlags[featureName] !== false) {
    return true;
  }
  
  return runtimeFeatureFlags[featureName] === true;
};

// Synchronous version for components that can't use async
export const isFeatureEnabledSync = (featureName: keyof typeof FeatureFlags): boolean => {
  // If runtime flags aren't loaded yet, use defaults
  if (runtimeFeatureFlags === null) {
    // Always enable all features in development mode if not explicitly disabled
    if (__DEV__ && FeatureFlags[featureName] !== false) {
      return true;
    }
    return FeatureFlags[featureName] === true;
  }
  
  // Make a local reference to avoid null checks
  const flags = runtimeFeatureFlags;
  
  // Always enable all features in development mode if not explicitly disabled
  if (__DEV__ && flags[featureName] !== false) {
    return true;
  }
  
  return flags[featureName] === true;
};

// Function to update the runtime feature flags
export const updateFeatureFlag = async (
  featureName: keyof typeof FeatureFlags, 
  value: boolean
): Promise<void> => {
  try {
    // Initialize runtime flags if not already done
    if (runtimeFeatureFlags === null) {
      const savedFlags = await AsyncStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
      if (savedFlags) {
        runtimeFeatureFlags = {...FeatureFlags, ...JSON.parse(savedFlags)};
      } else {
        runtimeFeatureFlags = {...FeatureFlags};
      }
    }
    
    // Update the runtime flags
    runtimeFeatureFlags = {
      ...runtimeFeatureFlags,
      [featureName]: value
    };
    
    // Save to AsyncStorage
    await AsyncStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(runtimeFeatureFlags));
  } catch (error) {
    console.error('Error updating feature flag:', error);
  }
}; 