import React, { useState, useEffect } from 'react';
import { 
  Sliders, Calendar, Clock, Download, Compass, Droplet, 
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Wind, 
  Sun, Activity, Eye, FileText, Target, Crosshair, HelpCircle, 
  Layers, Settings, Info, Award, Table, Copy, Check, X, Sparkles, Zap, ChevronRight, Gauge
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ReferenceLine, ReferenceArea 
} from 'recharts';
import { calculateDewPoint, calculateWBGT, evaluateSafety, getWBGTComfort, getClimaticAnomalyForYear } from '../utils/safetyEngine';
import { 
  BALLISTIC_CALIBERS, 
  calculateAtmosphericDensity, 
  calculateComprehensiveTrajectory 
} from '../utils/tacticalBallisticsEngine';

// Abu Dhabi monthly climatology guidelines (min Temp, max Temp, avg Humidity, peak UV, avg Wind, gust scale)
const climateDb = [
  { name: 'January', minT: 14, maxT: 24, avgRH: 62, uv: 5, wind: 14, gustM: 1.3 },
  { name: 'February', minT: 15, maxT: 25, avgRH: 60, uv: 6, wind: 15, gustM: 1.4 },
  { name: 'March', minT: 17, maxT: 28, avgRH: 55, uv: 8, wind: 16, gustM: 1.4 },
  { name: 'April', minT: 21, maxT: 33, avgRH: 50, uv: 10, wind: 15, gustM: 1.3 },
  { name: 'May', minT: 25, maxT: 38, avgRH: 45, uv: 11, wind: 14, gustM: 1.3 },
  { name: 'June', minT: 28, maxT: 42, avgRH: 45, uv: 12, wind: 15, gustM: 1.4 },
  { name: 'July', minT: 30, maxT: 44, avgRH: 50, uv: 12, wind: 16, gustM: 1.4 },
  { name: 'August', minT: 31, maxT: 44, avgRH: 55, uv: 12, wind: 15, gustM: 1.3 },
  { name: 'September', minT: 28, maxT: 41, avgRH: 60, uv: 10, wind: 13, gustM: 1.3 },
  { name: 'October', minT: 24, maxT: 36, avgRH: 60, uv: 8, wind: 12, gustM: 1.3 },
  { name: 'November', minT: 20, maxT: 31, avgRH: 60, uv: 6, wind: 13, gustM: 1.3 },
  { name: 'December', minT: 16, maxT: 26, avgRH: 65, uv: 5, wind: 14, gustM: 1.3 }
];

export default function CustomerPortal() {
  const [selectedYear, setSelectedYear] = useState(2026);
  // Simulator configuration states
  const [scenarioPreset, setScenarioPreset] = useState('EL_NINO'); // 'NEUTRAL', 'EL_NINO', 'LA_NINA', 'CUSTOM'
  const [tempOffset, setTempOffset] = useState(2.2); // °C
  const [rhOffset, setRhOffset] = useState(-12); // %
  const [windMultiplier, setWindMultiplier] = useState(0.85); // x
  const [dustMultiplier, setDustMultiplier] = useState(1.6); // x
  const [visOffset, setVisOffset] = useState(-3.0); // km
  
  // R&D Shift states
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(5); // June
  const [targetActivity, setTargetActivity] = useState('BALLISTICS'); // 'DRONES', 'BALLISTICS', 'LASER', 'TRAINING'
  const [shiftStart, setShiftStart] = useState(8); // 08:00
  const [shiftEnd, setShiftEnd] = useState(16); // 16:00
  const [targetDistance, setTargetDistance] = useState(500); // meters (for ballistics)
  
  // Advanced Ballistics & Range Card states
  const [selectedCaliberId, setSelectedCaliberId] = useState('338_lapua');
  const [zeroDistance, setZeroDistance] = useState(100); // 100m, 200m, 300m
  const [dragModel, setDragModel] = useState('G7'); // 'G7' or 'G1'
  const [crosswindAngle, setCrosswindAngle] = useState(90); // 90 deg full crosswind
  const [showDopeModal, setShowDopeModal] = useState(false);
  const [copiedDope, setCopiedDope] = useState(false);
  
  // Display states
  const [chartProfile, setChartProfile] = useState('THERMAL'); // 'THERMAL', 'WIND'
  
  // Automatically apply presets based on selected year
  useEffect(() => {
    const anomaly = getClimaticAnomalyForYear(selectedYear);
    setTempOffset(anomaly.tempOffset);
    setRhOffset(anomaly.rhOffset);
    setWindMultiplier(anomaly.windMultiplier);
    setDustMultiplier(anomaly.dustMultiplier);
    setVisOffset(anomaly.visOffset);
    setScenarioPreset(anomaly.type);
  }, [selectedYear]);

  // Generate 24-hour diurnal weather timeline under projection variables
  const getSimulatedTimeline = () => {
    const c = climateDb[selectedMonthIdx];
    const logs = [];
    
    // Check if seasonal midday ban is active for the simulated month
    const isMiddayBanMonth = selectedMonthIdx === 5 || selectedMonthIdx === 6 || selectedMonthIdx === 7 || selectedMonthIdx === 8; // Jun, Jul, Aug, Sep
    
    for (let hr = 0; hr < 24; hr++) {
      // 1. Diurnal temperature cycle peaking at 14:00, coolest at 05:00
      const radT = Math.PI * (hr - 14) / 12;
      const baseTemp = c.minT + (c.maxT - c.minT) * (0.5 + 0.5 * Math.cos(radT));
      const temp = Math.max(5, Number((baseTemp + tempOffset).toFixed(1)));
      
      // 2. Humidity is inversely proportional to Temperature
      const radH = Math.PI * (hr - 5) / 12;
      const baseRh = c.avgRH + 15 * Math.cos(radH);
      const rh = Math.max(5, Math.min(100, Math.round(baseRh + rhOffset)));
      
      // 3. Wind peaks in late afternoon (sea breeze effect)
      const radW = Math.PI * (hr - 16) / 12;
      const baseWind = c.wind + 5 * Math.cos(radW);
      const wind = Math.max(0, Number((baseWind * windMultiplier).toFixed(1)));
      const gusts = Math.max(0, Number((wind * c.gustM).toFixed(1)));
      
      // 4. UV peaks at 12:00
      let uv = 0;
      if (hr >= 6 && hr <= 18) {
        uv = Math.round(c.uv * Math.sin(Math.PI * (hr - 6) / 12));
      }
      
      // 5. Visibility (base visibility adjusted by offsets and wind-blown dust)
      let baseVis = wind > 25 ? 6000 : 12000;
      let visibility = Math.max(100, Math.round(baseVis + visOffset * 1000 - (dustMultiplier - 1.0) * 1500));
      
      // 6. PM10 Dust density
      const pm10 = Math.max(5, Math.round(45 * dustMultiplier + (wind > 20 ? (wind - 20) * 4 : 0)));
      const aqi = Math.min(500, Math.round(pm10 * 1.1));
      
      const dp = calculateDewPoint(temp, rh);
      const wbgt = calculateWBGT(temp, rh, wind, uv);
      
      // 7. Midday ban active hours: 12:30 to 15:00. 
      // For hourly blocks: 13:00 (13) and 14:00 (14) are fully banned. 12:00 (12) has a partial ban overlapping 12:30.
      let isMiddayBanActive = false;
      if (isMiddayBanMonth && (hr === 13 || hr === 14)) {
        isMiddayBanActive = true;
      }
      
      const readings = {
        temperature_2m: temp,
        apparent_temperature: temp + 2, // approximation
        relative_humidity_2m: rh,
        wind_speed_10m: wind,
        wind_gusts_10m: gusts,
        visibility,
        uv_index: uv,
        pm10,
        european_aqi: aqi,
        weathercode: 0 // clear baseline
      };
      
      const safetyEval = evaluateSafety(readings);
      
      logs.push({
        hour: hr,
        hourLabel: `${hr.toString().padStart(2, '0')}:00`,
        temp,
        rh,
        dewPoint: dp,
        wbgt,
        wind,
        gusts,
        uv,
        visibility: visibility / 1000, // in km
        pm10,
        aqi,
        safetyStatus: safetyEval.status,
        safetyReasons: safetyEval.reasons,
        isMiddayBanActive,
        isWithinShift: hr >= shiftStart && hr <= shiftEnd
      });
    }
    
    return logs;
  };

  const simTimeline = getSimulatedTimeline();
  const shiftLogs = simTimeline.filter(log => log.isWithinShift);

  // Environmental shift averages for ballistic & atmospheric calculations
  const avgTemp = shiftLogs.length > 0 ? (shiftLogs.reduce((acc, l) => acc + l.temp, 0) / shiftLogs.length) : 38;
  const avgRh = shiftLogs.length > 0 ? (shiftLogs.reduce((acc, l) => acc + l.rh, 0) / shiftLogs.length) : 35;
  const avgWind = shiftLogs.length > 0 ? (shiftLogs.reduce((acc, l) => acc + l.wind, 0) / shiftLogs.length) : 16;

  // Atmospheric density & density altitude for Abu Al Abyad Island
  const atmData = calculateAtmosphericDensity({
    temperatureC: avgTemp,
    relativeHumidity: avgRh,
    stationPressureHpa: 1011.5,
    altitudeM: 5
  });

  // Comprehensive trajectory & DOPE calculation
  const trajectoryResult = calculateComprehensiveTrajectory({
    distanceM: targetDistance,
    caliberId: selectedCaliberId,
    temperatureC: avgTemp,
    relativeHumidity: avgRh,
    stationPressureHpa: 1011.5,
    zeroDistanceM: zeroDistance,
    crosswindKmh: avgWind,
    crosswindAngleDeg: crosswindAngle,
    dragModel: dragModel,
    sightHeightCm: 4.5
  });

  const targetSolution = trajectoryResult.targetSolution;
  const activeCaliber = trajectoryResult.caliber;
  const dopeTable = trajectoryResult.cardTable;
  const bulletDrift = targetSolution.driftCm;

  // Compute aggregated stats during the custom shift
  const getShiftStats = () => {
    if (shiftLogs.length === 0) return null;
    
    let maxTemp = -999;
    let maxWbgt = -999;
    let maxWind = 0;
    let maxGust = 0;
    let minVis = 999;
    let maxAqi = 0;
    let greenHours = 0;
    let amberHours = 0;
    let redHours = 0;
    let banOverlaps = false;
    
    shiftLogs.forEach(log => {
      if (log.temp > maxTemp) maxTemp = log.temp;
      if (log.wbgt > maxWbgt) maxWbgt = log.wbgt;
      if (log.wind > maxWind) maxWind = log.wind;
      if (log.gusts > maxGust) maxGust = log.gusts;
      if (log.visibility < minVis) minVis = log.visibility;
      if (log.aqi > maxAqi) maxAqi = log.aqi;
      
      if (log.isMiddayBanActive) banOverlaps = true;
      
      if (log.safetyStatus === 'RED' || log.isMiddayBanActive) redHours++;
      else if (log.safetyStatus === 'AMBER') amberHours++;
      else greenHours++;
    });

    const totalHours = shiftLogs.length;
    const successRatio = totalHours > 0 ? ((greenHours + amberHours * 0.5) / totalHours) * 100 : 0;
    
    return {
      maxTemp,
      maxWbgt,
      maxWind,
      maxGust,
      minVis,
      maxAqi,
      greenHours,
      amberHours,
      redHours,
      banOverlaps,
      successRatio: Math.round(successRatio)
    };
  };

  const stats = getShiftStats();

  // R&D Diagnostics based on selected activity
  const getRDDiagnostics = () => {
    if (!stats || shiftLogs.length === 0) return null;
    
    let rating = 'OPTIMAL';
    let ratingColor = 'text-safetyGreen border-safetyGreen/20 bg-safetyGreen/5';
    let remarks = '';
    let metricValue = '';
    let metricLabel = '';
    
    if (targetActivity === 'DRONES') {
      metricLabel = 'PROJ. CRITICAL WIND HOURS';
      const criticalHours = shiftLogs.filter(l => l.wind >= 25 || l.gusts >= 35).length;
      metricValue = `${criticalHours}h / ${shiftLogs.length}h`;
      
      if (stats.maxGust >= 50 || stats.maxWind >= 38 || stats.minVis < 1.0) {
        rating = 'SUSPENDED';
        ratingColor = 'text-stopRed border-stopRed/20 bg-stopRed/5';
        remarks = 'High wind alerts or extreme visibility drop will suspend all drone sorties on the range.';
      } else if (stats.maxWind >= 25 || stats.maxGust >= 35 || stats.minVis < 3.0) {
        rating = 'HIGH RISK / DRIFT';
        ratingColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';
        remarks = 'Elevated wind shear and drift risks. Battery discharge rates will be 25-40% higher.';
      } else {
        rating = 'GO / CLEAR';
        remarks = 'Favorable aerodynamic conditions. Calm winds permit precise telemetry flight sorties.';
      }
      
    } else if (targetActivity === 'BALLISTICS') {
      metricLabel = 'CROSSWIND DEFLECTION';
      metricValue = `${Math.abs(targetSolution.driftCm).toFixed(1)} cm (${targetSolution.windMil} MIL)`;
      
      if (stats.maxGust >= 50 || stats.maxWind >= 38) {
        rating = 'SUSPENDED';
        ratingColor = 'text-stopRed border-stopRed/20 bg-stopRed/5';
        remarks = `Wind shear & peak gusts (${stats.maxGust} km/h) exceed safety envelopes. High risk of off-target dispersion.`;
      } else if (targetSolution.flightRegime.startsWith('Subsonic')) {
        rating = 'UNSTABLE / SUBSONIC';
        ratingColor = 'text-stopRed border-stopRed/20 bg-stopRed/5';
        remarks = `Projectile transitions subsonic (${targetSolution.velocityMps} m/s) before target distance (${targetDistance}m). Severe aerodynamic tumble & dispersal.`;
      } else if (targetSolution.flightRegime.startsWith('Transonic')) {
        rating = 'TRANSONIC BUFFET';
        ratingColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';
        remarks = `Transonic boundary crossed (${targetSolution.mach} Mach). Yaw angle dispersion elevated; compensation required.`;
      } else if (avgWind >= 20 || stats.maxGust >= 35) {
        rating = 'AMBER / COMPENSATE';
        ratingColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';
        remarks = `Crosswind requires ${targetSolution.windClicks01Mil} clicks windage trim (${targetSolution.windMoa} MOA). Density altitude: ${atmData.densityAltitudeFt.toLocaleString()} ft.`;
      } else {
        rating = 'CLEAR / MATCH GRADE';
        remarks = `Optimal ballistics window. Retained velocity ${targetSolution.velocityMps} m/s (${targetSolution.mach}M), ${targetSolution.energyJ.toLocaleString()}J energy.`;
      }
      
    } else if (targetActivity === 'LASER') {
      // Attenuation model (dB/km) = Dust component + Moisture scattering
      const avgAqi = shiftLogs.reduce((acc, l) => acc + l.aqi, 0) / shiftLogs.length;
      const attenuation = Number((1.2 * (avgAqi / 50) + (10 / stats.minVis)).toFixed(2));
      metricLabel = 'SIGNAL LOSS';
      metricValue = `${attenuation} dB/km`;
      
      if (stats.minVis < 1.0 || stats.maxAqi >= 250) {
        rating = 'SEVERE SCATTERING';
        ratingColor = 'text-stopRed border-stopRed/20 bg-stopRed/5';
        remarks = 'Extreme dust suspension or fog scattering will cause complete laser link outage.';
      } else if (stats.minVis < 5.0 || stats.maxAqi >= 100) {
        rating = 'DEGRADED';
        ratingColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';
        remarks = 'Light dust/haze is scattering optical paths. Expect reduced targeting accuracy.';
      } else {
        rating = 'OPTIMAL TRANSMISSION';
        remarks = 'Excellent visibility. Clean atmosphere permits stable laser range telemetry testing.';
      }
      
    } else if (targetActivity === 'TRAINING') {
      metricLabel = 'PEAK THERMAL WBGT';
      metricValue = `${stats.maxWbgt.toFixed(1)}°C`;
      
      if (stats.maxWbgt >= 30.0 || stats.maxTemp >= 43.0) {
        rating = 'MANDATORY HALT';
        ratingColor = 'text-stopRed border-stopRed/20 bg-stopRed/5 animate-pulse';
        remarks = 'Extreme heat stress. Outdoor training banned. Move activities to indoor simulators.';
      } else if (stats.maxWbgt >= 27.9 || stats.maxTemp >= 38.0) {
        rating = 'RESTRICTED / BREAKS';
        ratingColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';
        remarks = 'Enforce 40m work / 20m rest splits. Mandatory buddy system and electrolyte supply.';
      } else {
        rating = 'GO / UNRESTRICTED';
        remarks = 'Comfortable thermal load. Standard training and fitness activities approved.';
      }
    }
    
    return {
      rating,
      ratingColor,
      remarks,
      metricLabel,
      metricValue
    };
  };

  const rdDiagnostics = getRDDiagnostics();

  // Copy DOPE Table to clipboard
  const handleCopyDope = () => {
    let text = `======================================================================\n`;
    text += `       X-RANGE TACTICAL BALLISTICS DOPE CARD - ${activeCaliber.name.toUpperCase()}\n`;
    text += `======================================================================\n`;
    text += `AMMUNITION:    ${activeCaliber.bulletWeightGrains}gr | Muzzle Vel: ${activeCaliber.muzzleVelocityMps} m/s\n`;
    text += `ZERO RANGE:    ${zeroDistance}m | Drag Model: ${dragModel} (Effective BC: ${trajectoryResult.effectiveBC})\n`;
    text += `AIR DENSITY:   ${atmData.airDensity} kg/m3 (${atmData.airDensityDeltaPct}% vs Std) | DA: ${atmData.densityAltitudeFt.toLocaleString()} ft\n`;
    text += `CROSSWIND:     ${avgWind.toFixed(1)} km/h @ ${crosswindAngle}° (Full Value)\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `Range(m)\tDrop(cm)\tElev(MIL)\tElev(MOA)\tClicks(0.1M)\tDrift(cm)\tWind(MIL)\tVel(m/s)\tMach\tEnergy(J)\tToF(s)\n`;
    dopeTable.forEach(row => {
      text += `${row.rangeM}\t${row.dropCm}\t${row.elevMil}\t${row.elevMoa}\t${row.elevClicks01Mil}\t${row.driftCm}\t${row.windMil}\t${row.velocityMps}\t${row.mach}\t${row.energyJ}\t${row.timeOfFlightSec}\n`;
    });
    navigator.clipboard.writeText(text);
    setCopiedDope(true);
    setTimeout(() => setCopiedDope(false), 2000);
  };

  // Export DOPE Range Card as dedicated CSV
  const handleExportDopeCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `Range (m),Drop (cm),Elev (MIL),Elev (MOA),Elev Clicks (0.1 MIL),Drift (cm),Wind (MIL),Wind (MOA),Wind Clicks (0.1 MIL),Velocity (m/s),Mach,Energy (J),ToF (s),Flight Regime\r\n`;
    dopeTable.forEach(row => {
      csvContent += `${row.rangeM},${row.dropCm},${row.elevMil},${row.elevMoa},${row.elevClicks01Mil},${row.driftCm},${row.windMil},${row.windMoa},${row.windClicks01Mil},${row.velocityMps},${row.mach},${row.energyJ},${row.timeOfFlightSec},${row.flightRegime}\r\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `XRANGE_DOPE_${activeCaliber.id}_${targetDistance}m.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export report to txt format
  const handleExportTextReport = () => {
    const c = climateDb[selectedMonthIdx];
    
    // Hydration calculation: 0.5L/hr base, increases in heat
    let hydrationPerHour = 0.5;
    if (stats.maxWbgt >= 30.0) hydrationPerHour = 1.25;
    else if (stats.maxWbgt >= 27.9) hydrationPerHour = 1.0;
    else if (stats.maxWbgt >= 25.9) hydrationPerHour = 0.75;
    
    const totalWaterPerPerson = hydrationPerHour * shiftLogs.length;

    let targetReport = '';
    if (targetActivity === 'BALLISTICS') {
      targetReport = `* Ballistics Caliber:          ${activeCaliber.name} (${activeCaliber.bulletWeightGrains}gr / V0: ${activeCaliber.muzzleVelocityMps}m/s)
* Drag Function / BC:          ${dragModel} (Effective BC: ${trajectoryResult.effectiveBC})
* Zero Distance:               ${zeroDistance} meters
* Target Calibration Range:    ${targetDistance} meters
* Air Density:                 ${atmData.airDensity} kg/m3 (${atmData.airDensityDeltaPct}% vs ICAO Std)
* Density Altitude:            ${atmData.densityAltitudeFt.toLocaleString()} ft (${atmData.densityAltitudeM.toLocaleString()} m)
* Retained Velocity:           ${targetSolution.velocityMps} m/s (Mach ${targetSolution.mach} - ${targetSolution.flightRegime})
* Kinetic Energy at Target:    ${targetSolution.energyJ.toLocaleString()} Joules
* Time of Flight:              ${targetSolution.timeOfFlightSec} seconds
* Bullet Drop:                 ${targetSolution.dropCm} cm
* Elevation Holdover:          +${targetSolution.elevMil} MIL / +${targetSolution.elevMoa} MOA (${targetSolution.elevClicks01Mil} clicks UP)
* Crosswind Deflection:        ${Math.abs(targetSolution.driftCm).toFixed(1)} cm (${targetSolution.driftCm >= 0 ? 'Right' : 'Left'})
* Windage Correction:          ${targetSolution.windMil} MIL / ${targetSolution.windMoa} MOA (${targetSolution.windClicks01Mil} clicks)
* Firing Decision:             ${rdDiagnostics.rating}`;
    } else if (targetActivity === 'DRONES') {
      targetReport = `* Drone Flight Rating:        ${rdDiagnostics.rating}
* Wind Gust Peak:             ${stats.maxGust} km/h
* Aero flight window:         ${stats.maxGust < 35 ? "Optimal" : "High Drift Risk - Flights Restricted"}`;
    } else if (targetActivity === 'LASER') {
      targetReport = `* Optical Loss Index:         ${rdDiagnostics.metricValue}
* Minimum Shift Visibility:   ${stats.minVis} km
* Transmissivity rating:       ${rdDiagnostics.rating}`;
    } else {
      targetReport = `* Training Heat Code:         ${rdDiagnostics.rating}
* Mandated Work/Rest Ratio:   ${stats.maxWbgt >= 30.0 ? "30m Work / 30m Rest" : stats.maxWbgt >= 27.9 ? "40m Work / 20m Rest" : "Continuous"}
* Projected Person Hydration: ${totalWaterPerPerson.toFixed(2)} Liters / Day`;
    }

    const reportText = `======================================================================
               X-RANGE R&D CLIMATE ANOMALY IMPACT REPORT
            CUSTOMER PORTAL - ENVIRONMENTAL PROJECTION UTILITY
======================================================================
GENERATION TIMESTAMP:  ${new Date().toLocaleString('en-US')} GST
BASELINE MONTH:        ${c.name} Climatology
PROJECTED SCENARIO:    ${scenarioPreset === 'EL_NINO' ? 'EL NIÑO ANOMALY (WARMER/DRIER)' : scenarioPreset === 'LA_NINA' ? 'LA NIÑA ANOMALY (COOLER/WETTER)' : scenarioPreset === 'NEUTRAL' ? 'NEUTRAL BASELINE' : 'CUSTOM CLIMATE SHIFT'}
R&D ACTIVITY TYPE:     ${targetActivity}
PROJECTED SHIFT RANGE: ${shiftStart.toString().padStart(2, '0')}:00 - ${shiftEnd.toString().padStart(2, '0')}:00 GST

----------------------------------------------------------------------
1. CLIMATE SIMULATION VARIABLES
----------------------------------------------------------------------
* Temperature Offset:  ${tempOffset >= 0 ? '+' : ''}${tempOffset.toFixed(1)}°C
* Humidity Offset:     ${rhOffset >= 0 ? '+' : ''}${rhOffset}%
* Wind Speed Factor:   ${windMultiplier.toFixed(2)}x
* Dust (PM10) Factor:  ${dustMultiplier.toFixed(2)}x
* Visibility Offset:   ${visOffset >= 0 ? '+' : ''}${visOffset.toFixed(1)} km

----------------------------------------------------------------------
2. SIMULATED DIURNAL EXTREMES (SHIFT HOURS)
----------------------------------------------------------------------
* Max Shade Temperature:  ${stats.maxTemp.toFixed(1)}°C  (Baseline Avg: ${c.maxT}°C)
* Max Wet Bulb Globe T:   ${stats.maxWbgt.toFixed(1)}°C
* Average Wind Speed:     ${avgWind.toFixed(1)} km/h
* Peak Wind Gusts:        ${stats.maxGust.toFixed(1)} km/h
* Minimum Visibility:     ${stats.minVis.toFixed(1)} km
* Peak AQI Index:         ${stats.maxAqi} AQI

----------------------------------------------------------------------
3. ACTIVITY-SPECIFIC R&D COMPLIANCE ASSESSMENT
----------------------------------------------------------------------
R&D CLEARANCE STATUS:  ${rdDiagnostics.rating}
${targetReport}

Guidance Remarks:
  "${rdDiagnostics.remarks}"

----------------------------------------------------------------------
4. REGULATORY COMPLIANCE & SAFETY AUDIT
----------------------------------------------------------------------
* MoHRE Midday Work Ban:   ${stats.banOverlaps ? "WARNING: SHIFT OVERLAPS MANDATORY MOHRE BAN (12:30-15:00)" : "COMPLIANT / NO SEASONAL MIDDAY BAN OVERLAP"}
* ADOSH-SF Heat Stress:   ${stats.maxWbgt >= 30.0 ? "RED ALERT: Suspend outdoor training/work." : stats.maxWbgt >= 27.9 ? "AMBER ADVISORY: Strict hydration monitoring." : "GREEN: Safe levels."}
* Hydration Rate Per Person: ${hydrationPerHour.toFixed(2)} L/hr
* Projected Total Water:     ${totalWaterPerPerson.toFixed(2)} Liters / shift

${targetActivity === 'BALLISTICS' ? `----------------------------------------------------------------------
5. RANGE CARD / DOPE TABLE (${activeCaliber.name.toUpperCase()})
----------------------------------------------------------------------
Range(m)  Drop(cm)   Elev(MIL)  Elev(MOA)  Clicks  Drift(cm)  Wind(MIL)  Vel(m/s)   Mach   Energy(J)  ToF(s)
${dopeTable.map(r => `${r.rangeM.toString().padEnd(8)}  ${r.dropCm.toString().padEnd(9)}  ${r.elevMil.toString().padEnd(9)}  ${r.elevMoa.toString().padEnd(9)}  ${r.elevClicks01Mil.toString().padEnd(6)}  ${r.driftCm.toString().padEnd(9)}  ${r.windMil.toString().padEnd(9)}  ${r.velocityMps.toString().padEnd(9)}  ${r.mach.toString().padEnd(5)}  ${r.energyJ.toString().padEnd(9)}  ${r.timeOfFlightSec}`).join('\n')}
` : ''}
======================================================================
This report is generated for X-Range customers to project and design range
trials under projected atmospheric abnormalities. For operational live fires,
verify local telemetry feeds before final range officer approval.
======================================================================
                        END OF BRIEFING`;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `XRANGE_R&D_Climate_Brief_${c.name}_${scenarioPreset}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CSV Log of custom timeline
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Hour,Temperature (C),Humidity (%),Dew Point (C),WBGT (C),Wind Speed (kmh),Wind Gusts (kmh),Visibility (km),PM10 (ug/m3),AQI,Safety Status,Midday Ban,Within Shift\r\n';

    simTimeline.forEach((log) => {
      csvContent += `${log.hourLabel},${log.temp.toFixed(1)},${log.rh},${log.dewPoint.toFixed(1)},${log.wbgt.toFixed(1)},${log.wind.toFixed(1)},${log.gusts.toFixed(1)},${log.visibility.toFixed(1)},${log.pm10},${log.aqi},${log.safetyStatus},${log.isMiddayBanActive ? 'YES' : 'NO'},${log.isWithinShift ? 'YES' : 'NO'}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `XRANGE_Custom_Projection_${climateDb[selectedMonthIdx].name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 text-textIceWhite overflow-y-auto lg:overflow-hidden select-none px-4 py-3">
      {/* Top Banner Control Header */}
      <div className="bg-cardDarkSlate border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-edgeOrange" />
            <h1 className="text-lg font-black tracking-widest text-slate-100">R&D ANOMALY SIMULATOR & PORTAL</h1>
          </div>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase">
            Customer Planning Interface • Project Climatic Extremes & Assess Range Training / Ballistics R&D Feasibility
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportTextReport}
            className="bg-edgeOrange hover:bg-orange-600 border border-orange-700 hover:border-orange-500 transition-all duration-300 px-3.5 py-1.5 text-[10px] font-black uppercase flex items-center space-x-2 text-white cursor-pointer shadow-md shadow-edgeOrange/15"
            title="Download full text R&D briefing report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>DOWNLOAD R&D REPORT</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            className="bg-bgDeepSpace/65 border border-slate-700/60 hover:border-slate-500 hover:text-white transition-all duration-300 px-3.5 py-1.5 text-[10px] font-black uppercase flex items-center space-x-2 text-slate-300 cursor-pointer"
            title="Export 24h simulated metrics log to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV DATA</span>
          </button>
        </div>
      </div>

      {/* Main Grid Simulator */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden min-h-0">
        
        {/* Left Control Column (Sliders & Settings) - 4 Cols */}
        <div className="lg:col-span-4 flex flex-col space-y-4 overflow-y-auto pr-1 no-scrollbar shrink-0">
          
          {/* Projected Anomaly Advisor Card */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-3">
            <div className="flex items-center space-x-2 text-slate-300">
              <Layers className="w-4 h-4 text-edgeOrange" />
              <span className="text-[10.5px] font-black uppercase tracking-wider">PROJECTED YEARLY CLIMATE ANOMALY</span>
            </div>

            <div className={`p-3 border flex flex-col space-y-1.5 ${
              scenarioPreset === 'EL_NINO' 
                ? 'border-edgeOrange/40 bg-amberAlert/5 text-orange-250' 
                : scenarioPreset === 'LA_NINA' 
                  ? 'border-cyan-500/40 bg-cyan-950/5 text-cyan-250' 
                  : 'border-safetyGreen/40 bg-safetyGreen/5 text-emerald-250'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase">
                  {scenarioPreset === 'EL_NINO' ? '🔥 EL NIÑO ACTIVE' : scenarioPreset === 'LA_NINA' ? '🌊 LA NIÑA ACTIVE' : '🟢 NEUTRAL BASELINE'}
                </span>
                <span className="text-[9px] font-bold font-mono text-white bg-bgDeepSpace px-1.5 border border-slate-800">{selectedYear}</span>
              </div>
              
              <p className="text-[9.5px] leading-relaxed text-slate-400">
                {scenarioPreset === 'EL_NINO' && '💡 Regional models project warmer, drier weather averages (+2.2°C temperature shift, -12% RH offset, 0.85x wind multiplier, 1.6x suspended dust PM10).'}
                {scenarioPreset === 'LA_NINA' && '💡 Regional models project cooler, wetter, and windier weather averages (-1.5°C temperature shift, +15% RH offset, 1.25x wind multiplier, 0.75x PM10).'}
                {scenarioPreset === 'NEUTRAL' && '💡 No severe global climate abnormalities projected. Baseline historical averages will apply.'}
              </p>
            </div>
          </div>
 
          {/* Sliders Panel */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-slate-350">
              <span className="text-[10px] font-black uppercase tracking-wider">PROJECTED ANOMALY SETTINGS</span>
              <span className="text-[8px] text-slate-500 font-extrabold uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded leading-none select-none">LOCKED TO YEAR PROJECTION</span>
            </div>
 
            {/* Slider 1: Temp offset */}
            <div className="flex flex-col space-y-1.5 opacity-60">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Shade Temperature Offset</span>
                <span className="font-mono text-white text-xs font-black">
                  {tempOffset >= 0 ? '+' : ''}{tempOffset.toFixed(1)} °C
                </span>
              </div>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={tempOffset}
                disabled={true}
                className="w-full accent-slate-500 h-1 bg-bgDeepSpace cursor-not-allowed border-none outline-none"
              />
              <div className="flex justify-between text-[8px] text-slate-500">
                <span>Cooler (-5°C)</span>
                <span>Warmer (+5°C)</span>
              </div>
            </div>
 
            {/* Slider 2: RH offset */}
            <div className="flex flex-col space-y-1.5 opacity-60">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Relative Humidity Offset</span>
                <span className="font-mono text-white text-xs font-black">
                  {rhOffset >= 0 ? '+' : ''}{rhOffset}%
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={rhOffset}
                disabled={true}
                className="w-full accent-slate-500 h-1 bg-bgDeepSpace cursor-not-allowed border-none outline-none"
              />
              <div className="flex justify-between text-[8px] text-slate-500">
                <span>Dryer (-30%)</span>
                <span>Humid (+30%)</span>
              </div>
            </div>
 
            {/* Slider 3: Wind Multiplier */}
            <div className="flex flex-col space-y-1.5 opacity-60">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Wind Velocity Multiplier</span>
                <span className="font-mono text-white text-xs font-black">
                  {windMultiplier.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={windMultiplier}
                disabled={true}
                className="w-full accent-slate-500 h-1 bg-bgDeepSpace cursor-not-allowed border-none outline-none"
              />
              <div className="flex justify-between text-[8px] text-slate-500">
                <span>Calm (0.5x)</span>
                <span>Gales (2.0x)</span>
              </div>
            </div>
 
            {/* Slider 4: Dust Multiplier */}
            <div className="flex flex-col space-y-1.5 opacity-60">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Suspended Dust / PM10 Factor</span>
                <span className="font-mono text-white text-xs font-black">
                  {dustMultiplier.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={dustMultiplier}
                disabled={true}
                className="w-full accent-slate-500 h-1 bg-bgDeepSpace cursor-not-allowed border-none outline-none"
              />
              <div className="flex justify-between text-[8px] text-slate-500">
                <span>Clear (1.0x)</span>
                <span>Sandstorm (3.0x)</span>
              </div>
            </div>
 
            {/* Slider 5: Vis Offset */}
            <div className="flex flex-col space-y-1.5 opacity-60">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400 uppercase">Baseline Visibility Offset</span>
                <span className="font-mono text-white text-xs font-black">
                  {visOffset >= 0 ? '+' : ''}{visOffset.toFixed(1)} km
                </span>
              </div>
              <input
                type="range"
                min="-10"
                max="5"
                step="0.5"
                value={visOffset}
                disabled={true}
                className="w-full accent-slate-500 h-1 bg-bgDeepSpace cursor-not-allowed border-none outline-none"
              />
              <div className="flex justify-between text-[8px] text-slate-500">
                <span>Fog/Haze (-10km)</span>
                <span>Super-Clear (+5km)</span>
              </div>
            </div>
          </div>

          {/* R&D Target Shift Settings */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-4">
            <div className="flex items-center space-x-2 text-slate-300 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-edgeOrange" />
              <span className="text-[10px] font-black uppercase tracking-wider">R&D SIMULATOR TARGETS</span>
            </div>

            {/* Target Year Selector */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[9.5px] font-black text-slate-400 uppercase">TARGET PROJECTED YEAR:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-bgDeepSpace text-white border border-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none w-full"
              >
                {Array.from({ length: 11 }).map((_, i) => {
                  const y = 2020 + i;
                  const anomaly = getClimaticAnomalyForYear(y);
                  let labelSuffix = '';
                  if (anomaly.type === 'EL_NINO') labelSuffix = ' (El Niño)';
                  else if (anomaly.type === 'LA_NINA') labelSuffix = ' (La Niña)';
                  return (
                    <option key={y} value={y}>{y}{labelSuffix}</option>
                  );
                })}
              </select>
            </div>

            {/* Activity selector */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[9.5px] font-black text-slate-400 uppercase">ACTIVITY UNDER ANALYSIS:</span>
              <select
                value={targetActivity}
                onChange={(e) => setTargetActivity(e.target.value)}
                className="bg-bgDeepSpace text-white border border-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none w-full"
              >
                <option value="BALLISTICS">🎯 Precision Ballistics Live Fire</option>
                <option value="DRONES">🛸 Drone Aerodynamic Sorties</option>
                <option value="LASER">⚡ Laser & Optical Targeting</option>
                <option value="TRAINING">🛡️ Personnel Physical Drills</option>
              </select>
            </div>

            {/* Month selector */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[9.5px] font-black text-slate-400 uppercase">BASELINE CLIMATE MONTH:</span>
              <select
                value={selectedMonthIdx}
                onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value))}
                className="bg-bgDeepSpace text-white border border-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none w-full"
              >
                {climateDb.map((m, idx) => (
                  <option key={idx} value={idx}>{m.name} Climatology</option>
                ))}
              </select>
            </div>

            {/* Shift Hour Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1.5">
                <span className="text-[9.5px] font-black text-slate-400 uppercase">SHIFT START GST:</span>
                <select
                  value={shiftStart}
                  onChange={(e) => setShiftStart(parseInt(e.target.value))}
                  className="bg-bgDeepSpace text-white border border-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none w-full"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00 GST</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <span className="text-[9.5px] font-black text-slate-400 uppercase">SHIFT END GST:</span>
                <select
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(parseInt(e.target.value))}
                  className="bg-bgDeepSpace text-white border border-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none w-full"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00 GST</option>
                  ))}
                </select>
              </div>
            </div>
            {shiftStart >= shiftEnd && (
              <span className="text-[9px] text-stopRed font-bold uppercase animate-pulse">
                ⚠️ Error: Shift end hour must exceed start hour.
              </span>
            )}
          </div>
        </div>

        {/* Center Section: Charts & Timelines - 5 Cols */}
        <div className="lg:col-span-5 flex flex-col space-y-4 min-h-0">
          
          {/* Diurnal Clearance Timeline Block */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-3 shrink-0">
            <div className="flex justify-between items-center text-slate-350">
              <span className="text-[10px] font-black uppercase tracking-wider">DIURNAL CLEARANCE SCHEDULE (24-HOURS)</span>
              <span className="text-[9.5px] font-bold font-mono text-edgeOrange">SHIFT: {shiftStart.toString().padStart(2, '0')}:00 - {shiftEnd.toString().padStart(2, '0')}:00 GST</span>
            </div>

            {/* 24h Blocks */}
            <div className="flex flex-col space-y-2">
              <div className="flex w-full items-stretch h-8 border border-slate-900 bg-bgDeepSpace">
                {simTimeline.map((log) => {
                  let colorClass = 'bg-safetyGreen';
                  if (log.isMiddayBanActive) colorClass = 'bg-stopRed animate-pulse-ring';
                  else if (log.safetyStatus === 'RED') colorClass = 'bg-stopRed';
                  else if (log.safetyStatus === 'AMBER') colorClass = 'bg-amber-650';
                  
                  const isBorder = log.hour === shiftStart || log.hour === shiftEnd;

                  return (
                    <div
                      key={log.hour}
                      className={`flex-1 relative cursor-help group ${colorClass} ${
                        log.isWithinShift ? 'opacity-100' : 'opacity-30'
                      } ${isBorder ? 'border-x-2 border-white' : ''}`}
                    >
                      {/* Hover Tooltip card */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-slate-700 p-2.5 z-50 pointer-events-none hidden group-hover:block text-left text-[9.5px] shadow-2xl">
                        <p className="font-mono font-black text-white">{log.hourLabel} GST {log.isWithinShift ? '(SHIFT)' : ''}</p>
                        <p className="border-t border-slate-800 my-1 pt-0.5">Status: <span className="font-black text-slate-200">{log.isMiddayBanActive ? '🚨 MOHRE MIDDAY BAN' : log.safetyStatus}</span></p>
                        <p>Sim Temp: <span className="font-mono text-slate-300 font-bold">{log.temp}°C</span></p>
                        <p>Sim WBGT: <span className="font-mono text-slate-300 font-bold">{log.wbgt.toFixed(1)}°C</span></p>
                        <p>Wind/Gust: <span className="font-mono text-slate-300 font-bold">{log.wind} ({log.gusts}) km/h</span></p>
                        <p>Visibility: <span className="font-mono text-slate-300 font-bold">{log.visibility} km</span></p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hour labels */}
              <div className="flex w-full justify-between text-[8px] text-slate-500 font-mono font-bold">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>23:59</span>
              </div>
            </div>

            {/* Legend indicators */}
            <div className="flex items-center space-x-4 text-[9px] font-bold text-slate-400 flex-wrap gap-y-1">
              <div className="flex items-center space-x-1">
                <div className="w-2.5 h-2.5 bg-safetyGreen"></div>
                <span>GO (Green)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2.5 h-2.5 bg-amber-650"></div>
                <span>CAUTION (Amber)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2.5 h-2.5 bg-stopRed"></div>
                <span>HALT (Red)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2.5 h-2.5 bg-stopRed animate-pulse"></div>
                <span>MoHRE MIDDAY BAN</span>
              </div>
            </div>
          </div>

          {/* Recharts Curve Profile Area */}
          <div className="flex-grow bg-cardDarkSlate p-4 border border-slate-800 flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-350">
                PROJECTED DIURNAL ATMOSPHERIC PROFILE
              </span>
              <div className="flex items-center border border-slate-800 bg-bgDeepSpace/40 p-0.5">
                <button
                  onClick={() => setChartProfile('THERMAL')}
                  className={`px-2 py-1 text-[8.5px] font-black uppercase transition cursor-pointer ${
                    chartProfile === 'THERMAL' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ☀️ Thermal load
                </button>
                <button
                  onClick={() => setChartProfile('WIND')}
                  className={`px-2 py-1 text-[8.5px] font-black uppercase transition cursor-pointer ${
                    chartProfile === 'WIND' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  💨 Wind & UV
                </button>
              </div>
            </div>

            {/* Recharts */}
            <div className="flex-grow min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simTimeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="simTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4E02" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FF4E02" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="simWbgt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="simWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="hourLabel" stroke="#4B5563" fontSize={9} tickLine={false} />
                  
                  {chartProfile === 'THERMAL' ? (
                    <>
                      <YAxis domain={[10, 50]} stroke="#4B5563" fontSize={9} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#121418', borderColor: '#374151', fontSize: 11 }} />
                      <ReferenceArea y1={30.0} y2={50} fill="#EF4444" fillOpacity={0.03} />
                      <ReferenceLine y={30.0} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'ADOSH HALT 30.0°C', fill: '#EF4444', fontSize: 8, position: 'insideRight' }} />
                      <ReferenceLine y={27.9} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'CAUTION 27.9°C', fill: '#D97706', fontSize: 8, position: 'insideRight' }} />
                      <Area type="monotone" dataKey="temp" name="Shade Temp (°C)" stroke="#FF4E02" strokeWidth={2} fillOpacity={1} fill="url(#simTemp)" />
                      <Area type="monotone" dataKey="wbgt" name="WBGT Index (°C)" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#simWbgt)" />
                    </>
                  ) : (
                    <>
                      <YAxis domain={[0, 60]} stroke="#4B5563" fontSize={9} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#121418', borderColor: '#374151', fontSize: 11 }} />
                      <ReferenceLine y={38} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'WIND HALT 38 km/h', fill: '#EF4444', fontSize: 8, position: 'insideRight' }} />
                      <ReferenceLine y={20} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'WIND CAUTION 20 km/h', fill: '#D97706', fontSize: 8, position: 'insideRight' }} />
                      <Area type="monotone" dataKey="gusts" name="Wind Gusts (km/h)" stroke="#EC4899" strokeWidth={1} strokeDasharray="2 2" fill="none" />
                      <Area type="monotone" dataKey="wind" name="Wind Speed (km/h)" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#simWind)" />
                      <Area type="monotone" dataKey="uv" name="UV Index" stroke="#FBBF24" strokeWidth={1.5} fill="none" />
                    </>
                  )}
                  {/* Highlight shift overlay area */}
                  <ReferenceArea x1={`${shiftStart.toString().padStart(2, '0')}:00`} x2={`${shiftEnd.toString().padStart(2, '0')}:00`} fill="#FF4E02" fillOpacity={0.04} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Section: R&D Suitability & Hit target - 3 Cols */}
        <div className="lg:col-span-3 flex flex-col space-y-4 overflow-y-auto pr-1 no-scrollbar shrink-0">
          
          {/* Main Success Index Card */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-3 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">R&D FEASIBILITY INDEX</span>
            
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-mono font-black text-white">{stats ? stats.successRatio : '--'}%</span>
              <span className="text-xs text-slate-400 font-bold uppercase">Success Index</span>
            </div>

            <div className="w-full bg-bgDeepSpace h-2 relative overflow-hidden border border-slate-850">
              <div 
                className={`h-full transition-all duration-500 ${
                  stats && stats.successRatio >= 75 ? 'bg-safetyGreen' : stats && stats.successRatio >= 45 ? 'bg-amber-500' : 'bg-stopRed'
                }`}
                style={{ width: `${stats ? stats.successRatio : 0}%` }}
              ></div>
            </div>
            
            <p className="text-[9px] text-slate-400 leading-normal">
              Clear Training/R&D hours ratio across the diurnal shift. Suspension triggers reduce the clearance rating index.
            </p>
          </div>

          {/* Advanced Ballistics & Range Card Engine (Military R&D Precision Fire Widget) */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-3 shrink-0">
            {/* Header with Title and Range Card button */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-slate-350 justify-between">
              <div className="flex items-center space-x-1.5">
                <Crosshair className="w-4 h-4 text-edgeOrange" />
                <span className="text-[10px] font-black uppercase tracking-wider">TACTICAL BALLISTICS & DOPE</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDopeModal(true)}
                className="bg-edgeOrange/20 hover:bg-edgeOrange/30 text-edgeOrange border border-edgeOrange/40 hover:border-edgeOrange transition px-2 py-0.5 text-[8.5px] font-black uppercase flex items-center space-x-1 cursor-pointer"
                title="View full Data On Previous Engagements (DOPE) range card table"
              >
                <Table className="w-3 h-3" />
                <span>DOPE CARD</span>
              </button>
            </div>

            {/* Caliber Selector */}
            <div className="flex flex-col space-y-1">
              <div className="flex justify-between items-center text-[8.5px] font-black uppercase text-slate-400">
                <span>SELECT CARTRIDGE / CALIBER:</span>
                <span className="text-edgeOrange font-mono">{activeCaliber.caliber}</span>
              </div>
              <select
                value={selectedCaliberId}
                onChange={(e) => setSelectedCaliberId(e.target.value)}
                className="bg-bgDeepSpace border border-slate-700/80 text-white text-[9.5px] font-bold p-1.5 focus:border-edgeOrange outline-none cursor-pointer"
              >
                {BALLISTIC_CALIBERS.filter(c => c.id !== '120_mortar').map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} ({c.bulletWeightGrains}gr)
                  </option>
                ))}
              </select>
            </div>

            {/* Drag Function & Zero Distance Selector Row */}
            <div className="grid grid-cols-2 gap-2 text-[8.5px]">
              <div className="bg-bgDeepSpace/60 border border-slate-850 p-1.5 flex flex-col justify-between">
                <span className="text-slate-500 font-black uppercase">DRAG MODEL:</span>
                <div className="flex space-x-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setDragModel('G7')}
                    className={`flex-1 py-0.5 font-black uppercase text-center cursor-pointer transition ${dragModel === 'G7' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white bg-slate-850'}`}
                  >
                    G7
                  </button>
                  <button
                    type="button"
                    onClick={() => setDragModel('G1')}
                    className={`flex-1 py-0.5 font-black uppercase text-center cursor-pointer transition ${dragModel === 'G1' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white bg-slate-850'}`}
                  >
                    G1
                  </button>
                </div>
              </div>

              <div className="bg-bgDeepSpace/60 border border-slate-850 p-1.5 flex flex-col justify-between">
                <span className="text-slate-500 font-black uppercase">ZERO RANGE:</span>
                <div className="flex space-x-1 mt-1">
                  {[100, 200, 300].map(z => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZeroDistance(z)}
                      className={`flex-1 py-0.5 font-black uppercase text-center cursor-pointer transition ${zeroDistance === z ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-white bg-slate-850'}`}
                    >
                      {z}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Atmospheric Density Strip (Abu Al Abyad Island Environmental Correction) */}
            <div className="bg-bgDeepSpace/80 border border-slate-800 p-2 flex flex-col space-y-1">
              <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
                <div className="flex items-center space-x-1">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  <span>ATMOSPHERIC CORRECTION (ISLAND MET):</span>
                </div>
                <span className="text-cyan-400 font-mono">{atmData.airDensity} kg/m³</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[8px] text-center pt-0.5">
                <div className="bg-slate-900/60 p-1 border border-slate-800">
                  <span className="text-slate-500 block">DENSITY ALT</span>
                  <span className="font-mono text-white font-bold">{atmData.densityAltitudeFt.toLocaleString()} ft</span>
                </div>
                <div className="bg-slate-900/60 p-1 border border-slate-800">
                  <span className="text-slate-500 block">AIR DRAG DELTA</span>
                  <span className={`font-mono font-bold ${atmData.airDensityDeltaPct <= 0 ? 'text-safetyGreen' : 'text-stopRed'}`}>
                    {atmData.airDensityDeltaPct > 0 ? '+' : ''}{atmData.airDensityDeltaPct}%
                  </span>
                </div>
                <div className="bg-slate-900/60 p-1 border border-slate-800">
                  <span className="text-slate-500 block">SPEED OF SOUND</span>
                  <span className="font-mono text-white font-bold">{atmData.speedOfSoundMps} m/s</span>
                </div>
              </div>
            </div>

            {/* Target Distance input */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-slate-500 uppercase">ENGAGEMENT DISTANCE:</span>
                <span className="font-mono text-white text-xs font-black">{targetDistance}m</span>
              </div>
              <input
                type="range"
                min="100"
                max={Math.min(activeCaliber.maxEffectiveRangeM || 1500, 2000)}
                step="25"
                value={targetDistance}
                onChange={(e) => setTargetDistance(parseInt(e.target.value))}
                className="w-full accent-edgeOrange h-1 bg-bgDeepSpace cursor-pointer border-none outline-none"
              />
              <div className="flex justify-between text-[7.5px] text-slate-500 font-mono">
                <span>100m</span>
                <span>500m</span>
                <span>1000m</span>
                <span>{Math.min(activeCaliber.maxEffectiveRangeM || 1500, 2000)}m max</span>
              </div>
            </div>

            {/* High-Fidelity Tactical Mil-Dot Reticle Graphic */}
            <div className="relative flex justify-center py-2 bg-slate-950/70 border border-slate-850 overflow-hidden">
              <svg width="180" height="150" viewBox="0 0 180 150" className="select-none">
                <defs>
                  <radialGradient id="reticleVignette" cx="50%" cy="50%" r="50%">
                    <stop offset="70%" stopColor="#030712" stopOpacity="0" />
                    <stop offset="100%" stopColor="#030712" stopOpacity="0.85" />
                  </radialGradient>
                </defs>

                {/* Outer Scope Rim */}
                <circle cx="90" cy="75" r="70" fill="#090d16" stroke="#1e293b" strokeWidth="2" />
                <circle cx="90" cy="75" r="69" fill="url(#reticleVignette)" />

                {/* Optical Center Crosshairs */}
                <line x1="90" y1="10" x2="90" y2="140" stroke="#475569" strokeWidth="1" strokeDasharray="2 1" />
                <line x1="25" y1="75" x2="155" y2="75" stroke="#475569" strokeWidth="1" strokeDasharray="2 1" />

                {/* Mil-Dot Hash Graduations */}
                {[-4, -3, -2, -1, 1, 2, 3, 4].map(mil => (
                  <g key={`x-mil-${mil}`}>
                    <line x1={90 + mil * 12} y1="72" x2={90 + mil * 12} y2="78" stroke="#64748b" strokeWidth="1" />
                    {Math.abs(mil) % 2 === 0 && (
                      <text x={90 + mil * 12} y="85" fontSize="5" fill="#64748b" textAnchor="middle">{Math.abs(mil)}</text>
                    )}
                  </g>
                ))}

                {[1, 2, 3, 4, 5].map(mil => (
                  <g key={`y-mil-${mil}`}>
                    <line x1="86" y1={75 + mil * 11} x2="94" y2={75 + mil * 11} stroke="#64748b" strokeWidth="1" />
                    <text x="83" y={75 + mil * 11 + 2} fontSize="5" fill="#64748b" textAnchor="end">{mil}</text>
                  </g>
                ))}

                {/* Center Aiming Dot */}
                <circle cx="90" cy="75" r="1.5" fill="#f8fafc" opacity="0.9" />

                {/* Dynamic Impact Point: Elevation Drop + Windage Drift */}
                {(() => {
                  const maxPx = 55;
                  const dropPx = Math.min(maxPx, Math.max(0, targetSolution.elevMil * 3.8));
                  const driftPx = Math.max(-maxPx, Math.min(maxPx, (targetSolution.driftCm / (targetDistance * 0.1)) * 3.8));
                  const hitX = 90 + driftPx;
                  const hitY = 75 + dropPx;

                  return (
                    <g>
                      {/* Holdover Line from optical center */}
                      <line x1="90" y1="75" x2={hitX} y2={hitY} stroke="#f97316" strokeWidth="0.75" strokeDasharray="2,2" opacity="0.6" />

                      {/* Impact Point */}
                      <circle cx={hitX} cy={hitY} r="3" fill="#ef4444" className="animate-pulse" />
                      <circle cx={hitX} cy={hitY} r="6.5" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping opacity-50" />
                      
                      {/* Holdover coordinate label */}
                      <text x={hitX > 90 ? hitX - 8 : hitX + 8} y={hitY + 4} fontSize="5" fill="#f97316" fontWeight="bold" textAnchor={hitX > 90 ? "end" : "start"}>
                        {targetSolution.elevMil}M ↓ {targetSolution.windMil}M
                      </text>
                    </g>
                  );
                })()}

                {/* Wind Vector Direction Indicator */}
                <g transform="translate(150, 25)">
                  <circle cx="0" cy="0" r="11" fill="#0b0f19" stroke="#334155" strokeWidth="0.8" />
                  <path d="M 0 6 L 0 -6 M -3 -2 L 0 -6 L 3 -2" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
                  <text x="0" y="15" fontSize="4.5" fill="#94a3b8" textAnchor="middle" fontWeight="bold">WIND</text>
                </g>
              </svg>
            </div>

            {/* Tactical Fire Control Solutions Grid */}
            <div className="bg-bgDeepSpace/70 p-2 border border-slate-800 flex flex-col space-y-2 text-[8.5px] font-mono">
              <div className="grid grid-cols-2 gap-2">
                {/* Elevation Adjustment */}
                <div className="bg-slate-900/60 p-1.5 border border-slate-850 flex flex-col justify-between">
                  <span className="text-slate-400 font-sans font-black uppercase text-[8px]">ELEVATION HOLDOVER:</span>
                  <div className="flex items-baseline space-x-1 my-0.5">
                    <span className="text-sm font-black text-white">+{targetSolution.elevMil}</span>
                    <span className="text-edgeOrange font-bold">MIL</span>
                    <span className="text-slate-400 text-[8px]">(+{targetSolution.elevMoa} MOA)</span>
                  </div>
                  <span className="text-slate-400 text-[8px]">Turret: <strong className="text-white">+{targetSolution.elevClicks01Mil} Clicks UP</strong></span>
                </div>

                {/* Windage Adjustment */}
                <div className="bg-slate-900/60 p-1.5 border border-slate-850 flex flex-col justify-between">
                  <span className="text-slate-400 font-sans font-black uppercase text-[8px]">WINDAGE DEFLECTION:</span>
                  <div className="flex items-baseline space-x-1 my-0.5">
                    <span className="text-sm font-black text-white">{targetSolution.windMil}</span>
                    <span className="text-cyan-400 font-bold">MIL</span>
                    <span className="text-slate-400 text-[8px]">({targetSolution.windMoa} MOA)</span>
                  </div>
                  <span className="text-slate-400 text-[8px]">
                    Offset: <strong className="text-white">{Math.abs(targetSolution.driftCm).toFixed(1)} cm</strong> ({targetSolution.windClicks01Mil} Clicks)
                  </span>
                </div>
              </div>

              {/* Kinetic & Aerodynamic Telemetry */}
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-center">
                <div>
                  <span className="text-slate-500 block text-[7.5px] uppercase">VELOCITY</span>
                  <span className="font-bold text-white">{targetSolution.velocityMps} m/s</span>
                  <span className={`block text-[7.5px] font-bold ${targetSolution.regimeColor}`}>
                    {targetSolution.flightRegime} ({targetSolution.mach}M)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[7.5px] uppercase">TIME OF FLIGHT</span>
                  <span className="font-bold text-white">{targetSolution.timeOfFlightSec}s</span>
                  <span className="text-slate-500 block text-[7.5px]">To Target</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[7.5px] uppercase">RETAINED ENERGY</span>
                  <span className="font-bold text-white">{targetSolution.energyJ.toLocaleString()} J</span>
                  <span className="text-slate-500 block text-[7.5px]">Kinetic Energy</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button for DOPE Table */}
            <button
              type="button"
              onClick={() => setShowDopeModal(true)}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700/80 hover:border-edgeOrange transition py-1.5 px-3 text-[9px] font-black uppercase flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Table className="w-3.5 h-3.5 text-edgeOrange" />
              <span>EXPAND FULL DOPE RANGE CARD TABLE</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* R&D Impact Metrics Panel */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-3 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {targetActivity} DIAGNOSTIC METRICS
            </span>
            
            {/* Status badge */}
            <div className={`border p-2 px-3 text-[11px] font-black uppercase text-center ${rdDiagnostics ? rdDiagnostics.ratingColor : ''}`}>
              {rdDiagnostics ? rdDiagnostics.rating : '--'}
            </div>

            <div className="flex flex-col space-y-2 border-t border-slate-805 pt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] text-slate-500 uppercase font-black">{rdDiagnostics ? rdDiagnostics.metricLabel : ''}:</span>
                <span className="font-mono text-white text-xs font-black">{rdDiagnostics ? rdDiagnostics.metricValue : ''}</span>
              </div>
              <p className="text-[9.5px] text-slate-400 leading-normal italic">
                "{rdDiagnostics ? rdDiagnostics.remarks : ''}"
              </p>
            </div>
          </div>

          {/* MoHRE Midday Ban Summer Compliance Alert */}
          {stats?.banOverlaps && (
            <div className="bg-stopRed/10 border border-stopRed/25 p-3 flex items-start space-x-2.5 shrink-0">
              <AlertTriangle className="w-5 h-5 text-stopRed mt-0.5 shrink-0 animate-pulse" />
              <div>
                <h4 className="text-[10.5px] font-black text-stopRed">MOHRE MIDDAY BAN CONFLICT</h4>
                <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">
                  WARNING: Projected shift overlaps 12:30–15:00 during summer months. Non-essential operations on the range are legally halted. Penalty of AED 5,000 per worker will apply.
                </p>
              </div>
            </div>
          )}
          
          {/* Personnel safety / Hydration summary */}
          <div className="bg-cardDarkSlate p-4 border border-slate-800 flex flex-col space-y-2.5 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PERSONNEL HEALTH SUMMARY</span>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-bgDeepSpace/40 p-2 border border-slate-850">
                <span className="text-[8px] text-slate-500 block uppercase font-black">Daily Water / Person</span>
                <span className="text-white text-sm font-black font-mono">
                  {(() => {
                    let rate = 0.5;
                    if (stats && stats.maxWbgt >= 30.0) rate = 1.25;
                    else if (stats && stats.maxWbgt >= 27.9) rate = 1.0;
                    else if (stats && stats.maxWbgt >= 25.9) rate = 0.75;
                    return (rate * shiftLogs.length).toFixed(1);
                  })()} L
                </span>
              </div>
              <div className="bg-bgDeepSpace/40 p-2 border border-slate-850 flex flex-col justify-center">
                <span className="text-[8px] text-slate-500 block uppercase font-black">Rest Guidelines</span>
                <span className="text-white text-[9.5px] font-black leading-tight mt-0.5">
                  {stats && stats.maxWbgt >= 30.0 ? '30m Work / 30m Rest' : stats && stats.maxWbgt >= 27.9 ? '40m Work / 20m Rest' : 'Continuous Go'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 5. Full DOPE Range Card Modal */}
      {showDopeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fade-in">
          <div className="bg-cardDarkSlate border border-slate-700/80 rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-textIceWhite">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-bgDeepSpace/80 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-edgeOrange/20 border border-edgeOrange/40 rounded-lg">
                  <Crosshair className="w-5 h-5 text-edgeOrange" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wider uppercase flex items-center space-x-2">
                    <span>X-RANGE TACTICAL DOPE CARD</span>
                    <span className="text-edgeOrange font-mono">• {activeCaliber.name}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Zero: {zeroDistance}m • Drag Model: {dragModel} (Eff. BC: {trajectoryResult.effectiveBC}) • Density Alt: {atmData.densityAltitudeFt.toLocaleString()} ft • Air Density: {atmData.airDensity} kg/m³
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyDope}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-[9px] font-black uppercase flex items-center space-x-1.5 cursor-pointer transition rounded"
                  title="Copy DOPE table to clipboard"
                >
                  {copiedDope ? <Check className="w-3.5 h-3.5 text-safetyGreen" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDope ? 'COPIED!' : 'COPY TABLE'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportDopeCSV}
                  className="bg-edgeOrange hover:bg-orange-600 border border-orange-700 px-3 py-1.5 text-[9px] font-black uppercase flex items-center space-x-1.5 cursor-pointer text-white transition rounded shadow"
                  title="Export DOPE table to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDopeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer transition ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Environmental Summary Bar */}
            <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[9px] font-mono text-slate-300 shrink-0 flex-wrap gap-2">
              <span className="flex items-center space-x-1">
                <span className="text-slate-500">TEMP:</span>
                <strong className="text-white">{avgTemp.toFixed(1)}°C</strong>
              </span>
              <span className="flex items-center space-x-1">
                <span className="text-slate-500">RH:</span>
                <strong className="text-white">{avgRh}%</strong>
              </span>
              <span className="flex items-center space-x-1">
                <span className="text-slate-500">CROSSWIND:</span>
                <strong className="text-white">{avgWind.toFixed(1)} km/h @ {crosswindAngle}°</strong>
              </span>
              <span className="flex items-center space-x-1">
                <span className="text-slate-500">SOUND SPEED:</span>
                <strong className="text-white">{atmData.speedOfSoundMps} m/s</strong>
              </span>
              <span className="flex items-center space-x-1 bg-edgeOrange/15 px-2 py-0.5 rounded border border-edgeOrange/30">
                <span className="text-edgeOrange font-black uppercase">TARGET:</span>
                <strong className="text-white">{targetDistance}m</strong>
              </span>
            </div>

            {/* Table Area */}
            <div className="flex-grow overflow-auto p-4 no-scrollbar">
              <table className="w-full text-left border-collapse text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[9px] font-black text-slate-400 uppercase bg-slate-900/80 sticky top-0 z-10">
                    <th className="p-2.5">Range</th>
                    <th className="p-2.5">Drop (cm)</th>
                    <th className="p-2.5 text-edgeOrange">Elev (MIL)</th>
                    <th className="p-2.5">Elev (MOA)</th>
                    <th className="p-2.5">Clicks (0.1M)</th>
                    <th className="p-2.5">Drift (cm)</th>
                    <th className="p-2.5 text-cyan-400">Wind (MIL)</th>
                    <th className="p-2.5">Velocity</th>
                    <th className="p-2.5">Mach</th>
                    <th className="p-2.5">Energy (J)</th>
                    <th className="p-2.5">ToF (s)</th>
                    <th className="p-2.5">Flight Regime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dopeTable.map((row) => {
                    const isSelectedRange = Math.abs(row.rangeM - targetDistance) < 25;
                    return (
                      <tr 
                        key={row.rangeM}
                        className={`transition ${
                          isSelectedRange 
                            ? 'bg-edgeOrange/20 font-black border-l-4 border-edgeOrange text-white' 
                            : 'hover:bg-slate-900/40 text-slate-300'
                        }`}
                      >
                        <td className="p-2.5 font-bold">{row.rangeM}m</td>
                        <td className="p-2.5">{row.dropCm}</td>
                        <td className="p-2.5 text-edgeOrange font-black">+{row.elevMil}</td>
                        <td className="p-2.5 text-slate-400">+{row.elevMoa}</td>
                        <td className="p-2.5 font-bold text-white">+{row.elevClicks01Mil}</td>
                        <td className="p-2.5">{Math.abs(row.driftCm).toFixed(1)}</td>
                        <td className="p-2.5 text-cyan-400 font-bold">{row.windMil}</td>
                        <td className="p-2.5">{row.velocityMps} m/s</td>
                        <td className="p-2.5 font-bold">{row.mach}M</td>
                        <td className="p-2.5 text-slate-300">{row.energyJ.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-400">{row.timeOfFlightSec}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            row.flightRegime === 'Supersonic' ? 'bg-safetyGreen/20 text-safetyGreen' :
                            row.flightRegime.startsWith('Transonic') ? 'bg-amber-500/20 text-amber-400' :
                            'bg-stopRed/20 text-stopRed'
                          }`}>
                            {row.flightRegime}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-bgDeepSpace/80 flex items-center justify-between text-[9px] text-slate-400 shrink-0">
              <span className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-edgeOrange inline-block animate-pulse"></span>
                <span>Active calibration target highlighted at <strong>{targetDistance}m</strong>. Scope click values calculated for standard 0.1 MIL / 1cm @ 100m turrets.</span>
              </span>
              <button
                type="button"
                onClick={() => setShowDopeModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-black uppercase text-[9px] rounded cursor-pointer transition border border-slate-700"
              >
                Close DOPE Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
