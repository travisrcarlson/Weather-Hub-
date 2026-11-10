/**
 * Unified 5km Range Sector Definitions, Simulation Profiles & Active Alert Compiler
 * Single source of truth across App, XRangeMap, PilotConsole, and AlertCenter.
 */
import { evaluateHeatStress } from './safetyEngine';

export const SIMULATED_SECTOR_PROFILES = {
  hq: {
    id: 'hq',
    short: 'HQ',
    name: 'X-Range HQ',
    sectorTitle: 'X-Range HQ',
    mgrs: '39R YG 9058 7842',
    x: 310,
    y: 170,
    description: 'Administrative & Firing HQ',
    temperature_2m: 41.3,
    apparent_temperature: 43.1,
    relative_humidity_2m: 20,
    wind_speed_10m: 25,
    wind_gusts_10m: 35,
    wind_direction_10m: 290,
    wind_speed_100m: 33.2,
    wind_gusts_100m: 44.0,
    visibility: 10000,
    uv_index: 9.0,
    solar_radiation: 890,
    pm10: 45,
    weathercode: 3
  },
  north: {
    id: 'north',
    short: 'NORTH',
    name: 'Range North',
    sectorTitle: 'Range North',
    mgrs: '39R YG 9508 8183',
    x: 365,
    y: 100,
    description: 'Heavy Ballistics & Drone Range',
    temperature_2m: 39.5,
    apparent_temperature: 42.0,
    relative_humidity_2m: 25,
    wind_speed_10m: 42,
    wind_gusts_10m: 53,
    wind_direction_10m: 320,
    wind_speed_100m: 54.8,
    wind_gusts_100m: 69.5,
    visibility: 4000,
    uv_index: 9.0,
    solar_radiation: 840,
    pm10: 95,
    weathercode: 45
  },
  south: {
    id: 'south',
    short: 'SOUTH',
    name: 'Range South',
    sectorTitle: 'Range South',
    mgrs: '39R YG 8201 7438',
    x: 135,
    y: 180,
    description: 'Desert Durability Sector',
    temperature_2m: 44.5,
    apparent_temperature: 49.2,
    relative_humidity_2m: 15,
    wind_speed_10m: 12,
    wind_gusts_10m: 18,
    wind_direction_10m: 130,
    wind_speed_100m: 16.5,
    wind_gusts_100m: 24.0,
    visibility: 12000,
    uv_index: 9.8,
    solar_radiation: 985,
    pm10: 50,
    weathercode: 0
  },
  sea: {
    id: 'sea',
    short: 'SEA',
    name: 'Sea Boundary',
    sectorTitle: 'Sea Boundary',
    mgrs: '39R YG 8806 7726',
    x: 240,
    y: 205,
    description: 'Marine Spit & Port Security',
    temperature_2m: 34.0,
    apparent_temperature: 48.0,
    relative_humidity_2m: 89,
    wind_speed_10m: 28,
    wind_gusts_10m: 42,
    wind_direction_10m: 210,
    wind_speed_100m: 37.0,
    wind_gusts_100m: 53.5,
    visibility: 2000,
    uv_index: 8.6,
    solar_radiation: 820,
    pm10: 55,
    weathercode: 3
  }
};

export function getSimulatedStationReadings(stationId, baseCurrent = {}, simulatedLightning = false) {
  const profile = SIMULATED_SECTOR_PROFILES[stationId] || SIMULATED_SECTOR_PROFILES.hq;
  return {
    ...(baseCurrent || {}),
    temperature_2m: profile.temperature_2m,
    apparent_temperature: profile.apparent_temperature,
    relative_humidity_2m: profile.relative_humidity_2m,
    wind_speed_10m: profile.wind_speed_10m,
    wind_gusts_10m: profile.wind_gusts_10m,
    wind_direction_10m: profile.wind_direction_10m,
    wind_speed_100m: profile.wind_speed_100m,
    wind_gusts_100m: profile.wind_gusts_100m,
    visibility: profile.visibility,
    uv_index: profile.uv_index,
    solar_radiation: profile.solar_radiation,
    pm10: profile.pm10,
    weathercode: simulatedLightning ? 95 : profile.weathercode,
    name: profile.name,
    sectorTitle: profile.sectorTitle
  };
}

export function getStationCurrentReadings(apiData, stationId = 'hq', isSimulated = false, simulatedLightning = false) {
  if (!apiData) return null;
  if (isSimulated) {
    return getSimulatedStationReadings(
      stationId,
      apiData?.stations?.[stationId]?.current || apiData?.current,
      simulatedLightning
    );
  }
  const liveStation = apiData?.stations?.[stationId];
  if (liveStation?.current) {
    return {
      ...liveStation.current,
      name: liveStation.name,
      sectorTitle: liveStation.name
    };
  }
  return apiData?.current || null;
}

export const stationsList = Object.values(SIMULATED_SECTOR_PROFILES).map((p) => ({
  id: p.id,
  short: p.short,
  name: p.name,
  mgrs: p.mgrs,
  x: p.x,
  y: p.y,
  description: p.description,
  getReadings: (globalData, simulatedLightning = false) =>
    getSimulatedStationReadings(p.id, globalData, simulatedLightning)
}));

/**
 * Single source of truth for compiling active alerts across all 4 Abu Al Abyad stations.
 * Used identically by Header notification badge count (App.jsx) and AlertCenter.jsx drawer.
 */
export function compileActiveStationAlerts({ apiData, isSimulated = false, simulatedLightning = false }) {
  if (!apiData) return [];

  const alerts = [];
  const nowIso = new Date().toISOString();

  // 1. Global convective lightning check
  const hasLightning =
    simulatedLightning ||
    (Array.isArray(apiData.ncmWarnings) && apiData.ncmWarnings.some((w) => w.category === 'LIGHTNING'));

  if (hasLightning) {
    alerts.push({
      id: 'global-lightning',
      station: 'GLOBAL SENSORS',
      type: 'RED',
      category: 'LIGHTNING',
      title: '⚡ LIGHTNING STRIKE EMERGENCY',
      message: 'Active lightning strikes detected over the island. Evacuate training ranges immediately.',
      timestamp: nowIso
    });
  }

  // 2. Per-sector ADOSH v4.0 meteorological threshold checks
  stationsList.forEach((s) => {
    const readings = getStationCurrentReadings(apiData, s.id, isSimulated, simulatedLightning);
    if (!readings) return;

    const temp = readings.temperature_2m ?? 0;
    const rh = readings.relative_humidity_2m ?? 50;
    const wind = readings.wind_speed_10m ?? 0;
    const gusts = readings.wind_gusts_10m ?? wind * 1.3;
    const uv = readings.uv_index ?? 0;
    const pm10 = readings.pm10 ?? 40;
    const visibility = readings.visibility ?? 10000;

    // A. Unified Heat Stress & Hydration (Dry Bulb + WBGT + Apparent Temp)
    const heatStress = evaluateHeatStress(
      temp,
      rh,
      wind,
      uv,
      readings.solar_radiation ?? null,
      readings.apparent_temperature ?? null
    );

    if (temp >= 46 || heatStress.wbgt >= 34.5) {
      alerts.push({
        id: `${s.id}-temp-red`,
        station: s.name,
        type: 'RED',
        category: 'HEAT',
        title: '🔥 CRITICAL EXTREME HEAT HALT',
        message: `Shade ${temp.toFixed(1)}°C / WBGT ${heatStress.wbgt.toFixed(1)}°C. Suspend open-range duties; mandatory ${heatStress.volumePerHour} (${heatStress.cupSchedule}).`,
        timestamp: nowIso
      });
    } else if (heatStress.tier === 'SEVERE' || heatStress.tier === 'HIGH' || temp >= 38) {
      alerts.push({
        id: `${s.id}-heat-amber`,
        station: s.name,
        type: 'AMBER',
        category: 'HEAT',
        title: '☀️ HEAT STRESS & HYDRATION CAUTION',
        message: `Shade ${temp.toFixed(1)}°C / WBGT ${heatStress.wbgt.toFixed(1)}°C (${heatStress.flagLabel}). Enforce ${heatStress.workRestRatio} split & ${heatStress.volumePerHour} (${heatStress.cupSchedule}).`,
        timestamp: nowIso
      });
    }

    // B. Wind & Gust thresholds (RED >= 45 kph or Gusts >= 60 kph; AMBER >= 25 kph or Gusts >= 35 kph)
    if (gusts >= 60 || wind >= 45) {
      alerts.push({
        id: `${s.id}-wind-red`,
        station: s.name,
        type: 'RED',
        category: 'WIND',
        title: '💨 CRITICAL GALE WIND HALT',
        message: `Wind speed is ${wind.toFixed(0)} km/h with gusts to ${gusts.toFixed(0)} km/h. Live fire & UAV flights suspended.`,
        timestamp: nowIso
      });
    } else if (wind >= 25 || gusts >= 35) {
      alerts.push({
        id: `${s.id}-wind-amber`,
        station: s.name,
        type: 'AMBER',
        category: 'WIND',
        title: '💨 HIGH WIND DRIFT CAUTION',
        message: `Wind ${wind.toFixed(0)} km/h (gusts ${gusts.toFixed(0)} km/h). Apply ballistic crosswind compensation & monitor UAV drift.`,
        timestamp: nowIso
      });
    }

    // C. Visibility thresholds (RED < 800m; AMBER <= 4000m)
    if (visibility < 800) {
      alerts.push({
        id: `${s.id}-vis-red`,
        station: s.name,
        type: 'RED',
        category: 'VISIBILITY',
        title: '🌫️ CRITICAL VISIBILITY HALT',
        message: `Range visibility drops below 0.8 km (${(visibility / 1000).toFixed(1)} km). Cease all live fire training.`,
        timestamp: nowIso
      });
    } else if (visibility <= 4000) {
      alerts.push({
        id: `${s.id}-vis-amber`,
        station: s.name,
        type: 'AMBER',
        category: 'VISIBILITY',
        title: '🌫️ HAZE / DUST CAUTION',
        message: `Range visibility reduced to ${(visibility / 1000).toFixed(1)} km. Monitor long-range target lines.`,
        timestamp: nowIso
      });
    }

    // D. PM10 Dust thresholds (RED >= 250; AMBER >= 120)
    if (pm10 >= 250) {
      alerts.push({
        id: `${s.id}-pm10-red`,
        station: s.name,
        type: 'RED',
        category: 'AQI',
        title: '😷 CRITICAL DUST STORM HALT',
        message: `PM10 particulates are ${pm10.toFixed(0)} µg/m³. Suspend outdoor range duties, use respiratory protection.`,
        timestamp: nowIso
      });
    } else if (pm10 >= 120) {
      alerts.push({
        id: `${s.id}-pm10-amber`,
        station: s.name,
        type: 'AMBER',
        category: 'AQI',
        title: '😷 ELEVATED DUST CAUTION',
        message: `PM10 particulates are ${pm10.toFixed(0)} µg/m³. Limit prolonged dust exposure; N95 masks advised.`,
        timestamp: nowIso
      });
    }
  });

  return alerts;
}
