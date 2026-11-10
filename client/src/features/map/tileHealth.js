export function watchTileHealth(tiles, onChange) {
  let loaded = false; let errors = 0;
  onChange(false);
  const timer = window.setTimeout(() => { if (!loaded) onChange(true); }, 6000);
  const load = () => { loaded = true; errors = 0; onChange(false); window.clearTimeout(timer); };
  const fail = () => { errors += 1; if (errors >= 5) onChange(true); };
  tiles.on('tileload', load); tiles.on('tileerror', fail);
  return () => { window.clearTimeout(timer); tiles.off('tileload', load); tiles.off('tileerror', fail); };
}
