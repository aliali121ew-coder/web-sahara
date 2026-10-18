import { describe, expect, it } from 'vitest';
import { DAY_ROADS, NIGHT_ROADS, STATION_ENTRIES } from '../stationRoads';
import { ARRIVE_DWELL, TRACK, buildRoute, buildTrack, poseAt, stepSim, type SimState } from '../tankerTrack';

const SITES = Object.keys(STATION_ENTRIES);
const near = (net: typeof DAY_ROADS, node: string, x: number, y: number, h: number) =>
  Math.hypot(net.nodes[node][0] - x, net.nodes[node][1] * h - y) < 0.01;

describe('tanker routes on the stations map roads', () => {
  for (const [name, net, h] of [['day', DAY_ROADS, 1152 / 1500], ['night', NIGHT_ROADS, 1211 / 1600]] as const) {
    it(`${name}: every pair of stations is connected, entry to entry`, () => {
      for (const a of SITES) for (const b of SITES) {
        if (a === b) continue;
        const r = buildRoute(net, a, b, h);
        expect(r, `${a} → ${b}`).not.toBeNull();
        const first = r![0], last = r![r!.length - 1];
        expect(STATION_ENTRIES[a].some(n => near(net, n, first.x, first.y, h))).toBe(true);
        expect(STATION_ENTRIES[b].some(n => near(net, n, last.x, last.y, h))).toBe(true);
        // لا قفزات: نقاط الشارع متصلة (الساحات نقاطها أقل ويعاد تقسيمها في المسار)
        for (let i = 1; i < r!.length; i++) expect(Math.hypot(r![i].x - r![i - 1].x, r![i].y - r![i - 1].y)).toBeLessThan(r![i].yard ? 9 : 3);
      }
    });
  }

  it('the road from Taqa to Tasmeen goes around the Taqa station, not through the other sites', () => {
    const r = buildRoute(DAY_ROADS, 'الطاقة', 'التسمين', 1152 / 1500)!;
    expect(r.some(p => p.yard)).toBe(false);
    expect(Math.max(...r.map(p => p.x))).toBeGreaterThan(94);
  });

  it('speed profile: starts and ends stopped, never above the limit, slower in sharp bends', () => {
    const t = buildTrack(buildRoute(DAY_ROADS, 'الاجداد', 'الطاقة', 1152 / 1500)!);
    expect(t.v[0]).toBe(0);
    expect(t.v[t.v.length - 1]).toBe(0);
    expect(Math.max(...t.v)).toBeLessThanOrEqual(TRACK.vmax + 1e-6);
    // في الساحة (البياض) لا تتجاوز سرعة الساحة
    t.yard.forEach((y, i) => { if (y) expect(t.v[i]).toBeLessThanOrEqual(TRACK.vyard + 1e-6); });
    // الانطلاق تدريجي
    const i5 = Math.round(1 / t.step);
    expect(t.v[i5]).toBeLessThan(TRACK.vmax * 0.6);
  });

  it('pose stays on the track and heading follows the road', () => {
    const t = buildTrack(buildRoute(NIGHT_ROADS, 'البوادي', 'امهات البياض', 1211 / 1600)!);
    for (let d = 0; d <= t.length; d += t.length / 40) {
      const p = poseAt(t, d);
      let best = Infinity;
      for (let i = 0; i < t.x.length; i++) best = Math.min(best, Math.hypot(p.x - t.x[i], p.y - t.y[i]));
      expect(best).toBeLessThan(0.2);
      expect(Number.isFinite(p.heading)).toBe(true);
    }
    // اتجاه الطريق الأخير نحو أمهات البياض: شرقًا (يمين)
    expect(Math.cos(poseAt(t, t.length - 3).heading)).toBeGreaterThan(0.5);
  });

  it('simulation advances smoothly, arrives, waits, then restarts', () => {
    const t = buildTrack(buildRoute(DAY_ROADS, 'الطاقة', 'البياض', 1152 / 1500)!);
    let st: SimState = { dist: 0, phase: 'moving', dwell: 0, speed: 0 };
    let prev = 0, maxJump = 0, steps = 0;
    while (st.phase === 'moving' && steps < 100000) { st = stepSim(st, t, 1 / 60); maxJump = Math.max(maxJump, st.dist - prev); prev = st.dist; steps++; }
    expect(st.phase).toBe('arrived');
    expect(st.dist).toBe(t.length);
    expect(maxJump).toBeLessThan(TRACK.vmax / 60 + 0.01);
    st = stepSim(st, t, ARRIVE_DWELL + 0.1);
    expect(st.phase).toBe('moving');
    expect(st.dist).toBe(0);
  });
});

describe('staggered departure', () => {
  it('a loading tanker waits at the origin, then drives', () => {
    const t = buildTrack(buildRoute(DAY_ROADS, 'الطاقة', 'البياض', 1152 / 1500)!);
    let st: SimState = { dist: 0, phase: 'loading', dwell: 2, speed: 0 };
    st = stepSim(st, t, 1);
    expect(st).toMatchObject({ phase: 'loading', dist: 0 });
    st = stepSim(st, t, 1.5);
    expect(st.phase).toBe('moving');
    for (let i = 0; i < 60; i++) st = stepSim(st, t, 1 / 60);
    expect(st.dist).toBeGreaterThan(0);
  });
});
