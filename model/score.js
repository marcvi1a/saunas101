'use strict';
/* Saunas 101 ventilation model, agent E: the score.

   score = round(100 × breathing × feet), 0 to 100.

   breathing: from the CO₂ at the bather's mouth (agent C, ppm, 30 minutes into the session, 2 bathers).
     It is 1 at or below EN 16798-1 Category I (550 ppm above outdoor air) and 0 at the CO₂ of a sealed room with
     the same heater (evaluate.js passes it as zeroCO2), so the page's scale runs from a sealed sauna to the best layout;
     without zeroCO2 the zero falls back to the 5,000 ppm occupational limit. Between the two it falls with the share of people who find the air
     unacceptable, Fanger's dissatisfied-versus-ventilation curve, which is the curve EN 16798-1's
     categories are cut from (Cat I/II/III/IV = 15/20/30/40 % dissatisfied at 10/7/4/2.5 l/s per person):

       PD(ΔC) = 395 · exp(−1.83 · q^0.25)  %,   q = G / ΔC = 5,556 / ΔC   (l/s per person, ΔC in ppm above outdoor)
       breathing = (PD(5,000 − C_out) − PD(ΔC)) / (PD(5,000 − C_out) − PD(550)),  clamped to [0, 1]

   feet: agent D's feetFactor, passed through unchanged (no floor, no clamp) so the harness sees what D produced.

   Every number below is a cited standard value or a unit conversion; see E_report.md. */

// CO₂ emission of one standard (non-adapted, sedentary) person that EN 16798-1 uses to turn l/s per person into ppm.
// EN 16798-1:2019 Annex B, default design CO₂ concentrations "assuming a standard CO₂ emission of 20 L/(h·person)";
// table reproduced in B. W. Olesen, Revision of EPBD standards, REHVA 2015.
const G_STD_L_PER_H = 20;
const G_STD_ML_PER_S = G_STD_L_PER_H * 1000 / 3600;          // 5.556 mL/s per person
const PPM_LS = G_STD_ML_PER_S / 1000 * 1e6;                    // q (l/s) = 5,556 / ΔC (ppm)

// Fanger, P. O. (1988), Introduction of the olf and the decipol units, Energy and Buildings 12, 1–6;
// CEN CR 1752:1998; the basis of EN 16798-1 Method 1 categories. Valid for q ≥ 0.32 l/s per olf, PD = 100 % below it.
const PD_A = 395, PD_B = 1.83, PD_EXP = 0.25, PD_QMIN = 0.32;

// Anchors.
const DC_CAT_I = 550;      // ppm above outdoor: EN 16798-1 Category I (10 l/s per person, 15 % dissatisfied); the site's own fan rule, 10 l/s per bather
const C_LIMIT = 5000;      // ppm absolute: 8-h TWA limit (EU IOELV 9,000 mg/m³; OSHA PEL; NIOSH REL; ACGIH TLV)
const C_OUT_DEFAULT = 420; // ppm outdoor, the page's own figure; NOAA GML global mean 2024 = 422.7 ppm

/* Percentage dissatisfied (0–100) for an outdoor-air rate q in l/s per standard person. */
function pdFromQ(q) {
  if (!(q >= 0)) return NaN;
  if (q < PD_QMIN) return 100;
  return Math.min(100, PD_A * Math.exp(-PD_B * Math.pow(q, PD_EXP)));
}

/* Percentage dissatisfied for a CO₂ rise ΔC (ppm above outdoor), through q = G / ΔC. */
function pdFromDeltaCO2(dc) {
  if (!Number.isFinite(dc)) return NaN;
  if (dc <= 0) return 0;
  return pdFromQ(PPM_LS / dc);
}

/* Breathing factor for one mouth. c: CO₂ at the mouth (ppm); cOut: outdoor CO₂ (ppm). */
function breathingFactorFromCO2(c, cOut, cZero) {
  const co = Number.isFinite(cOut) ? cOut : C_OUT_DEFAULT;
  const cz = Number.isFinite(cZero) ? cZero : C_LIMIT;
  if (!Number.isFinite(c)) return NaN;
  const dc = c - co;
  if (dc <= DC_CAT_I) return 1;
  if (c >= cz) return 0;
  const pdGood = pdFromDeltaCO2(DC_CAT_I);
  const pdLimit = pdFromDeltaCO2(cz - co);
  const f = (pdLimit - pdFromDeltaCO2(dc)) / (pdLimit - pdGood);
  return Math.min(1, Math.max(0, f));
}

/* The CO₂ values to score. Agent C gives co2AtMouth as a number (the upper-bench bather) or, optionally,
   co2AtMouthByBather as an array; with several mouths the factor is the mean over bathers, since PD is a
   share of people and each bather counts once. */
function mouthValues(breathing) {
  if (!breathing) return [NaN];
  if (Array.isArray(breathing.co2AtMouthByBather) && breathing.co2AtMouthByBather.length) return breathing.co2AtMouthByBather;
  if (Array.isArray(breathing.co2AtMouth) && breathing.co2AtMouth.length) return breathing.co2AtMouth;
  return [breathing.co2AtMouth];
}

function score({ breathing, feet, zeroCO2, loyly, heat /* , flows, state */ }) {
  const cOut = breathing && Number.isFinite(breathing.co2Outdoor) ? breathing.co2Outdoor : C_OUT_DEFAULT;
  const vals = mouthValues(breathing);
  let sum = 0;
  for (const c of vals) sum += breathingFactorFromCO2(c, cOut, zeroCO2);
  const breathingFactor = sum / vals.length;
  const feetFactor = feet ? feet.feetFactor : NaN;
  /* löyly: the share of the heater's steam-carrying rising air that comes down to the benches instead of leaving at the ceiling (evaluate.js, from breathing.routes); 1 when not given */
  const loylyFactor = Number.isFinite(loyly) ? loyly : 1;
  /* heat: the share of the room's heat (thermostat over outdoor) the bathers sit in, from ankles to mouth (evaluate.js); 1 when not given */
  const heatFactor = Number.isFinite(heat) ? heat : 1;
  const raw = 100 * breathingFactor * feetFactor * loylyFactor * heatFactor;
  return { breathingFactor, feetFactor, loylyFactor, heatFactor, score: Number.isFinite(raw) ? Math.round(raw) : NaN };
}

/* The mapping as a table, for the report and the page note. */
function table(cOut = C_OUT_DEFAULT, points = [970, 1000, 1220, 1500, 1770, 2000, 2500, 3000, 4000, 5000]) {
  return points.map(c => ({ co2: c, deltaCO2: c - cOut, qPerPerson: +(PPM_LS / Math.max(c - cOut, 1e-9)).toFixed(2),
    pd: +pdFromDeltaCO2(c - cOut).toFixed(2), breathingFactor: +breathingFactorFromCO2(c, cOut).toFixed(3) }));
}

module.exports = {
  score, breathingFactorFromCO2, pdFromQ, pdFromDeltaCO2, table,
  CONST: { G_STD_L_PER_H, PPM_LS, PD_A, PD_B, PD_EXP, PD_QMIN, DC_CAT_I, C_LIMIT, C_OUT_DEFAULT }
};

if (require.main === module) {
  console.log('CO2 at mouth -> breathing factor (outdoor ' + C_OUT_DEFAULT + ' ppm)');
  console.table(table());
}
