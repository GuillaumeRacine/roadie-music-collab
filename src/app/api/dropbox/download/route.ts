import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessToken = searchParams.get('token');
  const path = searchParams.get('path');

  console.log('Download request:', { path, hasToken: !!accessToken });

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

    console.log('Attempting to download file from Dropbox:', path);
    const result = await dropboxService.downloadFile(path);
    
    // The Dropbox API returns the file content in the 'fileBlob' property
    const fileBlob = result.fileBlob as Blob;
    console.log('File downloaded successfully, size:', fileBlob.size);
    
    // Determine content type based on file extension
    const extension = path.toLowerCase().split('.').pop();
    let contentType = 'application/octet-stream';
    
    if (extension === 'txt' || extension === 'lyrics' || extension === 'md') {
      contentType = 'text/plain';
    } else if (extension === 'mp3') {
      contentType = 'audio/mpeg';
    } else if (extension === 'wav') {
      contentType = 'audio/wav';
    } else if (extension === 'm4a') {
      contentType = 'audio/mp4';
    } else if (extension === 'aac') {
      contentType = 'audio/aac';
    } else if (extension === 'ogg') {
      contentType = 'audio/ogg';
    } else if (extension === 'flac') {
      contentType = 'audio/flac';
    }

    const fileName = path.split('/').pop() || 'download';
    
    return new Response(fileBlob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'false',
      },
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json({ 
      error: 'Failed to download file',
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
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}