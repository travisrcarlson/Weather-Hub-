import React from 'react';
import { GlassWater, Sun, Flame, Timer, Moon } from 'lucide-react';
import { calculateWBGT, calculateSunscreenIntervals } from '../utils/safetyEngine';

export default function TvGuidelinesWidget({ data, isMobile = false }) {
  if (!data) return null;

  const temp = data.temperature_2m || 0;
  const rh = data.relative_humidity_2m || 0;
  const wind = data.wind_speed_10m || 0;
  const uv = data.uv_index !== undefined ? data.uv_index : 0;
  const solar = data.solar_radiation ?? null;
  
  const wbgt = calculateWBGT(temp, rh, wind, uv, solar);

  // 1. Sunscreen & Solar PPE Guidelines
  const getSunscreenInfo = (uvIndex) => {
    if (uvIndex <= 0.2) {
      return {
        spf: "NIGHT OPS • ZERO SOLAR UV",
        interval: "No sunscreen required until dawn",
        shortSpf: "NIGHT / NO UV",
        shortNote: "High-Vis & Night Optics",
        level: "NIGHT CLEAR",
        color: "text-sky-400",
        isNightUv: true
      };
    }

    const sunscreen = calculateSunscreenIntervals(uvIndex);
    const pct = Math.round((1 - sunscreen.factor) * 100);
    const reductionStr = pct > 0 ? ` (${pct}% UV reduction)` : '';

    if (uvIndex <= 2) {
      return { 
        spf: "SPF 30 RECOMMENDED", 
        interval: `${sunscreen.spf30} mins${reductionStr}`, 
        shortSpf: "SPF 30",
        shortNote: `Reapply ${sunscreen.spf30}m`,
        level: "LOW RISK", 
        color: "text-safetyGreen" 
      };
    }
    if (uvIndex <= 5) {
      return { 
        spf: "SPF 30+ MANDATORY", 
        interval: `${sunscreen.spf30} mins${reductionStr}`, 
        shortSpf: "SPF 30+",
        shortNote: `Reapply ${sunscreen.spf30}m`,
        level: "MODERATE RISK", 
        color: "text-yellow-400" 
      };
    }
    if (uvIndex <= 7) {
      return { 
        spf: "SPF 30+ OR SPF 50 REQUIRED", 
        interval: `${sunscreen.spf50} mins (SPF 50) / ${sunscreen.spf30} mins (SPF 30)${reductionStr}`, 
        shortSpf: "SPF 50 REQ",
        shortNote: `Reapply ${sunscreen.spf50}m`,
        level: "HIGH RISK", 
        color: "text-amberAlert" 
      };
    }
    if (uvIndex <= 10) {
      return { 
        spf: "SPF 50+ MANDATORY", 
        interval: `${sunscreen.spf50} mins${reductionStr}`, 
        shortSpf: "SPF 50+ MAX",
        shortNote: `Reapply ${sunscreen.spf50}m`,
        level: "VERY HIGH RISK", 
        color: "text-stopRed" 
      };
    }
    return { 
      spf: "SPF 50+ MANDATORY (MAX)", 
      interval: `${sunscreen.spf50} mins${reductionStr}`, 
      shortSpf: "SPF 50+ EXTREME",
      shortNote: `Reapply ${sunscreen.spf50}m`,
      level: "EXTREME RISK", 
      color: "text-purple-400 animate-pulse" 
    };
  };

  // 2. Hydration Guidelines (Based on ISO 7243 WBGT standards)
  const getHydrationInfo = (wbgtVal) => {
    if (wbgtVal < 25.9) {
      return { volume: "0.5 Liters / hr", shortVol: "0.5 L/hr", note: "Routine intake. Chilled water recommended.", shortNote: "Routine Chilled Water", color: "text-safetyGreen" };
    }
    if (wbgtVal < 27.9) {
      return { volume: "0.75 Liters / hr", shortVol: "0.75 L/hr", note: "Keep chilled water nearby. Drink constantly.", shortNote: "Drink Every 20m", color: "text-yellow-300" };
    }
    if (wbgtVal < 30.0) {
      return { volume: "1.00 Liter / hr", shortVol: "1.0 L/hr", note: "Chilled water + Electrolyte mix recommended.", shortNote: "Water + Electrolytes", color: "text-amber-400" };
    }
    return { volume: "1.25 Liters / hr", shortVol: "1.25 L/hr", note: "Electrolyte mix mandatory. Monitor buddy status.", shortNote: "Mandatory Electrolytes", color: "text-stopRed font-bold animate-pulse" };
  };

  // 3. Work/Rest Guidelines (ADOSH Heat Stress Safety Advisor based on WBGT flags)
  const getRestInfo = (wbgtVal) => {
    if (wbgtVal < 25.9) {
      return { work: "Continuous", rest: "Normal breaks", ratio: "Continuous Work", shortRatio: "Continuous", shortNote: "Normal Shade Breaks", color: "text-safetyGreen" };
    }
    if (wbgtVal < 27.9) {
      return { work: "50 Minutes", rest: "10 Minutes", ratio: "50m Work / 10m Rest", shortRatio: "50m / 10m", shortNote: "10m Shade / Hr", color: "text-yellow-400" };
    }
    if (wbgtVal < 30.0) {
      return { work: "40 Minutes", rest: "20 Minutes", ratio: "40m Work / 20m Rest", shortRatio: "40m / 20m", shortNote: "20m Mandatory Shade", color: "text-amberAlert" };
    }
    return { work: "30 Minutes", rest: "30 Minutes", ratio: "30m Work / 30m Rest", shortRatio: "30m / 30m", shortNote: "30m Mandatory Shade", color: "text-stopRed animate-pulse" };
  };

  const sunscreen = getSunscreenInfo(uv);
  const hydration = getHydrationInfo(wbgt);
  const rest = getRestInfo(wbgt);

  if (isMobile) {
    return (
      <div className="w-full bg-slate-950/80 border border-slate-800/85 p-3 backdrop-blur-md shadow-lg select-none">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5 mb-2.5">
          <div>
            <p className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest leading-none">
              ADOSH FIELD SAFETY DIRECTIVES • WBGT {wbgt.toFixed(1)}°C
            </p>
          </div>
          <span className="bg-edgeOrange/20 border border-edgeOrange/40 text-edgeOrange px-1.5 py-0.5 text-[7.5px] font-black uppercase tracking-wider">
            MANDATORY PPE / REST
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Work / Rest Tile */}
          <div className="bg-slate-900/70 border border-slate-800/80 p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">
              <span>WORK / REST</span>
              <Flame className="w-3 h-3 text-orange-400" />
            </div>
            <p className={`text-xs font-black font-mono leading-tight ${rest.color}`}>
              {rest.shortRatio}
            </p>
            <p className="text-[7.5px] font-bold text-slate-400 uppercase mt-0.5 truncate">
              {rest.shortNote}
            </p>
          </div>

          {/* Hydration Tile */}
          <div className="bg-slate-900/70 border border-slate-800/80 p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">
              <span>HYDRATION</span>
              <GlassWater className="w-3 h-3 text-sky-400" />
            </div>
            <p className={`text-xs font-black font-mono leading-tight ${hydration.color}`}>
              {hydration.shortVol}
            </p>
            <p className="text-[7.5px] font-bold text-slate-400 uppercase mt-0.5 truncate">
              {hydration.shortNote}
            </p>
          </div>

          {/* UV / PPE Tile */}
          <div className="bg-slate-900/70 border border-slate-800/80 p-2 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">
              <span>UV / PPE</span>
              {sunscreen.isNightUv ? (
                <Moon className="w-3 h-3 text-sky-400" />
              ) : (
                <Sun className="w-3 h-3 text-yellow-400" />
              )}
            </div>
            <p className={`text-xs font-black font-mono leading-tight ${sunscreen.color}`}>
              {sunscreen.shortSpf}
            </p>
            <p className="text-[7.5px] font-bold text-slate-400 uppercase mt-0.5 truncate">
              {sunscreen.shortNote}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md shadow-2xl flex flex-col justify-between select-none">
      
      {/* Title */}
      <div className="border-b border-slate-800/50 pb-2 mb-1.5 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
            ADOSH FIELD ADVISORY (ISO 7243 WBGT)
          </p>
          <h2 className="text-sm font-bold text-slate-200">Actionable Safety Recommendations</h2>
        </div>
        <span className="bg-edgeOrange/20 border border-edgeOrange/30 text-edgeOrange px-2 py-0.5 rounded text-[9px] font-bold uppercase">
          LIVE DIRECTIVES
        </span>
      </div>

      {/* 3 Guideline Sections */}
      <div className="space-y-4 my-1 flex-grow flex flex-col justify-around">
        
        {/* Sun Protection Block */}
        <div className="flex items-start space-x-3.5">
          <div className={`p-2 rounded-lg border mt-0.5 ${sunscreen.isNightUv ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
            {sunscreen.isNightUv ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div className="flex-grow">
            <div className="flex justify-between items-baseline">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SUN & OPTICAL PROTECTION</h3>
              <span className={`text-[9px] font-black uppercase ${sunscreen.color}`}>{sunscreen.level}</span>
            </div>
            <p className="text-base font-black text-textIceWhite tracking-wide mt-0.5 leading-none">
              {sunscreen.spf}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase flex items-center space-x-1">
              <Timer className="w-3 h-3 text-slate-500" />
              <span>{sunscreen.isNightUv ? 'STATUS:' : 'REAPPLY EVERY:'} <span className="text-textIceWhite">{sunscreen.interval}</span></span>
            </p>
          </div>
        </div>

        {/* Hydration Directive */}
        <div className="flex items-start space-x-3.5 border-t border-slate-800/30 pt-3.5">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 mt-0.5">
            <GlassWater className="w-5 h-5" />
          </div>
          <div className="flex-grow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">HYDRATION REQUIREMENT</h3>
            <p className="text-base font-black text-textIceWhite tracking-wide mt-0.5 leading-none">
              {hydration.volume}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase leading-snug">
              {hydration.note}
            </p>
          </div>
        </div>

        {/* Rest Break Split Directive */}
        <div className="flex items-start space-x-3.5 border-t border-slate-800/30 pt-3.5">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 mt-0.5">
            <Flame className="w-5 h-5" />
          </div>
          <div className="flex-grow">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">WORK / REST RATIO</h3>
            <p className="text-base font-black text-textIceWhite tracking-wide mt-0.5 leading-none">
              {rest.ratio}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase leading-snug">
              Mandatory rest periods must be taken in <span className="text-edgeOrange font-black">designated shade</span>.
            </p>
          </div>
        </div>

      </div>

      {/* Safety Standard Footer Note */}
      <div className="border-t border-slate-800/40 pt-2 text-center">
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
          REGULATED REGULATORY HEAT SHIELD • ADOSH-SF COMPLIANT
        </p>
      </div>

    </div>
  );
}
