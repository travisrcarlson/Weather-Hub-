import React from 'react';
import { ShieldAlert, Droplets, Sun, Wind, CloudLightning, Activity, AlertTriangle, PhoneCall } from 'lucide-react';
import { calculateSunscreenIntervals } from '../utils/safetyEngine';

export default function SafetyAdvisory({ data }) {
  return (
    <div className="w-full h-full text-slate-200 select-none p-5 flex flex-col justify-between overflow-hidden">
      {/* Title Header */}
      <div className="flex-none mb-3 border-b border-slate-800 pb-2">
        <p className="text-[10px] text-edgeOrange font-black uppercase tracking-widest leading-none mb-1">
          XRANGE • SAFETY STANDARDS
        </p>
        <h1 className="text-lg font-black text-textIceWhite leading-none uppercase">
          ADOSH Adverse Weather Advisory & Operational Guidelines
        </h1>
      </div>

      {/* Grid Content */}
      <div className="h-[90%] grid grid-cols-3 gap-5 items-stretch flex-grow">
        
        {/* Left Column: Heat Stress & Hydration */}
        <div className="h-full bg-cardDarkSlate border border-slate-800/85 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#80808005_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-3">
              <Droplets className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-textIceWhite uppercase tracking-wide">
                Heat Stress & Hydration
              </h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Hydration Schedule (Standard Duty)
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1">
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold text-slate-400">Flag Green (&lt;38°C)</span>
                    <span className="font-mono text-textIceWhite">250ml every 20m</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold text-amberAlert">Flag Amber (38-43°C)</span>
                    <span className="font-mono text-textIceWhite">500ml every 20m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-stopRed">Flag Red (&ge;43°C)</span>
                    <span className="font-mono text-textIceWhite">1L every 20m + Electrolytes</span>
                  </div>
                </div>
              </div>

              <div>
                {(() => {
                  const uv = data?.uv_index !== undefined ? data.uv_index : 0;
                  const sunscreen = calculateSunscreenIntervals(uv);
                  return (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[10.5px] text-edgeOrange font-black uppercase tracking-wider">
                          Skin Safety & SPF Guidelines
                        </p>
                        <span className="text-[9px] bg-slate-800 border border-slate-700/60 px-1.5 py-0.5 rounded font-mono text-slate-300">
                          LIVE UV: {uv.toFixed(1)}
                        </span>
                      </div>
                      <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2.5 text-[9.5px] space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-300 text-[10px]">SPF 10 (Basic Vests/Gear)</span>
                            <span className={`text-[8.5px] font-black uppercase ${
                              sunscreen.suitability.spf10 === "Suitable" ? "text-safetyGreen" :
                              sunscreen.suitability.spf10 === "Insufficient" ? "text-amberAlert animate-pulse" : "text-stopRed animate-pulse"
                            }`}>{sunscreen.suitability.spf10}</span>
                          </div>
                          <span className="font-mono text-textIceWhite text-right text-[11px] leading-snug">
                            Baseline: 45m<br />
                            <span className="text-edgeOrange font-black">Live: {sunscreen.spf10}m</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-300 text-[10px]">SPF 30 (Field Operators)</span>
                            <span className={`text-[8.5px] font-black uppercase ${
                              sunscreen.suitability.spf30 === "Suitable" || sunscreen.suitability.spf30 === "Recommended" ? "text-safetyGreen" :
                              sunscreen.suitability.spf30 === "Minimum Required" || sunscreen.suitability.spf30 === "Mandatory" ? "text-amberAlert animate-pulse" : "text-stopRed animate-pulse"
                            }`}>{sunscreen.suitability.spf30}</span>
                          </div>
                          <span className="font-mono text-textIceWhite text-right text-[11px] leading-snug">
                            Baseline: 80m<br />
                            <span className="text-edgeOrange font-black">Live: {sunscreen.spf30}m</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-300 text-[10px]">SPF 50 (Max Protection)</span>
                            <span className={`text-[8.5px] font-black uppercase ${
                              sunscreen.suitability.spf50.includes("Suitable") || sunscreen.suitability.spf50.includes("Protection") || sunscreen.suitability.spf50.includes("Recommended") ? "text-safetyGreen" : "text-amberAlert animate-pulse"
                            }`}>{sunscreen.suitability.spf50}</span>
                          </div>
                          <span className="font-mono text-textIceWhite text-right text-[11px] leading-snug">
                            Baseline: 120m<br />
                            <span className="text-edgeOrange font-black">Live: {sunscreen.spf50}m</span>
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-col space-y-0.5">
                        <p className="text-[9.5px] text-textIceWhite font-black uppercase leading-normal">
                          Recommended Min: <span className="text-edgeOrange font-black">{sunscreen.recommendedSpf}</span>
                        </p>
                        <p className="text-[9px] text-amberAlert font-black uppercase tracking-wider leading-normal">
                          * Live UV Index scales baseline intervals by {Math.round(sunscreen.factor * 100)}% (up to 50% reduction).
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Work / Rest splits (ADOSH CoP 11.0)
                </p>
                <p className="text-[8px] text-slate-400 leading-normal mb-1">
                  Rest breaks must be taken in designated air-conditioned cool zones.
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1">
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span>Normal Conditions</span>
                    <span className="font-mono text-textIceWhite">50m Work / 10m Rest</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="text-amberAlert">Amber Warning (Humidex &ge;40)</span>
                    <span className="font-mono text-textIceWhite">40m Work / 20m Rest</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stopRed">Red Warning (Humidex &ge;46)</span>
                    <span className="font-mono text-textIceWhite">30m Work / 30m Rest</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2 flex items-center space-x-1.5">
            <Sun className="w-3.5 h-3.5 text-edgeOrange" />
            <span className="text-[8.5px] font-bold text-slate-400 uppercase">
              Mandatory head cover & UV polarized eye protection active.
            </span>
          </div>
        </div>

        {/* Center Column: Range Operations & Wind Safety */}
        <div className="h-full bg-cardDarkSlate border border-slate-800/85 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#80808005_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-3">
              <Wind className="w-5 h-5 text-edgeOrange" />
              <h2 className="text-sm font-bold text-textIceWhite uppercase tracking-wide">
                Range Operational Limits
              </h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Wind Speed Thresholds & Actions
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1.5">
                  <div>
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>Sustained Wind &ge;38 km/h</span>
                      <span className="text-stopRed font-mono font-black">RED HALT</span>
                    </div>
                    <p className="text-[7.5px] text-slate-500 leading-normal">
                      Halt all live firing, ballistics test profiles, and target mechanism movements.
                    </p>
                  </div>
                  <div className="border-t border-slate-800/40 my-1" />
                  <div>
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>Wind Gusts &ge;50 km/h</span>
                      <span className="text-stopRed font-mono font-black">RED HALT</span>
                    </div>
                    <p className="text-[7.5px] text-slate-500 leading-normal">
                      Secure loose instrumentation, cover optics, and move personnel into protective shelter hubs.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Lightning Protocol (WMO Standard)
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1.5">
                  <div className="flex items-center space-x-2 text-stopRed font-bold">
                    <CloudLightning className="w-3.5 h-3.5 animate-pulse" />
                    <span>30/30 DETECTED PROTOCOL</span>
                  </div>
                  <p className="text-[7.5px] text-slate-400 leading-normal">
                    If lightning is seen and thunder is heard within 30 seconds, suspend all range activities. Wait 30 minutes after the last thunder/lightning event before resuming operations.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Sandstorm & Visibility Hazards
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1">
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold">Visibility &lt;1 km</span>
                    <span className="text-stopRed font-black">SUSPEND ALL VEHICLE & RANGE OPS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-amberAlert">Visibility 1-5 km</span>
                    <span className="text-amberAlert font-bold">REDUCED SPEED • HEADLIGHTS ON</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2 flex items-center space-x-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-stopRed animate-pulse" />
            <span className="text-[8.5px] font-bold text-slate-400 uppercase">
              Violation of adverse weather thresholds voids operational clearance.
            </span>
          </div>
        </div>

        {/* Right Column: First Aid, PPE & Contacts */}
        <div className="h-full bg-cardDarkSlate border border-slate-800/85 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#80808005_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-3">
              <Activity className="w-5 h-5 text-stopRed" />
              <h2 className="text-sm font-bold text-textIceWhite uppercase tracking-wide">
                First Aid & PPE Standards
              </h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Heat Stroke vs Exhaustion Indicators
                </p>
                <div className="grid grid-cols-2 gap-2 text-[7.5px]">
                  <div className="bg-amberAlert/5 border border-amberAlert/30 rounded p-1.5">
                    <p className="font-bold text-amberAlert uppercase mb-0.5">Heat Exhaustion</p>
                    <ul className="list-disc pl-2.5 text-slate-400 space-y-0.5">
                      <li>Moist, cool, clammy skin</li>
                      <li>Heavy sweating</li>
                      <li>Dizziness / Headache</li>
                      <li>Weak, fast pulse</li>
                    </ul>
                  </div>
                  <div className="bg-stopRed/5 border border-stopRed/30 rounded p-1.5">
                    <p className="font-bold text-stopRed uppercase mb-0.5">Heat Stroke (Emergency)</p>
                    <ul className="list-disc pl-2.5 text-slate-400 space-y-0.5">
                      <li>Hot, red, dry skin</li>
                      <li>No sweating</li>
                      <li>Confusion / Unconscious</li>
                      <li>Strong, rapid pulse</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Required PPE (June to September)
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1">
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold">Eye Wear</span>
                    <span className="text-slate-400">UV400 Polarized Safety Glasses</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold">Face Mask</span>
                    <span className="text-slate-400">N95 / FFP2 Dust & Particle Mask</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Clothing</span>
                    <span className="text-slate-400">Breathable UV-resistant long sleeves</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[9px] text-edgeOrange font-black uppercase tracking-wider mb-1">
                  Emergency Contacts & Frequencies
                </p>
                <div className="bg-bgDeepSpace/40 rounded border border-slate-800/60 p-2 text-[8px] space-y-1">
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold">Range Safety Officer</span>
                    <span className="font-mono text-textIceWhite">VHF Channel 16 / Ext 881</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-0.5">
                    <span className="font-bold">Range Medical Center</span>
                    <span className="font-mono text-textIceWhite">Ext 911 / +971 2 612 8888</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-edgeOrange">Crisis Command Center</span>
                    <span className="font-mono text-edgeOrange">Ext 999</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2 flex items-center space-x-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-edgeOrange" />
            <span className="text-[8.5px] font-bold text-slate-400 uppercase">
              Immediate evacuation required for any heat stroke signs.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
