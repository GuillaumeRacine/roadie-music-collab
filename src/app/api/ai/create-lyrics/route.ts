import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, songTitle, songStructure, theme, style } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400, headers: getCorsHeaders() });
    }

    // Get auth tokens from cookies
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const dropboxService = new DropboxService({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!
    });

    // Build a comprehensive lyrics generation prompt
    const lyricsPrompt = `You are a professional songwriter and lyricist. Create song lyrics based on the following requirements:

Prompt: ${prompt}
${songTitle ? `Song Title: ${songTitle}` : ''}
${theme ? `Theme/Mood: ${theme}` : ''}
${style ? `Musical Style: ${style}` : ''}
${songStructure ? `Structure: ${songStructure}` : 'Structure: Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus'}

Requirements:
1. Create complete, polished lyrics with clear structure
2. Include section labels (Verse, Chorus, Bridge, etc.)
3. Make the lyrics emotionally resonant and meaningful
4. Use appropriate rhyme schemes and meter
5. Consider the musical style in word choice and rhythm

Format the output as:
---
SONG TITLE: [Title]
ARTIST: [Leave blank for artist to fill]
STYLE: [Musical style]
WRITTEN: [Current date]

[Section labels and lyrics]
---

Make it professional and ready for recording.`;

    // Generate lyrics with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional songwriter with expertise in various musical genres. Create high-quality, original lyrics that are meaningful and well-structured.'
        },
        {
          role: 'user',
          content: lyricsPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
    });

    const generatedLyrics = completion.choices[0]?.message?.content || "Unable to generate lyrics.";

    // Create filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM
    const titleSlug = (songTitle || 'New Song').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${dateStr}_${timeStr}_${titleSlug}.lyrics`;
    
    // Save to Dropbox in the Lyrics folder
    const lyricsFolder = '/Music/Fiasco Total/Lyrics/2025';
    const filePath = `${lyricsFolder}/${filename}`;
    
    try {
      // Create lyrics folder if it doesn't exist
      await dropboxService.createFolder(authTokens.access_token, lyricsFolder).catch(() => {
        // Folder might already exist, ignore error
      });
      
      // Upload the lyrics file
      const uploadResult = await dropboxService.uploadFile(
        authTokens.access_token,
        filePath,
        Buffer.from(generatedLyrics, 'utf-8')
      );

      return NextResponse.json({
        success: true,
        lyrics: generatedLyrics,
        filePath,
        filename,
        message: `Lyrics saved to ${filePath}`
      }, { headers: getCorsHeaders() });

    } catch (uploadError) {
      console.error('Error uploading lyrics:', uploadError);
      
      // Return the lyrics even if upload fails
      return NextResponse.json({
        success: true,
        lyrics: generatedLyrics,
        uploadError: 'Failed to save to Dropbox',
        message: 'Lyrics generated but could not be saved to Dropbox'
      }, { headers: getCorsHeaders() });
    }

  } catch (error) {
    console.error('Lyrics creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create lyrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}