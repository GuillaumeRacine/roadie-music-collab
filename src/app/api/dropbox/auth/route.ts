import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { FRONTEND_ORIGIN, getCorsHeaders } from '@/lib/config';
import { setAuthCookies } from '@/lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!
    });

    const tokenData = await dropboxService.getAccessTokenFromCode(
      code,
      `${process.env.NEXTAUTH_URL}/api/dropbox/auth`
    );

    // Set cookies for session (HttpOnly)
    const res = NextResponse.redirect(`${FRONTEND_ORIGIN}/dashboard`);
    setAuthCookies(res, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
    return res;
  } catch (error) {
    console.error('Dropbox auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!
    });

    const authUrl = await dropboxService.getAuthUrl(
      `${process.env.NEXTAUTH_URL}/api/dropbox/auth`
    );

    return NextResponse.json({ authUrl }, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}
