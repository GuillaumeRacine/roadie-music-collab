import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const { oldPath, newPath } = await request.json();

    if (!oldPath || !newPath) {
      return NextResponse.json(
        { error: 'oldPath and newPath are required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const dropboxService = new DropboxService(authTokens.access_token);

    // Rename the folder/file
    await dropboxService.moveFile(oldPath, newPath);

    // Log the activity
    await activityLogger.logActivity({
      action: 'rename_folder',
      filePath: newPath,
      details: {
        oldPath,
        newPath,
        type: 'folder_rename'
      }
    });

    return NextResponse.json({
      message: 'Successfully renamed',
      oldPath,
      newPath
    }, { headers: getCorsHeaders() });

  } catch (error) {
    console.error('Rename error:', error);
    return NextResponse.json(
      {
        error: 'Failed to rename',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}