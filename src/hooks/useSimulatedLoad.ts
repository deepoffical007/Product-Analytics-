import { useEffect, useState } from 'react';

const seen = new Set<string>();

/** Shows skeletons briefly the first time a view loads in a session (mirrors a network fetch). */
export function useSimulatedLoad(key: string, ms = 450) {
  const [ready, setReady] = useState(seen.has(key));
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => {
      seen.add(key);
      setReady(true);
    }, ms);
    return () => clearTimeout(t);
  }, [key, ms, ready]);
  return ready;
}
