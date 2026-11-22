import { Alert, Button } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { historyLabel } from './helpers.js';

function readable(item, refs, lang, t) {
  if (item.champ === 'gps') return `${item.valeur.lat}, ${item.valeur.lng}`;
  const lists = { domaine_id: refs.domaines, type_id: refs.domaines.flatMap((domain) => domain.types),
    daira_id: refs.dairas, commune_id: refs.dairas.flatMap((daira) => daira.communes), epic_id: refs.epics, agent_id: refs.agents };
  if (lists[item.champ]) return refLabel(lists[item.champ].find((row) => String(row.id) === String(item.valeur)), lang);
  if (item.champ === 'plateforme') return t(`platform.${item.valeur}`);
  return String(item.valeur || '');
}
export default function FormSuggestions({ model }) {
  const { t, lang } = useI18n(); const { state, set, ui, refs } = model;
  if (!state.suggestions.length) return null;
  const apply = (item) => {
    if (item.champ === 'daira_id' && !refs.dairas.find((daira) => String(daira.id) === String(item.valeur))?.communes.some((commune) => String(commune.id) === state.values.commune_id)) set('commune_id', '');
    if (item.champ === 'commune_id') {
      const daira = refs.dairas.find((row) => row.communes.some((commune) => String(commune.id) === String(item.valeur)));
      if (daira) set('daira_id', String(daira.id));
    }
    set(item.champ, item.valeur, item.source);
  };
  return <div className="mb-6 grid gap-3 lg:grid-cols-2" aria-live="polite">{state.suggestions.map((item) => <div key={item.champ} data-testid={`suggestion-${item.champ}`}>
    <Alert title={`${historyLabel(item.champ, t)} — ${t('paste.suggestion')}`}>
      <p className="break-words"><bdi>{readable(item, refs, lang, t)}</bdi></p>
      <div className="mt-2 flex flex-wrap gap-2"><Button onClick={() => apply(item)}>{t('paste.replace')}</Button>
        <Button variant="ghost" onClick={() => ui({ suggestions: state.suggestions.filter((suggestion) => suggestion !== item) })}>{t('paste.ignore')}</Button></div>
    </Alert>
  </div>)}</div>;
}
