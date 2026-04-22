// Main App: layout, state, tweaks bridge.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "defaultN": 60,
  "defaultSpeed": 0.25,
  "showCircles": true,
  "showVectors": true,
  "showUserPath": true,
  "trailMode": "infinite",
  "showMath": true
}/*EDITMODE-END*/;

function App() {
  // persisted-tweak controlled values
  const [themeKey, setThemeKey] = useState(TWEAK_DEFAULTS.theme);
  const theme = THEMES[themeKey] || THEMES.paper;

  // language
  const [lang, setLang] = useState(() => localStorage.getItem('fc_lang') || 'en');
  const tr = I18N[lang] || I18N.en;
  const changeLang = (l) => { setLang(l); localStorage.setItem('fc_lang', l); };

  // mode: 'draw' or 'studio'
  const [mode, setMode] = useState('draw');
  const [vectors, setVectors] = useState(() => genDefaultVectors());
  const studioCoeffs = useMemo(() => vectorsToCoeffs(vectors), [vectors]);

  // live controls
  const [N, setN] = useState(TWEAK_DEFAULTS.defaultN);
  const [speed, setSpeed] = useState(TWEAK_DEFAULTS.defaultSpeed);
  const [playing, setPlaying] = useState(true);
  const [showCircles, setShowCircles] = useState(TWEAK_DEFAULTS.showCircles);
  const [showVectors, setShowVectors] = useState(TWEAK_DEFAULTS.showVectors);
  const [showUserPath, setShowUserPath] = useState(TWEAK_DEFAULTS.showUserPath);
  const [trailMode, setTrailMode] = useState(TWEAK_DEFAULTS.trailMode);
  const [showMath, setShowMath] = useState(TWEAK_DEFAULTS.showMath);

  // path / coefficient state
  const [userPath, setUserPath] = useState(null);   // centered points
  const [rawDrawing, setRawDrawing] = useState([]); // during-drag points
  const [isDrawing, setIsDrawing] = useState(false);
  const [coeffs, setCoeffs] = useState(null);
  const [pathResampled, setPathResampled] = useState(null);
  const [activePreset, setActivePreset] = useState('heart');
  const [t, setT] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // When a preset is chosen, compute coefficients.
  const applyPath = useCallback((points) => {
    if (!points || points.length < 4) return;
    const closed = closePath(points);
    const { centered } = centerPath(closed);
    const resampled = resamplePath(centered, 512);
    const c = dft(resampled);
    setUserPath(centered);
    setPathResampled(resampled);
    setCoeffs(c);
    setPlaying(true);
  }, []);

  // Load default preset on mount
  useEffect(() => {
    if (PRESETS[activePreset]) applyPath(PRESETS[activePreset].fn());
    // eslint-disable-next-line
  }, []);

  const selectPreset = (key) => {
    setActivePreset(key);
    if (PRESETS[key]) applyPath(PRESETS[key].fn());
  };

  // Drawing handlers
  const onDrawStart = (pt) => {
    setIsDrawing(true);
    setRawDrawing([pt]);
    setCoeffs(null);
    setUserPath(null);
  };
  const onDrawPoint = (pt) => {
    setRawDrawing((prev) => {
      if (prev.length === 0) return [pt];
      const last = prev[prev.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 2) return prev;
      return [...prev, pt];
    });
  };
  const onDrawEnd = () => {
    setIsDrawing(false);
    setActivePreset(null);
    if (rawDrawing.length >= 6) {
      applyPath(rawDrawing);
    }
    setRawDrawing([]);
  };

  // Clear
  const onClear = () => {
    setCoeffs(null);
    setUserPath(null);
    setRawDrawing([]);
    setActivePreset(null);
  };

  // Tweaks: postMessage bridge
  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setEditMode(true);
      if (e.data.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const setTweak = (key, value) => {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
  };

  // Amplitude summary for the math panel
  const topAmps = useMemo(() => {
    const src = mode === 'studio' ? studioCoeffs : coeffs;
    if (!src) return [];
    return src.slice(0, 8).map((c, i) => ({
      i,
      freq: c.freq,
      amp: c.amp,
      phase: c.phase,
    }));
  }, [coeffs, studioCoeffs, mode]);

  const maxN = Math.min(coeffs ? coeffs.length : 200, 200);

  // In studio mode, the active coeffs come from user vectors; maxN is len.
  const activeCoeffs = mode === 'studio' ? studioCoeffs : coeffs;
  const activeN = mode === 'studio' ? studioCoeffs.length : N;

  // Inline live-drawing render inside canvas (via extra prop)
  const activePath = isDrawing && rawDrawing.length > 1 ? rawDrawing : userPath;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: theme.bg,
      color: theme.ink,
      fontFamily: 'Inter, -apple-system, sans-serif',
      display: 'grid',
      gridTemplateColumns: 'minmax(260px, 300px) 1fr',
      overflow: 'hidden',
    }}>
      {/* Left rail */}
      <aside style={{
        borderRight: `1px solid ${theme.line}`,
        background: theme.panel,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Sticky header: wordmark + mode toggle — always visible */}
        <div style={{
          padding: '16px 20px 14px',
          flexShrink: 0,
          borderBottom: `1px solid ${theme.line}`,
          background: theme.panel,
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9, letterSpacing: 3, color: theme.muted,
            textTransform: 'uppercase', marginBottom: 4,
          }}>Fourier Canvas</div>
          <div style={{
            fontFamily: 'Newsreader, ui-serif, Georgia, serif',
            fontSize: 20, lineHeight: 1.2,
            fontWeight: 400, letterSpacing: -0.4, marginBottom: 14,
          }}>
            <em style={{ fontStyle: 'italic' }}>f</em>(t) = <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}>Σ cₙ e<sup style={{ fontSize: 9 }}>i2πnt</sup></span>
          </div>
          {/* Mode toggle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            border: `1px solid ${theme.line}`, borderRadius: 8, overflow: 'hidden',
          }}>
            {[['draw', tr.draw], ['studio', tr.studio]].map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)}
                style={{
                  padding: '9px 8px', fontSize: 12, fontFamily: 'Inter, sans-serif',
                  fontWeight: 600, letterSpacing: 0.4, cursor: 'pointer',
                  background: mode === k ? theme.ink : 'transparent',
                  color: mode === k ? theme.panel : theme.muted,
                  border: 'none', transition: 'all 120ms',
                }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          overflowY: 'auto', flex: 1,
          padding: '18px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
        {/* Description */}
        <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.5 }}>
          {mode === 'draw' ? tr.tagline : tr.taglineStudio}
        </div>

        {mode === 'studio' && (
          <VectorStudio vectors={vectors} setVectors={setVectors} theme={theme} tr={tr} />
        )}

        {mode === 'studio' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionLabel theme={theme}>{tr.playback}</SectionLabel>
            <Slider label="Speed" value={speed} min={0.02} max={1.5} step={0.01}
              theme={theme} onChange={setSpeed} format={(v) => `${v.toFixed(2)}×`} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button theme={theme} primary onClick={() => setPlaying((p) => !p)}>
                {playing ? tr.pause : tr.play}
              </Button>
            </div>
          </section>
        )}

        {/* Presets */}
        {mode === 'draw' && (
        <>
        <section>
          <SectionLabel theme={theme}>{tr.presets}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(PRESETS).map(([key, p]) => (
              <PresetChip
                key={key}
                label={p.label}
                active={activePreset === key}
                theme={theme}
                onClick={() => selectPreset(key)}
              />
            ))}
          </div>
        </section>

        {/* Controls */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionLabel theme={theme}>{tr.controls}</SectionLabel>
          <Slider
            label={tr.epicycles}
            value={N}
            min={1}
            max={maxN}
            step={1}
            onChange={setN}
            theme={theme}
            format={(v) => `${v}`}
          />
          <Slider
            label={tr.speed}
            value={speed}
            min={0.02}
            max={1.5}
            step={0.01}
            onChange={setSpeed}
            theme={theme}
            format={(v) => `${v.toFixed(2)}×`}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button theme={theme} primary onClick={() => setPlaying((p) => !p)}>
              {playing ? tr.pause : tr.play}
            </Button>
            <Button theme={theme} onClick={() => onClear()}>{tr.clear}</Button>
          </div>
        </section>
        </>
        )}

        {/* Layers */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel theme={theme}>{tr.layers}</SectionLabel>
          <Toggle label={tr.epicyclesToggle} value={showCircles} onChange={setShowCircles} theme={theme} />
          <Toggle label={tr.vectors}         value={showVectors} onChange={setShowVectors} theme={theme} />
          <Toggle label={tr.sourcePath}      value={showUserPath} onChange={setShowUserPath} theme={theme} />
        </section>

        {/* Trail */}
        <section>
          <SectionLabel theme={theme}>{tr.trail}</SectionLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['short', tr.short], ['long', tr.long], ['infinite', tr.infinite]].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setTrailMode(m)}
                style={{
                  flex: 1, padding: '7px 0',
                  background: trailMode === m ? theme.ink : 'transparent',
                  color: trailMode === m ? theme.panel : theme.ink,
                  border: `1px solid ${theme.line}`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >{label}</button>
            ))}
          </div>
        </section>

        {/* Hint for mobile/desktop */}
        {mode === 'draw' && (
        <section style={{
          fontSize: 11, lineHeight: 1.6, color: theme.muted,
          fontFamily: 'JetBrains Mono, monospace',
          padding: '12px 14px',
          border: `1px dashed ${theme.line}`,
          borderRadius: 6,
        }}>
          <div>{tr.hintDraw}</div>
          <div style={{ marginTop: 6 }}><span style={{ color: theme.ink }}>{tr.hintSpace}</span> {tr.hintSpaceLabel}</div>
          <div><span style={{ color: theme.ink }}>{tr.hintC}</span> {tr.hintCLabel}</div>
        </section>
        )}
        </div>{/* end scrollable content */}
      </aside>

      {/* Main canvas area */}
      <main style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Top status bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 1.5,
            textTransform: 'uppercase', color: theme.muted,
          }}>
            {mode === 'studio'
              ? tr.vectorCount(vectors.length)
              : (coeffs ? `${N} / ${coeffs.length} ${tr.harmonics}` : tr.ready)}
            <span style={{ margin: '0 10px', color: theme.line }}>│</span>
            t = {t.toFixed(3)}
          </div>
          <div style={{
            display: 'flex', gap: 4, pointerEvents: 'auto',
            background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 99,
            padding: 3,
          }}>
            {Object.keys(I18N).map((l) => (
              <button
                key={l}
                onClick={() => changeLang(l)}
                title={I18N[l].langName}
                style={{
                  padding: '3px 8px', borderRadius: 99,
                  border: lang === l ? `1.5px solid ${theme.ink}` : '1px solid transparent',
                  background: lang === l ? theme.ink : 'transparent',
                  color: lang === l ? theme.panel : theme.muted,
                  fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600, letterSpacing: 0.5, cursor: 'pointer',
                }}
              >{I18N[l].langLabel}</button>
            ))}
          </div>
          <div style={{
            display: 'flex', gap: 6, pointerEvents: 'auto',
            background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 99,
            padding: 3,
          }}>
            {Object.entries(THEMES).map(([k, v]) => (
              <button
                key={k}
                onClick={() => { setThemeKey(k); setTweak('theme', k); }}
                style={{
                  width: 28, height: 28, borderRadius: 99,
                  border: themeKey === k ? `2px solid ${theme.ink}` : `1px solid ${theme.line}`,
                  background: v.bg,
                  cursor: 'pointer',
                  position: 'relative',
                }}
                title={v.name}
              >
                <span style={{
                  position: 'absolute', inset: 4, borderRadius: 99,
                  background: v.accent,
                }} />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <FourierCanvas
          theme={theme}
          coeffs={activeCoeffs}
          userPath={mode === 'studio' ? null : activePath}
          pathResampled={pathResampled}
          N={activeN}
          speed={speed}
          playing={playing && !isDrawing}
          showCircles={showCircles}
          showVectors={showVectors}
          showUserPath={showUserPath && mode !== 'studio'}
          trailMode={trailMode}
          canDraw={mode === 'draw'}
          onDrawStart={onDrawStart}
          onDrawPoint={onDrawPoint}
          onDrawEnd={onDrawEnd}
          onTimeUpdate={(nt) => setT(nt)}
        />

        {/* Math readout */}
        {showMath && activeCoeffs && activeCoeffs.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 18, left: 20, zIndex: 2,
            background: `${theme.panel}`,
            border: `1px solid ${theme.line}`,
            borderRadius: 8,
            padding: '14px 16px',
            minWidth: 260,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: theme.ink,
            boxShadow: themeKey === 'graphite' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
              color: theme.muted, marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{tr.dominantHarmonics}</span>
              <button onClick={() => setShowMath(false)} style={{
                background: 'none', border: 'none', color: theme.muted, cursor: 'pointer',
                fontSize: 12, padding: 0, lineHeight: 1,
              }}>×</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr style={{ color: theme.muted }}>
                  <th style={{ textAlign: 'left', padding: '2px 0', fontWeight: 400 }}>#</th>
                  <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 400 }}>freq</th>
                  <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 400 }}>|c|</th>
                  <th style={{ textAlign: 'right', padding: '2px 0', fontWeight: 400 }}>arg</th>
                </tr>
              </thead>
              <tbody>
                {topAmps.map((r) => {
                  const barW = Math.min(1, r.amp / (topAmps[0]?.amp || 1));
                  return (
                    <tr key={r.i}>
                      <td style={{ padding: '3px 0' }}>{String(r.i).padStart(2, '0')}</td>
                      <td style={{ textAlign: 'right', padding: '3px 6px' }}>{r.freq > 0 ? `+${r.freq}` : r.freq}</td>
                      <td style={{ textAlign: 'right', padding: '3px 0', position: 'relative' }}>
                        <div style={{
                          position: 'absolute', right: 0, top: 4,
                          height: 10,
                          width: barW * 70,
                          background: theme.accent,
                          opacity: 0.2,
                          borderRadius: 1,
                        }} />
                        <span style={{ position: 'relative' }}>{r.amp.toFixed(1)}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '3px 0' }}>{r.phase.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!showMath && activeCoeffs && activeCoeffs.length > 0 && (
          <button
            onClick={() => setShowMath(true)}
            style={{
              position: 'absolute', bottom: 18, left: 20, zIndex: 2,
              background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 99,
              padding: '6px 12px', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
              color: theme.muted, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
            }}
          >{tr.showMath}</button>
        )}

        {/* Empty state hint */}
        {!coeffs && !isDrawing && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              color: theme.muted, textAlign: 'center',
              fontFamily: 'Newsreader, Georgia, serif',
              fontSize: 20, fontStyle: 'italic', letterSpacing: -0.2,
            }}>
              {tr.drawHint}
              <div style={{
                fontSize: 11, fontStyle: 'normal', letterSpacing: 2, marginTop: 10,
                fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
              }}>{tr.drawHintSub}</div>
            </div>
          </div>
        )}

        {/* Edit-mode badge (Tweaks) */}
        {editMode && (
          <div style={{
            position: 'absolute', bottom: 18, right: 20, zIndex: 3,
            background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 10,
            padding: 16, minWidth: 240,
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
              color: theme.muted, marginBottom: 12, fontFamily: 'JetBrains Mono, monospace',
            }}>{tr.tweaks}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: theme.muted, marginBottom: 6 }}>{tr.theme}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(THEMES).map(([k, v]) => (
                    <button key={k} onClick={() => { setThemeKey(k); setTweak('theme', k); }}
                      style={{
                        flex: 1, padding: '6px 8px', fontSize: 11,
                        background: themeKey === k ? theme.ink : 'transparent',
                        color: themeKey === k ? theme.panel : theme.ink,
                        border: `1px solid ${theme.line}`, borderRadius: 6, cursor: 'pointer',
                      }}>{v.name}</button>
                  ))}
                </div>
              </div>
              <Toggle label={tr.showMathPanel} value={showMath} onChange={(v) => { setShowMath(v); setTweak('showMath', v); }} theme={theme} />
              <Slider label={tr.defaultN} value={N} min={1} max={maxN} step={1} theme={theme}
                onChange={(v) => { setN(v); setTweak('defaultN', v); }}
                format={(v) => `${v}`} />
              <Slider label={tr.defaultSpeed} value={speed} min={0.02} max={1.5} step={0.01} theme={theme}
                onChange={(v) => { setSpeed(v); setTweak('defaultSpeed', v); }}
                format={(v) => `${v.toFixed(2)}×`} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SectionLabel({ children, theme }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
      color: theme.muted, marginBottom: 10,
    }}>{children}</div>
  );
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    window.__togglePlay && window.__togglePlay();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
