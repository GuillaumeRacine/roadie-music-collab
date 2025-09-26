'use client';

import { useState, useEffect, Suspense } from 'react';
import { apiUrl } from '@/lib/api';
import LyricsGenerator from '@/components/lyrics-generator';
import AudioClustering from '@/components/audio-clustering';
import TimelineCard from '@/components/timeline-card';

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
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showInitialAnimation, setShowInitialAnimation] = useState(true);
  const [previewFile, setPreviewFile] = useState<{name: string, content: string, type: 'text' | 'audio', url?: string} | null>(null);
  const [folderCache, setFolderCache] = useState<Map<string, {files: DropboxFile[], timestamp: number}>>(new Map());
  const [playingAudio, setPlayingAudio] = useState<{[filePath: string]: {url: string, isPlaying: boolean}}>({});
  const [audioElements, setAudioElements] = useState<{[filePath: string]: HTMLAudioElement}>({});
  const [audioAnalysis, setAudioAnalysis] = useState<{[filePath: string]: {
    bpm?: number;
    key?: string;
    mood?: string;
    quality?: string;
    suggestedName?: string;
    isProcessing?: boolean;
  }}>({});
  const [showLyricsGenerator, setShowLyricsGenerator] = useState(false);
  const [showAudioClustering, setShowAudioClustering] = useState(false);
  const [renamingClusters, setRenamingClusters] = useState(false);

  // Bootstrap: restore cache and load default folder using cookie session
  useEffect(() => {
    restoreCache();
    // Clear any cached data to ensure fresh folder listing
    localStorage.removeItem('dropbox_folder_cache');
    setFolderCache(new Map());
    const savedPath = localStorage.getItem('current_dropbox_path') || '/Music/Fiasco Total';
    loadFiles(savedPath);
  }, []);

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
        
        Object.entries(parsedCache as Record<string, { files: DropboxFile[], timestamp: number }>).forEach(([path, data]) => {
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

  const sortFiles = (files: DropboxFile[]): DropboxFile[] => {
    return files.sort((a, b) => {
      // If both are folders or both are files, sort by date
      if (a['.tag'] === b['.tag']) {
        // For date-based folders (YYYY.MM.DD format), sort by date
        if (a['.tag'] === 'folder' && /^\d{4}\.\d{2}\.\d{2}$/.test(a.name) && /^\d{4}\.\d{2}\.\d{2}$/.test(b.name)) {
          return b.name.localeCompare(a.name); // Newest first
        }
        // For other folders, sort alphabetically but with year folders first
        if (a['.tag'] === 'folder') {
          // Year folders (YYYY) should come first, then date folders
          const aIsYear = /^\d{4}$/.test(a.name);
          const bIsYear = /^\d{4}$/.test(b.name);
          if (aIsYear && !bIsYear) return -1;
          if (!aIsYear && bIsYear) return 1;
          if (aIsYear && bIsYear) return b.name.localeCompare(a.name); // Newest year first
          return b.name.localeCompare(a.name); // Alphabetical for other folders
        }
        // For files, sort by server_modified date if available, otherwise by name
        if (a.server_modified && b.server_modified) {
          return new Date(b.server_modified).getTime() - new Date(a.server_modified).getTime();
        }
        return b.name.localeCompare(a.name);
      }
      // Folders before files
      return a['.tag'] === 'folder' ? -1 : 1;
    });
  };

  const loadFiles = async (path: string) => {
    // Check cache first
    const cachedFiles = getCachedData(path);
    if (cachedFiles) {
      console.log('Loading from cache:', path);
      // Filter out Archive folder
      const filteredFiles = cachedFiles.filter(file =>
        !file.name.toLowerCase().includes('archive') || file['.tag'] !== 'folder'
      );
      // Sort files: folders first (newest to oldest), then files (newest to oldest)
      const sortedFiles = sortFiles(filteredFiles);
      setFiles(sortedFiles);
      setCurrentPath(path);
      localStorage.setItem('current_dropbox_path', path);
      return;
    }
    setLoading(true);
    try {
      console.log('Loading files from path:', path);
      const response = await fetch(apiUrl(`/api/dropbox/files?path=${encodeURIComponent(path)}`), { credentials: 'include' });
      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', data);
        console.error('Error details:', data.details);

        // Check for expired token
        if (response.status === 401) {
          alert('Your Dropbox session is missing or expired. Please reconnect.');
          window.location.href = '/';
          return;
        }

        if (data.error?.includes('path/not_found') || data.error?.includes('Folder not found')) {
          // If folder not found, try loading from root
          console.log('Folder not found, loading from root');
          const rootResponse = await fetch(apiUrl(`/api/dropbox/files?path=`), { credentials: 'include' });
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
        // Filter out Archive folder
        const filteredFiles = data.files.filter((file: DropboxFile) =>
          !file.name.toLowerCase().includes('archive') || file['.tag'] !== 'folder'
        );

        // Sort files: folders first (newest to oldest), then files (newest to oldest)
        const sortedFiles = sortFiles(filteredFiles);

        setFiles(sortedFiles);
        setCurrentPath(path);
        // Cache the loaded data (with Archive folders included for navigation purposes)
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
    if (!file) return;

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
      let targetFolder = '/Music/Fiasco Total/Live Recordings/2025';
      
      if (currentPath.includes('/New Uploads')) {
        targetFolder = '/Music/Fiasco Total/New Uploads';
      } else if (currentPath.includes('/Lyrics')) {
        targetFolder = '/Music/Fiasco Total/Lyrics/2025';
      } else if (currentPath.includes('/Live Recordings')) {
        targetFolder = currentPath;
      }
      
      const uploadPath = `${targetFolder}/${organizedName}`;
      formData.append('path', uploadPath);
      const response = await fetch(apiUrl('/api/dropbox/files'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        // Clear cache for affected folders
        clearCacheForPath(targetFolder);
        if (currentPath !== targetFolder) {
          clearCacheForPath(currentPath);
        }
        
        // Navigate to the folder where file was uploaded if not already there
        if (currentPath !== targetFolder) {
          loadFiles(targetFolder);
        } else {
          // Reload files in current directory
          loadFiles(currentPath);
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
    loadFiles(folderPath);
  };

  const goBack = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    
    loadFiles(parentPath);
  };

  const handleLogout = () => {
    fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
      .finally(() => { window.location.href = '/'; });
  };

  const handleRenameClusters = async () => {
    setRenamingClusters(true);
    try {
      const response = await fetch(apiUrl('/api/dropbox/rename-clusters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folderPath: currentPath })
      });

      const data = await response.json();

      if (response.ok) {
        let message = data.message;
        if (data.summary) {
          message += `\n\nRenamed: ${data.summary.renamed}`;
          message += `\nNo change needed: ${data.summary.noChange}`;
          if (data.summary.errors > 0) {
            message += `\nErrors: ${data.summary.errors}`;
          }
        }

        alert(message);

        // Refresh the file listing to show new names
        await loadFiles(currentPath);
      } else {
        alert(`Rename failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('Failed to rename cluster folders');
    } finally {
      setRenamingClusters(false);
    }
  };

  const organizeFiles = async (action: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', action);

      const response = await fetch(apiUrl('/api/dropbox/organize'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();
      if (response.ok) {
        alert(`Success: ${result.message}`);
        // Reload files to show new structure
        loadFiles('/Music/Fiasco Total');
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
    if (name.includes('idea')) return '💡';
    if (name.includes('sheet') || name.includes('chart')) return '🎼';
    if (name.includes('media') || name.includes('photo')) return '📷';
    return '📁'; // default folder icon
  };

  const previewFileContent = async (file: DropboxFile) => {
    try {
      const isText = isTextFile(file.name);
      const isAudio = isAudioFile(file.name);
      
      if (!isText && !isAudio) return;

      const downloadUrl = apiUrl(`/api/dropbox/download?path=${encodeURIComponent(file.path_display)}`);
      
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
          const previewUrl = apiUrl(`/api/dropbox/preview?path=${encodeURIComponent(file.path_display)}`);
          console.log('Getting direct preview URL from:', previewUrl);
          
          const previewResponse = await fetch(previewUrl, { credentials: 'include' });
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
          const testResponse = await fetch(downloadUrl, { method: 'HEAD', credentials: 'include' });
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

  const handleFileOperation = async (operation: string, files?: string[]) => {
    try {
      console.log('Executing file operation:', operation, files);
      
      const response = await fetch(apiUrl('/api/ai/file-operations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          operation,
          files,
          targetPath: currentPath,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('File operation successful:', result);
        // Refresh the current directory to show changes
        loadFiles(currentPath);
      } else {
        console.error('File operation failed:', result);
        alert(`Operation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error executing file operation:', error);
      alert('Failed to execute file operation');
    }
  };

  // Audio analysis function
  const processAudioFile = async (file: DropboxFile) => {
    const filePath = file.path_display;
    
    // Set processing state
    setAudioAnalysis(prev => ({
      ...prev,
      [filePath]: { ...prev[filePath], isProcessing: true }
    }));

    try {
      const response = await fetch(apiUrl('/api/audio-analysis'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ filePath }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const analysis = data.analysis;
        setAudioAnalysis(prev => ({
          ...prev,
          [filePath]: {
            bpm: analysis.audioAnalysis?.bpm,
            key: analysis.audioAnalysis?.key,
            mood: analysis.audioAnalysis?.mood,
            quality: analysis.aiAnalysis?.musicalContent?.recordingQuality,
            suggestedName: analysis.aiAnalysis?.suggestions?.suggestedName,
            isProcessing: false
          }
        }));
      } else {
        console.error('Analysis failed:', data.error);
        setAudioAnalysis(prev => ({
          ...prev,
          [filePath]: { ...prev[filePath], isProcessing: false }
        }));
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAudioAnalysis(prev => ({
        ...prev,
        [filePath]: { ...prev[filePath], isProcessing: false }
      }));
    }
  };

  const processNewUploads = async (action: 'preview' | 'process') => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/dropbox/process-uploads'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        if (action === 'preview') {
          // Show detailed preview results
          let previewMessage = `Preview: ${result.total} files found\n\n`;

          const categories: {[key: string]: number} = {};
          const dateSources: {[key: string]: number} = {};

          result.results.forEach((r: any) => {
            if (r.status !== 'skipped') {
              categories[r.category] = (categories[r.category] || 0) + 1;
              dateSources[r.dateSource] = (dateSources[r.dateSource] || 0) + 1;
            }
          });

          previewMessage += '📁 Destination folders:\n';
          for (const [category, count] of Object.entries(categories)) {
            previewMessage += `  • ${category.replace('-', ' ').toUpperCase()}: ${count} files\n`;
          }

          previewMessage += '\n📅 Date detection:\n';
          for (const [source, count] of Object.entries(dateSources)) {
            const sourceLabel = {
              'filename-prefix': 'From filename prefix (YYYYMMDD_)',
              'filename-embedded': 'From embedded date (YYYY-MM-DD)',
              'filename-us-format': 'From US date format (MM/DD/YYYY)',
              'dropbox-upload': 'From Dropbox upload date',
              'processing-date': 'From processing date (fallback)',
              'already-has-date': 'Already has date prefix',
              'original-preserved': 'Original filename preserved'
            }[source] || source;
            previewMessage += `  • ${sourceLabel}: ${count} files\n`;
          }

          if (result.skipped > 0) {
            previewMessage += `\n⚠️ ${result.skipped} files will be skipped (unknown types)\n`;
          }

          if (confirm(previewMessage + '\nProceed with processing?')) {
            processNewUploads('process');
          }
        } else {
          let successMessage = `Success: ${result.message}`;

          if (result.results.length > 0) {
            const errors = result.results.filter((r: any) => r.status === 'error');
            if (errors.length > 0) {
              successMessage += `\n\n⚠️ ${errors.length} files failed:\n`;
              errors.slice(0, 3).forEach((error: any) => {
                successMessage += `• ${error.fileName}: ${error.message}\n`;
              });
              if (errors.length > 3) {
                successMessage += `• ... and ${errors.length - 3} more\n`;
              }
            }
          }

          alert(successMessage);
          // Clear cache for New Uploads and reload
          clearCacheForPath(currentPath);
          loadFiles(currentPath);
        }
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error processing uploads:', error);
      alert('Failed to process uploads');
    } finally {
      setLoading(false);
    }
  };

  const restoreFiles = async (action: 'restore') => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/dropbox/restore-uploads'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`${result.message}\n\nRestored: ${result.restored} files\nErrors: ${result.errors}\nSkipped: ${result.skipped}`);
        // Clear cache and reload
        clearCacheForPath(currentPath);
        loadFiles(currentPath);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error restoring files:', error);
      alert('Failed to restore files');
    } finally {
      setLoading(false);
    }
  };

  const organizeLiveRecordings = async (action: 'preview' | 'organize') => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/dropbox/organize-live-recordings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        if (action === 'preview') {
          let previewMessage = `Preview: ${result.totalFiles} audio files found\n\n`;
          previewMessage += `📁 Will create ${result.dateGroups} date folders\n`;
          previewMessage += `📄 ${result.organized} files will be organized\n`;
          previewMessage += `⚠️ ${result.skipped} files will be skipped\n`;

          if (result.foldersCreated > 0) {
            previewMessage += `🆕 ${result.foldersCreated} new folders will be created\n`;
          }

          if (confirm(previewMessage + '\nProceed with organizing?')) {
            organizeLiveRecordings('organize');
          }
        } else {
          let successMessage = `Success: ${result.message}`;
          if (result.results.length > 0) {
            const errors = result.results.filter((r: any) => r.status === 'error');
            if (errors.length > 0) {
              successMessage += `\n\n⚠️ ${errors.length} files failed:\n`;
              errors.slice(0, 3).forEach((error: any) => {
                successMessage += `• ${error.fileName}: ${error.message}\n`;
              });
              if (errors.length > 3) {
                successMessage += `• ... and ${errors.length - 3} more\n`;
              }
            }
          }

          alert(successMessage);
          // Clear cache and reload
          clearCacheForPath(currentPath);
          loadFiles(currentPath);
        }
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error organizing live recordings:', error);
      alert('Failed to organize live recordings');
    } finally {
      setLoading(false);
    }
  };

  const handleInlineAudioPlay = async (file: DropboxFile) => {
    
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
      const previewUrl = apiUrl(`/api/dropbox/preview?path=${encodeURIComponent(filePath)}`);
      
      let audioUrl;
      
      try {
        const previewResponse = await fetch(previewUrl, { credentials: 'include' });
        if (previewResponse.ok) {
          const previewData = await previewResponse.json();
          audioUrl = previewData.previewUrl;
          console.log('Got direct preview URL for inline player:', audioUrl);
        } else {
          throw new Error('Preview API failed');
        }
      } catch (previewError) {
        console.log('Preview request failed, using download URL:', previewError);
        audioUrl = apiUrl(`/api/dropbox/download?path=${encodeURIComponent(filePath)}`);
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

  

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono">
      <div className="container mx-auto px-3 py-3">
        <div className="mb-4 flex justify-between items-center border-b-2 border-cyan-400 pb-2 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
          <div>
            <h1 className="text-xl font-bold text-white mb-1 drop-shadow-lg">♪ ROADIE v1.0</h1>
            <div className="text-sm text-cyan-300 flex items-center space-x-1">
              <span>&gt;</span>
              <button
                onClick={() => loadFiles('')}
                className="hover:text-white hover:underline transition-colors"
                title="Go to root"
              >
                /
              </button>
              {currentPath && currentPath.split('/').filter(Boolean).map((folder, index, array) => {
                const pathUpToHere = '/' + array.slice(0, index + 1).join('/');
                const isLast = index === array.length - 1;
                return (
                  <span key={index} className="flex items-center">
                    <span className="mx-1 text-cyan-500">/</span>
                    <button
                      onClick={() => !isLast && loadFiles(pathUpToHere)}
                      className={isLast ? 'text-white font-bold' : 'hover:text-white hover:underline transition-colors cursor-pointer'}
                      disabled={isLast}
                      title={isLast ? 'Current folder' : `Go to ${folder}`}
                    >
                      {folder}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => loadFiles('/Music/Fiasco Total')}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white border border-green-400 font-bold rounded shadow-lg hover:shadow-green-500/50 transition-all"
              title="Go to home folder"
            >
              🏠
            </button>
            <button
              onClick={() => setShowLyricsGenerator(true)}
              className="px-3 py-1 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border border-pink-400 font-bold rounded shadow-lg hover:shadow-pink-500/50 transition-all"
              title="Generate song lyrics"
            >
              📝
            </button>
            {currentPath && (
              <button
                onClick={goBack}
                className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 font-bold rounded shadow-lg hover:shadow-cyan-500/50 transition-all"
              >
                ⬅
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-xs bg-pink-600 hover:bg-pink-500 text-white border border-pink-400 font-bold rounded shadow-lg hover:shadow-pink-500/50 transition-all"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Activity Timeline Card */}
        <TimelineCard className="mb-4" />

        {/* Process New Uploads Button - Show only when in New Uploads folder */}
        {currentPath.toLowerCase().includes('new uploads') && files.length > 0 && (
          <div className="mb-4 bg-black/60 backdrop-blur-sm border border-yellow-500/50 rounded-lg p-4 shadow-lg shadow-yellow-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-yellow-400 font-bold mb-1 drop-shadow-lg">📤 PROCESS NEW UPLOADS</h3>
                <p className="text-xs text-cyan-200">
                  Smart organize {files.filter(f => f['.tag'] === 'file').length} files with intelligent date detection
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  • Preserves existing dates • Uses file creation dates • Falls back to upload date
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => processNewUploads('preview')}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 font-bold rounded shadow-lg hover:shadow-blue-500/50 transition-all"
                >
                  [PREVIEW]
                </button>
                <button
                  onClick={() => processNewUploads('process')}
                  className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white border border-green-400 font-bold rounded shadow-lg hover:shadow-green-500/50 transition-all"
                >
                  [PROCESS ALL]
                </button>
                <button
                  onClick={() => restoreFiles('restore')}
                  className="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-500 text-white border border-orange-400 font-bold rounded shadow-lg hover:shadow-orange-500/50 transition-all"
                >
                  [RESTORE]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Organize Live Recordings Button - Show only when in Live Recordings/2025 folder */}
        {currentPath.toLowerCase().includes('live recordings') && currentPath.includes('2025') && files.some(f => f['.tag'] === 'file' && isAudioFile(f.name)) && (
          <div className="mb-4 bg-black/60 backdrop-blur-sm border border-green-500/50 rounded-lg p-4 shadow-lg shadow-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-green-400 font-bold mb-1 drop-shadow-lg">🎤 ORGANIZE LIVE RECORDINGS</h3>
                <p className="text-xs text-cyan-200">
                  Group {files.filter(f => f['.tag'] === 'file' && isAudioFile(f.name)).length} audio files into date-based folders
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  • Extracts dates from filenames • Creates date folders • Groups recordings by date
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => organizeLiveRecordings('preview')}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 font-bold rounded shadow-lg hover:shadow-blue-500/50 transition-all"
                >
                  [PREVIEW]
                </button>
                <button
                  onClick={() => organizeLiveRecordings('organize')}
                  className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white border border-green-400 font-bold rounded shadow-lg hover:shadow-green-500/50 transition-all"
                >
                  [ORGANIZE]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audio Clustering Button - Show when there are multiple audio files */}
        {files.filter(f => f['.tag'] === 'file' && isAudioFile(f.name)).length >= 2 && (
          <div className="mb-4 bg-black/60 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-cyan-400 font-bold mb-1 drop-shadow-lg">🎵 CLUSTER AUDIO FILES</h3>
                <p className="text-xs text-cyan-200">
                  Find similar recordings from {files.filter(f => f['.tag'] === 'file' && isAudioFile(f.name)).length} audio files
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  • Groups different takes of same song • Identifies musical variations • Organizes by similarity
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAudioClustering(true)}
                  className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 font-bold rounded shadow-lg hover:shadow-cyan-500/50 transition-all"
                >
                  [ANALYZE CLUSTERS]
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Cluster Folders Button - Show when there are cluster folders */}
        {files.filter(f => f['.tag'] === 'folder' && f.name.startsWith('cluster_')).length > 0 && (
          <div className="mb-4 bg-black/60 backdrop-blur-sm border border-purple-500/50 rounded-lg p-4 shadow-lg shadow-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-purple-400 font-bold mb-1 drop-shadow-lg">🔄 RENAME CLUSTER FOLDERS</h3>
                <p className="text-xs text-cyan-200">
                  Update {files.filter(f => f['.tag'] === 'folder' && f.name.startsWith('cluster_')).length} cluster folders to use date + song name format
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  • Analyzes folder contents • Extracts song titles • Uses YYYYMMDD_Song_Name format
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleRenameClusters}
                  disabled={renamingClusters}
                  className={`px-3 py-1 text-xs rounded border font-bold transition-all ${
                    renamingClusters
                      ? 'bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-lg hover:shadow-purple-500/50'
                  }`}
                >
                  {renamingClusters ? '[RENAMING...]' : '[RENAME CLUSTERS]'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          processAudioFile(file);
                        }}
                        disabled={audioAnalysis[file.path_display]?.isProcessing}
                        className={`px-2 py-1 text-xs rounded border transition-all duration-200 flex items-center space-x-1 ${
                          audioAnalysis[file.path_display]?.isProcessing
                            ? 'bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed'
                            : audioAnalysis[file.path_display]?.bpm
                              ? 'bg-green-600 hover:bg-green-500 text-white border-green-400 shadow-lg shadow-green-500/30'
                              : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-lg hover:shadow-purple-500/30'
                        }`}
                        title={audioAnalysis[file.path_display]?.isProcessing ? 'Processing...' : audioAnalysis[file.path_display]?.bpm ? 'Re-analyze' : 'Analyze Audio'}
                      >
                        <span>
                          {audioAnalysis[file.path_display]?.isProcessing ? '⚙️' : 
                           audioAnalysis[file.path_display]?.bpm ? '✅' : '🎤'}
                        </span>
                        <span className="font-bold">
                          {audioAnalysis[file.path_display]?.isProcessing ? 'PROCESSING' : 
                           audioAnalysis[file.path_display]?.bpm ? 'ANALYZED' : 'PROCESS'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Audio analysis results */}
                {isAudioFile(file.name) && audioAnalysis[file.path_display] && !audioAnalysis[file.path_display].isProcessing && audioAnalysis[file.path_display].bpm && (
                  <div className="px-3 pb-3">
                    <div className="bg-black/40 border border-green-500/20 rounded-lg p-3 mt-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="text-center">
                          <div className="text-green-400 font-bold">{audioAnalysis[file.path_display].bpm} BPM</div>
                          <div className="text-gray-400">Tempo</div>
                        </div>
                        <div className="text-center">
                          <div className="text-purple-400 font-bold">{audioAnalysis[file.path_display].key || 'Unknown'}</div>
                          <div className="text-gray-400">Key</div>
                        </div>
                        <div className="text-center">
                          <div className="text-yellow-400 font-bold capitalize">{audioAnalysis[file.path_display].mood || 'Unknown'}</div>
                          <div className="text-gray-400">Mood</div>
                        </div>
                        <div className="text-center">
                          <div className={`font-bold ${
                            audioAnalysis[file.path_display].quality === 'High-Quality' ? 'text-green-400' :
                            audioAnalysis[file.path_display].quality === 'Professional' ? 'text-blue-400' :
                            audioAnalysis[file.path_display].quality === 'Demo' ? 'text-yellow-400' :
                            'text-gray-400'
                          }`}>
                            {audioAnalysis[file.path_display].quality || 'Unknown'}
                          </div>
                          <div className="text-gray-400">Quality</div>
                        </div>
                      </div>
                      
                      {audioAnalysis[file.path_display].suggestedName && (
                        <div className="mt-3 pt-2 border-t border-green-500/20">
                          <div className="text-xs text-gray-400">AI Suggested Name:</div>
                          <div className="text-green-300 font-medium text-sm mt-1">
                            {audioAnalysis[file.path_display].suggestedName}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                      If audio doesn&apos;t play, try refreshing or check browser console for errors.
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

        {/* Lyrics Generator Modal */}
        {showLyricsGenerator && (
          <LyricsGenerator onClose={() => setShowLyricsGenerator(false)} />
        )}

        {/* Audio Clustering Modal */}
        {showAudioClustering && (
          <AudioClustering
            currentPath={currentPath}
            onClose={() => setShowAudioClustering(false)}
            onOrganizeComplete={() => {
              clearCacheForPath(currentPath);
              loadFiles(currentPath);
            }}
          />
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
