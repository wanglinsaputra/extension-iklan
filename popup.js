const $ = (id) => document.getElementById(id);

async function load() {
  const { enabled = true, sync = null, extra = [], domains = [] } =
    await chrome.storage.local.get(['enabled', 'sync', 'extra', 'domains']);
  return { enabled, sync, extra, domains };
}

function render({ enabled, sync, extra }) {
  const status = $('status');
  status.textContent = enabled ? 'AKTIF' : 'MATI';
  status.className = 'status ' + (enabled ? 'on' : 'off');
  $('toggle').checked = enabled;
  $('meta').textContent = sync
    ? `Sinkron: ${new Date(sync.at).toLocaleTimeString()} · ${sync.count} domain`
    : 'Aturan static aktif. Belum sinkron.';

  const chips = $('chips');
  chips.innerHTML = '';
  for (const d of extra) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.textContent = d;
    chips.appendChild(c);
  }
}

async function init() {
  $('toggle').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
    const s = await load();
    render(s);
  });

  $('btnAdd').addEventListener('click', addDomain);
  $('addDomain').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain();
  });

  async function addDomain() {
    const val = $('addDomain').value.trim();
    if (!val) return;
    await chrome.runtime.sendMessage({ type: 'addDomain', domain: val });
    $('addDomain').value = '';
    render(await load());
  }

  render(await load());
}

init();