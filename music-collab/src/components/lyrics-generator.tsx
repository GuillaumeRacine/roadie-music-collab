'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiUrl } from '@/lib/api';

interface LyricsFormData {
  prompt: string;
  songTitle: string;
  songStructure: string;
  theme: string;
  style: string;
  mood: string;
  targetAudience: string;
  personalContext: string;
  specificInstructions: string;
  referenceArtists: string;
  keyWords: string;
  avoidWords: string;
}

interface LyricsGeneratorProps {
  onClose: () => void;
}

export default function LyricsGenerator({ onClose }: LyricsGeneratorProps) {
  const [formData, setFormData] = useState<LyricsFormData>({
    prompt: '',
    songTitle: '',
    songStructure: '',
    theme: '',
    style: '',
    mood: '',
    targetAudience: '',
    personalContext: '',
    specificInstructions: '',
    referenceArtists: '',
    keyWords: '',
    avoidWords: ''
  });

  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSavingToGoogleDocs, setIsSavingToGoogleDocs] = useState(false);

  const handleInputChange = (field: keyof LyricsFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) {
      alert('Please enter a prompt for your lyrics');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(apiUrl('/api/ai/create-lyrics'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setGeneratedLyrics(result.lyrics);

        // Show comprehensive save results
        let alertMessage = `✅ ${result.message}\n\n`;

        if (result.dropbox) {
          alertMessage += `📁 Dropbox: ${result.dropbox.filename}\n`;
        }

        if (result.googleDocs) {
          alertMessage += `📄 Google Docs: ${result.googleDocs.title}\n`;
          alertMessage += `🔗 URL: ${result.googleDocs.documentUrl}\n`;
        }

        if (result.errors && result.errors.length > 0) {
          alertMessage += `\n⚠️ Issues:\n${result.errors.join('\n')}`;
        }

        alert(alertMessage);

        // Auto-open Google Doc if available
        if (result.googleDocs?.documentUrl) {
          window.open(result.googleDocs.documentUrl, '_blank');
        }
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error generating lyrics:', error);
      alert('❌ Failed to generate lyrics. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToGoogleDocs = async () => {
    if (!generatedLyrics.trim()) {
      alert('Please generate lyrics first before saving to Google Docs');
      return;
    }

    setIsSavingToGoogleDocs(true);
    try {
      const response = await fetch(apiUrl('/api/ai/save-lyrics-gdocs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          lyrics: generatedLyrics,
          songTitle: formData.songTitle,
          style: formData.style,
          mood: formData.mood
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Lyrics saved to Google Docs!\n\nDocument: ${result.title}\nURL: ${result.documentUrl}\n\nClick OK to open in new tab.`);

        // Open the Google Doc in a new tab
        window.open(result.documentUrl, '_blank');
      } else {
        alert(`❌ Error saving to Google Docs: ${result.error}\n\nDetails: ${result.details || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving to Google Docs:', error);
      alert('❌ Failed to save to Google Docs. Please check your internet connection and try again.');
    } finally {
      setIsSavingToGoogleDocs(false);
    }
  };

  const presetStyles = [
    'Pop', 'Rock', 'Country', 'R&B/Soul', 'Hip-Hop/Rap', 'Folk', 'Blues',
    'Jazz', 'Alternative', 'Indie', 'Electronic', 'Reggae', 'Punk', 'Metal'
  ];

  const presetMoods = [
    'Happy/Upbeat', 'Sad/Melancholic', 'Angry/Intense', 'Romantic/Love',
    'Nostalgic', 'Hopeful/Inspiring', 'Dark/Moody', 'Energetic', 'Calm/Peaceful',
    'Rebellious', 'Empowering', 'Vulnerable', 'Contemplative', 'Celebratory'
  ];

  const presetStructures = [
    'Verse - Chorus - Verse - Chorus - Bridge - Chorus',
    'Intro - Verse - Chorus - Verse - Chorus - Bridge - Chorus - Outro',
    'Verse - Pre-Chorus - Chorus - Verse - Pre-Chorus - Chorus - Bridge - Chorus',
    'Verse - Verse - Chorus - Verse - Chorus - Bridge - Chorus - Chorus',
    'Custom (specify in instructions)'
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-purple-500/50 rounded-lg max-w-4xl max-h-[90vh] overflow-auto shadow-xl shadow-purple-500/30">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">🎵 AI LYRICS GENERATOR</h2>
            <button
              onClick={onClose}
              className="text-cyan-400 hover:text-white text-xl font-bold px-3 py-1 rounded hover:bg-purple-500/20 transition-all"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Section */}
            <div className="space-y-4">
              {/* Basic Fields */}
              <Card className="bg-black/60 border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="text-cyan-400 text-lg">📝 Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Song Concept/Prompt *
                    </label>
                    <textarea
                      value={formData.prompt}
                      onChange={(e) => handleInputChange('prompt', e.target.value)}
                      placeholder="Describe your song idea, story, or concept..."
                      className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Song Title (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.songTitle}
                      onChange={(e) => handleInputChange('songTitle', e.target.value)}
                      placeholder="Enter song title or leave blank to generate"
                      className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Musical Style/Genre
                    </label>
                    <select
                      value={formData.style}
                      onChange={(e) => handleInputChange('style', e.target.value)}
                      className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Select a style...</option>
                      {presetStyles.map(style => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mood/Emotion
                    </label>
                    <select
                      value={formData.mood}
                      onChange={(e) => handleInputChange('mood', e.target.value)}
                      className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Select a mood...</option>
                      {presetMoods.map(mood => (
                        <option key={mood} value={mood}>{mood}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full p-3 bg-purple-600/20 border border-purple-500/30 rounded text-purple-300 hover:bg-purple-600/30 transition-all font-medium"
                >
                  {showAdvanced ? '🔽' : '🔽'} Advanced Options {showAdvanced ? '(Hide)' : '(Show)'}
                </button>

                {showAdvanced && (
                  <Card className="bg-black/60 border-purple-500/30 mt-4">
                    <CardContent className="space-y-4 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Song Structure
                        </label>
                        <select
                          value={formData.songStructure}
                          onChange={(e) => handleInputChange('songStructure', e.target.value)}
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="">Select structure...</option>
                          {presetStructures.map(structure => (
                            <option key={structure} value={structure}>{structure}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Theme/Subject
                        </label>
                        <input
                          type="text"
                          value={formData.theme}
                          onChange={(e) => handleInputChange('theme', e.target.value)}
                          placeholder="Love, friendship, overcoming challenges, etc."
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Target Audience
                        </label>
                        <input
                          type="text"
                          value={formData.targetAudience}
                          onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                          placeholder="Teenagers, young adults, general audience, etc."
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Personal Context
                        </label>
                        <textarea
                          value={formData.personalContext}
                          onChange={(e) => handleInputChange('personalContext', e.target.value)}
                          placeholder="Personal experiences, memories, or stories that inspire this song..."
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Reference Artists/Songs
                        </label>
                        <input
                          type="text"
                          value={formData.referenceArtists}
                          onChange={(e) => handleInputChange('referenceArtists', e.target.value)}
                          placeholder="Taylor Swift, The Beatles, etc."
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Key Words to Include
                        </label>
                        <input
                          type="text"
                          value={formData.keyWords}
                          onChange={(e) => handleInputChange('keyWords', e.target.value)}
                          placeholder="Specific words or phrases you want included"
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Words/Themes to Avoid
                        </label>
                        <input
                          type="text"
                          value={formData.avoidWords}
                          onChange={(e) => handleInputChange('avoidWords', e.target.value)}
                          placeholder="Words or themes you want to avoid"
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Specific Instructions
                        </label>
                        <textarea
                          value={formData.specificInstructions}
                          onChange={(e) => handleInputChange('specificInstructions', e.target.value)}
                          placeholder="Any specific requirements, style preferences, or creative directions..."
                          className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:outline-none"
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !formData.prompt.trim()}
                className="w-full p-4 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin">⚙️</span>
                    <span>GENERATING LYRICS...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <span>🎵</span>
                    <span>GENERATE LYRICS</span>
                  </span>
                )}
              </Button>
            </div>

            {/* Results Section */}
            <div>
              <Card className="bg-black/60 border-green-500/30 h-full">
                <CardHeader>
                  <CardTitle className="text-green-400 text-lg">📄 Generated Lyrics</CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedLyrics ? (
                    <div className="space-y-4">
                      <div className="bg-gray-900/50 border border-green-500/30 rounded p-4 font-mono text-sm text-green-200 whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {generatedLyrics}
                      </div>

                      {/* Save Options */}
                      <div className="flex flex-col space-y-2">
                        <div className="text-xs text-gray-400 text-center">Save Options:</div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={handleSaveToGoogleDocs}
                            disabled={isSavingToGoogleDocs}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingToGoogleDocs ? (
                              <span className="flex items-center justify-center space-x-2">
                                <span className="animate-spin">⚙️</span>
                                <span>SAVING...</span>
                              </span>
                            ) : (
                              <span className="flex items-center justify-center space-x-2">
                                <span>📄</span>
                                <span>SAVE TO GOOGLE DOCS</span>
                              </span>
                            )}
                          </Button>

                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedLyrics);
                              alert('✅ Lyrics copied to clipboard!');
                            }}
                            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold transition-all"
                          >
                            <span className="flex items-center justify-center space-x-2">
                              <span>📋</span>
                              <span>COPY TO CLIPBOARD</span>
                            </span>
                          </Button>
                        </div>

                        <div className="text-xs text-center text-gray-500 mt-2">
                          💡 Google Docs files are saved with date and song title for easy organization
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-4xl mb-4">🎵</div>
                      <p>Your generated lyrics will appear here...</p>
                      <p className="text-sm mt-2">Fill out the form and click "Generate Lyrics" to begin</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}