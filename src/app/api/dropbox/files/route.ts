import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessToken = searchParams.get('token');
  const path = searchParams.get('path') || '';

  console.log('API: Listing files for path:', path);

  if (!accessToken) {
    return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
  }

  try {
    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const files = await dropboxService.listFiles(path);
    console.log(`API: Found ${files.length} files/folders`);
    return NextResponse.json({ files }, {
      headers: {
        'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
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
      }, { 
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to list files',
      details: {
        message: error.message,
        name: error.name,
        path: path,
        hasToken: !!accessToken
      }
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    const accessToken = formData.get('token') as string;

    if (!file || !path || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const result = await dropboxService.uploadFile(file, path);
    return NextResponse.json({ file: result }, {
      headers: {
        'Access-Control-Allow-Origin': 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { 
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