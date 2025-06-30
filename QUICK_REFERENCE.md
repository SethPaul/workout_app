# Isolated Components Quick Reference

## 🚀 Setup

```bash
# Run setup script
./setup-isolated-components.sh

# Or manual setup
cd packages/core
npm install uuid eventemitter3
npm install -D @types/uuid @types/jest @types/node typescript jest ts-jest
```

## 🧪 Testing Commands

```bash
cd packages/core

# Run all tests
npm test

# Watch mode (recommended for development)
npm run test:watch

# Coverage report
npm run test:coverage

# Test specific file
npm test -- StateManager.test.ts
```

## 📦 Core Imports

```typescript
import {
  // Core Components
  StateManager,
  SyncEngine,
  
  // Types
  CollaborativeElement,
  Operation,
  OperationType,
  ElementType,
  
  // Testing
  createMockElement,
  createMockOperation,
  MockStateManager,
  MockSyncEngine,
  TestUtils,
  
  // Factories
  createStateManager,
  createSyncEngine
} from '@collab-platform/core';
```

## 📊 StateManager Usage

```typescript
// Create and use StateManager
const stateManager = new StateManager();

// Add element
const element = createMockElement({
  type: ElementType.RECTANGLE,
  properties: { position: { x: 100, y: 100 } }
});
stateManager.addElement(element);

// Listen for changes
stateManager.on('state:element-added', (element) => {
  console.log('Added:', element.id);
});

// Update element
stateManager.updateElement(element.id, {
  position: { x: 200, y: 200 }
});

// Delete element (tombstoning)
stateManager.deleteElement(element.id);

// Merge remote state (conflict resolution)
const conflicts = stateManager.mergeState(remoteElements);

// Create snapshot
const snapshot = stateManager.createSnapshot();
```

## ⚡ SyncEngine Usage

```typescript
// Create SyncEngine
const syncEngine = new SyncEngine({
  batchInterval: 16, // 60fps
  maxBatchSize: 100
});

// Listen for batches
syncEngine.on('batch-ready', (operations) => {
  // Send to network
  console.log('Batch ready:', operations.length);
});

// Add operations
const operation = createMockOperation(OperationType.CREATE, {
  element: createMockElement()
});
syncEngine.addOperation(operation);

// Lifecycle
syncEngine.start();
syncEngine.stop();
syncEngine.destroy();

// Status
console.log('Queue size:', syncEngine.getQueueSize());
console.log('Is running:', syncEngine.isActive());
```

## 🧪 Testing Patterns

### Unit Testing
```typescript
describe('Component', () => {
  let component: MyComponent;
  
  beforeEach(() => {
    component = new MyComponent();
  });
  
  it('should do something', () => {
    // Test individual component behavior
    const result = component.doSomething();
    expect(result).toBeDefined();
  });
});
```

### Integration Testing with Mocks
```typescript
describe('Integration', () => {
  it('should work together', () => {
    const stateManager = new StateManager();
    const mockSync = new MockSyncEngine();
    
    // Wire them together
    stateManager.on('state:element-added', (element) => {
      mockSync.addOperation(createMockOperation(OperationType.CREATE, { element }));
    });
    
    // Test the integration
    stateManager.addElement(createMockElement());
    expect(mockSync.getQueueSize()).toBe(1);
  });
});
```

### Async Testing
```typescript
it('should handle async operations', async () => {
  const component = new AsyncComponent();
  
  component.start();
  
  // Wait for condition
  await TestUtils.waitFor(() => component.isReady());
  
  expect(component.isReady()).toBe(true);
});
```

### Event Testing
```typescript
it('should emit events', (done) => {
  const component = new EventComponent();
  
  component.on('something-happened', (data) => {
    expect(data).toBeDefined();
    done();
  });
  
  component.triggerEvent();
});
```

## 🏗️ Mock Components

```typescript
// Use mock implementations for testing
const mockState = new MockStateManager();
const mockSync = new MockSyncEngine();
const mockConnection = new MockConnectionManager();

// Mock methods
mockConnection.connect('ws://test');
mockConnection.simulateMessage({ type: 'test' });
expect(mockConnection.getSentMessages()).toHaveLength(1);
```

## 🔧 Test Data Creation

```typescript
// Create test elements
const element = createMockElement({
  type: ElementType.CIRCLE,
  properties: {
    position: { x: 50, y: 50 },
    dimensions: { width: 100, height: 100 }
  }
});

// Create test operations
const createOp = createMockOperation(OperationType.CREATE, {
  element: element
});

const updateOp = createMockOperation(OperationType.UPDATE, {
  elementId: element.id,
  updates: { position: { x: 100, y: 100 } }
});

// Create collections
const elements = Array.from({ length: 10 }, () => createMockElement());

// Create conflicts for testing
const conflicts = createConflictingOperations('element-1');
```

## 🎯 Common Patterns

### Component Wiring
```typescript
// Wire StateManager and SyncEngine
const state = new StateManager();
const sync = new SyncEngine();

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

state.on('state:element-updated', (element) => {
  sync.addOperation({
    id: Date.now().toString(),
    type: OperationType.UPDATE,
    elementId: element.id,
    updates: element.properties,
    version: element.version,
    versionNonce: element.versionNonce,
    authorId: 'user-1',
    timestamp: Date.now(),
    roomId: 'room-1'
  });
});
```

### Conflict Resolution Testing
```typescript
it('should resolve conflicts correctly', () => {
  const stateManager = new StateManager();
  
  // Add local element
  const localElement = createMockElement({ version: 1 });
  stateManager.addElement(localElement);
  
  // Create remote element with higher version
  const remoteElement = createMockElement({
    id: localElement.id,
    version: 2,
    properties: { position: { x: 999, y: 999 } }
  });
  
  // Merge and check resolution
  const conflicts = stateManager.mergeState([remoteElement]);
  
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0].winner).toBe('remote');
  expect(stateManager.getElement(localElement.id)!.properties.position.x).toBe(999);
});
```

### Performance Testing
```typescript
it('should handle large numbers of elements', () => {
  const stateManager = new StateManager();
  const elements = Array.from({ length: 1000 }, () => createMockElement());
  
  const startTime = Date.now();
  elements.forEach(element => stateManager.addElement(element));
  const endTime = Date.now();
  
  expect(stateManager.getElementCount()).toBe(1000);
  expect(endTime - startTime).toBeLessThan(100); // Should be fast
});
```

## 📂 File Structure Reference

```
packages/core/
├── src/
│   ├── types/index.ts              # All type definitions
│   ├── state/
│   │   ├── StateManager.ts         # State management component
│   │   └── __tests__/
│   │       └── StateManager.test.ts # State manager tests
│   ├── sync/
│   │   ├── SyncEngine.ts           # Sync component
│   │   └── __tests__/
│   │       └── SyncEngine.test.ts  # Sync engine tests
│   ├── testing/
│   │   └── helpers.ts              # Test utilities and mocks
│   └── index.ts                    # Main exports
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
└── jest.config.js                  # Jest test configuration
```

## 🎯 Development Workflow

1. **Start with interface** in `types/index.ts`
2. **Implement component** following the interface
3. **Write comprehensive tests** using testing utilities
4. **Create mock implementation** for integration testing
5. **Wire with other components** using events
6. **Test integration** using mocks
7. **Document usage** and add to exports

## 🔍 Debugging Tips

```typescript
// Enable verbose logging
stateManager.on('state:element-added', console.log);
stateManager.on('state:conflict-resolved', console.log);

// Check component state
console.log('Elements:', stateManager.getElementCount());
console.log('Queue size:', syncEngine.getQueueSize());
console.log('Stats:', syncEngine.getStats());

// Validate data
import { ValidationUtils } from '@collab-platform/core';
console.log('Valid element:', ValidationUtils.isValidElement(element));
console.log('Valid operation:', ValidationUtils.isValidOperation(operation));
```

---

This quick reference provides everything needed to start using the isolated components foundation immediately!