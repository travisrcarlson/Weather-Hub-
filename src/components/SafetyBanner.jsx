import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, AlertOctagon, Radio } from 'lucide-react';
import { getProjectedAdvisories } from '../utils/safetyEngine';
import { getActiveHseDirective } from '../services/hseBroadcastService';

export default function SafetyBanner({ safetyEvaluation, hourlyData, currentTime, isMobile, ncmWarnings }) {
  const [activeDirective, setActiveDirective] = useState(getActiveHseDirective());

  useEffect(() => {
    const handleDirective = () => {
      setActiveDirective(getActiveHseDirective());
    };
    window.addEventListener('xrange-hse-directive', handleDirective);
    window.addEventListener('storage', handleDirective);
    return () => {
      window.removeEventListener('xrange-hse-directive', handleDirective);
      window.removeEventListener('storage', handleDirective);
    };
  }, []);

  if (!safetyEvaluation) return null;

  const { status, reasons, colors } = safetyEvaluation;
  const projected = getProjectedAdvisories(hourlyData, currentTime);
  const compactStatusText = status === 'GREEN' ? 'ALL CLEAR' : status === 'AMBER' ? 'RANGE CAUTION' : 'CRITICAL HALT';

  const renderIcon = () => {
    switch (status) {
      case 'GREEN':
        return <CheckCircle className="w-8 h-8 text-white animate-bounce-slow" />;
      case 'AMBER':
        return <AlertTriangle className="w-8 h-8 text-white animate-pulse" />;
      case 'RED':
      default:
        return <AlertOctagon className="w-8 h-8 text-white animate-pulse" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'GREEN':
        return 'ALL CLEAR • OUTDOOR OPERATIONS GO';
      case 'AMBER':
        return 'RANGE SAFETY CAUTION • MONITOR CONDITIONS';
      case 'RED':
      default:
        return 'CRITICAL HALT • SUSPEND ALL OUTDOOR RANGE OPERATIONS';
    }
  };

  if (isMobile) {
    return (
      <div className={`w-full border rounded-xl p-3.5 flex flex-col space-y-2.5 transition-all duration-500 select-none ${colors.banner}`}>
        {/* Status Row */}
        <div className="flex items-center space-x-2.5">
          <div className="flex-none">{renderIcon()}</div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="text-xs font-black tracking-wide uppercase leading-tight">
                {getStatusText()}
              </h2>
              {ncmWarnings && ncmWarnings.length > 0 && (
                <span className="bg-white/25 border border-white/80 text-white px-1 py-0.5 rounded text-[6.5px] font-black tracking-wider uppercase animate-pulse leading-none">
                  NCM
                </span>
              )}
            </div>
            <p className="text-[7.5px] font-bold text-white/70 uppercase tracking-wider mt-0.5">
              Primary Safety Advisor Directive
            </p>
          </div>
        </div>

        {/* Active Directive Strip (if active) */}
        {activeDirective && (
          <div className="bg-black/40 border border-white/40 rounded-lg p-2 flex items-start space-x-2 text-white">
            <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded bg-white/20 font-mono tracking-wider flex-shrink-0">
              📢 RSO {activeDirective.severity}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-extrabold uppercase leading-tight text-amber-200 truncate">{activeDirective.title}</p>
              <p className="text-[8px] text-white/90 leading-tight mt-0.5 line-clamp-2">{activeDirective.details}</p>
            </div>
          </div>
        )}

        {/* Alerts Stack */}
        {((reasons && reasons.length > 0) || (projected && projected.length > 0) || activeDirective) && (
          <div className="border-t border-white/10 pt-2 flex flex-col space-y-2">
            {reasons && reasons.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-white/95 uppercase tracking-wider leading-none mb-1">
                  Current Alerts
                </p>
                <ul className="space-y-0.5 text-left text-white">
                  {reasons.map((reason, idx) => (
                    <li key={idx} className="text-[9px] font-extrabold uppercase tracking-wide list-disc list-inside leading-tight">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {projected && projected.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-white/95 uppercase tracking-wider leading-none mb-1">
                  Projected Outlook (12H)
                </p>
                <ul className="space-y-0.5 text-left text-white">
                  {projected.map((proj, idx) => (
                    <li key={idx} className="text-[9px] font-extrabold uppercase tracking-wide leading-tight list-none">
                      ⚠️ <span className={proj.type === 'RED' ? 'text-red-200' : 'text-amber-100'}>{proj.metric}</span> <span className="font-mono text-white/60 text-[8px]">({proj.timeframe})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-full border rounded-xl flex items-center justify-between px-5 transition-all duration-500 select-none ${colors.banner}`}>
      {/* Icon & Title */}
      <div className="flex items-center space-x-3 w-[24%] flex-shrink-0">
        <div className="flex-shrink-0">{renderIcon()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
            <h2 className="text-[16px] font-black tracking-wider uppercase leading-tight whitespace-nowrap">
              {compactStatusText}
            </h2>
            {ncmWarnings && ncmWarnings.length > 0 && (
              <span className="bg-white/20 border border-white text-white px-1 py-0.5 rounded text-[6.5px] font-black tracking-wider uppercase animate-pulse leading-none flex-shrink-0">
                NCM
              </span>
            )}
          </div>
          <p className="text-[7.5px] font-black text-white/80 uppercase tracking-wider mt-0.5 truncate">
            ADOSH & MoHRE POLICY
          </p>
        </div>
      </div>

      {/* Warning/Halt Reasons (Split into Current and Projected) */}
      <div className="flex-1 min-w-0 border-l border-white/20 pl-4 h-[90%] flex flex-row space-x-4 items-stretch overflow-hidden">
        {/* Current Section */}
        <div className="w-1/2 flex flex-col justify-between overflow-hidden">
          <p className="text-[11px] font-black text-white/85 uppercase tracking-wider mb-1 border-b border-white/10 pb-0.5 leading-none">
            Current Alerts
          </p>
          <div className="flex-grow overflow-y-auto no-scrollbar py-0.5">
            {/* Active Directive Notice on TV Console */}
            {activeDirective && (
              <div className="mb-1.5 p-1.5 rounded bg-black/50 border border-amber-300/40 flex items-start space-x-2 text-white">
                <span className="bg-amber-500/30 border border-amber-300/60 text-amber-200 px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase font-mono tracking-wider flex-shrink-0">
                  📢 RSO {activeDirective.severity || 'DIRECTIVE'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9.5px] font-black uppercase tracking-wide text-amber-200 leading-snug">
                    {activeDirective.title}
                  </p>
                  {activeDirective.details && (
                    <p className="text-[8px] text-white/90 leading-tight mt-0.5 line-clamp-1">
                      {activeDirective.details}
                    </p>
                  )}
                  <div className="flex items-center space-x-1.5 mt-0.5 text-[7px] font-mono text-white/70">
                    <span className="truncate">BY: {activeDirective.author}</span>
                    <span>•</span>
                    <span>{new Date(activeDirective.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GST</span>
                  </div>
                </div>
              </div>
            )}
            {reasons && reasons.length > 0 ? (
              <ul className="space-y-1 text-left text-white">
                {reasons.map((reason, idx) => (
                  <li key={idx} className="text-[10px] font-extrabold uppercase tracking-wide leading-tight flex items-start space-x-1.5">
                    <span className="text-white/80 font-mono text-[9px] flex-shrink-0 mt-0.5">▶</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : !activeDirective ? (
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/60 mt-1">
                ✓ No active alerts. All sensors safe.
              </p>
            ) : null}
          </div>
        </div>

        {/* Divider */}
        <div className="w-[1px] bg-white/10 self-stretch my-0.5" />

        {/* Projected Section */}
        <div className="w-1/2 flex flex-col justify-between overflow-hidden">
          <p className="text-[11px] font-black text-white/85 uppercase tracking-wider mb-1 border-b border-white/10 pb-0.5 leading-none">
            Today's Outlook (12H)
          </p>
          <div className="flex-grow overflow-y-auto no-scrollbar py-0.5">
            {projected && projected.length > 0 ? (
              <ul className="space-y-1 text-left text-white">
                {projected.map((proj, idx) => (
                  <li key={idx} className="text-[10px] font-extrabold uppercase tracking-wide leading-snug">
                    ⚠️ <span className={proj.type === 'RED' ? 'text-red-300' : 'text-amber-200'}>{proj.metric}</span> <span className="font-mono text-white/60 text-[9px]">({proj.timeframe})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/60 mt-1">
                ✓ No safety breaches projected.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
