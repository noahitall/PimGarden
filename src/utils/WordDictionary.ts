// A list of common English words for generating passphrases
// Words are all lowercase to comply with our passphrase requirements
const commonWords = [
  'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon',
  'mango', 'nectarine', 'orange', 'peach', 'quince', 'raspberry', 'strawberry', 'tangerine', 'watermelon',
  'almond', 'brazil', 'cashew', 'walnut', 'pistachio', 'peanut', 'pecan', 'hazelnut', 'macadamia',
  'bread', 'butter', 'cheese', 'donut', 'eclair', 'fudge', 'gelato', 'honey', 'icecream', 'jam',
  'kitchen', 'lemon', 'milk', 'noodle', 'olive', 'pasta', 'quiche', 'radish', 'salad', 'taco',
  'umbrella', 'violin', 'window', 'xylophone', 'yellow', 'zebra', 'airplane', 'bicycle', 'canoe', 'driver',
  'elephant', 'falcon', 'giraffe', 'horse', 'iguana', 'jaguar', 'koala', 'lion', 'monkey', 'nightingale',
  'octopus', 'penguin', 'quail', 'rabbit', 'snake', 'tiger', 'unicorn', 'vulture', 'whale', 'yak',
  'ocean', 'river', 'stream', 'mountain', 'valley', 'desert', 'forest', 'jungle', 'island', 'canyon',
  'autumn', 'winter', 'spring', 'summer', 'morning', 'evening', 'night', 'dawn', 'dusk', 'noon',
  'camera', 'pencil', 'keyboard', 'monitor', 'printer', 'speaker', 'battery', 'charger', 'cable', 'adapter',
  'doctor', 'teacher', 'engineer', 'artist', 'writer', 'dancer', 'singer', 'actor', 'chef', 'pilot',
  'cotton', 'denim', 'leather', 'linen', 'silk', 'suede', 'velvet', 'wool', 'polyester', 'nylon',
  'circle', 'square', 'triangle', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'sphere', 'cube', 'pyramid',
  'happy', 'brave', 'clever', 'peaceful', 'quiet', 'steady', 'strong', 'gentle', 'bright', 'calm',
  'dream', 'focus', 'goal', 'hope', 'idea', 'journey', 'memory', 'moment', 'passion', 'vision',
  'flower', 'garden', 'meadow', 'park', 'pond', 'stream', 'sunset', 'rainbow', 'planet', 'galaxy',
  'market', 'coffee', 'dinner', 'lunch', 'picnic', 'recipe', 'spice', 'sugar', 'taste', 'vanilla',
  'amber', 'azure', 'coral', 'crimson', 'emerald', 'fuchsia', 'golden', 'indigo', 'lavender', 'maroon',
  'soccer', 'tennis', 'hockey', 'baseball', 'cricket', 'football', 'rugby', 'volleyball', 'swimming', 'cycling'
];

/**
 * Generates a random 6-word passphrase from the dictionary
 * @returns A string containing 6 lowercase words separated by spaces
 */
export const generatePassphrase = (): string => {
  const selectedWords: string[] = [];
  
  // Select 6 random words from the dictionary
  while (selectedWords.length < 6) {
    const randomIndex = Math.floor(Math.random() * commonWords.length);
    const word = commonWords[randomIndex];
    
    // Avoid duplicate words
    if (!selectedWords.includes(word)) {
      selectedWords.push(word);
    }
  }
  
  // Join the words with spaces to create the passphrase
  return selectedWords.join(' ');
};

/**
 * Validates that a passphrase contains exactly 6 lowercase words
 * @param passphrase The passphrase to validate
 * @returns True if the passphrase is valid, false otherwise
 */
export const isValidPassphrase = (passphrase: string): boolean => {
  if (!passphrase) return false;
  
  const words = passphrase.trim().split(/\s+/);
  
  // Check if there are exactly 6 words
  if (words.length !== 6) {
    return false;
  }
  
  // Check if all words are lowercase letters only
  const lowercaseWordRegex = /^[a-z]+$/;
  return words.every(word => lowercaseWordRegex.test(word));
}; 