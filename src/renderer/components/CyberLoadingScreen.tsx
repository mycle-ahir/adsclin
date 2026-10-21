import { useEffect, useRef, useState } from 'react';
import adsclinLogo from '../assets/adsclin-logo.png';

interface CyberLoadingScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

const STEPS = [
  'Loading browser environment...',
  'Generating fingerprint...',
  'Masking system parameters...',
  'Configuring session...',
  'Synchronizing profile...',
];

export function CyberLoadingScreen({
  onComplete,
  minDurationMs = 2800,
}: CyberLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Smooth progress animation
  useEffect(() => {
    const startTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawPct = Math.min(100, Math.floor((elapsed / minDurationMs) * 100));
      setProgress(rawPct);

      // Map progress to steps
      if (rawPct < 22) setActiveStepIndex(0);
      else if (rawPct < 45) setActiveStepIndex(1);
      else if (rawPct < 68) setActiveStepIndex(2);
      else if (rawPct < 88) setActiveStepIndex(3);
      else setActiveStepIndex(4);

      if (elapsed < minDurationMs) {
        animId = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setActiveStepIndex(4);
        setTimeout(() => {
          onComplete?.();
        }, 350);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [minDurationMs, onComplete]);

  // 3D Wireframe Globe Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angleY = 0;
    const tiltX = 0.28; // Tilted ~16 degrees

    // Set high-DPI resolution
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Random star/grid background dots
    const particles = Array.from({ length: 45 }, () => ({
      x: (Math.random() - 0.5) * 450,
      y: (Math.random() - 0.5) * 450,
      z: (Math.random() - 0.5) * 200,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.55;
      const cy = h * 0.5;
      const radius = Math.min(w, h) * 0.42;

      angleY += 0.008;

      // 3D projection helper
      const project = (x: number, y: number, z: number) => {
        // Rotate Y
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        // Rotate X (tilt)
        const cosX = Math.cos(tiltX);
        const sinX = Math.sin(tiltX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const fov = 400;
        const scale = fov / (fov + z2);
        return {
          px: cx + x1 * scale,
          py: cy + y2 * scale,
          z: z2,
          visible: z2 > -radius * 0.9,
          alpha: Math.max(0.08, Math.min(1, (z2 + radius) / (2 * radius))),
        };
      };

      // Draw faint floating dots
      for (const p of particles) {
        const pt = project(p.x, p.y, p.z);
        ctx.fillStyle = `rgba(0, 255, 136, ${p.alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Latitude rings
      const latSteps = 10;
      for (let i = 1; i < latSteps; i++) {
        const phi = (i / latSteps - 0.5) * Math.PI;
        const rRing = radius * Math.cos(phi);
        const yVal = radius * Math.sin(phi);

        ctx.beginPath();
        let started = false;
        const segs = 40;
        for (let j = 0; j <= segs; j++) {
          const theta = (j / segs) * Math.PI * 2;
          const xVal = rRing * Math.cos(theta);
          const zVal = rRing * Math.sin(theta);
          const pt = project(xVal, yVal, zVal);

          if (!started) {
            ctx.moveTo(pt.px, pt.py);
            started = true;
          } else {
            ctx.lineTo(pt.px, pt.py);
          }
        }
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Longitude meridians
      const lonSteps = 12;
      for (let i = 0; i < lonSteps; i++) {
        const theta = (i / lonSteps) * Math.PI * 2;

        ctx.beginPath();
        let started = false;
        const segs = 36;
        for (let j = 0; j <= segs; j++) {
          const phi = (j / segs - 0.5) * Math.PI;
          const xVal = radius * Math.cos(phi) * Math.cos(theta);
          const yVal = radius * Math.sin(phi);
          const zVal = radius * Math.cos(phi) * Math.sin(theta);
          const pt = project(xVal, yVal, zVal);

          if (!started) {
            ctx.moveTo(pt.px, pt.py);
            started = true;
          } else {
            ctx.lineTo(pt.px, pt.py);
          }
        }
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Outer Orbital Rings
      const ringRadius = radius * 1.35;
      ctx.beginPath();
      let started = false;
      const orbitSegs = 64;
      for (let j = 0; j <= orbitSegs; j++) {
        const theta = (j / orbitSegs) * Math.PI * 2;
        const xVal = ringRadius * Math.cos(theta);
        const zVal = ringRadius * Math.sin(theta);
        // Tilt the orbital ring slightly opposite
        const yVal = Math.sin(theta) * 35;
        const pt = project(xVal, yVal, zVal);

        if (!started) {
          ctx.moveTo(pt.px, pt.py);
          started = true;
        } else {
          ctx.lineTo(pt.px, pt.py);
        }
      }
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Orbiting beacon point
      const beaconTheta = angleY * 2.2;
      const bX = ringRadius * Math.cos(beaconTheta);
      const bZ = ringRadius * Math.sin(beaconTheta);
      const bY = Math.sin(beaconTheta) * 35;
      const bPt = project(bX, bY, bZ);
      ctx.beginPath();
      ctx.arc(bPt.px, bPt.py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative h-screen w-full bg-[#040807] text-[#00ff88] select-none flex flex-col justify-between p-8 md:p-12 font-mono overflow-hidden">
      {/* Background radial cyber glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(0,255,136,0.06),rgba(4,8,7,0.98))]" />

      {/* Subtle Matrix / Digital Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #00ff88 1px, transparent 1px), linear-gradient(to bottom, #00ff88 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* TOP BAR */}
      <header className="relative z-10 flex items-start justify-between">
        {/* Top-Left Corner Bracket & Logo */}
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 border-t-2 border-l-2 border-[#00ff88]" />
          <div className="flex items-center gap-3">
            <img
              src={adsclinLogo}
              alt="Adsclin"
              className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(0,255,136,0.6)]"
            />
            <span className="text-3xl font-black tracking-tight text-white font-sans drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              Adsclin
            </span>
          </div>
        </div>

        {/* Top-Right Corner Bracket & Tech Badge */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-end pt-1">
            <span className="text-[11px] font-bold tracking-[0.22em] text-[#00ff88] uppercase">
              Anti-Detect Browser
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-emerald-400/80 font-mono">v1.0.2</span>
              <span className="text-emerald-500/50">—</span>
            </div>
          </div>
          <div className="w-8 h-8 border-t-2 border-r-2 border-[#00ff88]" />
        </div>
      </header>

      {/* MIDDLE BODY: Terminal on Left + 3D Holographic Globe on Right */}
      <div className="relative z-10 flex-1 flex items-center justify-between my-auto">
        {/* Left side: Cyber 3-dot ticks & Terminal */}
        <div className="flex items-start gap-6 max-w-xl w-full pl-2">
          {/* 3 Green squares / ticks as shown in screenshot */}
          <div className="flex flex-col gap-1.5 pt-8">
            <div className="w-2 h-2 bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
            <div className="w-2 h-2 bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
            <div className="w-2 h-2 bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
          </div>

          <div className="flex-1 space-y-6">
            {/* Terminal Command Prompt */}
            <div className="text-lg md:text-xl font-bold text-[#00ff88] flex items-center gap-2">
              <span className="text-emerald-400">&gt;</span>
              <span>adsclin --init</span>
            </div>

            {/* Step by Step Execution List */}
            <div className="space-y-3 text-sm md:text-base">
              {STEPS.map((step, idx) => {
                const isDone = idx < activeStepIndex || progress === 100;
                const isCurrent = idx === activeStepIndex && progress < 100;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 transition-opacity duration-300 ${
                      isDone
                        ? 'text-emerald-300'
                        : isCurrent
                        ? 'text-white font-semibold'
                        : 'text-emerald-900/60 opacity-40'
                    }`}
                  >
                    <span
                      className={`font-bold ${
                        isDone || isCurrent ? 'text-[#00ff88]' : 'text-emerald-900/50'
                      }`}
                    >
                      [+]
                    </span>
                    <span>{step}</span>
                    {isCurrent && (
                      <span className="inline-block w-2.5 h-4 bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse ml-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Glowing Neon Progress Bar & Percentage */}
            <div className="pt-4 flex items-center gap-4 max-w-md">
              <div className="flex-1 h-3 rounded-full bg-[#041910] border border-[#065f46] p-0.5 relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00ff88] to-[#10b981] transition-all duration-150 ease-out shadow-[0_0_12px_rgba(0,255,136,0.8)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-bold font-mono text-[#00ff88] w-12 text-right">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Right side: 3D Wireframe Globe Hologram Canvas */}
        <div className="hidden lg:block relative w-[460px] h-[400px] flex-shrink-0">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: '460px', height: '400px' }}
          />
        </div>
      </div>

      {/* BOTTOM FOOTER */}
      <footer className="relative z-10 flex items-end justify-between">
        {/* Bottom-Left Corner Bracket & Tracking text */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-b-2 border-l-2 border-[#00ff88]" />
          <span className="text-[10px] md:text-xs tracking-[0.28em] font-bold text-emerald-500 uppercase font-mono">
            SECURE &nbsp;/&nbsp; PRIVATE &nbsp;/&nbsp; UNDETECTABLE
          </span>
        </div>

        {/* Bottom-Right Corner Bracket & Hash marks */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="text-sm font-black tracking-widest text-[#00ff88]">///</span>
            <div className="w-12 h-[2px] bg-[#00ff88]/50" />
          </div>
          <div className="w-8 h-8 border-b-2 border-r-2 border-[#00ff88]" />
        </div>
      </footer>
    </div>
  );
}
