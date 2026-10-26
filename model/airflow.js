'use strict';
/* Agent A: single-zone airflow network for the Saunas 101 ventilation lab.
   One unknown, the room's static pressure at floor level relative to the outdoor static pressure at floor level (pRef, Pa).
   Every opening is a path from an outdoor end (height he) to a room end (height h). Its drive for inflow is
     Δ = g·[ I_room(h) − ρ_out·he − J_path ] − pRef,   I_room(h) = ∫0..h ρ_room(z) dz,   J_path = ∫he..h ρ_path(z) dz (signed)
   and its mass flow follows Δ = a·ṁ + b·ṁ² (direction-dependent a, b; a fan adds its curve in the outward direction).
   Σ ṁ = 0 is solved on pRef (secant, falling back to Brent) to under 1e-12 kg/s. Friction factors, the densities at
   each loss and the closed heater's casing heat depend on the flows; they are frozen per pass and iterated. The duct
   column, the one strong coupling, is solved as a 1-D root from the no-flow start (a still duct holds the temperature
   of whatever surrounds it), and from the opposite start to detect a second steady state.
   Run `node airflow.js` to write airflow.csv and print the checks. Every constant is listed in docs/airflow.md. */

/* ---------- physical constants ---------- */
const G = 9.80665;                 // m/s², standard gravity
const R_AIR = 287.05;              // J/(kg·K), dry air
const TK = 273.15;
const SIGMA = 5.670374419e-8;      // W/(m²·K⁴)
const CP = 1007;                   // J/(kg·K), dry air at 300 K (Incropera & DeWitt, Table A.4)

/* ---------- shared parameters (brief) ---------- */
const P_ATM = 101300;              // Pa
const T_OUT = 25;                  // °C
const rhoOf = Tc => P_ATM / (R_AIR * (Tc + TK));
const RHO_OUT = rhoOf(T_OUT);
/* Sutherland's law (White, Viscous Fluid Flow, Table 1-2/1-3) */
const muOf = Tc => { const T = Tc + TK; return 1.716e-5 * Math.pow(T / 273.15, 1.5) * (273.15 + 110.4) / (T + 110.4); };
const kOf  = Tc => { const T = Tc + TK; return 0.0241  * Math.pow(T / 273.15, 1.5) * (273.15 + 194)   / (T + 194); };

/* ---------- geometry (drawing: h = (300 − y)·2.1/300) ---------- */
const GEOM = {
  ceiling: (300 - 8) * 2.1 / 300,                       // 2.044 m
  volume: 12,
  inletH: { above: 0.98, middle: 0.45, below: 0.12, bottom: 0 },
  exhaustH: { lower: 0.20, upper: 0.64 },
  ductTop: { riser: 2.17, half: 1.18 },
  dryH: 1.94,
  doorW: 0.70, doorH: 1.90, doorGapLow: 0.010, doorGapTop: 0.002,
  inletDuctMouthH: 0.0625,                              // Ø125 mouth resting on the floor (drawing: y 291 → 0.063 m)
  casingW: 0.29, casingH: 0.67
};

/* ---------- empirical and assumed parameters (sources in A_report.md) ---------- */
const PARAMS = {
  D: 0.125,                       // m, brief
  grilleFreeArea: 0.5,            // physical free area ratio of a typical grille (Duco louvre CPD: 50 % is the usual specification)
  wallThickness: 0.15,            // m, sleeve through the wall: assumed (site build-up: panel, 10 mm gap, 50–100 mm insulation, outer skin)
  floorThickness: 0.10,           // m, assumed
  kEntryFlush: 0.5,               // ASHRAE fitting 1-1 (Idelchik 3-1), duct flush with wall
  kEntryProjecting: 1.0,          // ASHRAE fitting 1-1, thin-wall duct projecting, L/D ≥ 0.5
  kExit: 1.0,                     // ASHRAE fitting 2-1 (Idelchik 11-1), abrupt exit, uniform velocity
  kElbow: 0.22,                   // ASHRAE fitting 3-1, smooth-radius round 90° elbow, r/D = 1.0
  roughness: 0.09e-3,             // m, galvanised steel duct (ASHRAE Fundamentals ch. 21, "medium smooth")
  doorLeafT: 0.008,               // m, 8 mm tempered glass, the usual sauna door leaf
  cdSlot: 0.61,                   // sharp-edged orifice/slot discharge coefficient
  zetaCrack: 1.5,                 // entry + exit of a straight-through crack (Etheridge & Sandberg 1996)
  epsGalv: 0.25,                  // emissivity of galvanised steel (new 0.23 to weathered 0.28)
  inletDuctReading: 'inside',     // 'inside' (IDUCT comment) or 'outside' (drawing)
  ductHeatFactor: 1,              // multiplier on the duct heat loss: 1 = bare duct (brief), 0 = adiabatic (sensitivity only)
  doorGapLow: 0.010, doorGapTop: 0.002,   // m, brief
  /* fan: Same Sky CFM-A225BG-123-374 (120×120×25, 2300 rpm, 80.17 CFM) P-Q curve, scaled by the affinity laws to the site's fan (68.6 CFM) */
  fanFreeCFM: 68.6,
  fanBaseCFM: 80.17,
  fanBaseCurve: [[0, 4.32], [7, 3.95], [17.5, 3.38], [26.5, 2.88], [35.5, 2.30], [44, 2.05], [51.5, 1.95], [62, 1.47], [71, 0.55], [80.17, 0]], // CFM, mmH2O
  fanRatedRho: null,              // set below: 25 °C, 65 % RH, 101.325 kPa (datasheet test condition)
  /* closed casing heater under a floor inlet: stand-ins, low confidence */
  casingBaseGap: 0.02,            // m, intake slot round the casing foot (assumed; not in the brief)
  casingStoneDepth: 0.10,         // m, stone heap on the casing top (drawing: y 192–205)
  stoneD: 0.075,                  // m, site rule: 5 to 10 cm stones
  stoneVoid: 0.40,                // bed voidage (Duffie & Beckman: pebble beds about 0.4)
  heaterConvFraction: 1.0,        // stand-in for agent D: upper bound, all mean heater power leaves the casing as warm air
  wallInsulation: 0.075, lambdaInsulation: 0.037, lambdaPine: 0.13, panelT: 0.015,
  lambdaGround: 2.0,              // ISO 13370 default when the soil is unknown
  maxPasses: 400                  // inner fixed-point passes (numerics only)
};
{ const pv = 0.65 * 3169; PARAMS.fanRatedRho = (101325 - pv) / (R_AIR * 298.15) + pv / (461.5 * 298.15); }

/* ASHRAE fitting 6-8 (Idelchik diagram 8-6): perforated plate in a duct, t/d = 0.2, loss coefficient vs free area ratio n */
const PLATE_N  = [0.20, 0.25, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90];
const PLATE_C0 = [48,   28,   17,   7.7,  3.8,  1.9,  0.91, 0.40, 0.13];
function zetaPlate(n) {
  if (n <= PLATE_N[0]) return PLATE_C0[0];
  for (let i = 1; i < PLATE_N.length; i++) if (n <= PLATE_N[i]) {
    const t = (n - PLATE_N[i - 1]) / (PLATE_N[i] - PLATE_N[i - 1]);
    return Math.exp(Math.log(PLATE_C0[i - 1]) * (1 - t) + Math.log(PLATE_C0[i]) * t);
  }
  return PLATE_C0[PLATE_C0.length - 1];
}

/* ---------- the stand-in room profile (agent D replaces it) ---------- */
/* Linear from 40 °C at the floor to the 90 °C thermostat set point under the ceiling: lab.js's own stack stand-in (40 → 92.5 °C) with the brief's 90 °C */
function defaultProfile(h) { const H = GEOM.ceiling; const x = Math.min(Math.max(h, 0), H); return 40 + 50 * x / H; }

/* ---------- room density integral I(h) = ∫0..h ρ(T(z)) dz, Simpson on 5 mm cells ---------- */
const TABLE_DZ = 0.005, TABLE_N = 460;                    // 0 .. 2.30 m
const tableCache = new WeakMap();
function roomTable(profile) {
  let t = tableCache.get(profile); if (t) return t;
  const I = new Float64Array(TABLE_N + 1), rhoNode = new Float64Array(TABLE_N + 1);
  for (let i = 0; i <= TABLE_N; i++) rhoNode[i] = rhoOf(profile(i * TABLE_DZ));
  for (let i = 0; i < TABLE_N; i++) {
    const rm = rhoOf(profile((i + 0.5) * TABLE_DZ));
    I[i + 1] = I[i] + TABLE_DZ * (rhoNode[i] + 4 * rm + rhoNode[i + 1]) / 6;
  }
  t = { I, rhoNode, profile };
  tableCache.set(profile, t); return t;
}
function Iroom(tb, h) {
  if (h <= 0) return tb.rhoNode[0] * h;
  const hmax = TABLE_N * TABLE_DZ;
  if (h >= hmax) return tb.I[TABLE_N] + tb.rhoNode[TABLE_N] * (h - hmax);
  const i = Math.floor(h / TABLE_DZ), z0 = i * TABLE_DZ, dz = h - z0;
  if (dz < 1e-12) return tb.I[i];
  const rm = rhoOf(tb.profile(z0 + dz / 2)), r1 = rhoOf(tb.profile(h));
  return tb.I[i] + dz * (tb.rhoNode[i] + 4 * rm + r1) / 6;
}

/* ---------- root finding: Brent (Numerical Recipes zbrent) with bracket expansion ---------- */
function brent(f, a, b, fa, fb, xtol, ftol, maxit) {
  let c = b, fc = fb, d = b - a, e = d;
  for (let it = 0; it < maxit; it++) {
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * 1e-16 * Math.abs(b) + 0.5 * xtol, xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || Math.abs(fb) <= ftol) return { x: b, f: fb };
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa; let p, q;
      if (a === c) { p = 2 * xm * s; q = 1 - s; }
      else { const qq = fa / fc, r = fb / fc; p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1)); q = (qq - 1) * (r - 1) * (s - 1); }
      if (p > 0) q = -q; p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; }
      else { d = xm; e = d; }
    } else { d = xm; e = d; }
    a = b; fa = fb;
    b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1);
    fb = f(b);
  }
  return { x: b, f: fb };
}
/* f decreasing or increasing; finds a sign change around x0 by doubling the step */
function solveAround(f, x0, step, xtol, ftol, lo, hi) {
  let a = Math.max(lo, x0 - step), b = Math.min(hi, x0 + step), fa = f(a), fb = f(b);
  for (let k = 0; k < 80 && fa * fb > 0; k++) {
    step *= 2.5;
    if (Math.abs(fa) < Math.abs(fb)) { if (a <= lo) break; a = Math.max(lo, a - step); fa = f(a); }
    else { if (b >= hi) break; b = Math.min(hi, b + step); fb = f(b); }
  }
  if (fa === 0) return { x: a, f: 0 };
  if (fb === 0) return { x: b, f: 0 };
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? { x: a, f: fa, fail: true } : { x: b, f: fb, fail: true };
  return brent(f, a, b, fa, fb, xtol, ftol, 200);
}

/* secant from a warm start, falling back to a bracketed Brent once a sign change is seen */
function secantSolve(f, x0, dx, xtol, ftol, lo, hi) {
  let a = x0, fa = f(a);
  if (Math.abs(fa) <= ftol) return { x: a, f: fa };
  let b = Math.min(hi, Math.max(lo, x0 + dx)); if (b === a) b = Math.min(hi, Math.max(lo, x0 - dx));
  let fb = f(b);
  for (let k = 0; k < 12; k++) {
    if (Math.abs(fb) <= ftol) return { x: b, f: fb };
    if (fa * fb < 0) return brent(f, a, b, fa, fb, xtol, ftol, 200);
    if (fb === fa) break;
    let x = b - fb * (b - a) / (fb - fa);
    if (!isFinite(x)) break;
    x = Math.min(hi, Math.max(lo, x));
    if (Math.abs(x - b) > 50 * Math.abs(b - a) + 10 * dx) break;          // wild step: give up on the secant
    a = b; fa = fb; b = x; fb = f(b);
  }
  return solveAround(f, b, dx, xtol, ftol, lo, hi);
}

/* ---------- friction and heat transfer in a round duct ---------- */
/* Darcy friction. Laminar: Shah (1978) apparent friction for developing flow, returned as f·Re (linear law); turbulent: Haaland (1983). */
function frictionDarcy(Re, LoverD, relRough) {
  const lam = R => { const xp = Math.max(LoverD / Math.max(R, 1e-9), 1e-9), sx = Math.sqrt(xp);
    const fRe = 3.44 / sx + (1.25 / (4 * xp) + 16 - 3.44 / sx) / (1 + 0.00021 / (xp * xp)); return 4 * fRe; };  // Darcy f·Re
  const turb = R => { const t = -1.8 * Math.log10(Math.pow(relRough / 3.7, 1.11) + 6.9 / R); return 1 / (t * t); };
  if (Re < 2300) return { linear: true, fRe: lam(Re) };
  if (Re >= 4000) return { linear: false, f: turb(Re) };
  const w = (Re - 2300) / 1700, f = (1 - w) * lam(2300) / 2300 + w * turb(4000);
  return { linear: false, f };
}
/* Mean Nusselt number in a pipe, VDI Heat Atlas (2010) G1 (Gnielinski): laminar with simultaneously developing profiles at
   constant wall temperature, turbulent with the length correction, linear blend between Re 2300 and 1e4 */
function nuPipe(Re, Pr, DoverL) {
  const lam = R => { const x = R * Pr * DoverL, n2 = 1.615 * Math.cbrt(x) - 0.7, n3 = Math.pow(2 / (1 + 22 * Pr), 1 / 6) * Math.sqrt(x);
    return Math.cbrt(Math.pow(3.66, 3) + Math.pow(0.7, 3) + n2 * n2 * n2 + n3 * n3 * n3); };
  const turb = R => { const xi = Math.pow(1.8 * Math.log10(R) - 1.5, -2);
    return (xi / 8) * R * Pr / (1 + 12.7 * Math.sqrt(xi / 8) * (Math.pow(Pr, 2 / 3) - 1)) * (1 + Math.pow(DoverL, 2 / 3)); };
  if (Re <= 2300) return lam(Re);
  if (Re >= 1e4) return turb(Re);
  const g = (Re - 2300) / (1e4 - 2300); return (1 - g) * lam(2300) + g * turb(1e4);
}
/* Heat loss per metre of bare duct, W/(m·K): inside forced convection, outside natural convection (Churchill & Chu 1975, vertical surface) + radiation */
function ductUprime(mdot, Tair, Tamb, L, D, eps) {
  const m = Math.abs(mdot), A = Math.PI * D * D / 4;
  const mu = muOf(Tair), k = kOf(Tair), Pr = mu * CP / k, Re = m * D / (A * mu);
  const hi = nuPipe(Re, Pr, D / Math.max(L, D)) * k / D;
  let Tw = 0.5 * (Tair + Tamb), ho = 3, hr = 1;
  for (let it = 0; it < 4; it++) {
    const Tf = 0.5 * (Tw + Tamb), rf = rhoOf(Tf), nu = muOf(Tf) / rf, alpha = kOf(Tf) / (rf * CP), PrF = nu / alpha;
    const dT = Math.max(Math.abs(Tw - Tamb), 1e-3), Lc = Math.max(L, 0.05);
    const Ra = G * dT * Lc * Lc * Lc / ((Tf + TK) * nu * alpha);
    const nuL = Math.pow(0.825 + 0.387 * Math.pow(Ra, 1 / 6) / Math.pow(1 + Math.pow(0.492 / PrF, 9 / 16), 8 / 27), 2);
    ho = nuL * kOf(Tf) / Lc;
    const a1 = Tw + TK, a2 = Tamb + TK; hr = eps * SIGMA * (a1 * a1 + a2 * a2) * (a1 + a2);
    Tw = (hi * Tair + (ho + hr) * Tamb) / (hi + ho + hr);
  }
  return { Up: Math.PI * D / (1 / hi + 1 / (ho + hr)), hi, ho, hr, Re };
}

/* ---------- fan curve ---------- */
const CFM = 0.471947443e-3, MMH2O = 9.80665;
function fanCurve(P) {
  const s = P.fanFreeCFM / P.fanBaseCFM;                   // speed ratio by the affinity laws: Q ∝ N, p ∝ N²
  return P.fanBaseCurve.map(([c, mm]) => [c * s * CFM, mm * MMH2O * s * s]);   // [m³/s, Pa] at the rated density
}
function fanPressure(curve, Q) {                           // static pressure rise (Pa) at volume flow Q (m³/s), rated density
  const n = curve.length;
  if (Q <= curve[0][0]) { const s = (curve[1][1] - curve[0][1]) / (curve[1][0] - curve[0][0]); return curve[0][1] + s * (Q - curve[0][0]); }
  for (let i = 1; i < n; i++) if (Q <= curve[i][0]) {
    const t = (Q - curve[i - 1][0]) / (curve[i][0] - curve[i - 1][0]); return curve[i - 1][1] + t * (curve[i][1] - curve[i - 1][1]);
  }
  const s = (curve[n - 1][1] - curve[n - 2][1]) / (curve[n - 1][0] - curve[n - 2][0]); return curve[n - 1][1] + s * (Q - curve[n - 1][0]);
}

/* ---------- the network for one state ---------- */
function wallLosses(P, zIn, zOut) {           // a Ø125 sleeve through the wall with a grille on the room face
  const zp = zetaPlate(P.grilleFreeArea), zExit = Math.pow(1 + Math.sqrt(zp), 2);
  return {
    in:  [{ K: P.kEntryFlush, pos: 'outer' }, { L: zIn, pos: 'outer' }, { K: zExit, pos: 'inner' }],
    out: [{ K: zp, pos: 'inner' }, { L: zOut, pos: 'inner' }, { K: P.kExit, pos: 'outer', exit: true }]
  };
}
function buildPaths(state, P) {
  const D = P.D, A = Math.PI * D * D / 4, paths = [];
  const zp = zetaPlate(P.grilleFreeArea), zExit = Math.pow(1 + Math.sqrt(zp), 2);
  const crack = (name, role, h, gap, zeta) => ({ name, role, h, he: h, kind: 'crack', A: GEOM.doorW * gap, gap, Lc: P.doorLeafT, zeta });
  if (P.doorGapLow > 0) paths.push(crack('door gap, bottom', 'doorLow', P.doorGapLow / 2, P.doorGapLow, 1 / (P.cdSlot * P.cdSlot)));
  if (P.doorGapTop > 0) paths.push(crack('door gap, top', 'doorTop', GEOM.doorH - P.doorGapTop / 2, P.doorGapTop, P.zetaCrack));
  if (state.vent === 'none') return paths;
  const fan = state.fan === 'on';
  /* main inlet */
  if (state.inlet === 'bottom') {
    const L = wallLosses(P, P.floorThickness, P.floorThickness);
    paths.push({ name: 'inlet, floor', role: 'inlet', h: 0, he: 0, kind: 'orifice', A, D, loss: L, casing: state.heater === 'closed' });
  } else if (state.duct === 'inletduct') {
    const h = GEOM.inletH[state.inlet], hm = GEOM.inletDuctMouthH, Lr = Math.max(h - hm, 0);
    const inside = P.inletDuctReading !== 'outside';
    const loss = inside ? {
      in:  [{ K: P.kEntryFlush, pos: 'outer' }, { L: P.wallThickness, pos: 'outer' }, { K: P.kElbow, pos: 'mid' }, { L: Lr, pos: 'mid' }, { K: P.kElbow, pos: 'mid' }, { K: zExit, pos: 'inner' }],
      out: [{ K: zp, pos: 'inner' }, { K: P.kElbow, pos: 'mid' }, { L: Lr, pos: 'mid' }, { K: P.kElbow, pos: 'mid' }, { L: P.wallThickness, pos: 'outer' }, { K: P.kExit, pos: 'outer', exit: true }]
    } : {
      in:  [{ K: P.kEntryProjecting, pos: 'outer' }, { L: Lr, pos: 'mid' }, { K: P.kElbow, pos: 'mid' }, { L: P.wallThickness, pos: 'mid' }, { K: zExit, pos: 'inner' }],
      out: [{ K: zp, pos: 'inner' }, { L: P.wallThickness, pos: 'mid' }, { K: P.kElbow, pos: 'mid' }, { L: Lr, pos: 'mid' }, { K: P.kExit, pos: 'outer', exit: true }]
    };
    paths.push({ name: 'inlet, ' + state.inlet + ' via inlet duct (' + (inside ? 'inside' : 'outside') + ')', role: 'inlet', h, he: hm, kind: 'orifice', A, D, loss,
      column: { ambient: inside ? 'room' : 'out', L: Lr } });
  } else {
    const h = GEOM.inletH[state.inlet];
    paths.push({ name: 'inlet, ' + state.inlet, role: 'inlet', h, he: h, kind: 'orifice', A, D, loss: wallLosses(P, P.wallThickness, P.wallThickness) });
  }
  /* exhaust */
  const hg = GEOM.exhaustH[state.exhaust];
  if (state.duct === 'riser' || state.duct === 'half') {
    const top = GEOM.ductTop[state.duct], Lr = top - hg;
    const loss = {
      in:  [{ K: P.kEntryProjecting, pos: 'outer' }, { L: Lr, pos: 'mid' }, { K: P.kElbow, pos: 'mid' }, { L: P.wallThickness, pos: 'mid' }, { K: zExit, pos: 'inner' }],
      out: [{ K: zp, pos: 'inner' }, { L: P.wallThickness, pos: 'inner' }, { K: P.kElbow, pos: 'mid' }, { L: Lr, pos: 'mid' }, { K: P.kExit, pos: 'outer', exit: true }]
    };
    paths.push({ name: 'exhaust, ' + state.exhaust + ' grille + ' + (state.duct === 'riser' ? 'long' : 'short') + ' duct', role: 'exhaust', h: hg, he: top, kind: 'orifice', A, D, loss, fan,
      column: { ambient: 'out', L: Lr } });
  } else {
    paths.push({ name: 'exhaust, ' + state.exhaust + ' grille', role: 'exhaust', h: hg, he: hg, kind: 'orifice', A, D, loss: wallLosses(P, P.wallThickness, P.wallThickness), fan });
  }
  /* drying vent */
  if (state.dry === 'open') paths.push({ name: 'drying vent', role: 'dry', h: GEOM.dryH, he: GEOM.dryH, kind: 'orifice', A, D, loss: wallLosses(P, P.wallThickness, P.wallThickness) });
  return paths;
}

/* temperatures at the three positions of a path for each direction (frozen per pass) */
function initPathState(p, tb, warmStart) {
  const Th = tb.profile(p.h);
  p.st = { m: 0, Tin: { outer: T_OUT, mid: T_OUT, inner: T_OUT }, Tout: { outer: Th, mid: Th, inner: Th }, J: 0, fr: {}, colInfo: null };
  if (p.column) {
    /* the no-flow state: a still duct takes the temperature of what surrounds it; the alternative start is the opposite */
    const amb = p.column.ambient;
    let mode = amb;                                   // 'out' → column at T_OUT, 'room' → column at the room profile
    if (warmStart) mode = amb === 'out' ? 'roomEnd' : 'out';
    p.st.J = columnJ(p, tb, mode);
    p.st.Tout.mid = amb === 'out' ? (warmStart ? Th : T_OUT) : Th;
    p.st.Tout.outer = p.st.Tout.mid;
    p.st.Tin.mid = amb === 'room' && !warmStart ? 0.5 * (tb.profile(p.he) + Th) : T_OUT;
    p.st.Tin.inner = p.st.Tin.mid;
  }
}
/* ∫ he..h ρ dz for a still column: 'out' at T_OUT, 'room' at the room profile, 'roomEnd' at the room temperature of the room end */
function columnJ(p, tb, mode) {
  if (mode === 'out') return RHO_OUT * (p.h - p.he);
  if (mode === 'room') return Iroom(tb, p.h) - Iroom(tb, p.he);
  return rhoOf(tb.profile(p.h)) * (p.h - p.he);
}
/* temperature along a duct for a given flow: exponential integrator toward the local ambient, Simpson for ∫ρ dz */
const DUCT_STEPS = 24;
function ductMarch(p, tb, m, P) {
  const L = p.column.L, amb = p.column.ambient;
  const ambAt = z => amb === 'out' ? T_OUT : tb.profile(z);
  if (L <= 1e-9) { const T = m > 0 ? T_OUT : tb.profile(p.h); return { J: 0, Tmean: T, Tend: T, Up: 0 }; }
  const inflow = m > 0, z0 = inflow ? p.he : p.h, dir = (inflow ? p.h - p.he : p.he - p.h) / L;   // dir = dz/ds
  let T = inflow ? T_OUT : tb.profile(p.h);
  const Tamb0 = amb === 'out' ? T_OUT : 0.5 * (tb.profile(p.he) + tb.profile(p.h));
  const prevMean = inflow ? p.st.Tin.mid : p.st.Tout.mid;
  const ht = ductUprime(m, prevMean, Tamb0, L, P.D, P.epsGalv);
  const ell = Math.abs(m) * CP / (ht.Up * P.ductHeatFactor), ds = L / DUCT_STEPS;
  const Ts = new Float64Array(DUCT_STEPS + 1); Ts[0] = T;
  for (let i = 0; i < DUCT_STEPS; i++) {
    const zm = z0 + dir * (i + 0.5) * ds, Ta = ambAt(zm);
    T = Ta + (T - Ta) * (ell > 0 ? Math.exp(-ds / ell) : 0);
    Ts[i + 1] = T;
  }
  let sRho = 0, sT = 0;                                  // Simpson over the march nodes (even count)
  for (let i = 0; i <= DUCT_STEPS; i++) { const w = (i === 0 || i === DUCT_STEPS) ? 1 : (i % 2 ? 4 : 2); sRho += w * rhoOf(Ts[i]); sT += w * Ts[i]; }
  const intRho = sRho * ds / 3, Tmean = sT * ds / 3 / L;
  /* J = ∫ he..h ρ dz: the march runs he→h for inflow (dz = +ds·sign) and h→he for outflow */
  const signHeH = Math.sign(p.h - p.he);                 // +1 if the room end is above the outer end
  const J = signHeH * intRho;
  return { J, Tmean, Tend: Ts[DUCT_STEPS], Up: ht.Up, hi: ht.hi, ho: ht.ho, hr: ht.hr };
}

/* coefficients a (Pa per kg/s) and b (Pa per (kg/s)²) for each direction from the frozen state */
function pathCoeffs(p, tb, P) {
  if (p.kind === 'crack') {
    const Th = tb.profile(p.h), mk = (T) => { const r = rhoOf(T), mu = muOf(T);
      return { a: 12 * mu * p.Lc / (p.gap * p.gap * r * p.A), b: p.zeta / (2 * r * p.A * p.A) }; };
    const ci = mk(T_OUT), co = mk(Th);
    p.c = { aIn: ci.a, bIn: ci.b, aOut: co.a, bOut: co.b };
    return;
  }
  const A = p.A, D = p.D, rel = P.roughness / D;
  const dirCoeffs = (items, temps, m, fanOn) => {
    let a = 0, b = 0;
    for (const it of items) {
      const T = temps[it.pos], r = rhoOf(T);
      if (it.K !== undefined) { if (it.exit && fanOn) continue; b += it.K / (2 * r * A * A); }
      else if (it.L > 0) {
        const mu = muOf(T), Re = Math.abs(m) * D / (A * mu), fr = frictionDarcy(Re, it.L / D, rel);
        if (fr.linear) a += fr.fRe * mu * it.L / (2 * D * D * r * A);
        else b += fr.f * (it.L / D) / (2 * r * A * A);
      }
    }
    return { a, b };
  };
  const m = p.st.m;
  const ci = dirCoeffs(p.loss.in, p.st.Tin, m, false), co = dirCoeffs(p.loss.out, p.st.Tout, m, !!p.fan);
  p.c = { aIn: ci.a, bIn: ci.b, aOut: co.a, bOut: co.b };
}
function quadFlow(a, b, x) { return x <= 0 ? 0 : (a === 0 ? Math.sqrt(x / b) : 2 * x / (a + Math.sqrt(a * a + 4 * b * x))); }
function lawFlow(c, drive) { return drive >= 0 ? quadFlow(c.aIn, c.bIn, drive) : -quadFlow(c.aOut, c.bOut, -drive); }
function lawLoss(c, m) { return m >= 0 ? c.aIn * m + c.bIn * m * m : -(c.aOut * -m + c.bOut * m * m); }   // inflow-positive pressure loss

/* the fan path: inward drive Δ = loss(ṁ) − p_fan(−ṁ) with ṁ inflow-positive; the fan pushes outward */
function fanPathFlow(p, drive, ctx) {
  const rf = rhoOf(p.st.Tout.inner), scale = rf / ctx.P.fanRatedRho, curve = ctx.fan;
  const g = m => lawLoss(p.c, m) + fanPressure(curve, -m / rf) * scale - drive;   // increasing in m
  const r = solveAround(g, p.st.mGuess !== undefined ? p.st.mGuess : -0.02, 0.002, 1e-15, 1e-13, -5, 5);
  p.st.mGuess = r.x; return r.x;
}

/* ---------- the closed casing heater over the floor inlet: a node at the casing foot ---------- */
function casingSetup(p, tb, P) {
  const W = GEOM.casingW, Ap = W * W, slotA = 4 * W * P.casingBaseGap;
  const zs = 1 / (P.cdSlot * P.cdSlot), rs = rhoOf(tb.profile(0));
  p.cas = { Ap, slot: { aIn: 0, bIn: zs / (2 * rs * slotA * slotA), aOut: 0, bOut: zs / (2 * rs * slotA * slotA) }, Hc: GEOM.casingH,
    IHc: Iroom(tb, GEOM.casingH), Tr0: tb.profile(0), pbGuess: 0, mcGuess: 0.02 };
}
/* casing up-flow for a given foot pressure: loss through the stone heap = draught of the heated column */
function casingFlow(p, pb, pRef, Tmix, Q, P) {
  const cs = p.cas, Hc = cs.Hc, T1 = Tmix + TK, d = P.stoneD, ev = P.stoneVoid, Ls = P.casingStoneDepth;
  const F = m => {
    const T2 = Math.min(T1 + Q / (m * CP), 973.15), dT = T2 - T1;
    const J = dT > 1e-9 ? (P_ATM / R_AIR) * Hc * Math.log(T2 / T1) / dT : (P_ATM / R_AIR) * Hc / T1;
    const Tc = T2 - TK, r = rhoOf(Tc), mu = muOf(Tc), Vs = m / (r * cs.Ap);
    const ergun = Ls * (150 * mu * (1 - ev) * (1 - ev) * Vs / (ev * ev * ev * d * d) + 1.75 * r * (1 - ev) * Vs * Vs / (ev * ev * ev * d));
    const exitL = 0.5 * r * (Vs / ev) * (Vs / ev);       // the jets leaving the voids lose their velocity head
    return ergun + exitL - (pb - pRef + G * (cs.IHc - J));
  };
  if (F(1e-7) >= 0) return 1e-7;
  const r = secantSolve(F, Math.max(cs.mcGuess, 2e-6), 0.01 * Math.max(cs.mcGuess, 2e-6), 1e-14, 1e-13, 1e-7, 3);
  cs.mcGuess = r.x; return r.x;
}
function floorCasingFlow(p, pRef, ctx) {
  const cs = p.cas, Q = ctx.Qc;
  let last = null;
  const R = pb => {
    const mf = lawFlow(p.c, -pb), ms = lawFlow(cs.slot, pRef - pb);
    const inF = Math.max(mf, 0), inS = Math.max(ms, 0);
    const Tmix = (inF + inS) > 0 ? (inF * T_OUT + inS * cs.Tr0) / (inF + inS) : cs.Tr0;
    const mc = casingFlow(p, pb, pRef, Tmix, Q, ctx.P);
    last = { mf, ms, mc, Tmix };
    return mf + ms - mc;
  };
  const r = secantSolve(R, cs.pbGuess, 0.002, 1e-13, 1e-14, -200, 200);
  cs.pbGuess = r.x; R(r.x);
  cs.last = Object.assign({ pb: r.x }, last);
  return last.mf;
}

/* ---------- the mean heater power stand-in (agent D owns the energy balance) ---------- */
function heaterMeanPower(tb, paths, P) {
  const H = GEOM.ceiling, W = 2.63, Dp = 2.24;
  const meanT = (h0, h1) => { const n = 20, dz = (h1 - h0) / n; let s = 0; for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : (i % 2 ? 4 : 2)) * tb.profile(h0 + i * dz); return s * dz / 3 / (h1 - h0); };
  const Uw = 1 / (0.13 + P.panelT / P.lambdaPine + P.wallInsulation / P.lambdaInsulation + 0.04);     // ISO 6946 surface resistances
  const Ud = 1 / (0.13 + P.doorLeafT / 1.0 + 0.04);
  const Afl = W * Dp, Bp = Afl / (0.5 * 2 * (W + Dp)), dt = 0.2 + P.lambdaGround * (0.17 + 0.04);
  const Uf = 2 * P.lambdaGround / (Math.PI * Bp + dt) * Math.log(Math.PI * Bp / dt + 1);          // ISO 13370, uninsulated slab
  const Adoor = GEOM.doorW * GEOM.doorH, Awall = 2 * (W + Dp) * H - Adoor;
  let Q = Uw * Awall * (meanT(0, H) - T_OUT) + Uw * Afl * (tb.profile(H) - T_OUT) + Ud * Adoor * (meanT(0, GEOM.doorH) - T_OUT) + Uf * Afl * (tb.profile(0) - T_OUT);
  for (const p of paths) if (p.st.m < 0) Q += -p.st.m * CP * (tb.profile(p.h) - T_OUT);
  return Q;
}

/* ---------- one solve ---------- */
/* Inner loop: with the duct column held at a given mean density, iterate the weak couplings (friction factors, the
   densities at each loss, the casing heat) to a fixed point and return Φ, the column density the resulting flow produces.
   Outer loop: the column is the only strong coupling and there is at most one ducted path per state, so the steady
   state is a root of H(ρ̄) = Φ(ρ̄) − ρ̄, searched from a start column in the direction H points (the way a real duct's
   temperature would drift), which picks the first stable steady state reached from that start. */
function solveNetwork(state, profile, P, warmStart) {
  const tb = roomTable(profile);
  const paths = buildPaths(state, P);
  const ctx = { P, fan: fanCurve(P), Qc: 0 };
  for (const p of paths) { if (p.kind !== 'crack') initPathState(p, tb, warmStart); else p.st = { m: 0 }; if (p.casing) casingSetup(p, tb, P); }
  const hasCasing = paths.some(p => p.casing);
  const col = paths.find(p => p.column);
  const constTerm = p => G * (Iroom(tb, p.h) - RHO_OUT * p.he - (p.st.J || 0));
  let pRef = 0, innerPasses = 0, innerUnconverged = 0;
  const residual = pr => {
    let s = 0;
    for (const p of paths) {
      const drive = p.cst - pr;
      let m;
      if (p.casing) m = floorCasingFlow(p, pr, ctx);
      else if (p.fan) m = fanPathFlow(p, drive, ctx);
      else m = lawFlow(p.c, drive);
      p.mTrial = m; s += m;
    }
    return s;
  };
  let lastRes = 0;
  const inner = (tol) => {
    let ok = false;
    for (let pass = 1; pass <= P.maxPasses; pass++) {
      innerPasses++;
      for (const p of paths) { pathCoeffs(p, tb, P); p.cst = constTerm(p); }
      if (hasCasing) ctx.Qc = P.heaterConvFraction * heaterMeanPower(tb, paths, P);
      const r = secantSolve(residual, pRef, 1e-3, 1e-13, 1e-14, -1000, 1000);
      pRef = r.x; lastRes = residual(pRef);
      let maxDelta = 0;
      for (const p of paths) {
        const m = p.mTrial; maxDelta = Math.max(maxDelta, Math.abs(m - p.st.m)); p.st.m = m;
        if (p.kind === 'crack') continue;
        const Th = tb.profile(p.h);
        p.st.Tout.inner = Th;
        if (p.column) {
          const res = ductMarch(p, tb, m, P); p.st.colInfo = res;
          if (m > 0) { p.st.Tin.mid = res.Tmean; p.st.Tin.inner = res.Tend; }
          else { p.st.Tout.mid = res.Tmean; p.st.Tout.outer = res.Tend; }
        } else { p.st.Tout.mid = Th; p.st.Tout.outer = Th; }
      }
      if (hasCasing) { if (ctx.QcPrev !== undefined) maxDelta = Math.max(maxDelta, Math.abs(ctx.Qc - ctx.QcPrev) * 1e-9); ctx.QcPrev = ctx.Qc; }
      if (pass > 1 && maxDelta < tol) { ok = true; break; }
    }
    if (!ok) innerUnconverged++;
    return ok;
  };
  let converged = true, columnRoot = null;
  if (!col) converged = inner(1e-13);
  else {
    const span = col.h - col.he;
    if (Math.abs(span) < 1e-9) { col.st.J = 0; converged = inner(1e-13); }
    else {
      const Phi = rb => { col.st.J = rb * span; const ok = inner(1e-11); converged = converged && ok; return col.st.colInfo.J / span; };
      const H = rb => Phi(rb) - rb;
      /* bounds of the mean column density: between the hottest and the coldest air anywhere in the system */
      let Tmin = T_OUT, Tmax = T_OUT;
      for (let z = 0; z <= 2.3; z += 0.05) { const T = profile(z); Tmin = Math.min(Tmin, T); Tmax = Math.max(Tmax, T); }
      const rLo = rhoOf(Tmax + 1), rHi = rhoOf(Tmin - 1);
      let r0 = col.st.J / span, h0 = H(r0);
      if (Math.abs(h0) < 1e-13) columnRoot = r0;
      else {
        /* march in the direction H points: Newton steps on a secant slope, capped at 1/20 of the range so a pair of roots is not jumped */
        const dir = h0 > 0 ? 1 : -1, maxStep = (rHi - rLo) / 20;
        let ra = r0, ha = h0, rb = r0, hb = h0, found = false, slope = -1;
        for (let k = 0; k < 100; k++) {
          let step = slope < 0 ? -ha / slope : maxStep;
          step = dir * Math.min(Math.abs(step) * 1.05 + 1e-7, maxStep);
          rb = Math.min(rHi, Math.max(rLo, ra + step));
          hb = H(rb);
          if (hb * ha <= 0) { found = true; break; }
          if (rb === rHi || rb === rLo) break;
          slope = (hb - ha) / (rb - ra);
          ra = rb; ha = hb;
        }
        if (found) { const r = brent(H, ra, rb, ha, hb, 1e-12, 1e-12, 100); columnRoot = r.x; }
        else columnRoot = rb;
      }
      if (columnRoot !== null) {
        col.st.J = columnRoot * span; converged = inner(1e-13) && converged;
      }
    }
  }
  /* final consistent evaluation with the frozen state */
  for (const p of paths) { pathCoeffs(p, tb, P); p.cst = constTerm(p); }
  if (hasCasing) ctx.Qc = P.heaterConvFraction * heaterMeanPower(tb, paths, P);
  const r = secantSolve(residual, pRef, 1e-3, 1e-13, 1e-14, -1000, 1000);
  pRef = r.x;
  const res = residual(pRef);
  for (const p of paths) p.st.m = p.mTrial;
  const colGap = col && col.st.colInfo ? Math.abs(col.st.colInfo.J - col.st.J) * G : 0;   // Pa: column fixed-point mismatch
  return { paths, pRef, residual: res, converged: converged && innerUnconverged === 0 && colGap < 1e-9, passes: innerPasses, lastMaxDelta: colGap, tb, ctx };
}

/* temperature of the air passing an opening: arriving air for inflow, room air at the opening for outflow */
function passTemp(p, tb) { return p.st.m > 0 ? (p.kind === 'crack' ? T_OUT : p.st.Tin.inner) : tb.profile(p.h); }

/* ---------- public: airflow(state, profile) ---------- */
function airflow(state, profile, opts) {
  const P = opts ? Object.assign({}, PARAMS, opts) : PARAMS;
  profile = profile || defaultProfile;
  const sol = solveNetwork(state, profile, P, false);
  const notes = [];
  const tb = sol.tb;
  let bistable = false, alt = null;
  if (sol.paths.some(p => p.column)) {
    const sol2 = solveNetwork(state, profile, P, true);
    const d = Math.max(...sol.paths.map((p, i) => Math.abs(p.st.m - sol2.paths[i].st.m)));
    if (d > 1e-6) {
      bistable = true;
      alt = {};
      let mi = 0;
      for (const p of sol2.paths) { alt[p.role] = p.st.m / rhoOf(passTemp(p, tb)); if (p.st.m > 0) mi += p.st.m; }
      alt.qOutdoorIn = mi / RHO_OUT;
      notes.push('bistable: a second steady state exists from the opposite duct start (' + sol2.paths.map(p => p.role + ' ' + (alt[p.role] * 1000).toFixed(2) + ' l/s').join(', ') + '); reported state is the one reached from still ducts');
    }
  }
  const openings = [];
  let mIn = 0, mOut = 0, qOutVol = 0;
  const byRole = {};
  for (const p of sol.paths) {
    const m = p.st.m;
    const Tpass = passTemp(p, tb);
    const q = m / rhoOf(Tpass);
    const o = { name: p.name, role: p.role, h: p.h, q, mdot: m, T: Tpass };
    if (p.column && p.st.colInfo) { const ci = p.st.colInfo; o.ductMeanT = ci.Tmean; o.ductEndT = ci.Tend; o.ductHeat = { hi: ci.hi, ho: ci.ho, hr: ci.hr, Uprime: ci.Up }; }
    if (p.fan) { const rf = rhoOf(p.st.Tout.inner); o.fanQ = -m / rf; o.fanDp = fanPressure(sol.ctx.fan, -m / rf) * rf / P.fanRatedRho; }
    if (p.casing && p.cas.last) { o.casing = Object.assign({ Qc: sol.ctx.Qc }, p.cas.last); }
    openings.push(o); byRole[p.role] = o;
    if (m > 0) mIn += m; else { mOut += -m; qOutVol += -q; }
  }
  /* neutral plane: height where a plain hole would carry no flow */
  const drivePlain = h => G * (Iroom(tb, h) - RHO_OUT * h) - sol.pRef;
  let lo = -50, hi = 50;
  for (let k = 0; k < 200; k++) { const mid = 0.5 * (lo + hi); if (drivePlain(mid) > 0) lo = mid; else hi = mid; }
  const npH = 0.5 * (lo + hi);
  const none = state.vent === 'none';
  const mainInletQ = none ? 0 : byRole.inlet.q, mainExhaustQ = none ? 0 : byRole.exhaust.q;
  const reversed = !none && (mainInletQ < -1e-7 || mainExhaustQ > 1e-7);
  if (!none && state.duct === 'inletduct') notes.push('inlet duct read as ' + (P.inletDuctReading === 'outside' ? 'outside the room (column at 25 °C)' : 'inside the room along the heater wall, wall penetration at floor level (IDUCT comment)'));
  if (!none && state.inlet === 'bottom' && state.heater === 'closed') notes.push('floor inlet discharges into the closed casing foot; casing chimney solved as a node (stand-ins: square plan, ' + (P.casingBaseGap * 1000) + ' mm foot slot, ' + (P.heaterConvFraction * 100) + ' % convective mean power)');
  if (!sol.converged) notes.push('fixed point not fully converged after ' + sol.passes + ' passes (last change ' + sol.lastMaxDelta.toExponential(2) + ')');
  if (Math.abs(sol.residual) > 1e-9) notes.push('mass residual ' + sol.residual.toExponential(2) + ' kg/s');
  return {
    openings,
    qOutdoorIn: mIn / RHO_OUT,                 // m³/s of outdoor air (at 25 °C) entering
    qOutdoorOut: qOutVol,                      // m³/s leaving, at the density where it leaves
    mainInletQ, mainExhaustQ,
    dryQ: byRole.dry ? byRole.dry.q : 0,
    doorLowQ: byRole.doorLow ? byRole.doorLow.q : 0, doorTopQ: byRole.doorTop ? byRole.doorTop.q : 0,
    neutralPlaneH: npH,
    reversed,
    notes,
    /* extras */
    pRef: sol.pRef, massIn: mIn, massOut: mOut, residual: sol.residual, converged: sol.converged, passes: sol.passes,
    ach: mIn / RHO_OUT * 3600 / GEOM.volume, bistable, alt
  };
}

/* ---------- valid states (brief) ---------- */
function allStates() {
  const out = [];
  for (const inlet of ['above', 'middle', 'below', 'bottom'])
    for (const exhaust of ['lower', 'upper'])
      for (const fan of ['on', 'off'])
        for (const duct of ['straight', 'riser', 'half', 'inletduct']) {
          if (inlet === 'bottom' && duct === 'inletduct') continue;
          for (const heater of ['open', 'closed', 'wall'])
            for (const angle of (inlet === 'bottom' ? ['straight'] : ['straight', 'up45']))
              for (const dry of ['closed', 'open']) out.push({ vent: 'yes', inlet, exhaust, fan, duct, heater, angle, dry });
        }
  for (const heater of ['open', 'closed', 'wall']) out.push({ vent: 'none', heater });
  return out;
}

module.exports = { airflow, defaultProfile, allStates, PARAMS, GEOM, fanCurve, zetaPlate, RHO_OUT };

/* ---------- CLI: CSV + checks ---------- */
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const states = allStates();
  const t0 = process.hrtime.bigint();
  const results = states.map(s => airflow(s));
  const t1 = process.hrtime.bigint();
  const ls = x => (x * 1000).toFixed(3);
  const head = ['vent', 'inlet', 'exhaust', 'fan', 'duct', 'heater', 'angle', 'dry',
    'q_inlet_ls', 'q_exhaust_ls', 'q_dry_ls', 'q_doorLow_ls', 'q_doorTop_ls', 'qOutdoorIn_ls', 'qOutdoorOut_ls', 'ach',
    'neutralPlaneH_m', 'reversed', 'pRef_Pa', 'fanQ_ls', 'fanDp_Pa', 'ductEndT_C', 'inletPassT_C', 'bistable', 'alt_q_inlet_ls', 'alt_q_exhaust_ls', 'alt_qOutdoorIn_ls', 'residual_kgs', 'converged'];
  const rows = [head.join(',')];
  states.forEach((s, i) => {
    const r = results[i], ex = r.openings.find(o => o.role === 'exhaust'), inl = r.openings.find(o => o.role === 'inlet');
    rows.push([s.vent, s.inlet || '', s.exhaust || '', s.fan || '', s.duct || '', s.heater, s.angle || '', s.dry || '',
      ls(r.mainInletQ), ls(r.mainExhaustQ), ls(r.dryQ), ls(r.doorLowQ), ls(r.doorTopQ), ls(r.qOutdoorIn), ls(r.qOutdoorOut), r.ach.toFixed(3),
      r.neutralPlaneH.toFixed(3), r.reversed ? 1 : 0, r.pRef.toFixed(4),
      ex && ex.fanQ !== undefined ? ls(ex.fanQ) : '', ex && ex.fanDp !== undefined ? ex.fanDp.toFixed(3) : '',
      ex && ex.ductEndT !== undefined ? ex.ductEndT.toFixed(2) : '', inl ? inl.T.toFixed(2) : '',
      r.bistable ? 1 : 0, r.alt ? ls(r.alt.inlet) : '', r.alt ? ls(r.alt.exhaust) : '', r.alt ? ls(r.alt.qOutdoorIn) : '',
      r.residual.toExponential(2), r.converged ? 1 : 0].join(','));
  });
  fs.writeFileSync(path.join(__dirname, 'airflow.csv'), rows.join('\n') + '\n');
  console.log('states', states.length, 'mean ms/state', (Number(t1 - t0) / 1e6 / states.length).toFixed(3));
  console.log('max |residual| kg/s', Math.max(...results.map(r => Math.abs(r.residual))).toExponential(2), 'unconverged', results.filter(r => !r.converged).length, 'bistable', results.filter(r => r.bistable).length);
}
