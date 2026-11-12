import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'campusflow', timestamp: new Date().toISOString() });
}
