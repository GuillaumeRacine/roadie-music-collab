import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accessToken = formData.get('token') as string;

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    await moveSongIdeasFiles(dropboxService);

    return NextResponse.json({ success: true, message: 'Song ideas files moved and organized successfully' });
  } catch (error) {
    console.error('Error moving song ideas:', error);
    return NextResponse.json({ error: 'Failed to move song ideas files' }, { status: 500 });
  }
}

async function moveSongIdeasFiles(dropboxService: DropboxService) {
  const basePath = '/Music/Fiasco Total';
  const cutoffDate = new Date('2025-04-01');
  
  try {
    // Check if old "Song Ideas" folder exists
    let songIdeasFiles = [];
    try {
      songIdeasFiles = await dropboxService.listFiles(`${basePath}/Song Ideas`);
    } catch (error) {
      console.log('No existing Song Ideas folder found, checking root for song idea files...');
      
      // Check root folder for files that might be song ideas
      const rootFiles = await dropboxService.listFiles(basePath);
      songIdeasFiles = rootFiles.filter(file => {
        if (file['.tag'] !== 'file') return false;
        const fileName = file.name.toLowerCase();
        return (
          fileName.includes('idea') ||
          fileName.includes('demo') ||
          fileName.includes('sketch') ||
          fileName.includes('rough') ||
          fileName.includes('concept') ||
          fileName.includes('draft')
        );
      });
    }

    console.log(`Found ${songIdeasFiles.length} song idea files to process`);

    for (const file of songIdeasFiles) {
      if (file['.tag'] === 'file') {
        const oldPath = file.path_display!;
        const fileName = file.name;
        let newPath;

        // Check file date to determine if it goes to Archive or 2025
        if (file.server_modified) {
          const fileDate = new Date(file.server_modified);
          if (fileDate < cutoffDate) {
            newPath = `${basePath}/New Song Ideas/Archive/${fileName}`;
          } else {
            newPath = `${basePath}/New Song Ideas/2025/${fileName}`;
          }
        } else {
          // Default to current folder if no date
          newPath = `${basePath}/New Song Ideas/2025/${fileName}`;
        }

        try {
          await dropboxService.moveFile(oldPath, newPath);
          console.log(`Moved: ${oldPath} -> ${newPath}`);
        } catch (moveError) {
          console.error(`Failed to move ${oldPath}:`, moveError);
        }
      }
    }

    // Try to remove empty "Song Ideas" folder if it exists
    try {
      await dropboxService.deleteFile(`${basePath}/Song Ideas`);
      console.log('Removed empty Song Ideas folder');
    } catch (error) {
      console.log('Song Ideas folder may not exist or not empty');
    }

  } catch (error) {
    console.error('Error in moveSongIdeasFiles:', error);
  }
}