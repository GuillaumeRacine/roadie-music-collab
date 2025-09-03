'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiUrl } from '@/lib/api';

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Try pinging files endpoint to detect active session
    const checkSession = async () => {
      try {
        const resp = await fetch(apiUrl('/api/dropbox/files?path='), { credentials: 'include' });
        if (resp.ok) router.push('/dashboard');
      } catch {}
    };
    checkSession();
  }, [router]);

  const connectToDropbox = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch(apiUrl('/api/dropbox/auth'), {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting to Dropbox:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Music Collaboration Hub
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Organize, share, and collaborate on your music ideas and lyrics with your band.
            Connect your Dropbox to get started.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Dropbox</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                Connect your Dropbox account to start organizing your music files, 
                lyrics, and voice memos.
              </p>
              <Button 
                onClick={connectToDropbox} 
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : 'Connect Dropbox'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Automatically organize your music files, lyrics, and recordings 
                with smart categorization and tagging.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voice Memo Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Analyze voice memos for musical content, transcribe lyrics, 
                and extract feedback for coaching and improvement.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Band Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Share ideas seamlessly with your band members and 
                keep everyone in sync with your musical projects.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
