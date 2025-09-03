# Roadie - Music Collaboration Hub

A full-stack application for organizing, sharing, and collaborating on music ideas and lyrics with your band through Dropbox integration. This is the main backend API server.

## Architecture

- **Backend API** (`/src`): Next.js API routes for Dropbox integration and file management (runs on port 3001)
- **Frontend Client** (`/music-collab`): Standalone Next.js frontend that connects to this backend (runs on port 3000)

## Features

- **Dropbox Integration**: Connect your Dropbox account to manage music files
- **File Organization**: Automatically categorize and organize music files, lyrics, and recordings
- **File Upload**: Upload audio files, lyrics, and other music-related documents
- **Smart File Detection**: Automatically detect and display appropriate icons for different file types
- **Band Collaboration**: Share and organize files for seamless collaboration

## Getting Started

### Prerequisites

1. A Dropbox account
2. Dropbox App credentials (Client ID and Client Secret)

### Setup

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Create a Dropbox App:**
   - Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
   - Create a new app with "Full Dropbox" access
   - Note your App key and App secret

3. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Update `.env.local` with your credentials:
   ```
   DROPBOX_CLIENT_ID=your_app_key_here
   DROPBOX_CLIENT_SECRET=your_app_secret_here
   NEXTAUTH_SECRET=your_random_secret_here
   NEXTAUTH_URL=http://localhost:3001
   ```

4. **Configure Dropbox App Settings:**
   - Add `http://localhost:3001/api/dropbox/auth` to your app's redirect URIs

5. **Run both backend and frontend:**
   ```bash
   npm run dev
   ```
   - Backend API will be available at [http://localhost:3001](http://localhost:3001)
   - Frontend UI will be available at [http://localhost:3000](http://localhost:3000)

## Usage

1. **Connect Dropbox**: Click "Connect Dropbox" on the home page
2. **Authorize**: Complete the Dropbox OAuth flow
3. **Manage Files**: Upload, organize, and browse your music files
4. **Collaborate**: Share the application with band members using their own Dropbox accounts

## File Types Supported

- **Audio Files**: .mp3, .wav, .m4a, .aac, .ogg, .flac
- **Lyrics/Text**: .txt, .md, .lyrics
- **All other file types** are supported for general storage

## Future Features (Planned)

- **Voice Memo Analysis**: Transcription and musical analysis
- **iCloud Integration**: Automatic sync from iCloud to Dropbox
- **Audio Processing**: Key detection, tempo analysis, chord recognition
- **Collaboration Tools**: Comments, version control, shared workspaces

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui components
- **API Integration**: Dropbox API v2
- **Deployment Ready**: Vercel, Netlify, or any Node.js hosting

## Development

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Contributing

This is currently a prototype for personal/band use. Feel free to fork and adapt for your own needs.

## License

MIT License - feel free to use and modify for your own projects.