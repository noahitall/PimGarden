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
        FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
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
      
      console.log('All migrations completed. Current version:', await this.db.getFirstAsync('PRAGMA user_version'));
      
    } catch (error) {
      console.error('Error running migrations:', error);
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

  // Encrypt sensitive data
  private async encryptData(data: any): Promise<string> {
    // In a real app, you would use a proper encryption library
    // For this demo, we'll just stringify the data directly
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.error('Error stringifying data:', error);
      return '{}'; // Return empty object as fallback
    }
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
  async getAllEntities(type?: EntityType): Promise<Entity[]> {
    let query = 'SELECT * FROM entities';
    const params: any[] = [];
    
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const result = await this.db.getAllAsync(query, params) as Entity[];
    return result;
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
  async incrementInteractionScore(id: string, interactionType: string = 'General Contact'): Promise<boolean> {
    try {
      // Start a transaction
      await this.db.execAsync('BEGIN TRANSACTION');
      
      // Increment the interaction score
      const updateQuery = `
        UPDATE entities 
        SET interaction_score = interaction_score + 1, 
            updated_at = ? 
        WHERE id = ?
      `;
      await this.db.runAsync(updateQuery, [Date.now(), id]);
      
      // Record the interaction timestamp with type
      const interactionId = await this.generateId();
      const timestamp = Date.now();
      const insertQuery = `
        INSERT INTO interactions (id, entity_id, timestamp, type)
        VALUES (?, ?, ?, ?)
      `;
      await this.db.runAsync(insertQuery, [interactionId, id, timestamp, interactionType]);
      
      // Commit the transaction
      await this.db.execAsync('COMMIT');
      return true;
    } catch (error) {
      // Rollback on error
      await this.db.execAsync('ROLLBACK');
      console.error('Error incrementing interaction score:', error);
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
        await this.db.runAsync(
          'INSERT INTO tags (id, name, count) VALUES (?, ?, 1)',
          [tagId, tagName]
        );
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
        
        // Increment tag count
        await this.db.runAsync(
          'UPDATE tags SET count = count + 1 WHERE id = ?',
          [tagId]
        );
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
        `SELECT t.* FROM tags t
         JOIN entity_tags et ON t.id = et.tag_id
         WHERE et.entity_id = ?
         ORDER BY t.name COLLATE NOCASE`,
        [entityId]
      );
      
      return tags;
    } catch (error) {
      console.error('Error getting entity tags:', error);
      return [];
    }
  }
  
  // Get all tags (for autocomplete)
  async getAllTags(searchTerm?: string): Promise<Tag[]> {
    try {
      let query = 'SELECT * FROM tags ORDER BY name COLLATE NOCASE';
      const params: any[] = [];
      
      if (searchTerm) {
        query = 'SELECT * FROM tags WHERE name LIKE ? ORDER BY name COLLATE NOCASE';
        params.push(`%${searchTerm}%`);
      }
      
      const tags = await this.db.getAllAsync<Tag>(query, params);
      return tags;
    } catch (error) {
      console.error('Error getting all tags:', error);
      return [];
    }
  }

  // Get all interaction types
  async getInteractionTypes(): Promise<InteractionType[]> {
    const query = `
      SELECT id, name, tag_id, icon, entity_type
      FROM interaction_types
      ORDER BY name
    `;
    
    const results = await this.db.getAllAsync(query);
    return results as InteractionType[];
  }

  // Get interaction types appropriate for an entity based on its tags and type
  async getEntityInteractionTypes(entityId: string): Promise<InteractionType[]> {
    try {
      // First get the entity's type
      const entity = await this.getEntityById(entityId);
      if (!entity) return [];
      
      // Get general interaction types (not associated with any tags or entity types)
      const generalTypesQuery = `
        SELECT it.id, it.name, it.tag_id, it.icon, it.entity_type
        FROM interaction_types it
        WHERE it.tag_id IS NULL 
        AND it.entity_type IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM interaction_type_tags itt
          WHERE itt.interaction_type_id = it.id
        )
        ORDER BY it.name
      `;
      
      const generalTypes = await this.db.getAllAsync(generalTypesQuery);
      
      // Get entity-type specific interaction types - modified to handle JSON arrays
      // More inclusive: Get ALL interactions associated with this entity type
      const entityTypeQuery = `
        SELECT id, name, tag_id, icon, entity_type
        FROM interaction_types
        WHERE entity_type IS NULL 
           OR entity_type = ? 
           OR entity_type LIKE ?
           OR entity_type LIKE ?
           OR entity_type LIKE ?
        ORDER BY name
      `;
      
      // These LIKE patterns match JSON arrays containing this entity type
      const jsonPattern1 = `%"${entity.type}"]%`; // Matches at the end of array
      const jsonPattern2 = `%"${entity.type}",%`; // Matches at beginning or middle with comma after
      const jsonPattern3 = `%,\"${entity.type}\"%`; // Matches in the middle with comma before
      
      const entityTypeTypes = await this.db.getAllAsync(entityTypeQuery, [
        entity.type, 
        jsonPattern1,
        jsonPattern2,
        jsonPattern3
      ]);
      
      // Get the entity's tags
      const entityTags = await this.getEntityTags(entityId);
      const entityTagIds = entityTags.map(tag => tag.id);
      
      // More inclusive approach: Get ALL interaction types associated with ANY tag
      // If the entity has no tags, we'll skip this query
      let tagTypes: any[] = [];
      
      if (entityTagIds.length > 0) {
        // Build placeholders for the IN clause
        const placeholders = entityTagIds.map(() => '?').join(',');
        
        const tagTypesQuery = `
          SELECT DISTINCT it.id, it.name, it.tag_id, it.icon, it.entity_type
          FROM interaction_types it
          JOIN interaction_type_tags itt ON it.id = itt.interaction_type_id
          WHERE itt.tag_id IN (${placeholders})
          AND (it.entity_type IS NULL 
               OR it.entity_type = ? 
               OR it.entity_type LIKE ?
               OR it.entity_type LIKE ?
               OR it.entity_type LIKE ?)
          ORDER BY it.name
        `;
        
        // Params start with tag IDs, then entity type patterns
        const params = [...entityTagIds, entity.type, jsonPattern1, jsonPattern2, jsonPattern3];
        tagTypes = await this.db.getAllAsync(tagTypesQuery, params);
      }
      
      // Also get ALL tag-related interaction types regardless of entity type
      // This makes the logic more inclusive
      let allTagTypes: any[] = [];
      if (entityTagIds.length > 0) {
        const placeholders = entityTagIds.map(() => '?').join(',');
        const allTagTypesQuery = `
          SELECT DISTINCT it.id, it.name, it.tag_id, it.icon, it.entity_type
          FROM interaction_types it
          JOIN interaction_type_tags itt ON it.id = itt.interaction_type_id
          WHERE itt.tag_id IN (${placeholders})
          ORDER BY it.name
        `;
        
        allTagTypes = await this.db.getAllAsync(allTagTypesQuery, entityTagIds);
      }
      
      // Also check for the legacy tag_id field for backward compatibility
      let legacyTagTypes: any[] = [];
      
      if (entityTagIds.length > 0) {
        // Build placeholders for the IN clause
        const placeholders = entityTagIds.map(() => '?').join(',');
        
        const legacyTagTypesQuery = `
          SELECT DISTINCT it.id, it.name, it.tag_id, it.icon, it.entity_type
          FROM interaction_types it
          WHERE it.tag_id IN (${placeholders})
          AND (it.entity_type IS NULL 
               OR it.entity_type = ? 
               OR it.entity_type LIKE ?
               OR it.entity_type LIKE ?
               OR it.entity_type LIKE ?)
          ORDER BY it.name
        `;
        
        // Params start with tag IDs, then entity type patterns
        const params = [...entityTagIds, entity.type, jsonPattern1, jsonPattern2, jsonPattern3];
        legacyTagTypes = await this.db.getAllAsync(legacyTagTypesQuery, params);
        
        // Also get ALL legacy tag types regardless of entity type
        const allLegacyTagTypesQuery = `
          SELECT DISTINCT it.id, it.name, it.tag_id, it.icon, it.entity_type
          FROM interaction_types it
          WHERE it.tag_id IN (${placeholders})
          ORDER BY it.name
        `;
        
        const allLegacyTagTypes = await this.db.getAllAsync(allLegacyTagTypesQuery, entityTagIds);
        legacyTagTypes = [...legacyTagTypes, ...allLegacyTagTypes];
      }
      
      // Combine and return all types, removing duplicates
      const allTypes = [...generalTypes, ...entityTypeTypes, ...tagTypes, ...allTagTypes, ...legacyTagTypes] as InteractionType[];
      
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
    entityType: string | null = null
  ): Promise<string> {
    const id = await this.generateId();
    await this.db.runAsync(
      'INSERT INTO interaction_types (id, name, tag_id, icon, entity_type) VALUES (?, ?, ?, ?, ?)',
      [id, name, tagId, icon, entityType]
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
    // First try to get tags from the junction table
    const query = `
      SELECT t.id, t.name, COUNT(et.entity_id) as count
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
      
      // Otherwise, check if there's a tag_id directly in the interaction_types table (for backward compatibility)
      const legacyQuery = `
        SELECT t.id, t.name, COUNT(et.entity_id) as count
        FROM tags t
        LEFT JOIN entity_tags et ON t.id = et.tag_id
        WHERE t.id = (SELECT tag_id FROM interaction_types WHERE id = ? AND tag_id IS NOT NULL)
        GROUP BY t.id
        ORDER BY t.name COLLATE NOCASE
      `;
      
      const legacyTags = await this.db.getAllAsync<Tag>(legacyQuery, [typeId]);
      return legacyTags;
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
}

// Create and export a singleton instance
export const database = new Database(); 