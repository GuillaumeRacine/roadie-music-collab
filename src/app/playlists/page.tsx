'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PlaylistsPage() {
  const playlists = [
    {
      id: '4pGvNyUU5WJsqg7ZotrtWb',
      title: '🎵 Retro Vibes',
      description: 'Classic gaming soundtracks and chiptune beats',
      src: 'https://open.spotify.com/embed/playlist/4pGvNyUU5WJsqg7ZotrtWb?utm_source=generator'
    },
    {
      id: '2WYBukzNnbwmkZRPlTm8TY',
      title: '🎧 Level Up',
      description: 'High-energy tracks for creative sessions',
      src: 'https://open.spotify.com/embed/playlist/2WYBukzNnbwmkZRPlTm8TY?utm_source=generator'
    },
    {
      id: '7MxTQOi3fb2L4czsQePdzB',
      title: '🎶 Boss Battle',
      description: 'Epic music for intense recording moments',
      src: 'https://open.spotify.com/embed/playlist/7MxTQOi3fb2L4czsQePdzB?utm_source=generator'
    },
    {
      id: '2PeSSAkqhnIixGdsj3BzH0',
      title: '🎼 Chill Zone',
      description: 'Relaxing tunes for songwriting and mixing',
      src: 'https://open.spotify.com/embed/playlist/2PeSSAkqhnIixGdsj3BzH0?utm_source=generator'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🎵 Music Playlists</h1>
            <p className="text-gray-600">
              Curated Spotify collections to fuel your creativity
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="bg-white/80 backdrop-blur-sm"
            >
              🎧 Dashboard
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              ← Home
            </Button>
          </div>
        </div>

        {/* Hero Section */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-blue-200">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              🎮 Game On with Music
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Four handpicked playlists to power up your music creation sessions.
              From retro chiptunes to epic orchestrals, find your perfect soundtrack.
            </p>
          </CardContent>
        </Card>

        {/* Playlists Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {playlists.map((playlist, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border-blue-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900">
                  {playlist.title}
                </CardTitle>
                <p className="text-gray-600 text-sm">
                  {playlist.description}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-gray-100 rounded-lg p-3 border border-blue-100">
                  <iframe
                    data-testid="embed-iframe"
                    style={{ borderRadius: '8px' }}
                    src={playlist.src}
                    width="100%"
                    height="280"
                    frameBorder="0"
                    allowFullScreen={true}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="border-0 shadow-sm"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Action Card */}
        <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-3">
              🎵 Ready to Create?
            </h3>
            <p className="text-blue-100 mb-6 text-lg">
              Pick your soundtrack and head to the dashboard to start organizing your music files
            </p>
            <div className="flex justify-center gap-4">
              <Button
                variant="secondary"
                onClick={() => window.location.href = '/dashboard'}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                🎧 Go to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="border-white text-white hover:bg-white hover:text-blue-600"
              >
                🏠 Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Spacer */}
        <div className="h-8"></div>
      </div>
    </div>
  );
}