import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/config';

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ success: true }, { headers: getCorsHeaders() });
  // Clear auth cookies
  res.cookies.set('roadie_token', '', { path: '/', maxAge: 0 });
  res.cookies.set('roadie_token_exp', '', { path: '/', maxAge: 0 });
  res.cookies.set('roadie_refresh', '', { path: '/', maxAge: 0 });
  return res;
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}

