/**
 * SafeLogger.ts
 * 
 * This utility provides safe logging functions that prevent text rendering issues
 * that can occur during React Native's reconciliation process.
 * 
 * The issue occurs when logs containing React component references or complex objects
 * are processed during the React reconciliation phase, particularly in "completeWork" 
 * where text strings might not be properly wrapped in <Text> components.
 */

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

/**
 * Safely stringifies a value to prevent rendering issues
 */
const safeStringify = (value: any): string => {
  try {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    // Handle primitive types directly
    if (typeof value !== 'object' && typeof value !== 'function') {
      return String(value);
    }
    
    // For React elements, just return a placeholder
    if (value && value.$$typeof) {
      return '[React Element]';
    }
    
    // For errors, extract message
    if (value instanceof Error) {
      return `Error: ${value.message}`;
    }
    
    // For circular structures, use a try-catch with JSON.stringify
    try {
      return JSON.stringify(value, (key, val) => {
        // Handle circular references and React elements
        if (val && typeof val === 'object') {
          if (val.$$typeof) return '[React Element]';
          if (val === value) return '[Circular]';
        }
        return val;
      });
    } catch (err) {
      return `[Object: ${typeof value}]`;
    }
  } catch (err) {
    return `[Unstringifiable: ${typeof value}]`;
  }
};

/**
 * Safe version of console.log that prevents text rendering issues
 */
console.log = function(...args: any[]): void {
  try {
    // For development, use original console.log
    if (__DEV__) {
      originalConsoleLog.apply(console, args);
      return;
    }
    
    // For production, use a safer approach
    const safeArgs = args.map(arg => safeStringify(arg));
    originalConsoleLog.apply(console, safeArgs);
  } catch (err) {
    // If anything goes wrong, use a basic approach
    originalConsoleLog.call(console, '[SafeLogger: Error in log]');
  }
};

/**
 * Safe version of console.error
 */
console.error = function(...args: any[]): void {
  try {
    if (__DEV__) {
      originalConsoleError.apply(console, args);
      return;
    }
    
    const safeArgs = args.map(arg => safeStringify(arg));
    originalConsoleError.apply(console, safeArgs);
  } catch (err) {
    originalConsoleError.call(console, '[SafeLogger: Error in error]');
  }
};

/**
 * Safe version of console.warn
 */
console.warn = function(...args: any[]): void {
  try {
    if (__DEV__) {
      originalConsoleWarn.apply(console, args);
      return;
    }
    
    const safeArgs = args.map(arg => safeStringify(arg));
    originalConsoleWarn.apply(console, safeArgs);
  } catch (err) {
    originalConsoleWarn.call(console, '[SafeLogger: Error in warn]');
  }
};

/**
 * Safe version of console.info
 */
console.info = function(...args: any[]): void {
  try {
    if (__DEV__) {
      originalConsoleInfo.apply(console, args);
      return;
    }
    
    const safeArgs = args.map(arg => safeStringify(arg));
    originalConsoleInfo.apply(console, safeArgs);
  } catch (err) {
    originalConsoleInfo.call(console, '[SafeLogger: Error in info]');
  }
};

export default {
  // Export any additional utilities if needed
}; 