import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { ensureAccessToken } from '@/lib/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accessTokenFromQuery = searchParams.get('token');
  const path = searchParams.get('path');

  console.log('Download request:', { path, hasToken: !!accessToken });

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
    
    const res = new Response(fileBlob, {
      headers: {
        ...getCorsHeaders(),
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    // Note: cannot set cookies on a plain Response easily; return NextResponse instead if we refreshed
    if (ensured?.cookiesToSet?.length) {
      const nres = NextResponse.next();
      for (const c of ensured.cookiesToSet) nres.cookies.set(c.name, c.value, c.options);
      // Merge headers
      for (const [k, v] of (res.headers as any).entries()) nres.headers.set(k, v);
      // Return body with headers
      return new Response(fileBlob, { headers: nres.headers });
    }
    return res;
  } catch (error: any) {
    console.error('Error downloading file:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to download file', details: error.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}
