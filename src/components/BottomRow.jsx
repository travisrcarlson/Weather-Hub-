import React from 'react';
import { getWeatherCondition } from '../utils/weatherCodeMap';
import { Wind, Sunrise, Sunset, Waves, Anchor } from 'lucide-react';
import { getTrendIndicator } from '../utils/safetyEngine';
import { calculateAbuAlAbyadTides } from '../utils/tideEngine';

// Z9: 5-Day Forecast Tiles (Fits 35% width of bottom row, horizontal tiles)
export function DailyForecastWidget({ dailyData }) {
  if (!dailyData || !dailyData.time) return null;

  const days = [];
  for (let i = 1; i <= 5; i++) {
    if (i >= dailyData.time.length) break;

    const t = dailyData.time[i];
    const maxTemp = dailyData.temperature_2m_max[i];
    const minTemp = dailyData.temperature_2m_min[i];
    const code = dailyData.weathercode[i];
    const gustMax = dailyData.wind_gusts_10m_max ? dailyData.wind_gusts_10m_max[i] : 0;

    const dateObj = new Date(t);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Dubai' });
    const dateStr = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });
    const condition = getWeatherCondition(code);

    days.push({
      dayName,
      dateStr,
      maxTemp,
      minTemp,
      gustMax,
      condition
    });
  }

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between select-none backdrop-blur-md shadow-lg overflow-hidden">
      <div className="leading-none mb-1.5 flex-none">
        <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-none mb-0.5">
          Z9 • 5-DAY WEATHER FORECAST
        </p>
        <h2 className="text-xs xl:text-sm font-black text-white leading-none">Operational Outlook</h2>
      </div>

      <div className="grid grid-cols-5 gap-1.5 flex-grow min-h-0 items-stretch">
        {days.map((day, i) => (
          <div key={i} className="min-w-0 overflow-hidden bg-bgDeepSpace/40 border border-slate-700/40 rounded-lg py-1.5 px-1 flex flex-col justify-between items-center h-full hover:border-slate-600 transition-colors">
            <div className="text-center leading-none">
              <p className="text-xs font-black text-white uppercase leading-none">{day.dayName}</p>
              <p className="text-[9.5px] font-bold text-slate-300 uppercase mt-0.5 leading-none">{day.dateStr}</p>
            </div>
            <span className="text-lg xl:text-xl filter drop-shadow leading-none my-0.5">{day.condition.emoji}</span>
            <div className="text-xs xl:text-sm font-black font-mono text-white leading-none whitespace-nowrap">
              {day.maxTemp.toFixed(0)}°<span className="text-slate-300 font-bold">/{day.minTemp.toFixed(0)}°</span>
            </div>
            
            {/* Wind Gust Max */}
            <div className="flex items-center space-x-0.5 text-[10px] xl:text-[10.5px] font-mono font-black text-slate-300 leading-none mt-0.5">
              <Wind className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className={day.gustMax >= 50 ? 'text-stopRed font-black animate-pulse' : 'text-white font-black'}>
                {day.gustMax.toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Z10: AQI & Dust Card (Fits Right Sidebar, 31.5% height)
export function AqiWidget({ data, hourlyData }) {
  if (!data) return null;

  const aqi = data.european_aqi || 0;
  const pm25 = data.pm2_5 || 0;
  const pm10 = data.pm10 || 0;
  const dust = data.dust !== undefined && data.dust !== null ? Number(data.dust) : null;

  // Calculate trends compared to previous hour
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  
  const prevAqi = (prevIdx >= 0 && hourlyData.european_aqi) ? hourlyData.european_aqi[prevIdx] : null;
  const aqiTrend = getTrendIndicator(aqi, prevAqi, 1.0);

  const prevPm25 = (prevIdx >= 0 && hourlyData.pm2_5) ? hourlyData.pm2_5[prevIdx] : null;
  const pm25Trend = getTrendIndicator(pm25, prevPm25, 0.5);

  const prevPm10 = (prevIdx >= 0 && hourlyData.pm10) ? hourlyData.pm10[prevIdx] : null;
  const pm10Trend = getTrendIndicator(pm10, prevPm10, 1.0);

  const getAqiDetails = (index) => {
    if (index <= 50) return { label: 'GOOD', color: 'text-safetyGreen', bg: 'bg-safetyGreen' };
    if (index <= 100) return { label: 'MODERATE', color: 'text-yellow-400', bg: 'bg-yellow-500' };
    if (index <= 150) return { label: 'CAUTION', color: 'text-amberAlert', bg: 'bg-amberAlert' };
    if (index <= 200) return { label: 'UNHEALTHY', color: 'text-stopRed', bg: 'bg-stopRed' };
    return { label: 'HAZARDOUS', color: 'text-purple-400 font-bold animate-pulse', bg: 'bg-uvPurple animate-pulse' };
  };

  const aqiDetails = getAqiDetails(aqi);
  const pm25Pct = Math.min((pm25 / 25) * 100, 100);
  const pm10Pct = Math.min((pm10 / 155) * 100, 100);

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl py-2.5 px-3.5 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md shadow-lg">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header & AQI Summary Row */}
      <div className="relative z-10 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-none mb-0.5">
            Z10 • AIR QUALITY & DUST
          </p>
          <div className="flex items-center space-x-1.5">
            <h2 className="text-sm font-black text-white leading-none">Particulate Hazards</h2>
            {dust !== null && (
              <span className="text-[9px] font-mono font-black text-amber-200 bg-amber-950/50 border border-amber-500/40 px-1.5 py-0.5 rounded leading-none">
                DUST {dust.toFixed(0)} µg/m³
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <span className="text-2xl font-black text-white tracking-tight leading-none">{aqi}</span>
            <span className="text-[10px] font-black text-slate-300 uppercase leading-none">AQI</span>
          </div>
          <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border border-current leading-none ${aqiDetails.color}`}>
            {aqiDetails.label}
          </span>
        </div>
      </div>

      {/* PM2.5 and PM10 Vertically Stacked Progress Bars */}
      <div className="relative z-10 space-y-2 border-t border-slate-700/40 pt-2">
        {/* PM2.5 */}
        <div>
          <div className="flex justify-between text-[11px] font-black text-slate-300 leading-none mb-1.5">
            <span>PM2.5 (FINE DUST)</span>
            <span className="flex items-center space-x-0.5">
              <span className={pm25 >= 25 ? 'text-stopRed font-black' : 'text-white font-black'}>
                {pm25.toFixed(1)} µg/m³
              </span>
              {pm25Trend.arrow && pm25Trend.arrow !== ' ' && (
                <span className={`text-[11px] ${pm25Trend.class}`}>{pm25Trend.arrow}</span>
              )}
            </span>
          </div>
          <div className="w-full h-2.5 bg-bgDeepSpace/60 rounded overflow-hidden">
            <div 
              style={{ width: `${pm25Pct}%` }}
              className={`h-full ${pm25 >= 25 ? 'bg-stopRed' : 'bg-slate-300'}`}
            />
          </div>
        </div>

        {/* PM10 */}
        <div>
          <div className="flex justify-between text-[11px] font-black text-slate-300 leading-none mb-1.5">
            <span>PM10 (SAND STORM)</span>
            <span className="flex items-center space-x-0.5">
              <span className={pm10 >= 155 ? 'text-stopRed font-black animate-pulse' : 'text-white font-black'}>
                {pm10.toFixed(1)} µg/m³
              </span>
              {pm10Trend.arrow && pm10Trend.arrow !== ' ' && (
                <span className={`text-[11px] ${pm10Trend.class}`}>{pm10Trend.arrow}</span>
              )}
            </span>
          </div>
          <div className="w-full h-2.5 bg-bgDeepSpace/60 rounded overflow-hidden">
            <div 
              style={{ width: `${pm10Pct}%` }}
              className={`h-full ${pm10 >= 155 ? 'bg-stopRed animate-pulse' : 'bg-slate-300'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper for Moon Phase Calculations
export function getMoonDetails(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  const epoch = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const diffTime = date.getTime() - epoch.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const synodicMonth = 29.530588853;
  
  const phase = (diffDays % synodicMonth + synodicMonth) % synodicMonth;
  const agePct = phase / synodicMonth;
  
  let name = '';
  let emoji = '';
  
  if (agePct < 0.03 || agePct > 0.97) {
    name = 'New Moon';
    emoji = '🌑';
  } else if (agePct <= 0.22) {
    name = 'Waxing Crescent';
    emoji = '🌒';
  } else if (agePct <= 0.28) {
    name = 'First Quarter';
    emoji = '🌓';
  } else if (agePct <= 0.47) {
    name = 'Waxing Gibbous';
    emoji = '🌔';
  } else if (agePct <= 0.53) {
    name = 'Full Moon';
    emoji = '🌕';
  } else if (agePct <= 0.72) {
    name = 'Waning Gibbous';
    emoji = '🌖';
  } else if (agePct <= 0.78) {
    name = 'Third Quarter';
    emoji = '🌗';
  } else {
    name = 'Waning Crescent';
    emoji = '🌘';
  }
  
  return {
    phase: agePct,
    name,
    emoji
  };
}

// Generates an exact SVG path for the illuminated portion of the Moon centered at (0, 0) with radius r
export function getLunarPhaseSvgPath(agePct = 0.5, r = 5) {
  const p = ((agePct % 1) + 1) % 1;
  if (p <= 0.02 || p >= 0.98) {
    return '';
  }
  if (p >= 0.48 && p <= 0.52) {
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  }
  const phi = 2 * Math.PI * p;
  const rx = Math.max(0.05, Math.abs(Math.cos(phi)) * r);
  const outerSweep = p <= 0.5 ? 1 : 0;
  const innerSweep = (p < 0.25 || (p > 0.5 && p <= 0.75)) ? 0 : 1;
  return `M 0 ${-r} A ${r} ${r} 0 0 ${outerSweep} 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} 0 ${-r} Z`;
}

export function parseGstDate(str) {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  if (typeof str === 'string' && (str.includes('+') || str.endsWith('Z'))) return new Date(str);
  return new Date(`${str}+04:00`);
}

// Astronomical Lunar Altitude Calculator for Abu Al Abyad Island (24.195°N, 53.860°E)
function computeLunarAltitudeDeg(dateUtcMs, latDeg = 24.195, lonDeg = 53.860) {
  const rad = Math.PI / 180;
  // Days since J2000.0 (2000-01-01T12:00:00Z)
  const d = (dateUtcMs - 946728000000) / 86400000;

  // Geocentric ecliptic lunar elements (low-precision astronomical ephemeris)
  const L = (218.316 + 13.176396 * d) * rad; // Mean longitude
  const M = (134.963 + 13.064993 * d) * rad; // Mean anomaly
  const F = (93.272 + 13.229350 * d) * rad;  // Mean distance

  const lonEcl = L + 6.289 * rad * Math.sin(M); // Ecliptic longitude
  const latEcl = 5.128 * rad * Math.sin(F);     // Ecliptic latitude
  const eps = (23.439 - 0.0000004 * d) * rad;   // Obliquity of ecliptic

  // Right Ascension (ra) and Declination (dec)
  const sinDec = Math.sin(latEcl) * Math.cos(eps) + Math.cos(latEcl) * Math.sin(eps) * Math.sin(lonEcl);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.sin(lonEcl) * Math.cos(eps) - Math.tan(latEcl) * Math.sin(eps);
  const x = Math.cos(lonEcl);
  const ra = Math.atan2(y, x);

  // Greenwich Mean Sidereal Time + Local Sidereal Time
  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
  const lstRad = (gmstDeg + lonDeg) * rad;
  const ha = lstRad - ra; // Local Hour Angle

  const latRad = latDeg * rad;
  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha);
  const altDeg = (Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad) + 0.125; // +0.125° horizon refraction/parallax
  return altDeg;
}

// Helper for astronomical Moonrise/Moonset times at Abu Al Abyad Island (GST = UTC+4)
export function getMoonTimes(sunriseTimeStr, sunsetTimeStr, agePct = 0.5) {
  if (!sunriseTimeStr || !sunsetTimeStr) return { rise: '--:--', set: '--:--' };

  const refDate = parseGstDate(sunriseTimeStr);
  const gstOffsetMs = 4 * 3600 * 1000;
  const gstRef = new Date(refDate.getTime() + gstOffsetMs);
  const dayStartUtcMs = Date.UTC(
    gstRef.getUTCFullYear(),
    gstRef.getUTCMonth(),
    gstRef.getUTCDate(),
    0, 0, 0
  ) - gstOffsetMs;

  let riseMs = null;
  let setMs = null;
  const stepMs = 5 * 60 * 1000; // 5-minute ephemeris scan across 24h GST day
  let prevAlt = computeLunarAltitudeDeg(dayStartUtcMs);

  for (let m = 5; m <= 1440; m += 5) {
    const tMs = dayStartUtcMs + m * 60 * 1000;
    const curAlt = computeLunarAltitudeDeg(tMs);
    if (prevAlt < 0 && curAlt >= 0 && riseMs === null) {
      const frac = -prevAlt / (curAlt - prevAlt || 1);
      riseMs = tMs - stepMs + frac * stepMs;
    } else if (prevAlt >= 0 && curAlt < 0 && setMs === null) {
      const frac = prevAlt / (prevAlt - curAlt || 1);
      setMs = tMs - stepMs + frac * stepMs;
    }
    prevAlt = curAlt;
  }

  // Fallback if circumpolar or single crossing near midnight
  const fallbackRiseMs = refDate.getTime() + agePct * 24 * 3600 * 1000;
  const fallbackSetMs = parseGstDate(sunsetTimeStr).getTime() + agePct * 24 * 3600 * 1000;
  const finalRiseDate = new Date(riseMs !== null ? riseMs : fallbackRiseMs);
  const finalSetDate = new Date(setMs !== null ? setMs : fallbackSetMs);

  const formatTimeLocal = (d) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai'
    });

  return {
    rise: formatTimeLocal(finalRiseDate),
    set: formatTimeLocal(finalSetDate),
    riseDate: finalRiseDate,
    setDate: finalSetDate
  };
}

// Helper to check transit progress
export function checkTransitPosition(nowDate, riseDate, setDate) {
  const nowMs = nowDate.getTime();
  const riseMs = riseDate.getTime();
  const setMs = setDate.getTime();
  
  if (riseMs < setMs) {
    if (nowMs >= riseMs && nowMs <= setMs) {
      const p = (nowMs - riseMs) / (setMs - riseMs);
      return { visible: true, progress: p };
    }
  } else {
    const dayMs = 24 * 60 * 60 * 1000;
    if (nowMs >= riseMs - dayMs && nowMs <= setMs) {
      const p = (nowMs - (riseMs - dayMs)) / (setMs - (riseMs - dayMs));
      return { visible: true, progress: p };
    }
    if (nowMs >= riseMs && nowMs <= setMs + dayMs) {
      const p = (nowMs - riseMs) / ((setMs + dayMs) - riseMs);
      return { visible: true, progress: p };
    }
  }
  return { visible: false, progress: 0 };
}

// Z11: Sun & Moon Transit Widget (Fits Left Sidebar, 24% height)
export function SunTransitWidget({ dailyData, currentTime, marineData, currentData }) {
  if (!dailyData || !dailyData.sunrise) return null;

  const sunriseStr = dailyData.sunrise[0];
  const sunsetStr = dailyData.sunset[0];

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const d = parseGstDate(timeStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai'
    });
  };

  const sunrise = formatTime(sunriseStr);
  const sunset = formatTime(sunsetStr);

  const moonDetails = getMoonDetails(dailyData.time[0]);
  const moonTimes = getMoonTimes(sunriseStr, sunsetStr, moonDetails.phase);

  const nowDate = currentTime ? (currentTime instanceof Date ? currentTime : parseGstDate(currentTime)) : new Date();
  const sunriseDate = parseGstDate(sunriseStr);
  const sunsetDate = parseGstDate(sunsetStr);
  const tides = calculateAbuAlAbyadTides(nowDate);
  const waveHeight = marineData?.wave_height ?? currentData?.wave_height ?? null;
  const seaSurfaceTemp = marineData?.sea_surface_temperature ?? currentData?.sea_surface_temperature ?? null;

  // Calculate Sun SVG arc coordinates (viewBox 0 0 120 46, arc center (60,38), rx=46, ry=28)
  const sunTransit = checkTransitPosition(nowDate, sunriseDate, sunsetDate);
  const sunTheta = Math.PI * (1 - sunTransit.progress);
  const sunSvgX = sunTransit.visible
    ? 60 + 46 * Math.cos(sunTheta)
    : (nowDate.getTime() < sunriseDate.getTime() ? 14 : 106);
  const sunSvgY = sunTransit.visible
    ? 38 - 28 * Math.sin(sunTheta)
    : 38;

  // Calculate Moon SVG arc coordinates using astronomical moonrise/moonset
  const moonriseDate = moonTimes.riseDate || new Date(sunriseDate.getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
  const moonsetDate = moonTimes.setDate || new Date(sunsetDate.getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
  const moonTransit = checkTransitPosition(nowDate, moonriseDate, moonsetDate);
  const moonTheta = Math.PI * (1 - moonTransit.progress);
  const moonSvgX = moonTransit.visible
    ? 60 + 46 * Math.cos(moonTheta)
    : (nowDate.getTime() < moonriseDate.getTime() ? 14 : 106);
  const moonSvgY = moonTransit.visible
    ? 38 - 28 * Math.sin(moonTheta)
    : 38;
  const moonPhasePath = getLunarPhaseSvgPath(moonDetails.phase, 5.2);

  // Calculate Moonlight Percentage (synodic phase-based illumination)
  const moonlightPct = Math.round(50 * (1 - Math.cos(2 * Math.PI * moonDetails.phase)));

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 xl:p-3 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md shadow-lg">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center mb-0.5 flex-none">
        <div>
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest leading-none mb-0.5">
            Z11 • CELESTIAL & TIDAL TRANSIT
          </p>
          <h2 className="text-xs xl:text-sm font-black text-white leading-none">Sun, Moon & Tide Cycles</h2>
        </div>
        <span className="text-[9px] font-mono font-black text-slate-200 bg-slate-900/90 border border-slate-700/80 px-2 py-0.5 rounded shadow-sm flex items-center space-x-1.5">
          <svg viewBox="-6 -6 12 12" className="w-3 h-3 flex-shrink-0">
            <circle cx="0" cy="0" r="5.2" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
            {moonPhasePath && <path d={moonPhasePath} fill="#f8fafc" />}
          </svg>
          <span>{moonDetails.name} • {moonlightPct}%</span>
        </span>
      </div>

      {/* Columns: Sun and Moon Side-by-Side */}
      <div className="grid grid-cols-2 gap-3 flex-grow items-stretch my-0.5 relative z-10 min-h-0">
        {/* Sun Column */}
        <div className="flex flex-col justify-between border-r border-slate-800/60 pr-1.5 min-h-0">
          {/* Sun Arc Visualization (True SVG Semi-Ellipse) */}
          <div className="w-full h-11 xl:h-12 flex-shrink-0 relative flex items-center justify-center">
            <svg viewBox="0 0 120 46" className="w-full h-full overflow-visible">
              {/* Horizon Line */}
              <line x1="6" y1="38" x2="114" y2="38" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
              {/* Solar Transit Arc */}
              <path
                d="M 14 38 A 46 28 0 0 1 106 38"
                fill="none"
                stroke="#f97316"
                strokeOpacity="0.65"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              {/* Vector Sun Orb */}
              <g transform={`translate(${sunSvgX.toFixed(1)}, ${sunSvgY.toFixed(1)})`} opacity={sunTransit.visible ? 1 : 0.3}>
                {sunTransit.visible && (
                  <circle cx="0" cy="0" r="8.5" fill="#f97316" fillOpacity="0.28" />
                )}
                <circle cx="0" cy="0" r="5.2" fill="#f59e0b" />
                <circle cx="0" cy="0" r="3" fill="#fef08a" />
              </g>
              {/* Arc Status Text */}
              <text
                x="60"
                y="35"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="900"
                fill="#cbd5e1"
                className="font-mono uppercase"
              >
                {sunTransit.visible ? `${Math.round(sunTransit.progress * 100)}% DAY ARC` : 'BELOW HORIZON'}
              </text>
            </svg>
          </div>

          {/* Sunrise/Sunset times */}
          <div className="grid grid-cols-2 gap-1.5 text-center border-t border-slate-800/50 pt-1">
            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-black text-slate-300 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunrise className="w-3 h-3 text-amber-400" />
                <span>RISE</span>
              </span>
              <span className="text-xs xl:text-[13px] font-mono font-black text-white tracking-normal leading-none">{sunrise}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-black text-slate-300 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunset className="w-3 h-3 text-edgeOrange" />
                <span>SET</span>
              </span>
              <span className="text-xs xl:text-[13px] font-mono font-black text-white tracking-normal leading-none">{sunset}</span>
            </div>
          </div>

          {/* Underneath Sunrise & Sunset: Tide Cycles (High & Low Tide Times) */}
          <div className="border-t border-slate-800/50 pt-1 mt-0.5">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-[8px] font-black text-cyan-300 uppercase flex items-center space-x-1">
                <Waves className="w-2.5 h-2.5 text-cyan-400" />
                <span>TIDE CYCLE</span>
              </span>
              <span className="text-[8px] font-mono text-cyan-200 font-black uppercase">
                {tides.currentFlow} {tides.flowArrow}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="flex flex-col items-center bg-cyan-950/35 rounded py-1 px-1 border border-cyan-500/40 shadow-inner">
                <span className="text-[8px] font-black text-cyan-200 uppercase leading-none mb-0.5">HIGH TIDE</span>
                <span className="text-xs xl:text-[13px] font-mono font-black text-white leading-none">{tides.high1}</span>
                <span className="text-[8px] font-mono font-bold text-cyan-200/90 mt-0.5 leading-none">{tides.high2}</span>
              </div>
              <div className="flex flex-col items-center bg-slate-900/65 rounded py-1 px-1 border border-slate-700/80 shadow-inner">
                <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-0.5">LOW TIDE</span>
                <span className="text-xs xl:text-[13px] font-mono font-black text-white leading-none">{tides.low1}</span>
                <span className="text-[8px] font-mono font-bold text-slate-300 mt-0.5 leading-none">{tides.low2}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Moon Column */}
        <div className="flex flex-col justify-between pl-1.5 min-h-0">
          {/* Moon Arc/Phase Visualization (True SVG Semi-Ellipse + Vector Lunar Phase Disc) */}
          <div className="w-full h-11 xl:h-12 flex-shrink-0 relative flex items-center justify-center">
            <svg viewBox="0 0 120 46" className="w-full h-full overflow-visible">
              {/* Horizon Line */}
              <line x1="6" y1="38" x2="114" y2="38" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
              {/* Lunar Transit Arc */}
              <path
                d="M 14 38 A 46 28 0 0 1 106 38"
                fill="none"
                stroke="#818cf8"
                strokeOpacity="0.6"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              {/* Vector Moon Phase Orb */}
              <g transform={`translate(${moonSvgX.toFixed(1)}, ${moonSvgY.toFixed(1)})`} opacity={moonTransit.visible ? 1 : 0.35}>
                {moonTransit.visible && (
                  <circle cx="0" cy="0" r="8.5" fill="#38bdf8" fillOpacity="0.25" />
                )}
                <circle cx="0" cy="0" r="5.4" fill="#0f172a" stroke="#94a3b8" strokeWidth="0.8" />
                {moonPhasePath && <path d={moonPhasePath} fill="#f8fafc" />}
              </g>
              {/* Arc Status Text */}
              <text
                x="60"
                y="35"
                textAnchor="middle"
                fontSize="7.5"
                fontWeight="900"
                fill="#cbd5e1"
                className="font-mono uppercase"
              >
                {moonTransit.visible ? `${Math.round(moonTransit.progress * 100)}% NIGHT ARC` : 'BELOW HORIZON'}
              </text>
            </svg>
          </div>

          {/* Moonrise/Moonset times */}
          <div className="grid grid-cols-2 gap-1.5 text-center border-t border-slate-800/50 pt-1">
            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-black text-slate-300 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunrise className="w-3 h-3 text-slate-300" />
                <span>RISE</span>
              </span>
              <span className="text-xs xl:text-[13px] font-mono font-black text-white tracking-normal leading-none">{moonTimes.rise}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-black text-slate-300 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunset className="w-3 h-3 text-slate-300" />
                <span>SET</span>
              </span>
              <span className="text-xs xl:text-[13px] font-mono font-black text-white tracking-normal leading-none">{moonTimes.set}</span>
            </div>
          </div>

          {/* Underneath Moonrise & Moonset: Marine Status & Next Tide */}
          <div className="border-t border-slate-800/50 pt-1 mt-1">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-[8px] font-black text-indigo-200 uppercase flex items-center space-x-1">
                <Anchor className="w-2.5 h-2.5 text-indigo-400" />
                <span>MARINE TIDE</span>
              </span>
              <span className="text-[8px] font-mono text-slate-300 font-black uppercase">
                {tides.springNeap}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="flex flex-col items-center bg-indigo-950/35 rounded py-1 px-1 border border-indigo-500/40 shadow-inner">
                <span className="text-[8px] font-black text-indigo-200 uppercase leading-none mb-0.5">NEXT EVENT</span>
                <span className="text-xs xl:text-[13px] font-mono font-black text-white leading-none">{tides.nextTide.time}</span>
                <span className="text-[8px] font-mono font-bold text-indigo-200/90 mt-0.5 leading-none">
                  {tides.nextTide.type} ({tides.nextTide.eta})
                </span>
              </div>
              <div className="flex flex-col items-center bg-slate-900/65 rounded py-1 px-1 border border-slate-700/80 shadow-inner">
                <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-0.5">
                  {waveHeight !== null ? 'WAVE / TIDE' : 'TIDAL RANGE'}
                </span>
                <span className="text-xs xl:text-[13px] font-mono font-black text-white leading-none">
                  {waveHeight !== null ? `${Number(waveHeight).toFixed(1)}m • ${tides.range}` : tides.range}
                </span>
                <span className="text-[8px] font-mono font-bold text-slate-300 mt-0.5 leading-none">
                  {seaSurfaceTemp !== null ? `SEA ${Number(seaSurfaceTemp).toFixed(1)}°C` : 'ABU AL ABYAD'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
