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
    const {
      prompt,
      songTitle,
      songStructure,
      theme,
      style,
      mood,
      targetAudience,
      personalContext,
      specificInstructions,
      referenceArtists,
      keyWords,
      avoidWords
    } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400, headers: getCorsHeaders() });
    }

    // Get auth tokens from cookies
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const dropboxService = new DropboxService(authTokens.access_token);

    // Build a comprehensive lyrics generation prompt with rich context
    const lyricsPrompt = `You are a professional songwriter and lyricist with decades of experience across multiple genres. Create song lyrics based on the following detailed requirements:

## CORE CONCEPT
Prompt: ${prompt}

## SONG DETAILS
${songTitle ? `Song Title: ${songTitle}` : ''}
${theme ? `Theme: ${theme}` : ''}
${mood ? `Mood/Emotion: ${mood}` : ''}
${style ? `Musical Style: ${style}` : ''}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}
${songStructure ? `Structure: ${songStructure}` : 'Structure: Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus'}

## CREATIVE CONTEXT
${personalContext ? `Personal Context: ${personalContext}` : ''}
${referenceArtists ? `Reference Artists/Songs: ${referenceArtists}` : ''}
${keyWords ? `Key Words to Include: ${keyWords}` : ''}
${avoidWords ? `Words/Themes to Avoid: ${avoidWords}` : ''}

## SPECIFIC INSTRUCTIONS
${specificInstructions || 'Create emotionally resonant lyrics that tell a compelling story'}

## PROFESSIONAL REQUIREMENTS
1. Create complete, polished lyrics with clear structure and flow
2. Include section labels (Verse, Chorus, Bridge, etc.) in [BRACKETS]
3. Make the lyrics emotionally resonant and meaningful
4. Use appropriate rhyme schemes and meter for the musical style
5. Consider the musical genre in word choice, rhythm, and phrasing
6. Ensure lyrics are singable and memorable
7. Create strong hooks and memorable phrases
8. Maintain thematic consistency throughout
9. Include internal rhymes and wordplay where appropriate
10. Consider syllable count and natural emphasis for singing

## OUTPUT FORMAT
---
SONG TITLE: ${songTitle || '[Generated Title]'}
ARTIST: [Artist Name]
GENRE: ${style || '[Genre]'}
MOOD: ${mood || '[Mood]'}
WRITTEN: ${new Date().toLocaleDateString()}
TEMPO/FEEL: [Suggested tempo and feel]

[VERSE 1]
[Lyrics with natural rhythm and rhyme]

[CHORUS]
[Catchy, memorable chorus lyrics]

[VERSE 2]
[Second verse that advances the story/theme]

[CHORUS]
[Repeat chorus]

[BRIDGE]
[Bridge section with different perspective or twist]

[CHORUS]
[Final chorus, possibly with variations]

[OUTRO] (if appropriate)
[Optional outro section]
---

Create lyrics that are professional, emotionally engaging, and ready for recording. Make sure every line serves the song's emotional journey and tells a cohesive story.`;

    // Generate lyrics with OpenAI using enhanced system prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a world-class songwriter and lyricist with expertise in multiple genres including pop, rock, country, R&B, folk, hip-hop, and alternative music.

Your specialties include:
- Crafting emotionally resonant narratives through lyrics
- Creating memorable hooks and choruses
- Adapting writing style to different musical genres
- Understanding rhythm, meter, and how lyrics interact with melody
- Writing for different target audiences and contexts
- Using literary devices like metaphor, imagery, and wordplay effectively

You have written hits for major artists and understand both commercial appeal and artistic integrity. You create lyrics that are both meaningful and singable, with strong emotional core and universal themes that connect with listeners.

Always consider:
- How the lyrics will sound when sung
- The natural emphasis and flow of words
- Creating emotional peaks and valleys throughout the song
- Building to satisfying resolutions
- Using concrete imagery and specific details
- Balancing universal themes with unique perspectives`
        },
        {
          role: 'user',
          content: lyricsPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const generatedLyrics = completion.choices[0]?.message?.content || "Unable to generate lyrics.";

    // Create filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM
    const titleSlug = (songTitle || 'New Song').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${dateStr}_${timeStr}_${titleSlug}.lyrics`;
    
    // Save to both Dropbox and Google Docs
    const lyricsFolder = '/Music/Fiasco Total/Lyrics/2025';
    const filePath = `${lyricsFolder}/${filename}`;

    const results = {
      success: true,
      lyrics: generatedLyrics,
      dropbox: null as any,
      googleDocs: null as any,
      errors: [] as string[]
    };

    // Try to save to Dropbox
    try {
      // Create lyrics folder if it doesn't exist
      await dropboxService.createFolder(lyricsFolder).catch(() => {
        // Folder might already exist, ignore error
      });

      // Upload the lyrics file
      await dropboxService.uploadFile(
        filePath,
        Buffer.from(generatedLyrics, 'utf-8')
      );

      results.dropbox = {
        filePath,
        filename,
        message: `Lyrics saved to Dropbox: ${filePath}`
      };

    } catch (dropboxError) {
      console.error('Error uploading to Dropbox:', dropboxError);
      results.errors.push(`Dropbox save failed: ${dropboxError instanceof Error ? dropboxError.message : 'Unknown error'}`);
    }

    // Try to save to Google Docs (only if configured)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const { GoogleDriveService } = await import('@/lib/google-drive');

        const googleDriveService = new GoogleDriveService({
          serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
        });

        // Find or create the Lyrics folder
        const lyricsFolderId = await googleDriveService.findOrCreateLyricsFolder();

        // Generate base title with date and song name
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const songName = songTitle || 'Untitled Song';
        const baseTitle = `${dateStr} - ${songName}`;

        // Get existing documents to check for conflicts
        const existingDocs = await googleDriveService.listDocumentsInFolder(lyricsFolderId, dateStr);
        const existingTitles = existingDocs.map(doc => doc.name);

        // Generate unique title
        const uniqueTitle = googleDriveService.generateUniqueTitle(baseTitle, existingTitles);

        // Format lyrics for Google Docs
        const formattedLyrics = GoogleDriveService.formatLyricsForGoogleDocs(generatedLyrics, songName, style, mood);

        // Create the Google Doc
        const docResult = await googleDriveService.createDocument(
          uniqueTitle,
          formattedLyrics,
          lyricsFolderId
        );

        results.googleDocs = {
          documentId: docResult.id,
          documentUrl: docResult.url,
          title: uniqueTitle,
          message: `Lyrics saved to Google Docs: ${uniqueTitle}`
        };

        // Log the activity
        await activityLogger.logActivity({
          action: 'create_lyrics_doc',
          filePath: docResult.url,
          details: {
            documentId: docResult.id,
            title: uniqueTitle,
            songTitle: songName,
            style,
            mood,
            platform: 'google_docs',
            dropboxSaved: !!results.dropbox
          }
        });

      } catch (googleError) {
        console.error('Error saving to Google Docs:', googleError);
        results.errors.push(`Google Docs save failed: ${googleError instanceof Error ? googleError.message : 'Unknown error'}`);
      }
    } else {
      results.errors.push('Google Docs integration not configured (missing GOOGLE_SERVICE_ACCOUNT_KEY)');
    }

    // Return comprehensive results
    let message = 'Lyrics generated';
    if (results.dropbox && results.googleDocs) {
      message = `Lyrics saved to both Dropbox and Google Docs!`;
    } else if (results.dropbox) {
      message = `Lyrics saved to Dropbox (Google Docs ${results.errors.find(e => e.includes('Google')) ? 'failed' : 'not configured'})`;
    } else if (results.googleDocs) {
      message = `Lyrics saved to Google Docs (Dropbox ${results.errors.find(e => e.includes('Dropbox')) ? 'failed' : 'not configured'})`;
    } else {
      message = `Lyrics generated but save failed: ${results.errors.join(', ')}`;
    }

    return NextResponse.json({
      ...results,
      message
    }, { headers: getCorsHeaders() });

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