/**
 * SOC 2 Trust Services Criteria Security, Cryptography, Validation & Privacy Controls
 * Implements:
 * - FIPS 180-4 SHA-256 (synchronous deterministic 256-bit cryptographic digest) [CC7.2 / PI1.4]
 * - Salted passcode hashing, brute-force rate-limiting & 15m idle session expiry [CC6.1 / CC6.2]
 * - HTML, <script>-JSON & CSV formula-injection sanitization [CC6.6 / PI1.3]
 * - HTTPS & SSRF private-network blocking for outbound webhooks [CC6.6 / CC9.2]
 * - Personnel PII masking & 30-day retention pruning [P1.1 / P3.1 / P4.2 / C1.1]
 * - Inbound meteorological telemetry schema & physical-bounds clamping [PI1.2]
 */

// FIPS 180-4 SHA-256 Round Constants (first 32 bits of fractional parts of cube roots of first 64 primes)
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const SHA256_H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

function rotr32(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function utf8ToBytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(str ?? ''));
  }
  const s = unescape(encodeURIComponent(String(str ?? '')));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Computes a standard FIPS 180-4 256-bit SHA-256 hex digest synchronously.
 */
export function sha256Hex(input) {
  const msg = utf8ToBytes(input);
  const bitLenHi = Math.floor((msg.length * 8) / 0x100000000);
  const bitLenLo = (msg.length * 8) >>> 0;

  // Pad: append 0x80, then zeros until length === 56 (mod 64), then 64-bit big-endian bit length
  const paddedLen = (((msg.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLen);
  padded.set(msg);
  padded[msg.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, bitLenHi, false);
  view.setUint32(paddedLen - 4, bitLenLo, false);

  const H = new Uint32Array(SHA256_H0);
  const W = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(W[i - 15], 7) ^ rotr32(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr32(W[i - 2], 17) ^ rotr32(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += H[i].toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * Constant-time string comparison to mitigate timing side channels.
 */
export function timingSafeEqualStr(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) {
    diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Multi-round salted SHA-256 passcode derivation (2,048 rounds).
 * Precomputed default verifier corresponds to initial RSO passcode without storing plaintext in localStorage.
 */
const DEFAULT_ADMIN_SALT = 'xrange-omab-rso-v2';
// Precomputed 2,048-round salted SHA-256 digest for initial RSO passcode ('Freya2026')
export const DEFAULT_PASSCODE_RECORD = (() => {
  // Computed once at module load from salt + rounds; custom rotations replace this record completely.
  let digest = sha256Hex(`${DEFAULT_ADMIN_SALT}:Freya2026`);
  for (let i = 1; i < 2048; i++) {
    digest = sha256Hex(`${DEFAULT_ADMIN_SALT}:${i}:${digest}`);
  }
  return `sha256$2048$${DEFAULT_ADMIN_SALT}$${digest}`;
})();

export function createSaltedPasscodeRecord(plainPasscode, customSalt = null) {
  const trimmed = String(plainPasscode ?? '').trim();
  let salt = customSalt;
  if (!salt) {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(12);
      crypto.getRandomValues(buf);
      salt = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
    } else {
      salt = `salt-${Date.now().toString(36)}`;
    }
  }
  let digest = sha256Hex(`${salt}:${trimmed}`);
  for (let i = 1; i < 2048; i++) {
    digest = sha256Hex(`${salt}:${i}:${digest}`);
  }
  return `sha256$2048$${salt}$${digest}`;
}

export function verifyPasscodeRecord(candidatePasscode, storedRecord) {
  const trimmed = String(candidatePasscode ?? '').trim();
  if (!trimmed || !storedRecord) return false;

  const parts = String(storedRecord).split('$');
  if (parts.length !== 4 || parts[0] !== 'sha256') {
    return false;
  }
  const rounds = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!rounds || rounds < 1 || rounds > 20000 || !salt || !expectedHex) return false;

  let digest = sha256Hex(`${salt}:${trimmed}`);
  for (let i = 1; i < rounds; i++) {
    digest = sha256Hex(`${salt}:${i}:${digest}`);
  }
  return timingSafeEqualStr(digest, expectedHex);
}

// --- BRUTE-FORCE RATE LIMITER & IDLE SESSION TIMEOUT [CC6.1] ---

export const AUTH_MAX_ATTEMPTS = 5;
export const AUTH_BASE_LOCKOUT_MS = 60 * 1000; // 60s initial lockout, exponential up to 15m
export const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity auto-lock

export function evaluateLockoutState(rawState, nowMs = Date.now()) {
  const state = rawState && typeof rawState === 'object'
    ? rawState
    : { failedAttempts: 0, lockedUntilMs: 0, lockoutStrikes: 0 };

  const lockedUntilMs = Number(state.lockedUntilMs) || 0;
  const isLocked = lockedUntilMs > nowMs;
  const remainingSeconds = isLocked ? Math.ceil((lockedUntilMs - nowMs) / 1000) : 0;

  return {
    failedAttempts: Number(state.failedAttempts) || 0,
    lockedUntilMs,
    lockoutStrikes: Number(state.lockoutStrikes) || 0,
    isLocked,
    remainingSeconds
  };
}

export function computeNextFailureState(rawState, nowMs = Date.now()) {
  const cur = evaluateLockoutState(rawState, nowMs);
  const failedAttempts = cur.failedAttempts + 1;
  if (failedAttempts >= AUTH_MAX_ATTEMPTS) {
    const strikes = cur.lockoutStrikes + 1;
    const durationMs = Math.min(15 * 60 * 1000, AUTH_BASE_LOCKOUT_MS * Math.pow(2, strikes - 1));
    return {
      failedAttempts: 0,
      lockoutStrikes: strikes,
      lockedUntilMs: nowMs + durationMs,
      justLockedOut: true,
      lockoutSeconds: Math.ceil(durationMs / 1000)
    };
  }
  return {
    failedAttempts,
    lockoutStrikes: cur.lockoutStrikes,
    lockedUntilMs: 0,
    justLockedOut: false,
    attemptsRemaining: AUTH_MAX_ATTEMPTS - failedAttempts
  };
}

// --- OUTPUT ENCODING & INJECTION PREVENTION [CC6.6 / PI1.3] ---

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapes untrusted strings prior to HTML interpolation in PDF/Word/Print views.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

/**
 * Safely serializes data for embedding inside an HTML <script> block without </script> breakout.
 */
export function safeJsonForScript(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Sanitizes a single CSV cell against spreadsheet formula injection (=, +, -, @, tab, CR)
 * while preserving legitimate negative numbers (e.g., -1.5) and escaping quotes/commas.
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  let str = String(value).replace(/\r?\n/g, ' ');
  const isSafeSignedNumber = /^[+-]?\d+(\.\d+)?%?$/.test(str.trim());
  if (!isSafeSignedNumber && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// --- WEBHOOK TLS & SSRF VALIDATION [CC6.6 / CC9.2] ---

function isPrivateOrLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase().trim();
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '[::1]' ||
    host === '::1'
  ) {
    return true;
  }

  // IPv6 ULA (fc00::/7) and link-local (fe80::/10)
  const bareIpv6 = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (bareIpv6.includes(':')) {
    if (
      bareIpv6 === '::1' ||
      bareIpv6 === '::' ||
      /^f[cd][0-9a-f]{2}:/i.test(bareIpv6) ||
      /^fe[89ab][0-9a-f]:/i.test(bareIpv6)
    ) {
      return true;
    }
  }

  // IPv4 dotted quad checks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, o1, o2] = ipv4Match.map(Number);
    if (o1 === 0 || o1 === 10 || o1 === 127) return true;
    if (o1 === 169 && o2 === 254) return true; // Cloud IMDS link-local
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true; // CGNAT
  }
  return false;
}

/**
 * Validates that a webhook endpoint uses HTTPS and does not target loopback, RFC1918, or cloud metadata IPs.
 */
export function validateWebhookEndpoint(urlStr) {
  const trimmed = String(urlStr ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Webhook URL is required.' };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed Webhook URL.' };
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'SOC 2 Transport Policy: Webhook URL must use https://.' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Embedded credentials in Webhook URL are prohibited.' };
  }
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    return { valid: false, error: 'SSRF Protection: Loopback, private-network, and metadata hosts are blocked.' };
  }
  return { valid: true, normalizedUrl: parsed.toString() };
}

// --- PII MASKING & RETENTION CONTROLS [P1.1 / P4.2 / C1.1] ---

/**
 * Masks phone PII for unauthenticated viewers (e.g. "+971 50 123 4567" -> "+971 •• ••• 4567").
 */
export function maskPhonePii(phone) {
  const raw = String(phone ?? '').trim();
  if (!raw) return 'REDACTED';
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  const prefix = raw.startsWith('+') ? `+${digits.slice(0, Math.min(3, digits.length - 4))} ` : '';
  const last4 = digits.slice(-4);
  return `${prefix}•• ••• ${last4}`;
}

/**
 * Masks API keys / secrets in UI displays (e.g. "AIza••••9f2A").
 */
export function maskSecretKey(secret) {
  const raw = String(secret ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 8) return '••••••••';
  return `${raw.slice(0, 4)}${'•'.repeat(8)}${raw.slice(-4)}`;
}

export const BROADCAST_RETENTION_DAYS = 30;

/**
 * Prunes broadcast history records older than maxAgeDays (default 30 days) for SOC 2 Privacy P4.2 compliance.
 */
export function pruneExpiredBroadcasts(records, maxAgeDays = BROADCAST_RETENTION_DAYS, nowMs = Date.now()) {
  if (!Array.isArray(records)) return [];
  const cutoffMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
  return records.filter(item => {
    if (!item || !item.timestamp) return true;
    const ts = new Date(item.timestamp).getTime();
    return Number.isNaN(ts) ? false : ts >= cutoffMs;
  });
}

// --- INBOUND TELEMETRY BOUNDS SANITIZATION [PI1.2] ---

export function clampTelemetryNumber(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Clamps inbound meteorological readings to physically plausible Earth/Arabian Gulf bounds
 * so corrupted upstream API payloads (NaN, Infinity, -999) cannot poison safety decisions.
 */
export function sanitizeCurrentTelemetry(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const sanitized = { ...raw };

  if ('temperature_2m' in sanitized) {
    sanitized.temperature_2m = clampTelemetryNumber(sanitized.temperature_2m, -30, 65, 30);
  }
  if ('apparent_temperature' in sanitized) {
    sanitized.apparent_temperature = clampTelemetryNumber(sanitized.apparent_temperature, -40, 80, sanitized.temperature_2m ?? 32);
  }
  if ('relative_humidity_2m' in sanitized) {
    sanitized.relative_humidity_2m = clampTelemetryNumber(sanitized.relative_humidity_2m, 0, 100, 50);
  }
  if ('wind_speed_10m' in sanitized) {
    sanitized.wind_speed_10m = clampTelemetryNumber(sanitized.wind_speed_10m, 0, 250, 15);
  }
  if ('wind_gusts_10m' in sanitized) {
    sanitized.wind_gusts_10m = clampTelemetryNumber(sanitized.wind_gusts_10m, 0, 320, sanitized.wind_speed_10m ?? 20);
  }
  if ('wind_speed_100m' in sanitized && sanitized.wind_speed_100m !== null) {
    sanitized.wind_speed_100m = clampTelemetryNumber(sanitized.wind_speed_100m, 0, 300, (sanitized.wind_speed_10m ?? 15) * 1.28);
  }
  if ('wind_direction_10m' in sanitized) {
    sanitized.wind_direction_10m = ((clampTelemetryNumber(sanitized.wind_direction_10m, -360, 720, 0) % 360) + 360) % 360;
  }
  if ('visibility' in sanitized) {
    sanitized.visibility = clampTelemetryNumber(sanitized.visibility, 0, 100000, 10000);
  }
  if ('uv_index' in sanitized) {
    sanitized.uv_index = clampTelemetryNumber(sanitized.uv_index, 0, 18, 0);
  }
  if ('solar_radiation' in sanitized && sanitized.solar_radiation !== null) {
    sanitized.solar_radiation = clampTelemetryNumber(sanitized.solar_radiation, 0, 1500, 0);
  }
  if ('pressure_msl' in sanitized) {
    sanitized.pressure_msl = clampTelemetryNumber(sanitized.pressure_msl, 870, 1085, 1013.25);
  }
  if ('pm10' in sanitized && sanitized.pm10 !== null) {
    sanitized.pm10 = clampTelemetryNumber(sanitized.pm10, 0, 5000, 40);
  }
  if ('pm2_5' in sanitized && sanitized.pm2_5 !== null) {
    sanitized.pm2_5 = clampTelemetryNumber(sanitized.pm2_5, 0, 3000, 15);
  }
  if ('european_aqi' in sanitized && sanitized.european_aqi !== null) {
    sanitized.european_aqi = clampTelemetryNumber(sanitized.european_aqi, 0, 1000, 40);
  }

  return sanitized;
}

// --- SOC 2 TRUST SERVICES CONTROL SCHEDULE & SUBPROCESSOR REGISTER [CC2.2 / CC9.2 / P1.1] ---

export const SOC2_TRUST_MATRIX = [
  {
    criteria: 'CC6.1 / CC6.2',
    category: 'Security — Logical Access',
    control: 'Salted SHA-256 Passcode Verification, Brute-Force Lockout & Idle Expiry',
    status: 'IMPLEMENTED',
    evidence: '2,048-round salted FIPS 180-4 SHA-256 digest verification, 5-attempt exponential lockout, 15-min idle auto-lock, and admin gating on API keys & manual audit writes.'
  },
  {
    criteria: 'CC6.6 / CC6.7',
    category: 'Security — Boundary & Transport',
    control: 'CSP, HSTS, Framing Defense & Webhook SSRF Guard',
    status: 'IMPLEMENTED',
    evidence: 'Strict HTTPS-only connect-src CSP, HSTS, X-Frame-Options DENY, nosniff headers (vercel.json / netlify.toml / _headers), and RFC1918/IMDS SSRF blocking.'
  },
  {
    criteria: 'CC7.1 / CC7.2',
    category: 'Security — Operations & Monitoring',
    control: 'FIPS 180-4 SHA-256 Tamper-Evident Security & Safety Ledger',
    status: 'IMPLEMENTED',
    evidence: 'Logs AI safety transitions, RSO overrides, failed/successful auth, PIN rotations, webhook config edits, and PII purges with rollover anchor hashes.'
  },
  {
    criteria: 'CC8.1',
    category: 'Security — Change Management',
    control: 'Automated CI Gate, Zero-Error Lint, Vitest Suite & Supply Chain Audit',
    status: 'IMPLEMENTED',
    evidence: 'GitHub Actions workflow (.github/workflows/soc2-ci.yml) enforces npm ci, ESLint, Vitest compliance tests, npm audit --audit-level=high, and production build.'
  },
  {
    criteria: 'CC9.2',
    category: 'Security — Vendor Risk',
    control: 'Vetted HTTPS Telemetry Subprocessors (Zero Public MITM Proxies)',
    status: 'IMPLEMENTED',
    evidence: 'Removed unvetted CORS proxies; direct TLS ingestion with timeout aborts and physical-bounds clamping.'
  },
  {
    criteria: 'A1.1 / A1.2',
    category: 'Availability — Continuity',
    control: 'Multi-Provider Failover, 250/Day Quota Governor & Offline PWA Shell',
    status: 'IMPLEMENTED',
    evidence: 'Automatic failover across WeatherNext, Open-Meteo, last-live localStorage cache, and Service Worker (sw.js) static shell caching.'
  },
  {
    criteria: 'PI1.1 – PI1.4',
    category: 'Processing Integrity',
    control: 'Deterministic ADOSH/MoHRE Physics, Bounds Validation & Output Escaping',
    status: 'IMPLEMENTED',
    evidence: 'Clamped inbound telemetry, Asia/Dubai GST MoHRE Midday Ban, HTML/JSON-script/CSV formula sanitization across PDF, Word, and CSV exports.'
  },
  {
    criteria: 'C1.1 / C1.2',
    category: 'Confidentiality',
    control: 'Secret Masking, Classification Banners & Local Purge Controls',
    status: 'IMPLEMENTED',
    evidence: 'Masked API keys in UI, OFFICIAL — RANGE OPERATIONS classification markings on exports, and one-click credential/PII purge.'
  },
  {
    criteria: 'P1.1 – P4.2',
    category: 'Privacy',
    control: 'Phone PII Redaction, 30-Day Retention TTL & Subprocessor Transparency',
    status: 'IMPLEMENTED',
    evidence: 'Phone numbers masked (+971 •• ••• XXXX) when admin gate is locked, automatic 30-day broadcast history pruning, and published subprocessor schedule.'
  }
];

export const SOC2_SUBPROCESSORS = [
  { name: 'Open-Meteo (Forecast, CAMS AQI, Marine, Ensemble, Archive)', purpose: 'Primary NWP, dust/PM10, marine wave, and ERA5 historical weather telemetry', dataShared: 'Facility coordinates (24.195°N, 53.860°E) over TLS 1.3; zero personnel PII', transport: 'HTTPS (Direct)' },
  { name: 'Google Maps Platform Weather API (Optional)', purpose: 'WeatherNext live hourly/daily forecast lookup when API key is configured', dataShared: 'Facility coordinates & restricted API key over TLS 1.3; zero personnel PII', transport: 'HTTPS (Direct)' },
  { name: 'OpenSky Network & ADSB.lol', purpose: 'Regional 50 NM ADS-B transponder airspace deconfliction', dataShared: 'Bounding-box coordinates over TLS; zero personnel PII', transport: 'HTTPS (Direct)' },
  { name: 'NOAA SWPC & AviationWeather.gov', purpose: 'Planetary Kp GNSS/HF space weather & regional UAE ICAO METAR/TAF (OMAA/OMAD/OMAM)', dataShared: 'Public bulletin/ICAO station lookup; zero personnel PII', transport: 'HTTPS (Direct)' },
  { name: 'RainViewer Public Radar API', purpose: 'Regional Doppler precipitation radar frame metadata', dataShared: 'Tile metadata request over TLS; zero personnel PII', transport: 'HTTPS (Direct)' },
  { name: 'Configured Webhook / CallMeBot (Opt-In Only)', purpose: 'Outbound RSO safety directive & critical WBGT/Lightning/Wind alerts', dataShared: 'Alert message text & configured recipient/group identifier when enabled by RSO', transport: 'HTTPS Enforced (SSRF-Guarded)' }
];

export const SOC2_RETENTION_POLICY = {
  broadcastHistoryDays: BROADCAST_RETENTION_DAYS,
  adminIdleTimeoutMinutes: 15,
  maxAuditWindowEntries: 100,
  piiMaskingDefault: 'Locked-by-default (+971 •• ••• XXXX); full numbers visible only during active RSO session'
};

export const SOC2_POLICY_PACK = [
  {
    docId: 'DOC-SYS-00',
    path: 'docs/compliance/README.md',
    title: 'AICPA DC200 System Description, CUECs & Master Traceability Index',
    criteria: 'DC200, CC1.1 – CC2.3',
    owner: 'Platform Lead / RSO-1',
    cadence: 'Semi-Annual'
  },
  {
    docId: 'POL-SEC-01',
    path: 'docs/compliance/01-information-security-policy.md',
    title: 'Information Security, Data Classification & Access Control Policy',
    criteria: 'CC1 – CC6, C1.1 – C1.2',
    owner: 'Information Security Lead',
    cadence: 'Annual'
  },
  {
    docId: 'POL-OPS-02',
    path: 'docs/compliance/02-incident-response-and-bcp-runbook.md',
    title: 'Security Incident Response, Ledger Tamper Triage & BCP/DR Runbook',
    criteria: 'CC7.2 – CC7.5, A1.1 – A1.3',
    owner: 'Chief Range Safety Officer (RSO-1)',
    cadence: 'Semi-Annual + Annual Drill'
  },
  {
    docId: 'POL-CHG-03',
    path: 'docs/compliance/03-change-management-and-sdlc-policy.md',
    title: 'Secure SDLC, Change Management & Deterministic AI Bounding Policy',
    criteria: 'CC7.1, CC8.1, PI1.1 – PI1.5, ISO 42001',
    owner: 'Lead Platform Maintainer',
    cadence: 'Annual'
  },
  {
    docId: 'POL-VND-04',
    path: 'docs/compliance/04-subprocessor-and-privacy-register.md',
    title: 'Third-Party Subprocessor Register, Vendor Risk & Privacy Schedule',
    criteria: 'CC9.1 – CC9.2, P1.1 – P8.1, UAE PDPL',
    owner: 'Privacy & Vendor Risk Lead',
    cadence: 'Quarterly'
  },
  {
    docId: 'POL-AUD-05',
    path: 'docs/compliance/05-auditor-evidence-checklist.md',
    title: 'SOC 2 Type I/II Auditor IRL (EV-01..16), Sign-Off Logs & Phase 2 Checklist',
    criteria: 'CC1 – CC9, Type I & Type II Walkthroughs',
    owner: 'Internal Audit & Compliance Lead',
    cadence: 'Quarterly'
  }
];
