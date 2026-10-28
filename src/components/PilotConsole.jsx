import React, { useState, useMemo } from 'react';
import {
  Plane, Wind, Compass, Gauge, BatteryCharging, Thermometer,
  Eye, ShieldAlert, ShieldCheck, AlertTriangle, Download,
  Copy, Check, Navigation, Layers, Zap, Sun, Activity, Sliders, Radio, FileText
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  calculate100mWindShear,
  calculateAtmosphericDensity
} from '../utils/tacticalBallisticsEngine';
import { calculateDewPoint } from '../utils/safetyEngine';
import { stationsList } from './XRangeMap';

// Standard UAV Airframe & Fixed-Wing Profiles operated at X-Range (with V_min Stall & V_max Dash Speeds)
const UAV_AIRFRAMES = [
  {
    id: 'CLASS_1',
    name: 'Class I: Tactical Multirotor',
    models: 'DJI Matrice 350 RTK / Skydio X2D / Mavic 3T',
    type: 'ROTORCRAFT',
    maxSustainedWindKmh: 30,
    maxGustKmh: 42,
    maxCrosswindKmh: 25,
    maxTempC: 45,
    nominalEnduranceMin: 42,
    ceilingM: 500,
    minAirspeedKmh: 0,
    cruiseSpeedKmh: 54,
    maxAirspeedKmh: 76,
    emptyWeightKg: 6.5,
    maxPayloadKg: 2.7,
    defaultPayloadKg: 0.9
  },
  {
    id: 'CLASS_2',
    name: 'Class II: Heavy-Lift / Hybrid VTOL',
    models: 'Heavy Payload Octocopter / Quantum Trinity VTOL',
    type: 'HEAVY_ROTOR',
    maxSustainedWindKmh: 38,
    maxGustKmh: 50,
    maxCrosswindKmh: 32,
    maxTempC: 48,
    nominalEnduranceMin: 55,
    ceilingM: 1200,
    minAirspeedKmh: 0,
    cruiseSpeedKmh: 65,
    maxAirspeedKmh: 95,
    emptyWeightKg: 18.0,
    maxPayloadKg: 12.0,
    defaultPayloadKg: 4.5
  },
  {
    id: 'FW_LIGHT',
    name: 'Fixed-Wing I: Light Electric ISR',
    models: 'AeroVironment Puma 3 AE / Raven / Skylark',
    type: 'FIXED_WING',
    maxSustainedWindKmh: 38,
    maxGustKmh: 48,
    maxCrosswindKmh: 24,
    maxTempC: 48,
    nominalEnduranceMin: 150,
    ceilingM: 1000,
    minAirspeedKmh: 38,
    cruiseSpeedKmh: 62,
    maxAirspeedKmh: 85,
    emptyWeightKg: 6.8,
    maxPayloadKg: 2.5,
    defaultPayloadKg: 0.8
  },
  {
    id: 'FW_MED',
    name: 'Fixed-Wing II: Medium Endurance ISR',
    models: 'Boeing Insitu ScanEagle / Integrator',
    type: 'FIXED_WING',
    maxSustainedWindKmh: 46,
    maxGustKmh: 60,
    maxCrosswindKmh: 30,
    maxTempC: 50,
    nominalEnduranceMin: 360,
    ceilingM: 2500,
    minAirspeedKmh: 55,
    cruiseSpeedKmh: 95,
    maxAirspeedKmh: 148,
    emptyWeightKg: 18.0,
    maxPayloadKg: 6.5,
    defaultPayloadKg: 3.2
  },
  {
    id: 'FW_MALE',
    name: 'Fixed-Wing III: Tactical MALE / S-100',
    models: 'Schiebel Camcopter S-100 / Tactical MALE ISR',
    type: 'FIXED_WING',
    maxSustainedWindKmh: 50,
    maxGustKmh: 65,
    maxCrosswindKmh: 34,
    maxTempC: 50,
    nominalEnduranceMin: 300,
    ceilingM: 2500,
    minAirspeedKmh: 45,
    cruiseSpeedKmh: 130,
    maxAirspeedKmh: 220,
    emptyWeightKg: 110.0,
    maxPayloadKg: 50.0,
    defaultPayloadKg: 25.0
  },
  {
    id: 'FW_JET',
    name: 'Fixed-Wing IV: High-Speed Target Jet',
    models: 'QinetiQ Banshee Jet 80+ / Mirach 40 Target',
    type: 'FIXED_WING',
    maxSustainedWindKmh: 56,
    maxGustKmh: 72,
    maxCrosswindKmh: 36,
    maxTempC: 52,
    nominalEnduranceMin: 90,
    ceilingM: 3000,
    minAirspeedKmh: 130,
    cruiseSpeedKmh: 280,
    maxAirspeedKmh: 650,
    emptyWeightKg: 95.0,
    maxPayloadKg: 40.0,
    defaultPayloadKg: 15.0
  },
  {
    id: 'CUSTOM',
    name: 'Custom UAV Flight Envelope',
    models: 'R&D Experimental Prototype / Custom Airframe',
    type: 'CUSTOM',
    maxSustainedWindKmh: 34,
    maxGustKmh: 45,
    maxCrosswindKmh: 26,
    maxTempC: 46,
    nominalEnduranceMin: 60,
    ceilingM: 2500,
    minAirspeedKmh: 45,
    cruiseSpeedKmh: 90,
    maxAirspeedKmh: 160,
    emptyWeightKg: 12.0,
    maxPayloadKg: 10.0,
    defaultPayloadKg: 2.5
  }
];

// Standard X-Range 3 Runways on Abu Al Abyad Island (All aligned on the 31/13 magnetic axis: 310° NW / 130° SE)
const XRANGE_RUNWAYS = [
  { id: 'RWY_1', short: 'RWY 1 (MAIN)', label: 'RWY 1 • Main Strip (31/13)', rwy31Heading: 310, rwy13Heading: 130 },
  { id: 'RWY_2', short: 'RWY 2 (NORTH)', label: 'RWY 2 • North Strip (31/13)', rwy31Heading: 310, rwy13Heading: 130 },
  { id: 'RWY_3', short: 'RWY 3 (SOUTH)', label: 'RWY 3 • South Strip (31/13)', rwy31Heading: 310, rwy13Heading: 130 }
];

const RUNWAY_PRESETS = [
  { id: 'RWY_1_31', stripId: 'RWY_1', end: '31', label: 'RWY 1 • 31 (310° NW Main)', heading: 310 },
  { id: 'RWY_1_13', stripId: 'RWY_1', end: '13', label: 'RWY 1 • 13 (130° SE Main)', heading: 130 },
  { id: 'RWY_2_31', stripId: 'RWY_2', end: '31', label: 'RWY 2 • 31 (310° NW North)', heading: 310 },
  { id: 'RWY_2_13', stripId: 'RWY_2', end: '13', label: 'RWY 2 • 13 (130° SE North)', heading: 130 },
  { id: 'RWY_3_31', stripId: 'RWY_3', end: '31', label: 'RWY 3 • 31 (310° NW South)', heading: 310 },
  { id: 'RWY_3_13', stripId: 'RWY_3', end: '13', label: 'RWY 3 • 13 (130° SE South)', heading: 130 }
];

// 5-Point RPIC Pre-Flight Checklist Items
const RPIC_CHECKLIST_ITEMS = [
  { id: 'bat', label: 'LiPo Core < 40°C' },
  { id: 'rth', label: 'RTH Bingo Set' },
  { id: 'rtk', label: 'RTK Base Fixed' },
  { id: 'xwind', label: 'Rail X-Wind OK' },
  { id: 'notam', label: 'OMAB Airspace Clear' }
];

export default function PilotConsole({
  data,
  activeDisplayData,
  activeStation = 'hq',
  setActiveStation,
  isSimulated = false,
  ncmWarnings = [],
  currentTime
}) {
  // Airframe & Custom limits state
  const [selectedAirframeId, setSelectedAirframeId] = useState('CLASS_1');
  const [customMaxWind, setCustomMaxWind] = useState(34);
  const [customMaxGust, setCustomMaxGust] = useState(45);
  const [customMaxCrosswind, setCustomMaxCrosswind] = useState(26);
  const [payloadKg, setPayloadKg] = useState(0.9);

  // Runway / Launch Rail heading state (3 X-Range Runways on 31/13: 310° NW / 130° SE)
  const [runwayHeading, setRunwayHeading] = useState(310);
  const [selectedRunwayStrip, setSelectedRunwayStrip] = useState('RWY_1');
  const [selectedRunwayId, setSelectedRunwayId] = useState('RWY_1_31');

  // Goal Ground Speed Calculator, Platform V_min / V_max & Altitude Band state
  const [goalGroundSpeedKmh, setGoalGroundSpeedKmh] = useState(45);
  const [platformMinSpeedKmh, setPlatformMinSpeedKmh] = useState(0);
  const [platformMaxSpeedKmh, setPlatformMaxSpeedKmh] = useState(76);
  const [calcAltitudeM, setCalcAltitudeM] = useState(300);
  const [altitudeBand, setAltitudeBand] = useState('LOW'); // 'LOW' (10m-300m) or 'HIGH' (300m-2500m)

  // RPIC Pre-Flight Safety Gate Checklist state
  const [checkedItems, setCheckedItems] = useState({
    bat: true,
    rth: true,
    rtk: true,
    xwind: true,
    notam: true
  });

  // Copy METAR state
  const [copiedMetar, setCopiedMetar] = useState(false);

  const toggleChecklist = (id) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Resolve current station info and telemetry
  const stationObj = stationsList.find(s => s.id === activeStation) || stationsList[0];
  const stationReadings = useMemo(() => {
    if (!data || !data.current) return activeDisplayData || {};
    if (isSimulated && stationObj && stationObj.getReadings) {
      return stationObj.getReadings(data.current);
    }
    return activeDisplayData || data.current;
  }, [data, activeDisplayData, isSimulated, stationObj]);

  // Active airframe profile
  const baseAirframe = UAV_AIRFRAMES.find(a => a.id === selectedAirframeId) || UAV_AIRFRAMES[0];
  const airframe = selectedAirframeId === 'CUSTOM'
    ? {
        ...baseAirframe,
        maxSustainedWindKmh: customMaxWind,
        maxGustKmh: customMaxGust,
        maxCrosswindKmh: customMaxCrosswind,
        minAirspeedKmh: platformMinSpeedKmh,
        maxAirspeedKmh: platformMaxSpeedKmh
      }
    : {
        ...baseAirframe,
        minAirspeedKmh: platformMinSpeedKmh,
        maxAirspeedKmh: platformMaxSpeedKmh
      };

  // Extract live meteorological values with safe defaults
  const surfaceWindKmh = Number(stationReadings?.wind_speed_10m ?? 18);
  const surfaceGustKmh = Number(stationReadings?.wind_gusts_10m ?? (surfaceWindKmh * 1.35));
  const windDirDeg = Number(stationReadings?.wind_direction_10m ?? 315);
  const tempC = Number(stationReadings?.temperature_2m ?? 30.0);
  const rhPct = Number(stationReadings?.relative_humidity_2m ?? 45);
  const pressureHpa = Number(stationReadings?.pressure_msl ?? stationReadings?.surface_pressure ?? 1012.0);
  const visibilityM = Number(stationReadings?.visibility ?? 10000);
  const visibilityKm = Number((visibilityM / 1000).toFixed(1));
  const uvIndex = Number(stationReadings?.uv_index ?? 0);
  const solarWm2 = Number(stationReadings?.solar_radiation ?? (uvIndex > 0 ? uvIndex * 88 : 0));
  const pm10 = Number(stationReadings?.pm10 ?? 42);
  const soilTemp0cm = stationReadings?.soil_temperature_0cm ?? null;
  const cloudCoverPct = Number(stationReadings?.cloud_cover ?? 10);
  const dustUgm3 = Number(stationReadings?.dust ?? 25);

  // 100m Boundary layer wind & vertical shear calculation
  const rawWind100m = stationReadings?.wind_speed_100m !== undefined
    ? Number(stationReadings.wind_speed_100m)
    : Number((surfaceWindKmh * Math.pow(100 / 10, 0.24)).toFixed(1));

  const shearData = useMemo(
    () => calculate100mWindShear(surfaceWindKmh, rawWind100m),
    [surfaceWindKmh, rawWind100m]
  );

  // Atmospheric Density, Density Altitude & Rotor Lift Loss
  const atmData = useMemo(
    () => calculateAtmosphericDensity({
      temperatureC: tempC,
      relativeHumidity: rhPct,
      stationPressureHpa: pressureHpa,
      altitudeM: 5
    }),
    [tempC, rhPct, pressureHpa]
  );

  // Compute meteorological & aerodynamic profile at any altitude (10m up to 3000m AGL)
  const computeAltProfile = useMemo(() => {
    const alpha = surfaceWindKmh > 0.5
      ? Math.max(0.14, Math.min(0.36, Math.log(shearData.boundaryWind100mKmh / surfaceWindKmh) / Math.log(10)))
      : 0.22;
    const gustFactor10m = surfaceWindKmh > 0 ? (surfaceGustKmh / surfaceWindKmh) : 1.35;

    return (altM, zoneLabel = '') => {
      const z = Math.max(10, Math.min(3000, Number(altM) || 100));
      // Boundary layer (<=300m): power law; Free troposphere (>300m): logarithmic geostrophic transition
      const scale300 = Math.pow(300 / 10, alpha);
      const scale = z <= 300
        ? Math.pow(z / 10, alpha)
        : scale300 * (1 + 0.14 * Math.log(z / 300));
      const speedKmh = Number((surfaceWindKmh * scale).toFixed(1));

      // Mechanical surface turbulence dampens with height
      const altGustFactor = 1 + (gustFactor10m - 1) * Math.pow(10 / z, 0.14);
      const gustKmh = Number((speedKmh * altGustFactor).toFixed(1));
      const speedKts = Math.round(speedKmh * 0.539957);
      const gustKts = Math.round(gustKmh * 0.539957);

      // Ekman spiral: clockwise wind veering in Northern Hemisphere (up to ~30° in free atmosphere)
      const veerDeg = z <= 300
        ? ((z - 10) / 50) * 2.2
        : 12.8 + Math.min(18, Math.log(z / 300) * 8.5);
      const dirDeg = Math.round((windDirDeg + veerDeg) % 360);

      // Upper-air temperature lapse (-6.5°C per 1000m) and barometric pressure drop
      const altTempC = Number((tempC - 0.0065 * z).toFixed(1));
      const altPressureHpa = Number(
        (pressureHpa * Math.pow(1 - (0.0065 * z) / (tempC + 273.15), 5.255)).toFixed(1)
      );
      const altAtm = calculateAtmosphericDensity({
        temperatureC: altTempC,
        relativeHumidity: Math.max(15, rhPct - (z / 1000) * 8),
        stationPressureHpa: altPressureHpa,
        altitudeM: z
      });

      let status = 'GO';
      if (speedKmh >= airframe.maxSustainedWindKmh || gustKmh >= airframe.maxGustKmh) {
        status = 'NO-GO';
      } else if (
        speedKmh >= airframe.maxSustainedWindKmh * 0.82 ||
        gustKmh >= airframe.maxGustKmh * 0.82
      ) {
        status = 'CAUTION';
      }

      const altFt = Math.round(z * 3.28084);
      return {
        altM: z,
        altFt,
        label: `${z}m (${altFt.toLocaleString()} ft)`,
        zone: zoneLabel,
        speedKmh,
        gustKmh,
        speedKts,
        gustKts,
        dirDeg,
        altTempC,
        altPressureHpa,
        airDensity: altAtm.airDensity,
        airDensityRatio: altAtm.airDensityRatio,
        status
      };
    };
  }, [surfaceWindKmh, surfaceGustKmh, shearData.boundaryWind100mKmh, windDirDeg, tempC, pressureHpa, rhPct, airframe]);

  // Multi-tier Vertical Wind Ladder (Supports LOW 10m-300m and HIGH 300m-2500m bands)
  const altitudeLadder = useMemo(() => {
    const lowLevels = [
      { altM: 300, zone: 'Low ISR / Target' },
      { altM: 200, zone: 'Upper Multirotor' },
      { altM: 100, zone: 'WN3 Boundary Layer' },
      { altM: 50, zone: 'Approach & Transition' },
      { altM: 10, zone: 'Surface / Launch Pad' }
    ];
    const highLevels = [
      { altM: 2500, zone: 'Class III Ceiling (8.2k ft)' },
      { altM: 1500, zone: 'High ISR Loiter (4.9k ft)' },
      { altM: 1000, zone: 'Medium Tactical (3.3k ft)' },
      { altM: 600, zone: 'VTOL / Heavy Transit' },
      { altM: 300, zone: 'Low ISR / Target' }
    ];
    const activeSet = altitudeBand === 'HIGH' ? highLevels : lowLevels;
    return activeSet.map(l => computeAltProfile(l.altM, l.zone));
  }, [altitudeBand, computeAltProfile]);

  // Runway / Launch Rail Crosswind & Headwind Resolver
  const runwayAnalysis = useMemo(() => {
    const diffDeg = ((windDirDeg - runwayHeading) + 360) % 360;
    const diffRad = (diffDeg * Math.PI) / 180;

    // Positive = Headwind, Negative = Tailwind
    const headwindKmh = Number((surfaceWindKmh * Math.cos(diffRad)).toFixed(1));
    // Positive = Wind from Right, Negative = Wind from Left
    const crosswindSignedKmh = Number((surfaceWindKmh * Math.sin(diffRad)).toFixed(1));
    const crosswindAbsKmh = Math.abs(crosswindSignedKmh);
    const gustCrosswindKmh = Number((surfaceGustKmh * Math.abs(Math.sin(diffRad))).toFixed(1));

    const crosswindSide = crosswindAbsKmh < 0.5
      ? 'CENTERLINE'
      : crosswindSignedKmh > 0
      ? 'FROM RIGHT'
      : 'FROM LEFT';

    let crosswindStatus = 'SAFE';
    if (crosswindAbsKmh >= airframe.maxCrosswindKmh || gustCrosswindKmh >= airframe.maxCrosswindKmh * 1.25) {
      crosswindStatus = 'LIMIT EXCEEDED';
    } else if (crosswindAbsKmh >= airframe.maxCrosswindKmh * 0.78) {
      crosswindStatus = 'CAUTION';
    }

    return {
      diffDeg,
      headwindKmh,
      headwindKts: Number((headwindKmh * 0.539957).toFixed(1)),
      crosswindAbsKmh,
      crosswindKts: Number((crosswindAbsKmh * 0.539957).toFixed(1)),
      gustCrosswindKmh,
      crosswindSide,
      crosswindStatus,
      isTailwind: headwindKmh < -2.0
    };
  }, [windDirDeg, runwayHeading, surfaceWindKmh, surfaceGustKmh, airframe.maxCrosswindKmh]);

  // Rotor Lift Efficiency, Payload Hover Throttle, RTH Combat Radius & RF/EO-IR Calculations
  const aeroPerformance = useMemo(() => {
    const level100m = altitudeLadder.find(l => l.altM === 100) || altitudeLadder[2];
    const wind100mKmh = level100m?.speedKmh ?? rawWind100m;

    // 1. Rotor thrust & Density-Derated Max Payload
    const liftEfficiencyPct = Number((atmData.airDensityRatio * 100).toFixed(1));
    const thrustLossPct = Number((100 - liftEfficiencyPct).toFixed(1));
    const deratedMaxPayloadKg = Number(
      (airframe.maxPayloadKg * Math.pow(Math.max(0.75, atmData.airDensityRatio), 1.2)).toFixed(1)
    );
    const activePayloadKg = Math.min(payloadKg, airframe.maxPayloadKg);
    const totalMassRatio = (airframe.emptyWeightKg + activePayloadKg) / airframe.emptyWeightKg;

    // 2. Hover Throttle % & Motor Thermal Load
    const baseHoverThrottle = 48; // 48% hover throttle empty at ISA sea level
    const estHoverThrottlePct = Math.min(
      98,
      Math.round((baseHoverThrottle * Math.pow(totalMassRatio, 0.72)) / Math.pow(Math.max(0.75, atmData.airDensityRatio), 0.65))
    );
    const isPayloadOverweight = activePayloadKg > deratedMaxPayloadKg;

    // 3. Battery Endurance (Density + Wind Drag + Payload Mass Penalty)
    const hoverPowerPenalty = 1 / Math.pow(Math.max(0.7, atmData.airDensityRatio), 1.35);
    const windRatio = surfaceWindKmh / Math.max(20, airframe.maxSustainedWindKmh);
    const windDrainPenalty = 1 + Math.pow(windRatio, 2) * 0.25;
    const payloadDrainPenalty = Math.pow(totalMassRatio, 0.85);

    const totalDrainFactor = hoverPowerPenalty * windDrainPenalty * payloadDrainPenalty;
    const enduranceMultiplier = Number(Math.max(0.38, Math.min(1.0, 1 / totalDrainFactor)).toFixed(2));
    const effectiveEnduranceMin = Math.round(airframe.nominalEnduranceMin * enduranceMultiplier);

    // 4. RTH (Return-To-Home) & "Point of Safe Return" Combat Radius at 100m AGL
    const cruiseKmh = airframe.cruiseSpeedKmh || 54;
    const outboundGroundspeedKmh = Number((cruiseKmh + wind100mKmh).toFixed(1));
    const returnGroundspeedKmh = Number(Math.max(6, cruiseKmh - wind100mKmh).toFixed(1));
    const usableFlightHours = (effectiveEnduranceMin * 0.75) / 60; // 25% emergency reserve
    // Harmonic radius: R = T_usable * (V_out * V_back) / (V_out + V_back)
    const maxSafeRadiusKm = Number(
      Math.max(0.4, (usableFlightHours * outboundGroundspeedKmh * returnGroundspeedKmh) / (outboundGroundspeedKmh + returnGroundspeedKmh)).toFixed(1)
    );
    // Dynamic "Bingo" RTH Battery % trigger (scales up when return headwind is strong)
    const headwindReturnRatio = wind100mKmh / cruiseKmh;
    const bingoBatteryPct = Math.min(55, Math.max(25, Math.round(25 + headwindReturnRatio * 34 + thrustLossPct * 0.6)));

    // 5. Thermal Updraft & Convection Index (Desert thermals & dust devil potential)
    const thermalIndex = Number(((solarWm2 / 1000) * (tempC / 35)).toFixed(2));
    let thermalRisk = 'LOW';
    let thermalColor = 'text-safetyGreen';
    let thermalDesc = 'Stable boundary layer. Minimal vertical sink/lift on approach.';
    if (thermalIndex >= 1.15 || (tempC >= 41 && solarWm2 >= 750)) {
      thermalRisk = 'HIGH (DUST DEVIL / UPDRAFT RISK)';
      thermalColor = 'text-stopRed';
      thermalDesc = 'Strong desert convective columns (+3.5 m/s vertical gusts). Autopilot altitude hold & fixed-wing glidepaths will experience severe pitch/throttle hunting.';
    } else if (thermalIndex >= 0.75 || tempC >= 36) {
      thermalRisk = 'MODERATE CONVECTIVE TURBULENCE';
      thermalColor = 'text-amberAlert';
      thermalDesc = 'Moderate rising thermals over dark sand/asphalt sectors. Expect +/- 1.5 m/s vertical gusts below 100m AGL.';
    }

    // 6. EO/IR FLIR Thermal Crossover, LiDAR Extinction & Coastal RF Ducting
    const baseGroundC = soilTemp0cm !== null && soilTemp0cm !== undefined ? Number(soilTemp0cm) : tempC;
    const sandSurfaceTempC = Number((Math.max(baseGroundC, tempC + (solarWm2 / 1000) * 16)).toFixed(1));
    const tempContrastDelta = Math.abs(sandSurfaceTempC - 37.0); // vs 37°C human/vehicle baseline
    let flirStatus = 'OPTIMAL IR CONTRAST';
    let flirColor = 'text-safetyGreen';
    if (visibilityKm < 3.0 || pm10 >= 150) {
      flirStatus = 'DEGRADED (DUST ATTENUATION)';
      flirColor = 'text-stopRed';
    } else if (tempContrastDelta < 3.5 || sandSurfaceTempC >= 55) {
      flirStatus = 'THERMAL CROSSOVER / SATURATION';
      flirColor = 'text-amberAlert';
    }
    const recommendedFlirPolarity = solarWm2 >= 450 || sandSurfaceTempC >= 42 ? 'BLACK-HOT' : 'WHITE-HOT';

    // Laser / LiDAR (905nm/1550nm) extinction coefficient (dB/km) from Koschmieder + PM10
    const lidarExtinctionDbKm = Number(((13.0 / Math.max(0.5, visibilityKm)) + (pm10 * 0.008)).toFixed(2));

    // Arabian Gulf Coastal Evaporative RF Ducting (2.4/5.8 GHz C2 & RTK Multipath)
    const dewPointC = calculateDewPoint(tempC, rhPct);
    let rfDuctingStatus = 'NOMINAL LOS';
    let rfDuctingColor = 'text-safetyGreen';
    if (rhPct >= 72 || (dewPointC >= 24 && tempC >= 30)) {
      rfDuctingStatus = 'COASTAL DUCTING (MULTIPATH)';
      rfDuctingColor = 'text-amberAlert';
    } else if (pm10 >= 180) {
      rfDuctingStatus = 'DUST STATIC ATTENUATION';
      rfDuctingColor = 'text-amberAlert';
    }

    return {
      liftEfficiencyPct,
      thrustLossPct,
      deratedMaxPayloadKg,
      activePayloadKg,
      estHoverThrottlePct,
      isPayloadOverweight,
      enduranceMultiplier,
      effectiveEnduranceMin,
      outboundGroundspeedKmh,
      returnGroundspeedKmh,
      maxSafeRadiusKm,
      bingoBatteryPct,
      thermalIndex,
      thermalRisk,
      thermalColor,
      thermalDesc,
      sandSurfaceTempC,
      flirStatus,
      flirColor,
      recommendedFlirPolarity,
      lidarExtinctionDbKm,
      rfDuctingStatus,
      rfDuctingColor
    };
  }, [
    altitudeLadder,
    rawWind100m,
    atmData.airDensityRatio,
    airframe,
    payloadKg,
    surfaceWindKmh,
    solarWm2,
    tempC,
    soilTemp0cm,
    visibilityKm,
    pm10,
    rhPct
  ]);

  // Goal Ground Speed Calculator (Wind Triangle, Crab Angle, Platform V_min Stall & V_max Dash Envelopes at 10m-3000m)
  const groundSpeedSolver = useMemo(() => {
    const vMinIasKmh = Math.max(0, Number(platformMinSpeedKmh) || 0);
    const vMaxTasKmh = Math.max(30, Number(platformMaxSpeedKmh) || airframe.maxAirspeedKmh || 76);
    const vg = Math.max(5, Math.min(650, Number(goalGroundSpeedKmh) || 45));
    const altObj = computeAltProfile(calcAltitudeM, 'Selected Flight Level');
    const windSpd = altObj.speedKmh;
    const gustSpd = altObj.gustKmh;
    const windDir = altObj.dirDeg;
    const altDensityRatio = altObj.airDensityRatio;
    const densitySqrt = Math.sqrt(Math.max(0.55, altDensityRatio));

    // Angle between wind-from direction and desired course track (runwayHeading)
    const deltaRad = (((windDir - runwayHeading) + 360) % 360) * (Math.PI / 180);
    const headwindComp = windSpd * Math.cos(deltaRad); // + = headwind, - = tailwind
    const crosswindComp = windSpd * Math.sin(deltaRad); // + = from right, - = from left

    const gustHeadwind = gustSpd * Math.cos(deltaRad);
    const gustCrosswind = gustSpd * Math.sin(deltaRad);

    // Wind Triangle: V_air_vector = (Vg + W_head, W_cross)
    const reqTasKmh = Number(Math.sqrt(Math.pow(vg + headwindComp, 2) + Math.pow(crosswindComp, 2)).toFixed(1));
    const reqTasGustKmh = Number(Math.sqrt(Math.pow(vg + gustHeadwind, 2) + Math.pow(gustCrosswind, 2)).toFixed(1));
    const reqIasKmh = Number((reqTasKmh * densitySqrt).toFixed(1));

    // Required True Airspeed at Altitude to maintain V_min (Stall IAS)
    const vMinTasAtAltKmh = Number((vMinIasKmh / densitySqrt).toFixed(1));

    // Safe Achievable Ground Speed Window (minSafeVgKmh -> maxSafeVgKmh) on current track & altitude
    const minAlongTrackAirspeed = vMinTasAtAltKmh > Math.abs(crosswindComp)
      ? Math.sqrt(Math.max(0, Math.pow(vMinTasAtAltKmh, 2) - Math.pow(crosswindComp, 2)))
      : 0;
    const minSafeVgKmh = vMinIasKmh > 0
      ? Math.max(5, Math.ceil(minAlongTrackAirspeed - headwindComp))
      : 5;

    const maxAlongTrackAirspeed = vMaxTasKmh > Math.abs(crosswindComp)
      ? Math.sqrt(Math.max(0, Math.pow(vMaxTasKmh, 2) - Math.pow(crosswindComp, 2)))
      : 0;
    const maxSafeVgKmh = Math.max(minSafeVgKmh, Math.floor(maxAlongTrackAirspeed - headwindComp));

    // Reciprocal Return-Leg Required TAS & IAS (holding same Vg on opposite track)
    const returnTasKmh = Number(Math.sqrt(Math.pow(vg - headwindComp, 2) + Math.pow(crosswindComp, 2)).toFixed(1));
    const returnIasKmh = Number((returnTasKmh * densitySqrt).toFixed(1));

    // Wind Correction Angle (Crab Angle) & Required Compass Heading to Fly
    const wcaRad = Math.atan2(crosswindComp, vg + headwindComp);
    const wcaDeg = Number(((wcaRad * 180) / Math.PI).toFixed(1));
    const wcaAbs = Math.abs(wcaDeg);
    const wcaDir = wcaAbs < 0.4 ? '0°' : wcaDeg > 0 ? `+${wcaAbs}° R` : `-${wcaAbs}° L`;
    const commandHeadingDeg = Math.round((runwayHeading + wcaDeg + 360) % 360);

    // Airframe Max Airspeed & Propulsion Demand (adjusted for altitude air density)
    const maxAirspeedKmh = vMaxTasKmh;
    const speedRatio = reqTasKmh / Math.max(25, maxAirspeedKmh);
    const reqPitchDeg = Number(Math.min(38, Math.max(4, speedRatio * 28)).toFixed(1));
    const densityThrottlePenalty = Math.pow(Math.max(0.6, atmData.airDensityRatio / Math.max(0.55, altDensityRatio)), 0.55);
    const reqThrottlePct = Math.min(
      100,
      Math.round((aeroPerformance.estHoverThrottlePct * 0.72 + Math.pow(speedRatio, 1.65) * 52) * densityThrottlePenalty)
    );

    // 5 km Range Corridor Transit Time & Battery/Fuel Consumption
    const legTimeMinFloat = (5 / vg) * 60;
    const legMin = Math.floor(legTimeMinFloat);
    const legSec = Math.round((legTimeMinFloat - legMin) * 60);
    const legTime5kmStr = `${legMin}m ${String(legSec).padStart(2, '0')}s`;

    // Battery/fuel burn rate scales with flight time and (reqTas / cruiseSpeed)^1.45
    const powerMultiplier = Math.max(0.75, Math.pow(reqTasKmh / Math.max(25, airframe.cruiseSpeedKmh || 54), 1.45)) * densityThrottlePenalty;
    const legBatteryPct = Math.min(
      99,
      Math.max(1, Math.round(((legTimeMinFloat / Math.max(10, aeroPerformance.effectiveEnduranceMin)) * 100) * powerMultiplier))
    );

    const isStallRisk = vMinIasKmh > 0 && reqIasKmh < vMinIasKmh;
    const isNearStall = vMinIasKmh > 0 && !isStallRisk && reqIasKmh < vMinIasKmh * 1.15;
    const isReturnStallRisk = vMinIasKmh > 0 && returnIasKmh < vMinIasKmh;

    let status = 'ACHIEVABLE';
    let statusColor = 'bg-safetyGreen/20 border-safetyGreen/40 text-safetyGreen';
    if (isStallRisk) {
      status = `STALL RISK (IAS < V_MIN ${vMinIasKmh} KPH)`;
      statusColor = 'bg-stopRed/20 border-stopRed/40 text-stopRed';
    } else if (reqTasKmh > maxAirspeedKmh) {
      status = `EXCEEDS V_MAX (${maxAirspeedKmh} KPH)`;
      statusColor = 'bg-stopRed/20 border-stopRed/40 text-stopRed';
    } else if (isNearStall) {
      status = `LOW IAS / NEAR STALL (${vMinIasKmh} KPH)`;
      statusColor = 'bg-amberAlert/20 border-amberAlert/40 text-amberAlert';
    } else if (reqTasGustKmh > maxAirspeedKmh || reqThrottlePct >= 88) {
      status = 'HIGH POWER / GUST LIMIT';
      statusColor = 'bg-amberAlert/20 border-amberAlert/40 text-amberAlert';
    }

    return {
      vg,
      vgMs: Number((vg / 3.6).toFixed(1)),
      vgKts: Number((vg * 0.539957).toFixed(1)),
      altM: altObj.altM,
      altFt: altObj.altFt,
      altTempC: altObj.altTempC,
      altAirDensity: altObj.airDensity,
      windSpd,
      gustSpd,
      windDir,
      headwindComp: Number(headwindComp.toFixed(1)),
      crosswindComp: Number(Math.abs(crosswindComp).toFixed(1)),
      reqTasKmh,
      reqTasKts: Number((reqTasKmh * 0.539957).toFixed(1)),
      reqTasGustKmh,
      reqIasKmh,
      vMinIasKmh,
      vMinTasAtAltKmh,
      vMaxTasKmh: maxAirspeedKmh,
      minSafeVgKmh,
      maxSafeVgKmh,
      isStallRisk,
      isNearStall,
      isReturnStallRisk,
      returnTasKmh,
      returnIasKmh,
      wcaDeg,
      wcaDir,
      commandHeadingDeg,
      maxAirspeedKmh,
      reqPitchDeg,
      reqThrottlePct,
      legTime5kmStr,
      legBatteryPct,
      status,
      statusColor
    };
  }, [
    goalGroundSpeedKmh,
    platformMinSpeedKmh,
    platformMaxSpeedKmh,
    calcAltitudeM,
    computeAltProfile,
    runwayHeading,
    atmData.airDensityRatio,
    airframe.cruiseSpeedKmh,
    airframe.maxAirspeedKmh,
    aeroPerformance.estHoverThrottlePct,
    aeroPerformance.effectiveEnduranceMin
  ]);

  // 4-Sector Multi-Pad Readiness Matrix (Evaluates all 4 pads on Abu Al Abyad Island)
  const sectorReadinessMatrix = useMemo(() => {
    return stationsList.map(st => {
      const r = isSimulated && st.getReadings && data?.current
        ? st.getReadings(data.current)
        : (data?.stations?.[st.id]?.current || data?.current || {});
      const w10 = Number(r.wind_speed_10m ?? 18);
      const g10 = Number(r.wind_gusts_10m ?? (w10 * 1.35));
      const w100 = r.wind_speed_100m !== undefined
        ? Number(r.wind_speed_100m)
        : Number((w10 * Math.pow(100 / 10, 0.24)).toFixed(1));
      const visKm = Number(((r.visibility ?? 10000) / 1000).toFixed(1));
      const tC = Number(r.temperature_2m ?? 30);

      let padStatus = 'GO';
      if (
        w10 >= airframe.maxSustainedWindKmh ||
        g10 >= airframe.maxGustKmh ||
        w100 >= airframe.maxSustainedWindKmh * 1.1 ||
        visKm < 1.5 ||
        tC >= airframe.maxTempC
      ) {
        padStatus = 'NO-GO';
      } else if (
        w10 >= airframe.maxSustainedWindKmh * 0.8 ||
        g10 >= airframe.maxGustKmh * 0.8 ||
        w100 >= airframe.maxSustainedWindKmh * 0.9
      ) {
        padStatus = 'CAUTION';
      }

      return {
        id: st.id,
        short: st.id === 'hq' ? 'HQ Pad' : st.id === 'north' ? 'North' : st.id === 'south' ? 'South' : 'Sea Spit',
        w10: Math.round(w10),
        w100: Math.round(w100),
        status: padStatus
      };
    });
  }, [data, isSimulated, airframe]);

  // Master Go / Caution / No-Go Evaluation
  const masterClearance = useMemo(() => {
    const reasons = [];
    let status = 'GO';

    const hasLightning = ncmWarnings.some(w => w.category === 'LIGHTNING');
    const level100m = altitudeLadder.find(l => l.altM === 100) || altitudeLadder[2];

    if (hasLightning) {
      status = 'NO-GO';
      reasons.push('Active lightning strike hazard in sector — Immediate grounding mandated.');
    }
    if (surfaceWindKmh >= airframe.maxSustainedWindKmh || surfaceGustKmh >= airframe.maxGustKmh) {
      status = 'NO-GO';
      reasons.push(`Surface winds (${surfaceWindKmh.toFixed(0)} km/h, gusts ${surfaceGustKmh.toFixed(0)} km/h) exceed ${airframe.name} envelope.`);
    }
    if (level100m.speedKmh >= airframe.maxSustainedWindKmh * 1.1 || level100m.gustKmh >= airframe.maxGustKmh * 1.05) {
      status = 'NO-GO';
      reasons.push(`100m AGL boundary wind (${level100m.speedKmh} km/h / gusts ${level100m.gustKmh} km/h) breaches flight ceiling.`);
    }
    if (visibilityKm < 1.5) {
      status = 'NO-GO';
      reasons.push(`Visibility (${visibilityKm} km) below Visual Line of Sight (VLOS) minimum.`);
    }
    if (tempC >= airframe.maxTempC) {
      status = 'NO-GO';
      reasons.push(`Ambient temperature (${tempC.toFixed(1)}°C) exceeds avionics/battery maximum (${airframe.maxTempC}°C).`);
    }

    if (status !== 'NO-GO') {
      if (aeroPerformance.isPayloadOverweight) {
        status = 'CAUTION';
        reasons.push(`Payload (${aeroPerformance.activePayloadKg} kg) exceeds Density-Derated limit (${aeroPerformance.deratedMaxPayloadKg} kg at ${atmData.densityAltitudeFt.toLocaleString()} ft DA).`);
      }
      if (
        surfaceWindKmh >= airframe.maxSustainedWindKmh * 0.8 ||
        surfaceGustKmh >= airframe.maxGustKmh * 0.8 ||
        level100m.status !== 'GO'
      ) {
        status = 'CAUTION';
        reasons.push(`Elevated boundary layer winds at 100m AGL (${level100m.speedKmh} km/h). Restrict altitude below 50m AGL.`);
      }
      if (runwayAnalysis.crosswindStatus !== 'SAFE') {
        status = 'CAUTION';
        reasons.push(`Runway ${runwayHeading}° crosswind component (${runwayAnalysis.crosswindAbsKmh} km/h) near airframe limit.`);
      }
      if (aeroPerformance.thermalRisk.startsWith('HIGH') || tempC >= airframe.maxTempC - 3) {
        status = 'CAUTION';
        reasons.push(`High thermal updrafts & density altitude (${atmData.densityAltitudeFt.toLocaleString()} ft DA) reduce battery endurance to ~${aeroPerformance.effectiveEnduranceMin} min.`);
      }
      if (visibilityKm < 4.0) {
        status = 'CAUTION';
        reasons.push(`Suspended desert haze (${visibilityKm} km visibility) degrades optical target tracking.`);
      }
    }

    if (reasons.length === 0) {
      reasons.push(`All boundary layer, payload, and visibility parameters within ${airframe.name} operational limits.`);
    }

    return { status, reasons };
  }, [
    ncmWarnings,
    altitudeLadder,
    surfaceWindKmh,
    surfaceGustKmh,
    airframe,
    visibilityKm,
    tempC,
    runwayAnalysis,
    runwayHeading,
    aeroPerformance,
    atmData.densityAltitudeFt
  ]);

  // 12-Hour Diurnal UAV Flight Window Chart Data & Best 3-Hour Window Scanner
  const hourlyChartData = useMemo(() => {
    const activeHourly = data?.stations?.[activeStation]?.hourly || data?.hourly;
    if (!activeHourly?.time) return [];
    const now = currentTime || new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type)?.value || '00';
    const currentKey = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour') === '24' ? '00' : getPart('hour')}`;

    let startIdx = activeHourly.time.findIndex(t => t.startsWith(currentKey));
    if (startIdx === -1) startIdx = 0;

    const slice = [];
    for (let i = 0; i < 12; i++) {
      const idx = startIdx + i;
      if (idx >= activeHourly.time.length) break;
      const tStr = activeHourly.time[idx];
      const hrLabel = tStr.slice(11, 16);
      const w10 = Number((activeHourly.wind_speed_10m?.[idx] ?? surfaceWindKmh).toFixed(1));
      const g10 = Number((activeHourly.wind_gusts_10m?.[idx] ?? (w10 * 1.35)).toFixed(1));
      const w100 = activeHourly.wind_speed_100m?.[idx] !== undefined
        ? Number(activeHourly.wind_speed_100m[idx].toFixed(1))
        : Number((w10 * Math.pow(100 / 10, 0.24)).toFixed(1));

      slice.push({
        time: hrLabel,
        wind10m: w10,
        wind100m: w100,
        gusts: g10
      });
    }
    return slice;
  }, [data, activeStation, currentTime, surfaceWindKmh]);

  // Scan the 12-hour slice for the lowest-wind 3-hour sortie window
  const bestSortieWindow = useMemo(() => {
    if (!hourlyChartData || hourlyChartData.length < 3) return null;
    let bestIdx = 0;
    let lowestScore = Infinity;
    for (let i = 0; i <= hourlyChartData.length - 3; i++) {
      const avgW100 = (hourlyChartData[i].wind100m + hourlyChartData[i + 1].wind100m + hourlyChartData[i + 2].wind100m) / 3;
      const maxG = Math.max(hourlyChartData[i].gusts, hourlyChartData[i + 1].gusts, hourlyChartData[i + 2].gusts);
      const score = avgW100 + maxG * 0.4;
      if (score < lowestScore) {
        lowestScore = score;
        bestIdx = i;
      }
    }
    const avgW100 = Math.round(
      (hourlyChartData[bestIdx].wind100m + hourlyChartData[bestIdx + 1].wind100m + hourlyChartData[bestIdx + 2].wind100m) / 3
    );
    return {
      start: hourlyChartData[bestIdx].time,
      end: hourlyChartData[bestIdx + 2].time,
      avgW100,
      isCleared: avgW100 < airframe.maxSustainedWindKmh
    };
  }, [hourlyChartData, airframe.maxSustainedWindKmh]);

  // Generate grounded aviation METAR string for Abu Al Abyad Island (OMAB)
  const metarString = useMemo(() => {
    const now = currentTime || new Date();
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const dirPad = String(Math.round(windDirDeg / 10) * 10).padStart(3, '0');
    const spdKts = String(Math.round(surfaceWindKmh * 0.539957)).padStart(2, '0');
    const gstKts = String(Math.round(surfaceGustKmh * 0.539957)).padStart(2, '0');
    const visCode = visibilityM >= 9999 ? '9999' : String(Math.round(visibilityM / 100) * 100).padStart(4, '0');
    const wxGroup = visibilityM < 1000
      ? ' DS'
      : visibilityM < 5000
      ? (dustUgm3 >= 60 ? ' DU' : ' HZ')
      : '';
    const skyGroup = cloudCoverPct < 10
      ? 'SKC'
      : cloudCoverPct < 25
      ? 'FEW040'
      : cloudCoverPct < 50
      ? 'SCT045'
      : cloudCoverPct < 85
      ? 'BKN050'
      : 'OVC050';
    const tPad = String(Math.round(tempC)).padStart(2, '0');
    const dpC = Math.round(calculateDewPoint(tempC, rhPct));
    const dpPad = String(Math.max(0, dpC)).padStart(2, '0');
    const qnh = String(Math.round(pressureHpa)).padStart(4, '0');

    return `METAR OMAB ${dd}${hh}${mm}Z ${dirPad}${spdKts}G${gstKts}KT ${visCode}${wxGroup} ${skyGroup} ${tPad}/${dpPad} Q${qnh} RMK DA${atmData.densityAltitudeFt}FT WN100/${Math.round(shearData.boundaryWind100mKmh * 0.54)}KT RTH${aeroPerformance.bingoBatteryPct}PCT`;
  }, [currentTime, windDirDeg, surfaceWindKmh, surfaceGustKmh, visibilityM, dustUgm3, cloudCoverPct, tempC, rhPct, pressureHpa, atmData.densityAltitudeFt, shearData.boundaryWind100mKmh, aeroPerformance.bingoBatteryPct]);

  const handleCopyMetar = () => {
    navigator.clipboard.writeText(metarString);
    setCopiedMetar(true);
    setTimeout(() => setCopiedMetar(false), 2000);
  };

  const completedChecksCount = Object.values(checkedItems).filter(Boolean).length;

  // Download UAV Pilot Pre-Flight Weather Dossier (.txt)
  const handleDownloadPilotBrief = () => {
    const report = `======================================================================
           XRANGE WEATHER HUB • UAV FLIGHT OPERATIONS BRIEFING
         ABU AL ABYAD ISLAND (OMAB) • GROUND CONTROL STATION LOG
======================================================================
TIMESTAMP (GST):       ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })}
ACTIVE LAUNCH SECTOR:  ${stationObj.name.toUpperCase()} (${stationObj.description})
AIRFRAME PROFILE:      ${airframe.name} (${airframe.models})
CONFIGURED PAYLOAD:    ${aeroPerformance.activePayloadKg} kg (DA Derated Max: ${aeroPerformance.deratedMaxPayloadKg} kg)
MASTER FLIGHT STATUS:  ${masterClearance.status}

----------------------------------------------------------------------
1. AVIATION METAR TELEMETRY
----------------------------------------------------------------------
${metarString}

----------------------------------------------------------------------
2. VERTICAL BOUNDARY LAYER WIND PROFILE (AGL)
----------------------------------------------------------------------
Altitude        Sustained Wind      Peak Gusts          Direction   Status
${altitudeLadder.map(l => `${l.label.padEnd(15)} ${String(l.speedKmh + ' km/h (' + l.speedKts + ' kt)').padEnd(19)} ${String(l.gustKmh + ' km/h (' + l.gustKts + ' kt)').padEnd(19)} ${String(l.dirDeg + '°').padEnd(11)} ${l.status}`).join('\n')}

* 10m-100m Shear Gradient: +${shearData.shearGradient} km/h per 100m (Ratio: ${shearData.shearRatio}x - ${shearData.shearRisk} RISK)

----------------------------------------------------------------------
3. RUNWAY / LAUNCH RAIL CROSSWIND & RTH COMBAT RADIUS
----------------------------------------------------------------------
* Active Strip / Rail:     ${RUNWAY_PRESETS.find(r => r.id === selectedRunwayId)?.label || `Custom Heading ${runwayHeading}°`}
* Headwind / Tailwind:     ${runwayAnalysis.headwindKmh >= 0 ? `Headwind ${runwayAnalysis.headwindKmh} km/h (${runwayAnalysis.headwindKts} kt)` : `Tailwind ${Math.abs(runwayAnalysis.headwindKmh)} km/h (${Math.abs(runwayAnalysis.headwindKts)} kt)`}
* Direct Crosswind:        ${runwayAnalysis.crosswindAbsKmh} km/h (${runwayAnalysis.crosswindKts} kt) ${runwayAnalysis.crosswindSide}
* Gust Crosswind Peak:     ${runwayAnalysis.gustCrosswindKmh} km/h
* Crosswind Clearance:     ${runwayAnalysis.crosswindStatus} (Limit: ${airframe.maxCrosswindKmh} km/h)
* Downwind Groundspeed:    ${aeroPerformance.outboundGroundspeedKmh} km/h | Upwind Return: ${aeroPerformance.returnGroundspeedKmh} km/h
* Max Safe RTH Radius:     ${aeroPerformance.maxSafeRadiusKm} km (Point of Safe Return)
* Mandatory RTH Bingo:     ${aeroPerformance.bingoBatteryPct}% Battery Remaining
* Goal Ground Speed (${groundSpeedSolver.vg} km/h @ ${calcAltitudeM}m AGL): Req TAS ${groundSpeedSolver.reqTasKmh} km/h | Crab ${groundSpeedSolver.wcaDir} (Fly ${groundSpeedSolver.commandHeadingDeg}°) | Throttle ${groundSpeedSolver.reqThrottlePct}% | 5km Leg ${groundSpeedSolver.legTime5kmStr} (${groundSpeedSolver.legBatteryPct}% Bat)

----------------------------------------------------------------------
4. DENSITY ALTITUDE, PAYLOAD HOVER & SENSOR DIAGNOSTICS
----------------------------------------------------------------------
* Ambient Temperature:     ${tempC.toFixed(1)}°C (Max Limit: ${airframe.maxTempC}°C)
* Relative Humidity:       ${rhPct}% | Station Pressure: ${pressureHpa} hPa
* Air Density:             ${atmData.airDensity} kg/m³ (${atmData.airDensityDeltaPct}% vs ISA Standard)
* Density Altitude (DA):   ${atmData.densityAltitudeFt.toLocaleString()} ft (${atmData.densityAltitudeM.toLocaleString()} m)
* Rotor Lift Efficiency:   ${aeroPerformance.liftEfficiencyPct}% (-${aeroPerformance.thrustLossPct}% thrust loss in thin air)
* Est. Hover Throttle:     ${aeroPerformance.estHoverThrottlePct}% (with ${aeroPerformance.activePayloadKg} kg payload)
* Est. Battery Endurance:  ${aeroPerformance.effectiveEnduranceMin} min (${Math.round(aeroPerformance.enduranceMultiplier * 100)}% of ${airframe.nominalEnduranceMin} min nominal)
* Thermal Turbulence:      ${aeroPerformance.thermalRisk} (Index: ${aeroPerformance.thermalIndex})
* EO/IR Sensor Status:     ${aeroPerformance.flirStatus} (Rec. Polarity: ${aeroPerformance.recommendedFlirPolarity})
* LiDAR Extinction:        ${aeroPerformance.lidarExtinctionDbKm} dB/km | C2 RF Link: ${aeroPerformance.rfDuctingStatus}

----------------------------------------------------------------------
5. RPIC PRE-FLIGHT SAFETY GATE (${completedChecksCount}/5 VERIFIED)
----------------------------------------------------------------------
${RPIC_CHECKLIST_ITEMS.map(item => `[${checkedItems[item.id] ? 'X' : ' '}] ${item.label}`).join('\n')}

----------------------------------------------------------------------
6. FLIGHT SAFETY ADVISORIES & GCS SIGN-OFF
----------------------------------------------------------------------
${masterClearance.reasons.map(r => `* ${r}`).join('\n')}

Remote Pilot in Command (RPIC): ______________________  Sign: __________
Range Safety Officer (RSO):     ______________________  Time: __________
======================================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `XRANGE_UAV_Pilot_Brief_${stationObj.id.toUpperCase()}_${airframe.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Formatted MS Word (.doc) UAV Flight Dossier
  const handleDownloadWordBrief = () => {
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>XRANGE UAV Flight Dossier</title></head>
    <body style="font-family: Arial, sans-serif; font-size: 10pt; color: #0f172a;">
      <div style="background:#FF4E02; color:#fff; padding:12px;">
        <h2 style="margin:0;">XRANGE WEATHER HUB — UAV / DRONE FLIGHT DOSSIER</h2>
        <p style="margin:4px 0 0 0; font-size:9pt;">ABU AL ABYAD ISLAND (OMAB) • SECTOR: ${stationObj.name.toUpperCase()} • ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST</p>
      </div>
      <p><strong>AIRFRAME:</strong> ${airframe.name} (${airframe.models}) | <strong>PAYLOAD:</strong> ${aeroPerformance.activePayloadKg} kg (DA Limit: ${aeroPerformance.deratedMaxPayloadKg} kg)</p>
      <p><strong>MASTER CLEARANCE:</strong> ${masterClearance.status} — ${masterClearance.reasons.join(' • ')}</p>
      <p style="background:#0f172a; color:#38bdf8; padding:8px; font-family:Consolas, monospace; font-size:9pt;">${metarString}</p>
      <h3>1. Vertical Boundary Layer Wind Profile (AGL)</h3>
      <table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse; font-size:9pt;">
        <tr style="background:#1e293b; color:#fff;"><th>Altitude</th><th>Sustained</th><th>Peak Gust</th><th>Dir</th><th>Clearance</th></tr>
        ${altitudeLadder.map(l => `<tr><td>${l.label}</td><td>${l.speedKmh} km/h (${l.speedKts} kt)</td><td>${l.gustKmh} km/h</td><td>${l.dirDeg}°</td><td><strong>${l.status}</strong></td></tr>`).join('')}
      </table>
      <h3>2. RTH Combat Radius, Density Altitude & Sensor Diagnostics</h3>
      <table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse; font-size:9pt;">
        <tr><td><strong>Max Safe RTH Radius</strong></td><td>${aeroPerformance.maxSafeRadiusKm} km</td><td><strong>Mandatory RTH Bingo</strong></td><td>${aeroPerformance.bingoBatteryPct}% Battery</td></tr>
        <tr><td><strong>Outbound / Return Groundspeed</strong></td><td>${aeroPerformance.outboundGroundspeedKmh} / ${aeroPerformance.returnGroundspeedKmh} km/h</td><td><strong>Est. Flight Endurance</strong></td><td>${aeroPerformance.effectiveEnduranceMin} min (Hover ${aeroPerformance.estHoverThrottlePct}%)</td></tr>
        <tr><td><strong>Density Altitude (DA)</strong></td><td>${atmData.densityAltitudeFt.toLocaleString()} ft (${atmData.airDensity} kg/m³)</td><td><strong>FLIR Polarity / LiDAR</strong></td><td>${aeroPerformance.recommendedFlirPolarity} / ${aeroPerformance.lidarExtinctionDbKm} dB/km</td></tr>
        <tr><td><strong>C2 RF Link Status</strong></td><td>${aeroPerformance.rfDuctingStatus}</td><td><strong>RPIC Safety Gate</strong></td><td>${completedChecksCount}/5 Verified</td></tr>
      </table>
    </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `XRANGE_UAV_Dossier_${stationObj.id.toUpperCase()}_${airframe.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between space-y-2.5 text-textIceWhite overflow-y-auto lg:overflow-hidden select-none px-2 py-1">
      
      {/* TOP BAR: Master Flight Readiness Banner & Controls */}
      <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shrink-0 shadow-lg">
        {/* Left: Status & Title */}
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg border flex items-center justify-center ${
            masterClearance.status === 'GO'
              ? 'bg-safetyGreen/15 border-safetyGreen text-safetyGreen'
              : masterClearance.status === 'CAUTION'
              ? 'bg-amberAlert/15 border-amberAlert text-amberAlert'
              : 'bg-stopRed/20 border-stopRed text-stopRed animate-pulse'
          }`}>
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <h1 className="text-sm font-black tracking-widest uppercase text-white">
                UAV / DRONE PILOT FLIGHT OPS CONSOLE
              </h1>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                masterClearance.status === 'GO'
                  ? 'bg-safetyGreen/20 border-safetyGreen/50 text-safetyGreen'
                  : masterClearance.status === 'CAUTION'
                  ? 'bg-amberAlert/20 border-amberAlert/50 text-amberAlert'
                  : 'bg-stopRed/25 border-stopRed text-stopRed'
              }`}>
                {masterClearance.status === 'GO' ? '🟢 GO • FLIGHT CLEARED' :
                 masterClearance.status === 'CAUTION' ? '🟡 CAUTION • RESTRICTED ENVELOPE' :
                 '🔴 NO-GO • SORTIES GROUNDED'}
              </span>
            </div>
            <p className="text-[9.5px] text-slate-300 font-bold mt-0.5">
              {masterClearance.reasons[0]}
            </p>
          </div>
        </div>

        {/* Right: 4-Pad Readiness Matrix, Airframe Selector & Brief Exports */}
        <div className="flex items-center flex-wrap gap-2">
          {/* 4-Sector Multi-Pad Readiness Switcher */}
          {setActiveStation && (
            <div className="flex items-center bg-bgDeepSpace/90 p-1 rounded-lg border border-slate-800 gap-1">
              {sectorReadinessMatrix.map(pad => {
                const isSelected = activeStation === pad.id;
                const dotColor = pad.status === 'GO'
                  ? 'bg-safetyGreen'
                  : pad.status === 'CAUTION'
                  ? 'bg-amberAlert'
                  : 'bg-stopRed animate-ping';
                return (
                  <button
                    key={pad.id}
                    type="button"
                    onClick={() => setActiveStation(pad.id)}
                    className={`px-2 py-1 rounded text-[8.5px] font-black uppercase transition cursor-pointer flex items-center space-x-1.5 border ${
                      isSelected
                        ? 'bg-edgeOrange/25 border-edgeOrange text-white'
                        : 'bg-slate-900/60 border-transparent text-slate-400 hover:text-white'
                    }`}
                    title={`${pad.short}: ${pad.status} • 100m Wind: ${pad.w100} km/h`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span>{pad.short}</span>
                    <span className="font-mono text-[8px] text-cyan-300">{pad.w100}kph</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Airframe Profile Dropdown */}
          <select
            value={selectedAirframeId}
            onChange={(e) => {
              const nextId = e.target.value;
              setSelectedAirframeId(nextId);
              const nextAf = UAV_AIRFRAMES.find(a => a.id === nextId);
              if (nextAf) {
                setPayloadKg(nextAf.defaultPayloadKg);
                setPlatformMinSpeedKmh(nextAf.minAirspeedKmh ?? 0);
                setPlatformMaxSpeedKmh(nextAf.maxAirspeedKmh ?? 76);
                setGoalGroundSpeedKmh(nextAf.cruiseSpeedKmh ?? 54);
                if (nextAf.ceilingM >= 1500 && calcAltitudeM < 300) {
                  setCalcAltitudeM(600);
                  setAltitudeBand('HIGH');
                }
              }
            }}
            className="bg-bgDeepSpace border border-slate-700 text-white text-[9.5px] font-black uppercase px-2 py-1.5 rounded-lg focus:border-edgeOrange outline-none cursor-pointer"
          >
            {UAV_AIRFRAMES.map(a => (
              <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                ✈️ {a.name} ({a.minAirspeedKmh}–{a.maxAirspeedKmh} km/h | Wind ≤{a.maxSustainedWindKmh}kph)
              </option>
            ))}
          </select>

          {/* Export Briefing Buttons (.TXT and .DOC) */}
          <button
            type="button"
            onClick={handleDownloadPilotBrief}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition"
            title="Download Pre-Flight TXT Log"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span>TXT</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadWordBrief}
            className="bg-edgeOrange hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition shadow-md shadow-edgeOrange/15"
            title="Download Formatted MS Word UAV Flight Dossier"
          >
            <FileText className="w-3 h-3" />
            <span>WORD DOSSIER</span>
          </button>
        </div>
      </div>

      {/* AVIATION METAR + INTERACTIVE RPIC PRE-FLIGHT SAFETY GATE STRIP */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded-lg px-3 py-1.5 flex flex-col xl:flex-row xl:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 flex items-center space-x-1">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            <span>METAR</span>
          </span>
          <code className="text-[9.5px] font-mono font-bold text-slate-200 whitespace-nowrap">
            {metarString}
          </code>
          <button
            type="button"
            onClick={handleCopyMetar}
            className="text-[8px] font-black uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 flex items-center space-x-1 shrink-0 cursor-pointer transition"
          >
            {copiedMetar ? <Check className="w-2.5 h-2.5 text-safetyGreen" /> : <Copy className="w-2.5 h-2.5" />}
            <span>{copiedMetar ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>

        {/* Interactive 5-Point RPIC Pre-Flight Checklist */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
            completedChecksCount === 5
              ? 'bg-safetyGreen/20 border-safetyGreen/40 text-safetyGreen'
              : 'bg-amberAlert/20 border-amberAlert/40 text-amberAlert'
          }`}>
            RPIC GATE {completedChecksCount}/5
          </span>
          {RPIC_CHECKLIST_ITEMS.map(item => {
            const checked = !!checkedItems[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleChecklist(item.id)}
                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border flex items-center space-x-1 cursor-pointer transition whitespace-nowrap ${
                  checked
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{checked ? '✓' : '○'}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN 3-COLUMN COCKPIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-grow min-h-0 overflow-y-auto lg:overflow-hidden">
        
        {/* LEFT COLUMN (4 Cols): Vertical Boundary Layer Wind Ladder & Airframe + Payload Simulator */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-2.5 min-h-0 overflow-y-auto no-scrollbar">
          
          {/* Vertical Wind Shear Profile Ladder (10m up to 2,500m AGL) */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-3 flex flex-col justify-between flex-grow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 gap-1 flex-wrap">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-white">
                  VERTICAL WIND LADDER (10M–2500M)
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 text-[7.5px] font-black uppercase">
                  <button
                    type="button"
                    onClick={() => setAltitudeBand('LOW')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                      altitudeBand === 'LOW' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    10–300m
                  </button>
                  <button
                    type="button"
                    onClick={() => setAltitudeBand('HIGH')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                      altitudeBand === 'HIGH' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    300–2500m
                  </button>
                </div>
              </div>
            </div>

            {/* Altitude Slices */}
            <div className="flex flex-col space-y-1.5 my-auto">
              {altitudeLadder.map((lvl) => {
                const barPct = Math.min(100, Math.round((lvl.speedKmh / 75) * 100));
                const gustPct = Math.min(100, Math.round((lvl.gustKmh / 75) * 100));
                const limitPct = Math.min(100, Math.round((airframe.maxSustainedWindKmh / 75) * 100));
                const isSelectedAlt = calcAltitudeM === lvl.altM;

                return (
                  <div
                    key={lvl.altM}
                    onClick={() => setCalcAltitudeM(lvl.altM)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      isSelectedAlt
                        ? 'bg-cyan-950/30 border-cyan-500/60'
                        : lvl.status === 'NO-GO'
                        ? 'bg-stopRed/10 border-stopRed/40'
                        : lvl.status === 'CAUTION'
                        ? 'bg-amberAlert/10 border-amberAlert/30'
                        : 'bg-bgDeepSpace/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                    title="Click to load this altitude into the Goal Ground Speed Calculator"
                  >
                    <div className="flex items-center justify-between text-[9px] mb-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          lvl.status === 'NO-GO' ? 'bg-stopRed animate-ping' :
                          lvl.status === 'CAUTION' ? 'bg-amberAlert' : 'bg-safetyGreen'
                        }`} />
                        <span className="font-mono font-black text-white">{lvl.label}</span>
                        <span className="text-[7.5px] text-slate-400 font-bold uppercase hidden sm:inline">• {lvl.zone}</span>
                      </div>
                      <div className="font-mono font-bold text-right">
                        <span className="text-white">{lvl.speedKmh}</span>
                        <span className="text-slate-400 text-[7.5px]"> km/h </span>
                        <span className="text-amber-400 text-[8px]">(G {lvl.gustKmh})</span>
                        <span className="text-cyan-300 text-[7.5px] ml-1">{lvl.dirDeg}°</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-950 rounded overflow-hidden relative border border-slate-800">
                      <div
                        className="h-full bg-amber-500/35 absolute top-0 left-0 transition-all duration-500"
                        style={{ width: `${gustPct}%` }}
                      />
                      <div
                        className={`h-full absolute top-0 left-0 transition-all duration-500 ${
                          lvl.status === 'NO-GO' ? 'bg-stopRed' :
                          lvl.status === 'CAUTION' ? 'bg-amberAlert' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${barPct}%` }}
                      />
                      <div
                        className="h-full w-0.5 bg-white absolute top-0 z-10"
                        style={{ left: `${limitPct}%` }}
                        title={`Airframe Max Wind Limit: ${airframe.maxSustainedWindKmh} km/h`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[8px] text-slate-400">
              <span>White marker = Airframe Limit ({airframe.maxSustainedWindKmh} km/h)</span>
              <span className="font-mono text-cyan-300">Shear Ratio: {shearData.shearRatio}x</span>
            </div>
          </div>

          {/* Airframe Envelope & Interactive Payload Weight Simulator */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-3 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-edgeOrange flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>PAYLOAD & HOVER THROTTLE SIMULATOR</span>
              </span>
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                aeroPerformance.isPayloadOverweight
                  ? 'bg-stopRed/20 border-stopRed/40 text-stopRed'
                  : 'bg-slate-900 border-slate-700 text-cyan-300'
              }`}>
                DA MAX PAYLOAD: {aeroPerformance.deratedMaxPayloadKg} kg
              </span>
            </div>

            {/* Interactive Payload Mass Slider */}
            <div className="bg-bgDeepSpace/70 p-2 rounded border border-slate-800 mb-2">
              <div className="flex items-center justify-between text-[8.5px] mb-1">
                <span className="text-slate-300 font-bold uppercase">
                  GIMBAL / SENSOR PAYLOAD MASS: <strong className="text-white font-mono">{aeroPerformance.activePayloadKg} kg</strong>
                </span>
                <span className={`font-mono font-black ${
                  aeroPerformance.estHoverThrottlePct >= 75 ? 'text-stopRed' :
                  aeroPerformance.estHoverThrottlePct >= 62 ? 'text-amberAlert' : 'text-safetyGreen'
                }`}>
                  HOVER THROTTLE: {aeroPerformance.estHoverThrottlePct}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={airframe.maxPayloadKg}
                step="0.1"
                value={aeroPerformance.activePayloadKg}
                onChange={(e) => setPayloadKg(Number(e.target.value))}
                className="w-full accent-edgeOrange h-1 cursor-pointer"
              />
            </div>

            {selectedAirframeId === 'CUSTOM' ? (
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-[8px]">
                <div>
                  <span className="text-slate-400 block">MAX WIND: <strong className="text-white">{customMaxWind} km/h</strong></span>
                  <input
                    type="range" min="15" max="60" value={customMaxWind}
                    onChange={(e) => setCustomMaxWind(Number(e.target.value))}
                    className="w-full accent-edgeOrange h-1 mt-1 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block">MAX GUST: <strong className="text-white">{customMaxGust} km/h</strong></span>
                  <input
                    type="range" min="20" max="75" value={customMaxGust}
                    onChange={(e) => setCustomMaxGust(Number(e.target.value))}
                    className="w-full accent-edgeOrange h-1 mt-1 cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block">CROSSWIND: <strong className="text-white">{customMaxCrosswind} km/h</strong></span>
                  <input
                    type="range" min="10" max="45" value={customMaxCrosswind}
                    onChange={(e) => setCustomMaxCrosswind(Number(e.target.value))}
                    className="w-full accent-edgeOrange h-1 mt-1 cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1 text-center bg-bgDeepSpace/60 p-1.5 rounded border border-slate-800 text-[7.5px]">
                <div>
                  <span className="text-slate-500 block uppercase font-bold">V_MIN</span>
                  <span className="font-mono font-black text-amber-300">
                    {airframe.minAirspeedKmh > 0 ? `${airframe.minAirspeedKmh} kph` : '0 (HVR)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold">CRUISE</span>
                  <span className="font-mono font-black text-cyan-300">{airframe.cruiseSpeedKmh} kph</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold">V_MAX</span>
                  <span className="font-mono font-black text-emerald-300">{airframe.maxAirspeedKmh} kph</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold">MAX WIND</span>
                  <span className="font-mono font-black text-white">{airframe.maxSustainedWindKmh} kph</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase font-bold">X-WIND</span>
                  <span className="font-mono font-black text-white">{airframe.maxCrosswindKmh} kph</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN (4 Cols): Runway Crosswind + RTH Combat Radius & 12-Hour Flight Window */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-2.5 min-h-0 overflow-y-auto no-scrollbar">
          
          {/* Interactive Runway Crosswind + RTH Point of Safe Return Resolver */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center space-x-1.5">
                <Compass className="w-4 h-4 text-edgeOrange" />
                <span className="text-[10px] font-black uppercase tracking-wider text-white">
                  CROSSWIND & RTH SAFE RADIUS RESOLVER
                </span>
              </div>
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                runwayAnalysis.crosswindStatus === 'SAFE'
                  ? 'bg-safetyGreen/20 border-safetyGreen/40 text-safetyGreen'
                  : runwayAnalysis.crosswindStatus === 'CAUTION'
                  ? 'bg-amberAlert/20 border-amberAlert/40 text-amberAlert'
                  : 'bg-stopRed/20 border-stopRed/40 text-stopRed'
              }`}>
                {runwayAnalysis.crosswindStatus}
              </span>
            </div>

            {/* 3-Runway Strip Selector (RWY 1, RWY 2, RWY 3 — All 31/13) + 31 (310°) / 13 (130°) Threshold Toggle */}
            <div className="space-y-1.5 mb-2">
              <div className="grid grid-cols-3 gap-1">
                {XRANGE_RUNWAYS.map(strip => {
                  const isActiveStrip = selectedRunwayStrip === strip.id;
                  return (
                    <button
                      key={strip.id}
                      type="button"
                      onClick={() => {
                        setSelectedRunwayStrip(strip.id);
                        const endCode = runwayHeading === 130 ? '13' : '31';
                        const nextHdg = endCode === '13' ? 130 : 310;
                        setRunwayHeading(nextHdg);
                        setSelectedRunwayId(`${strip.id}_${endCode}`);
                      }}
                      className={`px-1.5 py-1 rounded text-[7.5px] font-black uppercase border text-center truncate cursor-pointer transition ${
                        isActiveStrip
                          ? 'bg-edgeOrange/20 border-edgeOrange text-white'
                          : 'bg-bgDeepSpace/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🛫 {strip.short} 31/13
                    </button>
                  );
                })}
              </div>

              {/* Active Runway End Direction Selector: RWY 31 (310° NW) vs RWY 13 (130° SE) */}
              {(() => {
                const delta310 = (((windDirDeg - 310) + 360) % 360) * (Math.PI / 180);
                const favorsRwy31 = Math.cos(delta310) >= 0;
                return (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRunwayHeading(310);
                        setSelectedRunwayId(`${selectedRunwayStrip}_31`);
                      }}
                      className={`px-2 py-1 rounded text-[8px] font-black uppercase border flex items-center justify-between cursor-pointer transition ${
                        runwayHeading === 310
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-bgDeepSpace/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>RWY 31 (310° NW)</span>
                      {favorsRwy31 && (
                        <span className="text-[7px] font-mono bg-safetyGreen/20 text-safetyGreen border border-safetyGreen/40 px-1 rounded">
                          ★ INTO WIND
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRunwayHeading(130);
                        setSelectedRunwayId(`${selectedRunwayStrip}_13`);
                      }}
                      className={`px-2 py-1 rounded text-[8px] font-black uppercase border flex items-center justify-between cursor-pointer transition ${
                        runwayHeading === 130
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-bgDeepSpace/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>RWY 13 (130° SE)</span>
                      {!favorsRwy31 && (
                        <span className="text-[7px] font-mono bg-safetyGreen/20 text-safetyGreen border border-safetyGreen/40 px-1 rounded">
                          ★ INTO WIND
                        </span>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Visual SVG Compass & Vector Readout */}
            <div className="grid grid-cols-12 gap-2 items-center my-0.5">
              <div className="col-span-5 flex justify-center bg-bgDeepSpace/60 rounded-lg p-1 border border-slate-800/80">
                <svg width="114" height="114" viewBox="0 0 140 140" className="select-none">
                  <circle cx="70" cy="70" r="62" fill="#090d16" stroke="#334155" strokeWidth="1.5" />
                  <circle cx="70" cy="70" r="52" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,3" />
                  <text x="70" y="16" fontSize="7" fill="#94a3b8" fontWeight="bold" textAnchor="middle">N</text>
                  <text x="126" y="72" fontSize="7" fill="#64748b" fontWeight="bold" textAnchor="middle">E</text>
                  <text x="70" y="129" fontSize="7" fill="#64748b" fontWeight="bold" textAnchor="middle">S</text>
                  <text x="14" y="72" fontSize="7" fill="#64748b" fontWeight="bold" textAnchor="middle">W</text>
                  <g transform={`rotate(${runwayHeading}, 70, 70)`}>
                    <rect x="60" y="20" width="20" height="100" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <line x1="70" y1="34" x2="70" y2="104" stroke="#f8fafc" strokeWidth="1" strokeDasharray="5,4" opacity="0.7" />
                    <path d="M 70 25 L 66 33 L 74 33 Z" fill="#f97316" />
                    <text x="70" y="115" fontSize="6.5" fill="#f8fafc" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      {runwayHeading === 130 ? '13' : runwayHeading === 310 ? '31' : String(Math.round(runwayHeading / 10)).padStart(2, '0')}
                    </text>
                  </g>
                  <g transform={`rotate(${windDirDeg}, 70, 70)`}>
                    <line x1="70" y1="12" x2="70" y2="54" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M 65 46 L 70 55 L 75 46" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="70" cy="12" r="2.5" fill="#38bdf8" />
                  </g>
                  <circle cx="70" cy="70" r="3.5" fill="#f97316" />
                </svg>
              </div>

              <div className="col-span-7 flex flex-col space-y-1.5 text-[8.5px] font-mono">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                    <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">
                      {runwayAnalysis.isTailwind ? '⚠️ TAILWIND' : '✅ HEADWIND'}
                    </span>
                    <span className={`text-xs font-black ${runwayAnalysis.isTailwind ? 'text-amberAlert' : 'text-safetyGreen'}`}>
                      {Math.abs(runwayAnalysis.headwindKmh)} km/h
                    </span>
                    <span className="text-[7.5px] text-slate-400 block">{Math.abs(runwayAnalysis.headwindKts)} kt</span>
                  </div>

                  <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                    <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">
                      X-WIND ({runwayAnalysis.crosswindSide.replace('FROM ', '')})
                    </span>
                    <span className={`text-xs font-black ${
                      runwayAnalysis.crosswindStatus === 'LIMIT EXCEEDED' ? 'text-stopRed' :
                      runwayAnalysis.crosswindStatus === 'CAUTION' ? 'text-amberAlert' : 'text-cyan-400'
                    }`}>
                      {runwayAnalysis.crosswindAbsKmh} km/h
                    </span>
                    <span className="text-[7.5px] text-slate-400 block">G: {runwayAnalysis.gustCrosswindKmh} kph</span>
                  </div>
                </div>

                {/* RTH Point of Safe Return & Bingo Battery Strip */}
                <div className="bg-slate-950/90 p-1.5 rounded border border-cyan-500/30">
                  <div className="flex items-center justify-between text-[7.5px] font-sans font-black text-cyan-300 uppercase">
                    <span>🧭 MAX RTH SAFE RADIUS</span>
                    <span className="text-amber-400">BINGO RTH: {aeroPerformance.bingoBatteryPct}% BAT</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-xs font-black text-white">{aeroPerformance.maxSafeRadiusKm} km</span>
                    <span className="text-[7.5px] text-slate-400">
                      Out {aeroPerformance.outboundGroundspeedKmh} / Back {aeroPerformance.returnGroundspeedKmh} kph
                    </span>
                  </div>
                </div>

                {/* Custom Azimuth Slider */}
                <div>
                  <div className="flex justify-between text-[7.5px] font-sans font-bold text-slate-400">
                    <span>LAUNCH HEADING:</span>
                    <span className="text-edgeOrange font-mono">{runwayHeading}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={runwayHeading}
                    onChange={(e) => {
                      setRunwayHeading(Number(e.target.value));
                      setSelectedRunwayId('CUSTOM');
                    }}
                    className="w-full accent-edgeOrange h-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 12-Hour UAV Flight Envelope Trend Chart + Best Sortie Window Badge */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-3 flex flex-col justify-between flex-grow min-h-[170px]">
            <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-white flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>12-HR BOUNDARY WIND ENVELOPE</span>
              </span>
              {bestSortieWindow && (
                <span className={`text-[7.5px] font-mono font-black px-1.5 py-0.5 rounded border ${
                  bestSortieWindow.isCleared
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                }`}>
                  ★ BEST WINDOW: {bestSortieWindow.start}–{bestSortieWindow.end} ({bestSortieWindow.avgW100} kph @100m)
                </span>
              )}
            </div>

            <div className="flex-grow w-full min-h-[115px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyChartData} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="uavWind100" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={8.5} tickLine={false} />
                  <YAxis domain={[0, 65]} stroke="#64748b" fontSize={8.5} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={airframe.maxSustainedWindKmh}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: `MAX ${airframe.maxSustainedWindKmh}km/h`, fill: '#ef4444', fontSize: 8, position: 'insideTopRight' }}
                  />
                  <Area type="monotone" dataKey="gusts" name="Peak Gusts (km/h)" stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="2 2" fill="none" />
                  <Area type="monotone" dataKey="wind100m" name="100m AGL Wind (km/h)" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#uavWind100)" />
                  <Area type="monotone" dataKey="wind10m" name="10m Surface Wind (km/h)" stroke="#10b981" strokeWidth={1.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (4 Cols): Goal Ground Speed Calculator, Density Altitude & Thermal / C2 / EO-IR Diagnostics */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-2.5 min-h-0 overflow-y-auto no-scrollbar">
          
          {/* Interactive Goal Ground Speed Calculator (Wind Triangle, Stall V_min & Dash V_max Solver) */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center space-x-1.5">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-white">
                  GOAL GROUND SPEED CALCULATOR (VG SOLVER)
                </span>
              </div>
              <span className={`text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded border ${groundSpeedSolver.statusColor}`}>
                {groundSpeedSolver.status}
              </span>
            </div>

            {/* Goal Speed + Platform V_min / V_max Envelope + Multi-Altitude Selector (10m to 3,000m AGL) */}
            <div className="bg-bgDeepSpace/80 p-2 rounded-lg border border-slate-800 mb-2 space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center space-x-1">
                  <span className="text-[7.5px] font-black uppercase text-slate-300">GOAL VG:</span>
                  <input
                    type="number"
                    min="5"
                    max="650"
                    value={goalGroundSpeedKmh}
                    onChange={(e) => setGoalGroundSpeedKmh(Math.max(5, Math.min(650, Number(e.target.value) || 0)))}
                    className="w-13 bg-slate-950 border border-cyan-500/50 rounded px-1 py-0.5 text-[11px] font-mono font-black text-white text-center focus:border-edgeOrange outline-none"
                  />
                  <span className="text-[7.5px] font-mono text-slate-400">
                    kph ({groundSpeedSolver.vgMs}m/s • {groundSpeedSolver.vgKts}kt)
                  </span>
                </div>

                {/* Custom Altitude Input (10m - 3000m AGL) */}
                <div className="flex items-center space-x-1">
                  <span className="text-[7.5px] font-black uppercase text-slate-400">ALT:</span>
                  <input
                    type="number"
                    min="10"
                    max="3000"
                    step="50"
                    value={calcAltitudeM}
                    onChange={(e) => setCalcAltitudeM(Math.max(10, Math.min(3000, Number(e.target.value) || 100)))}
                    className="w-13 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono font-black text-cyan-300 text-center focus:border-edgeOrange outline-none"
                    title="Enter any altitude from 10m to 3,000m AGL"
                  />
                  <span className="text-[7.5px] font-mono text-slate-400">m ({groundSpeedSolver.altFt}ft)</span>
                </div>
              </div>

              {/* Platform V_min (Stall) & V_max (Dash) Editable Envelope Strip */}
              <div className="flex items-center justify-between gap-1.5 bg-slate-950/90 px-2 py-1 rounded border border-slate-800/90 text-[7.5px] flex-wrap">
                <div className="flex items-center space-x-1">
                  <span className="text-amber-400 font-black uppercase">V_MIN (STALL):</span>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={platformMinSpeedKmh}
                    onChange={(e) => setPlatformMinSpeedKmh(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                    className="w-11 bg-slate-900 border border-amber-500/40 rounded px-1 py-0.5 font-mono font-black text-amber-300 text-center outline-none"
                    title="Platform Minimum / Stall Airspeed (IAS km/h; 0 for Rotorcraft Hover)"
                  />
                  <span className="text-slate-500 font-mono">kph</span>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-emerald-400 font-black uppercase">V_MAX (DASH):</span>
                  <input
                    type="number"
                    min="30"
                    max="700"
                    value={platformMaxSpeedKmh}
                    onChange={(e) => setPlatformMaxSpeedKmh(Math.max(30, Math.min(700, Number(e.target.value) || 76)))}
                    className="w-12 bg-slate-900 border border-emerald-500/40 rounded px-1 py-0.5 font-mono font-black text-emerald-300 text-center outline-none"
                    title="Platform Maximum / Dash Airspeed (TAS km/h)"
                  />
                  <span className="text-slate-500 font-mono">kph</span>
                </div>

                <span className="font-mono text-slate-300">
                  SAFE VG: <strong className="text-cyan-300">{groundSpeedSolver.minSafeVgKmh}–{groundSpeedSolver.maxSafeVgKmh} kph</strong>
                </span>
              </div>

              <input
                type="range"
                min={Math.max(5, Math.floor(groundSpeedSolver.minSafeVgKmh * 0.6))}
                max={Math.max(120, groundSpeedSolver.vMaxTasKmh)}
                step="1"
                value={goalGroundSpeedKmh}
                onChange={(e) => setGoalGroundSpeedKmh(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1 cursor-pointer"
              />

              {/* Expanded Quick Altitude Buttons (10m up to 2,500m AGL) + Live Wind at Altitude */}
              <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-slate-800/80 flex-wrap">
                <div className="flex items-center space-x-0.5 bg-slate-950 p-0.5 rounded border border-slate-800">
                  {[10, 100, 300, 600, 1000, 1500, 2500].map(alt => (
                    <button
                      key={alt}
                      type="button"
                      onClick={() => {
                        setCalcAltitudeM(alt);
                        if (alt > 300) setAltitudeBand('HIGH');
                        else if (alt < 300) setAltitudeBand('LOW');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-black cursor-pointer transition ${
                        calcAltitudeM === alt
                          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {alt >= 1000 ? `${alt / 1000}km` : `${alt}m`}
                    </button>
                  ))}
                </div>
                <span className="text-[7.5px] font-mono text-slate-400">
                  @{groundSpeedSolver.altM}m: <strong className="text-cyan-300">{groundSpeedSolver.windSpd} kph ({groundSpeedSolver.windDir}°)</strong> • <strong className="text-amber-300">{groundSpeedSolver.altTempC}°C</strong>
                </span>
              </div>
            </div>

            {/* 6-Parameter Computed Output Grid */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
              <div className={`bg-bgDeepSpace/70 p-1.5 rounded border ${
                groundSpeedSolver.isStallRisk || groundSpeedSolver.reqTasKmh > groundSpeedSolver.maxAirspeedKmh
                  ? 'border-stopRed/60 bg-stopRed/10'
                  : 'border-slate-800'
              }`}>
                <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">REQ. AIRSPEED (TAS)</span>
                <span className={`text-xs font-black ${
                  groundSpeedSolver.isStallRisk || groundSpeedSolver.reqTasKmh > groundSpeedSolver.maxAirspeedKmh
                    ? 'text-stopRed'
                    : groundSpeedSolver.isNearStall
                    ? 'text-amberAlert'
                    : 'text-white'
                }`}>
                  {groundSpeedSolver.reqTasKmh} km/h
                </span>
                <span className="text-[7px] text-slate-400 block">
                  IAS: {groundSpeedSolver.reqIasKmh} {groundSpeedSolver.vMinIasKmh > 0 ? `(Vmin ${groundSpeedSolver.vMinIasKmh})` : 'kph'}
                </span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">CRAB / FLY HDG</span>
                <span className="text-xs font-black text-cyan-300">
                  {groundSpeedSolver.commandHeadingDeg}°
                </span>
                <span className="text-[7px] text-amber-400 block">WCA: {groundSpeedSolver.wcaDir}</span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">THROTTLE / PITCH</span>
                <span className={`text-xs font-black ${
                  groundSpeedSolver.reqThrottlePct >= 88 ? 'text-amberAlert' : 'text-safetyGreen'
                }`}>
                  {groundSpeedSolver.reqThrottlePct}%
                </span>
                <span className="text-[7px] text-slate-400 block">Tilt: -{groundSpeedSolver.reqPitchDeg}°</span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">GUST PEAK TAS</span>
                <span className={`text-xs font-black ${
                  groundSpeedSolver.reqTasGustKmh > groundSpeedSolver.maxAirspeedKmh ? 'text-amberAlert' : 'text-slate-200'
                }`}>
                  {groundSpeedSolver.reqTasGustKmh} km/h
                </span>
                <span className="text-[7px] text-slate-400 block">
                  {groundSpeedSolver.vMinIasKmh > 0
                    ? `Envelope: ${groundSpeedSolver.vMinTasAtAltKmh}–${groundSpeedSolver.maxAirspeedKmh}`
                    : `Vmax: ${groundSpeedSolver.maxAirspeedKmh} kph`}
                </span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">5 KM LEG TIME</span>
                <span className="text-xs font-black text-white">
                  {groundSpeedSolver.legTime5kmStr}
                </span>
                <span className="text-[7px] text-cyan-300 block">Burn: ~{groundSpeedSolver.legBatteryPct}% Bat</span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[7px] font-sans font-black text-slate-400 uppercase block">RETURN LEG TAS</span>
                <span className={`text-xs font-black ${
                  groundSpeedSolver.isReturnStallRisk || groundSpeedSolver.returnTasKmh > groundSpeedSolver.maxAirspeedKmh
                    ? 'text-stopRed'
                    : 'text-amber-400'
                }`}>
                  {groundSpeedSolver.returnTasKmh} km/h
                </span>
                <span className="text-[7px] text-slate-400 block">
                  {groundSpeedSolver.isReturnStallRisk ? '⚠️ TAILWIND STALL' : `Recip. ${(runwayHeading + 180) % 360}°`}
                </span>
              </div>
            </div>
          </div>

          {/* Desert Density Altitude & Rotor Thrust Loss Card */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[9.5px] font-black uppercase tracking-wider text-white">
                  DENSITY ALTITUDE & ROTOR LIFT EFFICIENCY
                </span>
              </div>
              <span className="text-[8px] font-mono font-bold text-amber-400">
                {atmData.airDensity} kg/m³
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-bgDeepSpace/70 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[7px] font-black text-slate-400 uppercase block">DENSITY ALTITUDE</span>
                <span className="text-sm font-mono font-black text-white">
                  {atmData.densityAltitudeFt.toLocaleString()} ft
                </span>
                <span className="text-[7px] font-mono text-slate-400 block">ISA ({atmData.densityAltitudeM}m)</span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[7px] font-black text-slate-400 uppercase block">ROTOR LIFT EFF.</span>
                <span className={`text-sm font-mono font-black ${
                  aeroPerformance.liftEfficiencyPct < 90 ? 'text-amberAlert' : 'text-safetyGreen'
                }`}>
                  {aeroPerformance.liftEfficiencyPct}%
                </span>
                <span className="text-[7px] font-mono text-slate-400 block">
                  -{aeroPerformance.thrustLossPct}% Thrust Loss
                </span>
              </div>

              <div className="bg-bgDeepSpace/70 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[7px] font-black text-slate-400 uppercase block">NET ENDURANCE</span>
                <span className="text-sm font-mono font-black text-cyan-400">
                  {aeroPerformance.effectiveEnduranceMin}m
                </span>
                <span className="text-[7px] font-mono text-slate-400 block">
                  @{aeroPerformance.activePayloadKg}kg load
                </span>
              </div>
            </div>
          </div>

          {/* Combined Thermal Updraft, C2 RF Link, EO/IR FLIR & LiDAR Diagnostics Card */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between flex-grow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[9.5px] font-black uppercase tracking-wider text-white">
                  THERMAL, C2 RF LINK & EO/IR / LIDAR DIAGNOSTICS
                </span>
              </div>
              <span className={`text-[7.5px] font-black uppercase ${aeroPerformance.flirColor}`}>
                {aeroPerformance.flirStatus}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center my-auto">
              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[6.5px] font-black text-slate-400 uppercase block">THERMALS</span>
                <span className={`text-[10px] font-mono font-black ${aeroPerformance.thermalColor}`}>
                  {aeroPerformance.thermalIndex}
                </span>
              </div>
              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[6.5px] font-black text-slate-400 uppercase block">SAND SKIN</span>
                <span className="text-[10px] font-mono font-black text-amber-400">
                  {aeroPerformance.sandSurfaceTempC}°C
                </span>
              </div>
              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[6.5px] font-black text-slate-400 uppercase block">FLIR MODE</span>
                <span className="text-[10px] font-mono font-black text-purple-300">
                  {aeroPerformance.recommendedFlirPolarity}
                </span>
              </div>
              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[6.5px] font-black text-slate-400 uppercase block">LIDAR LOSS</span>
                <span className="text-[10px] font-mono font-black text-cyan-300">
                  {aeroPerformance.lidarExtinctionDbKm}dB
                </span>
              </div>
              <div className="bg-bgDeepSpace/70 p-1.5 rounded border border-slate-800">
                <span className="text-[6.5px] font-black text-slate-400 uppercase block">C2 2.4/5.8G</span>
                <span className={`text-[8.5px] font-mono font-black ${aeroPerformance.rfDuctingColor}`}>
                  {aeroPerformance.rfDuctingStatus === 'NOMINAL LOS' ? 'NOMINAL' : 'DUCTING'}
                </span>
              </div>
            </div>

            <p className="text-[7.5px] text-slate-400 mt-1 leading-snug">
              Updraft: <strong className={aeroPerformance.thermalColor}>{aeroPerformance.thermalRisk}</strong> ({Math.round(solarWm2)} W/m²). FLIR: <strong className="text-purple-300">{aeroPerformance.recommendedFlirPolarity}</strong> • C2 RF: <strong className={aeroPerformance.rfDuctingColor}>{aeroPerformance.rfDuctingStatus}</strong>.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
