import React, { useState } from 'react';
import { X, Target, Wind, Compass, ShieldAlert, AlertTriangle, CheckCircle, Crosshair, ChevronRight } from 'lucide-react';
import { 
  BALLISTIC_CALIBERS, 
  calculate100mWindShear, 
  calculateBallisticDrift, 
  evaluateUavFlightEnvelope 
} from '../utils/tacticalBallisticsEngine';

export default function TacticalBallisticsModal({ isOpen, onClose, currentData }) {
  if (!isOpen) return null;

  const [firingAzimuth, setFiringAzimuth] = useState(300); // Default 300° NW Range Bearing
  const [selectedCaliberId, setSelectedCaliberId] = useState('338_lapua');

  const surfaceWind = currentData?.wind_speed_10m || 24;
  const boundaryWind100m = currentData?.wind_speed_100m || (surfaceWind * 1.34 + 1.2);
  const gusts100m = currentData?.wind_gusts_100m || (boundaryWind100m * 1.38 + 2.0);
  const windDir = currentData?.wind_direction_10m || 290;
  const ambientTemp = currentData?.temperature_2m || 41.5;
  const solarRad = currentData?.solar_radiation || 850;

  // Compute 100m Wind Shear
  const shearAnalysis = calculate100mWindShear(surfaceWind, boundaryWind100m);

  // Compute Ballistic Drift
  const driftAnalysis = calculateBallisticDrift(firingAzimuth, windDir, surfaceWind, selectedCaliberId);

  // Compute UAV Flight Envelope
  const uavAnalysis = evaluateUavFlightEnvelope(surfaceWind, boundaryWind100m, gusts100m, ambientTemp, solarRad);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-cardDarkSlate border border-cyan-500/40 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black tracking-wide text-white uppercase">
                  WeatherNext 3 Ballistics & 100m Wind Shear Console
                </h2>
                <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-cyan-500/40">
                  5KM NEURAL LAYER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Atmospheric boundary layer gradient, aerodynamic crosswind deflection & UAV airspace envelope
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* TOP SECTION: 100M WIND SHEAR GRADIENT */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Wind className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  1. Boundary Layer Vertical Wind Shear Profile (10m vs 100m)
                </h3>
              </div>
              <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded border ${shearAnalysis.shearRisk === 'HIGH' ? 'bg-stopRed/20 text-stopRed border-stopRed/40' : shearAnalysis.shearRisk === 'MODERATE' ? 'bg-amberAlert/20 text-amberAlert border-amberAlert/40' : 'bg-safetyGreen/20 text-safetyGreen border-safetyGreen/40'}`}>
                SHEAR RISK: {shearAnalysis.shearRisk}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Surface Wind Card */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">10m Surface Wind</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-white">{shearAnalysis.surfaceWindKmh}</span>
                  <span className="text-xs text-slate-400 font-bold">km/h</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Standard range anemometer</span>
              </div>

              {/* 100m Boundary Wind Card */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-cyan-400 uppercase">100m Boundary Wind</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-cyan-300">{shearAnalysis.boundaryWind100mKmh}</span>
                  <span className="text-xs text-slate-400 font-bold">km/h</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">WeatherNext 3 High-Altitude Grid</span>
              </div>

              {/* Vertical Gradient Delta */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-amber-400 uppercase">Shear Gradient (Δv)</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className={`text-2xl font-black ${shearAnalysis.shearColor}`}>+{shearAnalysis.shearGradient}</span>
                  <span className="text-xs text-slate-400 font-bold">km/h / 100m</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Velocity ratio: {shearAnalysis.shearRatio}x</span>
              </div>

              {/* Tactical Assessment */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tactical Summary</span>
                <p className="text-xs text-slate-300 leading-snug mt-1 font-medium">
                  {shearAnalysis.description}
                </p>
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION: INTERACTIVE BALLISTIC DRIFT CALCULATOR */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-edgeOrange" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  2. Precision Ballistic Crosswind Drift Calculator
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Wind: {surfaceWind} km/h @ {windDir}° ({driftAnalysis.clockDirection})
              </span>
            </div>

            {/* Controls Bar: Caliber & Firing Azimuth */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Caliber Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Select Weapon & Cartridge Profile
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BALLISTIC_CALIBERS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCaliberId(c.id)}
                      className={`text-left p-2 rounded-lg border text-xs font-bold transition-all ${
                        selectedCaliberId === c.id
                          ? 'bg-edgeOrange/20 border-edgeOrange text-white shadow-lg'
                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="truncate">{c.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        MV: {c.muzzleVelocityMps}m/s • G1: {c.ballisticCoefficientG1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Firing Azimuth Dial / Slider */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Firing Line Azimuth: <span className="text-white font-mono text-sm">{firingAzimuth}°</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    Crosswind: <span className="text-amber-300 font-bold">{driftAnalysis.absCrosswind} km/h ({driftAnalysis.driftDirection})</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  step="5"
                  value={firingAzimuth}
                  onChange={(e) => setFiringAzimuth(Number(e.target.value))}
                  className="w-full accent-edgeOrange h-2 bg-slate-950 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-1">
                  <span>0° (N)</span>
                  <span>90° (E)</span>
                  <span>180° (S)</span>
                  <span>270° (W)</span>
                  <span>359°</span>
                </div>

                <div className="mt-2 p-2 bg-slate-950/60 rounded border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Head/Tailwind Component:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {Math.abs(driftAnalysis.headTailKmh)} km/h ({driftAnalysis.headTailKmh > 0 ? 'TAILWIND' : 'HEADWIND'})
                  </span>
                </div>
              </div>
            </div>

            {/* Ballistic Deflection Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Target Distance</th>
                    <th className="py-2.5 px-3">Crosswind Drift</th>
                    <th className="py-2.5 px-3">Angular Deflection (MRAD)</th>
                    <th className="py-2.5 px-3">Angular Deflection (MOA)</th>
                    <th className="py-2.5 px-3">Scope Correction (0.1 MRAD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {driftAnalysis.ranges.map(r => (
                    <tr key={r.distanceM} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white flex items-center space-x-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-edgeOrange" />
                        <span>{r.distanceM} meters</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-amber-300 font-bold">{r.cmOffset} cm</span>
                        <span className="text-slate-400 text-[10px] ml-1">({r.direction})</span>
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">{r.mrad} MRAD</td>
                      <td className="py-2.5 px-3 text-slate-300">{r.moa} MOA</td>
                      <td className="py-2.5 px-3">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-700 text-edgeOrange font-bold">
                          {r.clicks01Mrad} clicks {r.direction === 'RIGHT' ? 'LEFT' : r.direction === 'LEFT' ? 'RIGHT' : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTTOM SECTION: UAV & DRONE AIRSPACE ENVELOPE */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  3. UAV & Drone Airspace Flight Safety Envelope
                </h3>
              </div>
              <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded border ${uavAnalysis.badgeBg}`}>
                STATUS: {uavAnalysis.flightStatus}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">100m Flight Altitude Gusts</span>
                <div className="text-xl font-black text-white mt-1">{uavAnalysis.gusts100mKmh} km/h</div>
                <span className="text-[10px] text-slate-400 font-mono">Max safe rotor limit: 45 km/h</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Thermal Updraft Index</span>
                <div className="text-xl font-black text-amber-300 mt-1">{uavAnalysis.thermalUpdraftIndex}</div>
                <span className="text-[10px] text-slate-400 font-mono">Midday desert convection turbulence</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Flight Safety Advisory</span>
                <ul className="text-xs text-slate-300 mt-1 space-y-1">
                  {uavAnalysis.limitingFactors.map((f, i) => (
                    <li key={i} className="flex items-center space-x-1.5">
                      <span className="text-edgeOrange">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-900/80">
          <span className="text-[10px] font-mono text-slate-400">
            COMPLIANCE: MIL-STD-810H & ADOSH-SF v4.0 RANGE FLIGHT CLEARANCE
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Close Console
          </button>
        </div>

      </div>
    </div>
  );
}
