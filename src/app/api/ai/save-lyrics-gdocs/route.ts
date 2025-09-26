import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { GoogleDriveService } from '@/lib/google-drive';
import { activityLogger } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  try {
    const { lyrics, songTitle, style, mood } = await request.json();

    if (!lyrics) {
      return NextResponse.json({ error: 'Lyrics content is required' }, { status: 400, headers: getCorsHeaders() });
    }

    // Check if user is authenticated (optional - you might want to allow anonymous saves)
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    // Check if Google service account key is configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({
        error: 'Google Drive integration not configured',
        details: 'GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set'
      }, { status: 500, headers: getCorsHeaders() });
    }

    // Initialize Google Drive service
    const googleDriveService = new GoogleDriveService({
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    });

    // Find or create the Lyrics folder
    const lyricsFolderId = await googleDriveService.findOrCreateLyricsFolder();

    // Generate base title with date and song name
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const songName = songTitle || 'Untitled Song';
    const baseTitle = `${dateStr} - ${songName}`;

    // Get existing documents to check for conflicts
    const existingDocs = await googleDriveService.listDocumentsInFolder(lyricsFolderId, dateStr);
    const existingTitles = existingDocs.map(doc => doc.name);

    // Generate unique title
    const uniqueTitle = googleDriveService.generateUniqueTitle(baseTitle, existingTitles);

    // Format lyrics for Google Docs
    const formattedLyrics = GoogleDriveService.formatLyricsForGoogleDocs(lyrics, songName, style, mood);

    // Create the Google Doc
    const docResult = await googleDriveService.createDocument(
      uniqueTitle,
      formattedLyrics,
      lyricsFolderId
    );

    // Log the activity
    await activityLogger.logActivity({
      action: 'create_lyrics_doc',
      filePath: docResult.url,
      details: {
        documentId: docResult.id,
        title: uniqueTitle,
        songTitle: songName,
        style,
        mood,
        platform: 'google_docs'
      }
    });

    return NextResponse.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.url,
      title: uniqueTitle,
      message: `Lyrics saved to Google Docs: ${uniqueTitle}`
    }, { headers: getCorsHeaders() });

  } catch (error) {
    console.error('Google Docs save error:', error);

    // Handle specific Google API errors
    if (error instanceof Error) {
      if (error.message.includes('invalid_grant')) {
        return NextResponse.json({
          error: 'Google authentication failed',
          details: 'Service account credentials may be invalid or expired'
        }, { status: 500, headers: getCorsHeaders() });
      }

      if (error.message.includes('insufficient permissions')) {
        return NextResponse.json({
          error: 'Insufficient Google Drive permissions',
          details: 'Service account needs Drive and Docs API access'
        }, { status: 500, headers: getCorsHeaders() });
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to save lyrics to Google Docs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}