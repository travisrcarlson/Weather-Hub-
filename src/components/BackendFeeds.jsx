import React, { useState } from 'react';
import { Database, Network, Activity, Cpu, Code, Copy, Check, ShieldAlert, Wifi, Globe, MapPin, ExternalLink } from 'lucide-react';
import XRangeMap from './XRangeMap';

export default function BackendFeeds({ isSimulated, apiMeta, isOffline, apiData, activeStation, setActiveStation }) {
  const [expandedFeed, setExpandedFeed] = useState('weather');
  const [copied, setCopied] = useState(null);
  const [subTab, setSubTab] = useState('telemetry');

  const handleCopy = (feedKey, text) => {
    navigator.clipboard.writeText(text);
    setCopied(feedKey);
    setTimeout(() => setCopied(null), 2000);
  };

  // Mock metadata if we don't have meta yet (e.g., loading or offline)
  const defaultMeta = {
    weather: {
      url: 'https://api.open-meteo.com/v1/forecast',
      status: isOffline ? 'OFFLINE' : (isSimulated ? 'SIMULATED' : 'OK'),
      statusCode: isOffline ? 503 : 200,
      latency: isSimulated ? 4 : 142,
      lastPing: new Date().toISOString(),
      payload: { message: "Weather data payload is loading or offline..." }
    },
    aqi: {
      url: 'https://air-quality-api.open-meteo.com/v1/air-quality',
      status: isOffline ? 'OFFLINE' : (isSimulated ? 'SIMULATED' : 'OK'),
      statusCode: isOffline ? 503 : 200,
      latency: isSimulated ? 2 : 110,
      lastPing: new Date().toISOString(),
      payload: { message: "AQI data payload is loading or offline..." }
    }
  };

  const feeds = apiMeta || defaultMeta;

  // Let's create an override status if system is simulated
  const getFeedStatus = (key) => {
    if (isOffline) return { label: 'OFFLINE', color: 'text-stopRed border-stopRed/40 bg-stopRed/10', icon: ShieldAlert };
    if (isSimulated) return { label: 'SIMULATED', color: 'text-edgeOrange border-edgeOrange/40 bg-edgeOrange/10', icon: Cpu };
    return { label: 'CONNECTED', color: 'text-safetyGreen border-safetyGreen/40 bg-safetyGreen/10', icon: Wifi };
  };

  return (
    <div className="w-full h-full p-6 bg-slate-950 flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* Sub-tab Navigation */}
      <div className="flex-none flex space-x-4 border-b border-slate-800 pb-3 mb-4">
        <button
          onClick={() => setSubTab('telemetry')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            subTab === 'telemetry'
              ? 'border-edgeOrange text-edgeOrange bg-edgeOrange/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          API Endpoints & Telemetry
        </button>
        <button
          onClick={() => setSubTab('stations')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            subTab === 'stations'
              ? 'border-edgeOrange text-edgeOrange bg-edgeOrange/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Simulated Local Stations
        </button>
      </div>

      {subTab === 'telemetry' ? (
        <div className="flex-grow h-[88%] grid grid-cols-12 gap-6 items-stretch overflow-hidden">
          {/* Left Panel (Col-span-5): Feed Statuses and Coordinate Metadata */}
          <div className="col-span-5 flex flex-col justify-between h-full space-y-4">
            
            {/* Header Card */}
            <div className="bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden flex-none">
              <div className="absolute inset-0 bg-[radial-gradient(#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
                  SYSTEM CORE • DATA FLOW
                </p>
                <h2 className="text-lg font-black text-textIceWhite uppercase tracking-wide">
                  Backend Feeds & APIs
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Weather stations and Open-Meteo GPS grid queries. This diagnostic panel monitors endpoints, connection latencies, and parses incoming telemetry payloads.
                </p>
              </div>
            </div>

            {/* Coordinate Details Card */}
            <div className="bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between flex-none">
              <div className="flex items-center space-x-2 border-b border-slate-800/60 pb-2 mb-3">
                <Globe className="w-4 h-4 text-edgeOrange" />
                <span className="text-xs font-bold text-textIceWhite uppercase tracking-wider">Geographic Telemetry Target</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bgDeepSpace/40 border border-slate-850 p-2.5 rounded-lg flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">ABU AL ABYAD</p>
                    <p className="text-xs font-black text-textIceWhite">Abu Dhabi, UAE</p>
                  </div>
                </div>

                <div className="bg-bgDeepSpace/40 border border-slate-850 p-2.5 rounded-lg flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">COORDINATES</p>
                    <p className="text-xs font-mono font-black text-textIceWhite">24.20° N, 52.78° E</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center bg-bgDeepSpace/20 px-3 py-1.5 rounded-lg border border-slate-800/30">
                <span>TIMEZONE TARGET:</span>
                <span className="font-mono text-slate-300">ASIA/DUBAI (GST, UTC+4)</span>
              </div>
            </div>

            {/* Feed List Cards */}
            <div className="flex-grow flex flex-col space-y-3 justify-between overflow-y-auto no-scrollbar">
              {Object.keys(feeds).map((key) => {
                const feed = feeds[key];
                const status = getFeedStatus(key);
                const StatusIcon = status.icon;
                const isSelected = expandedFeed === key;

                return (
                  <div
                    key={key}
                    onClick={() => setExpandedFeed(key)}
                    className={`bg-cardDarkSlate border rounded-xl p-4 transition-all duration-305 cursor-pointer flex flex-col justify-between h-[47%] ${
                      isSelected 
                        ? 'border-edgeOrange bg-edgeOrange/5 shadow-md shadow-edgeOrange/5' 
                        : 'border-slate-700/40 hover:border-slate-650'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-edgeOrange/10 text-edgeOrange' : 'bg-slate-800 text-slate-400'}`}>
                          {key === 'weather' ? <Database className="w-5 h-5" /> : <Network className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-textIceWhite uppercase">
                            {key === 'weather' ? 'Open-Meteo Forecast' : 'Open-Meteo Air Quality'}
                          </h3>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
                            {feed.url}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center space-x-1 ${status.color}`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        <span>{status.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-slate-800/60 pt-3 mt-2">
                      <div>
                        <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-none mb-1">LATENCY</p>
                        <p className="text-sm font-mono font-black text-textIceWhite leading-none flex items-baseline">
                          {isOffline ? '--' : feed.latency}
                          {!isOffline && <span className="text-[9px] text-slate-500 ml-0.5">ms</span>}
                        </p>
                      </div>

                      <div>
                        <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-none mb-1">STATUS CODE</p>
                        <p className={`text-sm font-mono font-black leading-none ${feed.statusCode === 200 ? 'text-safetyGreen' : 'text-stopRed'}`}>
                          {feed.statusCode || '---'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-none mb-1">PING TIME</p>
                        <p className="text-sm font-mono font-bold text-slate-400 leading-none truncate" title={new Date(feed.lastPing).toLocaleTimeString()}>
                          {new Date(feed.lastPing).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Latency Bar */}
                    {!isOffline && (
                      <div className="w-full h-1 bg-bgDeepSpace/60 rounded-full overflow-hidden mt-3">
                        <div 
                          style={{ width: `${Math.min((feed.latency / 400) * 100, 100)}%` }}
                          className={`h-full transition-all duration-305 ${
                            feed.latency > 300 ? 'bg-stopRed' : (feed.latency > 150 ? 'bg-amberAlert' : 'bg-safetyGreen')
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          {/* Right Panel (Col-span-7): Live JSON Payload Viewer */}
          <div className="col-span-7 bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between h-full relative overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3 mb-2 flex-none">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-edgeOrange" />
                <span className="text-sm font-black text-textIceWhite uppercase tracking-wider">
                  Live Payload: {expandedFeed === 'weather' ? 'Weather API Response' : 'Air Quality API Response'}
                </span>
              </div>
              
              <button
                onClick={() => handleCopy(expandedFeed, JSON.stringify(feeds[expandedFeed]?.payload, null, 2))}
                className="flex items-center space-x-1.5 px-3 py-1 rounded bg-bgDeepSpace/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors text-slate-300 hover:text-textIceWhite text-[10px] font-black uppercase cursor-pointer"
              >
                {copied === expandedFeed ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-safetyGreen" />
                    <span className="text-safetyGreen">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Payload</span>
                  </>
                )}
              </button>
            </div>

            {/* JSON Display Area */}
            <div className="flex-1 bg-slate-950 border border-slate-900 rounded-lg p-4 font-mono text-[11px] text-slate-300 overflow-y-auto no-scrollbar relative w-full h-[85%] select-text">
              {feeds[expandedFeed]?.payload ? (
                <pre className="whitespace-pre-wrap break-all leading-relaxed tab-size-4">
                  {JSON.stringify(feeds[expandedFeed].payload, null, 2)}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-500 italic">
                  <span>No live payload telemetry available.</span>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase mt-3 flex-none border-t border-slate-850 pt-2">
              <span>RESPONSE ENCODING: UTF-8</span>
              <span className="flex items-center space-x-1 text-slate-400">
                <span>GPS API GRID RESOLUTION: 0.1° (~11KM)</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>

          </div>
        </div>
      ) : (
        <div className="flex-grow h-[88%] w-full">
          <XRangeMap 
            apiData={apiData} 
            isSimulated={isSimulated} 
            activeStation={activeStation}
            setActiveStation={setActiveStation}
            isBackground={false}
            hideDetails={false}
            showSimulatedStations={true}
          />
        </div>
      )}
    </div>
  );
}
