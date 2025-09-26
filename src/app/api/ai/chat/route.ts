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

    // Load robot settings
    let robotSettings;
    try {
      const settingsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/ai/settings`, {
        method: 'GET',
      });
      if (settingsResponse.ok) {
        robotSettings = await settingsResponse.json();
      } else {
        // Use default settings if loading fails
        robotSettings = {
          systemPrompt: `You are an AI assistant specialized in music production and file management. You help musicians organize their files, write lyrics, and manage their creative projects.`,
          roleDescription: "Music Production Assistant & File Manager",
          temperature: 0.7,
          maxTokens: 1000,
          llmProvider: "OpenAI",
          model: "gpt-4o-mini",
          responseStyle: "concise_helpful",
          contextInstructions: "Always consider the current folder structure and file types when providing advice."
        };
      }
    } catch (error) {
      console.warn('Failed to load robot settings, using defaults:', error);
      robotSettings = {
        systemPrompt: `You are an AI assistant specialized in music production and file management. You help musicians organize their files, write lyrics, and manage their creative projects.`,
        roleDescription: "Music Production Assistant & File Manager",
        temperature: 0.7,
        maxTokens: 1000,
        llmProvider: "OpenAI",
        model: "gpt-4o-mini",
        responseStyle: "concise_helpful",
        contextInstructions: "Always consider the current folder structure and file types when providing advice."
      };
    }

    const fileContext = context as FileContext;

    // Build system prompt using robot settings
    const systemPrompt = `${robotSettings.systemPrompt}

Role: ${robotSettings.roleDescription}

Current Context:
- Location: ${fileContext.currentPath || 'Root directory'}
- Total files: ${fileContext.fileCount}
- Audio files: ${fileContext.audioFiles.length} (${fileContext.audioFiles.slice(0, 5).join(', ')}${fileContext.audioFiles.length > 5 ? '...' : ''})
- Text/lyrics files: ${fileContext.textFiles.length} (${fileContext.textFiles.slice(0, 5).join(', ')}${fileContext.textFiles.length > 5 ? '...' : ''})
- Folders: ${fileContext.folderStructure.join(', ')}

Capabilities:
${robotSettings.capabilities?.fileOrganization ? '- File Organization: Help organize music files, create folder structures, rename files' : ''}
${robotSettings.capabilities?.lyricsWriting ? '- Lyrics Writing: Assist with songwriting, rhyme schemes, song structure, generate complete lyrics' : ''}
${robotSettings.capabilities?.musicProduction ? '- Music Production: Give advice on recording, mixing, collaboration' : ''}
${robotSettings.capabilities?.documentCreation ? '- Document Creation: Help create lyrics documents, song notes, collaboration docs' : ''}

Context Instructions: ${robotSettings.contextInstructions}

Response Style: ${robotSettings.responseStyle}

When suggesting file operations, format them as:
[FILE_OP: operation_type:file_path1,file_path2]

Available operations:
- CREATE_FOLDER: Create new folders
- RENAME_FILE: Rename files
- MOVE_FILE: Move files between folders
- CREATE_DOCUMENT: Create new text/lyrics files
- CREATE_LYRICS: Generate complete song lyrics and save to Dropbox
- ORGANIZE_BY_DATE: Auto-organize files by date
- ORGANIZE_BY_TYPE: Auto-organize files by type`;

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

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    // Call OpenAI with settings from robot configuration
    const completion = await openai.chat.completions.create({
      model: robotSettings.model || 'gpt-4o-mini',
      messages,
      max_tokens: robotSettings.maxTokens || 1000,
      temperature: robotSettings.temperature || 0.7,
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