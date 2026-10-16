'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validations/schemas';
import type { ActionResult } from './organization-actions';

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { success: false, error: 'Email atau password salah.' };
  }

  redirect('/dashboard');
}

export async function register(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/** updatePassword — simpan password baru. Hanya bisa dipakai user yang sedang punya sesi (dari link reset). */
export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Input tidak valid' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Sesi reset password sudah berakhir. Silakan minta link baru.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error('[updatePassword]', error.status, error.message);
    if (error.message.toLowerCase().includes('different')) {
      return { success: false, error: 'Password baru harus berbeda dari password lama.' };
    }
    return { success: false, error: 'Gagal mengubah password. Coba lagi.' };
  }

  redirect('/dashboard');
}
