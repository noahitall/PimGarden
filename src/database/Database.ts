import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

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
interface Tag {
  id: string;
  name: string;
  count: number; // Number of entities using this tag
}

// EntityTag interface (relationship between entities and tags)
interface EntityTag {
  entity_id: string;
  tag_id: string;
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
    // For this example, we'll just stringify and hash the data
    const jsonData = JSON.stringify(data);
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      jsonData
    );
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

  // Increment interaction score and record timestamp
  async incrementInteractionScore(id: string): Promise<boolean> {
    // Start a transaction
    await this.db.execAsync('BEGIN TRANSACTION');
    
    try {
      // Update the entity's interaction score
      const updateQuery = `
        UPDATE entities 
        SET interaction_score = interaction_score + 1, 
            updated_at = ? 
        WHERE id = ?
      `;
      await this.db.runAsync(updateQuery, [Date.now(), id]);
      
      // Record the interaction timestamp
      const interactionId = await this.generateId();
      const timestamp = Date.now();
      const insertQuery = `
        INSERT INTO interactions (id, entity_id, timestamp)
        VALUES (?, ?, ?)
      `;
      await this.db.runAsync(insertQuery, [interactionId, id, timestamp]);
      
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
  ): Promise<{ id: string; timestamp: number; formattedDate: string }[]> {
    const query = `
      SELECT id, timestamp
      FROM interactions 
      WHERE entity_id = ? 
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
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
        formattedDate
      };
    });
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

  // Search entities by name, phone number, or email
  async searchEntities(searchTerm: string, type?: EntityType): Promise<Entity[]> {
    if (!searchTerm.trim()) {
      return this.getAllEntities(type);
    }

    const searchPattern = `%${searchTerm}%`;
    let query = `
      SELECT * FROM entities 
      WHERE (name LIKE ? OR details LIKE ?)
    `;
    
    const params: any[] = [searchPattern, searchPattern];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const result = await this.db.getAllAsync(query, params) as Entity[];
    return result;
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
}

// Create and export a singleton instance
export const database = new Database(); 