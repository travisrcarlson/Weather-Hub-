# XRange Weather Hub — SOC 2 & ISO/IEC 42001 Compliance Evidence Pack

| Metadata Field | Value |
| :--- | :--- |
| **Document ID** | `DOC-SYS-00` (AICPA `DC200` System Description & Auditor Walkthrough Index) |
| **Version** | `v2.4.0` |
| **Effective Date** | `2026-11-11` |
| **Classification** | `OFFICIAL — RANGE OPERATIONS USE ONLY` |
| **Applicable Standards** | AICPA SOC 2 Trust Services Criteria (`2017 / 2022 Revised`), ISO/IEC `42001:2023` (AIMS), UAE ADOSH CoP `11.0`, UAE MoHRE Ministerial Decree `401/2015`, ISO `21384-3:2023` |
| **System Owner** | Range Safety & Operations Directorate — Abu Al Abyad Island Range (`OMAB`) |
| **Review Cadence** | Semi-Annual (or upon significant architectural / subprocessor change) |

---

## 1. AICPA `DC200` System Description

### 1.1 Services Provided & Operational Mission
**XRange Weather Hub (`xrange-weather-dash`)** is a mission-critical meteorological telemetry, occupational thermal safety, ballistic drift, and unmanned aerial vehicle (UAV) flight-envelope decision-support console engineered for **Abu Al Abyad Island Range (`OMAB`, `24.195°N, 53.860°E`, Abu Dhabi, UAE)**.

The platform ingests multi-provider synoptic, marine, aerosol/dust, aviation (`METAR/TAF`, `ADS-B`), and space-weather (`Kp`) feeds, bounds probabilistic forecast outputs (`WeatherNext 3` / `Open-Meteo`) inside deterministic physics engines, and provides Range Safety Officers (`RSO`), HSE Supervisors, and Remote Pilots in Command (`RPIC`) with:
- Real-time **GREEN / AMBER / RED** range status evaluations (`ADOSH CoP 11.0` Outdoor WBGT & `MoHRE` 12:30–15:00 GST Midday Break enforcement).
- **AF1R / AF2R / EM2R** runway crosswind, density-altitude, and `ISO 21384-3` ground-risk buffer clearances.
- Authenticated **RSO Directive & Emergency WhatsApp/Webhook Broadcast** dispatch.
- A **256-bit FIPS 180-4 SHA-256 hash-chained audit ledger** capturing automated safety state transitions, security events, and Human-in-the-Loop (`HITL`) overrides.

### 1.2 Principal System Components
- **Infrastructure & Edge Delivery**: Static single-page web application (`React 19` + `Vite 8`) served over HTTPS (`TLS 1.2/1.3`) with enforced edge security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) via `vercel.json`, `netlify.toml`, and `public/_headers`, paired with a same-origin offline shell Service Worker (`public/sw.js`).
- **Cryptographic, Access & Sanitization Kernel (`src/utils/securityControls.js`)**: Deterministic FIPS 180-4 SHA-256 implementation, 2,048-round salted passcode verification, 5-attempt exponential lockout, 15-minute idle session timeout, SSRF/RFC1918/IMDS webhook blocker, inbound telemetry physical-bounds clamping, PII/secret masking, 30-day retention pruning, and HTML/JSON-script/CSV formula-injection encoders.
- **Deterministic Safety & Aviation Engines (`src/utils/safetyEngine.js`, `src/services/uavService.js`)**: Zero-hallucination Stull wet-bulb / globe temperature WBGT solver, `Asia/Dubai` (`UTC+4`) MoHRE Midday Ban evaluator, haboob pressure-drop detector, G1/G7 ballistic crosswind drift solver, and SORA / `ISO 21384-3` UAV contingency calculator.
- **Governance & Broadcast Service (`src/services/hseBroadcastService.js`)**: RSO clearance session controller, SHA-256 tamper-evident ledger with 100-entry rolling checkpoint anchors, SSRF-guarded webhook dispatcher, and one-click local PII/credential purge routine.
- **Automated Compliance CI Gate (`.github/workflows/soc2-ci.yml` & `tests/soc2Compliance.test.js`)**: Continuous integration pipeline enforcing deterministic lockfile installation (`npm ci`), zero-error ESLint checks, Vitest compliance/physics tests, supply-chain vulnerability gating (`npm audit --audit-level=high`), and production bundle compilation.

### 1.3 Trust Boundaries & Deployment Model
1. **Current Architecture (Phase 1 — Hardened Client SPA)**: Runs locally within hardened range operations workstations and TV kiosks. No centralized multi-tenant database stores customer records; operational state (`localStorage` / `sessionStorage`) stays scoped to the workstation browser origin under strict CSP and salted authentication controls.
2. **External CPA Type I/II Boundary Note (Phase 2 Cloud Gateway)**: Organizations seeking formal third-party CPA attestation across multi-workstation fleets must pair this SPA with an Edge/Serverless proxy (`OIDC/SSO + MFA`, server-held API keys, and append-only `WORM` cloud log forwarding) as detailed in [05-auditor-evidence-checklist.md](./05-auditor-evidence-checklist.md).

---

## 2. Compliance Policy & Evidence Pack Index

| Doc ID | Document File | Primary TSC & ISO Scope | Owner Role | Review Cadence |
| :--- | :--- | :--- | :--- | :--- |
| **`DOC-SYS-00`** | [README.md](./README.md) | AICPA `DC200`, `CC1.1–CC2.3` System Description & CUECs | Platform Lead / RSO | Semi-Annual |
| **`POL-SEC-01`** | [01-information-security-policy.md](./01-information-security-policy.md) | `CC1–CC6`, `C1.1–C1.2` Governance, Access Control, Crypto & Classification | Information Security Lead | Annual |
| **`POL-OPS-02`** | [02-incident-response-and-bcp-runbook.md](./02-incident-response-and-bcp-runbook.md) | `CC7.2–CC7.5`, `A1.1–A1.3` Incident Triage, Tamper Playbooks & Continuity | Range Safety Officer (`RSO-1`) | Semi-Annual |
| **`POL-CHG-03`** | [03-change-management-and-sdlc-policy.md](./03-change-management-and-sdlc-policy.md) | `CC7.1`, `CC8.1`, `PI1.1–PI1.5`, `ISO 42001` CI/CD, Supply Chain & AI Bounding | Lead Maintainer / QA | Annual |
| **`POL-VND-04`** | [04-subprocessor-and-privacy-register.md](./04-subprocessor-and-privacy-register.md) | `CC9.1–CC9.2`, `P1.1–P8.1`, UAE PDPL Vendor Risk, PII Masking & Retention | Privacy & Vendor Lead | Quarterly |
| **`POL-AUD-05`** | [05-auditor-evidence-checklist.md](./05-auditor-evidence-checklist.md) | `CC1–CC9` Type I / Type II Auditor IRL, Sign-Off Logs & Phase 2 Checklist | Internal Audit / Compliance | Quarterly |

---

## 3. Master AICPA Trust Services Traceability Matrix

| TSC Code | Criterion Summary | Policy Reference | In-Repo Technical Control | Automated Verification / IRL |
| :--- | :--- | :--- | :--- | :--- |
| **`CC1.1 – CC1.5`** | Control environment, integrity, oversight & accountability | `POL-SEC-01` §2 | Accountable RSO Callsign attribution in `Iso42001GovernancePanel.jsx` & `AlertCenter.jsx` | `EV-01`, `EV-02` |
| **`CC2.1 – CC2.3`** | Internal & external communication of objectives and boundaries | `DOC-SYS-00`, `POL-VND-04` | In-app **SOC 2 TSC & Subprocessor Schedule** tab (`SOC2_TRUST_MATRIX`, `SOC2_SUBPROCESSORS`) | `EV-03`, `soc2Compliance.test.js` |
| **`CC3.1 – CC3.4`** | Risk assessment, fraud/tamper risk & change impact identification | `POL-SEC-01` §3, `POL-CHG-03` §4 | Threat-modeled SSRF, XSS, CSV formula, brute-force, and ledger-tampering mitigations | `EV-04`, `soc2Compliance.test.js` |
| **`CC4.1 – CC4.2`** | Ongoing & separate evaluations, deficiency remediation | `POL-AUD-05` §2 | Continuous GitHub Actions CI gate (`soc2-ci.yml`) + live SHA-256 chain verifier button | `EV-05`, `EV-13` |
| **`CC5.1 – CC5.3`** | Control activities & technology general controls | `POL-SEC-01` §5, `POL-CHG-03` §2 | Automated build/lint/audit gates + deterministic safety threshold enforcement | `EV-06`, `soc2-ci.yml` |
| **`CC6.1 – CC6.3`** | Logical access security, credential rotation, lockout & idle expiry | `POL-SEC-01` §5 | `createSaltedPasscodeRecord`, `verifyPasscodeRecord` (2,048-round SHA-256), 5-strike lockout, 15m idle lock | `EV-07`, `soc2Compliance.test.js` |
| **`CC6.6 – CC6.7`** | Boundary protection, TLS encryption in transit & header hardening | `POL-SEC-01` §6 | `vercel.json` / `netlify.toml` / `public/_headers` CSP+HSTS+XFO; `validateWebhookEndpoint` SSRF block | `EV-08`, `soc2Compliance.test.js` |
| **`CC7.1 – CC7.2`** | Vulnerability detection & tamper-evident security event monitoring | `POL-OPS-02` §2 | `npm audit --audit-level=high`; `SECURITY_*` & `PRIVACY_*` SHA-256 ledger events | `EV-09`, `EV-10` |
| **`CC7.3 – CC7.5`** | Security incident evaluation, containment, recovery & post-mortem | `POL-OPS-02` §3–§5 | Playbooks A–D, `purgeLocalSensitiveData`, JSON/DOC forensic ledger export | `EV-11` |
| **`CC8.1`** | Authorized, tested, and peer-reviewed change management | `POL-CHG-03` §2–§3 | Pull-request workflow + `.github/workflows/soc2-ci.yml` blocking failing builds | `EV-12`, `EV-13` |
| **`CC9.1 – CC9.2`** | Risk mitigation & third-party vendor / subprocessor risk management | `POL-VND-04` §2 | Direct HTTPS telemetry only (`allorigins.win` removed), `AbortController` timeouts | `EV-14` |
| **`A1.1 – A1.3`** | Capacity management, failover redundancy & disaster recovery testing | `POL-OPS-02` §4 | `250/day` API quota governor, multi-API failover, `last_live` cache, PWA Service Worker (`public/sw.js`) | `EV-15` |
| **`PI1.1 – PI1.5`** | Complete, valid, accurate, timely & authorized processing & outputs | `POL-CHG-03` §4 | `sanitizeCurrentTelemetry` clamping, `escapeHtml`, `safeJsonForScript`, `sanitizeCsvCell`, SHA-256 anchor | `soc2Compliance.test.js` |
| **`C1.1 – C1.2`** | Identification, masking, classification & disposal of confidential info | `POL-SEC-01` §4 | `maskSecretKey`, `OFFICIAL — RANGE OPERATIONS USE ONLY` banners, `purgeLocalSensitiveData` | `EV-07`, `EV-16` |
| **`P1.1 – P8.1`** | Privacy notice, minimization, 30-day retention, masking & erasure | `POL-VND-04` §3–§5 | `maskPhonePii`, `pruneExpiredBroadcasts` (30d TTL), Subprocessor Notice, one-click PII purge | `EV-16`, `soc2Compliance.test.js` |

---

## 4. Complementary User Entity Controls (`CUECs`)

Range organizations deploying XRange Weather Hub are responsible for enforcing the following operational controls at the facility boundary:
1. **`CUEC-01` (Bootstrap Passcode Rotation)**: Immediately upon commissioning a new workstation or kiosk, the designated `RSO-1` must rotate the initial bootstrap passcode (`Freya2026`) to a unique facility secret (`>= 12` characters) via the **HSE & WhatsApp Dispatcher** security drawer.
2. **`CUEC-02` (Workstation Physical Security)**: Operations center workstations and wall-mounted TV kiosks displaying `OFFICIAL — RANGE OPERATIONS USE ONLY` telemetry must reside within badge-controlled range facilities with OS-level disk encryption (`BitLocker` / `FileVault`) enabled.
3. **`CUEC-03` (Google API Key Restriction)**: When provisioning an optional Google Maps Platform Weather API key, administrators must restrict the key in Google Cloud Console by **HTTP Referrer** (production domain only) and **API Scope** (`Weather API` only).
4. **`CUEC-04` (Physical Sensor Cross-Check — ISO 42001 HITL)**: Prior to live-fire ordnance tests or marginal crosswind UAV launches, field officers must verify automated `WeatherNext 3` / `Open-Meteo` advisories against calibrated handheld anemometer (`Kestrel 5500`) or runway windsock observations and log variances in the SHA-256 governance ledger.
5. **`CUEC-05` (Shared Workstation Decommissioning)**: Prior to repurposing, servicing, or retiring any range tablet or workstation, an authorized RSO must execute **Purge Local PII & Keys** and export the final JSON/DOC SHA-256 audit ledger to facility records.
