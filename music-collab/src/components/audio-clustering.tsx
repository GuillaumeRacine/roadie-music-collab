'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';

interface AudioCluster {
  id: string;
  name: string;
  files: Array<{
    filePath: string;
    fileName: string;
    duration: number;
    tempo?: number;
    key?: string;
  }>;
  averageTempo?: number;
  dominantKey?: string;
  averageDuration: number;
  confidence: number;
  suggestedCategory: 'same_song_takes' | 'similar_ideas' | 'same_session' | 'unrelated';
}

interface AudioClusteringProps {
  currentPath: string;
  onClose: () => void;
  onOrganizeComplete: () => void;
}

export default function AudioClustering({ currentPath, onClose, onOrganizeComplete }: AudioClusteringProps) {
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<AudioCluster[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [analysisStats, setAnalysisStats] = useState<any>(null);

  const analyzeClusters = async () => {
    setAnalyzing(true);
    setProgressMessages([]);
    setAnalysisStats(null);
    setClusters([]);

    try {
      setProgressMessages(['🎵 Starting audio clustering analysis...']);

      const response = await fetch(apiUrl('/api/audio-analysis/cluster'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          folderPath: currentPath,
          action: 'analyze'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setClusters(data.clusters || []);
        setAnalysisStats(data.statistics);

        if (data.progressMessages) {
          setProgressMessages(prev => [...prev, ...data.progressMessages]);
        }

        if (data.errors && data.errors.length > 0) {
          setProgressMessages(prev => [...prev, '⚠️ Some files had errors:', ...data.errors.slice(0, 3)]);
        }

        if (data.clusters.length === 0) {
          setProgressMessages(prev => [...prev,
            `🔍 No clusters found with auto-selected threshold`,
            '💡 This might indicate:',
            '   • Files have very different naming patterns',
            '   • Files are from different recording sessions',
            '   • Look for common words or patterns in filenames'
          ]);
        } else {
          setProgressMessages(prev => [...prev, `✅ Found ${data.clusters.length} clusters from ${data.statistics?.analyzedFiles || 0} files!`]);
        }
      } else {
        console.error('Clustering failed:', data.error);
        setProgressMessages(prev => [...prev, `❌ Clustering failed: ${data.error}`]);
      }
    } catch (error) {
      console.error('Clustering error:', error);
      setProgressMessages(prev => [...prev, '❌ Failed to analyze audio clusters']);
    } finally {
      setAnalyzing(false);
    }
  };

  const organizeCluster = async (cluster: AudioCluster) => {
    setOrganizing(true);
    setSelectedCluster(cluster.id);

    try {
      const filePaths = cluster.files.map(f => f.filePath);

      const response = await fetch(apiUrl('/api/audio-analysis/cluster'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          folderPath: currentPath,
          action: 'organize_cluster',
          cluster_id: cluster.id,
          files: filePaths,
          cluster_name: cluster.name,
          cluster_category: cluster.suggestedCategory,
          cluster_confidence: cluster.confidence
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const successCount = data.results?.filter((r: any) => r.status === 'success').length || 0;
        const errorCount = data.results?.filter((r: any) => r.status === 'error').length || 0;

        let message = data.message;
        if (errorCount > 0) {
          message += `\n\n⚠️ ${errorCount} files failed to move.`;
        }

        alert(message);

        // Remove organized cluster from display
        setClusters(prev => prev.filter(c => c.id !== cluster.id));

        // Notify parent to refresh file listing
        onOrganizeComplete();
      } else {
        console.error('Organization failed:', data.error);
        alert(`Organization failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Organization error:', error);
      alert('Failed to organize cluster');
    } finally {
      setOrganizing(false);
      setSelectedCluster(null);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'same_song_takes': return 'text-green-400';
      case 'similar_ideas': return 'text-yellow-400';
      case 'same_session': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'same_song_takes': return '🎵';
      case 'similar_ideas': return '💡';
      case 'same_session': return '🎤';
      default: return '📄';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-black/90 border border-cyan-500/50 rounded-lg p-6 max-w-6xl max-h-[90vh] overflow-auto shadow-xl shadow-cyan-500/30 w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white drop-shadow-lg flex items-center space-x-2">
            <span>🎵</span>
            <span>Audio Clustering Analysis</span>
          </h2>
          <button
            onClick={onClose}
            className="text-cyan-400 hover:text-white text-xl font-bold px-2 py-1 rounded hover:bg-cyan-500/20 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 text-sm text-cyan-200">
          <p>Find similar audio files like different takes of the same song or musical variations.</p>
          <p className="text-xs text-gray-400 mt-1">Path: {currentPath}</p>
        </div>

        {/* Controls */}
        <div className="mb-6 bg-black/40 border border-cyan-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-cyan-200">
              <p>🤖 Smart clustering automatically selects the optimal similarity threshold for best results</p>
            </div>
            <button
              onClick={analyzeClusters}
              disabled={analyzing}
              className={`px-4 py-2 text-sm rounded border font-bold transition-all ${
                analyzing
                  ? 'bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg hover:shadow-cyan-500/30'
              }`}
            >
              {analyzing ? '🔄 ANALYZING...' : '🎯 ANALYZE CLUSTERS'}
            </button>
          </div>
        </div>

        {/* Progress Messages */}
        {(analyzing || progressMessages.length > 0) && (
          <div className="mb-6 bg-black/40 border border-yellow-500/20 rounded-lg p-4">
            <h3 className="text-yellow-400 font-bold mb-2 flex items-center space-x-2">
              <span>📋</span>
              <span>Analysis Progress</span>
              {analyzing && <span className="animate-spin">⚙️</span>}
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {progressMessages.map((message, idx) => (
                <div key={idx} className="text-xs font-mono text-gray-300">
                  {message}
                </div>
              ))}
              {analyzing && (
                <div className="text-xs font-mono text-yellow-400 animate-pulse">
                  ⏳ Analyzing audio files...
                </div>
              )}
            </div>
            {analysisStats && (
              <div className="mt-3 pt-2 border-t border-yellow-500/20 text-xs">
                <div className="grid grid-cols-2 gap-4 text-gray-400">
                  <div>📊 Files: {analysisStats.analyzedFiles}/{analysisStats.totalFiles}</div>
                  <div>🎯 Clusters: {analysisStats.clustersFound}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {clusters.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white mb-4">
              Found {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
            </h3>

            {clusters.map((cluster) => (
              <div key={cluster.id} className="bg-black/60 border border-green-500/30 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>{getCategoryIcon(cluster.suggestedCategory)}</span>
                      <span>{cluster.name}</span>
                    </h4>
                    <div className="flex items-center space-x-4 text-xs mt-1">
                      <span className={`font-bold ${getCategoryColor(cluster.suggestedCategory)}`}>
                        {cluster.suggestedCategory.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-gray-400">
                        Confidence: {Math.round(cluster.confidence * 100)}%
                      </span>
                      <span className="text-gray-400">
                        {cluster.files.length} files
                      </span>
                      {cluster.averageTempo && (
                        <span className="text-purple-400">
                          ~{Math.round(cluster.averageTempo)} BPM
                        </span>
                      )}
                      {cluster.dominantKey && (
                        <span className="text-yellow-400">
                          Key: {cluster.dominantKey}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => organizeCluster(cluster)}
                    disabled={organizing && selectedCluster === cluster.id}
                    className={`px-3 py-1 text-xs rounded border font-bold transition-all ${
                      organizing && selectedCluster === cluster.id
                        ? 'bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white border-green-400 shadow-lg hover:shadow-green-500/30'
                    }`}
                  >
                    {organizing && selectedCluster === cluster.id ? '📁 ORGANIZING...' : '📁 ORGANIZE'}
                  </button>
                </div>

                {/* File list */}
                <div className="grid gap-2">
                  {cluster.files.map((file, idx) => (
                    <div key={idx} className="bg-black/40 border border-gray-600/30 rounded p-2 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <span className="text-cyan-300 text-sm font-mono">
                          {file.fileName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDuration(file.duration)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs">
                        {file.tempo && (
                          <span className="text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                            {Math.round(file.tempo)} BPM
                          </span>
                        )}
                        {file.key && (
                          <span className="text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">
                            {file.key}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="text-xs text-gray-400 text-center mt-4">
              <p>💡 Tip: Organizing will create a new subfolder and move similar files into it.</p>
              <p>Files are grouped by filename similarity, tempo, key, and creation time.</p>
            </div>
          </div>
        )}

        {clusters.length === 0 && !analyzing && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">🎵</div>
            <p>Click "ANALYZE CLUSTERS" to find similar audio files</p>
            <p className="text-xs mt-2">This will analyze audio metadata and group similar recordings</p>
          </div>
        )}
      </div>
    </div>
  );
}