'use strict';
/* Agent D: vertical temperature profile of the hot room and the comfort of the bathers' feet.
     profile(state, flows) -> T(h), air temperature in degC at height h (m)
     feet(state, flows)    -> { ankleT_upper, ankleT_lower, ankleV, feetFactor, feetFactor_upper, feetFactor_lower, notes }
   Version 2 (integrator follow-up): natural-convection boundary layers on walls, door and bathers; the casing heater's
   measured casing temperatures radiate; ASHRAE 55 comfort models with whole-body sensation replace the v1 scaling;
   door gap 2 mm; a bug in the averaging window fixed. The first version is kept in the session's working folder, not in the repo.
   If flows is omitted, an airflow stand-in (marked as such) is iterated with the profile.
   Every constant is sourced in D_report.md. Physics, in one paragraph:
   - The room is a stack of horizontal layers in steady state, read 30 min into a session after a 1 h heat-up.
   - The heater's output = the room's losses at the thermostat set point. Open stones: a stone bed that draws room air
     in through its sides (buoyancy against the Ergun loss of the bed; breathing.js's bedSplit, so the whole model has
     one open heater); the outer stones run from the local air at the bottom to the outlet air at the top and radiate
     band by band, each band by its own view; the rest leaves as hot air at the top of the stones. Casing heaters: cool casing (measured), stones on top radiate at their
     measured temperature, the rest leaves as hot channel air through the top; a weak boundary layer rises along the casing.
   - The plume follows Morton-Taylor-Turner entrainment through the stratified room and fills it from the top
     (filling box). The ceiling sensor reads the plume's mean temperature where it meets the ceiling.
   - Surfaces: EN ISO 6946 conductances, McAdams free-convection coefficients, exact view factors of the rectangular
     box for long-wave exchange; the floor is a semi-infinite concrete slab (Carslaw & Jaeger, Duhamel superposition).
   - Two bathers are sensible heat sinks at 40 degC skin. Warm air under cooler air overturns (convective adjustment).
   - Every vertical surface (walls, door, bathers) drives a natural-convection boundary layer (Squire-Eckert laminar,
     Eckert-Jackson turbulent integral solutions) that carries its convective heat, entrains the layers it passes and
     leaves the surface where it is no longer buoyant, at its neutral height.
   - Every inflow is a buoyant jet: merged into the heater plume (momentum-flux balance, or the capture width of a
     line sink in a stream), or entraining room air (Ricou-Spalding, then MTT) and inserted at its neutral level.
   - Comfort: ASHRAE 55-2020 Addendum a vertical-gradient model (Liu et al. 2020) and ASHRAE 55 ankle-draft model
     (Liu et al. 2016), both with whole-body sensation TS = +3. feetFactor = mean over the two bathers of (1 - PPD_ankle draft)
     only: how warm the body is from ankles to mouth is the score's heat factor (evaluate.js), so the head-to-ankle gradient
     would count the same cold lower zone twice. PPD_gradient is still computed and reported. feetFactor_upper and
     feetFactor_lower given separately. */

const G = 9.81, RAIR = 287.05, PATM = 101325, CP = 1007, SIGMA = 5.670e-8, TK = 273.15;
const rho = T => PATM / (RAIR * (T + TK));
const SQRTPI = Math.sqrt(Math.PI);
const BREATHING = require('./breathing.js');   // the open heater's stone-bed flow and the stones' emissivity: one source for the whole model
const bedSplit = BREATHING._bedSplit, BED_BANDS = BREATHING._bedBands, EPS_STONE = BREATHING.CONST.epsStone;

/* ---------- empirical coefficients ---------- */
const ALPHA = 0.10;        // top-hat plume entrainment (Morton, Taylor & Turner 1956; Linden 1999)
const RS = 0.32;           // jet entrainment, Ricou & Spalding 1961
const BU = 5.8;            // round-jet centreline velocity decay U/U0 = 5.8 d/x (Hussein, Capp & George 1994)
const JHW = 0.094;         // round-jet half-width growth (Hussein et al. 1994)
const WJHW = 0.048;        // 3-D wall jet, wall-normal half-width growth (Launder & Rodi 1983)
const TDEC = 0.8;          // jet temperature excess decays at 0.8 of the velocity ratio (ASHRAE Fundamentals ch. 20)
const FOUNT = 2.46;        // fountain rise height z = 2.46 M^(3/4) F^(-1/2) (Turner 1966)
const FR_GC = 1.19;        // gravity-current Froude number, thin current (Huppert & Simpson 1980)
const CD = 0.61;           // sharp-edged orifice discharge coefficient
/* free convection at room surfaces, simplified air correlations (McAdams 1954, as tabulated in ASHRAE Fundamentals ch. 4):
   vertical turbulent 1.31 dT^(1/3); horizontal, unstable side (heated facing up, cooled facing down) 1.52 dT^(1/3);
   horizontal, stable side 0.59 (dT/L)^(1/4). They give EN ISO 6946's design values (2.5 / 5.0 / 0.7) near dT 7, 35, 1 K. */
const hVert = dT => 1.31 * Math.cbrt(Math.max(0.05, Math.abs(dT)));
const hHorUnstable = dT => 1.52 * Math.cbrt(Math.max(0.05, Math.abs(dT)));
const hHorStable = (dT, L) => 0.59 * Math.pow(Math.max(0.05, Math.abs(dT)) / L, 0.25);
/* natural-convection boundary layer on a vertical surface: volume flux per unit width at distance x from its leading edge.
   Integral solutions as given in Holman, Heat Transfer, ch. 7: laminar after Squire and Eckert,
   u = U1 (y/d)(1 - y/d)^2, d/x = 3.93 Pr^-1/2 (0.952 + Pr)^1/4 Gr^-1/4, U1 = 5.17 nu (0.952 + Pr)^-1/2 Gr^1/2 / x, so Q' = U1 d / 12;
   turbulent after Eckert & Jackson (1951), u = U1 (y/d)^(1/7) (1 - y/d)^4, d/x = 0.565 Gr^-0.1 Pr^-8/15 (1 + 0.494 Pr^2/3)^0.1,
   U1 = 1.185 (nu/x) Gr^1/2 (1 + 0.494 Pr^2/3)^-1/2, so Q' = U1 d B(8/7, 5). The larger of the two is used, which joins them near Gr 3e8. */
const PR_AIR = 0.70;
const nuAir = T => 1.589e-5 + 1.006e-7 * (T - 26.85);   // air kinematic viscosity, Incropera Table A.4 (300-350 K)
const B_875 = (() => { let a = 0; const n = 4000; for (let k = 0; k < n; k++) { const e = (k + 0.5) / n; a += Math.pow(e, 1 / 7) * Math.pow(1 - e, 4); } return a / n; })();
function blFlux(x, dT, Tm) {
  if (!(x > 0) || !(dT > 0)) return 0;
  const nu = nuAir(Tm), Gr = G * dT / (Tm + TK) * x * x * x / (nu * nu);
  const lam = 5.17 * nu * Math.pow(0.952 + PR_AIR, -0.5) * Math.sqrt(Gr) / x * x * 3.93 * Math.pow(PR_AIR, -0.5) * Math.pow(0.952 + PR_AIR, 0.25) * Math.pow(Gr, -0.25) / 12;
  const c = 1 + 0.494 * Math.pow(PR_AIR, 2 / 3);
  const tur = 1.185 * nu / x * Math.sqrt(Gr) / Math.sqrt(c) * x * 0.565 * Math.pow(Gr, -0.1) * Math.pow(PR_AIR, -8 / 15) * Math.pow(c, 0.1) * B_875;
  return Math.max(lam, tur);
}
const EPS = 0.9;           // wood, tile, glass, stone (Fan, Holmberg & Heikkinen 1994 use 0.9)
const EPS_SKIN = 0.95, AR_AD = 0.70;   // skin; effective radiation area of a seated body (ASHRAE Fundamentals ch. 9)
const T_STONE = 285;       // stone surface on top of a casing heater, 260-310 degC measured (Fan, Holmberg & Heikkinen 1994)
const T_CASING = 72;       // casing sides of a casing heater, 70.7-72.5 degC measured (Fan, Holmberg & Heikkinen 1994, Table 2)
const T_CASING_BOT = 60;   // its underside, 60 degC measured (same table)
const QTH_REF = 4.1e-3, PTH_REF = 1200, HTH_REF = 0.55;   // air through the VTT casing heater: 4.1 l/s, +245 K, ~1.2 kW, casing 0.55 m (same source)
const T_SKIN = 40;         // skin in an 80-90 degC sauna, 40.4 +/- 1 degC (Sohar et al. 1976)
const AD = 1.8;            // body surface area of a standard adult (DuBois)
const T_SKIN_OFFICE = 34, T_AIR_OFFICE = 24;   // neutral skin at sedentary activity (Fanger 1970), typical neutral air
const TU = 40;             // turbulence intensity % (ISO 7730 default for mixing ventilation)

/* ---------- geometry of the drawing ---------- */
const GEO = {
  W: 2.63, D: 2.24, H: 2.04,
  inletH: { above: 0.98, middle: 0.45, below: 0.12, bottom: 0.0 },
  exhaustH: { lower: 0.25, upper: 0.69 },
  ductTop: { riser: 2.17, half: 1.18 },
  dryH: 1.94,
  door: { w: 0.70, h0: 0.002, h1: 1.902, gapLow: 0.002, gapTop: 0.002 },   // integrator's ruling: 2 mm under the door (agent A's PARAMS.doorGapLow)
  dOpen: 0.125,
  heaterXc: 0.357,                                  // heater centre off the heater wall (drawing x = 73)
  lowerBenchFront: 1.245,                           // drawing x = 200
  ankleUpper: { x: 1.714, h: 0.55, mouth: 1.62 },   // feet of the drawn bather (drawing x = 267, on the lower bench)
  ankleLower: { x: 0.945, h: 0.10, mouth: 1.20 },   // lower-bench bather: ankles ~0.30 m in front of the bench edge
};
const HEATERS = {
  open:   { zb: 0.06, zt: 0.76, halfW: 0.14,  Aside: 4 * 0.28 * 0.70, Atop: 0.28 * 0.28, Abot: 0, sth: 0, intakeH: null, hCasing: 0.70, bed: true },
  closed: { zb: 0.00, zt: 0.67, halfW: 0.145, Aside: 4 * 0.29 * 0.67, Atop: 0.29 * 0.29, Abot: 0, casing: true, intakeH: 0.03, hCasing: 0.67 },
  wall:   { zb: 0.29, zt: 0.68, halfW: 0.145, Aside: 4 * 0.29 * 0.39, Atop: 0.29 * 0.29, Abot: 0.29 * 0.29, casing: true, intakeH: 0.30, hCasing: 0.39 },
};

/* ---------- envelope (EN ISO 6946, EN ISO 10456) ---------- */
function airGapR(d, e1, e2, Tm) {
  const E = 1 / (1 / e1 + 1 / e2 - 1), hr = 4 * SIGMA * Math.pow(Tm + TK, 3) * E, ha = Math.max(1.25, 0.025 / d);
  return 1 / (ha + hr);
}
function wallU(Rsi, Rse) {
  const common = Rsi + 0.015 / 0.13 + airGapR(0.020, 0.9, 0.05, 75) + 0.0125 / 0.25 + Rse;
  const Rins = common + 0.100 / 0.037, Rstud = common + 0.100 / 0.13, fStud = 0.12;
  return (1 - fStud) / Rins + fStud / Rstud;
}
const U_WALL = wallU(0.13, 0.13), U_CEIL = wallU(0.10, 0.10), U_DOOR = 1 / (0.13 + 0.008 / 1.0 + 0.13);
const SLAB_E = Math.sqrt(1.65 * 2200 * 1000);   // concrete 2200 kg/m3: lambda 1.65 W/mK, c 1000 J/kgK
function slabConductance(e, t, th) { return e * (2 / SQRTPI) * (Math.sqrt(t) - Math.sqrt(Math.max(0, t - th))) / th; }

/* ---------- view factors of a rectangular box (Incropera, aligned parallel rectangles) ---------- */
function Fpar(X, Y, c) {
  if (c <= 1e-9) return 1;
  const x = X / c, y = Y / c, x2 = x * x, y2 = y * y;
  return (2 / (Math.PI * x * y)) * (Math.log(Math.sqrt((1 + x2) * (1 + y2) / (1 + x2 + y2)))
    + x * Math.sqrt(1 + y2) * Math.atan(x / Math.sqrt(1 + y2)) + y * Math.sqrt(1 + x2) * Math.atan(y / Math.sqrt(1 + x2))
    - x * Math.atan(x) - y * Math.atan(y));
}
const geoCache = new Map();
function radGeometry(W, D, H, N) {
  const key = [W, D, H, N].join(',');
  if (geoCache.has(key)) return geoCache.get(key);
  const dz = H / N, Af = W * D, per = 2 * (W + D);
  const fp = c => Fpar(W, D, Math.abs(c));
  const S = (a, b) => b - a <= 0 ? 0 : per * (b - a) - 2 * Af * (1 - fp(b - a));   // self exchange area of the perimeter band [a,b]
  const Xdis = (a, b, c, d) => 0.5 * (S(a, d) - S(a, c) - S(b, d) + S(b, c));      // two disjoint bands, b <= c
  const Xseg = (a, b, c, d) => {   // two perimeter bands, any overlap
    if (b <= c) return Xdis(a, b, c, d);
    if (d <= a) return Xdis(c, d, a, b);
    const o1 = Math.max(a, c), o2 = Math.min(b, d);
    let x = S(o1, o2);
    const A = [[a, Math.min(b, o1)], [Math.max(a, o2), b]].filter(p => p[1] > p[0]);
    const B = [[c, Math.min(d, o1)], [Math.max(c, o2), d]].filter(p => p[1] > p[0]);
    for (const p of A) for (const q of B) x += Xseg(p[0], p[1], q[0], q[1]);
    for (const p of A) x += Xseg(p[0], p[1], o1, o2);
    for (const q of B) x += Xseg(o1, o2, q[0], q[1]);
    return x;
  };
  const XB = new Float64Array(N * N), XF = new Float64Array(N), XC = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = i * dz, b = a + dz;
    XF[i] = Af * (fp(a) - fp(b)); XC[i] = Af * (fp(H - b) - fp(H - a));
    for (let k = i + 1; k < N; k++) { const x = Xdis(a, b, k * dz, (k + 1) * dz); XB[i * N + k] = x; XB[k * N + i] = x; }
  }
  const g = { dz, Af, per, XB, XF, XC, XFC: Af * fp(H), fp, Xseg, S };
  geoCache.set(key, g);
  return g;
}

/* ---------- state -> case ---------- */
function buildCase(state, over) {
  const s = Object.assign({}, state), none = s.vent === 'none';
  const ht = HEATERS[s.heater || 'open'];
  const C = {
    N: 34, W: GEO.W, D: GEO.D, H: GEO.H, Tout: 25, Tground: 25, Tset: 90, thermostat: 'plumeCeiling', Pmax: 12000,
    Uwall: U_WALL, Uceil: U_CEIL, Udoor: U_DOOR, door: GEO.door, Ufloor: slabConductance(SLAB_E, 5400, 3600),
    heater: Object.assign({ xc: GEO.heaterXc }, ht),
    bathers: [
      { name: 'upper', feet: 0.45, seat: 0.88, top: 1.80, ankle: GEO.ankleUpper },
      { name: 'lower', feet: 0.00, seat: 0.45, top: 1.38, ankle: GEO.ankleLower },
    ],
    vent: !none,
    inlet: none ? null : { kind: s.inlet, h: GEO.inletH[s.inlet], angle: (s.inlet !== 'bottom' && s.angle === 'up45') ? Math.PI / 4 : 0, d: GEO.dOpen, duct: s.duct === 'inletduct' },
    exhaust: none ? null : { h: GEO.exhaustH[s.exhaust], kind: s.exhaust, duct: (s.duct === 'riser' || s.duct === 'half') ? s.duct : null, d: GEO.dOpen },
    fan: !none && s.fan === 'on', fanQ: 0.020, dry: !none && s.dry === 'open', dryH: GEO.dryH, benchFront: GEO.lowerBenchFront,
  };
  return Object.assign(C, over || {});
}

function interpProfile(zc, T) {
  const n = T.length, z0 = zc[0], dz = zc[1] - zc[0];
  return h => {
    if (h <= z0) return T[0];
    const f = (h - z0) / dz;
    if (f >= n - 1) return T[n - 1];
    const i = Math.floor(f), w = f - i;
    return T[i] * (1 - w) + T[i + 1] * w;
  };
}
const rsRatio = (s, d, re, r0) => Math.max(1, RS * (s / d) * Math.sqrt(re / r0));

/* ---------- stand-in airflow network (agent A owns the real one) ---------- */
function ductT(Tin, Tamb, q, L, D) {
  const m = Math.max(1e-6, rho(Tin) * Math.abs(q)), U = Math.abs(q) / (Math.PI * D * D / 4), Re = U * D / 1.9e-5;
  const Nu = Re > 2300 ? 0.023 * Math.pow(Re, 0.8) * Math.pow(0.7, 0.3) : 3.66;
  const Ud = 1 / (1 / Math.max(Nu * 0.029 / D, 1e-3) + 1 / 5.0), NTU = Ud * Math.PI * D * L / (m * CP);
  const eff = NTU < 1e-6 ? 1 : (1 - Math.exp(-NTU)) / NTU;
  return { mean: Tamb + (Tin - Tamb) * eff, exit: Tamb + (Tin - Tamb) * Math.exp(-NTU) };
}
function standInFlows(C, Tf) {
  const H = C.H, n = 102, dzz = H / n, pr = new Float64Array(n + 1);
  for (let k = 1; k <= n; k++) pr[k] = pr[k - 1] - G * rho(Tf((k - 0.5) * dzz)) * dzz;
  const prAt = h => { const f = Math.min(n, Math.max(0, h / dzz)), k = Math.min(n - 1, Math.floor(f)); return pr[k] + (pr[k + 1] - pr[k]) * (f - k); };
  const ro = rho(C.Tout), poAt = h => -ro * G * h, A125 = Math.PI * 0.125 * 0.125 / 4, Ko = 1 / (CD * CD);
  const ops = [];
  if (C.vent) {
    const inl = C.inlet, ex = C.exhaust;
    if (inl.duct) { const L = inl.h + 0.3; ops.push({ name: 'inlet', h: inl.h, path: 'inDuct', A: A125, K: Ko + 0.04 * L / 0.125 + 1, L }); }
    else ops.push({ name: 'inlet', h: inl.h, path: 'simple', A: A125, K: Ko });
    if (ex.duct) { const top = GEO.ductTop[ex.duct], L = top - ex.h + 0.3; ops.push({ name: 'exhaust', h: ex.h, path: 'exDuct', top, A: A125, K: Ko + 0.04 * L / 0.125 + 1, L, fan: C.fan }); }
    else ops.push({ name: 'exhaust', h: ex.h, path: 'simple', A: A125, K: Ko, fan: C.fan });
    if (C.dry) ops.push({ name: 'dry', h: C.dryH, path: 'simple', A: A125, K: Ko });
  }
  if (C.door) {
    ops.push({ name: 'doorLow', h: C.door.h0 / 2, path: 'simple', A: C.door.w * C.door.gapLow, K: Ko });
    ops.push({ name: 'doorTop', h: C.door.h1 + C.door.gapTop / 2, path: 'simple', A: C.door.w * C.door.gapTop, K: Ko });
  }
  for (const o of ops) { o.Tr = Tf(o.h); o.rr = rho(o.Tr); o.pr = prAt(o.h); o.Tc = o.path === 'exDuct' ? o.Tr : C.Tout; }
  const flowOf = (o, p0) => {
    if (o.fan) return -o.rr * C.fanQ;
    let dp;
    if (o.path === 'simple') dp = poAt(o.h) - (p0 + o.pr);
    else if (o.path === 'exDuct') dp = poAt(o.top) + rho(o.Tc) * G * (o.top - o.h) - (p0 + o.pr);
    else dp = poAt(0) - rho(o.Tc) * G * o.h - (p0 + o.pr);
    const rup = dp > 0 ? ro : o.rr;
    return Math.sign(dp) * rup * o.A * Math.sqrt(2 * Math.abs(dp) / (rup * o.K));
  };
  let p0 = 0;
  for (let pass = 0; pass < 3; pass++) {
    let lo = -60, hi = 60;
    for (let k = 0; k < 50; k++) { const mid = 0.5 * (lo + hi); let s = 0; for (const o of ops) s += flowOf(o, mid); if (s > 0) lo = mid; else hi = mid; }
    p0 = 0.5 * (lo + hi);
    for (const o of ops) {   // update the duct columns with the flow found
      const m = flowOf(o, p0), q = m / (m > 0 ? ro : o.rr);
      if (o.path === 'exDuct') o.Tc = q < 0 ? ductT(o.Tr, C.Tout, q, o.L, 0.125).mean : C.Tout;
      if (o.path === 'inDuct') o.Tc = q > 0 ? ductT(C.Tout, Tf(o.h / 2), q, o.L, 0.125).mean : o.Tr;
    }
  }
  const res = ops.map(o => { const m = flowOf(o, p0); return { name: o.name, h: o.h, q: m / (m > 0 ? ro : o.rr) }; });
  const get = nm => { const r = res.find(o => o.name === nm); return r ? r.q : 0; };
  const inl = res.find(r => r.name === 'inlet'), exh = res.find(r => r.name === 'exhaust');
  return {
    openings: res, qOutdoorIn: res.filter(r => r.q > 0).reduce((s, r) => s + r.q, 0), qOutdoorOut: -res.filter(r => r.q < 0).reduce((s, r) => s + r.q, 0),
    mainInletQ: get('inlet'), mainExhaustQ: get('exhaust'), dryQ: get('dry'), doorLowQ: get('doorLow'), doorTopQ: get('doorTop'),
    neutralPlaneH: null, reversed: !!(inl && exh && (inl.q < 0 || exh.q > 0)), standIn: true,
    notes: ['STAND-IN by agent D: plain Cd 0.61 orifices, fan fixed at 20 l/s, bare ducts with a fixed outside h of 5 W/m2K; agent A replaces this'],
  };
}

/* convective adjustment: warm air under cooler air overturns at once; pool adjacent violators into
   enthalpy-conserving means until the column is stable (the standard step of 1-D column models) */
function convectiveAdjust(T, val, wt, len) {
  const n = T.length;
  let top = -1;
  for (let i = 0; i < n; i++) {
    top++; val[top] = T[i]; wt[top] = 1; len[top] = 1;
    while (top > 0 && val[top - 1] > val[top]) {
      const w = wt[top - 1] + wt[top]; val[top - 1] = (val[top - 1] * wt[top - 1] + val[top] * wt[top]) / w; wt[top - 1] = w; len[top - 1] += len[top]; top--;
    }
  }
  let i = 0; for (let k = 0; k <= top; k++) for (let j = 0; j < len[k]; j++) T[i++] = val[k];
}

/* ---------- the room solver ---------- */
function solveRoom(C, flows, warm) {
  const Tout = C.Tout, Tground = C.Tground, Ufloor = C.Ufloor, Tset = C.Tset, RELAX2 = C.relax2 || 1;
  const N = C.N, H = C.H, rg = radGeometry(C.W, C.D, H, N), dz = rg.dz, Af = rg.Af, Ac = Af;
  const zc = new Float64Array(N); for (let i = 0; i < N; i++) zc[i] = (i + 0.5) * dz;
  const layerOf = h => Math.min(N - 1, Math.max(0, Math.floor(h / dz)));
  const ht = C.heater;

  /* surfaces by band */
  const Aw = new Float64Array(N), Ad = new Float64Array(N), Abd = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const b0 = i * dz, b1 = b0 + dz, ov = C.door ? Math.max(0, Math.min(b1, C.door.h1) - Math.max(b0, C.door.h0)) : 0;
    Ad[i] = C.door ? C.door.w * ov : 0; Aw[i] = rg.per * dz - Ad[i]; Abd[i] = rg.per * dz;
  }
  const Uw = 1 / (1 / C.Uwall - 0.13), Ud = C.door ? 1 / (1 / C.Udoor - 0.13) : 0, Uc = 1 / (1 / C.Uceil - 0.10);
  /* bathers' skin area by height (rule of nines: feet and lower legs 17 %, thighs 20 % in 0.1 m above the seat, the rest above) */
  const Ab = new Float64Array(N);
  for (const b of C.bathers || []) for (const [z0, z1, f] of [[b.feet, b.seat, 0.17], [b.seat, b.seat + 0.10, 0.20], [b.seat + 0.10, b.top, 0.63]])
    for (let i = 0; i < N; i++) { const ov = Math.max(0, Math.min((i + 1) * dz, z1) - Math.max(i * dz, z0)); if (ov > 0) Ab[i] += AD * f * ov / (z1 - z0); }
  let AbTot = 0; for (let i = 0; i < N; i++) AbTot += Ab[i];
  const ArTot = AbTot * AR_AD, Asurf = rg.per * H + 2 * Af;

  /* heater radiation: share to the bathers by area, the rest by the view of a wall band at the heater's height,
     of a plane at the heater top looking up, and (wall heater) of a plane at its bottom looking down */
  const wS = new Float64Array(N + 2), wT = new Float64Array(N + 2), wB = new Float64Array(N + 2);
  {
    let s = 0;
    for (let i = 0; i < N; i++) { wS[i] = rg.Xseg(ht.zb, ht.zt, i * dz, (i + 1) * dz); s += wS[i]; }
    wS[N] = Af * (rg.fp(ht.zb) - rg.fp(ht.zt)); wS[N + 1] = Af * (rg.fp(H - ht.zt) - rg.fp(H - ht.zb)); s += wS[N] + wS[N + 1];
    for (let k = 0; k < N + 2; k++) wS[k] /= s;
    s = 0;
    for (let i = 0; i < N; i++) { const a = Math.max(i * dz, ht.zt), b = (i + 1) * dz; wT[i] = b > a ? Af * (rg.fp(a - ht.zt) - rg.fp(b - ht.zt)) : 0; s += wT[i]; }
    wT[N + 1] = Af * rg.fp(H - ht.zt); s += wT[N + 1];
    for (let k = 0; k < N + 2; k++) wT[k] /= s;
    s = 0;
    for (let i = 0; i < N; i++) { const a = i * dz, b = Math.min((i + 1) * dz, ht.zb); wB[i] = b > a ? Af * (rg.fp(ht.zb - b) - rg.fp(ht.zb - a)) : 0; s += wB[i]; }
    wB[N] = Af * rg.fp(ht.zb); s += wB[N];
    for (let k = 0; k < N + 2; k++) wB[k] = s > 0 ? wB[k] / s : 0;
  }
  /* open stones: each band of the bed's sides radiates by its own view (its stones are cooler at the bottom, facing the floor) */
  const wSb = [];
  if (ht.bed) for (let j = 0; j < BED_BANDS; j++) {
    const a0 = ht.zb + (ht.zt - ht.zb) * j / BED_BANDS, a1 = ht.zb + (ht.zt - ht.zb) * (j + 1) / BED_BANDS, w = new Float64Array(N + 2);
    let s = 0;
    for (let i = 0; i < N; i++) { w[i] = rg.Xseg(a0, a1, i * dz, (i + 1) * dz); s += w[i]; }
    w[N] = Af * (rg.fp(a0) - rg.fp(a1)); w[N + 1] = Af * (rg.fp(H - a1) - rg.fp(H - a0)); s += w[N] + w[N + 1];
    for (let k = 0; k < N + 2; k++) w[k] /= s;
    wSb.push(w);
  }
  const shB = ArTot / (ArTot + Asurf);

  /* state */
  const T = new Float64Array(N);
  if (warm && warm.T && warm.T.length === N) T.set(warm.T); else for (let i = 0; i < N; i++) T[i] = 40 + 50 * zc[i] / H;
  const Tsw = new Float64Array(N), Tsd = new Float64Array(N), Tb = new Float64Array(N);
  if (warm && warm.Tsw && warm.Tsw.length === N) { Tsw.set(warm.Tsw); Tsd.set(warm.Tsd); }
  else for (let i = 0; i < N; i++) { Tsw[i] = T[i] - 3; Tsd[i] = T[i] - 15; }
  let Tsf = warm && warm.Tsf ? warm.Tsf : 35, Tsc = warm && warm.Tsc ? warm.Tsc : T[N - 1] - 2;
  let P = warm && warm.P ? warm.P : 3500, lastQth = warm && warm.Qth ? warm.Qth : 0, Trs = 60;

  /* openings */
  const fl = flows || {}, opens = [];
  const add = (name, h, q, role) => { if (q && Math.abs(q) > 1e-7) opens.push({ name, h, q, role }); };
  if (C.vent) { add('inlet', C.inlet.h, fl.mainInletQ || 0, 'inlet'); add('exhaust', C.exhaust.h, fl.mainExhaustQ || 0, 'exhaust'); if (C.dry) add('dry', C.dryH, fl.dryQ || 0, 'dry'); }
  if (C.door) { add('doorLow', C.door.h0 / 2, fl.doorLowQ || 0, 'doorLow'); add('doorTop', C.door.h1 + C.door.gapTop / 2, fl.doorTopQ || 0, 'doorTop'); }

  const pl = { M: new Float64Array(N), e: new Float64Array(N), w: new Float64Array(N), b: new Float64Array(N), Tp: new Float64Array(N), elin: new Float64Array(N), m: new Float64Array(N), reach: 0, Ttop: null, mTop: 0 };
  const capt = { frac: 0, how: '' };
  const ins = new Float64Array(N), insH = new Float64Array(N), rem = new Float64Array(N), F = new Float64Array(N + 1);
  const insP = new Float64Array(N), insHP = new Float64Array(N), remP = new Float64Array(N);
  const insertAt = (z, m, Hm) => {
    const f = Math.min(N - 1, Math.max(0, z / dz - 0.5)), i = Math.min(N - 2, Math.floor(f)), w = f - i;
    ins[i] += m * (1 - w); insH[i] += Hm * (1 - w); ins[i + 1] += m * w; insH[i + 1] += Hm * w;
  };
  const qW = new Float64Array(N);
  const aW = new Float64Array(N), bW = new Float64Array(N), aD = new Float64Array(N), bD = new Float64Array(N);
  const diag = new Float64Array(N), lowC = new Float64Array(N), upC = new Float64Array(N), rhs = new Float64Array(N), cpv = new Float64Array(N), dpv = new Float64Array(N);
  const hr = 4 * EPS * SIGMA * Math.pow(60 + TK, 3);
  const hW = new Float64Array(N), hD = new Float64Array(N), hB = new Float64Array(N);
  const wkV = new Float64Array(N), wkW = new Float64Array(N), wkL = new Int32Array(N);
  const XB = rg.XB, XF = rg.XF, XC = rg.XC, XFC = rg.XFC;
  let rowS = rg.rowS;
  if (!rowS) { rowS = new Float64Array(N); for (let i = 0; i < N; i++) { let x = rg.XF[i] + rg.XC[i]; for (let k = 0; k < N; k++) if (k !== i) x += rg.XB[i * N + k]; rowS[i] = x; } rg.rowS = rowS; }
  let streams = [], budget = null, prevSens = null;
  const NAVG = 10, avgT = new Float64Array(N), avgSw = new Float64Array(N), avgSd = new Float64Array(N); let avgF = 0, avgC = 0, avgP = 0, avgS = 0;
  const ITERMAX = C.iters || C.itermax || (warm ? 40 : 70), NSWEEP = C.sweeps || 2, TOL = C.tol || 0.05;
  let ITER = ITERMAX, calm = 0, endSet = false;
  const Tprev = new Float64Array(N);

  const CASRAD = C.casingRad !== false;
  const WALLBL = C.wallBL !== false, BODYBL = C.bodyBL !== false, BLSTOP = C.blStop !== false;
  const qBLw = new Float64Array(N), dBLw = new Float64Array(N), qBLb = new Float64Array(N), dBLb = new Float64Array(N);
  const blStats = { up: 0, down: 0 }; if (C.blTrace) C.blStats = blStats;
  const neutralZ = (iFrom, Tx, dir) => {   // height where the room temperature equals Tx, searching from layer iFrom in direction dir
    if (dir > 0) { for (let k = iFrom + 1; k < N; k++) if (T[k] >= Tx) { const w = T[k] > T[k - 1] ? (Tx - T[k - 1]) / (T[k] - T[k - 1]) : 1; return zc[k - 1] + dz * Math.min(1, Math.max(0, w)); } return zc[N - 1]; }
    for (let k = iFrom - 1; k >= 0; k--) if (T[k] <= Tx) { const w = T[k + 1] > T[k] ? (T[k + 1] - Tx) / (T[k + 1] - T[k]) : 1; return zc[k + 1] - dz * Math.min(1, Math.max(0, w)); } return zc[0];
  };
  const blColumn = (dT, q, area) => {   // dT: surface minus air per layer; q: convective heat per layer (W); area per layer (m2)
    for (const dir of [1, -1]) {
      const start = dir > 0 ? 0 : N - 1;
      for (let i = start; i >= 0 && i < N; i += dir) {
        const on = dir > 0 ? dT[i] > 0 : dT[i] < 0;
        const prevOn = (i - dir >= 0 && i - dir < N) ? (dir > 0 ? dT[i - dir] > 0 : dT[i - dir] < 0) && area[i - dir] > 0 : false;
        if (!on || area[i] <= 0 || prevOn) continue;
        let m = 0, H = 0, Qprev = 0, sA = 0, sdA = 0, j = i, last = i;
        for (; j >= 0 && j < N; j += dir) {
          const onj = dir > 0 ? dT[j] > 0 : dT[j] < 0;
          if (!onj || area[j] <= 0) break;
          sA += area[j]; sdA += area[j] * Math.abs(dT[j]);
          const x = (Math.abs(j - i) + 1) * dz, per = sA / x, Qt = blFlux(x, sdA / sA, T[j]) * per;
          const dm = rho(T[j]) * Math.max(0, Qt - Qprev); Qprev = Math.max(Qprev, Qt);
          rem[j] += dm; m += dm; H += dm * CP * T[j] + q[j]; last = j;
          if (BLSTOP && m > 0 && (H / (m * CP) - T[j]) * dir <= 0) {   // no longer buoyant against the local air: it leaves the wall here
            const Tb2 = H / (m * CP); insertAt(neutralZ(j, Tb2, -dir), m, H); m = 0; H = 0; Qprev = 0; sA = 0; sdA = 0; i = j;   // a new boundary layer starts above (below) this point
          }
        }
        if (m <= 0) continue;
        const Tbl = H / (m * CP);
        insertAt(neutralZ(last, Tbl, (Tbl - T[last]) * dir >= 0 ? dir : -dir), m, H);
        if (dir > 0) blStats.up += m; else blStats.down += m;
        i = last;
      }
    }
  };
  const plumeAdds = [], jets = [], applied = new Uint8Array(64), ib = layerOf(ht.zb), itop = layerOf(ht.zt), Hsrc = Math.max(1e-3, ht.zt - ht.zb);
  let mP = 0, Hp = 0, M2 = 0, Tp = 0, Qv = 0, qlin = 0, riseStopped = false, ThLast = 300, bedQc = 0, bedV = 0;
  const applyAdds = (i, forcedToo) => {
    for (let q = 0; q < plumeAdds.length; q++) {
      const a = plumeAdds[q];
      if (applied[q] || !(a.i <= i) || (a.forced && !forcedToo)) continue;
      applied[q] = 1;
      if (a.take) { const fr = Math.max(0.02, (mP + a.m) / mP); mP *= fr; Hp *= fr; M2 *= fr * fr; }
      else { const M = Math.sqrt(Math.max(0, M2)) + a.M; mP += a.m; Hp += a.m * CP * a.T; M2 = M * M; }
    }
  };
  const rise = (iFrom, zFrom, zEnd) => {   // integrate up to zEnd; returns the last layer reached, sets riseStopped
    let reach = iFrom; riseStopped = false;
    for (let i = iFrom; i < N; i++) {
      if (i * dz >= zEnd - 1e-9) break;
      applyAdds(i, false);
      const z0 = Math.max(i * dz, zFrom), z1 = Math.min((i + 1) * dz, zEnd), hs = (z1 - z0) / 3, Te = T[i], re = rho(Te);
      for (let k = 0; k < 3; k++) {
        const za = z0 + k * hs, zb2 = za + hs;
        const dm = re * 2 * SQRTPI * ALPHA * Math.sqrt(Math.sqrt(M2)) * hs;
        const src = (za < ht.zt && zb2 > ht.zb) ? qlin * (Math.min(zb2, ht.zt) - Math.max(za, ht.zb)) : 0;
        Hp += dm * CP * Te + src; mP += dm; pl.e[i] += dm;
        Tp = Hp / (mP * CP); Qv = mP / rho(Tp);
        M2 += 2 * G * (Tp - Te) / (Te + TK) * Qv * Qv * hs;
        if (M2 <= 0) { riseStopped = true; return i; }
      }
      Tp = Hp / (mP * CP); Qv = mP / rho(Tp);
      const M = Math.sqrt(M2);
      pl.Tp[i] = Tp; pl.M[i] = M; pl.w[i] = M / Qv; pl.b[i] = Qv / Math.sqrt(Math.PI * M); pl.elin[i] = pl.e[i] / re / dz; pl.m[i] = mP;
      reach = i;
    }
    return reach;
  };
  const detrain = (reach, stopped) => {
    Tp = Hp / (mP * CP);
    let zdet = zc[reach];
    if (stopped) {   // neutral height: where the room temperature equals the plume's, interpolated between layer centres
      zdet = zc[0];
      for (let j = reach; j >= 1; j--) if (T[j - 1] <= Tp) { zdet = T[j] > T[j - 1] ? zc[j - 1] + dz * Math.min(1, (Tp - T[j - 1]) / (T[j] - T[j - 1])) : zc[j - 1]; break; }
      if (T[reach] <= Tp) zdet = zc[reach];
    }
    insertAt(zdet, mP, mP * CP * Tp);
  };
  for (let it = 0; it < ITER; it++) {
    const relax = it < 8 ? (C.relax0 || 0.6) : (C.relax1 || 0.7), last = it === ITER - 1;
    Tprev.set(T);
    const Tf = interpProfile(zc, T);
    for (let i = 0; i < N; i++) Tb[i] = (Aw[i] * Tsw[i] + Ad[i] * Tsd[i]) / Abd[i];
    let num = Af * (Tsf + Tsc); for (let i = 0; i < N; i++) num += Abd[i] * Tb[i];
    Trs = num / Asurf;   // area-weighted mean surface temperature, used only for the bathers and the heater

    /* heater envelope */
    const Tr4 = Math.pow(Trs + TK, 4);
    let Th, Prad, PradS, PradT, PradBo, PradSb = null;
    if (ht.casing) {   // cool casing: only the stones on top radiate; the rest leaves as hot air through the top
      Th = T_STONE;
      const r4 = t => (t + TK) * (t + TK) * (t + TK) * (t + TK);
      const pT = Math.max(0, ht.Atop * EPS * SIGMA * (r4(Th) - Tr4)), pS = CASRAD ? Math.max(0, ht.Aside * EPS * SIGMA * (r4(T_CASING) - Tr4)) : 0;
      const pB = CASRAD ? Math.max(0, (ht.Abot || 0) * EPS * SIGMA * (r4(T_CASING_BOT) - Tr4)) : 0;
      const sc = Math.min(1, 0.9 * P / Math.max(1e-9, pT + pS + pB));   // the measured surfaces radiate; never more than 90 % of the output
      Prad = (pT + pS + pB) * sc; PradT = pT * sc * (1 - shB); PradS = pS * sc * (1 - shB); PradBo = pB * sc * (1 - shB);
    } else {           // open stones: a stone bed (breathing.js's bedSplit). Room air is drawn in through the stones, the outer stones
                       // run from the local air at the bottom to the outlet air at the top and radiate, the rest leaves with the air at the top
      const Tah = Tf(0.5 * (ht.zb + ht.zt)), bs = bedSplit(P, Tah, Trs, ht.Aside, ht.Atop, bedQc), aB = ht.Aside / BED_BANDS;
      bedQc = bs.Qc; bedV = bs.V; Th = bs.Ttop; ThLast = Th; Prad = P - bs.Qc;
      const r4 = t => (t + TK) * (t + TK) * (t + TK) * (t + TK);
      const pB = bs.bands.map(t => EPS_STONE * SIGMA * aB * Math.max(0, r4(t) - Tr4)), pT = EPS_STONE * SIGMA * ht.Atop * Math.max(0, r4(bs.Ttop) - Tr4);
      const sum = pT + pB.reduce((a, b) => a + b, 0), sc = sum > 0 ? Prad / sum : 0;   // the bands share exactly what the bed did not give its air
      PradSb = pB.map(p => p * sc * (1 - shB)); PradS = PradSb.reduce((a, b) => a + b, 0); PradT = pT * sc * (1 - shB); PradBo = 0;
    }
    let Pcas = 0;
    if (ht.casing) for (let i = 0; i < N; i++) {   // the warm casing (T_CASING) heats the air beside it: a wall-plume source along its height
      const ov = Math.max(0, Math.min((i + 1) * dz, ht.zt) - Math.max(i * dz, ht.zb)), dT = T_CASING - T[i];
      if (ov > 0 && dT > 0) Pcas += 1.42 * Math.pow(dT / Math.max(0.1, ht.zt - ht.zb), 0.25) * dT * ht.Aside * ov / (ht.zt - ht.zb);
    }
    const Pconv = P - Prad, Pth = ht.casing ? Math.max(0, Pconv - Pcas) : (ht.bed ? Math.max(0, Pconv) : 0), PradB = Prad * shB;
    const sideTo = k => { if (!PradSb) return PradS * wS[k]; let q = 0; for (let j = 0; j < PradSb.length; j++) q += PradSb[j] * wSb[j][k]; return q; };
    for (let i = 0; i < N; i++) qW[i] = (sideTo(i) + PradT * wT[i] + PradBo * wB[i]) / Abd[i];
    const qF = (sideTo(N) + PradBo * wB[N]) / Af, qC = (sideTo(N + 1) + PradT * wT[N + 1]) / Ac;

    /* inflows: capture, or jets */
    ins.fill(0); insH.fill(0); rem.fill(0);
    plumeAdds.length = 0; jets.length = 0;
    let mIn = 0, mOut = 0;
    for (const o of opens) {
      if (o.q > 0) {
        let Tin = Tout;
        if (o.role === 'inlet' && C.inlet.duct) Tin = ductT(Tout, Tf(C.inlet.h / 2), o.q, C.inlet.h + 0.3, 0.125).exit;
        o._T = Tin; o._m = rho(Tin) * o.q; mIn += o._m;
      } else { o._m = rho(Tf(o.h)) * (-o.q); mOut += o._m; }
    }
    const scale = mOut > 0 ? mIn / mOut : 0;
    for (const o of opens) if (o.q < 0) rem[layerOf(o.h)] += o._m * scale;
    capt.frac = 0; capt.how = '';
    for (const o of opens) {
      if (!(o.q > 0)) continue;
      const m = o._m, Tin = o._T, i0 = layerOf(o.h);
      if (o.role === 'inlet') {
        const inl = C.inlet, d = inl.d * Math.sqrt(CD), U0 = o.q / (CD * Math.PI * inl.d * inl.d / 4);
        const Uh = U0 * Math.cos(inl.angle), Uv = U0 * Math.sin(inl.angle), r0 = rho(Tin);
        if (inl.kind === 'above' || inl.kind === 'high') {
          const Mp = pl.M[i0], b = pl.b[i0], Mj = o.q * U0;
          if (Mp > 0 && b > 0) {   // momentum conservation: the merged flow goes where the summed momentum flux points
            const up = Mp + Mj * Math.sin(inl.angle), across = Mj * Math.cos(inl.angle);
            if (up >= across) { plumeAdds.push({ i: i0, m, T: Tin, M: Mj * Math.sin(inl.angle) }); capt.frac = 1; capt.how = 'merged into the plume (plume momentum ' + (up / across).toFixed(2) + ' x the jet across)'; continue; }
            const fInt = Math.min(1, d / (2 * b)), mx = fInt * pl.m[i0];   // the plume fluid in the jet's path goes with it
            plumeAdds.push({ i: i0, m: -mx, T: pl.Tp[i0], M: 0, take: true });
            const Tx = (m * Tin + mx * pl.Tp[i0]) / (m + mx);
            capt.how = 'pierces the plume (jet momentum ' + (across / up).toFixed(2) + ' x the plume), takes ' + (100 * fInt).toFixed(0) + ' % of it, ' + Tx.toFixed(0) + ' degC';
            jets.push({ role: 'inlet', h: inl.h, m: m + mx, T: Tx, U0, d, x0: ht.xc + b, dir: 1, attach: null, jetDone: ht.xc + b, Q0: o.q });
          } else { jets.push({ role: 'inlet', h: inl.h, m, T: Tin, U0, d, x0: 0, dir: 1, Q0: o.q }); capt.how = 'no plume at the inlet height'; }
          continue;
        }
        if (inl.kind === 'middle' || inl.kind === 'below') {
          const aimed = inl.kind === 'middle', sH = Math.max(0.05, ht.xc - ht.halfW);
          const Uat = Math.max(1e-6, Math.min(Uh, BU * Uh * d / sH)), wj = 2 * (JHW * sH + d / 2), el = pl.elin[i0];
          let chi = 0;
          if (pl.w[i0] > 0) chi = aimed ? Math.min(1, el / (Uat * wj)) : Math.min(1, Math.max(0, el / (2 * Uat) - ht.halfW) / wj);
          if (chi > 0) plumeAdds.push({ i: i0, m: m * chi, T: Tin, M: 0 });
          capt.frac = chi; capt.how = (aimed ? 'jet aimed at the heater' : 'jet passing beside the heater') + ', captured ' + (100 * chi).toFixed(0) + ' % (line sink capture width)';
          if (chi < 1) {
            let hRel = inl.h;
            if (Uv > 0) { const Fb = G * Math.max(1e-6, (Tf(inl.h) - Tin) / (Tf(inl.h) + TK)) * o.q; hRel = Math.min(H - dz, inl.h + FOUNT * Math.pow(o.q * Uv, 0.75) / Math.sqrt(Fb)); }
            jets.push({ role: 'inlet', h: hRel, m: m * (1 - chi), T: Tin, U0, d, x0: aimed ? sH : 0, dir: 1, attach: (!aimed && Uv === 0) ? 'floor' : null, impinged: aimed, Q0: o.q * (1 - chi) });
          }
          continue;
        }
        if (inl.kind === 'bottom') {
          let chi = 1;
          if (ht.zb > 0.1) {
            const Fb = G * Math.max(1e-6, (Tf(0.1) - Tin) / (Tf(0.1) + TK)) * o.q, zmax = FOUNT * Math.pow(o.q * U0, 0.75) / Math.sqrt(Fb);
            const draw = lastQth + pl.elin[layerOf(ht.zb + 0.02)] * 0.1;
            chi = zmax >= ht.zb ? Math.min(1, draw / o.q) : 0;
            capt.how = 'floor jet under a wall heater: fountain rises ' + zmax.toFixed(2) + ' m, captured ' + (100 * chi).toFixed(0) + ' %';
          } else capt.how = 'floor inlet straight into the heater base';
          if (chi > 0) plumeAdds.push({ i: layerOf(Math.max(ht.zb, 0.01)), m: m * chi, T: Tin, M: o.q * chi * U0, forced: !!(ht.casing || ht.bed) });
          capt.frac = chi;
          if (chi < 1) jets.push({ role: 'inlet', h: 0.01, m: m * (1 - chi), T: Tin, U0: 0, d, x0: ht.xc, dir: 1, Q0: o.q * (1 - chi), fallen: true });
          continue;
        }
      }
      if (o.role === 'exhaust' || o.role === 'dry') {
        const d = GEO.dOpen * Math.sqrt(CD), U0 = o.q / (CD * Math.PI * GEO.dOpen * GEO.dOpen / 4);
        jets.push({ role: o.role, h: o.h, m, T: Tin, U0, d, x0: C.W, dir: -1, attach: o.role === 'dry' ? 'ceiling' : (o.h < 0.3 ? 'floor' : null), confine: o.role === 'exhaust' && o.h < 0.45 ? C.W - C.benchFront : 0, Q0: o.q });
        continue;
      }
      jets.push({ role: o.role, h: o.h, m, T: Tin, U0: 0, d: 0.01, x0: null, dir: 0, Q0: o.q, lazy: true });
    }

    /* heater plume (MTT top-hat; d(M^2)/dz = 2 g' Q^2). Open stones: the bed's air, drawn in along the stone height, leaves the top.
       Casing: a boundary-layer plume along the warm casing, then the channel air leaving the stones at the top. */
    pl.M.fill(0); pl.e.fill(0); pl.w.fill(0); pl.b.fill(0); pl.Tp.fill(0); pl.elin.fill(0); pl.m.fill(0);
    qlin = ht.casing ? Pcas / Hsrc : (ht.bed ? 0 : Math.max(0, Pconv) / Hsrc); applied.fill(0);
    let qth = 0, mth = 0, Tint = 0;
    if (ht.casing) { Tint = Tf(ht.intakeH); qth = QTH_REF * Math.cbrt(Math.max(1, Pth) * ht.hCasing / (PTH_REF * HTH_REF)); mth = rho(Tint) * qth; rem[layerOf(ht.intakeH)] += mth; }
    else if (ht.bed) {   // the bed draws its air evenly along the stone height; the enthalpy it takes is that of the layers it draws from
      qth = bedV; mth = rho(Tf(0.5 * (ht.zb + ht.zt))) * qth; let hsum = 0;
      for (let i = 0; i < N; i++) { const ov = Math.max(0, Math.min((i + 1) * dz, ht.zt) - Math.max(i * dz, ht.zb)); if (ov > 0) { const dmi = mth * ov / Hsrc; rem[i] += dmi; hsum += dmi * T[i]; } }
      Tint = mth > 0 ? hsum / mth : Tf(0.5 * (ht.zb + ht.zt));
    }
    Qv = Math.PI * ht.halfW * ht.halfW * 0.05; M2 = Math.pow(Qv * 0.05, 2); mP = rho(T[ib]) * Qv; Hp = mP * CP * T[ib]; Tp = T[ib];
    pl.e[ib] += mP;
    let fin, finStop;
    if (!ht.casing && !ht.bed) { fin = rise(ib, ht.zb, H + 1); finStop = riseStopped; }
    else {
      rise(ib, ht.zb, ht.zt);   // the boundary layer along the casing (none on a bed) joins the channel air above the stones, stalled or not
      if (ht.bed) for (let i = ib; i <= itop && i < N; i++) {   // the bed is a line sink along the stones: inlet jets beside it are captured by its draw
        const ov = Math.max(0, Math.min((i + 1) * dz, ht.zt) - Math.max(i * dz, ht.zb));
        if (ov > 0) { pl.elin[i] = qth / Hsrc; pl.w[i] = Math.max(pl.w[i], qth / ht.Atop); }
      }
      if (M2 < 0) M2 = 0;
      // the channel air (and anything forced through the casing) leaves the stones at the top
      applyAdds(itop, true);
      mP += mth; Hp += mth * CP * Tint + Pth; Tp = Hp / (mP * CP); Qv = mP / rho(Tp);
      M2 = Math.pow(Math.sqrt(Math.max(0, M2)) + Qv * Qv / ht.Atop, 2);
      fin = rise(itop, ht.zt, H + 1); finStop = riseStopped;
    }
    applyAdds(N, true);
    detrain(fin, finStop);
    for (let i = 0; i < N; i++) rem[i] += pl.e[i];
    lastQth = qth;
    pl.reach = finStop ? zc[fin] : H; pl.Ttop = finStop ? null : Tp; pl.mTop = mP;

    /* inflow jets: jet phase over the momentum length, then a falling MTT plume to the neutral level */
    streams = [];
    for (const j of jets) {
      let m = j.m, Tj = j.T;
      const i = layerOf(j.h), path = last ? [] : null;
      if (!j.lazy && j.U0 > 0 && !j.fallen && !j.impinged) {
        const Te = T[i], M0 = j.Q0 * j.U0, F0 = G * Math.max(1e-6, (Te - Tj) / (Te + TK)) * (m / rho(Tj));
        const lM = Math.pow(M0, 0.75) / Math.sqrt(F0), L = Math.min(lM, j.confine || C.W), att = j.attach ? Math.SQRT1_2 : 1;
        const s0 = j.jetDone || 0, s1 = Math.max(s0, L);
        const me = m * Math.max(0, att * (rsRatio(s1, j.d, rho(Te), rho(Tj)) - rsRatio(Math.max(s0, 1e-6), j.d, rho(Te), rho(Tj))));
        rem[i] += me; Tj = (m * Tj + me * Te) / (m + me); m += me;
        j.xFall = j.x0 + j.dir * (s1 - s0); j.lM = lM;
      } else j.xFall = j.x0;
      let Qj = m / rho(Tj), M2j = Math.pow(Qj * 0.05, 2), Hj = m * CP * Tj, k = i, done = false, zstop = zc[0];
      for (; k >= 0; k--) {
        const Te = T[k], re = rho(Te), hs = dz / 2;
        for (let s = 0; s < 2; s++) {
          const dm = re * 2 * SQRTPI * ALPHA * Math.sqrt(Math.sqrt(M2j)) * hs;
          Hj += dm * CP * Te; m += dm; rem[k] += dm; Tj = Hj / (m * CP); Qj = m / rho(Tj);
          const dM2 = 2 * G * (Te - Tj) / (Te + TK) * Qj * Qj * hs;
          if (M2j + dM2 <= 0) { zstop = (k + 1) * dz - (s + Math.min(1, M2j / Math.max(1e-30, -dM2))) * hs; done = true; break; }
          M2j += dM2;
        }
        if (path) { const M = M2j > 0 ? Math.sqrt(M2j) : 0; path.push({ i: k, T: Tj, w: M / Qj, b: M > 0 ? Qj / Math.sqrt(Math.PI * M) : 0 }); }
        if (done) break;
      }
      insertAt(done ? Math.min(j.h, zstop) : zc[0], m, m * CP * Tj);
      if (last) streams.push(Object.assign({}, j, { path, mArr: m, Tarr: Tj, reachedFloor: k <= 0 }));
    }

    /* natural-convection boundary layers on the walls, the door and the bathers: the surface's convective heat goes
       into a layer of air that runs up (warm surface) or down (cool surface), entrains air from every layer it passes,
       and is inserted where its temperature matches the room (filling-box insertion) */
    if (WALLBL) {
      for (let i = 0; i < N; i++) {
        const hw = hVert(Tsw[i] - T[i]), hd = Ad[i] > 0 ? hVert(Tsd[i] - T[i]) : 0;
        qBLw[i] = hw * Aw[i] * (Tsw[i] - T[i]) + hd * Ad[i] * (Tsd[i] - T[i]);
        dBLw[i] = qBLw[i] / Math.max(1e-9, (hw * Aw[i] + hd * Ad[i]));
        const hb = Ab[i] > 0 ? 2.38 * Math.sqrt(Math.sqrt(Math.max(0.1, Math.abs(T[i] - T_SKIN)))) : 0;
        qBLb[i] = hb * Ab[i] * (T_SKIN - T[i]); dBLb[i] = T_SKIN - T[i];
      }
      blColumn(dBLw, qBLw, Abd);
      if (BODYBL) blColumn(dBLb, qBLb, Ab);
    }

    /* vertical mass fluxes, upward through the bottom face of each layer */
    let resid = 0; for (let i = 0; i < N; i++) resid += ins[i] - rem[i];
    rem[N - 1] += resid;
    const sr = C.srcRelax != null ? C.srcRelax : 0.5;
    if (it > 0 && sr < 1) for (let i = 0; i < N; i++) { ins[i] = sr * ins[i] + (1 - sr) * insP[i]; insH[i] = sr * insH[i] + (1 - sr) * insHP[i]; rem[i] = sr * rem[i] + (1 - sr) * remP[i]; }
    insP.set(ins); insHP.set(insH); remP.set(rem);
    F[0] = 0; for (let i = 0; i < N; i++) F[i + 1] = F[i] + ins[i] - rem[i];
    F[N] = 0;

    const hrb = 4 * EPS_SKIN * SIGMA * AR_AD * Math.pow(0.5 * (Trs + T_SKIN) + TK, 3), gb = hrb * ArTot / Asurf;
    let hcF = 1, hcC = 1;
    const Lh = Af / (2 * (C.W + C.D));
    for (let sw = 0; sw < NSWEEP; sw++) {
      /* surfaces: T_s = a + b * T_air, the other surfaces held at their last values */
      for (let i = 0; i < N; i++) {
        const row = i * N, xs = rowS[i];
        let xt = XF[i] * Tsf + XC[i] * Tsc - XB[row + i] * Tb[i];
        for (let k = 0; k < N; k++) xt += XB[row + k] * Tb[k];
        const g = hr * xs / Abd[i], radIn = hr * xt / Abd[i];
        if (sw === 0 && (it & 1) === 0) { hW[i] = hVert(Tsw[i] - T[i]); hD[i] = Ad[i] > 0 ? hVert(Tsd[i] - T[i]) : 0; }
        const hw = hW[i], hd = hD[i];
        const dW = g + hw + Uw + gb; aW[i] = (qW[i] + radIn + Uw * Tout + gb * T_SKIN) / dW; bW[i] = hw / dW;
        const dD = g + hd + Ud + gb; aD[i] = (qW[i] + radIn + Ud * Tout + gb * T_SKIN) / dD; bD[i] = hd / dD;
      }
      let xsF = XFC, xtF = XFC * Tsc, xsC = XFC, xtC = XFC * Tsf;
      for (let i = 0; i < N; i++) { xsF += XF[i]; xtF += XF[i] * Tb[i]; xsC += XC[i]; xtC += XC[i] * Tb[i]; }
      hcF = Tsf > T[0] ? hHorUnstable(Tsf - T[0]) : hHorStable(Tsf - T[0], Lh); hcC = T[N - 1] > Tsc ? hHorUnstable(T[N - 1] - Tsc) : hHorStable(T[N - 1] - Tsc, Lh);
      const dF = hr * xsF / Af + hcF + Ufloor + gb, aF = (qF + hr * xtF / Af + Ufloor * Tground + gb * T_SKIN) / dF, bF = hcF / dF;
      const dC = hr * xsC / Ac + hcC + Uc + gb, aC = (qC + hr * xtC / Ac + Uc * Tout + gb * T_SKIN) / dC, bC = hcC / dC;

      /* air layers: diag*T_i - lowC*T_{i-1} - upC*T_{i+1} = rhs (upwind advection, Thomas algorithm) */
      for (let i = 0; i < N; i++) {
        let d = CP * ((F[i + 1] > 0 ? F[i + 1] : 0) + (F[i] < 0 ? -F[i] : 0) + rem[i]), r = insH[i];
        lowC[i] = i > 0 && F[i] > 0 ? CP * F[i] : 0; upC[i] = i < N - 1 && F[i + 1] < 0 ? -CP * F[i + 1] : 0;
        if (!WALLBL) { d += hW[i] * Aw[i] * (1 - bW[i]); r += hW[i] * Aw[i] * aW[i]; if (Ad[i] > 0) { d += hD[i] * Ad[i] * (1 - bD[i]); r += hD[i] * Ad[i] * aD[i]; } }
        if (i === 0) { d += hcF * Af * (1 - bF); r += hcF * Af * aF; }
        if (i === N - 1) { d += hcC * Ac * (1 - bC); r += hcC * Ac * aC; }
        if (Ab[i] > 0) { if (sw === 0) hB[i] = 2.38 * Math.sqrt(Math.sqrt(Math.max(0.1, Math.abs(T[i] - T_SKIN)))); if (!(WALLBL && BODYBL)) { d += hB[i] * Ab[i]; r += hB[i] * Ab[i] * T_SKIN; } }
        diag[i] = d; rhs[i] = r;
      }
      cpv[0] = -upC[0] / diag[0]; dpv[0] = rhs[0] / diag[0];
      for (let i = 1; i < N; i++) { const den = diag[i] + lowC[i] * cpv[i - 1]; cpv[i] = -upC[i] / den; dpv[i] = (rhs[i] + lowC[i] * dpv[i - 1]) / den; }
      rhs[N - 1] = dpv[N - 1];
      for (let i = N - 2; i >= 0; i--) rhs[i] = dpv[i] - cpv[i] * rhs[i + 1];
      const rx = sw === 0 ? relax : RELAX2;
      for (let i = 0; i < N; i++) T[i] += rx * (rhs[i] - T[i]);
      convectiveAdjust(T, wkV, wkW, wkL);
      for (let i = 0; i < N; i++) { Tsw[i] = aW[i] + bW[i] * T[i]; Tsd[i] = aD[i] + bD[i] * T[i]; }
      Tsf = aF + bF * T[0]; Tsc = aC + bC * T[N - 1];
      for (let i = 0; i < N; i++) Tb[i] = (Aw[i] * Tsw[i] + Ad[i] * Tsd[i]) / Abd[i];

    }
    /* thermostat */
    const Tsens = C.thermostat === 'plumeCeiling' ? (pl.Ttop != null ? pl.Ttop : T[N - 1]) : Tf(C.thermostatH);
    {   // Newton step on the heater power; the room's temperature excess is near-linear in it, so rescale the field with it
      const Pn = Math.min(C.Pmax, Math.max(200, P * Math.pow((Tset - Tout) / Math.max(1, Tsens - Tout), C.pExp || 0.8)));
      const rr = Pn / P; P = Pn;
      if (C.pScale !== 0 && Math.abs(rr - 1) > 1e-9) {
        for (let i = 0; i < N; i++) {
          T[i] = Tout + (T[i] - Tout) * rr; Tsw[i] = Tout + (Tsw[i] - Tout) * rr; Tsd[i] = Tout + (Tsd[i] - Tout) * rr;
          insHP[i] = insP[i] * CP * Tout + (insHP[i] - insP[i] * CP * Tout) * rr;
        }
        Tsf = Tground + (Tsf - Tground) * rr; Tsc = Tout + (Tsc - Tout) * rr;
      }
    }
    if (!C.iters && !endSet) {   // settled: the profile moves less than TOL per iteration and the sensor holds the set point
      let dmax = 0; for (let i = 0; i < N; i++) dmax = Math.max(dmax, Math.abs(T[i] - Tprev[i]));
      calm = (dmax < TOL && Math.abs(Tsens - Tset) < 0.25) ? calm + 1 : 0;
      if (calm >= 3 || it >= ITERMAX - NAVG - 1) { ITER = it + 1 + NAVG; endSet = true; }   // the averaging window is fixed once, never restarted
    }
    if (it >= ITER - NAVG) {   // a marginal plume can flap between two states: keep the time mean of the last iterations
      for (let i = 0; i < N; i++) { avgT[i] += T[i] / NAVG; avgSw[i] += Tsw[i] / NAVG; avgSd[i] += Tsd[i] / NAVG; }
      avgF += Tsf / NAVG; avgC += Tsc / NAVG; avgP += P / NAVG; avgS += Tsens / NAVG;
    }
    if (C.trace) C.trace.push({ it, Tsens, P, reach: pl.reach, T0: T[0], T5: T[5], Ttop: T[N - 1], capt: capt.how });

    if (last) {
      let Qwall = 0, Qdoor = 0, Qbody = PradB;
      for (let i = 0; i < N; i++) {
        Qwall += Uw * Aw[i] * (Tsw[i] - Tout); Qdoor += Ud * Ad[i] * (Tsd[i] - Tout);
        Qbody += gb * (Aw[i] * (Tsw[i] - T_SKIN) + Ad[i] * (Tsd[i] - T_SKIN));
        if (Ab[i] > 0) Qbody += 2.38 * Math.pow(Math.max(0.1, Math.abs(T[i] - T_SKIN)), 0.25) * Ab[i] * (T[i] - T_SKIN);
      }
      Qbody += gb * (Af * (Tsf - T_SKIN) + Ac * (Tsc - T_SKIN));
      let Qvent = 0; for (const o of opens) if (o.q < 0) Qvent += o._m * scale * CP * (Tf(o.h) - Tout); else Qvent -= o._m * CP * (o._T - Tout);
      budget = { P: avgP, Prad, Pconv, Pth, Th, radShare: Prad / P, Qwall, Qdoor, Qfloor: Ufloor * Af * (avgF - Tground), Qceil: Uc * Ac * (avgC - Tout), Qbody, Qvent, Tsf: avgF, Tsc: avgC, Trs, resid, qth, Tsens: avgS };
    }
  }
  return { C, zc, T: Array.from(avgT), Tsw: Array.from(avgSw), Tsd: Array.from(avgSd), Tsf: avgF, Tsc: avgC, plume: pl, capt, streams, budget, Qth: lastQth, P: avgP, profile: interpProfile(zc, Float64Array.from(avgT)), opens };
}

/* ---------- which stream reaches which ankle ---------- */
function ankleStreams(R) {
  const C = R.C, Tf = R.profile, dz = C.H / C.N, out = {};
  for (const bt of C.bathers) {
    const a = bt.ankle, best = { v: 0, T: Tf(a.h), src: 'room air' };
    const consider = (v, T, src) => { if (v > 0.01 && v > best.v) { best.v = v; best.T = Math.min(Tf(a.h), T); best.src = src; } };
    for (const s of R.streams) {
      if (s.lazy) continue;
      const tag = s.role === 'inlet' ? 'main inlet' : s.role === 'exhaust' ? 'reversed exhaust grille' : s.role === 'dry' ? 'drying vent' : s.role;
      if (s.U0 > 0 && !s.impinged && !s.fallen && s.x0 != null && s.attach !== 'ceiling') {   // the jet itself
        const dist = (a.x - s.x0) * s.dir, travel = Math.min(s.lM != null ? s.lM : C.W, C.W);
        if (dist > 0 && dist <= travel + 0.3 && !(s.attach === 'floor' && a.h > 0.4)) {
          const deq = s.attach === 'floor' ? Math.SQRT2 * s.d : s.d, Um = Math.min(s.U0, BU * s.U0 * deq / dist);
          const hc = s.attach === 'floor' ? 0 : s.h, hw = s.attach === 'floor' ? WJHW * dist + s.d / 2 : JHW * dist + s.d / 2;
          const g = Math.exp(-Math.LN2 * Math.pow((a.h - hc) / hw, 2)), Te = Tf(a.h);
          consider(Um * g, Te - TDEC * (Um / s.U0) * (Te - s.T) * g, tag + ' jet');
        }
      }
      if (s.xFall != null && s.path) for (const p of s.path)   // its falling plume
        if (Math.abs((p.i + 0.5) * dz - a.h) <= dz / 2 && Math.abs(a.x - s.xFall) <= Math.max(p.b, 0.05)) consider(p.w, p.T, tag + ' falling plume');
      if (s.reachedFloor && a.h < 0.4 && s.Tarr < Tf(0.02) - 0.5) {   // a cold gravity current on the floor (not up on a bench)
        const Te = Tf(0.02), gp = G * (Te - s.Tarr) / (Te + TK), q1 = (s.mArr / rho(s.Tarr)) / C.D;
        const U = Math.pow(FR_GC, 2 / 3) * Math.cbrt(gp * q1), h = q1 / U;
        if (a.h <= h) consider(U, s.Tarr, tag + ' floor current');
      }
    }
    out[bt.name] = best;
  }
  return out;
}

/* ---------- comfort ---------- */
const pdVertical = dt => 100 / (1 + Math.exp(5.76 - 0.856 * dt));                     // ISO 7730:2005, vertical air temperature difference
function draughtRate(t, v, tu) {                                                          // ISO 7730:2005, draught rate
  if (t >= 34) return 0;
  const vv = Math.max(0.05, v);
  return Math.min(100, (34 - t) * Math.pow(vv - 0.05, 0.62) * (0.37 * vv * tu + 3.14));
}
/* ASHRAE 55 local discomfort models that take the whole-body thermal sensation TS as an input:
   vertical gradient, ASHRAE 55-2020 Addendum a after Liu et al. (2020, Energy and Buildings 110085):
     PPD_VG = 100 e^z / (1 + e^z) - 34.5 (floored at 0), z = 0.13 (TS - 1.91)^2 + 0.15 G - 1.6, G = head-ankle gradient in K/m
   ankle draft, ASHRAE 55 after Liu et al. (2016/17, Indoor Air 27: 852):
     PPD_AD = 100 e^y / (1 + e^y), y = -2.58 + 3.05 v_ankle - 1.06 TS
   TS = +3 ('hot'), the top of the seven-point scale both models were fitted on: PMV is undefined at sauna air temperatures,
   and a sauna bather's whole-body sensation is at least 'hot'. Both models are extrapolated here: Liu et al. tested gradients
   of 0.4-8.4 K/m on clothed, seated, near-neutral subjects. */
const TS_SAUNA = 3;
function ppdGradient(G, TS) { const z = 0.13 * (TS - 1.91) * (TS - 1.91) + 0.15 * G - 1.6; return Math.max(0, 100 * Math.exp(z) / (1 + Math.exp(z)) - 34.5); }
function ppdAnkleDraft(v, TS) { const y = -2.58 + 3.05 * v - 1.06 * TS; return 100 * Math.exp(y) / (1 + Math.exp(y)); }
function comfortOf(R, an) {
  const Tf = R.profile, res = {}, TS = R.C.TS != null ? R.C.TS : TS_SAUNA;
  let sum = 0, n = 0;
  for (const bt of R.C.bathers) {
    const a = bt.ankle, st = an[bt.name], Thead = Tf(a.mouth), Tank = st.T, dT = Thead - Tank, grad = dT / (a.mouth - a.h);
    const PD = ppdGradient(grad, TS), DR = ppdAnkleDraft(st.v, TS), ok = 1 - DR / 100;   // the gradient is the heat factor's, never counted here
    // version 1 mapping, kept for comparison only: ISO 7730 curves on a heat-flux-scaled difference
    const dTeq = dT * (T_SKIN_OFFICE - T_AIR_OFFICE) / Math.max(5, Thead - T_SKIN), okV1 = (1 - pdVertical(dTeq) / 100) * (1 - draughtRate(Tank, st.v, TU) / 100);
    res[bt.name] = { Thead, Tank, dT, grad, PD, DR, v: st.v, src: st.src, ok, okV1 };
    sum += ok; n++;
  }
  res.feetFactor = n ? sum / n : 1;
  res.feetFactorUpper = res.upper ? res.upper.ok : res.feetFactor;
  res.feetFactorLower = res.lower ? res.lower.ok : res.feetFactor;
  return res;
}

/* ---------- public API ---------- */
const cache = new Map();
function solve(state, flows, over) {
  const k = JSON.stringify(state) + '|' + (flows ? JSON.stringify([flows.mainInletQ, flows.mainExhaustQ, flows.dryQ, flows.doorLowQ, flows.doorTopQ]) : 'standin') + (over ? JSON.stringify(over) : '');
  if (cache.has(k)) return cache.get(k);
  const C = buildCase(state, over);
  let R;
  if (flows) R = solveRoom(C, flows);
  else {   // stand-in: the stack depends on the profile, the profile on the flows
    let Tf = h => 40 + 50 * h / C.H, warm = null, fl = null;
    for (let pass = 0; pass < (C.passes || 2); pass++) {
      fl = standInFlows(C, Tf);
      R = solveRoom(C, fl, warm);
      warm = R; Tf = R.profile;
    }
    R.flows = fl;
  }
  R.an = ankleStreams(R);
  R.comfort = comfortOf(R, R.an);
  if (cache.size > 4000) cache.clear();
  cache.set(k, R);
  return R;
}
function profile(state, flows) { return solve(state, flows).profile; }
function feet(state, flows) {
  const R = solve(state, flows), c = R.comfort, notes = [];
  if (R.capt && R.capt.how) notes.push('inlet: ' + R.capt.how);
  notes.push('upper ankle ' + c.upper.Tank.toFixed(1) + ' degC, ' + c.upper.v.toFixed(2) + ' m/s (' + c.upper.src + ')');
  notes.push('lower ankle ' + c.lower.Tank.toFixed(1) + ' degC, ' + c.lower.v.toFixed(2) + ' m/s (' + c.lower.src + ')');
  notes.push('gradient ' + c.upper.grad.toFixed(1) + '/' + c.lower.grad.toFixed(1) + ' K/m, PPD gradient upper/lower ' + c.upper.PD.toFixed(0) + '/' + c.lower.PD.toFixed(0) + ' %, ankle draft ' + c.upper.DR.toFixed(0) + '/' + c.lower.DR.toFixed(0) + ' % (ASHRAE 55, TS +3)');
  if (!flows) notes.push('flows: agent D stand-in');
  return { ankleT_upper: c.upper.Tank, ankleT_lower: c.lower.Tank, ankleV: Math.max(c.upper.v, c.lower.v), feetFactor: c.feetFactor,
    feetFactor_upper: c.feetFactorUpper, feetFactor_lower: c.feetFactorLower, notes,
    detail: { upper: c.upper, lower: c.lower, budget: R.budget } };
}
function defaultFlows(state) { return solve(state).flows; }

module.exports = { ppdGradient, ppdAnkleDraft, TS_SAUNA, profile, feet, solve, defaultFlows, buildCase, solveRoom, standInFlows, ankleStreams, comfortOf, pdVertical, draughtRate, radGeometry, Fpar, HEATERS, GEO, U_WALL, U_CEIL, U_DOOR, SLAB_E, slabConductance };
