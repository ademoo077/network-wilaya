/**
 * Galerie de modèles de synthèse V8.2 : #/syntheses
 * Liste les modèles système et personnels, ouvre une synthèse, personnalise
 * un modèle système (copie-écriture) ou crée une synthèse vide.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, ArrowRight } from 'lucide-react';
import { api } from '../../api/client.js';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, useToast } from '../../components/ui/index.js';
import { Chip } from '../../components/ui/Chip.jsx';
import { personalizeModel, rememberModel } from './syntheseActions.js';

const VIDE = { schema_version: 1, sections: [{ id: 'section-1', colonnes: [[]] }] };

function sourceIdFor(modele, systemes) {
  if (modele.nom === 'Ma synthèse hebdomadaire') {
    return systemes.find((item) => item.cle_systeme === 'hebdomadaire')?.id || null;
  }
  const prefix = 'Ma synthèse — ';
  if (!modele.nom.startsWith(prefix)) return null;
  return systemes.find((item) => item.nom === modele.nom.slice(prefix.length))?.id || null;
}

export default function SynthesesPage({ embedded = false, modeleHref = null } = {}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const canWrite = user && (user.role === 'admin' || user.role === 'operateur');

  const query = useApiQuery('/syntheses/modeles');
  const [creating, setCreating] = useState(false);
  const [personnalisant, setPersonnalisant] = useState(null);

  const models = useMemo(() => query.data?.items || [], [query.data]);
  const systemes = models.filter((m) => m.portee === 'systeme');
  const personnels = models.filter((m) => m.portee !== 'systeme');
  const hrefForModele = useCallback((id, options = {}) => {
    if (modeleHref) return modeleHref(id, options);
    const params = new URLSearchParams();
    if (options.personnaliser) params.set('personnaliser', '1');
    if (options.source) params.set('source', String(options.source));
    return `/syntheses/${id}${params.size ? `?${params}` : ''}`;
  }, [modeleHref]);

  const handleNouvelle = useCallback(async () => {
    if (!canWrite) return;
    setCreating(true);
    try {
      const cree = await api('/syntheses/modeles', {
        method: 'POST', body: { nom: `Nouvelle synthèse — ${new Date().toLocaleDateString()}`, definition: VIDE, portee: 'prive' },
      });
      const item = await rememberModel(cree.item || cree);
      navigate(hrefForModele(item.id, { personnaliser: true }));
    } catch (error) { push(error.message || t('common.error'), 'danger'); } finally { setCreating(false); }
  }, [canWrite, hrefForModele, navigate, push, t]);

  const handlePersonnaliser = useCallback(async (modele) => {
    if (!canWrite || personnalisant) return;
    setPersonnalisant(modele.id);
    try {
      let cible = modele;
      let item;
      try {
        item = await personalizeModel(cible);
      } catch (error) {
        if (error.status !== 404 || !modele.cle_systeme) throw error;
        const refreshed = await query.refetch();
        cible = refreshed.data?.items?.find((item) => item.cle_systeme === modele.cle_systeme);
        if (!cible || cible.id === modele.id) throw error;
        item = await personalizeModel(cible);
      }
      navigate(hrefForModele(item.id, { personnaliser: true, source: item.source_modele_id || cible.id }));
    } catch (error) { push(error.message || t('common.error'), 'danger'); } finally { setPersonnalisant(null); }
  }, [canWrite, personnalisant, hrefForModele, navigate, push, query, t]);

  const openModele = useCallback((modele) => {
    const source = modele.portee === 'systeme' ? null : sourceIdFor(modele, systemes);
    navigate(hrefForModele(modele.id, { source }));
  }, [hrefForModele, navigate, systemes]);

  return (
    <main className={`page-container grid ${embedded ? '' : 'min-h-dvh'}`} data-syntheses-page>
      <PageHeader
        eyebrow={t('synthese.eyebrow')}
        title={t('synthese.titreGalerie')}
        description={t('synthese.galerieHelp')}
        actions={
          canWrite && <Button size="sm" onClick={handleNouvelle} loading={creating}>
            <Plus className="h-4 w-4" aria-hidden="true" />{t('synthese.nouvelleSynthese')}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {query.isPending && <div className="grid place-items-center min-h-[40vh]"><Skeleton className="h-10 w-48" /></div>}
        {query.isError && <ErrorState message={query.error?.message || t('error.load')} onRetry={() => query.refetch()} />}
        {query.isSuccess && (
          <>
            {systemes.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-ink mb-3"><bdi>{t('synthese.modelesSysteme')}</bdi></h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {systemes.map((modele) => (
                    <Card key={modele.id} data-testid={`modele-${modele.id}`} className="p-4">
                      <CardHeader title={modele.nom} description={modele.description || t('synthese.modeleSystemeDesc')} />
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                        <Chip variant="primaire">{t('synthese.systeme')}</Chip>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openModele(modele)}>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />{t('synthese.ouvrir')}
                          </Button>
                          {canWrite && <Button size="sm" onClick={() => handlePersonnaliser(modele)} loading={personnalisant === modele.id} disabled={personnalisant !== null}>
                            <Play className="h-4 w-4" aria-hidden="true" />{t('synthese.personnaliser')}
                          </Button>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
            {personnels.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-ink mb-3"><bdi>{t('synthese.mesSyntheses')}</bdi></h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {personnels.map((modele) => (
                    <Card key={modele.id} data-testid={`modele-${modele.id}`} className="p-4">
                      <CardHeader title={modele.nom} description={`${modele.version}`} />
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <Chip variant={modele.portee === 'equipe' ? 'secondaire' : 'outline'}>{t(`synthese.portee.${modele.portee}`)}</Chip>
                        <Button size="sm" onClick={() => openModele(modele)}>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />{t('synthese.ouvrir')}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
            {!systemes.length && !personnels.length && <EmptyState title={t('synthese.aucunModele')} description={t('synthese.aucunModeleHelp')} action={canWrite ?
              <Button size="sm" onClick={handleNouvelle}><Plus className="h-4 w-4" aria-hidden="true" />{t('synthese.nouvelleSynthese')}</Button> : null
            } />}
          </>
        )}
      </div>
    </main>
  );
}
