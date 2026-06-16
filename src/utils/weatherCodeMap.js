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
