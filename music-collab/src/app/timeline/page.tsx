'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: 'rename' | 'move' | 'analyze' | 'upload' | 'delete' | 'organize' | 'restore' | 'create_folder';
  filePath: string;
  oldPath?: string;
  newPath?: string;
  details: {
    originalName?: string;
    newName?: string;
    category?: string;
    dateSource?: string;
    detectedDate?: string;
    folderCreated?: string;
    analysisResults?: any;
    fileSize?: number;
    duration?: number;
  };
  metadata?: {
    userId?: string;
    userAgent?: string;
    ip?: string;
  };
}

interface TimelineStats {
  totalActivities: number;
  actionCounts: {[key: string]: number};
  dateRange: {
    earliest: string;
    latest: string;
  } | null;
}

export default function Timeline() {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const router = useRouter();

  useEffect(() => {
    loadActivities();
  }, [filter, limit]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: '0'
      });

      if (filter) {
        params.append('action', filter);
      }

      const response = await fetch(apiUrl(`/api/timeline?${params}`), {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to load timeline');
      }

      const data = await response.json();
      setActivities(data.activities);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const icons = {
      rename: '✏️',
      move: '📁',
      analyze: '🔍',
      upload: '📤',
      delete: '🗑️',
      organize: '📊',
      restore: '↩️',
      create_folder: '📁'
    };
    return icons[action as keyof typeof icons] || '📄';
  };

  const getActionColor = (action: string) => {
    const colors = {
      rename: 'text-blue-400',
      move: 'text-green-400',
      analyze: 'text-purple-400',
      upload: 'text-yellow-400',
      delete: 'text-red-400',
      organize: 'text-cyan-400',
      restore: 'text-orange-400',
      create_folder: 'text-indigo-400'
    };
    return colors[action as keyof typeof colors] || 'text-gray-400';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes === 0 ? 'Just now' : `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  const renderActivityDetails = (activity: ActivityLogEntry) => {
    const { action, details, oldPath, newPath } = activity;

    switch (action) {
      case 'rename':
        return (
          <div className="text-sm text-gray-300">
            <span className="text-red-300">{details.originalName}</span>
            <span className="text-gray-500"> → </span>
            <span className="text-green-300">{details.newName}</span>
          </div>
        );

      case 'move':
        return (
          <div className="text-sm text-gray-300">
            <div><span className="text-gray-500">From:</span> {oldPath}</div>
            <div><span className="text-gray-500">To:</span> {newPath}</div>
            {details.category && (
              <div className="text-xs text-cyan-400 mt-1">Category: {details.category}</div>
            )}
          </div>
        );

      case 'analyze':
        return (
          <div className="text-sm text-gray-300">
            Analysis completed
            {details.analysisResults && (
              <div className="text-xs text-purple-400 mt-1">
                Results: {JSON.stringify(details.analysisResults).substring(0, 100)}...
              </div>
            )}
          </div>
        );

      case 'organize':
        return (
          <div className="text-sm text-gray-300">
            <div>Organized into: <span className="text-cyan-400">{details.category}</span></div>
            {details.dateSource && (
              <div className="text-xs text-yellow-400">Date from: {details.dateSource}</div>
            )}
            {details.detectedDate && (
              <div className="text-xs text-green-400">Detected date: {details.detectedDate}</div>
            )}
          </div>
        );

      case 'create_folder':
        return (
          <div className="text-sm text-gray-300">
            Created folder: <span className="text-indigo-400">{details.folderCreated}</span>
          </div>
        );

      case 'upload':
        return (
          <div className="text-sm text-gray-300">
            <div>File uploaded</div>
            {details.fileSize && (
              <div className="text-xs text-gray-400">Size: {(details.fileSize / 1024 / 1024).toFixed(2)} MB</div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-300">
            {action.charAt(0).toUpperCase() + action.slice(1)} completed
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono">
      <div className="container mx-auto px-3 py-3">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center border-b-2 border-cyan-400 pb-2 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
          <div>
            <h1 className="text-xl font-bold text-white mb-1 drop-shadow-lg">📊 ACTIVITY TIMELINE</h1>
            <p className="text-sm text-cyan-300">
              Track all file operations and changes
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => router.push('/dashboard')}
              className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 font-bold rounded shadow-lg hover:shadow-cyan-500/50 transition-all"
            >
              [BACK TO DASHBOARD]
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-black/60 border-cyan-500/30">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{stats.totalActivities}</div>
                  <div className="text-sm text-gray-400">Total Activities</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/60 border-cyan-500/30">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    {Object.keys(stats.actionCounts).length}
                  </div>
                  <div className="text-sm text-gray-400">Action Types</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/60 border-cyan-500/30">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-sm font-bold text-purple-400">
                    {stats.dateRange ? formatTimestamp(stats.dateRange.earliest) : 'No data'}
                  </div>
                  <div className="text-sm text-gray-400">First Activity</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 bg-black/60 backdrop-blur-sm border border-gray-500/30 rounded-lg p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-400">Filter by action:</span>
            <button
              onClick={() => setFilter('')}
              className={`px-2 py-1 text-xs rounded border transition-all ${
                filter === '' ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {stats && Object.keys(stats.actionCounts).map(action => (
              <button
                key={action}
                onClick={() => setFilter(action)}
                className={`px-2 py-1 text-xs rounded border transition-all ${
                  filter === action ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                }`}
              >
                {getActionIcon(action)} {action} ({stats.actionCounts[action]})
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center text-yellow-300 animate-pulse">&gt;&gt;&gt; LOADING TIMELINE...</div>
        ) : (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg">📋 No activities found</div>
                <div className="text-sm text-gray-500 mt-2">
                  {filter ? `No ${filter} activities recorded` : 'No activities have been logged yet'}
                </div>
              </div>
            ) : (
              activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="bg-black/60 backdrop-blur-sm border border-gray-500/30 rounded-lg p-4 hover:border-cyan-500/50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`text-2xl ${getActionColor(activity.action)}`}>
                        {getActionIcon(activity.action)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`font-bold text-sm ${getActionColor(activity.action)}`}>
                            {activity.action.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(activity.timestamp)}
                          </span>
                        </div>
                        <div className="text-white font-medium text-sm mb-2">
                          {getFileName(activity.filePath)}
                        </div>
                        {renderActivityDetails(activity)}
                        <div className="text-xs text-gray-500 mt-2">
                          Path: {activity.filePath}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {activities.length >= limit && (
              <div className="text-center py-4">
                <Button
                  onClick={() => setLimit(limit + 50)}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white border border-purple-400 font-bold rounded shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  [LOAD MORE]
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}