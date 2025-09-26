import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';

// GET: List files
export async function GET(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || '';

    const dropboxService = new DropboxService(authTokens.access_token);
    const files = await dropboxService.listFiles(path);

    return NextResponse.json({ files }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      {
        error: error.error?.error_summary || error.message || 'Failed to list files',
        details: error.error || error
      },
      { status: error.status || 500, headers: getCorsHeaders() }
    );
  }
}

// POST: Upload file
export async function POST(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file || !path) {
      return NextResponse.json({ error: 'File and path are required' }, { status: 400, headers: getCorsHeaders() });
    }

    const dropboxService = new DropboxService(authTokens.access_token);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await dropboxService.uploadFile(path, buffer);

    return NextResponse.json({ success: true, file: result }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}