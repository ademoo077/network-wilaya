import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, SegmentedControl } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import TerritoryStep from './TerritoryStep.jsx';
import { AgentStep, EpicStep } from './ReferenceSetupStep.jsx';
import SettingsStep from './SettingsStep.jsx';

export default function SetupPage() {
  const { t } = useI18n();
  const { reload } = useRefs();
  const navigate = useNavigate();
  const [step, setStep] = useState('territory');
  const steps = [
    { value: 'territory', label: t('setup.territory') },
    { value: 'epics', label: t('setup.epics') },
    { value: 'agents', label: t('setup.agents') },
    { value: 'settings', label: t('setup.parameters') },
  ];
  const advance = async (next) => { await reload(); setStep(next); };
  return <div className="page-container"><PageHeader title={t('setup.title')} description={t('setup.intro')} actions={<Button variant="ghost" onClick={() => navigate('/')}>{t('common.close')}</Button>} /><div className="mb-6"><SegmentedControl label={t('setup.title')} options={steps} value={step} onChange={setStep} /></div>{step === 'territory' && <TerritoryStep onApplied={() => advance('epics')} />}{step === 'epics' && <EpicStep />}{step === 'agents' && <AgentStep />}{step === 'settings' && <SettingsStep onSaved={() => navigate('/')} />}<div className="mt-6 flex justify-between"><Button variant="secondary" disabled={step === 'territory'} onClick={() => setStep(steps[Math.max(0, steps.findIndex((item) => item.value === step) - 1)].value)}>{t('common.previous')}</Button><Button disabled={step === 'settings'} onClick={() => setStep(steps[Math.min(steps.length - 1, steps.findIndex((item) => item.value === step) + 1)].value)}>{t('common.next')}</Button></div></div>;
}
