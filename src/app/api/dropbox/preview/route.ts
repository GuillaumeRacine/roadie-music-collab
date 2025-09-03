import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessToken = searchParams.get('token');
  const path = searchParams.get('path');

  console.log('Preview request:', { path, hasToken: !!accessToken });

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
    
    return NextResponse.json({ 
      previewUrl: directUrl,
      path
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'false',
      },
    });
  } catch (error: any) {
    console.error('Error getting preview link:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json({ 
      error: 'Failed to get preview link',
      details: error.message 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'false',
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}