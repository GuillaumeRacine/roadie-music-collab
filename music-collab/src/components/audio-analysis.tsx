'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AudioAnalysisResult {
  fileName: string;
  filePath: string;
  
  basicMetadata: {
    duration?: number;
    size: number;
    format?: string;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
  };
  
  audioAnalysis: {
    bpm?: number;
    key?: string;
    energy?: number;
    mood?: string[];
    genre?: string[];
    hasVocals?: boolean;
    isInstrumental?: boolean;
  };
  
  aiAnalysis?: {
    extractedLyrics?: string;
    songStructure?: {
      hasIntro?: boolean;
      hasVerses?: boolean;
      hasChorus?: boolean;
      hasBridge?: boolean;
      hasOutro?: boolean;
    };
    musicalContent?: {
      dominantInstruments?: string[];
      complexity?: 'Simple' | 'Moderate' | 'Complex';
      recordingQuality?: 'Demo' | 'Professional' | 'High-Quality';
    };
    suggestions?: {
      suggestedName?: string;
      tags?: string[];
      groupWith?: string[];
      improvements?: string[];
    };
  };
  
  confidence: number;
  analysisTimestamp: string;
}

interface AudioAnalysisProps {
  currentPath: string;
  files: Array<{
    name: string;
    path_display: string;
    '.tag': string;
  }>;
  onAnalysisComplete?: () => void;
}

export default function AudioAnalysis({ currentPath, files, onAnalysisComplete }: AudioAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AudioAnalysisResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<AudioAnalysisResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Filter to only audio files
  const audioFiles = files.filter(file => {
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    return file['.tag'] === 'file' && 
           audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  });

  const analyzeSingleFile = async (filePath: string) => {
    setIsAnalyzing(true);
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
        setAnalysisResults([data.analysis]);
        setSelectedFile(data.analysis);
        setShowResults(true);
      } else {
        alert(`Error: ${data.error || 'Failed to analyze audio file'}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze audio file');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeAllFiles = async () => {
    if (audioFiles.length === 0) {
      alert('No audio files found in current folder');
      return;
    }

    setIsAnalyzing(true);
    try {
      const filePaths = audioFiles.map(file => file.path_display);
      
      const response = await fetch(apiUrl('/api/audio-analysis'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ filePaths }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setAnalysisResults(data.analyses);
        setSelectedFile(data.analyses[0] || null);
        setShowResults(true);
        
        if (data.errors.length > 0) {
          console.warn('Some files failed analysis:', data.errors);
        }
      } else {
        alert(`Error: ${data.error || 'Failed to analyze audio files'}`);
      }
    } catch (error) {
      console.error('Batch analysis error:', error);
      alert('Failed to analyze audio files');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'High-Quality': return 'text-green-400';
      case 'Professional': return 'text-blue-400';
      case 'Demo': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getComplexityColor = (complexity?: string) => {
    switch (complexity) {
      case 'Complex': return 'text-purple-400';
      case 'Moderate': return 'text-blue-400';
      case 'Simple': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="mb-6">
      <Card className="bg-black/60 border border-green-500/30 text-cyan-200">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            🎤 AI Audio Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showResults ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                Extract BPM, key signature, lyrics, and get AI insights about your audio content.
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={analyzeAllFiles}
                  disabled={isAnalyzing || audioFiles.length === 0}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm"
                >
                  {isAnalyzing ? '🎵 Analyzing...' : `🎵 Analyze All (${audioFiles.length})`}
                </Button>
                
                {audioFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {audioFiles.slice(0, 3).map((file, index) => (
                      <Button
                        key={index}
                        onClick={() => analyzeSingleFile(file.path_display)}
                        disabled={isAnalyzing}
                        variant="outline"
                        className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-xs px-2 py-1"
                      >
                        {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                      </Button>
                    ))}
                    {audioFiles.length > 3 && (
                      <span className="text-xs text-gray-400 self-center">
                        +{audioFiles.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {audioFiles.length === 0 && (
                <p className="text-sm text-yellow-400">
                  No audio files found in current folder
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Analysis Results ({analysisResults.length})
                </h3>
                <Button
                  onClick={() => setShowResults(false)}
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500 text-xs"
                >
                  Back
                </Button>
              </div>

              {/* File selector */}
              {analysisResults.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Select File:</label>
                  <div className="flex flex-wrap gap-1">
                    {analysisResults.map((result, index) => (
                      <Button
                        key={index}
                        onClick={() => setSelectedFile(result)}
                        variant={selectedFile?.fileName === result.fileName ? "default" : "outline"}
                        className={`text-xs px-2 py-1 ${
                          selectedFile?.fileName === result.fileName
                            ? "bg-green-600 hover:bg-green-500 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-white border-gray-500"
                        }`}
                      >
                        {result.fileName.length > 12 ? `${result.fileName.substring(0, 12)}...` : result.fileName}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis results display */}
              {selectedFile && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {/* Basic Info */}
                  <div className="bg-gray-900/50 rounded p-3">
                    <h4 className="font-medium text-white mb-2">📁 Basic Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">File:</span> 
                        <span className="ml-1 text-white">{selectedFile.fileName}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Size:</span> 
                        <span className="ml-1 text-cyan-300">{formatFileSize(selectedFile.basicMetadata.size)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Format:</span> 
                        <span className="ml-1 text-cyan-300">{selectedFile.basicMetadata.format || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Confidence:</span> 
                        <span className="ml-1 text-green-300">{Math.round(selectedFile.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio Analysis */}
                  <div className="bg-gray-900/50 rounded p-3">
                    <h4 className="font-medium text-white mb-2">🎵 Audio Analysis</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">BPM:</span> 
                        <span className="ml-1 text-green-300 font-mono">{selectedFile.audioAnalysis.bpm || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Key:</span> 
                        <span className="ml-1 text-purple-300">{selectedFile.audioAnalysis.key || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Mood:</span> 
                        <span className="ml-1 text-yellow-300 capitalize">{selectedFile.audioAnalysis.mood || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Type:</span> 
                        <span className="ml-1 text-blue-300">
                          {selectedFile.audioAnalysis.hasVocals ? '🎤 Vocal' : '🎸 Instrumental'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  {selectedFile.aiAnalysis && (
                    <>
                      {/* Quality & Complexity */}
                      <div className="bg-gray-900/50 rounded p-3">
                        <h4 className="font-medium text-white mb-2">🤖 AI Analysis</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-400">Quality:</span> 
                            <span className={`ml-1 font-medium ${getQualityColor(selectedFile.aiAnalysis.musicalContent?.recordingQuality)}`}>
                              {selectedFile.aiAnalysis.musicalContent?.recordingQuality || 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Complexity:</span> 
                            <span className={`ml-1 font-medium ${getComplexityColor(selectedFile.aiAnalysis.musicalContent?.complexity)}`}>
                              {selectedFile.aiAnalysis.musicalContent?.complexity || 'Unknown'}
                            </span>
                          </div>
                        </div>
                        
                        {selectedFile.aiAnalysis.suggestions?.suggestedName && (
                          <div className="mt-2">
                            <span className="text-gray-400 text-sm">Suggested Name:</span> 
                            <span className="ml-1 text-green-300 font-medium">
                              {selectedFile.aiAnalysis.suggestions.suggestedName}
                            </span>
                          </div>
                        )}
                        
                        {selectedFile.aiAnalysis.suggestions?.tags && (
                          <div className="mt-2">
                            <span className="text-gray-400 text-sm">Tags:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedFile.aiAnalysis.suggestions.tags.map((tag, i) => (
                                <span key={i} className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Lyrics */}
                      {selectedFile.aiAnalysis.extractedLyrics && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <h4 className="font-medium text-white mb-2">🎤 Extracted Lyrics</h4>
                          <div className="bg-black/40 rounded p-2 text-sm text-gray-300 whitespace-pre-line font-mono max-h-32 overflow-y-auto">
                            {selectedFile.aiAnalysis.extractedLyrics}
                          </div>
                        </div>
                      )}

                      {/* Suggestions */}
                      {selectedFile.aiAnalysis.suggestions?.improvements && (
                        <div className="bg-gray-900/50 rounded p-3">
                          <h4 className="font-medium text-white mb-2">💡 Suggestions</h4>
                          <div className="space-y-2 text-sm">
                            {selectedFile.aiAnalysis.suggestions.improvements.map((suggestion, i) => (
                              <div key={i} className="flex items-start">
                                <span className="text-yellow-400 mr-2">•</span>
                                <span className="text-gray-300">{suggestion}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}