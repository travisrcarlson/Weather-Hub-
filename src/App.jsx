import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CurrentConditions from './components/CurrentConditions';
import WindWidget from './components/WindWidget';
import { HumidityWidget, VisibilityWidget, UvWidget, HydrationWidget } from './components/MetricsPanel';
import HourlyForecast from './components/HourlyForecast';
import SafetyBanner from './components/SafetyBanner';
import XRangeMap, { StationDetailsWidget } from './components/XRangeMap';
import { DailyForecastWidget, AqiWidget, SunTransitWidget } from './components/BottomRow';
import { fetchDashboardData } from './services/weatherService';
import { evaluateSafety, calculateDewPoint, calculateHumidex } from './utils/safetyEngine';
import { getWeatherCondition } from './utils/weatherCodeMap';
import TvGuidelinesWidget from './components/TvGuidelinesWidget';
import TvCoreMetricsWidget from './components/TvCoreMetricsWidget';
import SafetyAdvisory from './components/SafetyAdvisory';
import BackendFeeds from './components/BackendFeeds';

// Removed TvWeatherSummary component (HQ station data relocated to Operations Console page)

// Initial fallback data
const fallbackData = {
  current: {
    time: '2026-06-15T12:30',
    temperature_2m: 41.3,
    apparent_temperature: 43.1,
    relative_humidity_2m: 20,
    wind_speed_10m: 25.0,
    wind_direction_10m: 270,
    wind_gusts_10m: 35.0,
    weathercode: 3,
    visibility: 8000,
    precipitation: 0.0,
    cloud_cover: 35,
    pressure_msl: 1010.2,
    uv_index: 9.0,
    european_aqi: 68,
    pm2_5: 26.6,
    pm10: 52.2
  },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => `2026-06-15T${String(i).padStart(2, '0')}:00`),
    temperature_2m: [28, 27, 26, 26, 27, 27, 30, 32, 35, 37, 39, 40, 41, 42, 43, 42, 41, 39, 38, 36, 34, 32, 30, 29],
    apparent_temperature: [30, 29, 28, 28, 29, 29, 32, 34, 37, 39, 41, 42, 43, 44, 45, 44, 43, 41, 40, 38, 36, 34, 32, 31],
    relative_humidity_2m: [55, 58, 60, 62, 60, 58, 50, 45, 40, 35, 30, 25, 20, 20, 20, 22, 25, 30, 35, 40, 45, 50, 52, 55],
    weathercode: [0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 2, 2, 1, 1, 1, 0, 0, 0, 0],
    precipitation_probability: [0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 10, 10, 10, 5, 5, 0, 0, 0, 0, 0, 0, 0],
    wind_speed_10m: [10, 8, 9, 10, 11, 12, 15, 18, 22, 25, 30, 32, 35, 33, 30, 26, 22, 18, 15, 12, 10, 9, 9, 10],
    wind_direction_10m: [270, 265, 260, 260, 265, 270, 275, 280, 280, 275, 270, 270, 275, 280, 285, 290, 290, 285, 280, 275, 270, 265, 265, 270],
    wind_gusts_10m: [14, 11, 12, 14, 15, 16, 21, 25, 30, 33, 40, 44, 50, 47, 42, 36, 30, 24, 20, 16, 14, 13, 13, 14],
    uv_index: [0, 0, 0, 0, 0, 1, 3, 6, 8, 10, 11, 11, 10, 9, 7, 5, 3, 1, 0, 0, 0, 0, 0, 0],
    pressure_msl: [1010, 1010, 1010, 1011, 1011, 1011, 1010, 1010, 1009, 1009, 1008, 1008, 1008, 1009, 1009, 1010, 1010, 1010, 1011, 1011, 1011, 1011, 1011, 1010],
    visibility: [8000, 8000, 8000, 8000, 8000, 8500, 9000, 10000, 10000, 10000, 10000, 12000, 12000, 10000, 9000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
    cloud_cover: [30, 30, 35, 35, 40, 40, 35, 30, 25, 20, 20, 15, 15, 20, 25, 30, 35, 40, 40, 35, 30, 30, 30, 30],
    european_aqi: [60, 62, 65, 68, 70, 72, 70, 68, 65, 62, 60, 58, 60, 62, 65, 68, 70, 72, 70, 68, 65, 62, 60, 58],
    pm2_5: [22, 23, 24, 25, 26, 27, 26, 25, 24, 23, 22, 21, 22, 23, 24, 25, 26, 27, 26, 25, 24, 23, 22, 21],
    pm10: [45, 47, 50, 52, 55, 58, 55, 52, 50, 48, 45, 43, 45, 47, 50, 52, 55, 58, 55, 52, 50, 48, 45, 43]
  },
  daily: {
    time: ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'],
    weathercode: [3, 2, 1, 0, 0, 1, 3],
    temperature_2m_max: [43, 42, 40, 39, 41, 42, 44],
    temperature_2m_min: [28, 27, 26, 25, 27, 28, 29],
    wind_gusts_10m_max: [50, 45, 38, 32, 35, 48, 52],
    sunrise: ['2026-06-15T05:30', '2026-06-16T05:30', '2026-06-17T05:31', '2026-06-18T05:31', '2026-06-19T05:31', '2026-06-20T05:32', '2026-06-21T05:32'],
    sunset: ['2026-06-15T19:05', '2026-06-16T19:05', '2026-06-17T19:06', '2026-06-18T19:06', '2026-06-19T19:06', '2026-06-20T19:07', '2026-06-21T19:07']
  }
};

export default function App() {
  const [data, setData] = useState(fallbackData);
  const [apiMeta, setApiMeta] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('12:30:00');
  const [isOffline, setIsOffline] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [activeStation, setActiveStation] = useState('hq');
  const [viewMode, setViewMode] = useState('ops');
  const [systemTime, setSystemTime] = useState(new Date());

  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState('live'); // 'live', 'map', 'forecast', 'alerts'

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const activeTime = isSimulated ? new Date('2026-06-15T12:30:00') : systemTime;

  const loadData = async () => {
    try {
      const { mergedData, meta } = await fetchDashboardData();
      setData(mergedData);
      setApiMeta(meta);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Dubai' }));
      setIsOffline(false);
    } catch (err) {
      console.error("Fetch failed, using cached fallback data.", err);
      setIsOffline(true);
      setApiMeta(() => {
        const timestamp = new Date().toISOString();
        return {
          weather: {
            url: 'https://api.open-meteo.com/v1/forecast',
            status: 'OFFLINE',
            statusCode: 0,
            latency: 0,
            lastPing: timestamp,
            payload: { error: err.message || 'Network Timeout Error' }
          },
          aqi: {
            url: 'https://air-quality-api.open-meteo.com/v1/air-quality',
            status: 'OFFLINE',
            statusCode: 0,
            latency: 0,
            lastPing: timestamp,
            payload: { error: err.message || 'Network Timeout Error' }
          }
        };
      });
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSim = () => {
    setIsSimulated(prev => !prev);
  };

  const getCombinedSafety = () => {
    if (!data) return { status: 'GREEN', reasons: [], colors: { banner: 'bg-safetyGreen', pulse: false } };

    let globalStatus = 'GREEN';
    const globalReasons = [];

    if (!isSimulated) {
      const evalResult = evaluateSafety(data.current);
      globalStatus = evalResult.status;
      evalResult.reasons.forEach(r => globalReasons.push(r));
    } else {
      const stations = [
        {
          id: 'hq',
          name: 'Main HQ',
          readings: {
            ...data.current,
            temperature_2m: 41.3,
            apparent_temperature: 43.1,
            wind_speed_10m: 25,
            wind_gusts_10m: 35,
            relative_humidity_2m: 20,
            weathercode: 3,
            uv_index: 9.0
          }
        },
        {
          id: 'north',
          name: 'Range North',
          readings: {
            ...data.current,
            temperature_2m: 39.5,
            apparent_temperature: 42.0,
            wind_speed_10m: 42,
            wind_gusts_10m: 53,
            relative_humidity_2m: 25,
            visibility: 4000,
            weathercode: 45,
            uv_index: 9.0
          }
        },
        {
          id: 'south',
          name: 'Range South',
          readings: {
            ...data.current,
            temperature_2m: 44.5,
            apparent_temperature: 49.2,
            wind_speed_10m: 12,
            wind_gusts_10m: 18,
            relative_humidity_2m: 15,
            visibility: 12000,
            weathercode: 0,
            uv_index: 9.0
          }
        },
        {
          id: 'sea',
          name: 'Sea Boundary',
          readings: {
            ...data.current,
            temperature_2m: 34.0,
            apparent_temperature: 48.0,
            wind_speed_10m: 28,
            wind_gusts_10m: 42,
            relative_humidity_2m: 89,
            visibility: 2000,
            weathercode: 3,
            uv_index: 9.0
          }
        }
      ];

      stations.forEach(s => {
        const evalResult = evaluateSafety(s.readings);
        if (evalResult.status === 'RED') {
          globalStatus = 'RED';
        } else if (evalResult.status === 'AMBER' && globalStatus !== 'RED') {
          globalStatus = 'AMBER';
        }

        evalResult.reasons.forEach(r => {
          if (r.includes('MIDDAY BAN')) {
            if (!globalReasons.some(gr => gr.includes('MIDDAY BAN'))) {
              globalReasons.unshift(r);
            }
          } else {
            globalReasons.push(`${s.name}: ${r}`);
          }
        });
      });
    }

    // Incorporate NCM warnings into the safety state
    const ncmWarnings = data.ncmWarnings || [];
    ncmWarnings.forEach(w => {
      if (w.type === 'RED') {
        globalStatus = 'RED';
      } else if (w.type === 'AMBER' && globalStatus !== 'RED') {
        globalStatus = 'AMBER';
      }
      globalReasons.unshift(`[NCM ${w.type} ALERT] ${w.title}`);
    });

    let bannerColor = "bg-safetyGreen border-green-500 text-white";
    let pulse = false;
    if (globalStatus === "AMBER") {
      bannerColor = "bg-amberAlert border-amber-600 text-white animate-pulse";
    } else if (globalStatus === "RED") {
      bannerColor = "bg-stopRed border-red-600 text-white animate-red-flash";
      pulse = true;
    }

    return {
      status: globalStatus,
      reasons: globalReasons,
      colors: { banner: bannerColor, pulse }
    };
  };

  const globalSafety = getCombinedSafety();

  const getHQDisplayData = () => {
    if (!isSimulated) return data.current;
    return {
      ...data.current,
      temperature_2m: 41.3,
      apparent_temperature: 43.1,
      relative_humidity_2m: 20,
      wind_speed_10m: 25,
      wind_gusts_10m: 35,
      weathercode: 3,
      uv_index: 9.0
    };
  };

  const activeDisplayData = getHQDisplayData();

  // Calculate projected extremes for the next 12 hours
  const getTvProjectedExtremes = () => {
    if (!data || !data.hourly || !data.hourly.time) {
      return { maxTemp: 0, maxUv: 0, maxHumidex: 0 };
    }
    
    const now = isSimulated ? new Date('2026-06-15T12:30') : new Date();
    const getDubaiHourString = (date) => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        hourCycle: 'h23'
      });
      const parts = formatter.formatToParts(date);
      const getPart = (type) => parts.find(p => p.type === type).value;
      return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:00`;
    };
    const currentHourString = getDubaiHourString(now);
    let startIndex = data.hourly.time.findIndex(t => t.startsWith(currentHourString.slice(0, 13)));
    if (startIndex === -1) startIndex = 0;
    
    const next12Hours = data.hourly.time.slice(startIndex, startIndex + 12);
    
    let maxTemp = 0;
    let maxUv = 0;
    let maxHumidex = 0;
    
    next12Hours.forEach((t, i) => {
      const idx = startIndex + i;
      const temp = data.hourly.temperature_2m[idx];
      const uv = data.hourly.uv_index ? data.hourly.uv_index[idx] : 0;
      const rh = data.hourly.relative_humidity_2m ? data.hourly.relative_humidity_2m[idx] : 50;
      const dp = calculateDewPoint(temp, rh);
      const hx = calculateHumidex(temp, dp);
      
      if (temp > maxTemp) maxTemp = temp;
      if (uv > maxUv) maxUv = uv;
      if (hx > maxHumidex) maxHumidex = hx;
    });
    
    return {
      maxTemp,
      maxUv,
      maxHumidex
    };
  };

  const tvExtremes = getTvProjectedExtremes();

  if (isMobile) {
    return (
      <div className="w-full h-full bg-bgDeepSpace flex flex-col justify-between overflow-hidden relative pb-14">
        {/* Top Header bar (Z1) */}
        <Header 
          lastUpdated={lastUpdated} 
          isOffline={isOffline} 
          isSimulated={isSimulated}
          onToggleSim={handleToggleSim}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          time={activeTime}
          isMobile={true}
        />

        {/* Main Scrollable Content */}
        <main className="w-full flex-grow overflow-y-auto px-4 py-3 select-none no-scrollbar">
          {isOffline && (
            <div className="bg-stopRed/95 text-white text-[9px] font-black uppercase text-center py-1.5 mb-3 tracking-widest animate-pulse border-b border-red-700">
              ⚠️ DATA UNAVAILABLE • DISPLAYING CACHED OBSERVATIONS
            </div>
          )}

          {mobileTab === 'live' && (
            <div className="space-y-4">
              <div className="h-auto">
                <SafetyBanner safetyEvaluation={globalSafety} hourlyData={data.hourly} currentTime={activeTime} isMobile={true} ncmWarnings={data?.ncmWarnings} />
              </div>
              <div className="h-auto">
                <CurrentConditions data={activeDisplayData} dailyData={data.daily} hourlyData={data.hourly} />
              </div>
              <div className="grid grid-cols-2 gap-3 h-auto">
                <HumidityWidget data={activeDisplayData} hourlyData={data.hourly} />
                <VisibilityWidget data={activeDisplayData} hourlyData={data.hourly} />
              </div>
              <div className="h-auto">
                <UvWidget data={activeDisplayData} hourlyData={data.hourly} dailyData={data.daily} currentTime={activeTime} />
              </div>
              <div className="grid grid-cols-2 gap-3 h-auto">
                <AqiWidget data={activeDisplayData} hourlyData={data.hourly} />
                <HydrationWidget data={activeDisplayData} />
              </div>
            </div>
          )}

          {mobileTab === 'map' && (
            <div className="space-y-4 flex flex-col justify-between">
              <div className="w-full aspect-[440/185] border border-slate-700/30 rounded bg-bgDeepSpace/40 overflow-hidden flex items-center justify-center">
                <XRangeMap 
                  apiData={data} 
                  isSimulated={isSimulated} 
                  activeStation={activeStation}
                  setActiveStation={setActiveStation}
                  isBackground={false}
                  hideDetails={true}
                  showSimulatedStations={true}
                  ncmWarnings={data?.ncmWarnings}
                />
              </div>
              <div className="w-full">
                <StationDetailsWidget 
                  apiData={data} 
                  isSimulated={isSimulated} 
                  activeStation={activeStation} 
                  setActiveStation={setActiveStation}
                />
              </div>
            </div>
          )}

          {mobileTab === 'forecast' && (
            <div className="space-y-4">
              <div className="h-[200px]">
                <WindWidget data={activeDisplayData} hourlyData={data.hourly} currentTime={activeTime} />
              </div>
              <div className="h-[120px]">
                <SunTransitWidget dailyData={data.daily} currentTime={activeTime} />
              </div>
              <div className="h-[220px]">
                <HourlyForecast 
                  hourlyData={data.hourly} 
                  currentTime={activeTime} 
                  dailyData={data.daily}
                />
              </div>
              <div className="h-[150px]">
                <DailyForecastWidget dailyData={data.daily} />
              </div>
            </div>
          )}

          {mobileTab === 'alerts' && (
            <div className="space-y-4">
              <div className="h-auto">
                <SafetyBanner safetyEvaluation={globalSafety} hourlyData={data.hourly} currentTime={activeTime} isMobile={true} ncmWarnings={data?.ncmWarnings} />
              </div>
              <div className="border border-slate-800 bg-cardDarkSlate p-4 rounded-xl">
                <SafetyAdvisory data={activeDisplayData} ncmWarnings={data?.ncmWarnings} />
              </div>
            </div>
          )}
        </main>

        {/* Mobile Navigation Bar */}
        <nav className="absolute bottom-0 left-0 right-0 h-14 bg-cardDarkSlate border-t border-slate-800/80 flex flex-row items-stretch justify-around z-50 select-none">
          <button 
            onClick={() => setMobileTab('live')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-none cursor-pointer ${mobileTab === 'live' ? 'text-edgeOrange font-black bg-slate-900/40' : 'text-slate-400 font-bold'}`}
          >
            <span className="text-base">📊</span>
            <span className="text-[9px] uppercase tracking-wider">Live</span>
          </button>
          <button 
            onClick={() => setMobileTab('map')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-none cursor-pointer ${mobileTab === 'map' ? 'text-edgeOrange font-black bg-slate-900/40' : 'text-slate-400 font-bold'}`}
          >
            <span className="text-base">🗺️</span>
            <span className="text-[9px] uppercase tracking-wider">Map</span>
          </button>
          <button 
            onClick={() => setMobileTab('forecast')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-none cursor-pointer ${mobileTab === 'forecast' ? 'text-edgeOrange font-black bg-slate-900/40' : 'text-slate-400 font-bold'}`}
          >
            <span className="text-base">📅</span>
            <span className="text-[9px] uppercase tracking-wider">Forecast</span>
          </button>
          <button 
            onClick={() => setMobileTab('alerts')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-none cursor-pointer ${mobileTab === 'alerts' ? 'text-edgeOrange font-black bg-slate-900/40' : 'text-slate-400 font-bold'}`}
          >
            <span className={`text-base ${globalSafety.status === 'RED' ? 'text-stopRed animate-pulse' : globalSafety.status === 'AMBER' ? 'text-amberAlert' : ''}`}>⚠️</span>
            <span className="text-[9px] uppercase tracking-wider">Alerts</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-bgDeepSpace flex flex-col justify-between overflow-hidden relative">
      {/* Top Header bar (Z1) */}
      <Header 
        lastUpdated={lastUpdated} 
        isOffline={isOffline} 
        isSimulated={isSimulated}
        onToggleSim={handleToggleSim}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        time={activeTime}
      />

      {/* Main Container */}
      <main className="w-full h-[92%] relative select-none overflow-hidden">
        
        {/* View Mode Switching Overlays */}
        {viewMode === 'tv' && (
          /* TV Display (Simplified lobby mode) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-none flex flex-col justify-between space-y-3.5 w-full h-full">
            {/* Z8 Safety Status Banner */}
            <div className="h-[12%] pointer-events-auto">
              <SafetyBanner safetyEvaluation={globalSafety} hourlyData={data.hourly} currentTime={activeTime} ncmWarnings={data?.ncmWarnings} />
            </div>

            {/* 3-Column Split Layout */}
            <div className="h-[84%] grid grid-cols-10 gap-5 pointer-events-none items-stretch">
              {/* Left Column (Col-span-3): Daily Outlook extremes, Sunrise/Sunset & Hourly Forecast */}
              <div className="col-span-3 h-full pointer-events-auto flex flex-col justify-between space-y-3.5">
                <div className="h-[18%]">
                  <TvCoreMetricsWidget currentData={activeDisplayData} extremes={tvExtremes} hourlyData={data.hourly} />
                </div>
                <div className="h-[24%]">
                  <SunTransitWidget dailyData={data.daily} currentTime={activeTime} />
                </div>
                <div className="h-[54%]">
                  <HourlyForecast 
                    hourlyData={data.hourly} 
                    currentTime={activeTime} 
                    dailyData={data.daily}
                  />
                </div>
              </div>

              {/* Center Column (Col-span-4): Opaque Map Card */}
              <div className="col-span-4 h-full pointer-events-auto">
                <XRangeMap 
                  apiData={data} 
                  isSimulated={isSimulated} 
                  activeStation={activeStation}
                  setActiveStation={setActiveStation}
                  isBackground={false}
                  hideDetails={true}
                  showSimulatedStations={false}
                  ncmWarnings={data?.ncmWarnings}
                />
              </div>

              {/* Right Column (Col-span-3): Dynamic Guidelines */}
              <div className="col-span-3 h-full pointer-events-auto">
                <TvGuidelinesWidget data={activeDisplayData} />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'ops' && (
          /* Operations Console (Complex dashboard view) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-none grid grid-cols-10 gap-4 w-full h-full">
            
             {/* Left Sidebar (Col-span-2): Current, Heat Stress, Hydration, Wind Safety */}
             <div className="col-span-2 h-full flex flex-col justify-between space-y-3 pointer-events-auto">
               <div className="h-[24%]">
                 <CurrentConditions data={activeDisplayData} dailyData={data.daily} hourlyData={data.hourly} />
               </div>
               <div className="h-[18%]">
                 <HumidityWidget data={activeDisplayData} hourlyData={data.hourly} />
               </div>
               <div className="h-[16%]">
                 <HydrationWidget data={activeDisplayData} />
               </div>
               <div className="h-[38%]">
                 <WindWidget data={activeDisplayData} hourlyData={data.hourly} currentTime={activeTime} />
               </div>
             </div>

            {/* Center Column (Col-span-6): Safety Banner, Station Details overlay, and Forecasts */}
            <div className="col-span-6 h-full flex flex-col justify-between space-y-3 pointer-events-none">
              {/* Z8 Safety Status Banner */}
              <div className="h-[12%] pointer-events-auto">
                <SafetyBanner safetyEvaluation={globalSafety} hourlyData={data.hourly} currentTime={activeTime} ncmWarnings={data?.ncmWarnings} />
              </div>

              {/* Central Area: Opaque Map Card with Station Details */}
              <div className="h-[58%] pointer-events-auto">
                <XRangeMap 
                  apiData={data} 
                  isSimulated={isSimulated} 
                  activeStation={activeStation}
                  setActiveStation={setActiveStation}
                  isBackground={false}
                  hideDetails={true}
                  showSimulatedStations={false}
                  ncmWarnings={data?.ncmWarnings}
                />
              </div>

              {/* Bottom Forecast Row: Hourly (65%) and 5-Day Daily (35%) */}
              <div className="h-[26%] flex flex-row space-x-4 items-stretch pointer-events-auto">
                <div className="w-[65%] h-full">
                  <HourlyForecast 
                    hourlyData={data.hourly} 
                    currentTime={activeTime} 
                    dailyData={data.daily}
                  />
                </div>
                <div className="w-[35%] h-full">
                  <DailyForecastWidget dailyData={data.daily} />
                </div>
              </div>
            </div>

            {/* Right Sidebar (Col-span-2): UV, Visibility, AQI, Sunrise/Sunset (Light/Curfew) */}
             <div className="col-span-2 h-full flex flex-col justify-between space-y-3 pointer-events-auto">
               <div className="h-[47%]">
                 <UvWidget data={activeDisplayData} hourlyData={data.hourly} dailyData={data.daily} currentTime={activeTime} />
               </div>
               <div className="h-[16%]">
                 <VisibilityWidget data={activeDisplayData} hourlyData={data.hourly} />
               </div>
               <div className="h-[15.5%]">
                 <AqiWidget data={activeDisplayData} hourlyData={data.hourly} />
               </div>
               <div className="h-[16%]">
                 <SunTransitWidget dailyData={data.daily} currentTime={activeTime} />
               </div>
             </div>

          </div>
        )}

        {viewMode === 'advisory' && (
          /* Safety Advisory (Standard Operating Procedures & Survival Guidelines) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <SafetyAdvisory data={activeDisplayData} ncmWarnings={data?.ncmWarnings} />
          </div>
        )}

        {viewMode === 'backend' && (
          /* Backend Diagnostic Status & Telemetry feeds */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <BackendFeeds 
              isSimulated={isSimulated} 
              apiMeta={apiMeta} 
              isOffline={isOffline} 
              apiData={data}
              activeStation={activeStation}
              setActiveStation={setActiveStation}
            />
          </div>
        )}

      </main>

      {/* Offline Alert Overlay */}
      {isOffline && (
        <div className="absolute top-[8%] left-0 right-0 bg-stopRed/95 text-white text-[10px] font-black uppercase text-center py-1 select-none z-50 tracking-widest animate-pulse border-b border-red-700">
          ⚠️ DATA UNAVAILABLE • DISPLAYING CACHED METEOROLOGICAL OBSERVATIONS
        </div>
      )}
    </div>
  );
}
