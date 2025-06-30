import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  IStateManager,
  CollaborativeElement,
  ElementProperties,
  StateSnapshot,
  ConflictResolution,
  StateError,
  ComponentEvents
} from '../types';

/**
 * StateManager - Isolated component for managing collaborative element state
 * 
 * Responsibilities:
 * - Store and manage collaborative elements
 * - Handle element versioning
 * - Create and manage state snapshots
 * - Provide element CRUD operations
 * - Emit state change events
 * 
 * This component is fully isolated and testable without dependencies
 */
export class StateManager extends EventEmitter<ComponentEvents> implements IStateManager {
  private elements: Map<string, CollaborativeElement> = new Map();
  private version: number = 0;
  private lastSnapshot: StateSnapshot | null = null;

  constructor() {
    super();
  }

  /**
   * Get all elements (including deleted ones)
   */
  getElements(): CollaborativeElement[] {
    return Array.from(this.elements.values());
  }

  /**
   * Get all visible elements (excluding deleted ones)
   */
  getVisibleElements(): CollaborativeElement[] {
    return this.getElements().filter(element => !element.isDeleted);
  }

  /**
   * Get a specific element by ID
   */
  getElement(id: string): CollaborativeElement | null {
    return this.elements.get(id) || null;
  }

  /**
   * Add a new element to the state
   */
  addElement(element: CollaborativeElement): void {
    if (this.elements.has(element.id)) {
      throw new StateError(`Element with id ${element.id} already exists`);
    }

    // Ensure element has proper versioning
    const versionedElement: CollaborativeElement = {
      ...element,
      version: element.version || 1,
      versionNonce: element.versionNonce || this.generateVersionNonce(),
      createdAt: element.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    this.elements.set(element.id, versionedElement);
    this.incrementVersion();
    
    this.emit('state:element-added', versionedElement);
  }

  /**
   * Update an existing element
   */
  updateElement(id: string, updates: Partial<ElementProperties>): CollaborativeElement | null {
    const existing = this.elements.get(id);
    if (!existing) {
      return null;
    }

    if (existing.isDeleted) {
      throw new StateError(`Cannot update deleted element ${id}`);
    }

    const previous = { ...existing };
    const updated: CollaborativeElement = {
      ...existing,
      properties: {
        ...existing.properties,
        ...updates
      },
      version: existing.version + 1,
      versionNonce: this.generateVersionNonce(),
      updatedAt: Date.now()
    };

    this.elements.set(id, updated);
    this.incrementVersion();
    
    this.emit('state:element-updated', updated, previous);
    
    return updated;
  }

  /**
   * Delete an element (using tombstoning)
   */
  deleteElement(id: string): CollaborativeElement | null {
    const existing = this.elements.get(id);
    if (!existing) {
      return null;
    }

    if (existing.isDeleted) {
      return existing; // Already deleted
    }

    const deleted: CollaborativeElement = {
      ...existing,
      isDeleted: true,
      version: existing.version + 1,
      versionNonce: this.generateVersionNonce(),
      updatedAt: Date.now()
    };

    this.elements.set(id, deleted);
    this.incrementVersion();
    
    this.emit('state:element-deleted', deleted);
    
    return deleted;
  }

  /**
   * Merge remote state with local state
   * Returns array of conflict resolutions
   */
  mergeState(remoteElements: CollaborativeElement[]): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];
    const processed = new Set<string>();

    // Process remote elements
    for (const remoteElement of remoteElements) {
      processed.add(remoteElement.id);
      const localElement = this.elements.get(remoteElement.id);

      if (!localElement) {
        // New element from remote
        this.elements.set(remoteElement.id, remoteElement);
      } else {
        // Resolve conflict
        const resolution = this.resolveElementConflict(localElement, remoteElement);
        conflicts.push(resolution);
        this.elements.set(remoteElement.id, resolution.resolved);
      }
    }

    // Handle local elements not in remote state
    for (const [id, localElement] of this.elements) {
      if (!processed.has(id) && !localElement.isDeleted) {
        // Local element not in remote state - keep it
        // This could indicate a network partition or new local changes
      }
    }

    this.incrementVersion();
    
    // Emit conflict events
    conflicts.forEach(conflict => {
      this.emit('state:conflict-resolved', conflict);
    });

    return conflicts;
  }

  /**
   * Create a state snapshot
   */
  createSnapshot(): StateSnapshot {
    const snapshot: StateSnapshot = {
      elements: this.getElements(),
      version: this.version,
      timestamp: Date.now(),
      checksum: this.calculateChecksum()
    };

    this.lastSnapshot = snapshot;
    this.emit('state:snapshot-created', snapshot);
    
    return snapshot;
  }

  /**
   * Load state from snapshot
   */
  loadSnapshot(snapshot: StateSnapshot): void {
    this.elements.clear();
    
    for (const element of snapshot.elements) {
      this.elements.set(element.id, element);
    }
    
    this.version = snapshot.version;
    this.lastSnapshot = snapshot;
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.elements.clear();
    this.version = 0;
    this.lastSnapshot = null;
  }

  /**
   * Get current state version
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get element count (including deleted)
   */
  getElementCount(): number {
    return this.elements.size;
  }

  /**
   * Get visible element count
   */
  getVisibleElementCount(): number {
    return this.getVisibleElements().length;
  }

  /**
   * Check if state has changed since last snapshot
   */
  hasChangedSinceSnapshot(): boolean {
    if (!this.lastSnapshot) {
      return this.elements.size > 0;
    }
    
    return this.version > this.lastSnapshot.version;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private incrementVersion(): void {
    this.version++;
  }

  private generateVersionNonce(): number {
    return Math.floor(Math.random() * 1000000);
  }

  private resolveElementConflict(
    local: CollaborativeElement, 
    remote: CollaborativeElement
  ): ConflictResolution {
    let resolved: CollaborativeElement;
    let winner: 'local' | 'remote';
    let conflictType: 'version' | 'concurrent' | 'network';

    if (remote.version > local.version) {
      // Remote has higher version
      resolved = remote;
      winner = 'remote';
      conflictType = 'version';
    } else if (local.version > remote.version) {
      // Local has higher version
      resolved = local;
      winner = 'local';
      conflictType = 'version';
    } else {
      // Same version - use nonce for tie-breaking
      if (remote.versionNonce < local.versionNonce) {
        resolved = remote;
        winner = 'remote';
      } else {
        resolved = local;
        winner = 'local';
      }
      conflictType = 'concurrent';
    }

    return {
      resolved,
      conflictType,
      winner,
      metadata: {
        localVersion: local.version,
        remoteVersion: remote.version,
        localNonce: local.versionNonce,
        remoteNonce: remote.versionNonce,
        resolvedAt: Date.now()
      }
    };
  }

  private calculateChecksum(): string {
    // Simple checksum based on element IDs and versions
    const data = this.getElements()
      .map(el => `${el.id}:${el.version}:${el.isDeleted}`)
      .sort()
      .join('|');
    
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
}

/**
 * Factory function for creating StateManager instances
 */
export function createStateManager(): StateManager {
  return new StateManager();
}