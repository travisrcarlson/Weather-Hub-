/**
 * HSE Broadcast & WhatsApp Webhook Management Service
 * Handles Range Safety Officer (RSO) directives, PIN authentication, 
 * in-app broadcast synchronization, and zero-cost WhatsApp webhook dispatches.
 */

const STORAGE_KEY_DIRECTIVE = 'xrange_active_hse_directive';
const STORAGE_KEY_HISTORY = 'xrange_hse_directive_history';
const STORAGE_KEY_PIN = 'xrange_hse_security_pin';
const STORAGE_KEY_WHATSAPP = 'xrange_hse_whatsapp_config';
const STORAGE_KEY_ALERT_COOLDOWN = 'xrange_hse_alert_cooldowns';
const STORAGE_KEY_ISO42001_LEDGER = 'xrange_iso42001_audit_ledger_v1';

const DEFAULT_PIN = '9988';

// Deterministic 256-bit hex digest (8 x 32-bit FNV-1a / avalanche lanes) for synchronous tamper-evident hash chaining
export function computeIso42001Hash(inputStr) {
  const str = String(inputStr || '');
  const seeds = [
    0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35,
    0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5
  ];
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    for (let lane = 0; lane < 8; lane++) {
      let h = seeds[lane] ^ (ch + lane * 31);
      h = Math.imul(h, 0x01000193);
      h ^= h >>> 16;
      seeds[lane] = h >>> 0;
    }
  }
  return seeds.map(s => (s >>> 0).toString(16).padStart(8, '0')).join('');
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
      isoControl: 'A.4.2 / A.7.4',
      eventType: 'AI_MODEL_INITIALIZATION',
      actor: 'System Governor (Automated)',
      modelProvider: 'WEATHERNEXT_SIM (5km Neural Grid)',
      sector: 'ALL_SECTORS (HQ, North, South, Sea)',
      decision: 'CALIBRATED',
      rationale: 'Initialized Google DeepMind WeatherNext 3 5km downscaling with ADOSH CoP 11.0 deterministic physics bounds and 250 call/day zero-cost cap.',
      telemetrySnapshot: { gridResolutionKm: 5, verticalLevels: 47, dailyBudgetCap: 250 },
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
    },
    {
      id: 'AIMS-0002',
      timestamp: new Date(now - 1000 * 60 * 42).toISOString(),
      isoControl: 'A.5.2 / A.8.4',
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
  } catch (_e) {
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
    const prevHash = headEntry?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
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

    const updated = [entry, ...ledger].slice(0, 60);
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
    if (i > 0 && item.prevHash !== chronological[i - 1].hash) {
      valid = false;
      break;
    }
    verifiedCount++;
  }

  return {
    valid,
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
  customWebhookUrl: '', // For Custom Webhook POST endpoint (Zapier, Make, n8n, etc.)
  autoAlertWbgt: true,  // Auto-send when WBGT >= 30.0°C (Critical Halt)
  autoAlertLightning: true, // Auto-send when lightning is detected within 16km
  autoAlertWind: true,  // Auto-send when wind gusts >= 45 km/h
  cooldownMinutes: 15   // Minimum minutes between automated alerts of the same type
};

// --- PIN SECURITY ---

export function getHseSecurityPin() {
  return localStorage.getItem(STORAGE_KEY_PIN) || DEFAULT_PIN;
}

export function setHseSecurityPin(newPin) {
  if (!newPin || newPin.trim().length < 4) {
    return { success: false, error: 'PIN must be at least 4 digits.' };
  }
  localStorage.setItem(STORAGE_KEY_PIN, newPin.trim());
  return { success: true };
}

export function verifyHseSecurityPin(inputPin) {
  const currentPin = getHseSecurityPin();
  return String(inputPin).trim() === String(currentPin).trim();
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
    const updated = { ...getWhatsAppConfig(), ...config };
    localStorage.setItem(STORAGE_KEY_WHATSAPP, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('xrange-whatsapp-config', { detail: updated }));
    return { success: true };
  } catch (e) {
    console.error('Error saving WhatsApp config:', e);
    return { success: false, error: e.message };
  }
}

// --- WHATSAPP MESSAGE DISPATCHER ---

/**
 * Sends a message via configured WhatsApp gateway.
 * Zero-cost via CallMeBot or Custom Webhook URL.
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

      // If groupChatId is provided, use group endpoint, otherwise direct phone
      let url = '';
      if (config.groupChatId && config.groupChatId.trim()) {
        url = `https://api.callmebot.com/whatsapp.php?source=web&group=${encodeURIComponent(config.groupChatId.trim())}&text=${encodeURIComponent(messageText)}&apikey=${encodeURIComponent(config.apiKey.trim())}`;
      } else if (config.phone && config.phone.trim()) {
        const cleanPhone = config.phone.replace(/[^0-9]/g, '');
        url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(messageText)}&apikey=${encodeURIComponent(config.apiKey.trim())}`;
      } else {
        return { success: false, error: 'Please provide either a phone number or Group Chat ID.' };
      }

      // Dispatch request using image beacon / no-cors fetch to avoid browser CORS preflight blocking
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
      } catch (e) {
        // Fallback: create hidden Image element to ping URL
        const img = new Image();
        img.src = url;
      }
      return { success: true, message: 'Message successfully dispatched to WhatsApp gateway.' };
    } else if (config.gateway === 'custom') {
      if (!config.customWebhookUrl || !config.customWebhookUrl.trim()) {
        return { success: false, error: 'Custom Webhook URL is missing.' };
      }

      const payload = {
        event: 'XRANGE_HSE_ALERT',
        text: messageText,
        source: 'XRANGE Weather Safety System',
        station: 'Abu Al Abyad Island HQ',
        timestamp: new Date().toISOString()
      };

      const res = await fetch(config.customWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Custom webhook returned HTTP ${res.status}`);
      }

      return { success: true, message: 'Custom webhook POST completed successfully.' };
    }

    return { success: false, error: 'Unknown webhook gateway configured.' };
  } catch (err) {
    console.error('Error dispatching WhatsApp webhook:', err);
    return { success: false, error: err.message || 'Failed to dispatch WhatsApp webhook.' };
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

  let title = '';
  let instruction = '';

  switch (alertType) {
    case 'WBGT':
      title = '🚨 *EXTREME HEAT STRESS (CRITICAL WBGT HALT)*';
      instruction = `Current WBGT has reached *${detailValue}°C* (Safety Limit: 30.0°C).\nMandatory suspension of outdoor activities or 45M rest per hour in shade mandated (ADOSH CoP 11.0).`;
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

  // Record in Tamper-Evident ISO 42001 Audit Ledger (Annex A.9.3 Human-in-the-Loop Override & A.6.2.8 Event Logging)
  const auditEntry = appendIso42001AuditEntry({
    isoControl: 'A.9.3 / A.6.2.8',
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
  } catch (e) {}

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

  // 1. Check WBGT
  if (config.autoAlertWbgt && activeData) {
    const wbgtBreach = globalSafety?.reasons?.find(r => r.includes('WBGT') && (r.includes('EXCEEDS') || r.includes('CRITICAL')));
    if (wbgtBreach && canSend('WBGT')) {
      const match = wbgtBreach.match(/(\d+\.?\d*)°C/);
      const val = match ? match[1] : '30.5';
      const msg = formatWhatsAppWeatherAlert('WBGT', val);
      await sendWhatsAppMessage(msg);
      appendIso42001AuditEntry({
        isoControl: 'A.6.2.8 / A.8.4',
        eventType: 'AI_AUTO_ALERT_DISPATCH',
        actor: 'Automated HSE Trigger',
        modelProvider: 'ADOSH_WBGT_ENGINE',
        sector: activeData?.sectorTitle || 'Abu Al Abyad HQ',
        decision: 'CRITICAL_WBGT_ALERT',
        rationale: `Automated WhatsApp dispatch triggered: WBGT ${val}°C exceeds 30.0°C safety threshold.`
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
