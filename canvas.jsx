// FourierCanvas: the interactive drawing + animation surface.

function FourierCanvas({
  theme, coeffs, userPath, pathResampled,
  N, speed, playing, showCircles, showVectors, showUserPath, trailMode,
  onDrawStart, onDrawPoint, onDrawEnd, canDraw,
  onTimeUpdate,
}) {
  const canvasRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const [dims, setDims] = React.useState({ w: 800, h: 600 });
  const tRef = React.useRef(0);
  const tracePtsRef = React.useRef([]); // array of {x, y, age} (in "local" coords)
  const rafRef = React.useRef(0);
  const lastTsRef = React.useRef(0);
  const drawingRef = React.useRef(false);

  // Resize observer
  React.useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
    return () => ro.disconnect();
  }, []);

  // Clear trace when coeffs change
  React.useEffect(() => {
    tracePtsRef.current = [];
    tRef.current = 0;
  }, [coeffs]);

  // Draw the static grid + user path on the overlay canvas (under the animation layer).
  React.useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr;
    c.height = dims.h * dpr;
    c.style.width = dims.w + 'px';
    c.style.height = dims.h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dims.w, dims.h);

    // grid
    const gridStep = 40;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= dims.w; x += gridStep) {
      ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, dims.h);
    }
    for (let y = 0; y <= dims.h; y += gridStep) {
      ctx.moveTo(0, y + 0.5); ctx.lineTo(dims.w, y + 0.5);
    }
    ctx.stroke();

    // stronger axis lines
    ctx.strokeStyle = theme.gridStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dims.w / 2 + 0.5, 0); ctx.lineTo(dims.w / 2 + 0.5, dims.h);
    ctx.moveTo(0, dims.h / 2 + 0.5); ctx.lineTo(dims.w, dims.h / 2 + 0.5);
    ctx.stroke();

    // crosshair ticks
    ctx.fillStyle = theme.muted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('0', dims.w / 2 + 4, dims.h / 2 - 4);

    // user path (centered at canvas center)
    if (showUserPath && userPath && userPath.length > 1) {
      ctx.save();
      ctx.translate(dims.w / 2, dims.h / 2);
      ctx.strokeStyle = theme.user;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(userPath[0].x, userPath[0].y);
      for (let i = 1; i < userPath.length; i++) {
        ctx.lineTo(userPath[i].x, userPath[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [dims, theme, userPath, showUserPath]);

  // Animation loop
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c || !coeffs || coeffs.length === 0) {
      if (c) {
        const dpr = window.devicePixelRatio || 1;
        c.width = dims.w * dpr; c.height = dims.h * dpr;
        c.style.width = dims.w + 'px'; c.style.height = dims.h + 'px';
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, dims.w, dims.h);
      }
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + 'px'; c.style.height = dims.h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tick = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (playing) {
        tRef.current = (tRef.current + dt * speed) % 1;
      }
      const t = tRef.current;
      onTimeUpdate && onTimeUpdate(t);

      const tips = evalFourier(coeffs, t, N);
      const tip = tips[tips.length - 1];

      // Push tip into trace buffer
      if (playing) {
        tracePtsRef.current.push({ x: tip.x, y: tip.y, age: 0 });
      }
      // age trace points
      const maxAge = trailMode === 'infinite' ? Infinity
                   : trailMode === 'long' ? 3.0
                   : 1.2;
      for (const p of tracePtsRef.current) p.age += dt;
      if (maxAge !== Infinity) {
        tracePtsRef.current = tracePtsRef.current.filter((p) => p.age < maxAge);
      }

      // Render
      ctx.clearRect(0, 0, dims.w, dims.h);
      ctx.save();
      ctx.translate(dims.w / 2, dims.h / 2);

      // Trace
      const trace = tracePtsRef.current;
      if (trace.length > 1) {
        // Draw with gradient opacity by age
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // For performance, draw as a single polyline with fading by group-sampling:
        if (maxAge === Infinity) {
          ctx.strokeStyle = theme.trace;
          ctx.beginPath();
          ctx.moveTo(trace[0].x, trace[0].y);
          for (let i = 1; i < trace.length; i++) ctx.lineTo(trace[i].x, trace[i].y);
          ctx.stroke();
        } else {
          // segment-based alpha
          for (let i = 1; i < trace.length; i++) {
            const a = 1 - trace[i].age / maxAge;
            if (a <= 0) continue;
            ctx.strokeStyle = hexWithAlpha(theme.trace, a);
            ctx.beginPath();
            ctx.moveTo(trace[i - 1].x, trace[i - 1].y);
            ctx.lineTo(trace[i].x, trace[i].y);
            ctx.stroke();
          }
        }
      }

      // Circles and vectors
      if (showCircles || showVectors) {
        for (let i = 0; i < tips.length - 1; i++) {
          const from = tips[i];
          const to = tips[i + 1];
          const r = Math.hypot(to.x - from.x, to.y - from.y);
          if (showCircles && r > 0.5) {
            ctx.strokeStyle = theme.circle;
            ctx.globalAlpha = Math.max(0.15, 1 - i / Math.max(6, N) * 0.8);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(from.x, from.y, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (showVectors) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = theme.vector;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Dot at tip
      ctx.fillStyle = theme.trace;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.panel;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
  }, [dims, theme, coeffs, N, speed, playing, showCircles, showVectors, trailMode]);

  // Mouse/touch drawing
  const getLocalPt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left - dims.w / 2,
      y: clientY - rect.top - dims.h / 2,
    };
  };

  const handleDown = (e) => {
    if (!canDraw) return;
    e.preventDefault();
    drawingRef.current = true;
    onDrawStart(getLocalPt(e));
  };
  const handleMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    onDrawPoint(getLocalPt(e));
  };
  const handleUp = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault && e.preventDefault();
    drawingRef.current = false;
    onDrawEnd();
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        style={{
          position: 'absolute', inset: 0,
          cursor: canDraw ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
      />
    </div>
  );
}

function hexWithAlpha(hex, a) {
  // accept #rrggbb or rgba(...) strings
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
    return hex.replace(/rgba?\(([^)]+)\)/, (m, inner) => {
      const parts = inner.split(',').map((s) => s.trim());
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${a.toFixed(3)})`;
    });
  }
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

Object.assign(window, { FourierCanvas });
