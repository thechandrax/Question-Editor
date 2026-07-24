import { NextResponse } from 'next/server';

const RAILWAY = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://question-editor-production-b815.up.railway.app';

export async function GET() {
  try {
    const res = await fetch(`${RAILWAY}/api/diksha/status`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach Railway backend';
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}
