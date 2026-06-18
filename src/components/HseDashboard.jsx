import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Shield, FileText, Clock, AlertTriangle, Download, Info, Calendar } from 'lucide-react';
import { calculateDewPoint, calculateWBGT, evaluateSafety, calculateSunscreenIntervals } from '../utils/safetyEngine';

export default function HseDashboard({ data, hourlyData, currentTime, activeStation, isSimulated }) {
  const [selectedAuditIdx, setSelectedAuditIdx] = useState(0);

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
  for (let i = 0; i < 24; i++) {
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
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-bgDeepSpace/60 border border-slate-700/50 hover:border-slate-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
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
              <span>24-Hour Safety Audit Log (Chronological)</span>
            </span>
            <span className="text-[9px] text-slate-500 font-extrabold uppercase">
              Select any hour to inspect compliance
            </span>
          </div>

          {/* Scrollable Audit Table */}
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
        </div>

        {/* Right Side: Selected Hour HSE Audit Detail & Incident Report Generator (Col-span-5) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col justify-between space-y-3 min-h-0">
          
          {/* Top Panel: HSE Selected Audit Incident Report */}
          <div className="flex-1 bg-cardDarkSlate border border-slate-800/85 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden min-h-0">
            <div className="absolute inset-0 bg-[radial-gradient(#80808003_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            
            <div>
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-3 flex-none">
                <FileText className="w-5 h-5 text-edgeOrange" />
                <h2 className="text-sm font-bold text-textIceWhite uppercase tracking-wide">
                  HSE Weather Accident Audit Report
                </h2>
              </div>

              {/* Selected Hour Details */}
              <div className="space-y-3 overflow-y-auto no-scrollbar max-h-[300px] pr-1">
                {/* Audit Timestamp Banner */}
                <div className="flex justify-between items-center bg-bgDeepSpace/40 p-2 rounded border border-slate-800/60 text-[9.5px]">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-bold uppercase">
                    <Calendar className="w-4 h-4 text-edgeOrange" />
                    <span>{formatDateLabel(selectedAudit.time)}</span>
                  </div>
                  <div className="font-mono font-black text-textIceWhite">
                    {formatTimeLabel(selectedAudit.time)}
                  </div>
                </div>

                {/* Audit Parameters Grid */}
                <div className="grid grid-cols-2 gap-2 text-[8px]">
                  <div className="bg-bgDeepSpace/30 p-2 rounded border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">Dry Bulb / WBGT</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {selectedAudit.temp.toFixed(1)}°C / {selectedAudit.wbgt.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="bg-bgDeepSpace/30 p-2 rounded border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">Wind / Peak Gusts</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {selectedAudit.wind.toFixed(0)} / {selectedAudit.gusts.toFixed(0)} km/h
                    </span>
                  </div>
                  <div className="bg-bgDeepSpace/30 p-2 rounded border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">Visibility Index</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {(selectedAudit.visibility / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <div className="bg-bgDeepSpace/30 p-2 rounded border border-slate-800/40">
                    <span className="text-slate-500 font-bold uppercase block mb-0.5">UV Radiation / AQI</span>
                    <span className="text-xs font-mono font-black text-textIceWhite">
                      {selectedAudit.uv.toFixed(1)} UV / {selectedAudit.aqi.toFixed(0)} AQI
                    </span>
                  </div>
                </div>

                {/* ADOSH Directive Card */}
                <div className={`p-3 rounded-lg border flex items-start space-x-2.5 ${
                  selectedAudit.safety.status === 'RED' ? 'bg-red-500/10 border-red-500/35 text-red-200' :
                  selectedAudit.safety.status === 'AMBER' ? 'bg-amber-500/10 border-amber-500/35 text-amberAlert' :
                  'bg-green-500/10 border-green-500/35 text-green-200'
                }`}>
                  {selectedAudit.safety.status === 'GREEN' ? (
                    <ShieldCheck className="w-5 h-5 flex-none mt-0.5 animate-bounce-slow" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 flex-none mt-0.5 animate-pulse" />
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
                <div className="bg-slate-900/40 border border-slate-800 p-2.5 rounded-lg text-[9px] space-y-2">
                  {/* MoHRE Work/Rest Split */}
                  {(() => {
                    const wr = getWorkRestDirective(selectedAudit.temp, selectedAudit.wbgt);
                    return (
                      <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5">
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
                  <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5">
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
                    <span className="text-textIceWhite font-extrabold text-right text-[8.5px] max-w-[200px] leading-tight">
                      {getPpeRequirement(selectedAudit.uv, selectedAudit.temp)}
                    </span>
                  </div>
                </div>

                {/* Regulatory Breach Log */}
                {selectedAudit.breaches.length > 0 && (
                  <div className="border border-red-500/25 bg-red-950/20 p-2.5 rounded-lg flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-stopRed mt-0.5 flex-none animate-pulse" />
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
            <div className="border-t border-slate-800 pt-2 flex items-center space-x-1.5 flex-none mt-2">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[7.5px] font-bold text-slate-500 uppercase leading-snug">
                This log is a tamper-proof timestamp record generated by Open-Meteo GPS Grid & local Abu Al Abyad Island telemetry. Grounded in UAE Federal MoHRE ministerial decrees.
              </span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
