/**
 * طقس موقع كربلاء لخريطة "مزارع الموقع": يُجلب من WeatherAPI.com إن وُجد مفتاحه (وإلا Open-Meteo)، والغبار من جودة الهواء في Open-Meteo
 * ويُحفظ 15 دقيقة في ذاكرة الخادم وذاكرة Cloudflare المؤقتة — بلا أي قراءة أو كتابة في D1.
 * المسار بلا جلسة عمدًا (التحقق من الجلسة يقرأ D1): إحداثيات ثابتة وبيانات عامة لا تخص الشركة.
 */

/** موقع الشركة في كربلاء (32°18'43.46"N 44°02'00.59"E) */
const LAT = 32.312072;
const LON = 44.033497;
const TTL_MS = 15 * 60 * 1000;
const CACHE_KEY = 'https://weather.cache.internal/karbala-v3';

export interface SiteWeather {
  /** وقت القراءة في Open-Meteo (توقيت بغداد) */
  time: string;
  /** وقت جلبها من الخادم (ms) */
  fetchedAt: number;
  temp: number;
  feels: number;
  humidity: number;
  isDay: boolean;
  precipitation: number;
  /** رمز حالة الطقس (WMO) */
  code: number;
  cloud: number;
  /** كم/ساعة */
  wind: number;
  /** اتجاه الهبوب (من أين تأتي الريح، درجات من الشمال باتجاه عقارب الساعة) */
  windDir: number;
  gust: number;
  sunrise: string | null;
  sunset: string | null;
  /** الغبار µg/m³ (null إن تعذّر) */
  dust: number | null;
  pm10: number | null;
  /** مصدر قراءة الطقس */
  source: 'WeatherAPI' | 'Open-Meteo';
}

let memory: { at: number; data: SiteWeather } | null = null;

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

const fetchFresh = async (apiKey?: string): Promise<SiteWeather> => {
  // مفتاح الاشتراك التجاري (اختياري): نفس الخدمة على عنوان العملاء
  const base = apiKey ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
  const aqBase = apiKey ? 'https://customer-air-quality-api.open-meteo.com' : 'https://air-quality-api.open-meteo.com';
  const key = apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : '';
  const wUrl = `${base}/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=Asia%2FBaghdad&forecast_days=1`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    + `&daily=sunrise,sunset${key}`;
  const aUrl = `${aqBase}/v1/air-quality?latitude=${LAT}&longitude=${LON}&timezone=Asia%2FBaghdad&current=dust,pm10${key}`;
  const [w, a] = await Promise.all([
    fetch(wUrl).then(r => (r.ok ? r.json() : Promise.reject(new Error(`weather ${r.status}`)))),
    fetch(aUrl).then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]) as [{ current?: Record<string, unknown>; daily?: { sunrise?: string[]; sunset?: string[] } }, { current?: Record<string, unknown> } | null];
  const c = w.current ?? {};
  const aq = a?.current ?? {};
  return {
    time: typeof c.time === 'string' ? c.time : '',
    fetchedAt: Date.now(),
    temp: num(c.temperature_2m),
    feels: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    isDay: num(c.is_day, 1) === 1,
    precipitation: num(c.precipitation),
    code: num(c.weather_code),
    cloud: num(c.cloud_cover),
    wind: num(c.wind_speed_10m),
    windDir: num(c.wind_direction_10m),
    gust: num(c.wind_gusts_10m),
    sunrise: w.daily?.sunrise?.[0] ?? null,
    sunset: w.daily?.sunset?.[0] ?? null,
    dust: typeof aq.dust === 'number' ? aq.dust : null,
    pm10: typeof aq.pm10 === 'number' ? aq.pm10 : null,
    source: 'Open-Meteo',
  };
};

/** رموز حالة WeatherAPI.com → رموز WMO (التي تفهمها الواجهة) */
const WAPI_TO_WMO: Record<number, number> = {
  1000: 0, 1003: 2, 1006: 3, 1009: 3, 1030: 45, 1135: 45, 1147: 48,
  1063: 61, 1066: 71, 1069: 66, 1072: 56, 1087: 95, 1114: 75, 1117: 75,
  1150: 51, 1153: 53, 1168: 56, 1171: 57, 1180: 61, 1183: 61, 1186: 63, 1189: 63, 1192: 65, 1195: 65,
  1198: 66, 1201: 67, 1204: 66, 1207: 67, 1210: 71, 1213: 71, 1216: 73, 1219: 73, 1222: 75, 1225: 75,
  1237: 77, 1240: 80, 1243: 81, 1246: 82, 1249: 85, 1252: 86, 1255: 85, 1258: 86, 1261: 77, 1264: 77,
  1273: 95, 1276: 95, 1279: 96, 1282: 99,
};

/** "05:58 AM" → "YYYY-MM-DDT05:58" (نفس شكل Open-Meteo) */
const astroTime = (date: string, t: unknown): string | null => {
  const m = typeof t === 'string' ? /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim()) : null;
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${date}T${String(h).padStart(2, '0')}:${m[2]}`;
};

/** WeatherAPI.com للطقس، والغبار من جودة الهواء في Open-Meteo (WeatherAPI لا يعطي الغبار) */
const fetchWeatherApi = async (key: string, meteoKey?: string): Promise<SiteWeather> => {
  const aqBase = meteoKey ? 'https://customer-air-quality-api.open-meteo.com' : 'https://air-quality-api.open-meteo.com';
  const aUrl = `${aqBase}/v1/air-quality?latitude=${LAT}&longitude=${LON}&timezone=Asia%2FBaghdad&current=dust,pm10${meteoKey ? `&apikey=${encodeURIComponent(meteoKey)}` : ''}`;
  const wUrl = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(key)}&q=${LAT},${LON}&days=1&aqi=yes&alerts=no`;
  const [w, a] = await Promise.all([
    fetch(wUrl).then(r => (r.ok ? r.json() : Promise.reject(new Error(`weatherapi ${r.status}`)))),
    fetch(aUrl).then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]) as [{ current?: Record<string, unknown> & { condition?: { code?: number }; air_quality?: Record<string, unknown> }; forecast?: { forecastday?: { date?: string; astro?: Record<string, unknown> }[] } }, { current?: Record<string, unknown> } | null];
  const c = w.current;
  if (!c || typeof c.temp_c !== 'number') throw new Error('weatherapi: no current');
  const aq = a?.current ?? {};
  const day = w.forecast?.forecastday?.[0];
  const date = day?.date ?? (typeof c.last_updated === 'string' ? c.last_updated.slice(0, 10) : '');
  const pm10 = typeof aq.pm10 === 'number' ? aq.pm10 : typeof c.air_quality?.pm10 === 'number' ? c.air_quality.pm10 : null;
  return {
    // "2026-10-14 13:45" → نفس شكل Open-Meteo
    time: typeof c.last_updated === 'string' ? c.last_updated.replace(' ', 'T') : '',
    fetchedAt: Date.now(),
    temp: num(c.temp_c),
    feels: num(c.feelslike_c),
    humidity: num(c.humidity),
    isDay: num(c.is_day, 1) === 1,
    precipitation: num(c.precip_mm),
    code: WAPI_TO_WMO[num(c.condition?.code, 1000)] ?? 3,
    cloud: num(c.cloud),
    wind: num(c.wind_kph),
    windDir: num(c.wind_degree),
    gust: num(c.gust_kph),
    sunrise: astroTime(date, day?.astro?.sunrise),
    sunset: astroTime(date, day?.astro?.sunset),
    dust: typeof aq.dust === 'number' ? aq.dust : null,
    pm10,
    source: 'WeatherAPI',
  };
};

const respond = (data: SiteWeather) => new Response(JSON.stringify(data), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
  },
});

export const handleWeather = async (keys: { weatherApi?: string; openMeteo?: string }, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> => {
  const now = Date.now();
  if (memory && now - memory.at < TTL_MS) return respond(memory.data);
  // ذاكرة Cloudflare المؤقتة (لا تعمل على نطاقات workers.dev، فذاكرة الخادم أعلاه هي الأساس هناك)
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (cache) {
    const hit = await cache.match(CACHE_KEY).catch(() => undefined);
    if (hit) {
      const data = await hit.json() as SiteWeather;
      if (now - data.fetchedAt < TTL_MS) { memory = { at: data.fetchedAt, data }; return respond(data); }
    }
  }
  try {
    // WeatherAPI.com أولًا إن وُجد مفتاحه، وعند فشله Open-Meteo
    const data = keys.weatherApi
      ? await fetchWeatherApi(keys.weatherApi, keys.openMeteo).catch(e => { console.error('weatherapi failed, falling back', e); return fetchFresh(keys.openMeteo); })
      : await fetchFresh(keys.openMeteo);
    memory = { at: now, data };
    if (cache) ctx.waitUntil(cache.put(CACHE_KEY, new Response(JSON.stringify(data), { headers: { 'cache-control': `max-age=${TTL_MS / 1000}` } })).catch(() => undefined));
    return respond(data);
  } catch (e) {
    console.error('weather fetch failed', e);
    // آخر قراءة معروفة أفضل من لا شيء
    if (memory) return respond(memory.data);
    return new Response(JSON.stringify({ error: 'تعذّر جلب الطقس', code: 'weather_unavailable' }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};
