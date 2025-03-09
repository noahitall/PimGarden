const fs = require('fs');
const path = require('path');

// This plugin ensures that YAML configuration files are copied to the correct location in the bundle
module.exports = (config) => {
  console.log('Running custom config plugin for YAML files...');
  
  // Make sure the app has withAndroid, withIOS properties
  if (!config.mods) {
    config.mods = {};
  }
  if (!config.mods.android) {
    config.mods.android = {};
  }
  if (!config.mods.ios) {
    config.mods.ios = {};
  }
  
  // Hook into the pre-build step to copy our files
  config.mods.prebuild = async (config) => {
    console.log('Pre-build hook: Copying YAML configuration files...');
    
    // Define source and destination paths
    const srcConfigFile = path.join(__dirname, 'src', 'config', 'default-interactions.yaml');
    const assetsConfigFile = path.join(__dirname, 'assets', 'config', 'default-interactions.yaml');
    
    // Check if the YAML file exists
    if (!fs.existsSync(srcConfigFile) && !fs.existsSync(assetsConfigFile)) {
      console.error('ERROR: Could not find default-interactions.yaml in either src/config or assets/config');
      
      // Create default config content
      const defaultContent = `# Default Interaction Types Configuration
interactions:
  - name: General Contact
    icon: account-check
    entityTypes: null
    tags: null
    score: 1
    color: "#666666"
  
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
  
  - name: Coffee
    icon: coffee
    entityTypes: [person]
    tags: null
    score: 2
    color: "#7F5539"
  
  - name: Birthday
    icon: cake
    entityTypes: [person, pet]
    tags: null
    score: 5
    color: "#FF4081"

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
    color: "#26A69A"`;
      
      // Create the directories if they don't exist
      fs.mkdirSync(path.join(__dirname, 'src', 'config'), { recursive: true });
      fs.mkdirSync(path.join(__dirname, 'assets', 'config'), { recursive: true });
      
      // Write the default file
      fs.writeFileSync(srcConfigFile, defaultContent);
      fs.writeFileSync(assetsConfigFile, defaultContent);
      
      console.log('Created default YAML files in src/config and assets/config');
    }
    
    // Create intermediate directories in output locations
    const outputSrcDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'src', 'config');
    const outputAssetsDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'assets', 'config');
    const outputIOSDir = path.join(__dirname, 'ios', 'PimGarden', 'Supporting');
    
    fs.mkdirSync(outputSrcDir, { recursive: true });
    fs.mkdirSync(outputAssetsDir, { recursive: true });
    
    // Copy the files to the Android output locations
    if (fs.existsSync(srcConfigFile)) {
      fs.copyFileSync(srcConfigFile, path.join(outputSrcDir, 'default-interactions.yaml'));
      console.log(`Copied ${srcConfigFile} to ${outputSrcDir}`);
    }
    
    if (fs.existsSync(assetsConfigFile)) {
      fs.copyFileSync(assetsConfigFile, path.join(outputAssetsDir, 'default-interactions.yaml'));
      console.log(`Copied ${assetsConfigFile} to ${outputAssetsDir}`);
    }
    
    // Copy the files to the iOS output location
    if (fs.existsSync(srcConfigFile)) {
      fs.copyFileSync(srcConfigFile, path.join(outputIOSDir, 'src-config-default-interactions.yaml'));
      console.log(`Copied ${srcConfigFile} to ${outputIOSDir} as src-config-default-interactions.yaml`);
    }
    
    if (fs.existsSync(assetsConfigFile)) {
      fs.copyFileSync(assetsConfigFile, path.join(outputIOSDir, 'assets-config-default-interactions.yaml'));
      console.log(`Copied ${assetsConfigFile} to ${outputIOSDir} as assets-config-default-interactions.yaml`);
    }
    
    // Continue with the original config
    return config;
  };
  
  return config;
}; 