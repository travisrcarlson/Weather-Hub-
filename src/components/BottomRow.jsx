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
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
          Z9 • 5-DAY WEATHER FORECAST
        </p>
        <h2 className="text-xs sm:text-sm font-bold text-slate-200 leading-none">Operational Outlook</h2>
      </div>

      <div className="grid grid-cols-5 gap-1.5 flex-grow min-h-0 items-stretch">
        {days.map((day, i) => (
          <div key={i} className="min-w-0 overflow-hidden bg-bgDeepSpace/30 border border-slate-700/20 rounded-lg py-1.5 px-1 flex flex-col justify-between items-center h-full hover:border-slate-650 transition-colors">
            <div className="text-center leading-none">
              <p className="text-[11px] font-black text-slate-300 uppercase leading-none">{day.dayName}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 leading-none">{day.dateStr}</p>
            </div>
            <span className="text-lg sm:text-xl filter drop-shadow leading-none my-0.5">{day.condition.emoji}</span>
            <div className="text-xs sm:text-sm font-black font-mono text-textIceWhite leading-none whitespace-nowrap">
              {day.maxTemp.toFixed(0)}°<span className="text-slate-400 font-normal">/{day.minTemp.toFixed(0)}°</span>
            </div>
            
            {/* Wind Gust Max */}
            <div className="flex items-center space-x-0.5 text-[9.5px] font-mono font-bold text-slate-400 leading-none mt-0.5">
              <Wind className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
              <span className={day.gustMax >= 50 ? 'text-stopRed font-black animate-pulse' : 'text-slate-300 font-black'}>
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
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5">
            Z10 • AIR QUALITY & DUST
          </p>
          <div className="flex items-center space-x-1.5">
            <h2 className="text-sm font-black text-slate-200 leading-none">Particulate Hazards</h2>
            {dust !== null && (
              <span className="text-[8.5px] font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-1 py-0.5 rounded leading-none">
                DUST {dust.toFixed(0)} µg/m³
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <span className="text-2xl font-black text-textIceWhite tracking-tight leading-none">{aqi}</span>
            <span className="text-[9.5px] font-bold text-slate-400 uppercase leading-none">AQI</span>
          </div>
          <span className={`text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded border border-current leading-none ${aqiDetails.color}`}>
            {aqiDetails.label}
          </span>
        </div>
      </div>

      {/* PM2.5 and PM10 Vertically Stacked Progress Bars */}
      <div className="relative z-10 space-y-2 border-t border-slate-700/30 pt-2">
        {/* PM2.5 */}
        <div>
          <div className="flex justify-between text-[10.5px] font-bold text-slate-400 leading-none mb-1.5">
            <span>PM2.5 (FINE DUST)</span>
            <span className="flex items-center space-x-0.5">
              <span className={pm25 >= 25 ? 'text-stopRed font-black' : 'text-slate-200 font-black'}>
                {pm25.toFixed(1)} µg/m³
              </span>
              {pm25Trend.arrow && pm25Trend.arrow !== ' ' && (
                <span className={`text-[10.5px] ${pm25Trend.class}`}>{pm25Trend.arrow}</span>
              )}
            </span>
          </div>
          <div className="w-full h-2 bg-bgDeepSpace/40 rounded overflow-hidden">
            <div 
              style={{ width: `${pm25Pct}%` }}
              className={`h-full ${pm25 >= 25 ? 'bg-stopRed' : 'bg-slate-400'}`}
            />
          </div>
        </div>

        {/* PM10 */}
        <div>
          <div className="flex justify-between text-[10.5px] font-bold text-slate-400 leading-none mb-1.5">
            <span>PM10 (SAND STORM)</span>
            <span className="flex items-center space-x-0.5">
              <span className={pm10 >= 155 ? 'text-stopRed font-black animate-pulse' : 'text-slate-200 font-black'}>
                {pm10.toFixed(1)} µg/m³
              </span>
              {pm10Trend.arrow && pm10Trend.arrow !== ' ' && (
                <span className={`text-[10.5px] ${pm10Trend.class}`}>{pm10Trend.arrow}</span>
              )}
            </span>
          </div>
          <div className="w-full h-2 bg-bgDeepSpace/40 rounded overflow-hidden">
            <div 
              style={{ width: `${pm10Pct}%` }}
              className={`h-full ${pm10 >= 155 ? 'bg-stopRed animate-pulse' : 'bg-slate-400'}`}
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

  // Calculate Sun position
  const sunTransit = checkTransitPosition(nowDate, sunriseDate, sunsetDate);
  let sunX = 7.5;
  let sunY = 0;
  if (sunTransit.visible) {
    const theta = Math.PI - sunTransit.progress * Math.PI;
    sunX = 50 + 42.5 * Math.cos(theta);
    sunY = 75 * Math.sin(theta);
  } else {
    const sunRiseMs = sunriseDate.getTime();
    sunX = nowDate.getTime() < sunRiseMs ? 7.5 : 92.5;
    sunY = 0;
  }

  // Calculate Moon position using astronomical moonrise/moonset
  const moonriseDate = moonTimes.riseDate || new Date(sunriseDate.getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
  const moonsetDate = moonTimes.setDate || new Date(sunsetDate.getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
  const moonTransit = checkTransitPosition(nowDate, moonriseDate, moonsetDate);
  
  let moonX = 7.5;
  let moonY = 0;
  if (moonTransit.visible) {
    const theta = Math.PI - moonTransit.progress * Math.PI;
    moonX = 50 + 42.5 * Math.cos(theta);
    moonY = 75 * Math.sin(theta);
  } else {
    moonX = nowDate.getTime() < moonriseDate.getTime() ? 7.5 : 92.5;
    moonY = 0;
  }

  // Calculate Moonlight Percentage (synodic phase-based illumination)
  const moonlightPct = Math.round(50 * (1 - Math.cos(2 * Math.PI * moonDetails.phase)));

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md shadow-lg">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center mb-0.5">
        <div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
            Z11 • CELESTIAL & TIDAL TRANSIT
          </p>
          <h2 className="text-xs font-bold text-slate-200 leading-none">Sun, Moon & Tide Cycles</h2>
        </div>
        <span className="text-[8.5px] font-mono font-bold text-slate-400 bg-slate-900/80 border border-slate-800 px-1.5 py-0.5 rounded shadow-sm">
          {moonDetails.name} • {moonlightPct}%
        </span>
      </div>

      {/* Columns: Sun and Moon Side-by-Side */}
      <div className="grid grid-cols-2 gap-3 flex-grow items-stretch my-1 relative z-10">
        {/* Sun Column */}
        <div className="flex flex-col justify-between border-r border-slate-800/60 pr-1.5">
          {/* Sun Arc Visualization */}
          <div className="flex flex-col items-center justify-center relative h-13 w-full mb-0.5">
            <div className="w-full h-0.5 border-t border-dashed border-slate-700/60 absolute bottom-0 rounded-t-full" />
            <div className="w-[90%] h-[80%] border-t-2 border-t-edgeOrange/60 border-r border-r-transparent border-l border-l-transparent rounded-t-full absolute bottom-0" />
            <div 
              className={`absolute text-xl leading-none transition-all duration-500 ${!sunTransit.visible ? 'opacity-25 grayscale' : 'animate-pulse-slow'}`}
              style={{ 
                left: `calc(${sunX}% - 10px)`, 
                bottom: `calc(${sunY}% - 10px)` 
              }}
            >
              ☀️
            </div>
            <span className="absolute bottom-0.5 text-[7.5px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              {sunTransit.visible ? `${Math.round(sunTransit.progress * 100)}% Day Arc` : 'Below Horizon'}
            </span>
          </div>

          {/* Sunrise/Sunset times */}
          <div className="grid grid-cols-2 gap-1.5 text-center border-t border-slate-800/50 pt-1">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunrise className="w-2.5 h-2.5 text-amber-400" />
                <span>RISE</span>
              </span>
              <span className="text-xs font-mono font-black text-textIceWhite tracking-normal leading-none">{sunrise}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunset className="w-2.5 h-2.5 text-edgeOrange" />
                <span>SET</span>
              </span>
              <span className="text-xs font-mono font-black text-textIceWhite tracking-normal leading-none">{sunset}</span>
            </div>
          </div>

          {/* Underneath Sunrise & Sunset: Tide Cycles (High & Low Tide Times) */}
          <div className="border-t border-slate-800/50 pt-1 mt-1">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-[7.5px] font-black text-cyan-400 uppercase flex items-center space-x-1">
                <Waves className="w-2.5 h-2.5 text-cyan-400" />
                <span>TIDE CYCLE</span>
              </span>
              <span className="text-[7px] font-mono text-cyan-300 font-bold uppercase">
                {tides.currentFlow} {tides.flowArrow}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="flex flex-col items-center bg-cyan-950/25 rounded py-1 px-1 border border-cyan-500/30 shadow-inner">
                <span className="text-[7.5px] font-black text-cyan-300 uppercase leading-none mb-0.5">HIGH TIDE</span>
                <span className="text-xs font-mono font-black text-white leading-none">{tides.high1}</span>
                <span className="text-[7px] font-mono text-cyan-300/80 mt-0.5 leading-none">{tides.high2}</span>
              </div>
              <div className="flex flex-col items-center bg-slate-900/50 rounded py-1 px-1 border border-slate-800/80 shadow-inner">
                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-0.5">LOW TIDE</span>
                <span className="text-xs font-mono font-black text-slate-200 leading-none">{tides.low1}</span>
                <span className="text-[7px] font-mono text-slate-400 mt-0.5 leading-none">{tides.low2}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Moon Column */}
        <div className="flex flex-col justify-between pl-1.5">
          {/* Moon Arc/Phase Visualization */}
          <div className="flex flex-col items-center justify-center relative h-13 w-full mb-0.5">
            <div className="w-full h-0.5 border-t border-dashed border-slate-700/60 absolute bottom-0 rounded-t-full" />
            <div className="w-[90%] h-[80%] border-t-2 border-t-indigo-400/40 border-r border-r-transparent border-l border-l-transparent rounded-t-full absolute bottom-0" />
            <div 
              className={`absolute text-xl leading-none transition-all duration-500 ${!moonTransit.visible ? 'opacity-25 grayscale' : 'animate-pulse-slow'}`}
              style={{ 
                left: `calc(${moonX}% - 10px)`, 
                bottom: `calc(${moonY}% - 10px)` 
              }}
            >
              {moonDetails.emoji}
            </div>
            <span className="absolute bottom-0.5 text-[7.5px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              {moonTransit.visible ? `${Math.round(moonTransit.progress * 100)}% Night Arc` : 'Below Horizon'}
            </span>
          </div>

          {/* Moonrise/Moonset times */}
          <div className="grid grid-cols-2 gap-1.5 text-center border-t border-slate-800/50 pt-1">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunrise className="w-2.5 h-2.5 text-slate-400" />
                <span>RISE</span>
              </span>
              <span className="text-xs font-mono font-black text-textIceWhite tracking-normal leading-none">{moonTimes.rise}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunset className="w-2.5 h-2.5 text-slate-400" />
                <span>SET</span>
              </span>
              <span className="text-xs font-mono font-black text-textIceWhite tracking-normal leading-none">{moonTimes.set}</span>
            </div>
          </div>

          {/* Underneath Moonrise & Moonset: Marine Status & Next Tide */}
          <div className="border-t border-slate-800/50 pt-1 mt-1">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-[7.5px] font-black text-indigo-300 uppercase flex items-center space-x-1">
                <Anchor className="w-2.5 h-2.5 text-indigo-400" />
                <span>MARINE TIDE</span>
              </span>
              <span className="text-[7px] font-mono text-slate-400 font-bold uppercase">
                {tides.springNeap}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="flex flex-col items-center bg-indigo-950/25 rounded py-1 px-1 border border-indigo-500/30 shadow-inner">
                <span className="text-[7.5px] font-black text-indigo-300 uppercase leading-none mb-0.5">NEXT EVENT</span>
                <span className="text-xs font-mono font-black text-white leading-none">{tides.nextTide.time}</span>
                <span className="text-[7px] font-mono text-indigo-300/80 mt-0.5 leading-none">
                  {tides.nextTide.type} ({tides.nextTide.eta})
                </span>
              </div>
              <div className="flex flex-col items-center bg-slate-900/50 rounded py-1 px-1 border border-slate-800/80 shadow-inner">
                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-0.5">
                  {waveHeight !== null ? 'WAVE / TIDE' : 'TIDAL RANGE'}
                </span>
                <span className="text-xs font-mono font-black text-slate-200 leading-none">
                  {waveHeight !== null ? `${Number(waveHeight).toFixed(1)}m • ${tides.range}` : tides.range}
                </span>
                <span className="text-[7px] font-mono text-slate-400 mt-0.5 leading-none">
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
