import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accessToken = formData.get('token') as string;

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      accessToken
    });

    const result = await moveLiveRecordingsToUploads(dropboxService);

    return NextResponse.json({ 
      success: true, 
      message: `Moved ${result.movedCount} files from Live Recordings to New Uploads`,
      details: result.details
    });
  } catch (error) {
    console.error('Error moving live recordings:', error);
    return NextResponse.json({ error: 'Failed to move live recordings' }, { status: 500 });
  }
}

async function moveLiveRecordingsToUploads(dropboxService: DropboxService) {
  const liveRecordingsPath = '/Music/Fiasco Total/Live Recordings';
  const uploadsPath = '/Music/Fiasco Total/New Uploads';
  
  const results = {
    movedCount: 0,
    details: [] as string[]
  };

  // List of files I can see from your screenshot
  const filesToMove = [
    '20250828_08.m4a',
    '20250828_09.m4a', 
    '20250828_10.m4a',
    '20250828_11.m4a',
    '20250828_12.m4a',
    '20250828_13.m4a',
    '20250828_14.m4a',
    '20250828_15.m4a',
    '20250828_16.m4a',
    '20250828_17.m4a',
    '20250828_18.m4a',
    '20250828_19.m4a',
    '20250828_20.m4a',
    '20250828_21.m4a',
    '20250828_22.m4a',
    '20250902.m4a'
  ];

  for (const fileName of filesToMove) {
    const oldPath = `${liveRecordingsPath}/${fileName}`;
    const newPath = `${uploadsPath}/${fileName}`;
    
    try {
      await dropboxService.moveFile(oldPath, newPath);
      results.movedCount++;
      results.details.push(`Moved: ${fileName}`);
      console.log(`Moved: ${oldPath} -> ${newPath}`);
    } catch (moveError) {
      console.error(`Failed to move ${oldPath}:`, moveError);
      results.details.push(`Failed to move: ${fileName} (${moveError})`);
    }
  }

  return results;
}