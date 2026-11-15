/* Popup de capture assistée — Manifest V3, aucune télémétrie, aucun code distant. */
(function () {
  const { elementUrl, isConfigured, readConfig } = window.VeilleCapture;

  const $ = (id) => document.getElementById(id);
  const notice = $('notice');
  const unconfigured = $('unconfigured');
  const capture = $('capture');
  const form = $('form');
  const fields = { url: $('url'), page: $('page'), date: $('date'), text: $('text') };
  const readButton = $('read-page');
  const sendButton = $('send');
  const result = $('result');
  const textHint = $('text-hint');

  let config = { platformUrl: '', token: '' };
  let sending = false;

  function showNotice(message, variant) {
    notice.textContent = message || '';
    notice.className = `notice${variant ? ` ${variant}` : ''}`;
    notice.hidden = !message;
  }

  function setField(name, value) {
    fields[name].value = value == null ? '' : String(value);
  }

  function showCapture() {
    unconfigured.hidden = true;
    capture.hidden = false;
    result.hidden = true;
    form.hidden = true;
    showNotice('');
  }

  function showUnconfigured() {
    capture.hidden = true;
    result.hidden = true;
    unconfigured.hidden = false;
    showNotice('Aucun jeton configuré : aucune donnée ne peut être envoyée.', 'error');
  }

  function pageSnapshot() {
    const meta = (selector) => {
      const node = document.querySelector(selector);
      return node ? String(node.getAttribute('content') || '').trim() : '';
    };
    const canonical = document.querySelector('link[rel="canonical"]');
    const time = document.querySelector('time[datetime]');
    return {
      url: (canonical && canonical.href) || meta('meta[property="og:url"]') || location.href,
      page: meta('meta[property="og:site_name"]') || location.hostname,
      title: meta('meta[property="og:title"]') || document.title || '',
      description: meta('meta[property="og:description"]') || meta('meta[name="description"]') || '',
      published: meta('meta[property="article:published_time"]')
        || meta('meta[itemprop="datePublished"]')
        || (time ? String(time.getAttribute('datetime') || '') : ''),
      typeMedia: meta('meta[property="og:type"]') || '',
      selection: String((window.getSelection && window.getSelection().toString()) || '').trim(),
    };
  }

  async function readActivePage() {
    readButton.disabled = true;
    readButton.textContent = 'Lecture…';
    showNotice('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('Aucun onglet actif.');
      const url = String(tab.url || '');
      if (!/^https?:/i.test(url)) {
        throw new Error('Cette page n’est pas une page web publique (http/https).');
      }
      const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageSnapshot });
      if (!injection || !injection.result) throw new Error('Lecture impossible sur cette page.');
      const snapshot = injection.result;
      const text = snapshot.selection || snapshot.description || snapshot.title;
      setField('url', snapshot.url);
      setField('page', snapshot.page);
      setField('date', String(snapshot.published || '').slice(0, 10));
      setField('text', text);
      form.hidden = false;
      textHint.hidden = Boolean(text);
      if (text) fields.text.focus();
      showNotice(snapshot.selection
        ? 'Sélection récupérée. Vérifiez et complétez avant l’envoi.'
        : 'Aperçu récupéré depuis les métadonnées publiques. Vérifiez avant l’envoi.', 'ok');
    } catch (error) {
      form.hidden = true;
      showNotice(error && error.message ? error.message : 'Impossible de lire la page active.', 'error');
    } finally {
      readButton.disabled = false;
      readButton.textContent = 'Lire la page active';
    }
  }

  function renderSuggestions(suggestions) {
    const list = $('suggestions');
    list.textContent = '';
    for (const suggestion of suggestions || []) {
      const item = document.createElement('li');
      const head = document.createElement('strong');
      const labels = [];
      if (suggestion.groupe_id) labels.push(`Groupe #${suggestion.groupe_id}`);
      if (suggestion.domaine_id) labels.push(`Domaine #${suggestion.domaine_id}`);
      if (suggestion.type_id) labels.push(`Type #${suggestion.type_id}`);
      head.textContent = labels.length ? labels.join(' · ') : 'Suggestion';
      item.appendChild(head);
      const score = document.createElement('span');
      score.textContent = ` — score ${Number(suggestion.score || 0)}${suggestion.confidence ? ` · confiance ${suggestion.confidence}` : ''}`;
      item.appendChild(score);
      if (Array.isArray(suggestion.raisons) && suggestion.raisons.length) {
        const why = document.createElement('span');
        why.className = 'why';
        why.textContent = suggestion.raisons.join(' · ');
        item.appendChild(why);
      }
      list.appendChild(item);
    }
  }

  function showResult(payload) {
    form.hidden = true;
    result.hidden = false;
    showNotice('');
    const item = payload.item || {};
    $('result-title').textContent = payload.created === false
      ? 'Publication déjà présente : aucun doublon créé.'
      : 'Publication transmise à la boîte de veille.';
    const meta = [
      item.statut ? `Statut : ${item.statut}` : '',
      item.priorite ? `Priorité : ${item.priorite}` : '',
      typeof item.score === 'number' ? `Score : ${item.score}` : '',
    ].filter(Boolean);
    $('result-meta').textContent = meta.join(' · ');
    renderSuggestions(payload.suggestions);
    const link = $('open-element');
    const href = elementUrl(config.platformUrl, item.id);
    if (href) { link.href = href; link.hidden = false; } else { link.removeAttribute('href'); link.hidden = true; }
  }

  async function send(event) {
    event.preventDefault();
    if (sending) return;
    const texte = fields.text.value.trim();
    const url = fields.url.value.trim();
    if (texte.length < 3) { showNotice('Le texte public doit contenir au moins 3 caractères.', 'error'); return; }
    if (!/^https?:\/\//i.test(url)) { showNotice('L’URL doit commencer par http:// ou https://.', 'error'); return; }
    const platform = config.platformUrl;
    if (!isConfigured(config)) { showUnconfigured(); return; }
    sending = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Envoi…';
    showNotice('');
    try {
      const response = await fetch(`${platform}/api/veille/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        body: JSON.stringify({
          url,
          page_nom: fields.page.value.trim() || null,
          texte,
          date_publication: fields.date.value.trim() || null,
          type_media: null,
        }),
      });
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        const message = payload && payload.error && payload.error.message
          ? payload.error.message
          : `Envoi refusé (code ${response.status}).`;
        if (response.status === 401 || response.status === 403) {
          showNotice(`${message} Vérifiez ou régénérez votre jeton dans le profil de la plateforme.`, 'error');
        } else {
          showNotice(message, 'error');
        }
        return;
      }
      if (!payload || !payload.item) throw new Error('Réponse inattendue de la plateforme.');
      showResult(payload);
    } catch (error) {
      showNotice(`Plateforme injoignable : ${error && error.message ? error.message : 'erreur réseau'}.`, 'error');
    } finally {
      sending = false;
      sendButton.disabled = false;
      sendButton.textContent = 'Envoyer à la veille';
    }
  }

  function reset() {
    form.reset();
    form.hidden = true;
    result.hidden = true;
    textHint.hidden = true;
    showNotice('');
  }

  function openOptions(event) {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    config = await readConfig();
    $('open-options').addEventListener('click', openOptions);
    $('configure').addEventListener('click', openOptions);
    readButton.addEventListener('click', readActivePage);
    form.addEventListener('submit', send);
    $('reset').addEventListener('click', reset);
    $('another').addEventListener('click', () => {
      result.hidden = true;
      form.hidden = true;
      showCapture();
    });
    if (isConfigured(config)) showCapture(); else showUnconfigured();
  });
})();
