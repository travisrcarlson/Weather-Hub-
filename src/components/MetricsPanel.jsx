import React from 'react';
import { Droplets, Eye, Sun, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { calculateDewPoint, calculateHumidex, getHumidexComfort, getTrendIndicator, calculateSunscreenIntervals } from '../utils/safetyEngine';

// Z4: Humidity, Dew Point & Humidex
export function HumidityWidget({ data, hourlyData }) {
  if (!data) return null;

  const temp = data.temperature_2m || 0;
  const rh = data.relative_humidity_2m || 0;

  const dewPoint = calculateDewPoint(temp, rh);
  const humidex = calculateHumidex(temp, dewPoint);
  const comfort = getHumidexComfort(humidex);

  // Calculate trends compared to previous hour
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  const prevRh = prevIdx >= 0 ? hourlyData.relative_humidity_2m[prevIdx] : null;
  const rhTrend = getTrendIndicator(rh, prevRh, 1.0);

  let prevHumidex = null;
  if (prevIdx >= 0 && hourlyData.temperature_2m && hourlyData.relative_humidity_2m) {
    const prevTemp = hourlyData.temperature_2m[prevIdx];
    const prevRhVal = hourlyData.relative_humidity_2m[prevIdx];
    const prevDp = calculateDewPoint(prevTemp, prevRhVal);
    prevHumidex = calculateHumidex(prevTemp, prevDp);
  }
  const humidexTrend = getTrendIndicator(humidex, prevHumidex, 0.1);

  const getHumidityColor = (humidity) => {
    if (humidity >= 85) return 'text-stopRed';
    if (humidity >= 60) return 'text-amberAlert';
    return 'text-textIceWhite';
  };

  // Helper to calculate 24h Humidity/Humidex Forecast
  const getHumidityForecast = () => {
    if (!hourlyData || !hourlyData.relative_humidity_2m || !hourlyData.temperature_2m) {
      return {
        minRh: rh * 0.8,
        maxRh: Math.min(rh * 1.3, 100),
        maxHumidex: humidex * 1.05
      };
    }
    
    const rhList = hourlyData.relative_humidity_2m.slice(0, 24);
    const tempList = hourlyData.temperature_2m.slice(0, 24);
    
    const minRh = Math.min(...rhList);
    const maxRh = Math.max(...rhList);
    
    let maxHumidex = 0;
    for (let i = 0; i < tempList.length; i++) {
      const hTemp = tempList[i];
      const hRh = rhList[i];
      const hDp = calculateDewPoint(hTemp, hRh);
      const hHx = calculateHumidex(hTemp, hDp);
      if (hHx > maxHumidex) {
        maxHumidex = hHx;
      }
    }
    
    return {
      minRh,
      maxRh,
      maxHumidex
    };
  };

  const forecast = getHumidityForecast();

  const getWorkRestCycle = () => {
    // Grounded in UAE ADOSH CoP 11.0 guidelines
    if (humidex >= 46 || temp >= 43) {
      return { 
        ratio: "30m Work / 30m Rest", 
        color: "text-stopRed animate-pulse",
        law: "ADOSH CoP 11.0 (Critical Limit)"
      };
    } else if (humidex >= 40 || temp >= 38) {
      return { 
        ratio: "40m Work / 20m Rest", 
        color: "text-amberAlert",
        law: "ADOSH CoP 11.0 (High Alert)"
      };
    } else {
      return { 
        ratio: "50m Work / 10m Rest", 
        color: "text-safetyGreen",
        law: "ADOSH CoP 11.0 (Standard Split)"
      };
    }
  };

  const cycle = getWorkRestCycle();

  return (
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl py-3 px-3.5 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
          Z4 • HUMIDITY & DEW POINT
        </p>
        <h2 className="text-sm font-bold text-slate-200 leading-none">Heat Stress Metrics</h2>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-between my-1 relative z-10">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[9.5px] text-slate-400 font-bold uppercase leading-none">Relative Humidity</p>
          <div className="flex items-center leading-none">
            <span className={`text-4xl font-black tracking-tight ${getHumidityColor(rh)}`}>
              {rh}
            </span>
            <span className="text-[14px] font-semibold text-slate-400 ml-0.5">%</span>
            {rhTrend.arrow && rhTrend.arrow !== '→' && (
              <span className={`text-[11px] ml-1.5 ${rhTrend.class}`}>{rhTrend.arrow}</span>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[9.5px] text-slate-400 font-bold uppercase leading-none">Humidex</p>
          <div className="flex items-center justify-end leading-none">
            <span className="text-3xl font-black tracking-tight text-textIceWhite">
              {humidex.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-edgeOrange ml-0.5">°C</span>
            {humidexTrend.arrow && humidexTrend.arrow !== '→' && (
              <span className={`text-[11px] ml-1.5 ${humidexTrend.class}`}>{humidexTrend.arrow}</span>
            )}
          </div>
          <span className="text-[9.5px] font-bold text-slate-300 block mt-0.5">Dew Pt: {dewPoint.toFixed(1)}°C</span>
        </div>
      </div>

      {/* UAE MoHRE Work/Rest Split */}
      <div className="border-t border-slate-800/40 pt-1.5 pb-1 relative z-10 flex flex-col space-y-0.5">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase leading-none">
          <span className="text-slate-450">Work/Rest (MoHRE)</span>
          <span className={`${cycle.color} font-black tracking-wide`}>{cycle.ratio}</span>
        </div>
        <div className="flex justify-between items-center text-[7px] text-slate-500 uppercase leading-none">
          <span>Comfort: <span className={`font-black uppercase ${comfort.color}`}>{comfort.label}</span></span>
          <span className="font-extrabold tracking-wide">{cycle.law}</span>
        </div>
      </div>

      {/* Forecast Details */}
      <div className="border-t border-slate-700/30 pt-1.5 flex justify-between items-center relative z-10 text-[9px] font-bold text-slate-400 uppercase leading-none">
        <div>
          <span>24H Range: </span>
          <span className="text-textIceWhite font-mono font-black">{forecast.minRh.toFixed(0)}% - {forecast.maxRh.toFixed(0)}%</span>
        </div>
        <div className="text-right">
          <span>Peak Hx: </span>
          <span className={`font-mono font-black ${forecast.maxHumidex >= 40 ? 'text-stopRed' : forecast.maxHumidex >= 30 ? 'text-amberAlert' : 'text-textIceWhite'}`}>
            {forecast.maxHumidex.toFixed(1)}°C
          </span>
        </div>
      </div>
    </div>
  );
}

// Z5: Visibility & Pressure
export function VisibilityWidget({ data, hourlyData }) {
  if (!data) return null;

  const visibilityMeters = data.visibility || 10000;
  const visibilityKm = visibilityMeters / 1000;
  const pressure = data.pressure_msl || 1013.25;

  // Calculate trends compared to previous hour
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  
  const prevVisibilityMeters = (prevIdx >= 0 && hourlyData.visibility) ? hourlyData.visibility[prevIdx] : null;
  const prevVisibilityKm = prevVisibilityMeters !== null ? prevVisibilityMeters / 1000 : null;
  const visibilityTrend = getTrendIndicator(visibilityKm, prevVisibilityKm, 0.5);

  const prevPressure = (prevIdx >= 0 && hourlyData.pressure_msl) ? hourlyData.pressure_msl[prevIdx] : null;
  const pressureTrend = getTrendIndicator(pressure, prevPressure, 0.2);

  const getVisibilityStatus = (visKm) => {
    if (visKm < 1) return { label: 'FOG / SUSPEND OPS', color: 'text-stopRed font-bold animate-pulse' };
    if (visKm <= 5) return { label: 'HAZE / CAUTION', color: 'text-amberAlert' };
    return { label: 'CLEAR VISIBILITY', color: 'text-safetyGreen' };
  };

  const visStatus = getVisibilityStatus(visibilityKm);

  return (
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Header */}
      <div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
          Z5 • VISIBILITY & PRESSURE
        </p>
        <h2 className="text-xs font-bold text-slate-300 leading-none">Transit & Runway Safety</h2>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-between my-0.5 relative z-10">
        <div className="flex flex-col space-y-0.5">
          <p className="text-[8px] text-slate-400 font-bold uppercase leading-none">Visibility</p>
          <div className="flex items-center leading-none">
            <span className={`text-3xl font-black tracking-tight ${visibilityKm < 1 ? 'text-stopRed' : visibilityKm <= 5 ? 'text-amberAlert' : 'text-textIceWhite'}`}>
              {visibilityKm.toFixed(1)}
            </span>
            <span className="text-[12px] font-semibold text-slate-400 ml-0.5">km</span>
            {visibilityTrend.arrow && visibilityTrend.arrow !== '→' && (
              <span className={`text-[11px] ml-1.5 ${visibilityTrend.class}`}>{visibilityTrend.arrow}</span>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[8px] text-slate-400 font-bold uppercase leading-none">Barometer</p>
          <div className="flex items-center justify-end leading-none">
            <span className="text-2xl font-black tracking-tight text-textIceWhite">
              {pressure.toFixed(0)}
            </span>
            <span className="text-xs font-bold text-slate-400 ml-0.5">hPa</span>
          </div>
          <div className="flex items-center justify-end space-x-1 mt-0.5 leading-none">
            <span className="text-[8px] font-bold text-slate-400 uppercase">{pressureTrend.text}</span>
            <span className={`text-[9px] ${pressureTrend.class}`}>{pressureTrend.arrow}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700/30 pt-1.5 flex justify-between items-center">
        <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center space-x-0.5">
          <Eye className="w-3 h-3 text-slate-400" />
          <span>STATUS</span>
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${visStatus.color}`}>
          {visStatus.label}
        </span>
      </div>
    </div>
  );
}// Z6: UV Index
export function UvWidget({ data, hourlyData, dailyData, currentTime }) {
  if (!data) return null;

  const uv = data.uv_index !== undefined ? data.uv_index : 0;

  const getUvDetails = (index) => {
    if (index <= 2) return { label: 'LOW', color: 'bg-safetyGreen', textColor: 'text-safetyGreen', warning: 'Minimal hazard. Safe.' };
    if (index <= 5) return { label: 'MODERATE', color: 'bg-yellow-500', textColor: 'text-yellow-400', warning: 'Wear hat and sunscreen.' };
    if (index <= 7) return { label: 'HIGH', color: 'bg-amberAlert', textColor: 'text-amberAlert', warning: 'PPE & sunglasses mandatory.' };
    if (index <= 10) return { label: 'VERY HIGH', color: 'bg-stopRed', textColor: 'text-stopRed', warning: 'Limit direct sun exposure.' };
    return { label: 'EXTREME', color: 'bg-uvPurple animate-pulse', textColor: 'text-uvPurple font-bold animate-pulse', warning: 'Avoid sun 10 AM - 4 PM.' };
  };

  const details = getUvDetails(uv);

  // Calculate trends compared to previous hour
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  const prevUv = (prevIdx >= 0 && hourlyData.uv_index) ? hourlyData.uv_index[prevIdx] : null;
  const uvTrend = getTrendIndicator(uv, prevUv, 0.2); // 0.2 threshold

  // Helper to parse "2026-06-15T05:30", "12:30:00" or Date object
  const parseTimeStr = (str) => {
    if (!str) return { hour: 12, minute: 0, totalMinutes: 720 };
    if (str instanceof Date) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23'
      });
      const parts = formatter.formatToParts(str);
      const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
      const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
      return { hour: h, minute: m, totalMinutes: h * 60 + m };
    }
    const timePart = str.includes('T') ? str.split('T')[1] : str;
    const parts = timePart.split(':');
    const hour = parseInt(parts[0], 10) || 0;
    const minute = parseInt(parts[1], 10) || 0;
    return {
      hour,
      minute,
      totalMinutes: hour * 60 + minute
    };
  };

  const getDubaiDateString = (date) => {
    if (!date) return '2026-06-15';
    if (typeof date === 'string' && date.includes('T')) return date.slice(0, 10);
    if (typeof date === 'string') return date;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type).value;
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  };

  const currentDateStr = getDubaiDateString(currentTime || data.time);
  
  let dailyIdx = 0;
  if (dailyData && dailyData.time) {
    const idx = dailyData.time.findIndex(t => t.startsWith(currentDateStr));
    if (idx !== -1) dailyIdx = idx;
  }

  const sunriseStr = (dailyData && dailyData.sunrise && dailyData.sunrise[dailyIdx]) || `${currentDateStr}T05:30`;
  const sunsetStr = (dailyData && dailyData.sunset && dailyData.sunset[dailyIdx]) || `${currentDateStr}T19:05`;

  const sunriseTime = parseTimeStr(sunriseStr);
  const sunsetTime = parseTimeStr(sunsetStr);
  const currentTimeParsed = parseTimeStr(currentTime || data.time || '12:30:00');

  const formatTimeLabel = (input) => {
    const time = parseTimeStr(input);
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  };

  const sunriseLabel = formatTimeLabel(sunriseStr);
  const sunsetLabel = formatTimeLabel(sunsetStr);
  const nowLabel = formatTimeLabel(currentTime || data.time || '12:30:00');

  const getUvForHour = (hourNum) => {
    if (!hourlyData || !hourlyData.time || !hourlyData.uv_index) return 0;
    const hourStr = `${currentDateStr}T${String(hourNum).padStart(2, '0')}:00`;
    const idx = hourlyData.time.findIndex(t => t.startsWith(hourStr));
    if (idx !== -1) {
      return hourlyData.uv_index[idx] || 0;
    }
    return 0;
  };

  // Build the list of daylight points
  const pointsList = [];
  pointsList.push({ t: sunriseTime.totalMinutes, uv: 0 });

  for (let h = sunriseTime.hour + 1; h < sunsetTime.hour; h++) {
    pointsList.push({
      t: h * 60,
      uv: getUvForHour(h)
    });
  }

  pointsList.push({ t: sunsetTime.totalMinutes, uv: 0 });
  pointsList.sort((a, b) => a.t - b.t);

  const maxUv = Math.max(...pointsList.map(pt => pt.uv), 0.1);

  const duration = sunsetTime.totalMinutes - sunriseTime.totalMinutes;
  const currentMins = currentTimeParsed.totalMinutes;
  const isDaylight = currentMins >= sunriseTime.totalMinutes && currentMins <= sunsetTime.totalMinutes;

  const getInterpolatedUv = (targetMins, pts) => {
    if (pts.length === 0) return 0;
    if (targetMins <= pts[0].t) return pts[0].uv;
    if (targetMins >= pts[pts.length - 1].t) return pts[pts.length - 1].uv;
    
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (targetMins >= p1.t && targetMins <= p2.t) {
        const diff = p2.t - p1.t;
        if (diff === 0) return p1.uv;
        const pct = (targetMins - p1.t) / diff;
        return p1.uv + pct * (p2.uv - p1.uv);
      }
    }
    return 0;
  };

  let dotCx = 0;
  let dotCy = 68;
  let dotVal = 0;

  if (duration > 0) {
    if (isDaylight) {
      dotCx = ((currentMins - sunriseTime.totalMinutes) / duration) * 100;
      dotVal = getInterpolatedUv(currentMins, pointsList);
      dotCy = 68 - (dotVal / 12) * 24;
    } else {
      if (currentMins < sunriseTime.totalMinutes) {
        dotCx = 0;
      } else {
        dotCx = 100;
      }
      dotVal = 0;
      dotCy = 68;
    }
  }

  const points = pointsList.map(pt => {
    const x = duration > 0 ? ((pt.t - sunriseTime.totalMinutes) / duration) * 100 : 0;
    const y = 68 - (pt.uv / 12) * 24;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L 100,68 L 0,68 Z`;

  const dynamicIntervals = calculateSunscreenIntervals(uv);

  return (
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
          Z6 • UV RADIATION
        </p>
        <h2 className="text-sm font-bold text-slate-200 leading-none">Skin Safety Monitor</h2>
      </div>

      {/* Main Content with Progressive Sparkline Stacked */}
      <div className="flex flex-col space-y-2.5 my-1.5 relative z-10 flex-grow justify-around">
        {/* Top Metric Stats */}
        <div className="flex justify-between items-center w-full">
          {/* Current Index */}
          <div className="flex flex-col">
            <p className="text-[9px] text-slate-400 font-bold uppercase leading-none mb-1">Current Index</p>
            <div className="flex items-center leading-none">
              <span className={`text-5xl font-black tracking-tight ${details.textColor}`}>
                {uv.toFixed(1)}
              </span>
              {uvTrend.arrow && uvTrend.arrow !== '→' && (
                <span className={`text-[10px] ml-2 flex items-center space-x-0.5 ${uvTrend.class} bg-bgDeepSpace/60 border border-slate-800/40 px-1.5 py-0.5 rounded`}>
                  <span>{uvTrend.arrow}</span>
                  <span className="text-[8px] font-black uppercase tracking-wider">{uvTrend.text}</span>
                </span>
              )}
            </div>
          </div>
          {/* Projected Peak */}
          <div className="text-right">
            <p className="text-[9px] text-slate-400 font-bold uppercase leading-none mb-1">PROG PEAK</p>
            <div className="flex items-baseline justify-end leading-none">
              <span className="text-2xl font-black text-amber-400">
                {maxUv.toFixed(1)}
              </span>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Today's Peak</p>
          </div>
        </div>

        {/* Extended Progressive Chart (Stretches to fill container with Y-axis & X-axis labels) */}
        <div className="w-full h-[120px] flex flex-col justify-end mt-1 select-none">
          <div className="w-full flex-grow relative flex items-end">
            <div className="flex-1 h-full relative overflow-visible">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 70" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="uvChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E87722" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#E87722" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Guidelines representing Moderate (3), Very High (8), Extreme (11) */}
                <line x1="0" y1="62" x2="100" y2="62" stroke="#eab308" strokeWidth="0.2" strokeDasharray="1.5,1.5" opacity="0.5" />
                <text x="1" y="60.5" fill="#eab308" fontSize="2.8" fontWeight="bold">MOD (3)</text>

                <line x1="0" y1="52" x2="100" y2="52" stroke="#ef4444" strokeWidth="0.2" strokeDasharray="1.5,1.5" opacity="0.5" />
                <text x="1" y="50.5" fill="#ef4444" fontSize="2.8" fontWeight="bold">V.HIGH (8)</text>

                <line x1="0" y1="46" x2="100" y2="46" stroke="#a855f7" strokeWidth="0.2" strokeDasharray="1.5,1.5" opacity="0.5" />
                <text x="1" y="44.5" fill="#a855f7" fontSize="2.8" fontWeight="bold">EXTREME (11)</text>

                <path d={areaD} fill="url(#uvChartFill)" />
                <path d={pathD} fill="none" stroke="#E87722" strokeWidth="1.8" strokeLinecap="round" />
                {isDaylight && (
                  <>
                    <circle 
                      cx={dotCx} 
                      cy={dotCy} 
                      r="2.5" 
                      fill="#E87722" 
                      stroke="#F8FAFC" 
                      strokeWidth="0.6" 
                      className="animate-ping" 
                      style={{ transformOrigin: `${dotCx}% ${dotCy}%`, animationDuration: '3s' }} 
                    />
                    <circle 
                      cx={dotCx} 
                      cy={dotCy} 
                      r="1.8" 
                      fill="#E87722" 
                      stroke="#F8FAFC" 
                      strokeWidth="0.5" 
                    />
                  </>
                )}
              </svg>
            </div>
          </div>
          
          {/* X-Axis Labels */}
          <div className="w-full flex flex-row items-center pt-1 text-[8px] font-bold text-slate-400 relative border-t border-slate-800/40 mt-1">
            <div className="flex-1 h-6 relative">
              {/* Sunrise label */}
              {dotCx >= 15 && (
                <span className="absolute left-0 top-1 text-slate-500 flex flex-col items-start leading-tight">
                  <span className="text-[6.5px] uppercase text-slate-600">Sunrise</span>
                  <span className="font-mono">{sunriseLabel}</span>
                </span>
              )}
              
              {/* Dynamic NOW tracker label */}
              <span 
                className="absolute top-1 text-edgeOrange flex flex-col items-center leading-tight whitespace-nowrap" 
                style={{ left: `${dotCx}%`, transform: 'translateX(-50%)' }}
              >
                <span className="text-[6.5px] uppercase text-edgeOrange/70">{isDaylight ? 'Current' : 'Night'}</span>
                <span className="font-mono font-black">{isDaylight ? `NOW (${nowLabel})` : 'SHUTDOWN'}</span>
              </span>
              
              {/* Sunset label */}
              {dotCx <= 85 && (
                <span className="absolute right-0 top-1 text-slate-500 flex flex-col items-end leading-tight">
                  <span className="text-[6.5px] uppercase text-slate-600">Sunset</span>
                  <span className="font-mono">{sunsetLabel}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SPF Application Guidelines */}
      <div className="bg-bgDeepSpace/40 border border-slate-800/60 rounded p-2 text-[10px] font-bold text-slate-400 space-y-1 select-none z-10 leading-tight">
        <div className="flex justify-between items-center mb-1.5 border-b border-slate-800/30 pb-1">
          <p className="text-[9px] text-edgeOrange uppercase tracking-wide leading-none font-black">SPF REAPPLICATION PROTOCOL:</p>
          {uv >= 3 && (
            <span className="text-[8.5px] text-amberAlert uppercase font-black tracking-wider animate-pulse">
              ({Math.round((1 - (dynamicIntervals.spf50 / 120)) * 100)}% shorter)
            </span>
          )}
        </div>
        <div className="flex justify-between border-b border-slate-800/20 pb-0.5">
          <span>SPF 10 (Light Gear)</span>
          <span className="text-textIceWhite font-mono font-black">Every {dynamicIntervals.spf10}m</span>
        </div>
        <div className="flex justify-between border-b border-slate-800/20 pb-0.5">
          <span>SPF 30 (Field Ops)</span>
          <span className="text-textIceWhite font-mono font-black">Every {dynamicIntervals.spf30}m</span>
        </div>
        <div className="flex justify-between">
          <span>SPF 50 (Max Cover)</span>
          <span className="text-textIceWhite font-mono font-black">Every {dynamicIntervals.spf50}m</span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700/30 pt-2 flex flex-col space-y-1 relative z-10">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center space-x-0.5">
            <Sun className="w-3.5 h-3.5 text-slate-400" />
            <span>RISK LEVEL</span>
          </span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${details.textColor}`}>
            {details.label}
          </span>
        </div>
        <p className="text-[9px] text-slate-400 leading-tight font-semibold italic text-right">
          {details.warning}
        </p>
      </div>
    </div>
  );
}

export function HydrationWidget({ data }) {
  if (!data) return null;

  const temp = data.temperature_2m || 0;
  const rh = data.relative_humidity_2m || 0;

  // Calculate dew point and humidex
  const calculateDewPointLocal = (tempVal, rhVal) => {
    const a = 17.625;
    const b = 243.04;
    const alpha = ((a * tempVal) / (b + tempVal)) + Math.log(rhVal / 100);
    return Number(((b * alpha) / (a - alpha)).toFixed(1));
  };
  
  const calculateHumidexLocal = (tempVal, dewPointVal) => {
    const e = 6.11 * Math.exp(5417.7530 * (1/273.16 - 1/(dewPointVal + 273.15)));
    return Number((tempVal + 0.5555 * (e - 10.0)).toFixed(1));
  };

  const dewPoint = calculateDewPointLocal(temp, rh);
  const humidex = calculateHumidexLocal(temp, dewPoint);

  const getHydrationInfo = (hx) => {
    if (hx < 30) {
      return { 
        volume: "0.50 L", 
        note: "Routine water intake.", 
        color: "text-safetyGreen", 
        level: "LOW EXPOSURE" 
      };
    }
    if (hx < 40) {
      return { 
        volume: "0.75 L", 
        note: "Keep chilled water nearby.", 
        color: "text-yellow-400", 
        level: "MODERATE RISK" 
      };
    }
    if (hx < 46) {
      return { 
        volume: "1.00 L", 
        note: "Chilled water + Electrolyte mix.", 
        color: "text-amberAlert", 
        level: "HIGH RISK" 
      };
    }
    return { 
      volume: "1.25 L", 
      note: "Electrolyte mix mandatory.", 
      color: "text-stopRed font-bold animate-pulse", 
      level: "EXTREME DANGER" 
    };
  };

  const hydration = getHydrationInfo(humidex);

  return (
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl py-2 px-3 flex flex-col justify-between select-none relative overflow-hidden">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
            Z12 • HYDRATION DIRECTIVE
          </p>
          <h2 className="text-xs font-bold text-slate-200 leading-none">ADOSH Heat Stress Code</h2>
        </div>
        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-current leading-none ${hydration.color}`}>
          {hydration.level}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-between my-1 relative z-10">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-black text-textIceWhite tracking-tight leading-none">
            {hydration.volume}
          </span>
          <span className="text-[9.5px] font-bold text-slate-400 uppercase leading-none mt-0.5">/ Hour</span>
        </div>
        <div className="text-right">
          <p className="text-[7.5px] text-slate-400 font-bold uppercase leading-none mb-0.5">Humidex</p>
          <p className="text-xs font-black text-textIceWhite leading-none">
            {humidex.toFixed(1)}°C
          </p>
        </div>
      </div>

      {/* Footer / Advisory Note */}
      <p className="text-[8.5px] font-semibold text-slate-350 leading-tight relative z-10">
        💡 {hydration.note}
      </p>
    </div>
  );
}

