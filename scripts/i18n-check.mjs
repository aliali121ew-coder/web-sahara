// فحص الترجمات قبل البناء: كل مفتاح موجود في العربية والإنجليزية، بلا قيم فارغة،
// ونفس متغيرات {{...}} في اللغتين، وصيغ الجمع كاملة (العربية 6 صيغ، الإنجليزية one/other).
// أي خلل يُفشل البناء.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/i18n/locales/', import.meta.url);
const LANGS = ['ar', 'en'];
const PLURALS = { ar: ['zero', 'one', 'two', 'few', 'many', 'other'], en: ['one', 'other'] };
const PLURAL_RE = /_(zero|one|two|few|many|other)$/;

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};
const vars = s => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).filter(v => v !== 'count').sort().join(',');

const errors = [];
const namespaces = new Set(LANGS.flatMap(l => readdirSync(new URL(`${l}/`, ROOT)).filter(f => f.endsWith('.json'))));

for (const file of namespaces) {
  const data = {};
  for (const lang of LANGS) {
    try {
      data[lang] = flatten(JSON.parse(readFileSync(new URL(`${lang}/${file}`, ROOT), 'utf8')));
    } catch (e) {
      errors.push(`${lang}/${file}: ${e.code === 'ENOENT' ? 'الملف غير موجود' : e.message}`);
      data[lang] = {};
    }
  }
  const base = l => new Set(Object.keys(data[l]).map(k => k.replace(PLURAL_RE, '')));
  const all = new Set([...base('ar'), ...base('en')]);
  for (const key of all) {
    for (const lang of LANGS) {
      const keys = Object.keys(data[lang]);
      const plural = keys.filter(k => k.replace(PLURAL_RE, '') === key && PLURAL_RE.test(k));
      if (plural.length) {
        // كل صيغ اللغة مطلوبة (العربية الست كاملة) لضمان صحة الجمع في كل الأعداد
        const missing = PLURALS[lang].filter(f => !(`${key}_${f}` in data[lang]));
        if (missing.length) errors.push(`${lang}/${file} ${key}: صيغ جمع ناقصة (${missing.join(', ')})`);
      } else if (!(key in data[lang])) {
        errors.push(`${lang}/${file} ${key}: مفتاح ناقص`);
      }
    }
  }
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(data[lang])) {
      if (typeof v !== 'string' || !v.trim()) errors.push(`${lang}/${file} ${k}: قيمة فارغة`);
    }
  }
  for (const [k, v] of Object.entries(data.ar)) {
    if (PLURAL_RE.test(k)) continue;
    if (k in data.en && vars(v) !== vars(data.en[k])) errors.push(`${file} ${k}: متغيرات مختلفة بين اللغتين`);
  }
}

if (errors.length) {
  console.error(`✗ i18n-check: ${errors.length} خطأ\n` + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ i18n-check: ${namespaces.size} ملفات ترجمة متطابقة في ${LANGS.join(' و ')}`);
