import { NextRequest, NextResponse } from 'next/server';

interface RobotSettings {
  systemPrompt: string;
  roleDescription: string;
  temperature: number;
  maxTokens: number;
  fileAccessEnabled: boolean;
  accessibleFolders: string[];
  capabilities: {
    fileOrganization: boolean;
    lyricsWriting: boolean;
    musicProduction: boolean;
    documentCreation: boolean;
  };
  responseStyle: string;
  contextInstructions: string;
  llmProvider: string;
  model: string;
}

const defaultSettings: RobotSettings = {
  systemPrompt: `You are an AI assistant specialized in music production and file management. You help musicians organize their files, write lyrics, and manage their creative projects.`,
  roleDescription: "Music Production Assistant & File Manager",
  temperature: 0.7,
  maxTokens: 1000,
  fileAccessEnabled: true,
  accessibleFolders: ['/Music/Fiasco Total', '/Music/Fiasco Total/Lyrics', '/Music/Fiasco Total/Live Recordings'],
  capabilities: {
    fileOrganization: true,
    lyricsWriting: true,
    musicProduction: true,
    documentCreation: true,
  },
  responseStyle: "concise_helpful",
  contextInstructions: "Always consider the current folder structure and file types when providing advice.",
  llmProvider: "OpenAI",
  model: "gpt-4o-mini"
};

// In-memory storage for now (in production, this would use a database)
let robotSettings: RobotSettings = { ...defaultSettings };

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(robotSettings);
  } catch (error) {
    console.error('Error loading robot settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const newSettings: RobotSettings = await request.json();
    
    // Validate the settings
    if (!newSettings.systemPrompt || !newSettings.roleDescription) {
      return NextResponse.json(
        { error: 'System prompt and role description are required' },
        { status: 400 }
      );
    }

    if (newSettings.temperature < 0 || newSettings.temperature > 1) {
      return NextResponse.json(
        { error: 'Temperature must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (newSettings.maxTokens < 100 || newSettings.maxTokens > 2000) {
      return NextResponse.json(
        { error: 'Max tokens must be between 100 and 2000' },
        { status: 400 }
      );
    }

    // Update settings
    robotSettings = { ...newSettings };
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving robot settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}