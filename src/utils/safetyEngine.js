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

export function calculateWBGT(temp, rh, windSpeedKmh, uvIndex, solarRadiationWm2) {
  if (temp === undefined || rh === undefined) return temp || 0;
  
  // 1. Calculate Stull's Wet Bulb Temperature (Tw)
  const Tw = temp * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) 
             + Math.atan(temp + rh) 
             - Math.atan(rh - 1.676331) 
             + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) 
             - 4.686035;

  // 2. Solar radiation: use direct solar flux (W/m^2) if provided, or fallback to UV * 80
  const uv = uvIndex !== undefined ? uvIndex : 0;
  const S = solarRadiationWm2 !== undefined && solarRadiationWm2 !== null ? solarRadiationWm2 : uv * 80;

  // 3. Convert wind speed from km/h to m/s
  const u = Math.max(0.5, (windSpeedKmh || 0) / 3.6);

  // 4. Estimate Globe Temperature (Tg) calibrated for solar irradiance & wind convection
  let Tg = temp + (0.0095 * S) / (1 + 0.18 * u);
  if (S <= 0 || Tg < temp) {
    Tg = temp;
  }

  // 5. Calculate Outdoor WBGT: 0.7 * Tw + 0.2 * Tg + 0.1 * Ta
  const wbgt = 0.7 * Tw + 0.2 * Tg + 0.1 * temp;

  return Number(wbgt.toFixed(1));
}

// Unified ADOSH CoP 11.0 & ISO 7243 Heat Stress -> Hydration & Work/Rest Engine
// Evaluates WBGT, Dry-Bulb Shade Temp, and Apparent Temp (Feels Like) together so
// heat stress always translates directly and consistently into water intake (L/hr).
export function evaluateHeatStress(temp = 0, rh = 50, windSpeedKmh = 0, uvIndex = 0, solarRadiationWm2 = null, apparentTemp = null) {
  const wbgt = calculateWBGT(temp, rh, windSpeedKmh, uvIndex, solarRadiationWm2);
  const dewPoint = calculateDewPoint(temp, rh);
  const feelsLike = apparentTemp !== null && apparentTemp !== undefined
    ? apparentTemp
    : calculateHumidex(temp, dewPoint);

  // Determine unified heat stress severity tier from WBGT, Dry Bulb, or Feels Like
  if (wbgt >= 30.5 || temp >= 42.0 || feelsLike >= 43.0) {
    return {
      wbgt,
      dewPoint,
      feelsLike,
      tier: "SEVERE",
      level: "SEVERE CAUTION",
      flagLabel: "Severe Heat (Red Flag)",
      color: "text-amberAlert font-bold",
      badgeColor: "text-stopRed border-stopRed/60 bg-stopRed/10",
      litersPerHour: 1.25,
      volume: "1.25 L",
      volumePerHour: "1.25 L/hr",
      cupSchedule: "250 mL every 12m",
      workRestRatio: "30m Work / 30m Rest",
      shortRatio: "30m / 30m",
      shortNote: "30m Mandatory Shade",
      law: "ADOSH CoP 11.0 (Severe Heat)",
      note: "250 mL every 12m + Mandatory Electrolytes."
    };
  }

  if (wbgt >= 27.9 || temp >= 38.0 || feelsLike >= 39.0) {
    return {
      wbgt,
      dewPoint,
      feelsLike,
      tier: "HIGH",
      level: "HIGH CAUTION",
      flagLabel: "High Caution (Amber Flag)",
      color: "text-amberAlert",
      badgeColor: "text-amberAlert border-amberAlert/60 bg-amberAlert/10",
      litersPerHour: 1.00,
      volume: "1.00 L",
      volumePerHour: "1.00 L/hr",
      cupSchedule: "250 mL every 15m",
      workRestRatio: "40m Work / 20m Rest",
      shortRatio: "40m / 20m",
      shortNote: "20m Mandatory Shade",
      law: "ADOSH CoP 11.0 (High Caution)",
      note: "250 mL every 15m + Electrolyte mix."
    };
  }

  if (wbgt >= 25.9 || temp >= 34.0 || feelsLike >= 35.5) {
    return {
      wbgt,
      dewPoint,
      feelsLike,
      tier: "MODERATE",
      level: "CAUTION",
      flagLabel: "Caution (Yellow Flag)",
      color: "text-yellow-400",
      badgeColor: "text-yellow-400 border-yellow-400/50 bg-yellow-400/10",
      litersPerHour: 0.75,
      volume: "0.75 L",
      volumePerHour: "0.75 L/hr",
      cupSchedule: "250 mL every 20m",
      workRestRatio: "50m Work / 10m Rest",
      shortRatio: "50m / 10m",
      shortNote: "10m Shade / Hr",
      law: "ADOSH CoP 11.0 (Caution)",
      note: "250 mL chilled water every 20 mins."
    };
  }

  return {
    wbgt,
    dewPoint,
    feelsLike,
    tier: "LOW",
    level: "LOW RISK",
    flagLabel: "Normal (Green Flag)",
    color: "text-safetyGreen",
    badgeColor: "text-safetyGreen border-safetyGreen/50 bg-safetyGreen/10",
    litersPerHour: 0.50,
    volume: "0.50 L",
    volumePerHour: "0.50 L/hr",
    cupSchedule: "250 mL every 30m",
    workRestRatio: "50m Work / 10m Rest",
    shortRatio: "50m / 10m",
    shortNote: "Normal Shade Breaks",
    law: "ADOSH CoP 11.0 (Standard Split)",
    note: "Routine chilled water (250 mL / 30m)."
  };
}

export function getWBGTComfort(wbgt, temp = 0, apparentTemp = null) {
  if (wbgt >= 30.5 || temp >= 42.0 || (apparentTemp !== null && apparentTemp >= 43.0)) {
    return { label: "Severe Heat (Red Flag)", color: "text-amberAlert font-bold" };
  }
  if (wbgt >= 27.9 || temp >= 38.0 || (apparentTemp !== null && apparentTemp >= 39.0)) {
    return { label: "High Caution (Amber Flag)", color: "text-amberAlert" };
  }
  if (wbgt >= 25.9 || temp >= 34.0 || (apparentTemp !== null && apparentTemp >= 35.5)) {
    return { label: "Caution (Yellow Flag)", color: "text-yellow-400" };
  }
  return { label: "Normal (Green Flag)", color: "text-safetyGreen" };
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
  const feelsLike = data.apparent_temperature ?? null;
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
  
  // 1. Sustained Wind (Grounded: >=45 km/h RED Severe Gale Halt, 22-44.9 km/h AMBER Caution)
  if (windSpeed >= 45) {
    status = "RED";
    reasons.push(`Severe gale wind (${windSpeed} km/h) exceeds critical halt limit (≥45 km/h).`);
  } else if (windSpeed >= 35) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High wind caution (${windSpeed} km/h). Restrict high-altitude UAVs & adjust ballistic windage.`);
  } else if (windSpeed >= 22) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Elevated sustained wind (${windSpeed} km/h). Monitor crosswind drift.`);
  }
  
  // 2. Wind Gusts (Grounded: >=60 km/h RED Severe Gust Halt, 32-59.9 km/h AMBER Caution)
  if (windGusts >= 60) {
    status = "RED";
    reasons.push(`Severe wind gust (${windGusts} km/h) exceeds critical halt limit (≥60 km/h).`);
  } else if (windGusts >= 45) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High wind gust caution (${windGusts} km/h). Secure target rigs & loose range gear.`);
  } else if (windGusts >= 32) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Moderate wind gusts (${windGusts} km/h). Monitor lightweight equipment.`);
  }
  
  // 3. Visibility (Grounded: <0.8 km RED Critical Halt, 0.8-5.0 km AMBER Caution)
  if (visibilityKm < 0.8) {
    status = "RED";
    reasons.push(`Zero/critical visibility (${visibilityKm.toFixed(1)} km < 0.8 km) due to dense fog/sandstorm.`);
  } else if (visibilityKm <= 5) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Reduced visibility caution (${visibilityKm.toFixed(1)} km) due to haze/dust.`);
  }
  
  // 4 & 5. Unified Heat Stress & Water Intake Evaluation (ADOSH CoP 11.0 & ISO 7243 WBGT)
  // Translates thermal stress directly into required water intake (L/hr) & work/rest splits as Cautions (AMBER),
  // reserving RED Critical Halt only for extreme life-safety thermal emergency (Temp >=46°C or WBGT >=34.5°C).
  const heatStress = evaluateHeatStress(temp, rh, windSpeed, uv, data.solar_radiation ?? null, feelsLike);
  const wbgt = heatStress.wbgt;

  if (temp >= 46.0 || wbgt >= 34.5) {
    status = "RED";
    reasons.push(`Extreme Thermal Emergency (${temp.toFixed(1)}°C / WBGT ${wbgt.toFixed(1)}°C). Mandatory range stand-down & ${heatStress.volumePerHour} electrolyte hydration.`);
  } else if (heatStress.tier === "SEVERE") {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Severe Heat Stress Caution (${temp.toFixed(1)}°C / WBGT ${wbgt.toFixed(1)}°C). Enforce ${heatStress.workRestRatio} & ${heatStress.volumePerHour} (${heatStress.cupSchedule}) + Electrolytes.`);
  } else if (heatStress.tier === "HIGH") {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High Heat Stress Caution (WBGT ${wbgt.toFixed(1)}°C / Temp ${temp.toFixed(1)}°C). Enforce ${heatStress.workRestRatio} & ${heatStress.volumePerHour} (${heatStress.cupSchedule}) water intake.`);
  } else if (heatStress.tier === "MODERATE") {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Moderate Heat Caution (WBGT ${wbgt.toFixed(1)}°C). Maintain ${heatStress.volumePerHour} (${heatStress.cupSchedule}) chilled water intake.`);
  }
  
  // 6. UV Index (ADOSH Threshold: >=6 AMBER Caution)
  if (uv >= 8) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Very high UV index (${uv.toFixed(1)}). SPF 50+ & UV eye protection mandatory.`);
  } else if (uv >= 6) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High UV index (${uv.toFixed(1)}). Sunscreen & shade breaks advised.`);
  }
  
  // 7. Humidity (ADOSH Threshold: >=85% High Maritime Humidity Caution)
  if (rh >= 85) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`High coastal humidity (${rh}%). Evaporative cooling reduced — maintain ${heatStress.volumePerHour} hydration.`);
  }
  
  // 8. Precipitation (Grounded: >=5 mm/hr RED Halt, 0.1-4.9 mm/hr AMBER Caution)
  if (precip >= 5) {
    status = "RED";
    reasons.push(`Heavy storm precipitation (${precip} mm/hr). Suspend electrical & live-fire range ops.`);
  } else if (precip > 0) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Light/moderate precipitation (${precip} mm/hr) requiring surface traction caution.`);
  }
  
  // 9. Air Quality (Grounded: >=250 AQI RED, 101-249 AMBER Caution)
  if (aqi >= 250) {
    status = "RED";
    reasons.push(`Hazardous Air Quality (AQI ${aqi}). Suspend prolonged outdoor exposure.`);
  } else if (aqi >= 101) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Elevated Air Quality Caution (AQI ${aqi}). Particulate masks advised for sensitive personnel.`);
  }
  
  // 10. Dust PM10 (Grounded: >=250 RED Sandstorm Halt, 65-249 AMBER Caution)
  if (pm10 >= 250) {
    status = "RED";
    reasons.push(`Severe sandstorm dust level (${pm10} µg/m³) - Critical halt active.`);
  } else if (pm10 >= 65) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`Elevated blowing dust (${pm10} µg/m³). Protective eyewear & dust masks advised.`);
  }
  
  // 11. Lightning (WMO Code 95, 96, 99 triggers RED Critical Halt)
  if (wmo === 95 || wmo === 96 || wmo === 99) {
    status = "RED";
    reasons.push(`ACTIVE LIGHTNING AND THUNDERSTORMS (WMO ${wmo}). Evacuate range immediately!`);
  }
  
  // 12. MoHRE Statutory Midday Work Ban Check (June 15 - Sept 15, 12:30 - 15:00 GST)
  const midday = evaluateMiddayBan(data.time);
  if (midday.isActive) {
    status = "RED";
    reasons.unshift(`MoHRE MIDDAY BAN ACTIVE (${midday.countdownText}). Mandatory outdoor stand-down.`);
  } else if (midday.isUpcoming) {
    if (status !== "RED") status = "AMBER";
    reasons.push(`MoHRE Midday Work Ban upcoming (${midday.countdownText}). Prepare to transition indoors.`);
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
  
  const tempHaltHours = [];
  const tempCautionHours = [];
  const wbgtHaltHours = [];
  const wbgtCautionHours = [];
  const windHaltHours = [];
  const windCautionHours = [];
  const gustHaltHours = [];
  const gustCautionHours = [];
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

    // Check grounded thresholds:
    if (temp >= 46) {
      tempHaltHours.push(hour);
    } else if (temp >= 38) {
      tempCautionHours.push(hour);
    }
    const solarRad = hourlyData.solar_radiation ? (hourlyData.solar_radiation[idx] ?? null) : null;
    const wbgt = calculateWBGT(temp, rh, windSpeed, uv, solarRad);
    if (wbgt >= 34.5) {
      wbgtHaltHours.push(hour);
    } else if (wbgt >= 27.9) {
      wbgtCautionHours.push(hour);
    }
    if (windSpeed >= 45) {
      windHaltHours.push(hour);
    } else if (windSpeed >= 35) {
      windCautionHours.push(hour);
    }
    if (windGusts >= 60) {
      gustHaltHours.push(hour);
    } else if (windGusts >= 45) {
      gustCautionHours.push(hour);
    }
    if (uv >= 8) {
      uvBreachHours.push(hour);
    }
    if (visibilityKm < 0.8) {
      visibilityBreachHours.push(hour);
    }
    if (precip >= 5) {
      rainBreachHours.push(hour);
    }
    if (aqi >= 250) {
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
  if (tempHaltHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Extreme Heat Halt',
      timeframe: formatHourSegments(tempHaltHours)
    });
  } else if (tempCautionHours.length > 0) {
    projected.push({
      type: 'AMBER',
      metric: 'High Temp Caution',
      timeframe: formatHourSegments(tempCautionHours)
    });
  }
  if (wbgtHaltHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Extreme WBGT Halt',
      timeframe: formatHourSegments(wbgtHaltHours)
    });
  } else if (wbgtCautionHours.length > 0) {
    projected.push({
      type: 'AMBER',
      metric: 'Heat & Hydration Caution',
      timeframe: formatHourSegments(wbgtCautionHours)
    });
  }
  if (windHaltHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Severe Gale Wind Halt',
      timeframe: formatHourSegments(windHaltHours)
    });
  } else if (windCautionHours.length > 0) {
    projected.push({
      type: 'AMBER',
      metric: 'High Wind Caution',
      timeframe: formatHourSegments(windCautionHours)
    });
  }
  if (gustHaltHours.length > 0) {
    projected.push({
      type: 'RED',
      metric: 'Severe Gust Halt',
      timeframe: formatHourSegments(gustHaltHours)
    });
  } else if (gustCautionHours.length > 0) {
    projected.push({
      type: 'AMBER',
      metric: 'High Gust Caution',
      timeframe: formatHourSegments(gustCautionHours)
    });
  }
  if (uvBreachHours.length > 0) {
    projected.push({
      type: 'AMBER',
      metric: 'Very High UV Caution',
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
      metric: 'Hazardous AQI',
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

export function getClimaticAnomalyForYear(year) {
  const y = parseInt(year, 10);
  if (isNaN(y)) {
    return {
      type: 'NEUTRAL',
      name: 'Neutral Climate Baseline',
      tempOffset: 0.0,
      rhOffset: 0,
      windMultiplier: 1.0,
      dustMultiplier: 1.0,
      visOffset: 0.0
    };
  }
  
  if (y === 2023 || y === 2026 || y === 2030) {
    return {
      type: 'EL_NINO',
      name: 'El Niño Anomaly (Warmer/Drier)',
      tempOffset: 2.2,
      rhOffset: -12,
      windMultiplier: 0.85,
      dustMultiplier: 1.6,
      visOffset: -3.0
    };
  } else if (y === 2020 || y === 2021 || y === 2022 || y === 2025 || y === 2029) {
    return {
      type: 'LA_NINA',
      name: 'La Niña Anomaly (Cooler/Wetter/Windier)',
      tempOffset: -1.5,
      rhOffset: 15,
      windMultiplier: 1.25,
      dustMultiplier: 0.75,
      visOffset: 1.5
    };
  } else {
    return {
      type: 'NEUTRAL',
      name: 'Neutral Climate Baseline',
      tempOffset: 0.0,
      rhOffset: 0,
      windMultiplier: 1.0,
      dustMultiplier: 1.0,
      visOffset: 0.0
    };
  }
}


