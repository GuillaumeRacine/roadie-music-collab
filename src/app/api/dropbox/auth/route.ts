import { NextRequest, NextResponse } from 'next/server';
import { Dropbox } from 'dropbox';
import { getCorsHeaders } from '@/lib/config';
import { setAuthCookies } from '@/lib/session';

const CLIENT_ID = process.env.DROPBOX_CLIENT_ID!;
const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/dropbox/auth`;

// POST: Start OAuth flow
export async function POST(request: NextRequest) {
  try {
    const dbx = new Dropbox({
      clientId: CLIENT_ID,
    });

    const authUrl = await dbx.auth.getAuthenticationUrl(
      REDIRECT_URI,
      undefined,
      'code',
      'offline',
      undefined,
      'none',
      false
    );

    return NextResponse.json({ authUrl }, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// GET: OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Log OAuth callback parameters
  console.log('OAuth callback received:', {
    code: code ? 'present' : 'missing',
    error,
    errorDescription,
    allParams: Object.fromEntries(searchParams.entries())
  });

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    const errorMessage = encodeURIComponent(errorDescription || error || 'oauth_failed');
    return NextResponse.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}?error=${errorMessage}`);
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}?error=no_code_received`);
  }

  try {
    // Exchange code for access token manually
    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const result = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(result.error_description || 'Failed to get access token');
    }

    // Create response with redirect
    const redirectResponse = NextResponse.redirect(
      `${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/dashboard`
    );

    // Set auth cookies
    setAuthCookies(redirectResponse, {
      access_token: result.access_token,
      refresh_token: result.refresh_token || '',
      expiry_time: Date.now() + (result.expires_in || 14400) * 1000
    });

    return redirectResponse;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}?error=oauth_failed`);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}