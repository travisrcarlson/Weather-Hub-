# Information Security, Data Classification & Access Control Policy

| Metadata Field | Value |
| :--- | :--- |
| **Document ID** | `POL-SEC-01` |
| **Version** | `v2.4.0` |
| **Effective Date** | `2026-11-11` |
| **Classification** | `OFFICIAL — RANGE OPERATIONS USE ONLY` |
| **SOC 2 Criteria** | `CC1.1–CC1.5`, `CC2.1–CC2.2`, `CC3.1–CC3.4`, `CC5.1–CC5.3`, `CC6.1–CC6.8`, `C1.1–C1.2` |
| **ISO/IEC 42001 Clauses** | Clause `5` (Leadership), Annex `A.2` (Policies), Annex `A.3` (Internal Organization), Annex `A.6.2.8` (Logging) |
| **Policy Owner** | Information Security Lead & Chief Range Safety Officer (`RSO-1`) |
| **Review Cadence** | Annual (or upon material security architecture change) |

---

## 1. Purpose & Scope

This policy establishes the governance structure, information classification standards, logical access controls, cryptographic standards, and network boundary protections governing **XRange Weather Hub** across all Abu Al Abyad Island Range (`OMAB`) command consoles, drone flight decks, HSE stations, and source-code repositories.

---

## 2. Governance, Roles & Accountability (`CC1.1 – CC1.5`, `CC2.2`)

| Role | Assigned Responsibility | System Attribution / Privilege Scope |
| :--- | :--- | :--- |
| **Range Director / Executive Sponsor** | Approves compliance policies, risk appetite, annual audit budgets, and regulatory alignment (`ADOSH`, `MoHRE`, `GCAA`). | Read-only executive briefs & signed compliance dossiers. |
| **Information Security Lead** | Oversees `SOC 2` / `ISO 42001` control effectiveness, reviews CI vulnerability gates, leads security incident response, and audits quarterly credential rotations. | GitHub repository security admin; CI/CD branch protection owner. |
| **Range Safety Officer (`RSO-1`)** | Authenticates into the RSO Admin Gate, issues binding Range Safety Directives (`GREEN / AMBER / RED`), manages emergency recipient rosters, and logs `HITL` field verifications. | Salted SHA-256 RSO Admin Clearance (`isHseAdminUnlocked`); accountable Callsign logged per ledger entry. |
| **Remote Pilot in Command (`RPIC`)** | Evaluates `AF1R / AF2R / EM2R` wind envelopes, completes the mandatory 5-point Pre-Flight Safety Gate, and verifies `ISO 21384-3` ground-risk buffers. | Standard operational console access; pre-flight gate sign-off. |
| **Platform Maintainer / Engineer** | Implements code changes via peer-reviewed pull requests passing `.github/workflows/soc2-ci.yml`. Zero direct unreviewed pushes to production `main`. | Git contributor subject to automated lint, test, and `npm audit` gates. |

---

## 3. Risk Assessment & Threat Modeling Mandate (`CC3.1 – CC3.4`)

Risk assessments are conducted at least **semi-annually** and prior to introducing any external telemetry API, AI forecasting model, or outbound webhook integration. Assessments explicitly evaluate:
1. **Credential Brute-Force & Unauthorized Override Risk**: Mitigated via salted iterative SHA-256 hashing, 5-attempt exponential lockouts, and 15-minute idle session auto-expiry (`SOC2-01`).
2. **Server-Side / Client-Side Request Forgery (`SSRF`) & Exfiltration**: Mitigated via HTTPS-only transport enforcement, `no-referrer` fetch policies, and private/loopback/IMDS IP blocking (`SOC2-02`, `SOC2-07`).
3. **Cross-Site Scripting (`XSS`) & Spreadsheet Formula Injection (`CSV DDE`)**: Mitigated via mandatory `escapeHtml`, `safeJsonForScript`, and `sanitizeCsvCell` encoding on all PDF, Word, HTML, and CSV exports (`SOC2-04`).
4. **Upstream Telemetry Corruption & AI Hallucination**: Mitigated via physical-bounds clamping (`sanitizeCurrentTelemetry`) and deterministic `ADOSH` / `MoHRE` / `ISO 21384-3` safety rules (`SOC2-12`).
5. **Audit Log Fraud / Retroactive Tampering**: Mitigated via 256-bit `FIPS 180-4` SHA-256 hash chaining with signed rollover checkpoint anchors (`SOC2-05`).

---

## 4. Information Classification & Handling Standard (`C1.1 – C1.2`)

| Tier | Classification Label | Examples in XRange Weather Hub | Storage, Display & Disposal Controls |
| :--- | :--- | :--- | :--- |
| **Tier 1** | `PUBLIC` | Raw public WMO synoptic forecasts, NOAA `Kp` indices, public ICAO `METAR/TAF` strings. | Ingested over HTTPS (`TLS 1.2+`); bounded by `sanitizeCurrentTelemetry`. |
| **Tier 2** | `OFFICIAL — RANGE OPERATIONS USE ONLY` | Sector weather briefs (`HQ/AF1R`, `North`, `South/EM2R`, `Sea/AF2R`), ballistic drift tables, UAV envelopes, ISO 42001 / SOC 2 compliance dossiers. | Mandatory classification banner stamped on all PDF (`pdfGenerator.js`), Word (`wordGenerator.js`), JSON, and Dossier exports. |
| **Tier 3** | `CONFIDENTIAL / RESTRICTED` | RSO admin passcodes, Google Maps Platform API keys, outbound webhook URLs, personnel emergency phone numbers (`+971...`). | Never committed to Git; passcodes stored only as 2,048-round salted SHA-256 digests; API keys and phone numbers masked in UI when locked (`maskSecretKey`, `maskPhonePii`); erasable via one-click **Purge Local PII & Keys** (`purgeLocalSensitiveData`). |

---

## 5. Logical Access Control & Authentication Policy (`CC6.1 – CC6.3`)

1. **Privileged Operations Requiring RSO Clearance**:
   - Issuing or clearing manual Range Safety Directives (`AlertCenter.jsx`).
   - Viewing unmasked personnel phone numbers or editing the emergency recipient roster (`AlertCenter.jsx`).
   - Configuring or testing outbound WhatsApp / custom HTTPS webhooks (`HseWebhookDispatcher.jsx`).
   - Setting, rotating, or clearing the Google Maps Platform Weather API key (`BackendFeeds.jsx`, `setGoogleWeatherApiKey`).
   - Appending manual `HITL` verification or override entries to the SHA-256 governance ledger (`Iso42001GovernancePanel.jsx`).
   - Rotating the RSO security passcode (`setHseSecurityPin`).
2. **Cryptographic Passcode Storage**:
   - Plaintext passcodes are **strictly prohibited** in source code, `localStorage`, `sessionStorage`, or audit logs.
   - Passcodes are verified exclusively against `sha256$2048$<random-96bit-hex-salt>$<digest>` records via constant-time comparison (`timingSafeEqualStr` in `src/utils/securityControls.js`).
   - Rotating the passcode permanently replaces the initial bootstrap verifier (`DEFAULT_PASSCODE_RECORD`); the bootstrap passcode cannot be used as a fallback once rotated.
3. **Brute-Force Lockout & Session Timeout**:
   - **Lockout Threshold**: `5` consecutive failed attempts trigger an immediate `60-second` lockout (`AUTH_MAX_ATTEMPTS = 5`), doubling exponentially (`120s`, `240s`, `480s`) up to `15 minutes` on repeated strikes and recording `SECURITY_AUTH_LOCKOUT` in the SHA-256 ledger.
   - **Idle Session Expiry**: Unlocked RSO sessions reside in `sessionStorage` (tab-scoped, cleared on browser close) and automatically lock after **15 minutes of inactivity** (`ADMIN_IDLE_TIMEOUT_MS = 900,000 ms`).
4. **Rotation & Offboarding Cadence**:
   - RSO passcodes and optional third-party API keys must be rotated **quarterly** (every 90 days) and **immediately** (within `4 hours`) upon RSO role transfer or suspected compromise.

---

## 6. Cryptographic & Network Boundary Policy (`CC6.6 – CC6.7`)

1. **Transport Security**: All external API requests (`weatherService.js`) and webhook dispatches (`hseBroadcastService.js`) must use `https://` (`TLS 1.2+` / `TLS 1.3`) with `referrerPolicy: 'no-referrer'` and explicit `AbortController` request timeouts (`10,000 ms`).
2. **Zero Third-Party CORS Proxies**: Routing telemetry or airspace feeds through unvetted public proxies (e.g., `allorigins.win`, `cors-anywhere`) is prohibited.
3. **Outbound Webhook SSRF Protection**: Custom webhook URLs are validated by `validateWebhookEndpoint` prior to storage and prior to network dispatch, blocking:
   - Non-HTTPS schemes (`http:`, `file:`, `javascript:`, `data:`)
   - Embedded URL credentials (`https://user:pass@...`)
   - Loopback & local hostnames (`localhost`, `*.local`, `*.internal`, `127.0.0.0/8`, `::1`)
   - Private RFC 1918 & CGNAT ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `fc00::/7`, `fe80::/10`)
   - Cloud Instance Metadata Service (`IMDS`) endpoints (`169.254.169.254`).
4. **HTTP Security Headers**: Production deployments (`vercel.json`, `netlify.toml`, `public/_headers`) must enforce:
   - `Content-Security-Policy`: `default-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`
   - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
   - `X-Frame-Options`: `DENY`
   - `X-Content-Type-Options`: `nosniff`
   - `Referrer-Policy`: `no-referrer`
   - `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), payment=(), usb=()`

---

## 7. Policy Exceptions & Enforcement

Any temporary exception to this policy requires written risk acceptance signed by both the **Information Security Lead** and **Chief Range Safety Officer (`RSO-1`)**, with a mandatory expiration date not exceeding **30 calendar days** and a compensating control logged in the `ISO 42001 / SOC 2` governance ledger.
