import { describe, expect, it } from 'vitest';
import { DAY_ROADS, STATION_ENTRIES } from '../stationRoads';
import { Y_SCALE } from '../stationsLayout';
import { TRACK, buildRoute, buildTrack, distAtTime, planTrip, poseAt, timeTrack, tripAt } from '../tankerTrack';

const SITES = Object.keys(STATION_ENTRIES);
const DAY_H = Y_SCALE;
const at = (p: [number, number], h: number) => ({ x: p[0], y: p[1] * h });

describe('tanker routes on the stations map roads', () => {
  for (const [name, net, h] of [['scene', DAY_ROADS, DAY_H]] as const) {
    it(`${name}: every pair of stations is connected, from the source tank to the destination tank`, () => {
      for (const a of SITES) for (const b of SITES) {
        if (a === b) continue;
        const r = buildRoute(net, a, b, h);
        expect(r, `${a} → ${b}`).not.toBeNull();
        const first = r![0], last = r![r!.length - 1];
        const pa = at(net.yards[a].park, h), pb = at(net.yards[b].park, h);
        expect(Math.hypot(first.x - pa.x, first.y - pa.y)).toBeLessThan(0.01);
        expect(Math.hypot(last.x - pb.x, last.y - pb.y)).toBeLessThan(0.01);
        // يبدأ وينتهي داخل ساحة المحطة (بطيئًا)
        expect(first.yard && last.yard).toBe(true);
        for (let i = 1; i < r!.length; i++) expect(Math.hypot(r![i].x - r![i - 1].x, r![i].y - r![i - 1].y)).toBeLessThan(r![i].yard || r![i - 1].yard ? 13 : 3);
      }
    });
  }

  it('the road from Taqa to Tasmeen goes around the Taqa station on the road', () => {
    const r = buildRoute(DAY_ROADS, 'الطاقة', 'التسمين', DAY_H)!;
    expect(Math.max(...r.map(p => p.x))).toBeGreaterThan(94);
  });

  it('speed profile: starts and ends stopped, never above the limit, slow in the station yards', () => {
    const t = buildTrack(buildRoute(DAY_ROADS, 'الاجداد', 'الطاقة', DAY_H)!);
    expect(t.v[0]).toBe(0);
    expect(t.v[t.v.length - 1]).toBe(0);
    expect(Math.max(...t.v)).toBeLessThanOrEqual(TRACK.vmax + 1e-6);
    t.yard.forEach((y, i) => { if (y) expect(t.v[i]).toBeLessThanOrEqual(TRACK.vyard + 1e-6); });
  });

  it('pose stays on the track and heading follows the road', () => {
    const t = buildTrack(buildRoute(DAY_ROADS, 'البوادي', 'امهات البياض', DAY_H)!);
    for (let d = 0; d <= t.length; d += t.length / 40) {
      const p = poseAt(t, d);
      let best = Infinity;
      for (let i = 0; i < t.x.length; i++) best = Math.min(best, Math.hypot(p.x - t.x[i], p.y - t.y[i]));
      expect(best).toBeLessThan(0.2);
      expect(Number.isFinite(p.heading)).toBe(true);
    }
  });
});

describe('real-time trip schedule (no GPS: estimated from approval and arrival time)', () => {
  it('distance over time is monotonic, starts at the tank and ends at the destination tank', () => {
    const t = buildTrack(buildRoute(DAY_ROADS, 'الطاقة', 'البياض', DAY_H)!);
    const tc = timeTrack(t), T = tc[tc.length - 1];
    let prev = -1;
    for (let k = 0; k <= 100; k++) { const d = distAtTime(t, tc, (k / 100) * T); expect(d).toBeGreaterThanOrEqual(prev); prev = d; }
    expect(distAtTime(t, tc, 0)).toBe(0);
    expect(distAtTime(t, tc, T + 5)).toBe(t.length);
  });

  it('a convoy leaves in turn and unloads one after another at the fill point, then waits for receipt', () => {
    const t0 = Date.UTC(2026, 9, 19, 9, 0);
    const p0 = planTrip(t0, 90, 25000, 0), p1 = planTrip(t0, 90, 25000, 1);
    expect(tripAt(p0, t0 + 1000).phase).toBe('driving');
    expect(tripAt(p1, t0 + 1000).phase).toBe('waiting');
    const mid = tripAt(p0, t0 + 45 * 60000);
    expect(mid.phase).toBe('driving');
    expect(mid.drive).toBeCloseTo(0.5, 5);
    expect(mid.msLeft).toBe(45 * 60000);
    const unl = tripAt(p0, t0 + 90 * 60000 + 10 * 60000);
    expect(unl.phase).toBe('unloading');
    expect(unl.unload).toBeCloseTo(10 / 25, 5);
    // الثاني يصل بعد دقيقتين وينتظر حتى ينتهي الأول (25 دقيقة تفريغ)
    expect(tripAt(p1, t0 + 93 * 60000).phase).toBe('queued');
    expect(tripAt(p1, t0 + (90 + 25) * 60000 + 1000).phase).toBe('unloading');
    expect(tripAt(p0, t0 + (90 + 25) * 60000 + 1000).phase).toBe('unloaded');
    expect(tripAt(p0, t0 + 200 * 60000)).toMatchObject({ phase: 'unloaded', drive: 1, unload: 1 });
  });
});
