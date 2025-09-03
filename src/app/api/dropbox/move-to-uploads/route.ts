import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { MUSIC_BASE_PATH } from '@/lib/config';
import { ensureAccessToken } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const ensured = await ensureAccessToken(request);
    const accessToken = ensured?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const result = await moveFilesToUploads(dropboxService);

    const res = NextResponse.json({ 
      success: true, 
      message: `Moved ${result.movedCount} files to New Uploads folder`,
      details: result.details
    });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('Error moving files to uploads:', error);
    return NextResponse.json({ error: 'Failed to move files to uploads folder' }, { status: 500 });
  }
}

async function moveFilesToUploads(dropboxService: DropboxService) {
  const basePath = MUSIC_BASE_PATH;
  const songsPath = `${basePath}/Live Recordings`;
  const uploadsPath = `${basePath}/New Uploads`;
  
  const results = {
    movedCount: 0,
    details: [] as string[]
  };

  try {
    // Get all files from Live Recordings folder (including top level)
    const allFiles = await getAllFilesRecursively(dropboxService, songsPath);
    
    // Filter for audio files (.m4a, .mp3, .wav, etc.)
    const audioFiles = allFiles.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.m4a') || name.endsWith('.mp3') || name.endsWith('.wav') || 
             name.endsWith('.aiff') || name.endsWith('.flac');
    });

    console.log(`Found ${audioFiles.length} audio files to move`);

    for (const file of audioFiles) {
      const oldPath = file.path_display!;
      const newPath = `${uploadsPath}/${file.name}`;
      
      try {
        await dropboxService.moveFile(oldPath, newPath);
        results.movedCount++;
        results.details.push(`Moved: ${file.name}`);
        console.log(`Moved: ${oldPath} -> ${newPath}`);
      } catch (moveError) {
        console.error(`Failed to move ${oldPath}:`, moveError);
        results.details.push(`Failed to move: ${file.name} (${moveError})`);
      }
    }

  } catch (error) {
    console.error('Error in moveFilesToUploads:', error);
    throw error;
  }

  return results;
}

async function getAllFilesRecursively(dropboxService: DropboxService, folderPath: string): Promise<any[]> {
  const allFiles: any[] = [];
  
  async function processFolder(path: string) {
    try {
      const items = await dropboxService.listFiles(path);
      
      for (const item of items) {
        if (item['.tag'] === 'file') {
          allFiles.push(item);
        } else if (item['.tag'] === 'folder') {
          // Skip processing subfolders for now - only get files from the main folder
          console.log(`Skipping subfolder: ${item.path_display}`);
        }
      }
    } catch (error) {
      console.error(`Error processing folder ${path}:`, error);
    }
  }
  
  await processFolder(folderPath);
  return allFiles;
}
