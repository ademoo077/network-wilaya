/* Page de réglages — stockage local uniquement, aucun appel réseau. */
(function () {
  const { normalizePlatform, readConfig, writeConfig } = window.VeilleCapture;

  const form = document.getElementById('form');
  const platform = document.getElementById('platform');
  const token = document.getElementById('token');
  const notice = document.getElementById('notice');
  const toggle = document.getElementById('toggle-token');

  function showNotice(message, variant) {
    notice.textContent = message || '';
    notice.className = `notice${variant ? ` ${variant}` : ''}`;
    notice.hidden = !message;
  }

  async function load() {
    const config = await readConfig();
    platform.value = config.platformUrl || '';
    token.value = config.token || '';
    if (config.platformUrl && config.token) showNotice('Configuration enregistrée.', 'ok');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = normalizePlatform(platform.value);
    if (!url) { showNotice('Adresse invalide : utilisez http:// ou https://, sans identifiants dans l’URL.', 'error'); return; }
    if (token.value.trim().length < 20) { showNotice('Le jeton de capture semble incomplet.', 'error'); return; }
    await writeConfig({ platformUrl: url, token: token.value.trim() });
    platform.value = url;
    showNotice('Réglages enregistrés. Fermez cet onglet puis rouvrez le popup.', 'ok');
  });

  toggle.addEventListener('click', () => {
    const visible = token.type === 'text';
    token.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? 'Afficher' : 'Masquer';
  });

  document.getElementById('clear').addEventListener('click', async () => {
    platform.value = '';
    token.value = '';
    await writeConfig({ platformUrl: '', token: '' });
    showNotice('Configuration effacée de ce navigateur.', 'ok');
    platform.focus();
  });

  load().catch(() => showNotice('Impossible de lire la configuration locale.', 'error'));
})();
