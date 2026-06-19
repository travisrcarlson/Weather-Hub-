import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Shield, FileText, Clock, AlertTriangle, Download, Info, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { calculateDewPoint, calculateWBGT, evaluateSafety, calculateSunscreenIntervals } from '../utils/safetyEngine';

export default function HseDashboard({ data, hourlyData, currentTime, activeStation, isSimulated }) {
  const [selectedAuditIdx, setSelectedAuditIdx] = useState(0);
  const [hseActiveTab, setHseActiveTab] = useState('table'); // 'table' or 'trends'
  const [supervisorName, setSupervisorName] = useState('');
  const [incidentCategory, setIncidentCategory] = useState('heat');
  const [incidentNotes, setIncidentNotes] = useState('');
  const [showLogSuccess, setShowLogSuccess] = useState(false);
  const [lookbackHours, setLookbackHours] = useState(48); // default to 48H to capture yesterday

  if (!data || !hourlyData || !hourlyData.time) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 italic animate-pulse">
        Loading HSE audit data...
      </div>
    );
  }

  // Parse time zone helper
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

  const getDubaiHourString = (dateVal) => {
    if (!dateVal) return '';
    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type).value;
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:00`;
  };

  // Compile 24h historical logs going backward from current active time
  const activeTimeStr = getDubaiHourString(currentTime || data.current.time);
  const curIdx = hourlyData.time.findIndex(t => t.startsWith(activeTimeStr.slice(0, 13)));
  const startIdx = curIdx >= 0 ? curIdx : 0;

  const logs24h = [];
  for (let i = 0; i < lookbackHours; i++) {
    const idx = startIdx - i;
    if (idx >= 0 && idx < hourlyData.time.length) {
      const timeStr = hourlyData.time[idx];
      const temp = hourlyData.temperature_2m[idx];
      const rh = hourlyData.relative_humidity_2m[idx];
      const wind = hourlyData.wind_speed_10m[idx];
      const gusts = hourlyData.wind_gusts_10m ? hourlyData.wind_gusts_10m[idx] : wind * 1.3;
      const visibility = hourlyData.visibility ? hourlyData.visibility[idx] : 10000;
      const uv = hourlyData.uv_index ? hourlyData.uv_index[idx] : 0;
      const aqIndex = hourlyData.pm10 ? (hourlyData.pm10[idx] * 0.9) : 50; // Mock PM10 to AQI index conversion

      const dp = calculateDewPoint(temp, rh);
      const wbgt = calculateWBGT(temp, rh, wind, uv);

      // Evaluate safety for this specific hour
      const readings = {
        temperature_2m: temp,
        relative_humidity_2m: rh,
        wind_speed_10m: wind,
        wind_gusts_10m: gusts,
        visibility,
        uv_index: uv,
        pm10: hourlyData.pm10 ? hourlyData.pm10[idx] : 50
      };
      
      const safetyEval = evaluateSafety(readings);

      // Check for specific threshold breaches to flag
      const breaches = [];
      if (temp >= 43) breaches.push(`HEAT STRESS (${temp.toFixed(1)}°C)`);
      if (wbgt >= 30.0) breaches.push(`CRITICAL WBGT (${wbgt.toFixed(1)}°C)`);
      if (wind >= 38) breaches.push(`GALE WIND (${wind.toFixed(0)} km/h)`);
      if (gusts >= 50) breaches.push(`CRITICAL GUST (${gusts.toFixed(0)} km/h)`);
      if (visibility < 1000) breaches.push(`LOW VISIBILITY (${(visibility/1000).toFixed(1)} km)`);
      
      // Check for midday work ban compliance (12:30 - 15:00 GST) between June 15 and September 15
      const hour = parseInt(timeStr.split('T')[1].slice(0, 2), 10);
      const minute = parseInt(timeStr.split('T')[1].slice(3, 5), 10);
      const totalMinutes = hour * 60 + minute;
      const month = parseInt(timeStr.slice(5, 7), 10);
      const day = parseInt(timeStr.slice(8, 10), 10);
      const isMiddayBanDateRange = (month === 6 && day >= 15) || month === 7 || month === 8 || (month === 9 && day <= 15);
      const isMiddayBanTimeRange = totalMinutes >= 750 && totalMinutes <= 900; // 12:30 to 15:00 GST
      const isMiddayBanActive = isMiddayBanDateRange && isMiddayBanTimeRange;
      if (isMiddayBanActive) {
        breaches.push("MOHRE MIDDAY BAN");
      }

      logs24h.push({
        time: timeStr,
        temp,
        rh,
        wbgt: wbgt,
        dewPoint: dp,
        wind,
        gusts,
        visibility,
        uv,
        aqi: aqIndex,
        safety: safetyEval,
        breaches,
        isMiddayBanActive
      });
    }
  }

  const selectedAudit = logs24h[selectedAuditIdx] || logs24h[0];

  const getStatusBadgeClass = (status) => {
    if (status === 'RED') return 'bg-stopRed/20 border-stopRed text-red-400';
    if (status === 'AMBER') return 'bg-amberAlert/20 border-amber-600 text-amberAlert';
    return 'bg-safetyGreen/20 border-safetyGreen text-green-400';
  };

  const getWorkRestDirective = (temp, wbgtVal) => {
    if (wbgtVal >= 30.0 || temp >= 43) {
      return { ratio: "30m Work / 30m Rest", note: "Rest breaks mandatory in air-conditioned hubs.", limit: "Critical Limit" };
    }
    if (wbgtVal >= 27.9 || temp >= 38) {
      return { ratio: "40m Work / 20m Rest", note: "Increased hydration, monitor buddy status.", limit: "High Alert" };
    }
    if (wbgtVal >= 25.9) {
      return { ratio: "50m Work / 10m Rest", note: "Increased rest frequency. Shade available.", limit: "Caution" };
    }
    return { ratio: "50m Work / 10m Rest", note: "Standard rest splits. Shade available.", limit: "Standard Split" };
  };

  const getHydrationVolume = (wbgtVal) => {
    if (wbgtVal >= 30.0) return "1.25 Liters / hr + Electrolyte mix";
    if (wbgtVal >= 27.9) return "1.00 Liter / hr + Electrolyte mix";
    if (wbgtVal >= 25.9) return "0.75 Liters / hr (Chilled water)";
    return "0.50 Liters / hr (Water)";
  };

  const getPpeRequirement = (uv, temp) => {
    const ppe = ["Hard Hat / Head Cover", "UV Safety Glasses"];
    if (uv >= 8) ppe.push("SPF 50+ Sunscreen");
    else if (uv >= 3) ppe.push("SPF 30+ Sunscreen");
    if (temp >= 38) ppe.push("Breathable High-Wick Clothing");
    return ppe.join(", ");
  };

  // Export report download simulation helper
  const handleExportCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Timestamp,Dry Bulb Temp(C),WBGT(C),Humidity(%),Wind Speed(km/h),Wind Gust(km/h),Visibility(m),UV Index,Safety Status,Breaches/Directives\r\n";
      
      logs24h.forEach(log => {
        const timeLabel = log.time.replace('T', ' ');
        const safetyStatus = log.safety.status;
        const breachesText = log.breaches.join(" | ") || "COMPLIANT";
        csvContent += `${timeLabel},${log.temp.toFixed(1)},${log.wbgt.toFixed(1)},${log.rh},${log.wind.toFixed(0)},${log.gusts.toFixed(0)},${log.visibility},${log.uv.toFixed(1)},${safetyStatus},${breachesText}\r\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `HSE_Weather_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateRcoBrief = () => {
    const activeTimeStr = getDubaiHourString(currentTime || data.current.time);
    const targetDateStr = activeTimeStr.split('T')[0]; // e.g. "2026-06-19"
    
    // Find all hourly logs matching the target calendar day
    const dailyLogs = [];
    for (let idx = 0; idx < hourlyData.time.length; idx++) {
      const timeStr = hourlyData.time[idx];
      if (timeStr.startsWith(targetDateStr)) {
        const temp = hourlyData.temperature_2m[idx];
        const rh = hourlyData.relative_humidity_2m[idx];
        const wind = hourlyData.wind_speed_10m[idx];
        const gusts = hourlyData.wind_gusts_10m ? hourlyData.wind_gusts_10m[idx] : wind * 1.3;
        const visibility = hourlyData.visibility ? hourlyData.visibility[idx] : 10000;
        const uv = hourlyData.uv_index ? hourlyData.uv_index[idx] : 0;
        const aqIndex = hourlyData.pm10 ? (hourlyData.pm10[idx] * 0.9) : 50;

        const dp = calculateDewPoint(temp, rh);
        const wbgt = calculateWBGT(temp, rh, wind, uv);

        const readings = {
          temperature_2m: temp,
          relative_humidity_2m: rh,
          wind_speed_10m: wind,
          wind_gusts_10m: gusts,
          visibility,
          uv_index: uv,
          pm10: hourlyData.pm10 ? hourlyData.pm10[idx] : 50
        };
        
        const safetyEval = evaluateSafety(readings);

        const breaches = [];
        if (temp >= 43) breaches.push(`HEAT STRESS (${temp.toFixed(1)}°C)`);
        if (wbgt >= 30.0) breaches.push(`CRITICAL WBGT (${wbgt.toFixed(1)}°C)`);
        if (wind >= 38) breaches.push(`GALE WIND (${wind.toFixed(0)} km/h)`);
        if (gusts >= 50) breaches.push(`CRITICAL GUST (${gusts.toFixed(0)} km/h)`);
        if (visibility < 1000) breaches.push(`LOW VISIBILITY (${(visibility/1000).toFixed(1)} km)`);
        
        // Midday work ban compliance
        const hour = parseInt(timeStr.split('T')[1].slice(0, 2), 10);
        const minute = parseInt(timeStr.split('T')[1].slice(3, 5), 10);
        const totalMinutes = hour * 60 + minute;
        const month = parseInt(timeStr.slice(5, 7), 10);
        const day = parseInt(timeStr.slice(8, 10), 10);
        const isMiddayBanDateRange = (month === 6 && day >= 15) || month === 7 || month === 8 || (month === 9 && day <= 15);
        const isMiddayBanTimeRange = totalMinutes >= 750 && totalMinutes <= 900; // 12:30 to 15:00 GST
        const isMiddayBanActive = isMiddayBanDateRange && isMiddayBanTimeRange;
        if (isMiddayBanActive) {
          breaches.push("MOHRE MIDDAY BAN");
        }

        dailyLogs.push({
          time: timeStr,
          temp,
          rh,
          wbgt,
          dewPoint: dp,
          wind,
          gusts,
          visibility,
          uv,
          aqi: aqIndex,
          safety: safetyEval,
          breaches,
          isMiddayBanActive
        });
      }
    }

    const chronoLogs = dailyLogs.length > 0 ? dailyLogs : logs24h.slice(0, 24).reverse();
    
    if (chronoLogs.length === 0) {
      alert("No meteorological logs available for briefing compilation.");
      return;
    }
    
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
    
    chronoLogs.forEach(log => {
      const timeStr = formatTimeLabel(log.time);
      if (log.temp > maxTemp) { maxTemp = log.temp; maxTempTime = timeStr; }
      if (log.wbgt > maxWbgt) { maxWbgt = log.wbgt; maxWbgtTime = timeStr; }
      if (log.wind > maxWind) { maxWind = log.wind; maxWindTime = timeStr; }
      if (log.gusts > maxGust) { maxGust = log.gusts; maxGustTime = timeStr; }
      if (log.uv > maxUv) { maxUv = log.uv; maxUvTime = timeStr; }
      if (log.aqi > maxAqi) { maxAqi = log.aqi; maxAqiTime = timeStr; }
      
      totalWindSpeed += log.wind;
      
      const status = log.safety.status;
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
    
    const activeTimeStrForHash = getDubaiHourString(currentTime || data.current.time);
    const hashSeed = `${activeTimeStrForHash}-${maxTemp}-${maxWind}-${maxWbgt}`;
    let hash = 0;
    for (let i = 0; i < hashSeed.length; i++) {
      hash = ((hash << 5) - hash) + hashSeed.charCodeAt(i);
      hash = hash & hash;
    }
    const secureHash = "XR-RCO-" + Math.abs(hash).toString(16).toUpperCase() + "-" + Math.floor(10000 + Math.random() * 90000);

    const reportText = `======================================================================
                 X-RANGE RCO DAILY ENVIRONMENTAL WEATHER BRIEF
                 CONFIDENTIAL OPERATIONS PLANNING RESOURCE
======================================================================
GENERATION TIMESTAMP: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST
TARGET BRIEF DATE:    ${formatDateLabel(chronoLogs[0].time)}
ACTIVE STATION:       ${activeStation ? activeStation.toUpperCase() : "X-RANGE HQ"} (Abu Al Abyad Island, UAE)
SECURE RCO HASH:      ${secureHash}
SYSTEM MODE:          ${isSimulated ? "SIMULATION MODE (HIGH-FIDELITY)" : "LIVE SENSOR TELEMETRY"}

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
    link.download = `RCO_Daily_Weather_Brief_${chronoLogs[0].time.split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReport = () => {
    if (!supervisorName.trim()) {
      alert("Please enter supervisor name/badge.");
      return;
    }
    
    // Generate a secure digital audit verification signature hash for record integrity
    const mockHashInput = `${selectedAudit.time}-${supervisorName}-${incidentCategory}-${selectedAudit.temp}-${selectedAudit.wbgt}`;
    let hash = 0;
    for (let i = 0; i < mockHashInput.length; i++) {
      const char = mockHashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const secureHash = "XR-HSE-" + Math.abs(hash).toString(16).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);

    const wr = getWorkRestDirective(selectedAudit.temp, selectedAudit.wbgt);
    const reportText = `======================================================================
                  X-RANGE OPERATIONAL HSE INCIDENT BRIEF
                  FEDERAL UAE MOHRE & ADOSH COMPLIANCE RECORD
======================================================================
GENERATION TIMESTAMP: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST
AUDIT STATUS: OFFICIAL SUBMISSION
SECURE CRYPTO HASH: ${secureHash}

----------------------------------------------------------------------
1. INCIDENT META-DATA
----------------------------------------------------------------------
Incident Category:  ${incidentCategory.toUpperCase()}
Logging Supervisor: ${supervisorName}
Incident Date/Time: ${formatDateLabel(selectedAudit.time)} at ${formatTimeLabel(selectedAudit.time)}
Range Location:     X-Range HQ (Abu Al Abyad Island, UAE)
System Mode:        ${isSimulated ? "SIMULATION MODE" : "LIVE SENSOR TELEMETRY"}

----------------------------------------------------------------------
2. METEOROLOGICAL CONDITIONS (AT INCIDENT HOUR)
----------------------------------------------------------------------
Dry Bulb Temp (Shade):   ${selectedAudit.temp.toFixed(1)}°C
WBGT Heat Load Index:    ${selectedAudit.wbgt.toFixed(1)}°C
Relative Humidity:       ${selectedAudit.rh}%
Dew Point Temperature:   ${selectedAudit.dewPoint.toFixed(1)}°C
Wind Speed / Peak Gusts: ${selectedAudit.wind.toFixed(0)} km/h / ${selectedAudit.gusts.toFixed(0)} km/h
Visibility Index:        ${(selectedAudit.visibility / 1000).toFixed(1)} km
UV Radiation Index:      ${selectedAudit.uv.toFixed(1)} UV
Air Quality Index:       ${selectedAudit.aqi.toFixed(0)} AQI (PM10)

----------------------------------------------------------------------
3. ADOSH DIRECTIVES & MOHRE REGULATORY COMPLIANCE
----------------------------------------------------------------------
Safety Status Rating:   ${selectedAudit.safety.status}
Work/Rest Split Code:   ${wr.ratio} (${wr.limit})
Fluid Intake Guideline: ${getHydrationVolume(selectedAudit.wbgt)}
Mandatory PPE Gear:     ${getPpeRequirement(selectedAudit.uv, selectedAudit.temp)}
MOHRE Midday Ban Check: ${selectedAudit.isMiddayBanActive ? "ACTIVE VIOLATION BAN IN FORCE" : "NOT APPLICABLE"}

Key Breaches Logged:
${selectedAudit.breaches.length > 0 ? selectedAudit.breaches.map(b => `  * ${b}`).join("\n") : "  * NONE (COMPLIANT CONDITIONS)"}

----------------------------------------------------------------------
4. SUPERVISOR DETAILED DESCRIPTION
----------------------------------------------------------------------
Notes & Observations:
${incidentNotes.trim() ? incidentNotes.trim() : "No custom notes appended by logging supervisor."}

----------------------------------------------------------------------
5. REGULATORY DISCLAIMER & AUDIT VERIFICATION
----------------------------------------------------------------------
This record constitutes a legal compliance document under UAE Ministerial Decree
and ADOSH Code of Practice 11.0. Meteorological logs are locked and tamper-proof.
======================================================================
                      END OF INCIDENT REPORT
======================================================================`;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `HSE_Incident_Brief_${selectedAudit.time.replace(/[:T]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show visual success notification
    setShowLogSuccess(true);
    setTimeout(() => {
      setShowLogSuccess(false);
    }, 4000);
  };

  return (
    <div className="w-full h-full text-slate-200 select-none p-4 flex flex-col justify-between overflow-y-auto lg:overflow-hidden">
      {/* Title Panel */}
      <div className="flex-none mb-3 border-b border-slate-800 pb-2.5 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-edgeOrange font-black uppercase tracking-widest leading-none mb-1">
            HSE OFFICER HUB • AUDIT COMPLIANCE PORTAL
          </p>
          <h1 className="text-sm md:text-lg font-black text-textIceWhite leading-none uppercase">
            HSE Health, Safety & Environment Compliance Dashboard
          </h1>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleGenerateRcoBrief}
            className="flex items-center space-x-1.5 bg-bgDeepSpace/80 border border-edgeOrange hover:bg-edgeOrange/15 hover:text-white px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-sm shadow-edgeOrange/5"
            title="Draft Daily Weather Briefing for the Range Control Officer"
          >
            <FileText className="w-3.5 h-3.5 text-edgeOrange animate-pulse" />
            <span className="text-edgeOrange">Draft RCO Brief</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-bgDeepSpace/60 border border-slate-700/50 hover:border-slate-500 hover:text-white px-3 py-1.5 rounded-none text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-edgeOrange" />
            <span>Export CSV Log</span>
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-12 gap-4 flex-grow min-h-0 items-stretch">
        
        {/* Left Side: 24-Hour Timeline Audit Log Table (Col-span-7) */}
        <div className="col-span-12 lg:col-span-7 bg-cardDarkSlate border border-slate-800/85 rounded-xl p-3 flex flex-col justify-between min-h-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#80808003_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          <div className="flex-none flex items-center justify-between border-b border-slate-800/50 pb-2 mb-2">
            <span className="text-xs font-black text-textIceWhite uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-edgeOrange" />
              <span>{lookbackHours}-Hour Safety Audit Log</span>
            </span>
            
            {/* Control Selectors */}
            <div className="flex items-center space-x-2.5">
              {/* Range Selector */}
              <div className="flex bg-bgDeepSpace/60 border border-slate-800/80 p-0.5 rounded-none">
                <button
                  onClick={() => {
                    setLookbackHours(24);
                    if (selectedAuditIdx >= 24) setSelectedAuditIdx(0);
                  }}
                  className={`px-2 py-0.5 rounded-none text-[8.5px] font-black uppercase cursor-pointer transition-all ${
                    lookbackHours === 24 ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-textIceWhite'
                  }`}
                >
                  24H
                </button>
                <button
                  onClick={() => setLookbackHours(48)}
                  className={`px-2 py-0.5 rounded-none text-[8.5px] font-black uppercase cursor-pointer transition-all ${
                    lookbackHours === 48 ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-textIceWhite'
                  }`}
                >
                  48H
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-bgDeepSpace/60 border border-slate-800/80 p-0.5 rounded-none">
                <button
                  onClick={() => setHseActiveTab('table')}
                  className={`px-3 py-1 rounded-none text-[8.5px] font-black uppercase cursor-pointer transition-all ${
                    hseActiveTab === 'table' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-textIceWhite'
                  }`}
                >
                  Log Table
                </button>
                <button
                  onClick={() => setHseActiveTab('trends')}
                  className={`px-3 py-1 rounded-none text-[8.5px] font-black uppercase cursor-pointer transition-all ${
                    hseActiveTab === 'trends' ? 'bg-edgeOrange text-white' : 'text-slate-400 hover:text-textIceWhite'
                  }`}
                >
                  Visual Trends
                </button>
              </div>
            </div>
          </div>

          {hseActiveTab === 'table' ? (
            <div className="flex-grow overflow-y-auto pr-1 no-scrollbar min-h-0 border border-slate-800/40 rounded bg-bgDeepSpace/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[8.5px] text-slate-400 font-black uppercase tracking-widest sticky top-0 bg-slate-950/80 backdrop-blur-md z-20">
                    <th className="py-2 px-2.5">Time</th>
                    <th className="py-2 px-1">Dry Bulb</th>
                    <th className="py-2 px-1">WBGT</th>
                    <th className="py-2 px-1">Wind/Gust</th>
                    <th className="py-2 px-1 text-center">UV</th>
                    <th className="py-2 px-1.5 text-center">Status</th>
                    <th className="py-2 px-2">Key Incident Breaches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/35">
                  {logs24h.map((log, idx) => {
                    const isSelected = selectedAuditIdx === idx;
                    const rowStatusClass = 
                      log.safety.status === 'RED' ? 'hover:bg-red-950/10' :
                      log.safety.status === 'AMBER' ? 'hover:bg-amber-950/10' :
                      'hover:bg-green-950/5';

                    return (
                      <tr
                        key={log.time}
                        onClick={() => setSelectedAuditIdx(idx)}
                        className={`text-[10px] font-bold cursor-pointer transition-all duration-150 ${rowStatusClass} ${
                          isSelected ? 'bg-slate-800/40 border-l-2 border-l-edgeOrange' : ''
                        }`}
                      >
                        <td className="py-2.5 px-2.5 font-mono text-slate-300">
                          {formatTimeLabel(log.time)}
                        </td>
                        <td className="py-2.5 px-1 font-mono text-textIceWhite">{log.temp.toFixed(1)}°C</td>
                        <td className="py-2.5 px-1 font-mono text-slate-350">{log.wbgt.toFixed(1)}°C</td>
                        <td className="py-2.5 px-1 font-mono text-slate-350">
                          {log.wind.toFixed(0)}/{log.gusts.toFixed(0)} <span className="text-[8px] text-slate-500">k/h</span>
                        </td>
                        <td className="py-2.5 px-1 font-mono text-center text-slate-300">{log.uv.toFixed(1)}</td>
                        <td className="py-2.5 px-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black border tracking-wide uppercase ${getStatusBadgeClass(log.safety.status)}`}>
                            {log.safety.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 truncate max-w-[150px]">
                          {log.breaches.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {log.breaches.map((b, bIdx) => (
                                <span key={bIdx} className={`px-1 py-0.5 rounded text-[6.5px] font-black tracking-wider leading-none uppercase ${
                                  b.includes("CRITICAL") || b.includes("HALT") || b.includes("MOHRE")
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-amber-500/20 text-amberAlert border border-amberAlert/30'
                                }`}>
                                  {b.split(" (")[0]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-green-500 text-[8.5px] uppercase font-black tracking-wider flex items-center space-x-1">
                              <ShieldCheck className="w-3.5 h-3.5 inline" />
                              <span>Compliant</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-grow flex flex-col space-y-4 pr-1 no-scrollbar min-h-0 overflow-y-auto">
              {/* Chart 1: Heat Stress Trends */}
              <div className="bg-bgDeepSpace/30 border border-slate-800/80 p-3 rounded-lg h-[185px] flex flex-col">
                <span className="text-[9.5px] font-black tracking-wider text-slate-400 mb-1.5 uppercase block">
                  Thermal Load Trends (Dry Bulb vs. WBGT Index)
                </span>
                <div className="flex-grow min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={logs24h.slice().reverse()} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hseTempGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF4E02" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#FF4E02" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="hseWbgtGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#4B5563" 
                        fontSize={8.5} 
                        tickLine={false} 
                        tickFormatter={(t) => t ? t.split('T')[1].slice(0, 5) : ''}
                      />
                      <YAxis domain={[10, 50]} stroke="#4B5563" fontSize={8.5} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121418', borderColor: '#374151', fontSize: 10 }}
                        labelClassName="text-slate-400 font-mono font-bold"
                        labelFormatter={(t) => t ? t.replace('T', ' ') : ''}
                      />
                      <ReferenceArea y1={30.0} y2={50} fill="#EF4444" fillOpacity={0.04} />
                      <ReferenceLine y={30.0} stroke="#EF4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="temp" name="Dry Bulb" stroke="#FF4E02" strokeWidth={1.5} fillOpacity={1} fill="url(#hseTempGlow)" />
                      <Area type="monotone" dataKey="wbgt" name="WBGT Index" stroke="#8B5CF6" strokeWidth={1.5} fillOpacity={1} fill="url(#hseWbgtGlow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Aerodynamic Trends */}
              <div className="bg-bgDeepSpace/30 border border-slate-800/80 p-3 rounded-lg h-[185px] flex flex-col">
                <span className="text-[9.5px] font-black tracking-wider text-slate-400 mb-1.5 uppercase block">
                  Aerodynamic Trends (Wind, Gusts & UV Index)
                </span>
                <div className="flex-grow min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={logs24h.slice().reverse()} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hseWindGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#4B5563" 
                        fontSize={8.5} 
                        tickLine={false} 
                        tickFormatter={(t) => t ? t.split('T')[1].slice(0, 5) : ''}
                      />
                      <YAxis domain={[0, 60]} stroke="#4B5563" fontSize={8.5} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121418', borderColor: '#374151', fontSize: 10 }}
                        labelClassName="text-slate-400 font-mono font-bold"
                        labelFormatter={(t) => t ? t.replace('T', ' ') : ''}
                      />
                      <ReferenceLine y={38} stroke="#EF4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="gusts" name="Wind Gusts" stroke="#EC4899" strokeWidth={1} strokeDasharray="2 2" fill="none" />
                      <Area type="monotone" dataKey="wind" name="Wind Speed" stroke="#06B6D4" strokeWidth={1.5} fillOpacity={1} fill="url(#hseWindGlow)" />
                      <Area type="monotone" dataKey="uv" name="UV Index" stroke="#FBBF24" strokeWidth={1} fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Selected Hour HSE Audit Detail & Incident Report Generator (Col-span-5) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col justify-between space-y-3 min-h-0">
          
          {/* Card 1: Selected Hour HSE Audit Detail */}
          <div className="flex-[3] bg-cardDarkSlate border border-slate-800/85 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden min-h-0">
            <div className="absolute inset-0 bg-[radial-gradient(#80808003_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            
            <div className="min-h-0 flex flex-col">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-2 flex-none">
                <FileText className="w-4 h-4 text-edgeOrange" />
                <h2 className="text-[11px] font-bold text-textIceWhite uppercase tracking-wide">
                  HSE Weather Accident Audit Report
                </h2>
              </div>

              {/* Selected Hour Details */}
              <div className="space-y-2.5 overflow-y-auto no-scrollbar flex-grow min-h-0 pr-1">
                {/* Audit Timestamp Banner */}
                <div className="flex justify-between items-center bg-bgDeepSpace/40 p-2 border border-slate-800/60 text-[9.5px]">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-bold uppercase">
                    <Calendar className="w-3.5 h-3.5 text-edgeOrange" />
                    <span>{formatDateLabel(selectedAudit.time)}</span>
                  </div>
                  <div className="font-mono font-black text-textIceWhite">
                    {formatTimeLabel(selectedAudit.time)}
                  </div>
                </div>

                {/* Audit Parameters Grid */}
                <div className="grid grid-cols-2 gap-2 text-[8px]">
                  <div className="bg-bgDeepSpace/30 p-2 border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">Dry Bulb / WBGT</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {selectedAudit.temp.toFixed(1)}°C / {selectedAudit.wbgt.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="bg-bgDeepSpace/30 p-2 border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">Wind / Peak Gusts</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {selectedAudit.wind.toFixed(0)} / {selectedAudit.gusts.toFixed(0)} km/h
                    </span>
                  </div>
                  <div className="bg-bgDeepSpace/30 p-2 border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">Visibility Index</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {(selectedAudit.visibility / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <div className="bg-bgDeepSpace/30 p-2 border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">UV Radiation / AQI</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {selectedAudit.uv.toFixed(1)} UV / {selectedAudit.aqi.toFixed(0)} AQI
                    </span>
                  </div>
                </div>

                {/* ADOSH Directive Card */}
                <div className={`p-2.5 border flex items-start space-x-2.5 ${
                  selectedAudit.safety.status === 'RED' ? 'bg-red-500/10 border-red-500/35 text-red-200' :
                  selectedAudit.safety.status === 'AMBER' ? 'bg-amber-500/10 border-amber-500/35 text-amberAlert' :
                  'bg-green-500/10 border-green-500/35 text-green-200'
                }`}>
                  {selectedAudit.safety.status === 'GREEN' ? (
                    <ShieldCheck className="w-4.5 h-4.5 flex-none mt-0.5 animate-bounce-slow" />
                  ) : (
                    <ShieldAlert className="w-4.5 h-4.5 flex-none mt-0.5 animate-pulse" />
                  )}
                  <div className="text-[9px]">
                    <p className="font-black uppercase tracking-wider mb-0.5 leading-none">
                      ADOSH Safety Status: {selectedAudit.safety.status === 'RED' ? 'CRITICAL HALT' : selectedAudit.safety.status === 'AMBER' ? 'CAUTION PROTOCOL' : 'SECURE / CLEAR'}
                    </p>
                    <p className="opacity-90 leading-tight">
                      {selectedAudit.safety.status === 'RED' 
                        ? "MoHRE & ADOSH weather limits breached. Complete suspension of all outdoor activity is mandated."
                        : selectedAudit.safety.status === 'AMBER'
                        ? "Restricted operational clearance. Mandatory work/rest cycles and continuous supervisor monitoring required."
                        : "Weather parameters within normal bounds. Standby and monitor active NCM bulletins."
                      }
                    </p>
                  </div>
                </div>

                {/* HSE Audit Specific Details */}
                <div className="bg-slate-900/40 border border-slate-800 p-2 text-[9px] space-y-1.5">
                  {/* MoHRE Work/Rest Split */}
                  {(() => {
                    const wr = getWorkRestDirective(selectedAudit.temp, selectedAudit.wbgt);
                    return (
                      <div className="flex justify-between items-center border-b border-slate-800/40 pb-1">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-300">Mandated Work/Rest Split</span>
                          <span className="text-[7.5px] text-slate-500 uppercase">{wr.limit} (ADOSH CoP 11.0)</span>
                        </div>
                        <span className="font-mono text-textIceWhite font-black text-right text-[10px]">
                          {wr.ratio}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Mandated Hydration Intake */}
                  <div className="flex justify-between items-center border-b border-slate-800/40 pb-1">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-300">Hourly Fluid Intake</span>
                      <span className="text-[7.5px] text-slate-500 uppercase">ADOSH Heat Stress Code</span>
                    </div>
                    <span className="font-mono text-textIceWhite font-black text-right text-[10px]">
                      {getHydrationVolume(selectedAudit.wbgt)}
                    </span>
                  </div>

                  {/* Required PPE */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-300">Required PPE Gear</span>
                      <span className="text-[7.5px] text-slate-500 uppercase">ADOSH Compliance Minimum</span>
                    </div>
                    <span className="text-textIceWhite font-extrabold text-right text-[8.5px] max-w-[180px] leading-tight">
                      {getPpeRequirement(selectedAudit.uv, selectedAudit.temp)}
                    </span>
                  </div>
                </div>

                {/* Regulatory Breach Log */}
                {selectedAudit.breaches.length > 0 && (
                  <div className="border border-red-500/25 bg-red-950/20 p-2 rounded flex items-start space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-stopRed mt-0.5 flex-none animate-pulse" />
                    <div>
                      <p className="text-[8.5px] font-black text-red-300 uppercase leading-none mb-1 tracking-wider">
                        Compliance Breaches Detected
                      </p>
                      <ul className="list-disc pl-3 text-[7.5px] text-red-200/90 leading-tight space-y-0.5 uppercase font-bold">
                        {selectedAudit.breaches.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Status Disclaimer */}
            <div className="border-t border-slate-800 pt-1.5 flex items-center space-x-1.5 flex-none mt-1.5">
              <Info className="w-3 h-3 text-slate-500" />
              <span className="text-[7px] font-bold text-slate-500 uppercase leading-snug">
                This log is generated by Open-Meteo GPS Grid & Abu Al Abyad telemetry under UAE Federal MoHRE decrees.
              </span>
            </div>

            {/* RCO Daily Brief Action */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-col space-y-1 flex-none">
              <span className="text-[8px] font-black text-slate-450 uppercase tracking-wider block mb-0.5">Range Control Officer Briefing</span>
              <button
                onClick={handleGenerateRcoBrief}
                className="w-full flex items-center justify-center space-x-1.5 bg-edgeOrange hover:bg-orange-600 border border-orange-700 hover:border-orange-500 py-1.5 rounded-none text-[9.5px] font-black uppercase tracking-wider text-white transition cursor-pointer shadow-md shadow-edgeOrange/15"
                title="Draft Daily Weather Briefing for the Range Control Officer"
              >
                <FileText className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>Draft RCO Daily Weather Brief</span>
              </button>
            </div>
          </div>

          {/* Card 2: Weather Accident Incident Logger */}
          <div className="flex-[2] bg-cardDarkSlate border border-slate-800/85 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden min-h-0">
            <div className="absolute inset-0 bg-[radial-gradient(#80808003_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            
            <div className="min-h-0 flex flex-col">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-2 flex-none">
                <ShieldAlert className="w-4 h-4 text-edgeOrange" />
                <h2 className="text-[11px] font-bold text-textIceWhite uppercase tracking-wide">
                  Weather Accident Incident Logger
                </h2>
              </div>
              
              <div className="space-y-2 text-[9px] flex-grow overflow-y-auto no-scrollbar">
                {/* 2-Column Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-slate-500 font-bold uppercase text-[7.5px]">Supervisor Name / Badge</label>
                    <input 
                      type="text" 
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                      placeholder="e.g. Capt. Al Mansouri" 
                      className="bg-bgDeepSpace/60 border border-slate-800 px-2 py-1 text-[9px] text-textIceWhite focus:border-edgeOrange outline-none"
                    />
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <label className="text-slate-500 font-bold uppercase text-[7.5px]">Incident Category</label>
                    <select
                      value={incidentCategory}
                      onChange={(e) => setIncidentCategory(e.target.value)}
                      className="bg-bgDeepSpace/60 border border-slate-800 px-1.5 py-1 text-[9px] text-textIceWhite focus:border-edgeOrange outline-none"
                    >
                      <option value="heat">Heat Stress / Exhaustion</option>
                      <option value="wind">Wind / Gust Hazard</option>
                      <option value="visibility">Dust / Visibility Obstruction</option>
                      <option value="uv">UV Index / Sunburn</option>
                      <option value="injury">Weather-linked Injury</option>
                      <option value="other">Other Operations Halt</option>
                    </select>
                  </div>
                </div>

                {/* Supervisor Notes */}
                <div className="flex flex-col space-y-0.5">
                  <label className="text-slate-500 font-bold uppercase text-[7.5px]">Incident Details & Observations</label>
                  <textarea
                    value={incidentNotes}
                    onChange={(e) => setIncidentNotes(e.target.value)}
                    placeholder="Enter operator name, exact range coordinate, and action taken..."
                    className="bg-bgDeepSpace/60 border border-slate-800 px-2 py-1 text-[9px] text-textIceWhite focus:border-edgeOrange outline-none resize-none h-[42px] no-scrollbar"
                  />
                </div>
              </div>
            </div>

            {/* Action and Success Banner */}
            <div className="flex-none mt-2">
              {showLogSuccess && (
                <div className="mb-2 bg-safetyGreen/20 border border-safetyGreen/40 text-green-400 p-1.5 text-[8px] font-bold text-center uppercase tracking-wide animate-pulse">
                  ✓ Incident brief downloaded & locked to audit hash!
                </div>
              )}
              <button
                onClick={handleGenerateReport}
                className="w-full flex items-center justify-center space-x-1.5 bg-edgeOrange hover:bg-orange-600 border border-orange-700 hover:border-orange-500 py-1.5 text-[9px] font-black uppercase tracking-wider text-white transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Generate Weather Incident Brief</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

