import { Clock, Wifi, WifiOff, Cpu, Bell, Zap, Tv } from 'lucide-react';
import { PROVIDERS } from '../services/weatherService';

export default function Header({ 
  isOffline, 
  isSimulated, 
  onToggleSim, 
  viewMode, 
  onViewModeChange,
  time,
  isMobile,
  onOpenAlerts,
  activeAlertsCount,
  activeProvider,
  tvAutoReload = true,
  onToggleTvAutoReload
}) {
  const handleTvWakeAndFullscreen = () => {
    try {
      if (onToggleTvAutoReload) {
        onToggleTvAutoReload();
      }
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_e) {
      // Ignore fullscreen errors
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Dubai'
    });
  };

  if (isMobile) {
    return (
      <header className="w-full min-h-14 ios-pt-safe bg-navyGradient border-b border-cardDarkSlate/60 flex items-center justify-between px-3 sm:px-4 py-1.5 select-none relative z-50 flex-none">
        <div className="flex items-center space-x-2 min-w-0">
          <img 
            src="remaya_logo.png" 
            alt="REMAYA" 
            className="h-6 sm:h-7 w-auto object-contain bg-white px-1.5 py-0.5 rounded border border-white/80 flex-shrink-0" 
          />
          <div className="flex flex-col min-w-0">
            <h1 className="text-[11px] sm:text-xs font-black tracking-wider text-textIceWhite uppercase leading-none truncate">
              XRANGE WEATHER HUB
            </h1>
            <span className="text-[7px] sm:text-[7.5px] text-edgeOrange font-black tracking-wider uppercase mt-0.5 font-sans leading-none truncate">
              AI POWERED WEATHER SAFETY PORTAL
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          {/* Active Model Indicator Pill */}
          {activeProvider?.startsWith('WEATHERNEXT') && (
            <div 
              onClick={() => onViewModeChange && onViewModeChange('backend')}
              className="flex items-center space-x-1 bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.5 rounded text-[9px] font-mono font-black cursor-pointer hover:bg-cyan-900/60" 
              title="Google DeepMind WeatherNext 3 (5km) - Tap to view Backend Feeds"
            >
              <Zap className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
              <span>WN3</span>
              <span className="text-[7.5px] text-sky-300 border-l border-cyan-700/60 pl-1">{60 - (time ? time.getMinutes() % 60 : new Date().getMinutes() % 60)}m</span>
            </div>
          )}

          {/* Clock */}
          <div className="flex items-center space-x-1 text-textIceWhite bg-bgDeepSpace/40 px-2 py-1 rounded border border-slate-700/35">
            <Clock className="w-3.5 h-3.5 text-edgeOrange" />
            <span className="text-[11px] font-mono font-black tracking-wider leading-none">{formatTime(time).slice(0, 5)}</span>
          </div>

          {/* Notification Bell */}
          <button
            onClick={onOpenAlerts}
            className={`flex items-center justify-center p-1.5 rounded border cursor-pointer relative ${
              activeAlertsCount > 0
                ? 'bg-red-500/15 border-red-500 text-red-400'
                : 'bg-bgDeepSpace/40 border-slate-700/40 text-slate-400 hover:text-textIceWhite'
            }`}
            title="Open Safety Alert Center"
          >
            <Bell className={`w-3.5 h-3.5 ${activeAlertsCount > 0 ? 'animate-bounce text-red-400' : ''}`} />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 border border-cardDarkSlate text-[7.5px] font-black text-white w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                {activeAlertsCount}
              </span>
            )}
          </button>

          {/* Simulation Toggle */}
          <button
            onClick={onToggleSim}
            className={`flex items-center justify-center p-1.5 rounded border cursor-pointer ${
              isSimulated
                ? 'bg-edgeOrange/20 border-edgeOrange text-edgeOrange shadow-md shadow-edgeOrange/10'
                : 'bg-bgDeepSpace/40 border-slate-700/40 text-slate-400 hover:text-textIceWhite hover:border-slate-650'
            }`}
            title="Toggle Weather Station Simulation Override"
          >
            <Cpu className={`w-3.5 h-3.5 ${isSimulated ? 'animate-pulse' : ''}`} />
          </button>

          {/* Connection Status */}
          <div className="flex items-center justify-center p-1.5 rounded border border-slate-700/30 bg-bgDeepSpace/40">
            {isOffline ? (
              <WifiOff className="w-3.5 h-3.5 text-stopRed" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-safetyGreen animate-pulse" />
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full h-[8.5%] min-h-[52px] max-h-[72px] bg-navyGradient border-b border-cardDarkSlate/60 flex items-center justify-between gap-2 xl:gap-4 px-3.5 xl:px-6 py-1 select-none relative z-50 flex-none">
      {/* Left: Remaya Logo & Title (Never shrinks, wraps, or clips vertically) */}
      <div className="flex items-center space-x-2.5 xl:space-x-3.5 flex-shrink-0 whitespace-nowrap">
        <div className="h-8 xl:h-10 2xl:h-11 bg-white rounded-md px-1.5 py-0.5 flex items-center justify-center shadow-md shadow-white/5 border border-white/85 flex-shrink-0">
          <img 
            src="remaya_logo.png" 
            alt="REMAYA Logo" 
            className="h-full w-auto object-contain" 
          />
        </div>
        <div className="border-l border-slate-700/50 pl-2.5 xl:pl-3.5 flex flex-col justify-center flex-shrink-0">
          <h1 className="text-sm lg:text-base xl:text-lg 2xl:text-xl font-black tracking-wide xl:tracking-wider text-textIceWhite uppercase leading-tight whitespace-nowrap">
            XRANGE WEATHER HUB
          </h1>
          <p className="text-[7.5px] xl:text-[9px] 2xl:text-[10.5px] text-edgeOrange font-bold tracking-[0.12em] xl:tracking-[0.16em] uppercase leading-tight mt-0.5 font-sans whitespace-nowrap">
            AI POWERED WEATHER SAFETY PORTAL
          </p>
        </div>
      </div>

      {/* Center: Clock & Date (Compact Single-Line Telemetry Pill) */}
      <div className="flex items-center space-x-2 flex-shrink-0 whitespace-nowrap bg-bgDeepSpace/50 px-2.5 xl:px-3 py-1 xl:py-1.5 rounded-lg border border-slate-700/40 font-sans">
        <Clock className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-edgeOrange flex-shrink-0" />
        <span className="text-sm xl:text-base 2xl:text-lg font-mono font-black tracking-wider text-textIceWhite leading-none">
          {formatTime(time)}
        </span>
        <span className="text-[8.5px] xl:text-[9.5px] text-slate-400 font-bold uppercase leading-none">GST</span>
        <span className="hidden xl:inline text-slate-600">|</span>
        <span className="hidden xl:inline text-[11px] 2xl:text-xs font-black text-slate-300 uppercase leading-none">
          {formatDate(time)}
        </span>
      </div>

      {/* Right Controls & Views */}
      <div className="flex items-center space-x-2 xl:space-x-2.5 flex-shrink-0 whitespace-nowrap">
        {/* Streamlined 4-Tab Primary Operational Navigation */}
        <div className="flex bg-slate-900/85 p-1 rounded-lg border border-slate-800/90 shadow-inner gap-1">
          {[
            { id: 'ops', label: 'Tactical Ops', short: 'Tactical Ops', match: ['ops', 'tv'] },
            { id: 'pilot', label: 'Flight & Runways', short: 'Flight', match: ['pilot'] },
            { id: 'hse', label: 'HSE & Safety', short: 'HSE & SOPs', match: ['hse', 'advisory'] },
            { id: 'planning', label: 'Mission Planning', short: 'Planning', match: ['planning', 'customer'] }
          ].map(tab => {
            const isActive = tab.match.includes(viewMode);
            return (
              <button
                key={tab.id}
                onClick={() => onViewModeChange(tab.id)}
                className={`px-2.5 xl:px-3.5 2xl:px-4 py-1 xl:py-1.5 text-[9.5px] xl:text-[10.5px] 2xl:text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer rounded-md whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/40'
                    : 'text-slate-400 hover:text-textIceWhite hover:bg-slate-800/40'
                }`}
              >
                <span className="hidden xl:inline">{tab.label}</span>
                <span className="xl:hidden">{tab.short}</span>
              </button>
            );
          })}
        </div>

        {/* Notification Bell */}
        <button
          onClick={onOpenAlerts}
          className={`flex items-center space-x-1 px-2.5 py-1 xl:py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer relative shadow-sm whitespace-nowrap ${
            activeAlertsCount > 0
              ? 'bg-red-500/15 border-red-500/50 text-red-200 shadow-red-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-textIceWhite hover:border-slate-700'
          }`}
          title="Open Safety Alert Center & Dispatcher"
        >
          <Bell className={`w-3.5 h-3.5 ${activeAlertsCount > 0 ? 'text-red-400 animate-bounce' : 'text-slate-400'}`} />
          <span className="hidden 2xl:inline text-[10px] uppercase tracking-wide">Alerts</span>
          {activeAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 border border-slate-900 text-[8px] font-black text-white px-1 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[15px] h-[15px] shadow-sm select-none">
              {activeAlertsCount}
            </span>
          )}
        </button>

        {/* Unified System Telemetry Cluster */}
        <div className="flex items-center bg-slate-900/80 border border-slate-800/90 rounded-lg p-0.5 divide-x divide-slate-800/80 shadow-md whitespace-nowrap">
          {/* Segment 1: Active Forecast Model & Backend Feeds Access */}
          <button
            type="button"
            onClick={() => onViewModeChange('backend')}
            className={`flex items-center space-x-1 px-2 py-1 text-[8.5px] xl:text-[9px] font-mono font-black uppercase tracking-wider cursor-pointer transition-colors border-none rounded-l ${
              viewMode === 'backend'
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'hover:bg-slate-800/50 text-cyan-300'
            }`}
            title={`Active Engine: ${activeProvider?.startsWith('WEATHERNEXT') ? 'Google DeepMind WeatherNext 3 (5km)' : activeProvider || 'Open-Meteo'} • Click to open Backend Feeds`}
          >
            {activeProvider?.startsWith('WEATHERNEXT') ? (
              <Zap className="w-3 h-3 text-cyan-400 animate-pulse flex-shrink-0" />
            ) : (
              <Cpu className="w-3 h-3 text-slate-400 flex-shrink-0" />
            )}
            <span className={activeProvider?.startsWith('WEATHERNEXT') ? 'text-cyan-300' : 'text-slate-300'}>
              {activeProvider === PROVIDERS.WEATHERNEXT_SIM ? 'WN3•FEEDS' :
               activeProvider === PROVIDERS.WEATHERNEXT_LIVE ? 'WN3•FEEDS' :
               activeProvider === PROVIDERS.UAE_NCM ? 'NCM•FEEDS' : 'FEEDS'}
            </span>
          </button>

          {/* Segment 2: Simulation Toggle */}
          <button
            onClick={onToggleSim}
            className={`flex items-center space-x-1 px-1.5 py-1 text-[8.5px] font-mono font-black uppercase tracking-wider transition-colors cursor-pointer border-none ${
              isSimulated
                ? 'bg-edgeOrange/20 text-edgeOrange hover:bg-edgeOrange/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Toggle Weather Station Simulation Override"
          >
            <Cpu className={`w-3 h-3 ${isSimulated ? 'animate-pulse text-edgeOrange' : 'text-slate-500'}`} />
            <span>SIM:{isSimulated ? 'ON' : 'OFF'}</span>
          </button>

          {/* Segment 3: LG webOS / Smart TV Anti-Screensaver & Fullscreen Lock */}
          <button
            type="button"
            onClick={handleTvWakeAndFullscreen}
            className="flex items-center space-x-1 px-1.5 py-1 text-[8.5px] font-mono font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-950/50 transition-colors cursor-pointer border-none"
            title="LG webOS Anti-Screensaver Active (Full-Screen H.264+AAC Video + 35s Subframe Nav + 110s State-Preserving Reload)"
          >
            <Tv className="w-3 h-3 text-safetyGreen animate-pulse" />
            <span>{tvAutoReload ? 'WAKE:MAX' : 'WAKE:VID'}</span>
          </button>

          {/* Segment 4: Connection Link Status */}
          <div className="flex items-center space-x-1 px-1.5 py-1" title={isOffline ? 'System Offline' : 'Live Data Stream Active'}>
            {isOffline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-stopRed" />
                <span className="hidden xl:inline text-[8.5px] font-mono font-black text-stopRed tracking-wider uppercase">OFF</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-safetyGreen animate-pulse shadow-sm shadow-emerald-500/50" />
                <span className="hidden xl:inline text-[8.5px] font-mono font-black text-safetyGreen tracking-wider uppercase">LIVE</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
