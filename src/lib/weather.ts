import { useEffect, useState } from 'react';

/** طقس موقع كربلاء من الخادم (/api/weather → WeatherAPI.com أو Open-Meteo، محفوظ 15 دقيقة على الخادم، بلا D1) */
export interface SiteWeather {
  time: string;
  fetchedAt: number;
  temp: number;
  feels: number;
  humidity: number;
  isDay: boolean;
  precipitation: number;
  code: number;
  cloud: number;
  wind: number;
  windDir: number;
  gust: number;
  sunrise: string | null;
  sunset: string | null;
  dust: number | null;
  pm10: number | null;
  source?: 'WeatherAPI' | 'Open-Meteo';
}

const REFRESH_MS = 15 * 60 * 1000;

/** فئة حالة الطقس من رمز WMO */
export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'showers' | 'storm';
export const weatherKind = (code: number): WeatherKind =>
  code === 0 ? 'clear' : code <= 2 ? 'partly' : code === 3 ? 'cloudy' : code <= 48 ? 'fog' : code <= 57 ? 'drizzle'
    : code <= 67 ? 'rain' : code <= 77 ? 'snow' : code <= 82 ? 'showers' : code <= 86 ? 'snow' : 'storm';

/** مستوى الغبار (µg/m³): عادي، غبار، عاصفة ترابية */
export type DustLevel = 'none' | 'dust' | 'storm';
export const dustLevel = (dust: number | null): DustLevel => (dust === null || dust < 60 ? 'none' : dust < 250 ? 'dust' : 'storm');

/** اتجاه الريح (من أين تهب) بالجهات الثماني */
export const windSector = (deg: number) => ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export const useSiteWeather = () => {
  const [weather, setWeather] = useState<SiteWeather | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/weather', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: SiteWeather | null) => { if (alive && d && typeof d.temp === 'number') setWeather(d); })
      .catch(() => undefined);
    void load();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return weather;
};
