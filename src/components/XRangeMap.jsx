import { useState, useEffect } from 'react';
import { evaluateSafety, calculateDewPoint, calculateHumidex } from '../utils/safetyEngine';
import { propagateContactAtTime } from '../services/weatherService';
import { ShieldAlert, Compass, Sun, Droplets, Map, Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { getMoonDetails, getMoonTimes, checkTransitPosition, getLunarPhaseSvgPath } from '../utils/lunarEngine';
import { stationsList } from '../utils/rangeStations';
import { getIsNightTime } from '../utils/weatherCodeMap';

// High-Frequency 25-FPS Linear Isotropic ADS-B Radar Layer (Zero-Jolt Continuous Kinematics)
function AdsbTrafficLayer({ contacts }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let rafId;
    let lastTick = 0;
    const step = (ts) => {
      if (ts - lastTick >= 40) {
        lastTick = ts;
        setNowMs(Date.now());
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!Array.isArray(contacts) || contacts.length === 0) return null;

  // Deterministic alphabetical order prevents DOM node reordering jumps
  const liveContacts = [...contacts]
    .slice(0, 6)
    .sort((a, b) => String(a.callsign || '').localeCompare(String(b.callsign || '')))
    .map((ac) => propagateContactAtTime(ac, nowMs));

  const anyOverIsland = liveContacts.some((c) => c.isOverIsland);
  // Isotropic radar scale (6.2 SVG units per Nautical Mile in BOTH East and North axes = 0° angular distortion)
  const PX_PER_NM = 6.2;
  const COS_LAT = 0.91215; // cos(24.195° N)

  return (
    <g className="pointer-events-none" clipPath="url(#adsbViewportClip)">
      {/* 7.5 NM Abu Al Abyad Island TFR Geofence Ring */}
      <ellipse
        cx="265"
        cy="155"
        rx="115"
        ry="52"
        fill="none"
        stroke={anyOverIsland ? '#ef4444' : '#38bdf8'}
        strokeWidth="0.55"
        strokeDasharray="3,2.5"
        opacity="0.42"
      />
      <text
        x="265"
        y="101"
        textAnchor="middle"
        fill={anyOverIsland ? '#fca5a5' : '#38bdf8'}
        fontSize="2.5"
        fontFamily="monospace"
        fontWeight="bold"
        opacity="0.75"
      >
        7.5 NM ISLAND TFR GEOFENCE (39R YG)
      </text>

      {/* Outer Sector Radar Ring */}
      <ellipse
        cx="265"
        cy="155"
        rx="185"
        ry="78"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="0.45"
        strokeDasharray="1.8,2.8"
        opacity="0.32"
      />
      <text
        x="265"
        y="75"
        textAnchor="middle"
        fill="#7dd3fc"
        fontSize="2.4"
        fontFamily="monospace"
        fontWeight="bold"
        opacity="0.65"
      >
        50 NM ADS-B DECONFLICTION RADAR RING • OMAA / OMAD / OMAM SECTOR
      </text>

      {liveContacts.map((ac, idx) => {
        const eastNm = ((typeof ac.lon === 'number' ? ac.lon : 53.860) - 53.860) * 60 * COS_LAT;
        const northNm = ((typeof ac.lat === 'number' ? ac.lat : 24.195) - 24.195) * 60;
        const ax = 265 + eastNm * PX_PER_NM;
        const ay = 155 - northNm * PX_PER_NM;

        const heading = ac.headingDeg || 0;
        const trackRad = ((heading - 90) * Math.PI) / 180;
        const unitX = Math.cos(trackRad);
        const unitY = Math.sin(trackRad);
        const vecLen = Math.min(30, Math.max(15, (ac.speedKt || 250) / 17));
        const vx = unitX * vecLen;
        const vy = unitY * vecLen;

        const badgeColor = ac.isOverIsland ? '#ef4444' : ac.isInboundToIsland ? '#f59e0b' : '#06b6d4';
        const textColor = ac.isOverIsland ? '#fca5a5' : ac.isInboundToIsland ? '#fcd34d' : '#67e8f9';
        const flStr = `FL${String(Math.max(1, Math.round((ac.altitudeFt || 1000) / 100))).padStart(3, '0')}`;
        const altFormatted = `${(ac.altitudeFt || 0).toLocaleString()}FT (${flStr})`;

        // Keep data card consistently behind the aircraft tail so it never flips mid-flight or covers the velocity vector
        const cardOnLeft = heading < 180;
        const boxX = cardOnLeft ? -63.0 : 6.0;
        const textX = cardOnLeft ? -61.0 : 7.8;
        const fadeOpacity = ac.corridorFade ?? 1;

        return (
          <g
            key={`adsb-${ac.callsign || ac.hex || idx}`}
            transform={`translate(${ax.toFixed(3)}, ${ay.toFixed(3)})`}
            opacity={fadeOpacity}
          >
            {/* Subtle Linear Airway Corridor Track Line */}
            <line
              x1={(-unitX * 42).toFixed(2)}
              y1={(-unitY * 42).toFixed(2)}
              x2={(unitX * 42).toFixed(2)}
              y2={(unitY * 42).toFixed(2)}
              stroke={badgeColor}
              strokeWidth="0.3"
              strokeDasharray="1.2,2.2"
              opacity="0.28"
            />

            {/* 4-Dot Radar Wake Trail */}
            {[1, 2, 3, 4].map((step) => (
              <circle
                key={step}
                cx={(-unitX * step * 4.4).toFixed(2)}
                cy={(-unitY * step * 4.4).toFixed(2)}
                r={Math.max(0.45, 1.25 - step * 0.2)}
                fill={badgeColor}
                opacity={Math.max(0.18, 0.72 - step * 0.14)}
              />
            ))}

            {/* Forward Speed-Scaled Velocity Vector Leader Line + Tip Dot */}
            <line
              x1="0"
              y1="0"
              x2={vx.toFixed(2)}
              y2={vy.toFixed(2)}
              stroke={badgeColor}
              strokeWidth="0.75"
              strokeDasharray="1.8,1.4"
              opacity="0.9"
            />
            <circle cx={vx.toFixed(2)} cy={vy.toFixed(2)} r="1.1" fill={textColor} opacity="0.9" />

            {/* Pulsing Alert Ring for Overflight or Inbound */}
            {(ac.isOverIsland || ac.isInboundToIsland) && (
              <circle cx="0" cy="0" r="8" fill="none" stroke={badgeColor} strokeWidth="0.7" opacity="0.75">
                <animate attributeName="r" values="4;11" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Radar Target Reticle & Rotated Swept-Wing Aircraft Silhouette */}
            <circle cx="0" cy="0" r="4.6" fill="#020617" fillOpacity="0.8" stroke={badgeColor} strokeWidth="0.65" />
            <path
              d="M 0,-3.6 L 0.9,-1.0 L 3.4,0.8 L 3.4,1.6 L 0.8,0.8 L 0.6,2.6 L 1.6,3.3 L 1.6,3.8 L 0,3.3 L -1.6,3.8 L -1.6,3.3 L -0.6,2.6 L -0.8,0.8 L -3.4,1.6 L -3.4,0.8 L -0.9,-1.0 Z"
              fill={textColor}
              transform={`rotate(${heading})`}
            />

            {/* ADS-B Telemetry Data Block (3-Line Card with Explicit Altitude) */}
            <rect
              x={boxX}
              y="-7.2"
              width="57"
              height="14.6"
              rx="1.2"
              fill="#020617"
              fillOpacity="0.93"
              stroke={badgeColor}
              strokeWidth="0.45"
            />
            <text x={textX} y="-2.9" fill={textColor} fontSize="2.9" fontWeight="bold" fontFamily="monospace">
              {ac.callsign} • {ac.aircraftType || 'ACFT'}{ac.isOverIsland ? ' • OVER ISL' : ac.isInboundToIsland ? ` • ETA ${ac.etaToIslandMin}m` : ''}
            </text>
            <text x={textX} y="0.9" fill="#fcd34d" fontSize="2.55" fontWeight="bold" fontFamily="monospace">
              ALT: {altFormatted}
            </text>
            <text x={textX} y="4.7" fill="#e2e8f0" fontSize="2.35" fontFamily="monospace">
              {ac.speedKt}KT • {ac.distanceNm}NM@{String(ac.bearingDeg || 0).padStart(3, '0')}°
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function XRangeMap({ apiData, isSimulated, activeStation, setActiveStation, isAutoRotate = true, onToggleAutoRotate, isBackground, hideDetails, showSimulatedStations = false, ncmWarnings, simulatedLightning, onToggleSimulatedLightning, currentTime }) {
  const [activeLayer, setActiveLayer] = useState('none'); // 'none', 'thermal', 'wind', 'vis', 'radar'
  const [showAdsbTraffic, setShowAdsbTraffic] = useState(true);
  const [forecastOffset, setForecastOffset] = useState(0); // 0 = LIVE, 1..24 = +1H..+24H
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setForecastOffset(prev => (prev + 1) % 25);
    }, 1200);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const currentActive = activeStation || 'hq';

  // Retrieve readings for any station at a given hour offset (0 = Live, 1..24 = Forecast)
  const getStationReadingsAtOffset = (stationId, offsetHours = forecastOffset) => {
    if (!apiData) return null;
    const stationMeta = stationsList.find(s => s.id === stationId) || stationsList[0];

    if (offsetHours === 0) {
      if (isSimulated) {
        return stationMeta.getReadings(apiData.current);
      }
      return apiData?.stations?.[stationId]?.current || apiData.current;
    }

    const stHourly = apiData?.stations?.[stationId]?.hourly || apiData?.hourly;
    if (!stHourly || !stHourly.time) {
      return apiData?.stations?.[stationId]?.current || apiData.current;
    }

    const curTimeStr = (apiData.current?.time || '').slice(0, 13);
    let baseIdx = curTimeStr ? stHourly.time.findIndex(t => t && t.startsWith(curTimeStr)) : 48;
    if (baseIdx === -1) baseIdx = 48;
    const targetIdx = Math.min(stHourly.time.length - 1, Math.max(0, baseIdx + offsetHours));

    const temp = stHourly.temperature_2m?.[targetIdx] ?? 35;
    const rh = stHourly.relative_humidity_2m?.[targetIdx] ?? 35;
    const wind = stHourly.wind_speed_10m?.[targetIdx] ?? 18;
    const gusts = stHourly.wind_gusts_10m?.[targetIdx] ?? wind * 1.35;
    const windDir = stHourly.wind_direction_10m?.[targetIdx] ?? 280;
    const uv = stHourly.uv_index?.[targetIdx] ?? 0;
    const solar = stHourly.solar_radiation?.[targetIdx] ?? (uv * 90);
    const vis = stHourly.visibility?.[targetIdx] ?? 10000;
    const cloud = stHourly.cloud_cover?.[targetIdx] ?? 10;
    const pm10Val = stHourly.pm10?.[targetIdx] ?? 42;
    const aqiVal = stHourly.european_aqi?.[targetIdx] ?? 50;
    const wmo = stHourly.weathercode?.[targetIdx] ?? 0;
    const feels = stHourly.apparent_temperature?.[targetIdx] ?? Number((temp + (rh > 50 ? (rh - 50) * 0.18 : 1.2)).toFixed(1));

    return {
      time: stHourly.time[targetIdx],
      temperature_2m: temp,
      apparent_temperature: feels,
      relative_humidity_2m: rh,
      wind_speed_10m: wind,
      wind_direction_10m: windDir,
      wind_gusts_10m: gusts,
      uv_index: uv,
      solar_radiation: solar,
      visibility: vis,
      cloud_cover: cloud,
      pm10: pm10Val,
      european_aqi: aqiVal,
      weathercode: wmo
    };
  };

  const getInterpolatedWind = (x, y) => {
    const defaultHQ = { speed: 25, dir: 250 };
    const defaultNorth = { speed: 42, dir: 320 };
    const defaultSouth = { speed: 12, dir: 90 };
    const defaultSea = { speed: 28, dir: 210 };
    
    let hqSpeed = defaultHQ.speed;
    let hqDir = defaultHQ.dir;
    let northSpeed = defaultNorth.speed;
    let northDir = defaultNorth.dir;
    let southSpeed = defaultSouth.speed;
    let southDir = defaultSouth.dir;
    let seaSpeed = defaultSea.speed;
    let seaDir = defaultSea.dir;

    if (apiData) {
      const getStationData = (stationId, defaultVal) => {
        const readings = getStationReadingsAtOffset(stationId, forecastOffset);
        return {
          speed: readings?.wind_speed_10m ?? defaultVal.speed,
          dir: readings?.wind_direction_10m ?? defaultVal.dir
        };
      };

      const hq = getStationData('hq', defaultHQ);
      hqSpeed = hq.speed; hqDir = hq.dir;

      const north = getStationData('north', defaultNorth);
      northSpeed = north.speed; northDir = north.dir;

      const south = getStationData('south', defaultSouth);
      southSpeed = south.speed; southDir = south.dir;

      const sea = getStationData('sea', defaultSea);
      seaSpeed = sea.speed; seaDir = sea.dir;
    }

    const stations = [
      { x: 310, y: 170, speed: hqSpeed, dir: hqDir },
      { x: 365, y: 100, speed: northSpeed, dir: northDir },
      { x: 135, y: 180, speed: southSpeed, dir: southDir },
      { x: 240, y: 205, speed: seaSpeed, dir: seaDir }
    ];

    let totalWeight = 0;
    let weightedSpeed = 0;
    let weightedCos = 0;
    let weightedSin = 0;

    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      const dx = x - s.x;
      const dy = y - s.y;
      const distSq = dx * dx + dy * dy;
      if (distSq === 0) {
        return { speed: s.speed, direction: s.dir };
      }
      const weight = 1 / distSq;
      totalWeight += weight;
      weightedSpeed += s.speed * weight;
      
      const rad = (s.dir * Math.PI) / 180;
      weightedCos += Math.cos(rad) * weight;
      weightedSin += Math.sin(rad) * weight;
    }

    const finalSpeed = weightedSpeed / totalWeight;
    const finalDir = (Math.atan2(weightedSin, weightedCos) * 180) / Math.PI;
    return { 
      speed: finalSpeed, 
      direction: (finalDir + 360) % 360 
    };
  };

  const windVectorGrid = [
    { x: 70, y: 80 }, { x: 130, y: 80 }, { x: 190, y: 80 }, { x: 250, y: 80 }, { x: 310, y: 80 }, { x: 370, y: 80 }, { x: 430, y: 80 },
    { x: 70, y: 120 }, { x: 130, y: 120 }, { x: 190, y: 120 }, { x: 250, y: 120 }, { x: 310, y: 120 }, { x: 370, y: 120 }, { x: 430, y: 120 },
    { x: 70, y: 160 }, { x: 130, y: 160 }, { x: 190, y: 160 }, { x: 250, y: 160 }, { x: 310, y: 160 }, { x: 370, y: 160 }, { x: 430, y: 160 },
    { x: 70, y: 200 }, { x: 130, y: 200 }, { x: 190, y: 200 }, { x: 250, y: 200 }, { x: 310, y: 200 }, { x: 370, y: 200 }, { x: 430, y: 200 }
  ];

  const warnings = ncmWarnings || apiData?.ncmWarnings || [];
  const activeWarning = warnings.reduce((highest, w) => {
    if (!highest) return w;
    const priority = { 'RED': 3, 'AMBER': 2, 'YELLOW': 1 };
    return (priority[w.type] || 0) > (priority[highest.type] || 0) ? w : highest;
  }, null);

  const isLightningActive = warnings.some(w => w.category === 'LIGHTNING');

  // Compute effective time shifted by forecastOffset hours for day/night & sun/moon transit
  const getShiftedTime = () => {
    const base = currentTime || apiData?.current?.time;
    if (!base) return new Date();
    const baseDate = base instanceof Date ? base : new Date(typeof base === 'string' && !base.includes('+') && !base.endsWith('Z') ? `${base}+04:00` : base);
    return new Date(baseDate.getTime() + forecastOffset * 3600000);
  };
  const effectiveTime = getShiftedTime();

  const currentStationInfo = stationsList.find(s => s.id === currentActive) || stationsList[0];
  const stationReadings = getStationReadingsAtOffset(currentActive, forecastOffset);
  const activeStationSafety = stationReadings ? evaluateSafety(stationReadings, stationReadings.time ?? effectiveTime) : { status: 'GREEN', reasons: [] };
  const isNight = getIsNightTime(effectiveTime, apiData?.daily);

  const getMoonIllumination = () => {
    if (!apiData || !apiData.daily || !apiData.daily.time) return 0.5;
    try {
      const todayStr = apiData.daily.time[0];
      const moon = getMoonDetails(todayStr);
      const phase = moon.phase;
      return 1 - Math.abs(0.5 - phase) / 0.5;
    } catch {
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
  const activeTimeVal = effectiveTime;
  const hasTransitData = dailyData?.sunrise?.[0] && dailyData?.sunset?.[0] && activeTimeVal;

  let sunTransit = { visible: false, progress: 0 };
  let sunX = 0;
  let sunY = 0;
  let currentSunElevationDeg = 45;

  let moonTransit = { visible: false, progress: 0 };
  let moonX = 0;
  let moonY = 0;
  let moonDetails = null;

  let dynamicSunRy = 110;
  let dynamicMoonRy = 95;

  if (hasTransitData) {
    try {
      // Find the index of the active day in the daily arrays
      let dateStr = '';
      if (typeof activeTimeVal === 'string') {
        dateStr = activeTimeVal.slice(0, 10);
      } else if (activeTimeVal instanceof Date && !isNaN(activeTimeVal.getTime())) {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Dubai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const parts = formatter.formatToParts(activeTimeVal);
        const get = (type) => parts.find(p => p.type === type)?.value || '00';
        dateStr = `${get('year')}-${get('month')}-${get('day')}`;
      }

      const idx = dailyData.time ? dailyData.time.findIndex(t => t && t.startsWith(dateStr)) : 0;
      const targetIdx = idx >= 0 ? idx : 0;

      const sunriseStr = dailyData.sunrise[targetIdx];
      const sunsetStr = dailyData.sunset[targetIdx];

      const parseGstDate = (str) => {
        if (!str) return new Date();
        if (str instanceof Date) return str;
        if (typeof str === 'string' && (str.includes('+') || str.endsWith('Z'))) return new Date(str);
        return new Date(`${str}+04:00`);
      };

      const nowDate = activeTimeVal instanceof Date ? activeTimeVal : parseGstDate(activeTimeVal);
      const sunriseDate = parseGstDate(sunriseStr);
      const sunsetDate = parseGstDate(sunsetStr);

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
      sunTransit = checkTransitPosition(nowDate, sunriseDate, sunsetDate);
      if (sunTransit.visible) {
        const theta = sunTransit.progress * Math.PI;
        sunX = 250 + 180 * Math.cos(theta);
        sunY = 200 - dynamicSunRy * Math.sin(theta);
        currentSunElevationDeg = Math.max(1, Math.round(maxElevation * Math.sin(theta)));
      }

      // 2. Moon Transit
      moonDetails = getMoonDetails(dailyData.time[targetIdx]);
      const moonTimesObj = getMoonTimes(sunriseStr, sunsetStr, moonDetails.phase);
      const moonriseDate = moonTimesObj.riseDate || new Date(sunriseDate.getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);
      const moonsetDate = moonTimesObj.setDate || new Date(sunsetDate.getTime() + moonDetails.phase * 24 * 60 * 60 * 1000);

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
        <clipPath id="adsbViewportClip">
          <rect x="30" y="57.5" width="440" height="185" />
        </clipPath>
        <filter id="cloudBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="25" />
        </filter>
        <linearGradient id="radarSweepGradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="radarSweepGradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>

        {/* Dynamic Thermal Heatmap Radial Gradients */}
        <radialGradient id="heatHQ" cx="310" cy="170" r="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatNorth" cx="365" cy="100" r="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#eab308" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatSouth" cx="135" cy="180" r="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatSea" cx="240" cy="205" r="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#eab308" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
        </radialGradient>

        {/* Radiant Solar Corona & Photosphere Gradients */}
        <radialGradient id="sunCoronaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sunCoreGrad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="55%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>

      {/* Isometric 3D Map Image Backdrop */}
      <image href="xrange_map_3.png" xlinkHref="xrange_map_3.png" x="30" y="57.5" width="440" height="185" />

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

      {/* Subtle MGRS Grid Overlay (UTM Zone 39R • 100km Square YG • Abu Al Abyad Island) */}
      <g className="pointer-events-none">
        {/* Vertical MGRS Easting Lines (39R YG 78E to 98E) */}
        {[
          { x: 65, label: '78E', major: false },
          { x: 135, label: '82E', major: false },
          { x: 190, label: '85E', major: false },
          { x: 240, label: '88E', major: false },
          { x: 310, label: '90E', major: true },
          { x: 365, label: '95E', major: false },
          { x: 425, label: '98E', major: false }
        ].map(grid => (
          <g key={`mgrs-e-${grid.label}`}>
            <line
              x1={grid.x}
              y1="57.5"
              x2={grid.x}
              y2="242.5"
              stroke={grid.major ? '#38bdf8' : '#94a3b8'}
              strokeWidth={grid.major ? '0.45' : '0.3'}
              strokeDasharray={grid.major ? 'none' : '2.2,2.2'}
              opacity={grid.major ? '0.24' : '0.14'}
            />
            <text
              x={grid.x + 1.5}
              y="62.2"
              fill={grid.major ? '#38bdf8' : '#94a3b8'}
              fontSize="2.5"
              fontFamily="monospace"
              fontWeight="bold"
              opacity={grid.major ? '0.65' : '0.45'}
            >
              {grid.label}
            </text>
          </g>
        ))}

        {/* Horizontal MGRS Northing Lines (39R YG 84N to 74N) */}
        {[
          { y: 75, label: '84N', major: false },
          { y: 100, label: '81N', major: false },
          { y: 135, label: '80N', major: true },
          { y: 170, label: '78N', major: false },
          { y: 205, label: '76N', major: false },
          { y: 230, label: '74N', major: false }
        ].map(grid => (
          <g key={`mgrs-n-${grid.label}`}>
            <line
              x1="30"
              y1={grid.y}
              x2="470"
              y2={grid.y}
              stroke={grid.major ? '#38bdf8' : '#94a3b8'}
              strokeWidth={grid.major ? '0.45' : '0.3'}
              strokeDasharray={grid.major ? 'none' : '2.2,2.2'}
              opacity={grid.major ? '0.24' : '0.14'}
            />
            <text
              x="32.5"
              y={grid.y - 1.2}
              fill={grid.major ? '#38bdf8' : '#94a3b8'}
              fontSize="2.5"
              fontFamily="monospace"
              fontWeight="bold"
              opacity={grid.major ? '0.65' : '0.45'}
            >
              {grid.label}
            </text>
          </g>
        ))}

        {/* Subtle MGRS Grid Zone Designation Stamp (39R YG) */}
        <text
          x="466"
          y="62.2"
          textAnchor="end"
          fill="#38bdf8"
          fontSize="2.6"
          fontFamily="monospace"
          fontWeight="bold"
          opacity="0.55"
        >
          MGRS 39R YG • {currentStationInfo.mgrs || '39R YG 9058 7842'}
        </text>
      </g>

      {/* RainViewer Live Doppler Weather Radar Tile Overlay */}
      {(activeLayer === 'radar' || activeLayer === 'all') && apiData?.radarNowcast?.abuAlAbyadTileUrl && (
        <image
          href={apiData.radarNowcast.abuAlAbyadTileUrl}
          xlinkHref={apiData.radarNowcast.abuAlAbyadTileUrl}
          x="30"
          y="57.5"
          width="440"
          height="185"
          opacity={activeLayer === 'radar' ? 0.72 : 0.35}
          preserveAspectRatio="none"
          className="pointer-events-none"
        />
      )}

      {/* Live ADS-B Abu Al Abyad Island Overflight & 50 NM Regional Airspace Blips + Velocity Vectors */}
      {showAdsbTraffic && (
        <AdsbTrafficLayer contacts={apiData?.airspaceTraffic?.contacts} />
      )}

      {/* Tactical Radar Sweep (Pulsing sweep around active station) */}
      <g className="pointer-events-none">
        <g 
          className="animate-radar-sweep" 
          style={{ 
            transformOrigin: `${currentStationInfo.x}px ${currentStationInfo.y}px`,
            animationDuration: '6s'
          }}
        >
          <line 
            x1={currentStationInfo.x} 
            y1={currentStationInfo.y} 
            x2={currentStationInfo.x} 
            y2={currentStationInfo.y - 110} 
            stroke={isLightningActive ? "#ef4444" : "#10b981"} 
            strokeWidth="0.8" 
            opacity="0.25" 
          />
          <polygon 
            points={`${currentStationInfo.x},${currentStationInfo.y} ${currentStationInfo.x},${currentStationInfo.y - 110} ${currentStationInfo.x + 35},${currentStationInfo.y - 100} ${currentStationInfo.x},${currentStationInfo.y}`} 
            fill={`url(#radarSweepGradient-${isLightningActive ? 'red' : 'green'})`} 
            opacity="0.1" 
          />
        </g>
      </g>

      {/* Active Storm Cell Overlay & Lightning Strikes */}
      {isLightningActive && (
        <g className="pointer-events-none">
          <circle 
            cx="290" 
            cy="130" 
            r="45" 
            fill="#ef4444" 
            fillOpacity="0.08" 
            stroke="#ef4444" 
            strokeWidth="1" 
            strokeDasharray="3,3" 
            className="animate-pulse"
          />
          <circle 
            cx="280" 
            cy="125" 
            r="18" 
            fill="#dc2626" 
            fillOpacity="0.1" 
            stroke="#dc2626" 
            strokeWidth="0.75"
            strokeDasharray="1.5,1.5"
          />
          
          {/* Simulated strike points */}
          {[
            { id: 1, x: 275, y: 135 },
            { id: 2, x: 310, y: 120 },
            { id: 3, x: 190, y: 145 }
          ].map(strike => (
            <g key={strike.id} transform={`translate(${strike.x}, ${strike.y})`}>
              <circle cx="0" cy="0" r="8" fill="none" stroke="#facc15" strokeWidth="0.75" opacity="0.5">
                <animate attributeName="r" values="0;16" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite" />
              </circle>
              <path 
                d="M -1,-4 L 1.5,-1 L -0.5,0 L 1.5,4 L -2,0 L 0,-0.5 Z" 
                fill="#facc15" 
                stroke="#eab308" 
                strokeWidth="0.3" 
                className="animate-pulse"
              />
            </g>
          ))}
        </g>
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

        {/* Radiant Starburst Sun Transit Icon (Distinct from Circular Station Pins) */}
        {sunTransit.visible && (
          <g transform={`translate(${sunX}, ${sunY})`}>
            {/* Soft radial solar corona bloom */}
            <circle cx="0" cy="0" r="14" fill="url(#sunCoronaGlow)">
              <animate attributeName="r" values="12;16.5;12" dur="4s" repeatCount="indefinite" />
            </circle>

            {/* Slowly rotating 8-point tapered solar rays + corona ticks */}
            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 0 0"
                to="360 0 0"
                dur="28s"
                repeatCount="indefinite"
              />
              {/* 4 Primary Cardinal Tapered Sunbeams */}
              {[0, 90, 180, 270].map(angle => (
                <polygon
                  key={`sun-ray-maj-${angle}`}
                  points="0,-9.8 1.25,-4.6 -1.25,-4.6"
                  fill="#fde047"
                  opacity="0.92"
                  transform={`rotate(${angle})`}
                />
              ))}
              {/* 4 Intercardinal Tapered Sunbeams */}
              {[45, 135, 225, 315].map(angle => (
                <polygon
                  key={`sun-ray-min-${angle}`}
                  points="0,-7.8 0.95,-4.6 -0.95,-4.6"
                  fill="#f59e0b"
                  opacity="0.85"
                  transform={`rotate(${angle})`}
                />
              ))}
              {/* 8 Fine Outer Corona Ray Ticks */}
              {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(angle => (
                <line
                  key={`sun-tick-${angle}`}
                  x1="0"
                  y1="-5.2"
                  x2="0"
                  y2="-6.8"
                  stroke="#fef08a"
                  strokeWidth="0.45"
                  strokeLinecap="round"
                  opacity="0.7"
                  transform={`rotate(${angle})`}
                />
              ))}
            </g>

            {/* Golden-Yellow Solar Photosphere Core (No dark center ring like station pins) */}
            <circle
              cx="0"
              cy="0"
              r="4.1"
              fill="url(#sunCoreGrad)"
              stroke="#fef08a"
              strokeWidth="0.55"
            />

            {/* Subtle Solar Elevation Micro-Tag */}
            <g transform="translate(0, -11.8)">
              <rect
                x="-11.5"
                y="-2.6"
                width="23"
                height="4.4"
                rx="1"
                fill="#090d16"
                fillOpacity="0.82"
                stroke="#f59e0b"
                strokeWidth="0.35"
              />
              <text
                x="0"
                y="0.5"
                textAnchor="middle"
                fontSize="2.5"
                fontFamily="monospace"
                fontWeight="bold"
                fill="#fde047"
              >
                ☀ {currentSunElevationDeg}° EL
              </text>
            </g>
          </g>
        )}

        {/* Glowing Moon Transit Icon (Vector Lunar Phase Disc) */}
        {moonTransit.visible && (
          <g transform={`translate(${moonX}, ${moonY})`}>
            {/* Pulsing lunar halo */}
            <circle cx="0" cy="0" r="9" fill="#38bdf8" opacity="0.3">
              <animate attributeName="r" values="6;11;6" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0.1;0.35" dur="4s" repeatCount="indefinite" />
            </circle>
            {/* Dark lunar limb + exact illuminated phase */}
            <circle cx="0" cy="0" r="5" fill="#0f172a" stroke="#7dd3fc" strokeWidth="0.7" />
            {moonDetails && getLunarPhaseSvgPath(moonDetails.phase, 4.7) && (
              <path d={getLunarPhaseSvgPath(moonDetails.phase, 4.7)} fill="#f8fafc" />
            )}
          </g>
        )}
      </g>

      {/* Interactive Station Pins - WeatherNext 3 5km Multi-Station Microclimate Grid */}
      {stationsList
        .map(s => {
          const isSelected = currentActive === s.id;
          const readings = getStationReadingsAtOffset(s.id, forecastOffset);
          const safety = readings ? evaluateSafety(readings) : null;
          
          let statusColor = '#22c55e'; // Green
          if (safety?.status === 'AMBER') statusColor = '#f59e0b'; // Amber
          if (safety?.status === 'RED') statusColor = '#ef4444'; // Red

          const pinTemp = readings?.temperature_2m !== undefined ? `${readings.temperature_2m.toFixed(0)}°` : '--';
          const pinWind = readings?.wind_speed_10m !== undefined ? `${readings.wind_speed_10m.toFixed(0)}kph` : '--';

          return (
            <g 
              key={s.id} 
              transform={`translate(${s.x}, ${s.y})`} 
              className="cursor-pointer pointer-events-auto"
              onClick={() => setActiveStation && setActiveStation(s.id)}
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
                y="-8.5"
                textAnchor="middle"
                fontSize="7.2"
                fontWeight="black"
                fill={isSelected ? '#fb923c' : '#ffffff'}
                className="uppercase font-sans tracking-wider"
                style={{ textShadow: '0px 1.5px 4px rgba(0,0,0,0.98)' }}
              >
                {s.id === 'hq'
                  ? 'HQ • AF1R'
                  : s.id === 'south'
                  ? 'South • EM2R'
                  : s.id === 'sea'
                  ? 'Sea • AF2R'
                  : s.name.replace('Range ', '')}
              </text>

              {/* Micro Safety Telemetry Pill under Pin */}
              <g transform="translate(0, 10.5)">
                <rect
                  x="-24"
                  y="-4.6"
                  width="48"
                  height="9.2"
                  rx="1.5"
                  fill="#060911"
                  fillOpacity="0.92"
                  stroke={isSelected ? '#f97316' : statusColor}
                  strokeWidth={isSelected ? '0.9' : '0.7'}
                />
                <text
                  x="0"
                  y="1.5"
                  textAnchor="middle"
                  fontSize="5.3"
                  fontWeight="black"
                  fill="#ffffff"
                  className="font-mono"
                >
                  {pinTemp} • {pinWind}
                </text>
              </g>
            </g>
          );
        })}

      {/* 1. Thermal Heatmap Layer */}
      {activeLayer === 'thermal' && (
        <g className="pointer-events-none mix-blend-color-dodge">
          <rect x="30" y="57.5" width="440" height="185" fill="url(#heatHQ)" />
          <rect x="30" y="57.5" width="440" height="185" fill="url(#heatNorth)" />
          <rect x="30" y="57.5" width="440" height="185" fill="url(#heatSouth)" />
          <rect x="30" y="57.5" width="440" height="185" fill="url(#heatSea)" />
          
          {/* Contour Lines */}
          <path d="M 90 180 C 120 120, 180 140, 200 180 C 180 220, 120 220, 90 180 Z" fill="none" stroke="#dc2626" strokeWidth="0.75" strokeDasharray="3, 3" opacity="0.6" />
          <text x="135" y="145" fontSize="4.5" fill="#f87171" fontWeight="bold" opacity="0.8" textAnchor="middle">WBGT 44°C HEAT CONTOUR</text>
          
          <path d="M 270 170 C 290 130, 340 140, 350 170 C 330 200, 290 200, 270 170 Z" fill="none" stroke="#ef4444" strokeWidth="0.75" strokeDasharray="3, 3" opacity="0.5" />
          <text x="310" y="140" fontSize="4.5" fill="#fb923c" fontWeight="bold" opacity="0.8" textAnchor="middle">WBGT 41°C HEAT CONTOUR</text>
          
          <path d="M 320 100 C 340 70, 380 80, 390 100 C 370 120, 340 120, 320 100 Z" fill="none" stroke="#f59e0b" strokeWidth="0.75" strokeDasharray="3, 3" opacity="0.4" />
        </g>
      )}

      {/* 2. Wind Flow Vector Field Layer */}
      {activeLayer === 'wind' && (
        <g className="pointer-events-none">
          {windVectorGrid.map((p, idx) => {
            const wind = getInterpolatedWind(p.x, p.y);
            const angle = (wind.direction - 270 + 360) % 360;
            
            let color = '#10b981'; // Green
            if (wind.speed >= 38) color = '#ef4444'; // Red
            else if (wind.speed >= 25) color = '#f59e0b'; // Amber
            
            const animDuration = Math.max(1, 8 - (wind.speed / 6));

            return (
              <g 
                key={idx} 
                transform={`translate(${p.x}, ${p.y}) rotate(${angle})`}
                opacity="0.85"
              >
                <line 
                  x1="-6" 
                  y1="0" 
                  x2="6" 
                  y2="0" 
                  stroke={color} 
                  strokeWidth="1.2" 
                  strokeLinecap="round" 
                />
                <path 
                  d="M 2.5 -2.5 L 6 0 L 2.5 2.5" 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="1.2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <circle cx="-6" cy="0" r="0.9" fill="#ffffff">
                  <animate 
                    attributeName="cx" 
                    values="-6;6" 
                    dur={`${animDuration}s`} 
                    repeatCount="indefinite" 
                  />
                  <animate 
                    attributeName="opacity" 
                    values="0.2;1;0.2" 
                    dur={`${animDuration}s`} 
                    repeatCount="indefinite" 
                  />
                </circle>
              </g>
            );
          })}
        </g>
      )}

      {/* 3. Visibility Contours Layer */}
      {activeLayer === 'vis' && (
        <g className="pointer-events-none">
          {/* North Spit Haze */}
          <g>
            <path 
              d="M 310 90 Q 365 55 420 80 Q 445 110 395 130 Q 330 115 310 90 Z" 
              fill="#b45309" 
              fillOpacity="0.14" 
              stroke="#b45309" 
              strokeWidth="1.2" 
              strokeDasharray="3,3" 
            />
            <text x="365" y="92" fontSize="4.5" fill="#f59e0b" fontWeight="black" textAnchor="middle" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              🌫️ HAZE CONTROLS: 4.0KM
            </text>
          </g>

          {/* Sea Spit Severe Sandstorm */}
          <g className="animate-pulse" style={{ animationDuration: '3s' }}>
            <path 
              d="M 180 205 Q 240 180 300 205 Q 280 232 240 236 Q 195 232 180 205 Z" 
              fill="#78350f" 
              fillOpacity="0.22" 
              stroke="#78350f" 
              strokeWidth="1.5" 
              strokeDasharray="4,2" 
            />
            <text x="240" y="212" fontSize="5" fill="#ef4444" fontWeight="black" textAnchor="middle" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
              ⚠️ SANDSTORM LIMITS: 2.0KM
            </text>
          </g>
        </g>
      )}
    </svg>
  );

  // Precompute 25-step (0H..+24H) safety timeline strip for the active sector
  const timelineSafetySteps = Array.from({ length: 25 }, (_, h) => {
    const r = getStationReadingsAtOffset(currentActive, h);
    const ev = r ? evaluateSafety(r) : { status: 'GREEN' };
    return { hourOffset: h, status: ev.status, timeStr: r?.time ? r.time.slice(11, 16) : '' };
  });

  const formattedEffectiveGst = effectiveTime instanceof Date && !isNaN(effectiveTime.getTime())
    ? effectiveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' })
    : (stationReadings?.time?.slice(11, 16) || '--:--');

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
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md shadow-lg">
      <div className="absolute inset-0 bg-[radial-gradient(#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
      
      {/* Compact Title Bar */}
      <div className="flex justify-between items-center z-10 w-full border-b border-slate-800/60 pb-1.5 mb-1.5 flex-none">
        <div className="flex items-center space-x-2.5">
          <span className="text-[10.5px] text-white font-black uppercase tracking-widest">
            Z12 • XRANGE TACTICAL MAP
          </span>
          <span className={`text-[9px] font-black uppercase tracking-widest flex items-center space-x-1 ${isLightningActive ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLightningActive ? 'animate-ping' : ''}`} />
            <span>{isLightningActive ? '🔴 LIVE ALERT' : '🟢 Radar Connected'}</span>
          </span>
          <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">
            ({isSimulated ? 'Simulated Overlay' : 'Live GPS Grid'})
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {/* WeatherNext 3 5km Microclimate Station Quick Switcher (Auto-Rotates every 30s) */}
          <div className="hidden sm:flex items-center space-x-0.5 bg-slate-900/95 p-0.5 rounded-lg border border-slate-700/80 shadow-inner">
            {stationsList.map(st => {
              const isStActive = currentActive === st.id;
              const stData = getStationReadingsAtOffset(st.id, forecastOffset);
              const tempVal = stData ? `${stData.temperature_2m.toFixed(0)}°` : '';
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveStation && setActiveStation(st.id)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1 ${
                    isStActive
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm shadow-orange-950/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={`Switch active telemetry to ${st.name} (Auto-rotates every 30s)`}
                >
                  <span>{st.id.toUpperCase()}</span>
                  {tempVal && <span className="text-[8.5px] opacity-95 font-mono">{tempVal}</span>}
                </button>
              );
            })}
            {onToggleAutoRotate && (
              <button
                type="button"
                onClick={onToggleAutoRotate}
                className={`ml-0.5 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-black uppercase transition cursor-pointer flex items-center space-x-1 border ${
                  isAutoRotate
                    ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title={isAutoRotate ? 'Auto-rotating HQ → NORTH → SOUTH → SEA every 30s (Click to pause)' : '30s Auto-rotation paused (Click to resume)'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isAutoRotate ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>30s</span>
              </button>
            )}
          </div>

          {isSimulated && onToggleSimulatedLightning && (
            <button
              onClick={onToggleSimulatedLightning}
              className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                simulatedLightning 
                  ? 'bg-red-500/25 border-red-500/50 text-red-200 hover:bg-red-500/40' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              ⚡ Test Lightning: {simulatedLightning ? 'ON' : 'OFF'}
            </button>
          )}
          <span className="bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-lg text-[8px] font-bold text-slate-400 flex items-center space-x-1.5 flex-shrink-0 shadow-sm">
            <Map className="w-2.5 h-2.5 text-edgeOrange" />
            <span>ABU AL ABYAD ISLAND</span>
          </span>
        </div>
      </div>

      {/* Dedicated NCM Alerts Area (Full-Width Strip) */}
      <div className="w-full flex-none mb-1.5 z-10">
        {activeWarning ? (
          <div className={`p-2 rounded-lg border text-left flex flex-col justify-center space-y-0.5 shadow-md ${
            activeWarning.type === 'RED' ? 'bg-red-500/10 border-red-500/30 text-red-200 shadow-red-500/5' :
            activeWarning.type === 'AMBER' ? 'bg-amber-500/10 border-amber-500/30 text-amberAlert shadow-amber-500/5' :
            'bg-yellow-500/10 border-yellow-500/30 text-yellow-300 shadow-yellow-500/5'
          }`}>
            <div className="flex justify-between items-center mb-0.5">
              <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-black tracking-wider uppercase leading-none animate-pulse ${
                activeWarning.type === 'RED' ? 'bg-red-500/35 text-red-100' :
                activeWarning.type === 'AMBER' ? 'bg-amber-500/35 text-amber-100' :
                'bg-yellow-500/35 text-yellow-900'
              }`}>
                NCM {activeWarning.type} ALERT: {activeWarning.title}
              </span>
              <span className="text-[7.5px] text-slate-400 font-mono">
                EXPIRY: {activeWarning.expiry.slice(11, 16)}
              </span>
            </div>
            <p className="text-[9.5px] font-bold leading-normal text-slate-200">
              {activeWarning.description}
            </p>
          </div>
        ) : (
          <div className="bg-green-500/5 border border-green-500/20 text-green-400 px-3 py-1 rounded-lg text-[8.5px] font-black tracking-widest leading-none flex items-center justify-between shadow-sm shadow-green-500/2">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
              <span>NCM WEATHER STANDARDS: SECURE</span>
            </div>
            <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">
              No Active Warnings
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex items-center justify-between flex-grow min-h-0 z-10 gap-3">
        <div className={`${(hideDetails || !showSimulatedStations) ? 'w-full' : 'w-[58%]'} h-full relative border border-slate-700/30 rounded-lg bg-bgDeepSpace/40 overflow-hidden flex items-center justify-center`}>
          {mapContent}

          {/* Top-Left Sector Safety Situational HUD Banner */}
          {!isBackground && (
            <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-25">
              <div className={`pointer-events-auto flex items-center space-x-2 px-2.5 py-1 border backdrop-blur-md shadow-lg text-[8px] font-black uppercase tracking-wider ${
                activeStationSafety.status === 'RED'
                  ? 'bg-red-950/90 border-red-500/60 text-red-200'
                  : activeStationSafety.status === 'AMBER'
                  ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                  : 'bg-slate-950/85 border-emerald-500/40 text-emerald-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activeStationSafety.status === 'RED' ? 'bg-red-500 animate-ping' :
                  activeStationSafety.status === 'AMBER' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`} />
                <span className="text-textIceWhite font-mono">
                  {forecastOffset === 0 ? 'LIVE' : `+${forecastOffset}H (${formattedEffectiveGst} GST)`}
                </span>
                <span className="text-slate-600">|</span>
                <span>{currentStationInfo.name}: {activeStationSafety.status}</span>
                <span className="hidden md:inline text-slate-300 font-bold normal-case truncate max-w-[230px]">
                  — {activeStationSafety.reasons[0] || 'All safety parameters within limits'}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 pointer-events-auto">
                {/* Live QNH & ADS-B Sector Status Pill (Click to Toggle Aircraft Display ON/OFF) */}
                <button
                  type="button"
                  onClick={() => setShowAdsbTraffic(prev => !prev)}
                  className={`hidden sm:flex items-center space-x-1.5 px-2 py-1 border backdrop-blur-md shadow-lg text-[7.5px] font-mono font-black uppercase cursor-pointer transition-all ${
                    !showAdsbTraffic
                      ? 'bg-slate-950/75 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                      : (apiData?.airspaceTraffic?.activeOverIslandCount || 0) > 0
                      ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
                      : (apiData?.airspaceTraffic?.inboundToIslandCount || 0) > 0
                      ? 'bg-amber-950/90 border-amber-500/70 text-amber-200'
                      : 'bg-cyan-950/90 border-cyan-400/70 text-cyan-200'
                  }`}
                  title={showAdsbTraffic ? 'Click to HIDE 50 NM ADS-B Airspace Radar & Aircraft' : 'Click to SHOW 50 NM ADS-B Airspace Radar & Aircraft'}
                >
                  <span>
                    ✈️ {!showAdsbTraffic
                      ? 'ADS-B: OFF'
                      : (apiData?.airspaceTraffic?.activeOverIslandCount || 0) > 0
                      ? `${apiData.airspaceTraffic.activeOverIslandCount} OVER ISL`
                      : (apiData?.airspaceTraffic?.inboundToIslandCount || 0) > 0
                      ? `${apiData.airspaceTraffic.inboundToIslandCount} INBOUND`
                      : `50NM: ${apiData?.airspaceTraffic?.totalTracked50nm ?? 0} ACFT`}
                  </span>
                  {apiData?.aviationMetarTaf?.primaryQnhHpa && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className={showAdsbTraffic ? 'text-cyan-300' : 'text-slate-400'}>
                        OMAA Q{apiData.aviationMetarTaf.primaryQnhHpa} ({apiData.aviationMetarTaf.sectorFlightCategory || 'VFR'})
                      </span>
                    </>
                  )}
                </button>

                {forecastOffset > 0 && (
                  <button
                    type="button"
                    onClick={() => { setForecastOffset(0); setIsPlaying(false); }}
                    className="flex items-center space-x-1 px-2 py-1 bg-orange-600/90 hover:bg-orange-500 text-white border border-orange-400/60 text-[7.5px] font-black uppercase tracking-wider cursor-pointer shadow-lg transition-all"
                    title="Reset map to live conditions"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Return to Live</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom Tactical Dock: Overlay Selector (Left) + 24-Hour Safety Time-Scrubber (Right) */}
          {!isBackground && (
            <div className="absolute bottom-2 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-1.5 select-none z-25 pointer-events-none">
              {/* Layer Switcher */}
              <div className="pointer-events-auto flex items-center bg-slate-950/90 rounded-lg p-0.5 border border-slate-800/90 text-[7.5px] font-black uppercase tracking-wider backdrop-blur-md shadow-xl">
                <button
                  type="button"
                  onClick={() => setActiveLayer('none')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer font-sans ${
                    activeLayer === 'none'
                      ? 'bg-slate-800 text-textIceWhite font-black border border-slate-700/60 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  Satellite
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer(prev => prev === 'thermal' ? 'none' : 'thermal')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center space-x-1 font-sans ${
                    activeLayer === 'thermal'
                      ? 'bg-red-500/20 text-red-200 border border-red-500/40 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>Thermal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer(prev => prev === 'wind' ? 'none' : 'wind')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center space-x-1 font-sans ${
                    activeLayer === 'wind'
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  <span>Wind</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer(prev => prev === 'vis' ? 'none' : 'vis')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center space-x-1 font-sans ${
                    activeLayer === 'vis'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Vis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer(prev => prev === 'radar' ? 'none' : 'radar')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center space-x-1 font-sans ${
                    activeLayer === 'radar'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                  title="RainViewer Live Doppler Weather Radar Overlay"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Radar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdsbTraffic(prev => !prev)}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center space-x-1 font-sans ${
                    !showAdsbTraffic
                      ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/60 border border-transparent'
                      : (apiData?.airspaceTraffic?.activeOverIslandCount || 0) > 0
                      ? 'bg-red-950/70 text-red-200 border border-red-500/50 shadow-inner'
                      : 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-inner'
                  }`}
                  title={showAdsbTraffic ? 'Click to turn OFF ADS-B aircraft overlay' : 'Click to turn ON ADS-B aircraft overlay'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    !showAdsbTraffic
                      ? 'bg-slate-600'
                      : (apiData?.airspaceTraffic?.activeOverIslandCount || 0) > 0
                      ? 'bg-red-500 animate-pulse'
                      : (apiData?.airspaceTraffic?.inboundToIslandCount || 0) > 0
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-cyan-400 animate-pulse'
                  }`} />
                  <span>
                    {!showAdsbTraffic
                      ? 'ADS-B: OFF'
                      : (apiData?.airspaceTraffic?.activeOverIslandCount || 0) > 0
                      ? `ADS-B: ON • ${apiData.airspaceTraffic.activeOverIslandCount} OVER ISL`
                      : (apiData?.airspaceTraffic?.inboundToIslandCount || 0) > 0
                      ? `ADS-B: ON • ${apiData.airspaceTraffic.inboundToIslandCount} INBOUND`
                      : `ADS-B: ON (${apiData?.airspaceTraffic?.totalTracked50nm ?? 0})`}
                  </span>
                </button>
              </div>

              {/* Interactive 24-Hour Safety Forecast Scrubber */}
              <div className="pointer-events-auto flex items-center space-x-2 bg-slate-950/90 border border-slate-800/90 px-2.5 py-1 backdrop-blur-md shadow-xl flex-1 max-w-[360px] min-w-[210px]">
                <button
                  type="button"
                  onClick={() => setIsPlaying(prev => !prev)}
                  className={`p-1 border transition-all cursor-pointer flex items-center justify-center ${
                    isPlaying
                      ? 'bg-orange-600 border-orange-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                  }`}
                  title={isPlaying ? 'Pause 24-hour safety playback' : 'Play 24-hour safety forecast'}
                >
                  {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                </button>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-wider mb-0.5">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Clock className="w-2.5 h-2.5 text-edgeOrange" />
                      <span>24H SAFETY TIMELINE</span>
                    </span>
                    <span className={`font-mono ${forecastOffset > 0 ? 'text-edgeOrange' : 'text-emerald-400'}`}>
                      {forecastOffset === 0 ? 'NOW (LIVE)' : `+${forecastOffset}H • ${formattedEffectiveGst}`}
                    </span>
                  </div>

                  {/* Color-coded 25-hour safety strip + range input */}
                  <div className="relative w-full h-2.5 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 flex overflow-hidden border border-slate-800/80 pointer-events-none">
                      {timelineSafetySteps.map(step => (
                        <div
                          key={step.hourOffset}
                          className={`flex-1 h-full ${
                            step.status === 'RED'
                              ? 'bg-red-500/80'
                              : step.status === 'AMBER'
                              ? 'bg-amber-500/80'
                              : 'bg-emerald-500/65'
                          } ${step.hourOffset === forecastOffset ? 'ring-1 ring-white z-10' : 'opacity-75'}`}
                        />
                      ))}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      step="1"
                      value={forecastOffset}
                      onChange={(e) => {
                        setIsPlaying(false);
                        setForecastOffset(Number(e.target.value));
                      }}
                      className="relative w-full h-2.5 opacity-0 cursor-pointer z-20"
                      title="Scrub +0h to +24h to inspect projected sector safety status"
                    />
                    {/* Custom Thumb Indicator */}
                    <div
                      className="absolute top-0 bottom-0 w-1.5 bg-white border border-slate-950 shadow pointer-events-none z-15"
                      style={{ left: `calc(${(forecastOffset / 24) * 100}% - 3px)` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {!hideDetails && showSimulatedStations && (
          <div className="w-[39%] h-full">
            <StationDetailsWidget 
              apiData={apiData} 
              isSimulated={isSimulated} 
              activeStation={currentActive} 
              setActiveStation={setActiveStation}
              warnings={warnings}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Named export for the station details panel
export function StationDetailsWidget({ apiData, isSimulated, activeStation, setActiveStation, warnings = [] }) {
  const currentStationInfo = stationsList.find(s => s.id === activeStation) || stationsList[0];
  const stationReadings = isSimulated && apiData?.current
    ? currentStationInfo.getReadings(apiData.current)
    : (apiData?.stations?.[currentStationInfo.id]?.current || apiData?.current || null);
  let safety = stationReadings ? evaluateSafety(stationReadings, stationReadings.time ?? apiData?.current?.time ?? null) : null;

  const isLightningActive = warnings.some(w => w.category === 'LIGHTNING');

  if (isLightningActive && safety) {
    safety = {
      ...safety,
      status: 'RED',
      reasons: [
        '⚡ EMERGENCY: Severe thunderstorm & lightning strikes detected. Evacuate all personnel to shelters.',
        ...safety.reasons
      ]
    };
  }

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

        {isLightningActive && (
          <div className="mb-3 border border-red-500 bg-red-500/10 p-2.5 rounded-none flex items-start space-x-2 animate-pulse flex-none">
            <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 flex-none" />
            <div>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-wide">
                LIGHTNING WARNING IN EFFECT
              </p>
              <p className="text-[9px] font-bold text-slate-200 mt-0.5 leading-tight uppercase">
                Active strikes detected over the sector. Suspend all live fire training and seek immediate shelter.
              </p>
            </div>
          </div>
        )}

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
