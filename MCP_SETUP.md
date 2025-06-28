# MCP Server Setup Guide

This guide helps you set up the GitHub MCP server to work both locally and with Cursor background agents.

## Overview

The GitHub MCP server configuration has been updated to use environment variables instead of hardcoded tokens, making it safe to commit to version control while still working in both local and cloud environments.

## Setup for Local Development

### 1. Initial Setup

```bash
# Run the setup script to create your local environment
./setup_local_env.sh
```

This will:
- Create a `.env` file from the template if it doesn't exist
- Prompt you to add your GitHub Personal Access Token

### 2. Edit Your Environment File

Edit the `.env` file and replace `your_github_pat_here` with your actual GitHub Personal Access Token:

```bash
# Example .env content
GITHUB_PERSONAL_ACCESS_TOKEN=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
```

### 3. Required GitHub Token Scopes

Your GitHub Personal Access Token needs at least these scopes:
- `read:packages` - To pull the GitHub MCP server Docker image
- `repo` - For repository access
- Add other scopes based on what GitHub actions you want to perform

### 4. Starting Cursor with Environment Variables

Option A - Use the setup script:
```bash
# Source the environment and start Cursor
source setup_local_env.sh
cursor .
```

Option B - Add to your shell profile:
```bash
# Add to ~/.bashrc or ~/.zshrc
export GITHUB_PERSONAL_ACCESS_TOKEN="your_token_here"
```

## How It Works

### Local Environment
- The `.cursor/mcp.json` file references `${GITHUB_PERSONAL_ACCESS_TOKEN}` 
- Your local environment provides this variable through the `.env` file
- The Docker container gets the token through environment variable injection

### Cursor Background Agents
- Background agents have access to the token through their secrets system
- The same environment variable reference in `mcp.json` works automatically
- No additional configuration needed on the agent side

## Security Notes

- ✅ `.env` file is already in `.gitignore` - your tokens won't be committed
- ✅ `mcp.json` only contains variable references, not actual tokens
- ✅ Background agents use secure secret storage
- ✅ Local development uses environment variables

## Troubleshooting

### Token Issues
- Verify your token has the required scopes
- Check that the environment variable is properly set: `echo $GITHUB_PERSONAL_ACCESS_TOKEN`

### Docker Issues
- Ensure Docker is running
- Verify the MCP server can pull the GitHub MCP image

### MCP Connection Issues
- Restart Cursor after setting up the environment
- Check that the GitHub MCP server appears in the available tools list

## Available GitHub MCP Actions

Once set up, you can use Copilot Chat to:
- Create and manage issues
- List and review pull requests
- Search repositories and code
- Manage branches and commits
- Review repository information
- And much more!

Access these through Copilot Chat by selecting the Agent mode and using the GitHub MCP tools. 