'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your music AI assistant. I can help you organize your files, write lyrics, create documents, and manage your music projects. What would you like to do?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Toggle Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white p-4 rounded-full shadow-lg hover:shadow-purple-500/50 transition-all duration-300 border border-purple-400"
          title="Open AI Assistant"
        >
          <span className="text-2xl">🤖</span>
        </button>
      )}

      {/* Chat Panel */}
      {isExpanded && (
        <div className="bg-black/95 border border-cyan-500/50 rounded-lg shadow-2xl shadow-cyan-500/20 backdrop-blur-sm w-96 h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-cyan-500/30">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="text-white font-bold text-sm">AI Music Assistant</h3>
                <p className="text-cyan-400 text-xs">Ready to help with your music</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-cyan-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-cyan-200 border border-cyan-500/30'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-cyan-200 border border-cyan-500/30 p-3 rounded-lg text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-cyan-500/30">
            <div className="flex space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about your music files, lyrics, or organization..."
                className="flex-1 bg-gray-900 text-white border border-cyan-500/30 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-cyan-400 min-h-[40px]"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-400 text-white px-4 py-2 rounded transition-colors text-sm font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Current folder: {currentPath || '/'} ({files.length} items)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}