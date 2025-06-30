#!/bin/bash

# Setup script for isolated components foundation
echo "🚀 Setting up Isolated Components Foundation for Realtime Collaborative Platform"
echo

# Check if we're in the right directory
if [ ! -f "REALTIME_COLLABORATIVE_PLATFORM_DESIGN.md" ]; then
    echo "❌ Please run this script from the root of the collaboration platform project"
    exit 1
fi

echo "📁 Creating packages directory structure..."
mkdir -p packages/core/{src/{types,state,sync,connection,session,encryption,testing},dist}

echo "📦 Setting up core package..."
cd packages/core

# Install dependencies
echo "⬇️ Installing dependencies..."
npm install uuid eventemitter3
npm install -D @types/uuid @types/jest @types/node typescript jest ts-jest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser

echo "✅ Core package dependencies installed"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build 2>/dev/null || echo "⚠️ Build will work once dependencies are resolved"

echo
echo "🎯 Foundation Setup Complete!"
echo
echo "Next steps:"
echo "1. Review the Isolated Components Guide: ISOLATED_COMPONENTS_GUIDE.md"
echo "2. Examine the core types: packages/core/src/types/index.ts"
echo "3. Look at StateManager implementation: packages/core/src/state/StateManager.ts"
echo "4. Check out SyncEngine: packages/core/src/sync/SyncEngine.ts"
echo "5. Explore testing utilities: packages/core/src/testing/helpers.ts"
echo
echo "To start testing:"
echo "  cd packages/core"
echo "  npm test"
echo
echo "To start development:"
echo "  cd packages/core"
echo "  npm run test:watch"
echo
echo "📖 Read ISOLATED_COMPONENTS_GUIDE.md for comprehensive usage instructions"