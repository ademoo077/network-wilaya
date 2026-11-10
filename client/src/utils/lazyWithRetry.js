import { lazy } from 'react';
import { VERSION } from '@anm/shared';

const memory = new Set();
function reloadOnce() {
  const key = `anm:chunk:${VERSION}:${window.location.hash.split('?')[0]}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    // Without persistent storage, never risk a reload loop.
    return false;
  }
  window.location.reload();
  return true;
}
export function lazyWithRetry(loader) {
  let pending;
  const load = () => {
    if (!pending) pending = loader().catch(() => loader()).catch((error) => {
      if (!memory.has(loader) && reloadOnce()) { memory.add(loader); return new Promise(() => {}); }
      throw error;
    });
    return pending;
  };
  const Page = lazy(load);
  Page.preload = () => { load().catch(() => {}); };
  return Page;
}
export function installPreloadHandler() {
  // Vite rejects the import after this event. lazyWithRetry handles it, once.
  window.addEventListener('vite:preloadError', (event) => { memory.delete(event.payload); });
}
