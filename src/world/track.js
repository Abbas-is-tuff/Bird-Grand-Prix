// Track geometry maths. A standard 400 m athletics track (bird sized lanes).
//
// Layout (seen from above): the infield is centred on (0,0). The home straight runs
// along z = +R in the +x direction, the finish line is at x = +L/2. Birds run
// anticlockwise, so the infield is always on their LEFT.
//
// A position on the track is described by:
//   seg - 0 home straight, 1 first bend, 2 back straight, 3 second bend
//   t   - metres along a straight, or angle (radians) around a bend
//   d   - distance outward from the inner kerb (0 = kerb, 1.22 = lane 1/2 line...)

export const T = {
  L: 84.39, // straight length
  R: 36.5, // inner kerb radius
  W: 1.22, // lane width
  LANES: 8,
  CHUTE: 19, // extra straight behind the home straight for the 100 m start
  APRON: 1.0,
};
T.EDGE = T.W * T.LANES; // outer edge of lane 8
T.WALL = T.EDGE + T.APRON; // outer barrier
T.FINISH_X = T.L / 2;

// Official measurement line for lane k (0.3 m from the kerb in lane 1, 0.2 m from the line in others).
export function measureOffset(k) {
  return k === 1 ? 0.3 : (k - 1) * T.W + 0.2;
}
export function laneCenter(k) {
  return (k - 0.5) * T.W;
}
export function laneOf(d) {
  return Math.max(1, Math.min(T.LANES, Math.floor(d / T.W) + 1));
}
export function lapLength(m) {
  return 2 * T.L + 2 * Math.PI * (T.R + m);
}

// World (x,z) -> track coordinates (oval).
export function locate(x, z, out = {}) {
  const hL = T.L / 2;
  if (x >= -hL && x <= hL) {
    if (z >= 0) {
      out.seg = 0; out.t = x + hL; out.d = z - T.R;
    } else {
      out.seg = 2; out.t = hL - x; out.d = -z - T.R;
    }
  } else if (x > hL) {
    const dx = x - hL;
    out.seg = 1; out.t = Math.atan2(dx, z); out.d = Math.hypot(dx, z) - T.R;
  } else {
    const dx = -(x + hL);
    out.seg = 3; out.t = Math.atan2(dx, -z); out.d = Math.hypot(dx, z) - T.R;
  }
  out.curv = out.seg === 1 || out.seg === 3 ? 1 / (T.R + Math.max(0, out.d)) : 0;
  return out;
}

// Track coordinates -> distance along the line at offset m (0 = start of home straight).
export function stationOf(loc, m) {
  const r = T.R + m;
  const C = Math.PI * r;
  switch (loc.seg) {
    case 0: return loc.t;
    case 1: return T.L + loc.t * r;
    case 2: return T.L + C + loc.t;
    default: return 2 * T.L + C + loc.t * r;
  }
}

// Distance s along line m, sideways offset d -> world point + heading + curvature.
export function pointAt(s, m, d, out = {}) {
  const r = T.R + m;
  const L = T.L;
  const C = Math.PI * r;
  const lap = 2 * L + 2 * C;
  const hL = L / 2;
  const rd = T.R + d;
  s = ((s % lap) + lap) % lap;
  if (s < L) {
    out.x = -hL + s; out.z = T.R + d; out.h = Math.PI / 2; out.curv = 0; out.seg = 0;
  } else if (s < L + C) {
    const a = (s - L) / r;
    out.x = hL + rd * Math.sin(a); out.z = rd * Math.cos(a);
    out.h = Math.atan2(Math.cos(a), -Math.sin(a)); out.curv = 1 / rd; out.seg = 1;
  } else if (s < 2 * L + C) {
    const t = s - L - C;
    out.x = hL - t; out.z = -(T.R + d); out.h = -Math.PI / 2; out.curv = 0; out.seg = 2;
  } else {
    const a = (s - 2 * L - C) / r;
    out.x = -hL - rd * Math.sin(a); out.z = -rd * Math.cos(a);
    out.h = Math.atan2(-Math.cos(a), Math.sin(a)); out.curv = 1 / rd; out.seg = 3;
  }
  return out;
}

// Is (x,z) inside the 100 m chute (the straight extension behind the home straight)?
export function inChute(x, z) {
  return x < -T.L / 2 && x > -T.L / 2 - T.CHUTE - 2 && z > T.R - 0.5 && z < T.R + T.WALL + 0.5;
}

// Surface grip under a point. 1 = tartan track, lower = grass.
export function surfaceAt(x, z, straightMode) {
  let d;
  if (straightMode && x < T.L / 2 + 0.5) d = z - T.R;
  else d = locate(x, z).d;
  if (d >= -0.05 && d <= T.WALL) return { mu: 1.0, kind: 'tartan', d };
  return { mu: 0.78, kind: 'grass', d };
}
