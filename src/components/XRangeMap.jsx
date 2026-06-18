import React from 'react';
import { evaluateSafety, calculateDewPoint, calculateHumidex } from '../utils/safetyEngine';
import { ShieldAlert, Compass, Sun, Droplets, Map } from 'lucide-react';
import { getMoonDetails, getMoonTimes, checkTransitPosition } from './BottomRow';

// Stations definition matching geographical landmarks
export const stationsList = [
  {
    id: 'hq',
    name: 'Main HQ Station',
    x: 310,
    y: 170,
    description: 'Administrative & Firing HQ',
    getReadings: (globalData) => {
      if (!globalData) return null;
      return {
        ...globalData,
        temperature_2m: 41.3,
        apparent_temperature: 43.1,
        wind_speed_10m: 25,
        wind_gusts_10m: 35,
        relative_humidity_2m: 20,
        visibility: 10000,
        uv_index: 10,
        weathercode: 3
      };
    }
  },
  {
    id: 'north',
    name: 'Range North',
    x: 365,
    y: 100,
    description: 'Heavy Ballistics & Drone Range',
    getReadings: (globalData) => {
      if (!globalData) return null;
      return {
        ...globalData,
        temperature_2m: 39.5,
        apparent_temperature: 42.0,
        wind_speed_10m: 42, // Red (>=38 km/h)
        wind_gusts_10m: 53, // Red (>=50 km/h)
        relative_humidity_2m: 25,
        visibility: 4000, // Amber
        uv_index: 11,
        weathercode: 45
      };
    }
  },
  {
    id: 'south',
    name: 'Range South',
    x: 135,
    y: 180,
    description: 'Desert Durability Sector',
    getReadings: (globalData) => {
      if (!globalData) return null;
      return {
        ...globalData,
        temperature_2m: 44.5, // Red (>=43°C)
        apparent_temperature: 49.2, // Red (>=46°C apparent)
        wind_speed_10m: 12,
        wind_gusts_10m: 18,
        relative_humidity_2m: 15,
        visibility: 12000,
        uv_index: 12,
        weathercode: 0
      };
    }
  },
  {
    id: 'sea',
    name: 'Sea Boundary',
    x: 240,
    y: 205,
    description: 'Marine Spit & Port Security',
    getReadings: (globalData) => {
      if (!globalData) return null;
      return {
        ...globalData,
        temperature_2m: 34.0,
        apparent_temperature: 48.0,
        wind_speed_10m: 28,
        wind_gusts_10m: 42,
        relative_humidity_2m: 89,
        visibility: 2000,
        uv_index: 9,
        weathercode: 3
      };
    }
  }
];

export default function XRangeMap({ apiData, isSimulated, activeStation, setActiveStation, isBackground, hideDetails, showSimulatedStations = false, ncmWarnings }) {
  const warnings = ncmWarnings || apiData?.ncmWarnings || [];
  const activeWarning = warnings.reduce((highest, w) => {
    if (!highest) return w;
    const priority = { 'RED': 3, 'AMBER': 2, 'YELLOW': 1 };
    return (priority[w.type] || 0) > (priority[highest.type] || 0) ? w : highest;
  }, null);

  const currentActive = showSimulatedStations ? activeStation : 'hq';
  const currentStationInfo = stationsList.find(s => s.id === currentActive) || stationsList[0];
  const stationReadings = apiData 
    ? (isSimulated ? currentStationInfo.getReadings(apiData.current) : apiData.current) 
    : null;
  
  const getIsNight = () => {
    if (!apiData || !apiData.current || !apiData.daily) return false;
    const timeStr = apiData.current.time;
    const dailyData = apiData.daily;
    
    if (!dailyData.time || !dailyData.sunrise || !dailyData.sunset) {
      const date = new Date(timeStr);
      const hour = date.getHours();
      return hour < 6 || hour >= 19;
    }
    
    const dateStr = timeStr.slice(0, 10);
    const idx = dailyData.time.findIndex(t => t.startsWith(dateStr));
    if (idx === -1) {
      const date = new Date(timeStr);
      const hour = date.getHours();
      return hour < 6 || hour >= 19;
    }
    
    const sunriseStr = dailyData.sunrise[idx];
    const sunsetStr = dailyData.sunset[idx];
    
    const timeMs = new Date(timeStr).getTime();
    const sunriseMs = new Date(sunriseStr).getTime();
    const sunsetMs = new Date(sunsetStr).getTime();
    
    return timeMs < sunriseMs || timeMs > sunsetMs;
  };

  const isNight = getIsNight();

  const getMoonIllumination = () => {
    if (!apiData || !apiData.daily || !apiData.daily.time) return 0.5;
    try {
      const todayStr = apiData.daily.time[0];
      const moon = getMoonDetails(todayStr);
      const phase = moon.phase;
      return 1 - Math.abs(0.5 - phase) / 0.5;
    } catch (e) {
      return 0.5;
    }
  };

  const moonIllumination = getMoonIllumination();
  const nightOpacity = 0.58 - (moonIllumination * 0.20);

  const windSpeed = stationReadings?.wind_speed_10m || 0;
  const windDir = stationReadings?.wind_direction_10m || 0;
  const cloudCover = stationReadings?.cloud_cover || 0;

  const windOpacity = windSpeed > 0 ? Math.min(0.18, (windSpeed / 50) * 0.12 + 0.03) : 0;
  const cloudOpacity = (cloudCover / 100) * 0.18;
  const rotationAngle = (windDir - 270 + 360) % 360;

  // Sun & Moon Transit Calculations
  const dailyData = apiData?.daily;
  const currentTime = apiData?.current?.time;
  const hasTransitData = dailyData?.sunrise?.[0] && dailyData?.sunset?.[0] && currentTime;

  let sunTransit = { visible: false, progress: 0 };
  let sunX = 0;
  let sunY = 0;

  let moonTransit = { visible: false, progress: 0 };
  let moonX = 0;
  let moonY = 0;
  let moonDetails = null;

  let dynamicSunRy = 110;
  let dynamicMoonRy = 95;

  if (hasTransitData) {
    try {
      const sunriseStr = dailyData.sunrise[0];
      const sunsetStr = dailyData.sunset[0];
      const nowDate = new Date(currentTime);

      // Calculate Day of Year to determine Solar Declination
      const start = new Date(nowDate.getFullYear(), 0, 0);
      const diff = nowDate - start;
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);

      // Solar Declination Angle (approximate in degrees)
      const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 80));

      // Max Solar Elevation Angle for Abu Dhabi (Latitude 24.20)
      const maxElevation = 90 - Math.abs(24.20 - declination);

      // Scale Sun ry between 75 (winter solstice elevation ~42.35°) and 120 (summer solstice elevation ~89.25°)
      const elevationProgress = Math.max(0, Math.min(1, (maxElevation - 42.35) / (89.25 - 42.35)));
      dynamicSunRy = 75 + 45 * elevationProgress;
      dynamicMoonRy = dynamicSunRy - 15;

      // 1. Sun Transit
      sunTransit = checkTransitPosition(nowDate, new Date(sunriseStr), new Date(sunsetStr));
      if (sunTransit.visible) {
        const theta = sunTransit.progress * Math.PI;
        sunX = 250 + 180 * Math.cos(theta);
        sunY = 200 - dynamicSunRy * Math.sin(theta);
      }

      // 2. Moon Transit
      moonDetails = getMoonDetails(dailyData.time[0]);
      const moonriseDate = new Date(new Date(sunriseStr).getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
      const moonsetDate = new Date(new Date(sunsetStr).getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);

      moonTransit = checkTransitPosition(nowDate, moonriseDate, moonsetDate);
      if (moonTransit.visible) {
        const theta = moonTransit.progress * Math.PI;
        moonX = 250 + 160 * Math.cos(theta);
        moonY = 200 - dynamicMoonRy * Math.sin(theta);
      }
    } catch (e) {
      console.error('Error calculating celestial transits:', e);
    }
  }

  const mapContent = (
    <svg viewBox="30 57.5 440 185" className="w-full h-full select-none relative" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="cloudBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="25" />
        </filter>
      </defs>

      {/* Isometric 3D Map Image Backdrop */}
      <image href="/xrange_map_3.png" x="30" y="57.5" width="440" height="185" />

      {/* Night Map Overlay (Darkens map during night hours, scaled with moonlight) */}
      {isNight && (
        <rect 
          x="30" 
          y="57.5" 
          width="440" 
          height="185" 
          fill="#090B0E" 
          opacity={nightOpacity} 
          className="pointer-events-none mix-blend-multiply"
        />
      )}

      {/* Very Light Cloud Cover Overlay */}
      {cloudOpacity > 0.01 && (
        <g filter="url(#cloudBlur)" opacity={cloudOpacity} className="pointer-events-none">
          <ellipse cx="140" cy="90" rx="90" ry="45" fill="#FFFFFF" />
          <ellipse cx="360" cy="190" rx="130" ry="65" fill="#FFFFFF" />
          <ellipse cx="260" cy="70" rx="75" ry="35" fill="#FFFFFF" />
        </g>
      )}

      {/* Animated Wind Flow Lines */}
      {windSpeed > 0 && (
        <g transform={`rotate(${rotationAngle}, 250, 150)`} className="pointer-events-none">
          <path d="M 50 60 Q 250 85 450 60" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="8,22" opacity={windOpacity}>
            <animate attributeName="stroke-dashoffset" values="200;0" dur={`${Math.max(2, 12 - (windSpeed / 5))}s`} repeatCount="indefinite" />
          </path>
          <path d="M 50 150 Q 250 175 450 150" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="8,22" opacity={windOpacity}>
            <animate attributeName="stroke-dashoffset" values="200;0" dur={`${Math.max(2, 12 - (windSpeed / 5)) * 0.9}s`} repeatCount="indefinite" />
          </path>
          <path d="M 50 240 Q 250 265 450 240" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="8,22" opacity={windOpacity}>
            <animate attributeName="stroke-dashoffset" values="200;0" dur={`${Math.max(2, 12 - (windSpeed / 5)) * 1.1}s`} repeatCount="indefinite" />
          </path>
        </g>
      )}

      {/* Sleek Wind Compass Dial (Relocated just above the bottom row / 5-day outlook at cy=195) */}
      {windSpeed > 0 && (
        <g className="pointer-events-none select-none">
          {/* Compass Dial Background */}
          <circle cx="445" cy="195" r="15" fill="#090d16" fillOpacity="0.75" stroke="#334155" strokeWidth="0.75" />
          
          {/* Cardinal Directions */}
          <text x="445" y="185" fontSize="4.5" fill="#64748b" fontWeight="black" textAnchor="middle" alignmentBaseline="middle">N</text>
          <text x="445" y="206" fontSize="4.5" fill="#64748b" fontWeight="black" textAnchor="middle" alignmentBaseline="middle">S</text>
          <text x="435" y="195" fontSize="4.5" fill="#64748b" fontWeight="black" textAnchor="middle" alignmentBaseline="middle">W</text>
          <text x="455" y="195" fontSize="4.5" fill="#64748b" fontWeight="black" textAnchor="middle" alignmentBaseline="middle">E</text>

          {/* Wind Vane Arrow (points in flow direction: windDir + 180) */}
          <g transform={`rotate(${windDir + 180}, 445, 195)`}>
            <path d="M 445 202 L 445 188 M 442 192 L 445 188 L 448 192" fill="none" stroke="#E87722" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="445" cy="195" r="1.2" fill="#E87722" />
          </g>

          {/* Wind Speed text labels */}
          <text x="445" y="217" fontSize="6" fill="#F8FAFC" fontWeight="black" textAnchor="middle" className="font-mono">
            {windSpeed.toFixed(0)} <tspan fontSize="4.5" fill="#94A3B8">KPH</tspan>
          </text>
        </g>
      )}

      {/* Sun & Moon Celestial Arcs and Transit Icons */}
      <g className="pointer-events-none select-none">
        {/* Sun Transit Arc */}
        <path 
          d={`M 430 200 A 180 ${dynamicSunRy} 0 0 0 70 200`} 
          fill="none" 
          stroke="#ff7a00" 
          strokeWidth="1" 
          strokeDasharray="3, 5" 
          opacity="0.28" 
        />

        {/* Moon Transit Arc */}
        <path 
          d={`M 410 200 A 160 ${dynamicMoonRy} 0 0 0 90 200`} 
          fill="none" 
          stroke="#38bdf8" 
          strokeWidth="1" 
          strokeDasharray="2, 4" 
          opacity="0.24" 
        />

        {/* Glowing Sun Transit Icon */}
        {sunTransit.visible && (
          <g transform={`translate(${sunX}, ${sunY})`}>
            {/* Pulsing solar halo */}
            <circle cx="0" cy="0" r="10" fill="#ff7a00" opacity="0.35">
              <animate attributeName="r" values="7;13;7" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0.1;0.45" dur="3s" repeatCount="indefinite" />
            </circle>
            {/* Outer solar ring */}
            <circle cx="0" cy="0" r="5.5" fill="#f59e0b" opacity="0.8" />
            {/* Sun core */}
            <circle cx="0" cy="0" r="3" fill="#fff" />
          </g>
        )}

        {/* Glowing Moon Transit Icon */}
        {moonTransit.visible && (
          <g transform={`translate(${moonX}, ${moonY})`}>
            {/* Pulsing lunar halo */}
            <circle cx="0" cy="0" r="9" fill="#38bdf8" opacity="0.3">
              <animate attributeName="r" values="6;11;6" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0.1;0.35" dur="4s" repeatCount="indefinite" />
            </circle>
            {/* Moon emoji */}
            <text 
              x="0" 
              y="2" 
              fontSize="7.5" 
              textAnchor="middle" 
              dominantBaseline="central"
              className="select-none pointer-events-none"
            >
              {moonDetails?.emoji || '🌙'}
            </text>
          </g>
        )}
      </g>

      {/* Interactive Station Pins */}
      {stationsList
        .filter(s => showSimulatedStations ? true : s.id === 'hq')
        .map(s => {
          const isSelected = currentActive === s.id;
          const readings = apiData ? (isSimulated ? s.getReadings(apiData.current) : apiData.current) : null;
          const safety = readings ? evaluateSafety(readings) : null;
          
          let statusColor = '#22c55e'; // Green
          if (safety?.status === 'AMBER') statusColor = '#f59e0b'; // Amber
          if (safety?.status === 'RED') statusColor = '#ef4444'; // Red

          return (
            <g 
              key={s.id} 
              transform={`translate(${s.x}, ${s.y})`} 
              className={showSimulatedStations ? "cursor-pointer pointer-events-auto" : "pointer-events-none"}
              onClick={() => showSimulatedStations && setActiveStation && setActiveStation(s.id)}
            >
              {/* Pulsing halo for selected station */}
              {isSelected && (
                <circle cx="0" cy="0" r="10" fill={statusColor} fillOpacity="0.3">
                  <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Pin Outer Ring */}
              <circle 
                cx="0" 
                cy="0" 
                r="5" 
                fill="#0b0f19" 
                stroke={isSelected ? '#f97316' : statusColor} 
                strokeWidth={isSelected ? '2' : '1.5'} 
              />

              {/* Pin Center Dot */}
              <circle 
                cx="0" 
                cy="0" 
                r="2" 
                fill={statusColor} 
              />

              {/* Text Label */}
              <text
                y="-8"
                textAnchor="middle"
                fontSize="6.5"
                fontWeight="black"
                fill={isSelected ? '#f97316' : '#f8fafc'}
                className="uppercase font-sans tracking-wider"
                style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.95)' }}
              >
                {s.id === 'hq' ? (showSimulatedStations ? 'HQ' : 'Main HQ') : s.id}
              </text>
            </g>
          );
        })}
    </svg>
  );

  if (isBackground) {
    return (
      <div className="w-full h-full relative select-none bg-bgDeepSpace">
        <div className="w-full h-full flex items-center justify-center opacity-75">
          {mapContent}
        </div>
      </div>
    );
  }

  // Fallback card-style layout for default grid render
  return (
    <div className="w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between select-none relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
      <div className="flex justify-between items-start z-10 w-full">
        <div className="flex-grow min-w-0 pr-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center space-x-2">
            <span>Z12 • XRANGE TACTICAL MAP</span>
            {activeWarning ? (
              <span className={`animate-pulse px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border leading-none ${
                activeWarning.type === 'RED' ? 'bg-red-500/25 border-red-500 text-red-400' :
                activeWarning.type === 'AMBER' ? 'bg-amber-500/25 border-amber-500 text-amberAlert' :
                'bg-yellow-500/25 border-yellow-500 text-yellow-400'
              }`}>
                NCM {activeWarning.type} ALERT: {activeWarning.title}
              </span>
            ) : (
              <span className="bg-green-500/10 border border-green-500/30 text-green-400 px-1.5 py-0.5 rounded text-[7.5px] font-black tracking-wider leading-none">
                NCM SECURE
              </span>
            )}
          </p>
          <h2 className="text-sm font-bold text-slate-300 truncate mt-0.5">
            {activeWarning ? (
              <span className={`text-[11.5px] font-extrabold tracking-wide uppercase ${
                activeWarning.type === 'RED' ? 'text-red-400' :
                activeWarning.type === 'AMBER' ? 'text-amberAlert' :
                'text-yellow-400'
              }`}>
                ⚠️ NCM DIRECTIVE: {activeWarning.description}
              </span>
            ) : (
              isSimulated ? 'Simulated Local Sensor Overlay' : 'Open-Meteo GPS Grid'
            )}
          </h2>
        </div>
        <span className="bg-bgDeepSpace/40 border border-slate-700/50 px-2 py-0.5 rounded text-[9px] font-bold text-slate-400 flex items-center space-x-1 flex-shrink-0">
          <Map className="w-3 h-3 text-edgeOrange" />
          <span>ABU AL ABYAD ISLAND</span>
        </span>
      </div>

      <div className="flex items-center justify-between h-[88%] mt-2 z-10">
        <div className={`${(hideDetails || !showSimulatedStations) ? 'w-full' : 'w-[58%]'} h-full relative border border-slate-700/30 rounded-lg bg-bgDeepSpace/40 overflow-hidden flex items-center justify-center`}>
          {mapContent}
        </div>

        {!hideDetails && showSimulatedStations && (
          <div className="w-[39%] h-full">
            <StationDetailsWidget 
              apiData={apiData} 
              isSimulated={isSimulated} 
              activeStation={currentActive} 
              setActiveStation={setActiveStation}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Named export for the station details panel
export function StationDetailsWidget({ apiData, isSimulated, activeStation, setActiveStation }) {
  const currentStationInfo = stationsList.find(s => s.id === activeStation) || stationsList[0];
  const stationReadings = apiData 
    ? (isSimulated ? currentStationInfo.getReadings(apiData.current) : apiData.current) 
    : null;
  const safety = stationReadings ? evaluateSafety(stationReadings) : null;

  const tempDisplay = stationReadings?.temperature_2m || 0;
  const rhDisplay = stationReadings?.relative_humidity_2m || 0;
  const dewPointDisplay = calculateDewPoint(tempDisplay, rhDisplay);
  const humidexDisplay = calculateHumidex(tempDisplay, dewPointDisplay);

  const getStatusBgClass = (status) => {
    if (status === 'RED') return 'bg-stopRed/20 border-stopRed text-stopRed';
    if (status === 'AMBER') return 'bg-amberAlert/20 border-amber-500 text-amberAlert';
    return 'bg-safetyGreen/20 border-safetyGreen text-safetyGreen';
  };

  const getUvLabel = (index) => {
    if (index <= 2) return 'LOW';
    if (index <= 5) return 'MODERATE';
    if (index <= 7) return 'HIGH';
    if (index <= 10) return 'VERY HIGH';
    return 'EXTREME';
  };

  const getUvTextColor = (index) => {
    if (index <= 2) return 'text-safetyGreen';
    if (index <= 5) return 'text-yellow-400';
    if (index <= 7) return 'text-amberAlert';
    if (index <= 10) return 'text-stopRed';
    return 'text-uvPurple';
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md shadow-2xl select-none">
      <div className="flex flex-col h-full justify-between">
        {/* Station Selector tabs */}
        {setActiveStation && (
          <div className="grid grid-cols-4 gap-1.5 mb-3 bg-bgDeepSpace/40 p-1 rounded-lg border border-slate-805/50 flex-none">
            {stationsList.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStation(s.id)}
                className={`text-[10px] font-black uppercase py-1.5 rounded-md transition-all cursor-pointer ${
                  activeStation === s.id
                    ? 'bg-edgeOrange text-white shadow-md'
                    : 'text-slate-400 hover:text-textIceWhite'
                }`}
              >
                {s.id.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Station Info Row */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2 flex-none">
          <span className="text-base font-black uppercase tracking-wide text-textIceWhite truncate w-[65%]">
            {currentStationInfo.name}
          </span>
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border ${getStatusBgClass(safety?.status)}`}>
            {safety?.status || 'N/A'}
          </span>
        </div>
        <p className="text-[10.5px] font-bold text-slate-400 uppercase leading-none mb-3 flex-none">
          {currentStationInfo.description}
        </p>

        {/* 2x2 Telemetry Grid (Fills space nicely, numbers are highly scaled up) */}
        {stationReadings ? (
          <div className="grid grid-cols-2 gap-3 flex-grow my-1">
            {/* Card 1: Temp & Humidex */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10.5px] font-black text-slate-300 uppercase tracking-wider">
                <span>Temp / Hx</span>
                <Sun className="w-4 h-4 text-yellow-500/80" />
              </div>
              <div className="my-2 flex items-baseline">
                <span className="text-2xl font-black text-textIceWhite font-mono leading-none animate-fade-in">
                  {tempDisplay.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-0.5">°C</span>
              </div>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
                Humidex: {humidexDisplay.toFixed(1)}°C
              </span>
            </div>

            {/* Card 2: Wind & Gusts */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10.5px] font-black text-slate-300 uppercase tracking-wider">
                <span>Wind / Gust</span>
                <Compass className="w-4 h-4 text-edgeOrange/80" />
              </div>
              <div className="my-2 flex items-baseline">
                <span className={`text-2xl font-black font-mono leading-none ${safety?.reasons.some(r => r.includes('wind') || r.includes('gust')) ? 'text-stopRed animate-pulse' : 'text-textIceWhite'}`}>
                  {stationReadings.wind_speed_10m.toFixed(0)}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-0.5">k/h</span>
              </div>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
                Gusts: {stationReadings.wind_gusts_10m.toFixed(0)} k/h
              </span>
            </div>

            {/* Card 3: Humidity & Dew Point */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10.5px] font-black text-slate-300 uppercase tracking-wider">
                <span>Humidity</span>
                <Droplets className="w-4 h-4 text-sky-400/80" />
              </div>
              <div className="my-2 flex items-baseline">
                <span className={`text-2xl font-black font-mono leading-none ${rhDisplay >= 85 ? 'text-stopRed' : 'text-textIceWhite'}`}>
                  {rhDisplay}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
              </div>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
                Dew Pt: {dewPointDisplay.toFixed(1)}°C
              </span>
            </div>

            {/* Card 4: UV Index & Risk */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10.5px] font-black text-slate-300 uppercase tracking-wider">
                <span>UV Index</span>
                <Sun className="w-4 h-4 text-purple-400/80" />
              </div>
              <div className="my-2 flex items-baseline">
                <span className={`text-2xl font-black font-mono leading-none ${getUvTextColor(stationReadings.uv_index)}`}>
                  {stationReadings.uv_index.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-slate-400 ml-0.5">UV</span>
              </div>
              <span className={`text-[9px] font-extrabold uppercase tracking-wide ${getUvTextColor(stationReadings.uv_index)}`}>
                {getUvLabel(stationReadings.uv_index)} RISK
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic text-center py-4 flex-grow animate-pulse">No sensor data available.</p>
        )}

        {/* Bottom Status Banner */}
        {safety && safety.reasons.length > 0 ? (
          <div className="mt-3 border border-red-500/20 bg-red-950/20 p-3 rounded-lg flex items-start space-x-2 flex-none">
            <ShieldAlert className="w-4 h-4 text-stopRed mt-0.5 flex-none" />
            <p className="text-[10px] font-bold text-red-300 uppercase leading-tight tracking-wide">
              {safety.reasons[0]}
            </p>
          </div>
        ) : (
          <div className="mt-3 border border-green-500/20 bg-green-950/20 p-3 rounded-lg flex items-center space-x-2 flex-none">
            <span className="w-2 h-2 rounded-full bg-safetyGreen" />
            <p className="text-[10px] font-bold text-green-300 uppercase leading-tight tracking-wider">
              SECTOR PARAMETERS SECURE
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
