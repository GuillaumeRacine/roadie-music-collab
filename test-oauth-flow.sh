#!/bin/bash

echo "============================================"
echo "Testing Dropbox OAuth Flow"
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${YELLOW}Step 1: Testing OAuth endpoint${NC}"
echo "----------------------------------------"

# Get the OAuth URL
response=$(curl -s -X POST http://localhost:3001/api/dropbox/auth -H "Content-Type: application/json")
auth_url=$(echo $response | grep -o '"authUrl":"[^"]*' | cut -d'"' -f4)

if [ -n "$auth_url" ]; then
    echo -e "${GREEN}✓ OAuth URL generated successfully${NC}"
    echo ""
    echo "Auth URL: $auth_url"
    echo ""

    # Parse the URL components
    echo -e "${YELLOW}OAuth URL Components:${NC}"
    echo "----------------------------------------"
    echo "Client ID: $(echo $auth_url | grep -o 'client_id=[^&]*' | cut -d'=' -f2)"
    echo "Redirect URI: $(echo $auth_url | grep -o 'redirect_uri=[^&]*' | cut -d'=' -f2 | sed 's/%3A/:/g' | sed 's/%2F/\//g')"
    echo "Response Type: $(echo $auth_url | grep -o 'response_type=[^&]*' | cut -d'=' -f2)"
    echo "Token Access Type: $(echo $auth_url | grep -o 'token_access_type=[^&]*' | cut -d'=' -f2)"
else
    echo -e "${RED}✗ Failed to generate OAuth URL${NC}"
    echo "Response: $response"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Opening OAuth Flow${NC}"
echo "----------------------------------------"
echo "To complete the OAuth flow:"
echo ""
echo "1. Open this URL in your browser:"
echo "   $auth_url"
echo ""
echo "2. Log in to Dropbox and authorize the app"
echo ""
echo "3. You should be redirected to:"
echo "   http://localhost:3001/api/dropbox/auth?code=..."
echo ""
echo "4. Which should then redirect to:"
echo "   http://localhost:3000/dashboard"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "----------------------------------------"
echo "If you see 'User isn't allowed' error:"
echo ""
echo "1. Go to: https://www.dropbox.com/developers/apps"
echo "2. Click on your app (Client ID: pm84xrqz2ntb6sz)"
echo "3. Check these settings:"
echo "   - Status: Development or Production?"
echo "   - OAuth 2 > Redirect URIs: Must include"
echo "     http://localhost:3001/api/dropbox/auth"
echo "   - Development users: Your email must be listed"
echo "   - Permission type: Full Dropbox access"
echo ""
echo "Would you like to open the OAuth URL now? (y/n)"
read -r answer

if [ "$answer" = "y" ]; then
    open "$auth_url"
    echo ""
    echo -e "${GREEN}OAuth URL opened in browser${NC}"
    echo "Check the browser for any error messages"
fi

echo ""
echo "============================================"
echo "Test complete"
echo "============================================"