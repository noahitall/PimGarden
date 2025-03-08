import * as Crypto from 'expo-crypto';

// A list of common English words for generating passphrases
// Words are all lowercase to comply with our passphrase requirements
const commonWords = [
  // Basic nouns
  'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon',
  'mango', 'nectarine', 'orange', 'peach', 'quince', 'raspberry', 'strawberry', 'tangerine', 'watermelon',
  'almond', 'brazil', 'cashew', 'walnut', 'pistachio', 'peanut', 'pecan', 'hazelnut', 'macadamia',
  'bread', 'butter', 'cheese', 'donut', 'eclair', 'fudge', 'gelato', 'honey', 'icecream', 'jam',
  'kitchen', 'milk', 'noodle', 'olive', 'pasta', 'quiche', 'radish', 'salad', 'taco', 'sandwich',
  
  // Animals
  'elephant', 'falcon', 'giraffe', 'horse', 'iguana', 'jaguar', 'koala', 'lion', 'monkey', 'nightingale',
  'octopus', 'penguin', 'quail', 'rabbit', 'snake', 'tiger', 'unicorn', 'vulture', 'whale', 'yak',
  'zebra', 'antelope', 'bear', 'camel', 'dolphin', 'fox', 'gorilla', 'hippo', 'ibis', 'jellyfish',
  'kangaroo', 'lemur', 'moose', 'newt', 'otter', 'panda', 'raccoon', 'sloth', 'turtle', 'wolf',
  'alpaca', 'badger', 'cheetah', 'donkey', 'eel', 'ferret', 'gazelle', 'hamster', 'impala', 'lobster',
  
  // Nature
  'ocean', 'river', 'stream', 'mountain', 'valley', 'desert', 'forest', 'jungle', 'island', 'canyon',
  'autumn', 'winter', 'spring', 'summer', 'morning', 'evening', 'night', 'dawn', 'dusk', 'noon',
  'beach', 'cliff', 'coral', 'crater', 'delta', 'dune', 'field', 'geyser', 'glacier', 'harbor',
  'lagoon', 'lake', 'marsh', 'meadow', 'oasis', 'pond', 'prairie', 'rapids', 'reef', 'savanna',
  'swamp', 'tundra', 'volcano', 'waterfall', 'wetland', 'basin', 'bay', 'cave', 'coast', 'summit',
  
  // Objects and items
  'camera', 'pencil', 'keyboard', 'monitor', 'printer', 'speaker', 'battery', 'charger', 'cable', 'adapter',
  'umbrella', 'violin', 'window', 'xylophone', 'airplane', 'bicycle', 'canoe', 'driver', 'hammer', 'kettle',
  'laptop', 'magnet', 'needle', 'oven', 'pliers', 'quilt', 'radio', 'shovel', 'teapot', 'vase',
  'wagon', 'yacht', 'zipper', 'anchor', 'blender', 'compass', 'doorknob', 'envelope', 'funnel', 'goggles',
  'helmet', 'iron', 'journal', 'lantern', 'microphone', 'necklace', 'pillow', 'ruler', 'scissors', 'telescope',
  
  // Professions
  'doctor', 'teacher', 'engineer', 'artist', 'writer', 'dancer', 'singer', 'actor', 'chef', 'pilot',
  'baker', 'butcher', 'carpenter', 'dentist', 'electrician', 'farmer', 'gardener', 'journalist', 'lawyer', 'mechanic',
  'nurse', 'painter', 'plumber', 'police', 'scientist', 'soldier', 'tailor', 'vet', 'waiter', 'zoologist',
  'architect', 'barber', 'cashier', 'detective', 'firefighter', 'guard', 'historian', 'inspector', 'judge', 'librarian',
  'musician', 'optician', 'photographer', 'receptionist', 'surgeon', 'therapist', 'trainer', 'welder', 'analyst', 'broker',
  
  // Materials
  'cotton', 'denim', 'leather', 'linen', 'silk', 'suede', 'velvet', 'wool', 'polyester', 'nylon',
  'aluminum', 'bronze', 'ceramic', 'diamond', 'emerald', 'fabric', 'glass', 'granite', 'iron', 'jade',
  'kevlar', 'marble', 'nickel', 'obsidian', 'platinum', 'quartz', 'ruby', 'steel', 'titanium', 'uranium',
  'vinyl', 'wicker', 'zinc', 'amber', 'bamboo', 'cardboard', 'concrete', 'copper', 'crystal', 'enamel',
  'fiber', 'gold', 'ivory', 'latex', 'mahogany', 'oak', 'paper', 'plastic', 'porcelain', 'rubber',
  
  // Shapes and qualities
  'circle', 'square', 'triangle', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'sphere', 'cube', 'pyramid',
  'cone', 'cylinder', 'diamond', 'ellipse', 'fractal', 'helix', 'pentagon', 'prism', 'spiral', 'star',
  'arch', 'arrow', 'belt', 'bolt', 'chain', 'coil', 'cross', 'curve', 'dome', 'drop',
  'edge', 'frame', 'grid', 'hook', 'knot', 'layer', 'line', 'loop', 'maze', 'node',
  'orbit', 'path', 'point', 'ring', 'stack', 'tube', 'weave', 'web', 'wheel', 'zigzag',
  
  // Adjectives
  'happy', 'brave', 'clever', 'peaceful', 'quiet', 'steady', 'strong', 'gentle', 'bright', 'calm',
  'able', 'acid', 'angry', 'automatic', 'awake', 'bad', 'beautiful', 'best', 'better', 'big',
  'bitter', 'black', 'blue', 'boiling', 'bright', 'broken', 'brown', 'certain', 'cheap', 'chemical',
  'chief', 'clean', 'clear', 'cold', 'common', 'complete', 'complex', 'conscious', 'cruel', 'damp',
  'dark', 'dead', 'dear', 'deep', 'delicate', 'different', 'dirty', 'dry', 'early', 'elastic',
  
  // Abstract concepts
  'dream', 'focus', 'goal', 'hope', 'idea', 'journey', 'memory', 'moment', 'passion', 'vision',
  'action', 'balance', 'chance', 'change', 'choice', 'concept', 'culture', 'detail', 'effect', 'effort',
  'energy', 'event', 'factor', 'freedom', 'future', 'growth', 'harmony', 'health', 'history', 'impact',
  'justice', 'knowledge', 'language', 'legacy', 'lesson', 'logic', 'meaning', 'method', 'mystery', 'nature',
  'option', 'pattern', 'peace', 'phase', 'policy', 'process', 'progress', 'purpose', 'quality', 'reality',
  
  // Colors and visual
  'yellow', 'azure', 'coral', 'crimson', 'emerald', 'fuchsia', 'golden', 'indigo', 'lavender', 'maroon',
  'amber', 'aqua', 'beige', 'bronze', 'brown', 'burgundy', 'carmine', 'cerulean', 'charcoal', 'chrome',
  'citrine', 'cobalt', 'coffee', 'copper', 'cream', 'cyan', 'ebony', 'gold', 'green', 'grey',
  'ivory', 'jade', 'khaki', 'lime', 'magenta', 'mauve', 'navy', 'ochre', 'olive', 'onyx',
  'orange', 'orchid', 'peach', 'pearl', 'pink', 'purple', 'red', 'rose', 'ruby', 'rust',
  
  // Sports and activities
  'soccer', 'tennis', 'hockey', 'baseball', 'cricket', 'football', 'rugby', 'volleyball', 'swimming', 'cycling',
  'archery', 'badminton', 'ballet', 'billiards', 'bowling', 'boxing', 'canoeing', 'chess', 'climbing', 'dance',
  'diving', 'fencing', 'fishing', 'frisbee', 'golf', 'gymnastics', 'handball', 'hiking', 'jogging', 'judo',
  'karate', 'kayaking', 'kiting', 'marathon', 'paintball', 'polo', 'rafting', 'rowing', 'sailing', 'skating',
  'skiing', 'skydiving', 'snowboard', 'softball', 'squash', 'surfing', 'taekwondo', 'triathlon', 'wrestling', 'yoga',
  
  // Transportation
  'train', 'car', 'bus', 'boat', 'ship', 'ferry', 'yacht', 'jet', 'rocket', 'helicopter',
  'ambulance', 'blimp', 'caravan', 'cart', 'chariot', 'coach', 'drone', 'forklift', 'glider', 'hovercraft',
  'jeep', 'kayak', 'limo', 'metro', 'moped', 'motorcycle', 'parachute', 'raft', 'scooter', 'sedan',
  'shuttle', 'sled', 'submarine', 'tanker', 'taxi', 'tractor', 'trailer', 'tram', 'truck', 'unicycle',
  'van', 'wagon', 'zeppelin', 'airship', 'buggy', 'cab', 'canoe', 'cruiser', 'elevator', 'escalator',
  
  // Buildings and places
  'airport', 'arcade', 'bakery', 'bank', 'barn', 'bridge', 'bunker', 'cafe', 'camp', 'casino',
  'castle', 'cathedral', 'chapel', 'church', 'cinema', 'clinic', 'club', 'college', 'cottage', 'courthouse',
  'dome', 'embassy', 'factory', 'farm', 'fortress', 'garage', 'garden', 'gate', 'gym', 'hangar',
  'harbor', 'hostel', 'hotel', 'house', 'hut', 'inn', 'jail', 'kiosk', 'laboratory', 'library',
  'lighthouse', 'mall', 'mansion', 'marina', 'market', 'mosque', 'motel', 'museum', 'office', 'palace',
  
  // Technology
  'app', 'blog', 'byte', 'chip', 'cloud', 'code', 'data', 'disk', 'drone', 'email',
  'file', 'game', 'hack', 'icon', 'jpeg', 'laser', 'login', 'media', 'modem', 'mouse',
  'network', 'online', 'pixel', 'plugin', 'podcast', 'portal', 'query', 'render', 'server', 'tablet',
  'upload', 'vector', 'virus', 'website', 'wifi', 'backup', 'browser', 'cache', 'console', 'cookie',
  'desktop', 'domain', 'encoder', 'firewall', 'folder', 'gadget', 'hardware', 'hotspot', 'internet', 'joystick',
  
  // Food and drinks
  'apple', 'bagel', 'bacon', 'biscuit', 'brownie', 'burger', 'butter', 'cake', 'candy', 'caramel',
  'carrot', 'cereal', 'cheese', 'chicken', 'chili', 'chip', 'chocolate', 'cider', 'cinnamon', 'cocoa',
  'coconut', 'coffee', 'cookie', 'corn', 'cream', 'crepe', 'croissant', 'crumb', 'cupcake', 'curry',
  'custard', 'dessert', 'dough', 'drink', 'dumpling', 'egg', 'fajita', 'falafel', 'feast', 'fish',
  'flour', 'food', 'fruit', 'garlic', 'ginger', 'grain', 'grape', 'gravy', 'hummus',
  
  // Furniture and home
  'alarm', 'armchair', 'basin', 'basket', 'bathtub', 'bed', 'bench', 'blanket', 'blender', 'bookcase',
  'bucket', 'bureau', 'cabinet', 'candle', 'carpet', 'chair', 'chandelier', 'chest', 'chimney', 'closet',
  'couch', 'counter', 'curtain', 'cushion', 'desk', 'dishwasher', 'door', 'drawer', 'dryer', 'fence',
  'fireplace', 'freezer', 'fridge', 'furnace', 'furniture', 'gate', 'grill', 'hammock', 'hanger', 'heater',
  'lamp', 'mattress', 'mirror', 'ottoman', 'oven', 'pantry', 'pillow', 'porch', 'quilt', 'radiator',
  
  // Clothing and accessories
  'apron', 'backpack', 'badge', 'bag', 'belt', 'beret', 'blazer', 'blouse', 'boot', 'bracelet',
  'brooch', 'buckle', 'button', 'cap', 'cape', 'choker', 'cloak', 'coat', 'collar', 'crown',
  'dress', 'earring', 'fedora', 'glove', 'gown', 'handbag', 'hat', 'headband', 'helmet', 'hood',
  'jacket', 'jeans', 'jumper', 'kimono', 'lace', 'mask', 'mitten', 'necklace', 'necktie', 'pajama',
  'pants', 'pendant', 'poncho', 'purse', 'ribbon', 'ring', 'robe', 'sandal', 'sari', 'scarf',
  
  // Verbs
  'accept', 'achieve', 'add', 'admire', 'admit', 'advise', 'afford', 'agree', 'alert', 'allow',
  'amuse', 'analyze', 'announce', 'annoy', 'answer', 'appear', 'apply', 'approach', 'approve', 'argue',
  'arise', 'arrange', 'arrive', 'ask', 'attach', 'attack', 'attempt', 'attend', 'attract', 'avoid',
  'back', 'bake', 'balance', 'ban', 'bang', 'base', 'bat', 'bathe', 'battle', 'beam',
  'beat', 'become', 'beg', 'begin', 'behave', 'belong', 'bend', 'bet', 'bind', 'bite',
  
  // More verbs
  'bleach', 'blend', 'bless', 'blink', 'bloom', 'blow', 'blush', 'boast', 'boil', 'bolt',
  'bomb', 'book', 'bore', 'borrow', 'bounce', 'bow', 'box', 'brake', 'branch', 'break',
  'breathe', 'breed', 'brew', 'bridge', 'brief', 'bring', 'broadcast', 'brush', 'bubble', 'budget',
  'build', 'bump', 'burn', 'burst', 'bury', 'buzz', 'calculate', 'call', 'camp', 'cancel',
  'capture', 'care', 'carry', 'carve', 'cast', 'catch', 'cause', 'center', 'challenge', 'change',
  
  // Plants and flowers
  'acacia', 'alder', 'aloe', 'apple', 'ash', 'aspen', 'bamboo', 'banana', 'baobab', 'beech',
  'birch', 'blossom', 'bonsai', 'bush', 'cactus', 'cedar', 'cherry', 'clover', 'coconut', 'conifer',
  'cypress', 'daisy', 'dandelion', 'elm', 'eucalyptus', 'fern', 'fir', 'flower', 'forest', 'garden',
  'grass', 'hazel', 'herb', 'holly', 'ivy', 'jasmine', 'juniper', 'kelp', 'lavender', 'lemon',
  'lilac', 'lily', 'lotus', 'magnolia', 'maple', 'marigold', 'mint', 'moss', 'mushroom', 'narcissus',
  
  // Weather
  'autumn', 'blizzard', 'breeze', 'cloud', 'cold', 'cyclone', 'dawn', 'dew', 'drizzle', 'drought',
  'dusk', 'fog', 'frost', 'gale', 'gust', 'hail', 'haze', 'heat', 'humidity', 'hurricane',
  'ice', 'lightning', 'mist', 'monsoon', 'moon', 'rain', 'rainbow', 'sleet', 'smog', 'snow',
  'spring', 'storm', 'summer', 'sun', 'sunshine', 'tempest', 'thunder', 'tornado', 'tsunami', 'typhoon',
  'warm', 'weather', 'wind', 'winter', 'arid', 'balmy', 'brisk', 'chilly', 'clear', 'cloudy',
  
  // Education
  'academy', 'algebra', 'answer', 'art', 'assign', 'bell', 'book', 'campus', 'chalk', 'cheat',
  'class', 'college', 'course', 'degree', 'desk', 'drama', 'draft', 'draw', 'economics', 'edit',
  'educate', 'essay', 'exam', 'fail', 'geometry', 'grammar', 'grade', 'graduate', 'help', 'history',
  'homework', 'journal', 'learn', 'lecture', 'lesson', 'library', 'listen', 'major', 'math', 'music',
  'notebook', 'note', 'paper', 'pencil', 'physics', 'poem', 'practice', 'prize', 'program', 'project',
  
  // Music and arts
  'act', 'album', 'art', 'artist', 'audio', 'ballet', 'band', 'bass', 'beat', 'canvas',
  'cello', 'chalk', 'chord', 'chorus', 'clay', 'compose', 'concert', 'dance', 'drama', 'draw',
  'drum', 'duet', 'encore', 'exhibit', 'film', 'flute', 'gallery', 'guitar', 'harp', 'hymn',
  'jazz', 'lyric', 'melody', 'music', 'note', 'opera', 'organ', 'paint', 'palette', 'perform',
  'photo', 'piano', 'picture', 'play', 'poem', 'poetry', 'rhythm', 'scene', 'sculpt', 'sing',
  
  // Body parts
  'ankle', 'arm', 'back', 'beard', 'blood', 'bone', 'brain', 'cheek', 'chest', 'chin',
  'ear', 'elbow', 'eye', 'face', 'finger', 'foot', 'hair', 'hand', 'head', 'heart',
  'heel', 'hip', 'jaw', 'knee', 'leg', 'lip', 'lung', 'mouth', 'muscle', 'nail',
  'neck', 'nerve', 'nose', 'palm', 'rib', 'shoulder', 'skin', 'skull', 'spine', 'stomach',
  'teeth', 'thumb', 'toe', 'tongue', 'tooth', 'vein', 'waist', 'wrist', 'ankle', 'arch',
  
  // Numbers and mathematics
  'add', 'angle', 'area', 'axis', 'binary', 'bit', 'byte', 'calc', 'chart', 'circle',
  'code', 'count', 'curve', 'data', 'decimal', 'degree', 'digit', 'divide', 'eight', 'factor',
  'five', 'four', 'formula', 'graph', 'half', 'hex', 'integer', 'line', 'matrix', 'mean',
  'median', 'minus', 'mode', 'nine', 'number', 'odd', 'one', 'pair', 'pattern', 'percent',
  'pi', 'plot', 'plus', 'prime', 'product', 'quotient', 'ratio', 'root', 'seven', 'six',
  
  // Measurement and units
  'acre', 'amp', 'angle', 'atom', 'bar', 'barrel', 'base', 'billion', 'byte', 'calorie',
  'carat', 'celsius', 'cent', 'centimeter', 'cubic', 'cup', 'degree', 'dram', 'drop', 'eighth',
  'farad', 'fifth', 'foot', 'gallon', 'gram', 'half', 'henry', 'hertz', 'inch', 'joule',
  'kelvin', 'kilo', 'knot', 'liter', 'long', 'lumen', 'lux', 'mega', 'meter', 'micro',
  'mile', 'milli', 'minute', 'mole', 'month', 'nano', 'newton', 'ohm', 'ounce', 'pace',
  
  // Time-related
  'after', 'age', 'alarm', 'annual', 'autumn', 'before', 'century', 'clock', 'daily', 'date',
  'dawn', 'day', 'decade', 'delay', 'dusk', 'early', 'easter', 'epoch', 'era', 'evening',
  'fast', 'future', 'holiday', 'hour', 'instant', 'interim', 'late', 'later', 'lunar', 'minute',
  'moment', 'monday', 'month', 'morning', 'night', 'noon', 'now', 'pause', 'period', 'phase',
  'present', 'quarter', 'second', 'soon', 'span', 'spring', 'summer', 'sunday', 'tempo', 'term',
  
  // Countries and places
  'africa', 'america', 'arctic', 'asia', 'atlantic', 'australia', 'austria', 'bahamas', 'belgium', 'brazil',
  'britain', 'canada', 'china', 'cuba', 'denmark', 'earth', 'egypt', 'europe', 'finland', 'france',
  'germany', 'greece', 'hawaii', 'holland', 'iceland', 'india', 'iran', 'iraq', 'ireland', 'israel',
  'italy', 'japan', 'jordan', 'kenya', 'korea', 'kuwait', 'libya', 'malta', 'mexico', 'monaco',
  'nepal', 'norway', 'ocean', 'pacific', 'panama', 'peru', 'poland', 'qatar', 'rome', 'russia',
  
  // Emotions and feelings
  'afraid', 'angry', 'annoyed', 'anxious', 'bored', 'brave', 'calm', 'careful', 'caring', 'cheerful',
  'confident', 'confused', 'curious', 'depressed', 'eager', 'easy', 'elated', 'excited', 'fearful', 'friendly',
  'frustrated', 'generous', 'glad', 'gloomy', 'grateful', 'guilty', 'happy', 'hopeful', 'hurt', 'irritated',
  'jealous', 'joyful', 'kind', 'lazy', 'lonely', 'loving', 'mad', 'merry', 'nervous', 'optimistic',
  'peaceful', 'proud', 'relaxed', 'relieved', 'sad', 'satisfied', 'scared', 'sensitive', 'sorry', 'stressed',
  
  // More abstract concepts
  'access', 'account', 'accuracy', 'acid', 'address', 'adult', 'advance', 'advocate', 'affair', 'age',
  'agency', 'agenda', 'aid', 'aim', 'air', 'alarm', 'alcohol', 'alien', 'alliance', 'ally',
  'amount', 'analysis', 'ancestor', 'angel', 'anger', 'angle', 'animal', 'ankle', 'answer', 'antenna',
  'anxiety', 'appeal', 'apple', 'arch', 'area', 'arena', 'argument', 'arm', 'armor', 'army',
  'array', 'arrow', 'art', 'article', 'artist', 'ash', 'aspect', 'assault', 'asset', 'assist',
  
  // Astronomy and space
  'alien', 'asteroid', 'astronaut', 'astronomy', 'atom', 'aurora', 'binary', 'black', 'comet', 'cosmic',
  'cosmos', 'crater', 'dimension', 'earth', 'eclipse', 'equinox', 'galaxy', 'gravity', 'horizon', 'hubble',
  'infinity', 'lunar', 'mars', 'meteor', 'milky', 'moon', 'nebula', 'nova', 'orbit', 'planet',
  'pulsar', 'quasar', 'rocket', 'satellite', 'saturn', 'shuttle', 'sky', 'solar', 'space', 'star',
  'sun', 'supernova', 'telescope', 'universe', 'venus', 'void', 'warp', 'wormhole', 'zenith', 'zodiac',
  
  // More household items
  'baking', 'balloon', 'banner', 'barrel', 'basement', 'basket', 'bath', 'bathroom', 'battery', 'beach',
  'beam', 'beans', 'bedroom', 'beef', 'beer', 'bell', 'belt', 'bench', 'bicycle', 'bill',
  'bin', 'bird', 'birthday', 'biscuit', 'bit', 'bite', 'black', 'blade', 'blanket', 'blast',
  'block', 'blood', 'blow', 'blue', 'board', 'boat', 'body', 'bomb', 'bone', 'bonus',
  'book', 'boost', 'boot', 'border', 'boss', 'bottle', 'bottom', 'box', 'brand', 'bread',
  
  // Science terms
  'acid', 'atom', 'bacteria', 'balance', 'base', 'beaker', 'biology', 'botany', 'carbon', 'cell',
  'chemical', 'chemistry', 'climate', 'clone', 'dna', 'ecology', 'element', 'energy', 'enzyme', 'evolution',
  'experiment', 'factor', 'fossil', 'fungus', 'gene', 'geology', 'germ', 'graph', 'gravity', 'habitat',
  'heat', 'hybrid', 'hydrogen', 'hypothesis', 'immune', 'isotope', 'kinetic', 'lab', 'light', 'magnet',
  'mass', 'metal', 'mineral', 'molecule', 'motion', 'nucleus', 'nutrient', 'organic', 'oxygen', 'particle'
];

/**
 * Generates a random 6-word passphrase from the dictionary using cryptographically secure randomness
 * @returns A string containing 6 lowercase words separated by spaces
 */
export const generatePassphrase = async (): Promise<string> => {
  const selectedWords: string[] = [];
  const wordCount = commonWords.length;
  
  // Generate all needed random values at once for better performance
  // We need enough bytes to select 6 words from our dictionary
  const byteCount = Math.ceil(Math.log2(wordCount) / 8) * 6;
  let randomBytes = await Crypto.getRandomBytesAsync(byteCount);
  
  let byteIndex = 0;
  
  // Select 6 unique random words from the dictionary
  while (selectedWords.length < 6) {
    // Use modulo to convert random bytes to an index within our dictionary range
    // Grab enough bytes to cover our range (more accurate than a single byte modulo)
    let randomValue = 0;
    const bytesNeeded = Math.min(4, byteCount - byteIndex); // Use at most 4 bytes (32 bits) at a time
    
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = (randomValue << 8) | randomBytes[byteIndex++];
    }
    
    // If we've used all our random bytes but still need more words, get more bytes
    if (byteIndex >= byteCount && selectedWords.length < 6) {
      randomBytes = await Crypto.getRandomBytesAsync(byteCount);
      byteIndex = 0;
    }
    
    const randomIndex = randomValue % wordCount;
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