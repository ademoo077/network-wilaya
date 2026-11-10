import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { validateAnomalyState } from '@anm/shared';
import { api } from '../../api/client.js';
import { invalidateAnomalies, isAnomalyRead, updateCachedItem } from '../../api/anomalyCache.js';
import { useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export function usePendingAnomalies() {
  return useMutationState({ filters: { mutationKey: ['anomaly-state'], status: 'pending' }, select: (mutation) => mutation.state.variables.item.id });
}
export function useAnomalyMutation() {
  const client = useQueryClient(); const { push } = useToast(); const { t } = useI18n();
  return useMutation({ mutationKey: ['anomaly-state'],
    mutationFn: ({ item, field, body }) => api(`/anomalies/${item.id}/${field}`, { method: 'POST', body }),
    onMutate: async ({ item, body }) => {
      const optimistic = validateAnomalyState({ ...item, ...body }, { previous: item, motif: body.motif });
      await client.cancelQueries({ predicate: isAnomalyRead });
      const previous = [];
      for (const [key, data] of client.getQueriesData({ predicate: isAnomalyRead })) {
        client.setQueryData(key, updateCachedItem(data, item.id, (row) => { previous.push([key, row]); return { ...row, ...optimistic }; }));
      }
      return { previous };
    },
    onError: (error, { item }, context) => {
      for (const [key, row] of context?.previous ?? []) client.setQueryData(key, (data) => updateCachedItem(data, item.id, () => row));
      push(error.code === 'VERSION_CONFLICT' ? t('form.versionConflict') : error.message, 'danger');
    },
    onSuccess: (result, { item }) => {
      client.setQueriesData({ predicate: isAnomalyRead }, (data) => updateCachedItem(data, item.id, () => result.item));
      push(t('common.success'));
    },
    onSettled: () => invalidateAnomalies(client),
  });
}
