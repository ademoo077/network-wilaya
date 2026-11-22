/**
 * Multipart/Busboy décode les noms de fichiers en latin1 lorsque l'en-tête ne
 * précise pas le charset. Les noms accents/arabes arrivent donc mojibakés.
 * Le décodage est contrôlé : on ne retient que si le résultat est du UTF-8 valide.
 */
export function decodeMultipartFilename(value) {
  if (typeof value !== 'string' || !value) return 'piece';
  const candidates = [value];
  if (/[ÃÂ]/.test(value)) {
    try {
      const decoded = Buffer.from(value, 'latin1').toString('utf8');
      if (decoded && !decoded.includes('\uFFFD')) candidates.unshift(decoded);
    } catch { /* le nom initial reste utilisé */ }
  }
  return candidates.find((candidate) => candidate && !candidate.includes('\uFFFD')) || 'piece';
}

/** Nom d'affichage assaini ; le nom stocké sur disque reste un UUID. */
export function safeDisplayFilename(value) {
  const decoded = decodeMultipartFilename(value);
  const withoutPath = decoded.replace(/\\/g, '/').split('/').pop() || 'piece';
  const cleaned = withoutPath.normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((char) => {
      const code = char.codePointAt(0);
      return code <= 31 || code === 127 ? '_' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+$/, 'piece')
    .slice(0, 180);
  return cleaned || 'piece';
}
