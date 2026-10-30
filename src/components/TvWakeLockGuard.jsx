import React, { useEffect, useRef, useState } from 'react';

/**
 * TvWakeLockGuard
 * Multi-layered anti-screensaver engine specifically engineered for LG webOS Smart TVs
 * (webOS 6 / 22 / 23 / 24 / 25) and commercial wall-mounted displays.
 *
 * Why LG webOS triggers the Fireworks / Clock Screen Saver in the Web Browser:
 * 1. `navigator.wakeLock.request('screen')` often hangs indefinitely on webOS.
 * 2. Small corner videos (< 200x200px) or `canvas.captureStream()` are ignored by webOS
 *    because webOS treats small videos as webpage ad banners and software streams do not
 *    engage the LG `StarfishMedia` / `ums` hardware decoder.
 * 3. When a short 1-second video hits `ended` (`EOS`), `ums` drops the media wake lock.
 *
 * Countermeasures active in this component:
 * - Layer 1 (Full-Screen Hardware H.264+AAC Motion Video): Plays a real multi-second H.264+AAC
 *   motion MP4 (`tv-keepawake-motion.mp4`) at 100vw x 100vh in the background AND 260x150px
 *   in the top foreground layer, seeking smoothly at `duration - 0.8s` so the hardware decoder
 *   never hits EOS.
 * - Layer 2 (Subframe Navigation Heartbeat): Navigates a hidden `<iframe>` to `keepalive.html?t=...`
 *   every 35 seconds to trigger `WebContentsObserver::DidStartLoading/DidStopLoading` in the
 *   LG webOS Browser without flickering the main UI.
 * - Layer 3 (History & Synthetic Input Pulse): Updates URL state via `history.replaceState` and
 *   dispatches focus/input events every 20 seconds.
 * - Layer 4 (Optional 110s State-Preserving Page Reload): When `autoReload` is enabled, reloads
 *   the top window every 110 seconds (before the 2-3 min LG screensaver threshold) while `App.jsx`
 *   restores the exact active tab and station from `sessionStorage`.
 */
export default function TvWakeLockGuard({ enabled = true, autoReload = false }) {
  const bgVideoRef = useRef(null);
  const fgVideoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [iframeTick, setIframeTick] = useState(() => Date.now());

  const baseUrl = import.meta.env.BASE_URL || '/';
  const motionMp4Url = `${baseUrl}tv-keepawake-motion.mp4`;
  const fallbackMp4Url = `${baseUrl}tv-keepawake.mp4`;
  const fallbackWebmUrl = `${baseUrl}tv-keepawake.webm`;
  const keepAliveHtmlUrl = `${baseUrl}keepalive.html?t=${iframeTick}`;

  // Seamless loop handler so LG StarfishMedia hardware decoder never reaches EOS
  const handleTimeUpdate = (e) => {
    const vid = e.currentTarget;
    if (vid && vid.duration && vid.currentTime > vid.duration - 0.85) {
      try {
        vid.currentTime = 0.15;
        if (vid.paused) vid.play().catch(() => {});
      } catch (_err) {
        // Ignore seek errors
      }
    }
  };

  useEffect(() => {
    if (!enabled) return;

    const ensureVideosPlaying = () => {
      [bgVideoRef.current, fgVideoRef.current].forEach((vid) => {
        if (!vid) return;
        if (vid.paused || vid.ended) {
          vid.play().catch(() => {});
        }
      });
    };

    // Fire-and-forget W3C WakeLock (never await on webOS because it can hang)
    const tryWakeLockNonBlocking = () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          navigator.wakeLock.request('screen').catch(() => {});
        }
      } catch (_e) {
        // Ignore
      }
    };

    // Unlock unmuted hardware audio+video pipeline on first LG Magic Remote click/keypress
    const handleUserGesture = () => {
      tryWakeLockNonBlocking();
      [bgVideoRef.current, fgVideoRef.current].forEach((vid) => {
        if (!vid) return;
        try {
          // Unmuting at 1% volume on a silent AAC track locks LG webOS's audio+video ums pipeline
          vid.muted = false;
          vid.volume = 0.01;
          vid.play().catch(() => {
            vid.muted = true;
            vid.play().catch(() => {});
          });
        } catch (_err) {
          // Ignore
        }
      });

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !audioCtxRef.current) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          audioCtxRef.current = ctx;
        } else if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch (_e) {
        // Ignore
      }
    };

    tryWakeLockNonBlocking();
    ensureVideosPlaying();

    // Every 8 seconds: verify hardware videos are playing & dispatch activity heartbeat
    const videoWatchdog = setInterval(() => {
      ensureVideosPlaying();
      tryWakeLockNonBlocking();
      try {
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: Math.random() * 100, clientY: Math.random() * 100 }));
        window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Shift' }));
      } catch (_e) {
        // Ignore
      }
    }, 8000);

    // Every 35 seconds: navigate hidden iframe + replace history state to reset webOS browser load timer
    const navWatchdog = setInterval(() => {
      setIframeTick(Date.now());
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('hb', String(Math.floor(Date.now() / 1000) % 1000));
        window.history.replaceState({ hb: Date.now() }, '', url.toString());
      } catch (_e) {
        // Ignore
      }
    }, 35000);

    // Optional 110-second full top-window reload for strict LG OLED firmware
    let reloadWatchdog = null;
    if (autoReload) {
      reloadWatchdog = setInterval(() => {
        window.location.reload();
      }, 110000);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ensureVideosPlaying();
        tryWakeLockNonBlocking();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });
    window.addEventListener('touchstart', handleUserGesture, { passive: true });

    return () => {
      clearInterval(videoWatchdog);
      clearInterval(navWatchdog);
      if (reloadWatchdog) clearInterval(reloadWatchdog);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
    };
  }, [enabled, autoReload]);

  if (!enabled) return null;

  return (
    <>
      {/* Layer 1A: Full-Viewport (100vw x 100vh) Hardware H.264+AAC Motion Video
          Bypasses LG webOS's small-video/ad-banner filter so webOS recognizes full-screen video playback */}
      <video
        ref={bgVideoRef}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          opacity: 0.03,
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <source src={motionMp4Url} type="video/mp4" />
        <source src={fallbackMp4Url} type="video/mp4" />
        <source src={fallbackWebmUrl} type="video/webm" />
      </video>

      {/* Layer 1B: Top-Stacking-Context (260x150px, z-index 9999) Hardware H.264+AAC Video
          Ensures Chromium's VideoVisibilityTracker sees an unoccluded video in the top layer */}
      <video
        ref={fgVideoRef}
        width={260}
        height={150}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '260px',
          height: '150px',
          opacity: 0.012,
          pointerEvents: 'none',
          zIndex: 9999
        }}
      >
        <source src={motionMp4Url} type="video/mp4" />
        <source src={fallbackMp4Url} type="video/mp4" />
        <source src={fallbackWebmUrl} type="video/webm" />
      </video>

      {/* Layer 2: Hidden Subframe Navigation Heartbeat (Resets webOS browser loading timer every 35s) */}
      <iframe
        src={keepAliveHtmlUrl}
        title="tv-keepalive-frame"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '2px',
          height: '2px',
          opacity: 0.01,
          pointerEvents: 'none',
          border: 'none',
          zIndex: -1
        }}
      />
    </>
  );
}
