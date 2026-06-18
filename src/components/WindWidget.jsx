import React from 'react';
import { Navigation } from 'lucide-react';
import { getTrendIndicator, getWindShiftIndicator } from '../utils/safetyEngine';

export function getBeaufortScale(speedKmh) {
  if (speedKmh < 1) return "0: Calm";
  if (speedKmh <= 5) return "1: Light Air";
  if (speedKmh <= 11) return "2: Light Breeze";
  if (speedKmh <= 19) return "3: Gentle Breeze";
  if (speedKmh <= 28) return "4: Moderate Breeze";
  if (speedKmh <= 38) return "5: Fresh Breeze";
  if (speedKmh <= 49) return "6: Strong Breeze";
  if (speedKmh <= 61) return "7: Near Gale";
  if (speedKmh <= 74) return "8: Gale";
  if (speedKmh <= 88) return "9: Strong Gale";
  return "10+: Storm";
}

export function getCardinalDirection(degrees) {
  const sectors = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return sectors[index];
}

export default function WindWidget({ data, hourlyData, currentTime }) {
  if (!data) return null;

  const windSpeed = data.wind_speed_10m || 0;
  const gusts = data.wind_gusts_10m || 0;
  const directionDegrees = data.wind_direction_10m || 0;

  const cardinal = getCardinalDirection(directionDegrees);
  const beaufort = getBeaufortScale(windSpeed);

  // Calculate trends
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  const prevWindSpeed = prevIdx >= 0 ? hourlyData.wind_speed_10m[prevIdx] : null;
  const windTrend = getTrendIndicator(windSpeed, prevWindSpeed, 1.0);

  const prevGusts = prevIdx >= 0 ? hourlyData.wind_gusts_10m[prevIdx] : null;
  const gustsTrend = getTrendIndicator(gusts, prevGusts, 1.0);

  const prevWindDir = prevIdx >= 0 ? hourlyData.wind_direction_10m[prevIdx] : null;
  const isCurrentlyShifting = prevWindDir !== null ? getWindShiftIndicator(directionDegrees, prevWindDir) === 'Shifting' : false;

  // Determine alert status color for wind values
  const getWindColor = (speed, isGust) => {
    const limit = isGust ? 50 : 38;
    const warning = isGust ? 20 : 20;
    if (speed >= limit) return 'text-stopRed';
    if (speed >= warning) return 'text-amberAlert';
    return 'text-textIceWhite';
  };

  // Helper to get 24h wind statistics
  const getWindForecast = () => {
    if (!hourlyData || !hourlyData.wind_speed_10m || !hourlyData.wind_direction_10m) {
      return {
        minSpeed: windSpeed * 0.7,
        maxSpeed: windSpeed * 1.3 + 4,
        startDir: directionDegrees,
        endDir: (directionDegrees + 45) % 360,
        isShifting: true,
        shiftingText: `Shifting ${getCardinalDirection(directionDegrees)} to ${getCardinalDirection((directionDegrees + 45) % 360)}`
      };
    }
    
    const speeds = hourlyData.wind_speed_10m.slice(0, 24);
    const directions = hourlyData.wind_direction_10m.slice(0, 24);
    
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    
    const startDir = directions[0] || 0;
    const endDir = directions[directions.length - 1] || 0;
    
    const startCardinal = getCardinalDirection(startDir);
    const endCardinal = getCardinalDirection(endDir);
    
    const diff = Math.abs(startDir - endDir);
    const isShifting = diff > 20 && diff < 340;
    const shiftingText = isShifting 
      ? `Shifting ${startCardinal} to ${endCardinal}`
      : `Steady ${startCardinal}`;
      
    return {
      minSpeed,
      maxSpeed,
      startDir,
      endDir,
      isShifting,
      shiftingText
    };
  };

  const forecast = getWindForecast();

  const getForecastWedgePath = (startAngle, endAngle) => {
    const startRad = ((startAngle + 180) * Math.PI) / 180;
    const endRad = ((endAngle + 180) * Math.PI) / 180;
    
    const cx = 25;
    const cy = 25;
    const r = 18;
    
    const x1 = cx + r * Math.sin(startRad);
    const y1 = cy - r * Math.cos(startRad);
    const x2 = cx + r * Math.sin(endRad);
    const y2 = cy - r * Math.cos(endRad);
    
    let diff = (endAngle - startAngle + 360) % 360;
    const largeArcFlag = 0; // Always use the shortest path (<= 180)
    const sweepFlag = diff <= 180 ? 1 : 0;
    
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${x2} ${y2} Z`;
  };
  
  const wedgePath = forecast ? getForecastWedgePath(forecast.startDir, forecast.endDir) : null;

  // Calculate current hour index in hourlyData for the 12h forecast
  const getCurHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    return hourlyData.time.findIndex(t => t.startsWith(curHourStr));
  };

  const curIdx = getCurHourIdx();
  const startIdx = curIdx >= 0 ? curIdx : 0;

  const windForecast12h = [];
  if (hourlyData && hourlyData.time && hourlyData.wind_speed_10m) {
    for (let i = 0; i < 12; i++) {
      const idx = startIdx + i;
      if (idx < hourlyData.time.length) {
        const timeStr = hourlyData.time[idx];
        const speed = hourlyData.wind_speed_10m[idx] || 0;
        const gust = hourlyData.wind_gusts_10m ? (hourlyData.wind_gusts_10m[idx] || 0) : 0;
        const hour = timeStr.includes('T') ? timeStr.split('T')[1].slice(0, 2) : '00';
        windForecast12h.push({
          hour: `${hour}:00`,
          speed,
          gust
        });
      }
    }
  }

  const speedPoints = windForecast12h.map((d, i) => `${(15 + i * 9.545).toFixed(2)},${(52 - (d.speed / 60) * 44).toFixed(2)}`);
  const speedPathD = windForecast12h.length > 0 ? `M ${speedPoints.join(' L ')}` : 'M 15,52 L 120,52';
  const speedAreaD = `${speedPathD} L 120,52 L 15,52 Z`;

  const gustPoints = windForecast12h.map((d, i) => `${(15 + i * 9.545).toFixed(2)},${(52 - (d.gust / 60) * 44).toFixed(2)}`);
  const gustPathD = windForecast12h.length > 0 ? `M ${gustPoints.join(' L ')}` : 'M 15,52 L 120,52';
  const gustAreaD = `${gustPathD} L 120,52 L 15,52 Z`;

  return (
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Header */}
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
          Z3 • WIND & GUSTS
        </p>
        <h2 className="text-sm font-bold text-slate-200 leading-none">ADOSH Safety Limits</h2>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-2 items-center my-0.5 relative z-10">
        
        {/* Column 1 (Col-span-4): Readings */}
        <div className="col-span-4 flex flex-col justify-around h-full space-y-2 pr-1 border-r border-slate-800/40">
          <div>
            <p className="text-[8px] text-slate-400 font-bold uppercase leading-none mb-1">Sustained</p>
            <div className="flex items-center leading-none">
              <span className={`text-3xl font-black tracking-tight ${getWindColor(windSpeed, false)}`}>
                {windSpeed.toFixed(0)}
              </span>
              <span className="text-[9px] font-semibold text-slate-500 ml-1">km/h</span>
              {windTrend.arrow && windTrend.arrow !== '→' && (
                <span className={`text-[10px] ml-1.5 ${windTrend.class}`}>{windTrend.arrow}</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[8px] text-slate-400 font-bold uppercase leading-none mb-1">Peak Gusts</p>
            <div className="flex items-center leading-none">
              <span className={`text-3xl font-black tracking-tight ${getWindColor(gusts, true)}`}>
                {gusts.toFixed(0)}
              </span>
              <span className="text-[9px] font-semibold text-slate-500 ml-1">km/h</span>
              {gustsTrend.arrow && gustsTrend.arrow !== '→' && (
                <span className={`text-[10px] ml-1.5 ${gustsTrend.class}`}>{gustsTrend.arrow}</span>
              )}
            </div>
          </div>
        </div>

        {/* Column 2 (Col-span-4): Current Compass */}
        <div className="col-span-4 flex flex-col items-center justify-center border-r border-slate-800/60 pr-1">
          <span className="text-[8px] font-black text-slate-400 uppercase mb-1 leading-none">CURRENT</span>
          <div className="relative w-[84px] h-[84px] border border-slate-700/80 rounded-full flex items-center justify-center bg-bgDeepSpace/20 shadow-inner">
            {/* Compass Card Marks */}
            <span className="absolute top-1 text-[8px] font-black text-slate-500">N</span>
            <span className="absolute right-1.5 text-[8px] font-black text-slate-500">E</span>
            <span className="absolute bottom-1 text-[8px] font-black text-slate-500">S</span>
            <span className="absolute left-1.5 text-[8px] font-black text-slate-500">W</span>
            
            {/* Dynamic Arrow */}
            <div 
              style={{ transform: `rotate(${(directionDegrees + 180) % 360}deg)` }}
              className="transition-transform duration-500 ease-out flex items-center justify-center w-full h-full"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-edgeOrange fill-none stroke-current animate-pulse-slow" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="4" />
                <polyline points="7,9 12,4 17,9" />
              </svg>
            </div>
          </div>
          <span className="text-[9px] font-mono font-black text-slate-200 mt-1 uppercase leading-none truncate w-full text-center">
            {cardinal} • {directionDegrees}°
          </span>
          <span className={`text-[8px] font-black px-1.5 py-0.5 mt-1 rounded uppercase tracking-wider ${
            isCurrentlyShifting 
              ? 'bg-stopRed/20 text-stopRed border border-stopRed/40 animate-pulse' 
              : 'bg-safetyGreen/10 text-safetyGreen border border-safetyGreen/30'
          }`}>
            {isCurrentlyShifting ? 'Shifting' : 'Steady'}
          </span>
        </div>

        {/* Column 3 (Col-span-4): Forecast Compass */}
        <div className="col-span-4 flex flex-col items-center justify-center pl-1">
          <span className="text-[8px] font-black text-slate-400 uppercase mb-1 leading-none">24H ZONE</span>
          <div className="relative w-[84px] h-[84px] border border-slate-700/80 rounded-full flex items-center justify-center bg-bgDeepSpace/20 shadow-inner">
            <span className="absolute top-1 text-[8px] font-black text-slate-500">N</span>
            <span className="absolute right-1.5 text-[8px] font-black text-slate-500">E</span>
            <span className="absolute bottom-1 text-[8px] font-black text-slate-500">S</span>
            <span className="absolute left-1.5 text-[8px] font-black text-slate-500">W</span>

            {/* SVG Forecast Wedge and Arrows */}
            <svg viewBox="0 0 50 50" className="w-full h-full absolute inset-0">
              {wedgePath && (
                <path d={wedgePath} fill="#E87722" fillOpacity="0.18" stroke="#E87722" strokeWidth="0.75" strokeDasharray="1,1" />
              )}
              {forecast && (
                <>
                  {/* Start Arrow (Dashed) */}
                  <g transform={`rotate(${forecast.startDir + 180}, 25, 25)`}>
                    <line x1="25" y1="25" x2="25" y2="8" stroke="#94A3B8" strokeWidth="0.85" strokeDasharray="1.5,1.5" />
                    <polygon points="25,6 23,10 27,10" fill="#94A3B8" />
                  </g>
                  {/* End Arrow (Solid) */}
                  <g transform={`rotate(${forecast.endDir + 180}, 25, 25)`}>
                    <line x1="25" y1="25" x2="25" y2="8" stroke="#E87722" strokeWidth="1.2" />
                    <polygon points="25,6 22,10 28,10" fill="#E87722" />
                  </g>
                </>
              )}
              <circle cx="25" cy="25" r="1.5" fill="#E87722" />
            </svg>
          </div>
          <span className="text-[9px] font-mono font-black text-slate-200 mt-1 uppercase leading-none truncate w-full text-center">
            {forecast ? `${forecast.minSpeed.toFixed(0)}-${forecast.maxSpeed.toFixed(0)} k/h` : '--'}
          </span>
          <span className="text-[8px] font-black text-slate-400 mt-1 uppercase leading-none">Forecast</span>
        </div>

      </div>

      {/* 12-Hour Wind & Gust Forecast Sparkline */}
      <div className="w-full flex-1 min-h-[96px] mt-1.5 relative z-10 border-t border-slate-800/40 pt-2 flex flex-col justify-between">
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1 leading-none">12-Hour Wind Speed & Gusts Forecast</p>
        <div className="w-full flex-1 relative overflow-visible min-h-[64px] my-1">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 120 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="speedChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="gustChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF4E02" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FF4E02" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Y-Axis Legend */}
            <text x="2" y="5" fill="#64748B" fontSize="3" fontWeight="bold">km/h</text>
            
            <text x="8" y="9" fill="#64748B" fontSize="3" fontWeight="bold" textAnchor="end">60</text>
            <line x1="11" y1="8" x2="15" y2="8" stroke="#334155" strokeWidth="0.2" />

            <text x="8" y="16.3" fill="#EF4444" fontSize="3" fontWeight="bold" textAnchor="end">50</text>
            <line x1="11" y1="15.33" x2="15" y2="15.33" stroke="#EF4444" strokeWidth="0.2" />

            <text x="8" y="25.1" fill="#F59E0B" fontSize="3" fontWeight="bold" textAnchor="end">38</text>
            <line x1="11" y1="24.13" x2="15" y2="24.13" stroke="#F59E0B" strokeWidth="0.2" />

            <text x="8" y="38.3" fill="#64748B" fontSize="3" fontWeight="bold" textAnchor="end">20</text>
            <line x1="11" y1="37.33" x2="15" y2="37.33" stroke="#334155" strokeWidth="0.2" />

            <text x="8" y="53" fill="#64748B" fontSize="3" fontWeight="bold" textAnchor="end">0</text>
            <line x1="11" y1="52" x2="15" y2="52" stroke="#334155" strokeWidth="0.2" />

            {/* Safety Guidelines */}
            <line x1="15" y1="24.13" x2="120" y2="24.13" stroke="#F59E0B" strokeWidth="0.25" strokeDasharray="1.5,1.5" opacity="0.6" />
            <text x="17" y="22.5" fill="#F59E0B" fontSize="3" fontWeight="bold">SUSTAINED LIMIT (38)</text>

            <line x1="15" y1="15.33" x2="120" y2="15.33" stroke="#EF4444" strokeWidth="0.25" strokeDasharray="1.5,1.5" opacity="0.6" />
            <text x="17" y="13.7" fill="#EF4444" fontSize="3" fontWeight="bold">GUST LIMIT (50)</text>

            {/* Areas */}
            <path d={gustAreaD} fill="url(#gustChartFill)" />
            <path d={speedAreaD} fill="url(#speedChartFill)" />

            {/* Paths */}
            <path d={gustPathD} fill="none" stroke="#FF4E02" strokeWidth="1.2" strokeLinecap="round" />
            <path d={speedPathD} fill="none" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />

            {/* Axis Lines */}
            <line x1="15" y1="52" x2="120" y2="52" stroke="#334155" strokeWidth="0.2" />
            <line x1="15" y1="8" x2="15" y2="52" stroke="#334155" strokeWidth="0.2" />
          </svg>
        </div>
        
        {/* X-Axis labels */}
        <div className="flex justify-between text-[9.5px] font-black text-slate-400 font-mono mt-1 leading-none pl-[12.5%] pr-[1%]">
          <span>{windForecast12h[0]?.hour || 'NOW'}</span>
          <span>{windForecast12h[6]?.hour || '+6H'}</span>
          <span>{windForecast12h[11]?.hour || '+12H'}</span>
        </div>
      </div>

      {/* Footer / Shifting Info */}
      <div className="border-t border-slate-700/30 pt-1.5 flex justify-between items-center">
        <span className="text-[9px] text-slate-400 font-bold uppercase">24H EXPECTED TREND</span>
        <span className="text-[9px] font-mono font-black text-edgeOrange uppercase truncate max-w-[65%]">
          {forecast ? forecast.shiftingText : 'No Forecast'}
        </span>
      </div>
    </div>
  );
}
