import { AlertCircle, CheckCircle2, CircleDot, Clock3, HelpCircle, Lock, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

const statusConfig = {
  non_traite: ['bg-stnonbg text-stnon', AlertCircle],
  en_cours: ['bg-stcoursbg text-stcours', Clock3],
  traite: ['bg-straitebg text-straite', CheckCircle2],
};
const verificationConfig = {
  a_verifier: ['bg-surface2 text-muted', HelpCircle],
  confirmee: ['bg-straitebg text-straite', CheckCircle2],
  infirmee: ['bg-stnonbg text-stnon', AlertCircle],
};
const priorityConfig = {
  normale: ['bg-surface2 text-ink2', CircleDot],
  haute: ['bg-stcoursbg text-stcours', ShieldAlert],
  urgente: ['bg-stnonbg text-stnon', AlertCircle],
};

function Badge({ value, config, prefix, suffix }) {
  const { t } = useI18n();
  const [classes, Icon] = config[value] || ['bg-surface2 text-muted', CircleDot];
  const SuffixIcon = suffix;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{t(`${prefix}.${value}`)}{SuffixIcon ? <SuffixIcon className="h-3 w-3" aria-hidden="true" /> : null}</span>;
}

export function StatusBadge({ value }) { return <Badge value={value} config={statusConfig} prefix="status" suffix={value === 'traite' ? Lock : null} />; }
export function VerificationBadge({ value }) { return <Badge value={value} config={verificationConfig} prefix="verification" />; }
export function PriorityBadge({ value }) { return <Badge value={value} config={priorityConfig} prefix="priority" />; }

export function PlatformBadge({ value }) {
  const { t } = useI18n();
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-ink2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-[10px] font-black text-brand-800">{String(value || '?').slice(0, 2).toUpperCase()}</span>{t(`platform.${value}`)}</span>;
}
