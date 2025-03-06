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
- Track interaction scores for each entity with customizable scoring and decay settings
- Visualize interaction history with spark charts in both full and compact views
- Consistent UI across all screens
- Full display of entity names on cards for better readability
- Clean, minimalist card design with larger photos and names
- Responsive card layout that properly handles long entity names
- Pull-down search functionality to find entities by name, phone, or email
- Detailed interaction logs on entity detail pages with "View More" pagination
- Camera and photo library integration for setting entity photos
- Toggle between full-sized and compact entity cards
- Mark entities as favorites and keep them at the top of your list
- Sort entities by name, last updated, or recent interaction
- Filter entities by type (people, groups, topics) or favorites
- Create groups and manage group memberships
- Add and manage tags for better entity organization
- Create custom action types with configurable scores and colors

## User Interface Features

### Home Screen
- Sort entities by name, last updated, or recent interaction with a convenient sort menu
- Filter entities by type (All, People, Groups, Topics) using filter chips
- Toggle favorites filter to show only your favorite entities
- Toggle between full-sized and compact card views
- Mark entities as favorites by tapping the star icon

### Entity Details
- View and add custom interaction types with personalized icons and colors
- Tap on an entity's avatar to see a menu of interaction options
- View interaction history with a sparkline visualization that works in both view modes
- Add tags to categorize entities for easier management

### Groups Management
- Create groups to organize people and topics
- Add or remove members from groups easily
- Groups can receive interactions that propagate to all members
- Track group membership changes

### Settings
- Customize interaction score settings with decay factors and decay types
- Adjust how quickly interaction scores decay over time
- Developer options for database maintenance (in dev mode)

## Technical Improvements

### Database
- Robust migrations system for seamless app updates
- Enhanced error handling and fallbacks for database operations
- Support for tracking interaction scores with configurable decay
- Group membership tracking with timestamps
- Tag system with improved query performance
- Color support for interaction types

### Performance
- Optimized entity loading with configurable sorting
- Efficient filtering that works with large numbers of entities
- Adaptive layout for different screen sizes
- Improved database query performance

## Development Guidelines

1. **Offline-First**: All features must work without an internet connection
2. **Network Usage**: Network connections are only permitted when:
   - User explicitly requests a backup
   - User initiates a restore from backup
3. **Data Privacy**: All contact data is stored locally by default
4. **README Updates**: This README must be reviewed and updated with any code changes
5. **Data Encryption**: All data is encrypted at rest using secure encryption algorithms
6. **UI Consistency**: UI components should maintain consistent look and feel across all screens
7. **Error Handling**: All database operations should have proper error handling and fallbacks
8. **Migrations**: Database changes should include appropriate migrations

## Technical Architecture

- React Native with Expo for cross-platform mobile development
- SQLite for local database storage
- Crypto for data encryption
- React Navigation for app navigation
- React Native Paper for UI components
- Expo Contacts for accessing device contacts
- Expo Image Picker for camera and photo library integration

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

- **Home Screen**: Displays a grid of entity cards with minimalist design featuring larger photos and names in either full or compact view mode. Pull down to reveal a search bar for finding entities by name, phone, or email. Sort and filter entities using the top menu.
- **Entity Detail Screen**: Shows detailed information about an entity, including a chronological log of interactions with pagination support. Tap on the entity's photo to take a new picture, select from the photo library, or record an interaction.
- **Edit Entity Screen**: Create or edit entity information with consistent type selection UI. Create and manage custom interaction types.
- **Contact Import Screen**: Import contacts from your device
- **Group Member Screen**: Manage group memberships by adding or removing members
- **Settings Screen**: Configure application settings including interaction scoring preferences

## Data Model

The app manages three types of entities:

1. **Persons**: Imported from contacts or manually created
2. **Groups**: Collections of persons and topics with tracked membership
3. **Topics**: Subjects or themes that can be associated with entities

Each entity has:
- Name
- Type (person, group, or topic)
- Details
- Optional image
- Interaction score (calculated based on interaction history and settings)
- Tags for categorization
- Favorite status
- Creation and update timestamps

## Interaction Scoring

The app tracks interactions with entities and calculates a score based on:
- Frequency of interactions
- Recency of interactions
- Custom score values assigned to different interaction types
- Configurable decay settings to reduce scores for older interactions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 