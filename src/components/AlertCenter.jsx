import React, { useState, useEffect } from 'react';
import { 
  X, Bell, AlertTriangle, ShieldCheck, Mail, MessageSquare, Radio, Send, CheckCheck, 
  UserCheck, AlertCircle, Clock, Volume2, ShieldAlert, Check 
} from 'lucide-react';
import { evaluateSafety, calculateWBGT } from '../utils/safetyEngine';
import { stationsList } from './XRangeMap';

export default function AlertCenter({ 
  isOpen, 
  onClose, 
  isSimulated, 
  apiData, 
  simulatedLightning,
  broadcastHistory,
  onAddBroadcast
}) {
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' or 'dispatch' or 'history'
  const [dispatchChannel, setDispatchChannel] = useState('whatsapp'); // 'whatsapp', 'sms', 'email', 'radio'
  const [dispatchGroup, setDispatchGroup] = useState('officers'); // 'officers', 'hands', 'rd_teams', 'supervisors'
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('none');

  // Broadcast Channels Definitions
  const channels = {
    whatsapp: { name: 'WhatsApp Group Chat', icon: MessageSquare, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    sms: { name: 'SMS Broadcast', icon: MessageSquare, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    email: { name: 'Email Dispatch', icon: Mail, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    radio: { name: 'Radio Audio Alert', icon: Radio, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  };

  // Target Groups Definitions
  const groups = {
    officers: { name: 'X-Range Range Officers Group', size: 12 },
    hands: { name: 'All Field Personnel Broadcast', size: 145 },
    rd_teams: { name: 'R&D Trial Personnel Group', size: 28 },
    supervisors: { name: 'Safety Supervisors Committee', size: 8 }
  };

  // Message templates
  const templates = {
    lightning: {
      label: '⚡ Evacuate (Lightning strike)',
      text: '⚡ RED ALERT: Active lightning strikes detected over X-Range. Suspend all live fire training, power down range equipment, and evacuate all personnel to hardened shelters immediately.'
    },
    midday: {
      label: '☀️ Midday Ban Stand Down',
      text: '☀️ HSE COMPLIANCE NOTICE: Midday Work Ban is now active (12:30 - 15:00 GST). All outdoor activities and drills must stand down immediately. Seek air-conditioned shelter.'
    },
    hydration: {
      label: '💧 Heat / Hydration Advisory',
      text: '💧 HYDRATION ADVISORY: WBGT thermal stress index has crossed safety limits. Implement work/rest splits (40 mins work / 20 mins rest) and mandate 1.0L/hr chilled hydration.'
    },
    drone: {
      label: '🛸 Drone Flight Suspension',
      text: '🛸 FLIGHT SAFETY: Wind velocities exceed 35 km/h. High aerodynamic drift risk. Drone sorties are suspended until gusts drop below safe operational threshold limits.'
    },
    sandstorm: {
      label: '😷 Sandstorm / Dust Warning',
      text: '😷 DUST HAZARD: Suspended PM10 particulate levels exceed 150 ug/m3. Visibility is under 3.0km. Mandate respiratory filters and suspend high-velocity ballistics trials.'
    }
  };

  // Handle template selection
  const handleTemplateChange = (key) => {
    setActiveTemplate(key);
    if (key === 'none') {
      setCustomMessage('');
    } else {
      setCustomMessage(templates[key].text);
    }
  };

  // Compile active alerts across all 4 stations
  const getActiveStationAlerts = () => {
    if (!apiData) return [];
    
    const alerts = [];
    
    // Evaluate simulated lightning
    if (simulatedLightning || (apiData.ncmWarnings && apiData.ncmWarnings.some(w => w.category === 'LIGHTNING'))) {
      alerts.push({
        id: 'global-lightning',
        station: 'GLOBAL SENSORS',
        type: 'RED',
        category: 'LIGHTNING',
        title: '⚡ LIGHTNING STRIKE EMERGENCY',
        message: 'Active lightning strikes detected over the island. Evacuate training ranges immediately.',
        timestamp: new Date().toISOString()
      });
    }

    // Evaluate each station
    stationsList.forEach(s => {
      const readings = isSimulated ? s.getReadings(apiData.current) : apiData.current;
      if (!readings) return;

      const evalResult = evaluateSafety(readings);
      
      // Add individual breaches to alerts
      const temp = readings.temperature_2m || 0;
      const rh = readings.relative_humidity_2m || 0;
      const wind = readings.wind_speed_10m || 0;
      const gusts = readings.wind_gusts_10m || wind * 1.3;
      const uv = readings.uv_index || 0;
      const pm10 = readings.pm10 || 50;
      const visibility = readings.visibility || 10000;

      // 1. Temperature Limit
      if (temp >= 43) {
        alerts.push({
          id: `${s.id}-temp-red`,
          station: s.name,
          type: 'RED',
          category: 'HEAT',
          title: '🔥 CRITICAL HEAT STRESS',
          message: `Temperature is at ${temp.toFixed(1)}°C. ADOSH outdoor work ban in active effect.`,
          timestamp: new Date().toISOString()
        });
      } else if (temp >= 40) {
        alerts.push({
          id: `${s.id}-temp-amber`,
          station: s.name,
          type: 'AMBER',
          category: 'HEAT',
          title: '☀️ HIGH TEMPERATURE HAZARD',
          message: `Temperature is at ${temp.toFixed(1)}°C. Implement strict work/rest splits.`,
          timestamp: new Date().toISOString()
        });
      }

      // 2. WBGT Stress
      const wbgt = calculateWBGT(temp, rh, wind, uv);
      if (wbgt >= 30.0) {
        alerts.push({
          id: `${s.id}-wbgt-red`,
          station: s.name,
          type: 'RED',
          category: 'HEAT',
          title: '🥵 CRITICAL WBGT EXPOSURE',
          message: `Wet Bulb Globe Temp is ${wbgt.toFixed(1)}°C. Mandate electrolyte rehydration.`,
          timestamp: new Date().toISOString()
        });
      }

      // 3. Wind speed & Gust limits
      if (gusts >= 50 || wind >= 38) {
        alerts.push({
          id: `${s.id}-wind-red`,
          station: s.name,
          type: 'RED',
          category: 'WIND',
          title: '💨 GALE FORCE WIND LIMIT',
          message: `Wind speed is ${wind.toFixed(0)} km/h with gusts to ${gusts.toFixed(0)} km/h. Firing suspended.`,
          timestamp: new Date().toISOString()
        });
      } else if (wind >= 25 || gusts >= 35) {
        alerts.push({
          id: `${s.id}-wind-amber`,
          station: s.name,
          type: 'AMBER',
          category: 'WIND',
          title: '💨 HIGH WIND DRIFT WARNING',
          message: `Wind gusts are ${gusts.toFixed(0)} km/h. Drone sorties & optical targeting at high drift risk.`,
          timestamp: new Date().toISOString()
        });
      }

      // 4. Visibility limits
      if (visibility < 1000) {
        alerts.push({
          id: `${s.id}-vis-red`,
          station: s.name,
          type: 'RED',
          category: 'VISIBILITY',
          title: '🌫️ SEVERE VISIBILITY RESTRICTION',
          message: `Range visibility drops below 1.0 km. Cease all live fire training.`,
          timestamp: new Date().toISOString()
        });
      } else if (visibility < 3000) {
        alerts.push({
          id: `${s.id}-vis-amber`,
          station: s.name,
          type: 'AMBER',
          category: 'VISIBILITY',
          title: '🌫️ HAZE / DUST RESTRICTION',
          message: `Range visibility drops to ${(visibility/1000).toFixed(1)} km. Monitor long-range targets.`,
          timestamp: new Date().toISOString()
        });
      }

      // 5. PM10 Air Quality limits
      if (pm10 >= 150) {
        alerts.push({
          id: `${s.id}-pm10-red`,
          station: s.name,
          type: 'RED',
          category: 'AQI',
          title: '😷 HAZARDOUS DUST STORM',
          message: `PM10 particulates are ${pm10} ug/m3. Limit outdoor exposure, use protective filters.`,
          timestamp: new Date().toISOString()
        });
      }
    });

    return alerts;
  };

  const activeAlerts = getActiveStationAlerts();

  // Send Simulated Broadcast
  const handleDispatch = (e) => {
    e.preventDefault();
    if (!customMessage.trim()) return;

    setIsSending(true);

    // Simulate sending time over API gateway
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      
      const newBroadcast = {
        id: Date.now(),
        channel: dispatchChannel,
        group: dispatchGroup,
        message: customMessage,
        timestamp: new Date().toISOString()
      };

      onAddBroadcast(newBroadcast);

      // Clean up success status and form after 2 seconds
      setTimeout(() => {
        setSentSuccess(false);
        setCustomMessage('');
        setActiveTemplate('none');
        setActiveTab('history'); // switch to history to view the sent item
      }, 1500);

    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[3px] animate-fade-in select-none">
      {/* Tap outside to close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Slide-over Container */}
      <div className="relative w-full max-w-[440px] h-full bg-cardDarkSlate/95 border-l border-slate-800 shadow-2xl flex flex-col justify-between z-10 animate-slide-left select-none overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/80 flex items-center justify-between flex-none">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-edgeOrange/10 text-edgeOrange relative">
              <Bell className="w-5 h-5" />
              {activeAlerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-stopRed rounded-full border-2 border-cardDarkSlate animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-textIceWhite uppercase tracking-wider leading-none">
                Tactical Alert Center
              </h2>
              <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 block">
                Safety Dispatcher & Monitoring Hub
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-bgDeepSpace/40 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 border-b border-slate-800/80 flex-none bg-bgDeepSpace/20 text-xs font-black uppercase text-center tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`py-3.5 border-b-2 cursor-pointer transition-all ${
              activeTab === 'alerts'
                ? 'border-edgeOrange text-edgeOrange bg-edgeOrange/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Active Alarms ({activeAlerts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            className={`py-3.5 border-b-2 cursor-pointer transition-all ${
              activeTab === 'dispatch'
                ? 'border-edgeOrange text-edgeOrange bg-edgeOrange/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Dispatcher
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3.5 border-b-2 cursor-pointer transition-all ${
              activeTab === 'history'
                ? 'border-edgeOrange text-edgeOrange bg-edgeOrange/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Broadcasts ({broadcastHistory.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-grow overflow-y-auto p-4 no-scrollbar bg-slate-950/20">
          
          {/* TAB 1: ACTIVE WEATHER ALARMS LOG */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1.5 text-slate-350">
                <span className="text-[10px] font-black uppercase tracking-wider">Station Limits Violations</span>
                <span className="text-[9px] text-slate-500 font-bold font-mono">STATUS: AUDITING</span>
              </div>

              {activeAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-550 border border-dashed border-slate-800/80 rounded-xl bg-slate-950/10">
                  <ShieldCheck className="w-12 h-12 text-safetyGreen/40 mb-3 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">All Ranges Secure</p>
                  <p className="text-[9.5px] font-medium text-slate-500 mt-1 uppercase text-center px-6 leading-relaxed">
                    No environmental safety thresholds breached. Standard operation parameters applied.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeAlerts.map((alarm, idx) => (
                    <div 
                      key={idx}
                      className={`border p-3.5 rounded-xl text-left relative overflow-hidden flex flex-col justify-between ${
                        alarm.type === 'RED' 
                          ? 'bg-red-500/5 border-red-500/30 text-red-200' 
                          : 'bg-amber-500/5 border-amber-500/20 text-amberAlert'
                      }`}
                    >
                      {/* Left border highlight indicator */}
                      <span className={`absolute top-0 left-0 bottom-0 w-1 ${
                        alarm.type === 'RED' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />

                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] font-black uppercase font-mono bg-bgDeepSpace/85 px-1.5 py-0.5 rounded border border-slate-800">
                          {alarm.station}
                        </span>
                        <span className="text-[7.5px] font-bold text-slate-500 font-mono flex items-center space-x-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>LIVE MONITOR</span>
                        </span>
                      </div>

                      <h4 className="text-[11px] font-black uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                        <AlertCircle className={`w-3.5 h-3.5 ${alarm.type === 'RED' ? 'text-red-400' : 'text-amber-400'}`} />
                        <span>{alarm.title}</span>
                      </h4>

                      <p className="text-[9.5px] leading-relaxed text-slate-300 font-medium">
                        {alarm.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BROADSCAST DISPATCHER FORM */}
          {activeTab === 'dispatch' && (
            <form onSubmit={handleDispatch} className="space-y-4">
              
              {/* Channel Selector */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  Select Dispatch Channel:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.keys(channels).map((key) => {
                    const ch = channels[key];
                    const Icon = ch.icon;
                    const isSelected = dispatchChannel === key;

                    return (
                      <div
                        key={key}
                        onClick={() => setDispatchChannel(key)}
                        className={`p-2.5 border rounded-lg cursor-pointer flex items-center space-x-2 transition-all select-none ${
                          isSelected 
                            ? 'border-edgeOrange bg-edgeOrange/5 text-white' 
                            : 'border-slate-800 bg-bgDeepSpace/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className={`p-1.5 rounded ${isSelected ? 'bg-edgeOrange/20 text-edgeOrange' : 'bg-slate-800'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[9.5px] font-black uppercase tracking-wider leading-none">
                          {key === 'whatsapp' ? 'WhatsApp' : key.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recipient / Group Selector */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  Target Broadcast Group:
                </label>
                <select
                  value={dispatchGroup}
                  onChange={(e) => setDispatchGroup(e.target.value)}
                  className="bg-bgDeepSpace text-slate-200 border border-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none rounded-lg w-full cursor-pointer hover:border-slate-700"
                >
                  {Object.keys(groups).map((key) => (
                    <option key={key} value={key} className="bg-cardDarkSlate text-slate-200">
                      {groups[key].name} ({groups[key].size} users)
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Quick Selection */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide flex items-center justify-between">
                  <span>Autofill Alert Template:</span>
                  <span className="text-[8px] text-edgeOrange font-black">QUICK SELECT</span>
                </label>
                <div className="flex flex-col space-y-1">
                  <div
                    onClick={() => handleTemplateChange('none')}
                    className={`px-3 py-1.5 border rounded-lg cursor-pointer text-[9.5px] font-black uppercase transition-colors ${
                      activeTemplate === 'none'
                        ? 'border-edgeOrange bg-edgeOrange/5 text-white'
                        : 'border-slate-855 bg-bgDeepSpace/20 text-slate-400 hover:text-slate-300 hover:border-slate-750'
                    }`}
                  >
                    📝 Custom Blank Message
                  </div>
                  {Object.keys(templates).map((key) => {
                    const temp = templates[key];
                    const isSelected = activeTemplate === key;

                    return (
                      <div
                        key={key}
                        onClick={() => handleTemplateChange(key)}
                        className={`px-3 py-1.5 border rounded-lg cursor-pointer text-[9.5px] font-black uppercase text-left transition-colors ${
                          isSelected 
                            ? 'border-edgeOrange bg-edgeOrange/5 text-white' 
                            : 'border-slate-855 bg-bgDeepSpace/20 text-slate-400 hover:text-slate-300 hover:border-slate-750'
                        }`}
                      >
                        {temp.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Message Body Input */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide flex justify-between">
                  <span>Message Body Text:</span>
                  <span className="font-mono text-slate-500 text-[8.5px]">{customMessage.length} chars</span>
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter custom safety brief or broadcast instruction..."
                  className="bg-bgDeepSpace text-slate-200 border border-slate-800 hover:border-slate-750 p-3 text-xs font-mono rounded-lg w-full h-32 focus:border-edgeOrange outline-none resize-none"
                  disabled={isSending || sentSuccess}
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                {sentSuccess ? (
                  <div className="bg-safetyGreen/15 border border-safetyGreen/30 text-safetyGreen py-2.5 rounded-lg text-center flex items-center justify-center space-x-2 text-[10.5px] font-black uppercase tracking-widest animate-bounce">
                    <Check className="w-4 h-4" />
                    <span>BROADCAST DISPATCHED SUCCESSFULLY</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isSending || !customMessage.trim()}
                    className="w-full bg-edgeOrange hover:bg-orange-600 border border-orange-700 text-white font-black py-2.5 text-[10.5px] uppercase tracking-widest flex items-center justify-center space-x-2 rounded-lg cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-md shadow-edgeOrange/10"
                  >
                    {isSending ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>
                          {dispatchChannel === 'whatsapp' ? 'CONNECTING TO WHATSAPP API...' :
                           dispatchChannel === 'sms' ? 'TRANSMITTING CELLULAR SMS...' :
                           dispatchChannel === 'email' ? 'SENDING SMTP EMAIL DISPATCH...' :
                           'BROADCASTING AUDIO CARRIER...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Broadcast Alert</span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </form>
          )}

          {/* TAB 3: BROADCAST HISTORY / SENT LOGS */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1 text-slate-350">
                <span className="text-[10px] font-black uppercase tracking-wider">Dispatched Broadcast Log</span>
                <span className="text-[9px] text-slate-500 font-bold font-mono">COUNT: {broadcastHistory.length}</span>
              </div>

              {broadcastHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-550 border border-dashed border-slate-800/80 rounded-xl bg-slate-950/10">
                  <Clock className="w-11 h-11 text-slate-700/60 mb-3 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">No Dispatches Sent</p>
                  <p className="text-[9.5px] font-medium text-slate-500 mt-1 uppercase text-center px-6 leading-relaxed">
                    No safety alerts or message broadcasts have been dispatched during this console session.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pr-1">
                  {[...broadcastHistory].reverse().map((log) => {
                    const channelInfo = channels[log.channel] || channels.sms;
                    const groupInfo = groups[log.group] || { name: 'Recipient Group', size: 10 };
                    const isWhatsApp = log.channel === 'whatsapp';

                    // 1. WhatsApp styled group chat bubble dispatch
                    if (isWhatsApp) {
                      return (
                        <div key={log.id} className="flex flex-col space-y-1 text-left">
                          {/* Chat Date Divider */}
                          <div className="flex justify-center my-1.5">
                            <span className="bg-slate-900 border border-slate-805 text-slate-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none tracking-wider">
                              WhatsApp API Gateway • {new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Chat Box Container */}
                          <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 flex flex-col space-y-2 relative overflow-hidden">
                            {/* Group Tag Info */}
                            <div className="flex justify-between items-center text-[8.5px] font-bold text-slate-500 border-b border-slate-900 pb-1.5">
                              <span className="text-emerald-400 flex items-center space-x-1.5 font-black uppercase">
                                <MessageSquare className="w-3 h-3 text-emerald-400" />
                                <span>{groupInfo.name}</span>
                              </span>
                              <span className="font-mono text-slate-600">Dispatched: {groupInfo.size} users</span>
                            </div>

                            {/* WhatsApp Green Chat Bubble mockup */}
                            <div className="flex justify-end pr-1 pl-6 py-1 select-text">
                              <div className="bg-[#054735] border border-[#0d5945] rounded-xl rounded-tr-none p-2.5 max-w-full text-white relative shadow shadow-black/20">
                                {/* Triangle arrow for chat bubble */}
                                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#054735] border-t border-r border-[#0d5945] transform translate-x-1.2 rotate-45" style={{ transformOrigin: 'top left', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
                                
                                <p className="text-[10px] text-emerald-300 font-extrabold uppercase leading-none mb-1">
                                  X-Range Dispatch Officer
                                </p>
                                <p className="text-[9.5px] leading-relaxed font-semibold whitespace-pre-wrap break-words">
                                  {log.message}
                                </p>
                                
                                <div className="flex items-center justify-end space-x-1 text-[8.5px] text-emerald-300/60 font-mono mt-1 leading-none font-bold">
                                  <span>
                                    {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 2. Generic SMS / Email / Radio Broadcast Box
                    return (
                      <div key={log.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 text-left flex flex-col justify-between space-y-2 relative overflow-hidden">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase pb-1.5 border-b border-slate-850">
                          <span className={`${channelInfo.color} px-2 py-0.5 rounded border flex items-center space-x-1`}>
                            <channelInfo.icon className="w-3 h-3" />
                            <span>{channelInfo.name}</span>
                          </span>
                          <span className="font-mono text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-[9.5px] font-bold text-slate-400">
                          TARGET: <span className="text-slate-200 font-extrabold uppercase">{groupInfo.name}</span> ({groupInfo.size} users)
                        </div>

                        <p className="text-[9.5px] leading-relaxed font-semibold text-slate-300 bg-bgDeepSpace/40 p-2.5 rounded-lg border border-slate-855 whitespace-pre-wrap select-text">
                          {log.message}
                        </p>
                        
                        <div className="flex justify-end items-center text-[8px] text-slate-500 font-bold uppercase space-x-1 select-none">
                          <UserCheck className="w-3.5 h-3.5 text-safetyGreen" />
                          <span>SIMULATED DELIVERY DISPATCHED</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 flex-none text-[8.5px] text-slate-500 font-bold uppercase tracking-wider text-center flex justify-between select-none">
          <span>CONSOLE USER: ADMIN_1</span>
          <span className="flex items-center space-x-1 text-slate-400">
            <Volume2 className="w-3 h-3 text-slate-400" />
            <span>RADIO GATEWAY CONNECTED</span>
          </span>
        </div>

      </div>
    </div>
  );
}
