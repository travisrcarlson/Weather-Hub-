// Maps WMO codes to human-readable text, emojis, and styling classes.
// Sourced from WMO No. 1165 standards as specified in the project sheet.

export const weatherCodeMap = {
  0: { label: "Clear Sky", emoji: "☀️", bgClass: "from-blue-500/20 to-amber-500/20", iconColor: "text-amber-400" },
  1: { label: "Mainly Clear", emoji: "🌤️", bgClass: "from-blue-500/20 to-slate-500/10", iconColor: "text-amber-300" },
  2: { label: "Partly Cloudy", emoji: "⛅", bgClass: "from-slate-600/10 to-blue-500/10", iconColor: "text-slate-300" },
  3: { label: "Overcast", emoji: "☁️", bgClass: "from-slate-700/20 to-slate-800/20", iconColor: "text-slate-400" },
  45: { label: "Foggy", emoji: "🌫️", bgClass: "from-slate-800/30 to-zinc-700/20", iconColor: "text-slate-400" },
  48: { label: "Depositing Rime Fog", emoji: "🌫️", bgClass: "from-slate-800/30 to-zinc-700/20", iconColor: "text-slate-400" },
  51: { label: "Light Drizzle", emoji: "🌧️", bgClass: "from-blue-900/20 to-slate-800/10", iconColor: "text-blue-300" },
  53: { label: "Moderate Drizzle", emoji: "🌧️", bgClass: "from-blue-900/20 to-slate-800/10", iconColor: "text-blue-300" },
  55: { label: "Dense Drizzle", emoji: "🌧️", bgClass: "from-blue-900/20 to-slate-800/10", iconColor: "text-blue-300" },
  61: { label: "Slight Rain", emoji: "🌧️", bgClass: "from-blue-900/30 to-cyan-950/20", iconColor: "text-blue-400" },
  63: { label: "Moderate Rain", emoji: "🌧️", bgClass: "from-blue-900/40 to-cyan-950/30", iconColor: "text-blue-500" },
  65: { label: "Heavy Rain", emoji: "🌧️", bgClass: "from-blue-950/50 to-cyan-950/40", iconColor: "text-blue-600" },
  71: { label: "Slight Snow", emoji: "❄️", bgClass: "from-zinc-100/10 to-blue-950/10", iconColor: "text-zinc-200" },
  73: { label: "Moderate Snow", emoji: "❄️", bgClass: "from-zinc-100/20 to-blue-950/10", iconColor: "text-zinc-100" },
  75: { label: "Heavy Snow", emoji: "❄️", bgClass: "from-zinc-100/30 to-blue-950/20", iconColor: "text-zinc-50" },
  80: { label: "Light Rain Showers", emoji: "🌦️", bgClass: "from-blue-900/20 to-amber-500/10", iconColor: "text-blue-400" },
  81: { label: "Moderate Rain Showers", emoji: "🌦️", bgClass: "from-blue-900/30 to-amber-500/10", iconColor: "text-blue-400" },
  82: { label: "Violent Rain Showers", emoji: "🌦️", bgClass: "from-blue-950/40 to-red-500/10", iconColor: "text-blue-500" },
  95: { label: "Thunderstorm", emoji: "⛈️", bgClass: "from-purple-950/40 to-red-950/20", iconColor: "text-purple-400", isLightning: true },
  96: { label: "Thunderstorm with Hail", emoji: "⛈️", bgClass: "from-purple-950/50 to-red-950/30", iconColor: "text-purple-500", isLightning: true },
  99: { label: "Severe Thunderstorm", emoji: "⛈️", bgClass: "from-purple-950/60 to-red-950/40", iconColor: "text-purple-600", isLightning: true }
};

export function getWeatherCondition(code, isNight = false) {
  const cond = weatherCodeMap[code] || { label: "Unknown", emoji: "❓", bgClass: "from-slate-800 to-slate-900", iconColor: "text-slate-500" };
  
  if (isNight) {
    if (code === 0) {
      return {
        ...cond,
        label: "Clear Night",
        emoji: "🌙",
        bgClass: "from-blue-950/20 to-indigo-950/25",
        iconColor: "text-indigo-300"
      };
    }
    if (code === 1) {
      return {
        ...cond,
        label: "Mostly Clear",
        emoji: "☁️",
        bgClass: "from-blue-950/25 to-slate-900/10",
        iconColor: "text-slate-400"
      };
    }
    if (code === 2) {
      return {
        ...cond,
        label: "Partly Cloudy",
        emoji: "☁️",
        bgClass: "from-slate-800/10 to-indigo-950/10",
        iconColor: "text-slate-400"
      };
    }
  }
  
  return cond;
}

/**
 * Safely extracts the minute-of-day (0 - 1439) in Asia/Dubai timezone (GST, UTC+4).
 * Handles Date objects, ISO UTC strings ("...Z"), and local GST strings ("YYYY-MM-DDTHH:mm").
 */
export function getDubaiMinutesOfDay(input) {
  if (!input) return null;

  // Handle strings
  if (typeof input === 'string') {
    // If it has 'Z' or explicit timezone offset, parse as standard Date then format in Asia/Dubai
    if (input.includes('Z') || /[+-]\d{2}:\d{2}$/.test(input)) {
      const d = new Date(input);
      if (!isNaN(d.getTime())) {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Dubai',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
          hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(d);
        const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        return h * 60 + m;
      }
    } else {
      // Local GST time string like "2026-09-10T09:25" or "09:25"
      const match = input.match(/T?(\d{1,2}):(\d{2})/);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        return h * 60 + m;
      }
    }
  }

  // Handle Date objects or numeric epoch timestamps
  const d = typeof input === 'number' ? new Date(input) : (input instanceof Date ? input : new Date(input));
  if (!isNaN(d.getTime())) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(d);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return h * 60 + m;
  }

  return null;
}

/**
 * Robust Day/Night evaluator for X-Range (Asia/Dubai).
 * Compares current minute of day against local sunrise and sunset.
 * Default sunrise: 05:32 (332 min), sunset: 19:06 (1146 min).
 */
export function getIsNightTime(timeInput, dailyData) {
  const currentMinutes = getDubaiMinutesOfDay(timeInput);
  if (currentMinutes === null) return false;

  let sunriseMinutes = 5 * 60 + 32; // Default 05:32 GST
  let sunsetMinutes = 19 * 60 + 6;  // Default 19:06 GST

  if (dailyData && Array.isArray(dailyData.sunrise) && Array.isArray(dailyData.sunset)) {
    let dateStr = '';
    if (typeof timeInput === 'string') {
      const match = timeInput.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) dateStr = match[1];
    } else if (timeInput instanceof Date && !isNaN(timeInput.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(timeInput);
      const get = (type) => parts.find(p => p.type === type)?.value || '00';
      dateStr = `${get('year')}-${get('month')}-${get('day')}`;
    }

    let idx = -1;
    if (dateStr && Array.isArray(dailyData.time)) {
      idx = dailyData.time.findIndex(t => t && t.startsWith(dateStr));
    }
    if (idx === -1) idx = 0; // Fallback to today's entry (first element)

    if (dailyData.sunrise[idx]) {
      const parsedSunrise = getDubaiMinutesOfDay(dailyData.sunrise[idx]);
      if (parsedSunrise !== null) sunriseMinutes = parsedSunrise;
    }
    if (dailyData.sunset[idx]) {
      const parsedSunset = getDubaiMinutesOfDay(dailyData.sunset[idx]);
      if (parsedSunset !== null) sunsetMinutes = parsedSunset;
    }
  }

  return currentMinutes < sunriseMinutes || currentMinutes > sunsetMinutes;
}
