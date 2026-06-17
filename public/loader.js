function sectionLoaderHtml(text = "Yuklanmoqda...", compact = false) {
  const cls = compact ? 'section-loader section-loader--compact' : 'section-loader';
  return `<div class="${cls}" role="status" aria-live="polite">
    <span class="section-loader-spinner" aria-hidden="true"></span>
    <span class="section-loader-text">${text}</span>
  </div>`;
}

function showBootLoader(text = "Yuklanmoqda...") {
  if (document.getElementById('bootLoader')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="bootLoader" class="section-loader section-loader--overlay" role="status" aria-live="polite">
      <span class="section-loader-spinner" aria-hidden="true"></span>
      <span class="section-loader-text">${text}</span>
    </div>
  `);
}

function hideBootLoader() {
  document.getElementById('bootLoader')?.remove();
}

function setButtonLoading(btn, loading, loadingText = "Yuklanmoqda...") {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.idleText) btn.dataset.idleText = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${loadingText}`;
  } else {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.textContent = btn.dataset.idleText || btn.textContent;
    delete btn.dataset.idleText;
  }
}

function setLocationLoading(loading) {
  const status = document.getElementById('locationStatus');
  const btn = document.getElementById('detectLocationBtn');
  if (!status) return;

  if (loading) {
    status.innerHTML = `<span class="inline-loader" aria-hidden="true"></span> Lokatsiya aniqlanmoqda...`;
    if (btn) btn.disabled = true;
  }
}
