# Isolated Components Foundation Guide

## Overview

This guide explains how to use the isolated, testable components foundation for the realtime collaborative platform. Each component is designed to be independently testable, mockable, and composable.

## Component Architecture

### 🏗️ **Foundation Structure**
```
packages/core/
├── src/
│   ├── types/           # Shared interfaces and contracts
│   ├── state/           # State management components
│   ├── sync/            # Synchronization components  
│   ├── connection/      # Network communication components
│   ├── session/         # Session management components
│   ├── encryption/      # Security components
│   └── testing/         # Testing utilities and mocks
├── package.json
└── tsconfig.json
```

### 🎯 **Core Principles**

1. **Isolation**: Each component has clear boundaries and minimal dependencies
2. **Testability**: Every component can be tested in isolation with comprehensive test suites
3. **Mockability**: Mock implementations available for integration testing
4. **Composability**: Components can be combined to create larger systems
5. **Event-driven**: Components communicate through well-defined events

## Available Components

### 1. StateManager 📊

**Purpose**: Manages collaborative element state with versioning and conflict resolution

**Key Features**:
- Element CRUD operations
- Version-based conflict resolution
- Tombstoning for deletions
- State snapshots
- Event emission for state changes

**Usage**:
```typescript
import { StateManager, createMockElement } from '@collab-platform/core';

const stateManager = new StateManager();

// Add element
const element = createMockElement({ 
  type: ElementType.RECTANGLE,
  properties: { position: { x: 100, y: 100 } }
});
stateManager.addElement(element);

// Listen for changes
stateManager.on('state:element-added', (element) => {
  console.log('Element added:', element.id);
});

// Update element
stateManager.updateElement(element.id, {
  position: { x: 200, y: 200 }
});
```

**Testing**:
```typescript
// Unit testing with real component
describe('StateManager', () => {
  let stateManager: StateManager;
  
  beforeEach(() => {
    stateManager = new StateManager();
  });
  
  it('should add elements', () => {
    const element = createMockElement();
    stateManager.addElement(element);
    expect(stateManager.getElementCount()).toBe(1);
  });
});

// Integration testing with mock
const mockStateManager = new MockStateManager();
// Use in other component tests
```

### 2. SyncEngine ⚡

**Purpose**: Batches operations for efficient network transmission

**Key Features**:
- Operation queuing and batching
- Configurable batch intervals
- Automatic flushing on size limits
- Operation merging optimization
- Start/stop lifecycle management

**Usage**:
```typescript
import { SyncEngine, createMockOperation, OperationType } from '@collab-platform/core';

const syncEngine = new SyncEngine({
  batchInterval: 16, // 60fps
  maxBatchSize: 100
});

// Listen for batches
syncEngine.on('batch-ready', (operations) => {
  console.log('Sending batch:', operations.length);
  // Send to network layer
});

// Add operations
const operation = createMockOperation(OperationType.CREATE);
syncEngine.addOperation(operation);

// Start batching
syncEngine.start();
```

**Testing**:
```typescript
describe('SyncEngine', () => {
  it('should batch operations', async () => {
    const syncEngine = new SyncEngine({ batchInterval: 10 });
    const batchHandler = jest.fn();
    
    syncEngine.on('batch-ready', batchHandler);
    syncEngine.start();
    
    syncEngine.addOperation(createMockOperation(OperationType.CREATE));
    
    await TestUtils.wait(20);
    expect(batchHandler).toHaveBeenCalledWith([expect.any(Object)]);
  });
});
```

### 3. Testing Utilities 🧪

**Purpose**: Comprehensive testing support for all components

**Available Utilities**:
- Mock implementations of all components
- Factory functions for test data
- Validation utilities
- Timing and async testing helpers

**Mock Components**:
```typescript
import { 
  MockStateManager, 
  MockSyncEngine, 
  MockConnectionManager 
} from '@collab-platform/core';

// Use mocks in integration tests
const mockState = new MockStateManager();
const mockSync = new MockSyncEngine();
const mockConnection = new MockConnectionManager();

// Mock connection with simulated responses
mockConnection.connect('ws://test');
mockConnection.simulateMessage({ type: 'test' });
```

**Test Data Factories**:
```typescript
import { 
  createMockElement,
  createMockOperation,
  createConflictingOperations,
  ValidationUtils
} from '@collab-platform/core';

// Create test data
const element = createMockElement({ type: ElementType.CIRCLE });
const operation = createMockOperation(OperationType.UPDATE);
const conflicts = createConflictingOperations('element-1');

// Validate data
expect(ValidationUtils.isValidElement(element)).toBe(true);
expect(ValidationUtils.isValidOperation(operation)).toBe(true);
```

**Async Testing Utilities**:
```typescript
import { TestUtils } from '@collab-platform/core';

// Wait for conditions
await TestUtils.waitFor(() => stateManager.getElementCount() > 0);

// Create spies
const spy = TestUtils.createSpy();
component.on('event', spy.fn);
expect(spy.callCount).toBe(1);

// Time-based testing
await TestUtils.wait(100);
```

## Testing Strategies

### 🔬 **Unit Testing**

Test each component in complete isolation:

```typescript
// state/StateManager.test.ts
describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('Element Management', () => {
    it('should add new elements', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      expect(stateManager.getElement(element.id)).toEqual(element);
    });

    it('should handle conflicts correctly', () => {
      const element = createMockElement({ version: 1 });
      stateManager.addElement(element);
      
      const remoteElement = createMockElement({ 
        id: element.id, 
        version: 2 
      });
      
      const conflicts = stateManager.mergeState([remoteElement]);
      expect(conflicts[0].winner).toBe('remote');
    });
  });
});
```

### 🔗 **Integration Testing**

Test component interactions using mocks:

```typescript
// integration/StateSync.test.ts
describe('State and Sync Integration', () => {
  let stateManager: StateManager;
  let mockSync: MockSyncEngine;

  beforeEach(() => {
    stateManager = new StateManager();
    mockSync = new MockSyncEngine();
    
    // Wire them together
    stateManager.on('state:element-added', (element) => {
      const operation = createMockOperation(OperationType.CREATE, { element });
      mockSync.addOperation(operation);
    });
  });

  it('should sync state changes', () => {
    const element = createMockElement();
    stateManager.addElement(element);
    
    expect(mockSync.getQueueSize()).toBe(1);
    
    const operations = mockSync.flushOperations();
    expect(operations[0].type).toBe(OperationType.CREATE);
  });
});
```

### 🎭 **Mock Testing**

Test other systems using component mocks:

```typescript
// Example: Testing a higher-level collaboration engine
describe('CollaborationEngine', () => {
  it('should coordinate state and sync', () => {
    const mockState = new MockStateManager();
    const mockSync = new MockSyncEngine();
    
    const engine = new CollaborationEngine(mockState, mockSync);
    
    engine.addElement(createMockElement());
    
    // Verify coordination
    expect(mockState.getElements()).toHaveLength(1);
    expect(mockSync.getQueueSize()).toBe(1);
  });
});
```

## Setup Instructions

### 1. Installation

```bash
# Initialize the core package
cd packages/core
npm install

# Install dependencies
npm install uuid eventemitter3
npm install -D @types/uuid @types/jest @types/node typescript jest ts-jest
```

### 2. Package Configuration

The `package.json` includes all necessary dependencies and scripts:

```json
{
  "name": "@collab-platform/core",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 3. TypeScript Configuration

The `tsconfig.json` is configured for strict typing and proper module resolution.

### 4. Testing Setup

Jest is configured with TypeScript support:

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "collectCoverageFrom": ["src/**/*.ts"]
  }
}
```

## Development Workflow

### 🚀 **Component Development**

1. **Define Interface**: Start with the component interface in `types/index.ts`
2. **Implement Component**: Create the component following the interface
3. **Write Tests**: Comprehensive unit tests for all functionality
4. **Create Mocks**: Mock implementation for integration testing
5. **Integration**: Wire with other components using events

### 📝 **Testing Workflow**

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Test specific component
npm test -- StateManager.test.ts
```

### 🔧 **Example: Adding a New Component**

1. **Define interface** in `types/index.ts`:
```typescript
export interface IConnectionManager {
  connect(url: string): Promise<void>;
  disconnect(): void;
  send(message: Message): void;
  isConnected(): boolean;
}
```

2. **Implement component** in `connection/ConnectionManager.ts`:
```typescript
export class ConnectionManager implements IConnectionManager {
  // Implementation with full isolation
}
```

3. **Create tests** in `connection/__tests__/ConnectionManager.test.ts`:
```typescript
describe('ConnectionManager', () => {
  // Comprehensive test suite
});
```

4. **Create mock** in `testing/helpers.ts`:
```typescript
export class MockConnectionManager implements IConnectionManager {
  // Mock implementation for testing
}
```

## Benefits of This Approach

### ✅ **For Development**

- **Fast Feedback**: Test individual components quickly
- **Easier Debugging**: Isolate issues to specific components
- **Parallel Development**: Teams can work on different components simultaneously
- **Incremental Integration**: Add components one by one

### ✅ **For Testing**

- **Complete Coverage**: Every component thoroughly tested
- **Reliable Tests**: No external dependencies to break tests
- **Fast Test Suite**: Unit tests run in milliseconds
- **Deterministic**: Tests always produce same results

### ✅ **For Maintenance**

- **Modularity**: Change one component without affecting others
- **Clear Boundaries**: Well-defined interfaces between components
- **Easy Refactoring**: Refactor internals without breaking API
- **Documentation**: Each component is self-documenting

### ✅ **For Integration**

- **Gradual Integration**: Test component combinations incrementally
- **Mock External Dependencies**: Use mocks for services not yet implemented
- **Regression Testing**: Ensure changes don't break existing functionality
- **Performance Testing**: Measure individual component performance

## Component Roadmap

### ✅ **Completed**
- Core types and interfaces
- StateManager with conflict resolution
- SyncEngine with operation batching
- Comprehensive testing utilities

### 🚧 **In Progress**
- ConnectionManager for WebSocket communication
- SessionManager for participant management
- EncryptionManager for security

### 📋 **Planned**
- ConflictResolver as separate component
- CanvasEngine for rendering
- PersistenceManager for data storage
- MetricsCollector for observability

## Usage Examples

### Basic Component Usage

```typescript
import { 
  StateManager, 
  SyncEngine, 
  createMockElement, 
  OperationType 
} from '@collab-platform/core';

// Create components
const state = new StateManager();
const sync = new SyncEngine();

// Wire them together
state.on('state:element-added', (element) => {
  sync.addOperation({
    id: Date.now().toString(),
    type: OperationType.CREATE,
    element,
    authorId: 'user-1',
    timestamp: Date.now(),
    roomId: 'room-1'
  });
});

// Use the system
sync.start();
state.addElement(createMockElement());
```

### Advanced Integration

```typescript
import { createCollaborationEngine } from '@collab-platform/core';

// Create complete engine
const engine = createCollaborationEngine({
  batchInterval: 16,
  maxBatchSize: 100
});

// Set up event handling
engine.stateManager.on('state:element-added', (element) => {
  console.log('Element added:', element.id);
});

engine.syncEngine.on('batch-ready', (operations) => {
  console.log('Sending batch:', operations.length);
});

// Start the engine
engine.start();
```

This foundation provides a solid base for building the realtime collaborative platform with confidence that each component works correctly in isolation and can be composed into larger systems reliably.

---

**Next Steps**: 
1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Start building additional components
4. Create integration tests as you wire components together