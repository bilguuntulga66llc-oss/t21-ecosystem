// Public listing model: field validation, categories, statuses and search.
export const categories = Object.freeze({ market: 'Зах зээлийн мэдээлэл', research: 'Компанийн судалгаа' });
export const statuses = Object.freeze({ live: 'Нээлтээ хийсэн', concept: 'Тун удахгүй' });
// Illustrations a listing may reference explicitly.
export const illustrations = Object.freeze(['ownership-chain']);
// Verified technical relation of a listing to T21; only for available products.
export const relations = Object.freeze({ api: 'T21 API-г ашиглаж буй' });
const normalize = value => value.normalize('NFC').toLocaleLowerCase('mn').trim();
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${field}: required text, max ${max}`);
  return value.trim();
};
export function publicEntry(source) {
  const id = text(source.id, 'id', 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('id: invalid slug');
  if (!Object.hasOwn(categories, source.category)) throw new Error('category: invalid');
  if (!Object.hasOwn(statuses, source.status)) throw new Error('status: invalid');
  const entry = { id, name: text(source.name, 'name', 100), summary: text(source.summary, 'summary', 300), description: text(source.description, 'description', 1600), category: source.category, status: source.status };
  if (source.status === 'live') {
    let url;
    try { url = new URL(source.href); } catch { throw new Error('destination: invalid'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('destination: HTTPS without credentials required');
    entry.href = url.href;
    entry.domain = url.hostname;
  } else if (source.href !== undefined) throw new Error('concept: no outbound destination');
  if (source.t21Relation !== undefined) {
    if (!Object.hasOwn(relations, source.t21Relation)) throw new Error('relation: unknown');
    if (source.status !== 'live') throw new Error('relation: only for available products');
    entry.t21Relation = source.t21Relation;
  }
  if (source.illustration !== undefined) {
    if (!illustrations.includes(source.illustration)) throw new Error('illustration: unknown');
    entry.illustration = source.illustration;
  }
  if (source.sections !== undefined) {
    if (!Array.isArray(source.sections) || source.sections.length > 20) throw new Error('sections: invalid');
    entry.sections = Object.freeze(source.sections.map(s => text(s, 'sections', 100)));
  }
  return Object.freeze(entry);
}
export function search(entries, { q = '', category = '', status = '' } = {}) {
  const terms = normalize(String(q)).split(/\s+/u).filter(Boolean);
  return entries.filter(item => (!category || item.category === category) && (!status || item.status === status) && terms.every(term => normalize([item.name, item.summary, item.description, item.domain ?? '', ...(item.sections ?? [])].join(' ')).includes(term)));
}
