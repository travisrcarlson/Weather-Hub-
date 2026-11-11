# SOC 2 Type I & Type II Auditor Evidence Checklist (IRL) & Review Logs

| Metadata Field | Value |
| :--- | :--- |
| **Document ID** | `POL-AUD-05` |
| **Version** | `v2.4.0` |
| **Effective Date** | `2026-11-11` |
| **Classification** | `OFFICIAL — RANGE OPERATIONS USE ONLY` |
| **SOC 2 Criteria** | `CC1.1–CC9.2`, `A1.1–A1.3`, `PI1.1–PI1.5`, `C1.1–C1.2`, `P1.1–P8.1` |
| **Audit Owner** | Internal Compliance Lead & Information Security Lead |
| **Review Cadence** | Quarterly Evidence Collection • Annual External CPA Readiness Walkthrough |

---

## 1. Auditor Information Request List (`IRL`) — Type I & Type II Evidence Pack

Use this table during external CPA auditor walkthroughs to supply both **Type I** (Suitability of Design as of a point in time) and **Type II** (Operating Effectiveness across a 3–12 month observation window) artifacts:

| IRL ID | TSC Criteria | Evidence Artifact Requested by Auditor | Repository / System Source (Type I Design) | Operating Effectiveness Evidence (Type II Window) |
| :--- | :--- | :--- | :--- | :--- |
| **`EV-01`** | `CC1.1–CC1.5` | Information Security Policy & Role Charter | [01-information-security-policy.md](./01-information-security-policy.md) (`POL-SEC-01` §2) | Signed annual leadership approval & employee policy acknowledgment log (§3.1). |
| **`EV-02`** | `CC1.4`, `CC5.2` | RSO & Operator Safety/Security Training | `Iso42001GovernancePanel.jsx` HITL mandates & `CUEC-01..05` | Completed RSO/RPIC onboarding & annual security awareness completion records. |
| **`EV-03`** | `CC2.1–CC2.3` | System Description, Trust Matrix & Privacy Notice | [README.md](./README.md) (`DOC-SYS-00`) + in-app **SOC 2 TSC & Subprocessor Schedule** tab | Dated UI screenshot + exported `.DOC` Compliance Dossier from `Iso42001GovernancePanel`. |
| **`EV-04`** | `CC3.1–CC3.4` | Semi-Annual Risk Assessment & Threat Model | `POL-SEC-01` §3 + `SOC2-01..14` Findings Register | Semi-annual risk review minutes & risk treatment sign-offs (§3.3). |
| **`EV-05`** | `CC4.1–CC4.2` | Continuous Control Monitoring & Ledger Verification | `verifyIso42001LedgerIntegrity` (`hseBroadcastService.js`) + `soc2-ci.yml` | Quarterly exported `XRANGE_ISO42001_SOC2_Audit_Ledger_*.json` proving unbroken SHA-256 chain. |
| **`EV-06`** | `CC5.1–CC5.3` | Automated Compliance Regression Test Suite | `tests/soc2Compliance.test.js` (`Vitest`) | GitHub Actions run logs showing `100%` passing test executions across all merges in audit period. |
| **`EV-07`** | `CC6.1–CC6.3`, `C1.1` | Salted Auth, Brute-Force Lockout, Idle Lock & Key Masking | `securityControls.js` (`createSaltedPasscodeRecord`, `AUTH_MAX_ATTEMPTS`, `ADMIN_IDLE_TIMEOUT_MS`) | Quarterly Access & Passcode Rotation Log (§3.1) + ledger `SECURITY_PIN_ROTATED` entries. |
| **`EV-08`** | `CC6.6–CC6.7` | Production TLS, CSP, HSTS, Framing & SSRF Controls | `vercel.json`, `netlify.toml`, `public/_headers`, `validateWebhookEndpoint` | `curl -I https://<prod-domain>` HTTP response header capture + SSRF unit test pass log. |
| **`EV-09`** | `CC7.1` | Supply-Chain Dependency Vulnerability Scanning | `package-lock.json` + `npm audit --audit-level=high` step in `soc2-ci.yml` | Monthly Dependency Audit Log (§3.2) confirming `0` unmitigated High/Critical CVEs. |
| **`EV-10`** | `CC7.2`, `PI1.4` | Security & Safety Event Logging (`FIPS 180-4 SHA-256`) | `appendIso42001AuditEntry` (`SECURITY_*`, `PRIVACY_*`, `HITL_*` events) | Sampled SHA-256 ledger exports across audit window (plus Phase 2 WORM sink logs). |
| **`EV-11`** | `CC7.3–CC7.5` | Incident Response Plan & Post-Incident Reviews | [02-incident-response-and-bcp-runbook.md](./02-incident-response-and-bcp-runbook.md) (`POL-OPS-02`) | Completed annual Incident Response Tabletop Record (`POL-OPS-02` §6) + any `SEV-1/2` PIRs. |
| **`EV-12`** | `CC8.1` | Change Management Policy & Peer Review Rules | [03-change-management-and-sdlc-policy.md](./03-change-management-and-sdlc-policy.md) (`POL-CHG-03`) | Population of merged Git commits / PRs during audit window sampled by CPA for CI & review proof. |
| **`EV-13`** | `CC8.1`, `CC4.1` | Automated CI/CD Pipeline Configuration | `.github/workflows/soc2-ci.yml` | GitHub Actions workflow history export for the audit period. |
| **`EV-14`** | `CC9.2` | Third-Party Subprocessor Inventory & Vendor Reviews | [04-subprocessor-and-privacy-register.md](./04-subprocessor-and-privacy-register.md) (`POL-VND-04`) | Quarterly Subprocessor & DPA Review Log (§3.3). |
| **`EV-15`** | `A1.1–A1.3` | Quota Governor, Multi-Provider Failover & Offline PWA Shell | `weatherService.js` (`250/day` cap + failover) + `public/sw.js` | Annual failover / WAN-disconnect continuity drill record (`POL-OPS-02` §5–§6). |
| **`EV-16`** | `C1.2`, `P1–P8` | Classification Markings, 30-Day TTL & PII Erasure | `maskPhonePii`, `pruneExpiredBroadcasts`, `purgeLocalSensitiveData`, PDF/Word banners | Sampled exported operational PDF/Word briefs (`OFFICIAL — RANGE OPERATIONS`) + `PRIVACY_LOCAL_PII_PURGE` ledger proof. |

---

## 2. Quick Auditor Verification Commands

An internal reviewer or external technical auditor can independently verify all in-repo technical controls in under `30 seconds`:

```bash
# 1. Clean deterministic install from lockfile
npm ci

# 2. Verify zero static analysis / lint violations
npm run lint

# 3. Execute FIPS 180-4 SHA-256, Auth, SSRF, XSS/CSV, Privacy, ADOSH & Policy Pack suite
npm test

# 4. Verify zero High or Critical supply-chain vulnerabilities
npm audit --audit-level=high

# 5. Verify production compilation & asset bundle integrity
npm run build
```

---

## 3. Quarterly Governance Sign-Off Templates (Type II Operating Evidence)

### 3.1 Quarterly RSO Access, Roster & Credential Rotation Log (`CC6.1 – CC6.3`)

| Quarter | Review Date | Reviewer (`InfoSec` / `RSO-1`) | Bootstrap PIN Rotated? | Active Recipient Roster Audited? | Google API Key / Webhook Scoped? | `SECURITY_PIN_ROTATED` Ledger ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-Q4` | `2026-11-11` | `[Baseline Hardening — v2.4.0]` | `Pending Facility Cutover (CUEC-01)` | `Verified Masked Default` | `Verified Admin-Gated + SSRF Guard` | `ISO-GENESIS` |
| `2027-Q1` | `YYYY-MM-DD` | `[Name / Callsign]` | `[Yes / Date]` | `[Yes — __ Active Officers]` | `[Yes / N/A]` | `[ISO-XXXXXXXX]` |
| `2027-Q2` | `YYYY-MM-DD` | `[Name / Callsign]` | `[Yes / Date]` | `[Yes — __ Active Officers]` | `[Yes / N/A]` | `[ISO-XXXXXXXX]` |

### 3.2 Monthly Supply-Chain & CI Pipeline Audit Log (`CC7.1`, `CC8.1`)

| Month | Audit Date | Maintainer | `npm audit --audit-level=high` | `npm test` Result | `npm run lint` | Notes / Patched Packages |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-11` | `2026-11-11` | `Platform Engineering` | `PASS (0 Critical, 0 High)` | `PASS` | `PASS (0 Errors)` | Removed `axios`, upgraded `vite`, added `soc2-ci.yml`. |
| `2026-12` | `YYYY-MM-DD` | `[Name]` | `[PASS / Action Taken]` | `[PASS]` | `[PASS]` | `[Notes]` |

### 3.3 Quarterly Subprocessor, Telemetry & Risk Review Log (`CC3.2`, `CC9.2`, `P6.1`)

| Quarter | Review Date | Reviewer | `SOC2_SUBPROCESSORS` Matches Code? | Zero Public CORS Proxies Confirmed? | Opt-In Webhook DPAs Verified? | Sign-Off |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-Q4` | `2026-11-11` | `Privacy & InfoSec` | `Yes (6 Vetted Feeds)` | `Yes (allorigins.win removed)` | `Disabled by Default` | `Verified (fc37f3d)` |
| `2027-Q1` | `YYYY-MM-DD` | `[Name]` | `[Yes]` | `[Yes]` | `[Yes / Disabled]` | `[Signature]` |

---

## 4. Phase 2 Cloud Boundary Pre-Audit Checklist (Prior to External CPA Engagement)

If XRange Weather Hub transitions from single-workstation range kiosks to a multi-user cloud-hosted enterprise deployment undergoing formal CPA Type I / Type II examination, complete the three cloud infrastructure controls below:

- [ ] **Phase 2A — Server-Side Identity & MFA (`CC6.1`)**: Place RSO administrative routes behind an enterprise Identity Provider (`Entra ID` / `Google Workspace OIDC` + hardware/push `MFA`) issuing `HttpOnly; Secure; SameSite=Strict` session cookies via an Edge/Serverless gateway.
- [ ] **Phase 2B — Server-Side Secret Custody (`CC6.7`, `C1.1`)**: Move optional `Google Maps Platform Weather API` keys and outbound `WhatsApp / Webhook` secrets into server-side KMS/Secret Manager environment variables so zero third-party credentials are stored in browser storage.
- [ ] **Phase 2C — Append-Only Cloud `WORM` Audit Sink (`CC7.2`, `PI1.4`)**: Configure `appendIso42001AuditEntry` to dual-write every signed SHA-256 ledger entry to an immutable server-side log bucket (`AWS S3 Object Lock` or `Google Cloud Logging Locked Bucket`) with `365-day` retention.
