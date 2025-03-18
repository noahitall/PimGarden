import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { database, Database, EntityType } from '../database/Database';
import { PhoneNumber, EmailAddress, PhysicalAddress, ContactData } from '../types';

// Interface for contact identifiers
interface ContactIdentifier {
  name: string;
  phone?: string;
  email?: string;
}

export class ContactService {
  private database: Database;

  constructor() {
    this.database = database;
  }

  // Request permission to access contacts
  async requestPermission(): Promise<boolean> {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  }

  // Get all contacts from the device
  async getContacts(): Promise<Contacts.Contact[]> {
    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.ID,
        Contacts.Fields.Name,
        Contacts.Fields.FirstName,
        Contacts.Fields.LastName,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
        Contacts.Fields.Addresses,
        Contacts.Fields.Image,
      ],
    });
    return data;
  }

  // Check if a contact already exists in the database
  async contactExists(contact: Contacts.Contact): Promise<boolean> {
    try {
      // Get all person entities from the database
      const persons = await this.database.getAllEntities(EntityType.PERSON);
      
      // Extract identifiers from the contact
      const contactIdentifiers = await this.extractContactIdentifiers(contact);
      
      // If no identifiers, we can't check for duplicates
      if (contactIdentifiers.length === 0) return false;
      
      // Check each person in the database
      for (const person of persons) {
        // Try to extract identifiers from the person's encrypted data
        try {
          // In a real app, you would decrypt the data properly
          // For this example, we'll check if the name matches and any phone/email matches
          if (person.name === contact.name || 
              (contact.firstName && contact.lastName && 
               person.name === `${contact.firstName} ${contact.lastName}`.trim())) {
            
            // If we have a name match, check for phone or email match
            for (const identifier of contactIdentifiers) {
              // Check if this person has matching phone or email
              if ((identifier.phone && person.details?.includes(identifier.phone)) ||
                  (identifier.email && person.details?.includes(identifier.email))) {
                return true; // Found a duplicate
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
          console.error('Error checking for duplicate contact:', e);
        }
      }
      
      return false; // No duplicate found
    } catch (error) {
      console.error('Error in contactExists:', error);
      return false;
    }
  }

  // Extract identifiers from a contact
  private async extractContactIdentifiers(contact: Contacts.Contact): Promise<ContactIdentifier[]> {
    try {
      const identifiers: ContactIdentifier[] = [];
      const name = contact.name || 
                  `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                  'Unknown Contact';
      
      // Add phone numbers
      if (contact.phoneNumbers && Array.isArray(contact.phoneNumbers) && contact.phoneNumbers.length > 0) {
        for (const phone of contact.phoneNumbers) {
          if (phone && phone.number) {
            // Normalize phone number by removing non-digits
            const normalizedPhone = phone.number.replace(/\D/g, '');
            identifiers.push({
              name,
              phone: normalizedPhone
            });
          }
        }
      }
      
      // Add emails
      if (contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0) {
        for (const email of contact.emails) {
          if (email && email.email) {
            // Normalize email by converting to lowercase
            const normalizedEmail = email.email.toLowerCase();
            identifiers.push({
              name,
              email: normalizedEmail
            });
          }
        }
      }
      
      return identifiers;
    } catch (error) {
      console.error('Error in extractContactIdentifiers:', error);
      return [];
    }
  }

  // Find if a contact already exists in the database and return its ID
  async findExistingContactId(contact: Contacts.Contact): Promise<string | null> {
    try {
      // Get all person entities from the database
      const persons = await this.database.getAllEntities(EntityType.PERSON);
      
      // Extract identifiers from the contact
      const contactIdentifiers = await this.extractContactIdentifiers(contact);
      
      // If no identifiers, we can't check for duplicates
      if (contactIdentifiers.length === 0) return null;
      
      // Check each person in the database
      for (const person of persons) {
        try {
          // Check if the name matches
          if (person.name === contact.name || 
              (contact.firstName && contact.lastName && 
               person.name === `${contact.firstName} ${contact.lastName}`.trim())) {
            
            // If we have a name match, check for phone or email match
            for (const identifier of contactIdentifiers) {
              // Check if this person has matching phone or email
              if ((identifier.phone && person.details?.includes(identifier.phone)) ||
                  (identifier.email && person.details?.includes(identifier.email))) {
                console.log('Found existing contact with ID:', person.id);
                return person.id; // Found a match, return the ID
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
          console.error('Error checking for existing contact:', e);
        }
      }
      
      return null; // No match found
    } catch (error) {
      console.error('Error in findExistingContactId:', error);
      return null;
    }
  }

  // Format contact details for display
  formatContactDetails(contact: Contacts.Contact): string {
    let details = '';
    
    // Add phone numbers
    if (contact.phoneNumbers && Array.isArray(contact.phoneNumbers)) {
      contact.phoneNumbers.forEach(phone => {
        if (phone && phone.number) {
          details += `${phone.label || 'Phone'}: ${phone.number}\n`;
        }
      });
    }
    
    // Add email addresses
    if (contact.emails && Array.isArray(contact.emails)) {
      contact.emails.forEach(email => {
        if (email && email.email) {
          details += `${email.label || 'Email'}: ${email.email}\n`;
        }
      });
    }
    
    // Add physical addresses
    if (contact.addresses && Array.isArray(contact.addresses)) {
      contact.addresses.forEach(address => {
        if (address) {
          const addressStr = [
            address.street, 
            address.city, 
            address.region, 
            address.postalCode, 
            address.country
          ].filter(Boolean).join(', ');
          
          if (addressStr) {
            details += `${address.label || 'Address'}: ${addressStr}\n`;
          }
        }
      });
    }
    
    return details.trim();
  }

  // Store contact image and return the path
  async storeContactImage(image: any): Promise<string | undefined> {
    // Implementation to store the image
    // For now, return the image URI if available
    return image.uri;
  }

  // Generate a unique ID (using expo-crypto with fallback)
  async generateId(): Promise<string> {
    try {
      // Try to generate a UUID using expo-crypto
      return Crypto.randomUUID();
    } catch (error) {
      console.warn('Failed to generate UUID with Crypto.randomUUID(), using fallback method:', error);
      // Fallback to a basic ID generator that doesn't depend on crypto
      return this.generateFallbackId();
    }
  }

  // Fallback ID generator that doesn't rely on crypto APIs
  private generateFallbackId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}-${randomPart2}`;
  }

  // Import a contact to the database
  async importContact(contact: Contacts.Contact): Promise<string | null> {
    try {
      // Validate contact
      if (!contact) {
        console.error('ERROR: Cannot import null or undefined contact');
        return null;
      }
      
      console.log('DEBUG: Starting import for contact', contact.name);
      
      // Check if the contact already exists
      const existingId = await this.findExistingContactId(contact);
      if (existingId) {
        console.log('Contact already exists with ID:', existingId);
        return existingId;
      }
      
      // Extract name components
      let firstName = contact.firstName || '';
      let lastName = contact.lastName || '';
      let name = `${firstName} ${lastName}`.trim();
      
      // Fall back to company name if no person name
      if (!name && contact.company) {
        name = contact.company;
      }
      
      // Fallback to a generic name if everything else is missing
      if (!name) {
        name = 'Unknown Contact';
      }
      
      console.log('Using name:', name);
      
      // Format contact details for display
      const formattedDetails = this.formatContactDetails(contact);
      console.log('Formatted details length:', formattedDetails.length);
      
      // Check if the contact has an image
      let image: string | undefined = undefined;
      if (contact.image) {
        console.log('Contact has an image');
        // Store the image
        image = await this.storeContactImage(contact.image);
      }
      
      // Create an empty additionalData object
      const additionalData: any = {};
      
      // Create the entity
      const entityId = await this.database.createEntity(
        name, 
        EntityType.PERSON,
        formattedDetails, 
        image, 
        additionalData
      );
      
      if (!entityId) {
        console.error('Failed to create entity for contact', name);
        return null;
      }
      
      console.log('Created entity with ID:', entityId);
      
      // Prepare contact data
      const contactData: ContactData = {
        phoneNumbers: [],
        emailAddresses: [],
        physicalAddresses: []
      };
      
      // Add phone numbers
      if (contact.phoneNumbers && Array.isArray(contact.phoneNumbers)) {
        console.log('Processing', contact.phoneNumbers.length, 'phone numbers');
        const processedPhoneNumbers = [];
        
        for (let index = 0; index < contact.phoneNumbers.length; index++) {
          const phone = contact.phoneNumbers[index];
          if (!phone || !phone.number) continue;
          
          processedPhoneNumbers.push({
            id: await this.generateId(),
            label: phone.label || 'mobile',
            value: phone.number,
            isPrimary: index === 0
          });
        }
        
        contactData.phoneNumbers = processedPhoneNumbers;
        console.log('Processed', processedPhoneNumbers.length, 'phone numbers');
      } else {
        console.log('No phone numbers found or not an array');
      }
      
      // Add email addresses
      if (contact.emails && Array.isArray(contact.emails)) {
        console.log('Processing', contact.emails.length, 'email addresses');
        const processedEmails = [];
        
        for (let index = 0; index < contact.emails.length; index++) {
          const email = contact.emails[index];
          if (!email || !email.email) continue;
          
          processedEmails.push({
            id: await this.generateId(),
            label: email.label || 'work',
            value: email.email,
            isPrimary: index === 0
          });
        }
        
        contactData.emailAddresses = processedEmails;
        console.log('Processed', processedEmails.length, 'email addresses');
      } else {
        console.log('No email addresses found or not an array');
      }
      
      // Add physical addresses
      if (contact.addresses && Array.isArray(contact.addresses)) {
        console.log('Processing', contact.addresses.length, 'physical addresses');
        const processedAddresses = [];
        
        for (let index = 0; index < contact.addresses.length; index++) {
          const address = contact.addresses[index];
          if (!address) continue;
          
          processedAddresses.push({
            id: await this.generateId(),
            label: address.label || 'home',
            street: address.street || '',
            city: address.city || '',
            state: address.region || '',
            postalCode: address.postalCode || '',
            country: address.country || '',
            isPrimary: index === 0
          });
        }
        
        contactData.physicalAddresses = processedAddresses;
        console.log('Processed', processedAddresses.length, 'physical addresses');
      } else {
        console.log('No physical addresses found or not an array');
      }
      
      console.log('Contact data prepared:', 
        `${contactData.phoneNumbers.length} phones, ` +
        `${contactData.emailAddresses.length} emails, ` +
        `${contactData.physicalAddresses.length} addresses`
      );
      
      // Update the entity with contact data
      try {
        const updateSuccess = await this.database.updatePersonContactData(entityId, contactData);
        console.log('Contact data update success:', updateSuccess);
      } catch (error) {
        console.error('ERROR updating contact data:', error);
        // We've already created the entity, so we'll return the ID even if updating fails
      }
      
      return entityId;
    } catch (error) {
      console.error('ERROR importing contact:', error);
      if (error instanceof TypeError) {
        console.error('TypeError details:', error.message);
        console.error('Stack trace:', error.stack);
      }
      return null;
    }
  }
}

// Create and export a singleton instance
export const contactService = new ContactService(); 