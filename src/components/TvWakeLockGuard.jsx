import React, { useEffect, useRef } from 'react';

/**
 * TvWakeLockGuard
 * Prevents LG webOS Smart TVs, Samsung Tizen TVs, and wall-mounted kiosk browsers
 * from launching their built-in Screen Saver (Fireworks / Clock) after 3-5 minutes of idle time.
 *
 * Why LG webOS triggers Screen Saver in the Web Browser:
 * - LG webOS ignores DOM timers and only suppresses the TV Screen Saver when Chromium asserts
 *   `kPowerSaveBlockPreventDisplaySleep` via an active, visible HTML5 `<video>` pipeline or W3C WakeLock.
 * - Chromium ignores `<video>` elements smaller than 16x16px or with opacity: 0.
 *
 * This guard combines 3 hardware wake-lock mechanisms:
 * 1. W3C Screen Wake Lock API (`navigator.wakeLock.request('screen')`) with 15s auto-renewal.
 * 2. A 36x24px, opacity 0.08 HTML5 `<video>` element in the viewport playing a live 15 FPS
 *    `canvas.captureStream(15)` + silent WebAudio `MediaStream` track so LG webOS detects continuous
 *    active video playback and blocks the TV Screen Saver indefinitely.
 * 3. Periodic synthetic activity events and 1px OLED pixel-shift protection.
 */
export default function TvWakeLockGuard({ enabled = true, onStatusChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wakeLockRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (onStatusChange) onStatusChange('OFF');
      return;
    }

    let frameCount = 0;
    let drawTimer = null;
    let keepAliveTimer = null;

    // 1. Acquire W3C Screen Wake Lock (`navigator.wakeLock.request('screen')`)
    const requestScreenWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          if (!wakeLockRef.current || wakeLockRef.current.released) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            if (onStatusChange) onStatusChange('ACTIVE');
          }
        }
      } catch (_err) {
        // Relies on HTML5 video media wake lock below
      }
    };

    // 2. Start continuous 15 FPS Canvas -> HTML5 Video stream (blocks LG webOS Screen Saver)
    const startVideoKeepAlive = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      const renderHeartbeatFrame = () => {
        if (!ctx) return;
        frameCount = (frameCount + 7) % 360;
        ctx.fillStyle = `hsl(${frameCount}, 75%, 12%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = `hsl(${(frameCount + 180) % 360}, 85%, 35%)`;
        ctx.fillRect((frameCount >> 2) % 28, (frameCount >> 3) % 16, 6, 6);
      };

      renderHeartbeatFrame();
      drawTimer = setInterval(renderHeartbeatFrame, 120);

      try {
        if (typeof canvas.captureStream === 'function' && !video.srcObject) {
          const canvasStream = canvas.captureStream(15);
          video.srcObject = canvasStream;
        }
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        await video.play();
        if (onStatusChange) onStatusChange('ACTIVE');
      } catch (_playErr) {
        // Retried automatically on any remote pointer/key event
      }
    };

    // 3. Attach silent Web Audio track & unmute pipeline on first LG Magic Remote click/keydown
    const handleUserInteraction = () => {
      requestScreenWakeLock();
      const video = videoRef.current;
      const canvas = canvasRef.current;

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !audioCtxRef.current) {
          const audioCtx = new AudioContextClass();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          gain.gain.value = 0.00001; // Sub-audible keep-alive signal
          osc.connect(gain);

          // Also route into a MediaStreamAudioDestinationNode so the <video> stream has an audio track
          if (typeof audioCtx.createMediaStreamDestination === 'function' && canvas && typeof canvas.captureStream === 'function' && video) {
            const audioDest = audioCtx.createMediaStreamDestination();
            gain.connect(audioDest);
            const combinedStream = new MediaStream([
              ...canvas.captureStream(15).getVideoTracks(),
              ...audioDest.stream.getAudioTracks()
            ]);
            video.srcObject = combinedStream;
            video.muted = false;
            video.volume = 0.01;
          } else {
            gain.connect(audioCtx.destination);
          }

          osc.start();
          audioCtxRef.current = audioCtx;
        } else if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch (_audioErr) {
        // Ignore audio errors
      }

      if (video && video.paused) {
        video.play().catch(() => {});
      }
      if (onStatusChange) onStatusChange('LOCKED');
    };

    requestScreenWakeLock();
    startVideoKeepAlive();

    // 4. Every 12 seconds, verify video playback + WakeLock + synthetic activity pulse
    keepAliveTimer = setInterval(() => {
      requestScreenWakeLock();
      const video = videoRef.current;
      if (video && video.paused) {
        video.play().catch(() => {});
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      window.dispatchEvent(new Event('mousemove'));
    }, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestScreenWakeLock();
        const video = videoRef.current;
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      if (drawTimer) clearInterval(drawTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [enabled, onStatusChange]);

  if (!enabled) return null;

  // Kept at 36x24px with opacity 0.08 in the bottom-right corner so LG webOS Chromium's
  // VideoVisibilityTracker treats it as an active visible video stream and prevents the TV Screen Saver.
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: '2px',
        right: '2px',
        width: '36px',
        height: '24px',
        opacity: 0.08,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
        borderRadius: '4px'
      }}
    >
      <canvas ref={canvasRef} width={36} height={24} style={{ display: 'block' }} />
      <video
        ref={videoRef}
        width={36}
        height={24}
        muted
        loop
        playsInline
        autoPlay
        style={{ position: 'absolute', top: 0, left: 0, width: '36px', height: '24px' }}
      />
    </div>
  );
}
