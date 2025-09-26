import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

interface ProcessResult {
  fileName: string;
  originalPath: string;
  newPath: string;
  category: string;
  status: 'success' | 'error' | 'skipped';
  message?: string;
  detectedDate?: string;
  dateSource?: string;
  folderCreated?: string;
}

function extractDateFromFilename(filename: string): { date: string; source: string } | null {
  // Pattern 1: YYYYMMDD at start (20240315_filename.mp3)
  const pattern1 = /^(\d{4})(\d{2})(\d{2})[_-]/;
  const match1 = filename.match(pattern1);
  if (match1) {
    return {
      date: `${match1[1]}.${match1[2]}.${match1[3]}`,
      source: 'filename-prefix'
    };
  }

  // Pattern 2: YYYY-MM-DD anywhere (recording-2024-03-15.mp3)
  const pattern2 = /(\d{4})-(\d{2})-(\d{2})/;
  const match2 = filename.match(pattern2);
  if (match2) {
    return {
      date: `${match2[1]}.${match2[2]}.${match2[3]}`,
      source: 'filename-embedded'
    };
  }

  // Pattern 3: MM/DD/YYYY or MM-DD-YYYY
  const pattern3 = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
  const match3 = filename.match(pattern3);
  if (match3) {
    const month = match3[1].padStart(2, '0');
    const day = match3[2].padStart(2, '0');
    return {
      date: `${match3[3]}.${month}.${day}`,
      source: 'filename-us-format'
    };
  }

  return null;
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function hasDatePrefix(filename: string): boolean {
  return /^\d{8}[_-]/.test(filename);
}

async function findOrCreateDateFolder(dropboxService: DropboxService, basePath: string, targetDate: string): Promise<string> {
  const liveRecordingsPath = `${basePath}/Live Recordings`;
  const activeYear = process.env.MUSIC_ACTIVE_YEAR || '2025';
  const yearFolderPath = `${liveRecordingsPath}/${activeYear}`;

  console.log(`🗂️  findOrCreateDateFolder called with targetDate: ${targetDate}`);

  try {
    // List existing folders in the year folder (e.g., Live Recordings/2025)
    const foldersResponse = await dropboxService.listFiles(yearFolderPath);
    const existingFolders = foldersResponse
      .filter((entry: any) => entry['.tag'] === 'folder')
      .map((folder: any) => folder.name);

    console.log(`🗂️  Existing folders in ${yearFolderPath}:`, existingFolders);

    // Look for exact date match first (YYYY-MM-DD format)
    const exactDateFolder = targetDate; // Already in YYYY-MM-DD format
    if (existingFolders.includes(exactDateFolder)) {
      console.log(`🗂️  Found existing date folder: ${exactDateFolder}`);
      return `${yearFolderPath}/${exactDateFolder}`;
    }

    // Always create a date-based folder inside the year folder
    const newFolderPath = `${liveRecordingsPath}/${activeYear}/${exactDateFolder}`;
    console.log(`🗂️  Creating new date folder: ${newFolderPath}`);

    try {
      await dropboxService.createFolder(newFolderPath);

      // Log folder creation
      await activityLogger.logActivity({
        action: 'create_folder',
        filePath: newFolderPath,
        details: {
          folderCreated: exactDateFolder,
          dateSource: 'auto-clustering'
        }
      });

      console.log(`✅ Created new date folder: ${newFolderPath}`);
      return newFolderPath;
    } catch (error) {
      console.error('❌ Failed to create date folder:', error);
      // If we can't create the exact date folder, throw an error rather than falling back
      throw new Error(`Cannot create date folder ${exactDateFolder}: ${error}`);
    }
  } catch (error) {
    console.error('❌ Error in findOrCreateDateFolder:', error);
    throw error;
  }
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

    const results: ProcessResult[] = [];

    // Get all files in New Uploads folder
    const filesResponse = await dropboxService.listFiles(newUploadsPath);
    const files = filesResponse.filter((entry: any) => entry['.tag'] === 'file');

    if (files.length === 0) {
      return NextResponse.json({
        message: 'No files to process in New Uploads folder',
        processed: 0
      }, { headers: getCorsHeaders() });
    }

    for (const file of files) {
      const fileName = file.name;
      const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      const filePath = file.path_display;

      // Check if file already has a date prefix - if so, skip renaming
      const alreadyHasDate = hasDatePrefix(fileName);

      let targetFolder = '';
      let category = '';
      let organizedName = fileName;
      let detectedDate = '';
      let dateSource = '';
      let folderCreated = '';

      // Determine target folder based on file extension and name patterns
      if (['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'].includes(fileExt)) {
        // Audio files - check if they should go to live recordings vs songs/ideas
        if (fileName.toLowerCase().includes('mix') ||
            fileName.toLowerCase().includes('master') ||
            fileName.toLowerCase().includes('demo')) {
          category = 'song-demo';
          targetFolder = `${basePath}/Songs/${activeYear}`;
        } else if (fileName.toLowerCase().includes('idea') ||
                   fileName.toLowerCase().includes('riff') ||
                   fileName.toLowerCase().includes('jam')) {
          category = 'song-idea';
          targetFolder = `${basePath}/Song Ideas/${activeYear}`;
        } else {
          category = 'live-recording';
          // For live recordings, we'll determine the date-based folder later
        }
      } else if (['.txt', '.md', '.doc', '.docx'].includes(fileExt)) {
        category = 'lyrics';
        targetFolder = `${basePath}/Lyrics/${activeYear}`;
      } else if (['.pdf'].includes(fileExt)) {
        category = 'sheet-music';
        targetFolder = `${basePath}/Sheet Music/${activeYear}`;
      } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
        category = 'media';
        targetFolder = `${basePath}/Media/${activeYear}`;
      } else {
        // Unknown type - skip processing
        results.push({
          fileName,
          originalPath: filePath,
          newPath: filePath,
          category: 'unknown',
          status: 'skipped',
          message: 'Unknown file type - skipped'
        });
        continue;
      }

      if (!alreadyHasDate) {
        try {
          // Try to get date from filename first
          const filenameDate = extractDateFromFilename(fileName);

          if (filenameDate) {
            detectedDate = filenameDate.date;
            dateSource = filenameDate.source;
            const datePrefix = filenameDate.date.replace(/-/g, '');

            // Clean the original filename (remove the date if it was embedded)
            let cleanName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
            if (filenameDate.source === 'filename-prefix') {
              cleanName = cleanName.replace(/^\d{8}[_-]/, ''); // Remove date prefix
            } else if (filenameDate.source === 'filename-embedded' || filenameDate.source === 'filename-us-format') {
              cleanName = cleanName.replace(/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g, '').replace(/[_-]{2,}/g, '_').replace(/^[_-]|[_-]$/g, '');
            }

            organizedName = `${datePrefix}_${cleanName}${fileExt}`;
          } else {
            // Fallback: Get file metadata for server_modified date (when uploaded to Dropbox)
            try {
              const metadata = await dropboxService.getFileMetadata(filePath);
              if (metadata.server_modified) {
                const uploadDate = new Date(metadata.server_modified);
                detectedDate = uploadDate.toISOString().slice(0, 10).replace(/-/g, '.');
                dateSource = 'dropbox-upload';
                const datePrefix = formatDateForFilename(uploadDate);

                let cleanName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
                organizedName = `${datePrefix}_${cleanName}${fileExt}`;
              }
            } catch (metadataError) {
              // If metadata fails, use current date as last resort
              const fallbackDate = new Date();
              detectedDate = fallbackDate.toISOString().slice(0, 10).replace(/-/g, '.');
              dateSource = 'processing-date';
              const datePrefix = formatDateForFilename(fallbackDate);

              let cleanName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
              organizedName = `${datePrefix}_${cleanName}${fileExt}`;
            }
          }
        } catch (error) {
          console.error(`Error processing date for ${fileName}:`, error);
          // Keep original filename if date processing fails
          organizedName = fileName;
          dateSource = 'original-preserved';
        }
      } else {
        dateSource = 'already-has-date';
        detectedDate = 'preserved';
        // Extract date from existing prefix for live recordings clustering
        const match = fileName.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
          detectedDate = `${match[1]}-${match[2]}-${match[3]}`;
        }
      }

      // For live recordings, determine the date-based folder
      if (category === 'live-recording' && detectedDate && detectedDate !== 'preserved') {
        try {
          const dateFolderPath = await findOrCreateDateFolder(dropboxService, basePath, detectedDate);
          targetFolder = dateFolderPath;

          // Track if we created a folder (any date folder counts as created)
          if (dateFolderPath.includes(detectedDate)) {
            folderCreated = detectedDate;
          }
        } catch (error) {
          console.error('Error creating date folder:', error);
          // Skip this file rather than falling back to year folder
          results.push({
            fileName,
            originalPath: filePath,
            newPath: filePath,
            category,
            status: 'error',
            message: `Failed to create date folder: ${error}`,
            detectedDate,
            dateSource
          });
          continue;
        }
      } else if (category === 'live-recording') {
        // For live recordings without proper date, use current date to create a date folder
        try {
          const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
          const dateFolderPath = await findOrCreateDateFolder(dropboxService, basePath, currentDate);
          targetFolder = dateFolderPath;
          detectedDate = currentDate;
          dateSource = 'current-date-fallback';
          folderCreated = currentDate;
        } catch (error) {
          console.error('Error creating current date folder:', error);
          // Skip this file rather than falling back to year folder
          results.push({
            fileName,
            originalPath: filePath,
            newPath: filePath,
            category,
            status: 'error',
            message: `Failed to create date folder for current date: ${error}`,
            detectedDate: 'failed',
            dateSource: 'failed'
          });
          continue;
        }
      }

      const newPath = `${targetFolder}/${organizedName}`;

      try {
        if (action === 'preview') {
          // Just return what would happen
          results.push({
            fileName,
            originalPath: filePath,
            newPath,
            category,
            status: 'success',
            detectedDate,
            dateSource,
            folderCreated
          });
        } else if (action === 'process') {
          // Actually move the file
          await dropboxService.moveFile(filePath, newPath);

          // Log the activity
          await activityLogger.logActivity({
            action: 'organize',
            filePath: newPath,
            oldPath: filePath,
            newPath: newPath,
            details: {
              originalName: fileName,
              newName: organizedName,
              category,
              dateSource,
              detectedDate,
              folderCreated
            }
          });

          results.push({
            fileName,
            originalPath: filePath,
            newPath,
            category,
            status: 'success',
            message: `Moved to ${category}`,
            detectedDate,
            dateSource,
            folderCreated
          });
        }
      } catch (error: any) {
        console.error(`Error processing ${fileName}:`, error);
        results.push({
          fileName,
          originalPath: filePath,
          newPath,
          category,
          status: 'error',
          message: error.message || 'Failed to process',
          detectedDate,
          dateSource
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const foldersCreated = results.filter(r => r.folderCreated).length;

    let message = action === 'preview'
      ? `Found ${files.length} files to process (${skippedCount} will be skipped)`
      : `Processed ${successCount} of ${files.length} files (${skippedCount} skipped)`;

    if (foldersCreated > 0) {
      message += `. Created ${foldersCreated} date-based folders.`;
    }

    return NextResponse.json({
      message,
      results,
      processed: successCount,
      skipped: skippedCount,
      foldersCreated,
      total: files.length
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('Error processing uploads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process uploads' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}