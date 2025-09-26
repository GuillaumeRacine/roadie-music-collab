import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders, MUSIC_BASE_PATH, MUSIC_ACTIVE_YEAR } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const formData = await request.formData();
    const action = formData.get('action') as string;

    const dropboxService = new DropboxService(authTokens.access_token);

    let message = '';

    switch (action) {
      case 'move-to-uploads':
        // Move files from root to New Uploads folder
        await dropboxService.moveToUploadsFolder();
        message = 'Files moved to New Uploads folder';
        break;

      case 'organize-by-date':
        // Organize Live Recordings by date
        const liveRecordingsPath = `${MUSIC_BASE_PATH}/Live Recordings`;
        const files = await dropboxService.listFiles(liveRecordingsPath);

        for (const file of files) {
          if (file['.tag'] === 'file' && file.server_modified) {
            const date = new Date(file.server_modified);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const newPath = `${liveRecordingsPath}/${year}/${month}/${file.name}`;

            try {
              await dropboxService.moveFile(file.path_display, newPath);
            } catch (error) {
              console.error(`Failed to move ${file.name}:`, error);
            }
          }
        }
        message = 'Files organized by date';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400, headers: getCorsHeaders() }
        );
    }

    return NextResponse.json({ message }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('Error organizing files:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to organize files' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}