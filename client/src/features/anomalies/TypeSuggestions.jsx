import { Check, ListChecks, Undo2 } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';

export default function TypeSuggestions({ model }) {
  const { t, lang } = useI18n(); const { state, refs, chooseType, undo } = model;
  if (!state.result?.texteRestant || state.result.texteRestant.length < 4) return null;
  const undoable = state.undo.some((entry) => entry.id === state.typeChoice);
  return <div data-type-suggestions className="mt-4 rounded-md border border-border bg-surface p-3" aria-live="polite">
    <h3 className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-brand-700" aria-hidden="true" />{t('typeHints.title')}</h3>
    <p className="mt-1 text-xs text-muted">{t(state.typeSuggestions.length ? 'typeHints.help' : 'typeHints.empty')}</p>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{state.typeSuggestions.map((hint) => {
      const domain = refs.domaines.find((row) => row.id === hint.domaine_id);
      const type = domain?.types.find((row) => row.id === hint.type_id);
      const label = `${refLabel(domain, lang)} › ${refLabel(type, lang)}`;
      const selected = String(hint.type_id) === state.values.type_id;
      return <Button key={hint.type_id} variant="secondary" className="justify-start text-start" aria-label={t('typeHints.choose', { type: label })}
        aria-pressed={selected} onClick={() => chooseType(hint.type_id, 'suggestion')}>
        {selected && <Check className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />}
        <span className="min-w-0"><bdi className="block break-words">{label}</bdi><span className="mt-1 block text-xs font-normal text-muted">{t(`typeHints.${hint.match}`, { text: hint.matched_name })}</span></span>
      </Button>;
    })}</div>
    {undoable && <Button variant="ghost" size="sm" className="mt-2" onClick={() => undo(state.typeChoice)}><Undo2 className="h-4 w-4" />{t('typeHints.undo')}</Button>}
  </div>;
}
