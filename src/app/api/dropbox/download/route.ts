import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400, headers: getCorsHeaders() });
    }

    const dropboxService = new DropboxService(authTokens.access_token);
    const fileBuffer = await dropboxService.downloadFile(path);

    // Determine content type based on file extension
    const extension = path.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    if (extension === 'mp3') contentType = 'audio/mpeg';
    else if (extension === 'wav') contentType = 'audio/wav';
    else if (extension === 'm4a') contentType = 'audio/mp4';
    else if (extension === 'txt') contentType = 'text/plain';
    else if (extension === 'md') contentType = 'text/markdown';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
      ...getCorsHeaders()
    };

    return new NextResponse(fileBuffer, { headers });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to download file' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}