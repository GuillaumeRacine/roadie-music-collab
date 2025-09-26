import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

// Helper function to generate new cluster folder name based on contents
function generateClusterFolderNameFromContents(files: string[]): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  let songTitle = '';
  const songCandidates = new Set<string>();

  files.forEach(filePath => {
    const fileName = filePath.split('/').pop() || '';
    const cleanFileName = fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/^\d{8}_\d{8}_/, '') // Remove double date prefix (20250922_20250828_)
      .replace(/^\d{8}_/, '') // Remove single date prefix
      .replace(/^\d{4}_/, '') // Remove time prefix (HHMM_)
      .trim();

    // Look for potential song titles in various formats
    const patterns = [
      // "Song Name_something" or "Song Name something"
      /^([A-Za-z][A-Za-z\s]{2,}?)[\s_-]/,
      // "Song Name.ext"
      /^([A-Za-z][A-Za-z\s]{2,})$/,
      // Handle cases like "Punk Rock", "Take It Easy", "Dirty Deeds"
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
    ];

    for (const pattern of patterns) {
      const match = cleanFileName.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
          songCandidates.add(candidate);
        }
      }
    }

    // Also check if the whole clean filename looks like a song title
    if (cleanFileName.length >= 3 &&
        cleanFileName.length <= 50 &&
        /^[A-Za-z]/.test(cleanFileName) &&
        !cleanFileName.match(/^\d+/) &&
        cleanFileName.split(/\s+/).length <= 6) {
      songCandidates.add(cleanFileName);
    }

    // Check for special patterns like "379 Ch du Tour"
    const specialMatch = cleanFileName.match(/379\s+Ch\s+du\s+Tour/i);
    if (specialMatch) {
      songCandidates.add('Ch du Tour');
    }
  });

  // Find the most common song title candidate
  if (songCandidates.size > 0) {
    const candidateArray = Array.from(songCandidates);
    // Prefer longer, more descriptive titles
    candidateArray.sort((a, b) => b.length - a.length);
    songTitle = candidateArray[0];
  }

  // Clean up song title for folder use
  if (songTitle) {
    songTitle = songTitle
      .replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
      .replace(/\s+/g, ' ')      // Normalize spaces
      .trim()
      .replace(/\s/g, '_');      // Replace spaces with underscores

    // Capitalize first letter of each word
    songTitle = songTitle.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join('_');

    return `${dateStr}_${songTitle}`;
  } else {
    // Fallback to simple digit suffix
    return `${dateStr}_01`;
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

    const { folderPath } = await request.json();

    if (!folderPath) {
      return NextResponse.json(
        { error: 'folderPath is required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const dropboxService = new DropboxService(authTokens.access_token);

    // Get all files and folders in the directory
    const entries = await dropboxService.listFiles(folderPath);

    // Find cluster folders (those starting with "cluster_")
    const clusterFolders = entries.filter((entry: any) =>
      entry['.tag'] === 'folder' && entry.name.startsWith('cluster_')
    );

    console.log(`Found ${clusterFolders.length} cluster folders to rename`);

    const renameResults = [];

    for (const folder of clusterFolders) {
      try {
        const oldPath = `${folderPath}/${folder.name}`;

        // Get the contents of the cluster folder
        const folderContents = await dropboxService.listFiles(oldPath);
        const fileNames = folderContents
          .filter((entry: any) => entry['.tag'] === 'file')
          .map((entry: any) => entry.name);

        console.log(`Analyzing cluster folder: ${folder.name} with ${fileNames.length} files`);

        // Generate new name based on contents
        const newFolderName = generateClusterFolderNameFromContents(fileNames);
        const newPath = `${folderPath}/${newFolderName}`;

        // Check if new name is different from old name
        if (newFolderName !== folder.name) {
          // Rename the folder
          await dropboxService.moveFile(oldPath, newPath);

          renameResults.push({
            oldName: folder.name,
            newName: newFolderName,
            oldPath,
            newPath,
            status: 'success',
            filesAnalyzed: fileNames.length
          });

          console.log(`Renamed: ${folder.name} → ${newFolderName}`);
        } else {
          renameResults.push({
            oldName: folder.name,
            newName: folder.name,
            status: 'no_change',
            filesAnalyzed: fileNames.length
          });
        }

      } catch (error) {
        console.error(`Error renaming folder ${folder.name}:`, error);
        renameResults.push({
          oldName: folder.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log the activity
    await activityLogger.logActivity({
      action: 'rename_cluster_folders',
      filePath: folderPath,
      details: {
        foldersProcessed: clusterFolders.length,
        successfulRenames: renameResults.filter(r => r.status === 'success').length,
        errors: renameResults.filter(r => r.status === 'error').length
      }
    });

    return NextResponse.json({
      message: `Processed ${clusterFolders.length} cluster folders`,
      results: renameResults,
      summary: {
        total: clusterFolders.length,
        renamed: renameResults.filter(r => r.status === 'success').length,
        noChange: renameResults.filter(r => r.status === 'no_change').length,
        errors: renameResults.filter(r => r.status === 'error').length
      }
    }, { headers: getCorsHeaders() });

  } catch (error) {
    console.error('Cluster rename error:', error);
    return NextResponse.json(
      {
        error: 'Failed to rename cluster folders',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}