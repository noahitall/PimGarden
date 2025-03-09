# PimGarden Requirements Document

This document outlines the comprehensive requirements and use cases for the PimGarden application, a privacy-focused contact management system.

## Core Principles

1. **Privacy by Design**: All user data is stored locally on device with no automatic transmission to any servers
2. **Offline First**: The application functions entirely offline by default
3. **User Control**: Users have complete control over their data, including backup and restore options
4. **Intuitive Interface**: The UI should be clean, responsive, and easy to navigate
5. **Extensibility**: The codebase should be modular and allow for easy addition of new features

## User Use Cases

### Contact Management

#### UC-CM-1: Adding a New Contact
- **Description**: User wants to manually add a new person to their garden
- **Primary Actor**: App User
- **Preconditions**: Application is installed and running
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User taps the "+" button to create a new entity
  3. User selects "Person" as the entity type
  4. User enters the name and optional details for the person
  5. User can add a photo using camera or gallery
  6. User saves the new contact entry
- **Alternative Flows**:
  - User can cancel the creation process at any time
  - User can choose to add additional details like phone, email, etc.
- **Postconditions**: A new person entity is added to the database

#### UC-CM-2: Importing Contacts
- **Description**: User wants to import contacts from their device
- **Primary Actor**: App User
- **Preconditions**: Application has contacts permission
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User taps on menu and selects "Import Contacts"
  3. System displays list of device contacts
  4. User selects one or more contacts to import
  5. System imports selected contacts into the app database
- **Alternative Flows**:
  - If permission is not granted, user is prompted to enable it
  - User can search/filter device contacts before selecting
- **Postconditions**: Selected contacts are added to the database

#### UC-CM-3: Editing a Contact
- **Description**: User wants to modify information for an existing contact
- **Primary Actor**: App User
- **Preconditions**: At least one contact exists in the database
- **Main Flow**:
  1. User navigates to the contact details
  2. User taps "Edit" button
  3. User modifies contact information
  4. User saves changes
- **Alternative Flows**:
  - User can cancel edits without saving
  - User can change the contact's photo
- **Postconditions**: Contact information is updated in the database

#### UC-CM-4: Merging Duplicate Contacts
- **Description**: User wants to merge two duplicate contacts into one
- **Primary Actor**: App User
- **Preconditions**: At least two contacts exist in the database
- **Main Flow**:
  1. User enables merge mode from the home screen menu
  2. User selects the source contact (to be merged)
  3. User selects the target contact (to merge into)
  4. System confirms the merge action
  5. System combines all interactions, tags, and details from both contacts
- **Alternative Flows**:
  - User can cancel the merge process
  - System handles conflicts by keeping the most recent data
- **Postconditions**: Source contact is merged into target contact and removed from the database

### Group Management

#### UC-GM-1: Creating a Group
- **Description**: User wants to create a new group to organize contacts
- **Primary Actor**: App User
- **Preconditions**: Application is installed and running
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User taps the "+" button to create a new entity
  3. User selects "Group" as the entity type
  4. User enters a name and optional details for the group
  5. User saves the new group
- **Alternative Flows**:
  - User can cancel the creation process
  - User can immediately add members after creation
- **Postconditions**: A new group entity is added to the database

#### UC-GM-2: Managing Group Membership
- **Description**: User wants to add or remove contacts from a group
- **Primary Actor**: App User
- **Preconditions**: At least one group and one contact exist in the database
- **Main Flow**:
  1. User navigates to the group details
  2. User taps "Manage Members" button
  3. System displays current members and available contacts
  4. User adds or removes contacts from the group
  5. User saves changes
- **Alternative Flows**:
  - User can search for contacts to add
  - User can cancel without saving changes
- **Postconditions**: Group membership is updated in the database

#### UC-GM-3: Recording Group Interactions
- **Description**: User wants to record an interaction with an entire group at once
- **Primary Actor**: App User
- **Preconditions**: At least one group with members exists
- **Main Flow**:
  1. User navigates to the group details
  2. User initiates an interaction with the group
  3. User selects the interaction type
  4. System records the interaction for the group and all its members
- **Alternative Flows**:
  - User can add notes to the interaction
  - User can select which members to include in the interaction
- **Postconditions**: Interaction is recorded for the group and propagated to all members

### Topic Management

#### UC-TM-1: Creating a Topic
- **Description**: User wants to create a new topic to track
- **Primary Actor**: App User
- **Preconditions**: Application is installed and running
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User taps the "+" button to create a new entity
  3. User selects "Topic" as the entity type
  4. User enters a name and optional details for the topic
  5. User saves the new topic
- **Alternative Flows**:
  - User can cancel the creation process
  - User can add an image to represent the topic
- **Postconditions**: A new topic entity is added to the database

#### UC-TM-2: Associating Contacts with Topics
- **Description**: User wants to connect contacts with relevant topics
- **Primary Actor**: App User
- **Preconditions**: At least one topic and one contact exist
- **Main Flow**:
  1. User navigates to the contact details
  2. User adds a tag related to the topic
  3. System associates the contact with the topic
- **Alternative Flows**:
  - User can create a new tag if needed
  - User can add multiple tags to a contact
- **Postconditions**: Contact is associated with the topic via tags

### Interaction Tracking

#### UC-IT-1: Recording an Interaction
- **Description**: User wants to record an interaction with a contact
- **Primary Actor**: App User
- **Preconditions**: At least one contact exists in the database
- **Main Flow**:
  1. User navigates to the contact details
  2. User taps on the contact's avatar or the "Add Interaction" button
  3. User selects the interaction type
  4. System records the interaction and updates the contact's interaction score
- **Alternative Flows**:
  - User can add notes to the interaction
  - User can record a historical interaction with a custom date
- **Postconditions**: Interaction is recorded and the contact's score is updated

#### UC-IT-2: Viewing Interaction History
- **Description**: User wants to see past interactions with a contact
- **Primary Actor**: App User
- **Preconditions**: At least one contact with recorded interactions exists
- **Main Flow**:
  1. User navigates to the contact details
  2. System displays a list of past interactions in chronological order
  3. User can scroll through the list to see all interactions
- **Alternative Flows**:
  - User can filter interactions by type
  - User can load more interactions if the list is paginated
- **Postconditions**: User views the interaction history

#### UC-IT-3: Viewing Interaction Sparklines
- **Description**: User wants to visualize interaction frequency over time
- **Primary Actor**: App User
- **Preconditions**: At least one contact with recorded interactions exists
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User views the sparkline visualization on contact cards
  3. User can toggle between 30-day and 12-month timespans
- **Alternative Flows**:
  - User can view more detailed visualizations on the contact details screen
- **Postconditions**: User views the interaction visualization

#### UC-IT-4: Creating Custom Interaction Types
- **Description**: User wants to define new types of interactions
- **Primary Actor**: App User
- **Preconditions**: Application is installed and running
- **Main Flow**:
  1. User navigates to the Interaction Types screen
  2. User taps "Add" button
  3. User enters a name, selects an icon, and sets a score value and color
  4. User specifies applicable entity types (person, group, topic)
  5. User saves the new interaction type
- **Alternative Flows**:
  - User can cancel the creation process
  - User can associate interaction types with specific tags
- **Postconditions**: New interaction type is available for recording interactions

### Birthday Management

#### UC-BM-1: Setting a Birthday
- **Description**: User wants to set a birthday for a contact
- **Primary Actor**: App User
- **Preconditions**: At least one person contact exists
- **Main Flow**:
  1. User navigates to the contact details
  2. User taps on the birthday field
  3. User sets or modifies the birthday date
  4. User saves the birthday information
- **Alternative Flows**:
  - User can set a birthday without the year (month and day only)
  - User can clear an existing birthday
- **Postconditions**: Birthday is saved to the contact

#### UC-BM-2: Configuring Birthday Reminders
- **Description**: User wants to set a notification reminder for a contact's birthday
- **Primary Actor**: App User
- **Preconditions**: At least one contact with a birthday exists
- **Main Flow**:
  1. User navigates to the contact details
  2. User configures a birthday reminder
  3. User sets how many days in advance to be notified
  4. User enables the reminder
- **Alternative Flows**:
  - User can disable an existing reminder
  - User can modify reminder settings
- **Postconditions**: Birthday reminder is scheduled in the system

#### UC-BM-3: Viewing Upcoming Birthdays
- **Description**: User wants to see which contacts have upcoming birthdays
- **Primary Actor**: App User
- **Preconditions**: Feature flag for birthday display is enabled
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User views the Upcoming Birthdays section
  3. System displays contacts with birthdays in the next 30 days
- **Alternative Flows**:
  - User can tap on a contact to see their details
  - User can expand the list to see more upcoming birthdays
- **Postconditions**: User views the upcoming birthdays list

### Search and Organization

#### UC-SO-1: Searching for Contacts
- **Description**: User wants to find specific contacts
- **Primary Actor**: App User
- **Preconditions**: At least one contact exists in the database
- **Main Flow**:
  1. User pulls down on the Home Screen to reveal search bar
  2. User enters search query
  3. System displays matching contacts based on name, phone, or email
- **Alternative Flows**:
  - User can clear the search to see all contacts
  - No results are found for the search query
- **Postconditions**: User sees the search results

#### UC-SO-2: Filtering Contacts
- **Description**: User wants to filter contacts by type or favorites
- **Primary Actor**: App User
- **Preconditions**: Multiple contacts of different types exist
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User selects a filter option (All, People, Groups, Topics)
  3. System displays only contacts matching the selected filter
- **Alternative Flows**:
  - User can toggle the Favorites filter to show only favorite contacts
  - User can combine type filters with the favorites filter
- **Postconditions**: User sees the filtered contact list

#### UC-SO-3: Sorting Contacts
- **Description**: User wants to change the order of displayed contacts
- **Primary Actor**: App User
- **Preconditions**: Multiple contacts exist in the database
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User taps the sort menu
  3. User selects a sort option (Name, Last Updated, Recent Interaction)
  4. System reorders the contacts according to the selected sort method
- **Alternative Flows**:
  - User can toggle favorite contacts to always appear at the top
- **Postconditions**: Contacts are displayed in the selected order

#### UC-SO-4: Marking Favorites
- **Description**: User wants to mark certain contacts as favorites
- **Primary Actor**: App User
- **Preconditions**: At least one contact exists
- **Main Flow**:
  1. User navigates to the contact card
  2. User taps the star icon to toggle favorite status
  3. System updates the favorite status of the contact
- **Alternative Flows**:
  - User can also toggle favorites from the contact details screen
- **Postconditions**: Contact's favorite status is updated in the database

### Data Management

#### UC-DM-1: Creating an Encrypted Backup
- **Description**: User wants to backup their data with encryption
- **Primary Actor**: App User
- **Preconditions**: Application has data to backup
- **Main Flow**:
  1. User navigates to the Settings screen
  2. User selects "Create Backup"
  3. User enters a passphrase for encryption
  4. System encrypts and creates a backup file
  5. User shares or saves the backup file
- **Alternative Flows**:
  - User can cancel the backup process
  - System validates the passphrase strength
- **Postconditions**: Encrypted backup file is created

#### UC-DM-2: Restoring from Backup
- **Description**: User wants to restore data from a backup
- **Primary Actor**: App User
- **Preconditions**: User has a valid backup file
- **Main Flow**:
  1. User navigates to the Settings screen
  2. User selects "Restore from Backup"
  3. User selects the backup file
  4. User enters the passphrase used for encryption
  5. System validates and restores data from the backup
- **Alternative Flows**:
  - Incorrect passphrase is entered
  - Backup file is corrupted or invalid
- **Postconditions**: Data is restored from the backup

#### UC-DM-3: Configuring Interaction Score Settings
- **Description**: User wants to adjust how interaction scores are calculated
- **Primary Actor**: App User
- **Preconditions**: Application is installed and running
- **Main Flow**:
  1. User navigates to the Settings screen
  2. User selects "Interaction Score Settings"
  3. User adjusts decay factor and decay type
  4. User saves the settings
- **Alternative Flows**:
  - User can reset to default settings
- **Postconditions**: Interaction score calculation settings are updated

### UI Preferences

#### UC-UI-1: Toggling Compact Mode
- **Description**: User wants to switch between full and compact card views
- **Primary Actor**: App User
- **Preconditions**: Multiple contacts exist in the database
- **Main Flow**:
  1. User navigates to the Home Screen
  2. User toggles compact mode from the menu
  3. System updates the card display mode
- **Alternative Flows**:
  - None
- **Postconditions**: Cards are displayed in the selected mode

#### UC-UI-2: Toggling Feature Flags
- **Description**: User wants to enable or disable experimental features
- **Primary Actor**: App User
- **Preconditions**: Application is in development mode or has accessible feature flags
- **Main Flow**:
  1. User navigates to the Settings screen
  2. User selects "Feature Flags"
  3. User toggles specific features on or off
  4. System applies the changes
- **Alternative Flows**:
  - Some features may require app restart
- **Postconditions**: Selected features are enabled or disabled

## System Requirements

### Performance Requirements
- The application should load the home screen within 2 seconds
- Database queries should complete within 1 second
- UI interactions should be responsive with no perceptible lag
- The application should handle at least 10,000 contacts without performance degradation

### Security Requirements
- All data stored on device should be encrypted
- Backup files must be encrypted with strong encryption
- No data should be transmitted without explicit user action
- Password/passphrase requirements for backup encryption

### Reliability Requirements
- The application should gracefully handle database corruption
- Automatic recovery from failed operations where possible
- Regular database integrity checks

### Compatibility Requirements
- The application must run on iOS 12+ and Android 8+
- The UI must adapt to different screen sizes and orientations
- Support for both light and dark mode

## Technical Requirements

### Data Storage
- SQLite database for local storage
- Encryption for sensitive data
- Robust migration system for database schema updates

### User Interface
- React Native with native components for performance
- Responsive design that works on phones and tablets
- Accessibility support (screen readers, contrast, etc.)
- Text properly wrapped in appropriate components to prevent rendering errors

### Notifications
- Local notifications for birthday reminders
- Background task support for reliable scheduling
- User-configurable notification preferences

### Backup and Restore
- File-based encrypted backup
- Validation of backup files before restoration
- Support for cross-device restoration

## Feature Flag Requirements

### Development Features
- Debug button access (SHOW_DEBUG_BUTTON)
- Historical interaction generation (ENABLE_HISTORICAL_INTERACTIONS)
- Database reset functionality (ENABLE_DATA_RESET)
- Unencrypted backup option (ENABLE_UNENCRYPTED_BACKUP)
- Interaction config reset (ENABLE_INTERACTION_CONFIG_RESET)

### Production Features
- Entity merging functionality (ENABLE_MERGE_FEATURE)
- Contact import capability (ENABLE_CONTACT_IMPORT)
- Birthday display on home screen (ENABLE_BIRTHDAY_DISPLAY)
- Yearly sparkline visualization (ENABLE_YEARLY_SPARKLINES)

## Maintenance Requirements

- Log rotation and management
- Error reporting mechanism
- Database integrity verification
- Feature flag management

This requirements document serves as the definitive reference for all PimGarden application functionality. Any new features or modifications should be reflected in updates to this document. 