#!/bin/bash

# Setup script for local MCP development environment
# This script helps you set up environment variables for MCP servers

echo "🔧 Setting up local MCP environment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your GitHub Personal Access Token"
    echo "   Required scopes: read:packages, repo"
    echo ""
    echo "   Example:"
    echo "   GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_xxxxxxxxxxxxxx"
    echo ""
    echo "🛑 Please edit .env file before continuing!"
    exit 1
fi

# Source environment variables
echo "📂 Loading environment variables from .env..."
set -a  # automatically export all variables
source .env
set +a

# Verify required environment variables
if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ] || [ "$GITHUB_PERSONAL_ACCESS_TOKEN" = "your_github_pat_here" ]; then
    echo "❌ GITHUB_PERSONAL_ACCESS_TOKEN not set properly in .env file"
    echo "   Please edit .env file and add your actual GitHub Personal Access Token"
    exit 1
fi

echo "✅ Environment variables loaded successfully!"
echo "🚀 You can now start Cursor and the MCP servers will have access to your GitHub token"
echo ""
echo "💡 To use this environment:"
echo "   1. Run: source setup_local_env.sh"
echo "   2. Then start Cursor from this terminal: cursor ."
echo "   3. Or export the environment in your shell profile" 