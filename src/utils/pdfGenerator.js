/**
 * X-Range Weather Safety Portal - RCO Daily Brief PDF Generator
 * Outputs a clean, multi-page vector-rendered report with charts, tables, and directives.
 */

import { calculateDewPoint, calculateWBGT } from './safetyEngine';

export function generateRcoPdfBrief({
  targetDateLabel,
  activeStationName,
  secureHash,
  systemMode,
  overallStatus,
  overallInstruction,
  safeWindowText,
  cautionWindowText,
  haltWindowText,
  maxTemp, maxTempTime,
  maxWbgt, maxWbgtTime,
  maxWind, maxWindTime,
  maxGust, maxGustTime,
  maxUv, maxUvTime,
  maxAqi, maxAqiTime,
  avgWind,
  droneRating,
  droneInstruction,
  ballisticsCrosswindDrift,
  chronoLogs
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Popup blocker active. Please allow popups to view the PDF draft.");
    return;
  }

  // Serialize log data for the script in the child window
  const serializedLogs = JSON.stringify(chronoLogs);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RCO_Daily_Brief_${targetDateLabel.replace(/\s+/g, '_')}</title>
  <style>
    /* CSS reset and fonts */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      line-height: 1.4;
      font-size: 11px;
      padding: 20px;
    }

    /* Enforce Arial 11px on all body content, regular weight, uniform dark color */
    body, p, td, li, span, strong, em, b, i, 
    .meta-item, .meta-label, .meta-value, 
    .status-desc, .status-title, 
    .grid-card p,
    .directives-list li {
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 11px !important;
      font-weight: normal !important;
      color: #0f172a !important;
    }

    /* Exceptions for Headers, Titles, and Orange Blocks (must remain Arial 16px, bold if designed) */
    .header-left h1,
    .section-title,
    .grid-card-title,
    .chart-title,
    table.data-table th,
    .print-control-bar,
    .print-btn {
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 16px !important;
      font-weight: bold !important;
    }

    /* Orange background white text elements */
    .header,
    .grid-card-title,
    table.data-table th,
    .print-control-bar {
      background: #FF4E02 !important;
      color: #ffffff !important;
    }

    /* Orange text elements on white background */
    .section-title,
    .chart-title {
      color: #FF4E02 !important;
      background: transparent !important;
    }

    /* Header formatting */
    .header * {
      color: #ffffff !important;
      font-family: Arial, Helvetica, sans-serif !important;
    }
    .header p {
      font-size: 11px !important;
      font-weight: normal !important;
    }
    .header-left h1 {
      font-size: 16px !important;
      font-weight: 900 !important;
    }

    /* Print control bar specific color/font exception */
    .print-btn {
      color: #ffffff !important;
      font-size: 16px !important;
      background: #0f172a !important;
    }
    .print-control-bar span,
    .print-control-bar strong {
      color: #ffffff !important;
      font-size: 16px !important;
      font-weight: bold !important;
    }

    /* Status rating text colors in Executive Summary and cards */
    span.status-RED {
      color: #dc2626 !important;
      font-weight: normal !important;
    }
    span.status-AMBER {
      color: #d97706 !important;
      font-weight: normal !important;
    }
    span.status-GREEN {
      color: #16a34a !important;
      font-weight: normal !important;
    }

    /* Table status cells */
    td.cell-RED {
      background: rgba(239, 68, 68, 0.15) !important;
      color: #b91c1c !important;
      font-weight: normal !important;
    }
    td.cell-AMBER {
      background: rgba(245, 158, 11, 0.15) !important;
      color: #b45309 !important;
      font-weight: normal !important;
    }
    td.cell-GREEN {
      background: rgba(16, 185, 129, 0.12) !important;
      color: #047857 !important;
      font-weight: normal !important;
    }

    /* Footer formatting */
    .page-footer {
      color: #64748b !important;
      font-weight: bold !important;
      font-size: 11px !important;
    }

    /* Page container formatting for standard A4/Letter size */
    .page {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }

    .print-page {
      background: #ffffff;
      padding: 30px 40px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      position: relative;
      min-height: 1080px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    .page-footer {
      position: absolute;
      bottom: 20px;
      left: 40px;
      right: 40px;
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: bold;
      color: #64748b;
      text-transform: uppercase;
      line-height: 1.4;
    }

    /* Print specific settings */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        padding: 0;
        background: #ffffff;
        font-size: 11px;
      }
      .page {
        max-width: none;
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .print-page {
        padding: 30px 40px;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
        min-height: 297mm;
        height: 297mm;
      }
      .page-break {
        display: none;
      }
      .no-print {
        display: none;
      }
    }

    /* Top header block (Terracotta with white text) */
    .header {
      background: #FF4E02;
      color: #ffffff;
      padding: 10px 15px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left h1 {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #ffffff;
      text-transform: uppercase;
      font-family: Arial, Helvetica, sans-serif;
    }
    .header-left p {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 2px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .header-right {
      text-align: right;
    }
    .header-right p {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.2;
    }

    /* Metadata details bar */
    .meta-bar {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      margin-bottom: 15px;
      display: grid;
      grid-template-cols: 2.5fr 1.5fr;
      gap: 10px;
    }
    .meta-item {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .meta-label {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
    }
    .meta-value {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-right {
      text-align: left;
      border-left: 1px solid #cbd5e1;
      padding-left: 10px;
    }
    .meta-right p {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      color: #475569;
      line-height: 1.3;
    }
    .meta-right strong {
      color: #0f172a;
      font-weight: 800;
    }

    /* Sections styling */
    .section {
      margin-bottom: 15px;
    }
    .section-title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 16px;
      font-weight: bold;
      color: #FF4E02; /* Bright Orange */
      text-transform: uppercase;
      margin-top: 15px;
      margin-bottom: 10px;
      padding-bottom: 4px;
    }

    /* Operational status block */
    .status-block {
      border: 1.5px solid #0f172a;
      padding: 10px;
      margin-bottom: 12px;
    }
    .status-title {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
    }
    .status-RED { color: #dc2626; }
    .status-AMBER { color: #d97706; }
    .status-GREEN { color: #16a34a; }
    
    .status-desc {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      color: #334155;
    }

    /* Bullet directives */
    .directives-list {
      list-style-type: none;
    }
    .directives-list li {
      position: relative;
      padding-left: 12px;
      margin-bottom: 4px;
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .directives-list li::before {
      content: "▪";
      position: absolute;
      left: 0;
      color: #FF4E02;
    }

    /* Grid columns */
    .grid-2 {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    .grid-card {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      background: #ffffff;
    }
    .grid-card p {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }
    .grid-card-title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      background: #FF4E02;
      color: #ffffff !important;
      padding: 6px 10px;
      margin: -8px -10px 8px -10px;
      border-bottom: 1px solid #cbd5e1;
    }

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      text-align: center;
      margin-top: 5px;
    }
    table.data-table th {
      background: #FF4E02;
      color: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 16px;
      font-weight: 800;
      border: 1px solid #FF4E02;
      padding: 6px 4px;
      text-transform: uppercase;
    }
    table.data-table td {
      border: 1px solid #e2e8f0;
      padding: 3.5px 2px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }
    table.data-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .cell-RED { background: rgba(239, 68, 68, 0.15) !important; color: #b91c1c; font-weight: 700; }
    .cell-AMBER { background: rgba(245, 158, 11, 0.15) !important; color: #b45309; font-weight: 700; }
    .cell-GREEN { background: rgba(16, 185, 129, 0.12) !important; color: #047857; }

    /* Chart styles */
    .chart-container {
      width: 100%;
      height: 170px;
      margin: 5px 0 10px 0;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 5px;
    }
    .chart-title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      color: #FF4E02; /* Bright Orange */
      margin-bottom: 4px;
      margin-top: 8px;
    }

    /* Quick print warning bar */
    .print-control-bar {
      background: #FF4E02;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 16px;
    }
    .print-btn {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 6px 16px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      text-transform: uppercase;
      border-radius: 2px;
    }
    .print-btn:hover {
      background: #1e293b;
    }
    svg text {
      font-family: Arial, Helvetica, sans-serif;
    }
  </style>
</head>
<body>

  <!-- Print Control Bar (Hidden on actual print) -->
  <div class="print-control-bar no-print">
    <span><strong>X-Range System Weather Portal</strong> • Draft PDF Briefing Ready for Save/Print.</span>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="page">
    
    <div class="print-page">
      <!-- Page 1: RCO Operational Directive -->
      <div class="header">
        <div class="header-left">
          <p>X-Range Tactical Safety Network</p>
          <h1>Daily Environmental Operations Brief</h1>
        </div>
        <div class="header-right">
          <p>REPORT TYPE: Daily RCO Brief</p>
          <p>SECURITY: Open Source Release</p>
        </div>
      </div>

      <div class="meta-bar">
        <div class="meta-item">
          <span class="meta-label">Target Date:</span> <span class="meta-value">${targetDateLabel}</span><br/>
          <span class="meta-label">Station:</span> <span class="meta-value">${activeStationName} (Abu Al Abyad Island, UAE)</span><br/>
          <span class="meta-label">Data Mode:</span> <span class="meta-value">${systemMode}</span>
        </div>
        <div class="meta-right">
          <p><strong>TIMESTAMP:</strong></p>
          <p>${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST</p>
          <p><strong>VERIFICATION HASH:</strong></p>
          <p>${secureHash}</p>
        </div>
      </div>

      <!-- Section 1: Executive Summary -->
      <div class="section">
        <div class="section-title">1. Executive Operations Advisory</div>
        
        <div class="status-block">
          <div class="status-title">
            Rating: &nbsp;
            <span class="status-${overallStatus.includes('RED') ? 'RED' : overallStatus.includes('AMBER') ? 'AMBER' : 'GREEN'}">
              ${overallStatus}
            </span>
          </div>
          <div class="status-desc">
            Directive: ${overallInstruction}
          </div>
        </div>

        <div style="margin-top: 10px;">
          <p style="text-transform: uppercase; margin-bottom: 4px;">Operational Directives & Action Items:</p>
          <ul class="directives-list">
            <li>Thermal Exposure: Ensure mandatory hydration splits matched to Wet Bulb Globe Temperature (WBGT) flag ratings. Provide shaded rest structures with active cooling.</li>
            <li>Wind Limits: Secure all sensitive flight equipment, drone ground control arrays, and tall targets if wind gusts exceed safe limits.</li>
            <li>Midday Break Compliance: In date ranges from June 15 to Sept 15, completely cease range activities between 12:30 and 15:00 GST in compliance with UAE MoHRE Midday Work Ban guidelines.</li>
            <li>ADOSH Lightning Guidelines: In the event of lightning activity or storm cell alerts inside the 10km boundary, immediately trigger emergency strobe sirens and evacuate all range crews to solid masonry shelter facilities. Wait at least 30 minutes after the last observed lightning strike or official alert clear before training resumption.</li>
          </ul>
        </div>
      </div>

      <!-- Section 2: Diurnal Windows -->
      <div class="section">
        <div class="section-title">2. Diurnal Operational Windows (RCO Scheduling)</div>
        <div class="grid-2">
          <div class="grid-card" style="border-left: 3px solid #16a34a;">
            <div class="grid-card-title">Safe Operating Windows</div>
            <p>${safeWindowText}</p>
            <p>• Standard training profiles cleared for execution. Maintain ordinary safety rosters.</p>
          </div>
          <div class="grid-card" style="border-left: 3px solid #d97706;">
            <div class="grid-card-title">Caution Operating Windows</div>
            <p>${cautionWindowText}</p>
            <p>• Restricted operations. Rigorous supervisor control, mandatory hydration splits, and shaded rest required.</p>
          </div>
        </div>
        <div class="grid-card" style="border-left: 3px solid #dc2626; margin-bottom: 5px;">
          <div class="grid-card-title">Suspension / Halt Windows (RED)</div>
          <p>${haltWindowText}</p>
          <p>• Critical environmental limits exceeded. Suspension of all range, vehicular, and outdoor operations mandatory.</p>
        </div>
      </div>

      <!-- Section 3: Daily Extremes -->
      <div class="section" style="margin-bottom: 0;">
        <div class="section-title">3. Diurnal Environmental Extremes</div>
        <div class="grid-2" style="margin-bottom: 5px;">
          <div class="grid-card">
            <div class="grid-card-title">Thermal Extremes</div>
            <p style="margin-bottom: 3px;">Peak Temperature: ${maxTemp.toFixed(1)}°C at ${maxTempTime}</p>
            <p>Peak Heat Stress (WBGT): <span class="status-RED">${maxWbgt.toFixed(1)}°C</span> at ${maxWbgtTime}</p>
          </div>
          <div class="grid-card">
            <div class="grid-card-title">Aerodynamic & Solar Extremes</div>
            <p style="margin-bottom: 3px;">Peak Wind Gusts: ${maxGust.toFixed(0)} km/h at ${maxGustTime}</p>
            <p style="margin-bottom: 3px;">Max Sustained Wind: ${maxWind.toFixed(0)} km/h at ${maxWindTime}</p>
            <p>Peak UV Radiation: <span class="status-AMBER">${maxUv.toFixed(1)} UV</span> at ${maxUvTime}</p>
          </div>
        </div>
      </div>

      <!-- Section 4: Flight & Ballistics -->
      <div class="section">
        <div class="section-title">4. Flight Operations & Ballistics Assessment</div>
        <div class="grid-2" style="margin-bottom: 0;">
          <div class="grid-card">
            <div class="grid-card-title">Drone Flight Readiness</div>
            <p style="margin-bottom: 3px;">Rating: <span class="status-${droneRating.includes('HALT') ? 'RED' : droneRating.includes('CAUTION') ? 'AMBER' : 'GREEN'}">${droneRating}</span></p>
            <p>${droneInstruction}</p>
          </div>
          <div class="grid-card">
            <div class="grid-card-title">Ballistics Wind Drift Warning</div>
            <p style="margin-bottom: 3px;">Crosswind Drift: <span class="status-${maxGust >= 30 ? 'AMBER' : 'GREEN'}">${maxGust >= 30 ? 'ELEVATED RISK' : 'NEGLIGIBLE'}</span></p>
            <p>${ballisticsCrosswindDrift}</p>
          </div>
        </div>
      </div>

      <!-- Footer for Page 1 -->
      <div class="page-footer">
        PUBLIC<br/>Page 1 of 2
      </div>
    </div>
    
    <div class="page-break"></div>

    <div class="print-page">
      <div class="header">
        <div class="header-left">
          <p>X-Range Tactical Safety Network</p>
          <h1>Environmental Charts & Data Logs</h1>
        </div>
        <div class="header-right">
          <p>Target Date: ${targetDateLabel}</p>
          <p>Verification Hash: ${secureHash}</p>
        </div>
      </div>

      <!-- Section 5: Profiles Charts -->
      <div class="section">
        <div class="section-title">5. Daily Meteorological Profiles</div>
        
        <div class="chart-title">Thermal Load Profile (Dry Bulb vs. WBGT Index)</div>
        <div class="chart-container" id="thermalChart">
          <!-- SVG generated programmatically -->
        </div>

        <div class="chart-title">Aerodynamic & Solar Profile (Wind Speed, Gusts, & UV)</div>
        <div class="chart-container" id="aeroChart">
          <!-- SVG generated programmatically -->
        </div>
      </div>

      <!-- Section 6: Hourly Table -->
      <div class="section">
        <div class="section-title">6. Hourly Environmental Log Database</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Temp (°C)</th>
              <th>Humidity (%)</th>
              <th>Dew Pt (°C)</th>
              <th>WBGT (°C)</th>
              <th>Wind (km/h)</th>
              <th>Gusts (km/h)</th>
              <th>Visibility (km)</th>
              <th>UV Index</th>
              <th>AQI (PM10)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="tableBody">
            <!-- Filled dynamically -->
          </tbody>
        </table>
      </div>

      <!-- Footer for Page 2 -->
      <div class="page-footer">
        PUBLIC<br/>Page 2 of 2
      </div>
    </div>

  </div>

  <script>
    // Embedded logs data
    const logs = ${serializedLogs};

    // Helper to format hour labels
    function formatTimeLabel(isoString) {
      if (!isoString) return '';
      const hourPart = isoString.split('T')[1];
      if (!hourPart) return '';
      return hourPart.slice(0, 5);
    }

    // Populate the data table
    const tableBody = document.getElementById('tableBody');
    logs.forEach(log => {
      const row = document.createElement('tr');
      const timeStr = formatTimeLabel(log.time);
      const isRed = log.safety.status === 'RED';
      const isAmber = log.safety.status === 'AMBER';
      const statusClass = isRed ? 'cell-RED' : (isAmber ? 'cell-AMBER' : 'cell-GREEN');

      row.innerHTML = \`
        <td>\${timeStr}</td>
        <td>\${log.temp.toFixed(1)}</td>
        <td>\${log.rh}%</td>
        <td>\${log.dewPoint.toFixed(1)}</td>
        <td>\${log.wbgt.toFixed(1)}</td>
        <td>\${log.wind.toFixed(0)}</td>
        <td>\${log.gusts.toFixed(0)}</td>
        <td>\${(log.visibility / 1000).toFixed(1)}</td>
        <td>\${log.uv.toFixed(1)}</td>
        <td>\${log.aqi.toFixed(0)}</td>
        <td class="\${statusClass}">\${log.safety.status}</td>
      \`;
      tableBody.appendChild(row);
    });

    // SVG Chart Drawer function
    function renderSvgChart(containerId, dataset, configs) {
      const container = document.getElementById(containerId);
      const width = container.clientWidth || 740;
      const height = 160;
      const padding = { left: 40, right: 40, top: 15, bottom: 25 };
      const plotW = width - padding.left - padding.right;
      const plotH = height - padding.top - padding.bottom;

      // Extract values for scaling
      const valuesList = [];
      configs.series.forEach(s => {
        dataset.forEach(d => {
          valuesList.push(d[s.key]);
        });
      });
      const minVal = configs.minVal !== undefined ? configs.minVal : Math.min(...valuesList, 0);
      const maxVal = configs.maxVal !== undefined ? configs.maxVal : Math.max(...valuesList, 10) * 1.1;
      const valRange = maxVal - minVal;

      // Create main SVG structure
      let svgHtml = \`<svg width="100%" height="\${height}" viewBox="0 0 \${width} \${height}" style="overflow: visible;">\`;

      // 1. Gridlines & Axes
      // Horizontal gridlines (4 steps)
      for (let i = 0; i <= 4; i++) {
        const val = minVal + (valRange * (i / 4));
        const y = padding.top + plotH - (plotH * (i / 4));
        // Gridline
        svgHtml += \`<line x1="\${padding.left}" y1="\${y}" x2="\${width - padding.right}" y2="\${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2" />\`;
        // Left Axis Label
        svgHtml += \`<text x="\${padding.left - 6}" y="\${y + 3}" text-anchor="end" font-size="7.5" fill="#64748b" font-weight="bold">\${val.toFixed(0)}\${configs.yUnit || ''}</text>\`;
        
        // Right Axis Label (for UV if applicable)
        if (configs.rightAxisKey) {
          const rVal = 0 + (configs.rightAxisMax * (i / 4));
          svgHtml += \`<text x="\${width - padding.right + 6}" y="\${y + 3}" text-anchor="start" font-size="7.5" fill="#a855f7" font-weight="bold">\${rVal.toFixed(0)} UV</text>\`;
        }
      }

      // X-Axis labels (every 2 hours)
      dataset.forEach((d, idx) => {
        if (idx % 2 === 0) {
          const x = padding.left + (idx / 23) * plotW;
          const timeLabel = formatTimeLabel(d.time);
          svgHtml += \`<line x1="\${x}" y1="\${padding.top}" x2="\${x}" y2="\${padding.top + plotH}" stroke="#cbd5e1" stroke-width="0.5" opacity="0.3" />\`;
          svgHtml += \`<text x="\${x}" y="\${height - 8}" text-anchor="middle" font-size="7.5" fill="#64748b" font-family="Arial, sans-serif">\${timeLabel}</text>\`;
        }
      });

      // Draw horizontal threshold reference lines
      if (configs.thresholds) {
        configs.thresholds.forEach(t => {
          if (t.val >= minVal && t.val <= maxVal) {
            const y = padding.top + plotH - (((t.val - minVal) / valRange) * plotH);
            svgHtml += \`<line x1="\${padding.left}" y1="\${y}" x2="\${width - padding.right}" y2="\${y}" stroke="\${t.color}" stroke-width="1.2" stroke-dasharray="4,3" />\`;
            svgHtml += \`<text x="\${width - padding.right - 5}" y="\${y - 3}" text-anchor="end" font-size="7" fill="\${t.color}" font-weight="black">\${t.label}</text>\`;
          }
        });
      }

      // 2. Plot lines & points
      configs.series.forEach(s => {
        let points = '';
        dataset.forEach((d, idx) => {
          const x = padding.left + (idx / 23) * plotW;
          const val = d[s.key];
          const y = padding.top + plotH - (((val - minVal) / valRange) * plotH);
          points += \`\${x},\${y} \`;
        });

        // Draw path
        svgHtml += \`<polyline points="\${points}" fill="none" stroke="\${s.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />\`;

        // Draw dot markers
        dataset.forEach((d, idx) => {
          if (idx % 2 === 0) {
            const x = padding.left + (idx / 23) * plotW;
            const val = d[s.key];
            const y = padding.top + plotH - (((val - minVal) / valRange) * plotH);
            svgHtml += \`<circle cx="\${x}" cy="\${y}" r="2" fill="#ffffff" stroke="\${s.color}" stroke-width="1.5" />\`;
          }
        });
      });

      // 3. Right Axis Series (e.g. UV index) if needed
      if (configs.rightAxisKey) {
        let points = '';
        dataset.forEach((d, idx) => {
          const x = padding.left + (idx / 23) * plotW;
          const val = d[configs.rightAxisKey];
          const y = padding.top + plotH - ((val / configs.rightAxisMax) * plotH);
          points += \`\${x},\${y} \`;
        });
        // Line
        svgHtml += \`<polyline points="\${points}" fill="none" stroke="#a855f7" stroke-width="1.2" stroke-dasharray="3,3" stroke-linecap="round" />\`;
        // Dots
        dataset.forEach((d, idx) => {
          if (idx % 2 === 0) {
            const x = padding.left + (idx / 23) * plotW;
            const val = d[configs.rightAxisKey];
            const y = padding.top + plotH - ((val / configs.rightAxisMax) * plotH);
            svgHtml += \`<circle cx="\${x}" cy="\${y}" r="1.5" fill="#ffffff" stroke="#a855f7" stroke-width="1" />\`;
          }
        });
      }

      // 4. Legend
      let legendX = padding.left;
      configs.series.forEach(s => {
        svgHtml += \`<rect x="\${legendX}" y="2" width="8" height="4" fill="\${s.color}" />\`;
        svgHtml += \`<text x="\${legendX + 12}" y="6" font-size="7.5" font-weight="bold" fill="#334155">\${s.name}</text>\`;
        legendX += 80;
      });
      if (configs.rightAxisKey) {
        svgHtml += \`<rect x="\${legendX}" y="2" width="8" height="4" fill="none" stroke="#a855f7" stroke-width="1" stroke-dasharray="2,2" />\`;
        svgHtml += \`<text x="\${legendX + 12}" y="6" font-size="7.5" font-weight="bold" fill="#334155">\${configs.rightAxisName}</text>\`;
      }

      svgHtml += '</svg>';
      container.innerHTML = svgHtml;
    }

    // Render charts once DOM is active
    window.addEventListener('DOMContentLoaded', () => {
      // 1. Thermal chart (Temp vs WBGT)
      renderSvgChart('thermalChart', logs, {
        series: [
          { key: 'temp', name: 'Dry Bulb Temp', color: '#FF4E02' },
          { key: 'wbgt', name: 'WBGT Index', color: '#b91c1c' }
        ],
        yUnit: '°C',
        minVal: 15,
        maxVal: 50,
        thresholds: [
          { val: 30.0, label: 'RED HALT (30.0°C WBGT)', color: '#dc2626' },
          { val: 27.9, label: 'REST WORK splits (27.9°C WBGT)', color: '#d97706' }
        ]
      });

      // 2. Wind/Gusts/UV chart
      renderSvgChart('aeroChart', logs, {
        series: [
          { key: 'wind', name: 'Sustained Wind', color: '#0284c7' },
          { key: 'gusts', name: 'Peak Wind Gusts', color: '#ef4444' }
        ],
        yUnit: ' k/h',
        minVal: 0,
        maxVal: 60,
        rightAxisKey: 'uv',
        rightAxisName: 'UV Index',
        rightAxisMax: 12,
        thresholds: [
          { val: 50, label: 'CRITICAL GUST LIMIT (50 km/h)', color: '#dc2626' },
          { val: 38, label: 'SUSTAINED WIND LIMIT (38 km/h)', color: '#b91c1c' }
        ]
      });
      
      // Auto open print dialog
      setTimeout(() => {
        // window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
