import { NextRequest, NextResponse } from 'next/server';
import { DropboxService } from '@/lib/dropbox';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface FileContext {
  currentPath: string;
  files: Array<{
    name: string;
    type: string;
    path: string;
    size?: number;
    modified?: string;
  }>;
  fileCount: number;
  folderStructure: string[];
  audioFiles: string[];
  textFiles: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { message, context, conversationHistory } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400, headers: getCorsHeaders() });
    }

    // Get auth tokens from cookies
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders() });
    }

    const fileContext = context as FileContext;

    // Build system prompt with music production context
    const systemPrompt = `You are an AI assistant specialized in music production and file management. You help musicians organize their files, write lyrics, and manage their creative projects.

Current Context:
- Location: ${fileContext.currentPath || 'Root directory'}
- Total files: ${fileContext.fileCount}
- Audio files: ${fileContext.audioFiles.length} (${fileContext.audioFiles.slice(0, 5).join(', ')}${fileContext.audioFiles.length > 5 ? '...' : ''})
- Text/lyrics files: ${fileContext.textFiles.length} (${fileContext.textFiles.slice(0, 5).join(', ')}${fileContext.textFiles.length > 5 ? '...' : ''})
- Folders: ${fileContext.folderStructure.join(', ')}

Capabilities:
1. File Organization: Help organize music files, create folder structures, rename files
2. Lyrics Writing: Assist with songwriting, rhyme schemes, song structure, generate complete lyrics
3. Music Production: Give advice on recording, mixing, collaboration
4. Document Creation: Help create lyrics documents, song notes, collaboration docs
5. Creative Assistance: Help with song concepts, themes, chord progressions, arrangement ideas

Guidelines:
- Be concise but helpful
- Focus on practical music production advice
- Suggest specific file operations when relevant
- Use music terminology appropriately
- Be encouraging and creative
- For lyrics requests, offer to create complete song lyrics

When suggesting file operations, format them as:
[FILE_OP: operation_type:file_path1,file_path2]

Available operations:
- CREATE_FOLDER: Create new folders
- RENAME_FILE: Rename files
- MOVE_FILE: Move files between folders
- CREATE_DOCUMENT: Create new text/lyrics files
- CREATE_LYRICS: Generate complete song lyrics and save to Dropbox
- ORGANIZE_BY_DATE: Auto-organize files by date
- ORGANIZE_BY_TYPE: Auto-organize files by type

For lyrics creation, you can suggest:
"I can help you write complete song lyrics! Just tell me:
- Song theme or concept
- Musical style/genre
- Mood/emotion
- Any specific ideas or lines you have
Then I'll create professional lyrics and save them to your Lyrics folder."`;

    // Prepare conversation history for OpenAI
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-5).forEach((msg: ChatMessage) => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";

    // Parse for file operations
    const fileOperations: Array<{operation: string, files: string[]}> = [];
    const fileOpRegex = /\[FILE_OP:\s*(\w+):([^\]]+)\]/g;
    let match;
    
    while ((match = fileOpRegex.exec(aiResponse)) !== null) {
      const operation = match[1];
      const files = match[2].split(',').map(f => f.trim());
      fileOperations.push({ operation, files });
    }

    // Clean response of file operation tags
    const cleanResponse = aiResponse.replace(fileOpRegex, '').trim();

    return NextResponse.json({
      response: cleanResponse,
      fileOperations: fileOperations.length > 0 ? fileOperations : undefined
    }, { headers: getCorsHeaders() });

  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}