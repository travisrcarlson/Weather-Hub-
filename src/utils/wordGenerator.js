/**
 * X-Range Weather Safety Portal - RCO Daily Brief Word Document Generator
 * Outputs a clean, professionally formatted MS Word-compatible brief (.doc) using standard HTML/Office XML markup.
 */

export function generateRcoWordBrief({
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
  // Format target date for filename
  const sanitizedDate = targetDateLabel.replace(/\s+/g, '_');
  const filename = `RCO_Daily_Weather_Brief_${sanitizedDate}.doc`;

  // Build the hourly data table rows
  const tableRows = chronoLogs.map(log => {
    const timeStr = log.time.split('T')[1].slice(0, 5);
    const status = log.safety.status;
    let statusCellClass = 'cell-green';
    if (status === 'RED') {
      statusCellClass = 'cell-red';
    } else if (status === 'AMBER') {
      statusCellClass = 'cell-amber';
    }

    return `
      <tr>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 4px;">${timeStr}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.temp.toFixed(1)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.rh}%</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.dewPoint.toFixed(1)}</td>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 4px;">${log.wbgt.toFixed(1)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.wind.toFixed(0)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.gusts.toFixed(0)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${(log.visibility / 1000).toFixed(1)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.uv.toFixed(1)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 4px;">${log.aqi.toFixed(0)}</td>
        <td class="${statusCellClass}" style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 4px;">${status}</td>
      </tr>
    `;
  }).join('');

  // Combine content in Word-compatible HTML format
  const wordContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>RCO Daily Environmental Operations Brief</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      color: #0f172a;
      line-height: 1.4;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      background-color: #FF4E02;
      margin-bottom: 12pt;
    }
    .header-table td {
      padding: 12px;
      color: #ffffff;
      border: none;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15pt;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .meta-table td {
      padding: 8px;
      border: 1px solid #e2e8f0;
      font-size: 9.5pt;
      vertical-align: top;
    }
    .section-title {
      font-size: 13pt;
      font-weight: bold;
      color: #FF4E02;
      margin-top: 16pt;
      margin-bottom: 8pt;
      border-bottom: 1.5px solid #FF4E02;
      padding-bottom: 2px;
      text-transform: uppercase;
    }
    .status-block {
      border: 1.5px solid #0f172a;
      padding: 10px;
      margin-bottom: 12pt;
      background-color: #fdfdfd;
    }
    .status-title {
      font-size: 10.5pt;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .status-RED { color: #dc2626; }
    .status-AMBER { color: #d97706; }
    .status-GREEN { color: #16a34a; }
    
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
    }
    .grid-table td {
      vertical-align: top;
      padding: 8px;
      border: 1px solid #cbd5e1;
      background-color: #ffffff;
    }
    .grid-card-title {
      font-weight: bold;
      font-size: 10pt;
      background-color: #FF4E02;
      color: #ffffff;
      padding: 5px 8px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .directives-list {
      margin-top: 5px;
      padding-left: 15px;
    }
    .directives-list li {
      margin-bottom: 4px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .data-table th {
      background-color: #FF4E02;
      color: #ffffff;
      font-weight: bold;
      border: 1px solid #cbd5e1;
      padding: 5px;
      font-size: 9pt;
      text-transform: uppercase;
    }
    .data-table td {
      border: 1px solid #e2e8f0;
      padding: 4px;
      font-size: 9pt;
    }
    .cell-red { background-color: #fee2e2; color: #b91c1c; }
    .cell-amber { background-color: #fef3c7; color: #b45309; }
    .cell-green { background-color: #ecfdf5; color: #047857; }
  </style>
</head>
<body>

  <!-- Header Banner -->
  <table class="header-table">
    <tr>
      <td>
        <div style="font-size: 9pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.85);">X-Range Tactical Safety Network</div>
        <div style="font-size: 15pt; font-weight: bold; text-transform: uppercase; margin-top: 2px;">Daily Environmental Operations Brief</div>
      </td>
      <td style="text-align: right; font-size: 9pt; vertical-align: middle;">
        <div>REPORT TYPE: Daily RCO Brief</div>
        <div>SECURITY: Open Source Release</div>
      </td>
    </tr>
  </table>

  <!-- Metadata Table -->
  <table class="meta-table">
    <tr>
      <td style="width: 60%;">
        <strong>Target Date:</strong> ${targetDateLabel}<br/>
        <strong>Station:</strong> ${activeStationName} (Abu Al Abyad Island, UAE)<br/>
        <strong>Data Mode:</strong> ${systemMode}
      </td>
      <td style="width: 40%; border-left: 1px solid #cbd5e1;">
        <strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} GST<br/>
        <strong>Verification Hash:</strong> ${secureHash}
      </td>
    </tr>
  </table>

  <!-- Section 1: Executive Summary -->
  <div class="section-title">1. Executive Operations Advisory</div>
  
  <div class="status-block">
    <div class="status-title">
      Rating: &nbsp;
      <span class="${overallStatus.includes('RED') ? 'status-RED' : overallStatus.includes('AMBER') ? 'status-AMBER' : 'status-GREEN'}">
        ${overallStatus}
      </span>
    </div>
    <div style="font-weight: bold; color: #334155; margin-top: 4px;">
      Directive: ${overallInstruction}
    </div>
  </div>

  <div style="margin-top: 10px; margin-bottom: 12pt;">
    <strong style="text-transform: uppercase; font-size: 9pt; color: #475569;">Operational Directives & Action Items:</strong>
    <ul class="directives-list">
      <li>Thermal Exposure: Ensure mandatory hydration splits matched to Wet Bulb Globe Temperature (WBGT) flag ratings. Provide shaded rest structures with active cooling.</li>
      <li>Wind Limits: Secure all sensitive flight equipment, drone ground control arrays, and tall targets if wind gusts exceed safe limits.</li>
      <li>Midday Break Compliance: In date ranges from June 15 to Sept 15, completely cease range activities between 12:30 and 15:00 GST in compliance with UAE MoHRE Midday Work Ban guidelines.</li>
      <li>ADOSH Lightning Guidelines: In the event of lightning activity or storm cell alerts inside the 10km boundary, immediately trigger emergency strobe sirens and evacuate all range crews to solid masonry shelter facilities. Wait at least 30 minutes after the last observed lightning strike or official alert clear before training resumption.</li>
    </ul>
  </div>

  <!-- Section 2: Diurnal Windows -->
  <div class="section-title">2. Diurnal Operational Windows (RCO Scheduling)</div>
  <table class="grid-table">
    <tr>
      <td style="border-left: 4px solid #16a34a; width: 50%;">
        <div class="grid-card-title" style="background-color: #16a34a;">Safe Operating Windows</div>
        <p style="margin-top: 4px; font-weight: bold;">${safeWindowText}</p>
        <p style="font-size: 9pt; color: #475569; margin-top: 4px;">• Standard training profiles cleared for execution. Maintain ordinary safety rosters.</p>
      </td>
      <td style="border-left: 4px solid #d97706; width: 50%;">
        <div class="grid-card-title" style="background-color: #d97706;">Caution Operating Windows</div>
        <p style="margin-top: 4px; font-weight: bold;">${cautionWindowText}</p>
        <p style="font-size: 9pt; color: #475569; margin-top: 4px;">• Restricted operations. Rigorous supervisor control, mandatory hydration splits, and shaded rest required.</p>
      </td>
    </tr>
  </table>

  <table class="grid-table" style="margin-top: -6pt;">
    <tr>
      <td style="border-left: 4px solid #dc2626; width: 100%;">
        <div class="grid-card-title" style="background-color: #dc2626;">Suspension / Halt Windows (RED)</div>
        <p style="margin-top: 4px; font-weight: bold;">${haltWindowText}</p>
        <p style="font-size: 9pt; color: #475569; margin-top: 4px;">• Critical environmental limits exceeded. Suspension of all range, vehicular, and outdoor operations mandatory.</p>
      </td>
    </tr>
  </table>

  <!-- Section 3: Daily Extremes -->
  <div class="section-title">3. Diurnal Environmental Extremes</div>
  <table class="grid-table">
    <tr>
      <td style="width: 50%;">
        <div class="grid-card-title">Thermal Extremes</div>
        <p style="margin-bottom: 4px;"><strong>Peak Temperature:</strong> ${maxTemp.toFixed(1)}°C at ${maxTempTime}</p>
        <p><strong>Peak Heat Stress (WBGT):</strong> <span class="status-RED" style="font-weight: bold;">${maxWbgt.toFixed(1)}°C</span> at ${maxWbgtTime}</p>
      </td>
      <td style="width: 50%;">
        <div class="grid-card-title">Aerodynamic & Solar Extremes</div>
        <p style="margin-bottom: 4px;"><strong>Peak Wind Gusts:</strong> ${maxGust.toFixed(0)} km/h at ${maxGustTime}</p>
        <p style="margin-bottom: 4px;"><strong>Max Sustained Wind:</strong> ${maxWind.toFixed(0)} km/h at ${maxWindTime}</p>
        <p><strong>Peak UV Radiation:</strong> <span class="status-AMBER" style="font-weight: bold;">${maxUv.toFixed(1)} UV</span> at ${maxUvTime}</p>
      </td>
    </tr>
  </table>

  <!-- Section 4: Flight & Ballistics -->
  <div class="section-title">4. Flight Operations & Ballistics Assessment</div>
  <table class="grid-table">
    <tr>
      <td style="width: 50%;">
        <div class="grid-card-title">Drone Flight Readiness</div>
        <p style="margin-bottom: 4px;"><strong>Rating:</strong> 
          <span class="${droneRating.includes('HALT') ? 'status-RED' : droneRating.includes('CAUTION') ? 'status-AMBER' : 'status-GREEN'}" style="font-weight: bold;">
            ${droneRating}
          </span>
        </p>
        <p style="font-size: 9pt; color: #334155;">${droneInstruction}</p>
      </td>
      <td style="width: 50%;">
        <div class="grid-card-title">Ballistics Wind Drift Warning</div>
        <p style="margin-bottom: 4px;"><strong>Crosswind Drift:</strong> 
          <span class="${maxGust >= 30 ? 'status-AMBER' : 'status-GREEN'}" style="font-weight: bold;">
            ${maxGust >= 30 ? 'ELEVATED RISK' : 'NEGLIGIBLE'}
          </span>
        </p>
        <p style="font-size: 9pt; color: #334155;">${ballisticsCrosswindDrift}</p>
      </td>
    </tr>
  </table>

  <!-- Section 5: Hourly Table -->
  <div class="section-title">5. Hourly Environmental Log Database</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Time</th>
        <th>Temp (°C)</th>
        <th>Hum (%)</th>
        <th>Dew Pt (°C)</th>
        <th>WBGT (°C)</th>
        <th>Wind (km/h)</th>
        <th>Gust (km/h)</th>
        <th>Vis (km)</th>
        <th>UV Index</th>
        <th>AQI (PM10)</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <hr style="border: none; border-top: 1px solid #cbd5e1; margin-top: 25pt; margin-bottom: 5pt;" />
  <div style="text-align: center; font-size: 8.5pt; color: #64748b; font-weight: bold; text-transform: uppercase;">
    X-Range Tactical Safety Network • RCO Daily Briefing Document • Public Release
  </div>

</body>
</html>
  `;

  // Create file blob and trigger download
  const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
