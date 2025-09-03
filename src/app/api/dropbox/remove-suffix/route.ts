import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { MUSIC_BASE_PATH } from '@/lib/config';
import { ensureAccessToken } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const ensured = await ensureAccessToken(request);
    const accessToken = ensured?.accessToken;
    const targetFolder = (formData.get('folder') as string) || `${MUSIC_BASE_PATH}/Live Recordings`;

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const result = await removeLiveRecordingSuffix(dropboxService, targetFolder);

    const res = NextResponse.json({ 
      success: true, 
      message: `Updated ${result.renamedCount} files in ${targetFolder}`,
      details: result.details
    });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('Error removing suffix:', error);
    return NextResponse.json({ error: 'Failed to remove suffix from files' }, { status: 500 });
  }
}

async function removeLiveRecordingSuffix(dropboxService: DropboxService, folderPath: string) {
  const results = {
    renamedCount: 0,
    details: [] as string[]
  };

  try {
    // Get all files recursively
    const allFiles = await getAllFilesRecursively(dropboxService, folderPath);
    
    // Filter for files that have _LiveRecording.m4a suffix
    const filesToRename = allFiles.filter(file => {
      return file.name.includes('_LiveRecording.m4a');
    });

    console.log(`Found ${filesToRename.length} files to rename`);

    for (const file of filesToRename) {
      const oldPath = file.path_display!;
      const oldName = file.name;
      
      // Remove _LiveRecording from the filename
      const newName = oldName.replace('_LiveRecording', '');
      
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      try {
        await dropboxService.moveFile(oldPath, newPath);
        results.renamedCount++;
        results.details.push(`${oldName} → ${newName}`);
        console.log(`Renamed: ${oldPath} → ${newPath}`);
      } catch (renameError) {
        console.error(`Failed to rename ${oldPath}:`, renameError);
        results.details.push(`Failed: ${oldName} (${renameError})`);
      }
    }

  } catch (error) {
    console.error('Error in removeLiveRecordingSuffix:', error);
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
          // Recursively process subfolders
          await processFolder(item.path_display);
        }
      }
    } catch (error) {
      console.error(`Error processing folder ${path}:`, error);
    }
  }
  
  await processFolder(folderPath);
  return allFiles;
}
