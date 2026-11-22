import { useEffect, useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { normalize } from '@anm/shared';

function FieldShell({ id, label, error, hint, required, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <div className="mb-1.5 text-sm font-semibold text-ink"><label htmlFor={id}>{label}</label>{required && <span aria-hidden="true"> *</span>}</div>}
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-danger" role="alert">{error}</p>}
    </div>
  );
}

const fieldClass = 'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted transition focus:border-brand-600 disabled:cursor-not-allowed disabled:bg-surface2 disabled:opacity-70';

export function Input({ label, error, hint, required, className = '', id: givenId, ...props }) {
  const autoId = useId();
  const id = givenId || autoId;
  return (
    <FieldShell {...{ id, label, error, hint, required, className }}>
      <input id={id} placeholder={label} className={fieldClass} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} required={required} {...props} />
    </FieldShell>
  );
}

export function Textarea({ label, error, hint, required, maxLength, className = '', id: givenId, ...props }) {
  const autoId = useId();
  const id = givenId || autoId;
  const length = String(props.value ?? props.defaultValue ?? '').length;
  return (
    <FieldShell {...{ id, label, error, hint, required, className }}>
      <textarea id={id} placeholder={label} maxLength={maxLength} className={`${fieldClass} min-h-28 resize-y py-3`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} required={required} {...props} />
      {maxLength && <div className="mt-1 text-end text-xs text-muted" aria-live="polite">{length}/{maxLength}</div>}
    </FieldShell>
  );
}

export function Select({ label, error, hint, required, options = [], placeholder, className = '', id: givenId, ...props }) {
  const autoId = useId();
  const id = givenId || autoId;
  return (
    <FieldShell {...{ id, label, error, hint, required, className }}>
      <div className="relative">
        <select id={id} className={`${fieldClass} appearance-none pe-10`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} required={required} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
    </FieldShell>
  );
}

export function Combobox({ label, error, hint, required, options = [], value, onChange, onQueryChange, onBlur, disabled, id: givenId, placeholder, className = '' }) {
  const autoId = useId(); const id = givenId || autoId;
  const selected = options.find((option) => String(option.value) === String(value));
  const [query, setQuery] = useState(selected?.label || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => { setQuery(selected?.label || ''); }, [selected?.label, value]);
  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q || selected?.label === query) return options.slice(0, 100);
    return options.filter((option) => normalize(`${option.label} ${option.search || ''}`).includes(q)).slice(0, 100);
  }, [options, query, selected]);
  const choose = (option) => {
    if (option?.disabled) return;
    setQuery(option?.label || '');
    onChange?.(option?.value ?? '');
    setOpen(false);
  };
  const keyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, filtered.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    if (event.key === 'Enter' && open && filtered[active]) { event.preventDefault(); choose(filtered[active]); }
    if (event.key === 'Escape') setOpen(false);
  };
  return (
    <FieldShell {...{ id, label, error, hint, required, className }}>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
        <input id={id} role="combobox" disabled={disabled} aria-required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-expanded={open} aria-controls={open && filtered.length ? `${id}-list` : undefined} aria-autocomplete="list" aria-activedescendant={open && filtered[active] ? `${id}-option-${active}` : undefined}
          className={`${fieldClass} ps-10`} value={query} placeholder={placeholder || label}
          onFocus={() => setOpen(true)} onBlur={(event) => { setOpen(false); onBlur?.(event); }} onKeyDown={keyDown}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); onQueryChange?.(event.target.value); if (!event.target.value) onChange?.(''); }} />
        {open && filtered.length > 0 && (
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface p-1 shadow-2">
            {filtered.map((option, index) => (
              <li key={option.value} id={`${id}-option-${index}`} role="option" aria-disabled={option.disabled || undefined} aria-selected={String(option.value) === String(value)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm ${index === active ? 'bg-brand-100 text-ink' : 'hover:bg-surface2'}`}
                onMouseDown={(event) => { event.preventDefault(); choose(option); }}>
                <span className="min-w-0"><bdi>{option.label}</bdi>{option.description && <bdi className="mt-0.5 block text-xs text-muted">{option.description}</bdi>}</span>{String(option.value) === String(value) && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FieldShell>
  );
}

export function Checkbox({ label, children, className = '', ...props }) {
  return <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink ${className}`}><input type="checkbox" className="h-4 w-4 accent-brand-700" {...props} /><span>{children ?? label}</span></label>;
}
