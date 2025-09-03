'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

interface DropboxFile {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  id?: string;
  size?: number;
  server_modified?: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showInitialAnimation, setShowInitialAnimation] = useState(true);
  const [previewFile, setPreviewFile] = useState<{name: string, content: string, type: 'text' | 'audio', url?: string} | null>(null);
  const [folderCache, setFolderCache] = useState<Map<string, {files: DropboxFile[], timestamp: number}>>(new Map());
  const [playingAudio, setPlayingAudio] = useState<{[filePath: string]: {url: string, isPlaying: boolean}}>({});
  const [audioElements, setAudioElements] = useState<{[filePath: string]: HTMLAudioElement}>({});

  useEffect(() => {
    const token = searchParams?.get('token') || localStorage.getItem('dropbox_token');
    if (token) {
      setAccessToken(token);
      // Save token to localStorage for persistence
      localStorage.setItem('dropbox_token', token);
      
      // Restore cache from localStorage
      restoreCache();
      
      // Get saved path or use default
      const savedPath = localStorage.getItem('current_dropbox_path') || '/MUSIC/Fiasco Total';
      loadFiles(token, savedPath);
    }
  }, [searchParams]);

  useEffect(() => {
    // Hide the initial animation after 5 seconds
    const timer = setTimeout(() => {
      setShowInitialAnimation(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Cache management functions
  const restoreCache = () => {
    try {
      const cacheData = localStorage.getItem('dropbox_folder_cache');
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData);
        const restoredCache = new Map();
        
        Object.entries(parsedCache).forEach(([path, data]: [string, any]) => {
          // Only restore cache that's less than 10 minutes old
          if (Date.now() - data.timestamp < 10 * 60 * 1000) {
            restoredCache.set(path, data);
          }
        });
        
        setFolderCache(restoredCache);
        console.log(`Restored ${restoredCache.size} cached folders`);
      }
    } catch (error) {
      console.warn('Failed to restore cache:', error);
    }
  };

  const saveCache = () => {
    try {
      const cacheObj = Object.fromEntries(folderCache);
      localStorage.setItem('dropbox_folder_cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  };

  const getCachedData = (path: string) => {
    const cached = folderCache.get(path);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minutes
      return cached.files;
    }
    return null;
  };

  const setCachedData = (path: string, files: DropboxFile[]) => {
    const newCache = new Map(folderCache);
    newCache.set(path, { files, timestamp: Date.now() });
    setFolderCache(newCache);
    
    // Save to localStorage (debounced)
    setTimeout(saveCache, 100);
  };

  const clearCacheForPath = (path: string) => {
    const newCache = new Map(folderCache);
    newCache.delete(path);
    setFolderCache(newCache);
    console.log('Cleared cache for:', path);
  };

  const loadFiles = async (token: string, path: string) => {
    // Check cache first
    const cachedFiles = getCachedData(path);
    if (cachedFiles) {
      console.log('Loading from cache:', path);
      setFiles(cachedFiles);
      setCurrentPath(path);
      localStorage.setItem('current_dropbox_path', path);
      return;
    }
    setLoading(true);
    try {
      console.log('Loading files from path:', path);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/files?token=${token}&path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', data);
        console.error('Error details:', data.details);
        
        // Check for expired token
        if (data.error?.includes('expired_access_token')) {
          alert('Your Dropbox session has expired. Please reconnect.');
          localStorage.removeItem('dropbox_token');
          window.location.href = '/';
          return;
        }
        
        if (data.error?.includes('path/not_found') || data.error?.includes('Folder not found')) {
          // If folder not found, try loading from root
          console.log('Folder not found, loading from root');
          const rootResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/files?token=${token}&path=`);
          const rootData = await rootResponse.json();
          if (rootData.files) {
            setFiles(rootData.files);
            setCurrentPath('');
            alert('Folder not found. Showing root folder instead.');
          }
        } else {
          alert(`Error: ${data.error || 'Failed to load files'}\n${data.details?.message || ''}`);
        }
        return;
      }
      
      if (data.files) {
        console.log('Files loaded:', data.files);
        setFiles(data.files);
        setCurrentPath(path);
        // Cache the loaded data
        setCachedData(path, data.files);
        // Save current path
        localStorage.setItem('current_dropbox_path', path);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      alert('Failed to connect to Dropbox. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;

    setUploading(true);
    try {
      // Generate organized filename with date and time
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const timeStr = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM
      
      // Extract original filename without extension
      const originalName = file.name.replace(/\.[^/.]+$/, '');
      const extension = file.name.split('.').pop();
      
      // Create organized filename: YYYYMMDD_HHMM_OriginalName.ext
      const organizedName = `${dateStr}_${timeStr}_${originalName}.${extension}`;

      const formData = new FormData();
      formData.append('file', file);
      
      // Determine target folder based on current location or file type
      let targetFolder = '/MUSIC/Fiasco Total/Live Recordings/2025';
      
      if (currentPath.includes('/New Uploads')) {
        targetFolder = '/MUSIC/Fiasco Total/New Uploads';
      } else if (currentPath.includes('/Lyrics')) {
        targetFolder = '/MUSIC/Fiasco Total/Lyrics/2025';
      } else if (currentPath.includes('/Live Recordings')) {
        targetFolder = currentPath;
      }
      
      const uploadPath = `${targetFolder}/${organizedName}`;
      formData.append('path', uploadPath);
      formData.append('token', accessToken);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/files`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Clear cache for affected folders
        clearCacheForPath(targetFolder);
        if (currentPath !== targetFolder) {
          clearCacheForPath(currentPath);
        }
        
        // Navigate to the folder where file was uploaded if not already there
        if (currentPath !== targetFolder) {
          loadFiles(accessToken, targetFolder);
        } else {
          // Reload files in current directory
          loadFiles(accessToken, currentPath);
        }
        alert(`File uploaded as: ${organizedName}`);
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

  const handleLogout = () => {
    localStorage.removeItem('dropbox_token');
    window.location.href = '/';
  };

  const organizeFiles = async (action: string) => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('token', accessToken);
      formData.append('action', action);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/organize`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        alert(`Success: ${result.message}`);
        // Reload files to show new structure
        loadFiles(accessToken, '/MUSIC/Fiasco Total');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error organizing files:', error);
      alert('Failed to organize files');
    } finally {
      setLoading(false);
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

  const getFolderEmoji = (folderName: string) => {
    const name = folderName.toLowerCase();
    if (name.includes('lyrics')) return '📝';
    if (name.includes('live') || name.includes('recording')) return '🎤';
    if (name.includes('uploads') || name.includes('new')) return '📤';
    if (name.includes('songs') || name.includes('music')) return '🎵';
    if (name.includes('archive') || name.includes('old')) return '📦';
    if (name.includes('drum')) return '🥁';
    if (name.includes('guitar')) return '🎸';
    if (name.includes('bass')) return '🎸';
    if (name.includes('vocal')) return '🎤';
    return '📁'; // default folder icon
  };

  const previewFileContent = async (file: DropboxFile) => {
    if (!accessToken) return;

    try {
      const isText = isTextFile(file.name);
      const isAudio = isAudioFile(file.name);
      
      if (!isText && !isAudio) return;

      const downloadUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/download?token=${accessToken}&path=${encodeURIComponent(file.path_display)}`;
      
      if (isText) {
        console.log('Loading text file:', file.name);
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const content = await response.text();
        setPreviewFile({ name: file.name, content, type: 'text' });
      } else if (isAudio) {
        console.log('Loading audio file:', file.name);
        
        try {
          // First, try to get a direct preview link from Dropbox
          const previewUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/preview?token=${accessToken}&path=${encodeURIComponent(file.path_display)}`;
          console.log('Getting direct preview URL from:', previewUrl);
          
          const previewResponse = await fetch(previewUrl);
          if (previewResponse.ok) {
            const previewData = await previewResponse.json();
            console.log('Got direct preview URL:', previewData.previewUrl);
            
            // Test if the direct URL is accessible
            try {
              const testResponse = await fetch(previewData.previewUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                console.log('Direct preview URL is accessible');
                setPreviewFile({ name: file.name, content: '', type: 'audio', url: previewData.previewUrl });
                return;
              } else {
                console.log('Direct preview URL failed, falling back to download URL');
              }
            } catch (testError) {
              console.log('Direct preview URL test failed, falling back to download URL:', testError);
            }
          } else {
            console.log('Preview API failed, falling back to download URL');
          }
        } catch (previewError) {
          console.log('Preview request failed, falling back to download URL:', previewError);
        }
        
        // Fallback to the original download URL
        console.log('Using fallback download URL:', downloadUrl);
        try {
          const testResponse = await fetch(downloadUrl, { method: 'HEAD' });
          if (!testResponse.ok) {
            console.error('Audio file test failed:', testResponse.status, testResponse.statusText);
            const errorText = await testResponse.text();
            console.error('Error response:', errorText);
            throw new Error(`Audio file not accessible: HTTP ${testResponse.status} - ${testResponse.statusText}`);
          }
          
          console.log('Audio file headers:', Object.fromEntries(testResponse.headers.entries()));
          console.log('Content-Type:', testResponse.headers.get('content-type'));
          setPreviewFile({ name: file.name, content: '', type: 'audio', url: downloadUrl });
        } catch (headError) {
          console.error('HEAD request failed:', headError);
          // Still try to show the audio player even if HEAD fails
          setPreviewFile({ name: file.name, content: '', type: 'audio', url: downloadUrl });
        }
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      alert('Failed to preview file');
    }
  };

  const handleInlineAudioPlay = async (file: DropboxFile) => {
    if (!accessToken) return;
    
    const filePath = file.path_display;
    
    // If already playing, stop it
    if (playingAudio[filePath]?.isPlaying) {
      if (audioElements[filePath]) {
        audioElements[filePath].pause();
        audioElements[filePath].currentTime = 0;
      }
      setPlayingAudio(prev => ({...prev, [filePath]: {...prev[filePath], isPlaying: false}}));
      return;
    }

    try {
      console.log('Getting inline audio URL for:', file.name);
      
      // First, try to get a direct preview link from Dropbox
      const previewUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/preview?token=${accessToken}&path=${encodeURIComponent(filePath)}`;
      
      let audioUrl;
      
      try {
        const previewResponse = await fetch(previewUrl);
        if (previewResponse.ok) {
          const previewData = await previewResponse.json();
          audioUrl = previewData.previewUrl;
          console.log('Got direct preview URL for inline player:', audioUrl);
        } else {
          throw new Error('Preview API failed');
        }
      } catch (previewError) {
        console.log('Preview request failed, using download URL:', previewError);
        audioUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/dropbox/download?token=${accessToken}&path=${encodeURIComponent(filePath)}`;
      }

      // Create or reuse audio element
      let audio = audioElements[filePath];
      if (!audio) {
        audio = new Audio();
        setAudioElements(prev => ({...prev, [filePath]: audio}));
        
        // Set up event listeners
        audio.onended = () => {
          setPlayingAudio(prev => ({...prev, [filePath]: {...prev[filePath], isPlaying: false}}));
        };
        audio.onerror = (e) => {
          console.error('Inline audio error:', e);
          setPlayingAudio(prev => ({...prev, [filePath]: {...prev[filePath], isPlaying: false}}));
        };
      }

      // Stop any other playing audio
      Object.entries(audioElements).forEach(([path, audioEl]) => {
        if (path !== filePath && !audioEl.paused) {
          audioEl.pause();
          audioEl.currentTime = 0;
        }
      });
      setPlayingAudio(prev => {
        const newState = {...prev};
        Object.keys(newState).forEach(path => {
          if (path !== filePath) {
            newState[path] = {...newState[path], isPlaying: false};
          }
        });
        return newState;
      });

      // Set source and play
      audio.src = audioUrl;
      setPlayingAudio(prev => ({...prev, [filePath]: {url: audioUrl, isPlaying: true}}));
      
      try {
        await audio.play();
        console.log('Inline audio started playing');
      } catch (playError) {
        console.error('Failed to play inline audio:', playError);
        setPlayingAudio(prev => ({...prev, [filePath]: {...prev[filePath], isPlaying: false}}));
      }
      
    } catch (error) {
      console.error('Error setting up inline audio:', error);
    }
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono flex items-center justify-center">
        <div className="border-2 border-pink-500/70 bg-black/80 backdrop-blur-sm p-6 max-w-md rounded-lg shadow-xl shadow-pink-500/30">
          <h2 className="text-white font-bold mb-3 drop-shadow-lg">&gt;&gt;&gt; ACCESS DENIED &lt;&lt;&lt;</h2>
          <p className="text-sm mb-4 text-cyan-300">NO DROPBOX TOKEN DETECTED</p>
          <p className="text-xs text-cyan-400/70 mb-4">PLEASE CONNECT YOUR ACCOUNT TO PROCEED</p>
          <button 
            onClick={() => window.location.href = '/'} 
            className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white border border-pink-400 font-bold text-sm rounded shadow-lg hover:shadow-pink-500/50 transition-all"
          >
            [RETURN TO LOGIN]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono">
      <div className="container mx-auto px-3 py-3">
        <div className="mb-4 flex justify-between items-center border-b-2 border-cyan-400 pb-2 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
          <div>
            <h1 className="text-xl font-bold text-white mb-1 drop-shadow-lg">♪ ROADIE v1.0</h1>
            <p className="text-sm text-cyan-300">
              &gt; {currentPath || '/'}
            </p>
          </div>
          <div className="flex space-x-2">
            {currentPath && (
              <button 
                onClick={goBack}
                className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 font-bold rounded shadow-lg hover:shadow-cyan-500/50 transition-all"
              >
                [BACK]
              </button>
            )}
            <button 
              onClick={handleLogout} 
              className="px-3 py-1 text-xs bg-pink-600 hover:bg-pink-500 text-white border border-pink-400 font-bold rounded shadow-lg hover:shadow-pink-500/50 transition-all"
            >
              [LOGOUT]
            </button>
          </div>
        </div>


        {loading ? (
          <div className="text-center text-yellow-300 animate-pulse">&gt;&gt;&gt; LOADING FILES...</div>
        ) : (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="border border-cyan-500/30 bg-black/60 backdrop-blur-sm hover:bg-black/80 hover:border-pink-500/50 transition-all duration-300 rounded-lg shadow-lg hover:shadow-cyan-500/20"
              >
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-xl drop-shadow-lg">
                      {file['.tag'] === 'folder' ? getFolderEmoji(file.name) : 
                       isAudioFile(file.name) ? '🎵' :
                       isTextFile(file.name) ? '📝' : '📄'}
                    </span>
                    <span 
                      className={`text-sm truncate max-w-md ${
                        file['.tag'] === 'folder' 
                          ? 'text-white cursor-pointer hover:text-gray-200 font-bold drop-shadow-sm' 
                          : (isAudioFile(file.name) || isTextFile(file.name))
                            ? 'text-cyan-200 cursor-pointer hover:text-white'
                            : 'text-cyan-200'
                      }`}
                      onClick={() => {
                        if (file['.tag'] === 'folder') {
                          navigateToFolder(file.path_display);
                        } else if (isAudioFile(file.name) || isTextFile(file.name)) {
                          previewFileContent(file);
                        }
                      }}
                      title={file.name}
                    >
                      {file['.tag'] === 'folder' ? file.name : file.name.replace(/\.[^/.]+$/, "")}
                    </span>
                    {file.size && (
                      <span className="text-xs text-gray-400 bg-black/30 px-2 py-1 rounded">
                        {formatFileSize(file.size)}
                      </span>
                    )}
                  </div>
                  
                  {/* Action buttons for audio files */}
                  {isAudioFile(file.name) && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInlineAudioPlay(file);
                        }}
                        className={`px-2 py-1 text-xs rounded border transition-all duration-200 flex items-center space-x-1 ${
                          playingAudio[file.path_display]?.isPlaying
                            ? 'bg-pink-600 hover:bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/30'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg hover:shadow-cyan-500/30'
                        }`}
                        title={playingAudio[file.path_display]?.isPlaying ? 'Stop' : 'Listen'}
                      >
                        <span>{playingAudio[file.path_display]?.isPlaying ? '⏹️' : '🎧'}</span>
                        <span className="font-bold">
                          {playingAudio[file.path_display]?.isPlaying ? 'STOP' : 'LISTEN'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {files.length === 0 && (
              <div className="border border-pink-500/50 bg-black/60 backdrop-blur-sm p-4 text-center rounded-lg shadow-lg shadow-pink-500/20">
                <p className="text-white font-bold drop-shadow-lg">&gt;&gt;&gt; DIRECTORY EMPTY &lt;&lt;&lt;</p>
                <p className="text-xs text-cyan-400 mt-1">
                  NO FILES DETECTED IN CURRENT LOCATION
                </p>
              </div>
            )}
          </div>
        )}

        {/* File Preview Modal */}
        {previewFile && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPreviewFile(null)}>
            <div className="bg-black/90 border border-pink-500/50 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto shadow-xl shadow-pink-500/30" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-lg drop-shadow-lg">{previewFile.name}</h3>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="text-cyan-400 hover:text-white text-xl font-bold px-2 py-1 rounded hover:bg-pink-500/20 transition-all"
                >
                  ✕
                </button>
              </div>
              
              {previewFile.type === 'text' ? (
                <div className="bg-gray-900/50 border border-cyan-500/30 rounded p-4 font-mono text-sm text-cyan-200 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {previewFile.content}
                </div>
              ) : previewFile.type === 'audio' && previewFile.url ? (
                <div className="text-center">
                  <div className="bg-gray-900/50 border border-cyan-500/30 rounded-lg p-6">
                    <div className="text-6xl mb-4">🎵</div>
                    <p className="text-cyan-200 mb-4 text-sm">Audio Player</p>
                    <audio 
                      controls 
                      preload="metadata"
                      className="w-full max-w-md mx-auto"
                      style={{
                        accentColor: '#06b6d4',
                        backgroundColor: '#1f2937',
                        borderRadius: '8px'
                      }}
                      onError={(e) => {
                        console.error('Audio loading error:', e);
                        console.error('Audio URL:', previewFile.url);
                      }}
                      onLoadStart={() => console.log('Audio loading started')}
                      onCanPlay={() => console.log('Audio can play')}
                    >
                      <source src={previewFile.url} type="audio/mpeg" />
                      <source src={previewFile.url} type="audio/wav" />
                      <source src={previewFile.url} type="audio/mp4" />
                      Your browser does not support the audio element.
                    </audio>
                    <p className="text-xs text-gray-400 mt-2">
                      If audio doesn't play, try refreshing or check browser console for errors.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  Unable to preview this file type
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono flex items-center justify-center">
        <div className="text-center text-yellow-300 animate-pulse">
          &gt;&gt;&gt; LOADING DASHBOARD...
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}