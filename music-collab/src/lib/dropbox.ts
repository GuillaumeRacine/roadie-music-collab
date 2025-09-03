import { Dropbox } from 'dropbox';

export interface DropboxConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
}

export class DropboxService {
  private dbx: Dropbox;
  private clientId: string;
  private clientSecret: string;

  constructor(config: DropboxConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.dbx = new Dropbox({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      accessToken: config.accessToken,
      fetch: fetch
    });
  }

  async getAuthUrl(redirectUri: string) {
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    return authUrl;
  }

  async getAccessTokenFromCode(code: string, redirectUri: string) {
    try {
      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || 'Failed to get access token');
      }
      
      return data.access_token;
    } catch (error) {
      throw new Error(`Failed to get access token: ${error}`);
    }
  }

  async listFiles(path: string = '') {
    try {
      const response = await this.dbx.filesListFolder({ path });
      return response.result.entries;
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  async uploadFile(file: File, path: string) {
    try {
      const response = await this.dbx.filesUpload({
        path,
        contents: file,
        mode: { '.tag': 'add' },
        autorename: true
      });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async downloadFile(path: string) {
    try {
      const response = await this.dbx.filesDownload({ path });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  async createFolder(path: string) {
    try {
      const response = await this.dbx.filesCreateFolderV2({ path });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to create folder: ${error}`);
    }
  }

  async deleteFile(path: string) {
    try {
      const response = await this.dbx.filesDeleteV2({ path });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async getFileMetadata(path: string) {
    try {
      const response = await this.dbx.filesGetMetadata({ path });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error}`);
    }
  }

  async searchFiles(query: string, path: string = '') {
    try {
      const response = await this.dbx.filesSearchV2({
        query,
        options: {
          path,
          file_status: 'active'
        }
      });
      return response.result.matches;
    } catch (error) {
      throw new Error(`Failed to search files: ${error}`);
    }
  }

  async moveFile(fromPath: string, toPath: string) {
    try {
      const response = await this.dbx.filesMoveV2({
        from_path: fromPath,
        to_path: toPath,
        autorename: true
      });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to move file: ${error}`);
    }
  }

  async copyFile(fromPath: string, toPath: string) {
    try {
      const response = await this.dbx.filesCopyV2({
        from_path: fromPath,
        to_path: toPath,
        autorename: true
      });
      return response.result;
    } catch (error) {
      throw new Error(`Failed to copy file: ${error}`);
    }
  }
}