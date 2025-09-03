# Music Collaboration Hub - Frontend

This is the frontend client for the Roadie Music Collaboration Hub. It's a Next.js application that provides the user interface for managing music files through the Roadie backend API.

## Architecture

This frontend is designed to be a separate client that communicates with the main Roadie backend API server running on port 3000.

## Getting Started

### Prerequisites

Make sure the main Roadie backend is running on `http://localhost:3000` before starting this frontend.

### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables (optional):**
   ```bash
   cp .env.local.example .env.local
   ```
   
   The default configuration points to `http://localhost:3000` for the backend API. Modify if needed:
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
   ```

3. **Run the frontend development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3001](http://localhost:3001)

## Features

- **Dropbox Connection**: Connect to Dropbox through the backend API
- **File Management**: Browse, upload, and organize music files
- **File Organization**: Smart categorization of audio files, lyrics, and recordings
- **Real-time Updates**: Live file listing and organization feedback

## Development

```bash
npm run dev       # Start development server on port 3001
npm run build     # Build for production
npm run start     # Start production server on port 3001
npm run lint      # Run ESLint
```

## API Communication

This frontend communicates with the Roadie backend API using the following endpoints:
- `/api/dropbox/auth` - Dropbox authentication
- `/api/dropbox/files` - File operations (list, upload, download)
- `/api/dropbox/organize` - File organization tools

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui components
- **State Management**: React hooks and local storage
- **API Communication**: Fetch API

## Contributing

This frontend is designed to be a clean, focused client for the Roadie backend. When adding new features, ensure they communicate properly with the backend API and follow the existing patterns for error handling and user feedback.
