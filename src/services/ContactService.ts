import * as Contacts from 'expo-contacts';
import { database, EntityType } from '../database/Database';

// Interface for contact identifiers
interface ContactIdentifier {
  name: string;
  phone?: string;
  email?: string;
}

export class ContactService {
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
    // Get all person entities from the database
    const persons = await database.getAllEntities(EntityType.PERSON);
    
    // Extract identifiers from the contact
    const contactIdentifiers = this.extractContactIdentifiers(contact);
    
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
  }

  // Extract identifiers from a contact
  private extractContactIdentifiers(contact: Contacts.Contact): ContactIdentifier[] {
    const identifiers: ContactIdentifier[] = [];
    const name = contact.name || 
                `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                'Unknown Contact';
    
    // Add phone numbers
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      contact.phoneNumbers.forEach(phone => {
        if (phone.number) {
          // Normalize phone number by removing non-digits
          const normalizedPhone = phone.number.replace(/\D/g, '');
          identifiers.push({
            name,
            phone: normalizedPhone
          });
        }
      });
    }
    
    // Add emails
    if (contact.emails && contact.emails.length > 0) {
      contact.emails.forEach(email => {
        if (email.email) {
          // Normalize email by converting to lowercase
          const normalizedEmail = email.email.toLowerCase();
          identifiers.push({
            name,
            email: normalizedEmail
          });
        }
      });
    }
    
    return identifiers;
  }

  // Helper function to generate a random ID (replacement for uuid.v4())
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
  }

  // Import a contact to the database
  async importContact(contact: Contacts.Contact): Promise<string | null> {
    try {
      // Check if contact already exists
      const exists = await this.contactExists(contact);
      if (exists) {
        console.log('Contact already exists, skipping import:', contact.name);
        return null;
      }
      
      // Create a name from the contact data
      const name = contact.name || 
                  `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                  'Unknown Contact';
      
      // Create details from contact information
      const details = this.formatContactDetails(contact);
      
      // Get image if available
      const image = contact.image?.uri;
      
      // Create entity first
      const entityId = await database.createEntity(
        name,
        EntityType.PERSON,
        details,
        image,
        {} // Empty object for additionalData to avoid hash instead of JSON
      );
      
      if (entityId) {
        // Process phone numbers
        const phoneNumbers = contact.phoneNumbers?.map((phone, index) => ({
          id: this.generateId(),
          value: phone.number || '',
          label: phone.label || 'mobile',
          isPrimary: index === 0, // First number is primary by default
        })) || [];
        
        // Process email addresses
        const emailAddresses = contact.emails?.map((email, index) => ({
          id: this.generateId(),
          value: email.email || '',
          label: email.label || 'home',
          isPrimary: index === 0, // First email is primary by default
        })) || [];
        
        // Process physical addresses
        const physicalAddresses = contact.addresses?.map((address, index) => ({
          id: this.generateId(),
          street: address.street || '',
          city: address.city || '',
          state: address.region || '',
          postalCode: address.postalCode || '',
          country: address.country || '',
          label: address.label || 'home',
          isPrimary: index === 0, // First address is primary by default
        })) || [];
        
        // Update the person with structured contact data
        await database.updatePersonContactData(
          entityId,
          {
            phoneNumbers,
            emailAddresses,
            physicalAddresses
          }
        );
      }
      
      return entityId;
    } catch (error) {
      console.error('Error importing contact:', error);
      return null;
    }
  }

  // Format contact details as a string
  private formatContactDetails(contact: Contacts.Contact): string {
    const details = [];
    
    // Add phone numbers
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      const phones = contact.phoneNumbers.map(p => `${p.label}: ${p.number}`).join('\n');
      details.push(`Phone:\n${phones}`);
    }
    
    // Add emails
    if (contact.emails && contact.emails.length > 0) {
      const emails = contact.emails.map(e => `${e.label}: ${e.email}`).join('\n');
      details.push(`Email:\n${emails}`);
    }
    
    // Add addresses
    if (contact.addresses && contact.addresses.length > 0) {
      const addresses = contact.addresses.map(a => {
        return `${a.label}: ${[
          a.street, 
          a.city, 
          a.region, 
          a.postalCode, 
          a.country
        ].filter(Boolean).join(', ')}`;
      }).join('\n');
      details.push(`Address:\n${addresses}`);
    }
    
    return details.join('\n\n');
  }
}

// Create and export a singleton instance
export const contactService = new ContactService(); 