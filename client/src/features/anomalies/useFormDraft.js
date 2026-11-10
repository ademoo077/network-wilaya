import { useEffect } from 'react';
import { saveDraft } from '../../utils/drafts.js';

function persist(key, state) {
  return saveDraft(key, { values: state.values, meta: state.meta, paste: state.paste, original: state.original, version: state.version,
    duplicateFrom: state.duplicateFrom, forceDuplicate: state.forceDuplicate, persisted: state.persisted,
    fileNames: state.files.map((file) => file.name), savedAt: Date.now() });
}
export function useFormDraft({ state, current, dispatch, draftKey }) {
  useEffect(() => {
    if (!state.dirty || state.draft || state.tasks.submit.status === 'ok') return undefined;
    dispatch({ type: 'UI', patch: { draftStatus: 'saving' } });
    const timer = window.setTimeout(() => {
      dispatch({ type: 'UI', patch: { draftStatus: persist(draftKey, current.current) } });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draftKey, state.values, state.meta, state.paste, state.files, state.dirty, state.draft, state.tasks.submit.status, current, dispatch]);
  useEffect(() => {
    const flush = () => { const value = current.current; if (value.dirty && !value.draft && value.tasks.submit.status !== 'ok') persist(draftKey, value); };
    window.addEventListener('pagehide', flush); window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush); };
  }, [current, draftKey]);
}
