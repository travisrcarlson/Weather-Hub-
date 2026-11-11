# Security Incident Response, Business Continuity & Disaster Recovery Runbook

| Metadata Field | Value |
| :--- | :--- |
| **Document ID** | `POL-OPS-02` |
| **Version** | `v2.4.0` |
| **Effective Date** | `2026-11-11` |
| **Classification** | `OFFICIAL — RANGE OPERATIONS USE ONLY` |
| **SOC 2 Criteria** | `CC7.2–CC7.5` (Incident Detection & Response), `A1.1–A1.3` (Availability, Failover & Recovery) |
| **ISO/IEC 42001 Clauses** | Clause `8.4` (AI Incident Communication), Annex `A.6.2.8` (Audit Logging), Annex `A.9` (Human Oversight) |
| **Runbook Owner** | Chief Range Safety Officer (`RSO-1`) & Information Security Lead |
| **Review & Tabletop Cadence** | Semi-Annual Review • Annual Live Tabletop Exercise |

---

## 1. Purpose & Scope

This runbook defines operational triage SLAs, step-by-step containment and recovery playbooks, telemetry continuity failover chains, and post-incident documentation requirements for security events, cryptographic ledger anomalies, credential exposures, and meteorological provider outages affecting **XRange Weather Hub**.

---

## 2. Automated Security Event Monitoring (`CC7.2`)

The platform automatically records security-relevant events into the tamper-evident **FIPS 180-4 SHA-256 Audit Ledger** (`src/services/hseBroadcastService.js`), viewable in real time under the **ISO 42001 & AI Governance** tab:

| Ledger `eventType` | Trigger Condition | Default Severity | Required Action |
| :--- | :--- | :--- | :--- |
| `SECURITY_AUTH_LOCKOUT` | `5` consecutive invalid RSO passcode attempts (`60s–15m` exponential lockout engaged) | **SEV-2 (High)** | Execute **Playbook A** within `30 minutes`. |
| `SECURITY_AUTH_FAILURE` | Single failed passcode attempt against RSO Admin Gate | **SEV-4 (Info)** | Monitor for clustering (`>= 3` failures outside shift change). |
| `SECURITY_AUTH_SUCCESS` | Successful RSO clearance unlock | **SEV-4 (Info)** | Correlate against on-duty RSO shift roster during periodic review. |
| `SECURITY_PIN_ROTATED` | RSO salted SHA-256 passcode digest updated | **SEV-3 (Moderate)** | Confirm authorized rotation by `RSO-1` or InfoSec Lead. |
| `SECURITY_API_KEY_UPDATED` | Google Weather API key added, rotated, or cleared | **SEV-3 (Moderate)** | Verify Cloud Console referrer/API restrictions (`CUEC-03`). |
| `SECURITY_WEBHOOK_CONFIG_UPDATED` | Outbound WhatsApp / custom HTTPS webhook modified | **SEV-2 (High)** | Confirm target domain matches approved subprocessor schedule. |
| `PRIVACY_LOCAL_PII_PURGE` | One-click `Purge Local PII & Keys` executed | **SEV-3 (Moderate)** | Confirm authorized workstation wipe / DSAR fulfillment. |
| `CHAIN TAMPER ALERT` (UI Banner) | `verifyIso42001LedgerIntegrity().valid === false` | **SEV-1 (Critical)** | Execute **Playbook B** immediately (`<= 15 minutes`). |

---

## 3. Incident Severity Matrix & Response SLAs (`CC7.3 – CC7.4`)

| Severity | Definition | Detection-to-Triage SLA | Containment SLA | Escalation Path |
| :--- | :--- | :--- | :--- | :--- |
| **`SEV-1` (Critical)** | Active range safety telemetry poisoning, audit chain tamper alert during live range ops, or confirmed credential/PII compromise. | **15 minutes** | **1 hour** | `RSO-1` + InfoSec Lead + Range Director (Immediate VHF/Voice halt if safety state uncertain). |
| **`SEV-2` (High)** | Repeated `SECURITY_AUTH_LOCKOUT` events, unauthorized webhook modification attempt, or Critical/High runtime CVE in production. | **30 minutes** | **4 hours** | InfoSec Lead + `RSO-1`. |
| **`SEV-3` (Moderate)** | Primary weather provider outage (automatic failover active), unscheduled credential rotation, or dev-dependency CI gate failure. | **4 hours** | **24 hours** | Platform Maintainer + On-Duty RSO. |
| **`SEV-4` (Low / Info)** | Isolated typo during RSO unlock (`SECURITY_AUTH_FAILURE`) or transient single-poll network timeout. | **Next Business Day** | **Routine Review** | Logged in SHA-256 ledger for quarterly audit. |

---

## 4. Operational Response Playbooks (`CC7.4 – CC7.5`)

### Playbook A — Brute-Force / `SECURITY_AUTH_LOCKOUT`
1. **Identify**: Confirm workstation physical location and check CCTV / badge access logs for the command console exhibiting `SECURITY_AUTH_LOCKOUT`.
2. **Contain**: Verify exponential lockout is active; if the workstation is unattended in a shared area, lock the OS session immediately.
3. **Remediate**: Unlock RSO clearance using the current passcode, rotate the RSO passcode via **Update Security Passcode**, and export the **JSON Ledger** (`XRANGE_ISO42001_SOC2_Audit_Ledger_*.json`) as forensic evidence.
4. **Close**: Log a `HITL_RSO_OVERRIDE` / `AIMS_PERIODIC_AUDIT` rationale entry documenting the investigation outcome.

### Playbook B — SHA-256 Audit Ledger `CHAIN TAMPER ALERT`
1. **Identify**: `Iso42001GovernancePanel` displays `CHAIN TAMPER ALERT` (`verifyIso42001LedgerIntegrity` detected a hash mismatch or broken `prevHash` / rollover checkpoint anchor).
2. **Preserve Evidence**: Immediately click **JSON LEDGER** export to capture the exact corrupted `localStorage` payload (`brokenAtIndex` and surrounding digests) before clearing browser storage.
3. **Operational Safety Hold**: Treat cached browser state on that workstation as untrusted; verify active range weather status on an independent secondary RSO terminal or physical `Kestrel 5500` weather meter.
4. **Recover**: Execute **Purge Local PII & Keys** and clear `xrange_iso42001_audit_ledger_v2` only after archiving the forensic JSON snapshot, re-establish a clean Genesis block, and rotate the workstation RSO passcode.

### Playbook C — API Key or Webhook Credential Exposure
1. **Contain (Cloud)**: If a Google Maps Platform API key or custom webhook URL is suspected of exposure, immediately revoke/regenerate the key in **Google Cloud Console** or disable the target webhook endpoint at the receiver (`Zapier` / `Make` / enterprise gateway).
2. **Contain (Workstation)**: Click **Purge Local PII & Keys** inside `AlertCenter` or `BackendFeeds` (`purgeLocalSensitiveData`), wiping `xrange_google_weather_key`, `xrange_whatsapp_config_v1`, `xrange_recipient_directory_v1`, and active session tokens.
3. **Verify**: Confirm `PRIVACY_LOCAL_PII_PURGE` is recorded in the SHA-256 ledger and provision a newly scoped replacement credential (`CUEC-03`).

---

## 5. Business Continuity, Failover & Disaster Recovery (`A1.1 – A1.3`)

### 5.1 Recovery Objectives
- **Recovery Time Objective (`RTO`)**: **`< 60 seconds`** (automated client-side provider failover & Service Worker shell load; `< 10 minutes` full static redeploy from GitHub to secondary edge host).
- **Recovery Point Objective (`RPO`)**: **`<= 15 minutes`** for live meteorological telemetry (`xrange_weather_last_live` cache); **`0` loss** for source code & compliance policies stored in distributed Git repositories.

### 5.2 Multi-Tier Telemetry Continuity Chain (`A1.2`)
When an upstream API degrades, times out (`> 10s`), or hits the `250 calls/day` quota governor (`A1.1`), XRange Weather Hub degrades gracefully through five deterministic tiers:
1. **Tier 1 (Primary Live)**: Google Weather API (`WeatherNext` live lookup, when key configured & `< 250/day` budget) + Open-Meteo `CAMS` / `Marine` / `Ensemble`.
2. **Tier 2 (Automatic NWP Failover)**: Direct HTTPS failover to Open-Meteo Forecast API (`api.open-meteo.com`) with zero operator intervention.
3. **Tier 3 (Cached Telemetry Continuity)**: Automatic fallback to `xrange_weather_last_live` local snapshot with prominent `CACHED FALLBACK TELEMETRY` lineage banner and `30-minute` staleness watchdog alert (`dataAgeMinutes >= 30`).
4. **Tier 4 (Total WAN Outage — Offline App Shell)**: Same-origin Service Worker (`public/sw.js`) serves the cached UI, deterministic `ADOSH` WBGT calculator, ballistic solver, and `Simulation / Manual Input` tools completely offline.
5. **Tier 5 (Manual Field Instrument Fallback — HITL Mandate)**: If telemetry age exceeds `30 minutes` during active operations, `RSO-1` switches to calibrated handheld `Kestrel 5500` WBGT/anemometer measurements and VHF `OMAA / OMAD` aviation `METAR` voice checks.

---

## 6. Post-Incident Review (`PIR`) & Annual Tabletop Record Template (`CC7.5`, `A1.3`)

Copy and archive a completed copy of the record below for every `SEV-1` / `SEV-2` incident and for each annual BCP/IR tabletop drill:

| PIR / Drill Field | Recorded Details |
| :--- | :--- |
| **Incident / Exercise ID** | `INC-YYYY-NNN` / `TTX-YYYY-01` |
| **Date & Time (`Asia/Dubai` GST)** | `YYYY-MM-DD HH:MM GST` |
| **Lead Coordinator & Participants** | `[Name / Role — RSO-1, InfoSec Lead, Platform Maintainer]` |
| **Scenario / Trigger Event** | `[e.g., Simulated Open-Meteo outage + SECURITY_AUTH_LOCKOUT + Ledger Tamper Drill]` |
| **Timeline (Detect → Contain → Recover)** | `Detected: HH:MM | Contained: HH:MM | Recovered: HH:MM (Measured RTO: __ min)` |
| **Root Cause & Control Gaps Identified** | `[Summary of technical or procedural findings]` |
| **Corrective Actions & Owner Due Dates** | `[Action Item, GitHub Issue/PR #, Target Completion Date]` |
| **Approving Signatures** | `RSO-1: ____________________ | InfoSec Lead: ____________________` |
