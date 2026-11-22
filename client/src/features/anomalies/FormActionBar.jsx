import { useEffect, useRef } from 'react';

export default function FormActionBar({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const bar = ref.current; const page = bar.closest('.form-page');
    const measure = () => page.style.setProperty('--form-action-height', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    measure(); const observer = new ResizeObserver(measure); observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} data-action-bar className="sticky bottom-0 z-40 mt-6 flex w-full flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-surface p-3 shadow-3">{children}</div>;
}
