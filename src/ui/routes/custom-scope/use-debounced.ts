import { useEffect, useState } from 'react';

/**
 * A value that follows `value` after it has stopped changing for `delayMS`.
 *
 * @param value - The fast-changing value.
 * @param delayMS - How long it must hold still.
 */
export function useDebounced<T>(value: T, delayMS: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMS);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMS]);
  return debounced;
}
