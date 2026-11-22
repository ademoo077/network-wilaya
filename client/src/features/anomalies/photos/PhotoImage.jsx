import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '../../../i18n/index.jsx';

export default function PhotoImage({ piece, src, alt, className = '', imageClassName = '', onOpen, retryKey = 0 }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setFailed(false); setLoaded(false); setAttempt(0); }, [piece?.id, retryKey]);
  if (!piece) return null;
  if (failed) return <div className={`grid place-items-center bg-surface2 text-center text-xs text-muted ${className}`}>
    <button type="button" className="inline-flex min-h-11 items-center gap-2 px-3 font-bold text-brand-text-700"
      onClick={() => { setFailed(false); setLoaded(false); setAttempt((value) => value + 1); }}>
      <RotateCcw className="h-4 w-4" aria-hidden="true" />{t('photo.retry')}
    </button>
  </div>;
  const source = `${src || piece.thumb_url || piece.url}${attempt ? `${src?.includes('?') ? '&' : '?'}retry=${attempt}` : ''}`;
  const image = <img src={source} alt={alt || piece.legende || piece.nom_original}
    className={`${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity ${imageClassName}`}
    loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />;
  return <div className={`relative overflow-hidden bg-surface2 ${className}`}
    style={piece.apercu_flou ? { backgroundImage: `url("${piece.apercu_flou}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
    {onOpen ? <button type="button" className="absolute inset-0 h-full w-full" onClick={() => onOpen(piece)} aria-label={alt || piece.nom_original}>{image}</button> : image}
  </div>;
}
