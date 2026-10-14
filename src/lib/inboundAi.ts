import i18n from '../i18n';
import { serverText } from '../i18n/errors';
import { sessionHeaders } from './session';
import type { InboundImportRow } from './inboundImport';

/** الحد الأعلى لحجم ملف PDF المُرسل للقراءة الذكية (الخادم يقبل حتى 14MB بعد base64) */
export const AI_PDF_MAX_BYTES = 10 * 1024 * 1024;

const toBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * القراءة الذكية لأسماء كشف الوارد (worker/inboundNames.ts): يُرسل الملف والصفوف المستخرجة،
 * ويعود بنفس الصفوف بعد تصحيح الخانات النصية فقط (الأرقام والتواريخ لا تُلمس). يعيد أيضًا عدد الخانات التي تغيّرت.
 */
export const fixInboundNamesWithAi = async (file: File, rows: InboundImportRow[]): Promise<{ rows: InboundImportRow[]; changed: number }> => {
  if (file.size > AI_PDF_MAX_BYTES) throw new Error(i18n.t('deliveries:quick.aiTooLarge'));
  const pdf = await toBase64(file);
  let res: Response;
  try {
    res = await fetch('/api/inbound-names', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...sessionHeaders() },
      body: JSON.stringify({ pdf, rows: rows.map(r => ({ supplierName: r.supplierName, supplierCompany: r.supplierCompany, driverName: r.driverName, truckNumber: r.truckNumber, voucherNumber: r.voucherNumber, receivedQuantity: r.receivedQuantity })) })
    });
  } catch {
    throw new Error(i18n.t('server:errors.network'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(serverText(data, i18n.t('server:errors.analyze_failed')));
  const fixes = new Map<number, Partial<InboundImportRow>>((data.rows as ({ i: number } & Partial<InboundImportRow>)[]).map(f => [f.i, f]));
  let changed = 0;
  const fields = ['supplierName', 'supplierCompany', 'driverName', 'truckNumber'] as const;
  const out = rows.map((r, i) => {
    const f = fixes.get(i);
    if (!f) return r;
    const next = { ...r };
    for (const k of fields) {
      const v = typeof f[k] === 'string' ? f[k]!.trim() : r[k];
      if (v !== r[k]) { next[k] = v; changed++; }
    }
    return next;
  });
  return { rows: out, changed };
};
