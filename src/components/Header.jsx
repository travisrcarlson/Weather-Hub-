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
  activeProvider
}) {
  const handleTvWakeAndFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(() => {});
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
      <header className="w-full h-14 bg-navyGradient border-b border-cardDarkSlate/60 flex items-center justify-between px-4 select-none relative z-50 flex-none">
        <div className="flex items-center space-x-2">
          <img 
            src="remaya_logo.png" 
            alt="REMAYA" 
            className="h-7 w-auto object-contain bg-white px-1.5 py-0.5 rounded border border-white/80" 
          />
          <div className="flex flex-col">
            <h1 className="text-xs font-black tracking-wider text-textIceWhite uppercase leading-none">
              XRANGE WEATHER HUB
            </h1>
            <span className="text-[7.5px] text-edgeOrange font-black tracking-wider uppercase mt-0.5 font-sans leading-none">
              AI POWERED WEATHER SAFETY PORTAL
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
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
    <header className="w-full h-[8%] bg-navyGradient border-b border-cardDarkSlate/60 flex items-center justify-between px-6 select-none relative z-50 flex-none">
      {/* Remaya Logo & Title */}
      <div className="flex items-center space-x-5">
        {/* Remaya Corporate Logo Image Badge */}
        <div className="h-16 bg-white rounded-lg px-2 py-0.5 flex items-center justify-center shadow-md shadow-white/5 border border-white/85">
          <img 
            src="remaya_logo.png" 
            alt="REMAYA Logo" 
            className="h-full w-auto object-contain" 
          />
        </div>
        <div className="border-l border-slate-700/50 pl-4">
          <h1 className="text-2xl font-black tracking-widest text-textIceWhite uppercase leading-none">
            XRANGE WEATHER HUB
          </h1>
          <p className="text-xs text-edgeOrange font-bold tracking-[0.2em] uppercase mt-0.5 font-sans">
            AI POWERED WEATHER SAFETY PORTAL
          </p>
        </div>
      </div>

      {/* Clock & Date */}
      <div className="flex items-center space-x-4 flex-shrink-0 whitespace-nowrap">
        <div className="flex items-center space-x-2.5 text-textIceWhite bg-bgDeepSpace/40 px-4 py-2 rounded-lg border border-slate-700/35 font-sans">
          <Clock className="w-5 h-5 text-edgeOrange flex-shrink-0" />
          <span className="text-2xl font-mono font-black tracking-wider">{formatTime(time)}</span>
          <span className="text-xs text-slate-400 font-bold uppercase pl-1">GST (UTC+4)</span>
        </div>
        <div className="text-base font-black text-slate-300 hidden md:block whitespace-nowrap flex-shrink-0">
          {formatDate(time)}
        </div>
      </div>

      {/* Right Controls & Views */}
      <div className="flex items-center space-x-2.5">
        {/* View Mode Tabs */}
        <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800/90 shadow-inner">
          {[
            { id: 'tv', label: 'TV Display' },
            { id: 'ops', label: 'Tactical Console' },
            { id: 'pilot', label: 'Drone Pilot' },
            { id: 'advisory', label: 'Safety Advisory' },
            { id: 'hse', label: 'HSE Dashboard' },
            { id: 'planning', label: 'Range Planning' },
            { id: 'customer', label: 'Customer Portal' },
            { id: 'backend', label: 'Backend Feeds' }
          ].map(tab => {
            const isActive = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onViewModeChange(tab.id)}
                className={`px-3 py-1.5 text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/40'
                    : 'text-slate-400 hover:text-textIceWhite hover:bg-slate-800/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Notification Bell */}
        <button
          onClick={onOpenAlerts}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer relative shadow-sm ${
            activeAlertsCount > 0
              ? 'bg-red-500/15 border-red-500/50 text-red-200 shadow-red-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-textIceWhite hover:border-slate-700'
          }`}
          title="Open Safety Alert Center & Dispatcher"
        >
          <Bell className={`w-3.5 h-3.5 ${activeAlertsCount > 0 ? 'text-red-400 animate-bounce' : 'text-slate-400'}`} />
          <span className="text-[10px] uppercase tracking-wide">Alert Center</span>
          {activeAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 border border-slate-900 text-[8.5px] font-black text-white px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px] shadow-sm select-none">
              {activeAlertsCount}
            </span>
          )}
        </button>

        {/* Unified System Telemetry Cluster */}
        <div className="flex items-center bg-slate-900/80 border border-slate-800/90 rounded-lg p-0.5 divide-x divide-slate-800/80 shadow-md">
          {/* Segment 1: Active Forecast Model */}
          <div 
            onClick={() => onViewModeChange('backend')}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-[9.5px] font-mono font-black uppercase tracking-wider cursor-pointer hover:bg-slate-800/50 transition-colors"
            title={`Active Engine: ${activeProvider?.startsWith('WEATHERNEXT') ? 'Google DeepMind WeatherNext 3 (5km)' : activeProvider || 'Open-Meteo'} • Click to view Backend Feeds`}
          >
            {activeProvider?.startsWith('WEATHERNEXT') ? (
              <Zap className="w-3 h-3 text-cyan-400 animate-pulse flex-shrink-0" />
            ) : (
              <Cpu className="w-3 h-3 text-slate-400 flex-shrink-0" />
            )}
            <span className={activeProvider?.startsWith('WEATHERNEXT') ? 'text-cyan-300' : 'text-slate-300'}>
              {activeProvider === PROVIDERS.WEATHERNEXT_SIM ? 'WN3 5km Sim' :
               activeProvider === PROVIDERS.WEATHERNEXT_LIVE ? 'WN3 Live' :
               activeProvider === PROVIDERS.UAE_NCM ? 'UAE NCM' : 'Open-Meteo'}
            </span>
          </div>

          {/* Segment 2: Satellite Ingestion countdown (shown when WeatherNext active) */}
          {activeProvider?.startsWith('WEATHERNEXT') && (
            <div 
              onClick={() => onViewModeChange && onViewModeChange('backend')}
              className="hidden 2xl:flex items-center space-x-1 px-2 py-1 text-[9px] font-mono font-bold text-sky-300 cursor-pointer hover:bg-slate-800/50 transition-colors"
              title="Meteosat-11 Radiance assimilation countdown"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping mr-0.5" />
              <span>SAT:{60 - (time ? time.getMinutes() % 60 : new Date().getMinutes() % 60)}m</span>
            </div>
          )}

          {/* Segment 3: Simulation Toggle */}
          <button
            onClick={onToggleSim}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-[9.5px] font-mono font-black uppercase tracking-wider transition-colors cursor-pointer border-none ${
              isSimulated
                ? 'bg-edgeOrange/20 text-edgeOrange hover:bg-edgeOrange/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            title="Toggle Weather Station Simulation Override"
          >
            <Cpu className={`w-3 h-3 ${isSimulated ? 'animate-pulse text-edgeOrange' : 'text-slate-500'}`} />
            <span>SIM:{isSimulated ? 'ON' : 'OFF'}</span>
          </button>

          {/* Segment 4: LG webOS / Smart TV Anti-Screensaver & Fullscreen Lock */}
          <button
            type="button"
            onClick={handleTvWakeAndFullscreen}
            className="flex items-center space-x-1 px-2 py-1 text-[9px] font-mono font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-950/50 transition-colors cursor-pointer border-none"
            title="TV Anti-Screensaver Active (Video + WakeLock) • Click to enter Fullscreen Kiosk Mode on LG TV"
          >
            <Tv className="w-3 h-3 text-safetyGreen animate-pulse" />
            <span>TV WAKE</span>
          </button>

          {/* Segment 5: Connection Link Status */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1" title={isOffline ? 'System Offline' : 'Live Data Stream Active'}>
            {isOffline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-stopRed" />
                <span className="text-[9.5px] font-mono font-black text-stopRed tracking-wider uppercase">OFFLINE</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-safetyGreen animate-pulse shadow-sm shadow-emerald-500/50" />
                <span className="text-[9.5px] font-mono font-black text-safetyGreen tracking-wider uppercase">ONLINE</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
