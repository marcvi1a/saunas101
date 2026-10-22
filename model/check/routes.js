/* check/routes.js: every state through evaluate.js, then breathing.routes(), the zonal routing the drawing follows.
   Checks, per state:
     1. each stream's shares sum to its inflow: toHeater + toFloor + toBenches = q (1e-9 l/s), with
        0 ≤ floorToOutlet ≤ toFloor, 0 ≤ heaterToOutlet ≤ toHeater, reachesMouth = q − floorToOutlet − heaterToOutlet;
     2. the streams' outdoor air adds up to flows.qOutdoorIn within 1 %;
     3. every stream enters and every outlet leaves through an opening that runs that way in flows, and every opening
        carrying air in flows is listed once;
     4. Σ reachesMouth = breathing.qFreshAtBreathingZone (1e-6 relative), so the drawing and the score tell the same story;
     5. stale lies in [0, 1], the plume and the floor layer are finite.
   Run: node check/routes.js  (prints the failures, a summary, and the routes of five reference layouts) */
const path = require('path');
const ev = require(path.join(__dirname, '..', 'evaluate.js'));
const br = require(path.join(__dirname, '..', 'breathing.js'));

const TINY = 1e-9;                                       // m³/s: an opening carrying less is treated as shut
const fails = { shares: [], total: [], direction: [], reach: [], bounds: [] };
let n = 0, worstTotal = 0, worstReach = 0, worstShare = 0;
for (const st of ev.allStates()) {
  n++;
  const r = ev.evaluate(st), b = r.breathing, R = br.routes(st, r.flows, b);
  const key = ev.hashKey(st);
  /* 1. shares */
  for (const s of R.streams) {
    const err = Math.abs(s.toHeater + s.toFloor + s.toBenches - s.q);
    worstShare = Math.max(worstShare, err);
    const bad = err > 1e-9 || s.floorToOutlet < -1e-12 || s.floorToOutlet > s.toFloor + 1e-9 || s.heaterToOutlet < -1e-12 || s.heaterToOutlet > s.toHeater + 1e-9
      || Math.abs(s.reachesMouth - (s.q - s.floorToOutlet - s.heaterToOutlet)) > 1e-9 || [s.toHeater, s.toFloor, s.toBenches].some(v => v < -1e-12);
    if (bad) fails.shares.push(key + ' ' + s.from + ': q ' + s.q + ' heater ' + s.toHeater + ' floor ' + s.toFloor + ' benches ' + s.toBenches + ' short ' + s.floorToOutlet);
  }
  /* 2. total */
  const qIn = R.streams.reduce((a, s) => a + s.q, 0), qF = r.flows.qOutdoorIn * 1000;
  const rel = Math.abs(qIn - qF) / qF; worstTotal = Math.max(worstTotal, rel);
  if (rel > 0.01) fails.total.push(key + ': streams ' + qIn.toFixed(3) + ' l/s vs flows ' + qF.toFixed(3));
  /* 3. directions */
  const dirOf = {}; for (const o of r.flows.openings) if (Math.abs(o.q) > TINY) dirOf[o.role || o.name] = Math.sign(o.q);
  const listed = {};
  for (const s of R.streams) { if (dirOf[s.from] !== 1) fails.direction.push(key + ': stream ' + s.from + ' runs ' + dirOf[s.from] + ' in flows'); listed[s.from] = (listed[s.from] || 0) + 1; }
  for (const o of R.outlets) { if (dirOf[o.to] !== -1) fails.direction.push(key + ': outlet ' + o.to + ' runs ' + dirOf[o.to] + ' in flows'); if (!(o.q > 0)) fails.direction.push(key + ': outlet ' + o.to + ' q ' + o.q); listed[o.to] = (listed[o.to] || 0) + 1; }
  for (const k in dirOf) if (listed[k] !== 1) fails.direction.push(key + ': opening ' + k + ' listed ' + (listed[k] || 0) + ' times');
  /* 4. reach */
  const reach = R.streams.reduce((a, s) => a + s.reachesMouth, 0), qBZ = b.qFreshAtBreathingZone * 1000;
  const rr = Math.abs(reach - qBZ) / Math.max(qBZ, 1e-9); worstReach = Math.max(worstReach, rr);
  if (rr > 1e-6) fails.reach.push(key + ': Σ reachesMouth ' + reach.toFixed(4) + ' l/s vs qFreshAtBreathingZone ' + qBZ.toFixed(4));
  /* 5. bounds */
  if (!(R.stale >= 0 && R.stale <= 1) || !isFinite(R.plume) || !(R.floorLayer.h >= 0)) fails.bounds.push(key + ': stale ' + R.stale + ' plume ' + R.plume + ' layer ' + JSON.stringify(R.floorLayer));
}
let total = 0;
for (const k in fails) { total += fails[k].length; console.log((fails[k].length ? 'FAIL ' : 'ok   ') + k.padEnd(10) + fails[k].length + ' failing'); fails[k].slice(0, 5).forEach(x => console.log('        ' + x)); }
console.log(n + ' states; worst share error ' + worstShare.toExponential(2) + ' l/s; worst total mismatch ' + (100 * worstTotal).toFixed(4) + ' %; worst reach mismatch ' + worstReach.toExponential(2));

/* five reference layouts */
const show = [
  ['(a) fan, inlet above, lower grille, open heater', { vent: 'yes', inlet: 'above', exhaust: 'lower', fan: 'on', duct: 'straight', heater: 'open', angle: 'straight', dry: 'closed' }],
  ['(b) fan, floor inlet, lower grille, open heater', { vent: 'yes', inlet: 'bottom', exhaust: 'lower', fan: 'on', duct: 'straight', heater: 'open', angle: 'straight', dry: 'closed' }],
  ['(c) no fan, low inlet, lower grille', { vent: 'yes', inlet: 'below', exhaust: 'lower', fan: 'off', duct: 'straight', heater: 'open', angle: 'straight', dry: 'closed' }],
  ['(d) no fan, low inlet, upper grille, long duct', { vent: 'yes', inlet: 'below', exhaust: 'upper', fan: 'off', duct: 'riser', heater: 'open', angle: 'straight', dry: 'closed' }],
  ['(e) no ventilation', { vent: 'none', heater: 'open' }]
];
const f1 = v => (v == null ? '-' : v.toFixed(1));
for (const [name, st] of show) {
  const r = ev.evaluate(st), R = br.routes(st, r.flows, r.breathing);
  console.log('\n' + name + '  [' + ev.hashKey(st) + ']  CO₂ ' + Math.round(r.breathing.co2AtMouth) + ' ppm, fraction ' + r.breathing.fractionToBreathingZone.toFixed(2) + ', stale ' + R.stale.toFixed(2) + ', plume ' + f1(R.plume) + ' l/s, floor layer ' + (R.floorLayer.stable ? (100 * R.floorLayer.h).toFixed(0) + ' cm at ' + f1(R.floorLayer.T) + ' °C' : 'none'));
  for (const s of R.streams) console.log('  in  ' + s.from.padEnd(8) + ' q ' + f1(s.q).padStart(5) + ' | heater ' + f1(s.toHeater).padStart(5) + ' floor ' + f1(s.toFloor).padStart(5) + ' (short ' + f1(s.floorToOutlet) + (s.floorOutlet ? ' → ' + s.floorOutlet : '') + ') benches ' + f1(s.toBenches).padStart(5) + ' | reaches mouth ' + f1(s.reachesMouth));
  for (const o of R.outlets) console.log('  out ' + o.to.padEnd(8) + ' q ' + f1(o.q).padStart(5) + ' from ' + o.fromZone);
  R.notes.forEach(x => console.log('  · ' + x));
}
process.exit(total ? 1 : 0);
