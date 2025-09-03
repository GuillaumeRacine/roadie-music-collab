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

    const result = await createUploadsAndMoveFiles(dropboxService);

    const res = NextResponse.json({ 
      success: true, 
      message: `Created Uploads folder and moved ${result.movedCount} files`,
      details: result.details
    });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('Error creating uploads folder:', error);
    return NextResponse.json({ error: 'Failed to create uploads folder and move files' }, { status: 500 });
  }
}

async function createUploadsAndMoveFiles(dropboxService: DropboxService) {
  const basePath = MUSIC_BASE_PATH;
  const uploadsPath = `${basePath}/Uploads`;
  
  const results = {
    movedCount: 0,
    details: [] as string[]
  };

  try {
    // Create Uploads folder
    try {
      await dropboxService.createFolder(uploadsPath);
      console.log('Created Uploads folder');
      results.details.push('Created Uploads folder');
    } catch (error) {
      console.log('Uploads folder may already exist');
      results.details.push('Uploads folder already exists');
    }

    // Find all unarchived .m4a files from the active year folders
    const foldersToProcess = [
      `Live Recordings/${process.env.MUSIC_ACTIVE_YEAR || '2025'}`,
      `New Song Ideas/${process.env.MUSIC_ACTIVE_YEAR || '2025'}`,
      `Lyrics/${process.env.MUSIC_ACTIVE_YEAR || '2025'}`
    ];

    for (const folderName of foldersToProcess) {
      const folderPath = `${basePath}/${folderName}`;
      
      try {
        const files = await dropboxService.listFiles(folderPath);
        
        const m4aFiles = files.filter(file => 
          file['.tag'] === 'file' && file.name.toLowerCase().endsWith('.m4a')
        );
        
        for (const file of m4aFiles) {
          const oldPath = file.path_display!;
          const newPath = `${uploadsPath}/${file.name}`;
          
          try {
            await dropboxService.moveFile(oldPath, newPath);
            results.movedCount++;
            results.details.push(`Moved: ${file.name} from ${folderName}`);
            console.log(`Moved: ${oldPath} -> ${newPath}`);
          } catch (moveError) {
            console.error(`Failed to move ${oldPath}:`, moveError);
            results.details.push(`Failed to move: ${file.name} (${moveError})`);
          }
        }
        
      } catch (error) {
        console.log(`Error processing folder ${folderPath}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in createUploadsAndMoveFiles:', error);
    throw error;
  }

  return results;
}
