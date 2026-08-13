(() => {
  const apply = (on) => {
    document.documentElement.dataset.iklanAman = on ? 'on' : 'off';
    window.dispatchEvent(new CustomEvent('iklan-aman-toggle', { detail: { on } }));
  };

  const applyDomains = (domains) => {
    document.documentElement.dataset.iklanAmanDomains = JSON.stringify(domains || []);
    window.dispatchEvent(
      new CustomEvent('iklan-aman-domains', { detail: { domains: domains || [] } })
    );
  };

  chrome.storage.local.get({ enabled: true, domains: [] }, ({ enabled, domains }) => {
    apply(enabled);
    applyDomains(domains);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('enabled' in changes) apply(changes.enabled.newValue);
    if ('domains' in changes) applyDomains(changes.domains.newValue);
  });
})();