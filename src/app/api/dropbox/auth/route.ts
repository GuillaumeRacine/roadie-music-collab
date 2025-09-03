import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';

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

    const accessToken = await dropboxService.getAccessTokenFromCode(
      code,
      `${process.env.NEXTAUTH_URL}/api/dropbox/auth`
    );

    // In a real app, you'd save this token to a database
    // For now, we'll redirect with the token as a query param
    // Redirect to frontend URL (port 3000) instead of backend
    return NextResponse.redirect(
      `https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app/dashboard?token=${accessToken}`
    );
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

    return NextResponse.json({ authUrl }, {
      headers: {
        'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}