import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { MUSIC_ACTIVE_YEAR, MUSIC_BASE_PATH } from '@/lib/config';
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

    const result = await renameFilesByDate(dropboxService, targetFolder);

    const res = NextResponse.json({ 
      success: true, 
      message: `Renamed ${result.renamedCount} files in ${targetFolder}`,
      details: result.details
    });
    if (ensured?.cookiesToSet) {
      for (const c of ensured.cookiesToSet) res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('Error renaming files by date:', error);
    return NextResponse.json({ error: 'Failed to rename files' }, { status: 500 });
  }
}

async function renameFilesByDate(dropboxService: DropboxService, folderPath: string) {
  const results = {
    renamedCount: 0,
    details: [] as string[]
  };

  try {
    // Get all files in the folder and subfolders
    const allFiles = await getAllFilesRecursively(dropboxService, folderPath);
    
    // Filter for .m4a files that don't already follow our naming convention
    const m4aFiles = allFiles.filter(file => {
      const isM4a = file.name.toLowerCase().endsWith('.m4a');
      const alreadyRenamed = /^\d{8}(?:_\d{4})?[_-]?/.test(file.name); // Check if follows YYYYMMDD[_HHMM] pattern
      return isM4a && !alreadyRenamed;
    });

    console.log(`Found ${m4aFiles.length} .m4a files to rename`);

    // Group files by date to handle multiple files on same day
    const filesByDate: { [date: string]: typeof m4aFiles } = {};
    
    for (const file of m4aFiles) {
      let dateKey = 'unknown';
      
      if (file.server_modified) {
        const fileDate = new Date(file.server_modified);
        dateKey = fileDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      }
      
      if (!filesByDate[dateKey]) {
        filesByDate[dateKey] = [];
      }
      filesByDate[dateKey].push(file);
    }

    // Rename files
    for (const [dateKey, files] of Object.entries(filesByDate)) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const oldPath = file.path_display!;
        
        let newFileName: string;
        
        if (dateKey === 'unknown') {
          newFileName = `Unknown_Date_${String(i + 1).padStart(2, '0')}.m4a`;
        } else {
          const sequence = files.length > 1 ? `_${String(i + 1).padStart(2, '0')}` : '';
          newFileName = `${dateKey}${sequence}_LiveRecording.m4a`;
        }
        
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = newFileName;
        const newPath = pathParts.join('/');

        try {
          await dropboxService.moveFile(oldPath, newPath);
          results.renamedCount++;
          results.details.push(`${file.name} → ${newFileName}`);
          console.log(`Renamed: ${oldPath} → ${newPath}`);
        } catch (renameError) {
          console.error(`Failed to rename ${oldPath}:`, renameError);
          results.details.push(`Failed: ${file.name} (${renameError})`);
        }
      }
    }

  } catch (error) {
    console.error('Error in renameFilesByDate:', error);
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
