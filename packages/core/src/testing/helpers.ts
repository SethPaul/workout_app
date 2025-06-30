import { v4 as uuidv4 } from 'uuid';
import {
  CollaborativeElement,
  ElementType,
  ElementProperties,
  Operation,
  OperationType,
  Participant,
  User,
  CollaborationSession,
  TestingHelpers,
  CreateOperation,
  UpdateOperation,
  DeleteOperation,
  Point,
  Dimensions,
  ElementStyle
} from '../types';

/**
 * Testing helpers for creating mock objects and utilities
 * These allow isolated testing of components without external dependencies
 */

/**
 * Create a mock collaborative element with default values
 */
export function createMockElement(overrides: Partial<CollaborativeElement> = {}): CollaborativeElement {
  const defaultProperties: ElementProperties = {
    position: { x: 0, y: 0 },
    dimensions: { width: 100, height: 100 },
    rotation: 0,
    style: {
      fillColor: '#000000',
      strokeColor: '#000000',
      strokeWidth: 1,
      opacity: 1
    },
    zIndex: 0
  };

  const defaults: CollaborativeElement = {
    id: uuidv4(),
    type: ElementType.RECTANGLE,
    properties: defaultProperties,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    authorId: 'user-1',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return {
    ...defaults,
    ...overrides,
    properties: {
      ...defaults.properties,
      ...overrides.properties
    }
  };
}

/**
 * Create a mock operation with default values
 */
export function createMockOperation(
  type: OperationType,
  overrides: Partial<Operation> = {}
): Operation {
  const baseOperation = {
    id: uuidv4(),
    authorId: 'user-1',
    timestamp: Date.now(),
    roomId: 'room-1'
  };

  switch (type) {
    case OperationType.CREATE:
      return {
        ...baseOperation,
        type: OperationType.CREATE,
        element: createMockElement(),
        ...overrides
      } as CreateOperation;

    case OperationType.UPDATE:
      return {
        ...baseOperation,
        type: OperationType.UPDATE,
        elementId: 'element-1',
        updates: { position: { x: 10, y: 10 } },
        version: 2,
        versionNonce: Math.floor(Math.random() * 1000000),
        ...overrides
      } as UpdateOperation;

    case OperationType.DELETE:
      return {
        ...baseOperation,
        type: OperationType.DELETE,
        elementId: 'element-1',
        version: 2,
        versionNonce: Math.floor(Math.random() * 1000000),
        ...overrides
      } as DeleteOperation;

    case OperationType.BATCH:
      return {
        ...baseOperation,
        type: OperationType.BATCH,
        operations: [],
        ...overrides
      };

    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}

/**
 * Create a mock user
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const defaults: User = {
    id: uuidv4(),
    name: 'Test User',
    email: 'test@example.com'
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock participant
 */
export function createMockParticipant(overrides: Partial<Participant> = {}): Participant {
  const defaults: Participant = {
    id: uuidv4(),
    user: createMockUser(),
    color: '#FF0000',
    cursor: { x: 0, y: 0 },
    isActive: true,
    joinedAt: Date.now(),
    lastSeenAt: Date.now()
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a mock collaboration session
 */
export function createMockSession(overrides: Partial<CollaborationSession> = {}): CollaborationSession {
  const defaults: CollaborationSession = {
    roomId: uuidv4(),
    title: 'Test Session',
    ownerId: 'user-1',
    participants: new Map(),
    permissions: {},
    settings: {
      maxParticipants: 10,
      isPublic: false,
      allowGuests: true,
      autoSave: true,
      saveInterval: 30000
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a collection of mock elements for testing
 */
export function createMockElementCollection(count: number): CollaborativeElement[] {
  return Array.from({ length: count }, (_, index) =>
    createMockElement({
      id: `element-${index}`,
      type: [ElementType.RECTANGLE, ElementType.CIRCLE, ElementType.LINE][index % 3],
      properties: {
        position: { x: index * 50, y: index * 50 },
        dimensions: { width: 100, height: 100 },
        rotation: 0,
        style: {
          fillColor: `hsl(${index * 30}, 70%, 50%)`,
          strokeColor: '#000000',
          strokeWidth: 2,
          opacity: 1
        },
        zIndex: index
      }
    })
  );
}

/**
 * Create a sequence of operations for testing conflict resolution
 */
export function createConflictingOperations(elementId: string): Operation[] {
  return [
    createMockOperation(OperationType.UPDATE, {
      elementId,
      version: 2,
      versionNonce: 1000,
      updates: { position: { x: 100, y: 100 } },
      authorId: 'user-1'
    }),
    createMockOperation(OperationType.UPDATE, {
      elementId,
      version: 2,
      versionNonce: 500, // Lower nonce should win in tie
      updates: { position: { x: 200, y: 200 } },
      authorId: 'user-2'
    })
  ];
}

/**
 * Mock implementations for testing
 */

/**
 * Mock StateManager for testing other components
 */
export class MockStateManager {
  private elements: Map<string, CollaborativeElement> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();

  addElement(element: CollaborativeElement): void {
    this.elements.set(element.id, element);
    this.emit('state:element-added', element);
  }

  getElement(id: string): CollaborativeElement | null {
    return this.elements.get(id) || null;
  }

  getElements(): CollaborativeElement[] {
    return Array.from(this.elements.values());
  }

  clear(): void {
    this.elements.clear();
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }
}

/**
 * Mock SyncEngine for testing other components
 */
export class MockSyncEngine {
  private operations: Operation[] = [];
  private eventHandlers: Map<string, Function[]> = new Map();
  private isRunning: boolean = false;

  addOperation(operation: Operation): void {
    this.operations.push(operation);
    this.emit('sync:operation-added', operation);
  }

  flushOperations(): Operation[] {
    const ops = [...this.operations];
    this.operations = [];
    if (ops.length > 0) {
      this.emit('sync:batch-ready', ops);
    }
    return ops;
  }

  start(): void {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }

  getQueueSize(): number {
    return this.operations.length;
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }
}

/**
 * Mock ConnectionManager for testing
 */
export class MockConnectionManager {
  private isConnected: boolean = false;
  private eventHandlers: Map<string, Function[]> = new Map();
  private sentMessages: any[] = [];

  async connect(url: string): Promise<void> {
    this.isConnected = true;
    this.emit('connection:connected');
  }

  disconnect(): void {
    this.isConnected = false;
    this.emit('connection:disconnected');
  }

  send(message: any): void {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    this.sentMessages.push(message);
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  getSentMessages(): any[] {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }

  // Simulate receiving a message
  simulateMessage(message: any): void {
    this.emit('connection:message', message);
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }
}

/**
 * Test utilities for timing and async operations
 */
export const TestUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Wait for a condition to become true
   */
  waitFor(
    condition: () => boolean,
    timeoutMs: number = 5000,
    intervalMs: number = 10
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, intervalMs);
        }
      };
      
      check();
    });
  },

  /**
   * Create a spy function that tracks calls
   */
  createSpy(): {
    fn: (...args: any[]) => any;
    calls: any[][];
    callCount: number;
  } {
    const calls: any[][] = [];
    
    const fn = (...args: any[]) => {
      calls.push(args);
    };
    
    return {
      fn,
      calls,
      get callCount() {
        return calls.length;
      }
    };
  },

  /**
   * Generate deterministic IDs for testing
   */
  createTestId(prefix: string = 'test'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Deep clone an object for testing
   */
  deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
};

/**
 * Validation utilities for testing
 */
export const ValidationUtils = {
  /**
   * Validate element structure
   */
  isValidElement(element: any): element is CollaborativeElement {
    return (
      typeof element.id === 'string' &&
      typeof element.type === 'string' &&
      typeof element.version === 'number' &&
      typeof element.versionNonce === 'number' &&
      typeof element.isDeleted === 'boolean' &&
      typeof element.authorId === 'string' &&
      typeof element.createdAt === 'number' &&
      typeof element.updatedAt === 'number' &&
      element.properties &&
      typeof element.properties.position === 'object' &&
      typeof element.properties.dimensions === 'object'
    );
  },

  /**
   * Validate operation structure
   */
  isValidOperation(operation: any): operation is Operation {
    return (
      typeof operation.id === 'string' &&
      typeof operation.type === 'string' &&
      typeof operation.authorId === 'string' &&
      typeof operation.timestamp === 'number' &&
      typeof operation.roomId === 'string'
    );
  }
};

/**
 * Export the testing helpers implementation
 */
export const testingHelpers: TestingHelpers = {
  createMockElement,
  createMockOperation,
  createMockParticipant,
  createMockSession
};