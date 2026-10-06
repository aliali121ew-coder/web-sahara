import { beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import i18n, { i18nReady } from '../index';
import { fmtNumber, fmtDate } from '../format';
import { enumText } from '../enums';
import { serverText } from '../errors';

const NS = ['common', 'server', 'finance', 'chat', 'deliveries', 'system', 'prices', 'suppliers', 'tanks', 'dashboard', 'settings', 'admin', 'nav', 'auth', 'pages'];
const ARABIC_DIGITS = /[٠-٩۰-۹]/;

beforeAll(async () => {
  await i18nReady;
  await i18n.loadNamespaces(NS);
  await i18n.loadLanguages(['ar', 'en']);
});

describe('تبديل اللغة والاتجاه', () => {
  it('الإنجليزية من اليسار لليمين والعربية من اليمين لليسار', async () => {
    await i18n.changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.dir()).toBe('ltr');
    await i18n.changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('يحفظ الاختيار', async () => {
    await i18n.changeLanguage('en');
    expect(localStorage.getItem('sahara_language')).toBe('en');
  });
});

describe('الجمع', () => {
  it('العربية بصيغها الصحيحة', () => {
    const t = i18n.getFixedT('ar', 'common');
    expect(t('units.days', { count: 2 })).toBe('يومان');
    expect(t('units.days', { count: 3 })).toBe('3 أيام');
    expect(t('units.days', { count: 15 })).toBe('15 يومًا');
    expect(t('units.days', { count: 100 })).toBe('100 يوم');
  });
  it('الإنجليزية', () => {
    const t = i18n.getFixedT('en', 'common');
    expect(t('units.days', { count: 1 })).toBe('1 day');
    expect(t('units.days', { count: 5 })).toBe('5 days');
  });
});

describe('الأرقام والتواريخ غربية في اللغتين', () => {
  it.each(['ar', 'en'])('%s', async lng => {
    await i18n.changeLanguage(lng);
    expect(fmtNumber(1234567.5)).not.toMatch(ARABIC_DIGITS);
    expect(fmtDate(new Date(2026, 9, 5))).not.toMatch(ARABIC_DIGITS);
  });
});

describe('القيم المخزّنة بالعربية', () => {
  it('تُترجم المعروفة وتبقى غير المعروفة كما هي', async () => {
    await i18n.changeLanguage('en');
    expect(enumText('صحاري كربلاء')).toBe('Sahara Karbala');
    expect(enumText('السبت', 'short')).toBe('Sat');
    expect(enumText('محطة يدخلها المستخدم')).toBe('محطة يدخلها المستخدم');
    await i18n.changeLanguage('ar');
    expect(enumText('صحاري كربلاء')).toBe('صحاري كربلاء');
  });
});

describe('رسائل الخادم', () => {
  const data = { error: 'اسم المستخدم مستخدم مسبقًا', code: 'username_taken' };
  it('العربية تعرض نص الخادم', async () => {
    await i18n.changeLanguage('ar');
    expect(serverText(data, 'x')).toBe(data.error);
  });
  it('غيرها يترجم حسب الرمز، وبلا رمز رسالة عامة لا نص عربي', async () => {
    await i18n.changeLanguage('en');
    expect(serverText(data, 'x')).toBe('This username is already taken');
    expect(serverText({ error: 'خطأ غير معروف' }, 'x')).not.toMatch(/[؀-ۿ]/);
    expect(serverText(undefined, 'fallback')).toBe('fallback');
  });
});

describe('كل مفتاح مستخدم في الشيفرة موجود', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?)$/.test(f) && !/backup|\.test\./.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, '..', '..'));
  const keys = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?<![\w.])t\(\s*'([a-z]+:[\w.-]+)'/g)) keys.add(m[1]);
    for (const m of src.matchAll(/i18nKey="([a-z]+:[\w.-]+)"/g)) keys.add(m[1]);
  }
  it.each([...keys].sort())('%s', key => {
    for (const lng of ['ar', 'en']) {
      const exists = i18n.exists(key, { lng }) || i18n.exists(`${key}_one`, { lng }) || i18n.exists(`${key}_other`, { lng });
      expect(exists, `${lng}: ${key}`).toBe(true);
    }
  });
});
