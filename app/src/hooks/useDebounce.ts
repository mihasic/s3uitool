import { useEffect, useState } from "react";

/**
 * Hook that debounces a value and returns it after a specified delay
 * Useful for preventing rapid API calls or computations
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay is met
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
