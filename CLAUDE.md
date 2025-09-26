# Roadie - Development Setup Guide

## Environment Variables (.env.local)

This project requires the following environment variables to be set in a `.env.local` file at the root:

```env
# Dropbox OAuth Configuration
DROPBOX_CLIENT_ID=your_dropbox_client_id
DROPBOX_CLIENT_SECRET=your_dropbox_client_secret

# Authentication
NEXTAUTH_SECRET=your_random_secret_key
NEXTAUTH_URL=http://localhost:3001

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Google Drive API (for lyrics saving to Google Docs)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Application Configuration
FRONTEND_ORIGIN=http://localhost:3000
MUSIC_BASE_PATH=/Music/Fiasco Total
MUSIC_ACTIVE_YEAR=2025
```

## Architecture

This project has two separate Next.js applications:

1. **Backend API** (Port 3001): Main application with API routes
   - Location: `/src`
   - Handles Dropbox OAuth, file operations, AI features
   - Run with: `npm run dev:backend`

2. **Frontend Client** (Port 3000): Frontend UI application
   - Location: `/music-collab`
   - Connects to backend API for all operations
   - Run with: `npm run dev:frontend`

## Development Commands

```bash
# Install all dependencies (both apps)
npm run install:all

# Run both backend and frontend
npm run dev

# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend

# Clean start (free ports and restart)
npm run dev:clean

# Build both applications
npm run build

# Lint both applications
npm run lint
```

## Dropbox Setup

1. Create a Dropbox App at https://www.dropbox.com/developers/apps
2. Choose "Full Dropbox" access
3. Add redirect URI: `http://localhost:3001/api/dropbox/auth`
4. Copy App key and App secret to `.env.local`

## Google Drive Setup (for Lyrics to Google Docs)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google Drive API and Google Docs API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it
   - Search for "Google Docs API" and enable it
4. Create Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in service account details
   - Click "Create and Continue"
5. Generate Service Account Key:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format and download
6. Add the entire JSON content as `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env.local`
7. Optional: Share a Google Drive folder with the service account email for organized storage

## API Endpoints

### Dropbox Routes
- `POST /api/dropbox/auth` - Initiate OAuth flow
- `GET /api/dropbox/auth` - OAuth callback
- `GET /api/dropbox/files` - List files
- `POST /api/dropbox/files` - Upload file
- `GET /api/dropbox/download` - Download file
- `GET /api/dropbox/preview` - Get preview URL
- `POST /api/dropbox/organize` - Organize files
- `POST /api/dropbox/smart-organize` - Smart file grouping

### AI Routes
- `POST /api/ai/chat` - AI chat assistant
- `GET/POST /api/ai/settings` - Robot configuration
- `POST /api/ai/file-operations` - File operation execution
- `POST /api/ai/create-lyrics` - Generate lyrics
- `POST /api/ai/save-lyrics-gdocs` - Save lyrics to Google Docs
- `POST /api/audio-analysis` - Analyze audio files

### Authentication Routes
- `POST /api/auth/logout` - Clear session

## Key Libraries

- **Next.js 15.5.2** - Full-stack React framework
- **Dropbox SDK** - Dropbox API integration
- **OpenAI SDK** - GPT integration for AI features
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - UI components
- **isomorphic-fetch** - Required for Dropbox OAuth

## Common Issues

### "Unexpected token '<'" Error
This usually means the backend API is returning HTML instead of JSON. Check:
1. Backend server is running on port 3001
2. Environment variables are loaded
3. API routes are properly created

### OAuth Failed Error
Check:
1. Dropbox credentials in `.env.local`
2. Redirect URI matches Dropbox app settings
3. `isomorphic-fetch` is installed
4. Backend server has `.env.local` loaded

### CORS Issues
The backend automatically sets CORS headers for the frontend origin.
Default: `http://localhost:3000`

## Project Structure

```
/
├── src/                    # Backend API
│   ├── app/
│   │   ├── api/           # API routes
│   │   └── page.tsx       # Backend homepage
│   ├── lib/               # Utility functions
│   └── components/        # Backend components
├── music-collab/          # Frontend application
│   └── src/
│       ├── app/           # Frontend pages
│       ├── components/    # Frontend components
│       └── lib/           # Frontend utilities
├── .env.local             # Environment variables
└── package.json           # Root dependencies
```

## Testing

To test if everything is working:

1. Start both servers: `npm run dev`
2. Navigate to http://localhost:3000
3. Click "Connect Dropbox"
4. Complete OAuth flow
5. You should be redirected to the dashboard

## Notes for AI Assistants

### Environment and Architecture
- Always check if environment variables are properly set in `.env.local`
- The backend runs on port 3001, frontend on 3000
- Use `apiUrl()` helper in frontend for API calls
- Session cookies use the prefix `roadie_`
- The Dropbox SDK requires `isomorphic-fetch` for Node.js
- When creating new API routes, always include CORS headers using `getCorsHeaders()`

### File Organization System
- **Date Format**: Use dots for date folders (e.g., `2025.03.19`, `2025.09.25`)
- **Folder Structure**: Files are organized as `/Live Recordings/YEAR/YYYY.MM.DD/`
- **Audio Processing**: Files automatically get date prefixes (e.g., `20250925_filename.mp3`)
- **Smart Organization**: The `process-uploads` route organizes files by type:
  - Audio files → Live Recordings with date clustering
  - Lyrics → Lyrics folder
  - Sheet music → Sheet Music folder
  - Media files → Media folder

### Key API Endpoints and Functions
- `POST /api/dropbox/process-uploads` - Organizes files from New Uploads folder
- `POST /api/dropbox/migrate-2025-files` - One-time migration script (if needed)
- `findOrCreateDateFolder()` - Creates date-based folders in the correct format
- `extractDateFromFilename()` - Extracts dates from filenames in multiple formats

### Development Commands
- `npm run dev` - Start both frontend and backend
- `npm run dev:clean` - Kill ports and restart servers
- `npm run lint` - Run linting on both applications
- `npm run build` - Build both applications for production

### Code Style Guidelines
- Use shadcn/ui components for consistent styling
- Follow the retro game theme: `bg-gradient-to-br from-blue-50 to-indigo-100`
- Use music emojis from dashboard: 🎵 🎧 🎶 🎼
- Implement proper error handling and loading states
- Always use TypeScript interfaces for data structures

### Testing and Deployment
- Test file organization with actual Dropbox files
- Ensure authentication flow works end-to-end
- Verify CORS headers are present for frontend communication
- Check that date formatting is consistent across all operations

### Troubleshooting Common Issues
1. **Authentication Errors**: Check Dropbox credentials and OAuth redirect URIs
2. **File Organization**: Ensure date format uses dots (YYYY.MM.DD)
3. **API Errors**: Verify CORS headers and environment variables
4. **Build Issues**: Run `npm run lint` and fix any TypeScript errors