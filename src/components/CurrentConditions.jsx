import React from 'react';
import { getWeatherCondition } from '../utils/weatherCodeMap';
import { Cloud, Droplets } from 'lucide-react';
import { getTrendIndicator } from '../utils/safetyEngine';

export default function CurrentConditions({ data, dailyData, hourlyData }) {
  if (!data) return null;

  const temp = data.temperature_2m;
  const feelsLike = data.apparent_temperature;
  const weathercode = data.weathercode;
  const cloudCover = data.cloud_cover;
  const precipitation = data.precipitation;
  const windSpeed = data.wind_speed_10m || 0;
  const uv = data.uv_index !== undefined ? data.uv_index : 0;

  // Black Globe temperature estimation in direct sunlight
  const getSunTemp = () => {
    if (temp === undefined) return 0;
    const windMps = windSpeed / 3.6;
    const solarRad = uv * 90; // Approx 90 W/m2 per UV index point
    const globeTemp = temp + (0.01 * solarRad) - (0.12 * windMps);
    return Math.max(temp, globeTemp);
  };

  const sunTemp = getSunTemp();

  // Max and Min temperatures for today
  const tempMax = dailyData && dailyData.temperature_2m_max ? dailyData.temperature_2m_max[0] : null;
  const tempMin = dailyData && dailyData.temperature_2m_min ? dailyData.temperature_2m_min[0] : null;

  const isNightTime = () => {
    if (!data || !data.time) return false;
    if (!dailyData || !dailyData.time) {
      const date = new Date(data.time);
      const hour = date.getHours();
      return hour < 6 || hour >= 19;
    }
    const dateStr = data.time.slice(0, 10);
    const idx = dailyData.time.findIndex(t => t.startsWith(dateStr));
    if (idx === -1) {
      const date = new Date(data.time);
      const hour = date.getHours();
      return hour < 6 || hour >= 19;
    }
    const sunriseStr = dailyData.sunrise[idx];
    const sunsetStr = dailyData.sunset[idx];
    
    const timeMs = new Date(data.time).getTime();
    const sunriseMs = new Date(sunriseStr).getTime();
    const sunsetMs = new Date(sunsetStr).getTime();
    
    return timeMs < sunriseMs || timeMs > sunsetMs;
  };

  const condition = getWeatherCondition(weathercode, isNightTime());

  // Calculate indices for previous hour trend evaluations
  const getPrevHourIdx = () => {
    if (!hourlyData || !hourlyData.time || !data.time) return -1;
    const curHourStr = data.time.slice(0, 13) + ':00';
    const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr));
    return curIdx > 0 ? curIdx - 1 : -1;
  };

  const prevIdx = getPrevHourIdx();
  const prevTemp = prevIdx >= 0 ? hourlyData.temperature_2m[prevIdx] : null;
  const tempTrend = getTrendIndicator(temp, prevTemp, 0.1);

  const prevFeelsLike = (prevIdx >= 0 && hourlyData.apparent_temperature) ? hourlyData.apparent_temperature[prevIdx] : null;
  const feelsLikeTrend = getTrendIndicator(feelsLike, prevFeelsLike, 0.1);

  const prevCloudCover = (prevIdx >= 0 && hourlyData.cloud_cover) ? hourlyData.cloud_cover[prevIdx] : null;
  const cloudTrend = getTrendIndicator(cloudCover, prevCloudCover, 5.0); // 5% threshold

  return (
    <div className={`w-full h-full bg-cardDarkSlate border border-slate-700/40 rounded-xl p-4 flex flex-col justify-between bg-gradient-to-br ${condition.bgClass} relative overflow-hidden select-none`}>
      {/* Decorative Grid Line for Tech Vibe */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none animate-grid-glow" />

      {/* Top Section: Title & Badge */}
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
            Z2 • CURRENT CONDITIONS
          </p>
          <h2 className="text-sm font-bold text-slate-200 leading-none">HQ Observation Sector</h2>
        </div>
        {precipitation > 0 && (
          <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded text-[9px] font-bold flex items-center space-x-1 animate-pulse">
            <Droplets className="w-3 h-3" />
            <span>RAIN: {precipitation} mm/h</span>
          </span>
        )}
      </div>

      {/* Middle Section: Temp & Emoji */}
      <div className="flex items-center justify-between my-2 relative z-10">
        {/* Temp Display */}
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1.5 select-none">
            Temp in Shade
          </span>
          <div className="flex items-center">
            <span className="text-[54px] font-black text-textIceWhite tracking-tighter leading-none">
              {temp !== undefined ? temp.toFixed(1) : '--.-'}
            </span>
            <span className="text-3xl font-bold text-edgeOrange ml-0.5 leading-none">°C</span>
            {tempTrend.arrow && (
              <span className={`text-[10px] ml-3 flex items-center space-x-0.5 ${tempTrend.class} bg-bgDeepSpace/60 border border-slate-800/40 px-1.5 py-0.5 rounded`}>
                <span>{tempTrend.arrow}</span>
                <span className="text-[8px] font-black uppercase tracking-wider">{tempTrend.text}</span>
              </span>
            )}
          </div>
          {tempMax !== null && tempMin !== null && (
            <div className="flex items-center space-x-2.5 mt-2 bg-bgDeepSpace/50 border border-slate-800/70 rounded-lg px-2.5 py-1.5 w-fit select-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Today's Forecast:</span>
              <span className="text-[17px] font-black text-blue-400 font-mono leading-none">{tempMin.toFixed(0)}°</span>
              <span className="text-xs font-bold text-slate-650">/</span>
              <span className="text-[17px] font-black text-stopRed font-mono leading-none">{tempMax.toFixed(0)}°</span>
            </div>
          )}
        </div>

        {/* Large Condition Emoji */}
        <div className="text-5xl select-none filter drop-shadow-lg leading-none animate-bounce-slow">
          {condition.emoji}
        </div>
      </div>

      {/* Bottom Section: Sub-metrics & Feels Like */}
      <div className="grid grid-cols-3 gap-2 border-t border-slate-700/30 pt-3 mt-1 relative z-10">
        <div>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1 select-none">
            FEELS LIKE
          </p>
          <p className="text-base font-black text-textIceWhite flex items-center leading-none">
            {feelsLike !== undefined ? feelsLike.toFixed(1) : '--.-'}
            <span className="text-[9px] text-slate-400 ml-0.5">°C</span>
            {feelsLikeTrend.arrow && feelsLikeTrend.arrow !== '→' && (
              <span className={`text-[9px] ml-1 ${feelsLikeTrend.class}`}>{feelsLikeTrend.arrow}</span>
            )}
          </p>
        </div>

        <div>
          <p className="text-[8px] text-amberAlert font-bold uppercase tracking-wider leading-none mb-1 select-none">
            DIRECT SUN
          </p>
          <p className="text-base font-black text-amberAlert flex items-center leading-none">
            {sunTemp !== undefined ? sunTemp.toFixed(1) : '--.-'}
            <span className="text-[9px] text-amberAlert/70 ml-0.5">°C</span>
          </p>
        </div>

        <div>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-0.5 leading-none mb-1 select-none">
            <Cloud className="w-2.5 h-2.5 text-slate-400" />
            <span>CLOUD</span>
          </p>
          <p className="text-base font-black text-textIceWhite flex items-center leading-none">
            {cloudCover !== undefined ? cloudCover : '--'}
            <span className="text-[9px] text-slate-400 ml-0.5">%</span>
            {cloudTrend.arrow && cloudTrend.arrow !== '→' && (
              <span className={`text-[9px] ml-1 ${cloudTrend.class}`}>{cloudTrend.arrow}</span>
            )}
          </p>
        </div>
      </div>

      {/* Condition Text */}
      <div className="mt-3 text-xs font-bold text-slate-200 uppercase tracking-wider relative z-10 flex items-center space-x-2">
        <span className={`w-2.5 h-2.5 rounded-full ${condition.iconColor} bg-current`} />
        <span>{condition.label}</span>
      </div>
    </div>
  );
}
