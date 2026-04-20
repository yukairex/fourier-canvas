// Fourier math + path utilities
// DFT: take N complex samples of a path, return N {freq, amp, phase} descriptors

function dft(samples) {
  const N = samples.length;
  const out = [];
  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const phi = (2 * Math.PI * k * n) / N;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      re += samples[n].x * cos + samples[n].y * sin;
      im += -samples[n].x * sin + samples[n].y * cos;
    }
    re /= N;
    im /= N;
    // Remap to signed frequency: k in [N/2, N) becomes k - N (negative freq).
    const freq = k < N / 2 ? k : k - N;
    const amp = Math.sqrt(re * re + im * im);
    const phase = Math.atan2(im, re);
    // center frequencies around 0 (negative + positive) for aesthetic ordering later
    out.push({ re, im, freq, amp, phase });
  }
  // reorder: 0, +1, -1, +2, -2, ... so strongest low-freq dominate
  // Actually sort by amp descending for best visual tracing
  out.sort((a, b) => b.amp - a.amp);
  return out;
}

// Resample a polyline into N evenly-spaced points along its arc length.
function resamplePath(points, N) {
  if (points.length < 2) return points.slice();
  // compute cumulative arc length
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [points[0]];
  const out = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * total;
    // find segment
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= t) lo = mid;
      else hi = mid;
    }
    const segLen = cum[hi] - cum[lo] || 1;
    const localT = (t - cum[lo]) / segLen;
    out.push({
      x: points[lo].x + (points[hi].x - points[lo].x) * localT,
      y: points[lo].y + (points[hi].y - points[lo].y) * localT,
    });
  }
  return out;
}

// Ensure closed loop (append first point)
function closePath(points) {
  if (points.length < 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) > 0.5) {
    return [...points, { x: a.x, y: a.y }];
  }
  return points;
}

// Center path to origin and return {centered, bbox}
function centerPath(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    centered: points.map((p) => ({ x: p.x - cx, y: p.y - cy })),
    bbox: { minX, minY, maxX, maxY, cx, cy, w: maxX - minX, h: maxY - minY },
  };
}

// Evaluate the Fourier series at time t (0..1) with the top K coefficients.
// Returns array of vector tip positions (the last one is the drawing tip).
function evalFourier(coeffs, t, K) {
  let x = 0, y = 0;
  const tips = [{ x: 0, y: 0 }];
  const limit = Math.min(K, coeffs.length);
  for (let i = 0; i < limit; i++) {
    const c = coeffs[i];
    const angle = c.freq * 2 * Math.PI * t + c.phase;
    x += c.amp * Math.cos(angle);
    y += c.amp * Math.sin(angle);
    tips.push({ x, y });
  }
  return tips;
}

Object.assign(window, { dft, resamplePath, closePath, centerPath, evalFourier });
