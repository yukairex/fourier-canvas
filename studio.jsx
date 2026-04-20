// Vector Studio: directly edit a small set of (freq, amp, phase) vectors.

const { useState: useStudioState } = React;

function genDefaultVectors() {
  // A pleasing starter: two counter-rotating vectors → ellipse-ish
  return [
    { id: 1, freq:  1, amp: 160, phase: 0 },
    { id: 2, freq: -3, amp:  60, phase: 1.0 },
    { id: 3, freq:  5, amp:  24, phase: 0.4 },
  ];
}

// Render the studio panel (fills the left rail area when in studio mode).
function VectorStudio({ vectors, setVectors, theme, tr }) {
  const nextId = React.useRef(
    vectors.reduce((m, v) => Math.max(m, v.id), 0) + 1
  );

  const update = (id, key, val) => {
    setVectors((vs) => vs.map((v) => v.id === id ? { ...v, [key]: val } : v));
  };
  const remove = (id) => {
    setVectors((vs) => vs.filter((v) => v.id !== id));
  };
  const add = () => {
    const id = nextId.current++;
    setVectors((vs) => [...vs, { id, freq: vs.length + 1, amp: 40, phase: 0 }]);
  };
  const reset = () => {
    const starters = genDefaultVectors();
    nextId.current = starters.length + 1;
    setVectors(starters);
  };
  const randomize = () => {
    setVectors((vs) => vs.map((v) => ({
      ...v,
      freq: Math.round((Math.random() * 2 - 1) * 8) || 1,
      amp: 20 + Math.random() * 180,
      phase: Math.random() * Math.PI * 2,
    })));
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel theme={theme}>{tr ? tr.vectorsLabel(vectors.length) : `Vectors · ${vectors.length}`}</SectionLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button small theme={theme} onClick={randomize}>{tr ? tr.randomize : 'Randomize'}</Button>
          <Button small theme={theme} onClick={reset}>{tr ? tr.reset : 'Reset'}</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vectors.map((v, i) => (
          <VectorCard key={v.id} v={v} i={i} theme={theme} tr={tr} onChange={update} onRemove={remove} canRemove={vectors.length > 1} />
        ))}
      </div>

      <button
        onClick={add}
        style={{
          padding: '10px', background: 'transparent',
          border: `1px dashed ${theme.line}`,
          borderRadius: 6, color: theme.muted,
          fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: 2, textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >{ tr ? tr.addVector : '+ Add vector' }</button>
    </section>
  );
}

function VectorCard({ v, i, theme, tr, onChange, onRemove, canRemove }) {
  // Little swatch color cycling through accents for identity
  const hue = (i * 47) % 360;
  return (
    <div style={{
      border: `1px solid ${theme.line}`,
      borderRadius: 8,
      padding: '10px 12px',
      background: theme.bg === theme.panel ? 'transparent' : theme.bg,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 10, height: 10, borderRadius: 99,
            background: `hsl(${hue} 65% 52%)`,
            display: 'inline-block',
          }} />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11, color: theme.ink, fontWeight: 500,
          }}>
            v{String(i + 1).padStart(2, '0')}
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, color: theme.muted,
          }}>
            {v.amp.toFixed(0)} · e^(i·{v.freq}·2πt{v.phase >= 0 ? '+' : ''}{v.phase.toFixed(2)})
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MiniSlider label={tr ? tr.freq  : 'freq'}  value={v.freq}  min={-10} max={10}     step={1}    theme={theme}
          onChange={(x) => onChange(v.id, 'freq', x)}  format={(x) => `${x > 0 ? '+' : ''}${x}`} />
        <MiniSlider label={tr ? tr.amp   : 'amp'}   value={v.amp}   min={0}   max={260}    step={1}    theme={theme}
          onChange={(x) => onChange(v.id, 'amp', x)}   format={(x) => `${x.toFixed(0)}`} />
        <MiniSlider label={tr ? tr.phase : 'phase'} value={v.phase} min={0}   max={6.2832} step={0.01} theme={theme}
          onChange={(x) => onChange(v.id, 'phase', x)} format={(x) => `${(x / Math.PI).toFixed(2)}π`} />
      </div>
      {canRemove && (
        <button
          onClick={() => onRemove(v.id)}
          style={{
            marginTop: 4, padding: '4px 8px', fontSize: 10,
            background: 'transparent', color: theme.muted,
            border: `1px solid ${theme.line}`, borderRadius: 4,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >{tr ? tr.removeVector : 'Remove vector'}</button>
      )}
    </div>
  );
}

function MiniSlider({ label, value, min, max, step, onChange, format, theme }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 48px', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        color: theme.muted, letterSpacing: 1, textTransform: 'uppercase',
      }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: theme.accent, height: 3 }} />
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: theme.ink,
        textAlign: 'right',
      }}>{format ? format(value) : value}</span>
    </div>
  );
}

// Build a synthetic coeffs array from studio vectors for FourierCanvas to consume.
function vectorsToCoeffs(vectors) {
  // Sort by amp descending so largest-first (matches drawn-path behavior).
  const sorted = [...vectors].filter((v) => v.amp > 0).sort((a, b) => b.amp - a.amp);
  return sorted.map((v) => ({
    freq: v.freq,
    amp: v.amp,
    phase: v.phase,
    re: v.amp * Math.cos(v.phase),
    im: v.amp * Math.sin(v.phase),
  }));
}

Object.assign(window, { VectorStudio, genDefaultVectors, vectorsToCoeffs });
