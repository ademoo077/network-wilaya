import { useEffect, useState } from 'react';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

export function SegmentedControl({ options, value, onChange, label }) {
  return <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-surface p-1">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} disabled={option.disabled} onClick={() => onChange(option.value)} className={`min-h-9 whitespace-nowrap rounded-sm px-3 text-xs font-bold transition ${value === option.value ? 'bg-brand-700 text-brand-50' : 'text-ink2 hover:bg-surface2'} disabled:opacity-45`}>{option.label}</button>)}</div>;
}

export function Tabs({ tabs, value, onChange, ariaLabel }) {
  return <div role="tablist" aria-label={ariaLabel} className="flex max-w-full gap-1 overflow-x-auto border-b border-border">{tabs.map((tab) => <button type="button" role="tab" key={tab.value} aria-selected={value === tab.value} onClick={() => onChange(tab.value)} className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-bold ${value === tab.value ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted hover:text-ink'}`}>{tab.label}</button>)}</div>;
}

export function ProgressBar({ value = 0, label, showValue = true, className = '' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={className}>{(label || showValue) && <div className="mb-1 flex justify-between gap-2 text-xs text-muted">{label && <span>{label}</span>}{showValue && <span>{safe.toFixed(1)} %</span>}</div>}<div className="h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={safe}><div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${safe}%` }} /></div></div>;
}

export function Gauge({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="relative h-3 overflow-hidden rounded-full bg-surface2" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={safe}><div className="h-full rounded-full bg-brand-600" style={{ width: `${safe}%` }} /></div>;
}

function useAnimatedNumber(value) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return undefined; }
    const target = Number(value) || 0;
    const start = performance.now();
    let frame;
    const step = (now) => {
      const progress = Math.min(1, (now - start) / 500);
      setShown(target * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

export function KpiCard({ icon: Icon, label, value, suffix = '', variation, decimals = 0, onClick, children }) {
  const animated = useAnimatedNumber(value);
  const Wrapper = onClick ? 'button' : 'div';
  const down = Number(variation) < 0;
  const Trend = down ? TrendingDown : TrendingUp;
  return <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className={`w-full rounded-lg border border-border bg-surface p-4 text-start shadow-1 transition ${onClick ? 'hover:-translate-y-0.5 hover:shadow-2' : ''}`}><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-brand-100 text-brand-800"><Icon className="h-5 w-5" aria-hidden="true" /></div>{variation !== null && variation !== undefined && <span className={`inline-flex items-center gap-1 text-xs font-bold ${down ? 'text-danger' : 'text-straite'}`}><Trend className="h-3.5 w-3.5" aria-hidden="true" />{Math.abs(variation)}%</span>}</div><p className="mt-3 text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-2xl font-black text-ink">{animated.toFixed(decimals)}{suffix}</p>{children && <div className="mt-3">{children}</div>}</Wrapper>;
}

export function Avatar({ name = '?', size = 'md' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-800 ${size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'}`}>{initials || '?'}</span>;
}

export function Breadcrumbs({ items }) {
  const { dir } = useI18n();
  return <nav aria-label="Breadcrumb"><ol className="flex min-w-0 items-center gap-1 text-sm text-muted">{items.map((item, index) => <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">{index > 0 && <ChevronRight className={`h-4 w-4 shrink-0 ${dir === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true" />}{item.to ? <Link className="truncate hover:text-ink" to={item.to}>{item.label}</Link> : <span className="truncate text-ink">{item.label}</span>}</li>)}</ol></nav>;
}
