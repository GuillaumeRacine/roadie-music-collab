import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS
  const response = NextResponse.next();
  
  // Allow requests from the frontend
  response.headers.set('Access-Control-Allow-Origin', 'https://music-collab-gqvcb6ame-guillaumeracines-projects.vercel.app');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};