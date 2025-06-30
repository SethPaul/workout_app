/**
 * @collab-platform/core
 * 
 * Isolated, testable components for realtime collaborative platforms
 * 
 * This package provides the core building blocks for collaborative applications:
 * - State management with conflict resolution
 * - Operation synchronization and batching
 * - Testing utilities and mock implementations
 * 
 * All components are designed to be:
 * - Fully isolated and dependency-free
 * - Comprehensively tested
 * - Composable into larger systems
 * - Mock-able for integration testing
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export * from './types';

// ============================================================================
// CORE COMPONENTS
// ============================================================================

// State Management
export { StateManager, createStateManager } from './state/StateManager';

// Synchronization
export { SyncEngine, createSyncEngine, SyncUtils } from './sync/SyncEngine';

// ============================================================================
// TESTING UTILITIES
// ============================================================================

export {
  // Mock implementations
  MockStateManager,
  MockSyncEngine,
  MockConnectionManager,
  
  // Test helpers
  createMockElement,
  createMockOperation,
  createMockUser,
  createMockParticipant,
  createMockSession,
  createMockElementCollection,
  createConflictingOperations,
  
  // Utilities
  TestUtils,
  ValidationUtils,
  testingHelpers
} from './testing/helpers';

// ============================================================================
// VERSION AND METADATA
// ============================================================================

export const VERSION = '1.0.0';

export const COMPONENT_INFO = {
  name: '@collab-platform/core',
  version: VERSION,
  description: 'Core isolated components for realtime collaborative platforms',
  components: [
    'StateManager',
    'SyncEngine',
    'ConflictResolver',
    'SessionManager',
    'ConnectionManager',
    'EncryptionManager'
  ],
  features: [
    'Version-based conflict resolution',
    'Tombstoning for deletions',
    'Operation batching and synchronization',
    'Event-driven architecture',
    'Comprehensive testing utilities',
    'Mock implementations for testing'
  ]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a complete collaboration engine with all components
 */
export function createCollaborationEngine(options: {
  batchInterval?: number;
  maxBatchSize?: number;
} = {}) {
  const stateManager = createStateManager();
  const syncEngine = createSyncEngine(options);
  
  return {
    stateManager,
    syncEngine,
    
    // Convenience methods
    start() {
      syncEngine.start();
    },
    
    stop() {
      syncEngine.stop();
    },
    
    destroy() {
      syncEngine.destroy();
      stateManager.clear();
    }
  };
}

/**
 * Validate component compatibility
 */
export function validateComponentVersion(requiredVersion: string): boolean {
  // Simple version comparison for demonstration
  return VERSION >= requiredVersion;
}

/**
 * Get runtime information about the components
 */
export function getComponentStats() {
  return {
    ...COMPONENT_INFO,
    timestamp: new Date().toISOString(),
    environment: typeof window !== 'undefined' ? 'browser' : 'node'
  };
}