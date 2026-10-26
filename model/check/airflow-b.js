'use strict';
/* Agent B: independent airflow network for the Saunas 101 ventilation lab.
   Formulation: single-zone neutral-pressure-plane (hydrostatic) model, ASHRAE Fundamentals ch. 16 style.
   The room pressure at the floor, p0 (relative to outdoor air at the floor), is the one unknown;
   every opening's driving pressure is S(h) - p0 with S(h) = g * (integral_0^h rho_room dz - rho_out * h).
   Losses: Idelchik loss coefficients (grilles as thin orifices, entries, exits, elbows) and Idelchik/Altshul friction;
   door gaps: Baker, Sharples & Ward (1987) quadratic crack law; fan: Same Sky CFM-A225BG-123-374 curve,
   scaled by the fan laws to 68.6 CFM free air; bare outdoor ducts cool their air (Gnielinski / Hausen inside,
   Churchill-Chu + grey radiation outside). Sources and confidence levels: B_report.md.
   Convention: q and m positive INTO the room. Units SI unless a name says otherwise. */

/* ---------- constants ---------- */
const G = 9.80665;                 // m/s2, standard gravity
const R_AIR = 287.05;              // J/(kg K), dry air
const P_ATM = 101300;              // Pa, shared parameter
const K0 = 273.15;
const CP = 1006;                   // J/(kg K), dry air near 300-370 K
const SIGMA = 5.670374419e-8;      // W/(m2 K4)
const T_OUT = 25;                  // degC, shared parameter

/* ---------- geometry (brief and drawing) ---------- */
const H_CEIL = 2.04;
const ROOM_V = 12;                 // m3
const D_OPEN = 0.125;              // m, every opening and duct
const A_OPEN = Math.PI * D_OPEN * D_OPEN / 4;
const H_INLET = { above: 0.98, middle: 0.45, below: 0.12, bottom: 0 };
const H_GRILLE = { lower: 0.20, upper: 0.64 };
const H_DUCT_TOP = { riser: 2.17, half: 1.18 };
const H_DRY = 1.94;
const H_SENSOR = (300 - 22) * 2.1 / 300;   // 1.946 m, the drawing's sensor (lab.js SENSOR y = 22)
const L_SLEEVE = 0.10;             // m, wall or floor thickness the Ø125 sleeve crosses (assumed; friction only, < 1 % of loss)
const H_IDUCT_MOUTH = D_OPEN / 2;  // the inlet duct's floor-level mouth: a Ø125 penetration resting on the floor
/* door: Harvia-type 7x19 glass door, 8 mm tempered glass; gaps from the brief */
const DOOR_W = 0.70, DOOR_GAP_LOW = 0.010, DOOR_GAP_TOP = 0.002, DOOR_DEPTH = 0.008;
const H_DOOR_LOW = DOOR_GAP_LOW / 2;                    // 0.005 m
const H_DOOR_TOP = DOOR_GAP_LOW + 1.90 + DOOR_GAP_TOP / 2; // 1.911 m
const C_CRACK = 1.5;               // Baker et al. 1987: straight-through crack, entry 0.5 + exit 1.0
/* closed casing heater (floor-standing): 0.29 m wide, 0.67 m tall, stones on top */
const CASING_W = 0.29;             // m; depth taken equal to width (plan square, assumption)
const CASING_A = CASING_W * CASING_W;
const CASING_H = 0.67 + 0.09;      // m, casing plus the stone layer drawn on top (lab.js stones y 192..205)
const STONE_DEPTH = 0.09;          // m, from the drawing
const STONE_D = 0.075;             // m, Harvia manuals: stones 5-10 cm
const STONE_EPS = 0.45;            // void fraction of a random bed of broken stone (typical 0.4-0.5)
const CASING_INTAKE_ZETA = 1.5;    // sharp entry 0.5 + velocity head 1.0 (Idelchik)
const HEATER_W = 12000;            // W rated (shared parameter)
const CONV_FRACTION = 0.75;        // convective share while the elements are on (low confidence, see report)

/* ---------- loss coefficients (Idelchik, Handbook of Hydraulic Resistance, 3rd ed., 1994) ---------- */
const GRILLE_FREE = 65e-4;         // m2, Tecnosystemi G.C.I. Ø125 (11104046), "air passage 65 cm2", datasheet rev. 01 2025-06-20
const F_GR = GRILLE_FREE / A_OPEN; // 0.530
const CONTR = 0.707 * Math.pow(1 - F_GR, 0.375);
/* thin orifice in a duct (Idelchik diagram 4-14, Re >= 1e5): ((1-f) + 0.707(1-f)^0.375)^2 / f^2; written as (1/(eps f) - 1)^2 */
const ZETA_GRILLE_EXIT = Math.pow(1 + CONTR, 2) / (F_GR * F_GR);        // grille at the duct end, jet discharges into a large space: all jet energy lost
const ZETA_GRILLE_ENTRY = Math.pow(1.707 / F_GR - 1, 2);                // grille at the duct entry from a large space (contraction of a free-standing sharp entry, f -> 1 gives 0.50)
const ZETA_SHARP_ENTRY = 0.5;      // flush sharp-edged entry
const ZETA_REENTRANT = 1.0;        // thin-walled projecting pipe end (duct outlet used as an inlet)
const ZETA_EXIT = 1.0;             // free discharge of a duct into a large space
const ZETA_ELBOW = 0.21;           // 90 deg smooth elbow, R/D = 1: A1*B1*C1 = 1.0*0.21*1.0 (Idelchik diagram 6-1)
const ROUGH = 0.15e-3;             // m, galvanised steel duct (Idelchik table 2-5 range 0.10-0.15 mm)
const EPS_OUT = 0.28;              // emissivity, weathered galvanised steel outdoors
const EPS_IN = 0.23;               // emissivity, new galvanised steel indoors

/* ---------- fan: Same Sky CFM-A225BG-123-374 (2,300 rpm, 120x120x25), datasheet rev 1.04, p.3, digitised; CFM, mmH2O ---------- */
const FAN_PTS_RAW = [[0, 4.40], [7.3, 3.95], [17.4, 3.38], [26.3, 2.88], [35.2, 2.30], [44.1, 2.03], [51.6, 1.95], [62.5, 1.45], [71.0, 0.55], [80.17, 0.0]];
const FAN_FREE_CFM = 68.6;         // the site's fan (Ultrar EF12025ML2BP7T0), free air
const FAN_S = FAN_FREE_CFM / 80.17;           // speed ratio by the fan laws, Q ~ n -> 1,968 rpm
const CFM = 0.3048 ** 3 / 60;                 // m3/s per CFM
const MMH2O = 9.80665;                         // Pa per mmH2O
const FAN_Q = FAN_PTS_RAW.map(p => p[0] * FAN_S * CFM);
const FAN_P = FAN_PTS_RAW.map(p => p[1] * FAN_S * FAN_S * MMH2O);
const RHO_FAN_TEST = P_ATM / (R_AIR * (25 + K0));  // datasheet conditions 25 degC

/* ---------- air properties ---------- */
const rhoAir = TC => P_ATM / (R_AIR * (TC + K0));
const muAir = TC => { const T = TC + K0, x = T / 273.15; return 1.716e-5 * x * Math.sqrt(x) * (273.15 + 110.4) / (T + 110.4); };   // Sutherland
const kAir = TC => { const T = TC + K0, x = T / 273.15; return 0.0241 * x * Math.sqrt(x) * (273.15 + 194) / (T + 194); };          // Sutherland form for k
const RHO_OUT = rhoAir(T_OUT);

/* ---------- default room profile: Saari et al. 2002 (Indoor Air 2002, p. 397, fig. 4, sauna B), scaled so the sensor reads 90 degC ---------- */
const SAARI_B = [[0.10, 40], [0.40, 49], [0.70, 66], [1.20, 74], [1.80, 83], [2.10, 84]];
function saariRaw(h) {
  const P = SAARI_B;
  if (h <= P[0][0]) return P[0][1] + (h - P[0][0]) * (P[1][1] - P[0][1]) / (P[1][0] - P[0][0]);
  for (let i = 1; i < P.length; i++) if (h <= P[i][0]) return P[i - 1][1] + (h - P[i - 1][0]) * (P[i][1] - P[i - 1][1]) / (P[i][0] - P[i - 1][0]);
  return P[P.length - 1][1];
}
const PROFILE_K = (90 - T_OUT) / (saariRaw(H_SENSOR) - T_OUT);
function defaultProfile(h) { return T_OUT + PROFILE_K * (saariRaw(Math.min(Math.max(h, 0), H_CEIL)) - T_OUT); }

/* ---------- the room column: I(h) = integral_0^h rho dz ---------- */
const NCOL = 408, DHC = H_CEIL / NCOL;
function buildColumn(profile) {
  const rho = new Float64Array(NCOL + 1), I = new Float64Array(NCOL + 1), T = new Float64Array(NCOL + 1);
  for (let i = 0; i <= NCOL; i++) { T[i] = profile(i * DHC); rho[i] = rhoAir(T[i]); }
  for (let i = 0; i < NCOL; i++) I[i + 1] = I[i] + 0.5 * (rho[i] + rho[i + 1]) * DHC;
  const Iat = h => {
    if (h <= 0) return rho[0] * h;
    if (h >= H_CEIL) return I[NCOL] + rho[NCOL] * (h - H_CEIL);
    const x = h / DHC, i = Math.min(Math.floor(x), NCOL - 1), t = x - i;
    return I[i] + (rho[i] + 0.5 * (rho[i + 1] - rho[i]) * t) * t * DHC;
  };
  const S = h => G * (Iat(h) - RHO_OUT * h);   // outdoor-minus-room pressure at h when p0 = 0
  const Tat = h => profile(Math.min(Math.max(h, 0), H_CEIL));
  return { Iat, S, Tat, rho0: rho[0], rhoTop: rho[NCOL] };
}

/* ---------- friction: Idelchik's transition-region formula (Altshul), laminar 64/Re below the crossing ---------- */
function lambda(Re) {
  const lt = 0.1 * Math.pow(1.46 * ROUGH / D_OPEN + 100 / Re, 0.25);
  const ll = 64 / Re;
  return ll > lt ? ll : lt;
}
/* pressure loss of a run of minor losses (zeta) plus friction length Lf, at density rho and viscosity mu, mass flow mAbs >= 0 */
function runLoss(mAbs, zeta, Lf, rho, mu) {
  if (mAbs <= 0) return 0;
  const v = mAbs / (rho * A_OPEN);
  const Re = rho * v * D_OPEN / mu;
  return (zeta + lambda(Re) * Lf / D_OPEN) * 0.5 * rho * v * v;
}
/* inverse of runLoss: mass flow giving pressure loss dp >= 0 (laminar branch solved as a quadratic, turbulent by fixed point) */
function runFlow(dp, zeta, Lf, rho, mu) {
  if (dp <= 0) return 0;
  // laminar candidate: dp = a m + b m^2
  const a = 32 * mu * Lf / (rho * A_OPEN * D_OPEN * D_OPEN), b = zeta / (2 * rho * A_OPEN * A_OPEN);
  let m = (-a + Math.sqrt(a * a + 4 * b * dp)) / (2 * b);
  const Re0 = 4 * m / (Math.PI * D_OPEN * mu);
  if (64 / Re0 >= 0.1 * Math.pow(1.46 * ROUGH / D_OPEN + 100 / Re0, 0.25)) return m;
  for (let it = 0; it < 6; it++) {
    const Re = 4 * m / (Math.PI * D_OPEN * mu);
    const lam = lambda(Re);
    m = A_OPEN * Math.sqrt(2 * rho * dp / (zeta + lam * Lf / D_OPEN));
  }
  return m;
}

/* ---------- fan curve (static pressure, Pa) at volumetric flow Q (m3/s) through the fan and density rho ---------- */
function fanP(Q, rho) {
  const n = FAN_Q.length;
  let p;
  if (Q <= 0) p = FAN_P[0] + (FAN_P[1] - FAN_P[0]) / (FAN_Q[1] - FAN_Q[0]) * Q;          // backflow: first segment extended
  else if (Q >= FAN_Q[n - 1]) p = FAN_P[n - 1] + (FAN_P[n - 1] - FAN_P[n - 2]) / (FAN_Q[n - 1] - FAN_Q[n - 2]) * (Q - FAN_Q[n - 1]);   // overdriven: last segment extended
  else { let i = 1; while (Q > FAN_Q[i]) i++; p = FAN_P[i - 1] + (FAN_P[i] - FAN_P[i - 1]) * (Q - FAN_Q[i - 1]) / (FAN_Q[i] - FAN_Q[i - 1]); }
  return p * rho / RHO_FAN_TEST;   // fan law: pressure at fixed speed and volume flow scales with density
}

/* ---------- duct heat exchange: overall U (W/m2K) for bulk TbC, surroundings TsC, vertical length L ---------- */
function Ucoef(mAbs, TbC, TsC, L, eps) {
  const mu = muAir(TbC), k = kAir(TbC), Pr = mu * CP / k;
  const Re = 4 * mAbs / (Math.PI * D_OPEN * mu);
  const Lh = Math.max(L, D_OPEN);
  const nuLam = () => { const Gz = (D_OPEN / Lh) * Re * Pr; return 3.66 + 0.0668 * Gz / (1 + 0.04 * Math.pow(Gz, 2 / 3)); };            // Hausen, thermal entry, constant wall T
  const nuTurb = () => { const f = Math.pow(0.790 * Math.log(Re) - 1.64, -2); return (f / 8) * (Re - 1000) * Pr / (1 + 12.7 * Math.sqrt(f / 8) * (Math.pow(Pr, 2 / 3) - 1)); }; // Gnielinski
  let Nu;
  if (Re <= 2300) Nu = nuLam(); else if (Re >= 3000) Nu = nuTurb(); else { const w = (Re - 2300) / 700; Nu = (1 - w) * nuLam() + w * nuTurb(); }
  const hi = Nu * k / D_OPEN;
  let Tw = 0.5 * (TbC + TsC), ho = 5;
  for (let it = 0; it < 4; it++) {
    const Tf = 0.5 * (Tw + TsC), muf = muAir(Tf), kf = kAir(Tf), rhof = rhoAir(Tf);
    const nu = muf / rhof, Prf = muf * CP / kf, alpha = nu / Prf;
    const Ra = G * Math.abs(Tw - TsC) * Lh * Lh * Lh / ((Tf + K0) * nu * alpha);
    const NuO = Math.pow(0.825 + 0.387 * Math.pow(Ra, 1 / 6) / Math.pow(1 + Math.pow(0.492 / Prf, 9 / 16), 8 / 27), 2);   // Churchill-Chu, vertical surface
    const TwK = Tw + K0, TsK = TsC + K0;
    ho = NuO * kf / Lh + eps * SIGMA * (TwK * TwK + TsK * TsK) * (TwK + TsK);
    Tw = (hi * TbC + ho * TsC) / (hi + ho);
  }
  return 1 / (1 / hi + 1 / ho);
}
/* march air of mass flow mAbs entering at TinC along a vertical duct of length L, surroundings Ts(s) (s from the entry end);
   returns outlet temperature and integral of dz/T(K) over the length (exact per segment for constant surroundings) */
function ductMarch(mAbs, TinC, L, TsFn, nSeg, eps) {
  if (L <= 0) return { Tout: TinC, invT: 0, Tmean: TinC };
  const dl = L / nSeg;
  if (mAbs < 1e-12) {   // stagnant: the air takes the surroundings' temperature
    let inv = 0, Tsum = 0; for (let i = 0; i < nSeg; i++) { const Ts = TsFn((i + 0.5) * dl); inv += dl / (Ts + K0); Tsum += Ts; }
    return { Tout: TsFn(L), invT: inv, Tmean: Tsum / nSeg };
  }
  let Tsm = 0; for (let i = 0; i < nSeg; i++) Tsm += TsFn((i + 0.5) * dl); Tsm /= nSeg;
  let U = Ucoef(mAbs, TinC, Tsm, L, eps), res = null;
  for (let pass = 0; pass < 2; pass++) {
    const kk = U * Math.PI * D_OPEN / (mAbs * CP);
    let T = TinC, inv = 0, Tint = 0;
    for (let i = 0; i < nSeg; i++) {
      const Ts = TsFn((i + 0.5) * dl), TsK = Ts + K0, dT = T - Ts, e = Math.exp(-kk * dl);
      inv += (dl + Math.log((TsK + dT * e) / (TsK + dT)) / kk) / TsK;
      Tint += Ts * dl + dT * (1 - e) / kk;
      T = Ts + dT * e;
    }
    res = { Tout: T, invT: inv, Tmean: Tint / L };
    if (pass === 0) U = Ucoef(mAbs, 0.5 * (TinC + T), Tsm, L, eps);
  }
  return res;
}

/* ---------- root finding: Illinois (modified regula falsi) on a bracket with f(a) > 0 > f(b) or the reverse ---------- */
function illinois(f, a, b, fa, fb, tolF, maxIt, tolX) {
  tolX = tolX || 0;
  let side = 0, x = a, fx = fa;
  for (let it = 0; it < maxIt; it++) {
    x = (a * fb - b * fa) / (fb - fa);
    if (!(x > Math.min(a, b) && x < Math.max(a, b))) x = 0.5 * (a + b);
    fx = f(x);
    if (Math.abs(fx) <= tolF || a === b) break;
    if ((fx > 0) === (fb > 0)) { b = x; fb = fx; if (side === -1) fa *= 0.5; side = -1; }
    else { a = x; fa = fx; if (side === 1) fb *= 0.5; side = 1; }
    if (Math.abs(b - a) <= 1e-15 * (1 + Math.abs(x)) || Math.abs(b - a) <= tolX) break;
  }
  return { x, fx };
}
/* bracket a root of a function decreasing at large |x| going from x0 by doubling steps of size s in direction dir */
function bracketFrom(f, x0, f0, dir, s) {
  let x1 = x0 + dir * s, f1 = f(x1), it = 0;
  while ((f1 > 0) === (f0 > 0) && it < 80) { x0 = x1; f0 = f1; s *= 2; x1 = x0 + dir * s; f1 = f(x1); it++; }
  return [x0, f0, x1, f1];
}

/* ---------- paths ---------- */
/* Each path: J(m) = buoyancy + fan - signed loss (Pa); the flow satisfies S(h) - p0 + J(m) = 0, m > 0 into the room. */
function plainPath(name, h, col) {
  // wall or floor sleeve with the grille on the room side
  const Tr = col.Tat(h), rhoR = rhoAir(Tr), muR = muAir(Tr), muO = muAir(T_OUT);
  const zIn = ZETA_SHARP_ENTRY + ZETA_GRILLE_EXIT, zOut = ZETA_GRILLE_ENTRY + ZETA_EXIT;
  return {
    name, h, kind: 'plain',
    flow(dlt) { return dlt >= 0 ? runFlow(dlt, zIn, L_SLEEVE, RHO_OUT, muO) : -runFlow(-dlt, zOut, L_SLEEVE, rhoR, muR); },
    rhoAt(m) { return m >= 0 ? RHO_OUT : rhoR; }
  };
}
function crackPath(name, h, d, col) {
  const Tr = col.Tat(h), rhoR = rhoAir(Tr), muR = muAir(Tr), muO = muAir(T_OUT);
  const flowQ = (dp, rho, mu) => { const A = 12 * mu * DOOR_DEPTH / (DOOR_W * d * d * d), B = rho * C_CRACK / (2 * d * d * DOOR_W * DOOR_W); return (-A + Math.sqrt(A * A + 4 * B * dp)) / (2 * B); };
  return {
    name, h, kind: 'crack',
    flow(dlt) { return dlt >= 0 ? RHO_OUT * flowQ(dlt, RHO_OUT, muO) : -rhoR * flowQ(-dlt, rhoR, muR); },
    rhoAt(m) { return m >= 0 ? RHO_OUT : rhoR; }
  };
}
/* exhaust with optional outdoor duct and optional fan */
function exhaustPath(h, ductTop, fan, col) {
  const Tr = col.Tat(h), rhoR = rhoAir(Tr), muR = muAir(Tr), muO = muAir(T_OUT);
  const Lv = ductTop ? ductTop - h : 0;
  const march = mAbs => ductMarch(mAbs, Tr, Lv, () => T_OUT, 1, EPS_OUT);
  const J = m => {
    if (m < 0) {                       // outflow: room air up the duct
      const mAbs = -m;
      let loss = runLoss(mAbs, ZETA_GRILLE_ENTRY, L_SLEEVE, rhoR, muR), B = 0;
      if (ductTop) {
        const r = march(mAbs), Td = r.Tmean, rhoD = rhoAir(Td), rhoX = rhoAir(r.Tout);
        loss += runLoss(mAbs, ZETA_ELBOW, Lv, rhoD, muAir(Td)) + runLoss(mAbs, ZETA_EXIT, 0, rhoX, muAir(r.Tout));
        B = -G * (RHO_OUT * Lv - P_ATM / R_AIR * r.invT);       // warm column drives outflow (negative = out)
      } else if (!fan) loss += runLoss(mAbs, ZETA_EXIT, 0, rhoR, muR);
      const F = fan ? -fanP(mAbs / rhoR, rhoR) : 0;
      return B + F + loss;              // signed loss is -loss for outflow; J = B + F - (-loss)
    }
    // inflow: outdoor air down the duct (stays at outdoor temperature) or straight through the sleeve
    let loss = ductTop ? runLoss(m, ZETA_REENTRANT + ZETA_ELBOW, Lv, RHO_OUT, muO) : runLoss(m, ZETA_SHARP_ENTRY, 0, RHO_OUT, muO);
    loss += runLoss(m, ZETA_GRILLE_EXIT, L_SLEEVE, RHO_OUT, muO);
    const F = fan ? -fanP(-m / RHO_OUT, RHO_OUT) : 0;
    return F - loss;
  };
  const p = { name: 'exhaust', h, kind: 'exhaust', J, ductTop, fan, Tr,
    rhoAt(m) { return m >= 0 ? RHO_OUT : rhoR; } };
  p.fold = ductTop ? findFold(J) : null;
  p.coldBranch = false;
  p.flow = dlt => solvePathJ(p, dlt);
  return p;
}
/* the outflow branch of a buoyant outdoor duct can fold: J dips below J(0) before rising. Find its minimum on m < 0. */
function findFold(J) {
  const J0 = J(-1e-15);
  let best = { m: -1e-15, J: J0 };
  // geometric scan from 1e-6 to 0.3 kg/s of outflow
  for (let i = 0; i <= 24; i++) {
    const m = -1e-6 * Math.pow(3e5, i / 24), v = J(m);
    if (v < best.J) best = { m, J: v };
  }
  if (best.m === -1e-15) return { m: 0, J: J0, J0 };
  // golden-section refinement around the best scan point
  let a = best.m * Math.pow(3e5, 1 / 24), b = best.m / Math.pow(3e5, 1 / 24);   // a more negative than b
  const gr = (Math.sqrt(5) - 1) / 2;
  let c = b - gr * (b - a), d = a + gr * (b - a), fc = J(c), fd = J(d);
  for (let it = 0; it < 30; it++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = J(c); }
    else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = J(d); }
  }
  const m = 0.5 * (a + b), v = J(m);
  return v < J0 ? { m, J: v, J0 } : { m: 0, J: J0, J0 };
}
/* solve S - p0 + J(m) = 0 for one path, dlt = S - p0; with a fold, take the running (warm, largest-outflow) branch whenever it exists */
function solvePathJ(p, dlt) {
  const g = m => dlt + p.J(m);
  const tol = 1e-12;
  const last = p.lastM;
  const step = x => Math.max(1e-5, 0.05 * Math.abs(x));
  let x;
  if (p.fold && p.fold.m < 0 && dlt + p.fold.J <= 0 && !(p.coldBranch && dlt + p.fold.J0 > 0)) {
    // running branch: the outflow root on (-inf, fold.m]; g(fold.m) <= 0 and g -> +inf as m -> -inf
    const fm = g(p.fold.m);
    if (fm === 0) x = p.fold.m;
    else {
      const x0 = (last != null && last < p.fold.m) ? last : p.fold.m, g0 = x0 === p.fold.m ? fm : g(x0);
      let a, fa, b, fb;
      if (g0 > 0) { a = x0; fa = g0; b = p.fold.m; fb = fm; }
      else [a, fa, b, fb] = bracketFrom(g, x0, g0, -1, x0 === p.fold.m ? Math.max(1e-4, -p.fold.m) : step(x0));
      x = illinois(g, a, b, fa, fb, tol, 200).x;
    }
  } else {
    const coldIn = p.fold && p.fold.m < 0 && p.coldBranch && dlt + p.fold.J0 > 0;
    const x0 = (!coldIn && last != null) ? last : 0, g0 = g(x0);
    if (g0 === 0) x = x0;
    else {
      const dir = g0 > 0 ? 1 : -1;   // g decreasing: positive g means more inflow is needed
      const [a, fa, b, fb] = bracketFrom(g, x0, g0, dir, x0 === 0 ? 1e-3 : step(x0));
      x = illinois(g, a, b, fa, fb, tol, 200).x;
    }
  }
  p.lastM = x;
  return x;
}
/* inlet duct inside the hot room: outdoor air enters at a floor-level wall penetration, rises in a bare duct, discharges through the grille at hIn */
function inletDuctPath(hIn, col, inRoom) {
  const Lv = Math.max(hIn - H_IDUCT_MOUTH, 0);
  const TrIn = col.Tat(hIn), rhoR = rhoAir(TrIn), muR = muAir(TrIn), muO = muAir(T_OUT);
  const surrUp = s => inRoom ? col.Tat(H_IDUCT_MOUTH + s) : T_OUT;      // s measured from the mouth upward
  const surrDown = s => inRoom ? col.Tat(hIn - s) : T_OUT;              // s measured from the top downward
  const NSEG = 6;
  const J = m => {
    if (m >= 0) {   // normal: up the duct into the room
      const r = ductMarch(m, T_OUT, Lv, surrUp, NSEG, EPS_IN);
      const Td = r.Tmean, rhoX = rhoAir(r.Tout);
      const loss = runLoss(m, ZETA_SHARP_ENTRY, L_SLEEVE, RHO_OUT, muO) + runLoss(m, 2 * ZETA_ELBOW, Lv, rhoAir(Td), muAir(Td)) + runLoss(m, ZETA_GRILLE_EXIT, 0, rhoX, muAir(r.Tout));
      const B = G * (RHO_OUT * Lv - P_ATM / R_AIR * r.invT);
      return B - loss;
    }
    const mAbs = -m;   // reversed: room air down the duct and out at the floor
    const r = ductMarch(mAbs, TrIn, Lv, surrDown, NSEG, EPS_IN);
    const Td = r.Tmean, rhoX = rhoAir(r.Tout);
    const loss = runLoss(mAbs, ZETA_GRILLE_ENTRY, 0, rhoR, muR) + runLoss(mAbs, 2 * ZETA_ELBOW, Lv, rhoAir(Td), muAir(Td)) + runLoss(mAbs, ZETA_EXIT, L_SLEEVE, rhoX, muAir(r.Tout));
    const B = G * (RHO_OUT * Lv - P_ATM / R_AIR * r.invT);
    return B + loss;
  };
  const p = { name: 'mainInlet', h: hIn, kind: 'inletDuct', J, fold: null,
    rhoAt(m) { if (m >= 0) { const r = ductMarch(m, T_OUT, Lv, surrUp, NSEG, EPS_IN); return rhoAir(r.Tout); } return rhoR; } };
  p.flow = dlt => solvePathJ(p, dlt);
  return p;
}
/* floor inlet under a closed casing heater: the casing is a node C. Floor opening: outdoors -> C. Base intake: room <-> C.
   Chimney: C -> room at the casing top, driven by the hot column; stones as a packed bed (Ergun). */
function casingFloorPath(col, opts) {
  const floor = plainPath('floor', 0, col);           // its flow(dlt) with dlt = 0 - pC (outdoor minus node at the floor)
  const T0 = col.Tat(0), rho0 = rhoAir(T0);
  const Iroom = col.Iat(CASING_H);
  const Aint = opts.casingIntakeArea != null ? opts.casingIntakeArea : CASING_A;
  const Pconv = opts.heaterConvW != null ? opts.heaterConvW : HEATER_W * CONV_FRACTION;
  const intake = dp => (dp >= 0 ? 1 : -1) * Aint * Math.sqrt(2 * rho0 * Math.abs(dp) / CASING_INTAKE_ZETA);
  const chimney = (drive, Ttop) => {
    const rho = rhoAir(Ttop), mu = muAir(Ttop), e = STONE_EPS;
    const a = STONE_DEPTH * 150 * mu * (1 - e) * (1 - e) / (e * e * e * STONE_D * STONE_D);   // Pa per (m/s)
    const b = STONE_DEPTH * 1.75 * rho * (1 - e) / (e * e * e * STONE_D) + ZETA_EXIT * 0.5 * rho;  // Pa per (m/s)^2
    const u = (-a + Math.sqrt(a * a + 4 * b * Math.abs(drive))) / (2 * b);
    return (drive >= 0 ? 1 : -1) * rho * u * CASING_A;
  };
  let last = null, lastPC = null;
  const nodeSolve = p0 => {
    const resid = pC => {
      const mf = floor.flow(-pC), mi = intake(p0 - pC);
      const inF = Math.max(mf, 0), inI = Math.max(mi, 0);
      const Tmix = (inF + inI) > 0 ? (inF * T_OUT + inI * T0) / (inF + inI) : T0;
      const mEff = Math.max(mf + mi, 1e-9);
      const Ttop = Tmix + Pconv / (mEff * CP);
      const TmK = Tmix + K0, TtK = Ttop + K0;
      const invT = Math.abs(TtK - TmK) < 1e-9 ? CASING_H / TmK : CASING_H * Math.log(TtK / TmK) / (TtK - TmK);   // linear heating over the casing height
      const drive = (pC - p0) + G * (Iroom - P_ATM / R_AIR * invT);
      const mch = chimney(drive, Ttop);
      last = { mf, mi, mch, Tmix, Ttop, pC };
      return mf + mi - mch;
    };
    let r;
    if (lastPC != null) {   // warm start; the residual decreases with pC
      const x0 = lastPC, f0 = resid(x0);
      const [a, fa, b, fb] = bracketFrom(resid, x0, f0, f0 > 0 ? 1 : -1, 1e-3);
      r = illinois(resid, a, b, fa, fb, 1e-14, 300);
    } else {
      const lo = Math.min(p0, 0) - 50, hi = Math.max(p0, 0) + 50;
      r = illinois(resid, lo, hi, resid(lo), resid(hi), 1e-14, 300);
    }
    lastPC = r.x;
    resid(r.x);
    return last;
  };
  return {
    name: 'mainInlet', h: 0, kind: 'casingFloor',
    flow(dlt) { return nodeSolve(-dlt).mf; },      // dlt = S(0) - p0 = -p0
    node(p0) { return nodeSolve(p0); },
    rhoAt(m) { return m >= 0 ? RHO_OUT : rho0; }
  };
}

/* ---------- the network ---------- */
function buildPaths(state, col, opts) {
  const paths = [];
  const none = state.vent === 'none';
  if (!none) {
    const inlet = state.inlet, duct = state.duct;
    if (inlet === 'bottom') {
      paths.push(state.heater === 'closed' ? casingFloorPath(col, opts) : Object.assign(plainPath('mainInlet', 0, col), { name: 'mainInlet' }));
    } else if (duct === 'inletduct') {
      paths.push(inletDuctPath(H_INLET[inlet], col, opts.inletDuctInRoom !== false));
    } else paths.push(plainPath('mainInlet', H_INLET[inlet], col));
    const top = (duct === 'riser' || duct === 'half') ? H_DUCT_TOP[duct] : null;
    paths.push(exhaustPath(H_GRILLE[state.exhaust], top, state.fan === 'on', col));
    if (state.dry === 'open') paths.push(plainPath('dry', H_DRY, col));
  }
  paths.push(crackPath('doorLow', H_DOOR_LOW, DOOR_GAP_LOW, col));
  paths.push(crackPath('doorTop', H_DOOR_TOP, DOOR_GAP_TOP, col));
  for (const p of paths) { p.S = col.S(p.h); if (p.kind === 'exhaust') p.coldBranch = !!opts.coldBranch; }
  return paths;
}

/* one network solve: p0 such that the net mass flow into the room is zero */
function solveNet(paths, coldBranch) {
  for (const p of paths) if (p.kind === 'exhaust') p.coldBranch = coldBranch;
  const flows = new Float64Array(paths.length);
  const R = p0 => { let s = 0; for (let i = 0; i < paths.length; i++) { flows[i] = paths[i].flow(paths[i].S - p0); s += flows[i]; } return s; };
  let a = -2, b = 2, fa = R(a), fb = R(b);
  while (fa <= 0) { b = a; fb = fa; a *= 4; fa = R(a); }
  while (fb >= 0) { a = b; fa = fb; b *= 4; fb = R(b); }
  const p0 = illinois(R, a, b, fa, fb, 1e-14, 400, 1e-11).x;   // a bracket under 1e-11 Pa that has not closed is a branch jump
  const resid = R(p0);
  return { p0, resid, flows: Float64Array.from(flows) };
}

const MASS_TOL = 1e-9;

function summarise(state, paths, sol, col, opts) {
  const { p0, flows } = sol;
  const qOf = {}; let qIn = 0, qOut = 0, mIn = 0, mOut = 0;
  const openings = [];
  paths.forEach((p, i) => {
    const m = flows[i], q = m / p.rhoAt(m);
    qOf[p.name] = q;
    if (m > 0) { qIn += m / RHO_OUT; mIn += m; } else { qOut += -q; mOut += -m; }
    openings.push({ name: p.name, h: p.h, q, m });
  });
  ['mainInlet', 'exhaust', 'dry', 'doorLow', 'doorTop'].forEach(n => { if (!(n in qOf)) { qOf[n] = 0; openings.push({ name: n, h: n === 'dry' ? H_DRY : null, q: 0, m: 0, closed: true }); } });
  let npl;
  const SH = col.S(H_CEIL);
  if (p0 >= 0) npl = p0 / (G * (col.rho0 - RHO_OUT));
  else if (p0 <= SH) npl = H_CEIL + (p0 - SH) / (G * (col.rhoTop - RHO_OUT));
  else { let lo = 0, hi = H_CEIL; for (let it = 0; it < 60; it++) { const mid = 0.5 * (lo + hi); if (col.S(mid) > p0) lo = mid; else hi = mid; } npl = 0.5 * (lo + hi); }
  const TOLQ = 1e-7;
  const revIn = state.vent !== 'none' && qOf.mainInlet < -TOLQ, revEx = state.vent !== 'none' && qOf.exhaust > TOLQ;
  const notes = [];
  if (revIn) notes.push('main inlet reversed: room air leaves through it');
  if (revEx) notes.push('exhaust reversed: outdoor air enters through it');
  const r = {
    openings,
    qOutdoorIn: qIn, qOutdoorOut: qOut,
    mainInletQ: qOf.mainInlet, mainExhaustQ: qOf.exhaust, dryQ: qOf.dry, doorLowQ: qOf.doorLow, doorTopQ: qOf.doorTop,
    neutralPlaneH: npl, reversed: revIn || revEx, notes,
    p0, massResidual: sol.resid, massIn: mIn, massOut: mOut, ach: qIn * 3600 / ROOM_V
  };
  const ex = paths.find(p => p.kind === 'exhaust');
  if (ex) {
    const mEx = flows[paths.indexOf(ex)], rhoFan = mEx < 0 ? rhoAir(ex.Tr) : RHO_OUT;
    if (ex.fan) { r.fanQ = -mEx / rhoFan; r.fanP = fanP(r.fanQ, rhoFan); r.fanAirT = mEx < 0 ? ex.Tr : T_OUT; }
    if (ex.ductTop && mEx < 0) { const d = ductMarch(-mEx, ex.Tr, ex.ductTop - ex.h, () => T_OUT, 1, EPS_OUT); r.ductTin = ex.Tr; r.ductTout = d.Tout; }
  }
  const cas = paths.find(p => p.kind === 'casingFloor');
  if (cas) { const n = cas.node(p0); r.casing = { mFloor: n.mf, mIntake: n.mi, mChimney: n.mch, Tmix: n.Tmix, Ttop: n.Ttop, pC: n.pC, nodeResidual: n.mf + n.mi - n.mch }; notes.push('floor inlet feeds the casing and reaches the room at the casing top, ' + CASING_H.toFixed(2) + ' m'); }
  const idp = paths.find(p => p.kind === 'inletDuct');
  if (idp) { const m = flows[paths.indexOf(idp)]; if (m > 0) { const d = ductMarch(m, T_OUT, Math.max(idp.h - H_IDUCT_MOUTH, 0), s => opts.inletDuctInRoom !== false ? col.Tat(H_IDUCT_MOUTH + s) : T_OUT, 6, EPS_IN); r.inletDuctTout = d.Tout; } }
  return r;
}

/* The airflow for one switch state. Branch rule for a bare outdoor exhaust duct without a fan: a session starts with the duct cold,
   so the cold (reversed) state is taken whenever it is a consistent steady state; otherwise the running (warm) state.
   opts.branch = 'warm' forces the running state where it exists; the other state, if also consistent, is returned in alt. */
function airflow(state, profile, opts) {
  opts = opts || {};
  const prof = typeof profile === 'function' ? profile : defaultProfile;
  const col = buildColumn(prof);
  const paths = buildPaths(state, col, opts);
  const ex = paths.find(p => p.kind === 'exhaust');
  const folds = !!(ex && ex.fold && ex.fold.m < 0);
  const solW = solveNet(paths, false);
  let needC = false;
  if (folds) {
    const Pw = ex.S + ex.fold.J, Pc = ex.S + ex.fold.J0;   // warm root exists for p0 >= Pw; an inflow root exists for p0 < Pc
    needC = Math.abs(solW.resid) > MASS_TOL || (solW.p0 >= Pw && solW.p0 < Pc);
  }
  const solC = needC ? solveNet(paths, true) : solW;
  const okW = Math.abs(solW.resid) <= MASS_TOL, okC = Math.abs(solC.resid) <= MASS_TOL;
  const differ = Math.abs(solW.p0 - solC.p0) > 1e-9;
  let main = solW, alt = null, branch = 'unique';
  if (folds && differ) {
    if (okC && okW) { branch = 'bistable'; main = opts.branch === 'warm' ? solW : solC; alt = main === solW ? solC : solW; }
    else if (okC) { branch = 'cold-only'; main = solC; }
    else if (okW) { branch = 'warm-only'; main = solW; }
    else { branch = 'none'; main = Math.abs(solC.resid) < Math.abs(solW.resid) ? solC : solW; }
  }
  const r = summarise(state, paths, main, col, opts);
  r.branch = branch;
  if (branch === 'bistable') {
    const a = summarise(state, paths, alt, col, opts);
    r.alt = { mainInletQ: a.mainInletQ, mainExhaustQ: a.mainExhaustQ, dryQ: a.dryQ, doorLowQ: a.doorLowQ, doorTopQ: a.doorTopQ, qOutdoorIn: a.qOutdoorIn, neutralPlaneH: a.neutralPlaneH, p0: a.p0, massResidual: a.massResidual };
    r.notes.push('bistable exhaust duct: ' + (main === solC ? 'cold-start state shown (duct reversed); a running warm state also exists, in alt' : 'running warm state shown; a cold reversed state also exists, in alt'));
  } else if (branch === 'cold-only') r.notes.push('the duct cannot run warm here: the only steady state has it reversed');
  else if (branch === 'none') r.notes.push('no steady state: the exhaust duct would flip between cold and warm; the smaller-residual state is shown');
  if (Math.abs(r.massResidual) > MASS_TOL) r.notes.push('mass balance not closed: ' + r.massResidual.toExponential(2) + ' kg/s');
  r.notes = r.notes.join('; ');
  return r;
}

module.exports = { airflow, defaultProfile, _internals: { fanP, FAN_Q, FAN_P, ZETA_GRILLE_EXIT, ZETA_GRILLE_ENTRY, F_GR, rhoAir, ductMarch, Ucoef, PROFILE_K, H_SENSOR, CASING_A, RHO_OUT } };
