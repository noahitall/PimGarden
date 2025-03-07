/**
 * Simple event emitter for global events in the app
 */

// Define the global events
export type EventType = 'tagChange';

// Set up the event emitters
class EventEmitter {
  private listeners: Map<EventType, Array<() => void>> = new Map();
  
  addEventListener(event: EventType, callback: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }
  
  removeEventListener(event: EventType, callback: () => void) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event) || [];
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emitEvent(event: EventType) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event) || [];
      callbacks.forEach(callback => callback());
    }
  }
}

// Create and export a singleton
export const eventEmitter = new EventEmitter(); 