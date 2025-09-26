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
    const previewUrl = await dropboxService.getTemporaryLink(path);

    return NextResponse.json({ previewUrl }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('Error getting preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get preview URL' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}