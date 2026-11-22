/** V15 — instrumentation de géométrie et de pagination pour le Studio de synthèses. */

export function createDiagnostic(page, testInfo, nom) {
  let rapport = { nom };
  return {
    set(extra) { rapport = { ...rapport, ...extra }; },
    async save() {
      console.log(`[${nom}] ${JSON.stringify(rapport)}`);
      await testInfo.attach(`${nom}-geometrie.json`, {
        body: JSON.stringify(rapport, null, 2), contentType: 'application/json',
      });
      try {
        const capture = await page.screenshot({ fullPage: true, animations: 'disabled' });
        await testInfo.attach(`${nom}-capture.png`, { body: capture, contentType: 'image/png' });
      } catch { /* la page peut être fermée sur un échec de navigation */ }
    },
  };
}

export async function mesurerStudio(page) {
  return page.evaluate(() => {
    const widgets = [...document.querySelectorAll('[data-widget-id]')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const r = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const content = element.querySelector('[data-widget-content]');
        return {
          id: element.dataset.widgetId,
          titre: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 60),
          x: Math.round(r.x), y: Math.round(r.y),
          largeur: Math.round(r.width), hauteur: Math.round(r.height),
          overflow: style.overflow, overflowX: style.overflowX, overflowY: style.overflowY,
          contenuPlusGrand: content ? content.scrollHeight > element.clientHeight + 1 : false,
        };
      });
    const groupes = new Map();
    for (const widget of widgets) {
      const cle = Math.round(widget.y / 20);
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(widget);
    }
    const lignes = [...groupes.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, items]) => ({ largeurTotale: items.reduce((sum, item) => sum + item.largeur, 0), widgets: items.map((item) => item.id) }));
    const trous = [];
    for (let i = 1; i < lignes.length; i += 1) {
      const precedente = lignes[i - 1].widgets.map((id) => widgets.find((w) => w.id === id));
      const courante = lignes[i].widgets.map((id) => widgets.find((w) => w.id === id));
      const bas = Math.max(...precedente.map((w) => w.y + w.hauteur));
      const haut = Math.min(...courante.map((w) => w.y));
      trous.push(Math.max(0, haut - bas));
    }
    return { widgets, lignes, trous, plusEtroit: Math.min(...widgets.map((w) => w.largeur)), largeurUtile: document.documentElement.clientWidth };
  });
}

export async function mesurerImpression(page, {pdf} = {}) {
  await page.emulateMedia({ media: 'print' });
  const dom = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('[data-print-page]')];
    const zone = document.querySelector('[data-print-document]');
    const reference = document.querySelector('[data-print-reference]')?.textContent?.trim() || '';
    const periode = document.querySelector('[data-print-periode]');
    const periodeRect = periode?.getBoundingClientRect();
    const periodeStyle = periode ? getComputedStyle(periode) : null;
    const defilements = [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);
      return ['auto', 'scroll'].includes(style.overflow) || ['auto', 'scroll'].includes(style.overflowX) || ['auto', 'scroll'].includes(style.overflowY);
    }).slice(0, 20).map((element) => ({
      balise: element.tagName.toLowerCase(),
      attributs: element.getAttributeNames().filter((name) => name.startsWith('data-')).map((name) => `${name}=${element.getAttribute(name)}`).join(' '),
      overflow: `${getComputedStyle(element).overflowX}/${getComputedStyle(element).overflowY}`,
    }));
    const zones = pages.length ? pages : zone ? [zone] : [];
    const remplissage = zones.map((element) => {
      const r = element.getBoundingClientRect();
      const contenu = [...element.children].reduce((sum, child) => {
        const c = child.getBoundingClientRect();
        return sum + (c.height > 0 ? c.height + 16 : 0);
      }, 0);
      return r.height > 0 ? Math.min(1, contenu / r.height) : 0;
    });
    return {
      present: Boolean(zone),
      nombrePages: zones.length,
      remplissage: remplissage.map((value) => Math.round(value * 100)),
      defilements,
      reference,
      periode: periode?.textContent?.trim() || '',
      periodeHauteur: periodeRect ? Math.round(periodeRect.height) : 0,
      periodeInterligne: periodeStyle?.lineHeight || '',
      referenceVide: !reference || reference === '—',
    };
  });
  if (pdf) {
    const buffer = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    dom.pagesPdf = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    dom.taillePdf = buffer.length;
  }
  await page.emulateMedia({ media: 'screen' });
  return dom;
}

export function compterPagesPdf(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

export async function mesurerDonut(page) {
  return page.evaluate(() => {
    const widget = [...document.querySelectorAll('[data-widget-id]')]
      .find((element) => /Répartition des statuts/i.test(element.getAttribute('aria-label') || element.textContent || ''));
    const svg = widget?.querySelector('svg');
    const total = widget?.querySelector('[data-anneau-total]') || svg?.querySelector('text');
    const legende = widget?.querySelector('[data-anneau-legende]');
    const anneau = widget?.querySelector('[data-anneau-graphique]') || svg?.getBoundingClientRect();
    const totalRect = total?.getBoundingClientRect();
    const anneauRect = anneau && 'width' in anneau ? anneau : svg?.getBoundingClientRect();
    const dansAnneau = Boolean(totalRect && anneauRect
      && totalRect.left >= anneauRect.left - 1 && totalRect.right <= anneauRect.right + 1
      && totalRect.top >= anneauRect.top - 1 && totalRect.bottom <= anneauRect.bottom + 1);
    const entrees = legende ? [...legende.querySelectorAll('[data-anneau-entree]')] : [];
    return {
      present: Boolean(widget),
      total: total?.textContent?.trim() || '',
      dansAnneau,
      entrees: entrees.map((entree) => ({ texte: entree.textContent.replace(/\s+/g, ' ').trim(), tronque: /…|\.\.\.$/.test(entree.textContent) })),
    };
  });
}

export async function mesurerTableau(page, motif = /Par daïra/i) {
  return page.evaluate((source) => {
    const regex = new RegExp(source, 'i');
    const widget = [...document.querySelectorAll('[data-widget-id]')]
      .find((element) => regex.test(element.getAttribute('aria-label') || element.textContent || ''));
    const table = widget?.querySelector('table');
    const entetes = table ? [...table.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim()) : [];
    const lignes = table ? table.querySelectorAll('tbody tr').length : 0;
    const premiereColonne = table ? [...table.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent.trim()).filter(Boolean).length : 0;
    const content = widget?.querySelector('[data-widget-content]');
    return {
      present: Boolean(widget), entetes, lignes, premiereColonne,
      rogne: content ? content.scrollHeight > content.clientHeight + 1 : false,
    };
  }, motif.source);
}

export async function mesurerBarreOutils(page) {
  return page.evaluate(() => {
    const zone = document.querySelector('[data-report-studio]') || document.querySelector('header');
    const boutons = zone ? [...zone.querySelectorAll('button')].map((b) => ({
      texte: (b.getAttribute('aria-label') || b.textContent || '').trim(),
      titre: b.getAttribute('title') || '',
    })) : [];
    const sansLibelle = zone ? [...zone.querySelectorAll('select, input, button')].filter((element) => {
      const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.labels?.[0]?.textContent?.trim() || element.textContent.trim();
      return !name;
    }).length : 0;
    return {
      hauteur: zone ? Math.round(zone.getBoundingClientRect().height) : 0,
      doublons: ['Imprimer', 'Éditions'].filter((nom) => boutons.filter((b) => b.texte.includes(nom)).length > 1),
      sansLibelle,
      boutons: boutons.map((b) => b.texte).filter(Boolean),
    };
  });
}

export async function mesurerGalerie(page) {
  return page.evaluate(() => {
    const cartes = [...document.querySelectorAll('[data-widget-gallery-card]')];
    return {
      cartes: cartes.length,
      mauvaisLibelles: cartes.flatMap((carte) => {
        const texte = carte.textContent.replace(/\s+/g, ' ').trim();
        const problemes = [];
        if (/^[A-Z]{3}$/.test(texte.split(' ')[0])) problemes.push(`abreviation:${texte.split(' ')[0]}`);
        if (/^(delais|vue|categories|territoire|acteurs|plateformes|qualite|listes|texte)$/i.test(texte.split(' ')[0])) problemes.push(`slug:${texte.split(' ')[0]}`);
        if (!carte.querySelector('[data-galerie-description]')) problemes.push('description manquante');
        if (!carte.querySelector('[data-galerie-type]')) problemes.push('type manquant');
        if (!carte.querySelector('[data-galerie-taille]')) problemes.push('taille manquante');
        return problemes.map((probleme) => ({ probleme, texte: texte.slice(0, 80) }));
      }),
      recherche: Boolean(document.querySelector('[data-galerie-recherche]')),
      categories: [...document.querySelectorAll('[data-galerie-categorie]')].map((element) => element.textContent.trim()),
    };
  });
}
