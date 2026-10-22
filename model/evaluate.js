/* the ventilation model: the airflow network and the room's temperature profile iterated to agreement, then breathing at the upper bather's mouth, the bathers' feet and the score.
   Every number traces to a physical constant, the drawing, a cited source or a formula; docs/ holds the derivations and the sources. */
const airflow = require("./airflow.js"), breathing = require("./breathing.js"), feet = require("./feet.js"), score = require("./score.js");

/* the two settings the page states: a well-fitted door with a 2 mm gap under it, and the air judged once it has settled (steady state, so no session length is chosen) */
const SETTINGS = { doorGapLow: 0.002, sessionS: Infinity };
airflow.PARAMS.doorGapLow = SETTINGS.doorGapLow;
breathing.GEO.door.low1 = breathing.GEO.door.low0 + SETTINGS.doorGapLow;
breathing.CONST.sessionS = SETTINGS.sessionS;
if (Math.abs(feet.GEO.door.gapLow - SETTINGS.doorGapLow) > 1e-9) throw new Error("feet.js carries a different door gap from SETTINGS");

/* breathing's zero: the CO₂ at the mouth in a sealed room with the same heater, so a sealed sauna scores 0 and every vented layout is measured from it */
const SEALED = {};
function sealedCO2(heater) { if (!(heater in SEALED)) SEALED[heater] = evaluate({ vent: "none", heater }).breathing.co2AtMouth; return SEALED[heater]; }

const ITER = 6, TOL = 1e-5;   /* m³/s on the outdoor inflow: the profile and the flows agree within it */
function evaluate(state) {
  let prof = airflow.defaultProfile, flows = airflow.airflow(state, prof), last = flows.qOutdoorIn, it, conv = false;
  for (it = 1; it <= ITER; it++) {
    const T = feet.profile(state, flows);
    prof = h => T(h);
    flows = airflow.airflow(state, prof);
    if (Math.abs(flows.qOutdoorIn - last) < TOL) { conv = true; break; }
    last = flows.qOutdoorIn;
  }
  const b = breathing.breathing(state, flows), f = feet.feet(state, flows);
  const zeroCO2 = state.vent === "none" ? b.co2AtMouth : sealedCO2(state.heater);
  const s = score.score({ breathing: b, feet: f, flows, state, zeroCO2 });
  return { flows, breathing: b, feet: f, breathingFactor: s.breathingFactor, feetFactor: s.feetFactor, score: s.score, iter: it, converged: conv };
}

/* the page's address words, the same as lab.js uses: 7 words in switch order, no-<heater> for no ventilation */
const HASH_WORD = { inlet: { above: "above", middle: "middle", below: "low", bottom: "floor" }, fan: { on: "exhaust", off: "none" }, duct: { straight: "none", riser: "long", half: "short", inletduct: "inlet" }, angle: { straight: "straight", up45: "45" } };
const hashKey = s => s.vent === "none" ? "no-" + s.heater : [HASH_WORD.inlet[s.inlet], s.exhaust, HASH_WORD.fan[s.fan], HASH_WORD.duct[s.duct], s.heater, HASH_WORD.angle[s.angle], s.dry].join("-");

module.exports = { evaluate, allStates: airflow.allStates, hashKey, SETTINGS };
