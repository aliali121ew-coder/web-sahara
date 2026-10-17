import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteFarms, type AnnualRecord, type SiteFarmsRecord } from '../../lib/siteFarms';
import { closedMonths } from '../../lib/siteFarmsArchive';
import { listSaharaFiles, notifySaharaFilesChanged, siteMonthPdfName, siteMonthRecord, uploadSaharaFile } from '../../lib/saharaFiles';
import { usePermissions } from '../../lib/usePermission';
import { REPORT_PAGE_CLASS, REPORT_PAGE_STYLE, useMonthReportPages } from './SiteFarmsMonthReport';

/**
 * أرشفة PDF تقرير الشهر تلقائيًا (كل المواقع) بعد انتهاء الشهر، بلا ضغط:
 * يعمل في الخلفية لمن يملك تعديل "الاحتياطي"؛ يرسم صفحات التقرير خارج الشاشة، ويحوّلها PDF، ويرفعها للأرشيف.
 * الشهر يُؤرشف عندما تغطي ملفات المواقع السنوية آخر يوم فيه، أو بعد 7 أيام من انتهائه على أي حال.
 * ملف واحد لكل شهر (الخادم يرفض تكرار الاسم)، فلا يتكرر حتى لو فُتح البرنامج في أكثر من نافذة.
 */

/** أول شهر يُؤرشف تلقائيًا */
const AUTO_FROM = '2026-09';
const GRACE_DAYS = 7;
const doneKey = (ym: string) => `sahara_site_month_pdf_${ym}`;
const isDone = (ym: string) => { try { return localStorage.getItem(doneKey(ym)) === '1'; } catch { return false; } };
const markDone = (ym: string) => { try { localStorage.setItem(doneKey(ym), '1'); } catch { /* تخزين المتصفح غير متاح */ } };

/** هل بيانات الشهر مكتملة: كل ملف سنوي لتلك السنة يغطي آخر يوم من الشهر، أو مضت مهلة بعد انتهائه */
export const monthReady = (records: SiteFarmsRecord[], ym: string, today = new Date()) => {
  const [y, m] = ym.split('-').map(Number);
  const lastIdx = (Date.UTC(y, m, 0) - Date.UTC(y, 0, 1)) / 864e5;
  const covered = records
    .filter((r): r is AnnualRecord => r.kind === 'annual' && r.year === y)
    .every(r => r.f.length > lastIdx);
  const graceOver = today.getTime() >= new Date(y, m, GRACE_DAYS + 1).getTime();
  return covered || graceOver;
};

/** صفحات الشهر خارج الشاشة → PDF (صورة لكل صفحة A4 بالعرض) */
const pagesToPdf = async (root: HTMLElement): Promise<Blob> => {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  await document.fonts?.ready;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pages = Array.from(root.children) as HTMLElement[];
  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    const img = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: '#ffffff' });
    const ratio = el.offsetHeight / el.offsetWidth;
    // الصفحة الأطول من A4 تُصغَّر لتدخل في الورقة وتبقى في المنتصف
    const w = Math.min(297, 210 / ratio), h = w * ratio;
    if (i) pdf.addPage();
    pdf.addImage(img, 'JPEG', (297 - w) / 2, (210 - h) / 2, w, h);
  }
  return pdf.output('blob');
};

const MonthPages: React.FC<{ records: SiteFarmsRecord[]; ym: string; onReady: (root: HTMLElement) => void }> = ({ records, ym, onReady }) => {
  const { t, i18n } = useTranslation('finance');
  const names = t('finance:siteFarms.months', { returnObjects: true }) as unknown;
  const label = Array.isArray(names) ? `${names[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}` : ym;
  const pages = useMonthReportPages(records, ym, null, label);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // بعد رسم الصفحات وتحميل الشعار
    const timer = window.setTimeout(() => { if (ref.current) onReady(ref.current); }, 800);
    return () => window.clearTimeout(timer);
  }, [onReady]);
  return (
    <div ref={ref} aria-hidden className="no-print" dir={i18n.dir()} style={{ position: 'fixed', top: 0, left: -100000, pointerEvents: 'none' }}>
      {pages.map((p, i) => <div key={i} className={REPORT_PAGE_CLASS} style={REPORT_PAGE_STYLE}>{p}</div>)}
    </div>
  );
};

export const SiteFarmsAutoArchive: React.FC = () => {
  const { canEdit } = usePermissions();
  const records = useSiteFarms();
  const allowed = canEdit('sahara.reserves');
  // يزيد بعد كل شهر يُؤرشف فيُعاد حساب الأشهر الباقية
  const [round, setRound] = useState(0);
  // الأشهر المنتهية التي لم تُؤرشف في هذا المتصفح وبياناتها مكتملة
  const candidates = useMemo(
    () => (allowed ? closedMonths(records).filter(ym => ym >= AUTO_FROM && !isDone(ym) && monthReady(records, ym)).reverse() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowed, records, round]
  );
  const [target, setTarget] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!candidates.length || running.current) return;
    running.current = true;
    // بعد استقرار البرنامج: قائمة الأرشيف مرة واحدة، ثم أول شهر ناقص
    const timer = window.setTimeout(async () => {
      try {
        const have = new Set((await listSaharaFiles()).map(f => f.record_id));
        const missing = candidates.filter(ym => {
          if (have.has(siteMonthRecord(ym))) { markDone(ym); return false; }
          return true;
        });
        if (missing.length) setTarget(missing[0]);
        else running.current = false;
      } catch {
        running.current = false;
      }
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [candidates]);

  const onReady = React.useCallback(async (root: HTMLElement) => {
    const ym = target;
    if (!ym) return;
    try {
      const blob = await pagesToPdf(root);
      await uploadSaharaFile(siteMonthRecord(ym), new File([blob], siteMonthPdfName(ym), { type: 'application/pdf' }));
      markDone(ym);
      notifySaharaFilesChanged();
      setRound(n => n + 1);
    } catch (e) {
      // موجود مسبقًا (رفعته نافذة أخرى) = تم؛ غير ذلك يُعاد المحاولة في فتح لاحق
      if (e instanceof Error && /مسبق|already/i.test(e.message)) markDone(ym);
    } finally {
      setTarget(null);
      running.current = false;
    }
  }, [target]);

  return target ? <MonthPages records={records} ym={target} onReady={onReady} /> : null;
};

export default SiteFarmsAutoArchive;
