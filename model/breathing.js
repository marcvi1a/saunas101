'use strict';
/* Agent C: where the fresh air goes.
   breathing(state, flows[, profile[, opts]]) → { fractionToBreathingZone, qFreshAtBreathingZone, co2AtMouth, notes, ...extras }

   Three nodes. P = the heater plume, a conduit with no volume that carries what it draws in up to the ceiling.
   U = the upper zone, mixed by the plume's recirculation (≈ 120–140 l/s against ≈ 20 l/s of ventilation), which
   holds both mouths. L = a cold floor layer that exists only while outdoor air lands on the floor and stays colder
   than the air above it.
   1. Heat balance at steady state (envelope, ventilation, 2 bathers) → heater power → convective share → the heater's
      own through-flow (casing chimney or stone bed, Ergun) → an MTT plume above it with a flux-matched virtual origin.
   2. Every inflow is followed: a round buoyant jet (top-hat integral model, Priestley–Ball entrainment) until it meets
      the plume (Pratte–Baines penetration decides capture), the heater body (bed or casing), the floor, a wall, or
      dissolves into the room's circulation; or a floor current (wall jet → gravity current, Parker et al. 1987 entrainment)
      that runs to the far wall and up it. What is left of a jet goes to its neutral level: U or L.
   3. Where a current runs up a wall that holds an outlet, the outlet takes its draw from the arriving current first.
   4. The floor layer is as deep as the larger of the currents' run-up and the depth at which the heater intake and the
      outlets near it (selective withdrawal, Lubin & Springer) drain what lands on the floor.
   5. The floor heats the layer (floor-surface heat balance); the layer dissolves into U when that heat brings it to the
      temperature of the air above. Floor currents shear the layer top and exchange air both ways (same law).
   6. Fresh air in L reaches U through the heater intake, the layer-top exchange or overflow; the outlets in L take
      the rest. fractionToBreathingZone = outdoor air that reaches U before leaving / outdoor air entering.
   7. CO₂: a two-zone transient mass balance (U, L, the plume as a mixing conduit), both bathers exhaling into the zone
      holding their mouths, read at 30 min from outdoor air (CONST.sessionS = Infinity: the exact steady state).
   opts.floorEscape = true switches to the thermal limit (floor heat lifts parcels out of the layer), sensitivity only.
   Every constant is listed with its source and confidence in docs/breathing.md. Run `node breathing.js` for the CSV and
   the checks. Pure Node, deterministic, no dependencies (airflow.js is used only by the runner when present). */

/* ---------- physical constants ---------- */
const TK = 273.15;
const G = 9.80665;                       // m/s²
const RU = 8.314462618;                  // J/(mol·K)
const MAIR = 0.0289647;                  // kg/mol, dry air
const PATM = 101300;                     // Pa, brief
const CP = 1007;                         // J/(kg·K), air at 300 K (Incropera & DeWitt, Table A.4)
const SIGMA = 5.670374419e-8;            // W/(m²·K⁴)
const T_OUT = 25;                        // °C, brief
const rhoOf = Tc => PATM * MAIR / (RU * (Tc + TK));
const RHO_OUT = rhoOf(T_OUT);
const muOf = Tc => { const T = Tc + TK; return 1.716e-5 * Math.pow(T / 273.15, 1.5) * (273.15 + 110.4) / (T + 110.4); }; // Sutherland

/* ---------- empirical constants (sources in C_report.md) ---------- */
const K = {
  alphaJ: 0.0535 * Math.SQRT2,           // jet entrainment, top-hat (Fischer et al. 1979: Gaussian 0.0535 ± 0.0025)
  alphaP: 0.0833 * Math.SQRT2,           // plume entrainment, top-hat (Fischer et al. 1979: Gaussian 0.0833 ± 0.0042)
  pbA: 2.05, pbB: 0.28,                  // jet in crossflow, Pratte & Baines (1967): y/(r d) = 2.05 (s/(r d))^0.28
  wallJetLat: 0.26,                      // lateral half-width growth of a 3D wall jet (Launder & Rodi 1983; Abrahamsson et al. 1997)
  pkA: 0.075, pkB: 718, pkN: 2.4,       // E = 0.075/(1 + 718 Ri^2.4)^½ (Parker, Garcia, Fukushima & Yu 1987, a continuous fit through Ellison & Turner's data)
  ceilJet: 0.1,                          // ceiling-jet thickness ≈ 0.1 × source-to-ceiling height (Alpert, SFPE Handbook ch. 14)
  cd: 0.61,                              // sharp-edged orifice / slot discharge coefficient
  grilleFree: 0.5,                       // grille free-area ratio when the flows object does not give one (agent A's value)
  ergun1: 150, ergun2: 1.75,             // Ergun (1952)
  stoneD: 0.075, stoneVoid: 0.40,        // stones Ø5–10 cm (Harvia Vega Pro data); voidage of a random stone bed ≈ 0.4
  rockRho: 3000,                         // kg/m³, olivine diabase / peridotite sauna stones
  closedStoneKgPerM2: 50 / (0.435 * 0.47), // Harvia Vega Pro BC135: 50 kg stones on a 435 × 470 mm casing
  kIn: 0.5, kOut: 1.0,                   // casing entry and exit losses (Idelchik; ASHRAE fittings 1-1, 2-1)
  radFracCasing: 0.10,                   // radiant fraction of a natural convector (CIBSE Guide A via IES VE Apache Table 13)
  epsStone: 0.90,                        // emissivity of rough rock
  /* envelope (heat balance) */
  insul: 0.075, lamInsul: 0.037, panel: 0.015, lamPine: 0.13, // Harvia: 50–100 mm wool, midpoint; EN ISO 10456 λ
  slab: 0.15, lamConcrete: 2.3, glass: 0.008, lamGlass: 1.0,
  rsiH: 0.13, rsiUp: 0.10, rsiDown: 0.17,  // EN ISO 6946 surface resistances (both faces indoor)
  epsFloor: 0.90,                         // tiled or concrete floor
  hcUp: 1.52,                             // h = 1.52·ΔT^(1/3), heated horizontal plate facing up, turbulent (ASHRAE Fundamentals ch. 4, simplified air correlations)
  /* bathers */
  nBathers: 2, met: 1.2, adu: 1.8, rq: 0.83, // ASHRAE Fundamentals ch. 9; ASHRAE 62.1 App. C uses 1.2 met for sedentary adults
  tSkin: 38.5,                            // °C, skin in the sauna (Martin 1765 via Finnish Sauna Society: 38–39 °C)
  epsSkin: 0.95, arOverAd: 0.70,          // ASHRAE Fundamentals ch. 9, seated
  co2Out: 425.62,                         // ppm, NOAA GML global annual mean 2025
  sessionS: 1800                          // s, brief: read at 30 min; Infinity = exact steady state
};

/* ---------- geometry (drawing: h = (300 − y)·2.1/300, x = (X − 22)·2.1/300) ---------- */
const S = 2.1 / 300;
const GEO = {
  L: (398 - 22) * S,                     // 2.632 m heater wall → exhaust wall
  W: 2.24,                               // m, depth
  H: (300 - 8) * S,                      // 2.044 m
  D: 0.125,                              // Ø of inlet, grilles, drying vent
  inletH: { above: 0.98, middle: 0.45, below: 0.12, bottom: 0 },
  grilleH: { lower: 0.25, upper: 0.69 },
  dryH: 1.94,
  door: { w: 0.70, low0: 0, low1: 0.010, top0: 1.900, top1: 1.902, x: 0.875 },  // door in a side wall (assumption, see report)
  mouthUpper: 1.62, mouthLower: 1.20,
  heater: {
    open:   { x0: (53 - 22) * S, x1: (93 - 22) * S, w: 0.28, body0: (300 - 298) * S, z0: 0.06, z1: 0.76, intake: 'bed' },
    closed: { x0: (52 - 22) * S, x1: (94 - 22) * S, w: 0.29, body0: (300 - 298) * S, z0: (300 - 298) * S, z1: 0.67, intake: 'base', i0: 0, i1: (300 - 298) * S },
    wall:   { x0: (52 - 22) * S, x1: (94 - 22) * S, w: 0.29, body0: 0.29, z0: 0.29, z1: 0.68, intake: 'base', i0: 0.29, i1: 0.30 }
  }
};
GEO.A = GEO.L * GEO.W;
for (const k in GEO.heater) GEO.heater[k].xc = 0.5 * (GEO.heater[k].x0 + GEO.heater[k].x1);

/* ---------- the shared stand-in profile (same as agents A and B until agent D's replaces it) ---------- */
function defaultProfile(h) { const x = Math.min(Math.max(h, 0), GEO.H); return 40 + 50 * x / GEO.H; }

const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
const entrainE = Ri => K.pkA / Math.sqrt(1 + K.pkB * Math.pow(Math.max(Ri, 0), K.pkN));   // bulk-Richardson entrainment, continuous
const overlap = (a, b, top) => b <= a ? (top >= a ? 1 : 0) : clamp01((top - a) / (b - a));   // share of span [a,b] below `top`
function meanT(T, a, b) { let s = 0; const n = 8; for (let i = 0; i < n; i++) s += T(a + (b - a) * (i + 0.5) / n); return s / n; }
function invT(T, Tc) {                    // height where the room is at Tc (profile assumed to rise with height)
  if (Tc <= T(0)) return 0; if (Tc >= T(GEO.H)) return GEO.H;
  let lo = 0, hi = GEO.H; for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (T(m) < Tc) lo = m; else hi = m; } return 0.5 * (lo + hi);
}
function zoneMass(T, a, b) { if (b <= a) return 0; let s = 0; const n = 8; for (let i = 0; i < n; i++) s += rhoOf(T(a + (b - a) * (i + 0.5) / n)); return s / n * GEO.A * (b - a); }

/* ---------- CO₂ generation ---------- */
/* oxycaloric equivalent 21·(0.23·RQ + 0.77) kJ per litre of O₂ (ASHRAE Fundamentals ch. 9); M in met (58.15 W/m²) */
function co2GenPerBather() {
  const qO2 = K.met * 58.15 * K.adu / (21 * (0.23 * K.rq + 0.77));     // mL/s at STP
  const qCO2 = K.rq * qO2 * 1e-6;                                       // m³/s at STP
  return qCO2 * 101325 / (RU * TK);                                     // mol/s
}

/* ---------- the heat balance at steady state ---------- */
function heatBalance(ops, T) {
  const H = GEO.H, perim = 2 * (GEO.L + GEO.W);
  const aDoor = GEO.door.w * 1.9, aWall = perim * H - aDoor;
  const uWall = 1 / (K.rsiH + K.panel / K.lamPine + K.insul / K.lamInsul + K.rsiH);
  const uCeil = 1 / (K.rsiUp + K.panel / K.lamPine + K.insul / K.lamInsul + K.rsiUp);
  const uFloor = 1 / (K.rsiDown + K.slab / K.lamConcrete + K.rsiDown);
  const uGlass = 1 / (K.rsiH + K.glass / K.lamGlass + K.rsiH);
  const env = uWall * aWall * (meanT(T, 0, H) - T_OUT) + uCeil * GEO.A * (T(H) - T_OUT)
            + uFloor * GEO.A * (T(0) - T_OUT) + uGlass * aDoor * (meanT(T, 0, 1.9) - T_OUT);
  let vent = 0;
  for (const o of ops) if (o.m < 0) vent += -o.m * CP * (T(o.hc) - T_OUT);
  const bather = (a, b) => {                                    // sensible gain of one seated bather (ISO 7730 h_c, linearised h_r)
    const Ta = meanT(T, a, b), dT = Ta - K.tSkin;
    const hc = 2.38 * Math.pow(Math.abs(dT), 0.25);
    const hr = 4 * K.epsSkin * SIGMA * K.arOverAd * Math.pow((K.tSkin + Ta) / 2 + TK, 3);
    return K.adu * (hc + hr) * dT;
  };
  const bath = bather(0.88, 1.80) + (K.nBathers > 1 ? bather(0.45, 1.30) * (K.nBathers - 1) : 0);
  const total = env + vent + bath;
  return { env, vent, bath, total, capped: total > 12000, P: Math.min(total, 12000) };
}

/* ---------- heat reaching the floor layer: the floor surface's own balance ---------- */
function viewParallel(a, b, c) {             // aligned parallel rectangles a × b, c apart (Incropera & DeWitt, Table 13.2)
  const X = a / c, Y = b / c, X2 = X * X, Y2 = Y * Y;
  return 2 / (Math.PI * X * Y) * (Math.log(Math.sqrt((1 + X2) * (1 + Y2) / (1 + X2 + Y2))) + X * Math.sqrt(1 + Y2) * Math.atan(X / Math.sqrt(1 + Y2))
    + Y * Math.sqrt(1 + X2) * Math.atan(Y / Math.sqrt(1 + X2)) - X * Math.atan(X) - Y * Math.atan(Y));
}
function heaterToFloor(type) {               // share of the heater's side radiation that lands on the floor: ½(1 − z/√(z² + D²)) per face
  const hp = GEO.heater[type], z = 0.5 * (hp.z0 + hp.z1) - (type === 'wall' ? 0 : 0);
  const f = D => 0.5 * (1 - z / Math.sqrt(z * z + D * D));
  const faces = type === 'wall' ? [GEO.L - hp.xc, GEO.W / 2, GEO.W / 2] : [GEO.L - hp.xc, GEO.W / 2, GEO.W / 2, hp.x0];
  const side = 4 * hp.w * (hp.z1 - hp.z0), top = hp.w * hp.w;
  const fSide = faces.reduce((a, D) => a + f(D), 0) / 4;     // per side area (a face on the wall radiates nothing)
  return fSide * side / (side + top);
}
function floorHeat(T, TL, qRadHeater, type) {   // W into the floor layer by convection from the floor surface
  const Fc = viewParallel(GEO.L, GEO.W, GEO.H);
  const Tmrt = Fc * T(GEO.H) + (1 - Fc) * meanT(T, 0, GEO.H);
  const qh = qRadHeater * heaterToFloor(type) / GEO.A;
  const uDown = 1 / (K.slab / K.lamConcrete + K.rsiDown);
  const bal = Tf => {
    const hr = 4 * K.epsFloor * SIGMA * Math.pow((Tmrt + Tf) / 2 + TK, 3);
    const dT = Tf - TL, hc = dT > 0 ? K.hcUp * Math.cbrt(dT) : 0;
    return hr * (Tmrt - Tf) + qh - uDown * (Tf - T_OUT) - hc * dT;
  };
  let lo = T_OUT, hi = Math.max(Tmrt, TL) + 100;
  for (let i = 0; i < 50; i++) { const m = 0.5 * (lo + hi); if (bal(m) > 0) lo = m; else hi = m; }
  const Tf = 0.5 * (lo + hi), dT = Tf - TL;
  return { Tf, Q: dT > 0 ? K.hcUp * Math.cbrt(dT) * dT * GEO.A : 0, Tmrt };
}

/* ---------- the heater: chimney or stone-bed flow, then the plume ---------- */
function ergunLoss(v, L, rho, mu) {
  const e = K.stoneVoid, d = K.stoneD;
  return L * (K.ergun1 * mu * (1 - e) * (1 - e) * v / (e * e * e * d * d) + K.ergun2 * rho * (1 - e) * v * v / (e * e * e * d));
}
/* volume flow (m³/s at the intake density) through the heater for convective power Qc; boost = extra driving pressure (Pa) */
function heaterFlow(type, Qc, Ta, boost) {
  const hp = GEO.heater[type], A = hp.w * hp.w, rhoA = rhoOf(Ta);
  const bedClosed = K.closedStoneKgPerM2 / (K.rockRho * (1 - K.stoneVoid));
  const f = V => {
    const dT = Qc / (rhoA * CP * V), Tm = Ta + dT / 2, Th = Ta + dT;
    const rm = rhoOf(Tm), rh = rhoOf(Th), mu = muOf(Tm);
    const vs = V * rhoA / rm / A, vh = V * rhoA / rh / A;
    if (type === 'open') {
      const Hb = hp.z1 - hp.z0;            // uniform side intake: the parcel entering lowest sees ∫ v² over the bed = v_top² H/3
      const e = K.stoneVoid, d = K.stoneD;
      const loss = K.ergun1 * mu * (1 - e) * (1 - e) * vs / (e * e * e * d * d) * Hb / 2
                 + K.ergun2 * rm * (1 - e) * vs * vs / (e * e * e * d) * Hb / 3 + K.kOut * rh * vh * vh / 2;
      return G * Hb * (rhoA - rm) + boost - loss;
    }
    const Hc = hp.z1 - hp.i1;
    const loss = ergunLoss(vs, bedClosed, rm, mu) + K.kIn * rhoA * Math.pow(V / A, 2) / 2 + K.kOut * rh * vh * vh / 2;
    return G * Hc * (rhoA - rm) + boost - loss;
  };
  let lo = 1e-5, hi = 0.5;
  if (f(hi) > 0) return hi;
  for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (f(m) > 0) lo = m; else hi = m; }
  return Math.sqrt(lo * hi);
}
/* the open heater's stone bed: room air drawn in through the stones (heaterFlow) and heated on its way up. The outer stones follow
   the bed air, the local room air at the bottom and the outlet air at the top (thermal images of open mesh heaters: a cool bottom,
   200-300 °C at the top; Saunologia's Harvia Spirit and HUUM Drop tests), so the sides radiate band by band and the top at the
   outlet temperature. Trad: the surroundings' radiant temperature. One function for breathing.js and feet.js. */
const BED_BANDS = 7;
function bedSplit(P, Ta, Trad, Aside, Atop, Qc0) {
  const rA = rhoOf(Ta), Tr4 = Math.pow(Trad + TK, 4), aB = Aside / BED_BANDS;
  const rad = dt => { let q = Atop * Math.max(0, Math.pow(Ta + dt + TK, 4) - Tr4); for (let j = 0; j < BED_BANDS; j++) q += aB * Math.max(0, Math.pow(Ta + dt * (j + 0.5) / BED_BANDS + TK, 4) - Tr4); return K.epsStone * SIGMA * q; };
  let Qc = Qc0 > 0 ? Math.min(P, Qc0) : 0.75 * P, V = 0, dT = 0;
  for (let k = 0; k < 40; k++) {
    V = heaterFlow('open', Qc, Ta, 0); dT = Qc / (rA * CP * V);
    const Qn = Math.max(0.05 * P, P - rad(dT));
    if (Math.abs(Qn - Qc) < 0.5) { Qc = Qn; break; }
    Qc = 0.5 * (Qc + Qn);
  }
  V = heaterFlow('open', Qc, Ta, 0); dT = Qc / (rA * CP * V);
  const bands = []; for (let j = 0; j < BED_BANDS; j++) bands.push(Ta + dT * (j + 0.5) / BED_BANDS);
  return { Qc, V, dT, bands, Ttop: Ta + dT, Tside: Ta + dT / 2 };
}
function heaterModel(type, P, T) {
  const hp = GEO.heater[type];
  const Ta = type === 'open' ? T(0.5 * (hp.z0 + hp.z1)) : T(0.5 * (hp.i0 + hp.i1));
  let radFrac = K.radFracCasing, Qc = (1 - radFrac) * P, V = heaterFlow(type, Qc, Ta, 0), Ts = null;
  if (type === 'open') {                  // the stone bed: outer stones from the local air at the bottom to the outlet air at the top
    const bs = bedSplit(P, Ta, meanT(T, 0, GEO.H), 4 * hp.w * (hp.z1 - hp.z0), hp.w * hp.w, Qc);
    Qc = bs.Qc; V = bs.V; Ts = bs.Tside; radFrac = 1 - Qc / P;
  }
  return finishPlume({ type, hp, Ta, P, Qc, radFrac, V, Ts }, T);
}
function finishPlume(m, T) {
  const hp = m.hp, ap = K.alphaP;
  const Cv = 1.2 * ap * Math.cbrt(0.9 * ap) * Math.pow(Math.PI, 2 / 3);
  const Tsrc = T(hp.z1);
  const B = G * m.Qc / (rhoOf(Tsrc) * CP * (Tsrc + TK));
  const c1 = Cv * Math.cbrt(B);
  const zv = hp.z1 - Math.pow(m.V / c1, 0.6);
  m.Cv = Cv; m.B = B; m.c1 = c1; m.zv = zv; m.Tsrc = Tsrc;
  m.Vp = z => z <= hp.z1 ? m.V : c1 * Math.pow(z - zv, 5 / 3);
  m.bp = z => Math.max(hp.w / 2, 1.2 * ap * (z - zv));
  m.wp = z => { const b = 1.2 * ap * Math.max(z - zv, 1e-3), bb = Math.max(b, hp.w / 2); return m.Vp(z) / (Math.PI * bb * bb); };
  m.Tp = z => T(z) + m.Qc / (rhoOf(T(z)) * CP * m.Vp(z));
  m.VpH = m.Vp(GEO.H);
  return m;
}

/* ---------- a round buoyant jet (top-hat integral model, Priestley–Ball entrainment) ---------- */
function marchJet(o, T, hm, opts) {
  let x = o.x, z = o.z, Q = o.Q0, Mx = o.Q0 * o.U0 * Math.cos(o.theta), Mz = o.Q0 * o.U0 * Math.sin(o.theta), Tj = o.T0, s = 0;
  const ds = 0.01, rip = 1.6 * K.alphaP, hp = hm ? hm.hp : null;
  const out = type => { const M = Math.hypot(Mx, Mz); return { type, x, z, Q, Mx, Mz, w: M / Q, b: Q / Math.sqrt(Math.PI * M), Tj, s }; };
  for (let i = 0; i < 700; i++) {
    const M = Math.hypot(Mx, Mz), w = M / Q;
    if (w < opts.wbg) return out('dissolved');
    const b = Q / Math.sqrt(Math.PI * M);
    const Ta = T(z), gp = G * (Tj - Ta) / (Ta + TK);
    const Ri = Math.abs(gp) * b / (w * w), a = K.alphaJ + (K.alphaP - K.alphaJ) * Math.min(1, Ri / rip);
    const dQ = 2 * Math.sqrt(Math.PI) * a * Math.sqrt(M) * ds;
    Mz += gp * (Q / w) * ds;
    Tj = (Q * Tj + dQ * Ta) / (Q + dQ); Q += dQ;
    const M2 = Math.hypot(Mx, Mz);
    x += o.dir * ds * Mx / M2; z += ds * Mz / M2; s += ds;
    if (opts.checkHeater && hp) {
      if (x >= hp.x0 && x <= hp.x1 && z >= hp.body0 && z <= hp.z1) return out(Mz > 0 && z - hp.body0 < 0.02 ? 'intake' : 'heater');
      if (z > hp.z1 && Math.abs(x - hp.xc) <= hm.bp(z)) return out('plume');
    }
    if (z <= 0) return out('floor');
    if (z >= GEO.H) return out('ceiling');
    if (x <= 0 || x >= GEO.L) return out('wall');
  }
  return out('dissolved');
}

/* ---------- a cold current along the floor (wall jet → gravity current, Parker et al. 1987 entrainment) ---------- */
function marchFloor(o, T) {
  let Q = o.Q0, M = o.Q0 * o.U0, Tc = o.T0, x = 0, W = o.W0, h = o.d0, u = o.U0, gp = 0, hmax = 0, Ri = 0;
  const ds = 0.02;
  while (x < o.len) {
    const q = Q / W, Ta = T(h);
    gp = G * (Ta - Tc) / (Ta + TK);
    const um = M / Q, ug = gp > 0 ? Math.cbrt(gp * q) : 0;
    u = Math.max(um, ug); h = q / u; if (h > hmax) hmax = h;
    Ri = gp > 0 ? gp * h / (u * u) : 0;
    const E = entrainE(Ri);
    const dQ = E * u * W * ds;
    Tc = (Q * Tc + dQ * T(h)) / (Q + dQ); Q += dQ;
    if (ug > um) M = Q * ug;
    W = Math.min(o.Wmax, W + (um >= ug ? 2 * K.wallJetLat : Math.PI) * ds);
    x += ds;
  }
  /* run-up at the far wall: ½u² spent against g·(T(z) − Tc)/T(z), the room's own stratification included */
  let climb = h, ke = 0.5 * u * u;
  for (let i = 0; i < 400 && ke > 0 && climb < GEO.H; i++) { const Tz = T(climb); ke -= G * (Tz - Tc) / (Tz + TK) * 0.005; climb += 0.005; }
  return { Qarr: Q, u, h, hmax, gp, Tc, Ent: Q - o.Q0, climb, Ri };
}

/* ---------- the flows object → a list of openings with mass flows ---------- */
function openingsOf(state, flows, T) {
  const none = state.vent === 'none';
  const roleQ = {}, roleM = {}, roleT = {};
  if (flows && Array.isArray(flows.openings)) for (const o of flows.openings) {
    const r = o.role || o.name; if (!r) continue;
    roleQ[r] = o.q; if (o.mdot != null) roleM[r] = o.mdot; if (o.T != null) roleT[r] = o.T;
  }
  const pick = (role, scalar) => (flows && flows[scalar] != null) ? flows[scalar] : (roleQ[role] || 0);
  const ops = [];
  const add = (key, q, a, b, wall, area, extra) => {
    if (!q) return;
    const hc = 0.5 * (a + b);
    const Tin = roleT[key] != null && q > 0 ? roleT[key] : T_OUT;
    const m = roleM[key] != null ? roleM[key] : (q > 0 ? q * rhoOf(Tin) : q * rhoOf(T(hc)));
    ops.push(Object.assign({ key, q, m, a, b, hc, wall, area, Tin }, extra || {}));
  };
  const r = GEO.D / 2, aD = Math.PI * r * r;
  if (!none) {
    const hi = GEO.inletH[state.inlet];
    if (state.inlet === 'bottom') add('inlet', pick('inlet', 'mainInletQ'), 0, 0, 'floor', aD);
    else add('inlet', pick('inlet', 'mainInletQ'), hi - r, hi + r, 'heaterWall', aD);
    const hg = GEO.grilleH[state.exhaust];
    add('exhaust', pick('exhaust', 'mainExhaustQ'), hg - r, hg + r, 'exhaustWall', aD);
    if (state.dry === 'open') add('dry', pick('dry', 'dryQ'), GEO.dryH - r, GEO.dryH + r, 'exhaustWall', aD);
  }
  add('doorLow', pick('doorLow', 'doorLowQ'), GEO.door.low0, GEO.door.low1, 'door', GEO.door.w * (GEO.door.low1 - GEO.door.low0), { slot: true });
  add('doorTop', pick('doorTop', 'doorTopQ'), GEO.door.top0, GEO.door.top1, 'door', GEO.door.w * (GEO.door.top1 - GEO.door.top0), { slot: true });
  return ops;
}

/* ---------- 2×2 linear transient: dc/dt = A c + g, c(0) = 0; t = Infinity gives the steady state −A⁻¹g exactly ---------- */
function transient2(a11, a12, a21, a22, g1, g2, t) {
  const det = a11 * a22 - a12 * a21;
  const ss = [-(a22 * g1 - a12 * g2) / det, -(-a21 * g1 + a11 * g2) / det];
  if (!isFinite(t)) return { c: ss.slice(), ss };
  const s = 0.5 * (a11 + a22), q2 = s * s - det;
  let E11, E12, E21, E22;
  if (q2 > 1e-30) {                          // real eigenvalues l1 > l2 (both < 0): e^{At} = [e^{l1 t}(A − l2 I) − e^{l2 t}(A − l1 I)]/(l1 − l2)
    const q = Math.sqrt(q2), l1 = s + q, l2 = s - q, e1 = Math.exp(l1 * t), e2 = Math.exp(l2 * t), d = l1 - l2;
    E11 = (e1 * (a11 - l2) - e2 * (a11 - l1)) / d; E22 = (e1 * (a22 - l2) - e2 * (a22 - l1)) / d;
    E12 = (e1 - e2) * a12 / d; E21 = (e1 - e2) * a21 / d;
  } else {
    const e = Math.exp(s * t); let ch, sh;
    if (q2 < -1e-30) { const q = Math.sqrt(-q2); ch = Math.cos(q * t); sh = Math.sin(q * t) / q; } else { ch = 1; sh = t; }
    E11 = e * (ch + sh * (a11 - s)); E12 = e * sh * a12; E21 = e * sh * a21; E22 = e * (ch + sh * (a22 - s));
  }
  return { c: [ss[0] - (E11 * ss[0] + E12 * ss[1]), ss[1] - (E21 * ss[0] + E22 * ss[1])], ss };
}

/* ---------- the main entry ---------- */
function breathing(state, flows, profileArg, opts) {
  const floorEscape = !!(opts && opts.floorEscape === true);   // default: mixed layer (VTT 1992 floor air 33–40 °C from 18–20 °C inflow); true = thermal limit, sensitivity only
  const T = typeof profileArg === 'function' ? profileArg : (flows && typeof flows.profile === 'function' ? flows.profile : defaultProfile);
  const notes = [];
  const H = GEO.H, none = state.vent === 'none';
  const freeRatio = (flows && flows.grilleFreeArea) || K.grilleFree;
  const ops = openingsOf(state, flows, T);
  const ins = ops.filter(o => o.m > 0), outs = ops.filter(o => o.m < 0);
  const mIn = ins.reduce((s, o) => s + o.m, 0), mOut = outs.reduce((s, o) => s - o.m, 0);
  if (mIn > 0 && Math.abs(mIn - mOut) > 1e-3 * mIn) notes.push('mass imbalance in flows: in ' + mIn.toExponential(3) + ' kg/s, out ' + mOut.toExponential(3));

  /* 1. heat balance → convective output → heater flow and plume */
  const hb = heatBalance(ops, T);
  if (hb.capped) notes.push('steady losses ' + hb.total.toFixed(0) + ' W exceed the 12 kW rating; heater taken at 12 kW');
  let hm = heaterModel(state.heater, hb.P, T);
  const hp = hm.hp;

  /* floor inlet under a casing or a stone bed: the jet's momentum adds draught (momentum flux spread over the plan area) */
  const inletOp = ins.find(o => o.key === 'inlet');
  let floorBoost = 0;
  if (!none && state.inlet === 'bottom' && inletOp && state.heater !== 'wall') {
    const U0 = (inletOp.m / rhoOf(inletOp.Tin)) / (K.cd * freeRatio * inletOp.area);
    floorBoost = inletOp.m * U0 / (hp.w * hp.w);
    const V2 = heaterFlow(state.heater, hm.Qc, hm.Ta, floorBoost);
    hm = finishPlume(Object.assign({}, hm, { V: V2 }), T);
  }
  const rhoSrc = rhoOf(hm.Tsrc), rhoIntake = rhoOf(hm.Ta);
  const wbg = hm.VpH / (GEO.W * H);                      // mean speed of the plume-driven circulation across the room section
  const ceilTh = K.ceilJet * (H - hm.zv);                 // ceiling-jet thickness

  /* 2. follow every inflow */
  let capIntakeVol = 0;                                   // heater intake capacity used by directly captured streams (m³/s)
  const fates = [];
  const jetFrom = (o, x0, z0, dir, theta, check) => {
    const Q0 = o.m / rhoOf(o.Tin);
    const Aj = o.slot ? K.cd * o.area : K.cd * freeRatio * o.area;
    const U0 = Q0 / Aj, d0 = Math.sqrt(4 * Aj / Math.PI);
    return { Q0, U0, d0, Aj, res: marchJet({ x: x0, z: z0, dir, theta, Q0, U0, T0: o.Tin }, T, check ? hm : null, { wbg, checkHeater: check }) };
  };
  const neutralOf = Tj => invT(T, Tj);
  for (const o of ins) {
    const f = { key: o.key, m: o.m, Tin: o.Tin, pP: 0, pU: 0, pL: 0, nl: [], cur: null, spills: [], info: '' };
    fates.push(f);
    const isInlet = o.key === 'inlet';
    const theta = isInlet && state.angle === 'up45' && state.inlet !== 'bottom' ? Math.PI / 4 : 0;
    const floorCurrent = (Q0, U0, d0, W0, Wmax, len, wall) => {
      const c = marchFloor({ Q0, U0, d0, W0, Wmax, len, T0: o.Tin }, T);
      f.cur = Object.assign(c, { Q0, wall, share: 1 });
      f.pL = 1;
      f.info = 'floor current: arrives ' + (c.Qarr * 1000).toFixed(1) + ' l/s (×' + (c.Qarr / Q0).toFixed(2) + '), ' + (c.h * 100).toFixed(1) + ' cm deep, climbs ' + (c.climb * 100).toFixed(0) + ' cm at the ' + wall;
    };
    const spill = (share, Tj, Qvol) => {
      if (share <= 1e-9) return;
      const gp = G * (T(0) - Tj) / (T(0) + TK);
      const q = Qvol / GEO.W, hgc = gp > 0 ? Math.cbrt(q * q / gp) : 0.01;
      f.nl.push({ share, hn: neutralOf(Tj), hgc });
    };
    const resolveEnd = (r, share) => {               // what is left of a jet when it ends: sinks or rises to its neutral level
      if (r.type === 'floor') f.nl.push({ share, hn: 0, hgc: 0.02 });
      else spill(share, r.Tj, r.Q);
    };
    if (isInlet && state.inlet === 'below' && theta === 0) {
      const Q0 = o.m / rhoOf(o.Tin), Aj = K.cd * freeRatio * o.area, U0 = Q0 / Aj, d0 = Math.sqrt(4 * Aj / Math.PI);
      floorCurrent(Q0, U0, d0, d0, GEO.W, GEO.L, 'exhaustWall');
      f.ar = G * (T(o.hc) - o.Tin) / (T(o.hc) + TK) * d0 / (U0 * U0);
    } else if (isInlet && state.inlet === 'bottom') {
      const Q0 = o.m / rhoOf(o.Tin);
      if (state.heater === 'wall') {
        const j = jetFrom(o, hp.xc, 0, 1, Math.PI / 2, true);
        if (j.res.type === 'intake') {
          const avail = Math.max(0, hm.V - capIntakeVol), cap = Math.min(j.res.Q, avail);
          f.pP = cap / j.res.Q; capIntakeVol += cap;
          f.info = 'floor jet reaches the wall heater intake carrying ' + (j.res.Q * 1000).toFixed(1) + ' l/s; intake takes ' + (cap * 1000).toFixed(1);
          spill(1 - f.pP, j.res.Tj, j.res.Q * (1 - f.pP));
        } else { resolveEnd(j.res, 1); f.info = 'floor jet falls back before the wall heater (' + j.res.type + ')'; }
      } else {
        const avail = Math.max(0, hm.V - capIntakeVol), cap = Math.min(Q0, avail);
        f.pP = cap / Q0; capIntakeVol += cap;
        f.info = 'floor inlet under the ' + state.heater + ' heater: heater draws ' + (hm.V * 1000).toFixed(1) + ' l/s with the jet boost, takes ' + (cap * 1000).toFixed(1) + ' of ' + (Q0 * 1000).toFixed(1);
        if (f.pP < 1) spill(1 - f.pP, o.Tin, Q0 * (1 - f.pP));
      }
    } else if (isInlet) {
      const j = jetFrom(o, 0, o.hc, 1, theta, true);
      f.ar = G * (T(o.hc) - o.Tin) / (T(o.hc) + TK) * j.d0 / (j.U0 * j.U0);
      const r = j.res;
      if (r.type === 'plume') {
        const wpz = hm.wp(r.z), ratio = r.w / wpz, dj = 2 * r.b, bpz = hm.bp(r.z);
        const sRem = Math.max(H - r.z, 0.01), yP = K.pbA * ratio * dj * Math.pow(sRem / (ratio * dj), K.pbB);
        if (yP <= 2 * bpz) { f.pP = 1; f.info = 'jet meets the plume at ' + r.z.toFixed(2) + ' m and is turned inside it (penetration ' + yP.toFixed(2) + ' m < plume width ' + (2 * bpz).toFixed(2) + ' m)'; }
        else {                                           // punches through: mixes with plume air on the way, then carries on
          const dQ = 2 * Math.sqrt(Math.PI) * K.alphaJ * Math.sqrt(r.Q * r.w) * 2 * bpz;
          const Tj = (r.Q * r.Tj + dQ * hm.Tp(r.z)) / (r.Q + dQ), Qn = r.Q + dQ;
          const Mx = r.Mx, Mz = r.Mz + dQ * wpz;
          const M = Math.hypot(Mx, Mz), Un = M / Qn, th = Math.atan2(Mz, Mx);
          const r2 = marchJet({ x: hp.xc + bpz, z: r.z, dir: 1, theta: th, Q0: Qn, U0: Un, T0: Tj }, T, null, { wbg, checkHeater: false });
          resolveEnd(r2, 1);
          f.info = 'jet punches through the plume at ' + r.z.toFixed(2) + ' m (penetration ' + yP.toFixed(2) + ' m > width ' + (2 * bpz).toFixed(2) + ' m), leaves at ' + Tj.toFixed(0) + ' °C, ends ' + r2.type + ' at ' + r2.z.toFixed(2) + ' m';
        }
      } else if (r.type === 'heater') {
        if (state.heater === 'open') {                  // stone bed: the face's share of the bed draw plus what the stagnation pressure forces in
          const avail = Math.max(0, hm.V - capIntakeVol);
          const pst = 0.5 * rhoOf(r.Tj) * r.w * r.w, Af = Math.PI * r.b * r.b;
          let lo = 0, hi = 5; for (let i = 0; i < 50; i++) { const v = 0.5 * (lo + hi); if (ergunLoss(v, hp.w, rhoOf(r.Tj), muOf(r.Tj)) < pst) lo = v; else hi = v; }
          const qf = lo * Af, cap = Math.min(r.Q, avail / 4 + qf);
          f.pP = cap / r.Q; capIntakeVol += Math.min(cap, avail);
          f.info = 'jet hits the stone bed at ' + r.z.toFixed(2) + ' m carrying ' + (r.Q * 1000).toFixed(1) + ' l/s; bed takes ' + (cap * 1000).toFixed(1);
          spill(1 - f.pP, r.Tj, r.Q * (1 - f.pP));
        } else {                                       // sheet-metal casing: the part of the jet above the casing top enters the plume
          const zr = (hp.z1 - r.z) / r.b;
          const above = zr >= 1 ? 0 : (zr <= -1 ? 1 : (Math.acos(zr) - zr * Math.sqrt(1 - zr * zr)) / Math.PI);
          f.pP = above;
          let rest = 1 - above;
          if (state.heater === 'wall' && rest > 0) {    // the spill runs down the casing face past the intake at its foot
            const avail = Math.max(0, hm.V - capIntakeVol), cap = Math.min(r.Q * rest, avail);
            f.pP += cap / r.Q; capIntakeVol += cap; rest -= cap / r.Q;
          }
          f.info = 'jet hits the casing at ' + r.z.toFixed(2) + ' m; ' + (100 * f.pP).toFixed(0) + ' % goes up with the heater, the rest spills';
          spill(rest, r.Tj, r.Q * rest);
        }
      } else { resolveEnd(r, 1); f.info = 'jet ends: ' + r.type + ' at x ' + r.x.toFixed(2) + ' m, z ' + r.z.toFixed(2) + ' m, ' + r.Tj.toFixed(0) + ' °C'; }
    } else if (o.key === 'exhaust') {                  // reversed exhaust: outdoor air enters at the grille on the exhaust wall
      if (state.exhaust === 'lower') {
        const Q0 = o.m / rhoOf(o.Tin), Aj = K.cd * freeRatio * o.area, U0 = Q0 / Aj, d0 = Math.sqrt(4 * Aj / Math.PI);
        floorCurrent(Q0, U0, d0, d0, GEO.W, GEO.L, 'heaterWall');
      } else {
        const j = jetFrom(o, GEO.L, o.hc, -1, 0, true); resolveEnd(j.res, 1);
        f.info = 'reversed upper grille: jet ends ' + j.res.type + ' at ' + j.res.z.toFixed(2) + ' m, ' + j.res.Tj.toFixed(0) + ' °C';
      }
    } else if (o.key === 'doorLow') {
      const Q0 = o.m / rhoOf(o.Tin), Aj = K.cd * o.area, U0 = Q0 / Aj;
      floorCurrent(Q0, U0, Aj / GEO.door.w, GEO.door.w, GEO.L, GEO.W, 'sideWall');
    } else {                                           // drying vent or door top gap letting outdoor air in high up
      const j = o.key === 'dry' ? jetFrom(o, GEO.L, o.hc, -1, 0, true) : jetFrom(o, GEO.door.x, o.hc, 1, 0, false);
      if (j.res.type === 'plume') f.pP = 1; else resolveEnd(j.res, 1);
      f.info = o.key + ' inflow: jet ends ' + j.res.type + ' at ' + j.res.z.toFixed(2) + ' m, ' + j.res.Tj.toFixed(0) + ' °C';
    }
  }

  /* 3. outlets, and what the currents hand them directly where they arrive */
  const outl = outs.map(o => ({ key: o.key, a: o.a, b: o.b, m: -o.m, wall: o.wall, cj: overlap(H - ceilTh, H, o.b) > 0 ? clamp01((o.b - Math.max(o.a, H - ceilTh)) / Math.max(o.b - o.a, 1e-9)) : 0, direct: 0 }));
  const curs = fates.filter(f => f.cur);
  for (const f of curs) f.cur.entM = f.cur.Ent * rhoOf(T(f.cur.h));
  for (const ol of outl) {
    const arr = curs.filter(f => f.cur.wall === ol.wall);
    if (!arr.length) continue;
    let A = 0; for (const f of arr) { f.cur.ov = f.cur.ov || {}; f.cur.ov[ol.key] = overlap(ol.a, ol.b, f.cur.climb); A += (f.m * f.pL + f.cur.entM) * f.cur.ov[ol.key]; }
    if (A <= 0) continue;
    const Dj = Math.min(ol.m, A); ol.direct = Dj;
    for (const f of arr) { f.cur.s = Math.min(1, (f.cur.s || 0) + Dj / A * f.cur.ov[ol.key]); f.cur.sBy = f.cur.sBy || {}; f.cur.sBy[ol.key] = (f.cur.sBy[ol.key] || 0) + Dj / A * f.cur.ov[ol.key]; }
  }
  for (const f of curs) f.cur.s = f.cur.s || 0;
  for (const ol of outl) ol.rem = ol.m - ol.direct;

  /* 4. the floor layer: thickness where the heater intake and the outlets near it drain what lands on the floor.
     A point sink near the layer top draws from both sides once it is closer than the critical distance
     S = 0.69·(Q²/g′)^(1/5) (Lubin & Springer 1967); the share drawn from below runs from 0 at S above the interface
     to ½ at the interface and 1 at S below it. */
  const sinkPhi = (zs, Q, h, gp) => {
    if (Q <= 0) return zs < h ? 1 : 0;
    const Sc = 0.69 * Math.pow(Q * Q / gp, 0.2), d = zs - h;
    return d >= Sc ? 0 : (d <= -Sc ? 1 : 0.5 * (1 - d / Sc));
  };
  let mFT = 0, mF = 0; for (const o of ins) { mFT += o.m * o.Tin; mF += o.m; }
  const Tfresh = mF > 0 ? mFT / mF : T_OUT;
  let gpL = null;
  const gpAt = h => gpL != null ? gpL : Math.max(G * (T(h) - Tfresh) / (T(h) + TK), 1e-4);
  const intakeL = h => {                                 // m³/s the heater (and plume) draw from a layer of depth h
    const avail = Math.max(0, hm.V - capIntakeVol);
    let v = hp.intake === 'bed' ? avail * clamp01((h - hp.z0) / (hp.z1 - hp.z0)) : avail * sinkPhi(0.5 * (hp.i0 + hp.i1), avail, h, gpAt(h));
    if (h > hp.z1) v += hm.Vp(Math.min(h, H)) - hm.V;
    return v;
  };
  const outletL = (ol, h) => { const zc = 0.5 * (ol.a + ol.b), q = ol.rem * (1 - ol.cj); return q * sinkPhi(zc, q / rhoOf(T(zc)), h, gpAt(h)); };
  let keep = 1;                                          // share of the floor-bound fresh air the floor heat leaves in the layer
  const supplyAt = hL => {
    let s = 0; const kp = keep;
    for (const f of fates) {
      if (f.cur && !f.dissolved) s += f.m * f.pL * (1 - f.cur.s);
      for (const n of f.nl) if (n.hn <= hL) s += f.m * n.share;
    }
    return s * kp;
  };
  const hMinAt = hL => {
    let h = 0;
    for (const f of fates) { if (f.cur && !f.dissolved) h = Math.max(h, f.cur.climb); for (const n of f.nl) if (n.hn <= hL) h = Math.max(h, n.hgc); }   // a current's return cell is as deep as its run-up at the far wall
    return Math.min(h, H);
  };
  const drains = h => {
    let d = intakeL(h) * rhoOf(T(h / 2));
    for (const ol of outl) d += outletL(ol, h);
    for (const f of curs) d += f.cur.s * f.cur.entM;   // a current runs inside the layer it makes and re-entrains layer air
    return d;
  };
  const solveLayer = () => {
    let hL = 0;
    for (let it = 0; it < 12; it++) {
      const Ssup = supplyAt(hL);
      let hn;
      if (Ssup <= 1e-12) hn = 0;
      else {
        const hmin = Math.max(hMinAt(hL), 1e-3);
        if (drains(hmin) >= Ssup) hn = hmin;
        else if (drains(H) < Ssup) hn = H;
        else { let lo = hmin, hi = H; for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (drains(m) < Ssup) lo = m; else hi = m; } hn = hi; }
      }
      if (Math.abs(hn - hL) < 1e-5) { hL = hn; break; }
      hL = hn;
    }
    return hL;
  };

  /* 5. is the layer stable? Floor convection Q heats the air landing on the floor. Its forced share (1 − n), n the
     natural-convection share, warms the whole layer: TL = Tmix + (1 − n)·Q/(ṁ·cp). Its natural share forms thermals
     that lift parcels from TL to the temperature of the air above, Ti, and leave the layer:
     escaping share e = n·Q/(ṁ·cp·(Ti − TL)), e ≥ 1 (or TL ≥ Ti) meaning no layer at all.
     n from the Churchill–Usagi combination Nu³ = Nu_N³ + Nu_F³ (Incropera & DeWitt §9.9). The layer's buoyancy
     g′ = g·(Ti − TL)/T sets the critical sink distance; two passes settle g′, then the escape is applied once. */
  let hL = 0, SL = 0, layer = false, layerInfo = null;
  const layerTemps = (hLx) => {
    const Ti = T(hLx);
    let mT = 0, mm = 0, uL = 0, wu = 0;
    for (const f of fates) {
      const T0 = f.Tin;
      if (f.cur && !f.dissolved) { const w = f.m * f.pL * (1 - f.cur.s); mT += w * T0; mm += w; uL += w * f.cur.u; wu += w; }
      for (const n of f.nl) if (n.hn <= hLx) { mT += f.m * n.share * T0; mm += f.m * n.share; }
    }
    const D0 = Math.max(0, drains(hLx) - mm);
    const mth = mm + D0, Tmix = (mT + D0 * Ti) / mth;
    if (wu > 0) uL /= wu; else { const gp0 = Math.max(G * (Ti - Tmix) / (Ti + TK), 1e-4); uL = Math.cbrt(gp0 * mth / rhoOf(Tmix) / GEO.W); }
    const fNat = (Tf, TLx) => {
      const Tfilm = 0.5 * (Tf + TLx), nu = muOf(Tfilm) / rhoOf(Tfilm), kair = 0.0241 * Math.pow((Tfilm + TK) / TK, 1.5) * (TK + 194) / (Tfilm + TK + 194), Pr = 0.71;
      const dT = Math.max(Tf - TLx, 0.01), Ln = GEO.A / (2 * (GEO.L + GEO.W));
      const Ra = G / (Tfilm + TK) * dT * Ln * Ln * Ln / (nu * nu / Pr);
      const hN = (Ra > 1e7 ? 0.15 * Math.cbrt(Ra) : 0.54 * Math.pow(Ra, 0.25)) * kair / Ln;       // Incropera eqs. 9.30–9.31
      const Re = uL * GEO.L / nu, hF = 0.037 * Math.pow(Re, 0.8) * Math.cbrt(Pr) * kair / GEO.L;   // turbulent from the leading edge, eq. 7.38
      return Math.pow(hN, 3) / (Math.pow(hN, 3) + Math.pow(hF, 3));
    };
    let TL = Tmix, fh = null, fn = 1;
    for (let i = 0; i < 40; i++) {
      fh = floorHeat(T, TL, hb.P - hm.Qc, state.heater);
      fn = floorEscape ? fNat(fh.Tf, TL) : 0;
      const TLn = Tmix + (1 - fn) * fh.Q / (CP * mth);
      if (Math.abs(TLn - TL) < 0.005) { TL = TLn; break; } TL = 0.5 * (TL + TLn);
    }
    const e = TL >= Ti ? 1 : clamp01(fn * fh.Q / (CP * mth * (Ti - TL)));
    return { Ti, Tmix, TL, Qfloor: fh.Q, Tfloor: fh.Tf, natShare: fn, uFloor: uL, escape: e, stable: e < 1, gp: Math.max(G * (Ti - TL) / (Ti + TK), 1e-4), mth };
  };
  for (let pass = 0; pass < 3; pass++) {
    hL = solveLayer();
    layer = supplyAt(hL) > 1e-12 && hL > 0;
    if (!layer) break;
    layerInfo = layerTemps(hL);
    if (!layerInfo.stable) break;
    gpL = gpL == null ? layerInfo.gp : Math.sqrt(gpL * layerInfo.gp);
  }
  if (layer && layerInfo && !layerInfo.stable) {
    notes.push('floor layer not stable: inflow mixes to ' + layerInfo.Tmix.toFixed(1) + ' °C, floor heat ' + layerInfo.Qfloor.toFixed(0) + ' W lifts it all to ' + layerInfo.Ti.toFixed(1) + ' °C, the air above it; the low air joins the room');
    for (const f of fates) for (const n of f.nl) n.hn = GEO.H;          // spills join U
    for (const f of curs) { f.pU += f.pL * (1 - f.cur.s); f.pL = f.pL * f.cur.s; f.dissolved = true; }
    layer = false; hL = 0;
  } else if (layer) {
    keep = 1 - layerInfo.escape;
    hL = solveLayer();
  }
  SL = layer ? supplyAt(hL) : 0;
  const escaped = layer && keep > 0 ? SL / keep * (1 - keep) : 0;     // fresh lifted off the floor by floor convection, straight to U
  if (layer && escaped > 0) notes.push('floor convection lifts ' + (100 * (1 - keep)).toFixed(0) + ' % of the air landing on the floor into the room');

  /* 6. flows between the nodes */
  const EL = layer ? intakeL(hL) * rhoOf(T(hL / 2)) : 0;
  let XLrem = 0, sEntL = 0, sEntU = 0, entUinL = 0, Uout = 0, Pdraw = 0;
  for (const ol of outl) {
    const toP = ol.rem * ol.cj, toL = layer ? outletL(ol, hL) : 0;
    ol.toP = toP; ol.toL = toL; ol.toU = ol.rem - toP - toL;
    XLrem += toL; Uout += ol.toU; Pdraw += toP;
  }
  for (const f of curs) { if (layer) sEntL += f.cur.s * f.cur.entM; else sEntU += f.cur.s * f.cur.entM; }
  Uout += sEntU;
  let fP = 0, fU = escaped, fSC = 0;
  for (const f of fates) {
    fP += f.m * f.pP; fU += f.m * f.pU;
    if (f.cur) fSC += f.m * (f.dissolved ? f.pL : f.pL * f.cur.s);
    for (const n of f.nl) if (n.hn > hL || !layer) fU += f.m * n.share;
  }
  if (!layer) { /* nothing lands on the floor for long: no layer */ }
  let mpH = Math.max(rhoSrc * hm.VpH, fP + EL);
  const EU = mpH - fP - EL;
  const deltaP = Math.min(1, Pdraw / mpH);
  let D = 0, R = 0, J = 0;
  /* two-way exchange across the layer top, sheared by the floor air moving at uFloor (Parker et al. 1987, the same law as
     the floor currents): J = E(Ri)·u·A, Ri = g′·hL/u² */
  if (layer && layerInfo) {
    const u = Math.max(layerInfo.uFloor, 1e-4), Ri = layerInfo.gp * hL / (u * u);
    J = entrainE(Ri) * u * GEO.A * rhoOf(T(hL));
    layerInfo.Ri = Ri; layerInfo.J = J;
  }
  if (layer) {
    const net = SL + entUinL - (EL + XLrem + sEntL);
    if (net > 0) R = net; else D = -net;
  }
  const piL = layer ? (EL * (1 - deltaP) + R + J) / Math.max(EL + XLrem + sEntL + R + J, 1e-15) : 0;
  const mFreshIn = fates.reduce((s, f) => s + f.m, 0);
  const fresh2U = fP * (1 - deltaP) + fU + (layer ? piL * SL : 0);
  const F = mFreshIn > 0 ? clamp01(fresh2U / mFreshIn) : 0;
  const qIn = (flows && flows.qOutdoorIn != null) ? flows.qOutdoorIn : mFreshIn / RHO_OUT;
  const mainF = (() => {
    const f = fates.find(x => x.key === 'inlet'); if (!f) return null;
    let r = f.pP * (1 - deltaP) + f.pU;
    for (const n of f.nl) r += (n.hn > hL || !layer) ? n.share : n.share * ((1 - keep) + keep * piL);
    if (f.cur && !f.dissolved) r += f.pL * (1 - f.cur.s) * (layer ? (1 - keep) + keep * piL : 1);
    return r;
  })();

  /* 7. CO₂: both mouths in U unless the layer reaches them */
  const NU = zoneMass(T, layer ? hL : 0, H), NL = layer ? zoneMass(T, 0, hL) : 0;
  const g1 = co2GenPerBather() * MAIR * 1e6;            // kg/s·ppm per bather
  let GU = 0, GL = 0;
  const mouths = [GEO.mouthUpper, GEO.mouthLower].slice(0, K.nBathers);
  for (const hmth of mouths) if (layer && hL > hmth) GL += g1; else GU += g1;
  const upperInL = layer && hL > GEO.mouthUpper;
  const PtoU = mpH - Pdraw;
  let cU, cL, cUss;
  const t = K.sessionS;
  if (!layer || NL < 1e-6) {
    const k = Uout + EU * Pdraw / mpH;                   // = fresh reaching U
    cU = k > 0 ? (GU + GL) / k * (isFinite(t) ? 1 - Math.exp(-k * t / NU) : 1) : (GU + GL) * t / NU;
    cUss = k > 0 ? (GU + GL) / k : Infinity; cL = 0;
  } else {
    const a11 = (PtoU * EU / mpH - (EU + Uout + entUinL + D + J)) / NU;
    const a12 = (PtoU * EL / mpH + R + J) / NU;
    const a21 = (entUinL + D + J) / NL;
    const a22 = -(EL + XLrem + sEntL + R + J) / NL;
    const tr = transient2(a11, a12, a21, a22, GU / NU, GL / NL, t);
    cU = tr.c[0]; cL = tr.c[1]; cUss = tr.ss[0];
  }
  const cMouth = upperInL ? cL : cU;
  const co2AtMouth = K.co2Out + cMouth;

  /* U balance check (all nodes must close) */
  if (layer || fU + fP > 0) {
    const inU = fU + PtoU + R, outU = EU + Uout + entUinL + D;
    if (Math.abs(inU - outU) > 1e-6 + 1e-3 * mFreshIn) notes.push('U balance off by ' + (inU - outU).toExponential(2) + ' kg/s');
  }
  for (const f of fates) if (f.info) notes.push(f.key + ': ' + f.info);
  notes.push('heater ' + state.heater + ': steady losses ' + hb.total.toFixed(0) + ' W (envelope ' + hb.env.toFixed(0) + ', ventilation ' + hb.vent.toFixed(0) + ', bathers ' + hb.bath.toFixed(0) + '), convective ' + hm.Qc.toFixed(0) + ' W, heater draws ' + (hm.V * 1000).toFixed(1) + ' l/s, plume at the ceiling ' + (hm.VpH * 1000).toFixed(0) + ' l/s');
  if (layer && layerInfo) notes.push('floor layer stable: mixes to ' + layerInfo.TL.toFixed(1) + ' °C with ' + layerInfo.Qfloor.toFixed(0) + ' W from the floor (surface ' + layerInfo.Tfloor.toFixed(1) + ' °C), air above it ' + layerInfo.Ti.toFixed(1) + ' °C');
  if (layer && J > 0) notes.push('the moving floor air mixes ' + (J / RHO_OUT * 1000).toFixed(1) + ' l/s each way across the layer top (Ri ' + layerInfo.Ri.toFixed(2) + ')');
  if (layer) notes.push('cold floor layer ' + (hL * 100).toFixed(1) + ' cm: fresh into it ' + (SL / RHO_OUT * 1000).toFixed(1) + ' l/s, heater lifts ' + (EL / RHO_OUT * 1000).toFixed(1) + ' l/s of it, outlets inside it take ' + ((XLrem + sEntL) / RHO_OUT * 1000).toFixed(1) + ' l/s; share of its fresh air reaching the bench ' + piL.toFixed(2));
  if (fSC > 0) notes.push('short circuit: ' + (fSC / RHO_OUT * 1000).toFixed(1) + ' l/s of outdoor air runs along the floor straight into an outlet');
  if (Pdraw > 0) notes.push('ceiling outlets take ' + (100 * deltaP).toFixed(1) + ' % of the plume before it turns down to the benches');

  return {
    fractionToBreathingZone: F,
    qFreshAtBreathingZone: F * qIn,
    co2AtMouth,
    notes,
    /* extras */
    fractionMainInlet: mainF == null ? null : clamp01(mainF),
    co2Steady: K.co2Out + (upperInL ? NaN : cUss),
    floorLayerH: layer ? hL : 0,
    layer: layerInfo,
    heater: { P: hb.P, losses: hb, Qc: hm.Qc, radFrac: hm.radFrac, V: hm.V, VpH: hm.VpH, zv: hm.zv },
    nodes: { fP, fU, fL: SL, fSC, EL, EU, XL: XLrem + sEntL, mpH, deltaP, piL, D, R, J },
    /* the zonal routing above, per stream and per outlet, for routes() and the drawing (kg/s) */
    routing: {
      layer, hL: layer ? hL : 0, keep, deltaP, piL, EL, XLrem, sEntL, R, J, Pdraw, mpH, rhoPlume: rhoSrc,
      denom: EL + XLrem + sEntL + R + J,
      streams: fates.map(f => {
        let nlU = 0, nlL = 0;
        for (const n of f.nl) { if (n.hn > hL || !layer) nlU += n.share; else nlL += n.share; }
        const c = f.cur ? { pL: f.pL, s: f.cur.s, dissolved: !!f.dissolved, sBy: Object.assign({}, f.cur.sBy || {}), entM: f.cur.entM } : null;
        return { key: f.key, m: f.m, Tin: f.Tin, pP: f.pP, pU: f.pU, nlU, nlL, cur: c, info: f.info };
      }),
      outlets: outl.map(ol => {
        let sEnt = 0;
        for (const f of curs) if (f.cur.sBy && f.cur.sBy[ol.key]) { const tot = Object.values(f.cur.sBy).reduce((a, v) => a + v, 0); sEnt += f.cur.s * f.cur.entM * f.cur.sBy[ol.key] / tot; }
        return { key: ol.key, m: ol.m, toP: ol.toP, toL: ol.toL, toU: ol.toU, direct: ol.direct, sEntL: layer ? sEnt : 0 };
      })
    }
  };
}

/* ---------- routes(state, flows, b): the zonal routing as clean numbers for the drawing ----------
   Uses only what breathing() computed (b.routing, b.layer, b.co2AtMouth); no new physics.
   Streams, in l/s of outdoor air at 25 °C:
     q = toHeater + toFloor + toBenches (each stream's outdoor air, split by where it first goes);
     floorToOutlet ⊂ toFloor: leaves through an outlet without reaching the bench zone (straight along the floor, out of the
       layer through an outlet in it, or lifted by the heater and taken by a ceiling outlet first); floorOutlet names the largest;
     heaterToOutlet ⊂ toHeater: carried up by the plume and taken by a ceiling outlet before the plume turns down;
     reachesMouth = q − floorToOutlet − heaterToOutlet; Σ reachesMouth = qFreshAtBreathingZone.
   Outlets: q in l/s of room air at its own temperature (flows' q), fromZone the zone supplying most of it.
   plume: the plume's flux at the ceiling, l/s of room air at the temperature beside the stones' top.
   stale: the grey dots, counted against outdoor air: none up to 500 ppm of CO₂ at the mouth (outdoor air is about 426 ppm),
     then one per 500 ppm, rounded; so every occupied room shows at least one. */
const DOT_FREE = 500, DOT_PPM = 500;                     // ppm at the mouth: no grey dot up to DOT_FREE, then one per DOT_PPM
function routeLabel(state, key) {
  if (key == null) return '';
  const duct = state.duct === 'inletduct' ? ' (via the inlet duct)' : '';
  if (key === 'inlet') return ({ above: 'inlet above the stones', middle: "inlet at the heater's middle", below: 'low inlet', bottom: 'floor inlet' })[state.inlet] + duct;
  if (key === 'exhaust') return (state.exhaust === 'upper' ? 'grille under the upper bench' : 'grille under the lower bench') + (state.duct === 'riser' ? ' (long duct)' : state.duct === 'half' ? ' (short duct)' : '');
  return ({ dry: 'drying vent', doorLow: 'gap under the door', doorTop: 'gap over the door' })[key] || key;
}
function pathOf(f, rt) {                                 // the stream's first move, read from what breathing() recorded
  const i = f.info || '';
  const end = t => ({ floor: 'falls to the floor', wall: 'crosses the room to the far wall', dissolved: 'slows and mixes into the room', ceiling: 'rises to the ceiling', plume: 'drifts into the heater plume', heater: 'meets the heater' })[t] || 'mixes into the room';
  let p;
  if (/punches through the plume/.test(i)) p = 'crosses the heater plume, mixing with it';
  else if (/turned inside it/.test(i)) p = 'is turned up inside the heater plume';
  else if (/hits the stone bed/.test(i)) p = 'hits the stone bed';
  else if (/hits the casing/.test(i)) p = 'hits the heater casing';
  else if (/floor inlet under/.test(i)) p = 'rises straight into the heater';
  else if (/reaches the wall heater intake/.test(i)) p = "rises into the wall heater's intake";
  else if (/falls back before/.test(i)) p = 'rises, then falls back to the floor';
  else if (/floor current/.test(i)) p = f.cur && f.cur.dissolved ? "runs along the floor, where the floor's heat lifts it into the room" : 'runs along the floor';
  else { const m = i.match(/(?:jet ends:?|ends) ([a-z]+)/); p = m ? end(m[1]) : 'mixes into the room'; }
  return p;
}
function routes(state, flows, b) {
  if (!b || !b.routing) b = breathing(state, flows);
  const rt = b.routing, mIn = rt.streams.reduce((a, f) => a + f.m, 0);
  const L = flows && flows.qOutdoorIn > 0 && mIn > 0 ? flows.qOutdoorIn * 1000 / mIn : 1000 / RHO_OUT;   // kg/s → l/s of outdoor air, as flows counts it
  const Pdraw = rt.Pdraw, denom = rt.denom;
  const fOut = rt.layer && denom > 0 ? (rt.XLrem + rt.sEntL) / denom : 0;          // layer air leaving through outlets in the layer
  const fCeil = rt.layer && denom > 0 ? rt.EL * rt.deltaP / denom : 0;              // layer air lifted by the heater, then out at the ceiling
  const floorWeights = {};
  let fwSum = 0;
  for (const o of rt.outlets) { const w = o.toL + o.sEntL; floorWeights[o.key] = w; fwSum += w; }
  const streams = [], notes = [];
  for (const f of rt.streams) {
    const q = f.m * L;
    const toHeater = f.m * f.pP * L, toBenches = f.m * (f.pU + f.nlU) * L;
    let toFloor = f.m * f.nlL * L, sc = 0, floorNet = f.m * f.nlL * L;
    const byOut = {};
    if (f.cur) {
      toFloor += f.m * f.cur.pL * L;
      const sTot = Object.values(f.cur.sBy).reduce((a, v) => a + v, 0);
      if (f.cur.dissolved) sc = f.m * f.cur.pL * L;     // no stable layer: only the part an outlet took on arrival stays a short circuit
      else { sc = f.m * f.cur.pL * f.cur.s * L; floorNet += f.m * f.cur.pL * (1 - f.cur.s) * L; }
      if (sc > 0 && sTot > 0) for (const k in f.cur.sBy) byOut[k] = (byOut[k] || 0) + sc * f.cur.sBy[k] / sTot;
    }
    const kept = floorNet * rt.keep;
    const viaLayerOut = kept * fOut, viaLayerCeil = kept * fCeil;
    if (viaLayerOut > 0 && fwSum > 0) for (const k in floorWeights) if (floorWeights[k] > 0) byOut[k] = (byOut[k] || 0) + viaLayerOut * floorWeights[k] / fwSum;
    if (viaLayerCeil > 0 && Pdraw > 0) for (const o of rt.outlets) if (o.toP > 0) byOut[o.key] = (byOut[o.key] || 0) + viaLayerCeil * o.toP / Pdraw;
    const floorToOutlet = sc + viaLayerOut + viaLayerCeil;
    const heaterToOutlet = toHeater * rt.deltaP, heaterOutlets = {};
    if (heaterToOutlet > 0 && Pdraw > 0) for (const o of rt.outlets) if (o.toP > 0) heaterOutlets[o.key] = heaterToOutlet * o.toP / Pdraw;
    const reachesMouth = Math.max(0, q - floorToOutlet - heaterToOutlet);
    let floorOutlet = null, best = 0; for (const k in byOut) if (byOut[k] > best) { best = byOut[k]; floorOutlet = k; }
    const st = {
      from: f.key, label: routeLabel(state, f.key) + (f.key === 'exhaust' ? ', running backwards' : ''),
      q, toHeater, toFloor, floorToOutlet, floorOutlet, floorOutlets: byOut, toBenches,
      heaterToOutlet, heaterOutlets, reachesMouth
    };
    streams.push(st);
    const fx = v => v.toFixed(1), parts = [];
    if (toHeater > 0.05) parts.push(fx(toHeater) + ' into the heater and its plume' + (heaterToOutlet > 0.05 ? ' (' + fx(heaterToOutlet) + ' of it out at the ceiling)' : ''));
    if (toBenches > 0.05) parts.push(fx(toBenches) + ' into the bench zone');
    if (toFloor > 0.05) parts.push(fx(toFloor) + ' onto the floor' + (floorToOutlet > 0.05 ? ', ' + fx(floorToOutlet) + ' of it out through the ' + routeLabel(state, floorOutlet) + ' without reaching the bench' : ''));
    st.path = pathOf(f, rt);
    const lab = st.label.charAt(0).toUpperCase() + st.label.slice(1) + ' ' + st.path;
    notes.push(lab + ': ' + fx(q) + ' l/s in; ' + (parts.length ? parts.join('; ') : 'too little to split') + '. ' + fx(reachesMouth) + ' l/s reaches the bench' + (q > 0 ? ' (' + Math.round(100 * reachesMouth / q) + ' %).' : '.'));
  }
  const outlets = [];
  const qOf = {}; if (flows && Array.isArray(flows.openings)) for (const o of flows.openings) qOf[o.role || o.name] = o.q;
  for (const o of rt.outlets) {
    const ceiling = o.toP, floor = o.toL + o.direct, bench = o.toU, tot = (ceiling + floor + bench) || 1;
    const fromZone = ceiling >= floor && ceiling >= bench ? 'ceiling' : (floor >= bench ? 'floor' : 'bench');
    outlets.push({
      to: o.key, label: routeLabel(state, o.key) + (o.key === 'inlet' ? ', running backwards' : ''),
      q: qOf[o.key] != null ? -qOf[o.key] * 1000 : o.m / RHO_OUT * 1000, fromZone,
      shares: { ceiling: ceiling / tot, bench: bench / tot, floor: floor / tot }
    });
  }
  const lay = b.layer;
  const floorLayer = { h: b.floorLayerH || 0, T: lay ? lay.TL : null, stable: !!(rt.layer && lay && lay.stable) };
  const stale = Number.isFinite(b.co2AtMouth) ? Math.max(0, Math.round((b.co2AtMouth - DOT_FREE) / DOT_PPM)) : null;
  return { streams, outlets, plume: rt.mpH / rt.rhoPlume * 1000, floorLayer, stale, notes };
}


/* ---------- a simple stand-in airflow (fan 20 l/s, or stack through orifices), kept for comparison ---------- */
function standInAirflow(state, profile) {
  const T = profile || defaultProfile, H = GEO.H;
  const none = state.vent === 'none';
  const aD = Math.PI * GEO.D * GEO.D / 4;
  const ops = [];
  const n = 40, tb = [];                               // ∫0..h ρ_room dz table
  for (let i = 0, acc = 0; i <= n; i++) { tb.push(acc); const z = H * (i + 0.5) / n; acc += rhoOf(T(z)) * H / n; }
  const Iroom = h => { const x = Math.min(Math.max(h, 0), H) / H * n, i = Math.min(Math.floor(x), n - 1); return tb[i] + (tb[i + 1] - tb[i]) * (x - i); };
  if (!none) {
    ops.push({ role: 'inlet', h: GEO.inletH[state.inlet], top: GEO.inletH[state.inlet], A: K.cd * K.grilleFree * aD });
    const hg = GEO.grilleH[state.exhaust], top = state.duct === 'riser' ? 2.17 : (state.duct === 'half' ? 1.18 : hg);
    ops.push({ role: 'exhaust', h: hg, top, A: K.cd * K.grilleFree * aD, fan: state.fan === 'on' });
    if (state.dry === 'open') ops.push({ role: 'dry', h: GEO.dryH, top: GEO.dryH, A: K.cd * K.grilleFree * aD });
  }
  ops.push({ role: 'doorLow', h: 0.005, top: 0.005, A: K.cd * GEO.door.w * 0.010 });
  ops.push({ role: 'doorTop', h: 1.901, top: 1.901, A: K.cd * GEO.door.w * 0.002 });
  const flowOf = (o, p0) => {
    if (o.fan) return -0.020 * rhoOf(T(o.h));
    const pin = p0 - G * Iroom(o.h);
    const hot = rhoOf(T(o.h));
    let dp = -RHO_OUT * G * o.top + hot * G * (o.top - o.h) - pin;      // duct column warm when flowing out
    if (dp > 0 && o.top > o.h) { dp = -RHO_OUT * G * o.h - pin; if (dp < 0) return 0; }   // inflow fills the duct with outdoor air
    return dp > 0 ? o.A * Math.sqrt(2 * RHO_OUT * dp) : -o.A * Math.sqrt(2 * hot * -dp);
  };
  let lo = -60, hi = 60;
  for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); const s = ops.reduce((a, o) => a + flowOf(o, m), 0); if (s > 0) lo = m; else hi = m; }
  const p0 = 0.5 * (lo + hi);
  const openings = ops.map(o => { const m = flowOf(o, p0); const Tp = m > 0 ? T_OUT : T(o.h); return { name: o.role, role: o.role, h: o.h, q: m / rhoOf(Tp), mdot: m, T: Tp }; });
  const by = r => (openings.find(o => o.role === r) || { q: 0 }).q;
  const mIn = openings.reduce((s, o) => s + Math.max(o.mdot, 0), 0);
  return {
    openings, qOutdoorIn: mIn / RHO_OUT, qOutdoorOut: openings.reduce((s, o) => s + Math.max(-o.q, 0), 0),
    mainInletQ: none ? 0 : by('inlet'), mainExhaustQ: none ? 0 : by('exhaust'), dryQ: by('dry'), doorLowQ: by('doorLow'), doorTopQ: by('doorTop'),
    neutralPlaneH: null, reversed: !none && (by('inlet') < 0 || by('exhaust') > 0),
    notes: ['agent C stand-in: fixed 20 l/s fan at the grille temperature, orifices Cd 0.61, grille free area 0.5, duct columns at the grille temperature, inlet duct treated as a plain inlet']
  };
}

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

module.exports = { breathing, routes, standInAirflow, defaultProfile, allStates, CONST: K, GEO, co2GenPerBather, _heaterModel: heaterModel, _heatBalance: heatBalance, _heaterFlow: heaterFlow, _bedSplit: bedSplit, _bedBands: BED_BANDS };

/* ---------- runner: CSV + sanity checks ---------- */
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  let A = null;
  try { A = require(path.join(__dirname, 'airflow.js')); } catch (e) { A = null; }
  const states = allStates();
  const cols = ['vent', 'inlet', 'exhaust', 'fan', 'duct', 'heater', 'angle', 'dry'];
  const f3 = v => (v == null || !isFinite(v)) ? '' : (+v).toFixed(3);
  const f1 = v => (v == null || !isFinite(v)) ? '' : (+v).toFixed(1);
  const rows = [cols.concat(['flowSource', 'qOutdoorIn_ls', 'q_inlet_ls', 'q_exhaust_ls', 'q_dry_ls', 'q_doorLow_ls', 'q_doorTop_ls', 'reversed',
    'fractionToBreathingZone', 'qFreshAtBreathingZone_ls', 'co2AtMouth_ppm', 'fractionMainInlet', 'co2Steady_ppm', 'floorLayer_cm', 'heaterConv_W', 'plumeCeiling_ls',
    'thermalLimit_fraction', 'thermalLimit_co2AtMouth_ppm', 'standIn_qOutdoorIn_ls', 'standIn_fraction', 'standIn_qFreshBZ_ls', 'standIn_co2AtMouth_ppm']).join(',')];
  const res = {};
  let tMax = 0;
  for (const st of states) {
    const flows = A ? A.airflow(st, defaultProfile) : standInAirflow(st);
    const t0 = process.hrtime.bigint();
    const b = breathing(st, flows);
    const dt = Number(process.hrtime.bigint() - t0) / 1e6; if (dt > tMax) tMax = dt;
    const si = standInAirflow(st), bs = breathing(st, si), bt = breathing(st, flows, undefined, { floorEscape: true });
    const key = cols.map(c => st[c] || '').join('|'); res[key] = { b, flows, bs, si };
    rows.push(cols.map(c => st[c] || '').concat([A ? 'A_airflow' : 'C_standIn', f3(flows.qOutdoorIn * 1000), f3(flows.mainInletQ * 1000), f3(flows.mainExhaustQ * 1000), f3(flows.dryQ * 1000), f3(flows.doorLowQ * 1000), f3(flows.doorTopQ * 1000), flows.reversed ? 1 : 0,
      f3(b.fractionToBreathingZone), f3(b.qFreshAtBreathingZone * 1000), f1(b.co2AtMouth), f3(b.fractionMainInlet), f1(b.co2Steady), f1(b.floorLayerH * 100), f1(b.heater.Qc), f1(b.heater.VpH * 1000),
      f3(bt.fractionToBreathingZone), f1(bt.co2AtMouth), f3(si.qOutdoorIn * 1000), f3(bs.fractionToBreathingZone), f3(bs.qFreshAtBreathingZone * 1000), f1(bs.co2AtMouth)]).join(','));
  }
  fs.writeFileSync(path.join(__dirname, 'breathing.csv'), rows.join('\n') + '\n');
  console.log('states', states.length, 'flows from', A ? 'airflow.js' : 'stand-in', '| worst breathing() time', tMax.toFixed(3), 'ms');
  const get = (s) => res[cols.map(c => s[c] || '').join('|')];
  const base = { vent: 'yes', heater: 'open', angle: 'straight', dry: 'closed' };
  const show = [
    ['no fan, low inlet, lower grille', { inlet: 'below', exhaust: 'lower', fan: 'off', duct: 'straight' }],
    ['no fan, low inlet, upper grille', { inlet: 'below', exhaust: 'upper', fan: 'off', duct: 'straight' }],
    ['no fan, low inlet, lower grille, short duct', { inlet: 'below', exhaust: 'lower', fan: 'off', duct: 'half' }],
    ['no fan, low inlet, lower grille, long duct', { inlet: 'below', exhaust: 'lower', fan: 'off', duct: 'riser' }],
    ['fan, inlet above, lower grille', { inlet: 'above', exhaust: 'lower', fan: 'on', duct: 'straight' }],
    ['fan, inlet above, lower grille, long duct', { inlet: 'above', exhaust: 'lower', fan: 'on', duct: 'riser' }],
    ['fan, low inlet, lower grille', { inlet: 'below', exhaust: 'lower', fan: 'on', duct: 'straight' }],
    ['fan, low inlet, upper grille', { inlet: 'below', exhaust: 'upper', fan: 'on', duct: 'straight' }],
    ['no ventilation', { vent: 'none' }]
  ];
  for (const [name, s] of show) {
    const st = s.vent === 'none' ? { vent: 'none', heater: 'open' } : Object.assign({}, base, s);
    const r = get(st);
    console.log(name.padEnd(46), 'qIn', (r.flows.qOutdoorIn * 1000).toFixed(1).padStart(5), 'F', r.b.fractionToBreathingZone.toFixed(2), 'Fmain', r.b.fractionMainInlet == null ? '  - ' : r.b.fractionMainInlet.toFixed(2), 'qBZ', (r.b.qFreshAtBreathingZone * 1000).toFixed(1).padStart(5), 'CO2', r.b.co2AtMouth.toFixed(0), '| stand-in qIn', (r.si.qOutdoorIn * 1000).toFixed(1), 'F', r.bs.fractionToBreathingZone.toFixed(2), 'CO2', r.bs.co2AtMouth.toFixed(0));
  }
}
