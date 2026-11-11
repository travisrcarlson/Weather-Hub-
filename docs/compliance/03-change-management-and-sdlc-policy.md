# Secure SDLC, Change Management & AI Model Governance Policy

| Metadata Field | Value |
| :--- | :--- |
| **Document ID** | `POL-CHG-03` |
| **Version** | `v2.4.0` |
| **Effective Date** | `2026-11-11` |
| **Classification** | `OFFICIAL — RANGE OPERATIONS USE ONLY` |
| **SOC 2 Criteria** | `CC7.1` (Vulnerability Management), `CC8.1` (Change Management), `PI1.1–PI1.5` (Processing Integrity) |
| **ISO/IEC 42001 Clauses** | Clause `6.1` (AI Risk), Clause `8` (Operation), Annex `A.5` (Impact), Annex `A.6` (AI System Life Cycle), Annex `A.7` (Data Quality) |
| **Policy Owner** | Lead Platform Maintainer & Information Security Lead |
| **Review Cadence** | Annual |

---

## 1. Purpose & Scope

This policy governs software engineering changes, dependency supply-chain security, continuous integration (`CI`) testing gates, deterministic physics/regulatory threshold updates, and output sanitization across the **XRange Weather Hub** codebase (`https://github.com/travisrcarlson/Weather-Hub-`).

---

## 2. Change Control & Automated CI Gate (`CC8.1`)

1. **Version Control & Traceability**:
   - All application code, security headers (`vercel.json`, `netlify.toml`, `public/_headers`), compliance tests (`tests/`), and governance policies (`docs/compliance/`) are tracked in Git.
   - Every production change must reference a clear scope/control identifier (e.g., `security(soc2): ...`, `fix(hse): ...`) with author attribution and commit hash traceability.
2. **Mandatory Automated CI Gate (`.github/workflows/soc2-ci.yml`)**:
   Every push to `main` and every pull request must pass all five automated pipeline stages on a clean Ubuntu runner (`Node.js 22`) before deployment:
   - **Stage 1 — Deterministic Lockfile Install**: `npm ci` (rejects unpinned `package.json` / `package-lock.json` drift).
   - **Stage 2 — Static Analysis & Code Hygiene**: `npm run lint` (`ESLint 10` — `0` errors permitted).
   - **Stage 3 — Compliance, Crypto & Safety Regression Suite**: `npm test` (`Vitest` — verifies NIST `FIPS 180-4` SHA-256 vectors, salted passcode rotation, 5-strike brute-force lockout, 15m idle expiry, SSRF webhook blocking, HTML/script/CSV injection defenses, PII masking, 30-day retention pruning, telemetry bounds clamping, `ADOSH` WBGT, `MoHRE` Midday Ban, ledger tamper detection, and policy pack integrity).
   - **Stage 4 — Supply-Chain Security Gate**: `npm audit --audit-level=high` (fails build on any High or Critical CVE).
   - **Stage 5 — Production Bundle Verification**: `npm run build` (`Vite` production compilation verification).
3. **Segregation of Duties & Peer Review**:
   - Standard changes require pull-request review prior to merging into `main`.
   - High-impact changes affecting `src/utils/securityControls.js`, `src/utils/safetyEngine.js`, `src/services/uavService.js`, or `src/services/hseBroadcastService.js` require **dual sign-off** (Platform Maintainer + InfoSec Lead or `RSO-1` safety reviewer).

---

## 3. Dependency & Vulnerability Management (`CC7.1`, `CC8.1`)

1. **Minimal Dependency Footprint**:
   - Runtime `dependencies` in `package.json` are restricted strictly to essential UI and charting packages (`react`, `react-dom`, `lucide-react`, `recharts`).
   - Network I/O uses browser-native `fetch` + `AbortController` (`httpGetJson` in `src/services/weatherService.js`); third-party HTTP wrappers (`axios`) are prohibited to minimize supply-chain attack surface.
2. **Vulnerability Remediation SLAs**:
   - **Critical CVEs (`CVSS >= 9.0`) in Runtime Dependencies**: Remediate or remove within **`48 hours`**.
   - **High CVEs (`CVSS 7.0 – 8.9`) in Runtime Dependencies**: Remediate within **`7 calendar days`**.
   - **Moderate CVEs (`CVSS 4.0 – 6.9`) / Dev-Only Tooling**: Evaluate and patch during the **monthly dependency maintenance cycle** (`<= 30 days`).

---

## 4. Processing Integrity & Deterministic AI Bounding (`PI1.1 – PI1.5`, `ISO/IEC 42001`)

To prevent corrupted upstream payloads or probabilistic neural weather model artifacts (`WeatherNext 3`) from causing unsafe range decisions or poisoned exports, all changes must preserve four processing-integrity invariants:

1. **Inbound Physical-Bounds Clamping (`PI1.2`)**:
   Every live weather ingestion pipeline (`Open-Meteo` and `Google Weather API`) must pass through `sanitizeCurrentTelemetry` (`src/utils/securityControls.js`), clamping `NaN`, `Infinity`, and out-of-bounds readings to physically plausible Earth/Arabian Gulf limits:
   - `temperature_2m`: `[-30°C, +65°C]`
   - `relative_humidity_2m`: `[0%, 100%]`
   - `wind_speed_10m`: `[0, 250 km/h]` | `wind_gusts_10m`: `[0, 320 km/h]`
   - `visibility`: `[0, 100,000 m]` | `uv_index`: `[0, 18]` | `pressure_msl`: `[870, 1085 hPa]`
2. **Zero-Hallucination Regulatory Rule Enforcement (`PI1.1`, `PI1.3`)**:
   Life-safety `GREEN / AMBER / RED` and `GO / NO-GO` classifications are computed exclusively by deterministic physics & regulatory formulas—never by generative LLM text outputs:
   - **UAE `MoHRE` Ministerial Decree `401/2015`**: Enforced deterministically in `Asia/Dubai` (`UTC+4`) between **June 15 and September 15 (`12:30 – 15:00 GST`)** regardless of operator workstation local OS timezone (`evaluateMiddayBan`).
   - **`ADOSH CoP 11.0` / `ISO 7243` Thermal Stress**: Stull psychrometric wet-bulb + solar globe WBGT (`>= 30.0°C` Amber Caution; `>= 32.5°C` or extreme heat-index Red Halt).
   - **Aviation & `ISO 21384-3:2023` UAV Envelopes**: Deterministic runway `31/13` crosswind decomposition (`AF1R`, `AF2R`, `EM2R`), ISA density altitude, SORA ground-risk buffer, and parachute drift vectors.
3. **Output Encoding & Injection Prevention (`PI1.3`, `PI1.5`)**:
   - All HTML/PDF/Word report generators (`pdfGenerator.js`, `wordGenerator.js`, `Iso42001GovernancePanel.jsx`) must sanitize dynamic values with `escapeHtml` and `safeJsonForScript`, and isolate print popups with `printWindow.opener = null`.
   - All CSV exporters (`HseDashboard.jsx`, `PlanningDashboard.jsx`, `CustomerPortal.jsx`) must wrap every cell in `sanitizeCsvCell` to neutralize spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`) while preserving signed numeric values (e.g., `-2.5`).
4. **Ledger Continuity Across Window Rollover (`PI1.4`)**:
   - When the local `ISO 42001 / SOC 2` ledger reaches `100` entries, truncation must record a cryptographically verified rollover anchor (`xrange_iso42001_ledger_anchor_v2`) so `verifyIso42001LedgerIntegrity` continuously proves linkage without false-positive breaks.

---

## 5. Emergency Hotfix Procedure (`CC8.1`)

If a **`SEV-1`** production defect threatens range personnel safety or active security controls:
1. A targeted hotfix branch (`hotfix/sev1-<short-slug>`) may be merged immediately after **automated `soc2-ci.yml` checks pass** and verbal/written authorization is granted by `RSO-1` or the InfoSec Lead.
2. Retrospective peer code review and a formal Post-Incident Review (`POL-OPS-02` §6) must be completed within **`24 hours`** of deployment.
