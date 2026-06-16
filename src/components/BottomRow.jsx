import React from 'react';
import { getWeatherCondition } from '../utils/weatherCodeMap';
import { Wind, Sunrise, Sunset } from 'lucide-react';
import { getTrendIndicator } from '../utils/safetyEngine';

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
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-3 flex flex-col justify-between select-none">
      <div className="leading-none mb-1">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
          Z9 • 5-DAY WEATHER FORECAST
        </p>
        <h2 className="text-sm font-bold text-slate-200 leading-none">Operational Outlook</h2>
      </div>

      <div className="grid grid-cols-5 gap-1.5 h-[78%] items-stretch">
        {days.map((day, i) => (
          <div key={i} className="bg-bgDeepSpace/30 border border-slate-700/20 rounded-lg p-1.5 flex flex-col justify-between items-center h-full hover:border-slate-650 transition-colors">
            <div className="text-center">
              <p className="text-xs font-black text-slate-300 uppercase leading-none">{day.dayName}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 leading-none">{day.dateStr}</p>
            </div>
            <span className="text-2xl filter drop-shadow leading-none my-1">{day.condition.emoji}</span>
            <div className="text-sm font-black text-textIceWhite leading-none">
              {day.maxTemp.toFixed(0)}°<span className="text-slate-400 font-normal">/{day.minTemp.toFixed(0)}°</span>
            </div>
            
            {/* Wind Gust Max */}
            <div className="flex items-center space-x-0.5 text-[10.5px] font-mono font-bold text-slate-400 leading-none mt-1">
              <Wind className="w-3 h-3 text-slate-500" />
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
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl py-2.5 px-3.5 flex flex-col justify-between select-none relative overflow-hidden">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header & AQI Summary Row */}
      <div className="relative z-10 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5">
            Z10 • AIR QUALITY & DUST
          </p>
          <h2 className="text-sm font-black text-slate-200 leading-none">Particulate Hazards</h2>
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

// Helper for Moonrise/Moonset times approximation
export function getMoonTimes(sunriseTimeStr, sunsetTimeStr, agePct) {
  if (!sunriseTimeStr || !sunsetTimeStr) return { rise: '--:--', set: '--:--' };
  
  const riseDate = new Date(sunriseTimeStr);
  const setDate = new Date(sunsetTimeStr);
  const offsetMs = agePct * 24 * 60 * 60 * 1000;
  
  const moonriseDate = new Date(riseDate.getTime() + offsetMs);
  const moonsetDate = new Date(setDate.getTime() + offsetMs);
  
  const formatTimeLocal = (d) => {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai'
    });
  };
  
  return {
    rise: formatTimeLocal(moonriseDate),
    set: formatTimeLocal(moonsetDate)
  };
}

// Helper to check transit progress
function checkTransitPosition(nowDate, riseDate, setDate) {
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
export function SunTransitWidget({ dailyData, currentTime }) {
  if (!dailyData || !dailyData.sunrise) return null;

  const sunriseStr = dailyData.sunrise[0];
  const sunsetStr = dailyData.sunset[0];

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const d = new Date(timeStr);
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

  const nowDate = currentTime ? new Date(currentTime) : new Date();

  // Calculate Sun position
  const sunTransit = checkTransitPosition(nowDate, new Date(sunriseStr), new Date(sunsetStr));
  let sunX = 7.5;
  let sunY = 0;
  if (sunTransit.visible) {
    const theta = Math.PI - sunTransit.progress * Math.PI;
    sunX = 50 + 42.5 * Math.cos(theta);
    sunY = 75 * Math.sin(theta);
  } else {
    const sunRiseMs = new Date(sunriseStr).getTime();
    sunX = nowDate.getTime() < sunRiseMs ? 7.5 : 92.5;
    sunY = 0;
  }

  // Calculate Moon position
  const moonriseDate = new Date(new Date(sunriseStr).getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
  const moonsetDate = new Date(new Date(sunsetStr).getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
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
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between select-none relative overflow-hidden">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
          Z11 • SUN & MOON TRANSIT
        </p>
        <h2 className="text-sm font-bold text-slate-200 leading-none">Light & Curfew Planning</h2>
      </div>

      {/* Columns: Sun and Moon Side-by-Side (Upscaled height h-12 and text) */}
      <div className="grid grid-cols-2 gap-2 flex-grow items-stretch my-2 relative z-10">
        {/* Sun Column */}
        <div className="flex flex-col justify-between border-r border-slate-800/60 pr-2">
          {/* Sun Arc Visualization */}
          <div className="flex flex-col items-center justify-center relative h-12 w-full mb-1">
            <div className="w-full h-0.5 border-t border-dashed border-slate-700/60 absolute bottom-0 rounded-t-full" />
            <div className="w-[85%] h-[75%] border-t border-t-edgeOrange/40 border-r border-r-transparent border-l border-l-transparent rounded-t-full absolute bottom-0" />
            <div 
              className={`absolute text-lg leading-none transition-all duration-500 ${!sunTransit.visible ? 'opacity-20 grayscale' : 'animate-pulse-slow'}`}
              style={{ 
                left: `calc(${sunX}% - 9px)`, 
                bottom: `calc(${sunY}% - 9px)` 
              }}
            >
              ☀️
            </div>
          </div>
          {/* Sunrise/Sunset times */}
          <div className="grid grid-cols-2 gap-1.5 text-center border-t border-slate-800/40 pt-1.5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunrise className="w-2.5 h-2.5 text-amber-400" />
                <span>RISE</span>
              </span>
              <span className="text-2xl font-mono font-black text-textIceWhite tracking-tighter leading-none">{sunrise}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunset className="w-2.5 h-2.5 text-edgeOrange" />
                <span>SET</span>
              </span>
              <span className="text-2xl font-mono font-black text-textIceWhite tracking-tighter leading-none">{sunset}</span>
            </div>
          </div>
        </div>

        {/* Moon Column */}
        <div className="flex flex-col justify-between pl-1">
          {/* Moon Arc/Phase Visualization */}
          <div className="flex flex-col items-center justify-center relative h-12 w-full mb-1">
            <div className="w-full h-0.5 border-t border-dashed border-slate-700/60 absolute bottom-0 rounded-t-full" />
            <div className="w-[85%] h-[75%] border-t border-t-slate-500/30 border-r border-r-transparent border-l border-l-transparent rounded-t-full absolute bottom-0" />
            <div 
              className={`absolute text-lg leading-none transition-all duration-500 ${!moonTransit.visible ? 'opacity-20 grayscale' : 'animate-pulse-slow'}`}
              style={{ 
                left: `calc(${moonX}% - 9px)`, 
                bottom: `calc(${moonY}% - 9px)` 
              }}
            >
              {moonDetails.emoji}
            </div>
            <span className="absolute bottom-1 text-[9px] font-black text-slate-300 leading-none truncate max-w-full text-center">
              {moonDetails.name} • {moonlightPct}% Light
            </span>
          </div>
          {/* Moonrise/Moonset times */}
          <div className="grid grid-cols-2 gap-1.5 text-center border-t border-slate-800/40 pt-1.5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunrise className="w-2.5 h-2.5 text-slate-400" />
                <span>RISE</span>
              </span>
              <span className="text-2xl font-mono font-black text-textIceWhite tracking-tighter leading-none">{moonTimes.rise}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase flex items-center space-x-0.5 mb-0.5">
                <Sunset className="w-2.5 h-2.5 text-slate-400" />
                <span>SET</span>
              </span>
              <span className="text-2xl font-mono font-black text-textIceWhite tracking-tighter leading-none">{moonTimes.set}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
