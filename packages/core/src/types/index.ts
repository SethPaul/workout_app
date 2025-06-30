/**
 * Core types and interfaces for the collaborative platform
 * These define the contracts between all components
 */

// ============================================================================
// ELEMENT TYPES
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export enum ElementType {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  LINE = 'line',
  ARROW = 'arrow',
  TEXT = 'text',
  IMAGE = 'image',
  FREEHAND = 'freehand',
  PATH = 'path'
}

export interface ElementStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface ElementProperties {
  position: Point;
  dimensions: Dimensions;
  rotation: number;
  style: ElementStyle;
  zIndex: number;
  // Type-specific properties
  text?: string;
  imageData?: string;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
}

export interface CollaborativeElement {
  id: string;
  type: ElementType;
  properties: ElementProperties;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  authorId: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// OPERATION TYPES
// ============================================================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BATCH = 'batch'
}

export interface BaseOperation {
  id: string;
  type: OperationType;
  authorId: string;
  timestamp: number;
  roomId: string;
}

export interface CreateOperation extends BaseOperation {
  type: OperationType.CREATE;
  element: CollaborativeElement;
}

export interface UpdateOperation extends BaseOperation {
  type: OperationType.UPDATE;
  elementId: string;
  updates: Partial<ElementProperties>;
  version: number;
  versionNonce: number;
}

export interface DeleteOperation extends BaseOperation {
  type: OperationType.DELETE;
  elementId: string;
  version: number;
  versionNonce: number;
}

export interface BatchOperation extends BaseOperation {
  type: OperationType.BATCH;
  operations: Operation[];
}

export type Operation = CreateOperation | UpdateOperation | DeleteOperation | BatchOperation;

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Participant {
  id: string;
  user: User;
  color: string;
  cursor: Point;
  isActive: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export enum PermissionLevel {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}

export interface RoomPermissions {
  [userId: string]: PermissionLevel;
}

export interface SessionSettings {
  maxParticipants: number;
  isPublic: boolean;
  allowGuests: boolean;
  autoSave: boolean;
  saveInterval: number;
}

export interface CollaborationSession {
  roomId: string;
  title: string;
  description?: string;
  ownerId: string;
  participants: Map<string, Participant>;
  permissions: RoomPermissions;
  settings: SessionSettings;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

export interface StateSnapshot {
  elements: CollaborativeElement[];
  version: number;
  timestamp: number;
  checksum?: string;
}

export interface ConflictResolution {
  resolved: CollaborativeElement;
  conflictType: 'version' | 'concurrent' | 'network';
  winner: 'local' | 'remote';
  metadata: Record<string, any>;
}

// ============================================================================
// COMMUNICATION TYPES
// ============================================================================

export enum MessageType {
  JOIN_ROOM = 'join-room',
  LEAVE_ROOM = 'leave-room',
  SYNC_OPERATION = 'sync-operation',
  BATCH_OPERATIONS = 'batch-operations',
  STATE_SYNC = 'state-sync',
  CURSOR_MOVE = 'cursor-move',
  PARTICIPANT_JOINED = 'participant-joined',
  PARTICIPANT_LEFT = 'participant-left',
  PARTICIPANT_UPDATE = 'participant-update',
  ROOM_STATE = 'room-state',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

export interface BaseMessage {
  type: MessageType;
  id: string;
  timestamp: number;
  roomId?: string;
  authorId?: string;
}

export interface JoinRoomMessage extends BaseMessage {
  type: MessageType.JOIN_ROOM;
  roomId: string;
  user: User;
  reconnection?: boolean;
}

export interface SyncOperationMessage extends BaseMessage {
  type: MessageType.SYNC_OPERATION;
  operation: Operation;
}

export interface CursorMoveMessage extends BaseMessage {
  type: MessageType.CURSOR_MOVE;
  cursor: Point;
}

export interface RoomStateMessage extends BaseMessage {
  type: MessageType.ROOM_STATE;
  state: StateSnapshot;
  participants: Participant[];
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type Message = 
  | JoinRoomMessage 
  | SyncOperationMessage 
  | CursorMoveMessage 
  | RoomStateMessage 
  | ErrorMessage
  | BaseMessage;

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

export interface IStateManager {
  getElements(): CollaborativeElement[];
  getElement(id: string): CollaborativeElement | null;
  addElement(element: CollaborativeElement): void;
  updateElement(id: string, updates: Partial<ElementProperties>): CollaborativeElement | null;
  deleteElement(id: string): CollaborativeElement | null;
  mergeState(remoteState: CollaborativeElement[]): ConflictResolution[];
  createSnapshot(): StateSnapshot;
  loadSnapshot(snapshot: StateSnapshot): void;
  clear(): void;
}

export interface IConflictResolver {
  resolveConflict(local: CollaborativeElement, remote: CollaborativeElement): ConflictResolution;
  mergeStates(localElements: CollaborativeElement[], remoteElements: CollaborativeElement[]): {
    merged: CollaborativeElement[];
    conflicts: ConflictResolution[];
  };
}

export interface ISyncEngine {
  addOperation(operation: Operation): void;
  flushOperations(): Operation[];
  setBatchInterval(intervalMs: number): void;
  start(): void;
  stop(): void;
  on(event: 'batch-ready', handler: (operations: Operation[]) => void): void;
  off(event: 'batch-ready', handler: (operations: Operation[]) => void): void;
}

export interface IConnectionManager {
  connect(url: string, options?: any): Promise<void>;
  disconnect(): void;
  send(message: Message): void;
  isConnected(): boolean;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

export interface ISessionManager {
  createSession(roomId: string, ownerId: string, settings?: Partial<SessionSettings>): CollaborationSession;
  getSession(roomId: string): CollaborationSession | null;
  joinSession(roomId: string, participant: Participant): boolean;
  leaveSession(roomId: string, participantId: string): boolean;
  updateParticipant(roomId: string, participantId: string, updates: Partial<Participant>): boolean;
  hasPermission(roomId: string, userId: string, requiredLevel: PermissionLevel): boolean;
  destroySession(roomId: string): boolean;
}

export interface IEncryptionManager {
  generateRoomKey(roomId: string): Promise<string>;
  encrypt(data: any, roomId: string): Promise<ArrayBuffer>;
  decrypt(encryptedData: ArrayBuffer, roomId: string): Promise<any>;
  hasRoomKey(roomId: string): boolean;
  removeRoomKey(roomId: string): void;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface ComponentEvents {
  // State Manager Events
  'state:element-added': [element: CollaborativeElement];
  'state:element-updated': [element: CollaborativeElement, previous: CollaborativeElement];
  'state:element-deleted': [element: CollaborativeElement];
  'state:conflict-resolved': [resolution: ConflictResolution];
  'state:snapshot-created': [snapshot: StateSnapshot];

  // Sync Engine Events
  'sync:operation-added': [operation: Operation];
  'sync:batch-ready': [operations: Operation[]];
  'sync:batch-sent': [operations: Operation[]];

  // Connection Events
  'connection:connected': [];
  'connection:disconnected': [reason?: string];
  'connection:error': [error: Error];
  'connection:message': [message: Message];

  // Session Events
  'session:created': [session: CollaborationSession];
  'session:participant-joined': [participant: Participant];
  'session:participant-left': [participantId: string];
  'session:participant-updated': [participant: Participant];
  'session:destroyed': [roomId: string];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export interface TestingHelpers {
  createMockElement(overrides?: Partial<CollaborativeElement>): CollaborativeElement;
  createMockOperation(type: OperationType, overrides?: Partial<Operation>): Operation;
  createMockParticipant(overrides?: Partial<Participant>): Participant;
  createMockSession(overrides?: Partial<CollaborationSession>): CollaborationSession;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class CollaborationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CollaborationError';
  }
}

export class StateError extends CollaborationError {
  constructor(message: string, details?: any) {
    super(message, 'STATE_ERROR', details);
    this.name = 'StateError';
  }
}

export class ConflictError extends CollaborationError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

export class ConnectionError extends CollaborationError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class SessionError extends CollaborationError {
  constructor(message: string, details?: any) {
    super(message, 'SESSION_ERROR', details);
    this.name = 'SessionError';
  }
}

export class EncryptionError extends CollaborationError {
  constructor(message: string, details?: any) {
    super(message, 'ENCRYPTION_ERROR', details);
    this.name = 'EncryptionError';
  }
}