import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  ISyncEngine,
  Operation,
  ComponentEvents
} from '../types';

/**
 * SyncEngine - Isolated component for batching and synchronizing operations
 * 
 * Responsibilities:
 * - Batch operations for efficient network transmission
 * - Manage synchronization timing and intervals
 * - Provide operation queuing and flushing
 * - Emit sync events for coordination
 * 
 * This component is fully isolated and testable without dependencies
 */
export class SyncEngine extends EventEmitter<ComponentEvents> implements ISyncEngine {
  private operationQueue: Operation[] = [];
  private batchInterval: number = 16; // ~60fps
  private batchTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private maxBatchSize: number = 100;
  private lastFlushTime: number = 0;

  constructor(options: {
    batchInterval?: number;
    maxBatchSize?: number;
  } = {}) {
    super();
    
    this.batchInterval = options.batchInterval ?? this.batchInterval;
    this.maxBatchSize = options.maxBatchSize ?? this.maxBatchSize;
  }

  /**
   * Add an operation to the batch queue
   */
  addOperation(operation: Operation): void {
    this.operationQueue.push(operation);
    this.emit('sync:operation-added', operation);
    
    // Force flush if queue is getting too large
    if (this.operationQueue.length >= this.maxBatchSize) {
      this.forceFlush();
    } else if (this.isRunning && !this.batchTimer) {
      this.scheduleBatch();
    }
  }

  /**
   * Flush and return all queued operations
   */
  flushOperations(): Operation[] {
    const operations = [...this.operationQueue];
    this.operationQueue = [];
    this.lastFlushTime = Date.now();
    
    if (operations.length > 0) {
      this.emit('sync:batch-ready', operations);
    }
    
    return operations;
  }

  /**
   * Set the batch interval in milliseconds
   */
  setBatchInterval(intervalMs: number): void {
    if (intervalMs < 1) {
      throw new Error('Batch interval must be at least 1ms');
    }
    
    this.batchInterval = intervalMs;
    
    // Restart timer if running
    if (this.isRunning && this.batchTimer) {
      this.clearBatchTimer();
      this.scheduleBatch();
    }
  }

  /**
   * Set the maximum batch size
   */
  setMaxBatchSize(size: number): void {
    if (size < 1) {
      throw new Error('Max batch size must be at least 1');
    }
    
    this.maxBatchSize = size;
  }

  /**
   * Start the sync engine
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    // If there are pending operations, schedule a batch
    if (this.operationQueue.length > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Stop the sync engine
   */
  stop(): void {
    this.isRunning = false;
    this.clearBatchTimer();
  }

  /**
   * Force immediate flush of operations
   */
  forceFlush(): void {
    this.clearBatchTimer();
    this.flushOperations();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.operationQueue.length;
  }

  /**
   * Get batch interval
   */
  getBatchInterval(): number {
    return this.batchInterval;
  }

  /**
   * Get max batch size
   */
  getMaxBatchSize(): number {
    return this.maxBatchSize;
  }

  /**
   * Check if engine is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get time since last flush
   */
  getTimeSinceLastFlush(): number {
    return Date.now() - this.lastFlushTime;
  }

  /**
   * Check if there are pending operations
   */
  hasPendingOperations(): boolean {
    return this.operationQueue.length > 0;
  }

  /**
   * Clear all pending operations without flushing
   */
  clearQueue(): void {
    this.operationQueue = [];
    this.clearBatchTimer();
  }

  /**
   * Get statistics about the sync engine
   */
  getStats(): {
    queueSize: number;
    isRunning: boolean;
    batchInterval: number;
    maxBatchSize: number;
    timeSinceLastFlush: number;
    hasPendingOperations: boolean;
  } {
    return {
      queueSize: this.getQueueSize(),
      isRunning: this.isRunning,
      batchInterval: this.batchInterval,
      maxBatchSize: this.maxBatchSize,
      timeSinceLastFlush: this.getTimeSinceLastFlush(),
      hasPendingOperations: this.hasPendingOperations()
    };
  }

  // ============================================================================
  // EVENT HANDLER OVERRIDES
  // ============================================================================

  /**
   * Override to provide type-safe event handling
   */
  on(event: 'batch-ready', handler: (operations: Operation[]) => void): this;
  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler);
  }

  /**
   * Override to provide type-safe event handling
   */
  off(event: 'batch-ready', handler: (operations: Operation[]) => void): this;
  off(event: string, handler: (...args: any[]) => void): this {
    return super.off(event, handler);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private scheduleBatch(): void {
    if (!this.isRunning || this.batchTimer) {
      return;
    }
    
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushOperations();
    }, this.batchInterval);
  }

  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.clearQueue();
    this.removeAllListeners();
  }
}

/**
 * Factory function for creating SyncEngine instances
 */
export function createSyncEngine(options?: {
  batchInterval?: number;
  maxBatchSize?: number;
}): SyncEngine {
  return new SyncEngine(options);
}

/**
 * Utility functions for operation management
 */
export const SyncUtils = {
  /**
   * Calculate optimal batch interval based on operation frequency
   */
  calculateOptimalInterval(operationsPerSecond: number): number {
    // Aim for 10-20 operations per batch
    const targetOpsPerBatch = 15;
    const intervalMs = (targetOpsPerBatch / operationsPerSecond) * 1000;
    
    // Clamp between 16ms (60fps) and 1000ms (1 second)
    return Math.max(16, Math.min(1000, intervalMs));
  },

  /**
   * Calculate optimal batch size based on operation complexity
   */
  calculateOptimalBatchSize(averageOperationSize: number): number {
    // Aim for ~64KB batches for good network efficiency
    const targetBatchSize = 64 * 1024; // 64KB
    const opsPerBatch = Math.floor(targetBatchSize / averageOperationSize);
    
    // Clamp between 10 and 500 operations
    return Math.max(10, Math.min(500, opsPerBatch));
  },

  /**
   * Merge consecutive operations on the same element
   */
  mergeOperations(operations: Operation[]): Operation[] {
    if (operations.length === 0) {
      return [];
    }

    // Group operations by element ID
    const grouped = new Map<string, Operation[]>();
    
    for (const op of operations) {
      if (op.type === 'UPDATE') {
        const key = `${op.roomId}:${(op as any).elementId}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(op);
      }
    }

    // Merge update operations for same element
    const merged: Operation[] = [];
    const processed = new Set<string>();

    for (const op of operations) {
      if (op.type === 'UPDATE') {
        const key = `${op.roomId}:${(op as any).elementId}`;
        if (processed.has(key)) {
          continue; // Already processed
        }
        
        const elementOps = grouped.get(key) || [];
        if (elementOps.length > 1) {
          // Merge multiple updates into single operation
          const latestOp = elementOps[elementOps.length - 1];
          merged.push(latestOp);
        } else {
          merged.push(op);
        }
        processed.add(key);
      } else {
        merged.push(op);
      }
    }

    return merged;
  }
};