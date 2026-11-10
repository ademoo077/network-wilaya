import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';

const timeouts = { resolve: 8000, locate: 3000, duplicates: 5000, nearby: 5000, exif: 5000, submit: 30000 };
export function useFormTasks(dispatch) {
  const client = useQueryClient(); const tasks = useRef({}); const counter = useRef(0);
  const cancel = useCallback((name) => {
    const task = tasks.current[name]; if (task) { task.controller.abort(); if (task.key) client.cancelQueries({ queryKey: task.key, exact: true }); delete tasks.current[name]; }
  }, [client]);
  const cancelAll = useCallback(() => Object.keys(tasks.current).forEach(cancel), [cancel]);
  useEffect(() => cancelAll, [cancelAll]);
  const run = useCallback(async (name, work, apply) => {
    cancel(name); const id = ++counter.current; const controller = new AbortController(); tasks.current[name] = { id, controller };
    dispatch({ type: 'TASK_START', task: name, id });
    const timer = window.setTimeout(() => controller.abort('TIMEOUT'), timeouts[name] || 5000);
    try {
      const request = (path, options = {}) => {
        const queryKey = ['form-task', name, path, options.body || null];
        if (tasks.current[name]?.id === id) tasks.current[name].key = queryKey;
        return client.fetchQuery({ queryKey, staleTime: name === 'resolve' ? 300000 : 1000, retry: false,
          queryFn: ({ signal }) => api(path, { ...options, signal: AbortSignal.any([signal, controller.signal]) }) });
      };
      const data = await work(request, controller.signal);
      if (controller.signal.aborted || tasks.current[name]?.id !== id) return null;
      dispatch({ type: 'TASK_END', task: name, id, result: { status: data?.ok === false ? 'warning' : 'ok', data, message: data?.code } });
      apply?.(data); return data;
    } catch (error) {
      if (tasks.current[name]?.id !== id || controller.signal.aborted && controller.signal.reason !== 'TIMEOUT') return null;
      dispatch({ type: 'TASK_END', task: name, id, result: { status: 'error', message: controller.signal.aborted ? 'TIMEOUT' : error.code || 'NETWORK_UNAVAILABLE' } });
      return null;
    } finally { window.clearTimeout(timer); if (tasks.current[name]?.id === id) delete tasks.current[name]; }
  }, [cancel, client, dispatch]);
  return useMemo(() => ({ run, cancel, cancelAll }), [run, cancel, cancelAll]);
}
