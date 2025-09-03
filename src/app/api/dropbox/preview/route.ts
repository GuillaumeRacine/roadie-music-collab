import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { ensureAccessToken } from '@/lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessTokenFromQuery = searchParams.get('token');
  const path = searchParams.get('path');

  console.log('Preview request:', { path, hasToken: !!accessToken });

  // Cookies first, fallback to query
  const ensured = await ensureAccessToken(request);
  const accessToken = ensured?.accessToken || accessTokenFromQuery;
  if (!accessToken || !path) {
    console.error('Missing required parameters:', { hasToken: !!accessToken, hasPath: !!path });
    return NextResponse.json({ error: 'Missing token or path' }, { status: 400 });
  }

  try {
    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    console.log('Getting direct preview link for:', path);
    
    // Try to get a temporary link first (works for all file types)
    let directUrl;
    try {
      directUrl = await dropboxService.getDirectPreviewLink(path);
      console.log('Got temporary link:', directUrl);
    } catch (tempError) {
      console.log('Temporary link failed, trying shared link:', tempError.message);
      // Fallback to shared link
      directUrl = await dropboxService.getSharedLink(path);
      console.log('Got shared link:', directUrl);
    }
    
    const res = NextResponse.json({ previewUrl: directUrl, path }, { headers: getCorsHeaders() });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error: any) {
    console.error('Error getting preview link:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to get preview link', details: error.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}
