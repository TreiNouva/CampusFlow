import { NextResponse } from 'next/server';
import { isTeamAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const COLS = ['created_at', 'name', 'email', 'organization_name', 'organization_type', 'member_count', 'interested_plan', 'willing_to_pay', 'note', 'source'] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Cegah formula injection saat dibuka di Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await isTeamAdmin())) return new NextResponse('Not found', { status: 404 });
  const { data, error } = await createAdminClient().from('interest_signups').select(COLS.join(',')).order('created_at', { ascending: true });
  if (error) return new NextResponse('Gagal membaca data', { status: 500 });
  const lines = [COLS.join(','), ...((data ?? []) as any[]).map((r) => COLS.map((c) => csvCell(r[c])).join(','))];
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campusflow-interest-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
