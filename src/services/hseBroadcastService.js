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

const DEFAULT_PIN = '9988';

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

export function clearActiveHseDirective() {
  localStorage.removeItem(STORAGE_KEY_DIRECTIVE);
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
      markSent('WBGT');
    }
  }

  // 2. Check Lightning
  if (config.autoAlertLightning) {
    const hasLightning = simulatedLightning || (globalSafety?.reasons?.some(r => r.toLowerCase().includes('lightning')));
    if (hasLightning && canSend('LIGHTNING')) {
      const msg = formatWhatsAppWeatherAlert('LIGHTNING', '16 km Tactical Radius');
      await sendWhatsAppMessage(msg);
      markSent('LIGHTNING');
    }
  }

  // 3. Check Wind Gusts
  if (config.autoAlertWind && activeData && (activeData.wind_gusts_10m >= 45 || (globalSafety?.reasons?.some(r => r.includes('WIND GUST') && r.includes('REQUIRING'))))) {
    if (canSend('WIND')) {
      const gustVal = activeData.wind_gusts_10m ? activeData.wind_gusts_10m.toFixed(0) : '45+';
      const msg = formatWhatsAppWeatherAlert('WIND', gustVal);
      await sendWhatsAppMessage(msg);
      markSent('WIND');
    }
  }
}
