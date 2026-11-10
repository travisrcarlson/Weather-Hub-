/**
 * Abu Al Abyad Island Astronomical Lunar Ephemeris & Transit Utilities
 * Extracted into a pure utility module to preserve Vite Fast Refresh across UI components.
 */

export function parseGstDate(str) {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  if (typeof str === 'string' && (str.includes('+') || str.endsWith('Z'))) return new Date(str);
  return new Date(`${str}+04:00`);
}

export function getMoonDetails(dateString) {
  const date = dateString ? parseGstDate(dateString) : new Date();
  const epoch = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const diffTime = date.getTime() - epoch.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const synodicMonth = 29.530588853;

  const phase = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  const agePct = phase / synodicMonth;

  if (agePct < 0.03 || agePct > 0.97) {
    return { phase: agePct, name: 'New Moon', emoji: '🌑' };
  }
  if (agePct <= 0.22) {
    return { phase: agePct, name: 'Waxing Crescent', emoji: '🌒' };
  }
  if (agePct <= 0.28) {
    return { phase: agePct, name: 'First Quarter', emoji: '🌓' };
  }
  if (agePct <= 0.47) {
    return { phase: agePct, name: 'Waxing Gibbous', emoji: '🌔' };
  }
  if (agePct <= 0.53) {
    return { phase: agePct, name: 'Full Moon', emoji: '🌕' };
  }
  if (agePct <= 0.72) {
    return { phase: agePct, name: 'Waning Gibbous', emoji: '🌖' };
  }
  if (agePct <= 0.78) {
    return { phase: agePct, name: 'Third Quarter', emoji: '🌗' };
  }
  return { phase: agePct, name: 'Waning Crescent', emoji: '🌘' };
}

// Generates an exact SVG path for the illuminated portion of the Moon centered at (0, 0) with radius r
export function getLunarPhaseSvgPath(agePct = 0.5, r = 5) {
  const p = ((agePct % 1) + 1) % 1;
  if (p <= 0.02 || p >= 0.98) {
    return '';
  }
  if (p >= 0.48 && p <= 0.52) {
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  }
  const phi = 2 * Math.PI * p;
  const rx = Math.max(0.05, Math.abs(Math.cos(phi)) * r);
  const outerSweep = p <= 0.5 ? 1 : 0;
  const innerSweep = p < 0.25 || (p > 0.5 && p <= 0.75) ? 0 : 1;
  return `M 0 ${-r} A ${r} ${r} 0 0 ${outerSweep} 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} 0 ${-r} Z`;
}

// Astronomical Lunar Altitude Calculator for Abu Al Abyad Island (24.195°N, 53.860°E)
function computeLunarAltitudeDeg(dateUtcMs, latDeg = 24.195, lonDeg = 53.860) {
  const rad = Math.PI / 180;
  // Days since J2000.0 (2000-01-01T12:00:00Z)
  const d = (dateUtcMs - 946728000000) / 86400000;

  // Geocentric ecliptic lunar elements (low-precision astronomical ephemeris)
  const L = (218.316 + 13.176396 * d) * rad; // Mean longitude
  const M = (134.963 + 13.064993 * d) * rad; // Mean anomaly
  const F = (93.272 + 13.229350 * d) * rad;  // Mean distance

  const lonEcl = L + 6.289 * rad * Math.sin(M); // Ecliptic longitude
  const latEcl = 5.128 * rad * Math.sin(F);     // Ecliptic latitude
  const eps = (23.439 - 0.0000004 * d) * rad;   // Obliquity of ecliptic

  // Right Ascension (ra) and Declination (dec)
  const sinDec = Math.sin(latEcl) * Math.cos(eps) + Math.cos(latEcl) * Math.sin(eps) * Math.sin(lonEcl);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = Math.sin(lonEcl) * Math.cos(eps) - Math.tan(latEcl) * Math.sin(eps);
  const x = Math.cos(lonEcl);
  const ra = Math.atan2(y, x);

  // Greenwich Mean Sidereal Time + Local Sidereal Time
  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
  const lstRad = (gmstDeg + lonDeg) * rad;
  const ha = lstRad - ra; // Local Hour Angle

  const latRad = latDeg * rad;
  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha);
  const altDeg = (Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad) + 0.125; // +0.125° horizon refraction/parallax
  return altDeg;
}

// Helper for astronomical Moonrise/Moonset times at Abu Al Abyad Island (GST = UTC+4)
export function getMoonTimes(sunriseTimeStr, sunsetTimeStr, agePct = 0.5) {
  if (!sunriseTimeStr || !sunsetTimeStr) return { rise: '--:--', set: '--:--' };

  const refDate = parseGstDate(sunriseTimeStr);
  const gstOffsetMs = 4 * 3600 * 1000;
  const gstRef = new Date(refDate.getTime() + gstOffsetMs);
  const dayStartUtcMs = Date.UTC(
    gstRef.getUTCFullYear(),
    gstRef.getUTCMonth(),
    gstRef.getUTCDate(),
    0, 0, 0
  ) - gstOffsetMs;

  let riseMs = null;
  let setMs = null;
  const stepMs = 5 * 60 * 1000; // 5-minute ephemeris scan across 24h GST day
  let prevAlt = computeLunarAltitudeDeg(dayStartUtcMs);

  for (let m = 5; m <= 1440; m += 5) {
    const tMs = dayStartUtcMs + m * 60 * 1000;
    const curAlt = computeLunarAltitudeDeg(tMs);
    if (prevAlt < 0 && curAlt >= 0 && riseMs === null) {
      const frac = -prevAlt / (curAlt - prevAlt || 1);
      riseMs = tMs - stepMs + frac * stepMs;
    } else if (prevAlt >= 0 && curAlt < 0 && setMs === null) {
      const frac = prevAlt / (prevAlt - curAlt || 1);
      setMs = tMs - stepMs + frac * stepMs;
    }
    prevAlt = curAlt;
  }

  const fallbackRiseMs = refDate.getTime() + agePct * 24 * 3600 * 1000;
  const fallbackSetMs = parseGstDate(sunsetTimeStr).getTime() + agePct * 24 * 3600 * 1000;
  const finalRiseDate = new Date(riseMs !== null ? riseMs : fallbackRiseMs);
  const finalSetDate = new Date(setMs !== null ? setMs : fallbackSetMs);

  const formatTimeLocal = (d) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai'
    });

  return {
    rise: formatTimeLocal(finalRiseDate),
    set: formatTimeLocal(finalSetDate),
    riseDate: finalRiseDate,
    setDate: finalSetDate
  };
}

export function checkTransitPosition(nowDate, riseDate, setDate) {
  const nowMs = nowDate.getTime();
  const riseMs = riseDate.getTime();
  const setMs = setDate.getTime();

  if (riseMs < setMs) {
    if (nowMs >= riseMs && nowMs <= setMs) {
      const p = (nowMs - riseMs) / (setMs - riseMs);
      return { visible: true, progress: p };
    }
  } else {
    const dayMs = 24 * 60 * 60 * 1000;
    if (nowMs >= riseMs - dayMs && nowMs <= setMs) {
      const p = (nowMs - (riseMs - dayMs)) / (setMs - (riseMs - dayMs));
      return { visible: true, progress: p };
    }
    if (nowMs >= riseMs && nowMs <= setMs + dayMs) {
      const p = (nowMs - riseMs) / ((setMs + dayMs) - riseMs);
      return { visible: true, progress: p };
    }
  }
  return { visible: false, progress: 0 };
}
