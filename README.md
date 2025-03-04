# Offline-First Contact Manager

A mobile application for managing contacts that prioritizes privacy and offline functionality. The app stores contacts locally on your device and only connects to the network when explicitly requested for backup purposes.

## Key Features

- Store and manage contacts locally on your device
- Work completely offline by default
- Optional backup functionality when requested
- Compatible with both Android and iOS devices
- Privacy-focused design
- Import contacts from your device
- Organize entities into people, groups, and topics
- Track interaction scores for each entity
- Visualize interaction history with spark charts
- Consistent UI across all screens
- Full display of entity names on cards for better readability
- Clean, minimalist card design with larger photos and names

## Development Guidelines

1. **Offline-First**: All features must work without an internet connection
2. **Network Usage**: Network connections are only permitted when:
   - User explicitly requests a backup
   - User initiates a restore from backup
3. **Data Privacy**: All contact data is stored locally by default
4. **README Updates**: This README must be reviewed and updated with any code changes
5. **Data Encryption**: All data is encrypted at rest using secure encryption algorithms
6. **UI Consistency**: UI components should maintain consistent look and feel across all screens

## Technical Architecture

- React Native with Expo for cross-platform mobile development
- SQLite for local database storage
- Crypto for data encryption
- React Navigation for app navigation
- React Native Paper for UI components
- Expo Contacts for accessing device contacts

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
   npm start
   ```

4. Run on iOS simulator:
   ```
   npm run ios
   ```

5. Run on Android emulator:
   ```
   npm run android
   ```

## App Structure

- **Home Screen**: Displays a grid of entity cards with minimalist design featuring larger photos and names
- **Entity Detail Screen**: Shows detailed information about an entity
- **Edit Entity Screen**: Create or edit entity information with consistent type selection UI
- **Contact Import Screen**: Import contacts from your device

## Data Model

The app manages three types of entities:

1. **Persons**: Imported from contacts or manually created
2. **Groups**: Collections of persons
3. **Topics**: Subjects or themes that can be associated with entities

Each entity has:
- Name
- Type (person, group, or topic)
- Details
- Optional image
- Interaction score
- Creation and update timestamps

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 