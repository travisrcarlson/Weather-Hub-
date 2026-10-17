import React from 'react';
import { Thermometer, Sun, Flame } from 'lucide-react';
import { getTrendIndicator, calculateWBGT } from '../utils/safetyEngine';

export default function TvCoreMetricsWidget({ currentData, extremes, hourlyData }) {
  if (!currentData || !extremes) return null;

  const curTemp = currentData.temperature_2m;
  const maxTemp = Math.max(curTemp ?? 0, extremes.maxTemp ?? 0);
  const curRh = currentData.relative_humidity_2m ?? 0;
  const curWind = currentData.wind_speed_10m ?? 0;
  const curUv = currentData.uv_index !== undefined ? currentData.uv_index : 0;
  const curSolar = currentData.solar_radiation ?? null;

  const curWbgt = calculateWBGT(curTemp, curRh, curWind, curUv, curSolar);
  const maxWbgt = Math.max(curWbgt ?? 0, extremes.maxWbgt ?? curWbgt);

  const maxUv = Math.max(curUv ?? 0, extremes.maxUv ?? 0);

  // Calculate trends compared to previous hour
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !currentData.time) return -1;
    const curHourStr = currentData.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  
  const prevTemp = prevIdx >= 0 ? hourlyData.temperature_2m[prevIdx] : null;
  const tempTrend = getTrendIndicator(curTemp, prevTemp, 0.1);
  
  let prevWbgt = null;
  if (prevIdx >= 0 && hourlyData.temperature_2m && hourlyData.relative_humidity_2m) {
    const prevT = hourlyData.temperature_2m[prevIdx];
    const prevRhVal = hourlyData.relative_humidity_2m[prevIdx];
    const prevWindVal = hourlyData.wind_speed_10m ? hourlyData.wind_speed_10m[prevIdx] : 0;
    const prevUvVal = hourlyData.uv_index ? hourlyData.uv_index[prevIdx] : 0;
    const prevSolarVal = hourlyData.solar_radiation ? hourlyData.solar_radiation[prevIdx] : null;
    prevWbgt = calculateWBGT(prevT, prevRhVal, prevWindVal, prevUvVal, prevSolarVal);
  }
  const wbgtTrend = getTrendIndicator(curWbgt, prevWbgt, 0.1);

  const prevUv = (prevIdx >= 0 && hourlyData.uv_index) ? hourlyData.uv_index[prevIdx] : null;
  const uvTrend = getTrendIndicator(curUv, prevUv, 0.2);

  return (
    <div className="w-full h-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 backdrop-blur-md shadow-lg flex flex-col justify-between select-none overflow-hidden">
      {/* Header Row with Unified Legend */}
      <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5 mb-2 flex-none gap-2">
        <div className="min-w-0">
          <p className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5 truncate">
            DAILY EXTREMES OUTLOOK
          </p>
          <h2 className="text-[11px] font-bold text-slate-200 leading-none truncate">
            12-Hour Range Exposure
          </h2>
        </div>
        <div className="flex items-center space-x-1 bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider flex-shrink-0">
          <span className="text-textIceWhite">NOW</span>
          <span className="text-slate-600">/</span>
          <span className="text-edgeOrange">12H MAX</span>
        </div>
      </div>

      {/* 3 Structured Metric Sub-Cards */}
      <div className="grid grid-cols-3 gap-2 flex-grow items-stretch min-h-0">
        {/* 1. Shade Air Temperature */}
        <div className="min-w-0 overflow-hidden bg-slate-900/60 border border-slate-800/80 border-t-2 border-t-edgeOrange rounded-lg px-2 py-1.5 flex flex-col justify-between">
          <div className="flex items-center space-x-1 min-w-0">
            <Thermometer className="w-3 h-3 text-edgeOrange flex-shrink-0" />
            <span className="text-[8px] text-slate-300 font-black uppercase tracking-wider leading-none truncate">
              SHADE
            </span>
          </div>
          <div className="flex items-baseline justify-start mt-1 leading-none whitespace-nowrap">
            <span className="text-base sm:text-lg font-black font-mono text-textIceWhite tracking-tight">
              {curTemp !== undefined ? curTemp.toFixed(0) : '--'}
            </span>
            {tempTrend.arrow && tempTrend.arrow !== '→' && (
              <span className={`text-[9px] ml-0.5 ${tempTrend.class}`}>{tempTrend.arrow}</span>
            )}
            <span className="text-[10px] text-slate-600 font-bold px-0.5">/</span>
            <span className="text-base sm:text-lg font-black font-mono text-edgeOrange tracking-tight">
              {maxTemp !== undefined ? maxTemp.toFixed(0) : '--'}
            </span>
            <span className="text-[9px] font-bold text-slate-400 ml-0.5">°C</span>
          </div>
        </div>

        {/* 2. WBGT Heat Stress Index */}
        <div className="min-w-0 overflow-hidden bg-slate-900/60 border border-slate-800/80 border-t-2 border-t-stopRed rounded-lg px-2 py-1.5 flex flex-col justify-between">
          <div className="flex items-center space-x-1 min-w-0">
            <Flame className="w-3 h-3 text-stopRed flex-shrink-0" />
            <span className="text-[8px] text-slate-300 font-black uppercase tracking-wider leading-none truncate">
              WBGT
            </span>
          </div>
          <div className="flex items-baseline justify-start mt-1 leading-none whitespace-nowrap">
            <span className="text-base sm:text-lg font-black font-mono text-textIceWhite tracking-tight">
              {curWbgt !== undefined ? curWbgt.toFixed(0) : '--'}
            </span>
            {wbgtTrend.arrow && wbgtTrend.arrow !== '→' && (
              <span className={`text-[9px] ml-0.5 ${wbgtTrend.class}`}>{wbgtTrend.arrow}</span>
            )}
            <span className="text-[10px] text-slate-600 font-bold px-0.5">/</span>
            <span className="text-base sm:text-lg font-black font-mono text-stopRed tracking-tight">
              {maxWbgt !== undefined ? maxWbgt.toFixed(0) : '--'}
            </span>
            <span className="text-[9px] font-bold text-slate-400 ml-0.5">°C</span>
          </div>
        </div>

        {/* 3. Solar UV Index */}
        <div className="min-w-0 overflow-hidden bg-slate-900/60 border border-slate-800/80 border-t-2 border-t-amber-400 rounded-lg px-2 py-1.5 flex flex-col justify-between">
          <div className="flex items-center space-x-1 min-w-0">
            <Sun className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-[8px] text-slate-300 font-black uppercase tracking-wider leading-none truncate">
              UV INDEX
            </span>
          </div>
          <div className="flex items-baseline justify-start mt-1 leading-none whitespace-nowrap">
            <span className="text-base sm:text-lg font-black font-mono text-textIceWhite tracking-tight">
              {curUv !== undefined ? curUv.toFixed(1) : '--'}
            </span>
            {uvTrend.arrow && uvTrend.arrow !== '→' && (
              <span className={`text-[9px] ml-0.5 ${uvTrend.class}`}>{uvTrend.arrow}</span>
            )}
            <span className="text-[10px] text-slate-600 font-bold px-0.5">/</span>
            <span className="text-base sm:text-lg font-black font-mono text-amber-400 tracking-tight">
              {maxUv !== undefined ? maxUv.toFixed(1) : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
