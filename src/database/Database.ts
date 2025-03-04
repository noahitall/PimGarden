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

  // Increment interaction score
  async incrementInteractionScore(id: string): Promise<boolean> {
    const query = `
      UPDATE entities 
      SET interaction_score = interaction_score + 1, 
          updated_at = ? 
      WHERE id = ?
    `;
    
    const result = await this.db.runAsync(query, [Date.now(), id]);
    return result.changes > 0;
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
}

// Create and export a singleton instance
export const database = new Database(); 