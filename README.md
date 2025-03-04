# Contact Manager

A cross-platform mobile application for managing contacts, groups, and topics with a focus on privacy and offline functionality. The app stores all data locally on your device and only connects to the network when explicitly requested for backup purposes.

## Key Features

- **Offline-First Architecture**: All data is stored locally on your device
- **Privacy-Focused Design**: No unnecessary data collection or transmission
- **Contact Management**: Import contacts from your device with deduplication
- **Entity Organization**: Manage people, groups, and topics in a unified interface
- **Interaction Tracking**: Track engagement with each entity through interaction scores and timestamps
- **Interaction Visualization**: View interaction patterns with spark charts showing activity over time
- **Cross-Platform**: Works on both iOS and Android devices
- **Modern UI Design**: Visually appealing card-based interface with color-coding by entity type

## Privacy & Security

- **Local Storage**: All data is stored in a local SQLite database
- **Data Encryption**: Sensitive data is encrypted at rest
- **Permission Control**: Easy access to manage contact permissions
- **No Network Calls**: Network connections only occur during explicit backup/restore operations

## Technical Details

### Architecture

- **React Native with Expo**: Cross-platform mobile development
- **SQLite**: Local database for data persistence
- **React Navigation**: Navigation between screens
- **React Native Paper**: Material Design components
- **Expo Contacts**: Access to device contacts

### Data Model

The app manages three types of entities:

1. **Persons**: Imported from contacts or manually created
   - Name, contact details, interaction score
   - Deduplication based on name/phone/email combinations

2. **Groups**: Collections of persons
   - Name, members, interaction score

3. **Topics**: Subjects or themes
   - Name, related entities, interaction score

Each interaction with an entity is timestamped and stored, allowing for:
- Historical tracking of engagement patterns
- Visual representation of interaction frequency
- Data-driven insights about relationship maintenance

### Screens

- **Home Screen**: Grid layout of entity cards (4 rows of 2 columns on standard screens)
- **Entity Detail Screen**: Detailed view of an entity with interaction tracking
- **Edit Entity Screen**: Create or modify entity information
- **Contact Import Screen**: Import and manage contacts from your device

### UI Components

The app features a modern, visually appealing interface with:

- **Color-Coded Entity Cards**: Each entity type has a distinct background color for easy identification
  - Persons: Light blue
  - Groups: Light green
  - Topics: Light orange
  
- **Card Layout**:
  - First name and last initial at the top for quick identification
  - Prominent profile photos with fallback to initials
  - Interactive photos - tap to record an interaction
  - Spark chart showing interaction frequency over the past 14 days
  - Interaction score badges for quick reference
  - Type indicators with intuitive icons

- **Responsive Grid**: Automatically adjusts the number of columns based on screen size

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/contact-manager.git
   cd contact-manager
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npx expo start
   ```

4. Run on iOS simulator:
   ```
   Press 'i' in the terminal
   ```

5. Run on Android emulator:
   ```
   Press 'a' in the terminal
   ```

## Usage

### Importing Contacts

1. Navigate to the Contact Import screen
2. Use the dropdown menu to access "Add Contact Permission" if needed
3. Select contacts to import
4. Tap "Import Selected" to add them to your database
5. The app automatically prevents duplicate imports

### Managing Entities

1. View all entities on the Home screen
2. Filter by type (Person, Group, Topic) using the filter chips
3. Tap on a card to view details
4. Use the interaction button to increase the interaction score
5. Edit or delete entities as needed

## Development Guidelines

1. **Offline-First**: All features must work without an internet connection
2. **Network Usage**: Network connections are only permitted for explicit backup/restore operations
3. **Data Privacy**: All contact data is stored locally by default
4. **Data Encryption**: All sensitive data must be encrypted at rest

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 