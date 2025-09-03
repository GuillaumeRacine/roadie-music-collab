export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

export const MUSIC_BASE_PATH = process.env.MUSIC_BASE_PATH || '/Music/Fiasco Total';
export const MUSIC_ACTIVE_YEAR = process.env.MUSIC_ACTIVE_YEAR || '2025';

export function getCorsHeaders(origin = FRONTEND_ORIGIN) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  } as Record<string, string>;
}
