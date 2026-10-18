import React, { useState, useEffect, Suspense, lazy } from 'react';
import Header from './components/Header';
import CurrentConditions from './components/CurrentConditions';
import WindWidget from './components/WindWidget';
import { HumidityWidget, VisibilityWidget, UvWidget, HydrationWidget } from './components/MetricsPanel';
import HourlyForecast from './components/HourlyForecast';
import SafetyBanner from './components/SafetyBanner';
import XRangeMap, { StationDetailsWidget } from './components/XRangeMap';
import { DailyForecastWidget, AqiWidget, SunTransitWidget } from './components/BottomRow';
import { fetchDashboardData, getActiveProvider } from './services/weatherService';
import { evaluateSafety, calculateDewPoint, calculateHumidex, calculateWBGT } from './utils/safetyEngine';
import { getWeatherCondition } from './utils/weatherCodeMap';
import TvGuidelinesWidget from './components/TvGuidelinesWidget';
import TvCoreMetricsWidget from './components/TvCoreMetricsWidget';
import { checkAndDispatchAutoAlerts } from './services/hseBroadcastService';
import { detectHaboobConvectiveRisk } from './utils/tacticalBallisticsEngine';

const SafetyAdvisory = lazy(() => import('./components/SafetyAdvisory'));
const BackendFeeds = lazy(() => import('./components/BackendFeeds'));
const HseDashboard = lazy(() => import('./components/HseDashboard'));
const PlanningDashboard = lazy(() => import('./components/PlanningDashboard'));
const CustomerPortal = lazy(() => import('./components/CustomerPortal'));
const AlertCenter = lazy(() => import('./components/AlertCenter'));
const TacticalBallisticsModal = lazy(() => import('./components/TacticalBallisticsModal'));
const MunitionsThermalModal = lazy(() => import('./components/MunitionsThermalModal'));

const ViewLoadingFallback = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-950/80 border border-slate-800/80 text-slate-400 text-xs font-mono uppercase tracking-widest animate-pulse">
    Loading Range Safety Module...
  </div>
);

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
  hourly: (() => {
    const time = [];
    const temperature_2m = [];
    const apparent_temperature = [];
    const relative_humidity_2m = [];
    const wind_speed_10m = [];
    const wind_gusts_10m = [];
    const uv_index = [];
    const visibility = [];
    const pm10 = [];
    const european_aqi = [];
    
    // Generate 9 days of hourly data starting from 2 days ago (9 * 24 = 216 hours)
    // Simulated base date is June 15, 2026. Let's start from June 13, 2026.
    const baseDate = new Date('2026-06-13T00:00:00');
    for (let i = 0; i < 216; i++) {
      const d = new Date(baseDate.getTime() + i * 3600000);
      const pad = (num) => String(num).padStart(2, '0');
      const timeStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
      time.push(timeStr);
      
      const hour = d.getHours();
      const tempVal = 30 + 12 * Math.sin((hour - 8) * Math.PI / 12) + (Math.random() * 1.5 - 0.75);
      temperature_2m.push(tempVal);
      apparent_temperature.push(tempVal + 2 + (Math.random() * 1.0 - 0.5));
      
      const rhVal = 55 - 25 * Math.sin((hour - 8) * Math.PI / 12) + (Math.random() * 5 - 2.5);
      relative_humidity_2m.push(Math.round(rhVal));
      
      const windVal = 12 + 10 * Math.sin((hour - 9) * Math.PI / 12) + (Math.random() * 4 - 2);
      wind_speed_10m.push(Math.max(5, windVal));
      wind_gusts_10m.push(Math.max(8, windVal * 1.3 + (Math.random() * 3)));
      
      const uvVal = (hour >= 6 && hour <= 18) ? 11 * Math.sin((hour - 6) * Math.PI / 12) : 0;
      uv_index.push(parseFloat(uvVal.toFixed(1)));
      
      visibility.push(12000 + (Math.random() * 2000 - 1000));
      pm10.push(40 + Math.random() * 20);
      european_aqi.push(Math.round(45 + Math.random() * 25));
    }
    
    return {
      time,
      temperature_2m,
      apparent_temperature,
      relative_humidity_2m,
      weathercode: Array(216).fill(0),
      precipitation_probability: Array(216).fill(0),
      wind_speed_10m,
      wind_direction_10m: Array(216).fill(260),
      wind_gusts_10m,
      uv_index,
      pressure_msl: Array(216).fill(1008.5),
      visibility,
      cloud_cover: Array(216).fill(10),
      european_aqi,
      pm2_5: Array(216).fill(20.2),
      pm10
    };
  })(),
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
  const [simulatedLightning, setSimulatedLightning] = useState(false);
  const [activeStation, setActiveStation] = useState('hq');
  const [viewMode, setViewMode] = useState('ops');
  const [systemTime, setSystemTime] = useState(new Date());
  const [activeProvider, setActiveProviderState] = useState(getActiveProvider());

  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState('live'); // 'live', 'map', 'forecast', 'alerts'

  const [isAlertCenterOpen, setIsAlertCenterOpen] = useState(false);
  const [isBallisticsModalOpen, setIsBallisticsModalOpen] = useState(false);
  const [isMunitionsThermalModalOpen, setIsMunitionsThermalModalOpen] = useState(false);
  
  const [recipientDirectory, setRecipientDirectory] = useState({
    officers: [
      { name: 'Captain Al-Mansoori', phone: '+971 50 123 4567' },
      { name: 'Lieutenant Al-Shehhi', phone: '+971 50 234 5678' },
      { name: 'Range Officer J. Davis', phone: '+971 54 888 1234' }
    ],
    hands: [
      { name: 'HQ Logistics Lead', phone: '+971 56 345 6789' },
      { name: 'North Range Duty Officer', phone: '+971 52 456 7890' },
      { name: 'South Range Gate Security', phone: '+971 50 567 8901' },
      { name: 'Target Crew Crew Chief', phone: '+971 55 678 9012' }
    ],
    rd_teams: [
      { name: 'Dr. Sarah Carter (Ballistics)', phone: '+971 56 789 0123' },
      { name: 'Engineer Chen (Drones)', phone: '+971 55 890 1234' },
      { name: 'Laser Safety Specialist', phone: '+971 50 901 2345' }
    ],
    supervisors: [
      { name: 'HSE Director Salem', phone: '+971 52 111 2222' },
      { name: 'Operations Chief Miller', phone: '+971 50 333 4444' },
      { name: 'Range Commander Al-Nahyan', phone: '+971 50 555 6666' }
    ]
  });

  const [broadcastHistory, setBroadcastHistory] = useState([
    {
      id: 1,
      channel: 'sms',
      group: 'hands',
      message: '📢 RANGE SAFETY NOTICE: Hydration protocols are active (ADOSH orange zone). Ensure all personnel consume 0.75L/hour chilled water and work in shade where possible.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      recipients: [
        { name: 'HQ Logistics Lead', phone: '+971 56 345 6789', status: 'delivered', time: '13:45:10' },
        { name: 'North Range Duty Officer', phone: '+971 52 456 7890', status: 'delivered', time: '13:45:12' },
        { name: 'South Range Gate Security', phone: '+971 50 567 8901', status: 'delivered', time: '13:45:15' },
        { name: 'Target Crew Crew Chief', phone: '+971 55 678 9012', status: 'delivered', time: '13:45:18' }
      ]
    },
    {
      id: 2,
      channel: 'whatsapp',
      group: 'officers',
      message: '☀️ Midday Work Ban compliance reminder: All outdoor physical activities must stand down from 12:30 to 15:00 GST. Range Officers please ensure all field teams comply.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
      recipients: [
        { name: 'Captain Al-Mansoori', phone: '+971 50 123 4567', status: 'read', time: '15:15:30' },
        { name: 'Lieutenant Al-Shehhi', phone: '+971 50 234 5678', status: 'read', time: '15:16:02' },
        { name: 'Range Officer J. Davis', phone: '+971 54 888 1234', status: 'read', time: '15:17:11' }
      ]
    }
  ]);

  // Calculate active alerts count for header notification badge
  const getActiveAlertsCount = () => {
    let count = 0;
    if (!data) return 0;

    // Check lightning
    const hasLightning = simulatedLightning || (data.ncmWarnings && data.ncmWarnings.some(w => w.category === 'LIGHTNING'));
    if (hasLightning) count++;

    // Stations evaluation rules
    const stations = [
      { id: 'hq', t: 41.3, ws: 25, rh: 20, uv: 10, pm: 45, vis: 10000 },
      { id: 'north', t: 39.5, ws: 42, rh: 25, uv: 11, pm: 50, vis: 4000 },
      { id: 'south', t: 44.5, ws: 12, rh: 15, uv: 12, pm: 50, vis: 12000 },
      { id: 'sea', t: 34.0, ws: 28, rh: 89, uv: 9, pm: 50, vis: 2000 }
    ];

    stations.forEach(s => {
      const temp = isSimulated ? s.t : (data.current?.temperature_2m || 0);
      const wind = isSimulated ? s.ws : (data.current?.wind_speed_10m || 0);
      const gusts = isSimulated ? s.ws * 1.3 : (data.current?.wind_gusts_10m || wind * 1.3);
      const uv = isSimulated ? s.uv : (data.current?.uv_index || 0);
      const visibility = isSimulated ? s.vis : (data.current?.visibility || 10000);
      const pm10 = isSimulated ? s.pm : (data.current?.pm10 || 50);

      // Check temperature
      if (temp >= 43) count++;
      else if (temp >= 40) count++;

      // Check wind / gusts
      if (wind >= 38 || gusts >= 50) count++;
      else if (wind >= 25 || gusts >= 35) count++;

      // Check visibility
      if (visibility < 1000) count++;
      else if (visibility < 3000) count++;

      // Check PM10 AQI
      if (pm10 >= 150) count++;
    });

    return count;
  };

  const activeAlertsCount = getActiveAlertsCount();

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

  useEffect(() => {
    const handleProviderChange = (e) => {
      setActiveProviderState(e.detail);
      loadData();
    };
    window.addEventListener('xrange-provider-changed', handleProviderChange);
    return () => window.removeEventListener('xrange-provider-changed', handleProviderChange);
  }, []);

  const handleToggleSim = () => {
    setIsSimulated(prev => {
      const nextSim = !prev;
      if (!nextSim) setSimulatedLightning(false);
      return nextSim;
    });
  };

  const combinedNcmWarnings = [...(data?.ncmWarnings || [])];
  if (isSimulated && simulatedLightning) {
    if (!combinedNcmWarnings.some(w => w.id === "ncm-w-lightning-red")) {
      combinedNcmWarnings.unshift({
        id: "ncm-w-lightning-red",
        type: "RED",
        category: "LIGHTNING",
        title: "ACTIVE LIGHTNING & THUNDERSTORM WARNING",
        description: "Official Weather Agency Alert: Active convective thunderstorm and lightning strikes detected in the Abu Al Abyad sector. Halt all range activities and evacuate personnel immediately.",
        issued: new Date().toISOString(),
        expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
    }
  }
  const getCombinedSafety = () => {
    if (!data) return { status: 'GREEN', reasons: [], colors: { banner: 'bg-safetyGreen', pulse: false } };

    let globalStatus = 'GREEN';
    const globalReasons = [];

    if (!isSimulated) {
      const targetCurrent = data?.stations?.[activeStation]?.current || data.current;
      const evalResult = evaluateSafety(targetCurrent);
      globalStatus = evalResult.status;
      evalResult.reasons.forEach(r => globalReasons.push(r));
    } else {
      const stations = [
        {
          id: 'hq',
          name: 'X-Range HQ',
          readings: {
            ...data.current,
            temperature_2m: 41.3,
            apparent_temperature: 43.1,
            wind_speed_10m: 25,
            wind_gusts_10m: 35,
            relative_humidity_2m: 20,
            weathercode: simulatedLightning ? 95 : 3,
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
            weathercode: simulatedLightning ? 95 : 45,
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
            weathercode: simulatedLightning ? 95 : 0,
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
            weathercode: simulatedLightning ? 95 : 3,
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
    let isLightningHalt = false;
    combinedNcmWarnings.forEach(w => {
      if (w.type === 'RED') {
        globalStatus = 'RED';
      } else if (w.type === 'AMBER' && globalStatus !== 'RED') {
        globalStatus = 'AMBER';
      }
      if (w.category === 'LIGHTNING') {
        isLightningHalt = true;
      }
      globalReasons.unshift(`[NCM ${w.type} ALERT] ${w.title}`);
    });

    if (isLightningHalt) {
      globalStatus = 'RED';
      if (!globalReasons.some(r => r.includes('Severe thunderstorm & lightning strikes'))) {
        globalReasons.unshift(`⚡ EMERGENCY: Severe thunderstorm & lightning strikes detected. Evacuate all personnel to shelters.`);
      }
    }

    // WeatherNext 3 Convective Squall & Haboob Rapid Early-Warning
    if (data?.current && data?.hourly) {
      const prevHourIdx = Math.max(0, (data.hourly.time?.findIndex(t => t.startsWith(data.current?.time?.slice(0, 13))) || 1) - 1);
      const prevP = data.hourly.pressure_msl ? data.hourly.pressure_msl[prevHourIdx] : data.current.pressure_msl;
      const prevW = data.hourly.wind_speed_10m ? data.hourly.wind_speed_10m[prevHourIdx] : data.current.wind_speed_10m;
      const prevDir = data.hourly.wind_direction_10m ? data.hourly.wind_direction_10m[prevHourIdx] : data.current.wind_direction_10m;
      const haboob = detectHaboobConvectiveRisk(
        data.current.pressure_msl,
        prevP,
        data.current.wind_speed_10m,
        prevW,
        data.current.wind_direction_10m,
        prevDir,
        data.current.relative_humidity_2m
      );
      if (haboob.detected) {
        if (haboob.riskLevel === 'CRITICAL') {
          globalStatus = 'RED';
        } else if (globalStatus !== 'RED') {
          globalStatus = 'AMBER';
        }
        globalReasons.unshift(`🌪️ [WEATHERNEXT 3 AI] ${haboob.title}: ${haboob.description}`);
      }
    }

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

  const getActiveStationDisplayData = () => {
    if (isSimulated) {
      const simStationProfiles = {
        hq: {
          name: 'X-Range HQ',
          temperature_2m: 41.3,
          apparent_temperature: 43.1,
          relative_humidity_2m: 20,
          wind_speed_10m: 25,
          wind_gusts_10m: 35,
          weathercode: simulatedLightning ? 95 : 3,
          uv_index: 9.0,
          solar_radiation: 890
        },
        north: {
          name: 'Range North',
          temperature_2m: 39.5,
          apparent_temperature: 42.0,
          relative_humidity_2m: 25,
          wind_speed_10m: 42,
          wind_gusts_10m: 53,
          visibility: 4000,
          weathercode: simulatedLightning ? 95 : 45,
          uv_index: 9.0,
          solar_radiation: 840
        },
        south: {
          name: 'Range South',
          temperature_2m: 44.5,
          apparent_temperature: 49.2,
          relative_humidity_2m: 15,
          wind_speed_10m: 12,
          wind_gusts_10m: 18,
          visibility: 12000,
          weathercode: simulatedLightning ? 95 : 0,
          uv_index: 9.8,
          solar_radiation: 985
        },
        sea: {
          name: 'Sea Boundary',
          temperature_2m: 34.0,
          apparent_temperature: 48.0,
          relative_humidity_2m: 89,
          wind_speed_10m: 28,
          wind_gusts_10m: 42,
          visibility: 2000,
          weathercode: simulatedLightning ? 95 : 3,
          uv_index: 8.6,
          solar_radiation: 820
        }
      };
      const simProfile = simStationProfiles[activeStation] || simStationProfiles.hq;
      return {
        ...(data?.stations?.[activeStation]?.current || data.current),
        ...simProfile,
        sectorTitle: simProfile.name
      };
    }

    // WeatherNext 3 5km multi-station microclimate grid resolution
    if (data?.stations && data.stations[activeStation]?.current) {
      return {
        ...data.stations[activeStation].current,
        sectorTitle: data.stations[activeStation].name,
        name: data.stations[activeStation].name
      };
    }
    return data.current;
  };

  const activeDisplayData = getActiveStationDisplayData();
  const activeHourlyData = data?.stations?.[activeStation]?.hourly || data?.hourly;

  const getActiveStationDailyData = () => {
    const baseDaily = data?.stations?.[activeStation]?.daily || data?.daily;
    if (!baseDaily) return null;

    if (isSimulated) {
      const simDailyProfiles = {
        hq: { min0: 29.2, max0: 43.0, deltaT: 0, deltaG: 0 },
        north: { min0: 28.0, max0: 41.2, deltaT: -1.2, deltaG: 16.0 },
        south: { min0: 31.5, max0: 46.2, deltaT: 2.8, deltaG: -5.0 },
        sea: { min0: 26.5, max0: 36.5, deltaT: -4.5, deltaG: 7.0 }
      };
      const sp = simDailyProfiles[activeStation] || simDailyProfiles.hq;
      return {
        ...baseDaily,
        temperature_2m_max: (baseDaily.temperature_2m_max || []).map((v, i) =>
          i === 0 ? sp.max0 : Number((v + sp.deltaT).toFixed(1))
        ),
        temperature_2m_min: (baseDaily.temperature_2m_min || []).map((v, i) =>
          i === 0 ? sp.min0 : Number((v + sp.deltaT * 0.65).toFixed(1))
        ),
        wind_gusts_10m_max: (baseDaily.wind_gusts_10m_max || []).map(g =>
          Number(Math.max(8, g + sp.deltaG).toFixed(1))
        )
      };
    }

    return baseDaily;
  };

  const activeDailyData = getActiveStationDailyData();

  // Automated HSE WhatsApp & Directive Dispatcher
  useEffect(() => {
    if (globalSafety && activeDisplayData) {
      checkAndDispatchAutoAlerts(globalSafety, activeDisplayData, simulatedLightning);
    }
  }, [
    globalSafety?.status, 
    globalSafety?.reasons?.length, 
    simulatedLightning, 
    activeDisplayData?.temperature_2m, 
    activeDisplayData?.wind_speed_10m
  ]);

  // Calculate projected extremes for the next 12 hours using active station data
  const getTvProjectedExtremes = () => {
    const activeHourly = data?.stations?.[activeStation]?.hourly || data?.hourly;
    if (!activeHourly || !activeHourly.time) {
      return { maxTemp: 0, maxUv: 0, maxWbgt: 0 };
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
    let startIndex = activeHourly.time.findIndex(t => t.startsWith(currentHourString.slice(0, 13)));
    if (startIndex === -1) startIndex = 0;
    
    const next12Hours = activeHourly.time.slice(startIndex, startIndex + 12);
    
    const curTempVal = activeDisplayData?.temperature_2m ?? 0;
    const curUvVal = activeDisplayData?.uv_index ?? 0;
    const curWbgtVal = activeDisplayData
      ? calculateWBGT(
          activeDisplayData.temperature_2m,
          activeDisplayData.relative_humidity_2m ?? 50,
          activeDisplayData.wind_speed_10m ?? 0,
          activeDisplayData.uv_index ?? 0,
          activeDisplayData.solar_radiation ?? null
        )
      : 0;

    let maxTemp = curTempVal;
    let maxUv = curUvVal;
    let maxWbgt = curWbgtVal;
    
    next12Hours.forEach((t, i) => {
      const idx = startIndex + i;
      const temp = activeHourly.temperature_2m[idx];
      const uv = activeHourly.uv_index ? activeHourly.uv_index[idx] : 0;
      const rh = activeHourly.relative_humidity_2m ? activeHourly.relative_humidity_2m[idx] : 50;
      const wind = activeHourly.wind_speed_10m ? activeHourly.wind_speed_10m[idx] : 0;
      const solar = activeHourly.solar_radiation ? activeHourly.solar_radiation[idx] : null;
      const wbgt = calculateWBGT(temp, rh, wind, uv, solar);
      
      if (temp > maxTemp) maxTemp = temp;
      if (uv > maxUv) maxUv = uv;
      if (wbgt > maxWbgt) maxWbgt = wbgt;
    });
    
    return {
      maxTemp,
      maxUv,
      maxWbgt
    };
  };

  const tvExtremes = getTvProjectedExtremes();

  if (isMobile) {
    const mobileSectorList = [
      { id: 'hq', short: 'HQ', label: 'X-Range HQ' },
      { id: 'north', short: 'NORTH', label: 'Range North' },
      { id: 'south', short: 'SOUTH', label: 'Range South' },
      { id: 'sea', short: 'SEA', label: 'Sea Boundary' }
    ];

    const isCommandTab = ['hse', 'planning', 'customer', 'backend'].includes(mobileTab);

    return (
      <div className={`w-full h-full bg-bgDeepSpace flex flex-col justify-between overflow-hidden relative pb-15 ${globalSafety.status === 'RED' && globalSafety.reasons.some(r => r.includes('lightning') || r.includes('LIGHTNING') || r.includes('Lightning')) ? 'animate-emergency-strobe border-2 border-red-600' : ''}`}>
        {/* Top Header bar (Z1) */}
        <Header 
          lastUpdated={lastUpdated} 
          isOffline={isOffline} 
          isSimulated={isSimulated}
          onToggleSim={handleToggleSim}
          viewMode={viewMode}
          onViewModeChange={(mode) => {
            setViewMode(mode);
            setMobileTab(mode);
          }}
          time={activeTime}
          isMobile={true}
          onOpenAlerts={() => setIsAlertCenterOpen(true)}
          activeAlertsCount={activeAlertsCount}
          activeProvider={activeProvider}
        />

        {/* Persistent 4-Sector Range Safety Switcher Bar */}
        <div className="w-full bg-slate-950/95 border-b border-slate-800/80 px-3 py-1.5 flex-none z-40 select-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">
              5KM RANGE SECTOR SAFETY SELECTOR
            </span>
            <span className="text-[7.5px] font-mono font-bold text-edgeOrange uppercase">
              ACTIVE: {activeDisplayData?.sectorTitle || 'X-Range HQ'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {mobileSectorList.map(sec => {
              const isSelected = activeStation === sec.id;
              const secCurrent = isSimulated
                ? (() => {
                    const simMap = {
                      hq: { temperature_2m: 41.3, apparent_temperature: 43.1, wind_speed_10m: 25, wind_gusts_10m: 35, relative_humidity_2m: 20, uv_index: 9.0, weathercode: simulatedLightning ? 95 : 3 },
                      north: { temperature_2m: 39.5, apparent_temperature: 42.0, wind_speed_10m: 42, wind_gusts_10m: 53, relative_humidity_2m: 25, visibility: 4000, uv_index: 9.0, weathercode: simulatedLightning ? 95 : 45 },
                      south: { temperature_2m: 44.5, apparent_temperature: 49.2, wind_speed_10m: 12, wind_gusts_10m: 18, relative_humidity_2m: 15, visibility: 12000, uv_index: 9.8, weathercode: simulatedLightning ? 95 : 0 },
                      sea: { temperature_2m: 34.0, apparent_temperature: 48.0, wind_speed_10m: 28, wind_gusts_10m: 42, relative_humidity_2m: 89, visibility: 2000, uv_index: 8.6, weathercode: simulatedLightning ? 95 : 3 }
                    };
                    return { ...data?.current, ...simMap[sec.id] };
                  })()
                : (data?.stations?.[sec.id]?.current || data?.current);
              const secSafety = secCurrent ? evaluateSafety(secCurrent) : { status: 'GREEN' };
              const dotClass = secSafety.status === 'RED'
                ? 'bg-red-500 animate-ping'
                : secSafety.status === 'AMBER'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-400';

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveStation(sec.id)}
                  className={`px-2 py-1.5 border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-r from-orange-600/25 to-amber-600/15 border-edgeOrange text-textIceWhite shadow-sm'
                      : 'bg-slate-900/70 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-edgeOrange' : 'text-slate-200'}`}>
                      {sec.short}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  </div>
                  <div className="flex items-center justify-between w-full mt-0.5 text-[8px] font-mono font-bold text-slate-300">
                    <span>{secCurrent?.temperature_2m !== undefined ? `${secCurrent.temperature_2m.toFixed(0)}°C` : '--'}</span>
                    <span className="text-slate-500">{secCurrent?.wind_speed_10m !== undefined ? `${secCurrent.wind_speed_10m.toFixed(0)}kph` : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Command Sub-Navigation Bar (when Tools / Command tab is active) */}
        {isCommandTab && (
          <div className="w-full bg-slate-900/95 border-b border-slate-800 px-3 py-1.5 grid grid-cols-4 gap-1.5 flex-none z-30">
            {[
              { id: 'hse', label: '🛡️ HSE Audit' },
              { id: 'planning', label: '🗓️ Range Plan' },
              { id: 'customer', label: '💼 R&D Portal' },
              { id: 'backend', label: '⚡ Data Feeds' }
            ].map(sub => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setMobileTab(sub.id)}
                className={`py-1 px-1.5 text-[8.5px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                  mobileTab === sub.id
                    ? 'bg-edgeOrange text-white border-orange-400 shadow'
                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Main Scrollable Content */}
        <main className="w-full flex-grow overflow-y-auto px-3.5 py-3 select-none no-scrollbar">
          {isOffline && (
            <div className="bg-stopRed/95 text-white text-[9px] font-black uppercase text-center py-1.5 mb-3 tracking-widest animate-pulse border-b border-red-700">
              ⚠️ DATA UNAVAILABLE • DISPLAYING CACHED OBSERVATIONS
            </div>
          )}

          {mobileTab === 'live' && (
            <div className="space-y-3.5 pb-4">
              {/* 1. Primary Range Safety Status Banner */}
              <div className="h-auto">
                <SafetyBanner safetyEvaluation={globalSafety} hourlyData={activeHourlyData} currentTime={activeTime} isMobile={true} ncmWarnings={combinedNcmWarnings} />
              </div>

              {/* 2. Pocket Field Safety Directives (Work/Rest, Hydration, UV/PPE) */}
              <div className="h-auto">
                <TvGuidelinesWidget data={activeDisplayData} isMobile={true} />
              </div>

              {/* 3. Current Sector Conditions & Munitions Thermal Load */}
              <div className="min-h-[210px]">
                <CurrentConditions 
                  data={activeDisplayData} 
                  dailyData={activeDailyData} 
                  hourlyData={activeHourlyData} 
                  currentTime={activeTime} 
                  onOpenMunitionsThermal={() => setIsMunitionsThermalModalOpen(true)}
                />
              </div>

              {/* 4. Wind & Gust Safety (10m Surface + 100m Shear) */}
              <div className="min-h-[235px]">
                <WindWidget 
                  data={activeDisplayData} 
                  hourlyData={activeHourlyData} 
                  currentTime={activeTime} 
                  onOpenBallistics={() => setIsBallisticsModalOpen(true)}
                />
              </div>

              {/* 5. Heat Stress (WBGT) & Visibility Grid */}
              <div className="grid grid-cols-2 gap-3 min-h-[145px]">
                <HumidityWidget data={activeDisplayData} hourlyData={activeHourlyData} />
                <VisibilityWidget data={activeDisplayData} hourlyData={activeHourlyData} />
              </div>

              {/* 6. Solar UV Exposure */}
              <div className="min-h-[210px]">
                <UvWidget data={activeDisplayData} hourlyData={activeHourlyData} dailyData={activeDailyData} currentTime={activeTime} />
              </div>

              {/* 7. Dust / Air Quality & Hydration */}
              <div className="grid grid-cols-2 gap-3 min-h-[145px]">
                <AqiWidget data={activeDisplayData} hourlyData={activeHourlyData} />
                <HydrationWidget data={activeDisplayData} />
              </div>

              {/* 8. Daylight Curfew & Abu Al Abyad Tide Cycles */}
              <div className="min-h-[235px]">
                <SunTransitWidget dailyData={activeDailyData} currentTime={activeTime} />
              </div>
            </div>
          )}

          {mobileTab === 'map' && (
            <div className="space-y-3.5 pb-4 flex flex-col justify-between">
              <div className="w-full h-[360px] border border-slate-800/80 bg-bgDeepSpace/40 overflow-hidden flex items-center justify-center">
                <XRangeMap 
                  apiData={data} 
                  isSimulated={isSimulated} 
                  activeStation={activeStation}
                  setActiveStation={setActiveStation}
                  isBackground={false}
                  hideDetails={true}
                  showSimulatedStations={true}
                  ncmWarnings={combinedNcmWarnings}
                  simulatedLightning={simulatedLightning}
                  onToggleSimulatedLightning={() => setSimulatedLightning(prev => !prev)}
                  currentTime={activeTime}
                />
              </div>
              <div className="w-full">
                <StationDetailsWidget 
                  apiData={data} 
                  isSimulated={isSimulated} 
                  activeStation={activeStation} 
                  setActiveStation={setActiveStation}
                  warnings={combinedNcmWarnings}
                />
              </div>
            </div>
          )}

          {mobileTab === 'forecast' && (
            <div className="space-y-3.5 pb-4">
              {/* 12-Hour Range Exposure Extremes (CUR / MAX) */}
              <div className="min-h-[125px]">
                <TvCoreMetricsWidget currentData={activeDisplayData} extremes={tvExtremes} hourlyData={activeHourlyData} />
              </div>

              {/* 12-Hour Safety & Weather Timeline */}
              <div className="h-[275px]">
                <HourlyForecast 
                  hourlyData={activeHourlyData} 
                  currentTime={activeTime} 
                  dailyData={activeDailyData}
                />
              </div>

              {/* 5-Day Range Outlook */}
              <div className="min-h-[165px]">
                <DailyForecastWidget dailyData={activeDailyData} />
              </div>

              {/* Daylight Curfew & Tide Cycles */}
              <div className="min-h-[235px]">
                <SunTransitWidget dailyData={activeDailyData} currentTime={activeTime} />
              </div>
            </div>
          )}

          {mobileTab === 'alerts' && (
            <div className="space-y-3.5 pb-4">
              <div className="h-auto">
                <SafetyBanner safetyEvaluation={globalSafety} hourlyData={activeHourlyData} currentTime={activeTime} isMobile={true} ncmWarnings={combinedNcmWarnings} />
              </div>
              <div className="border border-slate-800 bg-cardDarkSlate p-3.5 rounded-xl">
                <Suspense fallback={<ViewLoadingFallback />}>
                  <SafetyAdvisory data={activeDisplayData} ncmWarnings={combinedNcmWarnings} />
                </Suspense>
              </div>
            </div>
          )}

          {mobileTab === 'hse' && (
            <div className="min-h-[680px] border border-slate-800 bg-cardDarkSlate rounded-xl overflow-y-auto">
              <Suspense fallback={<ViewLoadingFallback />}>
                <HseDashboard 
                  data={data} 
                  hourlyData={activeHourlyData} 
                  currentTime={activeTime} 
                  activeStation={activeStation} 
                  isSimulated={isSimulated} 
                />
              </Suspense>
            </div>
          )}

          {mobileTab === 'planning' && (
            <div className="min-h-[680px] border border-slate-800 bg-cardDarkSlate rounded-xl overflow-y-auto">
              <Suspense fallback={<ViewLoadingFallback />}>
                <PlanningDashboard 
                  isSimulated={isSimulated} 
                  hourlyData={activeHourlyData}
                  dailyData={activeDailyData}
                />
              </Suspense>
            </div>
          )}

          {mobileTab === 'customer' && (
            <div className="min-h-[680px] border border-slate-800 bg-cardDarkSlate rounded-xl overflow-y-auto">
              <Suspense fallback={<ViewLoadingFallback />}>
                <CustomerPortal />
              </Suspense>
            </div>
          )}

          {mobileTab === 'backend' && (
            <div className="min-h-[680px] border border-slate-800 bg-cardDarkSlate rounded-xl overflow-y-auto p-2">
              <Suspense fallback={<ViewLoadingFallback />}>
                <BackendFeeds 
                  isSimulated={isSimulated} 
                  apiMeta={apiMeta} 
                  isOffline={isOffline} 
                  apiData={data}
                  activeStation={activeStation}
                  setActiveStation={setActiveStation}
                  onRefreshFeeds={loadData}
                />
              </Suspense>
            </div>
          )}
        </main>

        {/* Ergonomic 5-Tab Mobile Bottom Navigation Bar */}
        <nav className="absolute bottom-0 left-0 right-0 h-15 bg-slate-950/95 border-t border-slate-800/90 flex flex-row items-stretch justify-around z-50 select-none backdrop-blur-md">
          <button 
            onClick={() => setMobileTab('live')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-t-2 cursor-pointer transition-all ${
              mobileTab === 'live'
                ? 'border-edgeOrange text-edgeOrange font-black bg-slate-900/60'
                : 'border-transparent text-slate-400 font-bold hover:text-slate-200'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <span className="text-base">🛡️</span>
              <span className={`absolute -top-0.5 -right-2 w-1.5 h-1.5 rounded-full ${
                globalSafety.status === 'RED' ? 'bg-red-500 animate-ping' :
                globalSafety.status === 'AMBER' ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
            </div>
            <span className="text-[9px] uppercase tracking-wider">Safety</span>
          </button>

          <button 
            onClick={() => setMobileTab('map')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-t-2 cursor-pointer transition-all ${
              mobileTab === 'map'
                ? 'border-edgeOrange text-edgeOrange font-black bg-slate-900/60'
                : 'border-transparent text-slate-400 font-bold hover:text-slate-200'
            }`}
          >
            <span className="text-base">🗺️</span>
            <span className="text-[9px] uppercase tracking-wider">5km Map</span>
          </button>

          <button 
            onClick={() => setMobileTab('forecast')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-t-2 cursor-pointer transition-all ${
              mobileTab === 'forecast'
                ? 'border-edgeOrange text-edgeOrange font-black bg-slate-900/60'
                : 'border-transparent text-slate-400 font-bold hover:text-slate-200'
            }`}
          >
            <span className="text-base">📅</span>
            <span className="text-[9px] uppercase tracking-wider">12H / 5D</span>
          </button>

          <button 
            onClick={() => setMobileTab('alerts')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-t-2 cursor-pointer transition-all ${
              mobileTab === 'alerts'
                ? 'border-edgeOrange text-edgeOrange font-black bg-slate-900/60'
                : 'border-transparent text-slate-400 font-bold hover:text-slate-200'
            }`}
          >
            <span className={`text-base ${globalSafety.status === 'RED' ? 'text-stopRed animate-pulse' : globalSafety.status === 'AMBER' ? 'text-amberAlert' : ''}`}>📋</span>
            <span className="text-[9px] uppercase tracking-wider">SOPs</span>
          </button>

          <button 
            onClick={() => setMobileTab(isCommandTab ? mobileTab : 'hse')}
            className={`flex-1 flex flex-col items-center justify-center space-y-0.5 border-t-2 cursor-pointer transition-all ${
              isCommandTab
                ? 'border-cyan-400 text-cyan-400 font-black bg-slate-900/60'
                : 'border-transparent text-slate-400 font-bold hover:text-slate-200'
            }`}
          >
            <span className="text-base">⚙️</span>
            <span className="text-[9px] uppercase tracking-wider">Command</span>
          </button>
        </nav>

        {/* Mounted Modals for Mobile View */}
        {isAlertCenterOpen && (
          <Suspense fallback={null}>
            <AlertCenter
              isOpen={isAlertCenterOpen}
              onClose={() => setIsAlertCenterOpen(false)}
              isSimulated={isSimulated}
              apiData={data}
              simulatedLightning={simulatedLightning}
              broadcastHistory={broadcastHistory}
              onAddBroadcast={(newBroadcast) => setBroadcastHistory(prev => [...prev, newBroadcast])}
              recipientDirectory={recipientDirectory}
              onUpdateRecipientDirectory={setRecipientDirectory}
            />
          </Suspense>
        )}

        {isBallisticsModalOpen && (
          <Suspense fallback={null}>
            <TacticalBallisticsModal
              isOpen={isBallisticsModalOpen}
              onClose={() => setIsBallisticsModalOpen(false)}
              currentData={activeDisplayData}
              hourlyData={activeHourlyData}
            />
          </Suspense>
        )}

        {isMunitionsThermalModalOpen && (
          <Suspense fallback={null}>
            <MunitionsThermalModal
              isOpen={isMunitionsThermalModalOpen}
              onClose={() => setIsMunitionsThermalModalOpen(false)}
              currentData={activeDisplayData}
              hourlyData={activeHourlyData}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-bgDeepSpace flex flex-col justify-between overflow-hidden relative ${globalSafety.status === 'RED' && globalSafety.reasons.some(r => r.includes('lightning') || r.includes('LIGHTNING') || r.includes('Lightning')) ? 'animate-emergency-strobe border-2 border-red-650' : ''}`}>
      {/* Top Header bar (Z1) */}
      <Header 
        lastUpdated={lastUpdated} 
        isOffline={isOffline} 
        isSimulated={isSimulated}
        onToggleSim={handleToggleSim}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        time={activeTime}
        onOpenAlerts={() => setIsAlertCenterOpen(true)}
        activeAlertsCount={activeAlertsCount}
        activeProvider={activeProvider}
      />

      {/* Main Container */}
      <main className="w-full h-[92%] relative select-none overflow-hidden">
        
        {/* View Mode Switching Overlays */}
        {viewMode === 'tv' && (
          /* TV Display (Simplified lobby mode) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-none flex flex-col justify-between space-y-3.5 w-full h-full">
            {/* Z8 Safety Status Banner */}
            <div className="h-[12%] pointer-events-auto">
              <SafetyBanner safetyEvaluation={globalSafety} hourlyData={activeHourlyData} currentTime={activeTime} ncmWarnings={combinedNcmWarnings} />
            </div>

            {/* 3-Column Split Layout */}
            <div className="h-[84%] grid grid-cols-10 gap-5 pointer-events-none items-stretch">
              {/* Left Column (Col-span-3): Daily Outlook extremes, Sunrise/Sunset & Hourly Forecast */}
              <div className="col-span-3 h-full pointer-events-auto flex flex-col justify-between space-y-3.5">
                <div className="h-[17%]">
                  <TvCoreMetricsWidget currentData={activeDisplayData} extremes={tvExtremes} hourlyData={activeHourlyData} />
                </div>
                <div className="h-[29%]">
                  <SunTransitWidget dailyData={activeDailyData} currentTime={activeTime} />
                </div>
                <div className="h-[51%]">
                  <HourlyForecast 
                    hourlyData={activeHourlyData} 
                    currentTime={activeTime} 
                    dailyData={activeDailyData}
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
                  ncmWarnings={combinedNcmWarnings}
                  simulatedLightning={simulatedLightning}
                  onToggleSimulatedLightning={() => setSimulatedLightning(prev => !prev)}
                  currentTime={activeTime}
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
               <div className="h-[26%]">
                 <CurrentConditions 
                   data={activeDisplayData} 
                   dailyData={activeDailyData} 
                   hourlyData={activeHourlyData} 
                   currentTime={activeTime} 
                   onOpenMunitionsThermal={() => setIsMunitionsThermalModalOpen(true)}
                 />
               </div>
               <div className="h-[18%]">
                 <HumidityWidget data={activeDisplayData} hourlyData={activeHourlyData} />
               </div>
               <div className="h-[16%]">
                 <HydrationWidget data={activeDisplayData} />
               </div>
               <div className="h-[37%]">
                 <WindWidget 
                   data={activeDisplayData} 
                   hourlyData={activeHourlyData} 
                   currentTime={activeTime} 
                   onOpenBallistics={() => setIsBallisticsModalOpen(true)}
                 />
               </div>
             </div>

            {/* Center Column (Col-span-6): Safety Banner, Station Details overlay, and Forecasts */}
            <div className="col-span-6 h-full flex flex-col justify-between space-y-3 pointer-events-none">
              {/* Z8 Safety Status Banner */}
              <div className="h-[12%] pointer-events-auto">
                <SafetyBanner safetyEvaluation={globalSafety} hourlyData={activeHourlyData} currentTime={activeTime} ncmWarnings={combinedNcmWarnings} />
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
                  ncmWarnings={combinedNcmWarnings}
                  simulatedLightning={simulatedLightning}
                  onToggleSimulatedLightning={() => setSimulatedLightning(prev => !prev)}
                  currentTime={activeTime}
                />
              </div>

              {/* Bottom Forecast Row: Hourly (65%) and 5-Day Daily (35%) */}
              <div className="h-[26%] flex flex-row space-x-4 items-stretch pointer-events-auto">
                <div className="w-[65%] h-full">
                  <HourlyForecast 
                    hourlyData={activeHourlyData} 
                    currentTime={activeTime} 
                    dailyData={activeDailyData}
                  />
                </div>
                <div className="w-[35%] h-full">
                  <DailyForecastWidget dailyData={activeDailyData} />
                </div>
              </div>
            </div>

            {/* Right Sidebar (Col-span-2): UV, Visibility, AQI, Sunrise/Sunset (Light/Curfew) */}
             <div className="col-span-2 h-full flex flex-col justify-between space-y-3 pointer-events-auto">
               <div className="h-[33%]">
                 <UvWidget data={activeDisplayData} hourlyData={activeHourlyData} dailyData={activeDailyData} currentTime={activeTime} />
               </div>
               <div className="h-[17%]">
                 <VisibilityWidget data={activeDisplayData} hourlyData={activeHourlyData} />
               </div>
               <div className="h-[17%]">
                 <AqiWidget data={activeDisplayData} hourlyData={activeHourlyData} />
               </div>
               <div className="h-[31%]">
                 <SunTransitWidget dailyData={activeDailyData} currentTime={activeTime} />
               </div>
             </div>

          </div>
        )}

        {viewMode === 'advisory' && (
          /* Safety Advisory (Standard Operating Procedures & Survival Guidelines) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <SafetyAdvisory data={activeDisplayData} ncmWarnings={combinedNcmWarnings} />
            </Suspense>
          </div>
        )}

        {viewMode === 'hse' && (
          /* HSE Dashboard (Compliance & Historical Auditing) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <HseDashboard 
                data={data} 
                hourlyData={activeHourlyData} 
                currentTime={activeTime} 
                activeStation={activeStation} 
                isSimulated={isSimulated} 
                onViewModeChange={setViewMode}
              />
            </Suspense>
          </div>
        )}

        {viewMode === 'planning' && (
          /* Range Planning (Historical & Climatological Modeling & Tactical Mission Windows) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <PlanningDashboard 
                isSimulated={isSimulated} 
                hourlyData={activeHourlyData}
                dailyData={activeDailyData}
              />
            </Suspense>
          </div>
        )}

        {viewMode === 'customer' && (
          /* Customer Portal (Climate Projections & R&D Simulation) */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <CustomerPortal />
            </Suspense>
          </div>
        )}

        {viewMode === 'backend' && (
          /* Backend Diagnostic Status & Telemetry feeds */
          <div className="absolute inset-0 px-5 py-3.5 z-10 pointer-events-auto w-full h-full bg-slate-950/60 backdrop-blur-[4px]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <BackendFeeds 
                isSimulated={isSimulated} 
                apiMeta={apiMeta} 
                isOffline={isOffline} 
                apiData={data}
                activeStation={activeStation}
                setActiveStation={setActiveStation}
                onRefreshFeeds={loadData}
              />
            </Suspense>
          </div>
        )}

      </main>

      {/* Offline Alert Overlay */}
      {isOffline && (
        <div className="absolute top-[8%] left-0 right-0 bg-stopRed/95 text-white text-[10px] font-black uppercase text-center py-1 select-none z-50 tracking-widest animate-pulse border-b border-red-700">
          ⚠️ DATA UNAVAILABLE • DISPLAYING CACHED METEOROLOGICAL OBSERVATIONS
        </div>
      )}

      {/* Safety Alert Center slide-over drawer */}
      {isAlertCenterOpen && (
        <Suspense fallback={null}>
          <AlertCenter
            isOpen={isAlertCenterOpen}
            onClose={() => setIsAlertCenterOpen(false)}
            isSimulated={isSimulated}
            apiData={data}
            simulatedLightning={simulatedLightning}
            broadcastHistory={broadcastHistory}
            onAddBroadcast={(newBroadcast) => setBroadcastHistory(prev => [...prev, newBroadcast])}
            recipientDirectory={recipientDirectory}
            onUpdateRecipientDirectory={setRecipientDirectory}
          />
        </Suspense>
      )}

      {/* WeatherNext 3 Tactical Ballistics & 100m Wind Shear Modal */}
      {isBallisticsModalOpen && (
        <Suspense fallback={null}>
          <TacticalBallisticsModal
            isOpen={isBallisticsModalOpen}
            onClose={() => setIsBallisticsModalOpen(false)}
            currentData={activeDisplayData}
            hourlyData={activeHourlyData}
          />
        </Suspense>
      )}

      {/* WeatherNext 3 Munitions & Equipment Thermal Cook-off Modal */}
      {isMunitionsThermalModalOpen && (
        <Suspense fallback={null}>
          <MunitionsThermalModal
            isOpen={isMunitionsThermalModalOpen}
            onClose={() => setIsMunitionsThermalModalOpen(false)}
            currentData={activeDisplayData}
            hourlyData={activeHourlyData}
          />
        </Suspense>
      )}
    </div>
  );
}
