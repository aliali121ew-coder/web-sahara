import { beforeEach, describe, expect, it } from 'vitest';
import { farmsDates, farmsOn, readSiteFarms, saveFarmsDay } from '../siteFarms';
import { backfillFarmsFromArchive, pendingArchiveFiles, type BackfillDeps } from '../siteFarmsBackfill';
import type { SaharaFile } from '../saharaFiles';

const file = (id: string, record_id: string, name = `${id}.pdf`): SaharaFile => ({ id, record_id, name, type: 'application/pdf', size: 1, created_at: 1 });
const row = (name: string, consumption: number) => ({ name, previous: 1000, inbound: 0, consumption, balance: 1000 - consumption });

describe('تحليل ملفات أرشيف كشف رصيد الصحاري لمزارع المواقع', () => {
  beforeEach(() => localStorage.clear());

  const deps = (files: SaharaFile[], reads: Record<string, ReturnType<BackfillDeps['read']>>, fetched: string[] = []): BackfillDeps => ({
    list: async () => files,
    fetchFile: async f => { fetched.push(f.id); if (f.id === 'offline') throw new TypeError('network'); return new File(['x'], f.id); },
    read: f => reads[f.name] ?? Promise.reject(new Error('not a report')),
    recordDates: () => new Map([['sah-1', '2026/10/12'], ['sah-2', '2026/10/13'], ['sah-3', '2026/10/14']]),
  });

  it('يحفظ مزارع كل موقع ليوم الأرشيف، ويتخطى الأيام المحفوظة والملفات غير الكشوف والملفات الأخرى', async () => {
    saveFarmsDay('التسمين', '2026/10/14', [row('تسمين مزرعة 1', 5)]);
    const files = [file('a', 'sah-1'), file('b', 'sah-2'), file('c', 'sah-3'), file('pet', 'pet-1'), file('img', 'sah-1', 'x.png')];
    const fetched: string[] = [];
    const d = deps(files, {
      a: Promise.resolve({ date: '2026/10/12', sites: { التسمين: [row('تسمين مزرعة 1', 100)], البوادي: [row('مزرعة الذكور', 40)] } }),
    }, fetched);
    expect((await pendingArchiveFiles(d)).map(f => f.id)).toEqual(['a', 'b']);
    const res = await backfillFarmsFromArchive(undefined, d);
    expect(res).toEqual({ done: 2, total: 2, days: 1 });
    expect(fetched).toEqual(['a', 'b']);
    const recs = readSiteFarms();
    expect(farmsDates(recs, 'التسمين')).toEqual(['2026/10/12', '2026/10/14']);
    expect(farmsOn(recs, 'البوادي', '2026/10/12')[0].consumption).toBe(40);
    // لا يُعاد تحليل ما حُلّل (ولا الملف الذي ليس كشفًا)
    expect(await pendingArchiveFiles(d)).toEqual([]);
  });

  it('تعذّر التنزيل لا يُسجَّل كمحلَّل فيُعاد لاحقًا، وبلا تاريخ أرشيف يُؤخذ تاريخ الملف', async () => {
    const files = [file('offline', 'sah-9'), file('z', 'sah-8')];
    const d = deps(files, { z: Promise.resolve({ date: '2026/09/30', sites: { التسمين: [row('تسمين مزرعة 2', 70)] } }) });
    await backfillFarmsFromArchive(undefined, d);
    expect(farmsDates(readSiteFarms(), 'التسمين')).toEqual(['2026/09/30']);
    expect((await pendingArchiveFiles(d)).map(f => f.id)).toEqual(['offline']);
  });
});
