# XRange Weather Hub (`v2.4.0`)

**AI-Powered Tactical Meteorology, Occupational Thermal Safety (`ADOSH` / `MoHRE`), Ballistic Drift & `ISO 21384-3` UAV Flight Operations Console — Abu Al Abyad Island Range (`OMAB`), UAE**

---

## 1. Overview

**XRange Weather Hub** fuses high-resolution multi-provider weather telemetry (`WeatherNext 3` 5km downscaling, `Open-Meteo` NWP/CAMS/Marine/Ensemble, `NOAA SWPC` geomagnetic `Kp`, `AviationWeather` `METAR/TAF`, and regional `ADS-B` airspace traffic) inside deterministic physics and safety rule engines for Range Safety Officers (`RSO`), HSE Supervisors, and Remote Pilots in Command (`RPIC`).

### Core Operational Modules
- **Command Overview & Tactical Sector Map**: Real-time monitoring across `HQ / AF1R`, `North Sector`, `South / EM2R`, and `Sea / AF2R` with 50 NM ADS-B airspace awareness and Doppler radar overlays.
- **Pilot & UAV Flight Operations (`ISO 21384-3` / `UAE GCAA`)**: Runway `31/13` crosswind decomposition, ISA density altitude, logarithmic wind-shear profiling (`10m–2500m AGL`), SORA ground-risk buffer, parachute drift vectors, and a 5-point RPIC Pre-Flight Safety Gate.
- **HSE Thermal & Haboob Protection (`ADOSH CoP 11.0` & `MoHRE`)**: Deterministic Stull wet-bulb + solar globe Outdoor `WBGT` calculation, `Asia/Dubai` (`UTC+4`) June 15 – September 15 (`12:30–15:00 GST`) Midday Break lock, convective haboob pressure-drop warnings, and G1/G7 ballistic crosswind drift tables.
- **RSO Directive & Emergency Broadcast Dispatcher**: Salted SHA-256 authenticated RSO console with 5-attempt brute-force lockout, 15-minute idle session auto-lock, PII phone masking, and SSRF-guarded HTTPS webhook dispatch.
- **ISO/IEC 42001:2023 & AICPA SOC 2 Governance Console**: Real-time 256-bit `FIPS 180-4 SHA-256` hash-chained audit ledger, Model Cards, Subprocessor Schedule, Policy Pack index, and sanitized `.DOC` / `.PDF` / `.CSV` / `.JSON` compliance dossier exports.

---

## 2. Security & Compliance Architecture (`SOC 2` + `ISO/IEC 42001`)

Full auditor walkthrough policies, system descriptions (`AICPA DC200`), incident response playbooks, subprocessor registers, and Type I / Type II evidence checklists (`EV-01` through `EV-16`) are maintained in [`docs/compliance/`](./docs/compliance/README.md):

- **[`DOC-SYS-00` — System Description & Master Traceability Matrix](./docs/compliance/README.md)**
- **[`POL-SEC-01` — Information Security, Classification & Access Control Policy](./docs/compliance/01-information-security-policy.md)**
- **[`POL-OPS-02` — Incident Response, Ledger Tamper Triage & BCP/DR Runbook](./docs/compliance/02-incident-response-and-bcp-runbook.md)**
- **[`POL-CHG-03` — Secure SDLC, Change Management & Deterministic AI Policy](./docs/compliance/03-change-management-and-sdlc-policy.md)**
- **[`POL-VND-04` — Third-Party Subprocessor Register & Privacy Schedule](./docs/compliance/04-subprocessor-and-privacy-register.md)**
- **[`POL-AUD-05` — SOC 2 Type I/II Auditor Evidence Checklist & Sign-Off Logs](./docs/compliance/05-auditor-evidence-checklist.md)**

---

## 3. Quick Start & Verification Gate

```bash
# Install exact locked dependencies
npm ci

# Start local development server
npm run dev

# Run ESLint static analysis (0 errors / 0 warnings policy)
npm run lint

# Run Vitest SOC 2 cryptography, SSRF, XSS/CSV, privacy, ADOSH & policy suite
npm test

# Verify supply-chain security (0 Critical / 0 High CVEs)
npm audit --audit-level=high

# Build production bundle
npm run build
```
