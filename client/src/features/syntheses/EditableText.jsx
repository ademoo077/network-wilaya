import { useEffect, useRef, useState } from 'react';

export default function EditableText({ value = '', onChange, as: Tag = 'span', className = '', placeholder = '', propId, blockId, ...rest }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== (value || '')) onChange?.(draft);
  };

  if (editing) {
    return <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
      className={`w-full rounded border border-brand-500 bg-surface px-1 py-0.5 text-inherit ${className}`}
      aria-label={placeholder || propId || 'Texte'}
    />;
  }

  return <Tag
    {...rest}
    data-editable={onChange ? 'true' : undefined}
    data-prop={propId}
    data-block-id={blockId}
    tabIndex={onChange ? 0 : undefined}
    role={onChange ? 'button' : undefined}
    className={`${className} ${onChange ? 'cursor-text rounded hover:outline hover:outline-1 hover:outline-brand-400' : ''}`}
    onDoubleClick={() => onChange && setEditing(true)}
    onKeyDown={(e) => { if (onChange && (e.key === 'Enter' || e.key === 'F2')) { e.preventDefault(); setEditing(true); } }}
    title={onChange ? 'Double-clic ou Entrée pour modifier' : undefined}
  >{value || placeholder}</Tag>;
}
