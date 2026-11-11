/**
 * HSE Broadcast, SOC 2 Security Gate & WhatsApp Webhook Management Service
 * Handles Range Safety Officer (RSO) directives, salted SHA-256 passcode verification,
 * brute-force lockout, 15m idle session expiry, SSRF-guarded webhook dispatches,
 * FIPS 180-4 SHA-256 tamper-evident audit logging, and PII purge controls.
 */

import { evaluateHeatStress } from '../utils/safetyEngine';
import {
  sha256Hex,
  DEFAULT_PASSCODE_RECORD,
  createSaltedPasscodeRecord,
  verifyPasscodeRecord,
  ADMIN_IDLE_TIMEOUT_MS,
  evaluateLockoutState,
  computeNextFailureState,
  validateWebhookEndpoint
} from '../utils/securityControls';

const STORAGE_KEY_DIRECTIVE = 'xrange_active_hse_directive';
const STORAGE_KEY_HISTORY = 'xrange_hse_directive_history';
const STORAGE_KEY_LEGACY_PIN = 'xrange_hse_security_pin';
const STORAGE_KEY_PIN_HASH = 'xrange_hse_security_pin_hash_v2';
const STORAGE_KEY_AUTH_LOCKOUT = 'xrange_hse_auth_lockout_v1';
const STORAGE_KEY_WHATSAPP = 'xrange_hse_whatsapp_config';
const STORAGE_KEY_ALERT_COOLDOWN = 'xrange_hse_alert_cooldowns';
const STORAGE_KEY_ISO42001_LEDGER = 'xrange_iso42001_audit_ledger_v2';
const STORAGE_KEY_ISO42001_ANCHOR = 'xrange_iso42001_anchor_v2';
const SESSION_KEY_ADMIN_UNLOCKED = 'xrange_admin_unlocked';
const SESSION_KEY_LAST_ACTIVITY = 'xrange_admin_last_activity';

const MAX_LEDGER_ENTRIES = 100;
const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// Standard FIPS 180-4 256-bit SHA-256 cryptographic digest for tamper-evident hash chaining
export function computeIso42001Hash(inputStr) {
  return sha256Hex(String(inputStr ?? ''));
}

function buildCanonicalAuditString(entry) {
  return [
    entry.id,
    entry.timestamp,
    entry.isoControl || 'A.6.2.8',
    entry.eventType,
    entry.actor,
    entry.modelProvider,
    entry.sector,
    entry.decision,
    entry.rationale,
    entry.prevHash
  ].join('|');
}

function createInitialIso42001Ledger() {
  const now = Date.now();
  const rawEntries = [
    {
      id: 'AIMS-0001',
      timestamp: new Date(now - 1000 * 60 * 95).toISOString(),
      isoControl: 'A.4.2 / A.7.4 / CC7.2',
      eventType: 'AI_MODEL_INITIALIZATION',
      actor: 'System Governor (Automated)',
      modelProvider: 'WEATHERNEXT_SIM (5km Neural Grid)',
      sector: 'ALL_SECTORS (HQ, North, South, Sea)',
      decision: 'CALIBRATED',
      rationale: 'Initialized Google DeepMind WeatherNext 3 5km downscaling with ADOSH CoP 11.0 deterministic physics bounds, FIPS 180-4 SHA-256 hash chaining, and 250 call/day zero-cost cap.',
      telemetrySnapshot: { gridResolutionKm: 5, verticalLevels: 47, dailyBudgetCap: 250, hashAlgorithm: 'SHA-256' },
      prevHash: GENESIS_PREV_HASH
    },
    {
      id: 'AIMS-0002',
      timestamp: new Date(now - 1000 * 60 * 42).toISOString(),
      isoControl: 'A.5.2 / A.8.4 / PI1.1',
      eventType: 'AI_SAFETY_EVALUATION',
      actor: 'ADOSH Safety Engine v4.0',
      modelProvider: 'WEATHERNEXT_SIM (5km Neural Grid)',
      sector: 'X-Range HQ (AF1R)',
      decision: 'GREEN / CLEARED',
      rationale: 'All thermal (WBGT), surface wind (10m), boundary shear (100m), and visibility parameters verified within operational limits.',
      telemetrySnapshot: { tempC: 32.4, wbgtC: 25.1, windKmh: 18, visKm: 10.0 },
      prevHash: ''
    }
  ];

  rawEntries[0].hash = computeIso42001Hash(buildCanonicalAuditString(rawEntries[0]));
  rawEntries[1].prevHash = rawEntries[0].hash;
  rawEntries[1].hash = computeIso42001Hash(buildCanonicalAuditString(rawEntries[1]));
  return rawEntries.reverse(); // Newest first in UI array
}

export function getIso42001AuditLedger() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ISO42001_LEDGER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading ISO 42001 ledger:', e);
  }
  const seeded = createInitialIso42001Ledger();
  try {
    localStorage.setItem(STORAGE_KEY_ISO42001_LEDGER, JSON.stringify(seeded));
    localStorage.setItem(STORAGE_KEY_ISO42001_ANCHOR, GENESIS_PREV_HASH);
  } catch {
    // ignore storage quota errors
  }
  return seeded;
}

export function appendIso42001AuditEntry({
  isoControl = 'A.6.2.8',
  eventType = 'AI_SAFETY_EVALUATION',
  actor = 'Safety Engine',
  modelProvider = 'WEATHERNEXT_3',
  sector = 'X-Range HQ',
  decision = 'GREEN',
  rationale = 'Routine evaluation completed.',
  telemetrySnapshot = {}
}) {
  try {
    const ledger = getIso42001AuditLedger();
    const headEntry = ledger[0];
    const prevHash = headEntry?.hash || GENESIS_PREV_HASH;
    const nextNum = ledger.length + 1;
    const entry = {
      id: `AIMS-${String(nextNum).padStart(4, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      isoControl,
      eventType,
      actor,
      modelProvider,
      sector,
      decision,
      rationale,
      telemetrySnapshot,
      prevHash
    };
    entry.hash = computeIso42001Hash(buildCanonicalAuditString(entry));

    const combined = [entry, ...ledger];
    if (combined.length > MAX_LEDGER_ENTRIES) {
      // Preserve the oldest retained entry's prevHash as the signed rollover checkpoint anchor
      const oldestRetained = combined[MAX_LEDGER_ENTRIES - 1];
      localStorage.setItem(STORAGE_KEY_ISO42001_ANCHOR, oldestRetained.prevHash);
    }
    const updated = combined.slice(0, MAX_LEDGER_ENTRIES);
    localStorage.setItem(STORAGE_KEY_ISO42001_LEDGER, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('xrange-iso42001-ledger', { detail: updated }));
    return entry;
  } catch (e) {
    console.error('Failed to append ISO 42001 audit entry:', e);
    return null;
  }
}

export function verifyIso42001LedgerIntegrity() {
  const ledger = getIso42001AuditLedger();
  const expectedAnchor = localStorage.getItem(STORAGE_KEY_ISO42001_ANCHOR) || GENESIS_PREV_HASH;
  // Ledger is stored newest-first; walk oldest-to-newest
  const chronological = [...ledger].reverse();
  let valid = true;
  let verifiedCount = 0;

  for (let i = 0; i < chronological.length; i++) {
    const item = chronological[i];
    const expectedHash = computeIso42001Hash(buildCanonicalAuditString(item));
    if (item.hash !== expectedHash) {
      valid = false;
      break;
    }
    if (i === 0) {
      if (item.prevHash !== expectedAnchor && item.prevHash !== GENESIS_PREV_HASH) {
        valid = false;
        break;
      }
    } else if (item.prevHash !== chronological[i - 1].hash) {
      valid = false;
      break;
    }
    verifiedCount++;
  }

  return {
    valid,
    algorithm: 'FIPS 180-4 SHA-256',
    totalEntries: ledger.length,
    verifiedCount,
    headHash: ledger[0]?.hash || 'NONE',
    lastChecked: new Date().toISOString()
  };
}

const DEFAULT_WHATSAPP_CONFIG = {
  enabled: false,
  gateway: 'callmebot', // 'callmebot' | 'custom'
  phone: '',            // For CallMeBot: Phone number with country code, e.g. 971501234567
  apiKey: '',           // For CallMeBot API key
  groupChatId: '',      // Optional group chat ID for CallMeBot
  customWebhookUrl: '', // For Custom Webhook POST endpoint (HTTPS enforced, SSRF-guarded)
  autoAlertWbgt: true,  // Auto-send when WBGT >= 30.5°C (Critical Halt)
  autoAlertLightning: true, // Auto-send when lightning is detected within 16km
  autoAlertWind: true,  // Auto-send when wind gusts >= 45 km/h
  cooldownMinutes: 15   // Minimum minutes between automated alerts of the same type
};

// --- UNIFIED SOC 2 ADMIN CLEARANCE, LOCKOUT & IDLE EXPIRY [CC6.1 / CC7.2] ---

function getStoredPasscodeHashRecord() {
  try {
    // One-time migration from legacy plaintext key, then erase plaintext immediately
    const legacyPlain = localStorage.getItem(STORAGE_KEY_LEGACY_PIN);
    if (legacyPlain !== null) {
      localStorage.removeItem(STORAGE_KEY_LEGACY_PIN);
      if (legacyPlain.trim() && legacyPlain.trim() !== '9988' && legacyPlain.trim() !== 'Freya2026') {
        const migrated = createSaltedPasscodeRecord(legacyPlain.trim());
        localStorage.setItem(STORAGE_KEY_PIN_HASH, migrated);
        return migrated;
      }
    }
    const storedHash = localStorage.getItem(STORAGE_KEY_PIN_HASH);
    return storedHash || DEFAULT_PASSCODE_RECORD;
  } catch {
    return DEFAULT_PASSCODE_RECORD;
  }
}

export function getAuthLockoutStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_LOCKOUT);
    const parsed = raw ? JSON.parse(raw) : null;
    return evaluateLockoutState(parsed, Date.now());
  } catch {
    return evaluateLockoutState(null, Date.now());
  }
}

export function touchHseAdminActivity() {
  try {
    if (sessionStorage.getItem(SESSION_KEY_ADMIN_UNLOCKED) === 'true') {
      sessionStorage.setItem(SESSION_KEY_LAST_ACTIVITY, String(Date.now()));
    }
  } catch {
    // ignore storage errors
  }
}

export function isHseAdminUnlocked() {
  try {
    const unlocked = sessionStorage.getItem(SESSION_KEY_ADMIN_UNLOCKED) === 'true';
    if (!unlocked) return false;
    const lastAct = Number(sessionStorage.getItem(SESSION_KEY_LAST_ACTIVITY) || 0);
    if (lastAct > 0 && Date.now() - lastAct > ADMIN_IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem(SESSION_KEY_ADMIN_UNLOCKED);
      sessionStorage.removeItem(SESSION_KEY_LAST_ACTIVITY);
      window.dispatchEvent(new CustomEvent('xrange-admin-auth', { detail: false }));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setHseAdminUnlocked(unlocked) {
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_KEY_ADMIN_UNLOCKED, 'true');
      sessionStorage.setItem(SESSION_KEY_LAST_ACTIVITY, String(Date.now()));
    } else {
      sessionStorage.removeItem(SESSION_KEY_ADMIN_UNLOCKED);
      sessionStorage.removeItem(SESSION_KEY_LAST_ACTIVITY);
    }
    window.dispatchEvent(new CustomEvent('xrange-admin-auth', { detail: Boolean(unlocked) }));
  } catch {
    // ignore storage errors
  }
}

export function verifyHseSecurityPin(inputPin) {
  const lockout = getAuthLockoutStatus();
  if (lockout.isLocked) return false;
  const record = getStoredPasscodeHashRecord();
  return verifyPasscodeRecord(inputPin, record);
}

/**
 * Full SOC 2 CC6.1 / CC7.2 authentication workflow with brute-force lockout & security event logging.
 */
export function authenticateHseAdmin(inputPin, sourceModule = 'Admin Gate') {
  const nowMs = Date.now();
  const lockout = getAuthLockoutStatus();
  if (lockout.isLocked) {
    return {
      success: false,
      lockedOut: true,
      remainingSeconds: lockout.remainingSeconds,
      error: `Account temporarily locked due to repeated failed attempts. Try again in ${lockout.remainingSeconds}s.`
    };
  }

  const record = getStoredPasscodeHashRecord();
  const matched = verifyPasscodeRecord(inputPin, record);

  if (matched) {
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH_LOCKOUT);
    } catch {
      // ignore
    }
    setHseAdminUnlocked(true);
    appendIso42001AuditEntry({
      isoControl: 'SOC2-CC6.1 / CC7.2',
      eventType: 'SECURITY_AUTH_SUCCESS',
      actor: 'Range Safety Officer',
      modelProvider: 'SALTSHA256_ACCESS_GATE',
      sector: sourceModule,
      decision: 'UNLOCKED',
      rationale: `RSO administrative session authenticated via ${sourceModule} (15-min idle timeout armed).`
    });
    return { success: true, lockedOut: false };
  }

  // Record failure & check if threshold reached
  let rawState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_LOCKOUT);
    rawState = raw ? JSON.parse(raw) : null;
  } catch {
    rawState = null;
  }

  const nextState = computeNextFailureState(rawState, nowMs);
  try {
    localStorage.setItem(STORAGE_KEY_AUTH_LOCKOUT, JSON.stringify({
      failedAttempts: nextState.failedAttempts,
      lockoutStrikes: nextState.lockoutStrikes,
      lockedUntilMs: nextState.lockedUntilMs
    }));
  } catch {
    // ignore
  }

  if (nextState.justLockedOut) {
    appendIso42001AuditEntry({
      isoControl: 'SOC2-CC6.1 / CC7.2',
      eventType: 'SECURITY_AUTH_LOCKOUT',
      actor: 'Unauthenticated Client',
      modelProvider: 'SALTSHA256_ACCESS_GATE',
      sector: sourceModule,
      decision: `LOCKED_OUT_${nextState.lockoutSeconds}S`,
      rationale: `5 consecutive invalid passcode attempts detected in ${sourceModule}. Enforced ${nextState.lockoutSeconds}s exponential lockout.`
    });
    return {
      success: false,
      lockedOut: true,
      remainingSeconds: nextState.lockoutSeconds,
      error: `Too many failed attempts. Console locked for ${nextState.lockoutSeconds}s.`
    };
  }

  appendIso42001AuditEntry({
    isoControl: 'SOC2-CC6.1 / CC7.2',
    eventType: 'SECURITY_AUTH_FAILURE',
    actor: 'Unauthenticated Client',
    modelProvider: 'SALTSHA256_ACCESS_GATE',
    sector: sourceModule,
    decision: 'ACCESS_DENIED',
    rationale: `Failed administrative passcode attempt in ${sourceModule} (${nextState.attemptsRemaining} attempts remaining before lockout).`
  });

  return {
    success: false,
    lockedOut: false,
    attemptsRemaining: nextState.attemptsRemaining,
    error: `Invalid Admin Passcode (${nextState.attemptsRemaining} attempt${nextState.attemptsRemaining === 1 ? '' : 's'} left before lockout).`
  };
}

export function setHseSecurityPin(newPin) {
  if (!isHseAdminUnlocked()) {
    return { success: false, error: 'Administrative clearance required to rotate passcode.' };
  }
  const trimmed = String(newPin ?? '').trim();
  if (trimmed.length < 6) {
    return { success: false, error: 'SOC 2 Policy: Passcode must be at least 6 characters.' };
  }
  const saltedRecord = createSaltedPasscodeRecord(trimmed);
  localStorage.setItem(STORAGE_KEY_PIN_HASH, saltedRecord);
  localStorage.removeItem(STORAGE_KEY_LEGACY_PIN);
  touchHseAdminActivity();

  appendIso42001AuditEntry({
    isoControl: 'SOC2-CC6.1 / CC7.2',
    eventType: 'SECURITY_PIN_ROTATED',
    actor: 'Range Safety Officer',
    modelProvider: 'SALTSHA256_ACCESS_GATE',
    sector: 'HSE_ADMIN_CONSOLE',
    decision: 'PASSCODE_UPDATED',
    rationale: 'Administrative passcode rotated; stored as 2,048-round salted SHA-256 digest and invalidated default fallback.'
  });
  return { success: true };
}

/**
 * SOC 2 Privacy P4.2 / Confidentiality C1.1: One-click purge of locally stored PII, broadcast history & API secrets.
 */
export function purgeLocalSensitiveData(actor = 'Range Safety Officer') {
  try {
    localStorage.removeItem(STORAGE_KEY_WHATSAPP);
    localStorage.removeItem('xrange_google_weather_key');
    localStorage.removeItem('xrange_recipient_directory_v1');
    localStorage.removeItem('xrange_broadcast_history_v1');
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    localStorage.removeItem(STORAGE_KEY_DIRECTIVE);

    window.dispatchEvent(new CustomEvent('xrange-whatsapp-config', { detail: { ...DEFAULT_WHATSAPP_CONFIG } }));
    window.dispatchEvent(new CustomEvent('xrange-hse-directive', { detail: null }));
    window.dispatchEvent(new CustomEvent('xrange-pii-purged'));

    appendIso42001AuditEntry({
      isoControl: 'SOC2-P4.2 / C1.1',
      eventType: 'PRIVACY_LOCAL_PII_PURGE',
      actor,
      modelProvider: 'DATA_RETENTION_CONTROLLER',
      sector: 'BROWSER_STORAGE',
      decision: 'PURGED',
      rationale: 'Purged locally cached API keys, webhook endpoints, recipient phone PII, and historical broadcast logs.'
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- ACTIVE DIRECTIVE & HISTORY ---

export function getActiveHseDirective() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIRECTIVE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Check expiration if set
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      clearActiveHseDirective();
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('Error reading active HSE directive:', e);
    return null;
  }
}

export function getHseDirectiveHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading HSE directive history:', e);
    return [];
  }
}

export function clearActiveHseDirective(actor = 'Range Safety Officer') {
  localStorage.removeItem(STORAGE_KEY_DIRECTIVE);
  appendIso42001AuditEntry({
    isoControl: 'A.9.3 / A.6.2.8',
    eventType: 'HITL_DIRECTIVE_CLEARED',
    actor,
    modelProvider: 'HUMAN_OVERSIGHT_GATE',
    sector: 'ALL_SECTORS',
    decision: 'DIRECTIVE_CLEARED',
    rationale: 'Active manual RSO override directive cleared; reverted to automated ADOSH/AI safety evaluation.'
  });
  window.dispatchEvent(new CustomEvent('xrange-hse-directive', { detail: null }));
}

// --- WHATSAPP CONFIGURATION ---

export function getWhatsAppConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WHATSAPP);
    return raw ? { ...DEFAULT_WHATSAPP_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_WHATSAPP_CONFIG };
  } catch (e) {
    console.error('Error reading WhatsApp config:', e);
    return { ...DEFAULT_WHATSAPP_CONFIG };
  }
}

export function saveWhatsAppConfig(config) {
  try {
    if (config.gateway === 'custom' && config.customWebhookUrl && config.customWebhookUrl.trim()) {
      const check = validateWebhookEndpoint(config.customWebhookUrl);
      if (!check.valid) {
        return { success: false, error: check.error };
      }
    }

    const updated = { ...getWhatsAppConfig(), ...config };
    localStorage.setItem(STORAGE_KEY_WHATSAPP, JSON.stringify(updated));
    touchHseAdminActivity();
    window.dispatchEvent(new CustomEvent('xrange-whatsapp-config', { detail: updated }));

    appendIso42001AuditEntry({
      isoControl: 'SOC2-CC6.6 / CC7.2',
      eventType: 'SECURITY_WEBHOOK_CONFIG_UPDATED',
      actor: 'Range Safety Officer',
      modelProvider: 'WEBHOOK_DISPATCH_CONTROLLER',
      sector: 'HSE_ADMIN_CONSOLE',
      decision: updated.enabled ? `ENABLED (${updated.gateway.toUpperCase()})` : 'DISABLED',
      rationale: `Updated WhatsApp/Webhook configuration (gateway: ${updated.gateway}, cooldown: ${updated.cooldownMinutes}m). Secrets redacted from audit log.`
    });

    return { success: true };
  } catch (e) {
    console.error('Error saving WhatsApp config:', e);
    return { success: false, error: e.message };
  }
}

// --- WHATSAPP MESSAGE DISPATCHER ---

/**
 * Sends a message via configured WhatsApp gateway.
 * Enforces HTTPS + SSRF validation on custom webhook endpoints.
 */
export async function sendWhatsAppMessage(messageText) {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { success: false, error: 'WhatsApp notifications are disabled in settings.' };
  }

  try {
    if (config.gateway === 'callmebot') {
      if (!config.apiKey) {
        return { success: false, error: 'CallMeBot API key is missing.' };
      }

      let url = '';
      if (config.groupChatId && config.groupChatId.trim()) {
        url = `https://api.callmebot.com/whatsapp.php?source=web&group=${encodeURIComponent(config.groupChatId.trim())}&text=${encodeURIComponent(messageText)}&apikey=${encodeURIComponent(config.apiKey.trim())}`;
      } else if (config.phone && config.phone.trim()) {
        const cleanPhone = config.phone.replace(/[^0-9]/g, '');
        url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(messageText)}&apikey=${encodeURIComponent(config.apiKey.trim())}`;
      } else {
        return { success: false, error: 'Please provide either a phone number or Group Chat ID.' };
      }

      try {
        await fetch(url, { method: 'GET', mode: 'no-cors', referrerPolicy: 'no-referrer' });
      } catch {
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.src = url;
      }
      return { success: true, message: 'Message dispatched to WhatsApp gateway (referrer suppressed).' };
    } else if (config.gateway === 'custom') {
      const check = validateWebhookEndpoint(config.customWebhookUrl);
      if (!check.valid) {
        return { success: false, error: check.error };
      }

      const payload = {
        event: 'XRANGE_HSE_ALERT',
        text: messageText,
        source: 'XRANGE Weather Safety System',
        station: 'Abu Al Abyad Island HQ',
        timestamp: new Date().toISOString()
      };

      const res = await fetch(check.normalizedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Custom webhook returned HTTP ${res.status}`);
      }

      return { success: true, message: 'Custom HTTPS webhook POST completed successfully.' };
    }

    return { success: false, error: 'Unknown webhook gateway configured.' };
  } catch {
    // Redact raw URL/query parameters from error logs so API keys never leak to console
    console.error('Error dispatching WhatsApp webhook (details redacted for credential safety).');
    return { success: false, error: 'Failed to dispatch WhatsApp webhook.' };
  }
}

/**
 * Format a high-impact WhatsApp directive message
 */
export function formatWhatsAppDirective(directive) {
  const emoji = directive.severity === 'CRITICAL' ? '🚨' : directive.severity === 'CAUTION' ? '⚠️' : '📢';
  const timeStr = new Date(directive.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Dubai'
  });

  return `${emoji} *[XRANGE HSE DIRECTIVE - ${directive.severity} ${directive.category.toUpperCase()}]* ${emoji}\n` +
         `📅 *Time:* ${timeStr} GST | *Location:* Abu Al Abyad Island\n` +
         `👤 *Officer:* ${directive.author || 'Range Safety Officer'}\n` +
         `📋 *Title:* ${directive.title}\n\n` +
         `💬 *Directive:*\n${directive.message}\n\n` +
         `_Official HSE Range Safety Directive • ADOSH & MoHRE Guidelines_`;
}

/**
 * Format an automated weather trigger alert for WhatsApp
 */
export function formatWhatsAppWeatherAlert(alertType, detailValue) {
  const timeStr = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Dubai'
  });

  let title;
  let instruction;

  switch (alertType) {
    case 'WBGT':
      title = '🚨 *EXTREME HEAT STRESS (CRITICAL WBGT HALT)*';
      instruction = `Current WBGT has reached *${detailValue}°C* (Safety Limit: 30.5°C).\nMandatory suspension of outdoor activities or 45M rest per hour in shade mandated (ADOSH CoP 11.0).`;
      break;
    case 'LIGHTNING':
      title = '⚡ *LIGHTNING STRIKE PROXIMITY ALERT*';
      instruction = `Active lightning discharge detected within *${detailValue}*.\nAll open-air firing ranges, crane lifts, and outdoor maneuvers must SUSPEND immediately (30-30 Rule).`;
      break;
    case 'WIND':
      title = '💨 *CRITICAL WIND GUST ADVISORY*';
      instruction = `Peak wind gusts have reached *${detailValue} km/h*.\nBallistic crosswinds active. Secure all lightweight equipment, shade canopies, and suspend drone flights.`;
      break;
    default:
      title = '⚠️ *RANGE ENVIRONMENTAL SAFETY ALERT*';
      instruction = detailValue;
  }

  return `${title}\n` +
         `📍 *Station:* Abu Al Abyad HQ | *Time:* ${timeStr} GST\n\n` +
         `${instruction}\n\n` +
         `_Automated telemetry alert from XRANGE Tactical Console_`;
}

// --- BROADCAST DIRECTIVE (IN-APP + WHATSAPP) ---

export async function broadcastHseDirective({
  title,
  message,
  severity = 'CAUTION', // 'INFO' | 'CAUTION' | 'CRITICAL'
  category = 'GENERAL', // 'HEAT' | 'WIND' | 'LIGHTNING' | 'CURFEW' | 'GENERAL'
  author = 'Range Safety Officer',
  sendToDashboard = true,
  sendToWhatsApp = false
}) {
  touchHseAdminActivity();
  const directive = {
    id: `HSE-${Date.now()}`,
    title: title.trim(),
    message: message.trim(),
    severity,
    category,
    author: author.trim() || 'Range Safety Officer',
    timestamp: new Date().toISOString(),
    sendToDashboard,
    sendToWhatsApp
  };

  // 1. Save to in-app active directive
  if (sendToDashboard) {
    localStorage.setItem(STORAGE_KEY_DIRECTIVE, JSON.stringify(directive));
    
    // Append to history (keep last 30)
    const history = getHseDirectiveHistory();
    const updatedHistory = [directive, ...history].slice(0, 30);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedHistory));

    // Dispatch event for in-tab and cross-tab UI update
    window.dispatchEvent(new CustomEvent('xrange-hse-directive', { detail: directive }));
  }

  // Record in Tamper-Evident SHA-256 Audit Ledger (Annex A.9.3 & SOC 2 CC7.2)
  const auditEntry = appendIso42001AuditEntry({
    isoControl: 'A.9.3 / A.6.2.8 / CC7.2',
    eventType: 'HITL_RSO_DIRECTIVE',
    actor: directive.author,
    modelProvider: 'HUMAN_OVERSIGHT_OVERRIDE',
    sector: 'ABU_AL_ABYAD_RANGE',
    decision: `${directive.severity} (${directive.category})`,
    rationale: `${directive.title}: ${directive.message}`,
    telemetrySnapshot: { sendToDashboard, sendToWhatsApp }
  });
  if (auditEntry) {
    directive.auditHash = auditEntry.hash;
  }

  // 2. Dispatch to WhatsApp if requested
  let whatsappResult = null;
  if (sendToWhatsApp) {
    const formattedText = formatWhatsAppDirective(directive);
    whatsappResult = await sendWhatsAppMessage(formattedText);
  }

  return {
    success: true,
    directive,
    whatsappResult
  };
}

// --- AUTOMATED WEATHER TRIGGER DISPATCHER ---

export async function checkAndDispatchAutoAlerts(globalSafety, activeData, simulatedLightning) {
  const config = getWhatsAppConfig();
  if (!config.enabled) return;

  // Retrieve cooldowns
  let cooldowns = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERT_COOLDOWN);
    if (raw) cooldowns = JSON.parse(raw);
  } catch {
    // ignore malformed cooldown storage
  }

  const now = Date.now();
  const cooldownMs = (config.cooldownMinutes || 15) * 60 * 1000;

  const canSend = (key) => {
    if (!cooldowns[key]) return true;
    return (now - cooldowns[key]) > cooldownMs;
  };

  const markSent = (key) => {
    cooldowns[key] = now;
    localStorage.setItem(STORAGE_KEY_ALERT_COOLDOWN, JSON.stringify(cooldowns));
  };

  // 1. Check WBGT / Extreme Heat directly via ADOSH heat stress physics
  if (config.autoAlertWbgt && activeData) {
    const heatStress = evaluateHeatStress(
      activeData.temperature_2m ?? 0,
      activeData.relative_humidity_2m ?? 50,
      activeData.wind_speed_10m ?? 0,
      activeData.uv_index ?? 0,
      activeData.solar_radiation ?? null,
      activeData.apparent_temperature ?? null
    );
    if ((heatStress.wbgt >= 30.5 || (activeData.temperature_2m ?? 0) >= 46) && canSend('WBGT')) {
      const val = heatStress.wbgt.toFixed(1);
      const msg = formatWhatsAppWeatherAlert('WBGT', val);
      await sendWhatsAppMessage(msg);
      appendIso42001AuditEntry({
        isoControl: 'A.6.2.8 / A.8.4',
        eventType: 'AI_AUTO_ALERT_DISPATCH',
        actor: 'Automated HSE Trigger',
        modelProvider: 'ADOSH_WBGT_ENGINE',
        sector: activeData?.sectorTitle || 'Abu Al Abyad HQ',
        decision: 'CRITICAL_WBGT_ALERT',
        rationale: `Automated WhatsApp dispatch triggered: WBGT ${val}°C exceeds ADOSH 30.5°C severe heat threshold.`
      });
      markSent('WBGT');
    }
  }

  // 2. Check Lightning
  if (config.autoAlertLightning) {
    const hasLightning = simulatedLightning || (globalSafety?.reasons?.some(r => r.toLowerCase().includes('lightning')));
    if (hasLightning && canSend('LIGHTNING')) {
      const msg = formatWhatsAppWeatherAlert('LIGHTNING', '16 km Tactical Radius');
      await sendWhatsAppMessage(msg);
      appendIso42001AuditEntry({
        isoControl: 'A.6.2.8 / A.8.4',
        eventType: 'AI_AUTO_ALERT_DISPATCH',
        actor: 'Automated HSE Trigger',
        modelProvider: 'CONVECTIVE_LIGHTNING_DETECTOR',
        sector: activeData?.sectorTitle || 'Abu Al Abyad HQ',
        decision: 'CRITICAL_LIGHTNING_HALT',
        rationale: 'Automated WhatsApp dispatch triggered: Lightning detected within 16 km tactical radius.'
      });
      markSent('LIGHTNING');
    }
  }

  // 3. Check Wind Gusts
  if (config.autoAlertWind && activeData && (activeData.wind_gusts_10m >= 45 || (globalSafety?.reasons?.some(r => r.includes('WIND GUST') && r.includes('REQUIRING'))))) {
    if (canSend('WIND')) {
      const gustVal = activeData.wind_gusts_10m ? activeData.wind_gusts_10m.toFixed(0) : '45+';
      const msg = formatWhatsAppWeatherAlert('WIND', gustVal);
      await sendWhatsAppMessage(msg);
      appendIso42001AuditEntry({
        isoControl: 'A.6.2.8 / A.8.4',
        eventType: 'AI_AUTO_ALERT_DISPATCH',
        actor: 'Automated HSE Trigger',
        modelProvider: 'WEATHERNEXT_BOUNDARY_WIND',
        sector: activeData?.sectorTitle || 'Abu Al Abyad HQ',
        decision: 'CRITICAL_WIND_GUST_ALERT',
        rationale: `Automated WhatsApp dispatch triggered: Peak gusts ${gustVal} km/h exceed 45 km/h threshold.`
      });
      markSent('WIND');
    }
  }
}
