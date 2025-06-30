import { StateManager } from '../StateManager';
import {
  CollaborativeElement,
  ElementType,
  ElementProperties,
  StateError
} from '../../types';

// Test helpers
function createMockElement(overrides: Partial<CollaborativeElement> = {}): CollaborativeElement {
  const defaults: CollaborativeElement = {
    id: `element-${Math.random().toString(36).substr(2, 9)}`,
    type: ElementType.RECTANGLE,
    properties: {
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
    },
    version: 1,
    versionNonce: 12345,
    isDeleted: false,
    authorId: 'user-1',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return { ...defaults, ...overrides };
}

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
      expect(stateManager.getElementCount()).toBe(1);
      expect(stateManager.getVisibleElementCount()).toBe(1);
    });

    it('should prevent adding duplicate elements', () => {
      const element = createMockElement();
      
      stateManager.addElement(element);
      
      expect(() => {
        stateManager.addElement(element);
      }).toThrow(StateError);
    });

    it('should update existing elements', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      
      const updates: Partial<ElementProperties> = {
        position: { x: 50, y: 50 }
      };
      
      const updated = stateManager.updateElement(element.id, updates);
      
      expect(updated).not.toBeNull();
      expect(updated!.properties.position).toEqual({ x: 50, y: 50 });
      expect(updated!.version).toBe(element.version + 1);
      expect(updated!.versionNonce).not.toBe(element.versionNonce);
    });

    it('should return null when updating non-existent element', () => {
      const result = stateManager.updateElement('non-existent', {});
      expect(result).toBeNull();
    });

    it('should prevent updating deleted elements', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      stateManager.deleteElement(element.id);
      
      expect(() => {
        stateManager.updateElement(element.id, {});
      }).toThrow(StateError);
    });

    it('should delete elements using tombstoning', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      
      const deleted = stateManager.deleteElement(element.id);
      
      expect(deleted).not.toBeNull();
      expect(deleted!.isDeleted).toBe(true);
      expect(deleted!.version).toBe(element.version + 1);
      expect(stateManager.getElementCount()).toBe(1); // Still exists
      expect(stateManager.getVisibleElementCount()).toBe(0); // Not visible
    });

    it('should handle deleting already deleted elements', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      
      const first = stateManager.deleteElement(element.id);
      const second = stateManager.deleteElement(element.id);
      
      expect(first).toEqual(second);
    });

    it('should return null when deleting non-existent element', () => {
      const result = stateManager.deleteElement('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('State Versioning', () => {
    it('should increment version when elements change', () => {
      const initialVersion = stateManager.getVersion();
      const element = createMockElement();
      
      stateManager.addElement(element);
      expect(stateManager.getVersion()).toBe(initialVersion + 1);
      
      stateManager.updateElement(element.id, { position: { x: 10, y: 10 } });
      expect(stateManager.getVersion()).toBe(initialVersion + 2);
      
      stateManager.deleteElement(element.id);
      expect(stateManager.getVersion()).toBe(initialVersion + 3);
    });

    it('should assign version nonces to elements', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      
      const stored = stateManager.getElement(element.id)!;
      expect(typeof stored.versionNonce).toBe('number');
      expect(stored.versionNonce).toBeGreaterThan(0);
    });

    it('should update timestamps on element changes', () => {
      const element = createMockElement();
      const beforeAdd = Date.now();
      
      stateManager.addElement(element);
      const stored = stateManager.getElement(element.id)!;
      
      expect(stored.updatedAt).toBeGreaterThanOrEqual(beforeAdd);
      
      const beforeUpdate = Date.now();
      const updated = stateManager.updateElement(element.id, {})!;
      
      expect(updated.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(stored.updatedAt);
    });
  });

  describe('State Merging', () => {
    it('should merge remote elements with no conflicts', () => {
      const localElement = createMockElement({ id: 'local-1' });
      const remoteElement = createMockElement({ id: 'remote-1' });
      
      stateManager.addElement(localElement);
      
      const conflicts = stateManager.mergeState([remoteElement]);
      
      expect(conflicts).toHaveLength(0);
      expect(stateManager.getElementCount()).toBe(2);
      expect(stateManager.getElement('remote-1')).toEqual(remoteElement);
    });

    it('should resolve version conflicts - remote wins', () => {
      const element = createMockElement({ version: 1 });
      stateManager.addElement(element);
      
      const remoteElement = createMockElement({ 
        id: element.id, 
        version: 2,
        properties: {
          ...element.properties,
          position: { x: 100, y: 100 }
        }
      });
      
      const conflicts = stateManager.mergeState([remoteElement]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].winner).toBe('remote');
      expect(conflicts[0].conflictType).toBe('version');
      expect(stateManager.getElement(element.id)!.properties.position).toEqual({ x: 100, y: 100 });
    });

    it('should resolve version conflicts - local wins', () => {
      const element = createMockElement({ version: 2 });
      stateManager.addElement(element);
      
      const remoteElement = createMockElement({ 
        id: element.id, 
        version: 1,
        properties: {
          ...element.properties,
          position: { x: 100, y: 100 }
        }
      });
      
      const conflicts = stateManager.mergeState([remoteElement]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].winner).toBe('local');
      expect(conflicts[0].conflictType).toBe('version');
      expect(stateManager.getElement(element.id)!.properties.position).toEqual(element.properties.position);
    });

    it('should resolve concurrent conflicts using nonce', () => {
      const element = createMockElement({ version: 1, versionNonce: 1000 });
      stateManager.addElement(element);
      
      const remoteElement = createMockElement({ 
        id: element.id, 
        version: 1, 
        versionNonce: 500 // Lower nonce should win
      });
      
      const conflicts = stateManager.mergeState([remoteElement]);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].winner).toBe('remote');
      expect(conflicts[0].conflictType).toBe('concurrent');
    });
  });

  describe('Snapshots', () => {
    it('should create snapshots', () => {
      const element1 = createMockElement();
      const element2 = createMockElement();
      
      stateManager.addElement(element1);
      stateManager.addElement(element2);
      
      const snapshot = stateManager.createSnapshot();
      
      expect(snapshot.elements).toHaveLength(2);
      expect(snapshot.version).toBe(stateManager.getVersion());
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.checksum).toBeDefined();
    });

    it('should load from snapshots', () => {
      const element = createMockElement();
      const snapshot = {
        elements: [element],
        version: 5,
        timestamp: Date.now(),
        checksum: 'abc123'
      };
      
      stateManager.loadSnapshot(snapshot);
      
      expect(stateManager.getElement(element.id)).toEqual(element);
      expect(stateManager.getVersion()).toBe(5);
      expect(stateManager.getElementCount()).toBe(1);
    });

    it('should detect changes since snapshot', () => {
      expect(stateManager.hasChangedSinceSnapshot()).toBe(false);
      
      const element = createMockElement();
      stateManager.addElement(element);
      
      expect(stateManager.hasChangedSinceSnapshot()).toBe(true);
      
      stateManager.createSnapshot();
      expect(stateManager.hasChangedSinceSnapshot()).toBe(false);
      
      stateManager.updateElement(element.id, {});
      expect(stateManager.hasChangedSinceSnapshot()).toBe(true);
    });
  });

  describe('State Clearing', () => {
    it('should clear all state', () => {
      const element = createMockElement();
      stateManager.addElement(element);
      stateManager.createSnapshot();
      
      stateManager.clear();
      
      expect(stateManager.getElementCount()).toBe(0);
      expect(stateManager.getVersion()).toBe(0);
      expect(stateManager.hasChangedSinceSnapshot()).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit element-added events', (done) => {
      const element = createMockElement();
      
      stateManager.on('state:element-added', (addedElement) => {
        expect(addedElement.id).toBe(element.id);
        done();
      });
      
      stateManager.addElement(element);
    });

    it('should emit element-updated events', (done) => {
      const element = createMockElement();
      stateManager.addElement(element);
      
      stateManager.on('state:element-updated', (updated, previous) => {
        expect(updated.id).toBe(element.id);
        expect(previous.id).toBe(element.id);
        expect(updated.version).toBe(previous.version + 1);
        done();
      });
      
      stateManager.updateElement(element.id, {});
    });

    it('should emit element-deleted events', (done) => {
      const element = createMockElement();
      stateManager.addElement(element);
      
      stateManager.on('state:element-deleted', (deleted) => {
        expect(deleted.id).toBe(element.id);
        expect(deleted.isDeleted).toBe(true);
        done();
      });
      
      stateManager.deleteElement(element.id);
    });

    it('should emit conflict-resolved events', (done) => {
      const element = createMockElement({ version: 1 });
      stateManager.addElement(element);
      
      stateManager.on('state:conflict-resolved', (resolution) => {
        expect(resolution.conflictType).toBe('version');
        expect(resolution.winner).toBe('remote');
        done();
      });
      
      const remoteElement = createMockElement({ 
        id: element.id, 
        version: 2 
      });
      
      stateManager.mergeState([remoteElement]);
    });

    it('should emit snapshot-created events', (done) => {
      stateManager.on('state:snapshot-created', (snapshot) => {
        expect(snapshot.version).toBeGreaterThanOrEqual(0);
        expect(snapshot.elements).toBeDefined();
        done();
      });
      
      stateManager.createSnapshot();
    });
  });

  describe('Edge Cases', () => {
    it('should handle elements with missing optional fields', () => {
      const minimalElement = createMockElement({
        version: undefined as any,
        versionNonce: undefined as any,
        createdAt: undefined as any
      });
      
      stateManager.addElement(minimalElement);
      const stored = stateManager.getElement(minimalElement.id)!;
      
      expect(stored.version).toBe(1);
      expect(stored.versionNonce).toBeGreaterThan(0);
      expect(stored.createdAt).toBeGreaterThan(0);
      expect(stored.updatedAt).toBeGreaterThan(0);
    });

    it('should maintain consistent checksums', () => {
      const element1 = createMockElement({ id: 'a', version: 1 });
      const element2 = createMockElement({ id: 'b', version: 1 });
      
      stateManager.addElement(element1);
      stateManager.addElement(element2);
      const checksum1 = stateManager.createSnapshot().checksum;
      
      stateManager.clear();
      stateManager.addElement(element2);
      stateManager.addElement(element1);
      const checksum2 = stateManager.createSnapshot().checksum;
      
      expect(checksum1).toBe(checksum2);
    });

    it('should handle large numbers of elements', () => {
      const elements = Array.from({ length: 1000 }, (_, i) => 
        createMockElement({ id: `element-${i}` })
      );
      
      elements.forEach(element => stateManager.addElement(element));
      
      expect(stateManager.getElementCount()).toBe(1000);
      expect(stateManager.getVisibleElementCount()).toBe(1000);
      
      const snapshot = stateManager.createSnapshot();
      expect(snapshot.elements).toHaveLength(1000);
    });
  });
});