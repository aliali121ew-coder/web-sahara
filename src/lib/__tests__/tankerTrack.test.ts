import { describe, expect, it } from 'vitest';
import { HOSE_TIP_M, M, NET, SITE_NAMES, SITE_PLANS, depotLayout, padToGround, parkLocal, STATION_OFFSET_Z } from '../stationNetwork';
import { CONVOY_GAP_S, TRACK, buildRoute, buildTrack, distAtTime, planTrip, poseAt, timeTrack, tripAt } from '../tankerTrack';

const dist = (a: { x: number; y: number }, b: [number, number]) => Math.hypot(a.x - b[0], a.y - b[1]);

describe('station road network (the management drawing)', () => {
  it('every pair of stations is connected, from the source depot to the destination depot', () => {
    for (const a of SITE_NAMES) for (const b of SITE_NAMES) {
      if (a === b) continue;
      const r = buildRoute(NET, a, b, 1);
      expect(r, `${a} → ${b}`).not.toBeNull();
      expect(dist(r![0], NET.yards[a].park)).toBeLessThan(0.01);
      expect(dist(r![r!.length - 1], NET.yards[b].park)).toBeLessThan(0.01);
      for (let i = 1; i < r!.length; i++) expect(Math.hypot(r![i].x - r![i - 1].x, r![i].y - r![i - 1].y)).toBeLessThan(r![i].yard || r![i - 1].yard ? 30 : 1.5);
    }
  });

  it('a tanker never drives through another station: only the yards of its source and destination', () => {
    // نقاط الساحات (yard) في المسار تقع داخل ساحتي الطرفين فقط
    const inside = (p: { x: number; y: number }, site: string) => {
      const s = SITE_PLANS[site];
      const dx = p.x * 10 - s.x, dz = p.y * 10 - s.z;
      const c = Math.cos(-s.angle), sn = Math.sin(-s.angle);
      const lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
      return Math.abs(lx) <= s.w / 2 + 1 && Math.abs(lz) <= s.d / 2 + 1;
    };
    const r = buildRoute(NET, 'الطاقة', 'الاجداد', 1)!;
    for (const p of r) {
      const hits = SITE_NAMES.filter(s => inside(p, s));
      hits.forEach(h => expect(['الطاقة', 'الاجداد']).toContain(h));
    }
  });

  it('no road crosses a station forecourt except its own entrance spur, and forecourts do not overlap', () => {
    const local = (x: number, y: number, site: string) => {
      const s = SITE_PLANS[site];
      const dx = x * 10 - s.x, dz = y * 10 - s.z, c = Math.cos(-s.angle), sn = Math.sin(-s.angle);
      return [dx * c + dz * sn, -dx * sn + dz * c];
    };
    for (const site of SITE_NAMES) {
      const s = SITE_PLANS[site], node = NET.entries[site][0];
      NET.edges.forEach(e => {
        if (e.a === node || e.b === node) return;
        e.pts.forEach(([x, y]) => {
          const [lx, lz] = local(x, y, site);
          expect(Math.abs(lx) > s.w / 2 + 32 || Math.abs(lz) > s.d / 2 + 32, `${site} × ${e.a}-${e.b}`).toBe(true);
        });
      });
      for (const other of SITE_NAMES) if (other !== site) {
        const o = SITE_PLANS[other];
        expect(Math.hypot(o.x - s.x, o.z - s.z)).toBeGreaterThan((Math.hypot(s.w, s.d) + Math.hypot(o.w, o.d)) / 2);
      }
    }
  });

  it('the parked tanker hose reaches the depot coupling', () => {
    for (const site of SITE_NAMES) {
      const s = SITE_PLANS[site], L = depotLayout(s.depot);
      const [px, pz] = parkLocal(s);
      // مركز الصهريج + طرف الخرطوم (للأمام وللجانب حسب الاتجاه) = الوصلة
      const fwd = s.hand === 1 ? 1 : -1;
      const tipX = px + fwd * HOSE_TIP_M.x * M, tipZ = pz - HOSE_TIP_M.z * M;
      expect(Math.abs(tipX - L.fx)).toBeLessThan(0.01);
      expect(Math.abs(tipZ - (L.fz + STATION_OFFSET_Z))).toBeLessThan(0.01);
      expect(padToGround(s, px, pz)).toEqual(NET.yards[site].park);
    }
  });

  it('speed profile: starts and ends stopped, never above the limit, slow in the station yards', () => {
    const t = buildTrack(buildRoute(NET, 'الاجداد', 'الطاقة', 1)!);
    expect(t.v[0]).toBe(0);
    expect(t.v[t.v.length - 1]).toBe(0);
    expect(Math.max(...t.v)).toBeLessThanOrEqual(TRACK.vmax + 1e-6);
    t.yard.forEach((y, i) => { if (y) expect(t.v[i]).toBeLessThanOrEqual(TRACK.vyard + 1e-6); });
  });

  it('pose stays on the track', () => {
    const t = buildTrack(buildRoute(NET, 'البوادي', 'امهات البياض', 1)!);
    for (let d = 0; d <= t.length; d += t.length / 40) {
      const p = poseAt(t, d);
      let best = Infinity;
      for (let i = 0; i < t.x.length; i++) best = Math.min(best, Math.hypot(p.x - t.x[i], p.y - t.y[i]));
      expect(best).toBeLessThan(0.4);
    }
  });
});

describe('real-time trip schedule (no GPS: estimated from approval and arrival time)', () => {
  it('distance over time is monotonic from depot to depot', () => {
    const t = buildTrack(buildRoute(NET, 'الطاقة', 'البياض', 1)!);
    const tc = timeTrack(t), T = tc[tc.length - 1];
    let prev = -1;
    for (let k = 0; k <= 100; k++) { const d = distAtTime(t, tc, (k / 100) * T); expect(d).toBeGreaterThanOrEqual(prev); prev = d; }
    expect(distAtTime(t, tc, T + 5)).toBe(t.length);
  });

  it('a convoy leaves 3 seconds apart and unloads one after another, then waits for receipt', () => {
    const t0 = Date.UTC(2026, 9, 20, 9, 0);
    const p0 = planTrip(t0, 90, 25000, 0), p1 = planTrip(t0, 90, 25000, 1);
    expect(p1.start - p0.start).toBe(CONVOY_GAP_S * 1000);
    expect(tripAt(p1, t0 + 1000).phase).toBe('waiting');
    expect(tripAt(p1, t0 + 3500).phase).toBe('driving');
    expect(tripAt(p0, t0 + 45 * 60000).drive).toBeCloseTo(0.5, 5);
    const unl = tripAt(p0, t0 + 100 * 60000);
    expect(unl.phase).toBe('unloading');
    expect(unl.unload).toBeCloseTo(10 / 25, 5);
    expect(tripAt(p1, t0 + 93 * 60000).phase).toBe('queued');
    expect(tripAt(p1, t0 + (90 + 25) * 60000 + 4000).phase).toBe('unloading');
    expect(tripAt(p0, t0 + 200 * 60000)).toMatchObject({ phase: 'unloaded', drive: 1, unload: 1 });
  });
});
