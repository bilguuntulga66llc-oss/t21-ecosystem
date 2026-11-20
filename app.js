import { search, publicEntry, statuses } from './discovery.mjs';

// Directory search. Reads the public catalog; the static list remains
// usable if the catalog cannot be loaded.
async function enhanceDirectory(root) {
  const form = root.querySelector('[data-search]');
  // Search controls are rendered only for larger catalogs.
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
    note.textContent = 'Хайлт ачаалагдсангүй. Төслийг жагсаалтаас сонгоно уу.';
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
    count.textContent = `${visible} төсөл`;
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

// Documentation search. Reads /docs/search.json; the sidebar stays the way to
// every page when the index cannot be loaded.
async function enhanceDocsSearch(form) {
  const input = form.elements.namedItem('q');
  const list = form.querySelector('[data-results]');
  const status = form.querySelector('[data-search-status]');
  const base = new URL('.', import.meta.url);
  let index;
  try {
    const response = await fetch(new URL('./docs/search.json', import.meta.url), { credentials: 'omit', redirect: 'error' });
    if (!response.ok) throw new Error('index unavailable');
    index = await response.json();
    if (!Array.isArray(index)) throw new Error('invalid index');
  } catch {
    return;
  }
  const fold = (text) => String(text).toLocaleLowerCase('mn');
  const entries = index.map((entry) => ({
    ...entry,
    titleKey: fold(entry.title),
    headingKey: fold(entry.headings.join(' ')),
    textKey: fold(entry.text),
  }));
  function render() {
    const words = fold(input.value.trim().slice(0, 80)).split(/\s+/).filter(Boolean);
    list.replaceChildren();
    if (!words.length) {
      list.hidden = true;
      status.textContent = '';
      return;
    }
    const phrase = words.join(' ');
    const scored = [];
    for (const entry of entries) {
      let score = entry.titleKey.includes(phrase) ? 6 : entry.headingKey.includes(phrase) ? 4 : entry.textKey.includes(phrase) ? 2 : 0;
      for (const word of words) {
        if (entry.titleKey.includes(word)) score += 3;
        else if (entry.headingKey.includes(word)) score += 2;
        else if (entry.textKey.includes(word)) score += 1;
        else { score = -1; break; }
      }
      if (score > 0) scored.push([score, entry]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    for (const [, entry] of scored.slice(0, 5)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = new URL(entry.path.slice(1), base).pathname;
      link.textContent = entry.title;
      const section = document.createElement('span');
      section.textContent = entry.section;
      link.append(section);
      item.append(link);
      list.append(item);
    }
    list.hidden = false;
    status.textContent = scored.length ? `${Math.min(scored.length, 5)} үр дүн` : 'Илэрц олдсонгүй';
    if (!scored.length) {
      const item = document.createElement('li');
      item.className = 'docs-results-empty';
      item.textContent = 'Илэрц олдсонгүй';
      list.append(item);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    list.querySelector('a')?.click();
  });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      render();
    }
  });
  form.hidden = false;
}

const docsSearch = document.querySelector('[data-docs-search]');
if (docsSearch) void enhanceDocsSearch(docsSearch);

const directory = document.querySelector('[data-directory]');
if (directory) void enhanceDirectory(directory);
