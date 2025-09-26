import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { AudioClusteringService, AudioFingerprint, AudioCluster } from '@/lib/audio-clustering';
import { activityLogger } from '@/lib/activity-log';

// Helper function to generate smart cluster folder names
function generateClusterFolderName(cluster: AudioCluster, files: string[], existingFolders: string[] = []): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Extract potential song name from cluster analysis
  let songTitle = '';

  // 1. Try to get song name from cluster name (remove "- Takes" or "- Variations" suffix)
  const clusterBaseName = cluster.name
    .replace(/\s*-\s*(Takes|Variations|Recording Session)\s*\([^)]+\).*$/i, '')
    .trim();

  if (clusterBaseName && clusterBaseName !== 'Similar Audio' && clusterBaseName !== 'Recording Session') {
    songTitle = clusterBaseName;
  }

  // 2. If no good song name found, try to extract from filename patterns
  if (!songTitle) {
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
    });

    // Find the most common song title candidate
    if (songCandidates.size > 0) {
      const candidateArray = Array.from(songCandidates);
      // Prefer longer, more descriptive titles
      candidateArray.sort((a, b) => b.length - a.length);
      songTitle = candidateArray[0];
    }
  }

  // 3. Clean up song title for folder use
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
  }

  // 4. Generate final folder name
  let folderName;
  if (songTitle) {
    folderName = `${dateStr}_${songTitle}`;
  } else {
    // Fallback to simple digit suffix
    let suffix = 1;
    do {
      folderName = `${dateStr}_${suffix.toString().padStart(2, '0')}`;
      suffix++;
    } while (existingFolders.some(folder => folder.includes(folderName)));
  }

  return folderName;
}

// Helper function to handle "379 ch" file renaming
function generateNewFileName(originalPath: string, dateStr: string, index: number): string {
  const fileName = originalPath.split('/').pop() || '';
  const extension = fileName.split('.').pop() || 'mp3';

  // Check if this is a "379 ch" file that needs special renaming
  if (fileName.toLowerCase().includes('379') && fileName.toLowerCase().includes('ch')) {
    return `${dateStr}_${(index + 1).toString().padStart(2, '0')}.${extension}`;
  }

  // For regular files, keep original name
  return fileName;
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

    const body = await request.json();
    const {
      folderPath,
      action = 'analyze',
      cluster_id,
      files,
      cluster_name,
      cluster_category,
      cluster_confidence
    } = body;

    if (!folderPath && !files) {
      return NextResponse.json(
        { error: 'Folder path or files array is required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const dropboxService = new DropboxService(authTokens.access_token);
    const clusteringService = new AudioClusteringService(dropboxService);

    if (action === 'analyze') {
      // Get audio files from folder or use provided files
      let audioFiles;

      if (files && Array.isArray(files)) {
        // Use provided file paths
        audioFiles = files.map((filePath: string) => ({
          name: filePath.split('/').pop(),
          path_display: filePath,
          '.tag': 'file',
          size: 0,
          server_modified: new Date().toISOString()
        }));
      } else {
        // Get files from folder
        const filesResponse = await dropboxService.listFiles(folderPath);
        audioFiles = filesResponse.filter((entry: any) => {
          if (entry['.tag'] !== 'file') return false;
          const fileName = entry.name.toLowerCase();
          return ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'].some(ext =>
            fileName.endsWith(ext)
          );
        });
      }

      if (audioFiles.length < 2) {
        return NextResponse.json({
          message: 'Need at least 2 audio files to perform clustering',
          fingerprints: [],
          clusters: []
        }, { headers: getCorsHeaders() });
      }

      console.log(`Analyzing ${audioFiles.length} audio files for clustering...`);

      // Extract fingerprints for all audio files
      const fingerprints: AudioFingerprint[] = [];
      const errors: string[] = [];
      const progressMessages: string[] = [];

      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        try {
          console.log(`[${i + 1}/${audioFiles.length}] Extracting fingerprint for: ${file.name}`);

          const fingerprint = await clusteringService.extractFingerprint(
            file.path_display,
            file,
            (message) => {
              const progressMsg = `[${i + 1}/${audioFiles.length}] ${message}`;
              console.log(progressMsg);
              progressMessages.push(progressMsg);
            }
          );

          fingerprints.push(fingerprint);
          progressMessages.push(`✓ [${i + 1}/${audioFiles.length}] Completed ${file.name}`);

        } catch (error) {
          const errorMsg = `✗ [${i + 1}/${audioFiles.length}] Failed ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          progressMessages.push(errorMsg);
        }
      }

      if (fingerprints.length < 2) {
        return NextResponse.json({
          error: 'Could not analyze enough files for clustering',
          details: errors,
          fingerprints: [],
          clusters: []
        }, { status: 500, headers: getCorsHeaders() });
      }

      // Debug: Log some sample fingerprints for analysis
      console.log('Sample fingerprints for debugging:');
      fingerprints.slice(0, 3).forEach((fp, i) => {
        console.log(`  ${i + 1}. ${fp.fileName} - tokens: [${fp.features.filenameTokens.join(', ')}]`);
      });

      // Perform clustering (let the system pick the optimal threshold automatically)
      console.log(`Clustering ${fingerprints.length} fingerprints with auto-selected optimal threshold...`);
      const clusters = clusteringService.clusterAudioFiles(fingerprints);

      // Debug: Log clustering results
      console.log(`Clustering completed. Found ${clusters.length} clusters.`);
      if (clusters.length > 0) {
        clusters.forEach((cluster, i) => {
          console.log(`  Cluster ${i + 1}: ${cluster.name} (${cluster.files.length} files, confidence: ${cluster.confidence})`);
        });
      } else {
        console.log('No clusters found. This might indicate:');
        console.log('  - Similarity threshold is too high (try 0.4 or lower)');
        console.log('  - Files have very different naming patterns');
        console.log('  - Files are from different recording sessions');
      }

      // Log the activity
      await activityLogger.logActivity({
        action: 'audio_cluster_analysis',
        filePath: folderPath || 'custom_files',
        details: {
          audioFilesAnalyzed: fingerprints.length,
          clustersFound: clusters.length,
          thresholdSelection: 'automatic',
          errors: errors.length
        }
      });

      console.log(`Found ${clusters.length} clusters from ${fingerprints.length} files`);

      return NextResponse.json({
        message: `Successfully analyzed ${fingerprints.length} audio files and found ${clusters.length} clusters`,
        fingerprints,
        clusters,
        errors: errors.length > 0 ? errors : undefined,
        progressMessages,
        statistics: {
          totalFiles: audioFiles.length,
          analyzedFiles: fingerprints.length,
          clustersFound: clusters.length,
          unclusteredFiles: fingerprints.length - clusters.reduce((sum, cluster) => sum + cluster.files.length, 0),
          averageClusterSize: clusters.length > 0 ?
            clusters.reduce((sum, cluster) => sum + cluster.files.length, 0) / clusters.length : 0,
          processingTime: Date.now() - Date.now() // Will be calculated properly
        }
      }, { headers: getCorsHeaders() });

    } else if (action === 'organize_cluster') {
      // Organize files in a cluster into a subfolder
      if (!cluster_id || !files || !Array.isArray(files)) {
        return NextResponse.json(
          { error: 'cluster_id and files array are required for organize action' },
          { status: 400, headers: getCorsHeaders() }
        );
      }

      console.log('Organization request received:', { cluster_id, cluster_name, cluster_category, cluster_confidence, filesCount: files.length });

      // Re-analyze the files to get cluster information for better naming
      let cluster: AudioCluster | null = null;
      try {
        // Quick re-analysis for folder naming
        if (files.length > 0) {
          const fingerprints: AudioFingerprint[] = [];

          // Get metadata for the files to help with folder naming
          for (const filePath of files) {
            const fileName = filePath.split('/').pop() || '';
            const fileMetadata = await dropboxService.getFileMetadata(filePath);

            const fingerprint = await clusteringService.extractFingerprint(
              filePath,
              fileMetadata
            );
            fingerprints.push(fingerprint);
          }

          // Create a mock cluster for naming purposes
          cluster = {
            id: cluster_id,
            name: cluster_name || 'Audio Cluster',
            files: fingerprints,
            averageDuration: fingerprints.reduce((sum, fp) => sum + fp.duration, 0) / fingerprints.length,
            confidence: cluster_confidence || 0.7,
            suggestedCategory: cluster_category || 'similar_ideas',
            createdDate: new Date()
          };
        }
      } catch (clusterError) {
        console.log('Could not re-analyze for folder naming, using fallback');
      }

      // Get existing folders in the directory to avoid naming conflicts
      const basePath = folderPath || files[0].split('/').slice(0, -1).join('/');
      let existingFolders: string[] = [];
      try {
        const existingFiles = await dropboxService.listFiles(basePath);
        existingFolders = existingFiles
          .filter((entry: any) => entry['.tag'] === 'folder')
          .map((entry: any) => entry.name);
      } catch (error) {
        console.log('Could not fetch existing folders, proceeding without conflict checking');
      }

      // Generate smart folder name using date_songname convention
      const clusterFolderName = cluster ?
        generateClusterFolderName(cluster, files, existingFolders) :
        `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_cluster_${cluster_id}`;

      const clusterFolderPath = `${basePath}/${clusterFolderName}`;

      const results = [];
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

      try {
        // Create cluster folder
        await dropboxService.createFolder(clusterFolderPath);

        // Sort files by creation date for consistent "379 ch" numbering
        const sortedFiles = [...files].sort((a, b) => {
          // Try to extract date from filename or use current date
          return a.localeCompare(b);
        });

        // Move and potentially rename files
        for (let i = 0; i < sortedFiles.length; i++) {
          const filePath = sortedFiles[i];
          try {
            const newFileName = generateNewFileName(filePath, dateStr, i);
            const newPath = `${clusterFolderPath}/${newFileName}`;

            await dropboxService.moveFile(filePath, newPath);

            results.push({
              originalPath: filePath,
              newPath,
              newFileName,
              status: 'success',
              renamed: newFileName !== filePath.split('/').pop()
            });

          } catch (moveError) {
            console.error(`Error moving file ${filePath}:`, moveError);
            results.push({
              originalPath: filePath,
              newPath: null,
              status: 'error',
              error: moveError instanceof Error ? moveError.message : 'Unknown error'
            });
          }
        }

        // Log the organization activity
        await activityLogger.logActivity({
          action: 'organize_audio_cluster',
          filePath: clusterFolderPath,
          details: {
            clusterId: cluster_id,
            clusterFolderName,
            filesOrganized: results.filter(r => r.status === 'success').length,
            totalFiles: files.length,
            renamedFiles: results.filter(r => r.status === 'success' && r.renamed).length,
            namingConvention: 'date_songname'
          }
        });

        const successCount = results.filter(r => r.status === 'success').length;
        const renamedCount = results.filter(r => r.status === 'success' && r.renamed).length;

        let message = `Successfully organized ${successCount} of ${files.length} files into cluster folder: ${clusterFolderName}`;
        if (renamedCount > 0) {
          message += `\n${renamedCount} files were renamed using date+digit convention`;
        }

        return NextResponse.json({
          message,
          clusterFolderPath,
          clusterFolderName,
          results
        }, { headers: getCorsHeaders() });

      } catch (error) {
        console.error('Error organizing cluster:', error);
        return NextResponse.json({
          error: 'Failed to organize cluster',
          details: error instanceof Error ? error.message : 'Unknown error',
          results
        }, { status: 500, headers: getCorsHeaders() });
      }

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "analyze" or "organize_cluster"' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

  } catch (error) {
    console.error('Audio clustering error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform audio clustering',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('folder');

    if (!folderPath) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const dropboxService = new DropboxService(authTokens.access_token);

    // Get audio files from folder
    const filesResponse = await dropboxService.listFiles(folderPath);
    const audioFiles = filesResponse.filter((entry: any) => {
      if (entry['.tag'] !== 'file') return false;
      const fileName = entry.name.toLowerCase();
      return ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'].some(ext =>
        fileName.endsWith(ext)
      );
    });

    return NextResponse.json({
      message: `Found ${audioFiles.length} audio files in ${folderPath}`,
      audioFiles: audioFiles.map((file: any) => ({
        name: file.name,
        path: file.path_display,
        size: file.size,
        modified: file.server_modified
      }))
    }, { headers: getCorsHeaders() });

  } catch (error) {
    console.error('Error listing audio files:', error);
    return NextResponse.json(
      {
        error: 'Failed to list audio files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}