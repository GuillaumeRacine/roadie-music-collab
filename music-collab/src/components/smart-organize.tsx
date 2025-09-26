'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GroupedFiles {
  groupName: string;
  folderPath: string;
  files: Array<{
    name: string;
    path_display: string;
    size?: number;
  }>;
  reason: string;
  confidence: number;
}

interface SmartOrganizeProps {
  currentPath: string;
  onComplete?: () => void;
}

export default function SmartOrganize({ currentPath, onComplete }: SmartOrganizeProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [suggestions, setSuggestions] = useState<GroupedFiles[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);

  const analyzePath = async (strategy: string = 'all') => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(apiUrl('/api/dropbox/smart-organize'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          path: currentPath,
          strategy
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuggestions(data.suggestions || []);
        setSelectedSuggestions(new Set(data.suggestions.map((_: any, index: number) => index)));
        setShowSuggestions(true);
      } else {
        alert(`Error: ${data.error || 'Failed to analyze files'}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze files for organization');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const executeOrganization = async () => {
    if (selectedSuggestions.size === 0) {
      alert('Please select at least one organization suggestion');
      return;
    }

    setIsOrganizing(true);
    try {
      const selectedSuggestionsList = suggestions.filter((_, index) => 
        selectedSuggestions.has(index)
      );

      const response = await fetch(apiUrl('/api/dropbox/smart-organize'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          suggestions: selectedSuggestionsList
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const successful = data.results.filter((r: any) => r.success).length;
        const total = data.results.length;
        
        alert(`Organization completed! ${successful}/${total} groups organized successfully.`);
        
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        
        if (onComplete) {
          onComplete();
        }
      } else {
        alert(`Error: ${data.error || 'Failed to organize files'}`);
      }
    } catch (error) {
      console.error('Organization error:', error);
      alert('Failed to organize files');
    } finally {
      setIsOrganizing(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="mb-6">
      <Card className="bg-black/60 border border-purple-500/30 text-cyan-200">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            🧠 Smart File Organization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showSuggestions ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                Automatically group similar audio files by recording sessions, song names, and upload timing.
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => analyzePath('all')}
                  disabled={isAnalyzing}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-sm"
                >
                  {isAnalyzing ? '🔍 Analyzing...' : '🔍 Analyze All'}
                </Button>
                
                <Button
                  onClick={() => analyzePath('date')}
                  disabled={isAnalyzing}
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-sm"
                >
                  📅 By Date
                </Button>
                
                <Button
                  onClick={() => analyzePath('similarity')}
                  disabled={isAnalyzing}
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-sm"
                >
                  🎵 By Name
                </Button>
                
                <Button
                  onClick={() => analyzePath('timing')}
                  disabled={isAnalyzing}
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-sm"
                >
                  ⏱️ By Timing
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Organization Suggestions ({suggestions.length})
                </h3>
                <Button
                  onClick={() => setShowSuggestions(false)}
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-xs"
                >
                  Back
                </Button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`border rounded p-3 cursor-pointer transition-colors ${
                      selectedSuggestions.has(index)
                        ? 'border-purple-400 bg-purple-900/30'
                        : 'border-gray-600 bg-gray-900/30'
                    }`}
                    onClick={() => toggleSuggestion(index)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-white">{suggestion.groupName}</h4>
                        <p className="text-xs text-gray-400 mt-1">{suggestion.folderPath}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                          {getConfidenceText(suggestion.confidence)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {suggestion.files.length} files
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-300 mb-2">{suggestion.reason}</p>
                    
                    <div className="space-y-1">
                      {suggestion.files.slice(0, 3).map((file, fileIndex) => (
                        <div key={fileIndex} className="text-xs text-gray-400 flex justify-between">
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="ml-2 text-gray-500">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                      {suggestion.files.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{suggestion.files.length - 3} more files...
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(index)}
                        onChange={() => toggleSuggestion(index)}
                        className="w-4 h-4 accent-purple-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label className="ml-2 text-xs text-gray-400">
                        Include in organization
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {suggestions.length > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-600">
                  <div className="text-sm text-gray-400">
                    {selectedSuggestions.size} of {suggestions.length} selected
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedSuggestions(new Set())}
                      variant="outline"
                      className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-sm"
                      disabled={isOrganizing}
                    >
                      Deselect All
                    </Button>
                    
                    <Button
                      onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}
                      variant="outline"
                      className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-sm"
                      disabled={isOrganizing}
                    >
                      Select All
                    </Button>
                    
                    <Button
                      onClick={executeOrganization}
                      disabled={isOrganizing || selectedSuggestions.size === 0}
                      className="bg-green-600 hover:bg-green-500 text-white text-sm"
                    >
                      {isOrganizing ? '📁 Organizing...' : `📁 Organize ${selectedSuggestions.size} Groups`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}