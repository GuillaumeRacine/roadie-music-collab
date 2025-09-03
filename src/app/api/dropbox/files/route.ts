import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { ensureAccessToken } from '@/lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessTokenFromQuery = searchParams.get('token');
  const path = searchParams.get('path') || '';

  console.log('API: Listing files for path:', path);

  // Try cookie-based session first
  const ensured = await ensureAccessToken(request);
  const accessToken = ensured?.accessToken || accessTokenFromQuery;
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401, headers: getCorsHeaders() });
  }

  try {
    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const files = await dropboxService.listFiles(path);
    console.log(`API: Found ${files.length} files/folders`);
    const res = NextResponse.json({ files }, { headers: getCorsHeaders() });
    // If access token was refreshed, set cookies
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error: any) {
    console.error('API Route - Error listing files:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Check if it's a path not found error
    if (error.message?.includes('path/not_found')) {
      return NextResponse.json({ 
        error: 'Folder not found. Starting from root folder.', 
        files: [],
        details: error.message
      }, { status: 404, headers: getCorsHeaders() });
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to list files',
      details: {
        message: error.message,
        name: error.name,
        path: path,
        hasToken: !!accessToken
      }
    }, { status: 500, headers: getCorsHeaders() });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    const ensured = await ensureAccessToken(request);
    const accessToken = ensured?.accessToken || (formData.get('token') as string);

    if (!file || !path || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const result = await dropboxService.uploadFile(file, path);
    const res = NextResponse.json({ file: result }, { headers: getCorsHeaders() });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}
