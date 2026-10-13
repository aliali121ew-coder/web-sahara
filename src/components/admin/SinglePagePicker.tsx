import React from 'react';
import { PanelLeftClose } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SINGLE_PAGE_TABS } from '../../lib/permCatalog';

/** مفتاح تسمية كل صفحة (ملف nav.json) */
const LABEL_KEY: Record<(typeof SINGLE_PAGE_TABS)[number], string> = {
  dashboard: 'nav:items.dashboard',
  tanks: 'nav:items.tanks',
  prices: 'nav:items.prices',
  suppliers: 'nav:items.suppliers',
  'deliveries-sahara': 'admin:perm.sections.deliveries-sahara',
  'deliveries-etihad': 'admin:perm.sections.deliveries-etihad',
  'finance-etihad': 'nav:items.financeEtihad',
  'finance-sahara': 'nav:items.financeSahara',
  chat: 'nav:items.chat',
  settings: 'nav:items.settings',
};

/**
 * «صفحة واحدة فقط»: يختار مدير النظام صفحة وحيدة للحساب، فتختفي عنه القائمة الجانبية ولا يتنقل لغيرها.
 * الصلاحيات تبقى كما هي (يلزم أن يملك عرض الصفحة المختارة على الأقل).
 */
export const SinglePagePicker: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation(['admin', 'nav']);
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-2 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <PanelLeftClose className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-extrabold text-slate-900 dark:text-white">{t('admin:singlePage.title')}</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
        {disabled ? t('admin:singlePage.adminNote') : t('admin:singlePage.hint')}
      </p>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        <option value="">{t('admin:singlePage.none')}</option>
        {SINGLE_PAGE_TABS.map(id => (
          <option key={id} value={id}>{t(LABEL_KEY[id])}</option>
        ))}
      </select>
    </div>
  );
};
