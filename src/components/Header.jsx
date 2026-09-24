import { Clock, Wifi, WifiOff, Cpu, Bell, Zap } from 'lucide-react';
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
              XRANGE
            </h1>
            <span className="text-[7.5px] text-edgeOrange font-black tracking-wider uppercase mt-0.5 font-sans">
              SAFETY PORTAL
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
        <div className="border-l border-slate-700/50 pl-4 flex flex-col justify-center">
          <h1 className="text-2xl font-black tracking-widest text-textIceWhite uppercase leading-none">
            XRANGE SYSTEM
          </h1>
          <p className="text-xs text-edgeOrange font-bold tracking-[0.2em] uppercase mt-1 font-sans">
            WEATHER SAFETY PORTAL
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
      <div className="flex items-center space-x-3">
        {/* View Mode Tabs */}
        <div className="flex bg-bgDeepSpace/60 p-1 rounded-lg border border-slate-750/50">
          <button
            onClick={() => onViewModeChange('tv')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'tv'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            TV Display
          </button>
          <button
            onClick={() => onViewModeChange('ops')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'ops'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            Tactical Console
          </button>
          <button
            onClick={() => onViewModeChange('advisory')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'advisory'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            Safety Advisory
          </button>
          <button
            onClick={() => onViewModeChange('hse')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'hse'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            HSE Dashboard
          </button>
          <button
            onClick={() => onViewModeChange('planning')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'planning'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            Range Planning
          </button>
          <button
            onClick={() => onViewModeChange('customer')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'customer'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            Customer Portal
          </button>
          <button
            onClick={() => onViewModeChange('backend')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
              viewMode === 'backend'
                ? 'bg-edgeOrange text-white shadow-md shadow-edgeOrange/10'
                : 'text-slate-400 hover:text-textIceWhite'
            }`}
          >
            Backend Feeds
          </button>
        </div>

        {/* Notification Bell */}
        <button
          onClick={onOpenAlerts}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-305 cursor-pointer relative ${
            activeAlertsCount > 0
              ? 'bg-red-500/10 border-red-500/50 text-red-200 shadow-lg shadow-red-500/5'
              : 'bg-bgDeepSpace/40 border-slate-700/40 text-slate-400 hover:text-textIceWhite hover:border-slate-600'
          }`}
          title="Open Safety Alert Center & Dispatcher"
        >
          <Bell className={`w-3.5 h-3.5 ${activeAlertsCount > 0 ? 'text-red-400 animate-bounce' : ''}`} />
          <span className="text-[10px] uppercase tracking-wide">Alert Center</span>
          {activeAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 border border-cardDarkSlate text-[8.5px] font-black text-white px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px] shadow-sm select-none">
              {activeAlertsCount}
            </span>
          )}
        </button>

        {/* Satellite Assimilation Ingestion Countdown Badge */}
        {activeProvider?.startsWith('WEATHERNEXT') && (
          <div 
            onClick={() => onViewModeChange && onViewModeChange('backend')}
            className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-sky-500/30 bg-sky-950/40 text-sky-300 text-[10px] font-mono font-black uppercase tracking-wider cursor-pointer hover:bg-sky-950/60 transition-all shadow-sm"
            title="Google DeepMind WeatherNext 3 assimilates real-time Meteosat-11 IODC (41.5°E) satellite radiance every 60 minutes for rapid convective detection. Click to view Backend Diagnostics."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            <span>🛰️ SAT INGEST: {60 - (time ? time.getMinutes() % 60 : new Date().getMinutes() % 60)}m</span>
          </div>
        )}

        {/* Active AI Forecast Engine Badge */}
        <div 
          onClick={() => onViewModeChange('backend')}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-black uppercase tracking-wider cursor-pointer transition-all ${
            activeProvider?.startsWith('WEATHERNEXT')
              ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/60'
              : activeProvider === PROVIDERS.UAE_NCM
              ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-950/60'
              : 'bg-bgDeepSpace/40 border-slate-700/40 text-slate-300 hover:text-textIceWhite'
          }`}
          title={`Click to view Backend Feeds • Active Engine: ${activeProvider?.startsWith('WEATHERNEXT') ? 'Google DeepMind WeatherNext 3 (5km)' : activeProvider || 'Open-Meteo'}`}
        >
          {activeProvider?.startsWith('WEATHERNEXT') ? (
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          ) : (
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>
            {activeProvider === PROVIDERS.WEATHERNEXT_SIM ? 'WeatherNext 3 (5km Sim)' :
             activeProvider === PROVIDERS.WEATHERNEXT_LIVE ? 'WeatherNext 3 (Live)' :
             activeProvider === PROVIDERS.UAE_NCM ? 'UAE NCM' : 'Open-Meteo GFS'}
          </span>
        </div>

        {/* Simulation Toggle */}
        <button
          onClick={onToggleSim}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-300 cursor-pointer ${
            isSimulated
              ? 'bg-edgeOrange/20 border-edgeOrange text-edgeOrange shadow-lg shadow-edgeOrange/10'
              : 'bg-bgDeepSpace/40 border-slate-700/40 text-slate-400 hover:text-textIceWhite hover:border-slate-600'
          }`}
          title="Toggle Weather Station Simulation Override"
        >
          <Cpu className={`w-3.5 h-3.5 ${isSimulated ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] uppercase tracking-wide">{isSimulated ? 'Sim active' : 'Simulate feeds'}</span>
        </button>

        {/* Connection Status */}
        <div className="flex items-center space-x-1.5 bg-bgDeepSpace/40 px-3 py-1.5 rounded-lg border border-slate-700/30">
          {isOffline ? (
            <>
              <WifiOff className="w-4 h-4 text-stopRed" />
              <span className="text-[10px] font-bold text-stopRed tracking-wider uppercase">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-safetyGreen animate-pulse" />
              <span className="text-[10px] font-bold text-safetyGreen tracking-wider uppercase">Connected</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
