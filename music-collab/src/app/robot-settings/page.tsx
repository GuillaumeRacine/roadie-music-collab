'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RobotSettings {
  systemPrompt: string;
  roleDescription: string;
  temperature: number;
  maxTokens: number;
  fileAccessEnabled: boolean;
  accessibleFolders: string[];
  capabilities: {
    fileOrganization: boolean;
    lyricsWriting: boolean;
    musicProduction: boolean;
    documentCreation: boolean;
  };
  responseStyle: string;
  contextInstructions: string;
  llmProvider: string;
  model: string;
}

const defaultSettings: RobotSettings = {
  systemPrompt: `You are an AI assistant specialized in music production and file management. You help musicians organize their files, write lyrics, and manage their creative projects.`,
  roleDescription: "Music Production Assistant & File Manager",
  temperature: 0.7,
  maxTokens: 1000,
  fileAccessEnabled: true,
  accessibleFolders: ['/Music/Fiasco Total', '/Music/Fiasco Total/Lyrics', '/Music/Fiasco Total/Live Recordings'],
  capabilities: {
    fileOrganization: true,
    lyricsWriting: true,
    musicProduction: true,
    documentCreation: true,
  },
  responseStyle: "concise_helpful",
  contextInstructions: "Always consider the current folder structure and file types when providing advice.",
  llmProvider: "OpenAI",
  model: "gpt-4o-mini"
};

export default function RobotSettings() {
  const [settings, setSettings] = useState<RobotSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/ai/settings'), {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings({ ...defaultSettings, ...data });
      } else {
        console.log('Using default settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/ai/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        alert('Settings saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm('Reset all settings to default values?')) {
      setSettings(defaultSettings);
    }
  };

  const addFolder = () => {
    if (newFolder.trim() && !settings.accessibleFolders.includes(newFolder.trim())) {
      setSettings({
        ...settings,
        accessibleFolders: [...settings.accessibleFolders, newFolder.trim()]
      });
      setNewFolder('');
    }
  };

  const removeFolder = (folder: string) => {
    setSettings({
      ...settings,
      accessibleFolders: settings.accessibleFolders.filter(f => f !== folder)
    });
  };

  const updateCapability = (capability: keyof typeof settings.capabilities, enabled: boolean) => {
    setSettings({
      ...settings,
      capabilities: {
        ...settings.capabilities,
        [capability]: enabled
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono flex items-center justify-center">
        <div className="text-center text-yellow-300 animate-pulse">
          &gt;&gt;&gt; LOADING ROBOT SETTINGS...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900 text-cyan-300 font-mono">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center border-b-2 border-cyan-400 pb-4 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-3">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">🤖 Roadie Robot Settings</h1>
            <p className="text-sm text-cyan-300">Configure your AI music assistant</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Core Settings */}
          <Card className="bg-black/60 border-cyan-500/30 text-cyan-200">
            <CardHeader>
              <CardTitle className="text-white">Core Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Role Description</label>
                <input
                  type="text"
                  value={settings.roleDescription}
                  onChange={(e) => setSettings({...settings, roleDescription: e.target.value})}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="e.g., Music Production Assistant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Response Style</label>
                <select
                  value={settings.responseStyle}
                  onChange={(e) => setSettings({...settings, responseStyle: e.target.value})}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="concise_helpful">Concise & Helpful</option>
                  <option value="detailed_technical">Detailed & Technical</option>
                  <option value="creative_encouraging">Creative & Encouraging</option>
                  <option value="professional_formal">Professional & Formal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Temperature ({settings.temperature})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-xs mt-1">
                  <span>Conservative</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Response Length</label>
                <input
                  type="number"
                  min="100"
                  max="2000"
                  value={settings.maxTokens}
                  onChange={(e) => setSettings({...settings, maxTokens: parseInt(e.target.value)})}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">LLM Provider</label>
                <select
                  value={settings.llmProvider}
                  onChange={(e) => setSettings({...settings, llmProvider: e.target.value})}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="OpenAI">OpenAI</option>
                  <option value="Anthropic">Anthropic (Claude)</option>
                  <option value="Groq">Groq</option>
                  <option value="Local">Local Model</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Model</label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({...settings, model: e.target.value})}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  {settings.llmProvider === 'OpenAI' && (
                    <>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </>
                  )}
                  {settings.llmProvider === 'Anthropic' && (
                    <>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                      <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                      <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                    </>
                  )}
                  {settings.llmProvider === 'Groq' && (
                    <>
                      <option value="llama-3.1-70b-versatile">Llama 3.1 70B</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                    </>
                  )}
                  {settings.llmProvider === 'Local' && (
                    <>
                      <option value="custom-model">Custom Model</option>
                      <option value="llama2-7b">Llama 2 7B</option>
                      <option value="codellama-7b">CodeLlama 7B</option>
                    </>
                  )}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Capabilities */}
          <Card className="bg-black/60 border-cyan-500/30 text-cyan-200">
            <CardHeader>
              <CardTitle className="text-white">Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(settings.capabilities).map(([capability, enabled]) => (
                  <div key={capability} className="flex items-center justify-between">
                    <label className="text-sm capitalize">
                      {capability.replace(/([A-Z])/g, ' $1')}
                    </label>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => updateCapability(capability as keyof typeof settings.capabilities, e.target.checked)}
                      className="w-4 h-4 accent-cyan-500"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.fileAccessEnabled}
                    onChange={(e) => setSettings({...settings, fileAccessEnabled: e.target.checked})}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="text-sm">Enable File System Access</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card className="lg:col-span-2 bg-black/60 border-cyan-500/30 text-cyan-200">
            <CardHeader>
              <CardTitle className="text-white">System Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Main System Prompt</label>
                <textarea
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({...settings, systemPrompt: e.target.value})}
                  rows={4}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Define the robot's core personality and role..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Context Instructions</label>
                <textarea
                  value={settings.contextInstructions}
                  onChange={(e) => setSettings({...settings, contextInstructions: e.target.value})}
                  rows={3}
                  className="w-full bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Instructions for how to use file context and current state..."
                />
              </div>
            </CardContent>
          </Card>

          {/* File Access */}
          <Card className="lg:col-span-2 bg-black/60 border-cyan-500/30 text-cyan-200">
            <CardHeader>
              <CardTitle className="text-white">File Access Control</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Accessible Folders</label>
                  <div className="flex space-x-2 mb-3">
                    <input
                      type="text"
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      placeholder="/path/to/folder"
                      className="flex-1 bg-gray-900 border border-cyan-500/30 rounded px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <Button 
                      onClick={addFolder}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white"
                    >
                      Add
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {settings.accessibleFolders.map((folder, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-2">
                        <span className="text-sm font-mono">{folder}</span>
                        <button
                          onClick={() => removeFolder(folder)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-between items-center bg-black/40 backdrop-blur-sm rounded-lg px-4 py-3">
          <Button 
            onClick={resetToDefaults}
            variant="outline"
            className="bg-gray-700 hover:bg-gray-600 text-white border-gray-500"
          >
            Reset to Defaults
          </Button>
          
          <div className="flex space-x-3">
            <Button 
              onClick={saveSettings}
              disabled={saving}
              className="bg-green-600 hover:bg-green-500 text-white"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}