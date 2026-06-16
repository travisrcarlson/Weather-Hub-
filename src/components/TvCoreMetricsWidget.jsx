import React from 'react';
import { Thermometer, Sun, Flame } from 'lucide-react';
import { getTrendIndicator } from '../utils/safetyEngine';

export default function TvCoreMetricsWidget({ currentData, extremes, hourlyData }) {
  if (!currentData || !extremes) return null;

  const curTemp = currentData.temperature_2m;
  const maxTemp = extremes.maxTemp;
  const curRh = currentData.relative_humidity_2m || 0;
  
  const calculateDewPointLocal = (temp, rh) => {
    if (!temp || !rh) return 0;
    const a = 17.625;
    const b = 243.04;
    const alpha = ((a * temp) / (b + temp)) + Math.log(rh / 100);
    const dewPoint = (b * alpha) / (a - alpha);
    return Number(dewPoint.toFixed(1));
  };
  
  const calculateHumidexLocal = (temp, dewPoint) => {
    if (!temp || !dewPoint) return temp || 0;
    const e = 6.11 * Math.exp(5417.7530 * (1/273.16 - 1/(dewPoint + 273.15)));
    const humidex = temp + 0.5555 * (e - 10.0);
    return Number(humidex.toFixed(1));
  };

  const curDp = calculateDewPointLocal(curTemp, curRh);
  const curHx = calculateHumidexLocal(curTemp, curDp);
  const maxHx = extremes.maxHumidex;

  const curUv = currentData.uv_index !== undefined ? currentData.uv_index : 0;
  const maxUv = extremes.maxUv;

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
  
  let prevHumidex = null;
  if (prevIdx >= 0 && hourlyData.temperature_2m && hourlyData.relative_humidity_2m) {
    const prevT = hourlyData.temperature_2m[prevIdx];
    const prevRhVal = hourlyData.relative_humidity_2m[prevIdx];
    const prevDp = calculateDewPointLocal(prevT, prevRhVal);
    prevHumidex = calculateHumidexLocal(prevT, prevDp);
  }
  const humidexTrend = getTrendIndicator(curHx, prevHumidex, 0.1);

  const prevUv = (prevIdx >= 0 && hourlyData.uv_index) ? hourlyData.uv_index[prevIdx] : null;
  const uvTrend = getTrendIndicator(curUv, prevUv, 0.2);

  return (
    <div className="w-full h-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md shadow-2xl flex flex-col justify-between select-none">
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
          DAILY EXTREMES OUTLOOK
        </p>
        <h2 className="text-xs font-bold text-slate-200 leading-none">12-Hour Range Exposure Forecast</h2>
      </div>

      <div className="grid grid-cols-3 gap-6 py-2 flex-grow items-center">
        {/* Air Temperature */}
        <div className="flex items-center space-x-3 border-r border-slate-800/50 pr-2 h-full">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-edgeOrange">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1.5">
              TEMP IN SHADE (CUR/MAX)
            </p>
            <div className="flex items-baseline leading-none">
              <span className="text-3xl font-black text-textIceWhite tracking-tight">
                {curTemp !== undefined ? curTemp.toFixed(0) : '--'}
              </span>
              {tempTrend.arrow && tempTrend.arrow !== '→' && (
                <span className={`text-xs ml-1 ${tempTrend.class}`}>{tempTrend.arrow}</span>
              )}
              <span className="text-sm text-slate-500 font-medium px-1.5">/</span>
              <span className="text-3xl font-black text-edgeOrange tracking-tight">
                {maxTemp !== undefined ? maxTemp.toFixed(0) : '--'}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-0.5">°C</span>
            </div>
          </div>
        </div>

        {/* Humidex */}
        <div className="flex items-center space-x-3 border-r border-slate-800/50 pr-2 h-full">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-stopRed">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1.5">
              HUMIDEX (CUR/MAX)
            </p>
            <div className="flex items-baseline leading-none">
              <span className="text-3xl font-black text-textIceWhite tracking-tight">
                {curHx !== undefined ? curHx.toFixed(0) : '--'}
              </span>
              {humidexTrend.arrow && humidexTrend.arrow !== '→' && (
                <span className={`text-xs ml-1 ${humidexTrend.class}`}>{humidexTrend.arrow}</span>
              )}
              <span className="text-sm text-slate-500 font-medium px-1.5">/</span>
              <span className="text-3xl font-black text-stopRed tracking-tight">
                {maxHx !== undefined ? maxHx.toFixed(0) : '--'}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-0.5">°C</span>
            </div>
          </div>
        </div>

        {/* UV Index */}
        <div className="flex items-center space-x-3 h-full">
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1.5">
              UV INDEX (CUR/MAX)
            </p>
            <div className="flex items-baseline leading-none">
              <span className="text-3xl font-black text-textIceWhite tracking-tight">
                {curUv !== undefined ? curUv.toFixed(1) : '--.-'}
              </span>
              {uvTrend.arrow && uvTrend.arrow !== '→' && (
                <span className={`text-xs ml-1 ${uvTrend.class}`}>{uvTrend.arrow}</span>
              )}
              <span className="text-sm text-slate-500 font-medium px-1.5">/</span>
              <span className="text-3xl font-black text-amber-400 tracking-tight">
                {maxUv !== undefined ? maxUv.toFixed(1) : '--.-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
