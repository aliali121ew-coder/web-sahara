import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Snowflake, Sun, Wind } from 'lucide-react';
import { dustLevel, weatherKind, windSector, type SiteWeather, type WeatherKind } from '../../lib/weather';

const WX_ICON: Record<WeatherKind, React.FC<{ className?: string }>> = {
  clear: Sun, partly: CloudSun, cloudy: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: Snowflake, showers: CloudRain, storm: CloudLightning,
};

/** بطاقة الطقس الحقيقي للموقع أعلى خرائط مركز المراقبة */
export const MapWeather: React.FC<{ weather: SiteWeather }> = ({ weather }) => {
  const { t } = useTranslation(['finance']);
  const kind = weatherKind(weather.code);
  const Icon = !weather.isDay && (kind === 'clear' || kind === 'partly') ? Moon : WX_ICON[kind];
  const dl = dustLevel(weather.dust);
  return (
    <div className={`sf-map-wx${dl !== 'none' ? ' dust' : ''}`} dir="rtl" title={`${t('finance:siteFarms.wx.updated', { time: weather.time.slice(11, 16) })} · ${weather.source ?? 'Open-Meteo'}`}>
      <div className="sf-map-wx-main">
        <Icon className="w-7 h-7" />
        <b>{Math.round(weather.temp)}°</b>
        <div>
          <span>{t(`finance:siteFarms.wx.kind.${kind}`)}</span>
          <small>{t('finance:siteFarms.wx.feels', { n: Math.round(weather.feels) })}</small>
        </div>
      </div>
      <div className="sf-map-wx-row">
        <Wind className="w-3.5 h-3.5" />
        <span>{t('finance:siteFarms.wx.wind', { n: Math.round(weather.wind) })}</span>
        <ArrowUp className="w-3.5 h-3.5 sf-map-wx-arrow" style={{ transform: `rotate(${weather.windDir + 180}deg)` }} aria-hidden="true" />
        <span>{t(`finance:siteFarms.wx.dir.${windSector(weather.windDir)}`)}</span>
      </div>
      <div className="sf-map-wx-row">
        <span>{t('finance:siteFarms.wx.humidity', { n: Math.round(weather.humidity) })}</span>
        {weather.dust !== null && <span>· {t('finance:siteFarms.wx.dust', { n: Math.round(weather.dust) })}</span>}
      </div>
      {dl !== 'none' && <div className="sf-map-wx-alert">{t(dl === 'storm' ? 'finance:siteFarms.wx.dustStorm' : 'finance:siteFarms.wx.dustWarn')}</div>}
      <small className="sf-map-wx-time">{t('finance:siteFarms.wx.updated', { time: weather.time.slice(11, 16) })} · {weather.source ?? 'Open-Meteo'}</small>
    </div>
  );
};

export default MapWeather;
