import { search, publicEntry, statuses } from './discovery.mjs';

// Only public catalog data is fetched. Static links and category listings stay
// usable if enhancement cannot initialize; never hide content before validation.
async function enhanceDirectory(root) {
  const form = root.querySelector('[data-search]');
  // Small catalogs are rendered without search; nothing to enhance or fetch.
  if (!form) return;
  const query = form.elements.namedItem('q');
  const status = form.elements.namedItem('status');
  const count = root.querySelector('[data-count]');
  const empty = root.querySelector('[data-empty]');
  const reset = root.querySelector('[data-reset]');
  const rows = [...root.querySelectorAll('.product-row[data-product]')];
  let catalog;
  try {
    const response = await fetch(new URL('./catalog.json', import.meta.url), { credentials: 'omit', redirect: 'error' });
    if (!response.ok) throw new Error('catalog unavailable');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('invalid catalog');
    catalog = data.map(publicEntry);
    const ids = new Set(catalog.map(item => item.id));
    if (ids.size !== catalog.length || rows.some(row => !ids.has(row.dataset.product))) {
      throw new Error('catalog and document differ');
    }
  } catch {
    const note = document.createElement('p');
    note.className = 'notice';
    note.setAttribute('role', 'status');
    note.textContent = 'Хайлт ачаалагдсангүй. Бүтээгдэхүүнийг жагсаалтаас сонгоно уу.';
    form.before(note);
    return;
  }

  let pendingInput;
  function apply(updateURL = true) {
    clearTimeout(pendingInput);
    const q = query.value.trim().slice(0, query.maxLength > 0 ? query.maxLength : 120);
    const selectedStatus = Object.hasOwn(statuses, status.value) ? status.value : '';
    const matches = new Set(search(catalog, { q, status: selectedStatus, category: root.dataset.category ?? '' }).map(item => item.id));
    let visible = 0;
    for (const row of rows) {
      row.hidden = !matches.has(row.dataset.product);
      if (!row.hidden) visible += 1;
    }
    count.textContent = `${visible} бүтээгдэхүүн`;
    empty.hidden = visible !== 0;
    reset.hidden = !q && !selectedStatus;
    if (updateURL) {
      const url = new URL(location.href);
      for (const [key, value] of [['q', q], ['status', selectedStatus]]) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      history.replaceState(history.state, '', url);
    }
  }
  function restore() {
    const params = new URL(location.href).searchParams;
    query.value = (params.get('q') ?? '').slice(0, query.maxLength > 0 ? query.maxLength : 120);
    const value = params.get('status') ?? '';
    status.value = Object.hasOwn(statuses, value) ? value : '';
    apply(false);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    apply();
  });
  query.addEventListener('input', event => {
    clearTimeout(pendingInput);
    if (!event.isComposing) pendingInput = setTimeout(() => apply(), 150);
  });
  query.addEventListener('compositionend', () => {
    clearTimeout(pendingInput);
    pendingInput = setTimeout(() => apply(), 150);
  });
  status.addEventListener('change', () => apply());
  reset.addEventListener('click', () => {
    query.value = '';
    status.value = '';
    apply();
    query.focus();
  });
  window.addEventListener('popstate', restore);
  restore();
  form.hidden = false;
}

const directory = document.querySelector('[data-directory]');
if (directory) void enhanceDirectory(directory);
