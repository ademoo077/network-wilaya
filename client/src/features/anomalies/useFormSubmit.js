import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { duplicateAnomalyValues, formPayload, validateForm } from '@anm/shared';
import { api } from '../../api/client.js';
import { clearDraft } from '../../utils/drafts.js';
import { useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { rememberType } from '../../utils/recentTypes.js';
import { focusFormField } from './formFocus.js';

export function useFormSubmit({ current, dispatch, draftKey, id, userId }) {
  const client = useQueryClient(); const navigate = useNavigate(); const { push } = useToast(); const { t } = useI18n();
  const pending = useRef(false);
  const mutation = useMutation({ mutationFn: async ({ state, force }) => {
    const existing = id || state.persisted?.id;
    const body = { ...formPayload(state.values), force_duplicate: Boolean(force || state.forceDuplicate) };
    const path = existing ? `/anomalies/${existing}` : state.duplicateFrom ? `/anomalies/${state.duplicateFrom.id}/dupliquer` : '/anomalies';
    const { item } = await api(path, {
      method: existing ? 'PATCH' : 'POST', body: existing ? { ...body, version: state.persisted?.version || state.version } : body,
    });
    dispatch({ type: 'UI', patch: { persisted: item } });
    for (const file of state.files) {
      const body = new FormData(); body.append('file', file); body.append('role', 'avant');
      await api(`/anomalies/${item.id}/pieces`, { method: 'POST', body });
      dispatch({ type: 'UI', patch: { files: current.current.files.filter((entry) => entry !== file), piecesCount: (current.current.piecesCount || 0) + 1 } });
    }
    return item;
  } });
  const save = async (mode = 'save', force = false) => {
    if (pending.current) return;
    const saveMode = mode === true ? 'new' : mode === false ? 'save' : mode;
    const state = current.current; const errors = validateForm(state.values, state.original);
    if (Object.keys(errors).length) {
      dispatch({ type: 'VALIDATE', errors, touched: Object.fromEntries(Object.keys(errors).map((key) => [key, true])) });
      requestAnimationFrame(() => focusFormField(Object.keys(errors)[0])); return;
    }
    pending.current = true;
    const requestId = Date.now(); dispatch({ type: 'TASK_START', task: 'submit', id: requestId });
    dispatch({ type: 'UI', patch: { saveMode } });
    dispatch({ type: 'VALIDATE', errors: {} });
    try {
      const item = await mutation.mutateAsync({ state, force });
      dispatch({ type: 'TASK_END', task: 'submit', id: requestId, result: { status: 'ok' } });
      clearDraft(draftKey); client.invalidateQueries({ predicate: (query) => !['auth', 'refs'].includes(query.queryKey[0]) });
      client.setQueryData(['anomaly', String(item.id)], { item });
      const recentTypes = rememberType(userId, state.values.type_id);
      push(t('form.saved'), 'success', { label: t('common.view'), onClick: () => navigate(`/anomalies/${item.id}`) });
      if (saveMode !== 'save') {
        const duplicate = saveMode === 'duplicate';
        dispatch({ type: 'INIT', values: duplicate ? duplicateAnomalyValues(state.values)
          : { plateforme: state.values.plateforme, date_signalement: state.values.date_signalement, daira_id: state.values.daira_id },
        context: { recentTypes, duplicateFrom: duplicate ? { id: item.id, reference: item.reference } : null, forceDuplicate: duplicate, dirty: duplicate } });
        if (id) navigate('/anomalies/nouvelle');
        requestAnimationFrame(() => { window.scrollTo(0, 0); document.getElementById('smart-paste')?.focus(); });
      } else navigate(`/anomalies/${item.id}`);
    } catch (error) {
      dispatch({ type: 'TASK_END', task: 'submit', id: requestId, result: { status: 'error', message: error.code } });
      if (error.code === 'DUPLICATE_LINK') dispatch({ type: 'UI', patch: { duplicateDialog: true, duplicateMatches: error.details || [], saveMode } });
      else dispatch({ type: 'VALIDATE', errors: error.code === 'DUPLICATE_STRICT' ? { lien_url: error.message }
        : error.code === 'VERSION_CONFLICT' ? { form: 'form.versionConflict' } : error.fields || { form: error.message } });
      push(error.message, 'danger');
    } finally { pending.current = false; }
  };
  return save;
}
