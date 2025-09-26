import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

interface MigrationResult {
  fileName: string;
  originalPath: string;
  newPath: string;
  status: 'success' | 'error' | 'skipped';
  message?: string;
  dateFolder?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const dropboxService = new DropboxService(authTokens.access_token);
    const basePath = process.env.MUSIC_BASE_PATH || '/Music/Fiasco Total';
    const yearFolder = '2025';
    const sourcePath = `${basePath}/Live Recordings/${yearFolder}`;

    const results: MigrationResult[] = [];

    console.log(`🔄 Starting migration from ${sourcePath}`);

    // List all files in the 2025 folder
    const filesResponse = await dropboxService.listFiles(sourcePath);
    const files = filesResponse.filter((entry: any) => entry['.tag'] === 'file');

    if (files.length === 0) {
      return NextResponse.json({
        message: 'No files to migrate in 2025 folder',
        results: []
      }, { headers: getCorsHeaders() });
    }

    console.log(`Found ${files.length} files to migrate`);

    // Group files by their date prefix or use current date
    const filesByDate = new Map<string, any[]>();

    for (const file of files) {
      const fileName = file.name;
      let dateKey = '';

      // Extract date from filename if it has the YYYYMMDD prefix
      const dateMatch = fileName.match(/^(\d{4})(\d{2})(\d{2})[_-]/);
      if (dateMatch) {
        dateKey = `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`;
      } else {
        // Use current date as fallback
        dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      }

      if (!filesByDate.has(dateKey)) {
        filesByDate.set(dateKey, []);
      }
      filesByDate.get(dateKey)!.push(file);
    }

    console.log(`Files will be organized into ${filesByDate.size} date folders`);

    // Process each date group
    for (const [dateKey, dateFiles] of filesByDate) {
      const dateFolderPath = `${basePath}/Live Recordings/${dateKey}`;

      // Create the date folder
      try {
        console.log(`📁 Creating folder: ${dateFolderPath}`);
        await dropboxService.createFolder(dateFolderPath);

        await activityLogger.logActivity({
          action: 'create_folder',
          filePath: dateFolderPath,
          details: {
            folderCreated: dateKey,
            dateSource: 'migration',
            fileCount: dateFiles.length
          }
        });

        console.log(`✅ Created folder: ${dateKey}`);
      } catch (error: any) {
        // Folder might already exist, that's ok
        if (!error.message?.includes('conflict')) {
          console.error(`Failed to create folder ${dateKey}:`, error);
        } else {
          console.log(`📁 Folder already exists: ${dateKey}`);
        }
      }

      // Move files to the date folder
      for (const file of dateFiles) {
        const fileName = file.name;
        const oldPath = file.path_display;
        const newPath = `${dateFolderPath}/${fileName}`;

        try {
          console.log(`📦 Moving: ${fileName} -> ${dateKey}/`);
          await dropboxService.moveFile(oldPath, newPath);

          await activityLogger.logActivity({
            action: 'migrate',
            filePath: newPath,
            oldPath: oldPath,
            details: {
              fileName,
              dateFolder: dateKey,
              migration: 'one-time-2025-cleanup'
            }
          });

          results.push({
            fileName,
            originalPath: oldPath,
            newPath,
            status: 'success',
            dateFolder: dateKey,
            message: `Moved to ${dateKey} folder`
          });

          console.log(`✅ Moved: ${fileName}`);
        } catch (error: any) {
          console.error(`Failed to move ${fileName}:`, error);
          results.push({
            fileName,
            originalPath: oldPath,
            newPath,
            status: 'error',
            message: error.message || 'Failed to move file'
          });
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      message: `Migration complete: ${successCount} files moved, ${errorCount} errors`,
      results,
      summary: {
        total: files.length,
        success: successCount,
        errors: errorCount,
        folders: filesByDate.size
      }
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}