import React from 'react';
import { Droplets, Eye, Sun, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { calculateDewPoint, calculateHumidex, getHumidexComfort, getTrendIndicator, calculateSunscreenIntervals, calculateWBGT, getWBGTComfort, evaluateHeatStress } from '../utils/safetyEngine';

// Z4: Humidity, Dew Point & Humidex
export function HumidityWidget({ data, hourlyData }) {
  if (!data) return null;

  const temp = data.temperature_2m || 0;
  const rh = data.relative_humidity_2m || 0;
  const wind = data.wind_speed_10m || 0;
  const uv = data.uv_index !== undefined ? data.uv_index : 0;
  const solar = data.solar_radiation ?? null;
  const feelsLike = data.apparent_temperature ?? null;

  const heatStress = evaluateHeatStress(temp, rh, wind, uv, solar, feelsLike);
  const dewPoint = heatStress.dewPoint;
  const wbgt = heatStress.wbgt;
  const comfort = getWBGTComfort(wbgt, temp, feelsLike);

  // Locate current hour index in hourlyData
  const getCurHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    return hourlyData.time.findIndex(t => t.startsWith(curHourStr));
  };

  const curIdx = getCurHourIdx();
  const prevIdx = curIdx > 0 ? curIdx - 1 : -1;
  const prevRh = prevIdx >= 0 ? hourlyData.relative_humidity_2m[prevIdx] : null;
  const rhTrend = getTrendIndicator(rh, prevRh, 1.0);

  let prevWbgt = null;
  if (prevIdx >= 0 && hourlyData.temperature_2m && hourlyData.relative_humidity_2m) {
    const prevTemp = hourlyData.temperature_2m[prevIdx];
    const prevRhVal = hourlyData.relative_humidity_2m[prevIdx];
    const prevWindVal = hourlyData.wind_speed_10m ? hourlyData.wind_speed_10m[prevIdx] : 0;
    const prevUvVal = hourlyData.uv_index ? hourlyData.uv_index[prevIdx] : 0;
    const prevSolarVal = hourlyData.solar_radiation ? hourlyData.solar_radiation[prevIdx] : null;
    prevWbgt = calculateWBGT(prevTemp, prevRhVal, prevWindVal, prevUvVal, prevSolarVal);
  }
  const wbgtTrend = getTrendIndicator(wbgt, prevWbgt, 0.1);

  const getHumidityColor = (humidity) => {
    if (humidity >= 85) return 'text-stopRed';
    if (humidity >= 60) return 'text-amberAlert';
    return 'text-textIceWhite';
  };

  // Helper to calculate 24h Humidity/WBGT Forecast starting from current hour
  const getHumidityForecast = () => {
    if (!hourlyData || !hourlyData.relative_humidity_2m || !hourlyData.temperature_2m) {
      return {
        minRh: rh * 0.8,
        maxRh: Math.min(rh * 1.3, 100),
        maxWbgt: wbgt * 1.05
      };
    }
    
    const startIdx = curIdx >= 0 ? curIdx : 48;
    const rhList = hourlyData.relative_humidity_2m.slice(startIdx, startIdx + 24);
    const tempList = hourlyData.temperature_2m.slice(startIdx, startIdx + 24);
    
    const minRh = rhList.length ? Math.min(rh, ...rhList) : rh;
    const maxRh = rhList.length ? Math.max(rh, ...rhList) : rh;
    
    let maxWbgt = wbgt;
    for (let i = 0; i < tempList.length; i++) {
      const idx = startIdx + i;
      const hTemp = tempList[i];
      const hRh = rhList[i];
      const hWind = hourlyData.wind_speed_10m ? (hourlyData.wind_speed_10m[idx] || 0) : 0;
      const hUv = hourlyData.uv_index ? (hourlyData.uv_index[idx] || 0) : 0;
      const hSolar = hourlyData.solar_radiation ? hourlyData.solar_radiation[idx] : null;
      const hWbgt = calculateWBGT(hTemp, hRh, hWind, hUv, hSolar);
      if (hWbgt > maxWbgt) {
        maxWbgt = hWbgt;
      }
    }
    
    return {
      minRh,
      maxRh,
      maxWbgt
    };
  };

  const forecast = getHumidityForecast();

  const cycle = {
    ratio: heatStress.workRestRatio,
    color: heatStress.color,
    law: heatStress.law
  };

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl py-3 px-3.5 flex flex-col justify-between relative overflow-hidden select-none backdrop-blur-md shadow-lg">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
            Z4 • HUMIDITY & DEW POINT
          </p>
          <h2 className="text-sm font-bold text-slate-200 leading-none">Heat Stress Metrics</h2>
        </div>
        <span className={`text-[8px] font-black font-mono uppercase px-1.5 py-0.5 rounded border leading-none ${heatStress.badgeColor}`}>
          💧 {heatStress.volumePerHour}
        </span>
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
          <p className="text-[9.5px] text-slate-400 font-bold uppercase leading-none">WBGT Index</p>
          <div className="flex items-center justify-end leading-none">
            <span className="text-3xl font-black tracking-tight text-textIceWhite">
              {wbgt.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-edgeOrange ml-0.5">°C</span>
            {wbgtTrend.arrow && wbgtTrend.arrow !== '→' && (
              <span className={`text-[11px] ml-1.5 ${wbgtTrend.class}`}>{wbgtTrend.arrow}</span>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-300 block mt-0.5 truncate">
            Dry Bulb: {temp.toFixed(1)}°C • Dew Pt: {dewPoint.toFixed(1)}°C
          </span>
        </div>
      </div>

      {/* UAE MoHRE Work/Rest Split & Translated Water Intake */}
      <div className="border-t border-slate-800/40 pt-1.5 pb-1 relative z-10 flex flex-col space-y-0.5">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase leading-none">
          <span className="text-slate-450">Work/Rest (MoHRE)</span>
          <span className={`${cycle.color} font-black tracking-wide`}>{cycle.ratio}</span>
        </div>
        <div className="flex justify-between items-center text-[7.5px] text-slate-400 uppercase leading-none">
          <span>Comfort: <span className={`font-black uppercase ${comfort.color}`}>{comfort.label}</span></span>
          <span className="font-mono font-black text-cyan-300">{heatStress.cupSchedule}</span>
        </div>
      </div>

      {/* Forecast Details */}
      <div className="border-t border-slate-700/30 pt-1.5 flex justify-between items-center relative z-10 text-[9px] font-bold text-slate-400 uppercase leading-none">
        <div>
          <span>24H Range: </span>
          <span className="text-textIceWhite font-mono font-black">{forecast.minRh.toFixed(0)}% - {forecast.maxRh.toFixed(0)}%</span>
        </div>
        <div className="text-right">
          <span>Peak WBGT: </span>
          <span className={`font-mono font-black ${forecast.maxWbgt >= 30.5 ? 'text-amberAlert' : forecast.maxWbgt >= 27.9 ? 'text-yellow-400' : 'text-textIceWhite'}`}>
            {forecast.maxWbgt.toFixed(1)}°C
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
  const dust = data.dust !== undefined && data.dust !== null ? Number(data.dust) : null;

  const getVisibilityStatus = (visKm) => {
    if (visKm < 1) {
      return {
        label: dust && dust >= 120 ? 'DUST STORM / SUSPEND' : 'FOG / SUSPEND OPS',
        color: 'text-stopRed font-bold animate-pulse'
      };
    }
    if (visKm <= 5) {
      return {
        label: dust && dust >= 60 ? 'BLOWING DUST / CAUTION' : 'HAZE / CAUTION',
        color: 'text-amberAlert'
      };
    }
    return { label: 'CLEAR VISIBILITY', color: 'text-safetyGreen' };
  };

  const visStatus = getVisibilityStatus(visibilityKm);

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden select-none backdrop-blur-md shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
            Z5 • VISIBILITY & PRESSURE
          </p>
          <h2 className="text-xs font-bold text-slate-300 leading-none">Transit & Runway Safety</h2>
        </div>
        {dust !== null && (
          <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-900/80 border border-slate-800 px-1.5 py-0.5 rounded leading-none">
            DUST {dust.toFixed(0)} µg/m³
          </span>
        )}
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
    if (str instanceof Date || (typeof str === 'string' && (str.includes('Z') || /[+-]\d{2}:\d{2}$/.test(str)))) {
      const d = str instanceof Date ? str : new Date(str);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23'
      });
      const parts = formatter.formatToParts(d);
      const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
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

  const maxUv = Math.max(uv, ...pointsList.map(pt => pt.uv), 0.1);

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
  let dotCy = 65;
  let dotVal = 0;

  if (duration > 0) {
    if (isDaylight) {
      dotCx = ((currentMins - sunriseTime.totalMinutes) / duration) * 100;
      dotVal = getInterpolatedUv(currentMins, pointsList);
      dotCy = 65 - (Math.min(13, dotVal) / 13) * 33;
    } else {
      if (currentMins < sunriseTime.totalMinutes) {
        dotCx = 0;
      } else {
        dotCx = 100;
      }
      dotVal = 0;
      dotCy = 65;
    }
  }

  const points = pointsList.map(pt => {
    const x = duration > 0 ? ((pt.t - sunriseTime.totalMinutes) / duration) * 100 : 0;
    const y = 65 - (Math.min(13, pt.uv) / 13) * 33;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L 100,65 L 0,65 Z`;

  const dynamicIntervals = calculateSunscreenIntervals(uv);
  const clampedDotX = Math.max(4, Math.min(96, dotCx));
  const dotTopPct = Math.max(38, Math.min(93, (dotCy / 70) * 100));
  const pillTranslateX = clampedDotX < 20 ? '-10%' : clampedDotX > 80 ? '-90%' : '-50%';

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden select-none backdrop-blur-md shadow-lg">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
            Z6 • UV RADIATION
          </p>
          <h2 className="text-xs font-bold text-slate-200 leading-none mb-1.5">Skin Safety Monitor</h2>
          <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border border-current leading-none ${details.textColor}`}>
            {details.label}
          </span>
        </div>
        <div className="text-right leading-none">
          <p className="text-[8.5px] text-slate-300 font-bold uppercase leading-none mb-1">Today&apos;s Peak</p>
          <span className="text-2xl font-black text-amber-400 leading-none tracking-tight">
            {maxUv.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Main Content with Progressive Sparkline & Curve-Following Current UV Level */}
      <div className="flex flex-col my-1 relative z-10 flex-grow justify-end">
        {/* Refined Progressive Chart with Non-Scaling Stroke */}
        <div className="w-full h-[110px] flex flex-col justify-end relative select-none">
          <div className="w-full flex-grow relative flex items-end">
            <div className="flex-1 h-full relative overflow-visible">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 70" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="uvChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                    <stop offset="85%" stopColor="#f97316" stopOpacity="0.03" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle Reference Threshold Lines mapped to 65 - (uv / 13) * 33 */}
                <line x1="0" y1="57.4" x2="100" y2="57.4" stroke="#eab308" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="44.7" x2="100" y2="44.7" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="37.1" x2="100" y2="37.1" stroke="#c084fc" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" vectorEffect="non-scaling-stroke" />

                <path d={areaD} fill="url(#uvChartFill)" />
                {/* Soft ambient glow line underneath */}
                <path d={pathD} fill="none" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" vectorEffect="non-scaling-stroke" />
                {/* Crisp refined foreground line */}
                <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>

              {/* Crisp Unstretched HTML Threshold Labels */}
              <span className="absolute left-1 top-[47%] -translate-y-full text-[8.5px] font-mono font-bold text-purple-300/80 pointer-events-none leading-none">
                EXT 11
              </span>
              <span className="absolute left-1 top-[61%] -translate-y-full text-[8.5px] font-mono font-bold text-red-400/80 pointer-events-none leading-none">
                V.HIGH 8
              </span>
              <span className="absolute left-1 top-[80%] -translate-y-full text-[8.5px] font-mono font-bold text-yellow-400/80 pointer-events-none leading-none">
                MOD 3
              </span>

              {/* Curve-Following Dot + Large Readable Current UV Number */}
              <div 
                className="absolute pointer-events-none z-20"
                style={{ left: `${clampedDotX}%`, top: `${dotTopPct}%` }}
              >
                {/* Floating Current UV Exposure Number (Slightly smaller than old text-4xl -> text-2xl/3xl) */}
                <div
                  className="absolute bottom-3 flex items-baseline space-x-1 bg-slate-950/90 border border-orange-500/50 rounded-lg px-2 py-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.85)] whitespace-nowrap backdrop-blur-sm"
                  style={{ transform: `translateX(${pillTranslateX})` }}
                >
                  <span className={`text-2xl xl:text-3xl font-black tracking-tight leading-none ${details.textColor}`}>
                    {uv.toFixed(1)}
                  </span>
                  {uvTrend.arrow && uvTrend.arrow !== '→' && (
                    <span className={`text-xs font-black leading-none ${uvTrend.class}`}>
                      {uvTrend.arrow}
                    </span>
                  )}
                </div>

                {/* Round Dot on the Curve */}
                <div className="-translate-x-1/2 -translate-y-1/2 relative">
                  {isDaylight && (
                    <div className="w-4 h-4 rounded-full bg-orange-500/35 animate-ping absolute inset-0 -m-0.5" />
                  )}
                  <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-md relative" />
                </div>
              </div>
            </div>
          </div>
          
          {/* X-Axis Labels */}
          <div className="w-full flex flex-row items-center pt-1 text-[9.5px] font-bold text-slate-300 relative border-t border-slate-800/60 mt-0.5">
            <div className="flex-1 h-4 relative">
              {/* Sunrise label */}
              {dotCx >= 15 && (
                <span className="absolute left-0 top-0 text-slate-400 font-mono font-bold">
                  {sunriseLabel}
                </span>
              )}
              
              {/* Dynamic NOW tracker label */}
              <span 
                className="absolute top-0 text-edgeOrange font-mono font-black text-[10px] whitespace-nowrap" 
                style={{ left: `${dotCx}%`, transform: 'translateX(-50%)' }}
              >
                {isDaylight ? nowLabel : 'NIGHT'}
              </span>
              
              {/* Sunset label */}
              {dotCx <= 85 && (
                <span className="absolute right-0 top-0 text-slate-400 font-mono font-bold">
                  {sunsetLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Structured SPF Application Guidelines (3-Column Tactical Badges) */}
      <div className="bg-bgDeepSpace/50 border border-slate-800/80 rounded-lg p-2 text-[9px] select-none z-10 space-y-1 mt-1">
        <div className="flex justify-between items-center border-b border-slate-800/40 pb-1">
          <span className="text-[8.5px] text-edgeOrange font-black uppercase tracking-wider">SPF Reapplication Interval</span>
          {uv >= 3 && (
            <span className="text-[8px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1 py-0.2 rounded font-black tracking-wide uppercase">
              Heavy Solar Load
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-slate-900/60 border border-slate-800/60 rounded px-1 py-0.5 flex flex-col">
            <span className="text-[8px] text-slate-300 font-bold uppercase">SPF 10</span>
            <span className="text-xs font-mono font-black text-slate-100">{dynamicIntervals.spf10}m</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/60 rounded px-1 py-0.5 flex flex-col">
            <span className="text-[8px] text-slate-300 font-bold uppercase">SPF 30</span>
            <span className="text-xs font-mono font-black text-amber-400">{dynamicIntervals.spf30}m</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/60 rounded px-1 py-0.5 flex flex-col">
            <span className="text-[8px] text-slate-300 font-bold uppercase">SPF 50+</span>
            <span className="text-xs font-mono font-black text-orange-400">{dynamicIntervals.spf50}m</span>
          </div>
        </div>
      </div>
      {/* Compact Advisory Footer */}
      <div className="border-t border-slate-800/50 pt-1 flex justify-between items-center text-[8px] text-slate-500 font-medium select-none z-10">
        <span>* CAMS Direct Solar UV Index</span>
        <span className="text-slate-400 italic font-semibold truncate max-w-[60%] text-right">{details.warning}</span>
      </div>
    </div>
  );
}

export function HydrationWidget({ data }) {
  if (!data) return null;

  const temp = data.temperature_2m || 0;
  const rh = data.relative_humidity_2m || 0;
  const wind = data.wind_speed_10m || 0;
  const uv = data.uv_index !== undefined ? data.uv_index : 0;
  const feelsLike = data.apparent_temperature ?? null;

  const heatStress = evaluateHeatStress(temp, rh, wind, uv, data.solar_radiation ?? null, feelsLike);
  const wbgt = heatStress.wbgt;

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl py-2 px-3 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md shadow-lg">
      {/* Decorative Grid Line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
            Z12 • HYDRATION DIRECTIVE {data.sectorTitle ? `• ${data.sectorTitle.replace('X-Range ', '').replace('Range ', '').toUpperCase()}` : ''}
          </p>
          <h2 className="text-xs font-bold text-slate-200 leading-none">ADOSH Heat Stress Code</h2>
        </div>
        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-current leading-none ${heatStress.color}`}>
          {heatStress.level}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-between my-1 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-textIceWhite tracking-tight leading-none">
              {heatStress.volume}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 uppercase leading-none">/ Hour</span>
          </div>
          <span className="text-[8px] font-mono font-bold text-cyan-300 mt-0.5 leading-none">
            {heatStress.cupSchedule}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[7.5px] text-slate-400 font-bold uppercase leading-none mb-0.5">Thermal Load</p>
          <p className="text-xs font-black text-textIceWhite leading-none">
            WBGT {wbgt.toFixed(1)}°C
          </p>
          <p className="text-[8px] font-mono font-bold text-slate-400 mt-0.5 leading-none">
            Shade {temp.toFixed(1)}°C
          </p>
        </div>
      </div>

      {/* Footer / Advisory Note */}
      <div className="border-t border-slate-800/50 pt-1 flex items-center justify-between text-[8px] font-semibold text-slate-300 leading-tight relative z-10">
        <span className="truncate">💡 {heatStress.note}</span>
      </div>
    </div>
  );
}

