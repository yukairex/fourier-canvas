// Theme tokens and small UI primitives for the Fourier canvas.

const THEMES = {
  paper: {
    name: 'Paper',
    bg: '#f3efe7',
    panel: '#ffffff',
    ink: '#1c1b17',
    muted: '#7a7468',
    line: '#d9d2c3',
    grid: 'rgba(28,27,23,0.06)',
    gridStrong: 'rgba(28,27,23,0.10)',
    accent: '#b85c2b',
    accent2: '#2f5c4a',
    circle: 'rgba(28,27,23,0.55)',
    vector: '#1c1b17',
    trace: '#b85c2b',
    ghost: 'rgba(28,27,23,0.28)',
    user: '#2f5c4a',
  },
  graphite: {
    name: 'Graphite',
    bg: '#0f1115',
    panel: '#181b22',
    ink: '#e9e7e1',
    muted: '#8a8e99',
    line: '#262a33',
    grid: 'rgba(255,255,255,0.04)',
    gridStrong: 'rgba(255,255,255,0.08)',
    accent: '#e7b04a',
    accent2: '#6aa9ff',
    circle: 'rgba(233,231,225,0.38)',
    vector: '#e9e7e1',
    trace: '#e7b04a',
    ghost: 'rgba(233,231,225,0.25)',
    user: '#6aa9ff',
  },
  oscilloscope: {
    name: 'Oscilloscope',
    bg: '#05120d',
    panel: '#0a1b14',
    ink: '#c9f5d9',
    muted: '#5f8c76',
    line: '#143024',
    grid: 'rgba(110,230,160,0.08)',
    gridStrong: 'rgba(110,230,160,0.14)',
    accent: '#7dfb9a',
    accent2: '#34b07a',
    circle: 'rgba(125,251,154,0.45)',
    vector: '#7dfb9a',
    trace: '#7dfb9a',
    ghost: 'rgba(125,251,154,0.3)',
    user: '#c9f5d9',
  },
};

function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 10.5,
      padding: '2px 6px',
      border: '1px solid currentColor',
      borderRadius: 4,
      opacity: 0.55,
      lineHeight: 1,
      marginLeft: 6,
    }}>{children}</span>
  );
}

function Slider({ label, value, min, max, step, onChange, format, theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: theme.muted, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: theme.ink, fontWeight: 500 }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: theme.accent, height: 4 }}
      />
    </div>
  );
}

function Toggle({ label, value, onChange, theme }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 11px',
        background: value ? theme.ink : 'transparent',
        color: value ? theme.panel : theme.ink,
        border: `1px solid ${value ? theme.ink : theme.line}`,
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        letterSpacing: 0.2,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        width: '100%',
        textAlign: 'left',
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <span style={{
        width: 22, height: 12, borderRadius: 99,
        background: value ? theme.accent : theme.line,
        position: 'relative',
        transition: 'background 120ms',
      }}>
        <span style={{
          position: 'absolute',
          top: 1, left: value ? 11 : 1,
          width: 10, height: 10,
          background: value ? theme.panel : theme.muted,
          borderRadius: 99,
          transition: 'left 120ms',
        }} />
      </span>
    </button>
  );
}

function Button({ children, onClick, theme, primary, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '6px 10px' : '9px 12px',
        background: primary ? theme.ink : 'transparent',
        color: primary ? theme.panel : theme.ink,
        border: `1px solid ${primary ? theme.ink : theme.line}`,
        borderRadius: 6,
        fontSize: small ? 11 : 12,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        letterSpacing: 0.2,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
      onMouseEnter={(e) => { if (!primary) e.currentTarget.style.background = theme.line; }}
      onMouseLeave={(e) => { if (!primary) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function PresetChip({ label, onClick, theme, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px',
        background: active ? theme.accent : 'transparent',
        color: active ? (theme.name === 'Paper' ? '#fff' : theme.panel) : theme.ink,
        border: `1px solid ${active ? theme.accent : theme.line}`,
        borderRadius: 99,
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        letterSpacing: 0.3,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

Object.assign(window, { THEMES, Kbd, Slider, Toggle, Button, PresetChip });
