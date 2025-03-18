import * as FileSystem from 'expo-file-system';
import * as yaml from 'js-yaml';
import { database } from '../database/Database';

// Define the structure for interaction configuration
interface InteractionConfig {
  name: string;
  icon: string;
  entityTypes: string[] | null;
  tags: string[] | null;
  score: number;
  color: string;
}

// Define the structure for tag configuration
interface TagConfig {
  name: string;
  icon?: string;
  color?: string;
}

// Define the structure for the entire configuration file
interface ConfigFile {
  interactions: InteractionConfig[];
  tags: TagConfig[];
}

export class InteractionConfigManager {
  
  private static CONFIG_FILE = 'default-interactions.yaml';
  private static CONFIG_PATH = FileSystem.documentDirectory + 'config/';
  private static ASSET_CONFIG_PATH = './assets/config/';
  private static isInitialized = false;
  
  /**
   * Initialize the configuration system
   * This copies the default configuration file from the bundle to the document directory if it doesn't exist
   * and ensures interaction types are loaded into the database.
   */
  static async init(): Promise<void> {
    try {
      // Skip if already initialized
      if (this.isInitialized) {
        console.log('[InteractionConfigManager] Already initialized, skipping');
        return;
      }
      
      console.log('[InteractionConfigManager] Initializing configuration...');
      
      // Make sure the config directory exists
      const dirInfo = await FileSystem.getInfoAsync(this.CONFIG_PATH);
      console.log('[InteractionConfigManager] Config directory exists:', dirInfo.exists, 'at path:', this.CONFIG_PATH);
      
      if (!dirInfo.exists) {
        console.log('[InteractionConfigManager] Creating config directory...');
        await FileSystem.makeDirectoryAsync(this.CONFIG_PATH, { intermediates: true });
        console.log('[InteractionConfigManager] Config directory created');
      }
      
      // Check if config file exists in document directory
      const configFilePath = this.CONFIG_PATH + this.CONFIG_FILE;
      const configFileInfo = await FileSystem.getInfoAsync(configFilePath);
      console.log('[InteractionConfigManager] Config file exists:', configFileInfo.exists, 'at path:', configFilePath);
      
      // Check the database for existing interaction types
      const interactionTypesCount = await this.getInteractionTypeCount();
      console.log(`[InteractionConfigManager] Found ${interactionTypesCount} interaction types in database`);
      
      // If we don't have any interaction types, load them from the config
      if (interactionTypesCount === 0) {
        console.log('[InteractionConfigManager] No interaction types found in database, loading from config');
        const config = await this.loadConfig();
        
        if (config && config.interactions && config.interactions.length > 0) {
          console.log(`[InteractionConfigManager] Loaded ${config.interactions.length} interaction types from config`);
          await this.applyConfig(config);
        } else {
          console.warn('[InteractionConfigManager] Failed to load interaction types from config');
        }
      } else {
        console.log('[InteractionConfigManager] Interaction types already exist in database, skipping initialization');
      }
      
      this.isInitialized = true;
      console.log('[InteractionConfigManager] Initialization complete');
    } catch (error) {
      console.error('[InteractionConfigManager] Error initializing interaction config:', error);
      // Don't throw - allow the app to continue even if interaction config fails
      // Defaults will be used from the database's initDefaultInteractionTypes method
    }
  }
  
  /**
   * Get the number of interaction types in the database
   */
  private static async getInteractionTypeCount(): Promise<number> {
    try {
      const result = await database.getInteractionTypesCount();
      return result;
    } catch (error) {
      console.error('[InteractionConfigManager] Error getting interaction type count:', error);
      return 0;
    }
  }
  
  /**
   * Read the embedded default configuration directly from the project
   */
  static async getDefaultConfig(): Promise<string> {
    try {
      console.log('[InteractionConfigManager] Getting default config...');
      
      // Try all possible locations
      const possiblePaths = [
        './src/config/' + this.CONFIG_FILE,
        './assets/config/' + this.CONFIG_FILE,
        'src/config/' + this.CONFIG_FILE,
        'assets/config/' + this.CONFIG_FILE,
        FileSystem.documentDirectory + 'src/config/' + this.CONFIG_FILE,
        FileSystem.documentDirectory + 'assets/config/' + this.CONFIG_FILE,
        // Add our custom plugin paths for iOS
        FileSystem.bundleDirectory + 'src-config-default-interactions.yaml',
        FileSystem.bundleDirectory + 'assets-config-default-interactions.yaml',
        // More Android specific paths
        FileSystem.bundleDirectory + 'assets/src/config/' + this.CONFIG_FILE,
        FileSystem.bundleDirectory + 'assets/assets/config/' + this.CONFIG_FILE,
        // Raw asset paths that might work
        'asset:/src/config/' + this.CONFIG_FILE,
        'asset:/assets/config/' + this.CONFIG_FILE
      ];
      
      for (const path of possiblePaths) {
        try {
          console.log('[InteractionConfigManager] Trying path:', path);
          const fileInfo = await FileSystem.getInfoAsync(path);
          console.log('[InteractionConfigManager] File exists at path:', path, fileInfo.exists);
          
          if (fileInfo.exists) {
            const content = await FileSystem.readAsStringAsync(path);
            console.log('[InteractionConfigManager] Successfully read config from path:', path);
            return content;
          }
        } catch (pathError) {
          console.log('[InteractionConfigManager] Error reading from path:', path, pathError);
          // Continue to next path
        }
      }
      
      // If all paths fail, use the hardcoded default without writing to filesystem
      console.log('[InteractionConfigManager] All file paths failed, using hardcoded defaults');
      return this.getHardcodedDefaultConfig();
    } catch (error) {
      // If that fails, return the hardcoded default
      console.warn('[InteractionConfigManager] Error reading default config, using embedded fallback:', error);
      return this.getHardcodedDefaultConfig();
    }
  }
  
  /**
   * Get a hardcoded default configuration as a string
   */
  static getHardcodedDefaultConfig(): string {
    console.log('[InteractionConfigManager] Using hardcoded default configuration');
    return `
# Default Interaction Types Configuration
interactions:
  - name: General Contact
    icon: account-check
    entityTypes: null
    tags: null
    score: 1
    color: "#666666"
  
  - name: Message
    icon: message-text
    entityTypes: [person]
    tags: null
    score: 1
    color: "#666666"
  
  - name: Phone Call
    icon: phone
    entityTypes: [person]
    tags: null
    score: 1
    color: "#666666"
  
  - name: Coffee
    icon: coffee
    entityTypes: [person]
    tags: null
    score: 2
    color: "#7F5539"
  
  - name: Birthday
    icon: cake
    entityTypes: [person, pet]
    tags: null
    score: 5
    color: "#FF4081"
  
  - name: Book Started
    icon: book-open-page-variant
    entityTypes: null
    tags: [book]
    score: 3
    color: "#26A69A"
  
  - name: Book Progress
    icon: book-open-variant
    entityTypes: null
    tags: [book]
    score: 1
    color: "#29B6F6"
  
  - name: Book Finished
    icon: book-check
    entityTypes: null
    tags: [book]
    score: 5
    color: "#5C6BC0"

tags:
  - name: family
    icon: account-group
    color: "#EC407A"
    
  - name: friend
    icon: account
    color: "#5C6BC0"
    
  - name: pet
    icon: paw
    color: "#8D6E63"
    
  - name: book
    icon: book
    color: "#26A69A"
`;
  }
  
  /**
   * Load the configuration from the YAML file
   */
  static async loadConfig(): Promise<ConfigFile | null> {
    try {
      console.log('[InteractionConfigManager] Loading configuration...');
      // Get the config file path
      const configFilePath = this.CONFIG_PATH + this.CONFIG_FILE;
      console.log('[InteractionConfigManager] Config file path:', configFilePath);
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(configFilePath);
      console.log('[InteractionConfigManager] Config file exists:', fileInfo.exists);
      
      let yamlContent: string;
      
      if (fileInfo.exists) {
        // Read the YAML file
        console.log('[InteractionConfigManager] Reading YAML file content...');
        yamlContent = await FileSystem.readAsStringAsync(configFilePath);
        console.log('[InteractionConfigManager] YAML content length:', yamlContent.length);
        // Log the first 100 characters to see if it's valid
        console.log('[InteractionConfigManager] YAML content start:', yamlContent.substring(0, 100));
        console.log('[InteractionConfigManager] YAML content end:', yamlContent.substring(yamlContent.length - 100));
      } else {
        // Use default config without saving to filesystem
        console.log('[InteractionConfigManager] Config file not found, using hardcoded config');
        yamlContent = this.getHardcodedDefaultConfig();
        console.log('[InteractionConfigManager] Hardcoded config length:', yamlContent.length);
      }
      
      // Parse the YAML
      console.log('[InteractionConfigManager] Parsing YAML content...');
      try {
        const config = yaml.load(yamlContent) as ConfigFile;
        
        // Validate the basic structure of the config
        if (!config || !config.interactions || !Array.isArray(config.interactions)) {
          console.error('[InteractionConfigManager] Invalid config structure, missing interactions array');
          return null;
        }
        
        console.log('[InteractionConfigManager] YAML parsed successfully');
        console.log('[InteractionConfigManager] Config contains:', 
          config.interactions?.length || 0, 'interactions,', 
          config.tags?.length || 0, 'tags');
        
        // Log each interaction name to verify the full list was parsed
        if (config.interactions) {
          console.log('[InteractionConfigManager] Parsed interactions:');
          config.interactions.forEach((interaction, index) => {
            console.log(`   ${index + 1}. ${interaction.name || 'Unnamed'} (${interaction.entityTypes ? 'Entity: ' + interaction.entityTypes : 'All entities'}, ${interaction.tags ? 'Tags: ' + interaction.tags.join(', ') : 'No tags'})`);
          });
        }
        
        return config;
      } catch (parseError) {
        console.error('[InteractionConfigManager] Error parsing YAML:', parseError);
        
        // Use hardcoded defaults as fallback
        console.log('[InteractionConfigManager] Falling back to hardcoded defaults due to parse error');
        const hardcodedYaml = this.getHardcodedDefaultConfig();
        const hardcodedConfig = yaml.load(hardcodedYaml) as ConfigFile;
        
        return hardcodedConfig;
      }
    } catch (error) {
      console.error('[InteractionConfigManager] Error loading interaction config:', error);
      
      // Final fallback - parse the hardcoded defaults
      try {
        console.log('[InteractionConfigManager] Final fallback - using hardcoded defaults');
        const hardcodedYaml = this.getHardcodedDefaultConfig();
        return yaml.load(hardcodedYaml) as ConfigFile;
      } catch {
        return null;
      }
    }
  }
  
  /**
   * Reset all interaction types based on the configuration file
   */
  static async resetInteractionTypes(): Promise<boolean> {
    try {
      console.log('[InteractionConfigManager] Resetting interaction types from config file...');
      
      // Initialize if needed
      await this.init();
      
      // Load the configuration
      const config = await this.loadConfig();
      if (!config) {
        console.error('[InteractionConfigManager] Failed to load configuration, using hardcoded defaults');
        // Use hardcoded defaults directly
        const yamlString = this.getHardcodedDefaultConfig();
        const config = yaml.load(yamlString) as ConfigFile;
        console.log('[InteractionConfigManager] Loaded hardcoded config with', 
          config.interactions?.length || 0, 'interactions and',
          config.tags?.length || 0, 'tags');
          
        return await this.applyConfig(config);
      }
      
      // Apply the loaded configuration
      return await this.applyConfig(config);
    } catch (error) {
      console.error('[InteractionConfigManager] Error resetting interaction types:', error);
      return false;
    }
  }
  
  /**
   * Apply the configuration to reset interaction types
   */
  static async applyConfig(configOverride?: ConfigFile): Promise<boolean> {
    try {
      // Load the configuration if not provided
      const config = configOverride || await this.loadConfig();
      if (!config) {
        throw new Error('Failed to load configuration');
      }
      
      console.log('[InteractionConfigManager] Applying configuration with', 
        config.interactions?.length || 0, 'interactions and',
        config.tags?.length || 0, 'tags');
      
      // Log the entire config to verify it's complete
      if (config.interactions) {
        console.log('[InteractionConfigManager] Interactions to apply:');
        config.interactions.forEach((interaction, index) => {
          console.log(`   ${index + 1}. ${interaction.name || 'Unnamed'} (${interaction.entityTypes ? 'Entity: ' + JSON.stringify(interaction.entityTypes) : 'All entities'}, ${interaction.tags ? 'Tags: ' + JSON.stringify(interaction.tags) : 'No tags'})`);
        });
      }
      
      // Start a transaction
      await database.beginTransaction();
      
      try {
        // First, make sure all the required tags exist
        const tagMap = new Map<string, string>(); // Map tag names to IDs
        
        if (config.tags && Array.isArray(config.tags)) {
          for (const tagConfig of config.tags) {
            const tagId = await this.ensureTagExists(tagConfig);
            tagMap.set(tagConfig.name, tagId);
            console.log('[InteractionConfigManager] Ensured tag exists:', tagConfig.name, 'with ID:', tagId);
          }
        }
        
        // Clear existing interaction types
        await database.clearInteractionTypes();
        console.log('[InteractionConfigManager] Cleared existing interaction types');
        
        // Reset the interaction types
        let createdCount = 0;
        if (config.interactions && Array.isArray(config.interactions)) {
          for (const interactionConfig of config.interactions) {
            // For each interaction, find tag IDs
            let tagId: string | null = null;
            const relatedTagIds: string[] = [];
            
            if (interactionConfig.tags && interactionConfig.tags.length > 0) {
              for (let i = 0; i < interactionConfig.tags.length; i++) {
                const tagName = interactionConfig.tags[i];
                if (tagMap.has(tagName)) {
                  const id = tagMap.get(tagName)!;
                  if (i === 0) {
                    // First tag is the primary
                    tagId = id;
                  } else {
                    // Other tags are related
                    relatedTagIds.push(id);
                  }
                }
              }
            }
            
            // Get entityType (use first one if multiple)
            const entityType = interactionConfig.entityTypes && interactionConfig.entityTypes.length > 0
              ? interactionConfig.entityTypes[0]
              : null;
            
            // Generate ID
            const id = await database.generatePublicId();
            
            try {
              // Create the interaction type
              await database.createInteractionTypeFromConfig(
                id,
                interactionConfig.name,
                tagId,
                interactionConfig.icon,
                entityType,
                interactionConfig.score,
                interactionConfig.color
              );
              
              createdCount++;
              console.log('[InteractionConfigManager] Created interaction type:', 
                interactionConfig.name,
                'for tag:', tagId ? 'Tag ID: ' + tagId : 'No tag',
                'and entity type:', entityType || 'All'
              );
              
              // Associate with related tags
              for (const relatedTagId of relatedTagIds) {
                await database.associateInteractionTypeWithTag(id, relatedTagId);
                console.log('[InteractionConfigManager] Associated type', interactionConfig.name, 'with related tag ID:', relatedTagId);
              }
            } catch (createError) {
              console.error('[InteractionConfigManager] Error creating interaction type:', interactionConfig.name, createError);
            }
          }
        }
        
        // Commit the transaction
        await database.commitTransaction();
        console.log(`[InteractionConfigManager] Successfully reset interaction types. Created ${createdCount} of ${config.interactions?.length || 0} types.`);
        return true;
      } catch (error) {
        // Rollback on error
        await database.rollbackTransaction();
        console.error('[InteractionConfigManager] Error during configuration application, rolling back:', error);
        throw error;
      }
    } catch (error) {
      console.error('[InteractionConfigManager] Error applying configuration:', error);
      return false;
    }
  }
  
  /**
   * Ensure a tag exists in the database
   */
  private static async ensureTagExists(tagConfig: TagConfig): Promise<string> {
    const existingTag = await database.getTagByName(tagConfig.name);
    
    if (existingTag) {
      return existingTag.id;
    }
    
    // Create the tag if it doesn't exist
    return await database.addTag(tagConfig.name);
  }
} 