'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';

interface TimelineEvent {
  timestamp: string;
  action: string;
  filePath?: string;
  details?: any;
}

interface TimelineCardProps {
  className?: string;
  initialExpanded?: boolean;
  maxHeight?: string;
}

export default function TimelineCard({
  className = '',
  initialExpanded = false,
  maxHeight = '600px'
}: TimelineCardProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (expanded && events.length === 0) {
      loadTimeline();
    }
  }, [expanded]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/timeline?limit=50'), {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTimeline = async () => {
    setRefreshing(true);
    await loadTimeline();
    setRefreshing(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (action: string) => {
    if (action.includes('upload')) return '📤';
    if (action.includes('organize')) return '📁';
    if (action.includes('cluster')) return '🎵';
    if (action.includes('lyrics')) return '📝';
    if (action.includes('download')) return '📥';
    if (action.includes('audio')) return '🎤';
    if (action.includes('move') || action.includes('rename')) return '✏️';
    if (action.includes('create')) return '✨';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('auth') || action.includes('login')) return '🔑';
    return '📌';
  };

  const getActionColor = (action: string) => {
    if (action.includes('upload')) return 'text-green-400';
    if (action.includes('organize') || action.includes('cluster')) return 'text-blue-400';
    if (action.includes('lyrics') || action.includes('create')) return 'text-purple-400';
    if (action.includes('audio')) return 'text-yellow-400';
    if (action.includes('delete')) return 'text-red-400';
    return 'text-cyan-400';
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatFilePath = (path?: string) => {
    if (!path) return null;
    const parts = path.split('/');
    return parts.slice(-2).join('/');
  };

  return (
    <div className={`bg-black/60 backdrop-blur-sm border border-cyan-500/30 rounded-lg shadow-lg hover:shadow-cyan-500/20 transition-all ${className}`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-black/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl drop-shadow-lg animate-pulse">📊</span>
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-lg">Timeline</h3>
              <p className="text-xs text-cyan-300">
                {events.length > 0
                  ? `${events.length} recent activities`
                  : 'Click to view activity history'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {expanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refreshTimeline();
                }}
                disabled={refreshing}
                className={`px-3 py-1 text-xs rounded border font-bold transition-all ${
                  refreshing
                    ? 'bg-gray-600 text-gray-300 border-gray-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-lg hover:shadow-cyan-500/30'
                }`}
              >
                {refreshing ? '⟳' : '⟳'}
              </button>
            )}
            <span className={`text-xl transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t border-cyan-500/20">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-yellow-300 animate-pulse">Loading timeline...</div>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>No activity recorded yet</p>
            </div>
          ) : (
            <div className="md:flex" style={{ maxHeight }}>
              {/* Events List - Left Side on Desktop, Full Width on Mobile */}
              <div className="md:w-1/2 md:border-r md:border-cyan-500/20 overflow-y-auto">
                <div className="p-4 space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedEvent(event)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedEvent === event
                          ? 'bg-cyan-900/40 border-cyan-400/50 shadow-lg shadow-cyan-500/20'
                          : 'bg-black/40 border-gray-700/50 hover:bg-black/60 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl drop-shadow-lg mt-1">
                          {getActionIcon(event.action)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-sm ${getActionColor(event.action)}`}>
                              {formatActionName(event.action)}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>
                          {event.filePath && (
                            <div className="text-xs text-cyan-200 mt-1 truncate">
                              {formatFilePath(event.filePath)}
                            </div>
                          )}
                          {/* Mobile: Show basic details inline */}
                          <div className="md:hidden">
                            {event.details?.filesOrganized && (
                              <div className="text-xs text-gray-400 mt-1">
                                {event.details.filesOrganized} files organized
                              </div>
                            )}
                            {event.details?.clustersFound !== undefined && (
                              <div className="text-xs text-gray-400 mt-1">
                                {event.details.clustersFound} clusters found
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Details - Right Side on Desktop, Hidden on Mobile (shown inline instead) */}
              <div className="hidden md:block md:w-1/2 overflow-y-auto">
                {selectedEvent ? (
                  <div className="p-4">
                    <div className="bg-black/40 border border-cyan-500/30 rounded-lg p-4">
                      <h4 className="text-lg font-bold text-white mb-3 flex items-center space-x-2">
                        <span>{getActionIcon(selectedEvent.action)}</span>
                        <span>{formatActionName(selectedEvent.action)}</span>
                      </h4>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Time:</span>
                          <span className="text-cyan-200 ml-2">
                            {new Date(selectedEvent.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {selectedEvent.filePath && (
                          <div>
                            <span className="text-gray-400">Path:</span>
                            <div className="text-cyan-200 mt-1 text-xs font-mono bg-black/40 p-2 rounded break-all">
                              {selectedEvent.filePath}
                            </div>
                          </div>
                        )}

                        {selectedEvent.details && (
                          <div>
                            <span className="text-gray-400">Details:</span>
                            <div className="mt-2 space-y-1">
                              {Object.entries(selectedEvent.details).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="text-gray-500 capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                                  </span>
                                  <span className="text-cyan-300 font-mono">
                                    {typeof value === 'object'
                                      ? JSON.stringify(value, null, 2)
                                      : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-2">📋</div>
                    <p>Select an event to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}