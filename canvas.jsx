// FourierCanvas: drawing + animation + zoom/pan.

function FourierCanvas({
  theme, coeffs, userPath,
  N, speed, playing, showCircles, showVectors, showUserPath, trailMode,
  onDrawStart, onDrawPoint, onDrawEnd, canDraw,
  onTimeUpdate,
}) {
  const canvasRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [dims, setDims] = React.useState({ w: 800, h: 600 });

  // Zoom/pan state (refs for perf in animation loop)
  const viewRef = React.useRef({ scale: 1, ox: 0, oy: 0 }); // ox,oy = pan offset in canvas px
  const [viewState, setViewState] = React.useState({ scale: 1, ox: 0, oy: 0 }); // for overlay re-draw
  const panRef = React.useRef(null); // { startX, startY, startOx, startOy }

  const tRef = React.useRef(0);
  const tracePtsRef = React.useRef([]);
  const rafRef = React.useRef(0);
  const lastTsRef = React.useRef(0);
  const drawingRef = React.useRef(false);

  // Resize observer
  React.useEffect(() => {
    const el = containerRef.current;
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

  // Reset zoom
  const resetView = () => {
    viewRef.current = { scale: 1, ox: 0, oy: 0 };
    setViewState({ scale: 1, ox: 0, oy: 0 });
  };

  const zoomBy = (factor, cx, cy) => {
    const v = viewRef.current;
    const w = dims.w, h = dims.h;
    const pcx = cx ?? w / 2;
    const pcy = cy ?? h / 2;
    const newScale = Math.min(20, Math.max(0.1, v.scale * factor));
    // Keep world point under cursor fixed:
    // world_pt = (pcx - w/2 - ox) / scale
    // After zoom: pcx = world_pt * newScale + w/2 + newOx
    // => newOx = pcx - w/2 - (pcx - w/2 - ox) * (newScale/scale)
    const newOx = pcx - w / 2 - (pcx - w / 2 - v.ox) * (newScale / v.scale);
    const newOy = pcy - h / 2 - (pcy - h / 2 - v.oy) * (newScale / v.scale);
    const next = { scale: newScale, ox: newOx, oy: newOy };
    viewRef.current = next;
    setViewState({ ...next });
  };

  // Wheel zoom
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomBy(factor, cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dims]);

  // Pinch-to-zoom
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let lastDist = null;
    let lastMidX = null, lastMidY = null;
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const rect = el.getBoundingClientRect();
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
        if (lastDist !== null) {
          zoomBy(dist / lastDist, midX, midY);
          // pan by mid movement
          const dx = midX - lastMidX, dy = midY - lastMidY;
          const v = viewRef.current;
          const next = { ...v, ox: v.ox + dx, oy: v.oy + dy };
          viewRef.current = next;
          setViewState({ ...next });
        }
        lastDist = dist; lastMidX = midX; lastMidY = midY;
      }
    };
    const onTouchEnd = () => { lastDist = null; };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [dims]);

  // Overlay: grid + user path (redraws on view change)
  React.useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + 'px'; c.style.height = dims.h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dims.w, dims.h);

    const { scale, ox, oy } = viewRef.current;
    // World origin in canvas coords:
    const cx = dims.w / 2 + ox;
    const cy = dims.h / 2 + oy;

    // Grid (adapt step to zoom level)
    const baseStep = 40;
    const step = baseStep * scale;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = (((-cx) / step) | 0) * step + cx % step;
    const startY = (((-cy) / step) | 0) * step + cy % step;
    for (let x = startX; x <= dims.w + step; x += step) {
      ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, dims.h);
    }
    for (let y = startY; y <= dims.h + step; y += step) {
      ctx.moveTo(0, y + 0.5); ctx.lineTo(dims.w, y + 0.5);
    }
    ctx.stroke();

    // Axis lines
    ctx.strokeStyle = theme.gridStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, 0); ctx.lineTo(cx + 0.5, dims.h);
    ctx.moveTo(0, cy + 0.5); ctx.lineTo(dims.w, cy + 0.5);
    ctx.stroke();

    // Origin label
    ctx.fillStyle = theme.muted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('0', cx + 4, cy - 4);

    // User path
    if (showUserPath && userPath && userPath.length > 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.strokeStyle = theme.user;
      ctx.lineWidth = 1.2 / scale;
      ctx.setLineDash([3 / scale, 4 / scale]);
      ctx.beginPath();
      ctx.moveTo(userPath[0].x, userPath[0].y);
      for (let i = 1; i < userPath.length; i++) ctx.lineTo(userPath[i].x, userPath[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [dims, theme, userPath, showUserPath, viewState]);

  // Animation loop
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + 'px'; c.style.height = dims.h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!coeffs || coeffs.length === 0) {
      ctx.clearRect(0, 0, dims.w, dims.h);
      return;
    }

    const tick = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      if (playing) tRef.current = (tRef.current + dt * speed) % 1;
      const t = tRef.current;
      onTimeUpdate && onTimeUpdate(t);

      const tips = evalFourier(coeffs, t, N);
      const tip = tips[tips.length - 1];

      if (playing) tracePtsRef.current.push({ x: tip.x, y: tip.y, age: 0 });
      const maxAge = trailMode === 'infinite' ? Infinity : trailMode === 'long' ? 3.0 : 1.2;
      for (const p of tracePtsRef.current) p.age += dt;
      if (maxAge !== Infinity) tracePtsRef.current = tracePtsRef.current.filter((p) => p.age < maxAge);

      ctx.clearRect(0, 0, dims.w, dims.h);

      const { scale, ox, oy } = viewRef.current;
      const originX = dims.w / 2 + ox;
      const originY = dims.h / 2 + oy;

      ctx.save();
      ctx.translate(originX, originY);
      ctx.scale(scale, scale);

      // Trace
      const trace = tracePtsRef.current;
      if (trace.length > 1) {
        ctx.lineWidth = 2.2 / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (maxAge === Infinity) {
          ctx.strokeStyle = theme.trace;
          ctx.beginPath();
          ctx.moveTo(trace[0].x, trace[0].y);
          for (let i = 1; i < trace.length; i++) ctx.lineTo(trace[i].x, trace[i].y);
          ctx.stroke();
        } else {
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

      // Circles + vectors
      if (showCircles || showVectors) {
        for (let i = 0; i < tips.length - 1; i++) {
          const from = tips[i], to = tips[i + 1];
          const r = Math.hypot(to.x - from.x, to.y - from.y);
          if (showCircles && r > 0.5) {
            ctx.strokeStyle = theme.circle;
            ctx.globalAlpha = Math.max(0.15, 1 - i / Math.max(6, N) * 0.8);
            ctx.lineWidth = 1 / scale;
            ctx.beginPath();
            ctx.arc(from.x, from.y, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (showVectors) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = theme.vector;
            ctx.lineWidth = 1.2 / scale;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Tip dot
      ctx.fillStyle = theme.trace;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.panel;
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); lastTsRef.current = 0; };
  }, [dims, theme, coeffs, N, speed, playing, showCircles, showVectors, trailMode]);

  // Pointer events: pan (right-click or when !canDraw) vs draw (left click when canDraw)
  const getCanvasPt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { cx: clientX - rect.left, cy: clientY - rect.top };
  };
  const canvasToWorld = (cx, cy) => {
    const { scale, ox, oy } = viewRef.current;
    return {
      x: (cx - dims.w / 2 - ox) / scale,
      y: (cy - dims.h / 2 - oy) / scale,
    };
  };

  const handleDown = (e) => {
    const isTouch = !!e.touches;
    if (isTouch && e.touches.length > 1) return; // pinch handled separately
    e.preventDefault();
    const { cx, cy } = getCanvasPt(e);
    const isPan = e.button === 1 || e.button === 2 || !canDraw;
    if (isPan) {
      panRef.current = { startX: cx, startY: cy, startOx: viewRef.current.ox, startOy: viewRef.current.oy };
    } else {
      drawingRef.current = true;
      const wp = canvasToWorld(cx, cy);
      onDrawStart(wp);
    }
  };
  const handleMove = (e) => {
    if (e.touches && e.touches.length > 1) return;
    e.preventDefault();
    const { cx, cy } = getCanvasPt(e);
    if (panRef.current) {
      const dx = cx - panRef.current.startX, dy = cy - panRef.current.startY;
      const next = { ...viewRef.current, ox: panRef.current.startOx + dx, oy: panRef.current.startOy + dy };
      viewRef.current = next;
      setViewState({ ...next });
    } else if (drawingRef.current) {
      onDrawPoint(canvasToWorld(cx, cy));
    }
  };
  const handleUp = (e) => {
    e.preventDefault && e.preventDefault();
    if (panRef.current) { panRef.current = null; return; }
    if (drawingRef.current) { drawingRef.current = false; onDrawEnd(); }
  };

  const cursor = panRef.current ? 'grabbing' : (!canDraw ? 'grab' : 'crosshair');

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        style={{ position: 'absolute', inset: 0, cursor, touchAction: 'none' }}
      />
      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 18, right: 20, zIndex: 3,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: '+', action: () => zoomBy(1.25) },
          { label: '⊙', action: resetView, title: 'Reset view' },
          { label: '−', action: () => zoomBy(1 / 1.25) },
        ].map(({ label, action, title }) => (
          <button key={label} onClick={action} title={title}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: theme.panel, border: `1px solid ${theme.line}`,
              color: theme.ink, fontSize: label === '⊙' ? 14 : 18,
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >{label}</button>
        ))}
        <div style={{
          fontSize: 9, color: theme.muted, textAlign: 'center', letterSpacing: 0.5,
          fontFamily: 'JetBrains Mono, monospace',
        }}>{Math.round(viewState.scale * 100)}%</div>
      </div>
    </div>
  );
}

function hexWithAlpha(hex, a) {
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
