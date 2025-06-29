# Realtime Collaborative Platform Implementation Guide

## Quick Start

This guide provides step-by-step instructions for implementing the realtime collaborative platform described in the [design documentation](./REALTIME_COLLABORATIVE_PLATFORM_DESIGN.md).

## Table of Contents

1. [Project Setup](#project-setup)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [WebSocket Integration](#websocket-integration)
5. [State Management](#state-management)
6. [Conflict Resolution](#conflict-resolution)
7. [Testing Setup](#testing-setup)
8. [Deployment Guide](#deployment-guide)

## Project Setup

### Prerequisites

- Node.js 18+ and npm/yarn
- Git for version control
- Docker (optional, for containerized deployment)
- Redis (for scaling)

### Initialize Project Structure

```bash
# Create project directory
mkdir realtime-collaboration-platform
cd realtime-collaboration-platform

# Initialize monorepo structure
mkdir -p packages/{server,client,shared}
npm init -y

# Initialize individual packages
cd packages/server && npm init -y
cd ../client && npm init -y
cd ../shared && npm init -y
```

### Package.json Configuration

**Root package.json**:
```json
{
  "name": "realtime-collaboration-platform",
  "version": "1.0.0",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm run dev --workspace=packages/server",
    "dev:client": "npm run dev --workspace=packages/client",
    "test": "npm run test --workspaces",
    "build": "npm run build --workspaces"
  },
  "devDependencies": {
    "concurrently": "^7.6.0",
    "typescript": "^4.9.4"
  }
}
```

## Backend Implementation

### Dependencies

```bash
cd packages/server
npm install express socket.io cors helmet
npm install -D @types/node @types/express ts-node nodemon
```

### Server Setup

**packages/server/src/index.ts**:
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { CollaborationServer } from './collaboration-server';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize collaboration server
const collaborationServer = new CollaborationServer(io);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Collaboration Server Implementation

**packages/server/src/collaboration-server.ts**:
```typescript
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface Room {
  id: string;
  participants: Map<string, Participant>;
  state: CollaborativeElement[];
  createdAt: Date;
}

interface Participant {
  id: string;
  socketId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
  isActive: boolean;
}

interface CollaborativeElement {
  id: string;
  type: string;
  properties: any;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  authorId: string;
  timestamp: number;
}

export class CollaborationServer {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  constructor(private io: Server) {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('join-room', (data) => {
        this.handleJoinRoom(socket, data);
      });

      socket.on('sync-operation', (data) => {
        this.handleSyncOperation(socket, data);
      });

      socket.on('cursor-move', (data) => {
        this.handleCursorMove(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleJoinRoom(socket: Socket, data: { roomId: string; user: any }) {
    const { roomId, user } = data;
    
    // Leave previous room if any
    const previousRoom = this.socketToRoom.get(socket.id);
    if (previousRoom) {
      socket.leave(previousRoom);
      this.removeParticipant(previousRoom, socket.id);
    }

    // Join new room
    socket.join(roomId);
    this.socketToRoom.set(socket.id, roomId);

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        state: [],
        createdAt: new Date()
      });
    }

    const room = this.rooms.get(roomId)!;
    
    // Add participant
    const participant: Participant = {
      id: user.id || uuidv4(),
      socketId: socket.id,
      name: user.name || 'Anonymous',
      color: user.color || this.generateRandomColor(),
      cursor: { x: 0, y: 0 },
      isActive: true
    };

    room.participants.set(participant.id, participant);

    // Send current state to new participant
    socket.emit('room-state', {
      elements: room.state,
      participants: Array.from(room.participants.values())
    });

    // Notify others about new participant
    socket.to(roomId).emit('participant-joined', participant);
  }

  private handleSyncOperation(socket: Socket, data: { operation: any }) {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const { operation } = data;
    
    // Apply operation to room state
    this.applyOperation(room, operation);

    // Broadcast to other participants
    socket.to(roomId).emit('receive-operation', { operation });
  }

  private handleCursorMove(socket: Socket, data: { cursor: { x: number; y: number } }) {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Update participant cursor
    const participant = Array.from(room.participants.values())
      .find(p => p.socketId === socket.id);
    
    if (participant) {
      participant.cursor = data.cursor;
      
      // Broadcast cursor position to others
      socket.to(roomId).emit('cursor-update', {
        participantId: participant.id,
        cursor: data.cursor
      });
    }
  }

  private handleDisconnect(socket: Socket) {
    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      this.removeParticipant(roomId, socket.id);
      this.socketToRoom.delete(socket.id);
    }
    console.log(`Client disconnected: ${socket.id}`);
  }

  private applyOperation(room: Room, operation: any) {
    switch (operation.type) {
      case 'create':
        room.state.push(operation.element);
        break;
      case 'update':
        const index = room.state.findIndex(el => el.id === operation.elementId);
        if (index !== -1) {
          room.state[index] = { ...room.state[index], ...operation.updates };
        }
        break;
      case 'delete':
        const deleteIndex = room.state.findIndex(el => el.id === operation.elementId);
        if (deleteIndex !== -1) {
          room.state[deleteIndex].isDeleted = true;
        }
        break;
    }
  }

  private removeParticipant(roomId: string, socketId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = Array.from(room.participants.values())
      .find(p => p.socketId === socketId);
    
    if (participant) {
      room.participants.delete(participant.id);
      
      // Notify others about participant leaving
      this.io.to(roomId).emit('participant-left', { participantId: participant.id });
      
      // Clean up empty rooms
      if (room.participants.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  private generateRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
```

## Frontend Implementation

### Dependencies

```bash
cd packages/client
npm install react react-dom socket.io-client
npm install -D @types/react @types/react-dom vite @vitejs/plugin-react
```

### Vite Configuration

**packages/client/vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
});
```

### Canvas Component

**packages/client/src/components/Canvas.tsx**:
```typescript
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CollaborationClient } from '../services/collaboration-client';

interface CanvasProps {
  roomId: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
}

export const Canvas: React.FC<CanvasProps> = ({ roomId, user }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collaborationClient] = useState(() => new CollaborationClient());
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth - 300; // Account for toolbar
    canvas.height = window.innerHeight - 100;

    // Initialize collaboration client
    collaborationClient.connect(roomId, user);

    // Listen for remote operations
    collaborationClient.on('receive-operation', (operation) => {
      renderOperation(ctx, operation);
    });

    collaborationClient.on('room-state', (state) => {
      renderState(ctx, state.elements);
    });

    return () => {
      collaborationClient.disconnect();
    };
  }, [roomId, user, collaborationClient]);

  const startDrawing = useCallback((e: React.MouseEvent) => {
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'brush') {
      startBrushStroke(x, y);
    } else if (tool === 'rectangle') {
      startRectangle(x, y);
    }
  }, [tool]);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'brush') {
      continueBrushStroke(x, y);
    }

    // Send cursor position
    collaborationClient.sendCursorMove({ x, y });
  }, [isDrawing, tool, collaborationClient]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    finishCurrentOperation();
  }, []);

  const startBrushStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = user.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const continueBrushStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();

    // Send drawing operation
    const operation = {
      type: 'draw',
      tool: 'brush',
      points: [{ x, y }],
      style: {
        color: user.color,
        lineWidth: 2
      },
      authorId: user.id,
      timestamp: Date.now()
    };

    collaborationClient.sendOperation(operation);
  };

  const finishCurrentOperation = () => {
    // Finalize current drawing operation
  };

  const renderOperation = (ctx: CanvasRenderingContext2D, operation: any) => {
    switch (operation.type) {
      case 'draw':
        ctx.strokeStyle = operation.style.color;
        ctx.lineWidth = operation.style.lineWidth;
        ctx.lineCap = 'round';
        
        if (operation.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(operation.points[0].x, operation.points[0].y);
          operation.points.forEach((point: any) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;
      case 'rectangle':
        ctx.strokeStyle = operation.style.color;
        ctx.lineWidth = operation.style.lineWidth;
        ctx.strokeRect(
          operation.x,
          operation.y,
          operation.width,
          operation.height
        );
        break;
    }
  };

  const renderState = (ctx: CanvasRenderingContext2D, elements: any[]) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    elements.forEach(element => {
      if (!element.isDeleted) {
        renderOperation(ctx, element);
      }
    });
  };

  return (
    <div className="canvas-container">
      <div className="toolbar">
        <button
          className={tool === 'brush' ? 'active' : ''}
          onClick={() => setTool('brush')}
        >
          Brush
        </button>
        <button
          className={tool === 'rectangle' ? 'active' : ''}
          onClick={() => setTool('rectangle')}
        >
          Rectangle
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
};
```

### Collaboration Client Service

**packages/client/src/services/collaboration-client.ts**:
```typescript
import { io, Socket } from 'socket.io-client';

export class CollaborationClient {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  connect(roomId: string, user: any) {
    this.socket = io('http://localhost:8080');

    this.socket.on('connect', () => {
      console.log('Connected to collaboration server');
      this.socket?.emit('join-room', { roomId, user });
    });

    this.socket.on('room-state', (data) => {
      this.emit('room-state', data);
    });

    this.socket.on('receive-operation', (data) => {
      this.emit('receive-operation', data.operation);
    });

    this.socket.on('participant-joined', (participant) => {
      this.emit('participant-joined', participant);
    });

    this.socket.on('participant-left', (data) => {
      this.emit('participant-left', data);
    });

    this.socket.on('cursor-update', (data) => {
      this.emit('cursor-update', data);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from collaboration server');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendOperation(operation: any) {
    if (this.socket) {
      this.socket.emit('sync-operation', { operation });
    }
  }

  sendCursorMove(cursor: { x: number; y: number }) {
    if (this.socket) {
      this.socket.emit('cursor-move', { cursor });
    }
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}
```

## WebSocket Integration

### Connection Management

**packages/client/src/hooks/useCollaboration.ts**:
```typescript
import { useEffect, useState } from 'react';
import { CollaborationClient } from '../services/collaboration-client';

export const useCollaboration = (roomId: string, user: any) => {
  const [client] = useState(() => new CollaborationClient());
  const [participants, setParticipants] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    client.connect(roomId, user);

    client.on('room-state', (state) => {
      setElements(state.elements);
      setParticipants(state.participants);
      setIsConnected(true);
    });

    client.on('receive-operation', (operation) => {
      setElements(prev => applyOperation(prev, operation));
    });

    client.on('participant-joined', (participant) => {
      setParticipants(prev => [...prev, participant]);
    });

    client.on('participant-left', (data) => {
      setParticipants(prev => 
        prev.filter(p => p.id !== data.participantId)
      );
    });

    return () => {
      client.disconnect();
    };
  }, [roomId, user, client]);

  const sendOperation = (operation: any) => {
    client.sendOperation(operation);
    // Optimistically update local state
    setElements(prev => applyOperation(prev, operation));
  };

  return {
    client,
    participants,
    elements,
    isConnected,
    sendOperation
  };
};

function applyOperation(elements: any[], operation: any): any[] {
  switch (operation.type) {
    case 'create':
      return [...elements, operation.element];
    case 'update':
      return elements.map(el => 
        el.id === operation.elementId 
          ? { ...el, ...operation.updates }
          : el
      );
    case 'delete':
      return elements.map(el => 
        el.id === operation.elementId 
          ? { ...el, isDeleted: true }
          : el
      );
    default:
      return elements;
  }
}
```

## State Management

### Element State Manager

**packages/shared/src/state-manager.ts**:
```typescript
export interface Element {
  id: string;
  type: string;
  properties: any;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  authorId: string;
  timestamp: number;
}

export class StateManager {
  private elements: Map<string, Element> = new Map();

  addElement(element: Element) {
    this.elements.set(element.id, element);
  }

  updateElement(id: string, updates: Partial<Element>) {
    const element = this.elements.get(id);
    if (element) {
      const updated = {
        ...element,
        ...updates,
        version: element.version + 1,
        versionNonce: Math.floor(Math.random() * 1000000),
        timestamp: Date.now()
      };
      this.elements.set(id, updated);
      return updated;
    }
    return null;
  }

  deleteElement(id: string) {
    const element = this.elements.get(id);
    if (element) {
      const deleted = {
        ...element,
        isDeleted: true,
        version: element.version + 1,
        versionNonce: Math.floor(Math.random() * 1000000),
        timestamp: Date.now()
      };
      this.elements.set(id, deleted);
      return deleted;
    }
    return null;
  }

  getElements(): Element[] {
    return Array.from(this.elements.values());
  }

  getVisibleElements(): Element[] {
    return this.getElements().filter(el => !el.isDeleted);
  }

  mergeElements(remoteElements: Element[]): Element[] {
    const merged = new Map<string, Element>();

    // Add all local elements
    this.elements.forEach((element, id) => {
      merged.set(id, element);
    });

    // Merge remote elements
    remoteElements.forEach(remoteElement => {
      const localElement = merged.get(remoteElement.id);
      
      if (!localElement) {
        merged.set(remoteElement.id, remoteElement);
      } else {
        // Keep element with higher version
        if (remoteElement.version > localElement.version) {
          merged.set(remoteElement.id, remoteElement);
        } else if (remoteElement.version === localElement.version) {
          // Break ties with nonce (lower nonce wins)
          if (remoteElement.versionNonce < localElement.versionNonce) {
            merged.set(remoteElement.id, remoteElement);
          }
        }
      }
    });

    // Update local state
    this.elements = merged;
    
    return this.getVisibleElements();
  }
}
```

## Conflict Resolution

### Conflict Resolution Engine

**packages/shared/src/conflict-resolver.ts**:
```typescript
export class ConflictResolver {
  static resolveConflict(local: Element, remote: Element): Element {
    // Version-based resolution
    if (remote.version > local.version) {
      return remote;
    } else if (local.version > remote.version) {
      return local;
    } else {
      // Same version - use nonce for tie-breaking
      return remote.versionNonce < local.versionNonce ? remote : local;
    }
  }

  static mergeStates(localElements: Element[], remoteElements: Element[]): Element[] {
    const elementMap = new Map<string, Element>();

    // Process all elements
    const allElements = [...localElements, ...remoteElements];
    
    allElements.forEach(element => {
      const existing = elementMap.get(element.id);
      
      if (!existing) {
        elementMap.set(element.id, element);
      } else {
        const resolved = this.resolveConflict(existing, element);
        elementMap.set(element.id, resolved);
      }
    });

    // Return sorted elements (by timestamp, then by id for consistency)
    return Array.from(elementMap.values())
      .filter(el => !el.isDeleted)
      .sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.id.localeCompare(b.id);
      });
  }

  static handleConcurrentOperations(
    operations: Array<{ element: Element; operation: string }>
  ): Element[] {
    const conflictGroups = new Map<string, Array<{ element: Element; operation: string }>>();

    // Group operations by element ID
    operations.forEach(op => {
      const id = op.element.id;
      if (!conflictGroups.has(id)) {
        conflictGroups.set(id, []);
      }
      conflictGroups.get(id)!.push(op);
    });

    const resolvedElements: Element[] = [];

    // Resolve conflicts for each element
    conflictGroups.forEach((ops, elementId) => {
      if (ops.length === 1) {
        // No conflict
        resolvedElements.push(ops[0].element);
      } else {
        // Resolve conflict
        const elements = ops.map(op => op.element);
        const resolved = elements.reduce((prev, curr) => 
          this.resolveConflict(prev, curr)
        );
        resolvedElements.push(resolved);
      }
    });

    return resolvedElements;
  }
}
```

## Testing Setup

### Unit Tests

**packages/server/src/__tests__/collaboration-server.test.ts**:
```typescript
import { CollaborationServer } from '../collaboration-server';
import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';

describe('CollaborationServer', () => {
  let server: Server;
  let collaborationServer: CollaborationServer;
  let clientSocket: any;

  beforeAll((done) => {
    const httpServer = createServer();
    server = new Server(httpServer);
    collaborationServer = new CollaborationServer(server);
    
    httpServer.listen(() => {
      const port = httpServer.address()?.port;
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.close();
  });

  test('should handle room joining', (done) => {
    clientSocket.emit('join-room', {
      roomId: 'test-room',
      user: { id: 'user1', name: 'Test User' }
    });

    clientSocket.on('room-state', (data) => {
      expect(data.participants).toHaveLength(1);
      expect(data.elements).toHaveLength(0);
      done();
    });
  });

  test('should sync operations between clients', (done) => {
    const client2 = new Client(`http://localhost:${clientSocket.io.opts.port}`);
    
    client2.on('connect', () => {
      client2.emit('join-room', {
        roomId: 'test-room',
        user: { id: 'user2', name: 'Test User 2' }
      });
    });

    client2.on('receive-operation', (data) => {
      expect(data.operation.type).toBe('create');
      expect(data.operation.element.id).toBe('test-element');
      client2.close();
      done();
    });

    clientSocket.emit('sync-operation', {
      operation: {
        type: 'create',
        element: {
          id: 'test-element',
          type: 'rectangle',
          properties: { x: 10, y: 10, width: 100, height: 100 }
        }
      }
    });
  });
});
```

### Integration Tests

**packages/client/src/__tests__/collaboration.test.tsx**:
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Canvas } from '../components/Canvas';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
  }))
}));

describe('Canvas Component', () => {
  const mockUser = {
    id: 'user1',
    name: 'Test User',
    color: '#FF0000'
  };

  test('renders canvas and toolbar', () => {
    render(<Canvas roomId="test-room" user={mockUser} />);
    
    expect(screen.getByText('Brush')).toBeInTheDocument();
    expect(screen.getByText('Rectangle')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument(); // canvas
  });

  test('switches tools when clicked', () => {
    render(<Canvas roomId="test-room" user={mockUser} />);
    
    const brushButton = screen.getByText('Brush');
    const rectangleButton = screen.getByText('Rectangle');
    
    expect(brushButton).toHaveClass('active');
    
    fireEvent.click(rectangleButton);
    expect(rectangleButton).toHaveClass('active');
    expect(brushButton).not.toHaveClass('active');
  });
});
```

## Deployment Guide

### Docker Configuration

**Dockerfile** (root):
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

# Build
RUN npm run build --workspace=packages/server

EXPOSE 8080

CMD ["npm", "start", "--workspace=packages/server"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  collaboration-server:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - collaboration-server
    restart: unless-stopped

volumes:
  redis_data:
```

### Nginx Configuration

**nginx.conf**:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream collaboration_server {
        server collaboration-server:8080;
    }

    server {
        listen 80;
        server_name your-domain.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Serve static files
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        # Proxy API requests
        location /api/ {
            proxy_pass http://collaboration_server;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Proxy WebSocket connections
        location /socket.io/ {
            proxy_pass http://collaboration_server;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Environment Configuration

**.env.production**:
```env
NODE_ENV=production
PORT=8080
REDIS_URL=redis://redis:6379
CLIENT_URL=https://your-domain.com
JWT_SECRET=your-jwt-secret-here
CORS_ORIGIN=https://your-domain.com
```

### Deployment Commands

```bash
# Build and deploy
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f collaboration-server

# Scale service
docker-compose up -d --scale collaboration-server=3

# Update deployment
docker-compose pull
docker-compose up -d --force-recreate
```

## Monitoring and Observability

### Health Checks

**packages/server/src/health.ts**:
```typescript
import { Express } from 'express';
import { Server } from 'socket.io';

export function setupHealthChecks(app: Express, io: Server) {
  app.get('/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: io.engine.clientsCount
    };
    
    res.json(health);
  });

  app.get('/metrics', (req, res) => {
    const metrics = {
      connections: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    res.json(metrics);
  });
}
```

## Next Steps

1. **Start with the basic setup** - Get the server and client running locally
2. **Test collaboration** - Open multiple browser tabs and test drawing
3. **Add more tools** - Implement additional drawing tools and features
4. **Implement security** - Add authentication and encryption
5. **Deploy to production** - Use the Docker configuration for deployment
6. **Monitor performance** - Set up monitoring and logging
7. **Scale horizontally** - Add Redis and load balancing as needed

This implementation guide provides a solid foundation for building a realtime collaborative platform. Start with the basic features and gradually add more sophisticated functionality as needed.

---

*This guide complements the [design documentation](./REALTIME_COLLABORATIVE_PLATFORM_DESIGN.md) and provides practical implementation details for getting started quickly.*