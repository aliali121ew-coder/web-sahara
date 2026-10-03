import { sessionHeaders } from './session';

/** ما يعيده الخادم بعد قراءة صورة الكشف اليومي (انظر worker/extractSaharaReport.ts) */
export interface SaharaReportExtraction {
  generators: number;
  vehicles: number;
  farms: number;
  sentToFarms: number;
  inboundInternal: number;
  inboundEtihad: number;
  inboundExternal: number;
  /** "المدوّر السابق" = مجموع الرصيد السابق لكل المواقع (من ملف Excel/PDF فقط) */
  previousCarried?: number;
  /** "الرصيد الحالي" كما في الكشف، للتحقق من الحساب */
  currentInFile?: number;
  /** آخر خلية في عمود "الرصيد التراكمي" (إجمالي الجدول) — تُنقل كما هي إلى الرصيد الحالي */
  tableTotal?: number;
  stations: { nameInImage: string; matchedStation: string | null; balance: number }[];
  notes: string;
}

/** تصغير الصورة قبل الرفع (أطول ضلع 2000px، JPEG) لتسريع الإرسال والبقاء ضمن حد الحجم */
const toJpegBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 2000;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('تعذّر تجهيز الصورة')); return; }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('الملف ليس صورة صالحة')); };
    img.src = url;
  });

export const extractSaharaReportImage = async (file: File, stationNames: string[]): Promise<SaharaReportExtraction> => {
  const image = await toJpegBase64(file);
  let res: Response;
  try {
    res = await fetch('/api/extract-sahara-report', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...sessionHeaders() },
      body: JSON.stringify({ image, mediaType: 'image/jpeg', stations: stationNames })
    });
  } catch {
    throw new Error('لا يوجد اتصال بالخادم');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'تعذّر تحليل الصورة');
  return data.result as SaharaReportExtraction;
};
