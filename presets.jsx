// Preset closed curves. Each returns an array of {x, y} in a ~600x600 box centered at 0.
// Points are densely sampled along the parametric curve.

function presetHeart(steps = 400) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({ x: x * 14, y: y * 14 });
  }
  return pts;
}

function presetStar(steps = 400, points = 5) {
  const pts = [];
  const R = 230, r = 95;
  const verts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    verts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  }
  // resample along polyline
  const cum = [0];
  for (let i = 1; i <= verts.length; i++) {
    const p0 = verts[(i - 1) % verts.length];
    const p1 = verts[i % verts.length];
    cum.push(cum[cum.length - 1] + Math.hypot(p1.x - p0.x, p1.y - p0.y));
  }
  const total = cum[cum.length - 1];
  for (let i = 0; i < steps; i++) {
    const d = (i / steps) * total;
    let lo = 0;
    while (lo < cum.length - 1 && cum[lo + 1] < d) lo++;
    const segLen = cum[lo + 1] - cum[lo] || 1;
    const t = (d - cum[lo]) / segLen;
    const p0 = verts[lo % verts.length];
    const p1 = verts[(lo + 1) % verts.length];
    pts.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
  }
  return pts;
}

function presetInfinity(steps = 400) {
  const pts = [];
  const a = 240;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    pts.push({ x: (a * Math.cos(t)) / denom, y: (a * Math.sin(t) * Math.cos(t)) / denom });
  }
  return pts;
}

function presetFlower(steps = 500, petals = 6) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 180 + 70 * Math.cos(petals * t);
    pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
  }
  return pts;
}

function presetSquare(steps = 400) {
  const size = 220;
  const corners = [
    { x: -size, y: -size },
    { x: size, y: -size },
    { x: size, y: size },
    { x: -size, y: size },
  ];
  const pts = [];
  for (let c = 0; c < 4; c++) {
    const p0 = corners[c];
    const p1 = corners[(c + 1) % 4];
    const per = steps / 4;
    for (let i = 0; i < per; i++) {
      const t = i / per;
      pts.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
    }
  }
  return pts;
}

// A stylized treble-like spiral squiggle
function presetSpiral(steps = 500) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 180 * (1 + 0.4 * Math.sin(3 * t));
    const a = t + 0.8 * Math.sin(2 * t);
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

const PRESETS = {
  heart:    { label: 'Heart',    fn: presetHeart },
  star:     { label: 'Star',     fn: presetStar },
  infinity: { label: 'Lemniscate', fn: presetInfinity },
  flower:   { label: 'Rosette',  fn: presetFlower },
  square:   { label: 'Square',   fn: presetSquare },
  spiral:   { label: 'Spiral',   fn: presetSpiral },
};

window.PRESETS = PRESETS;
