import React from 'react';
import { X, Sun, Flame, ShieldAlert, ShieldCheck, AlertTriangle, Thermometer } from 'lucide-react';
import { calculateMunitionsThermalLoad } from '../utils/tacticalBallisticsEngine';

export default function MunitionsThermalModal({ isOpen, onClose, currentData }) {
  if (!isOpen) return null;

  const ambientTemp = currentData?.temperature_2m || 41.5;
  const solarRad = currentData?.solar_radiation || 880;
  const windSpeed = currentData?.wind_speed_10m || 24;

  const thermal = calculateMunitionsThermalLoad(ambientTemp, solarRad, windSpeed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-cardDarkSlate border border-amber-500/40 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black tracking-wide text-white uppercase">
                  Munitions & Equipment Thermal Cook-Off Monitor
                </h2>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/40">
                  WEATHERNEXT 3 SOLAR FLUX
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct solar irradiance (W/m²) heating metallic crates, vehicles & propellant storage
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Main Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${thermal.badgeColor}`}>
            {thermal.status === 'CRITICAL COOK-OFF RISK' ? (
              <ShieldAlert className="w-6 h-6 flex-shrink-0 animate-bounce" />
            ) : thermal.status === 'THERMAL SOAK CAUTION' ? (
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-6 h-6 flex-shrink-0" />
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black uppercase tracking-wider">{thermal.status}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-current">
                  LIMIT: 65.0°C (149°F)
                </span>
              </div>
              <p className="text-xs mt-1 font-semibold leading-relaxed">{thermal.text}</p>
              <div className="mt-2 text-xs font-mono font-bold bg-black/40 p-2 rounded border border-current/30">
                ACTION: {thermal.coolingAction}
              </div>
            </div>
          </div>

          {/* Thermal Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Ambient Air Temp */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase">Ambient Shade Air Temp</span>
                <Thermometer className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-black text-white">{thermal.ambientTempC}</span>
                <span className="text-sm text-slate-400 font-bold">°C</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Standard Stevenson Screen reading</p>
            </div>

            {/* Direct Solar Radiation Flux */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-amber-400 mb-1">
                <span className="text-[10px] font-bold uppercase">WeatherNext 3 Solar Flux</span>
                <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-black text-amber-300">{thermal.solarRadiationWm2}</span>
                <span className="text-sm text-slate-400 font-bold">W/m²</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Peak desert solar loading</p>
            </div>

            {/* Equilibrium Metallic Surface Temp */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-edgeOrange mb-1">
                <span className="text-[10px] font-bold uppercase">Steel Container Surface</span>
                <Flame className="w-4 h-4 text-edgeOrange" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span className={`text-3xl font-black ${thermal.surfaceTempC >= 65 ? 'text-stopRed animate-pulse' : thermal.surfaceTempC >= 52 ? 'text-amberAlert' : 'text-safetyGreen'}`}>
                  {thermal.surfaceTempC}
                </span>
                <span className="text-sm text-slate-400 font-bold">°C</span>
                <span className="text-xs text-slate-400 font-mono ml-2">
                  (+{(thermal.surfaceTempC - thermal.ambientTempC).toFixed(1)}°C solar soak)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Dark OD / Tan military paint absorptivity</p>
            </div>

          </div>

          {/* MIL-STD Thresholds Reference Guide */}
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
            <h4 className="text-[11px] font-black uppercase text-slate-200 tracking-wider">
              MIL-STD-810H Method 501.7 & UAE Range Ordnance Thermal Safety Guide:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px] mt-2">
              <div className="p-2.5 rounded bg-slate-950/60 border border-safetyGreen/40">
                <span className="text-safetyGreen font-bold block mb-0.5">● &lt; 52.0°C (&lt; 125°F): NORMAL</span>
                <span className="text-slate-400 text-[10px]">Unrestricted handling. Chemical propellant degradation rate nominal.</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-amberAlert/40">
                <span className="text-amberAlert font-bold block mb-0.5">▲ 52.0°C - 65.0°C: THERMAL SOAK</span>
                <span className="text-slate-400 text-[10px]">Overpressure hazard in sealed ammo cases. Deploy shade tarps immediately.</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950/60 border border-stopRed/40">
                <span className="text-stopRed font-bold block mb-0.5">■ ≥ 65.0°C (≥ 149°F): COOK-OFF RISK</span>
                <span className="text-slate-400 text-[10px]">Critical propellant breakdown. Halt transport. Active chilling required.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-900/80">
          <span className="text-[10px] font-mono text-slate-400">
            REGULATION: ADOSH COPS & MIL-STD-810H HIGH-TEMP EXPLOSIVES HANDLING
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Close Monitor
          </button>
        </div>

      </div>
    </div>
  );
}
