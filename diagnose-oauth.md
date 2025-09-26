# Dropbox OAuth Diagnosis Report

## Current Configuration

### Environment Variables
- **Client ID**: `pm84xrqz2ntb6sz`
- **Redirect URI**: `http://localhost:3001/api/dropbox/auth`
- **Frontend Origin**: `http://localhost:3000`

### OAuth URL Components
```
https://dropbox.com/oauth2/authorize
  ?response_type=code
  &client_id=pm84xrqz2ntb6sz
  &redirect_uri=http://localhost:3001/api/dropbox/auth
  &token_access_type=offline
```

## Common "User isn't allowed" Causes

### 1. App in Development Mode
**Check**: Is your Dropbox app in development mode?
- Go to: https://www.dropbox.com/developers/apps
- Click on your app
- Check the "Status" section
- If in development, only whitelisted emails can authenticate

**Solution**:
- Add test email addresses in the app settings
- OR switch app to production mode (requires approval)

### 2. Redirect URI Mismatch
**Check**: Does the redirect URI exactly match?
- In Dropbox App Console, check "OAuth 2" > "Redirect URIs"
- Must EXACTLY match: `http://localhost:3001/api/dropbox/auth`
- Protocol (http), domain, port, and path must all match

**Solution**:
- Add the exact URI in Dropbox app settings
- Common mistakes: https vs http, missing port, trailing slash

### 3. App Permissions
**Check**: App access type
- Full Dropbox vs App folder access
- Required scopes are configured

### 4. Testing Steps

1. **Open test page**: http://localhost:3000/test-oauth.html
2. Click "Test Backend API" - Should show auth URL
3. Click "Test Full OAuth Flow" - Opens Dropbox auth
4. Check browser console for errors

## Action Items

1. **Verify in Dropbox Console** (https://www.dropbox.com/developers/apps):
   - [ ] App is in correct mode (development/production)
   - [ ] Redirect URI is exactly: `http://localhost:3001/api/dropbox/auth`
   - [ ] Your email is in the development users list (if in dev mode)
   - [ ] App has "Full Dropbox" access type

2. **Update Configuration**:
   - [ ] If redirect URI is different, update `.env.local` NEXTAUTH_URL
   - [ ] If using https, update all references from http to https

3. **Test Flow**:
   - [ ] Use test page to verify each step
   - [ ] Check browser network tab for exact error response
   - [ ] Look for error_description parameter in redirect

## Quick Fix Checklist

```bash
# 1. Verify servers are running
lsof -i :3000 -i :3001

# 2. Test OAuth endpoint directly
curl -X POST http://localhost:3001/api/dropbox/auth \
  -H "Content-Type: application/json"

# 3. Check the auth URL works
# Copy the authUrl from above and open in browser

# 4. If still failing, check Dropbox app console for:
# - Exact redirect URI match
# - Development user whitelist
# - App status and permissions
```

## Browser Testing

Open the main app: http://localhost:3000
Open the test page: file:///Users/gui/Documents/Code/Roadie/test-oauth.html

The test page will help identify exactly where the OAuth flow is failing.