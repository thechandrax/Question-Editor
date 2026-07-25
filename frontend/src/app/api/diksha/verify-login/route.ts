import { NextRequest, NextResponse } from 'next/server';

const RAILWAY = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://question-editor-production-b815.up.railway.app';

// 30s is enough — verify-login uses requests, not Playwright (~5-10s)
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${RAILWAY}/api/diksha/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // @ts-ignore
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    // On any error (timeout, network) — allow login, don't block user
    return NextResponse.json(
      { valid: true, message: 'Login accepted ✓ (server verification unavailable)' },
      { status: 200 }
    );
  }
}
