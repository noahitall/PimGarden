import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { format } from 'date-fns';

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

  // Initialize default interaction types
  private async initDefaultInteractionTypes(): Promise<void> {
    const defaultTypes = [
      { name: 'General Contact', icon: 'account-check', tag_id: null },
      { name: 'Message', icon: 'message-text', tag_id: null },
      { name: 'Phone Call', icon: 'phone', tag_id: null },
      { name: 'Meeting', icon: 'account-group', tag_id: null },
      { name: 'Email', icon: 'email', tag_id: null },
      { name: 'Coffee', icon: 'coffee', tag_id: null },
      { name: 'Birthday', icon: 'cake', tag_id: null }
    ];
    
    for (const type of defaultTypes) {
      // Check if type already exists
      const existingType = await this.db.getAllAsync(
        'SELECT * FROM interaction_types WHERE name = ?',
        [type.name]
      );
      
      if (existingType.length === 0) {
        const id = await this.generateId();
        await this.db.runAsync(
          'INSERT INTO interaction_types (id, name, tag_id, icon) VALUES (?, ?, ?, ?)',
          [id, type.name, type.tag_id, type.icon]
        );
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
      const jsonString = JSON.stringify(data);
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        jsonString
      );
      return digest;
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw error;
    }
  }

  // Decrypt data using the same symmetric key
  private async decryptData(encryptedData: string): Promise<string> {
    // For now, since we're using a hash function in encryptData,
    // we can't actually decrypt. In a real app, you would use proper
    // encryption/decryption with a symmetric key.
    // This is just for demonstration purposes.
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

  // Search entities by name, phone number, email, or address
  async searchEntities(searchTerm: string, type?: EntityType): Promise<Entity[]> {
    if (!searchTerm.trim()) {
      return this.getAllEntities(type);
    }

    const searchPattern = `%${searchTerm}%`;
    const searchTermLower = searchTerm.toLowerCase();
    
    try {
      // Start with entities that match name or details
      let query = `
        SELECT e.* FROM entities e 
        WHERE (e.name LIKE ? OR e.details LIKE ?)
      `;
      
      if (type) {
        query += ` AND e.type = ?`;
      }
      
      const params = type 
        ? [searchPattern, searchPattern, type]
        : [searchPattern, searchPattern];
      
      const nameMatchResults = await this.db.getAllAsync<Entity>(query, params);
      const resultMap = new Map<string, Entity>();
      
      // Add name/details matches to result map
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
              // Skip this entity if we can't parse the data
              console.error('Error parsing contact data:', e);
              continue;
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
      // First get the entity's type
      const entity = await this.getEntityById(entityId);
      if (!entity) return [];
      
      // Start with an empty array to collect all types
      let allTypesRaw: any[] = [];
      
      // Try each query separately and handle errors individually
      
      // Define patterns for JSON array matching up front (used in multiple queries)
      // These LIKE patterns match JSON arrays containing this entity type
      const jsonPattern1 = `%"${entity.type}"]%`; // Matches at the end of array
      const jsonPattern2 = `%"${entity.type}",%`; // Matches at beginning or middle with comma after
      const jsonPattern3 = `%,\"${entity.type}\"%`; // Matches in the middle with comma before
      
      // Check if the color column exists
      let hasColorColumn = true;
      try {
        const columnCheck = await this.db.getFirstAsync<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM pragma_table_info('interaction_types') WHERE name = 'color'"
        );
        hasColorColumn = columnCheck?.cnt ? columnCheck.cnt > 0 : false;
      } catch (error) {
        console.warn('Error checking for color column:', error);
        hasColorColumn = false;
      }
      
      // 1. Get general interaction types (not associated with any tags or entity types)
      try {
        const columnSelection = hasColorColumn 
          ? "id, name, tag_id, icon, entity_type, color, score" 
          : "id, name, tag_id, icon, entity_type, score";
        
        const generalTypesQuery = `
          SELECT ${columnSelection}
          FROM interaction_types
          WHERE tag_id IS NULL 
          AND entity_type IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM interaction_type_tags itt
            WHERE itt.interaction_type_id = interaction_types.id
          )
          ORDER BY name
        `;
        
        const generalTypes = await this.db.getAllAsync(generalTypesQuery);
        allTypesRaw = [...allTypesRaw, ...generalTypes];
      } catch (error) {
        console.warn('Error getting general interaction types:', error);
      }
      
      // 2. Get entity-type specific interaction types
      try {
        const columnSelection = hasColorColumn 
          ? "id, name, tag_id, icon, entity_type, color, score" 
          : "id, name, tag_id, icon, entity_type, score";
        
        // These LIKE patterns match JSON arrays containing this entity type
        const jsonPattern1 = `%"${entity.type}"]%`; // Matches at the end of array
        const jsonPattern2 = `%"${entity.type}",%`; // Matches at beginning or middle with comma after
        const jsonPattern3 = `%,\"${entity.type}\"%`; // Matches in the middle with comma before
        
        const entityTypeQuery = `
          SELECT ${columnSelection}
          FROM interaction_types
          WHERE entity_type IS NULL 
             OR entity_type = ? 
             OR entity_type LIKE ?
             OR entity_type LIKE ?
             OR entity_type LIKE ?
          ORDER BY name
        `;
        
        const entityTypeTypes = await this.db.getAllAsync(entityTypeQuery, [
          entity.type, 
          jsonPattern1,
          jsonPattern2,
          jsonPattern3
        ]);
        
        allTypesRaw = [...allTypesRaw, ...entityTypeTypes];
      } catch (error) {
        console.warn('Error getting entity-type specific interaction types:', error);
      }
      
      // 3. Get the entity's tags
      const entityTags = await this.getEntityTags(entityId);
      const entityTagIds = entityTags.map(tag => tag.id);
      
      // 4. Get tag-specific interaction types
      if (entityTagIds.length > 0) {
        try {
          const columnSelection = hasColorColumn 
            ? "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.color, interaction_types.score" 
            : "interaction_types.id, interaction_types.name, interaction_types.tag_id, interaction_types.icon, interaction_types.entity_type, interaction_types.score";
          
          // Build placeholders for the IN clause
          const placeholders = entityTagIds.map(() => '?').join(',');
          
          const tagTypesQuery = `
            SELECT DISTINCT ${columnSelection}
            FROM interaction_types
            JOIN interaction_type_tags itt ON interaction_types.id = itt.interaction_type_id
            WHERE itt.tag_id IN (${placeholders})
            AND (interaction_types.entity_type IS NULL 
                 OR interaction_types.entity_type = ? 
                 OR interaction_types.entity_type LIKE ?
                 OR interaction_types.entity_type LIKE ?
                 OR interaction_types.entity_type LIKE ?)
            ORDER BY interaction_types.name
          `;
          
          // Params start with tag IDs, then entity type patterns
          const params = [...entityTagIds, entity.type, jsonPattern1, jsonPattern2, jsonPattern3];
          const tagTypes = await this.db.getAllAsync(tagTypesQuery, params);
          allTypesRaw = [...allTypesRaw, ...tagTypes];
        } catch (error) {
          console.warn('Error getting tag-specific interaction types:', error);
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
        
        // 6. Check for the legacy tag_id field for backward compatibility
        try {
          const columnSelection = hasColorColumn 
            ? "id, name, tag_id, icon, entity_type, color, score" 
            : "id, name, tag_id, icon, entity_type, score";
          
          const placeholders = entityTagIds.map(() => '?').join(',');
          
          const legacyTagTypesQuery = `
            SELECT DISTINCT ${columnSelection}
            FROM interaction_types
            WHERE tag_id IN (${placeholders})
            AND (entity_type IS NULL 
                 OR entity_type = ? 
                 OR entity_type LIKE ?
                 OR entity_type LIKE ?
                 OR entity_type LIKE ?)
            ORDER BY name
          `;
          
          // Params start with tag IDs, then entity type patterns
          const params = [...entityTagIds, entity.type, jsonPattern1, jsonPattern2, jsonPattern3];
          const legacyTagTypes = await this.db.getAllAsync(legacyTagTypesQuery, params);
          allTypesRaw = [...allTypesRaw, ...legacyTagTypes];
          
          // Also get ALL legacy tag types regardless of entity type
          const allLegacyTagTypesQuery = `
            SELECT DISTINCT ${columnSelection}
            FROM interaction_types
            WHERE tag_id IN (${placeholders})
            ORDER BY name
          `;
          
          const allLegacyTagTypes = await this.db.getAllAsync(allLegacyTagTypesQuery, entityTagIds);
          allTypesRaw = [...allTypesRaw, ...allLegacyTagTypes];
        } catch (error) {
          console.warn('Error getting legacy tag interaction types:', error);
        }
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

  // Add a new interaction type
  async addInteractionType(
    name: string, 
    icon: string, 
    tagId: string | null = null, 
    entityType: string | null = null,
    color: string = '#666666',
    score: number = 1
  ): Promise<string> {
    const id = await this.generateId();
    await this.db.runAsync(
      'INSERT INTO interaction_types (id, name, tag_id, icon, entity_type, color, score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, tagId, icon, entityType, color, score]
    );
    return id;
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
    const interactionTypes: { name: string, icon: string }[] = [];
    
    const lowerTagName = tagName.toLowerCase();
    
    // Add tag-specific interaction types based on common categories
    if (lowerTagName.includes('friend') || lowerTagName.includes('family')) {
      interactionTypes.push(
        { name: 'Visit', icon: 'home' },
        { name: 'Catch Up', icon: 'chat' },
        { name: 'Gift', icon: 'gift' }
      );
    }
    
    if (lowerTagName.includes('work') || lowerTagName.includes('colleague') || lowerTagName.includes('coworker')) {
      interactionTypes.push(
        { name: 'Meeting', icon: 'calendar' },
        { name: 'Presentation', icon: 'presentation' },
        { name: 'Project Discussion', icon: 'clipboard-text' }
      );
    }
    
    if (lowerTagName.includes('client') || lowerTagName.includes('customer')) {
      interactionTypes.push(
        { name: 'Sales Call', icon: 'phone-in-talk' },
        { name: 'Follow-up', icon: 'arrow-right-circle' },
        { name: 'Proposal', icon: 'file-document' }
      );
    }
    
    if (lowerTagName.includes('doctor') || lowerTagName.includes('medical') || lowerTagName.includes('health')) {
      interactionTypes.push(
        { name: 'Appointment', icon: 'calendar-check' },
        { name: 'Consultation', icon: 'stethoscope' }
      );
    }
    
    if (lowerTagName.includes('book') || lowerTagName.includes('author')) {
      interactionTypes.push(
        { name: 'Reading', icon: 'book-open-page-variant' },
        { name: 'Discussion', icon: 'forum' }
      );
    }
    
    if (lowerTagName.includes('hobby') || lowerTagName.includes('interest') || lowerTagName.includes('club')) {
      interactionTypes.push(
        { name: 'Activity', icon: 'run' },
        { name: 'Discussion', icon: 'forum' }
      );
    }
    
    // Add a generic type with the tag name if we haven't added any specific ones
    if (interactionTypes.length === 0) {
      interactionTypes.push({ name: `${tagName} Interaction`, icon: 'star' });
    }
    
    // Create the interaction types and associate them with the tag
    for (const type of interactionTypes) {
      await this.addInteractionType(type.name, type.icon, tagId, null);
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
      // Get the entity
      const entity = await this.getEntityById(entityId);
      if (!entity || entity.type !== EntityType.PERSON) {
        return null;
      }
      
      // Create a person entity
      const person: PersonEntity = {
        ...entity,
        type: EntityType.PERSON
      };
      
      // Parse the encrypted_data field if it exists
      if (entity.encrypted_data) {
        try {
          // In a real app, you would decrypt the data properly
          // For this demo, we're just parsing the JSON
          const contactData = JSON.parse(entity.encrypted_data);
          person.contactData = contactData;
        } catch (e) {
          console.error('Error parsing contact data:', e);
        }
      }
      
      return person;
    } catch (error) {
      console.error('Error getting person with contact data:', error);
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

      // Perform the update
      const result = await this.db.runAsync(
        `UPDATE interactions SET ${updateParts.join(', ')} WHERE id = ?`,
        params
      );

      // If the interaction was found and updated
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
        const sourceData = JSON.parse(await this.decryptData(sourceEntity.encrypted_data)) as ContactData;
        const targetData = JSON.parse(await this.decryptData(targetEntity.encrypted_data)) as ContactData;

        // Merge phone numbers
        const mergedPhoneNumbers = [...targetData.phoneNumbers];
        for (const phone of sourceData.phoneNumbers) {
          if (!mergedPhoneNumbers.some(p => p.value === phone.value)) {
            mergedPhoneNumbers.push(phone);
          }
        }

        // Merge email addresses
        const mergedEmails = [...targetData.emailAddresses];
        for (const email of sourceData.emailAddresses) {
          if (!mergedEmails.some(e => e.value === email.value)) {
            mergedEmails.push(email);
          }
        }

        // Merge physical addresses
        const mergedAddresses = [...targetData.physicalAddresses];
        for (const address of sourceData.physicalAddresses) {
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
        
        // Update the entity's interaction_score
        await this.db.runAsync(
          'UPDATE entities SET interaction_score = ? WHERE id = ?',
          [score, entity.id]
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

  // Updates user settings
  async updateSettings(settings: AppSettings): Promise<void> {
    try {
      const db = await this.getDBConnection();
      
      await db.transaction(tx => {
        tx.executeSql(
          'INSERT OR REPLACE INTO settings (id, key, value) VALUES (?, ?, ?)',
          [1, 'score_settings', JSON.stringify(settings)]
        );
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // Reset database version (DEVELOPMENT/TESTING ONLY)
  async resetDatabaseVersion(version: number): Promise<void> {
    try {
      console.log(`Resetting database version to ${version}...`);
      
      // Delete existing version record
      await this.db.runAsync('DELETE FROM db_version');
      
      // Insert new version
      await this.db.runAsync(
        'INSERT INTO db_version (version) VALUES (?)',
        [version]
      );
      
      console.log(`Database version reset to ${version}. Migrations will run on next app start.`);
    } catch (error) {
      console.error('Error resetting database version:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const database = new Database(); 