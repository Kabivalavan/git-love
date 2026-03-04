import { useEffect, useRef, useState } from 'react';

export function useLazySection(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', ...options }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}
