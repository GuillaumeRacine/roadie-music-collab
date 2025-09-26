import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

interface OrganizeResult {
  fileName: string;
  originalPath: string;
  newPath: string;
  extractedDate: string;
  folderCreated: boolean;
  status: 'success' | 'error' | 'skipped';
  message?: string;
}

function extractDateFromFileName(fileName: string): string | null {
  // Look for date pattern at the start (YYYYMMDD format)
  const match = fileName.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}`;
  }
  return null;
}

function isAudioFile(fileName: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  return audioExtensions.includes(ext);
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

    const { action } = await request.json();
    const dropboxService = new DropboxService(authTokens.access_token);

    const basePath = process.env.MUSIC_BASE_PATH || '/Music/Fiasco Total';
    const activeYear = process.env.MUSIC_ACTIVE_YEAR || '2025';
    const liveRecordingsPath = `${basePath}/Live Recordings/${activeYear}`;

    const results: OrganizeResult[] = [];

    // Get all files and folders in Live Recordings/2025
    const filesResponse = await dropboxService.listFiles(liveRecordingsPath);
    const audioFiles = filesResponse.filter((entry: any) =>
      entry['.tag'] === 'file' && isAudioFile(entry.name)
    );
    const existingFolders = filesResponse
      .filter((entry: any) => entry['.tag'] === 'folder')
      .map((folder: any) => folder.name);

    console.log(`Found ${audioFiles.length} audio files to organize`);
    console.log(`Existing folders: ${existingFolders.join(', ')}`);

    if (audioFiles.length === 0) {
      return NextResponse.json({
        message: 'No audio files to organize in Live Recordings folder',
        organized: 0
      }, { headers: getCorsHeaders() });
    }

    // Group files by extracted date
    const filesByDate: { [date: string]: any[] } = {};

    for (const file of audioFiles) {
      const extractedDate = extractDateFromFileName(file.name);
      if (extractedDate) {
        if (!filesByDate[extractedDate]) {
          filesByDate[extractedDate] = [];
        }
        filesByDate[extractedDate].push(file);
      } else {
        // Files without date pattern - skip for now
        results.push({
          fileName: file.name,
          originalPath: file.path_display,
          newPath: file.path_display,
          extractedDate: '',
          folderCreated: false,
          status: 'skipped',
          message: 'No date pattern found in filename'
        });
      }
    }

    console.log(`Grouped files by dates: ${Object.keys(filesByDate).join(', ')}`);

    // Process each date group
    for (const [date, files] of Object.entries(filesByDate)) {
      const dateFolderPath = `${liveRecordingsPath}/${date}`;
      let folderCreated = false;

      // Check if date folder already exists
      if (!existingFolders.includes(date)) {
        try {
          if (action === 'organize') {
            await dropboxService.createFolder(dateFolderPath);

            // Log folder creation
            await activityLogger.logActivity({
              action: 'create_folder',
              filePath: dateFolderPath,
              details: {
                folderCreated: date,
                dateSource: 'filename-extraction',
                fileCount: files.length
              }
            });

            console.log(`Created folder: ${dateFolderPath}`);
            folderCreated = true;
          }
        } catch (error) {
          console.error(`Error creating folder ${dateFolderPath}:`, error);
          // Continue with files even if folder creation fails
        }
      }

      // Move files to date folder
      for (const file of files) {
        const newPath = `${dateFolderPath}/${file.name}`;

        try {
          if (action === 'preview') {
            results.push({
              fileName: file.name,
              originalPath: file.path_display,
              newPath,
              extractedDate: date,
              folderCreated,
              status: 'success',
              message: `Would move to ${date} folder`
            });
          } else if (action === 'organize') {
            await dropboxService.moveFile(file.path_display, newPath);

            // Log the move operation
            await activityLogger.logActivity({
              action: 'organize',
              filePath: newPath,
              oldPath: file.path_display,
              newPath: newPath,
              details: {
                originalName: file.name,
                newName: file.name,
                category: 'live-recording-organization',
                dateSource: 'filename-extraction',
                detectedDate: date,
                folderCreated: folderCreated ? date : undefined
              }
            });

            results.push({
              fileName: file.name,
              originalPath: file.path_display,
              newPath,
              extractedDate: date,
              folderCreated,
              status: 'success',
              message: `Moved to ${date} folder`
            });

            console.log(`Moved ${file.name} to ${newPath}`);
          }
        } catch (error: any) {
          console.error(`Error moving ${file.name}:`, error);
          results.push({
            fileName: file.name,
            originalPath: file.path_display,
            newPath,
            extractedDate: date,
            folderCreated,
            status: 'error',
            message: error.message || 'Failed to move file'
          });
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const foldersCreatedCount = results.filter(r => r.folderCreated).length;

    const message = action === 'preview'
      ? `Found ${audioFiles.length} audio files to organize into ${Object.keys(filesByDate).length} date folders (${skippedCount} will be skipped)`
      : `Organized ${successCount} files into date folders (${errorCount} errors, ${skippedCount} skipped, ${foldersCreatedCount} folders created)`;

    return NextResponse.json({
      message,
      results,
      organized: successCount,
      errors: errorCount,
      skipped: skippedCount,
      foldersCreated: foldersCreatedCount,
      totalFiles: audioFiles.length,
      dateGroups: Object.keys(filesByDate).length
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('Error organizing live recordings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to organize live recordings' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}