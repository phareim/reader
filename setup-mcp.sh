#!/bin/bash

# The Librarian MCP Setup Script
# Automatically configures Claude Desktop to connect to your Reader instance

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}The Librarian MCP Setup${NC}"
echo "================================"
echo ""

# Parse command line arguments
TOKEN=""
API_URL=""
REPO_PATH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --repo-path)
      REPO_PATH="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 --token YOUR_TOKEN [--api-url URL] [--repo-path PATH]"
      exit 1
      ;;
  esac
done

# Auto-detect repository path if not provided
if [ -z "$REPO_PATH" ]; then
  REPO_PATH="$(cd "$(dirname "$0")" && pwd)"
  echo -e "${BLUE}Auto-detected repository path:${NC} $REPO_PATH"
fi

# Verify repository path
if [ ! -f "$REPO_PATH/mcp-server/index.ts" ]; then
  echo -e "${RED}Error: MCP server not found at $REPO_PATH/mcp-server/index.ts${NC}"
  echo "Please run this script from the Reader repository root, or specify --repo-path"
  exit 1
fi

# Verify tsx is installed
if [ ! -f "$REPO_PATH/node_modules/.bin/tsx" ]; then
  echo -e "${YELLOW}tsx not found. Running npm install...${NC}"
  cd "$REPO_PATH"
  npm install
fi

# Prompt for token if not provided
if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}Please enter your MCP token from the settings page:${NC}"
  echo "(Visit your Reader at /mcp-settings to generate a token)"
  read -s TOKEN
  echo ""
fi

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Error: Token is required${NC}"
  exit 1
fi

# Set default API URL if not provided
if [ -z "$API_URL" ]; then
  API_URL="https://reader.phareim.no"
  echo -e "${BLUE}Using default API URL:${NC} $API_URL"
fi

# Auto-detect Claude Desktop config location
if [[ "$OSTYPE" == "darwin"* ]]; then
  CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_DIR="$HOME/.config/Claude"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  CONFIG_DIR="$APPDATA/Claude"
else
  echo -e "${RED}Unsupported operating system: $OSTYPE${NC}"
  exit 1
fi

CONFIG_PATH="$CONFIG_DIR/claude_desktop_config.json"

echo -e "${BLUE}Claude Desktop config:${NC} $CONFIG_PATH"

# Create config directory if it doesn't exist
if [ ! -d "$CONFIG_DIR" ]; then
  echo -e "${YELLOW}Creating config directory: $CONFIG_DIR${NC}"
  mkdir -p "$CONFIG_DIR"
fi

# Backup existing config if it exists
if [ -f "$CONFIG_PATH" ]; then
  BACKUP_PATH="$CONFIG_PATH.backup.$(date +%Y%m%d_%H%M%S)"
  echo -e "${YELLOW}Backing up existing config to:${NC} $BACKUP_PATH"
  cp "$CONFIG_PATH" "$BACKUP_PATH"
fi

# Create or update the configuration using Node.js
echo -e "${BLUE}Updating Claude Desktop configuration...${NC}"

node -e "
const fs = require('fs');
const configPath = '$CONFIG_PATH';

// Read existing config or create new one
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Warning: Could not parse existing config, creating new one');
  }
}

// Ensure mcpServers exists
if (!config.mcpServers) {
  config.mcpServers = {};
}

// Add or update the-librarian server
config.mcpServers['the-librarian'] = {
  command: 'node',
  args: [
    '$REPO_PATH/node_modules/.bin/tsx',
    '$REPO_PATH/mcp-server/index.ts'
  ],
  env: {
    READER_API_URL: '$API_URL',
    MCP_TOKEN: '$TOKEN'
  }
};

// Write the updated config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('${GREEN}✓ Configuration updated successfully${NC}');
"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Setup complete!${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "1. Completely quit Claude Desktop if it's running"
  echo "2. Restart Claude Desktop"
  echo "3. Look for the 🔌 icon to verify the connection"
  echo "4. Try asking Claude: 'What are my recent articles?'"
  echo ""
  echo -e "${YELLOW}Note:${NC} Your Reader app must be running for the MCP server to work."
  echo "      Start it with: cd $REPO_PATH && npm run dev"
else
  echo -e "${RED}Error: Failed to update configuration${NC}"
  exit 1
fi
