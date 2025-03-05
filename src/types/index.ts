import { EntityType } from '../database/Database';

// Base entity interface
export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  details?: string;
  image?: string;
  interaction_score: number;
  created_at: number;
  updated_at: number;
}

// Person entity
export interface Person extends Entity {
  type: EntityType.PERSON;
  phone?: string;
  email?: string;
  address?: string;
}

// Group entity
export interface Group extends Entity {
  type: EntityType.GROUP;
  members?: string[]; // Array of person IDs
}

// Topic entity
export interface Topic extends Entity {
  type: EntityType.TOPIC;
  related_entities?: string[]; // Array of entity IDs
}

// Navigation params
export type RootStackParamList = {
  Home: undefined;
  EntityDetail: { id: string };
  EditEntity: { id?: string; type?: EntityType };
  ContactImport: undefined;
  Debug: undefined;
}; 