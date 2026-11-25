/* eslint-disable i18next/no-literal-string */
import React from 'react';

/**
 * بدل الشاشة البيضاء: أي خطأ في عرض التطبيق أو تشغيله يظهر هنا بنصه، مع زر إعادة التحميل.
 * بلا ترجمات ولا مكونات أخرى حتى يعمل حتى لو تعطل تحميلها.
 */
export const CrashView: React.FC<{ error: unknown }> = ({ error }) => {
  const e = error instanceof Error ? error : new Error(String(error));
  const detail = `${e.name}: ${e.message}\n${(e.stack || '').split('\n').slice(1, 6).join('\n')}`;
  return (
    <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#f1f5f9', fontFamily: 'Cairo, Tahoma, sans-serif' }}>
      <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 10px 40px rgba(15,23,42,.15)', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>حدث خطأ أثناء فتح الصفحة</div>
        <div style={{ fontSize: 14, color: '#475569', marginTop: 6 }}>أعد تحميل الصفحة. إذا تكرر، صوّر هذه الشاشة وأرسلها للدعم.</div>
        <pre dir="ltr" style={{ marginTop: 14, padding: 12, background: '#0f172a', color: '#fecaca', borderRadius: 12, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', textAlign: 'left' }}>{detail}</pre>
        <button type="button" onClick={() => location.reload()} style={{ marginTop: 16, width: '100%', height: 48, borderRadius: 16, border: 0, background: '#2563eb', color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer' }}>
          إعادة تحميل
        </button>
      </div>
    </div>
  );
};

export class CrashBoundary extends React.Component<{ children: React.ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown) { console.error('app crashed', error); }
  render() { return this.state.error ? <CrashView error={this.state.error} /> : this.props.children; }
}
