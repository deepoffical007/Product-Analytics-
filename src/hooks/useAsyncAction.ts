import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Result } from '@/data/services';

/** Runs a service call, tracks loading and shows success/error toasts. */
export function useAsyncAction() {
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<Result<T>>, success?: string | ((data: T) => string)): Promise<Result<T>> => {
    setPending(key);
    try {
      const r = await fn();
      if (r.ok) {
        if (success) toast.success(typeof success === 'function' ? success(r.data) : success);
      } else toast.error(r.error);
      return r;
    } finally {
      setPending(null);
    }
  }, []);
  return { pending, run };
}
