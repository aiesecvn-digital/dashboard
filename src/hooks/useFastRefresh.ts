import { useState, useEffect } from 'react';

export function useFastRefresh() {
  const [isFastRefreshComplete, setIsFastRefreshComplete] = useState(false);

  useEffect(() => {
    // In development, wait for Fast Refresh to complete
    if (process.env.NODE_ENV === 'development') {
      // Wait for Fast Refresh to complete
      const timer = setTimeout(() => {
        setIsFastRefreshComplete(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      // In production, no need to wait
      setIsFastRefreshComplete(true);
    }
  }, []);

  return isFastRefreshComplete;
}
