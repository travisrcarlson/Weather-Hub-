# Third-Party Subprocessor Register, Vendor Risk & Privacy Schedule

| Metadata Field | Value |
| :--- | :--- |
| **Document ID** | `POL-VND-04` |
| **Version** | `v2.4.0` |
| **Effective Date** | `2026-11-11` |
| **Classification** | `OFFICIAL — RANGE OPERATIONS USE ONLY` |
| **SOC 2 Criteria** | `CC9.1–CC9.2` (Vendor & Business Partner Risk), `P1.1–P8.1` (AICPA Privacy Criteria) |
| **Regulatory Alignment** | UAE Federal Decree-Law No. `45 of 2021` (Personal Data Protection Law — `PDPL`), `ISO/IEC 42001` Annex `A.10` |
| **Register Owner** | Privacy & Vendor Risk Lead |
| **Review Cadence** | Quarterly |

---

## 1. Purpose & Scope

This register catalogs every external telemetry provider, infrastructure platform, and opt-in notification gateway integrated with **XRange Weather Hub**, alongside data-minimization rules, retention schedules, masking controls, and Data Subject Access / Erasure (`DSAR`) procedures.

> **Synchronization Note**: Runtime telemetry subprocessors listed in §2.1 are mirrored programmatically in `SOC2_SUBPROCESSORS` (`src/utils/securityControls.js`) and surfaced directly to operators inside the **SOC 2 TSC & Subprocessor Schedule** tab of `Iso42001GovernancePanel.jsx`.

---

## 2. Approved Subprocessor & Vendor Risk Register (`CC9.2`, `P1.1`, `P6.1`)

### 2.1 Runtime Telemetry & Opt-In Dispatch Subprocessors

| Subprocessor | Service Scope | Data Transmitted | PII Shared? | Transport & Security Controls | Continuity / Exit Strategy | Risk Tier |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Open-Meteo** (`api.open-meteo.com`, `air-quality-api`, `marine-api`, `ensemble-api`, `archive-api`) | Primary NWP forecast, CAMS dust/PM10, Arabian Gulf wave heights, ensemble spread & ERA5 climate normals | Facility coordinates (`24.195°N, 53.860°E`) | **None (`0` PII)** | Direct `HTTPS` (`TLS 1.3`), `no-referrer`, `10s` `AbortController`, `sanitizeCurrentTelemetry` clamping | Failover to `Google Weather API` or `last_live` local cache | **Low** |
| **Google Maps Platform Weather API** (`weather.googleapis.com`) *(Optional)* | Live `WeatherNext` hourly & daily forecast lookup when RSO configures API key | Facility coordinates + restricted API key | **None (`0` PII)** | Direct `HTTPS`, RSO-gated key storage, masked UI display, `250/day` quota cap, Cloud Console referrer lock | Instant fallback to `Open-Meteo` (`$0.00` impact) | **Moderate** |
| **OpenSky Network & ADSB.lol** (`opensky-network.org`, `api.adsb.lol`) | Regional `50 NM` ADS-B commercial/civilian transponder airspace awareness | Bounding-box lat/lon around `OMAB` | **None (`0` PII)** | Direct `HTTPS` only (anonymous CORS proxies banned per `SOC2-07`), `no-referrer`, `10s` timeout | Degrades cleanly to `OFFLINE` airspace badge without blocking weather/HSE | **Low** |
| **NOAA SWPC & AviationWeather.gov** (`services.swpc.noaa.gov`, `aviationweather.gov`) | Planetary `Kp` geomagnetic GNSS/UAV index & regional UAE ICAO `METAR/TAF` (`OMAA`, `OMAD`, `OMAM`) | Public station IDs / JSON feed poll | **None (`0` PII)** | Direct `HTTPS`, `no-referrer`, schema validation | Fallback to primary sector telemetry & VHF ATIS/METAR check | **Low** |
| **RainViewer API** (`api.rainviewer.com`) | Regional Doppler precipitation radar tile timestamps | Public radar map metadata request | **None (`0` PII)** | Direct `HTTPS`, read-only tile overlay | Map continues rendering tactical sectors without radar layer | **Low** |
| **Configured Webhook / CallMeBot** *(Opt-In Only — Disabled by Default)* | Outbound RSO safety directive & critical `WBGT` / Lightning / Wind WhatsApp or webhook dispatches | Alert summary text + RSO-configured recipient phone or channel webhook | **Opt-In Contact ID / Phone** | RSO Admin Clearance required, `validateWebhookEndpoint` (`HTTPS` enforced + RFC1918/IMDS SSRF block), `no-referrer` | Toggle `OFF` in `HseWebhookDispatcher` or click `Purge Local PII & Keys` | **High (When Enabled)** |

### 2.2 Hosting & CI/CD Infrastructure Providers

| Infrastructure Provider | Role | Data Access Scope | Security Controls |
| :--- | :--- | :--- | :--- |
| **GitHub (`github.com` / GitHub Actions)** | Source code repository & automated `.github/workflows/soc2-ci.yml` compliance runner | Source code & public commit metadata; **zero** live range PII or production API keys | MFA-protected maintainer accounts, branch protection, pinned lockfile (`npm ci`), automated `npm audit`. |
| **Vercel / Netlify / Static Edge Host** | Static asset delivery & HTTP security header enforcement (`vercel.json` / `netlify.toml` / `public/_headers`) | Serves static JS/CSS/HTML bundle over TLS; stores **zero** client `localStorage` state | Enforces `HSTS`, `CSP`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`. |

---

## 3. Vendor Onboarding & Prohibited Integration Rules (`CC9.1 – CC9.2`)

1. **Banned Proxy Architecture**: Public/anonymous CORS wrappers (`api.allorigins.win`, `thingproxy`, `corsproxy.io`) are strictly banned across the codebase to eliminate man-in-the-middle (`MITM`) telemetry injection and metadata harvesting.
2. **Pre-Integration Vendor Checklist**: Before adding a new external endpoint to `src/services/` and `SOC2_SUBPROCESSORS`:
   - Verify valid `HTTPS` (`TLS 1.2+`) certificate and absence of mixed-content assets.
   - Confirm zero personnel PII is transmitted unless explicitly opt-in, documented in §2.1, and covered by a signed Data Processing Addendum (`DPA`) for High-tier processors.
   - Wrap responses in `httpGetJson` (`AbortController` timeout + `no-referrer`) and deterministic schema/bounds sanitization.

---

## 4. Personal Information Inventory, Minimization & Retention (`P1 – P5`)

XRange Weather Hub follows a **Local-First Data Minimization** model:

| Storage Key | Data Elements | Purpose (`P2.1` / `P3.1`) | Default Visibility (`P6` / `C1.1`) | Retention TTL (`P4.2`) | Disposal Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `xrange_recipient_directory_v1` | Officer Callsign, Role, E.164 Phone (`+971...`), Active flag | Emergency RSO range halt / safety alert routing | **Masked by default** (`+971 •• ••• 4567` via `maskPhonePii`) until RSO unlocks Admin Clearance | Active roster reviewed quarterly; immediate removal upon transfer | Individual delete in UI or one-click `Purge Local PII & Keys` |
| `xrange_broadcast_history_v1` | Broadcast timestamp, severity, sector, summary text, delivery status | Operational shift handoff & dispatch verification | Visible to workstation operator (contains no raw secret keys) | **30 Calendar Days** (`BROADCAST_RETENTION_DAYS = 30`, auto-pruned on read/write via `pruneExpiredBroadcasts`) | Automatic 30-day TTL pruning + manual `Purge Local PII & Keys` |
| `xrange_whatsapp_config_v1` | Gateway mode, target phone/webhook URL, threshold toggles | Automated/manual HSE alert dispatch | Masked/gated behind RSO Admin Clearance | Retained while opt-in integration active | Cleared via `Purge Local PII & Keys` |
| `xrange_hse_admin_pin` | `sha256$2048$<salt>$<digest>` | Local RSO Admin Clearance verification | Non-reversible salted hash (plaintext never stored) | Rotated every `90 days` | Overwritten via `setHseSecurityPin` |
| `xrange_iso42001_audit_ledger_v2` | Event ID, UTC timestamp, eventType, Callsign/Engine, decision, rationale, SHA-256 chain hash | `ISO 42001` & `SOC 2 CC7.2` tamper-evident accountability | Read-only in Governance tab; manual append requires RSO Clearance | Rolling `100-entry` window + rollover hash anchor; exported quarterly to facility archive | Archived as JSON/DOC prior to workstation decommissioning |

---

## 5. Privacy Quality, Access, Correction & Erasure Procedure (`P5.1`, `P7.1`, `P8.1`)

1. **Accuracy & Self-Service Update (`P5.1`, `P7.1`)**: Range personnel may request updates to their callsign, role, or emergency contact number at any time through the on-duty `RSO-1`, who unlocks the **Alert Center** recipient roster and updates or removes the entry immediately.
2. **Right to Erasure / Workstation Sanitization (`P4.3`, UAE `PDPL` Art. 15)**:
   - **Single Personnel Removal**: `RSO-1` unlocks the Recipient Roster in `AlertCenter.jsx` and deletes the individual officer record (`< 5 minutes` SLA).
   - **Full Workstation Purge**: Executing **Purge Local PII & Keys** (`purgeLocalSensitiveData`) immediately deletes `xrange_recipient_directory_v1`, `xrange_broadcast_history_v1`, `xrange_whatsapp_config_v1`, `xrange_google_weather_key`, and active session keys, while appending a non-PII `PRIVACY_LOCAL_PII_PURGE` confirmation hash to the audit ledger.
3. **Privacy Inquiries & Complaints (`P8.1`)**: Privacy questions or incident reports are routed to the **Privacy & Vendor Risk Lead** and **Information Security Lead**, logged under `POL-OPS-02`, and resolved within **`5 business days`**.
