'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DropboxFile {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  id?: string;
  size?: number;
  server_modified?: string;
}

interface AIChatProps {
  currentPath: string;
  files: DropboxFile[];
  onFileOperation?: (operation: string, files?: string[]) => void;
}

export default function AIChat({ currentPath, files, onFileOperation }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context for the AI
      const context = {
        currentPath,
        files: files.map(f => ({
          name: f.name,
          type: f['.tag'],
          path: f.path_display,
          size: f.size,
          modified: f.server_modified
        })),
        fileCount: files.length,
        folderStructure: files.filter(f => f['.tag'] === 'folder').map(f => f.name),
        audioFiles: files.filter(f => {
          const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
          return audioExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
        }).map(f => f.name),
        textFiles: files.filter(f => {
          const textExtensions = ['.txt', '.md', '.lyrics'];
          return textExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
        }).map(f => f.name)
      };

      const response = await fetch(apiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: input.trim(),
          context,
          conversationHistory: messages.slice(-5) // Send last 5 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I'm sorry, I couldn't process your request. Please try again.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle any file operations suggested by the AI
      if (data.fileOperations && onFileOperation) {
        data.fileOperations.forEach((op: any) => {
          onFileOperation(op.operation, op.files);
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please make sure you're connected to the internet and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="mb-6">
      {/* Inline Chat Panel */}
      <div className="bg-black/60 border border-cyan-500/30 rounded-lg shadow-lg shadow-cyan-500/20 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-cyan-500/30">
          <div className="flex items-center space-x-2">
            <div>
              <button 
                onClick={() => router.push('/robot-settings')}
                className="text-white font-bold text-sm hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Roadie Robot 🤖
              </button>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-cyan-400 hover:text-white transition-colors text-sm px-2 py-1 rounded border border-cyan-500/30 hover:border-cyan-400"
          >
            {isExpanded ? '▼ Hide' : '▶ Show'}
          </button>
        </div>

        {/* Collapsible Content */}
        {isExpanded && (
          <>
            {/* Messages */}
            <div className="max-h-64 overflow-y-auto p-3 space-y-2 border-b border-cyan-500/30">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2 rounded text-sm ${
                      message.role === 'user'
                        ? 'bg-cyan-600/80 text-white'
                        : 'bg-gray-800/80 text-cyan-200 border border-cyan-500/20'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800/80 text-cyan-200 border border-cyan-500/20 p-2 rounded text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                      <span className="text-xs">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3">
              <div className="flex space-x-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me to organize files, write lyrics, or help with your music..."
                  className="flex-1 bg-gray-900/50 text-white border border-cyan-500/30 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-cyan-400 min-h-[36px] placeholder:text-gray-500"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-2 rounded transition-colors text-xs font-medium border border-cyan-500/30"
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}