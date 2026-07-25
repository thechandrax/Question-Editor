import { NextRequest, NextResponse } from 'next/server';

const RAILWAY = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://question-editor-production-b815.up.railway.app';

// Allow up to 300s — Railway Playwright login + course details fetching takes 25-45s
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${RAILWAY}/api/diksha/course-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // @ts-ignore — Node.js fetch signal workaround for long requests
      signal: AbortSignal.timeout(120000), // 120s internal timeout
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach Railway backend';
    const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('TimeoutError');
    return NextResponse.json(
      { detail: isTimeout ? 'Request timed out — Railway is processing. Try again in 30s.' : msg },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
