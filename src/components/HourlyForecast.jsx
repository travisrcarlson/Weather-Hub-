import React from 'react';
import { getWeatherCondition } from '../utils/weatherCodeMap';
import { evaluateSafety } from '../utils/safetyEngine';
import { Compass, Droplets } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, ReferenceArea, ReferenceDot, ReferenceLine } from 'recharts';

export default function HourlyForecast({ hourlyData, currentTime, dailyData }) {
  if (!hourlyData || !hourlyData.time) return null;

  // Find index of current hour in Asia/Dubai timezone
  const now = currentTime ? new Date(currentTime) : new Date();
  
  const isNightTime = (timeStr) => {
    if (!dailyData || !dailyData.time || !dailyData.sunrise || !dailyData.sunset) {
      const date = new Date(timeStr);
      const hour = date.getHours();
      return hour < 6 || hour >= 19;
    }
    const dateStr = timeStr.slice(0, 10);
    const idx = dailyData.time.findIndex(t => t.startsWith(dateStr));
    if (idx === -1) {
      const date = new Date(timeStr);
      const hour = date.getHours();
      return hour < 6 || hour >= 19;
    }
    const sunriseStr = dailyData.sunrise[idx];
    const sunsetStr = dailyData.sunset[idx];
    
    const timeMs = new Date(timeStr).getTime();
    const sunriseMs = new Date(sunriseStr).getTime();
    const sunsetMs = new Date(sunsetStr).getTime();
    
    return timeMs < sunriseMs || timeMs > sunsetMs;
  };

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
  
  let startIndex = hourlyData.time.findIndex(t => t.startsWith(currentHourString.slice(0, 13)));
  if (startIndex === -1) startIndex = 0;

  // Get 12 hours total: 2 hours of history (past), 10 hours of forecast (future)
  const displayStartIndex = Math.max(0, startIndex - 2);

  const hours = [];
  for (let i = 0; i < 12; i++) {
    const idx = displayStartIndex + i;
    if (idx >= hourlyData.time.length) break;

    const t = hourlyData.time[idx];
    const temp = hourlyData.temperature_2m[idx];
    const code = hourlyData.weathercode[idx];
    const precipProb = hourlyData.precipitation_probability[idx];
    const windSpeed = hourlyData.wind_speed_10m[idx];
    const windGusts = hourlyData.wind_gusts_10m[idx];
    const uv = hourlyData.uv_index ? hourlyData.uv_index[idx] : 0;

    const dateObj = new Date(t);
    const timeLabel = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai'
    });

    const mockHourData = {
      time: t,
      temperature_2m: temp,
      apparent_temperature: temp,
      wind_speed_10m: windSpeed,
      wind_gusts_10m: windGusts,
      relative_humidity_2m: 50,
      visibility: 10000,
      uv_index: uv,
      precipitation: 0,
      european_aqi: 50,
      pm10: 20,
      weathercode: code
    };

    const safety = evaluateSafety(mockHourData);
    
    // MoHRE Midday Work Ban: June 15 to Sept 15, 12:30 to 15:00
    // hourVal === 12 overlaps (12:30-13:00), 13 & 14 are fully within the ban
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    const isBanDate = (month === 5 && day >= 15) || (month > 5 && month < 8) || (month === 8 && day <= 15);
    const hourVal = dateObj.getHours();
    const isBanned = isBanDate && (hourVal === 12 || hourVal === 13 || hourVal === 14);

    const isHistory = idx < startIndex;
    const isCurrent = idx === startIndex;
    const isNight = isNightTime(t);

    hours.push({
      rawTime: t,
      isBanned,
      isHistory,
      isCurrent,
      isNight,
      timeLabel,
      temp,
      code,
      precipProb,
      windSpeed,
      safetyStatus: safety.status,
      condition: getWeatherCondition(code, isNight)
    });
  }

  const getSafetyBg = (status, isBanned, isNight) => {
    if (isBanned) return 'bg-red-950/25 border-red-800/45 hover:bg-red-950/35';
    if (status === 'RED') return 'bg-stopRed/20 border-stopRed/50 hover:bg-stopRed/35';
    if (status === 'AMBER') return 'bg-amberAlert/10 border-amber-800/40 hover:bg-amber-800/25';
    return isNight 
      ? 'bg-slate-950/60 border-safetyGreen/15 hover:border-safetyGreen/30' 
      : 'bg-slate-800/40 border-safetyGreen/15 hover:border-safetyGreen/30';
  };

  const getSafetyBorderColor = (status, isBanned) => {
    if (isBanned) return 'border-t-4 border-t-red-600';
    if (status === 'RED') return 'border-t-4 border-t-stopRed';
    if (status === 'AMBER') return 'border-t-4 border-t-amberAlert';
    return 'border-t-2 border-t-safetyGreen/40';
  };

  // Format data for Recharts temperature curve with virtual 12:30 data point for precise ban representation
  const chartStartTimeMs = hours.length > 0 ? new Date(hours[0].rawTime).getTime() : 0;
  
  const chartData = [];
  hours.forEach((h, idx) => {
    const offset = chartStartTimeMs > 0 ? (new Date(h.rawTime).getTime() - chartStartTimeMs) / (60 * 1000) : 0;
    chartData.push({
      time: h.timeLabel,
      offset: offset,
      temp: parseFloat(h.temp.toFixed(1))
    });

    const date = new Date(h.rawTime);
    const hourVal = date.getHours();
    const month = date.getMonth();
    const day = date.getDate();
    const isBanDate = (month === 5 && day >= 15) || (month > 5 && month < 8) || (month === 8 && day <= 15);

    // If this is the 12:00 hour on a ban date, insert the 12:30 virtual point
    if (isBanDate && hourVal === 12) {
      const nextTemp = idx + 1 < hours.length ? hours[idx + 1].temp : h.temp;
      const interpolatedTemp = (h.temp + nextTemp) / 2;
      const vTimeMs = new Date(h.rawTime).getTime() + 30 * 60 * 1000;
      const vOffset = chartStartTimeMs > 0 ? (vTimeMs - chartStartTimeMs) / (60 * 1000) : 30;
      chartData.push({
        time: "12:30",
        offset: vOffset,
        temp: parseFloat(interpolatedTemp.toFixed(1))
      });
    }
  });

  // Calculate currentOffsetMinutes from now to chartStartTimeMs
  const currentOffsetMinutes = chartStartTimeMs > 0 ? (now.getTime() - chartStartTimeMs) / (60 * 1000) : 120;
  const maxOffset = hours.length > 0 ? (new Date(hours[hours.length - 1].rawTime).getTime() - chartStartTimeMs) / (60 * 1000) : 660;
  const showCurrentLine = currentOffsetMinutes >= 0 && currentOffsetMinutes <= maxOffset;

  // Midday Ban offsets
  let banStartOffset = null;
  let banEndOffset = null;
  const firstHourDate = new Date(hours[0]?.rawTime || now);
  const banMonth = firstHourDate.getMonth();
  const banDay = firstHourDate.getDate();
  const isBanDate = (banMonth === 5 && banDay >= 15) || (banMonth > 5 && banMonth < 8) || (banMonth === 8 && banDay <= 15);

  if (isBanDate) {
    const banStartDate = new Date(firstHourDate);
    banStartDate.setHours(12, 30, 0, 0);
    const banEndDate = new Date(firstHourDate);
    banEndDate.setHours(15, 0, 0, 0);
    banStartOffset = (banStartDate.getTime() - chartStartTimeMs) / (60 * 1000);
    banEndOffset = (banEndDate.getTime() - chartStartTimeMs) / (60 * 1000);
  }

  const hasBanOverlap = isBanDate && banStartOffset !== null && banStartOffset < maxOffset && banEndOffset > 0;

  // Calculate daylight segments in the 12-hour window
  const timesOfInterest = [0, maxOffset];
  if (dailyData && dailyData.sunrise && dailyData.sunset) {
    dailyData.sunrise.forEach(sr => {
      const ms = new Date(sr).getTime();
      const offset = (ms - chartStartTimeMs) / (60 * 1000);
      if (offset > 0 && offset < maxOffset) {
        timesOfInterest.push(offset);
      }
    });
    dailyData.sunset.forEach(ss => {
      const ms = new Date(ss).getTime();
      const offset = (ms - chartStartTimeMs) / (60 * 1000);
      if (offset > 0 && offset < maxOffset) {
        timesOfInterest.push(offset);
      }
    });
  }
  timesOfInterest.sort((a, b) => a - b);

  const daylightAreas = [];
  for (let i = 0; i < timesOfInterest.length - 1; i++) {
    const start = timesOfInterest[i];
    const end = timesOfInterest[i + 1];
    const midOffset = (start + end) / 2;
    const midTimeMs = chartStartTimeMs + midOffset * 60 * 1000;
    const midTimeStr = new Date(midTimeMs).toISOString();
    if (!isNightTime(midTimeStr)) {
      daylightAreas.push({ start, end });
    }
  }

  // Temperature interpolation helper
  const getInterpolatedTemp = (targetMins) => {
    if (chartData.length === 0) return 0;
    if (targetMins <= chartData[0].offset) return chartData[0].temp;
    if (targetMins >= chartData[chartData.length - 1].offset) return chartData[chartData.length - 1].temp;
    
    for (let i = 0; i < chartData.length - 1; i++) {
      const p1 = chartData[i];
      const p2 = chartData[i + 1];
      if (targetMins >= p1.offset && targetMins <= p2.offset) {
        const diff = p2.offset - p1.offset;
        if (diff === 0) return p1.temp;
        const pct = (targetMins - p1.offset) / diff;
        return p1.temp + pct * (p2.temp - p1.temp);
      }
    }
    return 0;
  };

  const currentHourTemp = getInterpolatedTemp(currentOffsetMinutes);
  
  const ticks = hours.map(h => (new Date(h.rawTime).getTime() - chartStartTimeMs) / (60 * 1000));
  
  const tickFormatter = (offset) => {
    const match = hours.find(h => {
      const hOffset = (new Date(h.rawTime).getTime() - chartStartTimeMs) / (60 * 1000);
      return Math.abs(hOffset - offset) < 1;
    });
    return match ? match.timeLabel : '';
  };

  return (
    <div className="w-full h-full bg-cardDarkSlate/60 border border-slate-700/30 rounded-xl p-3 flex flex-col justify-between select-none">
      
      {/* Title block */}
      <div className="flex justify-between items-center mb-1 flex-none">
        <div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
            Z7 • HOURLY PROGRESSION
          </p>
          <h2 className="text-xs font-bold text-slate-300 leading-none">12-Hour Forecast & Temperature Curve</h2>
        </div>
        <div className="flex space-x-2.5 text-[8px] font-bold text-slate-400">
          <span className="flex items-center"><span className="w-2 h-2 rounded bg-safetyGreen/40 mr-1 inline-block border border-safetyGreen/60"></span>SAFE</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded bg-amberAlert/20 mr-1 inline-block border border-amberAlert/60"></span>CAUTION</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded bg-stopRed/30 mr-1 inline-block border border-stopRed/60"></span>HALT</span>
        </div>
      </div>

      {/* Temperature Sparkline Chart Curve */}
      <div className="w-full h-[32%] my-0.5 flex-none relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 2 }}>
            <defs>
              <linearGradient id="tempCurveStroke" x1="0" y1="0" x2="1" y2="0">
                {hours.map((h, i) => {
                  const pct = (i / (hours.length - 1)) * 100;
                  const color = h.isNight ? '#38bdf8' : '#E87722';
                  return <stop key={`stroke-stop-${i}`} offset={`${pct}%`} stopColor={color} />;
                })}
              </linearGradient>
              <linearGradient id="tempCurveGlow" x1="0" y1="0" x2="1" y2="0">
                {hours.map((h, i) => {
                  const pct = (i / (hours.length - 1)) * 100;
                  const color = h.isNight ? '#38bdf8' : '#E87722';
                  return <stop key={`glow-stop-${i}`} offset={`${pct}%`} stopColor={color} stopOpacity={0.12} />;
                })}
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="offset" 
              type="number"
              domain={[0, maxOffset]}
              ticks={ticks}
              tickFormatter={tickFormatter}
              stroke="#64748B" 
              fontSize={7} 
              tickLine={false} 
              axisLine={false}
              dy={2}
            />
            <YAxis 
              domain={['dataMin - 2', 'dataMax + 8']} 
              hide={true} 
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] font-mono font-bold text-textIceWhite">
                      Temp: {payload[0].value}°C
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Daylight segments shading */}
            {daylightAreas.map((area, idx) => (
              <ReferenceArea
                key={`daylight-${idx}`}
                x1={area.start}
                x2={area.end}
                fill="#eab308"
                fillOpacity={0.07}
                stroke="none"
              />
            ))}

            {/* Sunrise line */}
            {dailyData && dailyData.sunrise && dailyData.sunrise.map((sr, idx) => {
              const ms = new Date(sr).getTime();
              const offset = (ms - chartStartTimeMs) / (60 * 1000);
              if (offset >= 0 && offset <= maxOffset) {
                const labelTime = new Date(sr).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: 'Asia/Dubai'
                });
                return (
                  <ReferenceLine
                    key={`sunrise-${idx}`}
                    x={offset}
                    stroke="#eab308"
                    strokeWidth={1.5}
                    strokeDasharray="4,4"
                    label={{
                      value: `☀️ SUNRISE (${labelTime})`,
                      fill: "#eab308",
                      fontSize: 7,
                      fontWeight: "black",
                      position: "insideTopLeft",
                      offset: 5
                    }}
                  />
                );
              }
              return null;
            })}

            {/* Sunset line */}
            {dailyData && dailyData.sunset && dailyData.sunset.map((ss, idx) => {
              const ms = new Date(ss).getTime();
              const offset = (ms - chartStartTimeMs) / (60 * 1000);
              if (offset >= 0 && offset <= maxOffset) {
                const labelTime = new Date(ss).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: 'Asia/Dubai'
                });
                return (
                  <ReferenceLine
                    key={`sunset-${idx}`}
                    x={offset}
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    strokeDasharray="4,4"
                    label={{
                      value: `🌙 SUNSET (${labelTime})`,
                      fill: "#a855f7",
                      fontSize: 7,
                      fontWeight: "black",
                      position: "insideTopLeft",
                      offset: 5
                    }}
                  />
                );
              }
              return null;
            })}

            {hasBanOverlap && (
              <ReferenceArea 
                x1={Math.max(0, banStartOffset)} 
                x2={Math.min(maxOffset, banEndOffset)} 
                fill="#EF4444" 
                fillOpacity={0.15} 
                stroke="#EF4444"
                strokeWidth={0.5}
                strokeDasharray="3,3"
                label={{ 
                  value: "MIDDAY WORK BAN", 
                  fill: "#EF4444", 
                  fontSize: 6.5, 
                  fontWeight: "bold",
                  position: "insideBottomLeft",
                  offset: 8
                }} 
              />
            )}

            {showCurrentLine && (
              <ReferenceLine 
                x={currentOffsetMinutes} 
                stroke="#FF4E02" 
                strokeWidth={1.5}
                strokeDasharray="3,3"
                isFront={true}
              />
            )}

            {showCurrentLine && currentHourTemp !== null && (
              <ReferenceDot 
                x={currentOffsetMinutes} 
                y={currentHourTemp} 
                r={4} 
                fill="#FF4E02" 
                stroke="#F8FAFC" 
                strokeWidth={1.5} 
                isFront={true}
              />
            )}

            <Area 
              type="monotone" 
              dataKey="temp" 
              stroke="url(#tempCurveStroke)" 
              strokeWidth={3.0} 
              fillOpacity={1} 
              fill="url(#tempCurveGlow)" 
            >
              <LabelList 
                dataKey="temp" 
                position="top" 
                offset={8} 
                fontSize={7.5} 
                fill="#E8F4FD" 
                stroke="none"
                fontWeight="bold" 
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Grid Scrollable Cards */}
      <div className="flex space-x-2 overflow-x-auto pb-1 no-scrollbar w-full h-[52%] items-stretch mt-0.5 flex-grow">
        {hours.map((hour, i) => (
          <div
            key={i}
            className={`flex-none w-[82px] rounded-lg border flex flex-col justify-between p-1.5 transition-all duration-300 relative ${getSafetyBg(hour.safetyStatus, hour.isBanned, hour.isNight)} ${getSafetyBorderColor(hour.safetyStatus, hour.isBanned)} ${hour.isHistory ? 'opacity-50 border-dashed border-slate-800' : ''} ${hour.isCurrent ? 'ring-1 ring-edgeOrange/60 bg-edgeOrange/5 shadow-md shadow-edgeOrange/5' : ''}`}
          >
            {/* Time / Status Badge */}
            <div className="flex flex-col items-center space-y-0.5 leading-none">
              <span className="text-[10px] font-mono font-bold text-slate-300 text-center leading-none">
                {hour.timeLabel}
              </span>
              {hour.isHistory && (
                <span className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">
                  PAST
                </span>
              )}
              {hour.isCurrent && (
                <span className="text-[7.5px] font-extrabold text-edgeOrange bg-edgeOrange/15 border border-edgeOrange/30 px-1 py-0.2 rounded uppercase tracking-wider select-none animate-pulse">
                  CURRENT
                </span>
              )}
            </div>

            {/* Inline Midday Ban Status Badge (non-intrusive, keeps details readable) */}
            {hour.isBanned && (
              <span className="text-[7.5px] font-extrabold text-red-400 bg-red-950/85 border border-red-500/45 px-1 py-0.5 rounded text-center uppercase tracking-wide leading-none mt-1 select-none">
                {hour.rawTime.endsWith('12:00') ? 'BAN 12:30+' : 'BAN ACTIVE'}
              </span>
            )}

            {/* Condition Icon */}
            <span className="text-2xl text-center my-0.5 filter drop-shadow leading-none">
              {hour.condition.emoji}
            </span>

            {/* Temperature */}
            <div className="text-center">
              <span className="text-sm font-black text-textIceWhite">
                {hour.temp.toFixed(0)}
              </span>
              <span className="text-xs text-edgeOrange font-semibold">°</span>
            </div>

            {/* Precip% */}
            <div className="flex items-center justify-center space-x-0.5 text-[9.5px] font-bold text-slate-400 leading-none">
              <Droplets className="w-2.5 h-2.5 text-blue-400" />
              <span>{hour.precipProb}%</span>
            </div>

            {/* Wind */}
            <div className="flex items-center justify-center space-x-0.5 text-[9.5px] font-bold text-slate-400 leading-none">
              <Compass className="w-2.5 h-2.5 text-slate-500" />
              <span className="font-mono text-slate-200">{hour.windSpeed.toFixed(0)}</span>
              <span className="text-[7.5px] text-slate-500 font-semibold">k/h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
