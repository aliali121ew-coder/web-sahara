// فحص الترجمة فقط: يمنع كتابة نص عربي مباشرة في JSX (يجب أن يمر عبر t() من i18next).
// القيم المخزّنة بالعربية والمقارنات خارج JSX مسموحة؛ النص غير العربي (أرقام، PDF، A4...) لا يُفحص.
import tseslint from 'typescript-eslint';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // النسخ الاحتياطية القديمة ومكوّنات غير مستخدمة (لا يستوردها أي ملف) خارج الفحص
  { ignores: ['dist/**', 'node_modules/**', '**/*backup.tsx', 'src/components/dashboard/ConsumptionChart.tsx', 'src/components/supply/SupplyOrders.tsx'] },
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    files: ['src/**/*.tsx'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    // react-hooks مسجّل فقط لأن الشيفرة تحوي تعليقات تعطيل لقاعدته
    plugins: { i18next, 'react-hooks': reactHooks },
    rules: {
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-only',
        'jsx-attributes': { include: ['title', 'placeholder', 'alt', 'aria-label', 'label'] },
        words: { exclude: ['^[^\\u0600-\\u06FF]*$'] },
        // قيم البيانات المخزّنة بالعربية تُمرَّر لـ enumText لتُترجم عند العرض
        callees: { exclude: ['enumText', 'split', 'join', 'includes', 'startsWith', 'test', 'replace', 'i18n(ext)?', 't', 'require', 'addEventListener', 'removeEventListener', 'postMessage', 'getElementById', 'dispatch', 'querySelector', 'querySelectorAll', 'createElement', 'setAttribute'] },
      }],
    },
  },
];
