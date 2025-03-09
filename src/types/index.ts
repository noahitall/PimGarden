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
  is_hidden?: boolean; // Whether the entity is hidden from the main views
}

// Contact field interfaces
export interface PhoneNumber {
  id: string;
  value: string;
  label: string; // e.g., "Mobile", "Work", "Home"
  isPrimary: boolean;
}

export interface EmailAddress {
  id: string;
  value: string;
  label: string; // e.g., "Personal", "Work"
  isPrimary: boolean;
}

export interface PhysicalAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label: string; // e.g., "Home", "Work"
  isPrimary: boolean;
  // For convenience when displaying or sorting
  formattedAddress?: string;
}

export interface ContactData {
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
  physicalAddresses: PhysicalAddress[];
  birthday?: string; // ISO format date string for birthday
}

// Person entity
export interface Person extends Entity {
  type: EntityType.PERSON;
  // Legacy fields - kept for backward compatibility
  phone?: string;
  email?: string;
  address?: string;
  // New field for structured contact data
  contactData?: ContactData;
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
  EntityDetail: { id: string; merge?: boolean };
  EditEntity: { id?: string; type?: EntityType };
  ContactImport: undefined;
  Debug: undefined;
  Settings: undefined;
  GroupMembers: { groupId: string; groupName: string };
  InteractionTypes: undefined;
  NotificationManager: undefined;
  DatabaseFix: undefined;
}; 