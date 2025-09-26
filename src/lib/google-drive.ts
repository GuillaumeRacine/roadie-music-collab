import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface GoogleDriveConfig {
  serviceAccountKey: string;
  folderId?: string;
}

export class GoogleDriveService {
  private drive: any;
  private docs: any;
  private auth: JWT;
  private folderId?: string;

  constructor(config: GoogleDriveConfig) {
    // Parse the service account key
    const serviceAccount = JSON.parse(config.serviceAccountKey);

    // Set up JWT authentication
    this.auth = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents'
      ],
    });

    // Initialize Google APIs
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.docs = google.docs({ version: 'v1', auth: this.auth });
    this.folderId = config.folderId;
  }

  async createDocument(title: string, content: string, folderId?: string): Promise<{ id: string; url: string }> {
    try {
      // Create a new Google Doc
      const createResponse = await this.docs.documents.create({
        requestBody: {
          title: title
        }
      });

      const documentId = createResponse.data.documentId;

      // Add content to the document
      await this.docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: 1
                },
                text: content
              }
            }
          ]
        }
      });

      // Move to specific folder if provided
      const targetFolderId = folderId || this.folderId;
      if (targetFolderId) {
        await this.drive.files.update({
          fileId: documentId,
          addParents: targetFolderId,
          removeParents: 'root'
        });
      }

      // Make the document shareable (optional - you might want to control this)
      await this.drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      return {
        id: documentId,
        url: `https://docs.google.com/document/d/${documentId}/edit`
      };

    } catch (error) {
      console.error('Error creating Google Doc:', error);
      throw new Error(`Failed to create Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findOrCreateLyricsFolder(): Promise<string> {
    try {
      // Search for existing "Lyrics" folder
      const searchResponse = await this.drive.files.list({
        q: "name='Lyrics' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        spaces: 'drive'
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id;
      }

      // Create "Lyrics" folder if it doesn't exist
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: 'Lyrics',
          mimeType: 'application/vnd.google-apps.folder'
        }
      });

      return createResponse.data.id;

    } catch (error) {
      console.error('Error finding/creating Lyrics folder:', error);
      throw new Error(`Failed to setup Lyrics folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listDocumentsInFolder(folderId: string, namePrefix?: string): Promise<Array<{id: string, name: string}>> {
    try {
      let query = `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`;

      if (namePrefix) {
        query += ` and name contains '${namePrefix}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name)',
        orderBy: 'name'
      });

      return response.data.files || [];

    } catch (error) {
      console.error('Error listing documents:', error);
      throw new Error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  generateUniqueTitle(baseTitle: string, existingTitles: string[]): string {
    if (!existingTitles.includes(baseTitle)) {
      return baseTitle;
    }

    let counter = 1;
    let newTitle = `${baseTitle} (${counter})`;

    while (existingTitles.includes(newTitle)) {
      counter++;
      newTitle = `${baseTitle} (${counter})`;
    }

    return newTitle;
  }

  static formatLyricsForGoogleDocs(lyrics: string, songTitle: string, style?: string, mood?: string): string {
    const date = new Date().toLocaleDateString();

    return `${songTitle || 'Untitled Song'}

Generated: ${date}
${style ? `Style: ${style}` : ''}
${mood ? `Mood: ${mood}` : ''}

Generated with Roadie AI Lyrics Generator
────────────────────────────────────────

${lyrics}

────────────────────────────────────────
🎵 Created with Roadie Music Collaboration Tool`;
  }
}