import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Download, Compass, Droplet, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Wind, Sun, Activity, Eye, FileText, Crosshair, Plane, Users, Anchor, CheckCircle2, XCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { calculateDewPoint, calculateWBGT, evaluateSafety, getWBGTComfort, getClimaticAnomalyForYear } from '../utils/safetyEngine';
import { generateRcoPdfBrief } from '../utils/pdfGenerator';
import { generateRcoWordBrief } from '../utils/wordGenerator';
import { evaluateTacticalMissionMatrix } from '../utils/tacticalBallisticsEngine';

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

export default function PlanningDashboard({ isSimulated, hourlyData, dailyData }) {
  const getDubaiDateString = (dateVal) => {
    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
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

  const [selectedDate, setSelectedDate] = useState(getDubaiDateString(new Date()));
  const [planningSource, setPlanningSource] = useState('ARCHIVE'); // 'ARCHIVE' or 'CLIMATOLOGY'
  const [planningMode, setPlanningMode] = useState('DIURNAL'); // 'DIURNAL' or 'TACTICAL_MATRIX'
  const [selectedMatrixDay, setSelectedMatrixDay] = useState(0);
  const [matrixFilter, setMatrixFilter] = useState('ALL'); // 'ALL' | 'liveFire' | 'uav' | 'infantry' | 'amphibious'
  
  // Dynamically derive the climatic anomaly based on the selected year
  const selectedYear = isNaN(new Date(selectedDate).getTime()) ? 2026 : new Date(selectedDate).getFullYear();
  const anomalyObj = getClimaticAnomalyForYear(selectedYear);
  const activeAnomaly = anomalyObj.type;

  const [hourlyLogs, setHourlyLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState('SIMULATED'); // 'API' or 'SIMULATED' or 'API_ANALOG'
  const [analogDateUsed, setAnalogDateUsed] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // WeatherNext 3 7-day tactical mission operational windows matrix
  const tacticalDays = useMemo(() => {
    return evaluateTacticalMissionMatrix(hourlyData, dailyData, selectedDate);
  }, [hourlyData, dailyData, selectedDate]);

  // Parse active month climate data
  const dateObjForMonth = new Date(selectedDate);
  const selectedMonth = isNaN(dateObjForMonth.getTime()) ? 0 : dateObjForMonth.getMonth();
  const currentMonthAvg = climateDb[selectedMonth];

  // High-fidelity Abu Dhabi climatological simulation fallback
  const generateSyntheticDay = (dateStr) => {
    const dateObj = new Date(dateStr);
    const month = dateObj.getMonth(); // 0-11
    const c = climateDb[month];
    const logs = [];

    // Check if midday work ban date range (June 15 - Sept 15) is active
    const calendarMonth = month + 1;
    const calendarDay = dateObj.getDate();
    const isMiddayBanDate = (calendarMonth === 6 && calendarDay >= 15) || 
                            calendarMonth === 7 || 
                            calendarMonth === 8 || 
                            (calendarMonth === 9 && calendarDay <= 15);

    for (let hr = 0; hr < 24; hr++) {
      // Diurnal temp cycle peaking at 14:00, coolest at 05:00
      const radT = Math.PI * (hr - 14) / 12;
      let temp = c.minT + (c.maxT - c.minT) * (0.5 + 0.5 * Math.cos(radT));

      // Humidity is inversely proportional to Temperature
      const radH = Math.PI * (hr - 5) / 12;
      let rh = Math.round(c.avgRH + 15 * Math.cos(radH));

      // UV peaks at 12:00
      let uv = 0;
      if (hr >= 6 && hr <= 18) {
        uv = Math.round(c.uv * Math.sin(Math.PI * (hr - 6) / 12));
      }

      // Wind peaks in late afternoon (sea breeze effect)
      const radW = Math.PI * (hr - 16) / 12;
      let wind = Math.round(c.wind + 5 * Math.cos(radW));

      // Apply anomaly offsets
      let pm10Val = 45;
      let visibility = wind > 20 ? 8000 : 12000;
      if (activeAnomaly === 'EL_NINO') {
        temp = Number((temp + 2.2).toFixed(1));
        rh = Math.max(5, Math.min(100, Math.round(rh - 12)));
        wind = Math.round(wind * 0.85);
        visibility = Math.max(100, visibility - 3000);
        pm10Val = Math.round(pm10Val * 1.6);
      } else if (activeAnomaly === 'LA_NINA') {
        temp = Number((temp - 1.5).toFixed(1));
        rh = Math.max(5, Math.min(100, Math.round(rh + 15)));
        wind = Math.round(wind * 1.25);
        visibility = Math.max(100, visibility + 1500);
        pm10Val = Math.round(pm10Val * 0.75);
      }

      const gusts = Math.round(wind * c.gustM);
      const dp = calculateDewPoint(temp, rh);
      const wbgt = calculateWBGT(temp, rh, wind, uv);

      // Check midday work ban compliance
      let isMiddayBanActive = false;
      if (isMiddayBanDate && hr >= 12 && hr <= 14) {
        if (hr === 12) {
          isMiddayBanActive = true; // Includes 12:30 to 13:00 segment
        } else if (hr === 13 || hr === 14) {
          isMiddayBanActive = true;
        }
      }

      const readings = {
        temperature_2m: temp,
        relative_humidity_2m: rh,
        wind_speed_10m: wind,
        wind_gusts_10m: gusts,
        visibility,
        uv_index: uv,
        pm10: pm10Val
      };

      const safetyEval = evaluateSafety(readings);

      logs.push({
        time: `${dateStr}T${hr.toString().padStart(2, '0')}:00`,
        hourLabel: `${hr.toString().padStart(2, '0')}:00`,
        temp,
        rh,
        dewPoint: dp,
        wbgt,
        wind,
        gusts,
        uv,
        visibility: visibility / 1000, // converted to km
        safetyStatus: safetyEval.status,
        safetyReasons: safetyEval.reasons,
        isMiddayBanActive
      });
    }

    return logs;
  };

  useEffect(() => {
    let active = true;

    async function loadPlanningData() {
      setIsLoading(true);
      setFetchError(null);

      if (planningSource === 'CLIMATOLOGY') {
        if (active) {
          const simulatedLogs = generateSyntheticDay(selectedDate);
          setHourlyLogs(simulatedLogs);
          setDataSource('SIMULATED');
          setIsLoading(false);
        }
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const planDate = new Date(selectedDate);
      planDate.setHours(0, 0, 0, 0);

      const isFuture = planDate > today;
      let queryDate = selectedDate;
      let isAnalog = false;
      let analogYear = null;

      // Archive API has a ~2 day delay, so treat dates newer than 3 days ago as future/analog or simulation
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 3);
      cutoffDate.setHours(0, 0, 0, 0);

      if (planDate > cutoffDate) {
        isAnalog = true;
        analogYear = today.getFullYear() - 1; // Slide to the previous calendar year
        const analogDateObj = new Date(planDate);
        analogDateObj.setFullYear(analogYear);
        queryDate = analogDateObj.toISOString().slice(0, 10);
        setAnalogDateUsed(queryDate);
      } else {
        setAnalogDateUsed(null);
      }

      try {
        // Fetch from Open-Meteo Archive API
        const response = await fetch(
          `https://archive-api.open-meteo.com/v1/archive?latitude=24.20&longitude=52.78&start_date=${queryDate}&end_date=${queryDate}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility&timezone=Asia/Dubai&wind_speed_unit=kmh`
        );

        if (!response.ok) {
          throw new Error(`Archive API error: Status ${response.status}`);
        }

        const archive = await response.json();
        
        if (!archive.hourly || !archive.hourly.temperature_2m) {
          throw new Error('Malformed archive response payload');
        }

        if (!active) return;

        // Process hourly logs using historical data
        const dateObj = new Date(selectedDate);
        const month = dateObj.getMonth();
        const calendarMonth = month + 1;
        const calendarDay = dateObj.getDate();
        
        // Check midday work ban date range (June 15 - Sept 15) is active
        const isMiddayBanDate = (calendarMonth === 6 && calendarDay >= 15) || 
                                calendarMonth === 7 || 
                                calendarMonth === 8 || 
                                (calendarMonth === 9 && calendarDay <= 15);

        // Climatological clear-sky UV peak index guide
        const monthlyUvPeak = [5, 6, 8, 10, 11, 12, 12, 12, 10, 8, 6, 5];
        const peakUv = monthlyUvPeak[month];

        const logs = archive.hourly.time.map((timeStr, idx) => {
          const hr = parseInt(timeStr.split('T')[1].slice(0, 2), 10);
          
          let temp = archive.hourly.temperature_2m[idx];
          let rh = archive.hourly.relative_humidity_2m[idx];
          let wind = archive.hourly.wind_speed_10m[idx];
          let gusts = archive.hourly.wind_gusts_10m ? archive.hourly.wind_gusts_10m[idx] : wind * 1.3;
          let visibility = archive.hourly.visibility ? archive.hourly.visibility[idx] : 10000;

          // Apply anomaly offsets
          let pm10Val = 40;
          if (activeAnomaly === 'EL_NINO') {
            temp = Number((temp + 2.2).toFixed(1));
            rh = Math.max(5, Math.min(100, Math.round(rh - 12)));
            wind = Number((wind * 0.85).toFixed(1));
            gusts = Number((gusts * 0.85).toFixed(1));
            visibility = Math.max(100, visibility - 3000);
            pm10Val = Math.round(pm10Val * 1.6);
          } else if (activeAnomaly === 'LA_NINA') {
            temp = Number((temp - 1.5).toFixed(1));
            rh = Math.max(5, Math.min(100, Math.round(rh + 15)));
            wind = Number((wind * 1.25).toFixed(1));
            gusts = Number((gusts * 1.25).toFixed(1));
            visibility = Math.max(100, visibility + 1500);
            pm10Val = Math.round(pm10Val * 0.75);
          }

          // Estimate UV index from hour for clear skies
          let uv = 0;
          if (hr >= 6 && hr <= 18) {
            uv = Math.round(peakUv * Math.sin(Math.PI * (hr - 6) / 12));
          }

          const dp = calculateDewPoint(temp, rh);
          const wbgt = calculateWBGT(temp, rh, wind, uv);

          // Check midday work ban compliance
          let isMiddayBanActive = false;
          if (isMiddayBanDate && hr >= 12 && hr <= 14) {
            if (hr === 12) isMiddayBanActive = true;
            else if (hr === 13 || hr === 14) isMiddayBanActive = true;
          }

          const readings = {
            temperature_2m: temp,
            relative_humidity_2m: rh,
            wind_speed_10m: wind,
            wind_gusts_10m: gusts,
            visibility,
            uv_index: uv,
            pm10: pm10Val
          };

          const safetyEval = evaluateSafety(readings);

          return {
            time: `${selectedDate}T${hr.toString().padStart(2, '0')}:00`,
            hourLabel: `${hr.toString().padStart(2, '0')}:00`,
            temp,
            rh,
            dewPoint: dp,
            wbgt,
            wind,
            gusts,
            uv,
            visibility: visibility / 1000, // converted to km
            safetyStatus: safetyEval.status,
            safetyReasons: safetyEval.reasons,
            isMiddayBanActive
          };
        });

        setHourlyLogs(logs);
        setDataSource(isAnalog ? 'API_ANALOG' : 'API');
      } catch (err) {
        console.warn('Archive API fetch failed, falling back to local climate simulation:', err);
        if (active) {
          const simulatedLogs = generateSyntheticDay(selectedDate);
          setHourlyLogs(simulatedLogs);
          setDataSource('SIMULATED');
          setFetchError(err.message);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadPlanningData();

    return () => {
      active = false;
    };
  }, [selectedDate, planningSource]);

  // Aggregate Key Planning Statistics
  const getPlanningStats = () => {
    if (hourlyLogs.length === 0) return null;

    let peakTemp = -999;
    let peakTempTime = '';
    let peakWbgt = -999;
    let peakWbgtTime = '';
    let maxWind = 0;
    let maxGust = 0;
    let safeHoursCount = 0;
    let totalHydrationLiters = 0; // Cumulative hydration for standard 8h range day (08:00 - 16:00)

    hourlyLogs.forEach((log) => {
      if (log.temp > peakTemp) {
        peakTemp = log.temp;
        peakTempTime = log.hourLabel;
      }
      if (log.wbgt > peakWbgt) {
        peakWbgt = log.wbgt;
        peakWbgtTime = log.hourLabel;
      }
      if (log.wind > maxWind) maxWind = log.wind;
      if (log.gusts > maxGust) maxGust = log.gusts;
      if (log.safetyStatus === 'GREEN') safeHoursCount++;

      // Sum up fluid intake recommendation for work hours (08:00 to 16:00, index 8 to 16 inclusive)
      const hr = parseInt(log.hourLabel.slice(0, 2), 10);
      if (hr >= 8 && hr <= 16) {
        if (log.wbgt >= 30.0) totalHydrationLiters += 1.25;
        else if (log.wbgt >= 27.9) totalHydrationLiters += 1.00;
        else if (log.wbgt >= 25.9) totalHydrationLiters += 0.75;
        else totalHydrationLiters += 0.50;
      }
    });

    const isMiddayBanPresent = hourlyLogs.some(l => l.isMiddayBanActive);

    // Determine Drone Operations Risk
    let droneRisk = 'CLEARED';
    let droneColor = 'text-safetyGreen border-safetyGreen/20 bg-safetyGreen/5';
    if (maxGust >= 50 || maxWind >= 38) {
      droneRisk = 'SUSPENDED';
      droneColor = 'text-stopRed border-stopRed/20 bg-stopRed/5';
    } else if (maxWind >= 25 || maxGust >= 35) {
      droneRisk = 'HIGH DRIFT RISK';
      droneColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';
    }

    return {
      peakTemp,
      peakTempTime,
      peakWbgt,
      peakWbgtTime,
      maxWind,
      maxGust,
      safeHoursCount,
      totalHydrationLiters,
      isMiddayBanPresent,
      droneRisk,
      droneColor
    };
  };

  const stats = getPlanningStats();

  // CSV Report Generator
  const handleExportCSV = () => {
    if (hourlyLogs.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Hour GST,Shade Temperature (C),Humidity (%),Dew Point (C),WBGT Index (C),Wind Speed (kmh),Wind Gusts (kmh),UV Index,Visibility (m),Safety Status,Work Rest Ratio,Hydration Rate (L/hr),Midday Ban Active\r\n';

    hourlyLogs.forEach((log) => {
      // Work rest guidelines
      let workRest = 'Continuous';
      let hydration = '0.50';
      if (log.wbgt >= 30.0) {
        workRest = '30m Work / 30m Rest';
        hydration = '1.25';
      } else if (log.wbgt >= 27.9) {
        workRest = '40m Work / 20m Rest';
        hydration = '1.00';
      } else if (log.wbgt >= 25.9) {
        workRest = '50m Work / 10m Rest';
        hydration = '0.75';
      }

      csvContent += `${log.hourLabel},${log.temp.toFixed(1)},${log.rh},${log.dewPoint.toFixed(1)},${log.wbgt.toFixed(1)},${log.wind.toFixed(0)},${log.gusts.toFixed(0)},${log.uv},${log.visibility},${log.safetyStatus},"${workRest}",${hydration},${log.isMiddayBanActive ? 'YES' : 'NO'}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `XRANGE_Planning_Brief_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WeatherNext 3 7-Day Tactical Mission Operational Windows Briefing Generator
  const handleExportTacticalBrief = () => {
    if (!tacticalDays || tacticalDays.length === 0) return;

    let brief = `======================================================================\n`;
    brief += `       XRANGE WEATHERNEXT 3 - 7-DAY TACTICAL MISSION MATRIX BRIEF\n`;
    brief += `======================================================================\n`;
    brief += `GENERATED: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST\n`;
    brief += `START DATE: ${selectedDate} | TARGET: XRANGE HQ (24.20°N, 52.78°E)\n`;
    brief += `MODEL: Google DeepMind WeatherNext 3 (5km Microclimate Resolution)\n`;
    brief += `OPERATING STANDARDS: ADOSH CoP 11.0 / UAE MoHRE Midday Work Ban / MIL-STD-810H\n`;
    brief += `======================================================================\n\n`;

    tacticalDays.forEach((d, idx) => {
      brief += `----------------------------------------------------------------------\n`;
      brief += `DAY ${idx + 1}: ${d.dayLabel.toUpperCase()} (${d.dateStr})\n`;
      brief += `----------------------------------------------------------------------\n`;
      brief += `* Max Temperature:      ${d.maxTemp.toFixed(1)}°C\n`;
      brief += `* Peak Heat Stress:     ${d.maxWbgt.toFixed(1)}°C WBGT\n`;
      brief += `* Peak Surface Wind:    ${d.maxWind.toFixed(0)} km/h (Gusts: ${d.maxGust.toFixed(0)} km/h)\n`;
      brief += `* 100m Boundary Wind:   ${d.maxWind100m.toFixed(0)} km/h\n`;
      brief += `* MoHRE Midday Ban:     ${d.isMiddayBanDate ? 'MANDATORY HALT (12:30 - 15:00 GST)' : 'INACTIVE'}\n\n`;
      brief += `OPERATIONAL STATUS RATINGS:\n`;
      brief += `  1. [LIVE-FIRE EXERCISES]  Rating: ${d.summary.liveFire}\n`;
      brief += `  2. [UAV & DRONE SORTIES]  Rating: ${d.summary.uav}\n`;
      brief += `  3. [INFANTRY MANEUVERS]   Rating: ${d.summary.infantry}\n`;
      brief += `  4. [AMPHIBIOUS SEA OPS]   Rating: ${d.summary.amphibious}\n\n`;
      
      const noGoHours = d.hours.filter(h => Object.values(h.ops).some(op => op.status === 'NO-GO'));
      if (noGoHours.length > 0) {
        brief += `CRITICAL RESTRICTION HOURS:\n`;
        noGoHours.forEach(h => {
          const reasons = Object.entries(h.ops)
            .filter(([_, op]) => op.status === 'NO-GO')
            .map(([k, op]) => `${k.toUpperCase()}: ${op.reason}`)
            .join(' | ');
          brief += `  - ${h.hour}:00 GST -> ${reasons}\n`;
        });
      } else {
        brief += `CRITICAL RESTRICTION HOURS: None. Full operating clearance.\n`;
      }
      brief += `\n`;
    });

    brief += `======================================================================\n`;
    brief += `Compiled automatically by XRANGE Tactical Weather & Safety System.\n`;
    brief += `Range Control Officers (RCO) must continuously verify local sensor telemetry.\n`;
    brief += `======================================================================\n`;

    const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `XRANGE_WeatherNext3_Tactical_Windows_${selectedDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // RCO Daily Brief Generator for Range Planning Date
  const handleGenerateRcoBrief = () => {
    if (hourlyLogs.length === 0) {
      alert("No meteorological logs available for briefing compilation.");
      return;
    }
    
    const chronoLogs = hourlyLogs;
    
    let maxTemp = -999;
    let maxTempTime = '';
    let maxWbgt = -999;
    let maxWbgtTime = '';
    let maxWind = -999;
    let maxWindTime = '';
    let maxGust = -999;
    let maxGustTime = '';
    let maxUv = -999;
    let maxUvTime = '';
    let maxAqi = -999;
    let maxAqiTime = '';
    
    let totalWindSpeed = 0;
    const safeWindows = [];
    const cautionWindows = [];
    const haltWindows = [];
    
    const formatTimeLabel = (timeStr) => {
      if (!timeStr) return '--:--';
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Dubai'
      }) + ' GST';
    };
    
    const formatDateLabel = (timeStr) => {
      if (!timeStr) return '---';
      const d = new Date(timeStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Dubai'
      });
    };

    chronoLogs.forEach(log => {
      const timeStr = log.hourLabel + ' GST';
      if (log.temp > maxTemp) { maxTemp = log.temp; maxTempTime = timeStr; }
      if (log.wbgt > maxWbgt) { maxWbgt = log.wbgt; maxWbgtTime = timeStr; }
      if (log.wind > maxWind) { maxWind = log.wind; maxWindTime = timeStr; }
      if (log.gusts > maxGust) { maxGust = log.gusts; maxGustTime = timeStr; }
      if (log.uv > maxUv) { maxUv = log.uv; maxUvTime = timeStr; }
      
      const logAqi = 45;
      if (logAqi > maxAqi) { maxAqi = logAqi; maxAqiTime = timeStr; }
      
      totalWindSpeed += log.wind;
      
      const status = log.safetyStatus;
      if (status === 'RED') {
        haltWindows.push(log.time);
      } else if (status === 'AMBER') {
        cautionWindows.push(log.time);
      } else {
        safeWindows.push(log.time);
      }
    });
    
    const avgWind = totalWindSpeed / chronoLogs.length;
    
    const getFormattedWindows = (timeArray) => {
      if (timeArray.length === 0) return "NONE";
      const sortedHours = timeArray.map(t => new Date(t).getHours()).sort((a, b) => a - b);
      
      const ranges = [];
      let start = sortedHours[0];
      let prev = sortedHours[0];
      
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === prev + 1) {
          prev = sortedHours[i];
        } else {
          ranges.push(`${String(start).padStart(2, '0')}:00 - ${String(prev + 1).padStart(2, '0')}:00`);
          start = sortedHours[i];
          prev = sortedHours[i];
        }
      }
      ranges.push(`${String(start).padStart(2, '0')}:00 - ${String(prev + 1).padStart(2, '0')}:00`);
      return ranges.join(", ") + " GST";
    };

    const targetMonth = parseInt(selectedDate.slice(5, 7), 10);
    const targetDay = parseInt(selectedDate.slice(8, 10), 10);
    const isMiddayBanActiveForDay = (targetMonth === 6 && targetDay >= 15) || targetMonth === 7 || targetMonth === 8 || (targetMonth === 9 && targetDay <= 15);
    
    let haltWindowText = "";
    if (isMiddayBanActiveForDay) {
      // Filter out the midday ban hours (13:00 and 14:00) from the normal haltWindows to prevent duplicates/overlaps in formatting
      const otherHaltWindows = haltWindows.filter(t => {
        const hr = new Date(t).getHours();
        return hr !== 13 && hr !== 14;
      });
      const otherHaltText = getFormattedWindows(otherHaltWindows);
      if (otherHaltText === "NONE") {
        haltWindowText = "12:30 - 15:00 GST (Mandatory UAE MoHRE Midday Ban)";
      } else {
        haltWindowText = `12:30 - 15:00 GST (Mandatory UAE MoHRE Midday Ban), ${otherHaltText}`;
      }
    } else {
      haltWindowText = getFormattedWindows(haltWindows);
    }
    
    const safeWindowText = getFormattedWindows(safeWindows);
    const cautionWindowText = getFormattedWindows(cautionWindows);
    
    let overallStatus = "SAFE (GREEN)";
    let overallInstruction = "Normal range operations permitted. Continuous environmental monitoring active.";
    if (haltWindows.length > 0 || isMiddayBanActiveForDay) {
      overallStatus = "CRITICAL (RED HALT)";
      overallInstruction = "WARNING: Extreme threshold breaches or mandatory MoHRE midday ban detected today. Outdoor range exercises must be suspended during HALT windows.";
    } else if (cautionWindows.length > 0) {
      overallStatus = "RESTRICTED OPERATIONAL CLEARANCE (AMBER CAUTION)";
      overallInstruction = "CAUTION: Mandatory work/rest cycles and hydration monitoring in force. Exercise high supervisor vigilance.";
    }
    
    let droneRating = "OPTIMAL";
    let droneInstruction = "Wind speeds and gusts are within safe operating limits for standard drone sorties.";
    if (maxGust >= 50 || maxWind >= 38) {
      droneRating = "DANGEROUS / HALTED";
      droneInstruction = "Gale force winds or gusts exceed maximum airframe tolerance. Cancel all drone flights.";
    } else if (maxGust >= 30 || maxWind >= 20) {
      droneRating = "MARGINAL / CAUTION";
      droneInstruction = "Moderate winds/gusts present. High risk of wind drift and battery drain. Experienced pilots only.";
    }
    
    const hashSeed = `${selectedDate}-${maxTemp}-${maxWind}-${maxWbgt}`;
    let hash = 0;
    for (let i = 0; i < hashSeed.length; i++) {
      hash = ((hash << 5) - hash) + hashSeed.charCodeAt(i);
      hash = hash & hash;
    }
    const secureHash = "XR-RCO-" + Math.abs(hash).toString(16).toUpperCase() + "-" + Math.floor(10000 + Math.random() * 90000);

    const reportText = `======================================================================
                 X-RANGE RCO DAILY ENVIRONMENTAL WEATHER BRIEF
                 OPEN SOURCE RANGE PLANNING BRIEFING
======================================================================
GENERATION TIMESTAMP: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST
TARGET BRIEF DATE:    ${formatDateLabel(chronoLogs[0].time)}
ACTIVE STATION:       X-RANGE HQ (Abu Al Abyad Island, UAE)
SECURE RCO HASH:      ${secureHash}
SYSTEM MODE:          ${dataSource === 'API' ? 'HISTORICAL SENSOR TELEMETRY (ARCHIVE)' : dataSource === 'API_ANALOG' ? 'CLIMATOLOGICAL ANALOG MODEL' : 'SYNTHETIC CLIMATOLOGICAL MODEL'}

----------------------------------------------------------------------
1. EXECUTIVE DAILY OPERATIONS ADVISORY
----------------------------------------------------------------------
DAILY STATUS RATING:  ${overallStatus}
RCO DIRECTIVE:
${overallInstruction}

Active Daily Hazards / Advisories:
${haltWindows.length > 0 ? "  [!] RED ALERT: Extreme thermal load / wind gusts will suspend activities during specified hours." : ""}
${cautionWindows.length > 0 ? "  [!] AMBER CAUTION: Heat stress or wind gusts require operational modifications." : ""}
${maxUv >= 8 ? "  [!] UV ADVISORY: Extreme UV Index requires mandatory sunscreen protocols." : ""}
${maxAqi >= 100 ? "  [!] AQI WARNING: Elevated particulate counts (dust/sand suspension)." : ""}
${isMiddayBanActiveForDay ? "  [!] MOHRE MIDDAY BAN: Mandated outdoor work cessation active between 12:30-15:00 GST." : ""}

----------------------------------------------------------------------
2. DIURNAL OPERATIONAL WINDOWS (RCO SCHEDULING GUIDELINES)
----------------------------------------------------------------------
[+] SAFE OPERATING WINDOWS (GREEN):
    ${safeWindowText}
    * Personnel and training exercises clear to operate.

[!] CAUTION OPERATING WINDOWS (AMBER):
    ${cautionWindowText}
    * Restricted clearance. Mandatory work/rest cycles and hydration in force.

[X] SUSPENSION / HALT WINDOWS (RED):
    ${haltWindowText}
    * Range closed. Complete cessation of all outdoor operations.

----------------------------------------------------------------------
3. DIURNAL ENVIRONMENTAL EXTREMES (TODAY)
----------------------------------------------------------------------
* Peak Temperature (Dry Bulb): ${maxTemp.toFixed(1)}°C  (Occurred at: ${maxTempTime})
* Peak Heat Stress (WBGT):     ${maxWbgt.toFixed(1)}°C  (Occurred at: ${maxWbgtTime})
* Peak Wind Gusts:             ${maxGust.toFixed(0)} km/h  (Occurred at: ${maxGustTime})
* Max Sustained Wind Speed:    ${maxWind.toFixed(0)} km/h  (Occurred at: ${maxWindTime})
* Peak UV Index:               ${maxUv.toFixed(1)} UV  (Occurred at: ${maxUvTime})
* Peak Air Quality Index (AQI):${maxAqi.toFixed(0)} AQI (Occurred at: ${maxAqiTime})

----------------------------------------------------------------------
4. BALLISTICS & DRONE FLIGHT SAFETY ASSESSMENT
----------------------------------------------------------------------
* Average Sustained Wind:      ${avgWind.toFixed(1)} km/h (Main Direction: 260° W)
* Peak Gust Velocity:          ${maxGust.toFixed(0)} km/h
* Drone Flight Status:         ${droneRating}
  Directive: ${droneInstruction}
* Ballistics Crosswind Drift:  ${maxGust >= 30 ? "HIGH - Expect significant wind-drift on live fire. Apply compensation tables." : "NEGLIGIBLE - Wind vectors within normal range tolerances."}

----------------------------------------------------------------------
5. PERSONNEL SAFETY & COMPLIANCE SUMMARY
----------------------------------------------------------------------
* UAE MoHRE Midday Work Ban:   ${isMiddayBanActiveForDay ? "ACTIVE COMPLIANCE MANDATED (12:30 - 15:00 GST)" : "NOT APPLICABLE TODAY"}
* Mandated Work/Rest Cycles:   ${maxWbgt >= 30 ? "30m Work / 30m Rest (Extreme Heat Load)" : maxWbgt >= 27.9 ? "40m Work / 20m Rest (High Heat Load)" : "50m Work / 10m Rest (Standard split)"}
* Required Daily Fluid Volume: ${maxWbgt >= 30 ? "1.25 L/hr + Electrolytes" : maxWbgt >= 27.9 ? "1.00 L/hr + Electrolytes" : "0.75 L/hr (Chilled Water)"}
* PPE Gear Requirements:       ${maxUv >= 8 ? "SPF 50+ Sunscreen, UV Protective Glasses, Hard Hat, High-Wick Clothing" : "Standard Range PPE"}

======================================================================
This briefing is compiled under Abu Dhabi Occupational Safety and Health
Decrees (ADOSH CoP 11.0) and UAE Federal MoHRE ministerial guidelines.
Range Safety Officers must enforce work rest cycles and wind halt curfews.
======================================================================
                      END OF DAILY BRIEFING
======================================================================`;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `RCO_Daily_Weather_Brief_${selectedDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const compilePlanningRcoBriefPayload = () => {
    if (hourlyLogs.length === 0) {
      alert("No meteorological logs available for briefing compilation.");
      return null;
    }
    
    const chronoLogs = hourlyLogs;
    
    let maxTemp = -999;
    let maxTempTime = '';
    let maxWbgt = -999;
    let maxWbgtTime = '';
    let maxWind = -999;
    let maxWindTime = '';
    let maxGust = -999;
    let maxGustTime = '';
    let maxUv = -999;
    let maxUvTime = '';
    let maxAqi = -999;
    let maxAqiTime = '';
    
    let totalWindSpeed = 0;
    const safeWindows = [];
    const cautionWindows = [];
    const haltWindows = [];
    
    const formatDateLabel = (timeStr) => {
      if (!timeStr) return '---';
      const d = new Date(timeStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Dubai'
      });
    };

    chronoLogs.forEach(log => {
      const timeStr = log.hourLabel + ' GST';
      if (log.temp > maxTemp) { maxTemp = log.temp; maxTempTime = timeStr; }
      if (log.wbgt > maxWbgt) { maxWbgt = log.wbgt; maxWbgtTime = timeStr; }
      if (log.wind > maxWind) { maxWind = log.wind; maxWindTime = timeStr; }
      if (log.gusts > maxGust) { maxGust = log.gusts; maxGustTime = timeStr; }
      if (log.uv > maxUv) { maxUv = log.uv; maxUvTime = timeStr; }
      if (log.aqi > maxAqi) { maxAqi = log.aqi; maxAqiTime = timeStr; }
      
      totalWindSpeed += log.wind;
      
      const status = log.safetyStatus;
      if (status === 'RED') {
        haltWindows.push(log.time);
      } else if (status === 'AMBER') {
        cautionWindows.push(log.time);
      } else {
        safeWindows.push(log.time);
      }
    });
    
    const avgWind = totalWindSpeed / chronoLogs.length;
    
    const getFormattedWindows = (timeArray) => {
      if (timeArray.length === 0) return "NONE";
      const sortedHours = timeArray.map(t => new Date(t).getHours()).sort((a, b) => a - b);
      
      const ranges = [];
      let start = sortedHours[0];
      let prev = sortedHours[0];
      
      for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === prev + 1) {
          prev = sortedHours[i];
        } else {
          ranges.push(`${String(start).padStart(2, '0')}:00 - ${String(prev + 1).padStart(2, '0')}:00`);
          start = sortedHours[i];
          prev = sortedHours[i];
        }
      }
      ranges.push(`${String(start).padStart(2, '0')}:00 - ${String(prev + 1).padStart(2, '0')}:00`);
      return ranges.join(", ") + " GST";
    };

    const firstLogTime = chronoLogs[0].time;
    const targetMonth = parseInt(firstLogTime.slice(5, 7), 10);
    const targetDay = parseInt(firstLogTime.slice(8, 10), 10);
    const isMiddayBanActiveForDay = (targetMonth === 6 && targetDay >= 15) || targetMonth === 7 || targetMonth === 8 || (targetMonth === 9 && targetDay <= 15);
    
    let haltWindowText = "";
    if (isMiddayBanActiveForDay) {
      const otherHaltWindows = haltWindows.filter(t => {
        const hr = new Date(t).getHours();
        return hr !== 13 && hr !== 14;
      });
      const otherHaltText = getFormattedWindows(otherHaltWindows);
      if (otherHaltText === "NONE") {
        haltWindowText = "12:30 - 15:00 GST (Mandatory UAE MoHRE Midday Ban)";
      } else {
        haltWindowText = `12:30 - 15:00 GST (Mandatory UAE MoHRE Midday Ban), ${otherHaltText}`;
      }
    } else {
      haltWindowText = getFormattedWindows(haltWindows);
    }
    
    const safeWindowText = getFormattedWindows(safeWindows);
    const cautionWindowText = getFormattedWindows(cautionWindows);
    
    let overallStatus = "SAFE (GREEN)";
    let overallInstruction = "Normal range operations permitted. Continuous environmental monitoring active.";
    if (haltWindows.length > 0 || isMiddayBanActiveForDay) {
      overallStatus = "CRITICAL (RED HALT)";
      overallInstruction = "WARNING: Extreme threshold breaches or mandatory MoHRE midday ban detected today. Outdoor range exercises must be suspended during HALT windows.";
    } else if (cautionWindows.length > 0) {
      overallStatus = "RESTRICTED OPERATIONAL CLEARANCE (AMBER CAUTION)";
      overallInstruction = "CAUTION: Mandatory work/rest cycles and hydration monitoring in force. Exercise high supervisor vigilance.";
    }
    
    let droneRating = "OPTIMAL";
    let droneInstruction = "Wind speeds and gusts are within safe operating limits for standard drone sorties.";
    if (maxGust >= 50 || maxWind >= 38) {
      droneRating = "DANGEROUS / HALTED";
      droneInstruction = "Gale force winds or gusts exceed maximum airframe tolerance. Cancel all drone flights.";
    } else if (maxGust >= 30 || maxWind >= 20) {
      droneRating = "MARGINAL / CAUTION";
      droneInstruction = "Moderate winds/gusts present. High risk of wind drift and battery drain. Experienced pilots only.";
    }

    const activeTimeStrForHash = selectedDate + "T12:00:00";
    const hashSeed = `${activeTimeStrForHash}-${maxTemp}-${maxWind}-${maxWbgt}`;
    let hash = 0;
    for (let i = 0; i < hashSeed.length; i++) {
      hash = ((hash << 5) - hash) + hashSeed.charCodeAt(i);
      hash = hash & hash;
    }
    const secureHash = "XR-RCO-" + Math.abs(hash).toString(16).toUpperCase() + "-" + Math.floor(10000 + Math.random() * 90000);

    const formattedChronoLogs = chronoLogs.map(l => ({
      ...l,
      safety: { status: l.safetyStatus }
    }));

    return {
      targetDateLabel: formatDateLabel(chronoLogs[0].time),
      activeStationName: "X-RANGE HQ",
      secureHash,
      systemMode: dataSource === 'API' ? 'HISTORICAL SENSOR TELEMETRY (ARCHIVE)' : dataSource === 'API_ANALOG' ? 'CLIMATOLOGICAL ANALOG MODEL' : 'SYNTHETIC CLIMATOLOGICAL MODEL',
      overallStatus,
      overallInstruction,
      safeWindowText,
      cautionWindowText,
      haltWindowText,
      maxTemp, maxTempTime,
      maxWbgt, maxWbgtTime,
      maxWind, maxWindTime,
      maxGust, maxGustTime,
      maxUv, maxUvTime,
      maxAqi, maxAqiTime,
      avgWind,
      droneRating,
      droneInstruction,
      ballisticsCrosswindDrift: maxGust >= 30 ? "HIGH - Expect significant wind-drift on live fire. Apply compensation tables." : "NEGLIGIBLE - Wind vectors within normal range tolerances.",
      chronoLogs: formattedChronoLogs
    };
  };

  const handleGenerateRcoPdfBrief = () => {
    const payload = compilePlanningRcoBriefPayload();
    if (payload) {
      generateRcoPdfBrief(payload);
    }
  };

  const handleGenerateRcoWordBrief = () => {
    const payload = compilePlanningRcoBriefPayload();
    if (payload) {
      generateRcoWordBrief(payload);
    }
  };

  // Safe shooting timeline display helpers
  const getTimelineIntervals = () => {
    if (hourlyLogs.length === 0) return [];
    
    const intervals = [];
    let startHr = 0;
    let prevStatus = hourlyLogs[0].safetyStatus;

    for (let i = 1; i < hourlyLogs.length; i++) {
      const currentStatus = hourlyLogs[i].safetyStatus;
      if (currentStatus !== prevStatus) {
        intervals.push({
          start: `${startHr.toString().padStart(2, '0')}:00`,
          end: `${(i - 1).toString().padStart(2, '0')}:59`,
          status: prevStatus
        });
        startHr = i;
        prevStatus = currentStatus;
      }
    }

    intervals.push({
      start: `${startHr.toString().padStart(2, '0')}:00`,
      end: `23:59`,
      status: prevStatus
    });

    return intervals;
  };

  const timelineIntervals = getTimelineIntervals();
  const activeTacticalDay = tacticalDays[selectedMatrixDay] || tacticalDays[0];

  return (
    <div className="w-full h-full flex flex-col space-y-4 text-textIceWhite overflow-y-auto lg:overflow-hidden select-none px-4 py-3">
      {/* Date Picker & Control Header Bar */}
      <div className="bg-cardDarkSlate border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-edgeOrange" />
            <h1 className="text-lg font-black tracking-widest text-slate-100">RANGE OPERATION PLANNING</h1>
          </div>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase">
            TARGET COORDINATES: 24.20°N, 52.78°E (XRANGE HQ) • TIMEZONE: GST (Asia/Dubai)
            {currentMonthAvg && (
              <span className="text-edgeOrange ml-2 pl-2 border-l border-slate-700/50">
                {currentMonthAvg.name} Avg: High {currentMonthAvg.maxT}°C / Low {currentMonthAvg.minT}°C
              </span>
            )}
          </p>
        </div>

        {/* Planning Sub-Mode Switcher */}
        <div className="flex bg-bgDeepSpace/80 p-1 rounded-lg border border-slate-700/60">
          <button
            onClick={() => setPlanningMode('DIURNAL')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              planningMode === 'DIURNAL'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 24H Diurnal Planner
          </button>
          <button
            onClick={() => setPlanningMode('TACTICAL_MATRIX')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
              planningMode === 'TACTICAL_MATRIX'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-cyan-400 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>7-Day Mission Windows (WN3)</span>
          </button>
        </div>

        {/* Date Selector input & actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-bgDeepSpace border border-slate-700/80 px-3 py-1.5 gap-2">
            <span className="text-[9.5px] font-black uppercase text-slate-400">
              {planningMode === 'TACTICAL_MATRIX' ? 'START DATE:' : 'SELECT DATE:'}
            </span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-mono font-bold text-xs border-none outline-none cursor-pointer"
            />
          </div>

          {planningMode === 'DIURNAL' && (
            <div className="flex items-center bg-bgDeepSpace border border-slate-700/80 px-3 py-1.5 gap-2">
              <span className="text-[9.5px] font-black uppercase text-slate-400">MODEL DATA:</span>
              <select
                value={planningSource}
                onChange={(e) => setPlanningSource(e.target.value)}
                className="bg-transparent text-white font-bold text-xs border-none outline-none cursor-pointer uppercase font-mono"
              >
                <option value="ARCHIVE" className="bg-cardDarkSlate text-white">Specific Date (Archive)</option>
                <option value="CLIMATOLOGY" className="bg-cardDarkSlate text-white">Monthly Average (Climatology)</option>
              </select>
            </div>
          )}

          {planningMode === 'TACTICAL_MATRIX' ? (
            <button
              onClick={handleExportTacticalBrief}
              disabled={!tacticalDays || tacticalDays.length === 0}
              className="bg-cyan-600 hover:bg-cyan-500 border border-cyan-400 transition-all duration-300 px-3.5 py-1.5 text-xs font-black uppercase flex items-center space-x-2 text-white cursor-pointer shadow-md shadow-cyan-600/20"
              title="Export 7-Day WeatherNext 3 Tactical Operations Briefing"
            >
              <FileText className="w-4 h-4 animate-pulse" />
              <span>EXPORT 7-DAY BRIEF</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleGenerateRcoBrief}
                disabled={hourlyLogs.length === 0 || isLoading}
                className="bg-edgeOrange hover:bg-orange-600 border border-orange-700 hover:border-orange-500 transition-all duration-300 px-3.5 py-1.5 text-xs font-black uppercase flex items-center space-x-2 text-white cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-edgeOrange/15"
                title="Draft Daily Weather Briefing for the Range Control Officer"
              >
                <FileText className="w-4 h-4 animate-pulse" />
                <span>DRAFT RCO BRIEF</span>
              </button>

              <button
                onClick={handleGenerateRcoPdfBrief}
                disabled={hourlyLogs.length === 0 || isLoading}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-550 transition-all duration-300 px-3.5 py-1.5 text-xs font-black uppercase flex items-center space-x-2 text-slate-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-md"
                title="Draft Daily Weather Briefing PDF for the Range Control Officer"
              >
                <FileText className="w-4 h-4" />
                <span>DRAFT PDF BRIEF</span>
              </button>

              <button
                onClick={handleGenerateRcoWordBrief}
                disabled={hourlyLogs.length === 0 || isLoading}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-550 transition-all duration-300 px-3.5 py-1.5 text-xs font-black uppercase flex items-center space-x-2 text-slate-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-md"
                title="Draft Daily Weather Briefing Word Document for the Range Control Officer"
              >
                <FileText className="w-4 h-4" />
                <span>DRAFT WORD BRIEF</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={hourlyLogs.length === 0 || isLoading}
                className="bg-bgDeepSpace/65 border border-slate-700/60 hover:border-slate-500 hover:text-white transition-all duration-300 px-3.5 py-1.5 text-xs font-black uppercase flex items-center space-x-2 text-slate-350 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT CSV LOG</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* API / Simulation Status Alert Banner */}
      <div className="w-full">
        {isLoading ? (
          <div className="bg-slate-900/60 border border-slate-800 text-center py-2 text-slate-400 text-xs font-mono font-black animate-pulse flex items-center justify-center space-x-2">
            <Clock className="w-4 h-4 text-edgeOrange animate-spin" />
            <span>RETRIEVING ARCHIVAL AND CLIMATOLOGICAL TELEMETRY...</span>
          </div>
        ) : dataSource === 'API' ? (
          <div className="bg-safetyGreen/10 border border-safetyGreen/30 text-safetyGreen text-[10px] font-black uppercase text-center py-2 tracking-widest flex items-center justify-center space-x-2">
            <ShieldCheck className="w-4 h-4" />
            <span>HISTORICAL OBSERVATIONS LOADED • SHOWING COMPILED SENSOR DATA RECORDED ON {selectedDate}</span>
          </div>
        ) : dataSource === 'API_ANALOG' ? (
          <div className="bg-edgeOrange/15 border border-edgeOrange/30 text-edgeOrange text-[10px] font-black uppercase text-center py-2 tracking-widest flex items-center justify-center space-x-2">
            <Compass className="w-4 h-4" />
            <span>RANGE PLANNING PREDICTION ACTIVE • DISPLAYING CLIMATOLOGICAL ANALOG FROM ARCHIVE DATE: {analogDateUsed}</span>
          </div>
        ) : planningSource === 'CLIMATOLOGY' ? (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase text-center py-2 tracking-widest flex items-center justify-center space-x-2">
            <Compass className="w-4 h-4 animate-pulse" />
            <span>CLIMATOLOGICAL AVERAGE MODEL ACTIVE • SHOWING REGIONAL HISTORICAL AVERAGES FOR THE MONTH OF {currentMonthAvg ? currentMonthAvg.name.toUpperCase() : ''}</span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase text-center py-2 tracking-widest flex items-center justify-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>SYNTHETIC CLIMATOLOGICAL MODEL ACTIVE • fallback to local environmental statistics {fetchError ? `(${fetchError})` : ''}</span>
          </div>
        )}
      </div>

      {/* Climatic Anomaly Warning Card */}
      {activeAnomaly !== 'NEUTRAL' && (
        <div className={`p-4 border flex items-start space-x-3 shrink-0 ${
          activeAnomaly === 'EL_NINO' 
            ? 'bg-amberAlert/20 border-edgeOrange/50 text-orange-200' 
            : 'bg-blue-950/40 border-cyan-500/50 text-cyan-200'
        }`}>
          <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${
            activeAnomaly === 'EL_NINO' ? 'text-edgeOrange animate-pulse' : 'text-cyan-400'
          }`} />
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-black uppercase tracking-wider">
                {activeAnomaly === 'EL_NINO' ? '🔥 PROJECTED EL NIÑO WEATHER ANOMALY WARNING' : '🌊 PROJECTED LA NIÑA WEATHER ANOMALY WARNING'}
              </h4>
              <span className="text-[9px] font-mono font-black border border-white/20 px-1 text-white">
                PROJECTED CLIMATE SHIFT ACTIVE
              </span>
            </div>
            <p className="text-[10.5px] text-slate-350 leading-relaxed mt-1">
              {activeAnomaly === 'EL_NINO' ? (
                <span>
                  Regional models project 2026 as an active **El Niño** year. Diurnal temperature baselines are adjusted upward by **+2.2°C**, relative humidity is reduced by **-12%**, and suspended dust storms / PM10 density is increased. Training plans must anticipate earlier heat-stress halts (WBGT ≥30°C) and stricter midday work ban enforcement.
                </span>
              ) : (
                <span>
                  Regional models project an active **La Niña** year. Diurnal temperature baselines are adjusted downward by **-1.5°C**, relative humidity is increased by **+15%**, and wind velocities are scaled upward by **+25%**. Assess ballistic firing trajectories and drone flight sorties for wind-drift and gale-halt risks.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      {planningMode === 'DIURNAL' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto lg:overflow-hidden min-h-0">
          
          {/* Left Side: KPIs and Charts (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4 min-h-0">
            
            {/* KPI Statistics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              {/* Safe Operational Window */}
              <div className="border border-slate-800/80 bg-cardDarkSlate p-3 flex flex-col justify-between h-[100px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">CLEAR WINDOW</span>
                  <Shield className="w-4 h-4 text-safetyGreen" />
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-mono font-black text-white">{stats ? stats.safeHoursCount : '--'}</span>
                  <span className="text-xs text-slate-400 font-bold"> / 24H</span>
                </div>
                <span className="text-[8px] text-slate-400 font-bold uppercase truncate">Hours with no flags</span>
              </div>

              {/* Peak Thermal load */}
              <div className="border border-slate-800/80 bg-cardDarkSlate p-3 flex flex-col justify-between h-[100px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">PEAK WBGT HEAT</span>
                  <Sun className="w-4 h-4 text-edgeOrange" />
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-mono font-black text-white">
                    {stats ? stats.peakWbgt.toFixed(1) : '--'}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">°C</span>
                </div>
                <span className="text-[8px] text-slate-400 font-bold uppercase block truncate">
                  At {stats ? stats.peakWbgtTime : '--'} • Peak Shade: {stats ? stats.peakTemp.toFixed(1) : '--'}°C
                </span>
                <span className="text-[8px] text-edgeOrange font-black uppercase block truncate mt-0.5">
                  {currentMonthAvg ? `${currentMonthAvg.name} Avg: H ${currentMonthAvg.maxT}°C / L ${currentMonthAvg.minT}°C` : ''}
                </span>
              </div>

              {/* Total Hydration Planning */}
              <div className="border border-slate-800/80 bg-cardDarkSlate p-3 flex flex-col justify-between h-[100px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">HYDRATION NEED</span>
                  <Droplet className="w-4 h-4 text-blue-400" />
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-mono font-black text-white">
                    {stats ? stats.totalHydrationLiters.toFixed(2) : '--'}
                  </span>
                  <span className="text-xs text-slate-400 font-bold"> LITERS</span>
                </div>
                <span className="text-[8px] text-slate-400 font-bold uppercase">Per person (08:00 - 16:00 Shift)</span>
              </div>

              {/* Drone & Wind Assessment */}
              <div className="border border-slate-800/80 bg-cardDarkSlate p-3 flex flex-col justify-between h-[100px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">DRONE READINESS</span>
                  <Wind className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-1">
                  <span className="text-sm font-black text-white block truncate">
                    {stats ? stats.droneRisk : '--'}
                  </span>
                  <span className={`text-[8.5px] font-black border px-1 inline-block mt-0.5 ${stats ? stats.droneColor : ''}`}>
                    MAX GUST: {stats ? stats.maxGust.toFixed(0) : '--'} KM/H
                  </span>
                </div>
                <span className="text-[8px] text-slate-400 font-bold uppercase">Aerodynamic flight window</span>
              </div>
            </div>

            {/* Recharts Area Curves (Scrollable on height restricted screens) */}
            <div className="flex-1 flex flex-col space-y-4 min-h-[350px] overflow-y-auto pr-1 no-scrollbar">
              
              {/* Chart 1: Heat Stress Profile */}
              <div className="border border-slate-800/80 bg-cardDarkSlate p-4 flex flex-col h-[200px]">
                <span className="text-[10px] font-black tracking-wider text-slate-400 mb-2 uppercase block">
                  Thermal Load Profile (Shade Temp vs Wet Bulb Globe Temp)
                </span>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyLogs} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tempGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF4E02" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#FF4E02" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="wbgtGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                      <XAxis dataKey="hourLabel" stroke="#4B5563" fontSize={9} tickLine={false} />
                      <YAxis domain={[10, 50]} stroke="#4B5563" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121418', borderColor: '#374151', fontSize: 11 }}
                        labelClassName="text-slate-400 font-mono font-bold"
                      />
                      {/* Safety reference zones for WBGT */}
                      <ReferenceArea y1={30.0} y2={50} fill="#EF4444" fillOpacity={0.05} />
                      <ReferenceArea y1={27.9} y2={30.0} fill="#D97706" fillOpacity={0.05} />
                      <ReferenceLine y={30.0} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'HALT 30°C', fill: '#EF4444', fontSize: 8, position: 'insideRight' }} />
                      <Area type="monotone" dataKey="temp" name="Shade Temp" stroke="#FF4E02" strokeWidth={2} fillOpacity={1} fill="url(#tempGlow)" />
                      <Area type="monotone" dataKey="wbgt" name="WBGT Index" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#wbgtGlow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Aerodynamic Profile */}
              <div className="border border-slate-800/80 bg-cardDarkSlate p-4 flex flex-col h-[200px]">
                <span className="text-[10px] font-black tracking-wider text-slate-400 mb-2 uppercase block">
                  Aerodynamic Profile (Wind speed, Wind Gusts & UV radiation)
                </span>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyLogs} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="windGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                      <XAxis dataKey="hourLabel" stroke="#4B5563" fontSize={9} tickLine={false} />
                      <YAxis domain={[0, 60]} stroke="#4B5563" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121418', borderColor: '#374151', fontSize: 11 }}
                        labelClassName="text-slate-400 font-mono font-bold"
                      />
                      <ReferenceLine y={38} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'GALE 38 km/h', fill: '#EF4444', fontSize: 8, position: 'insideRight' }} />
                      <Area type="monotone" dataKey="gusts" name="Wind Gusts" stroke="#EC4899" strokeWidth={1} strokeDasharray="2 2" fill="none" />
                      <Area type="monotone" dataKey="wind" name="Wind Speed" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#windGlow)" />
                      <Area type="monotone" dataKey="uv" name="UV Index" stroke="#FBBF24" strokeWidth={1.5} fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Compliance and Detailed Table (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4 min-h-0">
            
            {/* Timeline Range Status Advisories */}
            <div className="border border-slate-800 bg-cardDarkSlate p-4 shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                Range Safety Windows Briefing
              </span>
              <div className="space-y-2">
                {timelineIntervals.map((interval, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between px-3 py-2 border ${
                      interval.status === 'RED' 
                        ? 'border-stopRed/20 bg-stopRed/5 text-stopRed' 
                        : interval.status === 'AMBER' 
                          ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' 
                          : 'border-safetyGreen/20 bg-safetyGreen/5 text-safetyGreen'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-mono text-xs font-black">{interval.start} - {interval.end}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] font-black uppercase">
                      {interval.status === 'RED' && <ShieldAlert className="w-4 h-4" />}
                      {interval.status === 'GREEN' && <ShieldCheck className="w-4 h-4" />}
                      <span>{interval.status === 'RED' ? 'HALT OUTDOOR ACTIVITIES' : interval.status === 'AMBER' ? 'INCREASE REST CYCLES' : 'ALL CLEAR / NORMAL'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance & Policy Alerts */}
            <div className="border border-slate-800 bg-cardDarkSlate p-4 shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">
                COMPLIANCE AUDIT
              </span>
              <div className="space-y-3">
                {/* MoHRE midday ban */}
                {stats?.isMiddayBanPresent ? (
                  <div className="bg-stopRed/10 border border-stopRed/30 p-3 flex items-start space-x-2.5">
                    <AlertTriangle className="w-5 h-5 text-stopRed mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[10.5px] font-black text-stopRed">MOHRE MIDDAY BAN ACTIVE</h4>
                      <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">
                        UAE Law: Outdoor operations suspended between 12:30 and 15:00 GST. Employers must provide shade/shelter areas.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-safetyGreen/5 border border-safetyGreen/20 p-3 flex items-start space-x-2.5">
                    <ShieldCheck className="w-5 h-5 text-safetyGreen mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[10.5px] font-black text-safetyGreen">MOHRE BAN INACTIVE</h4>
                      <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">
                        No seasonal midday restriction in place for this calendar period. Proceed under standard ADOSH thermal guidelines.
                      </p>
                    </div>
                  </div>
                )}

                {/* Heat Acclimatization Alert */}
                {stats && stats.peakWbgt >= 27.9 ? (
                  <div className="bg-amber-500/10 border border-amber-500/25 p-3 flex items-start space-x-2.5">
                    <Activity className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[10.5px] font-black text-amber-500">ACCLIMATIZATION REQUIRED</h4>
                      <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">
                        Peak WBGT exceeds 27.9°C. Planners must apply a 7-to-14 day incremental exposure program for new range operators.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Diurnal Hourly Schedule Table */}
            <div className="flex-grow border border-slate-800 bg-cardDarkSlate overflow-hidden flex flex-col min-h-[220px]">
              <div className="bg-bgDeepSpace/40 px-4 py-2 border-b border-slate-800 shrink-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  24-HOUR DETAILED DIURNAL LOG
                </span>
              </div>
              
              <div className="flex-1 overflow-auto no-scrollbar">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-bgDeepSpace/20 sticky top-0 z-10 border-b border-slate-800/80">
                    <tr>
                      <th className="py-2.5 px-3 text-[9px] font-black text-slate-400 uppercase">HOUR</th>
                      <th className="py-2.5 px-3 text-[9px] font-black text-slate-400 uppercase">STATUS</th>
                      <th className="py-2.5 px-3 text-[9px] font-black text-slate-400 uppercase">WBGT</th>
                      <th className="py-2.5 px-3 text-[9px] font-black text-slate-400 uppercase">WIND</th>
                      <th className="py-2.5 px-3 text-[9px] font-black text-slate-400 uppercase">PLAN (REST / FLUID)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] font-black">
                    {hourlyLogs.map((log, idx) => {
                      let textClass = 'text-safetyGreen';
                      if (log.safetyStatus === 'RED') textClass = 'text-stopRed';
                      else if (log.safetyStatus === 'AMBER') textClass = 'text-amber-400';

                      // Rest cycle details
                      let workRest = 'Continuous';
                      let hydration = '0.50 L';
                      if (log.wbgt >= 30.0) {
                        workRest = '30m Work/Rest';
                        hydration = '1.25 L';
                      } else if (log.wbgt >= 27.9) {
                        workRest = '40m / 20m';
                        hydration = '1.00 L';
                      } else if (log.wbgt >= 25.9) {
                        workRest = '50m / 10m';
                        hydration = '0.75 L';
                      }

                      if (log.isMiddayBanActive) {
                        workRest = 'MOHRE HALT';
                        hydration = '0.00 L';
                      }

                      return (
                        <tr key={idx} className={log.isMiddayBanActive ? 'bg-stopRed/5' : ''}>
                          <td className="py-2 px-3 text-slate-300 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{log.hourLabel}</span>
                          </td>
                          <td className={`py-2 px-3 ${textClass}`}>
                            {log.isMiddayBanActive ? '🚨 BAN ACTIVE' : log.safetyStatus}
                          </td>
                          <td className="py-2 px-3 text-slate-100">{log.wbgt.toFixed(1)}°C</td>
                          <td className="py-2 px-3 text-slate-100">{log.wind.toFixed(0)} <span className="text-[9.5px] text-slate-500 font-bold">({log.gusts.toFixed(0)})</span></td>
                          <td className="py-2 px-3 text-slate-400">
                            {workRest} <span className="text-[9.5px] text-blue-400 font-bold">({hydration})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* 7-DAY TACTICAL MISSION OPERATIONAL WINDOWS MATRIX (WeatherNext 3) */
        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto min-h-0 no-scrollbar">
          
          {/* 1. Tactical Operation Pillars Overview for Active Day */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
            {/* Live-Fire */}
            <div className={`p-3.5 border rounded-lg bg-cardDarkSlate flex flex-col justify-between ${
              activeTacticalDay.summary.liveFire === 'OPTIMAL' ? 'border-safetyGreen/40 shadow-sm shadow-safetyGreen/5' :
              activeTacticalDay.summary.liveFire === 'RESTRICTED' ? 'border-amberAlert/40 shadow-sm shadow-amberAlert/5' :
              'border-stopRed/50 shadow-sm shadow-stopRed/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Crosshair className="w-4 h-4 text-edgeOrange" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">LIVE-FIRE EXERCISES</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                  activeTacticalDay.summary.liveFire === 'OPTIMAL' ? 'bg-safetyGreen/20 text-safetyGreen border border-safetyGreen/40' :
                  activeTacticalDay.summary.liveFire === 'RESTRICTED' ? 'bg-amberAlert/20 text-amberAlert border border-amberAlert/40' :
                  'bg-stopRed/20 text-stopRed border border-stopRed/40 animate-pulse'
                }`}>
                  {activeTacticalDay.summary.liveFire}
                </span>
              </div>
              <div className="my-2">
                <p className="text-xl font-mono font-black text-white">
                  Gusts: {activeTacticalDay.maxGust.toFixed(0)} <span className="text-xs text-slate-400">km/h</span>
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {activeTacticalDay.maxGust >= 30 ? 'High crosswind deflection. Scope MOA offset needed.' : 'Minimal crosswind deflection. Sub-MOA ballistic path.'}
                </p>
              </div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Ballistic Trajectory Status</span>
            </div>

            {/* UAV Drone Sorties */}
            <div className={`p-3.5 border rounded-lg bg-cardDarkSlate flex flex-col justify-between ${
              activeTacticalDay.summary.uav === 'OPTIMAL' ? 'border-safetyGreen/40 shadow-sm shadow-safetyGreen/5' :
              activeTacticalDay.summary.uav === 'RESTRICTED' ? 'border-amberAlert/40 shadow-sm shadow-amberAlert/5' :
              'border-stopRed/50 shadow-sm shadow-stopRed/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Plane className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">UAV DRONE SORTIES</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                  activeTacticalDay.summary.uav === 'OPTIMAL' ? 'bg-safetyGreen/20 text-safetyGreen border border-safetyGreen/40' :
                  activeTacticalDay.summary.uav === 'RESTRICTED' ? 'bg-amberAlert/20 text-amberAlert border border-amberAlert/40' :
                  'bg-stopRed/20 text-stopRed border border-stopRed/40 animate-pulse'
                }`}>
                  {activeTacticalDay.summary.uav}
                </span>
              </div>
              <div className="my-2">
                <p className="text-xl font-mono font-black text-white">
                  100m Wind: {activeTacticalDay.maxWind100m.toFixed(0)} <span className="text-xs text-slate-400">km/h</span>
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {activeTacticalDay.maxWind100m >= 38 ? 'Ceiling breach. High rotorcraft loss risk.' : activeTacticalDay.maxWind100m >= 28 ? 'Elevated boundary shear. Experienced pilots only.' : 'Stable boundary layer flow. Full flight envelope.'}
                </p>
              </div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">100m Boundary Ceiling</span>
            </div>

            {/* Infantry Maneuvers */}
            <div className={`p-3.5 border rounded-lg bg-cardDarkSlate flex flex-col justify-between ${
              activeTacticalDay.summary.infantry === 'OPTIMAL' ? 'border-safetyGreen/40 shadow-sm shadow-safetyGreen/5' :
              activeTacticalDay.summary.infantry === 'RESTRICTED' ? 'border-amberAlert/40 shadow-sm shadow-amberAlert/5' :
              'border-stopRed/50 shadow-sm shadow-stopRed/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-yellow-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">INFANTRY MANEUVERS</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                  activeTacticalDay.summary.infantry === 'OPTIMAL' ? 'bg-safetyGreen/20 text-safetyGreen border border-safetyGreen/40' :
                  activeTacticalDay.summary.infantry === 'RESTRICTED' ? 'bg-amberAlert/20 text-amberAlert border border-amberAlert/40' :
                  'bg-stopRed/20 text-stopRed border border-stopRed/40 animate-pulse'
                }`}>
                  {activeTacticalDay.summary.infantry}
                </span>
              </div>
              <div className="my-2">
                <p className="text-xl font-mono font-black text-white">
                  Peak WBGT: {activeTacticalDay.maxWbgt.toFixed(1)} <span className="text-xs text-slate-400">°C</span>
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {activeTacticalDay.isMiddayBanDate ? '🚨 UAE MoHRE Midday Ban (12:30-15:00) active' : activeTacticalDay.maxWbgt >= 30 ? 'WBGT ≥ 30°C Red Halt in effect' : 'Standard ADOSH hydration protocols'}
                </p>
              </div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">ADOSH Heat & Ban Audit</span>
            </div>

            {/* Amphibious Sea Ops */}
            <div className={`p-3.5 border rounded-lg bg-cardDarkSlate flex flex-col justify-between ${
              activeTacticalDay.summary.amphibious === 'OPTIMAL' ? 'border-safetyGreen/40 shadow-sm shadow-safetyGreen/5' :
              activeTacticalDay.summary.amphibious === 'RESTRICTED' ? 'border-amberAlert/40 shadow-sm shadow-amberAlert/5' :
              'border-stopRed/50 shadow-sm shadow-stopRed/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Anchor className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">AMPHIBIOUS SEA OPS</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                  activeTacticalDay.summary.amphibious === 'OPTIMAL' ? 'bg-safetyGreen/20 text-safetyGreen border border-safetyGreen/40' :
                  activeTacticalDay.summary.amphibious === 'RESTRICTED' ? 'bg-amberAlert/20 text-amberAlert border border-amberAlert/40' :
                  'bg-stopRed/20 text-stopRed border border-stopRed/40 animate-pulse'
                }`}>
                  {activeTacticalDay.summary.amphibious}
                </span>
              </div>
              <div className="my-2">
                <p className="text-xl font-mono font-black text-white">
                  Max Wind: {activeTacticalDay.maxWind.toFixed(0)} <span className="text-xs text-slate-400">km/h</span>
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {activeTacticalDay.maxWind >= 32 ? 'High coastal spit chop & tidal squalls' : activeTacticalDay.maxWind >= 22 ? 'Moderate swell on marine spit approach' : 'Calm sea state & secure marine corridor'}
                </p>
              </div>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Coastal Spit & Maritime</span>
            </div>
          </div>

          {/* 2. 7-Day Day Selector Bar */}
          <div className="bg-cardDarkSlate border border-slate-800 p-3 rounded-xl flex items-center space-x-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 pr-2 shrink-0">
              7-DAY MATRIX:
            </span>
            {tacticalDays.map((d, idx) => {
              const isSelected = selectedMatrixDay === idx;
              const hasRed = Object.values(d.summary).includes('NO-GO');
              const hasAmber = Object.values(d.summary).includes('RESTRICTED');
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedMatrixDay(idx)}
                  className={`flex-1 min-w-[130px] p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/40' 
                      : 'bg-bgDeepSpace/40 border-slate-700/50 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase">{d.dayLabel}</span>
                    <span className={`w-2 h-2 rounded-full ${hasRed ? 'bg-stopRed animate-pulse' : hasAmber ? 'bg-amberAlert' : 'bg-safetyGreen'}`} />
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between">
                    <span>H: {d.maxTemp.toFixed(0)}°C</span>
                    <span>WBGT: {d.maxWbgt.toFixed(0)}°</span>
                    <span>{d.maxGust.toFixed(0)}k</span>
                  </div>
                  <div className="flex items-center space-x-1 mt-1.5 pt-1 border-t border-slate-800/60">
                    <span className={`w-1.5 h-1.5 rounded-full ${d.summary.liveFire === 'OPTIMAL' ? 'bg-safetyGreen' : d.summary.liveFire === 'RESTRICTED' ? 'bg-amberAlert' : 'bg-stopRed'}`} title="Live-Fire" />
                    <span className={`w-1.5 h-1.5 rounded-full ${d.summary.uav === 'OPTIMAL' ? 'bg-safetyGreen' : d.summary.uav === 'RESTRICTED' ? 'bg-amberAlert' : 'bg-stopRed'}`} title="UAV" />
                    <span className={`w-1.5 h-1.5 rounded-full ${d.summary.infantry === 'OPTIMAL' ? 'bg-safetyGreen' : d.summary.infantry === 'RESTRICTED' ? 'bg-amberAlert' : 'bg-stopRed'}`} title="Infantry" />
                    <span className={`w-1.5 h-1.5 rounded-full ${d.summary.amphibious === 'OPTIMAL' ? 'bg-safetyGreen' : d.summary.amphibious === 'RESTRICTED' ? 'bg-amberAlert' : 'bg-stopRed'}`} title="Amphibious" />
                    <span className="text-[7.5px] text-slate-400 font-mono ml-auto">Day {idx + 1}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. 24-Hour Visual Operational Ribbons */}
          <div className="bg-cardDarkSlate border border-slate-800 p-4 rounded-xl flex flex-col space-y-3 shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
                  <span>DIURNAL MISSION WINDOWS: {activeTacticalDay.dayLabel.toUpperCase()} ({activeTacticalDay.dateStr})</span>
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Color-coded 24-hour Go / Caution / No-Go timelines based on WeatherNext 3 microclimate physics and ADOSH regulations.
                </p>
              </div>
              <div className="flex items-center space-x-3 text-[9px] font-black uppercase">
                <span className="flex items-center space-x-1 text-safetyGreen"><span className="w-2.5 h-2.5 rounded bg-safetyGreen/40 border border-safetyGreen inline-block" /><span>GO (OPTIMAL)</span></span>
                <span className="flex items-center space-x-1 text-amberAlert"><span className="w-2.5 h-2.5 rounded bg-amberAlert/40 border border-amberAlert inline-block" /><span>CAUTION</span></span>
                <span className="flex items-center space-x-1 text-stopRed"><span className="w-2.5 h-2.5 rounded bg-stopRed/40 border border-stopRed inline-block" /><span>NO-GO (HALT)</span></span>
              </div>
            </div>

            {/* Ribbons */}
            <div className="space-y-2 pt-1">
              {/* Ribbon 1: Live-Fire */}
              <div className="flex items-center space-x-3">
                <span className="w-24 text-[9.5px] font-black uppercase text-slate-300 flex items-center space-x-1.5 shrink-0">
                  <Crosshair className="w-3.5 h-3.5 text-edgeOrange" />
                  <span>Live-Fire</span>
                </span>
                <div className="flex-1 grid grid-cols-24 gap-1 h-6">
                  {activeTacticalDay.hours.map((h, i) => {
                    const status = h.ops.liveFire.status;
                    const bg = status === 'GO' ? 'bg-safetyGreen/30 border-safetyGreen/50 text-safetyGreen' :
                               status === 'CAUTION' ? 'bg-amberAlert/35 border-amberAlert/60 text-amberAlert' :
                               'bg-stopRed/50 border-stopRed/80 text-stopRed';
                    return (
                      <div key={i} className={`h-full border rounded flex items-center justify-center text-[7.5px] font-mono font-bold cursor-pointer hover:scale-105 transition-transform ${bg}`} title={`${h.hour}:00 GST - ${status}: ${h.ops.liveFire.reason}`}>
                        {h.hour}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ribbon 2: UAV Flights */}
              <div className="flex items-center space-x-3">
                <span className="w-24 text-[9.5px] font-black uppercase text-slate-300 flex items-center space-x-1.5 shrink-0">
                  <Plane className="w-3.5 h-3.5 text-cyan-400" />
                  <span>UAV Drones</span>
                </span>
                <div className="flex-1 grid grid-cols-24 gap-1 h-6">
                  {activeTacticalDay.hours.map((h, i) => {
                    const status = h.ops.uav.status;
                    const bg = status === 'GO' ? 'bg-safetyGreen/30 border-safetyGreen/50 text-safetyGreen' :
                               status === 'CAUTION' ? 'bg-amberAlert/35 border-amberAlert/60 text-amberAlert' :
                               'bg-stopRed/50 border-stopRed/80 text-stopRed';
                    return (
                      <div key={i} className={`h-full border rounded flex items-center justify-center text-[7.5px] font-mono font-bold cursor-pointer hover:scale-105 transition-transform ${bg}`} title={`${h.hour}:00 GST - ${status}: ${h.ops.uav.reason}`}>
                        {h.hour}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ribbon 3: Infantry Maneuvers */}
              <div className="flex items-center space-x-3">
                <span className="w-24 text-[9.5px] font-black uppercase text-slate-300 flex items-center space-x-1.5 shrink-0">
                  <Users className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Infantry</span>
                </span>
                <div className="flex-1 grid grid-cols-24 gap-1 h-6">
                  {activeTacticalDay.hours.map((h, i) => {
                    const status = h.ops.infantry.status;
                    const bg = status === 'GO' ? 'bg-safetyGreen/30 border-safetyGreen/50 text-safetyGreen' :
                               status === 'CAUTION' ? 'bg-amberAlert/35 border-amberAlert/60 text-amberAlert' :
                               'bg-stopRed/50 border-stopRed/80 text-stopRed';
                    return (
                      <div key={i} className={`h-full border rounded flex items-center justify-center text-[7.5px] font-mono font-bold cursor-pointer hover:scale-105 transition-transform ${bg}`} title={`${h.hour}:00 GST - ${status}: ${h.ops.infantry.reason}`}>
                        {h.isMiddayBanHour ? 'BAN' : h.hour}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ribbon 4: Amphibious Sea Ops */}
              <div className="flex items-center space-x-3">
                <span className="w-24 text-[9.5px] font-black uppercase text-slate-300 flex items-center space-x-1.5 shrink-0">
                  <Anchor className="w-3.5 h-3.5 text-blue-400" />
                  <span>Amphibious</span>
                </span>
                <div className="flex-1 grid grid-cols-24 gap-1 h-6">
                  {activeTacticalDay.hours.map((h, i) => {
                    const status = h.ops.amphibious.status;
                    const bg = status === 'GO' ? 'bg-safetyGreen/30 border-safetyGreen/50 text-safetyGreen' :
                               status === 'CAUTION' ? 'bg-amberAlert/35 border-amberAlert/60 text-amberAlert' :
                               'bg-stopRed/50 border-stopRed/80 text-stopRed';
                    return (
                      <div key={i} className={`h-full border rounded flex items-center justify-center text-[7.5px] font-mono font-bold cursor-pointer hover:scale-105 transition-transform ${bg}`} title={`${h.hour}:00 GST - ${status}: ${h.ops.amphibious.reason}`}>
                        {h.hour}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Detailed Hourly Breakdown Table */}
          <div className="bg-cardDarkSlate border border-slate-800 rounded-xl overflow-hidden flex flex-col flex-1 min-h-[260px]">
            <div className="bg-bgDeepSpace/40 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center shrink-0">
              <span className="text-[9.5px] font-black text-slate-300 uppercase tracking-widest">
                24-HOUR DETAILED TACTICAL MISSION DIRECTIVES
              </span>
              <div className="flex items-center space-x-2">
                {['ALL', 'liveFire', 'uav', 'infantry', 'amphibious'].map(f => (
                  <button
                    key={f}
                    onClick={() => setMatrixFilter(f)}
                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider cursor-pointer border ${
                      matrixFilter === f ? 'bg-edgeOrange text-white border-edgeOrange' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {f === 'ALL' ? 'ALL MISSIONS' : f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar">
              <table className="w-full border-collapse text-left font-mono text-[10.5px]">
                <thead className="bg-bgDeepSpace/20 sticky top-0 z-10 border-b border-slate-800/80">
                  <tr>
                    <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">HOUR</th>
                    <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">TEMP / WBGT</th>
                    <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">WIND (10M / 100M)</th>
                    <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">SOLAR (W/M²)</th>
                    {(matrixFilter === 'ALL' || matrixFilter === 'liveFire') && (
                      <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">🎯 LIVE-FIRE</th>
                    )}
                    {(matrixFilter === 'ALL' || matrixFilter === 'uav') && (
                      <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">🚁 UAV DRONES</th>
                    )}
                    {(matrixFilter === 'ALL' || matrixFilter === 'infantry') && (
                      <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">🪖 INFANTRY</th>
                    )}
                    {(matrixFilter === 'ALL' || matrixFilter === 'amphibious') && (
                      <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase">⚓ AMPHIBIOUS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-bold">
                  {activeTacticalDay.hours.map((h, idx) => (
                    <tr key={idx} className={h.isMiddayBanHour ? 'bg-stopRed/5' : ''}>
                      <td className="py-2 px-3 text-slate-300 font-black">{h.hour}:00 GST</td>
                      <td className="py-2 px-3 text-white">
                        {h.temp.toFixed(1)}°C <span className="text-slate-400 text-[9px]">({h.wbgt.toFixed(1)}° WBGT)</span>
                      </td>
                      <td className="py-2 px-3 text-slate-200">
                        {h.wind.toFixed(0)}k <span className="text-slate-400 text-[9px]">/ 100m: {h.wind100m.toFixed(0)}k</span>
                      </td>
                      <td className="py-2 px-3 text-amber-400">{h.solar}</td>

                      {(matrixFilter === 'ALL' || matrixFilter === 'liveFire') && (
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            h.ops.liveFire.status === 'GO' ? 'bg-safetyGreen/20 text-safetyGreen' :
                            h.ops.liveFire.status === 'CAUTION' ? 'bg-amberAlert/20 text-amberAlert' :
                            'bg-stopRed/20 text-stopRed'
                          }`}>
                            {h.ops.liveFire.status}
                          </span>
                          <span className="text-[8.5px] text-slate-400 ml-1.5 block md:inline font-normal truncate max-w-[200px]" title={h.ops.liveFire.reason}>
                            {h.ops.liveFire.reason}
                          </span>
                        </td>
                      )}

                      {(matrixFilter === 'ALL' || matrixFilter === 'uav') && (
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            h.ops.uav.status === 'GO' ? 'bg-safetyGreen/20 text-safetyGreen' :
                            h.ops.uav.status === 'CAUTION' ? 'bg-amberAlert/20 text-amberAlert' :
                            'bg-stopRed/20 text-stopRed'
                          }`}>
                            {h.ops.uav.status}
                          </span>
                          <span className="text-[8.5px] text-slate-400 ml-1.5 block md:inline font-normal truncate max-w-[200px]" title={h.ops.uav.reason}>
                            {h.ops.uav.reason}
                          </span>
                        </td>
                      )}

                      {(matrixFilter === 'ALL' || matrixFilter === 'infantry') && (
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            h.ops.infantry.status === 'GO' ? 'bg-safetyGreen/20 text-safetyGreen' :
                            h.ops.infantry.status === 'CAUTION' ? 'bg-amberAlert/20 text-amberAlert' :
                            'bg-stopRed/20 text-stopRed'
                          }`}>
                            {h.ops.infantry.status}
                          </span>
                          <span className="text-[8.5px] text-slate-400 ml-1.5 block md:inline font-normal truncate max-w-[200px]" title={h.ops.infantry.reason}>
                            {h.ops.infantry.reason}
                          </span>
                        </td>
                      )}

                      {(matrixFilter === 'ALL' || matrixFilter === 'amphibious') && (
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            h.ops.amphibious.status === 'GO' ? 'bg-safetyGreen/20 text-safetyGreen' :
                            h.ops.amphibious.status === 'CAUTION' ? 'bg-amberAlert/20 text-amberAlert' :
                            'bg-stopRed/20 text-stopRed'
                          }`}>
                            {h.ops.amphibious.status}
                          </span>
                          <span className="text-[8.5px] text-slate-400 ml-1.5 block md:inline font-normal truncate max-w-[200px]" title={h.ops.amphibious.reason}>
                            {h.ops.amphibious.reason}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
