// Safety Evaluation Engine for XRange Range Operations
// Standards based on ADOSH-SF v4.0 (Adverse Weather & Heat Stress CoPs) and MoHRE Ministerial Decree 401/2015

export function calculateDewPoint(temp, rh) {
  if (!temp || !rh) return 0;
  const a = 17.625;
  const b = 243.04;
  const alpha = ((a * temp) / (b + temp)) + Math.log(rh / 100);
  const dewPoint = (b * alpha) / (a - alpha);
  return Number(dewPoint.toFixed(1));
}

export function calculateHumidex(temp, dewPoint) {
  if (!temp || !dewPoint) return temp || 0;
  // e = vapor pressure in hPa
  const e = 6.11 * Math.exp(5417.7530 * (1/273.16 - 1/(dewPoint + 273.15)));
  const humidex = temp + 0.5555 * (e - 10.0);
  return Number(humidex.toFixed(1));
}

export function getHumidexComfort(humidex) {
  if (humidex < 30) return { label: "Comfortable", color: "text-safetyGreen" };
  if (humidex < 40) return { label: "Some Discomfort", color: "text-amberAlert" };
  if (humidex < 46) return { label: "Great Discomfort", color: "text-windDanger" };
  return { label: "Extreme Danger (Stroke Risk)", color: "text-purple-400 font-bold animate-pulse" };
}

export function calculateWBGT(temp, rh, windSpeedKmh, uvIndex) {
  if (temp === undefined || rh === undefined) return temp || 0;
  
  // 1. Calculate Stull's Wet Bulb Temperature (Tw)
  const Tw = temp * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) 
             + Math.atan(temp + rh) 
             - Math.atan(rh - 1.676331) 
             + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) 
             - 4.686035;

  // 2. Estimate solar radiation from UV index (S in W/m^2)
  const uv = uvIndex !== undefined ? uvIndex : 0;
  const S = uv * 90;

  // 3. Convert wind speed from km/h to m/s
  const u = (windSpeedKmh || 0) / 3.6;

  // 4. Estimate Globe Temperature (Tg)
  let Tg = temp + 0.017 * S - 0.208 * u;
  if (S === 0 || Tg < temp) {
    Tg = temp;
  }

  // 5. Calculate Outdoor WBGT: 0.7 * Tw + 0.2 * Tg + 0.1 * Ta
  const wbgt = 0.7 * Tw + 0.2 * Tg + 0.1 * temp;

  return Number(wbgt.toFixed(1));
}

export function getWBGTComfort(wbgt) {
  if (wbgt < 25.9) return { label: "Normal (Green Flag)", color: "text-safetyGreen" };
  if (wbgt < 27.9) return { label: "Caution (Yellow Flag)", color: "text-yellow-400" };
  if (wbgt < 30.0) return { label: "High Risk (Amber Flag)", color: "text-amberAlert" };
  return { label: "Extreme Danger (Red/Black Flag)", color: "text-purple-400 font-bold animate-pulse" };
}

// MoHRE Midday Work Ban helper: June 15 to September 15, 12:30 to 15:00 GST
export function evaluateMiddayBan(dateTimeStr) {
  const date = dateTimeStr ? new Date(dateTimeStr) : new Date();
  
  // Since we are running in GST (UTC+4), we can parse current hours/minutes in local time
  // If we run inside Abu Dhabi, local browser time matches GST
  const month = date.getMonth(); // 0-indexed (June = 5, Sep = 8)
  const day = date.getDate();
  
  let isBanDate = false;
  if (month === 5 && day >= 15) isBanDate = true; // June 15+
  if (month > 5 && month < 8) isBanDate = true;    // July, August
  if (month === 8 && day <= 15) isBanDate = true; // Sept 1-15
  
  if (!isBanDate) {
    return { isActive: false, isUpcoming: false, countdownText: "" };
  }
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentMinutes = hour * 60 + minute;
  
  const banStartMinutes = 12 * 60 + 30; // 12:30 -> 750
  const banEndMinutes = 15 * 60;        // 15:00 -> 900
  
  if (currentMinutes >= banStartMinutes && currentMinutes < banEndMinutes) {
    // Ban is active
    const diff = banEndMinutes - currentMinutes;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const cdText = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
    return { isActive: true, isUpcoming: false, countdownText: cdText };
  } else if (currentMinutes < banStartMinutes) {
    // Ban is upcoming today
    const diff = banStartMinutes - currentMinutes;
    if (diff <= 120) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      const cdText = h > 0 ? `${h}h ${m}m to start` : `${m}m to start`;
      return { isActive: false, isUpcoming: true, countdownText: cdText };
    } else {
      return { isActive: false, isUpcoming: false, countdownText: "" };
    }
  } else {
    // Ban is finished for today, upcoming tomorrow
    return { isActive: false, isUpcoming: false, countdownText: "Finished for today" };
  }
}

export function evaluateSafety(data) {
  const reasons = [];
  let status = "GREEN";
  
  const temp = data.temperature_2m || 0;
  const feelsLike = data.apparent_temperature || 0;
  const windSpeed = data.wind_speed_10m || 0;
  const windGusts = data.wind_gusts_10m || 0;
  const rh = data.relative_humidity_2m || 0;
  const visibilityMeters = data.visibility || 10000;
  const visibilityKm = visibilityMeters / 1000;
  const uv = data.uv_index || 0;
  const precip = data.precipitation || 0;
  const aqi = data.european_aqi || 0;
  const pm10 = data.pm10 || 0;
  const wmo = data.weathercode || 0;
  
  // 1. Sustained Wind (ADOSH Threshold: >=38 km/h RED, 20-37 km/h AMBER)
  if (windSpeed >= 38) {
    status = "RED";
    reasons.push(`Sustained wind speed (${windSpeed} km/h) exceeds safe limit (≥38 km/h).`);
  } else if (windSpeed >= 20) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Elevated sustained wind speed (${windSpeed} km/h).`);
  }
  
  // 2. Wind Gusts (ADOSH Threshold: >=50 km/h RED, 20-49 km/h AMBER)
  if (windGusts >= 50) {
    status = "RED";
    reasons.push(`Wind gust (${windGusts} km/h) exceeds safe limit (≥50 km/h).`);
  } else if (windGusts >= 20) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Elevated wind gust (${windGusts} km/h) requiring equipment securing.`);
  }
  
  // 3. Visibility (ADOSH Threshold: <1 km RED, 1-5 km AMBER)
  if (visibilityKm < 1) {
    status = "RED";
    reasons.push(`Visibility (${visibilityKm.toFixed(1)} km) is below safe limit (<1 km) due to fog/sandstorm.`);
  } else if (visibilityKm <= 5) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Reduced visibility (${visibilityKm.toFixed(1)} km) due to haze/dust.`);
  }
  
  // 4. Air Temperature (ADOSH Threshold: >=43°C RED, 38-43°C AMBER)
  if (temp >= 43) {
    status = "RED";
    reasons.push(`Extreme temperature (${temp}°C) exceeds safety limit (≥43°C).`);
  } else if (temp >= 38) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High temperature (${temp}°C). Heat stress protocols active.`);
  }
  
  // 5. ISO 7243 Wet Bulb Globe Temperature (WBGT) (Threshold: >=30.0°C RED, >=27.9°C AMBER)
  const wbgt = calculateWBGT(temp, rh, windSpeed, uv);
  if (wbgt >= 30.0) {
    status = "RED";
    reasons.push(`Extreme Heat Stress (WBGT: ${wbgt.toFixed(1)}°C) exceeds safety limit (≥30.0°C). Suspend all outdoor activities.`);
  } else if (wbgt >= 27.9) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High Heat Stress (WBGT: ${wbgt.toFixed(1)}°C). Rest break compliance required.`);
  } else if (wbgt >= 25.9) {
    if (status !== "RED" && status !== "AMBER") status = "AMBER";
    reasons.push(`Elevated Heat Stress (WBGT: ${wbgt.toFixed(1)}°C). Monitor personnel hydration.`);
  }
  
  // 6. UV Index (ADOSH Threshold: >=8 AMBER/RED - Master Prompt requires UV>=8 = CAUTION (AMBER))
  if (uv >= 8) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Extreme UV index (${uv}). Re-schedule outdoor work and wear PPE.`);
  } else if (uv >= 6) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High UV index (${uv}). Mandatory sunscreen & protective gear.`);
  }
  
  // 7. Humidity (ADOSH Threshold: >=85% Severe Comfort Index)
  if (rh >= 85) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Extreme humidity (${rh}%). Dew point and heat stroke risk heightened.`);
  } else if (rh >= 60) {
    if (status !== "RED" && status !== "AMBER") status = "AMBER";
    // We don't always add a reason line for 60% as it's common, but we color it
  }
  
  // 8. Precipitation (ADOSH Threshold: >=2 mm/hr RED, 0.1-2 mm/hr AMBER)
  if (precip >= 2) {
    status = "RED";
    reasons.push(`Moderate/heavy precipitation (${precip} mm/hr). Suspend electrical/range ops.`);
  } else if (precip > 0) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Precipitation (${precip} mm/hr) requiring surface traction review.`);
  }
  
  // 9. Air Quality (ADOSH Threshold: >=200 AQI RED, 101-200 AMBER)
  if (aqi >= 200) {
    status = "RED";
    reasons.push(`Dangerous Air Quality (AQI ${aqi}). N95/FFP3 masks mandatory.`);
  } else if (aqi >= 101) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Unhealthy Air Quality (AQI ${aqi}) for sensitive groups.`);
  }
  
  // 10. Dust PM10 (ADOSH Threshold: >=155 RED, 54-154 AMBER)
  if (pm10 >= 155) {
    status = "RED";
    reasons.push(`Extreme dust/PM10 level (${pm10} µg/m³) - Sandstorm protocol active.`);
  } else if (pm10 >= 54) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Elevated dust/PM10 level (${pm10} µg/m³).`);
  }
  
  // 11. Lightning (WMO Code 95, 96, 99 triggers RED)
  if (wmo === 95 || wmo === 96 || wmo === 99) {
    status = "RED";
    reasons.push(`ACTIVE LIGHTNING AND THUNDERSTORMS (WMO ${wmo}). Evacuate range immediately!`);
  }
  
  // 12. MoHRE Midday Ban Check
  const midday = evaluateMiddayBan(data.time);
  if (midday.isActive) {
    status = "RED";
    reasons.unshift(`MoHRE MIDDAY BAN ACTIVE (${midday.countdownText}). No outdoor work allowed.`);
  } else if (midday.isUpcoming) {
    if (status !== "RED" && status !== "AMBER") status = "AMBER";
    reasons.push(`MoHRE Midday Work Ban upcoming (${midday.countdownText}). Prepare to suspend.`);
  }
  
  // Styling mappings
  let bannerColor = "bg-safetyGreen border-green-500 text-white";
  let pulse = false;
  if (status === "AMBER") {
    bannerColor = "bg-amberAlert border-amber-600 text-white animate-pulse";
  } else if (status === "RED") {
    bannerColor = "bg-stopRed border-red-600 text-white animate-red-flash";
    pulse = true;
  }
  
  return {
    status,
    reasons,
    colors: { banner: bannerColor, pulse }
  };
}

export function getTrendIndicator(currentVal, prevVal, threshold = 0.05) {
  if (prevVal === undefined || prevVal === null) return { arrow: '→', text: 'Steady', class: 'text-slate-500' };
  const diff = currentVal - prevVal;
  if (Math.abs(diff) < threshold) return { arrow: '→', text: 'Steady', class: 'text-slate-500' };
  if (diff > 0) return { arrow: '↑', text: 'Rising', class: 'text-stopRed font-bold' };
  return { arrow: '↓', text: 'Falling', class: 'text-safetyGreen font-bold' };
}

export function getWindShiftIndicator(currentDir, prevDir) {
  if (prevDir === undefined || prevDir === null) return 'Steady';
  const diff = Math.abs(currentDir - prevDir);
  const angleDiff = diff > 180 ? 360 - diff : diff;
  return angleDiff > 15 ? 'Shifting' : 'Steady';
}

export function calculateSunscreenIntervals(uvIndex) {
  const uv = uvIndex !== undefined ? uvIndex : 0;
  let factor = 1.0;
  if (uv > 10) factor = 0.5;      // Extreme: 50% shorter
  else if (uv >= 8) factor = 0.6; // Very High: 40% shorter
  else if (uv >= 6) factor = 0.75;// High: 25% shorter
  else if (uv >= 3) factor = 0.9; // Moderate: 10% shorter

  // Baselines: SPF 10: 45m, SPF 30: 80m, SPF 50: 120m
  const spf10 = Math.round(45 * factor);
  const spf30 = Math.round(80 * factor);
  const spf50 = Math.round(120 * factor);

  // Recommended SPF based on UV index
  let recommendedSpf = "SPF 15+";
  let suitability = { spf10: "Suitable", spf30: "Suitable", spf50: "Suitable" };

  if (uv <= 2) {
    recommendedSpf = "SPF 15+";
    suitability = { spf10: "Suitable", spf30: "Recommended", spf50: "Max Protection" };
  } else if (uv <= 5) {
    recommendedSpf = "SPF 30+";
    suitability = { spf10: "Insufficient", spf30: "Mandatory", spf50: "Recommended" };
  } else if (uv <= 7) {
    recommendedSpf = "SPF 30+ / SPF 50";
    suitability = { spf10: "Dangerous", spf30: "Minimum Required", spf50: "Highly Recommended" };
  } else if (uv <= 10) {
    recommendedSpf = "SPF 50+";
    suitability = { spf10: "Extreme Danger", spf30: "Insufficient", spf50: "Mandatory" };
  } else {
    recommendedSpf = "SPF 50+";
    suitability = { spf10: "Extreme Danger", spf30: "Insufficient", spf50: "Mandatory + Reapply Alert" };
  }

  return {
    factor,
    spf10,
    spf30,
    spf50,
    recommendedSpf,
    suitability
  };
}

export function getProjectedAdvisories(hourlyData, currentTime) {
  if (!hourlyData || !hourlyData.time) return [];

  // Find the current hour index
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

  const curHourStr = getDubaiHourString(currentTime);
  const curIdx = hourlyData.time.findIndex(t => t.startsWith(curHourStr.slice(0, 13)));
  const startIndex = curIdx >= 0 ? curIdx : 0;

  // Scan the next 12 hours (excluding current hour for projections)
  const scanHoursCount = 12;
  
  const tempBreachHours = [];
  const wbgtBreachHours = [];
  const windBreachHours = [];
  const gustBreachHours = [];
  const uvBreachHours = [];
  const visibilityBreachHours = [];
  const rainBreachHours = [];
  const aqiBreachHours = [];
  const middayBanHours = [];

  for (let i = 1; i <= scanHoursCount; i++) {
    const idx = startIndex + i;
    if (idx >= hourlyData.time.length) break;

    const timeStr = hourlyData.time[idx];
    const hour = parseInt(timeStr.split('T')[1].slice(0, 2), 10);

    const temp = hourlyData.temperature_2m[idx] || 0;
    const rh = hourlyData.relative_humidity_2m ? (hourlyData.relative_humidity_2m[idx] || 0) : 50;
    const windSpeed = hourlyData.wind_speed_10m[idx] || 0;
    const windGusts = hourlyData.wind_gusts_10m ? (hourlyData.wind_gusts_10m[idx] || 0) : 0;
    const uv = hourlyData.uv_index ? (hourlyData.uv_index[idx] || 0) : 0;
    const visibility = hourlyData.visibility ? (hourlyData.visibility[idx] || 10000) : 10000;
    const visibilityKm = visibility / 1000;
    const precip = hourlyData.precipitation ? (hourlyData.precipitation[idx] || 0) : 0;
    const aqi = hourlyData.european_aqi ? (hourlyData.european_aqi[idx] || 0) : 0;

    // Check thresholds:
    if (temp >= 43) {
      tempBreachHours.push(hour);
    }
    const wbgt = calculateWBGT(temp, rh, windSpeed, uv);
    if (wbgt >= 30.0) {
      wbgtBreachHours.push(hour);
    }
    if (windSpeed >= 38) {
      windBreachHours.push(hour);
    }
    if (windGusts >= 50) {
      gustBreachHours.push(hour);
    }
    if (uv >= 8) {
      uvBreachHours.push(hour);
    }
    if (visibilityKm < 1) {
      visibilityBreachHours.push(hour);
    }
    if (precip >= 2) {
      rainBreachHours.push(hour);
    }
    if (aqi >= 200) {
      aqiBreachHours.push(hour);
    }

    // Midday work ban: June 15 to September 15, 12:30 to 15:00 GST
    const date = new Date(timeStr);
    const month = date.getMonth();
    const day = date.getDate();
    let isBanDate = false;
    if (month === 5 && day >= 15) isBanDate = true;
    if (month > 5 && month < 8) isBanDate = true;
    if (month === 8 && day <= 15) isBanDate = true;

    if (isBanDate) {
      if (hour === 13 || hour === 14) {
        middayBanHours.push(hour);
      }
    }
  }

  const formatHourSegments = (hoursList) => {
    if (!hoursList || hoursList.length === 0) return "";
    const sorted = [...hoursList].sort((a, b) => a - b);
    const segments = [];
    let start = sorted[0];
    let prev = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        segments.push({ start, end: prev });
        start = sorted[i];
        prev = sorted[i];
      }
    }
    segments.push({ start, end: prev });
    
    return segments.map(seg => {
      const startStr = `${String(seg.start).padStart(2, '0')}:00`;
      const endStr = `${String((seg.end + 1) % 24).padStart(2, '0')}:00`;
      return `${startStr}-${endStr}`;
    }).join(', ');
  };

  const projected = [];
  if (tempBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Extreme Heat',
      timeframe: formatHourSegments(tempBreachHours)
    });
  }
  if (wbgtBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Danger WBGT Heat',
      timeframe: formatHourSegments(wbgtBreachHours)
    });
  }
  if (windBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'High Wind Speed',
      timeframe: formatHourSegments(windBreachHours)
    });
  }
  if (gustBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Critical Gusts',
      timeframe: formatHourSegments(gustBreachHours)
    });
  }
  if (uvBreachHours.length > 0) {
    projected.push({
      type: 'AMBER',
      metric: 'Extreme UV Index',
      timeframe: formatHourSegments(uvBreachHours)
    });
  }
  if (visibilityBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Severe Low Vis',
      timeframe: formatHourSegments(visibilityBreachHours)
    });
  }
  if (rainBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Heavy Precip Risk',
      timeframe: formatHourSegments(rainBreachHours)
    });
  }
  if (aqiBreachHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Dangerous AQI',
      timeframe: formatHourSegments(aqiBreachHours)
    });
  }
  if (middayBanHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Midday Ban (12:30-15:00)',
      timeframe: '12:30-15:00'
    });
  }

  return projected;
}


