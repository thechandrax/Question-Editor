import { NextRequest, NextResponse } from 'next/server';

const RAILWAY = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://question-editor-production-b815.up.railway.app';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${RAILWAY}/api/diksha/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ valid: false, message: `Server error: ${String(err)}` }, { status: 500 });
  }
}
