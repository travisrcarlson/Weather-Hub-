import React, { useEffect, useRef, useState } from 'react';

/**
 * TvWakeLockGuard
 * Multi-layered anti-screensaver engine engineered for LG webOS 24 / webOS 25 Smart TVs:
 *
 * Why LG webOS 24/25 has TWO separate screensaver timers in the Web Browser:
 * 1. Timer A (2–3 minutes, Static Page): Triggered when no hardware H.264/VP9 video is decoding.
 * 2. Timer B (30 minutes, Type-2 "Video + OSD Overlay"): Triggered when a video is playing
 *    either with partial CSS `opacity < 1.0` OR with DOM/UI ("OSD") elements continuously
 *    rendered on top of the video for 30 minutes without entering Type-1 (100% opaque,
 *    zero-OSD fullscreen video).
 *
 * Countermeasures active in this component:
 * - Layer 1A (100% Opaque `opacity: 1.0` Full-Viewport Black H.264+AAC Video):
 *   Plays `tv-keepawake.mp4` at `width: 100%; height: 100%` with NO CSS `opacity`, `transform`,
 *   or `border` properties so Chromium does not disqualify the video layer for partial opacity.
 * - Layer 1B (Hardware H.264+AAC Motion Stream): Plays `tv-keepawake-motion.mp4` continuously
 *   with pre-EOS seeking (`duration - 0.85s -> 0.15s`) so `StarfishMedia` never hits `EOS`.
 * - Layer 2 (8-Minute Zero-OSD Type-1 Hardware Video Plane Reset):
 *   Every 8 minutes (well before the 30-minute Type-2 OSD timeout), hides all DOM/OSD elements
 *   for 4.5 seconds and mounts a single unoccluded, 100% opaque (`opacity: 1.0`) full-viewport
 *   `<video>` element (`#tv-type1-reset-video`) so webOS transitions from Type-2 (Video + OSD)
 *   to Type-1 (Pure Fullscreen Video) and resets the 30-minute countdown back to 0:00.
 * - Layer 3 (14-Minute Top-Window Pure Video Bounce via `keepalive.html?bounce=1`):
 *   When `autoReload` (`WAKE:MAX`) is enabled, bounces the top window through `keepalive.html?bounce=1`
 *   every 14 minutes (4.5s pure fullscreen video document with zero DOM/OSD) and returns to `./`,
 *   where `App.jsx` restores the exact view mode and station from `sessionStorage`.
 */
export default function TvWakeLockGuard({ enabled = true, autoReload = true }) {
  const bgVideoRef = useRef(null);
  const fgVideoRef = useRef(null);
  const resetVideoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [iframeTick, setIframeTick] = useState(() => Date.now());
  const [isType1ResetActive, setIsType1ResetActive] = useState(false);
  const [resetCycleKey, setResetCycleKey] = useState(0);

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
      [bgVideoRef.current, fgVideoRef.current, resetVideoRef.current].forEach((vid) => {
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

    // Unlock unmuted hardware audio+video pipeline & request native Fullscreen on user click/keypress
    const handleUserGesture = () => {
      tryWakeLockNonBlocking();
      [bgVideoRef.current, fgVideoRef.current].forEach((vid) => {
        if (!vid) return;
        try {
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

    // Every 35 seconds: navigate hidden iframe + replace history state
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

    // Every 8 minutes (480,000 ms): Trigger a 4.5-second Zero-OSD Type-1 Fullscreen Video Reset
    // Hides all DOM/OSD elements and plays a single 100% opaque fullscreen <video> so LG webOS
    // exits Type-2 (Video+OSD 30-min cap) and resets the 30-minute countdown back to 0:00.
    let resetTimeoutId = null;
    const type1ResetWatchdog = setInterval(() => {
      setResetCycleKey((prev) => prev + 1);
      setIsType1ResetActive(true);
      if (resetTimeoutId) clearTimeout(resetTimeoutId);
      resetTimeoutId = setTimeout(() => {
        setIsType1ResetActive(false);
      }, 4500);
    }, 8 * 60 * 1000);

    // Every 14 minutes (840,000 ms): Bounce top window through `keepalive.html?bounce=1`
    // (a pure zero-OSD 100%-opaque fullscreen video page) for 4.5s and return to `./`
    let bounceWatchdog = null;
    if (autoReload) {
      bounceWatchdog = setInterval(() => {
        try {
          window.location.replace(`${baseUrl}keepalive.html?bounce=1&t=${Date.now()}`);
        } catch (_e) {
          window.location.reload();
        }
      }, 14 * 60 * 1000);
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
      clearInterval(type1ResetWatchdog);
      if (resetTimeoutId) clearTimeout(resetTimeoutId);
      if (bounceWatchdog) clearInterval(bounceWatchdog);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
    };
  }, [enabled, autoReload, baseUrl]);

  if (!enabled) return null;

  return (
    <>
      {/* During the 4.5s Type-1 Fullscreen Video Reset every 8 minutes, hide all OSD/DOM elements
          so Chromium submits ONLY the 100% opaque full-viewport hardware video plane to webOS */}
      {isType1ResetActive && (
        <>
          <style>{`
            body > #root > div > *:not(#tv-type1-reset-video) {
              visibility: hidden !important;
            }
          `}</style>
          <video
            id="tv-type1-reset-video"
            key={`type1-reset-${resetCycleKey}`}
            ref={resetVideoRef}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: '#000000',
              zIndex: 2147483647
            }}
          >
            <source src={`${motionMp4Url}?cycle=${resetCycleKey}`} type="video/mp4" />
            <source src={fallbackMp4Url} type="video/mp4" />
          </video>
        </>
      )}

      {/* Layer 1A: 100% Opaque (NO CSS opacity/transform/border!) Full-Viewport Black H.264+AAC Video
          Satisfies LG webOS's requirement that fullscreen video elements have no partial opacity */}
      <video
        ref={bgVideoRef}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <source src={fallbackMp4Url} type="video/mp4" />
        <source src={fallbackWebmUrl} type="video/webm" />
      </video>

      {/* Layer 1B: Continuous Hardware H.264+AAC Motion Stream */}
      <video
        ref={fgVideoRef}
        width={320}
        height={180}
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
          width: '320px',
          height: '180px',
          opacity: 0.015,
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
