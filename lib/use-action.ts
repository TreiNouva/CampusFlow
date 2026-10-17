'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/actions/organization-actions';
import { isNextRedirect, NETWORK_ERROR_MESSAGE } from '@/lib/utils';

/**
 * Pembungkus pemanggilan server action dari komponen client: mengatur status loading, pesan error,
 * penanganan error jaringan (tidak membuat halaman crash), dan me-refresh data halaman setelah berhasil.
 */
export function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T = undefined>(
    fn: () => Promise<ActionResult<T>>,
    options: { onSuccess?: (result: ActionResult<T>) => void; refresh?: boolean } = {}
  ): Promise<ActionResult<T> | undefined> {
    setError(null);
    setBusy(true);
    try {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? 'Terjadi kesalahan.');
        return result;
      }
      options.onSuccess?.(result);
      if (options.refresh !== false) router.refresh();
      return result;
    } catch (err) {
      if (isNextRedirect(err)) throw err;
      setError(NETWORK_ERROR_MESSAGE);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return { error, setError, busy, run };
}
