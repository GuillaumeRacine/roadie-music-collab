import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';

interface GroupedFiles {
  groupName: string;
  folderPath: string;
  files: Array<{
    name: string;
    path_display: string;
    size?: number;
  }>;
  reason: string;
  confidence: number;
}

// POST: Analyze files for organization suggestions
export async function POST(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const { path, strategy = 'all' } = await request.json();
    const dropboxService = new DropboxService(authTokens.access_token);
    const files = await dropboxService.listFiles(path);

    const suggestions: GroupedFiles[] = [];

    // Only process files, not folders
    const audioFiles = files.filter(f =>
      f['.tag'] === 'file' &&
      ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'].some(ext =>
        f.name.toLowerCase().endsWith(ext)
      )
    );

    if (strategy === 'date' || strategy === 'all') {
      // Group by upload date
      const dateGroups = new Map<string, any[]>();

      audioFiles.forEach(file => {
        if (file.server_modified) {
          const date = new Date(file.server_modified);
          const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

          if (!dateGroups.has(dateKey)) {
            dateGroups.set(dateKey, []);
          }
          dateGroups.get(dateKey)!.push(file);
        }
      });

      dateGroups.forEach((groupFiles, date) => {
        if (groupFiles.length > 1) {
          suggestions.push({
            groupName: `Recording Session ${date}`,
            folderPath: `${path}/${date.replace(/-/g, '')}`,
            files: groupFiles.map(f => ({
              name: f.name,
              path_display: f.path_display,
              size: f.size
            })),
            reason: `${groupFiles.length} files uploaded on the same day`,
            confidence: 0.8
          });
        }
      });
    }

    if (strategy === 'similarity' || strategy === 'all') {
      // Group by name similarity
      const nameGroups = new Map<string, any[]>();

      audioFiles.forEach(file => {
        const baseName = file.name
          .replace(/\.(mp3|wav|m4a|aac|ogg|flac)$/i, '')
          .replace(/[_-]\d+$/, '') // Remove trailing numbers
          .replace(/\d{8}_\d{4}_/, ''); // Remove date/time prefixes

        if (!nameGroups.has(baseName)) {
          nameGroups.set(baseName, []);
        }
        nameGroups.get(baseName)!.push(file);
      });

      nameGroups.forEach((groupFiles, baseName) => {
        if (groupFiles.length > 1) {
          suggestions.push({
            groupName: baseName,
            folderPath: `${path}/${baseName.replace(/[^a-zA-Z0-9]/g, '_')}`,
            files: groupFiles.map(f => ({
              name: f.name,
              path_display: f.path_display,
              size: f.size
            })),
            reason: `${groupFiles.length} files with similar names (likely same song/session)`,
            confidence: 0.9
          });
        }
      });
    }

    if (strategy === 'timing' || strategy === 'all') {
      // Group by upload timing (within 30 minutes)
      const sortedFiles = [...audioFiles].sort((a, b) => {
        const timeA = new Date(a.server_modified || 0).getTime();
        const timeB = new Date(b.server_modified || 0).getTime();
        return timeA - timeB;
      });

      const timeGroups: any[][] = [];
      let currentGroup: any[] = [];

      sortedFiles.forEach((file, index) => {
        if (index === 0) {
          currentGroup.push(file);
        } else {
          const prevTime = new Date(sortedFiles[index - 1].server_modified || 0).getTime();
          const currTime = new Date(file.server_modified || 0).getTime();

          if (currTime - prevTime <= 30 * 60 * 1000) { // 30 minutes
            currentGroup.push(file);
          } else {
            if (currentGroup.length > 1) {
              timeGroups.push(currentGroup);
            }
            currentGroup = [file];
          }
        }
      });

      if (currentGroup.length > 1) {
        timeGroups.push(currentGroup);
      }

      timeGroups.forEach((group, index) => {
        const firstFile = group[0];
        const date = new Date(firstFile.server_modified || Date.now());
        const sessionName = `Session_${date.toISOString().split('T')[0]}_${index + 1}`;

        suggestions.push({
          groupName: sessionName,
          folderPath: `${path}/${sessionName}`,
          files: group.map(f => ({
            name: f.name,
            path_display: f.path_display,
            size: f.size
          })),
          reason: `${group.length} files uploaded within 30 minutes of each other`,
          confidence: 0.7
        });
      });
    }

    // Remove duplicate suggestions
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex((s) =>
        s.folderPath === suggestion.folderPath
      )
    );

    return NextResponse.json({ suggestions: uniqueSuggestions }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('Error analyzing files:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze files' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// PUT: Execute organization based on suggestions
export async function PUT(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const { suggestions } = await request.json();
    const dropboxService = new DropboxService(authTokens.access_token);

    const results = [];

    for (const suggestion of suggestions) {
      try {
        // Create the folder
        await dropboxService.createFolder(suggestion.folderPath);

        // Move files to the folder
        for (const file of suggestion.files) {
          const newPath = `${suggestion.folderPath}/${file.name}`;
          await dropboxService.moveFile(file.path_display, newPath);
        }

        results.push({
          groupName: suggestion.groupName,
          success: true,
          movedCount: suggestion.files.length
        });
      } catch (error: any) {
        results.push({
          groupName: suggestion.groupName,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({ results }, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('Error organizing files:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to organize files' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}