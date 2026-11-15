import { rssConnector, googleNewsConnector } from './rss.js';
import { facebookManagedConnector, facebookPublicConnector } from './facebook.js';
import { importConnector } from './importConnector.js';

const registry = new Map([
  [rssConnector.type, rssConnector],
  [googleNewsConnector.type, googleNewsConnector],
  [facebookManagedConnector.type, facebookManagedConnector],
  [facebookPublicConnector.type, facebookPublicConnector],
  [importConnector.type, importConnector],
]);

export function connectorFor(type) {
  return registry.get(type) || null;
}

export function availableConnectors() {
  return [...registry.values()].map((connector) => ({
    type: connector.type, label: connector.label, permissionNote: connector.permissionNote || null,
  }));
}
