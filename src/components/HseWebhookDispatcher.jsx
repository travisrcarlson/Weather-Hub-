import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Send, 
  MessageSquare, 
  Key, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Settings, 
  Phone, 
  Globe, 
  Trash2, 
  RefreshCw,
  Zap,
  Info,
  ChevronRight
} from 'lucide-react';
import { 
  verifyHseSecurityPin, 
  setHseSecurityPin, 
  getHseSecurityPin,
  getActiveHseDirective, 
  getHseDirectiveHistory, 
  broadcastHseDirective, 
  clearActiveHseDirective, 
  getWhatsAppConfig, 
  saveWhatsAppConfig, 
  sendWhatsAppMessage,
  formatWhatsAppDirective
} from '../services/hseBroadcastService';

export default function HseWebhookDispatcher() {
  // Authentication State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Active Directive & History
  const [activeDirective, setActiveDirective] = useState(getActiveHseDirective());
  const [history, setHistory] = useState(getHseDirectiveHistory());

  // Composer Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('CAUTION');
  const [category, setCategory] = useState('HEAT');
  const [author, setAuthor] = useState('RSO-1 / Lead Safety Officer');
  const [sendToDashboard, setSendToDashboard] = useState(true);
  const [sendToWhatsApp, setSendToWhatsApp] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // WhatsApp Webhook Configuration State
  const [waConfig, setWaConfig] = useState(getWhatsAppConfig());
  const [isTestingWa, setIsTestingWa] = useState(false);
  const [waTestResult, setWaTestResult] = useState(null);
  const [waConfigSaved, setWaConfigSaved] = useState(false);

  // Synchronize on external updates
  useEffect(() => {
    const handleDirectiveChange = () => {
      setActiveDirective(getActiveHseDirective());
      setHistory(getHseDirectiveHistory());
    };
    const handleWaConfigChange = () => {
      setWaConfig(getWhatsAppConfig());
    };

    window.addEventListener('xrange-hse-directive', handleDirectiveChange);
    window.addEventListener('xrange-whatsapp-config', handleWaConfigChange);
    window.addEventListener('storage', handleDirectiveChange);

    return () => {
      window.removeEventListener('xrange-hse-directive', handleDirectiveChange);
      window.removeEventListener('xrange-whatsapp-config', handleWaConfigChange);
      window.removeEventListener('storage', handleDirectiveChange);
    };
  }, []);

  // PIN Verification Handler
  const handlePinSubmit = (e) => {
    if (e) e.preventDefault();
    if (verifyHseSecurityPin(enteredPin)) {
      setIsUnlocked(true);
      setPinError('');
      setEnteredPin('');
    } else {
      setPinError('Invalid Security PIN. Access Denied.');
      setEnteredPin('');
    }
  };

  // Change PIN Handler
  const handleChangePin = () => {
    const res = setHseSecurityPin(newPin);
    if (res.success) {
      setPinChangeSuccess(true);
      setNewPin('');
      setTimeout(() => {
        setPinChangeSuccess(false);
        setIsChangingPin(false);
      }, 2000);
    } else {
      setPinError(res.error);
    }
  };

  // Broadcast Handler
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert('Please provide both a Title and Directive Message.');
      return;
    }

    setIsBroadcasting(true);
    setBroadcastResult(null);

    const res = await broadcastHseDirective({
      title,
      message,
      severity,
      category,
      author,
      sendToDashboard,
      sendToWhatsApp: sendToWhatsApp && waConfig.enabled
    });

    setIsBroadcasting(false);
    setBroadcastResult(res);

    if (res.success) {
      setActiveDirective(res.directive);
      setHistory(getHseDirectiveHistory());
      // Reset text inputs
      setTitle('');
      setMessage('');
      setTimeout(() => setBroadcastResult(null), 5000);
    }
  };

  // Clear Active Directive Handler
  const handleClearDirective = () => {
    clearActiveHseDirective();
    setActiveDirective(null);
  };

  // Save WhatsApp Config Handler
  const handleSaveWaConfig = () => {
    saveWhatsAppConfig(waConfig);
    setWaConfigSaved(true);
    setTimeout(() => setWaConfigSaved(false), 2500);
  };

  // Send Test Ping Handler
  const handleSendTestPing = async () => {
    setIsTestingWa(true);
    setWaTestResult(null);

    const testMsg = `🔔 *[XRANGE HSE SYSTEM TEST]* 🔔\n` +
                    `📍 Abu Al Abyad Island HQ\n` +
                    `⏱️ Timestamp: ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai' })} GST\n\n` +
                    `✅ WhatsApp Webhook connection is verified & active.\n` +
                    `Automated range safety notifications are armed.\n\n` +
                    `_XRANGE Weather & Safety Portal_`;

    const res = await sendWhatsAppMessage(testMsg);
    setIsTestingWa(false);
    setWaTestResult(res);
    setTimeout(() => setWaTestResult(null), 6000);
  };

  // ----------------------------------------------------
  // RENDER: Locked PIN Screen
  // ----------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-950/70 select-none">
        <div className="w-full max-w-md bg-cardDarkSlate border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#80808008_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-edgeOrange/10 border border-edgeOrange/30 flex items-center justify-center mb-4 text-edgeOrange shadow-lg shadow-edgeOrange/5">
              <Lock className="w-7 h-7" />
            </div>

            <h2 className="text-base font-black text-textIceWhite uppercase tracking-wider mb-1">
              HSE Officer Security Clearance
            </h2>
            <p className="text-xs text-slate-400 mb-6 max-w-xs leading-relaxed">
              Enter your 4-digit Range Safety Officer PIN to unlock the live directive broadcaster and WhatsApp webhook dispatcher.
            </p>

            {/* PIN Entry Form */}
            <form onSubmit={handlePinSubmit} className="w-full space-y-4">
              <div className="relative">
                <input 
                  type="password"
                  maxLength={8}
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  placeholder="Enter RSO PIN"
                  className="w-full bg-bgDeepSpace/80 border border-slate-700/60 rounded-xl px-4 py-3 text-center text-xl font-mono font-black text-textIceWhite tracking-[0.4em] focus:border-edgeOrange outline-none transition-all"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="flex items-center justify-center space-x-1.5 text-stopRed text-xs font-bold animate-shake">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-edgeOrange hover:bg-orange-600 text-white font-black uppercase text-xs tracking-wider py-3 rounded-xl transition-all shadow-md shadow-edgeOrange/20 cursor-pointer flex items-center justify-center space-x-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock HSE Controls</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>DEFAULT RSO PIN: <strong className="text-slate-300">9988</strong></span>
              <span className="flex items-center space-x-1 text-safetyGreen">
                <ShieldCheck className="w-3 h-3" />
                <span>ADOSH COP 11.0</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Unlocked HSE Dispatcher Console
  // ----------------------------------------------------
  return (
    <div className="w-full h-full flex flex-col justify-between space-y-4 select-none overflow-y-auto no-scrollbar font-sans pr-1">
      
      {/* Top Console Bar */}
      <div className="flex justify-between items-center bg-cardDarkSlate border border-slate-800 rounded-xl px-4 py-2.5 flex-none">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-edgeOrange/20 border border-edgeOrange/40 flex items-center justify-center text-edgeOrange">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-black text-textIceWhite uppercase tracking-wider leading-none">
                HSE DIRECTIVES & WHATSAPP DISPATCHER
              </h2>
              <span className="bg-safetyGreen/20 border border-safetyGreen/50 text-safetyGreen text-[8px] font-mono font-black px-1.5 py-0.5 rounded leading-none">
                AUTHORITY: UNLOCKED
              </span>
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">
              Live broadcast messages to the Outdoor TV Tactical Console and range WhatsApp group channel.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Security Change PIN Toggle */}
          <button
            onClick={() => setIsChangingPin(!isChangingPin)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-bgDeepSpace/60 hover:border-slate-500 text-slate-300 text-[9.5px] font-bold uppercase transition cursor-pointer"
          >
            <Key className="w-3 h-3 text-edgeOrange" />
            <span>{isChangingPin ? 'Cancel' : 'Change PIN'}</span>
          </button>

          {/* Lock / Logout */}
          <button
            onClick={() => setIsUnlocked(false)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-red-300 text-[9.5px] font-black uppercase transition cursor-pointer"
          >
            <Lock className="w-3 h-3 text-red-400" />
            <span>Lock Console</span>
          </button>
        </div>
      </div>

      {/* Change PIN Dropdown Panel */}
      {isChangingPin && (
        <div className="bg-cardDarkSlate border border-edgeOrange/40 rounded-xl p-3 flex-none flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-edgeOrange" />
            <span className="text-xs font-bold text-slate-200">Update Officer Security PIN:</span>
          </div>
          <div className="flex items-center space-x-2">
            <input 
              type="password"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="New 4-digit PIN"
              className="bg-bgDeepSpace/80 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:border-edgeOrange outline-none w-32"
            />
            <button
              onClick={handleChangePin}
              className="bg-edgeOrange hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-black uppercase cursor-pointer"
            >
              Update
            </button>
            {pinChangeSuccess && (
              <span className="text-safetyGreen text-xs font-bold">✓ PIN Updated!</span>
            )}
          </div>
        </div>
      )}

      {/* Active Directive Highlight (If active) */}
      {activeDirective && (
        <div className={`p-4 rounded-xl border flex-none flex justify-between items-start transition-all ${
          activeDirective.severity === 'CRITICAL' 
            ? 'bg-red-950/30 border-red-500/50 text-red-100 shadow-lg shadow-red-950/20' 
            : activeDirective.severity === 'CAUTION'
            ? 'bg-amber-950/30 border-amber-500/50 text-amber-100 shadow-lg shadow-amber-950/20'
            : 'bg-blue-950/30 border-blue-500/50 text-blue-100'
        }`}>
          <div className="flex items-start space-x-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none ${
              activeDirective.severity === 'CRITICAL' ? 'bg-red-500 text-white animate-pulse' :
              activeDirective.severity === 'CAUTION' ? 'bg-amber-500 text-black' : 'bg-blue-500 text-white'
            }`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded">
                  ACTIVE LIVE DIRECTIVE • {activeDirective.severity} ({activeDirective.category})
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {new Date(activeDirective.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai' })} GST
                </span>
              </div>
              <h3 className="text-sm font-black tracking-wide text-white uppercase leading-snug">
                {activeDirective.title}
              </h3>
              <p className="text-xs mt-1 leading-relaxed opacity-95">
                {activeDirective.message}
              </p>
              <div className="text-[9px] text-slate-400 mt-2 flex items-center space-x-2">
                <span>Authorized by: <strong>{activeDirective.author}</strong></span>
                <span>•</span>
                <span>Broadcasting to: {activeDirective.sendToDashboard ? '📺 Tactical TV' : ''} {activeDirective.sendToWhatsApp ? '📱 WhatsApp Group' : ''}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClearDirective}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-600/20 hover:bg-red-600/40 text-red-200 text-xs font-black uppercase transition cursor-pointer flex-none ml-4"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Revoke Directive</span>
          </button>
        </div>
      )}

      {/* Main 2-Column Grid: Left (Composer) | Right (WhatsApp Webhook Settings & History) */}
      <div className="grid grid-cols-12 gap-4 flex-grow items-start min-h-0">
        
        {/* Left Column (Col-span-7): Directive Composer */}
        <div className="col-span-12 lg:col-span-7 bg-cardDarkSlate border border-slate-800 rounded-xl p-4 flex flex-col space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-edgeOrange" />
              <h3 className="text-xs font-black text-textIceWhite uppercase tracking-wider">
                Compose HSE Range Directive
              </h3>
            </div>
            <span className="text-[9px] text-slate-400 font-mono">
              ADOSH & MoHRE DIRECTIVE BROADCAST
            </span>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-3">
            {/* Directive Severity & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  Directive Severity
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSeverity('INFO')}
                    className={`py-1.5 rounded text-[9px] font-black uppercase transition cursor-pointer border ${
                      severity === 'INFO'
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                        : 'bg-bgDeepSpace/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverity('CAUTION')}
                    className={`py-1.5 rounded text-[9px] font-black uppercase transition cursor-pointer border ${
                      severity === 'CAUTION'
                        ? 'bg-amber-500 border-amber-300 text-black shadow-md'
                        : 'bg-bgDeepSpace/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Caution
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverity('CRITICAL')}
                    className={`py-1.5 rounded text-[9px] font-black uppercase transition cursor-pointer border ${
                      severity === 'CRITICAL'
                        ? 'bg-stopRed border-red-400 text-white shadow-md'
                        : 'bg-bgDeepSpace/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Halt
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  Safety Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-bgDeepSpace/80 border border-slate-800 rounded px-2 py-1.5 text-xs text-textIceWhite font-bold focus:border-edgeOrange outline-none"
                >
                  <option value="HEAT">Heat Stress & WBGT</option>
                  <option value="WIND">Wind & Ballistics</option>
                  <option value="LIGHTNING">Lightning & Storms</option>
                  <option value="CURFEW">Midday Ban & Curfew</option>
                  <option value="FIRING">Live Firing Notice</option>
                  <option value="GENERAL">General Operational HSE</option>
                </select>
              </div>
            </div>

            {/* Officer Call-Sign & Title */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  Author / Call-Sign
                </label>
                <input 
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. RSO-1 / Lead Safety Officer"
                  className="w-full bg-bgDeepSpace/80 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-textIceWhite font-bold focus:border-edgeOrange outline-none"
                />
              </div>
              <div className="col-span-7">
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  Directive Title / Subject
                </label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. MANDATORY 30M HYDRATION BREAK"
                  className="w-full bg-bgDeepSpace/80 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-textIceWhite font-bold focus:border-edgeOrange outline-none"
                />
              </div>
            </div>

            {/* Directive Message Body */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                Directive Message Body & Actions Required
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter mandatory safety instructions for outdoor range operators..."
                className="w-full bg-bgDeepSpace/80 border border-slate-800 rounded px-2.5 py-2 text-xs text-textIceWhite leading-relaxed focus:border-edgeOrange outline-none resize-none no-scrollbar font-mono"
              />
            </div>

            {/* Target Destinations */}
            <div className="bg-bgDeepSpace/40 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={sendToDashboard}
                    onChange={(e) => setSendToDashboard(e.target.checked)}
                    className="accent-orange-500 w-4 h-4 cursor-pointer"
                  />
                  <span>📺 Outdoor TV Tactical Console</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={sendToWhatsApp}
                    onChange={(e) => setSendToWhatsApp(e.target.checked)}
                    disabled={!waConfig.enabled}
                    className="accent-green-500 w-4 h-4 cursor-pointer disabled:opacity-40"
                  />
                  <span className={!waConfig.enabled ? 'text-slate-500 line-through' : 'text-green-300'}>
                    📱 WhatsApp HSE Group Webhook
                  </span>
                </label>
              </div>

              {!waConfig.enabled && (
                <span className="text-[9px] text-amber-400 font-bold">
                  (Enable WhatsApp below)
                </span>
              )}
            </div>

            {/* Broadcast Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isBroadcasting}
                className="w-full bg-edgeOrange hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider py-2.5 rounded-lg shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Broadcasting Directive...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Broadcast Directive Now</span>
                  </>
                )}
              </button>
            </div>

            {broadcastResult && (
              <div className="p-2.5 rounded bg-safetyGreen/20 border border-safetyGreen/40 text-green-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
                <span>✓ Directive broadcasted successfully to active displays!</span>
                {broadcastResult.whatsappResult && (
                  <span className="text-[10px] text-green-200">
                    WhatsApp: {broadcastResult.whatsappResult.success ? 'Dispatched ✓' : 'Failed'}
                  </span>
                )}
              </div>
            )}
          </form>

          {/* Directive History Log */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              Recent HSE Broadcast History ({history.length})
            </span>
            <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
              {history.length > 0 ? (
                history.slice(0, 5).map((item) => (
                  <div key={item.id} className="bg-bgDeepSpace/50 border border-slate-800/80 p-2 rounded flex justify-between items-center text-[10px]">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-1.5 font-bold text-slate-300">
                        <span className={`w-2 h-2 rounded-full ${
                          item.severity === 'CRITICAL' ? 'bg-red-500' :
                          item.severity === 'CAUTION' ? 'bg-amber-400' : 'bg-blue-400'
                        }`} />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <p className="text-slate-500 text-[9px] truncate mt-0.5">{item.message}</p>
                    </div>
                    <span className="text-slate-500 text-[8.5px] font-mono whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-500 italic py-2 text-center">
                  No previous directives logged today.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Col-span-5): WhatsApp Webhook Configuration */}
        <div className="col-span-12 lg:col-span-5 bg-cardDarkSlate border border-slate-800 rounded-xl p-4 flex flex-col space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black text-textIceWhite uppercase tracking-wider">
                WhatsApp Group Webhook
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-[8.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded border ${
                waConfig.enabled 
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400' 
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}>
                {waConfig.enabled ? 'ONLINE / ARMED' : 'DISABLED'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Master Enable Toggle */}
            <div className="flex items-center justify-between bg-bgDeepSpace/60 border border-slate-800 p-2.5 rounded-lg">
              <div>
                <span className="text-xs font-bold text-white block">Automated WhatsApp Alerts</span>
                <span className="text-[9px] text-slate-400 block">
                  Send HSE messages directly to range WhatsApp group.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWaConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  waConfig.enabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  waConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Gateway Selector */}
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                Webhook Gateway Architecture
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWaConfig(prev => ({ ...prev, gateway: 'callmebot' }))}
                  className={`p-2 rounded border text-left cursor-pointer transition ${
                    waConfig.gateway === 'callmebot'
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                      : 'bg-bgDeepSpace/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase block">CallMeBot API</span>
                  <span className="text-[8px] opacity-80 block mt-0.5">100% Free • Direct WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWaConfig(prev => ({ ...prev, gateway: 'custom' }))}
                  className={`p-2 rounded border text-left cursor-pointer transition ${
                    waConfig.gateway === 'custom'
                      ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200'
                      : 'bg-bgDeepSpace/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase block">Custom Webhook</span>
                  <span className="text-[8px] opacity-80 block mt-0.5">Zapier / Make / n8n / Bot</span>
                </button>
              </div>
            </div>

            {/* CallMeBot Settings */}
            {waConfig.gateway === 'callmebot' && (
              <div className="space-y-2.5 bg-bgDeepSpace/40 border border-slate-800/80 p-3 rounded-lg text-[9px]">
                <div>
                  <label className="font-bold text-slate-400 uppercase block mb-0.5">
                    WhatsApp Phone Number (with Country Code)
                  </label>
                  <input 
                    type="text"
                    value={waConfig.phone || ''}
                    onChange={(e) => setWaConfig(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. 971501234567 (no + symbol)"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1.5 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-400 uppercase block mb-0.5">
                    Group Chat ID (Optional for Groups)
                  </label>
                  <input 
                    type="text"
                    value={waConfig.groupChatId || ''}
                    onChange={(e) => setWaConfig(prev => ({ ...prev, groupChatId: e.target.value }))}
                    placeholder="e.g. 971501234567-1600000000@g.us"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1.5 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-400 uppercase block mb-0.5">
                    CallMeBot API Key
                  </label>
                  <input 
                    type="password"
                    value={waConfig.apiKey || ''}
                    onChange={(e) => setWaConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter API Key"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1.5 text-white font-mono text-xs focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[8.5px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-emerald-400 block mb-0.5">💡 Free Setup Instructions:</span>
                  Send WhatsApp text <em>"I allow callmebot to send me messages"</em> to <strong>+34 644 44 24 53</strong>. You will receive your free API key in 10 seconds.
                </div>
              </div>
            )}

            {/* Custom Webhook Settings */}
            {waConfig.gateway === 'custom' && (
              <div className="space-y-2 bg-bgDeepSpace/40 border border-slate-800/80 p-3 rounded-lg text-[9px]">
                <label className="font-bold text-slate-400 uppercase block mb-0.5">
                  Custom Webhook POST URL
                </label>
                <input 
                  type="text"
                  value={waConfig.customWebhookUrl || ''}
                  onChange={(e) => setWaConfig(prev => ({ ...prev, customWebhookUrl: e.target.value }))}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1.5 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                />
                <p className="text-[8px] text-slate-400">
                  Sends JSON payload with <code>event</code>, <code>text</code>, <code>station</code>, and <code>timestamp</code>.
                </p>
              </div>
            )}

            {/* Automated Telemetry Trigger Checkboxes */}
            <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                Automated Sensor Triggers
              </span>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={waConfig.autoAlertWbgt}
                  onChange={(e) => setWaConfig(prev => ({ ...prev, autoAlertWbgt: e.target.checked }))}
                  className="accent-red-500"
                />
                <span>🔥 WBGT Critical Halt (≥ 30.0°C)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={waConfig.autoAlertLightning}
                  onChange={(e) => setWaConfig(prev => ({ ...prev, autoAlertLightning: e.target.checked }))}
                  className="accent-yellow-500"
                />
                <span>⚡ Lightning Strike Proximity (≤ 16 km)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={waConfig.autoAlertWind}
                  onChange={(e) => setWaConfig(prev => ({ ...prev, autoAlertWind: e.target.checked }))}
                  className="accent-orange-500"
                />
                <span>💨 Gale Force Wind Gusts (≥ 45 km/h)</span>
              </label>
            </div>

            {/* Actions: Save Settings & Test Ping */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSaveWaConfig}
                className="bg-slate-800 hover:bg-slate-700 text-textIceWhite font-black uppercase text-xs py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-edgeOrange" />
                <span>{waConfigSaved ? 'Saved ✓' : 'Save Config'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTestPing}
                disabled={isTestingWa}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs py-2 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {isTestingWa ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>Test Ping</span>
              </button>
            </div>

            {waTestResult && (
              <div className={`p-2 rounded text-[9px] font-bold text-center animate-fadeIn ${
                waTestResult.success 
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' 
                  : 'bg-red-950/60 border border-red-500/40 text-red-300'
              }`}>
                {waTestResult.success ? '✓ WhatsApp Ping Dispatched Successfully!' : `⚠️ Error: ${waTestResult.error}`}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
