import { describe, it, expect, beforeEach } from 'vitest';
import {
  sha256Hex,
  DEFAULT_PASSCODE_RECORD,
  createSaltedPasscodeRecord,
  verifyPasscodeRecord,
  evaluateLockoutState,
  computeNextFailureState,
  escapeHtml,
  safeJsonForScript,
  sanitizeCsvCell,
  validateWebhookEndpoint,
  maskPhonePii,
  maskSecretKey,
  pruneExpiredBroadcasts,
  sanitizeCurrentTelemetry,
  ADMIN_IDLE_TIMEOUT_MS
} from '../src/utils/securityControls.js';
import {
  computeIso42001Hash,
  getIso42001AuditLedger,
  appendIso42001AuditEntry,
  verifyIso42001LedgerIntegrity,
  authenticateHseAdmin,
  setHseSecurityPin,
  isHseAdminUnlocked,
  saveWhatsAppConfig,
  purgeLocalSensitiveData
} from '../src/services/hseBroadcastService.js';
import {
  calculateWBGT,
  evaluateMiddayBan,
  evaluateSafety
} from '../src/utils/safetyEngine.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear()
  };
}

describe('SOC 2 Trust Services Compliance Suite', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
    globalThis.sessionStorage = createMemoryStorage();
    globalThis.window = new EventTarget();
  });

  describe('CC6.1 / CC7.2 — FIPS 180-4 SHA-256 & Salted Passcode Authentication', () => {
    it('matches official NIST FIPS 180-4 SHA-256 test vectors', () => {
      expect(sha256Hex('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
      expect(sha256Hex('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      );
      expect(computeIso42001Hash('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      );
    });

    it('verifies initial salted SHA-256 passcode and permanently invalidates default after rotation', () => {
      expect(verifyPasscodeRecord('Freya2026', DEFAULT_PASSCODE_RECORD)).toBe(true);
      expect(verifyPasscodeRecord('wrongpass', DEFAULT_PASSCODE_RECORD)).toBe(false);

      const authRes = authenticateHseAdmin('Freya2026', 'UnitTest');
      expect(authRes.success).toBe(true);
      expect(isHseAdminUnlocked()).toBe(true);

      // Rotate passcode to a new strong secret
      const rotateRes = setHseSecurityPin('XRange#RSO2026!');
      expect(rotateRes.success).toBe(true);

      // Old default passcode must NO LONGER work (no hardcoded backdoor)
      expect(authenticateHseAdmin('Freya2026', 'UnitTest').success).toBe(false);
      // New passcode succeeds
      expect(authenticateHseAdmin('XRange#RSO2026!', 'UnitTest').success).toBe(true);
    });

    it('creates unique random salts for identical passcodes', () => {
      const recA = createSaltedPasscodeRecord('SameSecret123');
      const recB = createSaltedPasscodeRecord('SameSecret123');
      expect(recA).not.toBe(recB);
      expect(verifyPasscodeRecord('SameSecret123', recA)).toBe(true);
      expect(verifyPasscodeRecord('SameSecret123', recB)).toBe(true);
    });

    it('enforces 5-attempt brute-force lockout and logs SECURITY_AUTH_LOCKOUT', () => {
      for (let i = 1; i <= 4; i++) {
        const res = authenticateHseAdmin('BadCode', 'AlertCenter');
        expect(res.success).toBe(false);
        expect(res.lockedOut).toBe(false);
      }
      const fifth = authenticateHseAdmin('BadCode', 'AlertCenter');
      expect(fifth.success).toBe(false);
      expect(fifth.lockedOut).toBe(true);

      // Even valid passcode is rejected while lockout timer is active
      const duringLockout = authenticateHseAdmin('Freya2026', 'AlertCenter');
      expect(duringLockout.success).toBe(false);
      expect(duringLockout.lockedOut).toBe(true);

      const ledger = getIso42001AuditLedger();
      expect(ledger[0].eventType).toBe('SECURITY_AUTH_LOCKOUT');
    });

    it('auto-expires idle admin sessions after 15 minutes', () => {
      authenticateHseAdmin('Freya2026', 'UnitTest');
      expect(isHseAdminUnlocked()).toBe(true);

      // Simulate 16 minutes of inactivity
      globalThis.sessionStorage.setItem(
        'xrange_admin_last_activity',
        String(Date.now() - ADMIN_IDLE_TIMEOUT_MS - 60_000)
      );
      expect(isHseAdminUnlocked()).toBe(false);
    });

    it('computes exponential backoff on repeated lockout strikes', () => {
      const now = 1_700_000_000_000;
      let state = null;
      for (let i = 0; i < 5; i++) {
        state = computeNextFailureState(state, now);
      }
      expect(state.justLockedOut).toBe(true);
      expect(state.lockoutSeconds).toBe(60);
      expect(evaluateLockoutState(state, now + 30_000).isLocked).toBe(true);
      expect(evaluateLockoutState(state, now + 61_000).isLocked).toBe(false);
    });
  });

  describe('CC6.6 / CC9.2 — Webhook TLS & SSRF Protection', () => {
    it('blocks plaintext HTTP, localhost, RFC1918 private IPs, IPv6 loopback, and cloud IMDS', () => {
      expect(validateWebhookEndpoint('http://hooks.zapier.com/test').valid).toBe(false);
      expect(validateWebhookEndpoint('https://localhost:8080/hook').valid).toBe(false);
      expect(validateWebhookEndpoint('https://127.0.0.1/hook').valid).toBe(false);
      expect(validateWebhookEndpoint('https://10.0.0.15/hook').valid).toBe(false);
      expect(validateWebhookEndpoint('https://172.16.5.4/hook').valid).toBe(false);
      expect(validateWebhookEndpoint('https://192.168.1.1/hook').valid).toBe(false);
      expect(validateWebhookEndpoint('https://169.254.169.254/latest/meta-data/').valid).toBe(false);
      expect(validateWebhookEndpoint('https://[::1]/hook').valid).toBe(false);
      expect(validateWebhookEndpoint('https://user:pass@hooks.example.com/hook').valid).toBe(false);

      // Rejects saving SSRF target in hseBroadcastService
      const saveRes = saveWhatsAppConfig({
        enabled: true,
        gateway: 'custom',
        customWebhookUrl: 'https://169.254.169.254/latest/meta-data/'
      });
      expect(saveRes.success).toBe(false);
    });

    it('accepts valid external HTTPS webhook endpoints', () => {
      const check = validateWebhookEndpoint('https://hooks.zapier.com/hooks/catch/12345/abcdef/');
      expect(check.valid).toBe(true);
    });
  });

  describe('PI1.3 / PI1.4 — Output Encoding & Formula Injection Defense', () => {
    it('escapes HTML entities and prevents </script> breakout in PDF/Word serializers', () => {
      const payload = `<img src=x onerror="alert('xss')"> & </script><script>evil()</script>`;
      const escaped = escapeHtml(payload);
      expect(escaped).not.toContain('<img');
      expect(escaped).not.toContain('</script>');
      expect(escaped).toContain('&lt;img');

      const jsonScript = safeJsonForScript({ note: '</script><script>alert(1)</script>' });
      expect(jsonScript).not.toContain('</script>');
      expect(jsonScript).toContain('\\u003c/script\\u003e');
    });

    it('neutralizes CSV spreadsheet formula injection while preserving signed numbers', () => {
      expect(sanitizeCsvCell('=CMD|\' /C calc\'!A0')).toBe("'=CMD|' /C calc'!A0");
      expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
      expect(sanitizeCsvCell('@IMPORTXML(A1,A2)')).toBe('"\'@IMPORTXML(A1,A2)"');
      expect(sanitizeCsvCell('-2.5')).toBe('-2.5');
      expect(sanitizeCsvCell(-4.2)).toBe('-4.2');
    });
  });

  describe('P1.1 / P4.2 / C1.1 — PII Masking, 30-Day Retention & Local Purge', () => {
    it('masks phone PII and secret API keys', () => {
      expect(maskPhonePii('+971 50 123 4567')).toBe('+971 •• ••• 4567');
      expect(maskSecretKey('AIzaSyD91234567890abcd')).toBe('AIza••••••••abcd');
    });

    it('prunes broadcast history entries older than 30 days', () => {
      const now = Date.now();
      const recent = { id: 1, timestamp: new Date(now - 5 * 86400_000).toISOString() };
      const expired = { id: 2, timestamp: new Date(now - 35 * 86400_000).toISOString() };
      const kept = pruneExpiredBroadcasts([recent, expired], 30, now);
      expect(kept).toHaveLength(1);
      expect(kept[0].id).toBe(1);
    });

    it('purges locally stored sensitive keys & PII and logs PRIVACY_LOCAL_PII_PURGE', () => {
      globalThis.localStorage.setItem('xrange_google_weather_key', 'AIzaSecret');
      globalThis.localStorage.setItem('xrange_recipient_directory_v1', '{"officers":[{"phone":"+971500000000"}]}');
      const res = purgeLocalSensitiveData('Test RSO');
      expect(res.success).toBe(true);
      expect(globalThis.localStorage.getItem('xrange_google_weather_key')).toBeNull();
      expect(globalThis.localStorage.getItem('xrange_recipient_directory_v1')).toBeNull();
      expect(getIso42001AuditLedger()[0].eventType).toBe('PRIVACY_LOCAL_PII_PURGE');
    });
  });

  describe('PI1.1 / PI1.2 / CC7.2 — Telemetry Clamping, ADOSH Physics & Tamper-Evident Ledger', () => {
    it('clamps corrupted upstream API readings to physical bounds', () => {
      const clamped = sanitizeCurrentTelemetry({
        temperature_2m: 999,
        relative_humidity_2m: -45,
        wind_speed_10m: NaN,
        visibility: -500,
        uv_index: 99
      });
      expect(clamped.temperature_2m).toBe(65);
      expect(clamped.relative_humidity_2m).toBe(0);
      expect(clamped.wind_speed_10m).toBe(15);
      expect(clamped.visibility).toBe(0);
      expect(clamped.uv_index).toBe(18);
    });

    it('evaluates UAE MoHRE Midday Ban in Asia/Dubai GST and ADOSH WBGT Halt accurately', () => {
      expect(evaluateMiddayBan('2026-07-15T13:00:00+04:00').isActive).toBe(true);
      expect(evaluateMiddayBan('2026-07-15T09:00:00+04:00').isActive).toBe(false);
      expect(evaluateMiddayBan('2026-11-15T13:00:00+04:00').isActive).toBe(false);

      const wbgtExtreme = calculateWBGT(45, 55, 8, 10, 950);
      expect(wbgtExtreme).toBeGreaterThanOrEqual(30.5);

      const safety = evaluateSafety(
        {
          temperature_2m: 45,
          relative_humidity_2m: 55,
          wind_speed_10m: 12,
          wind_gusts_10m: 18,
          visibility: 9000,
          uv_index: 10,
          solar_radiation: 950
        },
        '2026-07-15T13:15:00+04:00'
      );
      expect(safety.status).toBe('RED');
    });

    it('detects retroactive tampering anywhere in the SHA-256 hash-chained audit ledger', () => {
      appendIso42001AuditEntry({
        isoControl: 'A.6.2.8',
        eventType: 'TEST_EVENT',
        actor: 'Automated Suite',
        decision: 'GREEN',
        rationale: 'Original untampered rationale.'
      });
      expect(verifyIso42001LedgerIntegrity().valid).toBe(true);

      // Tamper with a stored ledger entry directly in localStorage
      const ledger = JSON.parse(globalThis.localStorage.getItem('xrange_iso42001_audit_ledger_v2'));
      ledger[0].rationale = 'Retroactively forged rationale!';
      globalThis.localStorage.setItem('xrange_iso42001_audit_ledger_v2', JSON.stringify(ledger));

      expect(verifyIso42001LedgerIntegrity().valid).toBe(false);
    });
  });
});
