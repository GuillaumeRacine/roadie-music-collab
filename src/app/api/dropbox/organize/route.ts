import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { MUSIC_BASE_PATH, MUSIC_ACTIVE_YEAR } from '@/lib/config';
import { ensureAccessToken } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const ensured = await ensureAccessToken(request);
    const accessToken = ensured?.accessToken || (formData.get('token') as string);
    const action = formData.get('action') as string;

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    switch (action) {
      case 'create_structure':
        await createFolderStructure(dropboxService);
        break;
      case 'archive_old_files':
        await archiveOldFiles(dropboxService);
        break;
      case 'organize_existing':
        await organizeExistingFiles(dropboxService);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const res = NextResponse.json({ success: true, message: `Action ${action} completed successfully` });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('Error organizing files:', error);
    return NextResponse.json({ error: 'Failed to organize files' }, { status: 500 });
  }
}

async function createFolderStructure(dropboxService: DropboxService) {
  const basePath = MUSIC_BASE_PATH;
  
  const foldersToCreate = [
    `${basePath}/Live Recordings`,
    `${basePath}/Live Recordings/${MUSIC_ACTIVE_YEAR}`,
    `${basePath}/Live Recordings/Archive`,
    `${basePath}/New Song Ideas`,
    `${basePath}/New Song Ideas/${MUSIC_ACTIVE_YEAR}`,
    `${basePath}/New Song Ideas/Archive`,
    `${basePath}/Lyrics`,
    `${basePath}/Lyrics/${MUSIC_ACTIVE_YEAR}`,
    `${basePath}/Lyrics/Archive`
  ];

  for (const folderPath of foldersToCreate) {
    try {
      await dropboxService.createFolder(folderPath);
      console.log(`Created folder: ${folderPath}`);
    } catch (error) {
      // Folder might already exist, continue
      console.log(`Folder may already exist: ${folderPath}`);
    }
  }
}

async function archiveOldFiles(dropboxService: DropboxService) {
  const basePath = MUSIC_BASE_PATH;
  const cutoffDate = new Date(`${MUSIC_ACTIVE_YEAR}-04-01`);
  
  const foldersToProcess = [
    'Live Recordings',
    'New Song Ideas', 
    'Lyrics'
  ];

  for (const folder of foldersToProcess) {
    try {
      const files = await dropboxService.listFiles(`${basePath}/${folder}`);
      
      for (const file of files) {
        if (file['.tag'] === 'file' && file.server_modified) {
          const fileDate = new Date(file.server_modified);
          
          if (fileDate < cutoffDate) {
            // Move to Archive folder
            const oldPath = file.path_display;
            const fileName = file.name;
            const newPath = `${basePath}/${folder}/Archive/${fileName}`;
            
            try {
              await moveFile(dropboxService, oldPath!, newPath);
              console.log(`Archived: ${oldPath} -> ${newPath}`);
            } catch (moveError) {
              console.error(`Failed to archive ${oldPath}:`, moveError);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing folder ${folder}:`, error);
    }
  }
}

async function organizeExistingFiles(dropboxService: DropboxService) {
  const basePath = MUSIC_BASE_PATH;
  
  try {
    const files = await dropboxService.listFiles(basePath);
    
    for (const file of files) {
      if (file['.tag'] === 'file') {
        const fileName = file.name.toLowerCase();
        const filePath = file.path_display!;
        
        let targetFolder = '';
        
        // Categorize files based on name patterns
        if (fileName.includes('recording') || fileName.includes('live') || fileName.includes('rehearsal')) {
          targetFolder = `Live Recordings/${MUSIC_ACTIVE_YEAR}`;
        } else if (fileName.includes('idea') || fileName.includes('demo') || fileName.includes('sketch')) {
          targetFolder = `New Song Ideas/${MUSIC_ACTIVE_YEAR}`;
        } else if (fileName.includes('lyric') || fileName.includes('.txt') || fileName.includes('.md')) {
          targetFolder = `Lyrics/${MUSIC_ACTIVE_YEAR}`;
        } else if (fileName.includes('.m4a') || fileName.includes('.mp3') || fileName.includes('.wav')) {
          // Default audio files to Live Recordings
          targetFolder = `Live Recordings/${MUSIC_ACTIVE_YEAR}`;
        }
        
        if (targetFolder) {
          const newPath = `${basePath}/${targetFolder}/${file.name}`;
          try {
            await moveFile(dropboxService, filePath, newPath);
            console.log(`Organized: ${filePath} -> ${newPath}`);
          } catch (moveError) {
            console.error(`Failed to move ${filePath}:`, moveError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error organizing existing files:', error);
  }
}

async function moveFile(dropboxService: DropboxService, fromPath: string, toPath: string) {
  await dropboxService.moveFile(fromPath, toPath);
}
