import axios from 'axios';

const LAT = 24.20;
const LON = 52.78;
const TIMEZONE = 'Asia/Dubai';

// ==========================================================
// FUTURE UAE NCM (NATIONAL CENTER OF METEOROLOGY) API CONFIG
// ==========================================================
// Set USE_NCM_API to true and specify your credentials when access is obtained.
const USE_NCM_API = false;
const NCM_API_KEY = '';
const NCM_API_URL = 'https://api.ncm.gov.ae/v1/forecast'; // Future NCM URL

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Future UAE NCM API Integration Handler
async function fetchNCMData() {
  try {
    console.log("UAE NCM API mode enabled. Simulating integration...");
    
    // Future API call syntax:
    // const res = await axios.get(NCM_API_URL, {
    //   headers: { 'Authorization': `Bearer ${NCM_API_KEY}` },
    //   params: { latitude: LAT, longitude: LON }
    // });
    // const weatherData = res.data;
    
    // Return mock structured dataset matching dashboard expectations to prevent UI breakages
    const mockNcmData = {
      latitude: LAT,
      longitude: LON,
      timezone: TIMEZONE,
      current: {
        time: new Date().toISOString().slice(0, 16),
        temperature_2m: 42.0,
        apparent_temperature: 44.5,
        relative_humidity_2m: 18,
        wind_speed_10m: 22.0,
        wind_direction_10m: 260,
        wind_gusts_10m: 30.0,
        weathercode: 0,
        visibility: 12000,
        precipitation: 0.0,
        cloud_cover: 10,
        pressure_msl: 1008.5,
        uv_index: 10.0,
        european_aqi: 55,
        pm2_5: 20.2,
        pm10: 45.1
      },
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => {
          const d = new Date();
          d.setHours(i, 0, 0, 0);
          return d.toISOString().slice(0, 16);
        }),
        temperature_2m: [29, 28, 27, 27, 28, 28, 31, 33, 36, 38, 40, 41, 42, 42, 42, 41, 40, 39, 38, 36, 34, 32, 30, 29],
        apparent_temperature: [31, 30, 29, 29, 30, 30, 33, 35, 38, 40, 42, 43, 44, 44, 44, 43, 42, 41, 40, 38, 36, 34, 32, 31],
        relative_humidity_2m: [50, 52, 55, 58, 55, 52, 48, 42, 38, 33, 28, 22, 18, 18, 18, 20, 22, 28, 33, 38, 42, 48, 50, 52],
        weathercode: Array(24).fill(0),
        precipitation_probability: Array(24).fill(0),
        wind_speed_10m: [12, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 23, 22, 21, 20, 18, 16, 14, 12, 11, 10, 9, 9, 10],
        wind_direction_10m: Array(24).fill(260),
        wind_gusts_10m: [16, 13, 14, 16, 17, 18, 22, 25, 28, 30, 33, 31, 30, 29, 28, 25, 22, 18, 16, 14, 13, 12, 12, 13],
        uv_index: [0, 0, 0, 0, 0, 1, 3, 6, 8, 10, 11, 11, 10, 9, 7, 5, 3, 1, 0, 0, 0, 0, 0, 0],
        pressure_msl: Array(24).fill(1008.5),
        visibility: Array(24).fill(12000),
        cloud_cover: Array(24).fill(10),
        european_aqi: Array(24).fill(55),
        pm2_5: Array(24).fill(20.2),
        pm10: Array(24).fill(45.1)
      },
      daily: {
        time: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return d.toISOString().slice(0, 10);
        }),
        weathercode: [0, 0, 1, 2, 1, 0, 0],
        temperature_2m_max: [42, 43, 41, 40, 42, 43, 44],
        temperature_2m_min: [29, 28, 27, 26, 28, 29, 30],
        wind_gusts_10m_max: [30, 32, 28, 25, 28, 35, 40],
        sunrise: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return `${d.toISOString().slice(0, 10)}T05:30`;
        }),
        sunset: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return `${d.toISOString().slice(0, 10)}T19:05`;
        })
      },
      ncmWarnings: []
    };

    mockNcmData.ncmWarnings = generateMockNcmWarnings(mockNcmData.current);

    const mockMeta = {
      weather: {
        url: NCM_API_URL,
        params: { latitude: LAT, longitude: LON },
        status: 'OK',
        statusCode: 200,
        latency: 45,
        lastPing: new Date().toISOString(),
        payload: { source: 'UAE NCM API (Future Placeholder)' }
      },
      aqi: {
        url: NCM_API_URL + '/aqi',
        params: { latitude: LAT, longitude: LON },
        status: 'OK',
        statusCode: 200,
        latency: 35,
        lastPing: new Date().toISOString(),
        payload: { source: 'UAE NCM API (Future Placeholder)' }
      }
    };

    return {
      mergedData: mockNcmData,
      meta: mockMeta
    };
  } catch (error) {
    console.error('Error in future NCM API integration handler:', error);
    throw error;
  }
}

// UAE NCM Warnings Mock Generator
export function generateMockNcmWarnings(currentData) {
  const warnings = [];
  if (!currentData) return warnings;

  const temp = currentData.temperature_2m || 0;
  const wind = currentData.wind_speed_10m || 0;
  const visibility = currentData.visibility || 10000;
  const pm10 = currentData.pm10 || 0;

  // 1. Heat Warnings
  if (temp >= 43) {
    warnings.push({
      id: "ncm-w-heat-red",
      type: "RED",
      category: "HEAT",
      title: "EXTREME HEAT EMERGENCY",
      description: "Official NCM Warning: Extreme heatwave conditions with temperatures exceeding 43°C. Avoid direct sunlight. Suspend all outdoor range activities.",
      issued: new Date().toISOString().slice(0, 10) + "T09:00:00+04:00",
      expiry: new Date().toISOString().slice(0, 10) + "T17:00:00+04:00"
    });
  } else if (temp >= 38) {
    warnings.push({
      id: "ncm-w-heat-amber",
      type: "AMBER",
      category: "HEAT",
      title: "HEAT ADVISORY",
      description: "Official NCM Advisory: High temperatures exceeding 38°C. Implement mandatory rest cycles and hydration procedures.",
      issued: new Date().toISOString().slice(0, 10) + "T10:00:00+04:00",
      expiry: new Date().toISOString().slice(0, 10) + "T16:00:00+04:00"
    });
  }

  // 2. Wind Warnings
  if (wind >= 38) {
    warnings.push({
      id: "ncm-w-wind-red",
      type: "RED",
      category: "WIND",
      title: "GALE WARNING",
      description: "Official NCM Warning: Severe gale winds exceeding 38 km/h with high gusts. Suspend all ballistics and drone operations.",
      issued: new Date().toISOString().slice(0, 10) + "T08:00:00+04:00",
      expiry: new Date().toISOString().slice(0, 10) + "T20:00:00+04:00"
    });
  } else if (wind >= 25) {
    warnings.push({
      id: "ncm-w-wind-yellow",
      type: "YELLOW",
      category: "WIND",
      title: "STRONG WIND AWARENESS",
      description: "Official NCM Alert: Strong winds up to 30 km/h expected to cause blowing sand and dust. Reduce speeds and exercise caution.",
      issued: new Date().toISOString().slice(0, 10) + "T08:00:00+04:00",
      expiry: new Date().toISOString().slice(0, 10) + "T18:00:00+04:00"
    });
  }

  // 3. Sandstorm / Visibility Warnings
  if (visibility < 1000 || pm10 >= 155) {
    warnings.push({
      id: "ncm-w-dust-red",
      type: "RED",
      category: "DUST",
      title: "SEVERE DUST STORM WARNING",
      description: "Official NCM Warning: Severe dust storm causing horizontal visibility to drop below 1000 meters. Halt range movement and secure equipment.",
      issued: new Date().toISOString().slice(0, 10) + "T07:30:00+04:00",
      expiry: new Date().toISOString().slice(0, 10) + "T15:30:00+04:00"
    });
  } else if (visibility < 4000) {
    warnings.push({
      id: "ncm-w-dust-amber",
      type: "AMBER",
      category: "DUST",
      title: "BLOWING DUST ADVISORY",
      description: "Official NCM Alert: Dust suspension causing visibility between 1km and 4km. Avoid long-exposure outdoor duties.",
      issued: new Date().toISOString().slice(0, 10) + "T08:00:00+04:00",
      expiry: new Date().toISOString().slice(0, 10) + "T16:00:00+04:00"
    });
  }

  return warnings;
}

export async function fetchDashboardData() {
  if (USE_NCM_API) {
    return fetchNCMData();
  }
  try {
    const weatherParams = {
      latitude: LAT,
      longitude: LON,
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'weathercode',
        'visibility',
        'precipitation',
        'cloud_cover',
        'pressure_msl',
        'uv_index'
      ].join(','),
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation_probability',
        'weathercode',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'uv_index',
        'pressure_msl',
        'visibility',
        'cloud_cover'
      ].join(','),
      daily: [
        'weathercode',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'sunrise',
        'sunset'
      ].join(','),
      timezone: TIMEZONE,
      wind_speed_unit: 'kmh',
      forecast_days: 7
    };

    const aqiParams = {
      latitude: LAT,
      longitude: LON,
      current: 'european_aqi,pm2_5,pm10',
      hourly: 'european_aqi,pm2_5,pm10',
      timezone: TIMEZONE
    };

    const fetchWeather = async () => {
      const start = performance.now();
      const res = await axios.get(WEATHER_URL, { params: weatherParams });
      const end = performance.now();
      return {
        res,
        latency: Math.round(end - start)
      };
    };

    const fetchAqi = async () => {
      const start = performance.now();
      const res = await axios.get(AQI_URL, { params: aqiParams });
      const end = performance.now();
      return {
        res,
        latency: Math.round(end - start)
      };
    };

    // Perform API calls concurrently
    const [weatherResult, aqiResult] = await Promise.all([
      fetchWeather(),
      fetchAqi()
    ]);

    const weatherData = weatherResult.res.data;
    const aqiData = aqiResult.res.data;

    // Merge current weather and air quality parameters
    const mergedData = {
      latitude: LAT,
      longitude: LON,
      timezone: TIMEZONE,
      current: {
        ...weatherData.current,
        ...aqiData.current
      },
      hourly: {
        ...weatherData.hourly,
        european_aqi: aqiData.hourly ? aqiData.hourly.european_aqi : null,
        pm2_5: aqiData.hourly ? aqiData.hourly.pm2_5 : null,
        pm10: aqiData.hourly ? aqiData.hourly.pm10 : null
      },
      daily: weatherData.daily,
      ncmWarnings: generateMockNcmWarnings({
        ...weatherData.current,
        ...aqiData.current
      })
    };

    const meta = {
      weather: {
        url: WEATHER_URL,
        params: weatherParams,
        status: 'OK',
        statusCode: weatherResult.res.status,
        latency: weatherResult.latency,
        lastPing: new Date().toISOString(),
        payload: weatherData
      },
      aqi: {
        url: AQI_URL,
        params: aqiParams,
        status: 'OK',
        statusCode: aqiResult.res.status,
        latency: aqiResult.latency,
        lastPing: new Date().toISOString(),
        payload: aqiData
      }
    };

    return {
      mergedData,
      meta
    };
  } catch (error) {
    console.error('Error fetching weather dashboard data:', error);
    throw error;
  }
}

