import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useToast } from '../components/ui/index.js';
import { useI18n } from '../i18n/index.jsx';

export function useOptimisticRows(path, after) {
  const client = useQueryClient(); const { push } = useToast(); const { t } = useI18n(); const queryKey = ['api', path];
  return useMutation({ mutationFn: ({ row, changes, method = 'PATCH' }) => api(`${path}/${row.id}`, { method, body: method === 'DELETE' ? undefined : changes }),
    onMutate: async ({ row, changes }) => {
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData(queryKey, (data) => ({ ...data, items: (data?.items ?? []).map((item) => item.id === row.id ? { ...item, ...changes } : item) }));
      return row;
    },
    onError: (error, { row }, previous) => {
      client.setQueryData(queryKey, (data) => ({ ...data, items: (data?.items ?? []).map((item) => item.id === row.id ? previous : item) }));
      push(error.message, 'danger');
    },
    onSuccess: () => push(t('common.success')),
    onSettled: async () => { await client.invalidateQueries({ queryKey, exact: true }); await after?.(); },
  });
}
