#!/bin/bash

# Script to run Flutter app with MCP-compatible debugging flags
# This enables the Flutter MCP server to connect to your app

echo "🚀 Starting Flutter app with MCP debugging support..."
echo "📱 This will enable AI assistants to inspect and debug your app"
echo ""

# Run Flutter with MCP-compatible flags
snap run flutter run \
  --debug \
  --host-vmservice-port=8182 \
  --dds-port=8181 \
  --enable-vm-service \
  --disable-service-auth-codes

echo ""
echo "✅ Flutter app started with MCP support!"
echo "🔗 VM Service available on port 8181"
echo "🔗 Host VM Service available on port 8182"
echo ""
echo "💡 Now you can use AI assistants to:"
echo "   • Take screenshots of your app"
echo "   • Get error information"
echo "   • Inspect widget tree"
echo "   • Debug performance issues"
echo "   • And much more!" 