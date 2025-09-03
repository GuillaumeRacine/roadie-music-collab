import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { operation, files, targetPath, content } = await request.json();
    
    if (!operation) {
      return NextResponse.json({ error: 'Operation is required' }, { status: 400, headers: getCorsHeaders() });
    }

    // Get auth tokens from cookies
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!
    });

    let result;

    switch (operation) {
      case 'CREATE_FOLDER':
        if (!targetPath) {
          return NextResponse.json({ error: 'Target path required for folder creation' }, { status: 400, headers: getCorsHeaders() });
        }
        result = await dropboxService.createFolder(authTokens.access_token, targetPath);
        break;

      case 'CREATE_DOCUMENT':
        if (!targetPath || !content) {
          return NextResponse.json({ error: 'Target path and content required for document creation' }, { status: 400, headers: getCorsHeaders() });
        }
        
        // Create the document content
        const documentContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        
        try {
          // Upload the document to Dropbox
          const uploadResult = await dropboxService.uploadFile(
            authTokens.access_token,
            targetPath,
            Buffer.from(documentContent, 'utf-8')
          );
          result = { success: true, path: targetPath, uploadResult };
        } catch (uploadError) {
          console.error('Document upload error:', uploadError);
          result = { success: false, error: 'Failed to create document' };
        }
        break;

      case 'RENAME_FILE':
        if (!files || files.length !== 2) {
          return NextResponse.json({ error: 'Source and target paths required for rename' }, { status: 400, headers: getCorsHeaders() });
        }
        result = await dropboxService.moveFile(authTokens.access_token, files[0], files[1]);
        break;

      case 'MOVE_FILE':
        if (!files || files.length !== 2) {
          return NextResponse.json({ error: 'Source and target paths required for move' }, { status: 400, headers: getCorsHeaders() });
        }
        result = await dropboxService.moveFile(authTokens.access_token, files[0], files[1]);
        break;

      case 'ORGANIZE_BY_DATE':
        // This is a more complex operation that would organize files by date
        result = await organizeFilesByDate(dropboxService, authTokens.access_token, targetPath || '/Music/Fiasco Total');
        break;

      case 'ORGANIZE_BY_TYPE':
        // This is a more complex operation that would organize files by type
        result = await organizeFilesByType(dropboxService, authTokens.access_token, targetPath || '/Music/Fiasco Total');
        break;

      case 'CREATE_LYRICS':
        if (!content) {
          return NextResponse.json({ error: 'Content required for lyrics creation' }, { status: 400, headers: getCorsHeaders() });
        }
        
        // Extract lyrics creation parameters from content
        const lyricsData = typeof content === 'string' ? JSON.parse(content) : content;
        
        // Call the create-lyrics API endpoint internally
        const lyricsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/ai/create-lyrics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify(lyricsData),
        });
        
        result = await lyricsResponse.json();
        break;

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400, headers: getCorsHeaders() });
    }

    return NextResponse.json({
      success: true,
      operation,
      result
    }, { headers: getCorsHeaders() });

  } catch (error) {
    console.error('File operation error:', error);
    return NextResponse.json(
      { error: 'File operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

async function organizeFilesByDate(dropboxService: DropboxService, accessToken: string, basePath: string) {
  try {
    // Get all files in the directory
    const filesResult = await dropboxService.listFiles(accessToken, basePath);
    const files = filesResult.entries || [];
    
    const operations = [];
    const currentYear = new Date().getFullYear().toString();
    
    for (const file of files) {
      if (file['.tag'] !== 'file' || !file.server_modified) continue;
      
      const fileDate = new Date(file.server_modified);
      const year = fileDate.getFullYear().toString();
      const month = (fileDate.getMonth() + 1).toString().padStart(2, '0');
      
      const targetFolder = `${basePath}/${year}/${month}`;
      const targetPath = `${targetFolder}/${file.name}`;
      
      operations.push({
        operation: 'move',
        from: file.path_display,
        to: targetPath
      });
    }
    
    return { operations, count: operations.length };
  } catch (error) {
    console.error('Organize by date error:', error);
    return { success: false, error: 'Failed to organize by date' };
  }
}

async function organizeFilesByType(dropboxService: DropboxService, accessToken: string, basePath: string) {
  try {
    // Get all files in the directory
    const filesResult = await dropboxService.listFiles(accessToken, basePath);
    const files = filesResult.entries || [];
    
    const operations = [];
    
    for (const file of files) {
      if (file['.tag'] !== 'file') continue;
      
      const ext = file.name.split('.').pop()?.toLowerCase();
      let targetFolder;
      
      if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext || '')) {
        targetFolder = `${basePath}/Audio Files`;
      } else if (['txt', 'md', 'lyrics'].includes(ext || '')) {
        targetFolder = `${basePath}/Lyrics`;
      } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '')) {
        targetFolder = `${basePath}/Images`;
      } else {
        targetFolder = `${basePath}/Other Files`;
      }
      
      const targetPath = `${targetFolder}/${file.name}`;
      
      operations.push({
        operation: 'move',
        from: file.path_display,
        to: targetPath
      });
    }
    
    return { operations, count: operations.length };
  } catch (error) {
    console.error('Organize by type error:', error);
    return { success: false, error: 'Failed to organize by type' };
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}