/* compares the two independent airflow networks over every valid state, with the same room profile fed to both */
const A = require("../airflow.js"), B = require("./airflow-b.js");
const states = A.allStates();
const prof = A.defaultProfile;
const get = (r, role) => {
  const o = r.openings.find(x => (x.role || x.name) === role);
  return o ? o.q * 1000 : 0;
};
const rows = [];
for (const s of states) {
  const a = A.airflow(s, prof), b = B.airflow(s, prof);
  const qa = a.qOutdoorIn * 1000, qb = b.qOutdoorIn * 1000;
  const ea = (a.mainExhaustQ || 0) * 1000, eb = (b.mainExhaustQ || 0) * 1000;
  const ia = (a.mainInletQ || 0) * 1000, ib = (b.mainInletQ || 0) * 1000;
  const da = (a.dryQ || 0) * 1000, db = (b.dryQ || 0) * 1000;
  const rel = Math.abs(qa - qb) / Math.max(1, (qa + qb) / 2);
  const signFlip = (Math.sign(Math.round(ia * 10)) !== Math.sign(Math.round(ib * 10))) || (Math.sign(Math.round(ea * 10)) !== Math.sign(Math.round(eb * 10)));
  rows.push({ s, qa, qb, rel, ia, ib, ea, eb, da, db, signFlip, ra: !!a.reversed, rb: !!b.reversed });
}
const key = s => s.vent === "none" ? "none-" + s.heater : [s.inlet, s.exhaust, s.fan, s.duct, s.heater, s.angle, s.dry].join("-");
const f = x => x.toFixed(1);
console.log("states:", rows.length);
const buckets = [0.05, 0.1, 0.2, 0.3, 0.5, 1e9];
const counts = buckets.map((b, i) => rows.filter(r => r.rel <= b && (i === 0 || r.rel > buckets[i - 1])).length);
console.log("qOutdoorIn relative difference A vs B: <=5% " + counts[0] + " | 5-10% " + counts[1] + " | 10-20% " + counts[2] + " | 20-30% " + counts[3] + " | 30-50% " + counts[4] + " | >50% " + counts[5]);
console.log("direction disagreements on inlet or exhaust:", rows.filter(r => r.signFlip).length, "| reversed flag disagreements:", rows.filter(r => r.ra !== r.rb).length);
const byFan = fan => { const rr = rows.filter(r => r.s.fan === fan && r.s.vent !== "none"); return "median rel " + (rr.map(r => r.rel).sort((a, b) => a - b)[Math.floor(rr.length / 2)] * 100).toFixed(1) + "%"; };
console.log("fan on:", byFan("on"), "| fan off:", byFan("off"));
console.log("\nworst 15 by relative difference:");
rows.slice().sort((x, y) => y.rel - x.rel).slice(0, 15).forEach(r => console.log(key(r.s).padEnd(44), "A", f(r.qa).padStart(6), "B", f(r.qb).padStart(6), "| inlet", f(r.ia), "/", f(r.ib), "| exh", f(r.ea), "/", f(r.eb), "| dry", f(r.da), "/", f(r.db)));
const groups = {};
rows.filter(r => r.rel > 0.2).forEach(r => { const g = r.s.vent === "none" ? "none" : [r.s.fan, r.s.duct, r.s.dry, r.s.inlet].join("/"); groups[g] = (groups[g] || 0) + 1; });
console.log("\n>20% disagreements grouped fan/duct/dry/inlet:", JSON.stringify(groups));
