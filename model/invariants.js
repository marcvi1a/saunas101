'use strict';
/* Saunas 101 ventilation model, agent E: physical-invariants harness.

   Checks any module exporting evaluate(state) -> { flows, breathing, feet, breathingFactor, feetFactor, score }
   over every valid switch state (651: 648 vented + 3 sealed).

   Usage
     node invariants.js path/to/model.js [--strict] [--json out.json]
     node invariants.js --self-test

   Tiers
     hard      a failure is a model bug: conservation, ranges, interface, or a consequence of hydrostatics
               that holds for any room warmer than outdoors.
     expected  physically argued and very likely, but a correct model could break it in a corner case;
               every failure is a finding to explain, not to tune away.
     info      reported, never failed: directions physics does not fix (for example the drying vent with the fan on).
   Exit code 1 on any hard failure (or any expected failure with --strict).

   Optional fields the harness uses when present
     openings[i].rho (kg/m³) or openings[i].T (°C)   exact mass balance; otherwise result.profile(h), otherwise a density band
     result.profile(h)                               room temperature profile, °C
     breathing.co2Outdoor                            ppm, default 420
     module.FAN = { qFree, pShut }                   m³/s, Pa; default the catalogue fan (68.6 CFM) and a 120×25 mm datasheet shut-off
     module.fanCurve(dp) and result.fan = { q, dp }  exact fan operating-point check */

/* ---------- constants (sources in E_report.md) ---------- */
const G = 9.80665;                 // m/s², standard gravity
const R_AIR = 287.05;              // J/(kg·K), dry air
const P_ATM = 101300;              // Pa, brief
const T_OUT = 25;                  // °C, brief
const K0 = 273.15;
const rhoAt = tC => P_ATM / (R_AIR * (tC + K0));
const RHO_OUT = rhoAt(T_OUT);      // 1.184 kg/m³
const T_MAX_AIR = 110;             // °C, upper bound for any air leaving the room (ceiling 90 °C at the thermostat, plume margin)
const CEILING = 2.04;              // m, brief
const T_SENSOR = 90;               // °C, brief
const CFM = 0.000471947;           // m³/s per CFM
const FAN_QFREE = 68.6 * CFM;      // m³/s, Ultrar EF12025ML2BP7T0 catalogue free-air flow (brief)
const FAN_PSHUT = 3.0 * G;         // Pa, 3.0 mmH₂O: Mechatronics E1225 datasheet, 120×25 mm at 1,800 rpm (the lowest shut-off of the 1,800–2,200 rpm rows: loosest bound)
const DP_STACK_MAX = (RHO_OUT - rhoAt(T_MAX_AIR)) * G * 2.17;   // Pa, largest stack the room plus long duct can add
const REF_FAN_LS = [15, 25];       // l/s, the brief's "about 20 l/s" for the reference layout, ±25 %
const CO2_OUT_DEFAULT = 420;

/* ---------- states ---------- */
const INLETS = ['above', 'middle', 'below', 'bottom'];
const EXHAUSTS = ['lower', 'upper'];
const FANS = ['on', 'off'];
const DUCTS = ['straight', 'riser', 'half', 'inletduct'];
const HEATERS = ['open', 'closed', 'wall'];
const ANGLES = ['straight', 'up45'];
const DRYS = ['closed', 'open'];
const NONE_DEFAULTS = { inlet: 'above', exhaust: 'lower', fan: 'on', duct: 'straight', angle: 'straight', dry: 'closed' };
const NONE_ALT = { inlet: 'below', exhaust: 'upper', fan: 'off', duct: 'riser', angle: 'up45', dry: 'open' };
const REFERENCE = { vent: 'yes', inlet: 'above', exhaust: 'lower', fan: 'on', duct: 'straight', heater: 'open', angle: 'straight', dry: 'closed' };

function enumerateStates() {
  const out = [];
  for (const inlet of INLETS) for (const exhaust of EXHAUSTS) for (const fan of FANS) for (const duct of DUCTS)
    for (const heater of HEATERS) for (const angle of ANGLES) for (const dry of DRYS) {
      if (inlet === 'bottom' && duct === 'inletduct') continue;   // a floor hole has no duct to drop
      if (inlet === 'bottom' && angle !== 'straight') continue;   // angle collapses for the floor inlet
      out.push({ vent: 'yes', inlet, exhaust, fan, duct, heater, angle, dry });
    }
  for (const heater of HEATERS) out.push(Object.assign({ vent: 'none', heater }, NONE_DEFAULTS));
  return out;
}
const keyOf = s => s.vent === 'none' ? 'none|' + s.heater : [s.inlet, s.exhaust, s.fan, s.duct, s.heater, s.angle, s.dry].join('|');
const withSw = (s, patch) => Object.assign({}, s, patch);

/* ---------- helpers ---------- */
const fin = x => typeof x === 'number' && Number.isFinite(x);
const ls = q => (q * 1000).toFixed(2) + ' l/s';
function numericLeaves(o, prefix, out) {
  if (o == null) return out;
  if (typeof o === 'number') { out.push([prefix, o]); return out; }
  if (typeof o === 'boolean') { out.push([prefix, o ? 1 : 0]); return out; }
  if (Array.isArray(o)) { o.forEach((v, i) => numericLeaves(v, prefix + '[' + i + ']', out)); return out; }
  if (typeof o === 'object') { for (const k of Object.keys(o)) if (k !== 'notes') numericLeaves(o[k], prefix ? prefix + '.' + k : k, out); }
  return out;
}
function sameNumbers(a, b, tol) {
  const la = numericLeaves(a, '', []), lb = numericLeaves(b, '', []);
  if (la.length !== lb.length) return 'leaf count ' + la.length + ' vs ' + lb.length;
  for (let i = 0; i < la.length; i++) {
    const [ka, va] = la[i], [kb, vb] = lb[i];
    if (ka !== kb) return 'key ' + ka + ' vs ' + kb;
    if (Number.isNaN(va) && Number.isNaN(vb)) continue;
    if (Math.abs(va - vb) > tol * Math.max(1, Math.abs(va))) return ka + ' ' + va + ' vs ' + vb;
  }
  return null;
}

/* ---------- the harness ---------- */
function runInvariants(evaluate, opts = {}) {
  const mod = opts.module || {};
  const FAN = Object.assign({ qFree: FAN_QFREE, pShut: FAN_PSHUT }, mod.FAN || {});
  const states = enumerateStates();
  const R = new Map();
  const errors = [];
  const t0 = process.hrtime.bigint();
  for (const s of states) {
    try { R.set(keyOf(s), evaluate(Object.assign({}, s))); }
    catch (e) { errors.push(keyOf(s) + ': ' + (e && e.message)); R.set(keyOf(s), null); }
  }
  const msPerState = Number(process.hrtime.bigint() - t0) / 1e6 / states.length;
  const get = s => R.get(keyOf(s));

  const results = [];
  function check(id, tier, name, fn) {
    const r = { id, tier, name, checked: 0, failures: [], info: [] };
    const ctx = {
      ok: () => { r.checked++; },
      fail: (k, msg) => { r.checked++; r.failures.push(k + ': ' + msg); },
      note: (k, msg) => { r.info.push(k + ': ' + msg); }
    };
    try { fn(ctx); } catch (e) { r.failures.push('harness exception: ' + (e && e.stack || e)); }
    results.push(r);
  }
  const vented = states.filter(s => s.vent === 'yes');
  const cOutOf = res => (res && res.breathing && fin(res.breathing.co2Outdoor)) ? res.breathing.co2Outdoor : CO2_OUT_DEFAULT;
  const qIn = res => res.flows.qOutdoorIn;
  const TOL = 0.005;   // 0.5 % relative tolerance on flow comparisons
  const geq = (a, b) => a >= b * (1 - TOL) - 1e-7;

  /* H1 interface: every field present and finite */
  check('H1', 'hard', 'interface complete, no NaN or Infinity', c => {
    for (const s of states) {
      const k = keyOf(s), r = get(s);
      if (!r) { c.fail(k, 'evaluate threw or returned nothing'); continue; }
      const f = r.flows || {};
      const need = { qOutdoorIn: f.qOutdoorIn, qOutdoorOut: f.qOutdoorOut, mainInletQ: f.mainInletQ, mainExhaustQ: f.mainExhaustQ,
        dryQ: f.dryQ, doorLowQ: f.doorLowQ, doorTopQ: f.doorTopQ, breathingFactor: r.breathingFactor, feetFactor: r.feetFactor, score: r.score,
        co2AtMouth: r.breathing && (Array.isArray(r.breathing.co2AtMouth) ? r.breathing.co2AtMouth[0] : r.breathing.co2AtMouth),
        fractionToBreathingZone: r.breathing && r.breathing.fractionToBreathingZone, qFreshAtBreathingZone: r.breathing && r.breathing.qFreshAtBreathingZone,
        ankleT_upper: r.feet && r.feet.ankleT_upper, ankleT_lower: r.feet && r.feet.ankleT_lower, ankleV: r.feet && r.feet.ankleV, feetFactorD: r.feet && r.feet.feetFactor };
      const bad = Object.keys(need).filter(n => !fin(need[n]));
      if (!Array.isArray(f.openings) || !f.openings.length) bad.push('openings[]');
      else f.openings.forEach((o, i) => { if (!fin(o.q) || !fin(o.h) || typeof o.name !== 'string') bad.push('openings[' + i + ']'); });
      if (typeof f.reversed !== 'boolean') bad.push('reversed (boolean)');
      if (bad.length) c.fail(k, 'missing or not finite: ' + bad.join(', ')); else c.ok();
    }
    for (const e of errors) c.fail('evaluate', e);
  });
  const okStates = states.filter(s => { const r = get(s); return r && r.flows && Array.isArray(r.flows.openings); });

  /* H2 ranges */
  check('H2', 'hard', 'factors in [0, 1], score an integer in [0, 100]', c => {
    for (const s of okStates) {
      const r = get(s), k = keyOf(s);
      const bad = [];
      if (!(r.breathingFactor >= 0 && r.breathingFactor <= 1)) bad.push('breathingFactor ' + r.breathingFactor);
      if (!(r.feetFactor >= 0 && r.feetFactor <= 1)) bad.push('feetFactor ' + r.feetFactor);
      if (!(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100)) bad.push('score ' + r.score);
      bad.length ? c.fail(k, bad.join(', ')) : c.ok();
    }
  });

  /* H3 the page's structure: score = round(100 × breathing × feet) */
  check('H3', 'hard', 'score = round(100 × min(breathingFactor × feetFactor × loylyFactor, the drying-vent cap))', c => {
    for (const s of okStates) {
      const r = get(s), prod = r.breathingFactor * r.feetFactor * (r.loylyFactor != null ? r.loylyFactor : 1), want = Math.round(100 * (r.capRaw != null ? Math.min(prod, r.capRaw) : prod));
      Math.abs(r.score - want) <= 1 ? c.ok() : c.fail(keyOf(s), 'score ' + r.score + ', product gives ' + want);
    }
  });

  /* H3d an open drying vent can only lower a score */
  check('H3d', 'hard', 'an open drying vent never scores above the same layout with the vent shut', c => {
    for (const s of okStates) {
      if (s.vent !== 'yes' || s.dry !== 'open') continue;
      const r = get(s), shut = get(Object.assign({}, s, { dry: 'closed' }));
      if (!shut) continue;
      r.score <= shut.score ? c.ok() : c.fail(keyOf(s), 'open ' + r.score + ' > shut ' + shut.score);
    }
  });

  /* H3l löyly stays a share, and an open drying vent that lets air out at the ceiling never raises it */
  check('H3l', 'hard', 'loylyFactor in [0, 1]; opening the drying vent where it carries air out never raises it', c => {
    for (const s of okStates) {
      const r = get(s); if (r.loylyFactor == null) { c.ok(); continue; }
      if (!(r.loylyFactor >= 0 && r.loylyFactor <= 1)) { c.fail(keyOf(s), 'loylyFactor ' + r.loylyFactor); continue; }
      if (s.vent === 'yes' && s.dry === 'open') { const shut = get(Object.assign({}, s, { dry: 'closed' })); if (shut && r.flows.dryQ < 0 && r.loylyFactor > shut.loylyFactor + 1e-9) { c.fail(keyOf(s), 'open vent raises löyly ' + shut.loylyFactor.toFixed(4) + ' -> ' + r.loylyFactor.toFixed(4)); continue; } }
      c.ok();
    }
  });

  /* H4 bookkeeping between the openings list and the summary fields */
  check('H4', 'hard', 'flow bookkeeping consistent (qOutdoorIn, qOutdoorOut, named flows vs openings[])', c => {
    for (const s of okStates) {
      const f = get(s).flows, k = keyOf(s);
      let pin = 0, pout = 0, sum = 0;
      /* outdoor air is counted by mass at outdoor density when the opening reports its mass flow: air warmed in an inlet duct is the same outdoor air at a larger volume */
      for (const o of f.openings) { const qo = (o.mdot != null ? o.mdot : (o.m != null ? o.m : null)); const qv = qo != null ? qo / RHO_OUT : o.q; if (o.q > 0) pin += qv; else pout -= o.q; sum += o.q; }   // outflow stays a volume at the room side, as the brief defines qOutdoorOut
      const named = f.mainInletQ + f.mainExhaustQ + f.dryQ + f.doorLowQ + f.doorTopQ;
      const tol = 1e-6 + 1e-3 * (pin + pout);
      const bad = [];
      if (Math.abs(f.qOutdoorIn - pin) > tol + 2e-3 * pin) bad.push('qOutdoorIn ' + ls(f.qOutdoorIn) + ' vs sum of inflows ' + ls(pin));
      if (Math.abs(Math.abs(f.qOutdoorOut) - pout) > tol) bad.push('qOutdoorOut ' + ls(f.qOutdoorOut) + ' vs sum of outflows ' + ls(pout));
      if (Math.abs(named - sum) > tol) bad.push('named flows sum ' + ls(named) + ' vs openings sum ' + ls(sum));
      bad.length ? c.fail(k, bad.join('; ')) : c.ok();
    }
  });

  /* H5 conservation of mass */
  check('H5', 'hard', 'mass balance: Σ ρ·q = 0 over the openings', c => {
    let mode = '';
    for (const s of okStates) {
      const r = get(s), f = r.flows, k = keyOf(s);
      const haveRho = f.openings.every(o => fin(o.rho) || fin(o.T));
      const prof = typeof r.profile === 'function' ? r.profile : null;
      if (haveRho || prof) {
        let m = 0, scale = 0;
        for (const o of f.openings) {
          let rho;
          if (fin(o.rho)) rho = o.rho; else if (fin(o.T)) rho = rhoAt(o.T);
          else rho = o.q > 0 ? RHO_OUT : rhoAt(prof(o.h));
          m += rho * o.q; scale += Math.abs(rho * o.q);
        }
        mode = haveRho ? 'per-opening density' : 'profile density';
        Math.abs(m) <= 0.01 * scale + 1e-7 ? c.ok() : c.fail(k, 'net mass ' + (m * 1000).toFixed(3) + ' g/s of ' + (scale * 500).toFixed(3) + ' g/s through');
      } else {
        // outgoing air is never colder than 25 °C nor hotter than T_MAX_AIR, so its volume is 1 to ρ_out/ρ(T_MAX) times the incoming volume
        mode = 'density band';
        const pin = f.qOutdoorIn, pout = Math.abs(f.qOutdoorOut), hi = RHO_OUT / rhoAt(T_MAX_AIR);
        (pout >= pin * (1 - 0.01) - 1e-7 && pout <= pin * hi * 1.01 + 1e-7) ? c.ok()
          : c.fail(k, 'out/in volume ratio ' + (pout / pin).toFixed(3) + ' outside [1, ' + hi.toFixed(3) + ']');
      }
    }
    if (mode) c.note('mode', mode);
  });

  /* H6 the sealed room: door gaps only, and only the heater matters */
  check('H6', 'hard', 'vent none: only door gaps carry flow, and no switch but the heater changes anything', c => {
    for (const heater of HEATERS) {
      const s = Object.assign({ vent: 'none', heater }, NONE_DEFAULTS), r = get(s), k = keyOf(s);
      if (!r) continue;
      const f = r.flows;
      if (Math.abs(f.mainInletQ) > 1e-9 || Math.abs(f.mainExhaustQ) > 1e-9 || Math.abs(f.dryQ) > 1e-9) c.fail(k, 'main inlet/exhaust/drying vent carry flow');
      else c.ok();
      let alt;
      try { alt = evaluate(Object.assign({ vent: 'none', heater }, NONE_ALT)); } catch (e) { c.fail(k, 'evaluate threw on alternative switches: ' + e.message); continue; }
      const d = sameNumbers(r, alt, 1e-9);
      d ? c.fail(k, 'result depends on switches that do not exist without ventilation: ' + d) : c.ok();
    }
  });

  /* H7 a heated room with openings at two heights always exchanges air */
  check('H7', 'hard', 'qOutdoorIn > 0 in every state', c => {
    for (const s of okStates) { const q = get(s).flows.qOutdoorIn; q > 0 ? c.ok() : c.fail(keyOf(s), 'qOutdoorIn ' + ls(q)); }
  });

  /* H8 hydrostatics: with no fan and no duct, room-minus-outdoor pressure rises with height in any room warmer than outdoors,
     so every inflow opening lies below every outflow opening (one neutral plane). */
  check('H8', 'hard', 'no fan, no duct: all inflow openings lie below all outflow openings (single neutral plane)', c => {
    for (const s of okStates) {
      const isNoFanNoDuct = s.vent === 'none' || (s.fan === 'off' && s.duct === 'straight');
      if (!isNoFanNoDuct) continue;
      const f = get(s).flows, k = keyOf(s);
      const live = f.openings.filter(o => Math.abs(o.q) > 1e-7);
      const ins = live.filter(o => o.q > 0), outs = live.filter(o => o.q < 0);
      const topIn = ins.length ? Math.max(...ins.map(o => o.h)) : -Infinity, lowOut = outs.length ? Math.min(...outs.map(o => o.h)) : Infinity;
      const bad = [];
      if (topIn > lowOut + 1e-3) bad.push('inflow at ' + topIn.toFixed(3) + ' m above outflow at ' + lowOut.toFixed(3) + ' m');
      if (fin(f.neutralPlaneH)) {
        if (topIn > f.neutralPlaneH + 0.01) bad.push('inflow opening above the reported neutral plane ' + f.neutralPlaneH.toFixed(3));
        if (lowOut < f.neutralPlaneH - 0.01) bad.push('outflow opening below the reported neutral plane ' + f.neutralPlaneH.toFixed(3));
      }
      bad.length ? c.fail(k, bad.join('; ')) : c.ok();
    }
  });

  /* H9 the brief: an inlet above the outlet, no fan, no duct, runs reversed.
     The door's 10 mm undercut (0.007 m², the largest and lowest opening) keeps the neutral plane below 0.45 m, so the inlet exhausts. */
  const REV_PAIRS = [['above', 'lower'], ['above', 'upper'], ['middle', 'lower']];
  check('H9', 'hard', 'no fan, no duct, drying vent shut, inlet above the grille: the inlet carries air out and reversed = true', c => {
    for (const s of vented) {
      if (s.fan !== 'off' || s.duct !== 'straight' || s.dry !== 'closed') continue;
      if (!REV_PAIRS.some(([i, e]) => s.inlet === i && s.exhaust === e)) continue;
      const f = get(s).flows, k = keyOf(s);
      (f.mainInletQ < 0 && f.reversed === true) ? c.ok() : c.fail(k, 'mainInletQ ' + ls(f.mainInletQ) + ', reversed ' + f.reversed);
    }
  });
  check('H10', 'expected', 'no fan, no duct, drying vent shut, low or floor inlet: runs forward', c => {
    for (const s of vented) {
      if (s.fan !== 'off' || s.duct !== 'straight' || s.dry !== 'closed' || !(s.inlet === 'below' || s.inlet === 'bottom')) continue;
      const f = get(s).flows, k = keyOf(s);
      (f.mainInletQ > 0 && f.reversed === false) ? c.ok() : c.fail(k, 'mainInletQ ' + ls(f.mainInletQ) + ', reversed ' + f.reversed);
    }
  });

  /* H11 the brief: no fan, low inlet, raising the outlet never lowers outdoor inflow.
     Raising an opening that carries air OUT raises the neutral plane and every inflow; raising one that carries air IN lowers them.
     So the check applies while the grille is an outlet in both states; otherwise it is reported. */
  check('H11', 'hard', 'no fan, low or floor inlet, drying vent shut: lower grille ≤ upper grille; per grille none ≤ short ≤ long (outdoor inflow)', c => {
    for (const s of vented) {
      if (s.fan !== 'off' || s.dry !== 'closed' || !(s.inlet === 'below' || s.inlet === 'bottom') || s.exhaust !== 'lower' || s.duct !== 'straight') continue;
      const chain = [];
      const a = get(s), b = get(withSw(s, { exhaust: 'upper' }));
      chain.push(['lower grille', 'upper grille', a, b, withSw(s, { exhaust: 'upper' })]);
      for (const g of EXHAUSTS) {
        const n = get(withSw(s, { exhaust: g, duct: 'straight' })), h = get(withSw(s, { exhaust: g, duct: 'half' })), l = get(withSw(s, { exhaust: g, duct: 'riser' }));
        chain.push([g + ' none', g + ' short', n, h, withSw(s, { exhaust: g, duct: 'half' })]);
        chain.push([g + ' short', g + ' long', h, l, withSw(s, { exhaust: g, duct: 'riser' })]);
      }
      for (const [na, nb, ra, rb, sb] of chain) {
        if (!ra || !rb) continue;
        const k = keyOf(sb) + ' (' + na + ' → ' + nb + ')';
        if (!(ra.flows.mainExhaustQ < 0 && rb.flows.mainExhaustQ < 0)) { c.note(k, 'grille carries air in, raising an inlet-acting opening may lower inflow'); continue; }
        geq(qIn(rb), qIn(ra)) ? c.ok() : c.fail(k, ls(qIn(ra)) + ' → ' + ls(qIn(rb)));
      }
    }
  });
  check('H11x', 'expected', 'no fan, low or floor inlet, drying vent shut: upper grille without duct ≤ lower grille with short duct', c => {
    for (const s of vented) {
      if (s.fan !== 'off' || s.dry !== 'closed' || !(s.inlet === 'below' || s.inlet === 'bottom') || s.exhaust !== 'upper' || s.duct !== 'straight') continue;
      const a = get(s), sb = withSw(s, { exhaust: 'lower', duct: 'half' }), b = get(sb);
      if (!a || !b) continue;
      geq(qIn(b), qIn(a)) ? c.ok() : c.fail(keyOf(sb), 'upper/none ' + ls(qIn(a)) + ' > lower/short ' + ls(qIn(b)));
    }
  });

  /* H12 the brief: no fan, a long duct never gives less inflow than a short one (every inlet sits below both outlets, 1.18 and 2.17 m) */
  /* a duct that carries outdoor air into the room (the cold-start reversed branch behind an inlet above the grille) gives no lift, only friction, so a longer one may pass slightly less; the order is only physics where both ducts carry air out (the airflow model's finding) */
  check('H12', 'hard', 'no fan, drying vent shut: long duct ≥ short duct (outdoor inflow) wherever both ducts carry air out', c => {
    for (const s of vented) {
      if (s.fan !== 'off' || s.dry !== 'closed' || s.duct !== 'half') continue;
      const a = get(s), sl = withSw(s, { duct: 'riser' }), b = get(sl);
      if (!a || !b) continue;
      if (a.flows.mainExhaustQ > 0 || b.flows.mainExhaustQ > 0) { c.ok(); continue; }
      geq(qIn(b), qIn(a)) ? c.ok() : c.fail(keyOf(sl), 'short ' + ls(qIn(a)) + ' > long ' + ls(qIn(b)));
    }
  });
  check('H12d', 'expected', 'no fan, drying vent open: long duct ≥ short duct; low inlet: grille and duct chain', c => {
    for (const s of vented) {
      if (s.fan !== 'off' || s.dry !== 'open' || s.duct !== 'half') continue;
      const a = get(s), sl = withSw(s, { duct: 'riser' }), b = get(sl);
      if (!a || !b) continue;
      geq(qIn(b), qIn(a)) ? c.ok() : c.fail(keyOf(sl), 'short ' + ls(qIn(a)) + ' > long ' + ls(qIn(b)));
    }
  });

  /* H13 the fan */
  check('H13', 'hard', 'fan on: the fan path extracts, below free-air flow plus stack assist, and never less than without the fan', c => {
    const qMax = FAN.qFree * (1 + DP_STACK_MAX / FAN.pShut);
    for (const s of vented) {
      if (s.fan !== 'on') continue;
      const r = get(s), k = keyOf(s); if (!r) continue;
      const ex = -r.flows.mainExhaustQ;
      if (!(ex > 0)) { c.fail(k, 'fan path not extracting: mainExhaustQ ' + ls(r.flows.mainExhaustQ)); continue; }
      if (ex > qMax) { c.fail(k, 'extract ' + ls(ex) + ' above free air + stack assist ' + ls(qMax)); continue; }
      if (typeof mod.fanCurve === 'function' && r.fan && fin(r.fan.dp) && fin(r.fan.q)) {
        const qc = mod.fanCurve(r.fan.dp);
        if (Math.abs(qc - r.fan.q) > 0.02 * Math.max(qc, 1e-6)) { c.fail(k, 'off the fan curve: q ' + ls(r.fan.q) + ' vs curve ' + ls(qc) + ' at ' + r.fan.dp.toFixed(2) + ' Pa'); continue; }
        if (Math.abs(r.fan.q - ex) > 0.02 * ex) { c.fail(k, 'fan q ' + ls(r.fan.q) + ' differs from mainExhaustQ ' + ls(ex)); continue; }
      }
      const off = get(withSw(s, { fan: 'off' }));
      if (off) {
        const exOff = Math.max(0, -off.flows.mainExhaustQ);
        if (!geq(ex, exOff)) { c.fail(k, 'extract ' + ls(ex) + ' below the no-fan extract ' + ls(exOff)); continue; }
        if (!(qIn(r) >= qIn(off) * 0.98 - 1e-7)) { c.fail(k, 'outdoor inflow ' + ls(qIn(r)) + ' below the no-fan ' + ls(qIn(off))); continue; }
      }
      c.ok();
    }
  });
  check('H13r', 'expected', 'reference layout (inlet above, lower grille, fan, no duct): extract ' + REF_FAN_LS.join('–') + ' l/s and running forward', c => {
    const r = get(REFERENCE); if (!r) return;
    const ex = -r.flows.mainExhaustQ * 1000;
    (ex >= REF_FAN_LS[0] && ex <= REF_FAN_LS[1]) ? c.ok() : c.fail(keyOf(REFERENCE), 'extract ' + ex.toFixed(2) + ' l/s');
    (r.flows.mainInletQ > 0 && r.flows.reversed === false) ? c.ok() : c.fail(keyOf(REFERENCE), 'inlet ' + ls(r.flows.mainInletQ) + ', reversed ' + r.flows.reversed);
  });

  /* H14 the brief: opening the drying vent never raises feetFactor.
     Fan off: a high outlet raises the neutral plane, so more outdoor air enters below it: expected to hold.
     Fan on: the room is depressurised to above 1.94 m, the vent becomes a second inlet at the ceiling and takes inflow from the low openings;
     feet can get warmer. Reported, not failed. */
  check('H14', 'expected', 'fan off: opening the drying vent never raises feetFactor', c => {
    for (const s of vented) {
      if (s.dry !== 'closed') continue;
      const a = get(s), so = withSw(s, { dry: 'open' }), b = get(so); if (!a || !b) continue;
      if (s.fan === 'off') b.feetFactor <= a.feetFactor + 1e-9 ? c.ok() : c.fail(keyOf(so), 'feet ' + a.feetFactor.toFixed(4) + ' → ' + b.feetFactor.toFixed(4));
      else if (b.feetFactor > a.feetFactor + 1e-9) c.note(keyOf(so), 'fan on, feet rise ' + a.feetFactor.toFixed(4) + ' → ' + b.feetFactor.toFixed(4) + ' (drying vent dryQ ' + ls(b.flows.dryQ) + ')');
    }
  });

  /* H15 the score's own monotonicity: more CO₂ at the mouth never raises breathingFactor */
  /* breathing's zero is the sealed room with the same heater, so the order holds among states with one heater */
  check('H15', 'hard', 'breathingFactor never rises with CO₂ at the mouth, among states with the same heater', c => {
    const pts = okStates.map(s => ({ k: keyOf(s), r: get(s), h: s.heater }))
      .filter(p => fin(p.r.breathing && p.r.breathing.co2AtMouth) && !Array.isArray(p.r.breathing.co2AtMouthByBather))
      .sort((a, b) => a.h < b.h ? -1 : a.h > b.h ? 1 : a.r.breathing.co2AtMouth - b.r.breathing.co2AtMouth);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      if (p.h !== q.h) { c.ok(); continue; }
      if (q.r.breathingFactor > p.r.breathingFactor + 1e-9 && q.r.breathing.co2AtMouth > p.r.breathing.co2AtMouth)
        c.fail(q.k, 'CO₂ ' + q.r.breathing.co2AtMouth.toFixed(0) + ' scores ' + q.r.breathingFactor.toFixed(4) + ' > ' + p.r.breathingFactor.toFixed(4) + ' at ' + p.r.breathing.co2AtMouth.toFixed(0) + ' (' + p.k + ')');
      else c.ok();
    }
  });
  /* H16 the brief: more breathing-zone fresh air never lowers breathingFactor (across states; holds if C's CO₂ falls with qFresh) */
  check('H16', 'expected', 'more breathing-zone fresh air (by more than 5 %) never lowers breathingFactor', c => {
    const pts = okStates.map(s => ({ k: keyOf(s), r: get(s) })).filter(p => fin(p.r.breathing && p.r.breathing.qFreshAtBreathingZone))
      .sort((a, b) => a.r.breathing.qFreshAtBreathingZone - b.r.breathing.qFreshAtBreathingZone);
    // sweep: for each state, compare with the highest breathingFactor among states with at least 5 % less fresh air
    let j = 0, best = -Infinity, bestK = '';
    for (const p of pts) {
      while (j < pts.length && pts[j].r.breathing.qFreshAtBreathingZone * 1.05 < p.r.breathing.qFreshAtBreathingZone) {
        if (pts[j].r.breathingFactor > best) { best = pts[j].r.breathingFactor; bestK = pts[j].k; } j++;
      }
      if (best > p.r.breathingFactor + 1e-6) c.fail(p.k, 'qFresh ' + ls(p.r.breathing.qFreshAtBreathingZone) + ' scores ' + p.r.breathingFactor.toFixed(4) + ' < ' + best.toFixed(4) + ' of ' + bestK);
      else c.ok();
    }
  });
  /* H17 breathing-zone physical bounds */
  check('H17', 'hard', 'CO₂ at the mouth ≥ outdoor; 0 ≤ fraction ≤ 1; breathing-zone fresh air ≤ outdoor inflow', c => {
    for (const s of okStates) {
      const r = get(s), b = r.breathing || {}, k = keyOf(s), bad = [];
      const co = cOutOf(r);
      const mouths = Array.isArray(b.co2AtMouthByBather) ? b.co2AtMouthByBather : [b.co2AtMouth];
      if (mouths.some(m => !(m >= co - 1))) bad.push('CO₂ ' + mouths.join('/') + ' below outdoor ' + co);
      if (!(b.fractionToBreathingZone >= 0 && b.fractionToBreathingZone <= 1)) bad.push('fraction ' + b.fractionToBreathingZone);
      if (!(b.qFreshAtBreathingZone >= 0 && b.qFreshAtBreathingZone <= r.flows.qOutdoorIn * (1 + 1e-6) + 1e-9)) bad.push('qFresh ' + ls(b.qFreshAtBreathingZone) + ' vs inflow ' + ls(r.flows.qOutdoorIn));
      bad.length ? c.fail(k, bad.join('; ')) : c.ok();
    }
  });

  /* H18 adding area to a stack-driven room never lowers its exchange (at fixed temperatures) */
  check('H18', 'expected', 'no fan: opening the drying vent raises outdoor inflow; any vented no-fan state ≥ the sealed room', c => {
    for (const s of vented) {
      if (s.fan !== 'off') continue;
      const r = get(s); if (!r) continue;
      if (s.dry === 'closed') { const so = withSw(s, { dry: 'open' }), ro = get(so); if (ro) geq(qIn(ro), qIn(r)) ? c.ok() : c.fail(keyOf(so), ls(qIn(r)) + ' → ' + ls(qIn(ro))); }
      const sealed = get(Object.assign({ vent: 'none', heater: s.heater }, NONE_DEFAULTS));
      if (sealed) geq(qIn(r), qIn(sealed)) ? c.ok() : c.fail(keyOf(s), ls(qIn(r)) + ' below sealed ' + ls(qIn(sealed)));
    }
  });
  /* H19 the inlet angle aims the jet; it does not change the opening's pressure-flow law */
  check('H19', 'expected', 'inlet angle changes outdoor inflow by at most 5 %', c => {
    for (const s of vented) {
      if (s.angle !== 'straight' || s.inlet === 'bottom') continue;
      const a = get(s), su = withSw(s, { angle: 'up45' }), b = get(su); if (!a || !b) continue;
      Math.abs(qIn(b) - qIn(a)) <= 0.05 * qIn(a) + 1e-7 ? c.ok() : c.fail(keyOf(su), ls(qIn(a)) + ' vs ' + ls(qIn(b)));
    }
  });
  /* H20 temperatures: the ankles sit in a stably stratified room below a ceiling held at 90 °C */
  check('H20', 'hard', 'ankle air between outdoor (25 °C) and the ceiling setpoint (90 °C); profile non-decreasing with height when given', c => {
    for (const s of okStates) {
      const r = get(s), ft = r.feet || {}, k = keyOf(s), bad = [];
      for (const n of ['ankleT_upper', 'ankleT_lower']) if (!(ft[n] >= T_OUT - 0.5 && ft[n] <= T_SENSOR + 5)) bad.push(n + ' ' + ft[n]);
      if (!(ft.ankleV >= 0)) bad.push('ankleV ' + ft.ankleV);
      if (typeof r.profile === 'function') {
        let prev = -Infinity;
        for (let h = 0; h <= CEILING + 1e-9; h += 0.05) { const t = r.profile(h); if (!fin(t) || t < prev - 0.05) { bad.push('profile falls at ' + h.toFixed(2) + ' m'); break; } prev = t; }
      }
      bad.length ? c.fail(k, bad.join('; ')) : c.ok();
    }
  });
  check('H20b', 'expected', 'upper-bench ankles (0.55 m) no colder than lower-bench ankles (0.10 m)', c => {
    for (const s of okStates) { const ft = get(s).feet; ft.ankleT_upper >= ft.ankleT_lower - 0.5 ? c.ok() : c.fail(keyOf(s), ft.ankleT_upper + ' < ' + ft.ankleT_lower); }
  });

  /* H21 determinism, H22 speed */
  check('H21', 'hard', 'deterministic: the same state gives the same numbers', c => {
    for (const s of okStates) {
      let again; try { again = evaluate(Object.assign({}, s)); } catch (e) { c.fail(keyOf(s), 'threw on second call'); continue; }
      const d = sameNumbers(get(s), again, 0); d ? c.fail(keyOf(s), d) : c.ok();
    }
  });
  /* the model runs once per build over every state, not in the browser: the bound keeps the build quick */
  check('H22', 'hard', 'under 50 ms per state (build time)', c => {
    msPerState < 50 ? c.ok() : c.fail('timing', msPerState.toFixed(3) + ' ms per state');
  });

  /* H23 the manuals' and VTT's recommended layout should beat a sealed room */
  check('H23', 'expected', 'reference layout scores at least as high as every sealed room', c => {
    const r = get(REFERENCE); if (!r) return;
    for (const heater of HEATERS) {
      const sr = get(Object.assign({ vent: 'none', heater }, NONE_DEFAULTS)); if (!sr) continue;
      r.score >= sr.score ? c.ok() : c.fail('none|' + heater, 'sealed ' + sr.score + ' > reference ' + r.score);
    }
  });

  const hardFail = results.filter(r => r.tier === 'hard' && r.failures.length).length;
  const expFail = results.filter(r => r.tier === 'expected' && r.failures.length).length;
  return { states: states.length, msPerState, results, hardFail, expFail, ok: hardFail === 0 };
}

function report(run, log = console.log, maxShow = 3) {
  log('states: ' + run.states + ', ' + run.msPerState.toFixed(4) + ' ms per state');
  for (const r of run.results) {
    const st = r.failures.length ? (r.tier === 'hard' ? 'FAIL' : 'FLAG') : 'ok  ';
    log(st + ' ' + r.id.padEnd(5) + ' [' + r.tier.padEnd(8) + '] ' + r.name + '  (' + r.checked + ' checks' + (r.failures.length ? ', ' + r.failures.length + ' failing' : '') + (r.info.length ? ', ' + r.info.length + ' notes' : '') + ')');
    r.failures.slice(0, maxShow).forEach(f => log('        ' + f));
    if (r.failures.length > maxShow) log('        … ' + (r.failures.length - maxShow) + ' more');
    r.info.slice(0, Math.min(2, maxShow)).forEach(f => log('        note ' + f));
  }
  log(run.hardFail ? run.hardFail + ' hard invariant(s) failing' : 'all hard invariants hold' + (run.expFail ? '; ' + run.expFail + ' expected invariant(s) flagged' : ''));
}

/* ---------- stand-in model, for the self-test only ----------
   A single-zone stack and fan network with a fixed linear temperature profile, a well-mixed CO₂ room and a crude feet rule.
   It exists to prove the harness, not to propose physics: its profile, grille free area, duct friction, mixing flow and feet rule
   are placeholders (marked STAND-IN). The hydrostatics, orifice law and mass balance are real. */
function makeStandIn() {
  const A125 = Math.PI * 0.0625 * 0.0625;   // m², Ø125
  const CD = 0.61;                          // sharp-edged orifice discharge coefficient (textbook)
  const FREE = 0.6;                         // STAND-IN grille free-area ratio
  const CDA_VENT = CD * A125 * FREE;
  const DOOR = { low: { h: 0.005, a: 0.70 * 0.010 }, top: { h: 1.899, a: 0.70 * 0.002 } };
  const H_IN = { above: 0.98, middle: 0.45, below: 0.12, bottom: 0 }, H_EX = { lower: 0.25, upper: 0.69 }, H_TOP = { riser: 2.17, half: 1.18 };
  const T_FLOOR = 45;                       // STAND-IN profile: linear 45 °C at the floor to 90 °C at the ceiling
  const T = h => T_FLOOR + (T_SENSOR - T_FLOOR) * Math.min(Math.max(h, 0), CEILING) / CEILING;
  const rhoIn = h => rhoAt(T(h));
  const I = h => { const n = 24; let s = 0; for (let i = 0; i < n; i++) s += rhoIn((i + 0.5) * h / n); return s * h / n; };   // ∫0^h ρ_in dz
  const pIn = (P0, h) => P0 - G * I(h);
  const pOut = h => -RHO_OUT * G * h;
  const F_DUCT = 0.02, K_DUCT = 1.5;        // STAND-IN Darcy friction factor and minor losses
  const ductR = L => (F_DUCT * L / 0.125 + K_DUCT) / (A125 * A125);
  const orifice = (dp, cda, rhoOut) => dp > 0 ? -cda * Math.sqrt(2 * dp / rhoOut) : cda * Math.sqrt(-2 * dp / RHO_OUT);   // + into the room
  const Q_MIX = 0.020;                      // STAND-IN heater-loop mixing flow into the lower zone, m³/s

  function paths(state) {
    const P = [];
    const plain = (name, h, cda) => P.push({ name, h, flow: P0 => { const q = orifice(pIn(P0, h) - pOut(h), cda, rhoIn(h)); return { q, rho: q > 0 ? RHO_OUT : rhoIn(h) }; } });
    plain('doorLow', DOOR.low.h, CD * DOOR.low.a);
    plain('doorTop', DOOR.top.h, CD * DOOR.top.a);
    if (state.vent === 'none') return P;
    const hi = H_IN[state.inlet], hg = H_EX[state.exhaust];
    if (state.duct === 'inletduct') {
      // cold duct from a floor-level mouth: inflow sees the inlet's own height; outflow fills it with room air and sees the mouth; in between it stalls
      const R = 1 / (CDA_VENT * CDA_VENT) + ductR(hi + 0.5);
      P.push({ name: 'inlet', h: hi, flow: P0 => {
        const dIn = pOut(hi) - pIn(P0, hi), dOut = pIn(P0, hi) + rhoIn(hi) * G * hi - pOut(0);
        if (dIn > 0) return { q: Math.sqrt(2 * dIn / (RHO_OUT * R)), rho: RHO_OUT };
        if (dOut > 0) return { q: -Math.sqrt(2 * dOut / (rhoIn(hi) * R)), rho: rhoIn(hi) };
        return { q: 0, rho: RHO_OUT };
      } });
    } else plain('inlet', hi, CDA_VENT);
    if (state.dry === 'open') plain('dry', 1.94, CDA_VENT);
    const top = H_TOP[state.duct];
    const Rex = 1 / (CDA_VENT * CDA_VENT) + (top ? ductR(top - hg + 0.5) : 0);
    const buoy = P0 => pIn(P0, hg) - pOut(top || hg) - (top ? rhoIn(hg) * G * (top - hg) : 0);   // a primed duct holds room air from the grille
    if (state.fan === 'on') {
      const qf = FAN_QFREE, ps = 44.1;     // STAND-IN linear curve: 68.6 CFM free air, 4.5 mmH₂O shut-off (Mechatronics E1225M row)
      P.push({ name: 'exhaust', h: hg, flow: P0 => {
        const a = rhoIn(hg) * Rex / 2, b = ps / qf, cc = buoy(P0) + ps;
        if (cc <= 0) return { q: 0, rho: rhoIn(hg) };
        return { q: -(-b + Math.sqrt(b * b + 4 * a * cc)) / (2 * a), rho: rhoIn(hg) };
      } });
    } else {
      P.push({ name: 'exhaust', h: hg, flow: P0 => { const d = buoy(P0); const q = d > 0 ? -Math.sqrt(2 * d / (rhoIn(hg) * Rex)) : Math.sqrt(-2 * d / (RHO_OUT * Rex)); return { q, rho: q > 0 ? RHO_OUT : rhoIn(hg) }; } });
    }
    return P;
  }

  function airflow(state) {
    const P = paths(state);
    const net = P0 => P.reduce((m, p) => { const f = p.flow(P0); return m + f.rho * f.q; }, 0);   // decreasing in P0
    let lo = -300, hi = 300;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (net(mid) > 0) lo = mid; else hi = mid; }
    const P0 = (lo + hi) / 2;
    const openings = P.map(p => { const f = p.flow(P0); return { name: p.name, h: p.h, q: f.q, rho: f.rho }; });
    const by = n => { const o = openings.find(x => x.name === n); return o ? o.q : 0; };
    let qOutdoorIn = 0, qOutdoorOut = 0; for (const o of openings) { if (o.q > 0) qOutdoorIn += o.q; else qOutdoorOut -= o.q; }
    let neutralPlaneH = null;
    if (state.vent === 'none' || (state.fan === 'off' && state.duct === 'straight')) {
      const d = h => pIn(P0, h) - pOut(h);
      if (d(0) < 0 && d(CEILING) > 0) { let a = 0, b = CEILING; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (d(m) < 0) a = m; else b = m; } neutralPlaneH = (a + b) / 2; }
    }
    return { openings, qOutdoorIn, qOutdoorOut, mainInletQ: by('inlet'), mainExhaustQ: by('exhaust'), dryQ: by('dry'), doorLowQ: by('doorLow'), doorTopQ: by('doorTop'),
      neutralPlaneH, reversed: by('inlet') < 0, notes: 'STAND-IN' };
  }
  function breathing(state, flows) {
    // STAND-IN: well-mixed room, 2 bathers at EN 16798-1's 20 L/h each, read at 30 min, starting from outdoor air
    const Gm3h = 2 * 0.020, V = 12, t = 0.5, Q = flows.qOutdoorIn * 3600;
    const dc = Q > 1e-9 ? Gm3h / Q * (1 - Math.exp(-Q / V * t)) * 1e6 : Gm3h * t / V * 1e6;
    return { fractionToBreathingZone: 1, qFreshAtBreathingZone: flows.qOutdoorIn, co2AtMouth: CO2_OUT_DEFAULT + dc, co2Outdoor: CO2_OUT_DEFAULT, notes: 'STAND-IN' };
  }
  function feet(state, flows) {
    // STAND-IN: outdoor air entering below 0.6 m mixes with Q_MIX of room air in the lower zone
    const qLow = flows.openings.filter(o => o.q > 0 && o.h < 0.6).reduce((s, o) => s + o.q, 0);
    const cool = qLow / (qLow + Q_MIX);
    const up = T(0.55) - (T(0.55) - T_OUT) * cool, lowT = T(0.10) - (T(0.10) - T_OUT) * cool;
    const head = T(1.70);
    const f = Math.min(1, Math.max(0, ((up + lowT) / 2 - T_OUT) / (head - T_OUT)));
    return { ankleT_upper: up, ankleT_lower: lowT, ankleV: 0, feetFactor: f, notes: 'STAND-IN' };
  }
  const scoreMod = require('./score.js');
  function evaluate(state) {
    const flows = airflow(state), b = breathing(state, flows), ft = feet(state, flows);
    const sc = scoreMod.score({ breathing: b, feet: ft, flows, state });
    /* the page's rule: an open drying vent can only lower a score */
    const product = sc.breathingFactor * sc.feetFactor;
    const capRaw = (state.vent === 'yes' && state.dry === 'open') ? evaluate(Object.assign({}, state, { dry: 'closed' })).raw : null;
    const raw = capRaw != null ? Math.min(product, capRaw) : product;
    return { flows, breathing: b, feet: ft, breathingFactor: sc.breathingFactor, feetFactor: sc.feetFactor, capRaw, raw, score: Math.round(100 * raw), profile: T };
  }
  return { evaluate, airflow };
}

/* ---------- mutants: each breaks one law; the harness must catch it ---------- */
function scaleFlows(f, k) {
  const g = JSON.parse(JSON.stringify(f));
  g.openings.forEach(o => { o.q *= k; });
  for (const n of ['qOutdoorIn', 'qOutdoorOut', 'mainInletQ', 'mainExhaustQ', 'dryQ', 'doorLowQ', 'doorTopQ']) g[n] *= k;
  return g;
}
function mutants(base) {
  const ev = base.evaluate;
  const clone = r => Object.assign({}, r, { flows: JSON.parse(JSON.stringify(r.flows)), breathing: Object.assign({}, r.breathing), feet: Object.assign({}, r.feet) });
  const rescore = r => { r.score = Math.round(100 * r.breathingFactor * r.feetFactor * (r.loylyFactor != null ? r.loylyFactor : 1)); return r; };
  return [
    { target: 'H1', name: 'NaN feet in one state', evaluate: s => { const r = clone(ev(s)); if (s.inlet === 'middle' && s.fan === 'off' && s.duct === 'half' && s.heater === 'wall' && s.dry === 'open' && s.angle === 'up45' && s.exhaust === 'upper') { r.feetFactor = NaN; r.score = NaN; } return r; } },
    { target: 'H3', name: 'score ignores feet', evaluate: s => { const r = clone(ev(s)); r.score = Math.round(100 * r.breathingFactor); return r; } },
    { target: 'H3d', name: 'an open drying vent earns points', evaluate: s => { const r = clone(ev(s)); if (s.vent === 'yes' && s.dry === 'open') { r.capRaw = null; r.score = Math.min(100, r.score + 5); r.breathingFactor = Math.min(1, r.score / 100 / Math.max(1e-9, r.feetFactor)); } return r; } },
    { target: 'H5', name: 'outflows halved (mass not conserved)', evaluate: s => { const r = clone(ev(s)); r.flows.openings.forEach(o => { if (o.q < 0) o.q *= 0.5; }); let a = 0, b = 0, by = {}; r.flows.openings.forEach(o => { if (o.q > 0) a += o.q; else b -= o.q; by[o.name] = o.q; }); r.flows.qOutdoorIn = a; r.flows.qOutdoorOut = b; r.flows.mainInletQ = by.inlet || 0; r.flows.mainExhaustQ = by.exhaust || 0; r.flows.dryQ = by.dry || 0; r.flows.doorLowQ = by.doorLow || 0; r.flows.doorTopQ = by.doorTop || 0; return r; } },
    { target: 'H6', name: 'sealed room leaks through a main inlet', evaluate: s => { const r = clone(ev(s)); if (s.vent === 'none') { r.flows.mainInletQ = 0.004; r.flows.openings.push({ name: 'inlet', h: 0.98, q: 0.004, rho: RHO_OUT }); r.flows.qOutdoorIn += 0.004; } return r; } },
    { target: 'H9', name: 'high inlet never reverses', evaluate: s => { const r = clone(ev(s)); r.flows.reversed = false; return r; } },
    { target: 'H12', name: 'long duct below short duct (the duct paradox)', evaluate: s => { const r = clone(ev(s)); if (s.fan === 'off' && s.duct === 'riser') r.flows = scaleFlows(r.flows, 0.6); return r; } },
    { target: 'H11', name: 'upper grille below lower grille', evaluate: s => { const r = clone(ev(s)); if (s.fan === 'off' && s.exhaust === 'upper' && s.duct === 'straight') r.flows = scaleFlows(r.flows, 0.5); return r; } },
    { target: 'H13', name: 'fan three times its free-air flow', evaluate: s => { const r = clone(ev(s)); if (s.vent === 'yes' && s.fan === 'on') r.flows = scaleFlows(r.flows, 3); return r; } },
    { target: 'H14', name: 'drying vent warms the feet without a fan', evaluate: s => { const r = clone(ev(s)); if (s.vent === 'yes' && s.fan === 'off' && s.dry === 'open') { r.feetFactor = Math.min(1, r.feetFactor + 0.2); r.feet.feetFactor = r.feetFactor; rescore(r); } return r; } },
    { target: 'H15', name: 'breathing rises with CO₂', evaluate: s => { const r = clone(ev(s)); r.breathingFactor = Math.min(1, Math.max(0, (r.breathing.co2AtMouth - 420) / 4580)); return rescore(r); } },
    { target: 'H17', name: 'more fresh air at the mouth than enters the room', evaluate: s => { const r = clone(ev(s)); r.breathing.qFreshAtBreathingZone = r.flows.qOutdoorIn * 1.5; return r; } },
    { target: 'H21', name: 'non-deterministic', evaluate: (() => { let n = 0; return s => { const r = clone(ev(s)); r.flows.notes = 'x'; r.breathingFactor = Math.max(0, Math.min(1, r.breathingFactor) - 1e-9 * (++n)); return rescore(r); }; })() }
  ];
}

function selfTest(log = console.log) {
  const base = makeStandIn();
  log('--- stand-in model (must hold every hard invariant) ---');
  const run = runInvariants(base.evaluate, {});
  report(run, log, 2);
  let ok = run.ok;
  if (!run.ok) log('SELF-TEST: the stand-in breaks a hard invariant: either the stand-in or the invariant is wrong');
  log('--- mutants (each must be caught by its target invariant) ---');
  for (const m of mutants(base)) {
    const r = runInvariants(m.evaluate, {});
    const t = r.results.find(x => x.id === m.target);
    const caught = t && t.failures.length > 0;
    if (!caught) ok = false;
    log((caught ? 'caught ' : 'MISSED ') + m.target.padEnd(4) + ' ' + m.name + (caught ? '  (' + t.failures.length + ' failing; e.g. ' + t.failures[0].slice(0, 110) + ')' : ''));
  }
  log(ok ? 'SELF-TEST PASSED' : 'SELF-TEST FAILED');
  return ok;
}

module.exports = { runInvariants, report, enumerateStates, keyOf, makeStandIn, mutants, selfTest,
  CONST: { RHO_OUT, FAN_QFREE, FAN_PSHUT, DP_STACK_MAX, REF_FAN_LS, T_MAX_AIR } };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test') || !args.length) { process.exit(selfTest() ? 0 : 1); }
  const path = require('path');
  const mod = require(path.resolve(args[0]));
  if (typeof mod.evaluate !== 'function') { console.error('module exports no evaluate(state)'); process.exit(2); }
  const run = runInvariants(mod.evaluate, { module: mod });
  report(run);
  const ji = args.indexOf('--json');
  if (ji >= 0 && args[ji + 1]) require('fs').writeFileSync(args[ji + 1], JSON.stringify(run, null, 1));
  process.exit(run.hardFail || (args.includes('--strict') && run.expFail) ? 1 : 0);
}
