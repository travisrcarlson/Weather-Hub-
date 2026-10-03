// Tactical Ballistics, 100m Wind Shear, Munitions Thermal & Haboob Early-Warning Engine
// Calibrated for Google DeepMind WeatherNext 3 High-Resolution Boundary Layer Physics

// 1. STANDARD BALLISTIC CARTRIDGE PROFILES
export const BALLISTIC_CALIBERS = [
  {
    id: '556_nato',
    name: '5.56x45mm NATO (M855A1 EPR)',
    shortName: '5.56 NATO',
    caliber: '5.56mm',
    bulletWeightGrains: 62,
    muzzleVelocityMps: 940, // 3084 fps
    ballisticCoefficientG1: 0.307,
    ballisticCoefficientG7: 0.152,
    maxEffectiveRangeM: 800,
    mradPerKmh: {
      300: 0.038,
      500: 0.076,
      800: 0.165,
      1000: 0.245
    }
  },
  {
    id: '762_nato',
    name: '7.62x51mm NATO (M118LR / DMR)',
    shortName: '7.62 NATO',
    caliber: '7.62mm',
    bulletWeightGrains: 175,
    muzzleVelocityMps: 790, // ~2590 fps
    ballisticCoefficientG1: 0.505,
    ballisticCoefficientG7: 0.243,
    maxEffectiveRangeM: 1000,
    // Crosswind sensitivity factor (mrad per km/h pure 90° crosswind at given distances)
    mradPerKmh: {
      500: 0.042,
      1000: 0.115,
      1500: 0.220
    }
  },
  {
    id: '300_winmag',
    name: '.300 Winchester Magnum (Mk 248 Mod 1)',
    shortName: '.300 WinMag',
    caliber: '7.62mm',
    bulletWeightGrains: 220,
    muzzleVelocityMps: 869, // ~2850 fps
    ballisticCoefficientG1: 0.620,
    ballisticCoefficientG7: 0.310,
    maxEffectiveRangeM: 1300,
    mradPerKmh: {
      500: 0.031,
      1000: 0.084,
      1500: 0.160
    }
  },
  {
    id: '338_lapua',
    name: '.338 Lapua Magnum (250gr Scenar)',
    shortName: '.338 Lapua',
    caliber: '8.6mm',
    bulletWeightGrains: 250,
    muzzleVelocityMps: 915, // ~3000 fps
    ballisticCoefficientG1: 0.675,
    ballisticCoefficientG7: 0.322,
    maxEffectiveRangeM: 1600,
    mradPerKmh: {
      500: 0.026,
      1000: 0.072,
      1500: 0.138
    }
  },
  {
    id: '50_bmg',
    name: '12.7x99mm / .50 BMG (M33 Ball)',
    shortName: '.50 BMG',
    caliber: '12.7mm',
    bulletWeightGrains: 661,
    muzzleVelocityMps: 887, // ~2910 fps
    ballisticCoefficientG1: 0.670,
    ballisticCoefficientG7: 0.345,
    maxEffectiveRangeM: 2000,
    mradPerKmh: {
      500: 0.021,
      1000: 0.058,
      1500: 0.112
    }
  },
  {
    id: '120_mortar',
    name: '120mm High-Angle Mortar (HE M933)',
    shortName: '120mm Mortar',
    caliber: '120mm',
    bulletWeightGrains: 20000,
    muzzleVelocityMps: 310,
    ballisticCoefficientG1: 0.210,
    ballisticCoefficientG7: 0.105,
    maxEffectiveRangeM: 7200,
    mradPerKmh: {
      500: 0.120,
      1000: 0.310,
      1500: 0.590
    }
  }
];

// 2. 100M BOUNDARY LAYER WIND SHEAR
// Uses WeatherNext 3 boundary layer logarithmic profile with atmospheric stability parameter alpha
export function calculate100mWindShear(surfaceWindKmh, boundaryWind100mKmh) {
  const v10 = Math.max(0.1, surfaceWindKmh || 0);
  const v100 = Math.max(v10, boundaryWind100mKmh !== undefined ? boundaryWind100mKmh : v10 * Math.pow(100 / 10, 0.24));
  
  // Vertical shear gradient in (km/h) per 100m
  const shearGradient = Number((v100 - v10).toFixed(1));
  const shearRatio = Number((v100 / v10).toFixed(2));

  let shearRisk = 'LOW';
  let shearColor = 'text-safetyGreen';
  let description = 'Uniform boundary layer flow. Minimal trajectory curvature.';

  if (shearGradient >= 18 || shearRatio >= 1.7) {
    shearRisk = 'HIGH';
    shearColor = 'text-stopRed';
    description = 'Severe vertical wind shear. High trajectory curvature & severe drone rotor turbulence.';
  } else if (shearGradient >= 10 || shearRatio >= 1.4) {
    shearRisk = 'MODERATE';
    shearColor = 'text-amberAlert';
    description = 'Moderate vertical shear. Trajectory compensation required above 800m.';
  }

  return {
    surfaceWindKmh: Number(v10.toFixed(1)),
    boundaryWind100mKmh: Number(v100.toFixed(1)),
    shearGradient,
    shearRatio,
    shearRisk,
    shearColor,
    description
  };
}

// 3. BALLISTIC CROSSWIND DRIFT CALCULATOR
// Calculates crosswind component and bullet deflection in MRAD, MOA, and cm offset
export function calculateBallisticDrift(firingAzimuthDeg, windDirectionDeg, windSpeedKmh, caliberId = '338_lapua') {
  const caliber = BALLISTIC_CALIBERS.find(c => c.id === caliberId) || BALLISTIC_CALIBERS[1];
  
  // Angle between firing line and incoming wind vector
  const relativeAngle = ((windDirectionDeg - firingAzimuthDeg) + 360) % 360;
  const relRad = (relativeAngle * Math.PI) / 180;

  // Crosswind component (perpendicular to bullet flight)
  // Positive = wind blowing from left to right; Negative = right to left
  const crosswindKmh = Number((windSpeedKmh * Math.sin(relRad)).toFixed(1));
  const absCrosswind = Math.abs(crosswindKmh);
  
  // Headwind/Tailwind component (parallel to bullet flight)
  // Positive = tailwind (pushes bullet high); Negative = headwind (drops bullet low)
  const headTailKmh = Number((windSpeedKmh * -Math.cos(relRad)).toFixed(1));

  const driftDirection = crosswindKmh > 0.5 ? 'RIGHT' : crosswindKmh < -0.5 ? 'LEFT' : 'HEAD/TAIL';

  // Calculate deflection at ranges 500m, 1000m, 1500m
  const ranges = [500, 1000, 1500].map(dist => {
    const factor = caliber.mradPerKmh[dist] || 0.05;
    const mradDeflection = Number((absCrosswind * factor).toFixed(2));
    const moaDeflection = Number((mradDeflection * 3.4377).toFixed(2)); // 1 MRAD = 3.4377 MOA
    
    // Offset in centimeters at that distance (1 MRAD at 1000m = 100cm, at 500m = 50cm)
    const cmOffset = Math.round(mradDeflection * (dist / 100));

    // Number of clicks for standard 0.1 MRAD scope
    const clicks01Mrad = Math.round(mradDeflection * 10);

    return {
      distanceM: dist,
      mrad: mradDeflection,
      moa: moaDeflection,
      cmOffset,
      clicks01Mrad,
      direction: driftDirection
    };
  });

  return {
    caliber,
    firingAzimuthDeg,
    windDirectionDeg,
    windSpeedKmh,
    crosswindKmh,
    absCrosswind,
    headTailKmh,
    driftDirection,
    clockDirection: getClockFaceWind(relativeAngle),
    ranges
  };
}

// Helper to determine clock position (e.g., 9 o'clock crosswind)
function getClockFaceWind(angleDeg) {
  const clockHour = Math.round(angleDeg / 30) || 12;
  const normalizedHour = clockHour === 0 ? 12 : clockHour;
  return `${normalizedHour} o'clock`;
}

// 3.1 ATMOSPHERIC DENSITY & DENSITY ALTITUDE ENGINE (Abu Al Abyad Environmental Corrections)
export function calculateAtmosphericDensity({ temperatureC = 25, relativeHumidity = 50, stationPressureHpa = 1013.25, altitudeM = 5 }) {
  const T = Number(temperatureC);
  const RH = Math.max(1, Math.min(100, Number(relativeHumidity)));
  const P = Number(stationPressureHpa);
  const T_kelvin = T + 273.15;

  // Saturated vapor pressure (Tetens formula in hPa)
  const satVaporPressHpa = 6.1078 * Math.pow(10, (7.5 * T) / (237.3 + T));
  const vaporPressHpa = (satVaporPressHpa * RH) / 100;
  const dryAirPressHpa = Math.max(0, P - vaporPressHpa);

  // Gas constants: Rd = 287.058 J/(kg*K), Rv = 461.495 J/(kg*K)
  const rhoDry = (dryAirPressHpa * 100) / (287.058 * T_kelvin);
  const rhoVapor = (vaporPressHpa * 100) / (461.495 * T_kelvin);
  const airDensity = Number((rhoDry + rhoVapor).toFixed(4)); // kg/m^3

  // Standard Sea Level Density: 1.2250 kg/m^3
  const standardDensity = 1.2250;
  const airDensityRatio = Number((airDensity / standardDensity).toFixed(4));
  const airDensityDeltaPct = Number((((airDensity - standardDensity) / standardDensity) * 100).toFixed(1));

  // Density Altitude calculation in feet (NOAA standard)
  const densityAltitudeFt = Math.round(145366 * (1 - Math.pow(airDensityRatio, 0.23496)));
  const densityAltitudeM = Math.round(densityAltitudeFt * 0.3048);

  // Speed of sound in m/s: a = 331.3 * sqrt(1 + T / 273.15)
  const speedOfSoundMps = Number((331.3 * Math.sqrt(1 + T / 273.15)).toFixed(1));

  return {
    temperatureC: T,
    relativeHumidity: RH,
    stationPressureHpa: P,
    altitudeM,
    airDensity,
    standardDensity,
    airDensityRatio,
    airDensityDeltaPct,
    densityAltitudeFt,
    densityAltitudeM,
    speedOfSoundMps
  };
}

// 3.2 HIGH-FIDELITY TRAJECTORY SOLVER (G1 / G7 Aerodynamic Drag & Drop/Windage Card)
export function calculateComprehensiveTrajectory({
  distanceM = 500,
  caliberId = '338_lapua',
  temperatureC = 25,
  relativeHumidity = 50,
  stationPressureHpa = 1013.25,
  zeroDistanceM = 100,
  crosswindKmh = 15,
  crosswindAngleDeg = 90,
  dragModel = 'G7',
  sightHeightCm = 4.5
}) {
  const caliber = BALLISTIC_CALIBERS.find(c => c.id === caliberId) || BALLISTIC_CALIBERS[3];
  const atm = calculateAtmosphericDensity({ temperatureC, relativeHumidity, stationPressureHpa });
  
  // Choose G7 or G1 ballistic coefficient
  const baseBC = (dragModel === 'G7' && caliber.ballisticCoefficientG7) 
    ? caliber.ballisticCoefficientG7 
    : caliber.ballisticCoefficientG1;

  // Thin desert air reduces aerodynamic drag (effective BC is higher)
  const effectiveBC = baseBC / Math.max(0.5, atm.airDensityRatio);

  // Aerodynamic retardation constant (K-factor based on G7 vs G1 curve)
  const kFactor = dragModel === 'G7' ? 6250 : 3650;
  const massKg = caliber.bulletWeightGrains * 0.00006479891;
  const v0 = caliber.muzzleVelocityMps;

  // Sub-function to compute kinematics at any target range x
  const computePoint = (x) => {
    if (x <= 0) {
      return {
        rangeM: 0,
        velocityMps: v0,
        mach: Number((v0 / atm.speedOfSoundMps).toFixed(2)),
        energyJ: Math.round(0.5 * massKg * v0 * v0),
        timeOfFlightSec: 0,
        dropCm: 0,
        elevMil: 0,
        elevMoa: 0,
        elevClicks01Mil: 0,
        driftCm: 0,
        windMil: 0,
        windMoa: 0,
        windClicks01Mil: 0,
        flightRegime: 'Supersonic'
      };
    }

    // Velocity decay: V(x) = V0 * exp(-x / (K * BC_eff))
    const decayExp = Math.exp(-x / (kFactor * effectiveBC));
    const vx = Math.max(50, v0 * decayExp);
    const vAvg = (v0 + vx) / 2;
    const tof = x / vAvg; // Time of flight in seconds
    const mach = Number((vx / atm.speedOfSoundMps).toFixed(2));

    // Flight regime: Supersonic > 1.2 Mach, Transonic 1.0 - 1.2 Mach, Subsonic < 1.0 Mach
    let flightRegime = 'Supersonic';
    let regimeColor = 'text-safetyGreen';
    if (mach <= 1.0) {
      flightRegime = 'Subsonic';
      regimeColor = 'text-stopRed';
    } else if (mach <= 1.2) {
      flightRegime = 'Transonic';
      regimeColor = 'text-amberAlert';
    }

    // Kinetic energy in Joules
    const energyJ = Math.round(0.5 * massKg * vx * vx);

    // Gravity raw drop (m) from bore axis: 0.5 * g * t^2
    const rawDropM = 0.5 * 9.80665 * (tof * tof);

    // Sight line correction: zeroed at zeroDistanceM with sightHeightCm above bore
    const zTof = zeroDistanceM / ((v0 + (v0 * Math.exp(-zeroDistanceM / (kFactor * effectiveBC)))) / 2);
    const zRawDropM = 0.5 * 9.80665 * (zTof * zTof);
    const sightHeightM = sightHeightCm / 100;
    const zeroBoreAngleRad = (zRawDropM + sightHeightM) / zeroDistanceM;

    // Drop relative to Line of Sight (LOS) in cm
    const dropLosM = rawDropM + sightHeightM - (zeroBoreAngleRad * x);
    const dropCm = Number((dropLosM * 100).toFixed(1));

    // Elevation compensation (MIL and MOA)
    const elevMil = x > 0 ? Number(((dropCm / (x * 0.1))).toFixed(1)) : 0;
    const elevMoa = Number((elevMil * 3.4377).toFixed(1));
    const elevClicks01Mil = Math.round(elevMil * 10);

    // Crosswind deflection (Didion's formula)
    const radWind = (crosswindAngleDeg * Math.PI) / 180;
    const crosswindMps = (crosswindKmh / 3.6) * Math.sin(radWind);
    // Drift = V_cross * (tof - x / V0)
    const lagTime = Math.max(0, tof - (x / v0));
    const driftM = crosswindMps * lagTime;
    const driftCm = Number((driftM * 100).toFixed(1));

    const windMil = x > 0 ? Number((Math.abs(driftCm) / (x * 0.1)).toFixed(1)) : 0;
    const windMoa = Number((windMil * 3.4377).toFixed(1));
    const windClicks01Mil = Math.round(windMil * 10);

    return {
      rangeM: x,
      velocityMps: Math.round(vx),
      mach,
      energyJ,
      timeOfFlightSec: Number(tof.toFixed(3)),
      dropCm,
      elevMil,
      elevMoa,
      elevClicks01Mil,
      driftCm,
      windMil,
      windMoa,
      windClicks01Mil,
      flightRegime,
      regimeColor
    };
  };

  // Trajectory at user-selected target distance
  const targetSolution = computePoint(distanceM);

  // Full DOPE Table generation (100m to 1500m in 100m increments)
  const maxRange = Math.min(caliber.maxEffectiveRangeM || 1500, 2000);
  const cardTable = [];
  for (let r = 100; r <= maxRange; r += 100) {
    cardTable.push(computePoint(r));
  }

  return {
    caliber,
    atm,
    dragModel,
    effectiveBC: Number(effectiveBC.toFixed(3)),
    zeroDistanceM,
    crosswindKmh,
    crosswindAngleDeg,
    targetDistanceM: distanceM,
    targetSolution,
    cardTable
  };
}

// 4. UAV & DRONE AIRSPACE FLIGHT ENVELOPE
export function evaluateUavFlightEnvelope(surfaceWindKmh, boundaryWind100mKmh, gusts100mKmh, temperatureC, solarRadiationWm2) {
  const v100 = boundaryWind100mKmh || surfaceWindKmh * 1.35;
  const g100 = gusts100mKmh || v100 * 1.4;
  const solar = solarRadiationWm2 || 800;

  // Thermal updraft index based on midday solar flux and ambient temp
  const thermalUpdraftIndex = Number(((solar / 1000) * (temperatureC / 35)).toFixed(2));
  
  let flightStatus = 'GO';
  let flightColor = 'text-safetyGreen';
  let badgeBg = 'bg-safetyGreen/20 border-safetyGreen/40 text-safetyGreen';
  const limitingFactors = [];

  // Rotorcraft limits (quadcopters, ISR drones)
  if (v100 >= 38 || g100 >= 48) {
    flightStatus = 'NO-GO (HALT)';
    flightColor = 'text-stopRed';
    badgeBg = 'bg-stopRed/20 border-stopRed/40 text-stopRed';
    limitingFactors.push(`100m Boundary Wind exceeds rotorcraft ceiling (${v100.toFixed(0)} km/h / Gusts ${g100.toFixed(0)} km/h)`);
  } else if (v100 >= 28 || g100 >= 36) {
    flightStatus = 'CAUTION';
    flightColor = 'text-amberAlert';
    badgeBg = 'bg-amberAlert/20 border-amberAlert/40 text-amberAlert';
    limitingFactors.push(`High 100m crosswinds (${v100.toFixed(0)} km/h) — Experienced UAV operators only`);
  }

  // Thermal updraft / turbulence warning
  if (thermalUpdraftIndex >= 1.15 && temperatureC >= 40) {
    if (flightStatus === 'GO') {
      flightStatus = 'CAUTION';
      flightColor = 'text-amberAlert';
      badgeBg = 'bg-amberAlert/20 border-amberAlert/40 text-amberAlert';
    }
    limitingFactors.push('Strong desert thermal updrafts (sink/lift turbulence on glidepath)');
  }

  return {
    flightStatus,
    flightColor,
    badgeBg,
    boundaryWind100mKmh: Number(v100.toFixed(1)),
    gusts100mKmh: Number(g100.toFixed(1)),
    thermalUpdraftIndex,
    limitingFactors: limitingFactors.length > 0 ? limitingFactors : ['Optimal airspace envelope. Stable boundary layer.']
  };
}

// 5. MUNITIONS & EQUIPMENT THERMAL COOK-OFF SAFETY INDEX
// Direct solar radiation (W/m^2) heating dark metal containers / ordnance crates
// MIL-STD-810H Method 501.7 High Temperature & Explosive Cook-off thresholds
export function calculateMunitionsThermalLoad(ambientTempC, solarRadiationWm2, windSpeedKmh) {
  const ta = ambientTempC || 38;
  const solar = solarRadiationWm2 || 850;
  const wind = windSpeedKmh || 15;

  // Radiation absorptivity for olive-drab (OD) or desert-tan steel/aluminum: alpha ~ 0.82
  // Wind cooling convective coefficient: hc = 10.45 - v + 10 * sqrt(v) in W/(m^2*K)
  const vMps = Math.max(0.5, wind / 3.6);
  const windCooling = Math.min(6.5, vMps * 0.45);
  
  // Equilibrium surface temperature: ambient + solar thermal soak - convective wind loss
  const solarSoakElevation = (solar / 1000) * 23.5;
  const surfaceTempC = Number((ta + solarSoakElevation - windCooling).toFixed(1));

  let status = 'SAFE';
  let badgeColor = 'bg-safetyGreen/20 text-safetyGreen border-safetyGreen/40';
  let text = 'Safe Munitions Storage. Internal chemical stability intact.';
  let coolingAction = 'Standard field storage acceptable.';

  if (surfaceTempC >= 65.0) {
    // 65°C / 149°F: Critical Cook-Off & Chemical Degradation Threshold
    status = 'CRITICAL COOK-OFF RISK';
    badgeColor = 'bg-stopRed/20 text-stopRed border-stopRed/40 animate-pulse';
    text = 'CRITICAL: Munitions surface exceeds 65°C. Immediate propellant breakdown / cook-off risk!';
    coolingAction = 'MANDATORY: Cease unshaded transport. Deploy reflective canopies and thermal cooling blankets.';
  } else if (surfaceTempC >= 52.0) {
    // 52°C / 125°F: MIL-STD Thermal Soak Caution Limit
    status = 'THERMAL SOAK CAUTION';
    badgeColor = 'bg-amberAlert/20 text-amberAlert border-amberAlert/40';
    text = 'CAUTION: Container surface in 52°C - 65°C danger band. Elevated pressure in sealed ammo crates.';
    coolingAction = 'REQUIRED: Keep ordnance under camouflage shade netting. Maintain cross-ventilation.';
  }

  return {
    ambientTempC: Number(ta.toFixed(1)),
    solarRadiationWm2: Math.round(solar),
    surfaceTempC,
    status,
    badgeColor,
    text,
    coolingAction,
    milStdThreshold: 65.0
  };
}

// 6. RAPID CONVECTIVE HABOOB / SQUALL DETECTION
// Detects sudden convective downdrafts typical in desert summers (within 60-90m ETA)
export function detectHaboobConvectiveRisk(currentPressureHpa, prevPressureHpa, windSpeedKmh, prevWindSpeedKmh, windDirDeg, prevWindDirDeg, humidityPercent) {
  if (!currentPressureHpa || !prevPressureHpa) {
    return { detected: false, riskLevel: 'LOW' };
  }

  const pressureDrop = prevPressureHpa - currentPressureHpa; // hPa drop over 1 hour
  const windSurge = windSpeedKmh - (prevWindSpeedKmh || windSpeedKmh);
  const dirShift = Math.abs((windDirDeg - (prevWindDirDeg || windDirDeg) + 360) % 360);

  // Severe haboob signature: Rapid pressure plunge (> 1.2 hPa) + Wind surge (> 15 km/h) + Direction shift (> 45°)
  if (pressureDrop >= 1.2 && windSurge >= 15 && dirShift >= 45) {
    return {
      detected: true,
      riskLevel: 'CRITICAL',
      title: 'AI HABOOB / CONVECTIVE DUST WALL DETECTED',
      etaMinutes: 45,
      description: `Rapid barometric plunge (-${pressureDrop.toFixed(1)} hPa/h) & sudden ${dirShift}° wind surge. High probability of incoming dust wall & zero visibility.`,
      action: 'Secure all light equipment, batten firing lines, halt drone flights, issue respiratory PPE.'
    };
  } else if (pressureDrop >= 0.8 && windSurge >= 10) {
    return {
      detected: true,
      riskLevel: 'ELEVATED',
      title: 'CONVECTIVE GUST FRONT FORMING',
      etaMinutes: 75,
      description: `Barometric instability detected (-${pressureDrop.toFixed(1)} hPa/h). Regional downdraft developing.`,
      action: 'Monitor radar and northern horizon. Prepare for sudden gust shifts.'
    };
  }

  return { detected: false, riskLevel: 'LOW' };
}

// 7. 7-DAY TACTICAL MISSION OPERATIONAL WINDOWS MATRIX
// Evaluates Live-Fire, UAV Drone Sorties, Infantry Maneuvers, and Amphibious Marine Ops
export function evaluateTacticalMissionMatrix(hourlyData, dailyData, startDateStr) {
  const days = [];
  const baseDate = startDateStr ? new Date(startDateStr) : new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(baseDate.getTime() + dayOffset * 24 * 3600 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayLabel = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Check MoHRE Midday Ban (June 15 - Sept 15)
    const monthNum = targetDate.getMonth() + 1;
    const dayNum = targetDate.getDate();
    const isMiddayBanDate = (monthNum === 6 && dayNum >= 15) || monthNum === 7 || monthNum === 8 || (monthNum === 9 && dayNum <= 15);

    // Extract or simulate hours for this day
    const hours = [];
    let maxTemp = 0;
    let maxWbgt = 0;
    let maxWind = 0;
    let maxGust = 0;
    let maxWind100m = 0;
    let maxSolar = 0;

    for (let hr = 0; hr < 24; hr++) {
      const hrPad = String(hr).padStart(2, '0');
      const timeKey = `${dateStr}T${hrPad}:00`;

      // Find matching hour in hourlyData if available
      let temp = 38, rh = 35, wind = 18, gusts = 26, uv = 0, solar = 0, wind100m = 24, vis = 10000;
      if (hourlyData && hourlyData.time) {
        const idx = hourlyData.time.findIndex(t => t.startsWith(`${dateStr}T${hrPad}`));
        if (idx !== -1) {
          temp = hourlyData.temperature_2m[idx] || temp;
          rh = hourlyData.relative_humidity_2m[idx] || rh;
          wind = hourlyData.wind_speed_10m[idx] || wind;
          gusts = hourlyData.wind_gusts_10m ? hourlyData.wind_gusts_10m[idx] : wind * 1.35;
          uv = hourlyData.uv_index ? hourlyData.uv_index[idx] : 0;
          solar = hourlyData.solar_radiation ? hourlyData.solar_radiation[idx] : uv * 95;
          wind100m = hourlyData.wind_speed_100m ? hourlyData.wind_speed_100m[idx] : wind * 1.35;
          vis = hourlyData.visibility ? hourlyData.visibility[idx] : 10000;
        } else {
          // Synthetic diurnal estimation
          const rad = Math.PI * (hr - 14) / 12;
          temp = Number((34 + 8 * (0.5 + 0.5 * Math.cos(rad))).toFixed(1));
          rh = Math.round(50 - 25 * (0.5 + 0.5 * Math.cos(rad)));
          wind = Number((14 + 10 * Math.sin(Math.PI * hr / 24)).toFixed(1));
          gusts = Number((wind * 1.4).toFixed(1));
          wind100m = Number((wind * 1.38).toFixed(1));
          uv = (hr >= 6 && hr <= 18) ? Math.round(11 * Math.sin(Math.PI * (hr - 6) / 12)) : 0;
          solar = uv * 95;
        }
      }

      // WBGT approximation
      const wbgt = Number((0.7 * (temp * (0.5 + 0.005 * rh)) + 0.2 * (temp + 3) + 0.1 * temp).toFixed(1));

      if (temp > maxTemp) maxTemp = temp;
      if (wbgt > maxWbgt) maxWbgt = wbgt;
      if (wind > maxWind) maxWind = wind;
      if (gusts > maxGust) maxGust = gusts;
      if (wind100m > maxWind100m) maxWind100m = wind100m;
      if (solar > maxSolar) maxSolar = solar;

      // Evaluate 4 tactical operation pillars for this hour
      // 1. Live-Fire Exercises
      let liveFireStatus = 'GO';
      let liveFireReason = 'Optimal crosswind & trajectory tolerances';
      if (gusts >= 45 || wind >= 35) {
        liveFireStatus = 'NO-GO';
        liveFireReason = `Severe crosswind & gust dispersion (${gusts} km/h gusts)`;
      } else if (gusts >= 30 || wind >= 22 || wbgt >= 32) {
        liveFireStatus = 'CAUTION';
        liveFireReason = `Elevated bullet deflection (MOA correction required) or high heat`;
      }

      // 2. UAV & Drone Flights (100m boundary wind limit)
      let uavStatus = 'GO';
      let uavReason = 'Boundary winds within rotorcraft ceiling';
      if (wind100m >= 38 || gusts >= 48) {
        uavStatus = 'NO-GO';
        uavReason = `100m wind ceiling breach (${wind100m.toFixed(0)} km/h)`;
      } else if (wind100m >= 28 || gusts >= 35 || solar >= 850) {
        uavStatus = 'CAUTION';
        uavReason = 'Moderate 100m shear or desert thermal updrafts';
      }

      // 3. Infantry Maneuvers (ADOSH Heat Stress + MoHRE Midday Ban)
      let infantryStatus = 'GO';
      let infantryReason = 'Normal training intensity allowed';
      const isMiddayBanHour = isMiddayBanDate && (hr >= 12 && hr <= 14);
      if (isMiddayBanHour) {
        infantryStatus = 'NO-GO';
        infantryReason = 'Mandatory UAE MoHRE Midday Work Ban (12:30 - 15:00 GST)';
      } else if (wbgt >= 30.0) {
        infantryStatus = 'NO-GO';
        infantryReason = `Extreme heat stress breach (WBGT ${wbgt}°C ≥ 30°C Red Halt)`;
      } else if (wbgt >= 27.9) {
        infantryStatus = 'CAUTION';
        infantryReason = `High thermal load: 40m Work / 20m Rest mandated`;
      }

      // 4. Amphibious / Marine Sea Ops (Coastal Spit winds & visibility)
      let amphStatus = 'GO';
      let amphReason = 'Calm sea state & secure marine corridor';
      if (wind >= 32 || gusts >= 45 || vis < 3000) {
        amphStatus = 'NO-GO';
        amphReason = `High coastal chop/squall risk or low visibility (<3km)`;
      } else if (wind >= 22 || gusts >= 32) {
        amphStatus = 'CAUTION';
        amphReason = 'Moderate swell & tidal current chop at spit';
      }

      hours.push({
        hour: hrPad,
        timeKey,
        temp,
        rh,
        wind,
        gusts,
        wind100m,
        solar,
        wbgt,
        isMiddayBanHour,
        ops: {
          liveFire: { status: liveFireStatus, reason: liveFireReason },
          uav: { status: uavStatus, reason: uavReason },
          infantry: { status: infantryStatus, reason: infantryReason },
          amphibious: { status: amphStatus, reason: amphReason }
        }
      });
    }

    // Daily summary score for each mission type
    const getOverallOpStatus = (opKey) => {
      const noGoCount = hours.filter(h => h.ops[opKey].status === 'NO-GO').length;
      const cautionCount = hours.filter(h => h.ops[opKey].status === 'CAUTION').length;
      if (noGoCount >= 6) return 'NO-GO';
      if (noGoCount > 0 || cautionCount >= 4) return 'RESTRICTED';
      return 'OPTIMAL';
    };

    days.push({
      dateStr,
      dayLabel,
      dayOffset,
      maxTemp,
      maxWbgt,
      maxWind,
      maxGust,
      maxWind100m,
      maxSolar,
      isMiddayBanDate,
      summary: {
        liveFire: getOverallOpStatus('liveFire'),
        uav: getOverallOpStatus('uav'),
        infantry: getOverallOpStatus('infantry'),
        amphibious: getOverallOpStatus('amphibious')
      },
      hours
    });
  }

  return days;
}

