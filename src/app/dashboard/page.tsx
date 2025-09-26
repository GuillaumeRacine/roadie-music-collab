'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DropboxFile {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  id?: string;
  size?: number;
  server_modified?: string;
}

export default function Dashboard() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [searchParamsToken, setSearchParamsToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Client-side only effect to extract token from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      setSearchParamsToken(urlToken);
    }
  }, []);

  useEffect(() => {
    const token = searchParamsToken;
    if (token) {
      setAccessToken(token);
      loadFiles(token, '');
    }
  }, [searchParamsToken]);

  const loadFiles = async (token: string, path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dropbox/files?token=${token}&path=${path}`);
      const data = await response.json();
      if (data.files) {
        setFiles(data.files);
        setCurrentPath(path);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `${currentPath}/${file.name}`);
      formData.append('token', accessToken);

      const response = await fetch('/api/dropbox/files', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Reload files after upload
        loadFiles(accessToken, currentPath);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const navigateToFolder = (folderPath: string) => {
    if (accessToken) {
      loadFiles(accessToken, folderPath);
    }
  };

  const goBack = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    if (accessToken) {
      loadFiles(accessToken, parentPath);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isAudioFile = (name: string) => {
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    return audioExtensions.some(ext => name.toLowerCase().endsWith(ext));
  };

  const isTextFile = (name: string) => {
    const textExtensions = ['.txt', '.md', '.lyrics'];
    return textExtensions.some(ext => name.toLowerCase().endsWith(ext));
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>No Dropbox access token found. Please go back and connect your account.</p>
            <Button onClick={() => window.location.href = '/'} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Music Files Dashboard</h1>
          <p className="text-gray-600">
            Current path: {currentPath || '/'}
          </p>
        </div>

        <div className="mb-6 flex gap-4">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="file-upload"
            accept="audio/*,.txt,.md,.lyrics"
          />
          <label htmlFor="file-upload">
            <Button disabled={uploading} className="cursor-pointer">
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </label>
          
          {currentPath && (
            <Button variant="outline" onClick={goBack}>
              Back
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center">Loading files...</div>
        ) : (
          <div className="grid gap-4">
            {files.map((file, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {file['.tag'] === 'folder' ? '📁' : 
                         isAudioFile(file.name) ? '🎵' :
                         isTextFile(file.name) ? '📝' : '📄'}
                      </div>
                      <div>
                        <h3 
                          className={`font-medium ${file['.tag'] === 'folder' ? 'text-blue-600 cursor-pointer hover:underline' : ''}`}
                          onClick={() => file['.tag'] === 'folder' && navigateToFolder(file.path_display)}
                        >
                          {file.name}
                        </h3>
                        {file.size && (
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.size)}
                            {file.server_modified && (
                              <span className="ml-2">
                                Modified: {new Date(file.server_modified).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {isAudioFile(file.name) && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          🎧 Preview
                        </Button>
                        <Button size="sm" variant="outline">
                          🔍 Analyze
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {files.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500">No files found in this folder.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Upload some music files or create folders to get started!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}