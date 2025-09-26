import { NextRequest, NextResponse } from 'next/server';

export interface TokenResult {
  accessToken: string;
  cookiesToSet?: Array<{ name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }>; 
}

export async function ensureAccessToken(req: NextRequest): Promise<TokenResult | null> {
  const cookies = req.cookies;
  const access = cookies.get('roadie_token')?.value;
  const expStr = cookies.get('roadie_token_exp')?.value;
  const refresh = cookies.get('roadie_refresh')?.value;

  const now = Date.now();
  const exp = expStr ? parseInt(expStr, 10) : 0;

  // If we have a valid access token (with 60s buffer), use it
  if (access && exp && exp - 60_000 > now) {
    return { accessToken: access };
  }

  // Try refresh
  if (refresh) {
    try {
      const tokenResp = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh,
          client_id: process.env.DROPBOX_CLIENT_ID!,
          client_secret: process.env.DROPBOX_CLIENT_SECRET!,
        }),
      });

      const data = await tokenResp.json();
      if (!tokenResp.ok) {
        throw new Error(data.error_description || 'Failed to refresh token');
      }

      const newAccess = data.access_token as string;
      const expiresIn = (data.expires_in as number) ?? 14400; // default 4h
      const newExp = String(Date.now() + expiresIn * 1000);

      return {
        accessToken: newAccess,
        cookiesToSet: [
          { name: 'roadie_token', value: newAccess, options: cookieOptions() },
          { name: 'roadie_token_exp', value: newExp, options: cookieOptions() },
        ],
      };
    } catch (_e) {
      return null;
    }
  }

  return null;
}

export function getAuthFromCookies(req: NextRequest): { access_token: string; refresh_token?: string; expiry_time?: number } | null {
  const cookies = req.cookies;
  const access = cookies.get('roadie_token')?.value;
  const refresh = cookies.get('roadie_refresh')?.value;
  const expStr = cookies.get('roadie_token_exp')?.value;

  if (!access) {
    return null;
  }

  return {
    access_token: access,
    refresh_token: refresh,
    expiry_time: expStr ? parseInt(expStr, 10) : undefined
  };
}

export function setAuthCookies(
  res: NextResponse,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expiry_time?: number
  }
) {
  const expiryTime = tokens.expiry_time || (Date.now() + 14400 * 1000);
  res.cookies.set('roadie_token', tokens.access_token, cookieOptions());
  res.cookies.set('roadie_token_exp', String(expiryTime), cookieOptions());
  if (tokens.refresh_token) {
    // refresh lasts long; 30d
    res.cookies.set('roadie_refresh', tokens.refresh_token, { ...cookieOptions(), maxAge: 60 * 60 * 24 * 30 });
  }
}

function cookieOptions(): Parameters<NextResponse['cookies']['set']>[2] {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  } as const;
}

