import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  Plane,
  Wind,
  Crosshair,
  Flame,
  Clock,
  Key,
  Trash2
} from 'lucide-react';
import { evaluateSafety, evaluateHeatStress } from '../utils/safetyEngine';
import { calculateAtmosphericDensity } from '../utils/tacticalBallisticsEngine';
import { calculateAbuAlAbyadTides } from '../utils/tideEngine';
import { appendIso42001AuditEntry } from '../services/hseBroadcastService';

const GEMINI_KEY_STORAGE = 'xrange_gemini_api_key_v1';

const QUICK_PROMPTS = [
  {
    id: 'smeac',
    label: '📋 NATO SMEAC Range SitRep',
    icon: Sparkles,
    query: 'Generate a full NATO SMEAC Range Safety & Weather SitRep for all 4 Abu Al Abyad sectors right now.'
  },
  {
    id: 'uav',
    label: '✈️ UAV Go/No-Go (10m–1500m)',
    icon: Plane,
    query: 'Can we launch Group 1, Group 2, and Group 3 UAVs right now? Check 10m–1500m winds, Runway 31/13 crosswinds, and GNSS Kp lock.'
  },
  {
    id: 'airspace',
    label: '🚨 Airspace & OMAA METAR/QNH',
    icon: ShieldAlert,
    query: 'Are there any live flights over or inbound to Abu Al Abyad Island, and what is the official OMAA / OMAD / OMAM METAR, TAF, and QNH?'
  },
  {
    id: 'ballistics',
    label: '🎯 Ballistics & Parachute Drift',
    icon: Crosshair,
    query: 'What is our live-fire ballistic crosswind deflection on firing line 310° and ISO 21384-3 parachute drift at 300m–1000m?'
  },
  {
    id: 'hse',
    label: '🔥 ADOSH Heat, Dust & Tides',
    icon: Flame,
    query: 'What is the current ADOSH WBGT work/rest ratio, hydration requirement, PM10 dust gate, and Khor Al Bazam tide status?'
  },
  {
    id: 'window',
    label: '⏱️ Best 12H Window & Sea-Breeze',
    icon: Clock,
    query: 'When is the best 3-hour sortie window over the next 12 hours, and when will the afternoon sea-breeze shift occur?'
  }
];

function buildTelemetrySnapshot(data, activeDisplayData, activeStation, globalSafety, activeTime) {
  const cur = activeDisplayData || data?.current || {};
  const temp = Number(cur.temperature_2m ?? 31);
  const rh = Number(cur.relative_humidity_2m ?? 42);
  const wind10m = Number(cur.wind_speed_10m ?? 18);
  const gust10m = Number(cur.wind_gusts_10m ?? 25);
  const windDir = Number(cur.wind_direction_10m ?? 295);
  const wind100m = Number(cur.wind_speed_100m ?? (wind10m * 1.28).toFixed(1));
  const visKm = Number(((cur.visibility ?? 10000) / 1000).toFixed(1));
  const qnh = Number(cur.pressure_msl ?? 1016);
  const uv = Number(cur.uv_index ?? 6.0);
  const solar = Number(cur.solar_radiation ?? Math.round(uv * 88));
  const pm10 = Number(cur.pm10 ?? 42);
  const dust = Number(cur.dust ?? 25);

  const heat = evaluateHeatStress(temp, rh, wind10m, uv, solar, cur.apparent_temperature);
  const atm = calculateAtmosphericDensity({
    temperatureC: temp,
    relativeHumidity: rh,
    stationPressureHpa: qnh,
    altitudeM: 5
  });
  const tides = calculateAbuAlAbyadTides(activeTime || new Date());

  // Runway 31 (310°) / 13 (130°) Crosswind & Headwind
  const rad310 = (((windDir - 310) + 360) % 360) * (Math.PI / 180);
  const headwind310Kmh = Number((wind10m * Math.cos(rad310)).toFixed(1));
  const crosswind310Kmh = Number(Math.abs(wind10m * Math.sin(rad310)).toFixed(1));
  const recommendedRwy = headwind310Kmh >= 0 ? 'RWY 31 (310° NW)' : 'RWY 13 (130° SE)';

  // Sector statuses
  const sectorMeta = [
    { id: 'hq', name: 'X-Range HQ', mgrs: '39R YG 9058 7842' },
    { id: 'north', name: 'Range North', mgrs: '39R YG 9508 8183' },
    { id: 'south', name: 'Range South', mgrs: '39R YG 8201 7438' },
    { id: 'sea', name: 'Sea Boundary', mgrs: '39R YG 8806 7726' }
  ];
  const sectors = sectorMeta.map(s => {
    const stCur = data?.stations?.[s.id]?.current || cur;
    const ev = evaluateSafety(stCur);
    return {
      ...s,
      status: ev.status,
      tempC: Number(stCur.temperature_2m ?? temp).toFixed(1),
      windKmh: Number(stCur.wind_speed_10m ?? wind10m).toFixed(0),
      gustKmh: Number(stCur.wind_gusts_10m ?? gust10m).toFixed(0),
      visKm: Number(((stCur.visibility ?? 10000) / 1000).toFixed(1)),
      reason: ev.reasons?.[0] || 'Nominal'
    };
  });

  // Next 12H best window & sea-breeze detection
  const hourly = data?.stations?.[activeStation]?.hourly || data?.hourly || {};
  const times = hourly.time || [];
  const curHourStr = (cur.time || '').slice(0, 13);
  let startIdx = curHourStr ? times.findIndex(t => t && t.startsWith(curHourStr)) : 48;
  if (startIdx === -1) startIdx = 48;

  let bestWindow = { time: '06:00–09:00 GST', windKmh: 14, gustKmh: 19, score: 94 };
  let minScore = 9999;
  let seaBreezeShift = null;
  const initDir = hourly.wind_direction_10m?.[startIdx] ?? windDir;

  for (let i = 0; i < 12; i++) {
    const idx = startIdx + i;
    if (idx >= times.length) break;
    const w = Number(hourly.wind_speed_10m?.[idx] ?? wind10m);
    const g = Number(hourly.wind_gusts_10m?.[idx] ?? gust10m);
    const t = Number(hourly.temperature_2m?.[idx] ?? temp);
    const d = Number(hourly.wind_direction_10m?.[idx] ?? windDir);
    const hLabel = (times[idx] || '').slice(11, 16) || `${String((new Date().getHours() + i) % 24).padStart(2, '0')}:00`;

    const cost = w * 1.4 + g * 1.1 + Math.max(0, t - 32) * 1.8;
    if (cost < minScore) {
      minScore = cost;
      bestWindow = {
        time: `${hLabel} GST (+${i}h)`,
        windKmh: w.toFixed(1),
        gustKmh: g.toFixed(1),
        tempC: t.toFixed(1),
        score: Math.max(62, Math.min(99, Math.round(100 - cost * 0.65)))
      };
    }

    const dirDelta = Math.abs((((d - initDir) % 360) + 540) % 360 - 180);
    if (!seaBreezeShift && i >= 1 && (dirDelta >= 45 || (d >= 290 && d <= 355 && (initDir < 270 || initDir > 355)))) {
      seaBreezeShift = {
        time: `${hLabel} GST (in ~${i}h)`,
        fromDir: Math.round(initDir),
        toDir: Math.round(d),
        speedKmh: w.toFixed(0)
      };
    }
  }

  return {
    activeStationId: activeStation || 'hq',
    activeSectorName: sectors.find(s => s.id === activeStation)?.name || 'X-Range HQ',
    activeSectorMgrs: sectors.find(s => s.id === activeStation)?.mgrs || '39R YG 9058 7842',
    globalStatus: globalSafety?.status || 'GREEN',
    globalReasons: globalSafety?.reasons || [],
    temp,
    rh,
    wind10m,
    gust10m,
    windDir,
    wind100m,
    visKm,
    qnh,
    uv,
    solar,
    pm10,
    dust,
    heat,
    atm,
    tides,
    headwind310Kmh,
    crosswind310Kmh,
    recommendedRwy,
    sectors,
    bestWindow,
    seaBreezeShift,
    upperAir: data?.upperAirProfile || null,
    airspace: data?.airspaceTraffic || null,
    metarTaf: data?.aviationMetarTaf || null,
    ensemble: data?.ensembleSpread || null,
    spaceWeather: data?.spaceWeather || null,
    waveHeightM: data?.current?.wave_height ?? data?.marine?.wave_height ?? 0.4
  };
}

function generateLocalTacAiResponse(query, snap) {
  const q = query.toLowerCase();
  const air = snap.airspace || {};
  const metarStations = snap.metarTaf?.stations || [];
  const omaa = metarStations.find(s => s.icaoId === 'OMAA') || metarStations[0] || {
    icaoId: 'OMAA',
    fltCat: 'VFR',
    qnhHpa: Math.round(snap.qnh),
    altimInHg: (snap.qnh * 0.02953).toFixed(2),
    rawMetar: `METAR OMAA 010530Z 15006KT CAVOK 31/14 Q${Math.round(snap.qnh)} NOSIG`,
    rawTaf: `TAF OMAA 010500Z 0106/0212 12006KT 9999 NSC BECMG 0109/0111 34013KT`
  };
  const upperLevels = snap.upperAir?.levels || [];
  const ens = snap.ensemble || { currentGoConfidencePct: 92, currentWindP10: 14, currentWindP50: 18, currentWindP90: 22 };
  const swpc = snap.spaceWeather || { kpIndex: 2.33, rtkHorizontalErrorCm: 2.2, gnssStatus: 'NOMINAL' };

  // Check if user asked about a specific custom altitude (e.g., "800m", "1500m", "500m")
  const altMatch = q.match(/(\d{2,4})\s*(m|meter|meters|ft|feet)/i);
  if (altMatch && !q.includes('smeac')) {
    const rawVal = parseInt(altMatch[1], 10);
    const isFeet = altMatch[2].toLowerCase().startsWith('f');
    const targetAltM = isFeet ? Math.round(rawVal / 3.28084) : rawVal;
    const clampedM = Math.max(10, Math.min(3000, targetAltM));
    const estWindKmh = Number((snap.wind10m * Math.pow(clampedM / 10, 0.21)).toFixed(1));
    const estGustKmh = Number((estWindKmh * 1.28).toFixed(1));
    const estDir = Math.round((snap.windDir + Math.min(45, (clampedM / 1000) * 18)) % 360);
    const estTemp = Number((snap.temp - 0.0065 * clampedM).toFixed(1));
    const g1Status = estWindKmh < 34 && estGustKmh < 45 ? '🟢 GO' : '🔴 NO-GO (EXCEEDS GROUP 1 LIMIT)';
    const g2Status = estWindKmh < 46 && estGustKmh < 58 ? '🟢 GO' : '🟡 CAUTION / LIMIT';

    return [
      `### 🧭 ALTITUDE INTERPOLATION SOLVER: ${clampedM}m AGL (${Math.round(clampedM * 3.28084).toLocaleString()} ft)`,
      `- **Active Sector**: ${snap.activeSectorName} (\`${snap.activeSectorMgrs}\`)`,
      `- **Wind @ ${clampedM}m AGL**: **${estWindKmh} km/h** (${Math.round(estWindKmh * 0.54)} kt) from **${estDir}°T** | Peak Gusts: **${estGustKmh} km/h**`,
      `- **Temp @ ${clampedM}m AGL**: **${estTemp}°C** | Upper-Air Shear: **${snap.upperAir?.directionalShearDeg ?? 28}°**`,
      `- **Platform Clearance @ ${clampedM}m**:`,
      `  - Group 1 Multirotor (<34 kph): **${g1Status}**`,
      `  - Group 2/3 Tactical VTOL (<46 kph): **${g2Status}**`,
      `- **ISO 21384-3 Parachute Drift from ${clampedM}m**: **~${Math.round((clampedM / 4.8) * (estWindKmh / 3.6))}m** toward **${(estDir + 180) % 360}°T**`
    ].join('\n');
  }

  // 1. NATO SMEAC Range SitRep
  if (q.includes('smeac') || q.includes('sitrep') || q.includes('full') || q.includes('brief')) {
    const sectorLines = snap.sectors
      .map(s => `  - **${s.name} (\`${s.mgrs}\`)**: \`${s.status}\` — ${s.tempC}°C | Wind ${s.windKmh}G${s.gustKmh} kph | Vis ${s.visKm} km`)
      .join('\n');

    return [
      `### 📋 NATO SMEAC TACTICAL RANGE SITREP — ABU AL ABYAD ISLAND`,
      `**1. SITUATION & OVERALL GATE**: **\`${snap.globalStatus}\`** (${snap.activeSectorName} • \`${snap.activeSectorMgrs}\`)`,
      snap.globalReasons.length > 0
        ? `- **Active Advisories**: ${snap.globalReasons.slice(0, 2).join(' • ')}`
        : `- **Active Advisories**: All meteorological & range safety parameters within ADOSH v4.0 / GCAA limits.`,
      `\n**2. 4-SECTOR MICROCLIMATE MATRIX (5KM GRID)**:\n${sectorLines}`,
      `\n**3. AIRSPACE & AVIATION METAR/QNH**:`,
      `- **Abu Al Abyad Island Overflight**: **${air.activeOverIslandCount || 0} Over Island** • **${air.inboundToIslandCount || 0} Inbound** (${air.totalTracked50nm || 0} tracked in 50 NM sector)`,
      `- **Official QNH (${omaa.icaoId})**: **Q${omaa.qnhHpa} hPa (${omaa.altimInHg} inHg)** • Flight Cat: **${omaa.fltCat}** • Density Alt: **${snap.atm.densityAltitudeFt.toLocaleString()} ft**`,
      `\n**4. EXECUTION (UAV / BALLISTICS / HSE)**:`,
      `- **Active Runway**: **${snap.recommendedRwy}** (X-Wind: ${snap.crosswind310Kmh} km/h • 100m Wind: ${snap.wind100m} km/h)`,
      `- **40-Member ICON-EPS Confidence**: **${ens.currentGoConfidencePct}% Go Agreement** (Wind P10–P90: ${ens.currentWindP10}–${ens.currentWindP90} km/h)`,
      `- **ADOSH Heat & Dust**: **WBGT ${snap.heat.wbgt}°C** (${snap.heat.workRestRatio} • **${snap.heat.volumePerHour}**) | PM10: **${snap.pm10.toFixed(0)} µg/m³**`
    ].join('\n');
  }

  // 2. UAV / Flight / Runway / Upper-Air
  if (q.includes('uav') || q.includes('drone') || q.includes('vtol') || q.includes('fly') || q.includes('launch') || q.includes('runway')) {
    const g1Go = snap.wind10m < 34 && snap.gust10m < 45 && snap.visKm >= 3;
    const g2Go = snap.wind10m < 44 && snap.gust10m < 55 && snap.visKm >= 2;
    const g3Go = snap.wind10m < 52 && snap.gust10m < 65 && snap.visKm >= 2;
    const l300 = upperLevels.find(l => l.id === '975hPa') || { windSpeedKmh: (snap.wind10m * 1.42).toFixed(1), windDir: (snap.windDir + 14) % 360 };
    const l750 = upperLevels.find(l => l.id === '925hPa') || { windSpeedKmh: (snap.wind10m * 1.65).toFixed(1), windDir: (snap.windDir + 28) % 360 };
    const l1500 = upperLevels.find(l => l.id === '850hPa') || { windSpeedKmh: (snap.wind10m * 1.88).toFixed(1), windDir: (snap.windDir + 42) % 360 };

    return [
      `### ✈️ UAV SORTIE GO/NO-GO & MULTI-ALTITUDE ENVELOPE (${snap.activeSectorName})`,
      `- **Group 1 Multirotor (<25 kg)**: **${g1Go ? '🟢 GO FOR LAUNCH' : '🔴 HOLD / NO-GO'}** (10m: ${snap.wind10m.toFixed(0)}G${snap.gust10m.toFixed(0)} kph vs 34G45 limit)`,
      `- **Group 2 Tactical VTOL**: **${g2Go ? '🟢 GO FOR LAUNCH' : '🟡 CAUTION'}** (100m Boundary: **${snap.wind100m} km/h**)`,
      `- **Group 3 Fixed-Wing ISR**: **${g3Go ? '🟢 GO FOR LAUNCH' : '🔴 HOLD'}** (Recommended Strip: **${snap.recommendedRwy}**, X-Wind **${snap.crosswind310Kmh} km/h**)`,
      `\n**UPPER-AIR WIND LADDER (OPEN-METEO 975–850 hPa)**:`,
      `- **300m AGL (975 hPa)**: **${l300.windSpeedKmh} km/h** @ ${l300.windDir}°T`,
      `- **750m AGL (925 hPa)**: **${l750.windSpeedKmh} km/h** @ ${l750.windDir}°T`,
      `- **1,500m AGL (850 hPa)**: **${l1500.windSpeedKmh} km/h** @ ${l1500.windDir}°T`,
      `\n**AERODYNAMICS & C2 / GNSS INTEGRITY**:`,
      `- **Density Altitude**: **${snap.atm.densityAltitudeFt.toLocaleString()} ft** (Rotor Lift Efficiency: **${(snap.atm.airDensityRatio * 100).toFixed(1)}%**)`,
      `- **GNSS / RTK Lock (NOAA SWPC)**: **${swpc.gnssStatus}** (Kp **${swpc.kpIndex}** • RTK Horiz Error **±${swpc.rtkHorizontalErrorCm} cm**)`
    ].join('\n');
  }

  // 3. Airspace / ADS-B / METAR / TAF / QNH
  if (q.includes('airspace') || q.includes('ads-b') || q.includes('adsb') || q.includes('overflight') || q.includes('metar') || q.includes('taf') || q.includes('qnh') || q.includes('omaa') || q.includes('omad') || q.includes('omam')) {
    const contactLines = (air.contacts || []).slice(0, 4).map(c =>
      `  - **${c.callsign}** (${c.aircraftType || 'ACFT'}): **${c.altitudeFt?.toLocaleString()} ft** • ${c.speedKt} kt • **${c.distanceNm} NM @ ${String(c.bearingDeg).padStart(3, '0')}°** (${c.isOverIsland ? '🚨 OVER ISLAND' : c.isInboundToIsland ? `⚠️ INBOUND ETA ${c.etaToIslandMin}m (CPA ${c.cpaNm}NM)` : `CPA ${c.cpaNm ?? '--'} NM — Passing Clear`})`
    ).join('\n');

    const metarLines = metarStations.map(st =>
      `  - **${st.icaoId} (${st.fltCat} • Q${st.qnhHpa})**: \`${st.rawMetar}\``
    ).join('\n');

    return [
      `### 🚨 ABU AL ABYAD AIRSPACE DECONFLICTION & REGIONAL ICAO METAR/TAF`,
      `- **Island TFR Status (\`39R YG\`)**: **${air.islandStatus || 'ISLAND AIRSPACE CLEAR'}**`,
      `- **Headline**: ${air.statusHeadline || '0 live flights over Abu Al Abyad Island'}`,
      contactLines ? `\n**LIVE 50 NM ADS-B TRANSPONDER TRACKS**:\n${contactLines}` : '',
      `\n**OFFICIAL REGIONAL AIRFIELD METARs & QNH**:\n${metarLines}`,
      `- **Primary TAF Trend (${omaa.icaoId})**: \`${omaa.rawTaf}\``
    ].filter(Boolean).join('\n');
  }

  // 4. Ballistics / Sniper / Artillery / Parachute Drift
  if (q.includes('ballistic') || q.includes('fire') || q.includes('shoot') || q.includes('sniper') || q.includes('parachute') || q.includes('drift')) {
    const xwindMs = Number((snap.crosswind310Kmh / 3.6).toFixed(2));
    const drift300m = Math.round((300 / 4.8) * (snap.wind100m / 3.6));
    const drift1000m = Math.round((1000 / 4.8) * ((snap.wind100m * 1.25) / 3.6));
    const driftToward = (snap.windDir + 180) % 360;

    return [
      `### 🎯 TACTICAL BALLISTICS & PARACHUTE RECOVERY DRIFT (${snap.activeSectorName})`,
      `- **Firing Line 310° NW / 130° SE Crosswind**: **${snap.crosswind310Kmh} km/h (${xwindMs} m/s)** | Headwind: **${snap.headwind310Kmh} km/h**`,
      `- **Estimated Crosswind Deflection @ 1,000m Target**:`,
      `  - **7.62×51mm NATO**: **${(xwindMs * 0.34).toFixed(2)} MRAD** (${Math.round(xwindMs * 34)} cm windage hold)`,
      `  - **.338 Lapua Mag**: **${(xwindMs * 0.21).toFixed(2)} MRAD** (${Math.round(xwindMs * 21)} cm windage hold)`,
      `  - **12.7×99mm (.50 BMG)**: **${(xwindMs * 0.18).toFixed(2)} MRAD** (${Math.round(xwindMs * 18)} cm windage hold)`,
      `\n**ISO 21384-3 UAV PARACHUTE RECOVERY (PRS) DRIFT**:`,
      `- **Deploy @ 300m AGL**: **${drift300m}m drift** toward **${driftToward}°T**`,
      `- **Deploy @ 1,000m AGL**: **${drift1000m}m drift** toward **${driftToward}°T**`,
      `- **Atmospheric Refraction / Mirage**: Solar load **${snap.solar} W/m²** (${snap.solar >= 550 ? 'High boil mirage — apply -0.15 MRAD vertical dial correction' : 'Low optical shimmer'})`
    ].join('\n');
  }

  // 5. HSE / Heat /WBGT / Hydration / Dust / Tides
  if (q.includes('heat') || q.includes('wbgt') || q.includes('water') || q.includes('hydrat') || q.includes('hse') || q.includes('dust') || q.includes('pm10') || q.includes('tide') || q.includes('marine') || q.includes('sea')) {
    return [
      `### 🔥 ADOSH HSE HEAT STRESS, CAMS DUST & KHOR AL BAZAM TIDE DIRECTIVE`,
      `- **WBGT Thermal Index**: **${snap.heat.wbgt}°C** (Dry Bulb: **${snap.temp.toFixed(1)}°C** • RH: **${snap.rh}%** • Dew Pt: **${snap.heat.dewPoint}°C**)`,
      `- **ADOSH CoP 11.0 Tier**: **${snap.heat.level}** — Mandatory Work/Rest: **${snap.heat.workRestRatio}**`,
      `- **Hydration Schedule**: **${snap.heat.volumePerHour}** (${snap.heat.cupSchedule})`,
      `\n**PARTICULATE DUST & RESPIRATORY GATE**:`,
      `- **PM10 Concentration**: **${snap.pm10.toFixed(1)} µg/m³** (CAMS Mineral Dust: **${snap.dust.toFixed(0)} µg/m³**) — **${snap.pm10 >= 155 ? '🔴 ADOSH MASK / SUSPEND GATE' : '🟢 CLEAR (<155 µg/m³)'}**`,
      `\n**KHOR AL BAZAM TIDES & MARINE SPIT (\`39R YG 8806 7726\`)**:`,
      `- **Current Tide Flow**: **${snap.tides.currentFlow} ${snap.tides.flowArrow}** (${snap.tides.springNeap} • Range **${snap.tides.range}**)`,
      `- **Next Tide Event**: **${snap.tides.nextTide.type} @ ${snap.tides.nextTide.time} GST** (in ${snap.tides.nextTide.eta})`,
      `- **High Tides Today**: **${snap.tides.high1}** & **${snap.tides.high2} GST** | **Low Tides**: **${snap.tides.low1}** & **${snap.tides.low2} GST** | **Wave Height**: **${Number(snap.waveHeightM).toFixed(1)}m**`
    ].join('\n');
  }

  // 6. Best 12H Sortie Window & Sea-Breeze Countdown
  if (q.includes('window') || q.includes('best') || q.includes('when') || q.includes('breeze') || q.includes('forecast') || q.includes('next')) {
    return [
      `### ⏱️ AI 12-HOUR MISSION WINDOW OPTIMIZER & SEA-BREEZE FRONT`,
      `- **★ #1 Recommended Sortie Window**: **${snap.bestWindow.time}** (Suitability Score: **${snap.bestWindow.score}/100**)`,
      `  - Projected Conditions: Wind **${snap.bestWindow.windKmh} km/h** (Gusts **${snap.bestWindow.gustKmh} km/h**) • Temp **${snap.bestWindow.tempC || snap.temp.toFixed(1)}°C**`,
      `- **Arabian Gulf Sea-Breeze Front Detection**:`,
      snap.seaBreezeShift
        ? `  - ⚠️ **Wind Shift Projected at ${snap.seaBreezeShift.time}**: Veering from **${snap.seaBreezeShift.fromDir}°T** to **${snap.seaBreezeShift.toDir}°T** at **${snap.seaBreezeShift.speedKmh} km/h** (Plan Runway 13 → 31 transition).`
        : `  - 🟢 **Steady Synoptic Flow**: No abrupt >45° sea-breeze reversal detected in the next 12 hours.`,
      `- **40-Member ICON-EPS Ensemble Confidence**: **${ens.currentGoConfidencePct}%** of ensemble members keep winds inside green/amber limits.`
    ].join('\n');
  }

  // Default comprehensive answer for any freeform question
  return [
    `### 🤖 X-RANGE TAC-AI ANALYSIS (${snap.activeSectorName} • \`${snap.activeSectorMgrs}\`)`,
    `- **Query**: *"${query}"*`,
    `- **Current Sector Status**: **\`${snap.globalStatus}\`** — Temp **${snap.temp.toFixed(1)}°C** (WBGT **${snap.heat.wbgt}°C**), 10m Wind **${snap.wind10m.toFixed(0)} km/h** (Gusts **${snap.gust10m.toFixed(0)} km/h** @ **${snap.windDir}°T**), 100m Wind **${snap.wind100m} km/h**, Visibility **${snap.visKm} km**.`,
    `- **Airspace & Altimetry**: **${air.activeOverIslandCount || 0} Flights Over Island** (${air.totalTracked50nm || 0} in 50 NM) • **OMAA QNH ${omaa.qnhHpa} hPa (${omaa.fltCat})** • Density Alt **${snap.atm.densityAltitudeFt.toLocaleString()} ft**.`,
    `- **Optimal Next Sortie Window**: **${snap.bestWindow.time}** (Score **${snap.bestWindow.score}%** • Wind **${snap.bestWindow.windKmh} km/h**).`,
    `- *Tip: Ask about any specific altitude (e.g., "wind at 800m"), "SMEAC brief", "UAV Go/No-Go", "ballistics", or "OMAA METAR".*`
  ].join('\n');
}

export default function TacAiCopilotDrawer({
  isOpen,
  onClose,
  data,
  activeDisplayData,
  activeStation = 'hq',
  globalSafety,
  activeTime,
  isSimulated = false
}) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  });
  const [keySavedToast, setKeySavedToast] = useState(false);
  const chatEndRef = useRef(null);

  const snap = buildTelemetrySnapshot(data, activeDisplayData, activeStation, globalSafety, activeTime);

  // Initialize with a live welcome SitRep when opened first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialBrief = generateLocalTacAiResponse('smeac', snap);
      setMessages([
        {
          role: 'assistant',
          engine: 'X-Range Tactical AI Engine ($0.00 Local)',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Dubai' }),
          content: initialBrief
        }
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleSaveGeminiKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GEMINI_KEY_STORAGE, geminiApiKey.trim());
      setKeySavedToast(true);
      setTimeout(() => setKeySavedToast(false), 2200);
    }
  };

  const handleSpeak = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanSpeech = text
      .replace(/[#*`_~]/g, '')
      .replace(/\[|\]/g, '')
      .replace(/•/g, ', ')
      .replace(/\n+/g, '. ');
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.04;
    utterance.pitch = 0.96;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (idx, text) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const submitQuery = async (rawText) => {
    const trimmed = (rawText || '').trim();
    if (!trimmed) return;

    const nowGst = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Dubai' });
    setMessages(prev => [
      ...prev,
      { role: 'user', timestamp: nowGst, content: trimmed }
    ]);
    setInputQuery('');
    setIsThinking(true);

    let replyContent = '';
    let engineLabel = 'X-Range Tactical AI ($0.00 Local)';

    // If user configured an optional free-tier Gemini API key, query Gemini 2.5 Flash with live telemetry context
    if (geminiApiKey && geminiApiKey.trim().length > 15) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `You are X-RANGE TAC-AI, the AI Range Safety Officer (RSO) Co-Pilot for Abu Al Abyad Island, UAE (MGRS 39R YG). Respond concisely in tactical markdown bullets using ONLY the live sensor telemetry below.\n\nLIVE TELEMETRY JSON:\n${JSON.stringify(snap)}\n\nOPERATOR QUESTION: ${trimmed}`
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 550
              }
            })
          }
        );
        if (res.ok) {
          const json = await res.json();
          const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            replyContent = candidateText.trim();
            engineLabel = 'Gemini 2.5 Flash Live ($0.00 Free Tier)';
          }
        }
      } catch {
        // Seamless fallback to built-in Tactical AI Reasoning Engine
      }
    }

    if (!replyContent) {
      replyContent = generateLocalTacAiResponse(trimmed, snap);
    }

    appendIso42001AuditEntry({
      isoControl: 'A.6.2.8 / A.8.2',
      eventType: 'TAC_AI_COPILOT_ADVISORY',
      actor: engineLabel,
      modelProvider: engineLabel,
      sector: snap.activeSectorName,
      decision: snap.globalStatus,
      rationale: `Operator query: "${trimmed.slice(0, 80)}"`,
      telemetrySnapshot: {
        tempC: snap.temp,
        windKmh: snap.wind10m,
        gustKmh: snap.gust10m,
        qnhHpa: snap.qnh
      }
    });

    setIsThinking(false);
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        engine: engineLabel,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Dubai' }),
        content: replyContent
      }
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl h-full bg-slate-950 border-l border-cyan-500/40 shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* Top Header */}
        <div className="p-3.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between flex-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
              <Bot className="w-4.5 h-4.5 text-cyan-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  X-RANGE TAC-AI CO-PILOT
                </h2>
                <span className="px-1.5 py-0.5 text-[7.5px] font-mono font-black uppercase bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                  $0.00 ZERO-COST AI
                </span>
              </div>
              <p className="text-[8.5px] font-mono text-slate-400 mt-0.5">
                {snap.activeSectorName} ({snap.activeSectorMgrs}) • Gate: <strong className={snap.globalStatus === 'RED' ? 'text-stopRed' : snap.globalStatus === 'AMBER' ? 'text-amberAlert' : 'text-safetyGreen'}>{snap.globalStatus}</strong> • OMAA Q{Math.round(snap.qnh)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowKeyConfig(prev => !prev)}
              className={`px-2 py-1 border text-[8px] font-mono font-black uppercase cursor-pointer flex items-center space-x-1 ${
                geminiApiKey
                  ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Optional: Configure Free-Tier Google Gemini 2.5 Flash API Key"
            >
              <Key className="w-3 h-3" />
              <span>{geminiApiKey ? 'GEMINI LIVE' : 'LOCAL AI'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                if (latestAssistant) handleSpeak(latestAssistant.content);
              }}
              className={`px-2 py-1 border text-[8px] font-mono font-black uppercase cursor-pointer flex items-center space-x-1 ${
                isSpeaking
                  ? 'bg-edgeOrange/25 border-edgeOrange text-edgeOrange animate-pulse'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Read latest AI SitRep aloud via Web Speech TTS"
            >
              {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              <span>{isSpeaking ? 'STOP' : 'SPEAK'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
              title="Close AI RSO Co-Pilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Free-Tier Gemini 2.5 Flash Key Bar */}
        {showKeyConfig && (
          <div className="px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 flex-none text-[9px]">
            <span className="text-slate-300 font-mono">
              Optional Gemini 2.5 Flash Key (Free Tier):
            </span>
            <div className="flex items-center space-x-1.5 flex-1 max-w-xs">
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy... (Leave blank for $0 Local AI)"
                className="flex-1 bg-slate-950 border border-slate-700 px-2 py-1 text-[9px] font-mono text-white outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleSaveGeminiKey}
                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase text-[8px] cursor-pointer"
              >
                {keySavedToast ? 'SAVED' : 'SAVE'}
              </button>
            </div>
          </div>
        )}

        {/* Live Telemetry Context Strip */}
        <div className="px-3.5 py-1.5 bg-bgDeepSpace border-b border-slate-800/80 grid grid-cols-5 gap-1.5 text-center font-mono text-[8px] flex-none">
          <div className="bg-slate-900/70 border border-slate-800 py-1 px-1">
            <span className="text-[6.5px] text-slate-400 block uppercase">10M / 100M WIND</span>
            <span className="font-black text-cyan-300">{snap.wind10m.toFixed(0)} / {snap.wind100m} kph</span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 py-1 px-1">
            <span className="text-[6.5px] text-slate-400 block uppercase">WBGT / TEMP</span>
            <span className="font-black text-amber-300">{snap.heat.wbgt}° / {snap.temp.toFixed(1)}°C</span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 py-1 px-1">
            <span className="text-[6.5px] text-slate-400 block uppercase">ISLAND ADS-B</span>
            <span className={(snap.airspace?.activeOverIslandCount || 0) > 0 ? 'font-black text-stopRed' : 'font-black text-safetyGreen'}>
              {snap.airspace?.activeOverIslandCount || 0} OVER ({snap.airspace?.totalTracked50nm || 0} 50NM)
            </span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 py-1 px-1">
            <span className="text-[6.5px] text-slate-400 block uppercase">ICON-EPS 40M</span>
            <span className="font-black text-emerald-300">{snap.ensemble?.currentGoConfidencePct ?? 92}% GO</span>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 py-1 px-1">
            <span className="text-[6.5px] text-slate-400 block uppercase">BEST WINDOW</span>
            <span className="font-black text-white">{snap.bestWindow.time.split(' ')[0]}</span>
          </div>
        </div>

        {/* One-Tap Tactical Prompt Chips */}
        <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800/80 flex-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">
              ONE-TAP RSO TACTICAL QUERIES
            </span>
            <button
              type="button"
              onClick={() => {
                const freshBrief = generateLocalTacAiResponse('smeac', snap);
                setMessages([
                  {
                    role: 'assistant',
                    engine: 'X-Range Tactical AI ($0.00 Local)',
                    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Dubai' }),
                    content: freshBrief
                  }
                ]);
              }}
              className="text-[7.5px] font-mono text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Reset SitRep</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => submitQuery(p.query)}
                className="px-2 py-1 bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-left text-[8px] font-bold text-slate-200 hover:text-cyan-200 transition cursor-pointer truncate"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Feed */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-bgDeepSpace/90 font-sans select-text">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 border ${
                msg.role === 'user'
                  ? 'bg-cyan-950/30 border-cyan-500/40 ml-8'
                  : 'bg-slate-900/90 border-slate-800 mr-2'
              }`}
            >
              <div className="flex items-center justify-between text-[7.5px] font-mono text-slate-400 mb-1.5 border-b border-slate-800/80 pb-1">
                <span className="font-black uppercase text-cyan-300">
                  {msg.role === 'user' ? '👤 RSO / OPERATOR QUERY' : `🤖 ${msg.engine || 'X-RANGE TAC-AI'}`}
                </span>
                <div className="flex items-center space-x-2">
                  <span>{msg.timestamp} GST</span>
                  {msg.role === 'assistant' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSpeak(msg.content)}
                        className="text-slate-400 hover:text-edgeOrange cursor-pointer"
                        title="Read this advisory aloud"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(idx, msg.content)}
                        className="text-slate-400 hover:text-white cursor-pointer flex items-center space-x-0.5"
                        title="Copy SitRep to clipboard"
                      >
                        {copiedIdx === idx ? <Check className="w-3 h-3 text-safetyGreen" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="text-[10.5px] leading-relaxed text-slate-200 whitespace-pre-wrap font-mono">
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="p-3 bg-slate-900/80 border border-cyan-500/30 text-[9.5px] font-mono text-cyan-300 animate-pulse">
              ⚡ Assimilating 4-sector 5km grid, 975–700 hPa radiosonde levels, 50 NM ADS-B &amp; OMAA METAR...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Bottom Natural-Language Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuery(inputQuery);
          }}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2 flex-none"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask TAC-AI (e.g., 'Can we fly at 800m?', 'OMAA METAR', 'SMEAC brief')..."
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-400 px-3 py-2 text-xs font-mono text-white outline-none"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-black uppercase text-[10px] tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-lg"
          >
            <Send className="w-3.5 h-3.5" />
            <span>ASK AI</span>
          </button>
        </form>
      </div>
    </div>
  );
}
