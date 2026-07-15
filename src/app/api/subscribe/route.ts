import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return NextResponse.json({ ok: false, error: 'Please enter a valid email.' }, { status: 400 });
    }
    const supabase = createPublicClient();
    // Anon INSERT via a validated RLS policy (no service role). A duplicate email
    // (23505) means already subscribed — idempotent success, not an error. We keep
    // anon to INSERT-only, so no UPDATE surface is opened.
    const { error } = await supabase
      .from('zo_subscribers')
      .insert({ email: email.toLowerCase().trim(), source: 'website' });
    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
