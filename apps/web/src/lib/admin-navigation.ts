'use client';
import { useSearchParams } from 'next/navigation';

export function useAdminNavigation() {
  const params = useSearchParams();
  function update(values: Record<string, string>, replace = false) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }
  return { params, update };
}
