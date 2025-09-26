import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

interface RestoreResult {
  fileName: string;
  originalPath: string;
  restoredPath: string;
  status: 'success' | 'error' | 'skipped';
  message?: string;
}

function getOriginalFileName(currentName: string): string {
  // Remove date prefix if it exists (YYYYMMDD_ format)
  const withoutDatePrefix = currentName.replace(/^\d{8}_/, '');
  return withoutDatePrefix;
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
    const newUploadsPath = `${basePath}/New Uploads`;

    const results: RestoreResult[] = [];

    // Define all the folders where processed files might be
    const targetFolders = [
      `${basePath}/Songs/${activeYear}`,
      `${basePath}/Song Ideas/${activeYear}`,
      `${basePath}/Live Recordings/${activeYear}`,
      `${basePath}/Lyrics/${activeYear}`,
      `${basePath}/Sheet Music/${activeYear}`,
      `${basePath}/Media/${activeYear}`
    ];

    let totalFilesFound = 0;

    for (const folderPath of targetFolders) {
      try {
        console.log(`Checking folder: ${folderPath}`);
        const filesResponse = await dropboxService.listFiles(folderPath);
        const files = filesResponse.filter((entry: any) => entry['.tag'] === 'file');

        for (const file of files) {
          totalFilesFound++;
          const currentName = file.name;
          const currentPath = file.path_display;

          // Check if this looks like a processed file (has date prefix)
          const hasDatePrefix = /^\d{8}_/.test(currentName);

          if (hasDatePrefix) {
            const originalName = getOriginalFileName(currentName);
            const restoredPath = `${newUploadsPath}/${originalName}`;

            try {
              if (action === 'preview') {
                // Just return what would happen
                results.push({
                  fileName: currentName,
                  originalPath: currentPath,
                  restoredPath,
                  status: 'success'
                });
              } else if (action === 'restore') {
                // Actually move the file back
                await dropboxService.moveFile(currentPath, restoredPath);

                // Log the activity
                await activityLogger.logActivity({
                  action: 'restore',
                  filePath: restoredPath,
                  oldPath: currentPath,
                  newPath: restoredPath,
                  details: {
                    originalName: currentName,
                    newName: originalName
                  }
                });

                results.push({
                  fileName: currentName,
                  originalPath: currentPath,
                  restoredPath,
                  status: 'success',
                  message: `Restored as ${originalName}`
                });
              }
            } catch (error: any) {
              console.error(`Error restoring ${currentName}:`, error);
              results.push({
                fileName: currentName,
                originalPath: currentPath,
                restoredPath,
                status: 'error',
                message: error.message || 'Failed to restore'
              });
            }
          } else {
            // File doesn't look like it was processed by our system
            results.push({
              fileName: currentName,
              originalPath: currentPath,
              restoredPath: currentPath,
              status: 'skipped',
              message: 'Not a processed file'
            });
          }
        }
      } catch (error) {
        console.error(`Error accessing folder ${folderPath}:`, error);
        // Continue to next folder if this one fails
      }
    }

    const processedFiles = results.filter(r => r.status === 'success');
    const skippedFiles = results.filter(r => r.status === 'skipped');
    const errorFiles = results.filter(r => r.status === 'error');

    return NextResponse.json({
      message: action === 'preview'
        ? `Found ${processedFiles.length} processed files to restore (${skippedFiles.length} skipped, ${totalFilesFound} total files scanned)`
        : `Restored ${processedFiles.length} files to New Uploads (${errorFiles.length} errors, ${skippedFiles.length} skipped)`,
      results,
      restored: processedFiles.length,
      errors: errorFiles.length,
      skipped: skippedFiles.length,
      totalScanned: totalFilesFound
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('Error restoring uploads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore uploads' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}