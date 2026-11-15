const ESCAPES = /[.*+?^${}()|[\]\\]/g;
const escape = (value) => String(value).replace(ESCAPES, '\\$&');

/** Affiche le texte public en mettant en évidence les termes du lexique, sans injecter de HTML. */
export default function HighlightedText({ text = '', terms = [], className = '' }) {
  const unique = [...new Set((terms || []).filter((term) => String(term || '').trim().length > 1))]
    .sort((left, right) => right.length - left.length);
  if (!unique.length) return <p className={className}><bdi>{text}</bdi></p>;
  const lookup = new Set(unique.map((term) => term.toLocaleLowerCase('fr')));
  const parts = String(text).split(new RegExp(`(${unique.map(escape).join('|')})`, 'gi'));
  return <p className={className}>{parts.map((part, index) => lookup.has(part.toLocaleLowerCase('fr'))
    ? <mark key={`${part}-${index}`} className="rounded-sm bg-warning/25 px-0.5 font-semibold text-ink">{part}</mark>
    : <span key={`${part}-${index}`}>{part}</span>)}</p>;
}
