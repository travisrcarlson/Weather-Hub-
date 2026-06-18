import React, { useState, useEffect } from 'react';
import { Clock, Wifi, WifiOff, Cpu } from 'lucide-react';

export default function Header({ 
  lastUpdated, 
  isOffline, 
  isSimulated, 
  onToggleSim, 
  viewMode, 
  onViewModeChange,
  time,
  isMobile
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
            src="/remaya_logo.png" 
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

        <div className="flex items-center space-x-2">
          {/* Clock */}
          <div className="flex items-center space-x-1.5 text-textIceWhite bg-bgDeepSpace/40 px-2.5 py-1.5 rounded border border-slate-700/35">
            <Clock className="w-3.5 h-3.5 text-edgeOrange" />
            <span className="text-xs font-mono font-black tracking-wider leading-none">{formatTime(time)}</span>
          </div>

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
    <header className="w-full h-[8%] bg-navyGradient border-b border-cardDarkSlate/60 flex items-center justify-between px-6 select-none relative z-50">
      {/* Remaya Logo & Title */}
      <div className="flex items-center space-x-5">
        {/* Remaya Corporate Logo Image Badge */}
        <div className="h-16 bg-white rounded-lg px-2 py-0.5 flex items-center justify-center shadow-md shadow-white/5 border border-white/85">
          <img 
            src="/remaya_logo.png" 
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
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3 text-textIceWhite bg-bgDeepSpace/40 px-5 py-2 rounded-lg border border-slate-700/35">
          <Clock className="w-5 h-5 text-edgeOrange" />
          <span className="text-2xl font-mono font-black tracking-wider">{formatTime(time)}</span>
          <span className="text-xs text-slate-400 font-bold uppercase pl-1">GST (UTC+4)</span>
        </div>
        <div className="text-lg font-black text-slate-300 hidden md:block">
          {formatDate(time)}
        </div>
      </div>

      {/* Controls: View Mode & Simulation */}
      <div className="flex items-center space-x-4">
        {/* View Mode Toggle Tabs */}
        <div className="flex items-center bg-bgDeepSpace/40 rounded-lg p-0.5 border border-slate-700/40">
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
