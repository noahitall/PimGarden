// Script to ensure config files are properly copied during build
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking and fixing config files...');

// Define paths
const srcConfigDir = path.join(__dirname, 'src', 'config');
const assetsConfigDir = path.join(__dirname, 'assets', 'config');
const defaultInteractionsFile = 'default-interactions.yaml';

// Ensure directories exist
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  return false;
}

// Copy file if exists
function copyFileIfExists(src, dest) {
  if (fs.existsSync(src)) {
    console.log(`Copying ${src} to ${dest}`);
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

// Ensure config directories exist
ensureDirectoryExists(srcConfigDir);
ensureDirectoryExists(assetsConfigDir);

// Check if either location has the file
const srcFilePath = path.join(srcConfigDir, defaultInteractionsFile);
const assetsFilePath = path.join(assetsConfigDir, defaultInteractionsFile);

let hasFile = false;

// Check src/config
if (fs.existsSync(srcFilePath)) {
  console.log(`✅ Found ${defaultInteractionsFile} in src/config`);
  hasFile = true;
  
  // If it exists in src but not in assets, copy it
  if (!fs.existsSync(assetsFilePath)) {
    console.log(`Copying from src/config to assets/config`);
    fs.copyFileSync(srcFilePath, assetsFilePath);
  }
} 

// Check assets/config
if (fs.existsSync(assetsFilePath)) {
  console.log(`✅ Found ${defaultInteractionsFile} in assets/config`);
  hasFile = true;
  
  // If it exists in assets but not in src, copy it
  if (!fs.existsSync(srcFilePath)) {
    console.log(`Copying from assets/config to src/config`);
    fs.copyFileSync(assetsFilePath, srcFilePath);
  }
}

// If file doesn't exist in either location, create the default one
if (!hasFile) {
  console.log(`❌ ${defaultInteractionsFile} not found in either location, creating default...`);
  
  // Content for the default file
  const defaultContent = `# Default Interaction Types Configuration
# 
# This file defines all default interaction types, which entity types they apply to,
# and which tags they are associated with. This allows easier customization and
# maintenance of the default interaction types.

interactions:
  # General interaction types (available to all entity types)
  - name: General Contact
    icon: account-check
    entityTypes: null  # null = applies to all entity types
    tags: null  # null = not associated with any tag
    score: 1
    color: "#666666"
    
  # Person-specific interaction types
  - name: Message
    icon: message-text
    entityTypes: [person]
    tags: null
    score: 1
    color: "#666666"
    
  - name: Phone Call
    icon: phone
    entityTypes: [person]
    tags: null
    score: 1
    color: "#666666"
    
  - name: Meeting
    icon: account-group
    entityTypes: [person]
    tags: null
    score: 1
    color: "#666666"
    
  - name: Email
    icon: email
    entityTypes: [person]
    tags: null
    score: 1
    color: "#666666"
    
  - name: Coffee
    icon: coffee
    entityTypes: [person]
    tags: null
    score: 2
    color: "#7F5539"
    
  - name: Birthday
    icon: cake
    entityTypes: [person]
    tags: null
    score: 5
    color: "#FF4081"
    
  # Tag-specific interaction types
  
  # Pet tag interactions
  - name: Birthday
    icon: cake-variant
    entityTypes: null
    tags: [pet]
    score: 5
    color: "#FF8A65"
    
  - name: Vet Visit
    icon: hospital-box
    entityTypes: null
    tags: [pet]
    score: 3
    color: "#42A5F5"
    
  - name: Grooming
    icon: content-cut
    entityTypes: null
    tags: [pet]
    score: 2
    color: "#66BB6A"
    
  # Book tag interactions
  - name: Book Started
    icon: book-open-page-variant
    entityTypes: null
    tags: [book]
    score: 3
    color: "#26A69A"
    
  - name: Book Progress
    icon: book-open-variant
    entityTypes: null
    tags: [book]
    score: 1
    color: "#29B6F6"
    
  - name: Book Finished
    icon: book-check
    entityTypes: null
    tags: [book]
    score: 5
    color: "#5C6BC0"
    
  # Family tag interactions
  - name: Family Dinner
    icon: food-variant
    entityTypes: null
    tags: [family]
    score: 2
    color: "#EC407A"
    
  - name: Family Call
    icon: phone
    entityTypes: null
    tags: [family]
    score: 2
    color: "#7E57C2"
    
  - name: Visit
    icon: home
    entityTypes: null
    tags: [family]
    score: 3
    color: "#26A69A"
    
  # Friend tag interactions
  - name: Catch Up
    icon: chat
    entityTypes: null
    tags: [friend]
    score: 2
    color: "#FF7043"
    
  - name: Hangout
    icon: glass-cocktail
    entityTypes: null
    tags: [friend]
    score: 2
    color: "#5C6BC0"

# Default Tags Configuration
tags:
  - name: family
    icon: account-group
    color: "#EC407A"
    
  - name: friend
    icon: account
    color: "#5C6BC0"
    
  - name: pet
    icon: paw
    color: "#8D6E63"
    
  - name: book
    icon: book
    color: "#26A69A"
`;

  // Write the default file to both locations
  fs.writeFileSync(srcFilePath, defaultContent);
  fs.writeFileSync(assetsFilePath, defaultContent);
  
  console.log(`✅ Created default ${defaultInteractionsFile} in both locations`);
}

console.log('✅ Config files check complete!'); 