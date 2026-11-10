export const isAnomalyRead = ({ queryKey }) => queryKey[0] === 'map-anomalies'
  || queryKey[0] === 'api' && /^\/anomalies(?:\?|\/\d+$|$)/.test(queryKey[1]);
export const isAnomalyRelated = ({ queryKey }) => queryKey[0] === 'map-anomalies'
  || queryKey[0] === 'api' && /^\/(?:anomalies|stats|reports|work)(?:[/?]|$)/.test(queryKey[1]);

export function updateCachedItem(data, id, update) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map((row) => row.id === id ? update(row) : row);
  if (data.item?.id === id) return { ...data, item: update(data.item) };
  if (data.items) return { ...data, items: data.items.map((row) => row.id === id ? update(row) : row) };
  return data;
}

export function invalidateAnomalies(client) { return client.invalidateQueries({ predicate: isAnomalyRelated }); }
