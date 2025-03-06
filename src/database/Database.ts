import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { format } from 'date-fns';
import * as Random from 'expo-random';
import * as FileSystem from 'expo-file-system';

// Entity types
export enum EntityType {
  PERSON = 'person',
  GROUP = 'group',
  TOPIC = 'topic',
}

// Entity interface
interface Entity {
  id: string;
  name: string;
  type: string;
  details: string | null;
  image: string | null;
  interaction_score: number;
  created_at: number;
  updated_at: number;
  encrypted_data: string | null;
}

// Interaction interface
interface Interaction {
  id: string;
  entity_id: string;
  timestamp: number;
  type: string; // Added interaction type field
}

// InteractionType interface
export interface InteractionType {
  id: string;
  name: string;
  tag_id: string | null; // Associated tag (or null for generic types)
  icon: string; // Material icon name
  entity_type: string | null; // Associated entity type (or null for all types)
  score: number; // Score value for this interaction type
  color: string; // Color for the interaction type
}

// EntityPhoto interface
interface EntityPhoto {
  id: string;
  entity_id: string;
  uri: string;
  caption: string | null;
  timestamp: number;
  base64Data?: string;
}

// Tag interface
export interface Tag {
  id: string;
  name: string;
  count: number; // Number of entities using this tag
}

// EntityTag interface (relationship between entities and tags)
interface EntityTag {
  entity_id: string;
  tag_id: string;
}

// Define local interfaces for contact data
interface PhoneNumber {
  id: string;
  value: string;
  label: string;
  isPrimary: boolean;
}

interface EmailAddress {
  id: string;
  value: string;
  label: string;
  isPrimary: boolean;
}

interface PhysicalAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label: string;
  isPrimary: boolean;
  formattedAddress?: string;
}

interface ContactData {
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
  physicalAddresses: PhysicalAddress[];
}

// Define local Person interface that extends Entity
interface PersonEntity extends Entity {
  type: string;
  phone?: string;
  email?: string;
  address?: string;
  contactData?: ContactData;
}

// Settings interface
export interface AppSettings {
  decayFactor: number; // 0 = no decay, 1 = full decay after one day
  decayType: string; // 'linear', 'exponential', 'logarithmic'
}

// Add a type definition for photos with base64 data
interface EntityPhotoWithData extends EntityPhoto {
  base64Data?: string;
}

// Database class to handle all database operations
export class Database {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync('entities.db');
    this.init();
  }

  // Initialize database tables
  private async init(): Promise<void> {
    // Create tables if they don't exist
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        details TEXT,
        image TEXT,
        interaction_score INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        encrypted_data TEXT
      );
    `);

    // Create interactions table to track timestamps
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT,
        type_id TEXT,
        notes TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE,
        FOREIGN KEY (type_id) REFERENCES interaction_types (id) ON DELETE SET NULL
      );
    `);
    
    // Create group_members table to track group membership
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (group_id, member_id),
        FOREIGN KEY (group_id) REFERENCES entities (id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES entities (id) ON DELETE CASCADE
      );
    `);
    
    // Run migrations to update schema if needed
    await this.runMigrations();
    
    // Create entity_photos table to store additional photos
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS entity_photos (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        uri TEXT NOT NULL,
        caption TEXT,
        timestamp INTEGER NOT NULL,
        base64Data TEXT,
        FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
      );
    `);
    
    // Create tags table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        count INTEGER DEFAULT 0
      );
    `);
    
    // Create entity_tags junction table (for many-to-many relationship)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS entity_tags (
        entity_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (entity_id, tag_id),
        FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      );
    `);
    
    // Initialize default tags
    await this.initDefaultTags();
    
    // Initialize default interaction types
    this.initDefaultInteractionTypes();
    
    // Create settings table during initialization
    await this.createSettingsTable();
  }
  
  // Run database migrations to update schema
  private async runMigrations(): Promise<void> {
    try {
      // Check current database version
      const versionResult = await this.db.getFirstAsync<{ version: number }>(
        'PRAGMA user_version'
      );
      
      const currentVersion = versionResult?.version || 0;
      
      console.log('Current database version:', currentVersion);
      
      // Run migrations based on current version
      if (currentVersion < 1) {
        console.log('Running migration 1: Create initial tables');
        await this.createInitialTables();
        console.log('Setting database version to 1');
        await this.db.runAsync(`PRAGMA user_version = 1`);
      }
      
      if (currentVersion < 2) {
        console.log('Running migration 2: Add interaction type field');
        await this.addInteractionTypeField();
        console.log('Setting database version to 2');
        await this.db.runAsync(`PRAGMA user_version = 2`);
      }
      
      if (currentVersion < 3) {
        console.log('Running migration 3: Add tags support');
        await this.addTagsSupport();
        console.log('Setting database version to 3');
        await this.db.runAsync(`PRAGMA user_version = 3`);
      }
      
      if (currentVersion < 4) {
        console.log('Running migration 4: Add multiple tags and entity type support');
        await this.addMultipleTagsAndEntityTypeSupport();
        console.log('Setting database version to 4');
        await this.db.runAsync(`PRAGMA user_version = 4`);
      }
      
      if (currentVersion < 5) {
        console.log('Running migration 5: Add favorites support');
        await this.addFavoritesSupport();
        console.log('Setting database version to 5');
        await this.db.runAsync(`PRAGMA user_version = 5`);
      }
      
      if (currentVersion < 6) {
        console.log('Running migration 6: Add interaction score support');
        await this.addInteractionScoreSupport();
        console.log('Setting database version to 6');
        await this.db.runAsync(`PRAGMA user_version = 6`);
      }
      
      if (currentVersion < 7) {
        console.log('Running migration 7: Update interactions table');
        await this.updateInteractionsTable();
        console.log('Setting database version to 7');
        await this.db.runAsync(`PRAGMA user_version = 7`);
      }
      
      if (currentVersion < 8) {
        console.log('Running migration 8: Add interaction color support');
        await this.addInteractionColorSupport();
        console.log('Setting database version to 8');
        await this.db.runAsync(`PRAGMA user_version = 8`);
      }
      
      console.log('All migrations completed. Current version:', await this.db.getFirstAsync('PRAGMA user_version'));
      
    } catch (error) {
      console.error('Error running migrations:', error);
    }
  }
  
  // Migration to add color column to interaction_types
  private async addInteractionColorSupport(): Promise<void> {
    try {
      // Check if color column exists in interaction_types table
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(interaction_types)"
      );
      
      const hasColorColumn = tableInfo.some(column => column.name === 'color');
      
      if (!hasColorColumn) {
        // Add color column to interaction_types table
        await this.db.runAsync(
          "ALTER TABLE interaction_types ADD COLUMN color TEXT DEFAULT '#666666'"
        );
        
        // Update existing interaction types to have a default color
        await this.db.runAsync(
          "UPDATE interaction_types SET color = '#666666'"
        );
        
        console.log('Added color column to interaction_types table');
      }
    } catch (error) {
      console.error('Error adding interaction color support:', error);
      throw error;
    }
  }
  
  // Migration to update interactions table
  private async updateInteractionsTable(): Promise<void> {
    try {
      // Check if type_id column exists in interactions table
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(interactions)"
      );
      
      // Add type column if it doesn't exist
      if (!tableInfo.some(column => column.name === 'type')) {
        await this.db.runAsync(
          "ALTER TABLE interactions ADD COLUMN type TEXT"
        );
        console.log('Added type column to interactions table');
      }
      
      // Add type_id column if it doesn't exist
      if (!tableInfo.some(column => column.name === 'type_id')) {
        await this.db.runAsync(
          "ALTER TABLE interactions ADD COLUMN type_id TEXT REFERENCES interaction_types(id) ON DELETE SET NULL"
        );
        console.log('Added type_id column to interactions table');
      }
      
      // Add notes column if it doesn't exist
      if (!tableInfo.some(column => column.name === 'notes')) {
        await this.db.runAsync(
          "ALTER TABLE interactions ADD COLUMN notes TEXT"
        );
        console.log('Added notes column to interactions table');
      }
      
      // Update type_id for existing interactions based on type name
      await this.db.runAsync(`
        UPDATE interactions
        SET type_id = (
          SELECT id FROM interaction_types 
          WHERE name = interactions.type
          LIMIT 1
        )
        WHERE type IS NOT NULL AND type_id IS NULL
      `);
      console.log('Updated type_id for existing interactions');
      
    } catch (error) {
      console.error('Error updating interactions table:', error);
      throw error;
    }
  }
  
  // Add interaction scoring support
  private async addInteractionScoreSupport(): Promise<void> {
    try {
      // Check if score column exists in interaction_types table
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(interaction_types)"
      );
      
      const hasScoreColumn = tableInfo.some(column => column.name === 'score');
      
      if (!hasScoreColumn) {
        // Add score column to interaction_types table
        await this.db.runAsync(
          "ALTER TABLE interaction_types ADD COLUMN score INTEGER DEFAULT 1"
        );
        
        // Update existing interaction types to have a default score of 1
        await this.db.runAsync(
          "UPDATE interaction_types SET score = 1"
        );
        
        console.log('Added score column to interaction_types table');
      }
    } catch (error) {
      console.error('Error adding interaction score support:', error);
      throw error;
    }
  }

  // Migration 1: Create initial tables
  private async createInitialTables(): Promise<void> {
    try {
      // Create entities table
      await this.db.runAsync(`
        CREATE TABLE IF NOT EXISTS entities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          details TEXT,
          image TEXT,
          interaction_score INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          encrypted_data TEXT
        )
      `);
      
      // Create interactions table
      await this.db.runAsync(`
        CREATE TABLE IF NOT EXISTS interactions (
          id TEXT PRIMARY KEY,
          entity_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
        )
      `);
      
      // Create entity_photos table
      await this.db.runAsync(`
        CREATE TABLE IF NOT EXISTS entity_photos (
          id TEXT PRIMARY KEY,
          entity_id TEXT NOT NULL,
          uri TEXT NOT NULL,
          caption TEXT,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
        )
      `);
      
      console.log('Created initial tables');
    } catch (error) {
      console.error('Error creating initial tables:', error);
    }
  }
  
  // Migration 2: Add interaction type field
  private async addInteractionTypeField(): Promise<void> {
    try {
      console.log('Starting migration: Add interaction type field');
      
      // Check if interactions table already has a type column
      const interactionsTableInfo = await this.db.getAllAsync("PRAGMA table_info(interactions)");
      const hasTypeColumn = interactionsTableInfo.some((column: any) => column.name === 'type');
      
      if (!hasTypeColumn) {
        // Add type column to interactions table
        console.log('Adding type column to interactions table');
        await this.db.runAsync(`
          ALTER TABLE interactions ADD COLUMN type TEXT DEFAULT "General Contact"
        `);
      } else {
        console.log('Interactions table already has type column, skipping');
      }
      
      // Check if interaction_types table exists
      const tables = await this.db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='interaction_types'");
      if (tables.length === 0) {
        console.log('Creating interaction_types table');
        // Create interaction_types table
        await this.db.runAsync(`
          CREATE TABLE IF NOT EXISTS interaction_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tag_id TEXT,
            icon TEXT NOT NULL,
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
          )
        `);
        
        // Initialize default interaction types
        await this.initDefaultInteractionTypes();
      } else {
        console.log('interaction_types table already exists, skipping');
      }
      
      console.log('Completed migration: Add interaction type field');
    } catch (error) {
      console.error('Error in migration addInteractionTypeField:', error);
    }
  }
  
  // Migration 3: Add tags support
  private async addTagsSupport(): Promise<void> {
    try {
      // Create tags table
      await this.db.runAsync(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        )
      `);
      
      // Create entity_tags junction table
      await this.db.runAsync(`
        CREATE TABLE IF NOT EXISTS entity_tags (
          entity_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (entity_id, tag_id),
          FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
        )
      `);
      
      console.log('Added tags support');
    } catch (error) {
      console.error('Error adding tags support:', error);
    }
  }

  // Initialize default tags
  private async initDefaultTags(): Promise<void> {
    const defaultTags = [
      { name: 'family' },
      { name: 'friend' },
      { name: 'pet' },
      { name: 'book' }
    ];
    
    for (const tag of defaultTags) {
      // Check if tag already exists
      const existingTag = await this.db.getAllAsync(
        'SELECT * FROM tags WHERE name COLLATE NOCASE = ?',
        [tag.name]
      );
      
      if (existingTag.length === 0) {
        const id = await this.generateId();
        await this.db.runAsync(
          'INSERT INTO tags (id, name, count) VALUES (?, ?, ?)',
          [id, tag.name, 0]
        );
      }
    }
  }

  // Initialize default interaction types
  private async initDefaultInteractionTypes(): Promise<void> {
    // Get tags for interactions
    const familyTag = await this.db.getFirstAsync<{id: string}>(
      'SELECT id FROM tags WHERE name COLLATE NOCASE = ?',
      ['family']
    );
    
    const friendTag = await this.db.getFirstAsync<{id: string}>(
      'SELECT id FROM tags WHERE name COLLATE NOCASE = ?',
      ['friend']
    );
    
    const petTag = await this.db.getFirstAsync<{id: string}>(
      'SELECT id FROM tags WHERE name COLLATE NOCASE = ?',
      ['pet']
    );
    
    const bookTag = await this.db.getFirstAsync<{id: string}>(
      'SELECT id FROM tags WHERE name COLLATE NOCASE = ?',
      ['book']
    );
    
    const familyTagId = familyTag?.id || null;
    const friendTagId = friendTag?.id || null;
    const petTagId = petTag?.id || null;
    const bookTagId = bookTag?.id || null;
    
    const defaultTypes = [
      { name: 'General Contact', icon: 'account-check', tag_id: null, entity_type: null, score: 1, color: '#666666' },
      { name: 'Message', icon: 'message-text', tag_id: null, entity_type: null, score: 1, color: '#666666' },
      { name: 'Phone Call', icon: 'phone', tag_id: null, entity_type: null, score: 1, color: '#666666' },
      { name: 'Meeting', icon: 'account-group', tag_id: null, entity_type: null, score: 1, color: '#666666' },
      { name: 'Email', icon: 'email', tag_id: null, entity_type: null, score: 1, color: '#666666' },
      { name: 'Coffee', icon: 'coffee', tag_id: null, entity_type: EntityType.PERSON, score: 2, color: '#7F5539' },
      { name: 'Birthday', icon: 'cake', tag_id: null, entity_type: EntityType.PERSON, score: 5, color: '#FF4081' },
      
      // Special interaction types for pet tag
      { name: 'Birthday', icon: 'cake-variant', tag_id: petTagId, entity_type: null, score: 5, color: '#FF8A65' },
      { name: 'Vet Visit', icon: 'hospital-box', tag_id: petTagId, entity_type: null, score: 3, color: '#42A5F5' },
      { name: 'Grooming', icon: 'content-cut', tag_id: petTagId, entity_type: null, score: 2, color: '#66BB6A' },
      { name: 'Walk', icon: 'walk', tag_id: petTagId, entity_type: null, score: 1, color: '#8D6E63' },
      
      // Book-related interaction types
      { name: 'Book Started', icon: 'book-open-page-variant', tag_id: bookTagId, entity_type: null, score: 3, color: '#26A69A' },
      { name: 'Book Progress', icon: 'book-open-variant', tag_id: bookTagId, entity_type: null, score: 1, color: '#29B6F6' },
      { name: 'Book Finished', icon: 'book-check', tag_id: bookTagId, entity_type: null, score: 5, color: '#5C6BC0' },
      { name: 'Book Discussion', icon: 'forum', tag_id: bookTagId, entity_type: null, score: 2, color: '#AB47BC' },
      
      // Family-specific interaction types
      { name: 'Family Dinner', icon: 'food-variant', tag_id: familyTagId, entity_type: null, score: 2, color: '#EC407A' },
      { name: 'Family Call', icon: 'phone', tag_id: familyTagId, entity_type: null, score: 2, color: '#7E57C2' },
      { name: 'Visit', icon: 'home', tag_id: familyTagId, entity_type: null, score: 3, color: '#26A69A' },
      
      // Friend-specific interaction types
      { name: 'Catch Up', icon: 'chat', tag_id: friendTagId, entity_type: null, score: 2, color: '#FF7043' },
      { name: 'Hangout', icon: 'glass-cocktail', tag_id: friendTagId, entity_type: null, score: 2, color: '#5C6BC0' },
      { name: 'Coffee', icon: 'coffee', tag_id: friendTagId, entity_type: null, score: 2, color: '#7F5539' }
    ];
    
    for (const type of defaultTypes) {
      // Check if type already exists
      const existingType = await this.db.getAllAsync(
        'SELECT * FROM interaction_types WHERE name = ? AND (tag_id = ? OR (tag_id IS NULL AND ? IS NULL))',
        [type.name, type.tag_id, type.tag_id]
      );
      
      if (existingType.length === 0) {
        const id = await this.generateId();
        
        // Check if all columns exist
        try {
          await this.db.runAsync(
            'INSERT INTO interaction_types (id, name, tag_id, icon, entity_type, score, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, type.name, type.tag_id, type.icon, type.entity_type, type.score, type.color]
          );
        } catch (error) {
          // Fall back to earlier schema if needed
          console.log('Falling back to basic interaction type schema');
          await this.db.runAsync(
            'INSERT INTO interaction_types (id, name, tag_id, icon) VALUES (?, ?, ?, ?)',
            [id, type.name, type.tag_id, type.icon]
          );
        }
      }
    }
  }

  // Generate a unique ID
  private async generateId(): Promise<string> {
    const uuid = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      new Date().toISOString() + Math.random().toString()
    );
    return uuid.substring(0, 10);
  }

  // Encrypt data using a symmetric key
  private async encryptData(data: any): Promise<string> {
    try {
      // Instead of hashing, we'll just JSON stringify the data
      // In a real app, you would use proper encryption
      return JSON.stringify(data);
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw error;
    }
  }

  // Decrypt data using the same symmetric key
  private async decryptData(encryptedData: string): Promise<string> {
    // Since we're just storing JSON strings, we can return it directly
    // In a real app, you would use proper decryption
    return encryptedData;
  }

  // Find duplicate entities based on name and details
  async findDuplicateEntities(
    type: EntityType,
    name: string,
    details: string
  ): Promise<Entity[]> {
    // First, check for exact name matches
    const nameMatches = await this.db.getAllAsync(
      'SELECT * FROM entities WHERE type = ? AND name = ?',
      [type, name]
    ) as Entity[];
    
    if (nameMatches.length > 0) {
      // If we have name matches, check details for phone or email matches
      const duplicates: Entity[] = [];
      
      for (const entity of nameMatches) {
        // If the entity has details that match parts of our details, it's likely a duplicate
        if (entity.details && details) {
          // Extract phone numbers and emails from details
          const phoneMatches = details.match(/\d{10,}/g) || [];
          const emailMatches = details.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
          
          // Check if any phone number or email in our details exists in the entity's details
          const hasPhoneMatch = phoneMatches.some(phone => entity.details?.includes(phone));
          const hasEmailMatch = emailMatches.some(email => entity.details?.includes(email));
          
          if (hasPhoneMatch || hasEmailMatch) {
            duplicates.push(entity);
          }
        }
      }
      
      return duplicates;
    }
    
    return [];
  }

  // Create a new entity
  async createEntity(
    name: string,
    type: EntityType,
    details?: string,
    image?: string,
    additionalData?: any
  ): Promise<string> {
    // Check for duplicates first
    if (details) {
      const duplicates = await this.findDuplicateEntities(type, name, details);
      if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicates for ${name}, not creating new entity`);
        return duplicates[0].id; // Return the ID of the first duplicate
      }
    }
    
    const id = await this.generateId();
    const now = Date.now();
    const encryptedData = additionalData ? await this.encryptData(additionalData) : null;

    const query = `
      INSERT INTO entities (id, name, type, details, image, interaction_score, created_at, updated_at, encrypted_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    
    await this.db.runAsync(query, [
      id, 
      name, 
      type, 
      details || null, 
      image || null, 
      0, 
      now, 
      now, 
      encryptedData
    ]);
    
    return id;
  }

  // Get all entities
  async getAllEntities(
    type?: EntityType,
    options: {
      sortBy?: 'name' | 'recent_interaction';
      keepFavoritesFirst?: boolean;
    } = {}
  ): Promise<Entity[]> {
    try {
      let query = '';
      const params: any[] = [];

      if (options.keepFavoritesFirst) {
        // Use LEFT JOIN to include all entities, with favorites having value 1 and others 0
        query = `
          SELECT e.*, 
                 CASE WHEN f.entity_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                 MAX(i.timestamp) as last_interaction
          FROM entities e
          LEFT JOIN favorites f ON e.id = f.entity_id
          LEFT JOIN interactions i ON e.id = i.entity_id
        `;
      } else {
        query = `
          SELECT e.*, 
                 MAX(i.timestamp) as last_interaction
          FROM entities e
          LEFT JOIN interactions i ON e.id = i.entity_id
        `;
      }

      if (type) {
        query += ' WHERE e.type = ?';
        params.push(type);
      }

      // Group by to handle the aggregation
      query += ' GROUP BY e.id';

      // Add ORDER BY clause based on sorting options
      const orderClauses: string[] = [];
      
      if (options.keepFavoritesFirst) {
        orderClauses.push('is_favorite DESC');
      }
      
      if (options.sortBy === 'name') {
        orderClauses.push('e.name COLLATE NOCASE ASC');
      } else if (options.sortBy === 'recent_interaction') {
        orderClauses.push('last_interaction DESC NULLS LAST');
      } else {
        // Default sort by updated_at
        orderClauses.push('e.updated_at DESC');
      }
      
      if (orderClauses.length > 0) {
        query += ' ORDER BY ' + orderClauses.join(', ');
      }

      const result = await this.db.getAllAsync(query, params) as (Entity & { is_favorite?: number })[];
      
      // Remove the is_favorite property before returning
      return result.map(({ is_favorite, ...entity }) => entity);
    } catch (error) {
      console.error('Error getting entities:', error);
      return [];
    }
  }

  // Get entity by ID
  async getEntityById(id: string): Promise<Entity | null> {
    const query = 'SELECT * FROM entities WHERE id = ?';
    const result = await this.db.getAllAsync(query, [id]) as Entity[];
    
    if (result.length > 0) {
      return result[0];
    }
    
    return null;
  }

  // Update entity
  async updateEntity(
    id: string,
    updates: {
      name?: string;
      details?: string;
      image?: string;
      additionalData?: any;
    }
  ): Promise<boolean> {
    const entity = await this.getEntityById(id);
    if (!entity) return false;

    const now = Date.now();
    const encryptedData = updates.additionalData 
      ? await this.encryptData(updates.additionalData) 
      : entity.encrypted_data;

    const query = `
      UPDATE entities 
      SET name = ?, details = ?, image = ?, updated_at = ?, encrypted_data = ?
      WHERE id = ?
    `;
    
    const result = await this.db.runAsync(query, [
      updates.name || entity.name,
      updates.details !== undefined ? updates.details : entity.details,
      updates.image !== undefined ? updates.image : entity.image,
      now,
      encryptedData,
      id
    ]);
    
    return result.changes > 0;
  }

  // Delete entity
  async deleteEntity(id: string): Promise<boolean> {
    const query = 'DELETE FROM entities WHERE id = ?';
    const result = await this.db.runAsync(query, [id]);
    return result.changes > 0;
  }

  // Increment interaction score and record interaction
  async incrementInteractionScore(entityId: string, interactionType: string = 'General Contact'): Promise<boolean> {
    try {
      // Check if this is a group
      const entity = await this.getEntityById(entityId);
      if (!entity) return false;
      
      // For groups, propagate the interaction to all members
      if (entity.type === EntityType.GROUP) {
        // Start a transaction
        await this.db.execAsync('BEGIN TRANSACTION');
        
        try {
          // First record for the group itself
          await this._recordSingleEntityInteraction(entityId, interactionType);
          
          // Then record for all members
          const members = await this.getGroupMembers(entityId);
          for (const member of members) {
            await this._recordSingleEntityInteraction(member.id, interactionType);
          }
          
          // Commit the transaction
          await this.db.execAsync('COMMIT');
          return true;
        } catch (error) {
          // Rollback on error
          await this.db.execAsync('ROLLBACK');
          throw error;
        }
      } else {
        // For non-group entities, just record the interaction
        return this._recordSingleEntityInteraction(entityId, interactionType);
      }
    } catch (error) {
      console.error('Error incrementing interaction score:', error);
      return false;
    }
  }
  
  // Internal method to record interaction for a single entity
  private async _recordSingleEntityInteraction(entityId: string, interactionType: string): Promise<boolean> {
    try {
      // Get the interaction type to determine its score
      let interactionScore = 1; // Default score
      
      // Find the interaction type by name
      const interactionTypeRow = await this.db.getFirstAsync<{ id: string, score: number }>(
        'SELECT id, score FROM interaction_types WHERE name = ?',
        [interactionType]
      );
      
      if (interactionTypeRow) {
        interactionScore = interactionTypeRow.score || 1;
      }
      
      // Get the current settings for decay
      const settings = await this.getSettings();
      const decayFactor = settings?.decayFactor || 0;
      const decayType = settings?.decayType || 'linear';
      
      // Record the interaction timestamp with type and type_id
      const interactionId = await this.generateId();
      const timestamp = Date.now();
      const insertQuery = `
        INSERT INTO interactions (id, entity_id, timestamp, type, type_id)
        VALUES (?, ?, ?, ?, ?)
      `;
      await this.db.runAsync(
        insertQuery, 
        [interactionId, entityId, timestamp, interactionType, interactionTypeRow?.id || null]
      );
      
      // Calculate the new interaction score with decay
      const newScore = await this.calculateInteractionScore(entityId, decayFactor, decayType);
      
      // Update the entity with the new score
      const updateQuery = `
        UPDATE entities 
        SET interaction_score = ?, 
            updated_at = ? 
        WHERE id = ?
      `;
      await this.db.runAsync(updateQuery, [newScore, timestamp, entityId]);
      
      return true;
    } catch (error) {
      console.error('Error recording single entity interaction:', error);
      return false;
    }
  }

  // Add a historical interaction with a custom timestamp for debugging
  async addHistoricalInteraction(
    entityId: string,
    timestamp: number,
    interactionType: string = 'General Contact'
  ): Promise<string | null> {
    try {
      // Start a transaction
      await this.db.execAsync('BEGIN TRANSACTION');
      
      // Increment the interaction score for this entity
      await this.db.runAsync(
        `UPDATE entities 
         SET interaction_score = interaction_score + 1, 
             updated_at = ? 
         WHERE id = ?`,
        [timestamp, entityId]
      );
      
      // Generate a unique interaction ID
      const interactionId = await this.generateId();
      
      // Insert the interaction with the historical timestamp
      await this.db.runAsync(
        `INSERT INTO interactions (
          id, entity_id, type, timestamp, notes
        ) VALUES (?, ?, ?, ?, ?)`,
        [interactionId, entityId, interactionType, timestamp, 'Added via debug interface']
      );
      
      // Commit the transaction
      await this.db.execAsync('COMMIT');
      
      console.log(`Added historical interaction for entity ${entityId} with timestamp ${new Date(timestamp).toLocaleString()}`);
      return interactionId;
    } catch (error) {
      // Rollback on error
      await this.db.execAsync('ROLLBACK');
      console.error('Error adding historical interaction:', error);
      return null;
    }
  }

  // Get interaction timestamps for an entity within a date range
  async getInteractionTimestamps(
    entityId: string, 
    startDate: number = Date.now() - (30 * 24 * 60 * 60 * 1000) // Default to last 30 days
  ): Promise<number[]> {
    const query = `
      SELECT timestamp 
      FROM interactions 
      WHERE entity_id = ? AND timestamp >= ? 
      ORDER BY timestamp ASC
    `;
    
    const results = await this.db.getAllAsync(query, [entityId, startDate]);
    return results.map((row: any) => row.timestamp as number);
  }

  // Get detailed interaction logs for an entity
  async getInteractionLogs(
    entityId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ id: string; timestamp: number; formattedDate: string; type: string }[]> {
    try {
      // Check if type column exists yet
      const tableInfo = await this.db.getAllAsync("PRAGMA table_info(interactions)");
      const hasTypeColumn = tableInfo.some((column: any) => column.name === 'type');

      // Construct query based on available columns
      let query: string;
      if (hasTypeColumn) {
        query = `
          SELECT id, timestamp, type
          FROM interactions 
          WHERE entity_id = ? 
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `;
      } else {
        query = `
          SELECT id, timestamp
          FROM interactions 
          WHERE entity_id = ? 
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `;
      }
      
      const results = await this.db.getAllAsync(query, [entityId, limit, offset]);
      
      return results.map((row: any) => {
        const timestamp = row.timestamp as number;
        const date = new Date(timestamp);
        
        // Format date as "Month Day, Year at Hour:Minute AM/PM"
        const formattedDate = date.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        return {
          id: row.id,
          timestamp,
          formattedDate,
          type: row.type || 'General Contact'
        };
      });
    } catch (error) {
      console.error('Error getting interaction logs:', error);
      throw error;
    }
  }

  // Get total count of interactions for an entity
  async getInteractionCount(entityId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM interactions 
      WHERE entity_id = ?
    `;
    
    const result = await this.db.getAllAsync(query, [entityId]);
    return result.length > 0 ? (result[0] as any).count : 0;
  }

  // Get interaction counts by day for the past month
  async getInteractionCountsByDay(entityId: string): Promise<{ date: string; count: number }[]> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Get all interactions in the past 30 days
    const interactions = await this.getInteractionTimestamps(entityId, thirtyDaysAgo);
    
    // Group by day
    const countsByDay: Record<string, number> = {};
    
    // Initialize all days in the past 30 days with 0 count
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      countsByDay[dateString] = 0;
    }
    
    // Count interactions by day
    interactions.forEach(timestamp => {
      const date = new Date(timestamp);
      const dateString = date.toISOString().split('T')[0];
      countsByDay[dateString] = (countsByDay[dateString] || 0) + 1;
    });
    
    // Convert to array format
    return Object.entries(countsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Get interaction counts by month for the past year
  async getInteractionCountsByMonth(entityId: string): Promise<{ month: string; count: number }[]> {
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    
    // Get all interactions in the past year
    const interactions = await this.getInteractionTimestamps(entityId, oneYearAgo);
    
    // Group by month
    const countsByMonth: Record<string, number> = {};
    
    // Initialize all months in the past year with 0 count
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      // Format as YYYY-MM
      const monthString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      countsByMonth[monthString] = 0;
    }
    
    // Count interactions by month
    interactions.forEach(timestamp => {
      const date = new Date(timestamp);
      const monthString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      countsByMonth[monthString] = (countsByMonth[monthString] || 0) + 1;
    });
    
    // Convert to array format
    return Object.entries(countsByMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // Search entities by name, phone number, email, address, or tag names
  async searchEntities(searchTerm: string, type?: EntityType): Promise<Entity[]> {
    if (!searchTerm.trim()) {
      return this.getAllEntities(type);
    }

    const searchPattern = `%${searchTerm}%`;
    const searchTermLower = searchTerm.toLowerCase();
    
    try {
      // Start with entities that match name, details, or tags
      let query = `
        SELECT DISTINCT e.* FROM entities e 
        LEFT JOIN entity_tags et ON e.id = et.entity_id
        LEFT JOIN tags t ON et.tag_id = t.id
        WHERE (e.name LIKE ? OR e.details LIKE ? OR t.name LIKE ?)
      `;
      
      if (type) {
        query += ` AND e.type = ?`;
      }
      
      const params = type 
        ? [searchPattern, searchPattern, searchPattern, type]
        : [searchPattern, searchPattern, searchPattern];
      
      const nameMatchResults = await this.db.getAllAsync<Entity>(query, params);
      const resultMap = new Map<string, Entity>();
      
      // Add name/details/tag matches to result map
      nameMatchResults.forEach(entity => {
        resultMap.set(entity.id, entity);
      });
      
      // For person entities, also search in contact data (stored in encrypted_data)
      if (!type || type === EntityType.PERSON) {
        // Only get person entities not already in our results
        let personQuery = `
          SELECT e.* FROM entities e 
          WHERE e.type = '${EntityType.PERSON}'
        `;
        
        // If we have a specific type that's not PERSON, skip this part
        if (type && type !== EntityType.PERSON) {
          return Array.from(resultMap.values());
        }
        
        // Get all person entities
        const personEntities = await this.db.getAllAsync<Entity>(personQuery);
        
        // Filter for those with matching contact data
        for (const entity of personEntities) {
          // Skip if already in results
          if (resultMap.has(entity.id)) continue;
          
          if (!entity.encrypted_data) continue;
          
          try {
            // Try to parse the contact data
            const encryptedData = entity.encrypted_data;
            let parsedData;
            
            try {
              parsedData = JSON.parse(encryptedData);
            } catch (e) {
              // Log the error but don't stop the search process
              console.error('Error parsing contact data:', e);
              
              // Attempt to repair the corrupted data
              await this.resetCorruptedContactData(entity.id);
              
              // Instead of skipping entirely, set an empty object
              parsedData = {
                phoneNumbers: [],
                emailAddresses: [],
                physicalAddresses: []
              };
            }
            
            // We need to directly access phoneNumbers, emailAddresses, etc. since that's how updatePersonContactData stores them
            const phoneNumbers = parsedData.phoneNumbers || [];
            const emailAddresses = parsedData.emailAddresses || [];
            const physicalAddresses = parsedData.physicalAddresses || [];
            
            // Check phone numbers
            const hasMatchingPhone = phoneNumbers.some((phone: any) => 
              phone.value?.toLowerCase().includes(searchTermLower));
              
            // Check email addresses
            const hasMatchingEmail = emailAddresses.some((email: any) => 
              email.value?.toLowerCase().includes(searchTermLower));
              
            // Check physical addresses
            const hasMatchingAddress = physicalAddresses.some((address: any) => {
              return (
                (address.street && address.street.toLowerCase().includes(searchTermLower)) ||
                (address.city && address.city.toLowerCase().includes(searchTermLower)) ||
                (address.state && address.state.toLowerCase().includes(searchTermLower)) ||
                (address.postalCode && address.postalCode.toLowerCase().includes(searchTermLower)) ||
                (address.formattedAddress && address.formattedAddress.toLowerCase().includes(searchTermLower)) ||
                (address.country && address.country.toLowerCase().includes(searchTermLower))
              );
            });
              
            if (hasMatchingPhone || hasMatchingEmail || hasMatchingAddress) {
              resultMap.set(entity.id, entity);
            }
          } catch (error) {
            console.error('Error searching contact data:', error);
          }
        }
      }
      
      // Convert results map back to array and sort by updated_at
      const results = Array.from(resultMap.values());
      results.sort((a, b) => b.updated_at - a.updated_at);
      
      return results;
    } catch (error) {
      console.error('Error searching entities:', error);
      throw error;
    }
  }

  // Remove duplicate entities
  async removeDuplicates(): Promise<number> {
    let removedCount = 0;
    
    // Get all entities grouped by type
    const entityTypes = [EntityType.PERSON, EntityType.GROUP, EntityType.TOPIC];
    
    for (const type of entityTypes) {
      const entities = await this.getAllEntities(type);
      
      // Track processed entities to avoid checking the same combinations multiple times
      const processedIds = new Set<string>();
      
      // Compare each entity with others of the same type
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        // Skip if already processed
        if (processedIds.has(entity.id)) continue;
        
        // Find duplicates
        const duplicates = await this.findDuplicateEntities(
          type as EntityType,
          entity.name,
          entity.details || ''
        );
        
        // Skip the original entity
        const duplicatesToRemove = duplicates.filter(d => d.id !== entity.id);
        
        // Remove duplicates
        for (const duplicate of duplicatesToRemove) {
          await this.deleteEntity(duplicate.id);
          processedIds.add(duplicate.id);
          removedCount++;
        }
        
        // Mark as processed
        processedIds.add(entity.id);
      }
    }
    
    return removedCount;
  }

  // Add a photo to an entity
  async addEntityPhoto(
    entityId: string,
    uri: string,
    caption?: string
  ): Promise<string> {
    try {
      const photoId = await this.generateId();
      const timestamp = Date.now();
      
      await this.db.runAsync(
        `INSERT INTO entity_photos (id, entity_id, uri, caption, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [photoId, entityId, uri, caption || null, timestamp]
      );
      
      return photoId;
    } catch (error) {
      console.error('Error adding entity photo:', error);
      throw error;
    }
  }
  
  // Get all photos for an entity
  async getEntityPhotos(
    entityId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<EntityPhoto[]> {
    try {
      const result = await this.db.getAllAsync(
        `SELECT * FROM entity_photos
         WHERE entity_id = ?
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
        [entityId, limit, offset]
      );
      
      return result as EntityPhoto[];
    } catch (error) {
      console.error('Error getting entity photos:', error);
      return [];
    }
  }
  
  // Get photo count for an entity
  async getEntityPhotoCount(entityId: string): Promise<number> {
    try {
      const result = await this.db.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) as count FROM entity_photos WHERE entity_id = ?`,
        [entityId]
      );
      
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting entity photo count:', error);
      return 0;
    }
  }
  
  // Delete a photo from an entity
  async deleteEntityPhoto(photoId: string): Promise<boolean> {
    try {
      await this.db.runAsync(
        `DELETE FROM entity_photos WHERE id = ?`,
        [photoId]
      );
      
      return true;
    } catch (error) {
      console.error('Error deleting entity photo:', error);
      return false;
    }
  }

  // Add tag to entity
  async addTagToEntity(entityId: string, tagName: string): Promise<string> {
    try {
      // Normalize tag name (trim and lowercase)
      tagName = tagName.trim();
      if (!tagName) throw new Error('Tag name cannot be empty');
      
      // Begin transaction
      await this.db.runAsync('BEGIN TRANSACTION');
      
      // Check if tag exists
      let tag = await this.db.getFirstAsync<Tag>(
        'SELECT * FROM tags WHERE name = ? COLLATE NOCASE',
        [tagName]
      );
      
      let tagId: string;
      
      // If tag doesn't exist, create it
      if (!tag) {
        tagId = await this.generateId();
        try {
          // Try with count column (normal schema)
          await this.db.runAsync(
            'INSERT INTO tags (id, name, count) VALUES (?, ?, 1)',
            [tagId, tagName]
          );
        } catch (error) {
          // If that fails, try without count column (older schema)
          console.log('Falling back to simpler tags schema without count');
          await this.db.runAsync(
            'INSERT INTO tags (id, name) VALUES (?, ?)',
            [tagId, tagName]
          );
        }
      } else {
        tagId = tag.id;
        
        // Check if entity already has this tag
        const existingRelation = await this.db.getFirstAsync(
          'SELECT * FROM entity_tags WHERE entity_id = ? AND tag_id = ?',
          [entityId, tagId]
        );
        
        if (existingRelation) {
          // Entity already has this tag, rollback and return
          await this.db.runAsync('ROLLBACK');
          return tagId;
        }
        
        // Increment tag count if the column exists
        try {
          await this.db.runAsync(
            'UPDATE tags SET count = count + 1 WHERE id = ?',
            [tagId]
          );
        } catch (error) {
          // Ignore errors if count column doesn't exist
          console.log('Skipping count increment (column might not exist)');
        }
      }
      
      // Create entity-tag relationship
      await this.db.runAsync(
        'INSERT INTO entity_tags (entity_id, tag_id) VALUES (?, ?)',
        [entityId, tagId]
      );
      
      // Commit transaction
      await this.db.runAsync('COMMIT');
      
      return tagId;
    } catch (error) {
      // Rollback transaction on error
      await this.db.runAsync('ROLLBACK');
      console.error('Error adding tag to entity:', error);
      throw error;
    }
  }
  
  // Remove tag from entity
  async removeTagFromEntity(entityId: string, tagId: string): Promise<boolean> {
    try {
      // Begin transaction
      await this.db.runAsync('BEGIN TRANSACTION');
      
      // Remove entity-tag relationship
      await this.db.runAsync(
        'DELETE FROM entity_tags WHERE entity_id = ? AND tag_id = ?',
        [entityId, tagId]
      );
      
      // Decrement tag count
      await this.db.runAsync(
        'UPDATE tags SET count = count - 1 WHERE id = ?',
        [tagId]
      );
      
      // Delete tag if count reaches 0
      await this.db.runAsync(
        'DELETE FROM tags WHERE id = ? AND count <= 0',
        [tagId]
      );
      
      // Commit transaction
      await this.db.runAsync('COMMIT');
      
      return true;
    } catch (error) {
      // Rollback transaction on error
      await this.db.runAsync('ROLLBACK');
      console.error('Error removing tag from entity:', error);
      return false;
    }
  }
  
  // Get all tags for an entity
  async getEntityTags(entityId: string): Promise<Tag[]> {
    try {
      const tags = await this.db.getAllAsync<Tag>(
        `SELECT t.id, t.name, COALESCE(t.count, 0) as count FROM tags t
         JOIN entity_tags et ON t.id = et.tag_id
         WHERE et.entity_id = ?
         ORDER BY t.name COLLATE NOCASE`,
        [entityId]
      );
      
      return tags;
    } catch (error) {
      // If the COALESCE approach fails, try without referencing count column
      try {
        const tags = await this.db.getAllAsync<Tag>(
          `SELECT t.id, t.name, 0 as count FROM tags t
           JOIN entity_tags et ON t.id = et.tag_id
           WHERE et.entity_id = ?
           ORDER BY t.name COLLATE NOCASE`,
          [entityId]
        );
        
        return tags;
      } catch (fallbackError) {
        console.error('Error getting entity tags (even with fallback):', fallbackError);
        return [];
      }
    }
  }
  
  // Get all tags (for autocomplete)
  async getAllTags(searchTerm?: string): Promise<Tag[]> {
    try {
      let query, params: any[] = [];
      
      if (searchTerm) {
        query = 'SELECT id, name, COALESCE(count, 0) as count FROM tags WHERE name LIKE ? ORDER BY name COLLATE NOCASE';
        params.push(`%${searchTerm}%`);
      } else {
        query = 'SELECT id, name, COALESCE(count, 0) as count FROM tags ORDER BY name COLLATE NOCASE';
      }
      
      const tags = await this.db.getAllAsync<Tag>(query, params);
      return tags;
    } catch (error) {
      // If the COALESCE approach fails, try without referencing count column
      try {
        let query, params: any[] = [];
        
        if (searchTerm) {
          query = 'SELECT id, name, 0 as count FROM tags WHERE name LIKE ? ORDER BY name COLLATE NOCASE';
          params.push(`%${searchTerm}%`);
        } else {
          query = 'SELECT id, name, 0 as count FROM tags ORDER BY name COLLATE NOCASE';
        }
        
        const tags = await this.db.getAllAsync<Tag>(query, params);
        return tags;
      } catch (fallbackError) {
        console.error('Error getting all tags (even with fallback):', fallbackError);
        return [];
      }
    }
  }

  // Get all interaction types
  async getInteractionTypes(): Promise<InteractionType[]> {
    try {
      // First try with all columns including color
      try {
        const rows = await this.db.getAllAsync<InteractionType>(
          `SELECT id, name, tag_id, color, icon, entity_type, score FROM interaction_types ORDER BY name`
        );
        
        return rows.map(row => ({
          id: row.id,
          name: row.name,
          tag_id: row.tag_id,
          entity_type: row.entity_type,
          color: row.color || '#666666',
          icon: row.icon,
          score: row.score || 1 // Default to 1 if score is null
        }));
      } catch (error) {
        // If color column doesn't exist yet, try without it
        console.warn('Falling back to query without color column:', error);
        
        const rows = await this.db.getAllAsync<Omit<InteractionType, 'color'>>(
          `SELECT id, name, tag_id, icon, entity_type, score FROM interaction_types ORDER BY name`
        );
        
        return rows.map(row => ({
          id: row.id,
          name: row.name,
          tag_id: row.tag_id,
          entity_type: row.entity_type,
          color: '#666666', // Default color
          icon: row.icon,
          score: row.score || 1
        }));
      }
    } catch (error) {
      console.error('Error getting interaction types:', error);
      return [];
    }
  }

  async getInteractionTypeByID(id: number): Promise<InteractionType | null> {
    try {
      // First try with all columns including color
      try {
        const row = await this.db.getFirstAsync<InteractionType>(
          `SELECT id, name, tag_id, color, icon, entity_type, score FROM interaction_types WHERE id = ?`,
          [id]
        );
        
        if (row) {
          return {
            id: row.id,
            name: row.name,
            tag_id: row.tag_id,
            entity_type: row.entity_type,
            color: row.color || '#666666',
            icon: row.icon,
            score: row.score || 1
          };
        }
        return null;
      } catch (error) {
        // If color column doesn't exist yet, try without it
        console.warn('Falling back to query without color column:', error);
        
        const row = await this.db.getFirstAsync<Omit<InteractionType, 'color'>>(
          `SELECT id, name, tag_id, icon, entity_type, score FROM interaction_types WHERE id = ?`,
          [id]
        );
        
        if (row) {
          return {
            id: row.id,
            name: row.name,
            tag_id: row.tag_id,
            entity_type: row.entity_type,
            color: '#666666', // Default color
            icon: row.icon,
            score: row.score || 1
          };
        }
        return null;
      }
    } catch (error) {
      console.error('Error getting interaction type by ID:', error);
      return null;
    }
  }

  // Get interaction types appropriate for an entity based on its tags and type
  async getEntityInteractionTypes(entityId: string): Promise<InteractionType[]> {
    try {
      console.log(`Getting interaction types for entity ${entityId}`);
      
      // Get the entity to determine its type
      const entity = await this.getEntityById(entityId);
      if (!entity) {
        console.error(`Entity ${entityId} not found`);
        return [];
      }
      
      const entityType = entity.type;
      console.log(`Entity type: ${entityType}`);
      
      // Get all tags associated with this entity
      const entityTags = await this.getEntityTags(entityId);
      console.log(`Entity has ${entityTags.length} tags`);
      
      const entityTagIds = entityTags.map(tag => tag.id);
      
      // Check if current schema has all required columns
      const tableInfo = await this.db.getAllAsync("PRAGMA table_info(interaction_types)");
      const hasColorColumn = tableInfo.some((column: any) => column.name === 'color');
      const hasEntityTypeColumn = tableInfo.some((column: any) => column.name === 'entity_type');
      const hasScoreColumn = tableInfo.some((column: any) => column.name === 'score');
      
      // Initialize empty result array
      let allTypesRaw: any[] = [];
      
      // Get specifically entity type matching interaction types
      const columnSelection = hasColorColumn 
        ? "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.color, interaction_types.score" 
        : "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.score";
      
      // 1. Get all general interaction types (no tag_id and no entity_type or matching entity_type)
      if (hasEntityTypeColumn) {
        try {
          const generalTypesQuery = `
            SELECT ${columnSelection}
            FROM interaction_types
            WHERE tag_id IS NULL AND (entity_type IS NULL OR entity_type = ? OR entity_type LIKE ?)
            ORDER BY interaction_types.name
          `;
          
          // For entity_type, check exact match or if it's included in a JSON array
          const entityTypeLike = `%"${entityType}"%`;
          const generalTypes = await this.db.getAllAsync(generalTypesQuery, [entityType, entityTypeLike]);
          allTypesRaw = [...generalTypes];
        } catch (error) {
          console.warn('Error getting general interaction types with entity_type filter:', error);
        }
      } else {
        // Fallback for older schema without entity_type
        try {
          const generalTypesQuery = `
            SELECT interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon
            FROM interaction_types
            WHERE tag_id IS NULL
            ORDER BY interaction_types.name
          `;
          
          const generalTypes = await this.db.getAllAsync(generalTypesQuery);
          allTypesRaw = [...generalTypes];
        } catch (error) {
          console.warn('Error getting general interaction types (fallback):', error);
        }
      }
      
      // If entity has no tags, return only general interaction types
      if (entityTagIds.length === 0) {
        console.log(`Entity has no tags, returning ${allTypesRaw.length} general interaction types`);
        
        // Add default color and score if missing
        const allTypes = allTypesRaw
          .filter(type => type && type.id) // Filter out any null or invalid types
          .map(type => ({
            id: type.id,
            name: type.name,
            tag_id: type.tag_id,
            entity_type: type.entity_type,
            icon: type.icon || 'account-check',
            score: type.score || 1,
            color: type.color || '#666666'
          })) as InteractionType[];
        
        // Remove duplicates by id
        const interactionTypesMap = new Map<string, InteractionType>();
        allTypes.forEach(type => {
          if (type && type.id && !interactionTypesMap.has(type.id)) {
            interactionTypesMap.set(type.id, type);
          }
        });
        
        return Array.from(interactionTypesMap.values());
      }
      
      // 2. Get tag-specific interaction types with tag_id directly matching entity tags
      try {
        // Create placeholders for the IN clause
        const placeholders = entityTagIds.map(() => '?').join(',');
        
        const tagSpecificQuery = `
          SELECT ${columnSelection}
          FROM interaction_types
          WHERE tag_id IN (${placeholders})
          ORDER BY interaction_types.name
        `;
        
        const tagSpecificTypes = await this.db.getAllAsync(tagSpecificQuery, entityTagIds);
        allTypesRaw = [...allTypesRaw, ...tagSpecificTypes];
      } catch (error) {
        console.warn('Error getting tag-specific interaction types:', error);
      }
      
      // 3. Get all inherited tag-related interaction types
      try {
        // Get all related tags (from groups if this is a person, etc.)
        const relatedTagIds = await this.getInheritedTagIds(entityId);
        
        if (relatedTagIds.length > 0) {
          console.log(`Found ${relatedTagIds.length} inherited tags`);
          
          // Create placeholders for the IN clause
          const placeholders = relatedTagIds.map(() => '?').join(',');
          
          const relatedTagQuery = `
            SELECT ${columnSelection}
            FROM interaction_types
            WHERE tag_id IN (${placeholders})
            ORDER BY interaction_types.name
          `;
          
          const relatedTagTypes = await this.db.getAllAsync(relatedTagQuery, relatedTagIds);
          allTypesRaw = [...allTypesRaw, ...relatedTagTypes];
        }
      } catch (error) {
        console.warn('Error getting inherited tag interaction types:', error);
      }
      
      // 4. Get interaction types from junction table interaction_type_tags
      try {
        const columnSelection = hasColorColumn 
          ? "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.color, interaction_types.score" 
          : "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.score";
        
        const placeholders = entityTagIds.map(() => '?').join(',');
        const junctionQuery = `
          SELECT DISTINCT ${columnSelection}
          FROM interaction_types
          JOIN interaction_type_tags itt ON interaction_types.id = itt.interaction_type_id
          WHERE itt.tag_id IN (${placeholders})
          ORDER BY interaction_types.name
        `;
        
        const junctionTypes = await this.db.getAllAsync(junctionQuery, entityTagIds);
        allTypesRaw = [...allTypesRaw, ...junctionTypes];
      } catch (error) {
        console.warn('Error getting interaction types from junction table:', error);
      }
      
      // 5. Get ALL tag-related interaction types regardless of entity type
      try {
        const columnSelection = hasColorColumn 
          ? "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.color, interaction_types.score" 
          : "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.score";
        
        const placeholders = entityTagIds.map(() => '?').join(',');
        const allTagTypesQuery = `
          SELECT DISTINCT ${columnSelection}
          FROM interaction_types
          JOIN interaction_type_tags itt ON interaction_types.id = itt.interaction_type_id
          WHERE itt.tag_id IN (${placeholders})
          ORDER BY interaction_types.name
        `;
        
        const allTagTypes = await this.db.getAllAsync(allTagTypesQuery, entityTagIds);
        allTypesRaw = [...allTypesRaw, ...allTagTypes];
      } catch (error) {
        console.warn('Error getting all tag-related interaction types:', error);
      }
      
      // Add default color and score if missing and convert to InteractionType objects
      const allTypes = allTypesRaw
        .filter(type => type && type.id) // Filter out any null or invalid types
        .map(type => ({
          id: type.id,
          name: type.name,
          tag_id: type.tag_id,
          entity_type: type.entity_type,
          icon: type.icon || 'account-check',
          score: type.score || 1,
          color: type.color || '#666666'
        })) as InteractionType[];
      
      // Remove duplicates by id
      const interactionTypesMap = new Map<string, InteractionType>();
      allTypes.forEach(type => {
        if (type && type.id && !interactionTypesMap.has(type.id)) {
          interactionTypesMap.set(type.id, type);
        }
      });
      
      return Array.from(interactionTypesMap.values());
    } catch (error) {
      console.error('Error getting entity interaction types:', error);
      return [];
    }
  }

  // Get tag IDs that should be inherited by this entity
  async getInheritedTagIds(entityId: string): Promise<string[]> {
    try {
      // Get entity to determine type
      const entity = await this.getEntityById(entityId);
      if (!entity) return [];
      
      const inheritedTagIds: string[] = [];
      
      // For group entities: include tags from all members
      if (entity.type === 'group') {
        // Get all members of the group
        const memberEntities = await this.getGroupMembers(entityId);
        
        // For each member, get their tags
        for (const memberEntity of memberEntities) {
          if (memberEntity && memberEntity.id) {
            const memberTags = await this.getEntityTags(memberEntity.id);
            memberTags.forEach(tag => {
              if (!inheritedTagIds.includes(tag.id)) {
                inheritedTagIds.push(tag.id);
              }
            });
          }
        }
      }
      
      // For person entities: include tags from groups they belong to
      if (entity.type === 'person') {
        // Find all groups this person belongs to
        const groups = await this.db.getAllAsync<{id: string}>(
          `SELECT entity_id as id FROM group_members WHERE member_id = ?`,
          [entityId]
        );
        
        // For each group, get its tags
        for (const group of groups) {
          const groupTags = await this.getEntityTags(group.id);
          groupTags.forEach(tag => {
            if (!inheritedTagIds.includes(tag.id)) {
              inheritedTagIds.push(tag.id);
            }
          });
        }
      }
      
      return inheritedTagIds;
    } catch (error) {
      console.error('Error getting inherited tag IDs:', error);
      return [];
    }
  }

  // Add a new interaction type
  async addInteractionType(
    name: string, 
    icon: string, 
    tagId: string | null = null, 
    entityType: string | null = null,
    color: string = '#666666',
    score: number = 1
  ): Promise<string> {
    try {
      // Generate a new ID
      const id = await this.generateId();
      
      // Try the new schema first with entity_type, score, and color
      try {
        await this.db.runAsync(
          'INSERT INTO interaction_types (id, name, tag_id, icon, entity_type, score, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, name, tagId, icon, entityType, score, color]
        );
      } catch (error) {
        // Check if we need to add the missing columns first
        try {
          // Check if entity_type column exists
          const tableInfo = await this.db.getAllAsync("PRAGMA table_info(interaction_types)");
          const hasEntityTypeColumn = tableInfo.some((column: any) => column.name === 'entity_type');
          const hasScoreColumn = tableInfo.some((column: any) => column.name === 'score');
          const hasColorColumn = tableInfo.some((column: any) => column.name === 'color');
          
          // Add missing columns if needed
          if (!hasEntityTypeColumn) {
            await this.db.runAsync('ALTER TABLE interaction_types ADD COLUMN entity_type TEXT');
          }
          
          if (!hasScoreColumn) {
            await this.db.runAsync('ALTER TABLE interaction_types ADD COLUMN score INTEGER DEFAULT 1');
          }
          
          if (!hasColorColumn) {
            await this.db.runAsync('ALTER TABLE interaction_types ADD COLUMN color TEXT DEFAULT "#666666"');
          }
          
          // Try insert again after adding columns
          await this.db.runAsync(
            'INSERT INTO interaction_types (id, name, tag_id, icon, entity_type, score, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, name, tagId, icon, entityType, score, color]
          );
        } catch (columnError) {
          // Fall back to basic schema if we can't add columns
          console.warn('Could not add columns to interaction_types table, falling back to basic schema');
          await this.db.runAsync(
            'INSERT INTO interaction_types (id, name, tag_id, icon) VALUES (?, ?, ?, ?)',
            [id, name, tagId, icon]
          );
        }
      }
      
      return id;
    } catch (error) {
      console.error('Error adding interaction type:', error);
      throw error;
    }
  }

  // Associate an interaction type with a tag
  async associateInteractionTypeWithTag(typeId: string, tagId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE interaction_types SET tag_id = ? WHERE id = ?',
      [tagId, typeId]
    );
  }

  // Associate an interaction type with multiple tags
  async associateInteractionTypeWithMultipleTags(typeId: string, tagIds: string[]): Promise<void> {
    try {
      // Start a transaction
      await this.db.runAsync('BEGIN TRANSACTION');
      
      // First remove all existing tag associations
      await this.db.runAsync(
        'DELETE FROM interaction_type_tags WHERE interaction_type_id = ?',
        [typeId]
      );
      
      // For backward compatibility, also clear the tag_id in the main table
      await this.db.runAsync(
        'UPDATE interaction_types SET tag_id = NULL WHERE id = ?',
        [typeId]
      );
      
      // Then add new associations
      if (tagIds.length > 0) {
        for (const tagId of tagIds) {
          if (tagId) {
            try {
              await this.db.runAsync(
                'INSERT INTO interaction_type_tags (interaction_type_id, tag_id) VALUES (?, ?)',
                [typeId, tagId]
              );
              console.log(`Associated interaction type ${typeId} with tag ${tagId}`);
            } catch (err) {
              console.error(`Error associating tag ${tagId} with interaction type ${typeId}:`, err);
            }
          }
        }
      }
      
      // Commit the transaction
      await this.db.runAsync('COMMIT');
      console.log(`Successfully updated tags for interaction type ${typeId}`);
    } catch (error) {
      // Rollback on error
      await this.db.runAsync('ROLLBACK');
      console.error('Error in associateInteractionTypeWithMultipleTags:', error);
      throw error;
    }
  }

  // Associate an interaction type with an entity type
  async associateInteractionTypeWithEntityType(typeId: string, entityType: string | null): Promise<void> {
    await this.db.runAsync(
      'UPDATE interaction_types SET entity_type = ? WHERE id = ?',
      [entityType, typeId]
    );
  }

  // Get tags associated with an interaction type
  async getInteractionTypeTags(typeId: string): Promise<Tag[]> {
    try {
      // First try to get tags from the junction table
      const query = `
        SELECT t.id, t.name, COALESCE(COUNT(et.entity_id), 0) as count
        FROM tags t
        JOIN interaction_type_tags itt ON t.id = itt.tag_id
        LEFT JOIN entity_tags et ON t.id = et.tag_id
        WHERE itt.interaction_type_id = ?
        GROUP BY t.id
        ORDER BY t.name COLLATE NOCASE
      `;
      
      try {
        const tags = await this.db.getAllAsync<Tag>(query, [typeId]);
        
        // If tags were found in the junction table, return them
        if (tags.length > 0) {
          return tags;
        }
      } catch (queryError) {
        console.warn('Error with main interaction type tags query:', queryError);
        // If the first query fails, we'll fall through to the next one
      }
      
      // Try a simpler query without the count and joins if the previous one failed
      try {
        const simpleQuery = `
          SELECT t.id, t.name, 0 as count
          FROM tags t
          JOIN interaction_type_tags itt ON t.id = itt.tag_id
          WHERE itt.interaction_type_id = ?
          GROUP BY t.id
          ORDER BY t.name COLLATE NOCASE
        `;
        
        const tags = await this.db.getAllAsync<Tag>(simpleQuery, [typeId]);
        
        if (tags.length > 0) {
          return tags;
        }
      } catch (simpleQueryError) {
        console.warn('Error with simplified interaction type tags query:', simpleQueryError);
        // If this also fails, we'll try the legacy query
      }
      
      // Otherwise, check if there's a tag_id directly in the interaction_types table (for backward compatibility)
      try {
        const legacyQuery = `
          SELECT t.id, t.name, COALESCE(COUNT(et.entity_id), 0) as count
          FROM tags t
          LEFT JOIN entity_tags et ON t.id = et.tag_id
          WHERE t.id = (SELECT tag_id FROM interaction_types WHERE id = ? AND tag_id IS NOT NULL)
          GROUP BY t.id
          ORDER BY t.name COLLATE NOCASE
        `;
        
        const legacyTags = await this.db.getAllAsync<Tag>(legacyQuery, [typeId]);
        return legacyTags;
      } catch (legacyQueryError) {
        console.warn('Error with legacy interaction type tags query:', legacyQueryError);
        
        // Final fallback - try without count
        const simplestQuery = `
          SELECT t.id, t.name, 0 as count
          FROM tags t
          WHERE t.id = (SELECT tag_id FROM interaction_types WHERE id = ? AND tag_id IS NOT NULL)
        `;
        
        try {
          return await this.db.getAllAsync<Tag>(simplestQuery, [typeId]);
        } catch (finalError) {
          console.error('All interaction type tags queries failed:', finalError);
          return [];
        }
      }
    } catch (error) {
      console.error('Error getting interaction type tags:', error);
      return [];
    }
  }

  // Delete an interaction type
  async deleteInteractionType(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM interaction_types WHERE id = ?', [id]);
  }

  // Create tag-specific interaction types based on tag name
  private async createTagInteractionTypes(tagId: string, tagName: string): Promise<void> {
    // Create appropriate interaction types based on tag name
    // Different tags will have different relevant interaction types
    const interactionTypes: { name: string, icon: string, score?: number, color?: string }[] = [];
    
    const lowerTagName = tagName.toLowerCase();
    
    // Add tag-specific interaction types based on common categories
    if (lowerTagName === 'family' || lowerTagName.includes('family')) {
      interactionTypes.push(
        { name: 'Visit', icon: 'home', score: 3, color: '#26A69A' },
        { name: 'Family Dinner', icon: 'food-variant', score: 2, color: '#EC407A' },
        { name: 'Family Call', icon: 'phone', score: 2, color: '#7E57C2' },
        { name: 'Gift', icon: 'gift', score: 2, color: '#9C27B0' }
      );
    }
    
    if (lowerTagName === 'friend' || lowerTagName.includes('friend')) {
      interactionTypes.push(
        { name: 'Catch Up', icon: 'chat', score: 2, color: '#FF7043' },
        { name: 'Hangout', icon: 'glass-cocktail', score: 2, color: '#5C6BC0' },
        { name: 'Coffee', icon: 'coffee', score: 2, color: '#7F5539' },
        { name: 'Game Night', icon: 'cards', score: 2, color: '#FFA000' }
      );
    }
    
    if (lowerTagName === 'pet' || lowerTagName.includes('pet')) {
      interactionTypes.push(
        { name: 'Birthday', icon: 'cake-variant', score: 5, color: '#FF8A65' },
        { name: 'Vet Visit', icon: 'hospital-box', score: 3, color: '#42A5F5' },
        { name: 'Grooming', icon: 'content-cut', score: 2, color: '#66BB6A' },
        { name: 'Walk', icon: 'walk', score: 1, color: '#8D6E63' },
        { name: 'Training', icon: 'school', score: 2, color: '#AB47BC' },
        { name: 'Playtime', icon: 'toy-brick', score: 1, color: '#4CAF50' }
      );
    }
    
    if (lowerTagName === 'book' || lowerTagName.includes('book')) {
      interactionTypes.push(
        { name: 'Book Started', icon: 'book-open-page-variant', score: 3, color: '#26A69A' },
        { name: 'Book Progress', icon: 'book-open-variant', score: 1, color: '#29B6F6' },
        { name: 'Book Finished', icon: 'book-check', score: 5, color: '#5C6BC0' },
        { name: 'Book Discussion', icon: 'forum', score: 2, color: '#AB47BC' },
        { name: 'Book Club', icon: 'account-group', score: 3, color: '#E64A19' },
        { name: 'Author Event', icon: 'microphone-variant', score: 4, color: '#D32F2F' }
      );
    }
    
    if (lowerTagName.includes('work') || lowerTagName.includes('colleague') || lowerTagName.includes('coworker')) {
      interactionTypes.push(
        { name: 'Meeting', icon: 'calendar', score: 1, color: '#7986CB' },
        { name: 'Presentation', icon: 'presentation', score: 2, color: '#F06292' },
        { name: 'Project Discussion', icon: 'clipboard-text', score: 2, color: '#4DD0E1' },
        { name: 'Coffee Break', icon: 'coffee', score: 1, color: '#7F5539' }
      );
    }
    
    if (lowerTagName.includes('client') || lowerTagName.includes('customer')) {
      interactionTypes.push(
        { name: 'Sales Call', icon: 'phone-in-talk', score: 3, color: '#4CAF50' },
        { name: 'Follow-up', icon: 'arrow-right-circle', score: 2, color: '#FF9800' },
        { name: 'Proposal', icon: 'file-document', score: 3, color: '#2196F3' },
        { name: 'Client Meeting', icon: 'handshake', score: 4, color: '#9C27B0' }
      );
    }
    
    if (lowerTagName.includes('doctor') || lowerTagName.includes('medical') || lowerTagName.includes('health')) {
      interactionTypes.push(
        { name: 'Appointment', icon: 'calendar-check', score: 3, color: '#42A5F5' },
        { name: 'Consultation', icon: 'stethoscope', score: 3, color: '#26A69A' },
        { name: 'Checkup', icon: 'clipboard-pulse', score: 2, color: '#FF5722' }
      );
    }
    
    if (lowerTagName.includes('hobby') || lowerTagName.includes('interest') || lowerTagName.includes('club')) {
      interactionTypes.push(
        { name: 'Activity', icon: 'run', score: 2, color: '#7CB342' },
        { name: 'Discussion', icon: 'forum', score: 1, color: '#9575CD' },
        { name: 'Meeting', icon: 'account-group', score: 2, color: '#FF7043' }
      );
    }
    
    // Add a generic type with the tag name if we haven't added any specific ones
    if (interactionTypes.length === 0) {
      interactionTypes.push({ name: `${tagName} Interaction`, icon: 'star', score: 1, color: '#FBC02D' });
    }
    
    // Create the interaction types and associate them with the tag
    for (const type of interactionTypes) {
      try {
        await this.addInteractionType(
          type.name, 
          type.icon, 
          tagId, 
          null, 
          type.color || '#666666',
          type.score || 1
        );
      } catch (error) {
        console.error(`Error adding interaction type ${type.name} for tag ${tagName}:`, error);
      }
    }
  }

  // Add a new tag
  async addTag(name: string): Promise<string> {
    try {
      // Check if tag already exists (case insensitive)
      const existingTag = await this.db.getAllAsync(
        'SELECT * FROM tags WHERE name COLLATE NOCASE = ?',
        [name.trim()]
      );
      
      if (existingTag.length > 0) {
        // Tag already exists, return its ID
        return (existingTag[0] as any).id;
      }
      
      // Generate a new ID and create the tag
      const id = await this.generateId();
      await this.db.runAsync(
        'INSERT INTO tags (id, name, count) VALUES (?, ?, ?)',
        [id, name.trim(), 0]
      );
      
      // Create interaction types related to this tag
      await this.createTagInteractionTypes(id, name.trim());
      
      return id;
    } catch (error) {
      console.error('Error adding tag:', error);
      throw error;
    }
  }

  // Migration 4: Add support for multiple tags per interaction type and entity type filtering
  private async addMultipleTagsAndEntityTypeSupport(): Promise<void> {
    try {
      console.log('Starting migration: Add multiple tags and entity type support');
      
      // Check if entity_type column already exists to avoid migration errors
      const tableInfo = await this.db.getAllAsync("PRAGMA table_info(interaction_types)");
      const hasEntityTypeColumn = tableInfo.some((column: any) => column.name === 'entity_type');
      
      if (!hasEntityTypeColumn) {
        // Add entity_type column to interaction_types table
        console.log('Adding entity_type column to interaction_types table');
        await this.db.runAsync(`
          ALTER TABLE interaction_types ADD COLUMN entity_type TEXT
        `);
      } else {
        console.log('entity_type column already exists, skipping');
      }
      
      // Check if interaction_type_tags table exists
      const tables = await this.db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='interaction_type_tags'");
      if (tables.length === 0) {
        console.log('Creating interaction_type_tags table');
        // Create junction table for interaction types and tags
        await this.db.runAsync(`
          CREATE TABLE interaction_type_tags (
            interaction_type_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            PRIMARY KEY (interaction_type_id, tag_id),
            FOREIGN KEY (interaction_type_id) REFERENCES interaction_types (id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
          )
        `);
        
        // Migrate existing tag_id values to the junction table
        console.log('Migrating existing tag associations to junction table');
        await this.db.runAsync(`
          INSERT OR IGNORE INTO interaction_type_tags (interaction_type_id, tag_id)
          SELECT id, tag_id FROM interaction_types
          WHERE tag_id IS NOT NULL
        `);
      } else {
        console.log('interaction_type_tags table already exists, skipping');
      }
      
      console.log('Completed migration: Add multiple tags and entity type support');
    } catch (error) {
      console.error('Error in migration addMultipleTagsAndEntityTypeSupport:', error);
    }
  }

  // Migration 5: Add favorites support
  private async addFavoritesSupport(): Promise<void> {
    try {
      // Check if favorites table exists
      const tables = await this.db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='favorites'");
      if (tables.length === 0) {
        console.log('Creating favorites table');
        // Create favorites table
        await this.db.runAsync(`
          CREATE TABLE IF NOT EXISTS favorites (
            entity_id TEXT PRIMARY KEY,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
          )
        `);
      } else {
        console.log('Favorites table already exists, skipping');
      }
    } catch (error) {
      console.error('Error adding favorites support:', error);
    }
  }

  // Add entity to favorites
  async addToFavorites(entityId: string): Promise<boolean> {
    try {
      // Check if entity exists
      const entity = await this.getEntityById(entityId);
      if (!entity) {
        console.error('Entity not found:', entityId);
        return false;
      }
      
      // Check if already favorited
      const isFavorite = await this.isFavorite(entityId);
      if (isFavorite) {
        return true; // Already a favorite
      }
      
      // Add to favorites
      await this.db.runAsync(
        'INSERT INTO favorites (entity_id, added_at) VALUES (?, ?)',
        [entityId, Date.now()]
      );
      
      return true;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      return false;
    }
  }
  
  // Remove entity from favorites
  async removeFromFavorites(entityId: string): Promise<boolean> {
    try {
      await this.db.runAsync(
        'DELETE FROM favorites WHERE entity_id = ?',
        [entityId]
      );
      
      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      return false;
    }
  }
  
  // Toggle favorite status
  async toggleFavorite(entityId: string): Promise<boolean> {
    try {
      const isFavorite = await this.isFavorite(entityId);
      
      if (isFavorite) {
        return await this.removeFromFavorites(entityId);
      } else {
        return await this.addToFavorites(entityId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  }
  
  // Check if entity is a favorite
  async isFavorite(entityId: string): Promise<boolean> {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT entity_id FROM favorites WHERE entity_id = ?',
        [entityId]
      );
      
      return !!result;
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }
  }
  
  // Get all favorite entities
  async getFavorites(): Promise<Entity[]> {
    try {
      const entities = await this.db.getAllAsync(`
        SELECT e.* 
        FROM entities e
        JOIN favorites f ON e.id = f.entity_id
        ORDER BY f.added_at DESC
      `) as Entity[];
      
      return entities;
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  // Add a method to reset database version (for debugging)
  async resetDatabaseVersion(version: number = 0): Promise<void> {
    try {
      await this.db.runAsync('PRAGMA user_version = ?', [version]);
      console.log('Database version reset complete. You must restart the app for migrations to run.');
    } catch (error) {
      console.error('Error resetting database version:', error);
      throw error;
    }
  }

  // Clear all data from the database but keep the structure
  async clearAllData(): Promise<{
    entities: number;
    interactions: number;
    photos: number;
    tags: number;
    favorites: number;
    total: number;
  }> {
    try {
      // Start a transaction
      await this.db.execAsync('BEGIN TRANSACTION');
      
      // Get counts before deletion for reporting
      const entityCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM entities');
      const interactionCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM interactions');
      const photoCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM entity_photos');
      
      const entityCount = entityCountResult?.count || 0;
      const interactionCount = interactionCountResult?.count || 0;
      const photoCount = photoCountResult?.count || 0;
      
      // Get tag related counts
      let tagCount = 0;
      let entityTagCount = 0;
      let interactionTypeTagCount = 0;
      
      try {
        const tagCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM tags');
        const entityTagCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM entity_tags');
        const interactionTypeTagCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM interaction_type_tags');
        
        tagCount = tagCountResult?.count || 0;
        entityTagCount = entityTagCountResult?.count || 0;
        interactionTypeTagCount = interactionTypeTagCountResult?.count || 0;
      } catch (e) {
        console.log('Some tag tables may not exist yet');
      }
      
      // Get favorites count
      let favoritesCount = 0;
      try {
        const favoritesCountResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM favorites');
        favoritesCount = favoritesCountResult?.count || 0;
      } catch (e) {
        console.log('Favorites table may not exist yet');
      }
      
      // Clear all tables that have foreign keys to entities first
      const tables = [
        'interactions',
        'entity_photos',
        'entity_tags',
        'favorites'
      ];
      
      for (const table of tables) {
        try {
          await this.db.runAsync(`DELETE FROM ${table}`);
        } catch (e) {
          console.log(`Table ${table} may not exist yet or could not be cleared:`, e);
        }
      }
      
      // Clear interaction_type_tags
      try {
        await this.db.runAsync('DELETE FROM interaction_type_tags');
      } catch (e) {
        console.log('Table interaction_type_tags may not exist yet');
      }
      
      // Clear tags
      try {
        await this.db.runAsync('DELETE FROM tags');
      } catch (e) {
        console.log('Table tags may not exist yet');
      }
      
      // Clear interaction_types
      try {
        await this.db.runAsync('DELETE FROM interaction_types');
      } catch (e) {
        console.log('Table interaction_types may not exist yet');
      }
      
      // Clear entities last (as other tables refer to it)
      await this.db.runAsync('DELETE FROM entities');
      
      // Commit the transaction
      await this.db.execAsync('COMMIT');
      
      // Initialize default interaction types after clearing
      await this.initDefaultInteractionTypes();
      
      // Calculate total
      const total = entityCount + interactionCount + photoCount + tagCount + 
                   entityTagCount + interactionTypeTagCount + favoritesCount;
      
      return {
        entities: entityCount,
        interactions: interactionCount,
        photos: photoCount,
        tags: tagCount + entityTagCount + interactionTypeTagCount,
        favorites: favoritesCount,
        total
      };
    } catch (error) {
      // Rollback on error
      await this.db.execAsync('ROLLBACK');
      console.error('Error clearing all data:', error);
      throw error;
    }
  }
  
  // Add a method to get database schema info for debugging
  async getDatabaseInfo(): Promise<{
    version: number;
    tables: string[];
    interactionTypesColumns: { name: string, type: string }[];
    interactionsColumns: { name: string, type: string }[];
  }> {
    try {
      // Get current version
      const versionResult = await this.db.getFirstAsync<{ version: number }>('PRAGMA user_version');
      const version = versionResult?.version || 0;
      
      // Get tables
      const tablesResult = await this.db.getAllAsync<{name: string}>("SELECT name FROM sqlite_master WHERE type='table'");
      const tables = tablesResult.map(t => t.name);
      
      // Get interaction_types columns
      const interactionTypesColumns = await this.db.getAllAsync<{ name: string, type: string }>(
        "PRAGMA table_info(interaction_types)"
      );
      
      // Get interactions columns
      const interactionsColumns = await this.db.getAllAsync<{ name: string, type: string }>(
        "PRAGMA table_info(interactions)"
      );
      
      return {
        version,
        tables,
        interactionTypesColumns,
        interactionsColumns
      };
    } catch (error) {
      console.error('Error getting database info:', error);
      return {
        version: -1,
        tables: [],
        interactionTypesColumns: [],
        interactionsColumns: []
      };
    }
  }

  // Update contact data for a person entity
  async updatePersonContactData(
    entityId: string,
    contactData: ContactData
  ): Promise<boolean> {
    try {
      // First get the entity to ensure it exists and is a person
      const entity = await this.getEntityById(entityId);
      if (!entity || entity.type !== EntityType.PERSON) {
        console.error(`Cannot update contact data: entity ${entityId} is not a person or doesn't exist`);
        return false;
      }
      
      // Update the entity with the new contact data
      const now = Date.now();
      
      // Create a summary for the details field to maintain searchability
      let detailsSummary = '';
      
      // Add phone numbers to summary
      if (contactData.phoneNumbers && contactData.phoneNumbers.length > 0) {
        contactData.phoneNumbers.forEach(phone => {
          detailsSummary += `${phone.label}: ${phone.value}\n`;
        });
      }
      
      // Add email addresses to summary
      if (contactData.emailAddresses && contactData.emailAddresses.length > 0) {
        contactData.emailAddresses.forEach(email => {
          detailsSummary += `${email.label}: ${email.value}\n`;
        });
      }
      
      // Add physical addresses to summary
      if (contactData.physicalAddresses && contactData.physicalAddresses.length > 0) {
        contactData.physicalAddresses.forEach(address => {
          detailsSummary += `${address.label}: ${address.street || ''} ${address.city || ''} ${address.state || ''} ${address.postalCode || ''} ${address.country || ''}\n`;
        });
      }
      
      // Store the contact data in the encrypted_data field
      const encryptedData = await this.encryptData(contactData);
      
      // Update both fields - details and encrypted_data
      const query = `
        UPDATE entities 
        SET updated_at = ?, details = ?, encrypted_data = ?
        WHERE id = ?
      `;
      
      const result = await this.db.runAsync(query, [
        now, 
        detailsSummary.trim() || entity.details, 
        encryptedData, 
        entityId
      ]);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating person contact data:', error);
      return false;
    }
  }
  
  // Get a person entity with its contact data
  async getPersonWithContactData(entityId: string): Promise<PersonEntity | null> {
    try {
      const entity = await this.getEntityById(entityId);
      if (!entity || entity.type !== EntityType.PERSON) {
        return null;
      }
      
      const person: PersonEntity = {
        ...entity,
        type: EntityType.PERSON,
        phone: undefined,
        email: undefined,
        address: undefined
      };
      
      // Parse the encrypted_data field if it exists
      if (entity.encrypted_data) {
        try {
          // In a real app, you would decrypt the data properly
          // For this demo, we're just parsing the JSON
          const contactData = JSON.parse(entity.encrypted_data);
          person.contactData = contactData;
        } catch (e: any) { // Type 'e' as any to fix linter error
          // Provide more detailed error logging
          console.error(`Error parsing contact data for entity ${entityId}: ${e.message || e}`);
          
          // Attempt to repair the corrupted data
          await this.resetCorruptedContactData(entityId);
          
          // Set empty contact data to prevent UI issues
          person.contactData = {
            phoneNumbers: [],
            emailAddresses: [],
            physicalAddresses: []
          };
        }
      }
      
      return person;
    } catch (error) {
      console.error('Error retrieving person with contact data:', error);
      return null;
    }
  }

  // Update an existing interaction with new timestamp and type
  async updateInteraction(
    interactionId: string,
    updates: {
      timestamp?: number;
      type?: string;
    }
  ): Promise<boolean> {
    try {
      // Build the SQL update parts based on what fields are being updated
      const updateParts: string[] = [];
      const params: any[] = [];

      if (updates.timestamp !== undefined) {
        updateParts.push('timestamp = ?');
        params.push(updates.timestamp);
      }

      if (updates.type !== undefined) {
        updateParts.push('type = ?');
        params.push(updates.type);
      }

      // If nothing to update, return early
      if (updateParts.length === 0) {
        return false;
      }

      // Complete the parameters with the interaction ID
      params.push(interactionId);

      // Get the entity ID for this interaction
      const interaction = await this.db.getFirstAsync<{ entity_id: string }>(
        'SELECT entity_id FROM interactions WHERE id = ?',
        [interactionId]
      );

      if (!interaction) {
        console.error('Interaction not found:', interactionId);
        return false;
      }

      // Perform the update
      const result = await this.db.runAsync(
        `UPDATE interactions SET ${updateParts.join(', ')} WHERE id = ?`,
        params
      );

      // If the interaction was found and updated, also update the entity's score
      if (result.changes > 0) {
        // Get the entity ID for this interaction
        const entityId = interaction.entity_id;

        // Get current settings for decay
        const settings = await this.getSettings();
        const decayFactor = settings?.decayFactor || 0;
        const decayType = settings?.decayType || 'linear';

        // Calculate new score
        const newScore = await this.calculateInteractionScore(entityId, decayFactor, decayType);
        const now = Date.now();

        // Update entity with new score and timestamp
        await this.db.runAsync(
          'UPDATE entities SET interaction_score = ?, updated_at = ? WHERE id = ?',
          [newScore, now, entityId]
        );
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating interaction:', error);
      return false;
    }
  }

  // Get a single interaction by ID
  async getInteraction(interactionId: string): Promise<Interaction | null> {
    try {
      const query = `
        SELECT id, entity_id, timestamp, type, notes
        FROM interactions
        WHERE id = ?
      `;
      
      const result = await this.db.getFirstAsync<Interaction>(query, [interactionId]);
      
      if (!result) {
        return null;
      }
      
      return result;
    } catch (error) {
      console.error('Error getting interaction:', error);
      return null;
    }
  }

  // Merge two entities together
  async mergeEntities(sourceId: string, targetId: string): Promise<boolean> {
    try {
      // Start a transaction
      await this.db.execAsync('BEGIN TRANSACTION');

      // Get both entities
      const sourceEntity = await this.getEntityById(sourceId);
      const targetEntity = await this.getEntityById(targetId);

      if (!sourceEntity || !targetEntity) {
        await this.db.execAsync('ROLLBACK');
        return false;
      }

      // Ensure entities are of the same type
      if (sourceEntity.type !== targetEntity.type) {
        await this.db.execAsync('ROLLBACK');
        return false;
      }

      // Update interactions to point to target entity
      await this.db.runAsync(
        'UPDATE interactions SET entity_id = ? WHERE entity_id = ?',
        [targetId, sourceId]
      );

      // Update photos to point to target entity
      await this.db.runAsync(
        'UPDATE entity_photos SET entity_id = ? WHERE entity_id = ?',
        [targetId, sourceId]
      );

      // Update entity tags to point to target entity
      await this.db.runAsync(
        'INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) SELECT ?, tag_id FROM entity_tags WHERE entity_id = ?',
        [targetId, sourceId]
      );
      await this.db.runAsync(
        'DELETE FROM entity_tags WHERE entity_id = ?',
        [sourceId]
      );

      // Merge contact data if it exists
      if (sourceEntity.encrypted_data && targetEntity.encrypted_data) {
        let sourceData: ContactData | null = null;
        let targetData: ContactData | null = null;
        
        try {
          sourceData = JSON.parse(await this.decryptData(sourceEntity.encrypted_data)) as ContactData;
          targetData = JSON.parse(await this.decryptData(targetEntity.encrypted_data)) as ContactData;
        } catch (e: any) {
          // Log the error but continue with the merge
          console.log(`Error parsing contact data during merge: ${e.message || e}`);
          
          // Attempt to repair corrupted data
          let repaired = false;
          if (sourceEntity.encrypted_data && !this.isValidJson(sourceEntity.encrypted_data)) {
            await this.resetCorruptedContactData(sourceEntity.id);
            repaired = true;
          }
          
          if (targetEntity.encrypted_data && !this.isValidJson(targetEntity.encrypted_data)) {
            await this.resetCorruptedContactData(targetEntity.id);
            repaired = true;
          }
          
          if (repaired) {
            console.log("Corrupted contact data was repaired during merge");
          }
          
          // Skip the contact data merge but continue with other operations
        }
        
        // Only proceed with contact data merge if parsing was successful
        if (sourceData && targetData) {
          // Merge phone numbers
          const mergedPhoneNumbers = [...(targetData.phoneNumbers || [])];
          for (const phone of (sourceData.phoneNumbers || [])) {
            if (!mergedPhoneNumbers.some(p => p.value === phone.value)) {
              mergedPhoneNumbers.push(phone);
            }
          }
          
          // Merge email addresses
          const mergedEmails = [...(targetData.emailAddresses || [])];
          for (const email of (sourceData.emailAddresses || [])) {
            if (!mergedEmails.some(e => e.value === email.value)) {
              mergedEmails.push(email);
            }
          }
          
          // Merge physical addresses
          const mergedAddresses = [...(targetData.physicalAddresses || [])];
          for (const address of (sourceData.physicalAddresses || [])) {
            if (!mergedAddresses.some(a => 
              a.street === address.street && 
              a.city === address.city && 
              a.state === address.state && 
              a.postalCode === address.postalCode
            )) {
              mergedAddresses.push(address);
            }
          }
          
          // Update target entity with merged data
          const mergedContactData: ContactData = {
            phoneNumbers: mergedPhoneNumbers,
            emailAddresses: mergedEmails,
            physicalAddresses: mergedAddresses
          };
          
          // Create a summary of the merged contact details
          const detailsSummary = [
            ...mergedPhoneNumbers.map(p => p.value),
            ...mergedEmails.map(e => e.value),
            ...mergedAddresses.map(a => a.formattedAddress || `${a.street}, ${a.city}, ${a.state} ${a.postalCode}`)
          ].join('\n');
          
          // Encrypt the merged data
          const encryptedMergedData = await this.encryptData(mergedContactData);
          
          // Update the target entity
          await this.db.runAsync(
            'UPDATE entities SET details = ?, encrypted_data = ? WHERE id = ?',
            [detailsSummary, encryptedMergedData, targetId]
          );
        }
      }

      // Delete the source entity
      await this.db.runAsync('DELETE FROM entities WHERE id = ?', [sourceId]);

      // Commit the transaction
      await this.db.execAsync('COMMIT');
      return true;
    } catch (error) {
      console.error('Error merging entities:', error);
      await this.db.execAsync('ROLLBACK');
      return false;
    }
  }

  // Get group members
  async getGroupMembers(groupId: string): Promise<Entity[]> {
    try {
      const query = `
        SELECT e.* 
        FROM entities e
        JOIN group_members gm ON e.id = gm.member_id
        WHERE gm.group_id = ?
        ORDER BY e.name COLLATE NOCASE
      `;
      
      const results = await this.db.getAllAsync(query, [groupId]);
      return (results || []) as Entity[];
    } catch (error) {
      console.error('Error getting group members:', error);
      return [];
    }
  }
  
  // Update the members of a group
  async updateGroupMembers(groupId: string, memberIds: string[]): Promise<boolean> {
    try {
      // Start a transaction
      await this.db.execAsync('BEGIN TRANSACTION');
      
      try {
        // First, remove all existing members
        await this.db.runAsync(
          'DELETE FROM group_members WHERE group_id = ?',
          [groupId]
        );
        
        // Then add all the new members
        const timestamp = Date.now(); // Current timestamp
        for (const memberId of memberIds) {
          await this.db.runAsync(
            'INSERT INTO group_members (group_id, member_id, added_at) VALUES (?, ?, ?)',
            [groupId, memberId, timestamp]
          );
        }
        
        // Commit the transaction
        await this.db.execAsync('COMMIT');
        return true;
      } catch (error) {
        // Rollback on error
        await this.db.execAsync('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error updating group members:', error);
      return false;
    }
  }
  
  // Add a member to a group
  async addGroupMember(groupId: string, memberId: string): Promise<boolean> {
    try {
      // Check if the group exists and is actually a group
      const group = await this.getEntityById(groupId);
      if (!group || group.type !== EntityType.GROUP) {
        console.error('Entity is not a group:', groupId);
        return false;
      }
      
      // Check if the member exists
      const member = await this.getEntityById(memberId);
      if (!member) {
        console.error('Member entity does not exist:', memberId);
        return false;
      }
      
      // Add the member to the group
      await this.db.runAsync(
        'INSERT OR REPLACE INTO group_members (group_id, member_id, added_at) VALUES (?, ?, ?)',
        [groupId, memberId, Date.now()]
      );
      
      return true;
    } catch (error) {
      console.error('Error adding group member:', error);
      return false;
    }
  }
  
  // Remove a member from a group
  async removeGroupMember(groupId: string, memberId: string): Promise<boolean> {
    try {
      await this.db.runAsync(
        'DELETE FROM group_members WHERE group_id = ? AND member_id = ?',
        [groupId, memberId]
      );
      
      return true;
    } catch (error) {
      console.error('Error removing group member:', error);
      return false;
    }
  }
  
  // Get all groups that an entity belongs to
  async getEntityGroups(entityId: string): Promise<Entity[]> {
    try {
      const query = `
        SELECT e.*
        FROM entities e
        JOIN group_members gm ON e.id = gm.group_id
        WHERE gm.member_id = ?
        ORDER BY e.name COLLATE NOCASE ASC
      `;
      
      return await this.db.getAllAsync(query, [entityId]);
    } catch (error) {
      console.error('Error getting entity groups:', error);
      return [];
    }
  }

  // Record interaction for all group members
  async recordGroupInteraction(groupId: string, interactionType: string): Promise<boolean> {
    try {
      // First, record the interaction for the group itself
      await this.incrementInteractionScore(groupId, interactionType);
      
      // Then, get all members of the group
      const members = await this.getGroupMembers(groupId);
      
      // Record the interaction for each member
      for (const member of members) {
        await this.incrementInteractionScore(member.id, interactionType);
      }
      
      return true;
    } catch (error) {
      console.error('Error recording group interaction:', error);
      return false;
    }
  }

  // Update an interaction type's score
  async updateInteractionTypeScore(typeId: string, score: number): Promise<void> {
    try {
      await this.db.runAsync(
        'UPDATE interaction_types SET score = ? WHERE id = ?',
        [score, typeId]
      );
    } catch (error) {
      console.error('Error updating interaction type score:', error);
      throw error;
    }
  }
  
  // Update an interaction type's details
  async updateInteractionType(
    typeId: string,
    name: string,
    icon: string,
    entityType: string | null = null,
    color: string = '#666666',
    score: number = 1
  ): Promise<void> {
    try {
      await this.db.runAsync(
        'UPDATE interaction_types SET name = ?, icon = ?, entity_type = ?, color = ?, score = ? WHERE id = ?',
        [name, icon, entityType, color, score, typeId]
      );
    } catch (error) {
      console.error('Error updating interaction type:', error);
      throw error;
    }
  }

  // Calculate interaction score with decay
  async calculateInteractionScore(
    entityId: string, 
    decayFactor: number = 0, // 0 = no decay, 1 = full decay after one day
    decayType: string = 'linear' // 'linear', 'exponential', 'logarithmic'
  ): Promise<number> {
    try {
      // Get all interactions for this entity
      const interactions = await this.db.getAllAsync<{
        id: string;
        timestamp: number;
        type_id: string;
        score: number;
      }>(
        `SELECT i.id, i.timestamp, i.type_id, COALESCE(it.score, 1) as score
         FROM interactions i
         LEFT JOIN interaction_types it ON i.type_id = it.id
         WHERE i.entity_id = ?
         ORDER BY i.timestamp DESC`,
        [entityId]
      );
      
      if (interactions.length === 0) {
        return 0;
      }
      
      const now = Date.now();
      let totalScore = 0;
      
      // Calculate score for each interaction based on decay
      for (const interaction of interactions) {
        const ageInDays = (now - interaction.timestamp) / (1000 * 60 * 60 * 24);
        let decayMultiplier = 1;
        
        // Only apply decay if decayFactor > 0
        if (decayFactor > 0 && ageInDays > 0) {
          switch (decayType) {
            case 'exponential':
              // Exponential decay: score * e^(-decayFactor * ageInDays)
              decayMultiplier = Math.exp(-decayFactor * ageInDays);
              break;
            case 'logarithmic':
              // Logarithmic decay: score * (1 - decayFactor * ln(1 + ageInDays))
              decayMultiplier = Math.max(0, 1 - decayFactor * Math.log(1 + ageInDays));
              break;
            case 'linear':
            default:
              // Linear decay: score * (1 - decayFactor * ageInDays)
              decayMultiplier = Math.max(0, 1 - decayFactor * ageInDays);
              break;
          }
        }
        
        // Add the decayed score to the total
        totalScore += interaction.score * decayMultiplier;
      }
      
      return totalScore;
    } catch (error) {
      console.error('Error calculating interaction score:', error);
      return 0;
    }
  }
  
  // Update interaction scores for all entities
  async updateAllInteractionScores(
    decayFactor: number = 0,
    decayType: string = 'linear'
  ): Promise<void> {
    try {
      // Get all entities
      const entities = await this.getAllEntities();
      
      // Update each entity's interaction score
      for (const entity of entities) {
        const score = await this.calculateInteractionScore(entity.id, decayFactor, decayType);
        const now = Date.now();
        
        // Update the entity's interaction_score AND updated_at timestamp
        await this.db.runAsync(
          'UPDATE entities SET interaction_score = ?, updated_at = ? WHERE id = ?',
          [score, now, entity.id]
        );
      }
      
      console.log('Updated interaction scores for all entities');
    } catch (error) {
      console.error('Error updating all interaction scores:', error);
    }
  }

  // Create settings table during initialization
  private async createSettingsTable(): Promise<void> {
    try {
      // Check if settings table exists
      const tableExists = await this.db.getFirstAsync<{ count: number }>(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='settings'"
      );
      
      if (!tableExists || tableExists.count === 0) {
        // Create settings table
        await this.db.runAsync(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `);
        
        // Insert default settings
        const defaultSettings: AppSettings = {
          decayFactor: 0,
          decayType: 'linear'
        };
        
        await this.db.runAsync(
          'INSERT INTO settings (key, value) VALUES (?, ?)',
          ['app_settings', JSON.stringify(defaultSettings)]
        );
        
        console.log('Created settings table with default values');
      }
    } catch (error) {
      console.error('Error creating settings table:', error);
    }
  }
  
  // Get application settings
  async getSettings(): Promise<AppSettings | null> {
    try {
      const settingsRow = await this.db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        ['app_settings']
      );
      
      if (settingsRow) {
        return JSON.parse(settingsRow.value) as AppSettings;
      }
      
      // If no settings found, create default settings
      const defaultSettings: AppSettings = {
        decayFactor: 0,
        decayType: 'linear'
      };
      
      await this.updateSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }
  
  // Update application settings
  async updateSettings(settings: AppSettings): Promise<boolean> {
    try {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['app_settings', JSON.stringify(settings)]
      );
      
      // After updating settings, recalculate all interaction scores
      await this.updateAllInteractionScores(settings.decayFactor, settings.decayType);
      
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }

  // Helper function to check if encrypted_data is valid JSON
  private isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Reset corrupted encrypted_data for an entity
  async resetCorruptedContactData(entityId: string): Promise<boolean> {
    try {
      const entity = await this.getEntityById(entityId);
      if (!entity) return false;
      
      // Check if encrypted_data exists and is corrupted
      if (entity.encrypted_data && !this.isValidJson(entity.encrypted_data)) {
        console.log(`Resetting corrupted contact data for entity ${entityId}`);
        
        // Create empty contact data structure
        const emptyContactData = {
          phoneNumbers: [],
          emailAddresses: [],
          physicalAddresses: []
        };
        
        // Update the entity with empty valid contact data
        const result = await this.db.runAsync(
          `UPDATE entities SET encrypted_data = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(emptyContactData), Date.now(), entityId]
        );
        
        return result.changes > 0;
      }
      
      return false; // No corruption detected or no data to repair
    } catch (error) {
      console.error('Error resetting corrupted contact data:', error);
      return false;
    }
  }

  // Regenerate default tags and interaction types
  async regenerateDefaultTagsAndInteractions(): Promise<void> {
    try {
      console.log('Regenerating default tags and interaction types');
      
      // Initialize default tags first
      await this.initDefaultTags();
      
      // Then initialize default interaction types (which may reference the tags)
      await this.initDefaultInteractionTypes();
      
      console.log('Default tags and interaction types regenerated successfully');
    } catch (error) {
      console.error('Error regenerating default tags and interaction types:', error);
      throw error;
    }
  }

  // Export all data as encrypted backup
  async exportEncryptedData(passphrase: string): Promise<string> {
    try {
      console.log('Starting data export');
      
      // Get all data from database
      const entities = await this.getAllEntities();
      console.log(`Exporting ${entities.length} entities`);
      
      // Get all interactions
      const interactions: any[] = [];
      for (const entity of entities) {
        const entityInteractions = await this.db.getAllAsync(
          'SELECT id, entity_id, timestamp, type FROM interactions WHERE entity_id = ?',
          [entity.id]
        );
        interactions.push(...entityInteractions);
      }
      console.log(`Exporting ${interactions.length} interactions`);
      
      // Get all photos with metadata
      const photoRecords = await this.db.getAllAsync<EntityPhoto>(
        'SELECT id, entity_id, uri, caption, timestamp FROM entity_photos'
      );
      console.log(`Exporting ${photoRecords.length} photos`);
      
      // Process photos to include actual image data
      const photos: EntityPhotoWithData[] = [];
      for (const photo of photoRecords) {
        try {
          // Read the actual image file as base64
          let base64Image = '';
          try {
            // First, try to read the file from the URI
            const fileInfo = await FileSystem.getInfoAsync(photo.uri);
            if (fileInfo.exists) {
              base64Image = await FileSystem.readAsStringAsync(photo.uri, {
                encoding: FileSystem.EncodingType.Base64
              });
            }
          } catch (photoError) {
            console.warn(`Could not read photo at ${photo.uri}:`, photoError);
          }
          
          // Add the photo with the base64 data
          photos.push({
            ...photo,
            base64Data: base64Image
          });
        } catch (err) {
          console.warn(`Skipping photo ${photo.id} due to error:`, err);
          // Still include the photo metadata even if we couldn't get the file
          photos.push({
            ...photo,
            base64Data: ''
          });
        }
      }
      
      // Get all tags
      const tags = await this.getAllTags();
      console.log(`Exporting ${tags.length} tags`);
      
      // Get entity tags relationships
      const entityTags = await this.db.getAllAsync(
        'SELECT entity_id, tag_id FROM entity_tags'
      );
      console.log(`Exporting ${entityTags.length} entity-tag relationships`);
      
      // Get all interaction types
      const interactionTypes = await this.getInteractionTypes();
      console.log(`Exporting ${interactionTypes.length} interaction types`);
      
      // Get interaction type tags
      const interactionTypeTags = await this.db.getAllAsync(
        'SELECT interaction_type_id, tag_id FROM interaction_type_tags'
      );
      console.log(`Exporting ${interactionTypeTags.length} interaction type tag relationships`);
      
      // Get group members - using correct column names
      const groupMembers = await this.db.getAllAsync(
        'SELECT group_id, member_id FROM group_members'
      );
      console.log(`Exporting ${groupMembers.length} group member relationships`);
      
      // Get favorites
      let favorites: any[] = [];
      try {
        favorites = await this.db.getAllAsync(
          'SELECT entity_id FROM favorites'
        );
        console.log(`Exporting ${favorites.length} favorites`);
      } catch (error: any) {
        // If favorites table doesn't exist or has different structure, log and continue
        console.warn('Could not export favorites:', error.message);
        favorites = [];
      }
      
      // Create backup object
      const backup = {
        version: 1,
        timestamp: Date.now(),
        entities,
        interactions,
        photos,
        tags,
        entityTags,
        interactionTypes,
        interactionTypeTags,
        groupMembers,
        favorites
      };
      
      // Encrypt the backup using the passphrase
      const encryptedBackup = await this.encryptBackup(JSON.stringify(backup), passphrase);
      return encryptedBackup;
    } catch (error: any) {
      console.error('Error exporting data:', error);
      throw new Error('Failed to export data: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Import encrypted backup data
  async importEncryptedData(encryptedData: string, passphrase: string): Promise<boolean> {
    try {
      console.log('Starting data import');
      
      // Decrypt the backup using the passphrase
      const decryptedData = await this.decryptBackup(encryptedData, passphrase);
      
      // Parse the backup data
      const backup = JSON.parse(decryptedData);
      
      // Validate backup format
      if (!backup.version || !backup.entities) {
        throw new Error('Invalid backup format');
      }
      
      console.log(`Importing backup from ${new Date(backup.timestamp).toLocaleString()}`);
      
      // Clear existing data before import
      await this.clearAllDataForImport();
      
      // Start a transaction for the import
      await this.db.execAsync('BEGIN TRANSACTION');
      
      try {
        // Import entities
        console.log(`Importing ${backup.entities.length} entities`);
        for (const entity of backup.entities) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO entities 
             (id, name, type, details, image, interaction_score, created_at, updated_at, encrypted_data) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              entity.id,
              entity.name,
              entity.type,
              entity.details,
              entity.image,
              entity.interaction_score || 0,
              entity.created_at,
              entity.updated_at,
              entity.encrypted_data
            ]
          );
        }
        
        // Import tags
        console.log(`Importing ${backup.tags.length} tags`);
        for (const tag of backup.tags) {
          await this.db.runAsync(
            'INSERT OR REPLACE INTO tags (id, name, count) VALUES (?, ?, ?)',
            [tag.id, tag.name, tag.count || 0]
          );
        }
        
        // Import entity tags
        console.log(`Importing ${backup.entityTags.length} entity-tag relationships`);
        for (const entityTag of backup.entityTags) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)',
            [entityTag.entity_id, entityTag.tag_id]
          );
        }
        
        // Import interaction types
        console.log(`Importing ${backup.interactionTypes.length} interaction types`);
        for (const type of backup.interactionTypes) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO interaction_types 
             (id, name, tag_id, icon, entity_type, score, color) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              type.id,
              type.name,
              type.tag_id,
              type.icon,
              type.entity_type,
              type.score || 1,
              type.color || '#666666'
            ]
          );
        }
        
        // Import interaction type tags
        console.log(`Importing ${backup.interactionTypeTags.length} interaction type tag relationships`);
        for (const itt of backup.interactionTypeTags) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO interaction_type_tags (interaction_type_id, tag_id) VALUES (?, ?)',
            [itt.interaction_type_id, itt.tag_id]
          );
        }
        
        // Import interactions
        console.log(`Importing ${backup.interactions.length} interactions`);
        for (const interaction of backup.interactions) {
          await this.db.runAsync(
            'INSERT OR REPLACE INTO interactions (id, entity_id, timestamp, type) VALUES (?, ?, ?, ?)',
            [
              interaction.id,
              interaction.entity_id,
              interaction.timestamp,
              interaction.type
            ]
          );
        }
        
        // Import photos with actual image data
        console.log(`Importing ${backup.photos.length} photos`);
        for (const photo of backup.photos as EntityPhotoWithData[]) {
          // If we have base64 image data, save it to a file
          let newUri = photo.uri;
          if (photo.base64Data) {
            try {
              // Create photos directory if it doesn't exist
              const photosDir = `${FileSystem.documentDirectory}photos/`;
              const dirInfo = await FileSystem.getInfoAsync(photosDir);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
              }
              
              // Generate new file path
              const fileName = `photo_${photo.id}_${Date.now()}.jpg`;
              const newFilePath = `${photosDir}${fileName}`;
              
              // Write the base64 data to the file
              await FileSystem.writeAsStringAsync(newFilePath, photo.base64Data, {
                encoding: FileSystem.EncodingType.Base64
              });
              
              // Update the URI to point to the new file
              newUri = newFilePath;
            } catch (fileError) {
              console.warn(`Error saving photo file for ${photo.id}:`, fileError);
              // Keep the original URI if we can't save the file
            }
          }
          
          // Insert the photo metadata into the database
          await this.db.runAsync(
            'INSERT OR REPLACE INTO entity_photos (id, entity_id, uri, caption, timestamp) VALUES (?, ?, ?, ?, ?)',
            [
              photo.id,
              photo.entity_id,
              newUri,
              photo.caption,
              photo.timestamp
            ]
          );
        }
        
        // Import group members
        console.log(`Importing ${backup.groupMembers.length} group member relationships`);
        for (const groupMember of backup.groupMembers) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)',
            [groupMember.group_id, groupMember.member_id]
          );
        }
        
        // Import favorites
        console.log(`Importing ${backup.favorites.length} favorites`);
        for (const favorite of backup.favorites) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO favorites (entity_id) VALUES (?)',
            [favorite.entity_id]
          );
        }
        
        // Commit the transaction
        await this.db.execAsync('COMMIT');
        console.log('Import completed successfully');
        return true;
      } catch (error: any) {
        // Rollback the transaction in case of error
        await this.db.execAsync('ROLLBACK');
        console.error('Error during import, rolling back:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Error importing data:', error);
      throw new Error('Failed to import data: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Clear all data before import
  private async clearAllDataForImport(): Promise<void> {
    try {
      // Start a transaction
      await this.db.execAsync('BEGIN TRANSACTION');
      
      // Delete all data from tables while preserving structure
      await this.db.execAsync('DELETE FROM interactions');
      await this.db.execAsync('DELETE FROM entity_photos');
      await this.db.execAsync('DELETE FROM entity_tags');
      await this.db.execAsync('DELETE FROM interaction_type_tags');
      await this.db.execAsync('DELETE FROM group_members');
      await this.db.execAsync('DELETE FROM favorites');
      await this.db.execAsync('DELETE FROM interaction_types');
      await this.db.execAsync('DELETE FROM tags');
      await this.db.execAsync('DELETE FROM entities');
      
      // Commit the transaction
      await this.db.execAsync('COMMIT');
      console.log('Database cleared for import');
    } catch (error: any) {
      // Rollback the transaction in case of error
      await this.db.execAsync('ROLLBACK');
      console.error('Error clearing database:', error);
      throw new Error('Failed to clear database: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Encrypt backup data with passphrase
  private async encryptBackup(data: string, passphrase: string): Promise<string> {
    try {
      // Generate a key from the passphrase (using a secure key derivation function)
      const passphraseBuffer = new TextEncoder().encode(passphrase);
      // Use Crypto.getRandomBytes instead of expo-random
      const salt = new Uint8Array(await Crypto.getRandomBytesAsync(16));
      
      // Generate a secure random key for the passphrase
      const hashKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        passphrase + Array.from(salt).map((b: number) => b.toString(16)).join('')
      );
      
      // Generate a random IV for encryption
      const iv = new Uint8Array(await Crypto.getRandomBytesAsync(16));
      
      // Since we can't use SubtleCrypto directly in React Native, we'll use a simplified approach:
      // 1. Hash the passphrase with the salt to create a key
      // 2. XOR the data with this key (simulating encryption)
      
      // Convert the data to a buffer
      const dataBytes = new TextEncoder().encode(data);
      
      // Encrypt the data using a simple XOR with the key (repeated as needed)
      // Note: In a production app, you would use a more robust encryption method
      // This is a simplified version for demonstration
      const keyBytes = new TextEncoder().encode(hashKey);
      const encryptedBytes = new Uint8Array(dataBytes.length);
      
      for (let i = 0; i < dataBytes.length; i++) {
        encryptedBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      
      // Create a HMAC for data integrity 
      // NOTE: Use the original data (not encrypted) to match decryption
      const hmac = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        hashKey + Array.from(dataBytes).join(',')
      );
      
      // Combine salt, IV, and encrypted data into a single package
      const result = {
        salt: Array.from(salt).map((b: number) => b.toString(16).padStart(2, '0')).join(''),
        iv: Array.from(iv).map((b: number) => b.toString(16).padStart(2, '0')).join(''),
        data: Array.from(encryptedBytes).map((b: number) => b.toString(16).padStart(2, '0')).join(''),
        hmac: hmac
      };
      
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error encrypting backup:', error);
      throw new Error('Failed to encrypt backup: ' + (error.message || 'Unknown error'));
    }
  }
  
  // Decrypt backup data with passphrase
  private async decryptBackup(encryptedData: string, passphrase: string): Promise<string> {
    try {
      console.log('Starting backup decryption');
      
      // Parse the encrypted data package
      let encryptedPackage;
      try {
        encryptedPackage = JSON.parse(encryptedData);
        console.log('Successfully parsed encrypted package');
      } catch (parseError) {
        console.error('Failed to parse encrypted data:', parseError);
        throw new Error('Invalid backup format. The file does not appear to be a valid encrypted backup.');
      }
      
      // Validate package structure
      if (!encryptedPackage.salt || !encryptedPackage.iv || !encryptedPackage.data) {
        console.error('Invalid package structure:', Object.keys(encryptedPackage));
        throw new Error('Invalid backup format. Missing required encryption components.');
      }
      
      // Extract salt, IV, and encrypted data
      try {
        // Try to parse the hex strings
        const saltMatches = encryptedPackage.salt.match(/.{1,2}/g);
        const ivMatches = encryptedPackage.iv.match(/.{1,2}/g);
        const dataMatches = encryptedPackage.data.match(/.{1,2}/g);
        
        if (!saltMatches || !ivMatches || !dataMatches) {
          throw new Error('Invalid hex data in encrypted backup');
        }
        
        const salt = new Uint8Array(saltMatches.map((byte: string) => parseInt(byte, 16)));
        const iv = new Uint8Array(ivMatches.map((byte: string) => parseInt(byte, 16)));
        const data = new Uint8Array(dataMatches.map((byte: string) => parseInt(byte, 16)));
        const hmac = encryptedPackage.hmac;
        
        console.log(`Extracted encryption components: Salt length=${salt.length}, IV length=${iv.length}, Data length=${data.length}`);
        
        // Generate the key from the passphrase and salt
        const hashKey = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          passphrase + Array.from(salt).map((b: number) => b.toString(16)).join('')
        );
        console.log('Generated hash key from passphrase');
        
        // First, decrypt the data (using the same XOR approach)
        const keyBytes = new TextEncoder().encode(hashKey);
        const decryptedBytes = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
          decryptedBytes[i] = data[i] ^ keyBytes[i % keyBytes.length];
        }
        
        // Try to bypass HMAC verification if requested via a debug flag
        const bypassHmacVerification = false; // Set to true only for recovery
        
        // Verify HMAC if provided to ensure data integrity
        if (hmac && !bypassHmacVerification) {
          console.log('HMAC validation enabled, checking data integrity');
          
          // The HMAC was computed on the original data, not the encrypted data
          // So we need to compute it on the decrypted data
          const computedHmac = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            hashKey + Array.from(decryptedBytes).join(',')
          );
          
          if (computedHmac !== hmac) {
            console.error('HMAC validation failed. Computed:', computedHmac, 'Expected:', hmac);
            
            // Try with the original method (using encrypted data) as a fallback
            // This is for compatibility with older backups
            const legacyComputedHmac = await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              hashKey + Array.from(data).join(',')
            );
            
            if (legacyComputedHmac !== hmac) {
              console.error('Legacy HMAC validation also failed');
              throw new Error('Data integrity check failed. The backup may be corrupted or the passphrase is incorrect.');
            }
            
            console.log('Legacy HMAC validation passed');
          } else {
            console.log('HMAC validation passed');
          }
        } else if (bypassHmacVerification) {
          console.log('⚠️ HMAC verification bypassed - using backup without integrity check');
        } else {
          console.log('No HMAC found, skipping data integrity check');
        }
        
        // Convert the decrypted data back to a string
        const decryptedText = new TextDecoder().decode(decryptedBytes);
        
        // Validate that the decrypted content is valid JSON
        try {
          JSON.parse(decryptedText);
          console.log('Successfully decrypted and parsed backup data');
        } catch (jsonError) {
          console.error('Decrypted data is not valid JSON', jsonError);
          throw new Error('Decryption produced invalid data. Likely incorrect passphrase or corrupted file.');
        }
        
        return decryptedText;
      } catch (dataError: any) {
        console.error('Error processing encrypted data:', dataError);
        throw new Error(`Error processing encrypted data: ${dataError.message}`);
      }
    } catch (error: any) {
      console.error('Error decrypting backup:', error);
      throw new Error(`Failed to decrypt backup: ${error.message || 'Incorrect passphrase or corrupted file'}`);
    }
  }

  // Validate a 6-word passphrase (all lowercase words)
  validatePassphrase(passphrase: string): boolean {
    // Check if passphrase is a string of 6 lowercase words separated by spaces
    const words = passphrase.trim().split(/\s+/);
    if (words.length !== 6) {
      return false;
    }
    
    // Check if all words are lowercase letters only
    const lowercaseWordRegex = /^[a-z]+$/;
    return words.every(word => lowercaseWordRegex.test(word));
  }

  // Export all data as unencrypted backup (for troubleshooting)
  async exportUnencryptedData(): Promise<string> {
    try {
      console.log('Starting unencrypted data export');
      
      // Get all data from database
      const entities = await this.getAllEntities();
      console.log(`Exporting ${entities.length} entities`);
      
      // Get all interactions
      const interactions: any[] = [];
      for (const entity of entities) {
        const entityInteractions = await this.db.getAllAsync(
          'SELECT id, entity_id, timestamp, type FROM interactions WHERE entity_id = ?',
          [entity.id]
        );
        interactions.push(...entityInteractions);
      }
      console.log(`Exporting ${interactions.length} interactions`);
      
      // Get all photos with metadata
      const photoRecords = await this.db.getAllAsync<EntityPhoto>(
        'SELECT id, entity_id, uri, caption, timestamp FROM entity_photos'
      );
      console.log(`Exporting ${photoRecords.length} photos`);
      
      // Process photos to include actual image data
      const photos: EntityPhotoWithData[] = [];
      for (const photo of photoRecords) {
        try {
          // Read the actual image file as base64
          let base64Image = '';
          try {
            // First, try to read the file from the URI
            const fileInfo = await FileSystem.getInfoAsync(photo.uri);
            if (fileInfo.exists) {
              base64Image = await FileSystem.readAsStringAsync(photo.uri, {
                encoding: FileSystem.EncodingType.Base64
              });
            }
          } catch (photoError) {
            console.warn(`Could not read photo at ${photo.uri}:`, photoError);
          }
          
          // Add the photo with the base64 data
          photos.push({
            ...photo,
            base64Data: base64Image
          });
        } catch (err) {
          console.warn(`Skipping photo ${photo.id} due to error:`, err);
          // Still include the photo metadata even if we couldn't get the file
          photos.push({
            ...photo,
            base64Data: ''
          });
        }
      }
      
      // Get all tags
      const tags = await this.getAllTags();
      console.log(`Exporting ${tags.length} tags`);
      
      // Get entity tags relationships
      const entityTags = await this.db.getAllAsync(
        'SELECT entity_id, tag_id FROM entity_tags'
      );
      console.log(`Exporting ${entityTags.length} entity-tag relationships`);
      
      // Get all interaction types
      const interactionTypes = await this.getInteractionTypes();
      console.log(`Exporting ${interactionTypes.length} interaction types`);
      
      // Get interaction type tags
      const interactionTypeTags = await this.db.getAllAsync(
        'SELECT interaction_type_id, tag_id FROM interaction_type_tags'
      );
      console.log(`Exporting ${interactionTypeTags.length} interaction type tag relationships`);
      
      // Get group members - using correct column names
      const groupMembers = await this.db.getAllAsync(
        'SELECT group_id, member_id FROM group_members'
      );
      console.log(`Exporting ${groupMembers.length} group member relationships`);
      
      // Get favorites
      let favorites: any[] = [];
      try {
        favorites = await this.db.getAllAsync(
          'SELECT entity_id FROM favorites'
        );
        console.log(`Exporting ${favorites.length} favorites`);
      } catch (error: any) {
        // If favorites table doesn't exist or has different structure, log and continue
        console.warn('Could not export favorites:', error.message);
        favorites = [];
      }
      
      // Create backup object
      const backup = {
        version: 1,
        timestamp: Date.now(),
        entities,
        interactions,
        photos,
        tags,
        entityTags,
        interactionTypes,
        interactionTypeTags,
        groupMembers,
        favorites
      };
      
      // Return the backup as a JSON string
      return JSON.stringify(backup, null, 2); // Pretty-print for easier debugging
    } catch (error: any) {
      console.error('Error exporting unencrypted data:', error);
      throw new Error('Failed to export unencrypted data: ' + (error.message || 'Unknown error'));
    }
  }

  // Import unencrypted backup data (for troubleshooting)
  async importUnencryptedData(jsonData: string): Promise<boolean> {
    try {
      console.log('Starting unencrypted data import');
      
      // Parse the backup data
      const backup = JSON.parse(jsonData);
      
      // Validate backup format
      if (!backup.version || !backup.entities) {
        throw new Error('Invalid backup format');
      }
      
      console.log(`Importing backup from ${new Date(backup.timestamp).toLocaleString()}`);
      
      // Clear existing data before import
      await this.clearAllDataForImport();
      
      // Start a transaction for the import
      await this.db.execAsync('BEGIN TRANSACTION');
      
      try {
        // Import entities
        console.log(`Importing ${backup.entities.length} entities`);
        for (const entity of backup.entities) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO entities 
             (id, name, type, details, image, interaction_score, created_at, updated_at, encrypted_data) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              entity.id,
              entity.name,
              entity.type,
              entity.details,
              entity.image,
              entity.interaction_score || 0,
              entity.created_at,
              entity.updated_at,
              entity.encrypted_data
            ]
          );
        }
        
        // Import tags
        console.log(`Importing ${backup.tags.length} tags`);
        for (const tag of backup.tags) {
          await this.db.runAsync(
            'INSERT OR REPLACE INTO tags (id, name, count) VALUES (?, ?, ?)',
            [tag.id, tag.name, tag.count || 0]
          );
        }
        
        // Import entity tags
        console.log(`Importing ${backup.entityTags.length} entity-tag relationships`);
        for (const entityTag of backup.entityTags) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)',
            [entityTag.entity_id, entityTag.tag_id]
          );
        }
        
        // Import interaction types
        console.log(`Importing ${backup.interactionTypes.length} interaction types`);
        for (const type of backup.interactionTypes) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO interaction_types 
             (id, name, tag_id, icon, entity_type, score, color) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              type.id,
              type.name,
              type.tag_id,
              type.icon,
              type.entity_type,
              type.score || 1,
              type.color || '#666666'
            ]
          );
        }
        
        // Import interaction type tags
        console.log(`Importing ${backup.interactionTypeTags.length} interaction type tag relationships`);
        for (const itt of backup.interactionTypeTags) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO interaction_type_tags (interaction_type_id, tag_id) VALUES (?, ?)',
            [itt.interaction_type_id, itt.tag_id]
          );
        }
        
        // Import interactions
        console.log(`Importing ${backup.interactions.length} interactions`);
        for (const interaction of backup.interactions) {
          await this.db.runAsync(
            'INSERT OR REPLACE INTO interactions (id, entity_id, timestamp, type) VALUES (?, ?, ?, ?)',
            [
              interaction.id,
              interaction.entity_id,
              interaction.timestamp,
              interaction.type
            ]
          );
        }
        
        // Import photos with actual image data
        console.log(`Importing ${backup.photos.length} photos`);
        for (const photo of backup.photos as EntityPhotoWithData[]) {
          // If we have base64 image data, save it to a file
          let newUri = photo.uri;
          if (photo.base64Data) {
            try {
              // Create photos directory if it doesn't exist
              const photosDir = `${FileSystem.documentDirectory}photos/`;
              const dirInfo = await FileSystem.getInfoAsync(photosDir);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
              }
              
              // Generate new file path
              const fileName = `photo_${photo.id}_${Date.now()}.jpg`;
              const newFilePath = `${photosDir}${fileName}`;
              
              // Write the base64 data to the file
              await FileSystem.writeAsStringAsync(newFilePath, photo.base64Data, {
                encoding: FileSystem.EncodingType.Base64
              });
              
              // Update the URI to point to the new file
              newUri = newFilePath;
            } catch (fileError) {
              console.warn(`Error saving photo file for ${photo.id}:`, fileError);
              // Keep the original URI if we can't save the file
            }
          }
          
          // Insert the photo metadata into the database
          await this.db.runAsync(
            'INSERT OR REPLACE INTO entity_photos (id, entity_id, uri, caption, timestamp) VALUES (?, ?, ?, ?, ?)',
            [
              photo.id,
              photo.entity_id,
              newUri,
              photo.caption,
              photo.timestamp
            ]
          );
        }
        
        // Import group members
        console.log(`Importing ${backup.groupMembers.length} group member relationships`);
        for (const groupMember of backup.groupMembers) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)',
            [groupMember.group_id, groupMember.member_id]
          );
        }
        
        // Import favorites
        console.log(`Importing ${backup.favorites.length} favorites`);
        for (const favorite of backup.favorites) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO favorites (entity_id) VALUES (?)',
            [favorite.entity_id]
          );
        }
        
        // Commit the transaction
        await this.db.execAsync('COMMIT');
        console.log('Unencrypted import completed successfully');
        return true;
      } catch (error: any) {
        // Rollback the transaction in case of error
        await this.db.execAsync('ROLLBACK');
        console.error('Error during unencrypted import, rolling back:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Error importing unencrypted data:', error);
      throw new Error('Failed to import unencrypted data: ' + (error.message || 'Unknown error'));
    }
  }

  // Emergency recovery method that attempts to decrypt a backup with HMAC verification disabled
  async recoverBackupEmergency(encryptedData: string, passphrase: string): Promise<boolean> {
    try {
      console.log('Starting emergency backup recovery');
      
      // Parse the encrypted data package
      let encryptedPackage;
      try {
        encryptedPackage = JSON.parse(encryptedData);
        console.log('Successfully parsed encrypted package');
      } catch (parseError) {
        console.error('Failed to parse encrypted data:', parseError);
        throw new Error('Invalid backup format. The file does not appear to be a valid encrypted backup.');
      }
      
      // Validate package structure
      if (!encryptedPackage.salt || !encryptedPackage.iv || !encryptedPackage.data) {
        console.error('Invalid package structure:', Object.keys(encryptedPackage));
        throw new Error('Invalid backup format. Missing required encryption components.');
      }
      
      // Extract salt, IV, and encrypted data
      try {
        // Try to parse the hex strings
        const saltMatches = encryptedPackage.salt.match(/.{1,2}/g);
        const ivMatches = encryptedPackage.iv.match(/.{1,2}/g);
        const dataMatches = encryptedPackage.data.match(/.{1,2}/g);
        
        if (!saltMatches || !ivMatches || !dataMatches) {
          throw new Error('Invalid hex data in encrypted backup');
        }
        
        const salt = new Uint8Array(saltMatches.map((byte: string) => parseInt(byte, 16)));
        const iv = new Uint8Array(ivMatches.map((byte: string) => parseInt(byte, 16)));
        const data = new Uint8Array(dataMatches.map((byte: string) => parseInt(byte, 16)));
        
        console.log(`Extracted encryption components: Salt length=${salt.length}, IV length=${iv.length}, Data length=${data.length}`);
        
        // Generate the key from the passphrase and salt
        const hashKey = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          passphrase + Array.from(salt).map((b: number) => b.toString(16)).join('')
        );
        console.log('Generated hash key from passphrase');
        
        // Decrypt the data without HMAC verification
        const keyBytes = new TextEncoder().encode(hashKey);
        const decryptedBytes = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
          decryptedBytes[i] = data[i] ^ keyBytes[i % keyBytes.length];
        }
        
        console.log('⚠️ EMERGENCY MODE: Bypassing HMAC verification');
        
        // Convert the decrypted data back to a string
        const decryptedText = new TextDecoder().decode(decryptedBytes);
        
        // Validate that the decrypted content is valid JSON
        let backupData;
        try {
          backupData = JSON.parse(decryptedText);
          console.log('Successfully decrypted and parsed backup data');
        } catch (jsonError) {
          console.error('Decrypted data is not valid JSON', jsonError);
          throw new Error('Decryption produced invalid data. Likely incorrect passphrase or corrupted file.');
        }
        
        // Validate backup format
        if (!backupData.version || !backupData.entities) {
          throw new Error('Invalid backup format. Missing required data.');
        }
        
        // Clear existing data before import
        await this.clearAllDataForImport();
        
        // Start a transaction for the import
        await this.db.execAsync('BEGIN TRANSACTION');
        
        try {
          // Import entities
          console.log(`Importing ${backupData.entities.length} entities`);
          for (const entity of backupData.entities) {
            await this.db.runAsync(
              `INSERT OR REPLACE INTO entities 
               (id, name, type, details, image, interaction_score, created_at, updated_at, encrypted_data) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                entity.id,
                entity.name,
                entity.type,
                entity.details,
                entity.image,
                entity.interaction_score || 0,
                entity.created_at,
                entity.updated_at,
                entity.encrypted_data
              ]
            );
          }
          
          // Import tags
          console.log(`Importing ${backupData.tags.length} tags`);
          for (const tag of backupData.tags) {
            await this.db.runAsync(
              'INSERT OR REPLACE INTO tags (id, name, count) VALUES (?, ?, ?)',
              [tag.id, tag.name, tag.count || 0]
            );
          }
          
          // Import entity tags
          console.log(`Importing ${backupData.entityTags.length} entity-tag relationships`);
          for (const entityTag of backupData.entityTags) {
            await this.db.runAsync(
              'INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)',
              [entityTag.entity_id, entityTag.tag_id]
            );
          }
          
          // Import interaction types
          console.log(`Importing ${backupData.interactionTypes.length} interaction types`);
          for (const type of backupData.interactionTypes) {
            await this.db.runAsync(
              `INSERT OR REPLACE INTO interaction_types 
               (id, name, tag_id, icon, entity_type, score, color) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                type.id,
                type.name,
                type.tag_id,
                type.icon,
                type.entity_type,
                type.score || 1,
                type.color || '#666666'
              ]
            );
          }
          
          // Import interaction type tags
          console.log(`Importing ${backupData.interactionTypeTags.length} interaction type tag relationships`);
          for (const itt of backupData.interactionTypeTags) {
            await this.db.runAsync(
              'INSERT OR IGNORE INTO interaction_type_tags (interaction_type_id, tag_id) VALUES (?, ?)',
              [itt.interaction_type_id, itt.tag_id]
            );
          }
          
          // Import interactions
          console.log(`Importing ${backupData.interactions.length} interactions`);
          for (const interaction of backupData.interactions) {
            await this.db.runAsync(
              'INSERT OR REPLACE INTO interactions (id, entity_id, timestamp, type) VALUES (?, ?, ?, ?)',
              [
                interaction.id,
                interaction.entity_id,
                interaction.timestamp,
                interaction.type
              ]
            );
          }
          
          // Import photos with actual image data
          console.log(`Importing ${backupData.photos.length} photos`);
          for (const photo of backupData.photos as EntityPhotoWithData[]) {
            // If we have base64 image data, save it to a file
            let newUri = photo.uri;
            if (photo.base64Data) {
              try {
                // Create photos directory if it doesn't exist
                const photosDir = `${FileSystem.documentDirectory}photos/`;
                const dirInfo = await FileSystem.getInfoAsync(photosDir);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
                }
                
                // Generate new file path
                const fileName = `photo_${photo.id}_${Date.now()}.jpg`;
                const newFilePath = `${photosDir}${fileName}`;
                
                // Write the base64 data to the file
                await FileSystem.writeAsStringAsync(newFilePath, photo.base64Data, {
                  encoding: FileSystem.EncodingType.Base64
                });
                
                // Update the URI to point to the new file
                newUri = newFilePath;
              } catch (fileError) {
                console.warn(`Error saving photo file for ${photo.id}:`, fileError);
                // Keep the original URI if we can't save the file
              }
            }
            
            // Insert the photo metadata into the database
            await this.db.runAsync(
              'INSERT OR REPLACE INTO entity_photos (id, entity_id, uri, caption, timestamp) VALUES (?, ?, ?, ?, ?)',
              [
                photo.id,
                photo.entity_id,
                newUri,
                photo.caption,
                photo.timestamp
              ]
            );
          }
          
          // Import group members
          console.log(`Importing ${backupData.groupMembers.length} group member relationships`);
          for (const groupMember of backupData.groupMembers) {
            await this.db.runAsync(
              'INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES (?, ?)',
              [groupMember.group_id, groupMember.member_id]
            );
          }
          
          // Import favorites
          console.log(`Importing ${backupData.favorites.length} favorites`);
          for (const favorite of backupData.favorites) {
            await this.db.runAsync(
              'INSERT OR IGNORE INTO favorites (entity_id) VALUES (?)',
              [favorite.entity_id]
            );
          }
          
          // Commit the transaction
          await this.db.execAsync('COMMIT');
          console.log('Emergency recovery completed successfully');
          return true;
        } catch (error: any) {
          // Rollback the transaction in case of error
          await this.db.execAsync('ROLLBACK');
          console.error('Error during emergency import, rolling back:', error);
          throw error;
        }
      } catch (dataError: any) {
        console.error('Error processing encrypted data:', dataError);
        throw new Error(`Error processing encrypted data: ${dataError.message}`);
      }
    } catch (error: any) {
      console.error('Error recovering backup:', error);
      throw new Error(`Failed to recover backup: ${error.message || 'Unknown error'}`);
    }
  }
}

// Create and export a singleton instance
export const database = new Database(); 