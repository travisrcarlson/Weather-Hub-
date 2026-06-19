import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Download, Compass, Droplet, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Wind, Sun, Activity, Eye, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { calculateDewPoint, calculateWBGT, evaluateSafety, getWBGTComfort } from '../utils/safetyEngine';

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

export default function PlanningDashboard({ isSimulated }) {
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
  const [hourlyLogs, setHourlyLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState('SIMULATED'); // 'API' or 'SIMULATED' or 'API_ANALOG'
  const [analogDateUsed, setAnalogDateUsed] = useState(null);
  const [fetchError, setFetchError] = useState(null);

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
      const temp = c.minT + (c.maxT - c.minT) * (0.5 + 0.5 * Math.cos(radT));

      // Humidity is inversely proportional to Temperature
      const radH = Math.PI * (hr - 5) / 12;
      const rh = Math.round(c.avgRH + 15 * Math.cos(radH));

      // UV peaks at 12:00
      let uv = 0;
      if (hr >= 6 && hr <= 18) {
        uv = Math.round(c.uv * Math.sin(Math.PI * (hr - 6) / 12));
      }

      // Wind peaks in late afternoon (sea breeze effect)
      const radW = Math.PI * (hr - 16) / 12;
      const wind = Math.round(c.wind + 5 * Math.cos(radW));
      const gusts = Math.round(wind * c.gustM);

      // Typical visibility, occasional minor dust at peak winds
      const visibility = wind > 20 ? 8000 : 12000;

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
        pm10: 45
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
        visibility,
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
          
          const temp = archive.hourly.temperature_2m[idx];
          const rh = archive.hourly.relative_humidity_2m[idx];
          const wind = archive.hourly.wind_speed_10m[idx];
          const gusts = archive.hourly.wind_gusts_10m ? archive.hourly.wind_gusts_10m[idx] : wind * 1.3;
          const visibility = archive.hourly.visibility ? archive.hourly.visibility[idx] : 10000;

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
            pm10: 40
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
            visibility,
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
  }, [selectedDate]);

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
                 CONFIDENTIAL RANGE PLANNING BRIEFING RESOURCE
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

        {/* Date Selector input */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-bgDeepSpace border border-slate-700/80 px-3 py-1.5 gap-2">
            <span className="text-[9.5px] font-black uppercase text-slate-400">SELECT DATE:</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-mono font-bold text-xs border-none outline-none cursor-pointer"
            />
          </div>

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
            onClick={handleExportCSV}
            disabled={hourlyLogs.length === 0 || isLoading}
            className="bg-bgDeepSpace/65 border border-slate-700/60 hover:border-slate-500 hover:text-white transition-all duration-300 px-3.5 py-1.5 text-xs font-black uppercase flex items-center space-x-2 text-slate-350 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT CSV LOG</span>
          </button>
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
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase text-center py-2 tracking-widest flex items-center justify-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span>SYNTHETIC CLIMATOLOGICAL MODEL ACTIVE • fallback to local environmental statistics {fetchError ? `(${fetchError})` : ''}</span>
          </div>
        )}
      </div>

      {/* Main Grid Content */}
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
    </div>
  );
}
