# Agent E: the score, the validation targets, the invariant harness

Files in this folder:

- `E_score.js`: `score({breathing, feet, flows, state})`. Running `node E_score.js` prints the CO₂-to-breathing table.
- `E_invariants.js`: the harness. Run `node E_invariants.js model.js [--strict] [--json out.json]`, or `--self-test`.
- `E_validation.md`: 20 targets with sources.
- `E_scores_standin.csv`: all 651 states scored on a **stand-in** airflow, CO₂ and feet model. It is not a proposal; it shows how breathing spreads under well-mixed CO₂.

Status: the self-test passes. The stand-in holds every hard invariant, and all 12 mutants are caught.

## 1. The score (what the page note can say)

> **Score = 100 × breathing × feet × löyly × heat**, rounded, then scaled so the model's best state is 100; an open drying vent scores no more than the same layout shut (evaluate.js).
> **Breathing** = (PD(4,580) − PD(ΔCO₂)) / (PD(4,580) − PD(550)), between 0 and 1, where PD(ΔC) = 395·e^(−1.83·q^0.25) and q = 5,556 / ΔC. ΔC is CO₂ above outdoor air at the mouth, 30 minutes in.

In words: breathing is 1 when the air at the mouth is as fresh as EN 16798-1's best category (550 ppm above outdoor, about 970 ppm here) and 0 at the CO₂ of a sealed room with the same heater. Löyly is the share of the heater's rising air that comes down to the benches instead of leaving at the ceiling. Heat is the share of the room's heat, 90 °C at the thermostat over 25 °C outdoor, that the two bathers sit in, averaged from ankles to mouth. In between it follows the share of people who find the air stale.

| CO₂ at mouth (outdoor 420) | 970 | 1,000 | 1,220 | 1,500 | 1,770 | 2,000 | 2,500 | 3,000 | 4,000 | 5,000 |
|---|---|---|---|---|---|---|---|---|---|---|
| equivalent l/s per person | 10.1 | 9.6 | 6.9 | 5.1 | 4.1 | 3.5 | 2.7 | 2.2 | 1.6 | 1.2 |
| % dissatisfied (Fanger) | 15.1 | 15.8 | 20.3 | 25.1 | 29.2 | 32.2 | 38.1 | 43.0 | 51.2 | 57.9 |
| **breathing** | **1** | 0.98 | 0.88 | 0.77 | 0.67 | 0.60 | 0.46 | 0.35 | 0.16 | **0** |

The 1,220 and 1,770 columns are EN 16798-1's Category II and III limits. 2,000 is the UBA "hygienically unacceptable" line.

## 2. Breathing: derivation

**Why CO₂ at the mouth.** The page's question is what the bather breathes. CO₂ at the mouth folds three things into one number with a cited human response:

- how much outdoor air enters (A/B),
- how much of it reaches the breathing zone (C),
- how many people are emitting.

The current page divides fresh air by need, which is linear in l/s. That only works at steady state and gives no meaning to "half the need".

**Why this curve.** The only cited dose-response between ventilation and people is Fanger's: PD = 395·exp(−1.83·q^0.25), valid for q ≥ 0.32 l/s per olf (Fanger 1988; CEN CR 1752:1998). EN 16798-1 cuts its categories from it: Categories I, II, III and IV are 15, 20, 30 and 40 % dissatisfied at 10, 7, 4 and 2.5 l/s per person. `E_score.pdFromQ` reproduces 15.3, 20.1, 29.7 and 39.6 %.

EN 16798-1 converts l/s to ppm with a standard 20 L/h CO₂ per person, so q = 5,556 / ΔC. Its default Category I/II/III rises are 550, 800 and 1,350 ppm.

The curve is steep just above good air and flat near the limit, as psychophysical odour perception is (Stevens' power law). Going from 1,000 to 1,500 ppm costs more than going from 4,000 to 4,500.

The curve describes the first impression of a visitor entering the room. That is exactly a bather coming back in for the next round.

**Why these anchors.**

- **1 at Category I (ΔC 550).** Category I is 10 l/s per person, which is the site's own fan rule (rule 17: 5 l/s per seat, sized for half of 4 seats, so 10 l/s per bather). It also equals the page's current "near 1,000 ppm" statement.
- **0 at 5,000 ppm absolute.** This is the 8-hour exposure limit everywhere: OSHA PEL, NIOSH REL, ACGIH TLV, and the EU IOELV of 9,000 mg/m³. It is the only cited limit that is a ceiling rather than a design or action level.
- **Rejected zero anchors.** EN 16798-1's health minimum of 4 l/s per person (ΔC 1,350) and UBA's 2,000 ppm are design and ventilation-action levels for rooms occupied for hours. As zeros they would give every gravity layout breathing 0 (see the alternatives table).

Confidence: high on the curve, high on the anchor values, moderate on the choice of anchors (a judgment, stated).

**Two bathers.** If C returns `co2AtMouthByBather` (or an array), breathing is the mean of the per-bather factors. PD is a share of people, so each bather counts once. With a single number it uses that mouth.

**Alternatives compared** (stand-in, well-mixed CO₂ at 30 min):

| state | CO₂ | **chosen** | linear 970→5,000 ppm | 550/ΔC (the page's current logic) | UBA linear 1,000→2,000 | PD, Cat I→Cat III |
|---|---|---|---|---|---|---|
| reference (Above, lower grille, fan) | 958 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 |
| low inlet, long duct, no fan | 1,417 | **0.80** | 0.89 | 0.55 | 0.58 | 0.39 |
| Gravity preset (Low, upper grille, no fan) | 1,581 | **0.74** | 0.85 | 0.47 | 0.42 | 0.20 |
| sealed room | 1,900 | **0.63** | 0.77 | 0.37 | 0.10 | 0.00 |

**Sensitivities, in order of size.**

1. **Read time.** For the sealed room, breathing is 0.63 at 30 min, 0.33 at 60 min and 0.04 at 2 h (3,064 and 4,695 ppm at 1 h and 2 h). The reference stays at about 950–976 ppm throughout. The 30-minute read is the brief's choice, and it is the biggest lever on how bad "no ventilation" looks.
2. **Bather CO₂ emission (C's choice).** 20 L/h is the sedentary standard. If a sauna bather emits 1.5× that, the sealed room at 30 min reads about 2,900 ppm and breathing about 0.36.
3. **Outdoor CO₂.** 420 against 428 ppm moves breathing by under 0.01.

## 3. Humidity: not in breathing

1. **Same dilution as CO₂.** Water vapour from löyly and CO₂ from mouths are both room-generated and removed by the same outdoor air. For a given flow pattern their dilution is governed by the same delivery. Adding humidity would mostly re-weight the same signal, while needing a löyly dose and an uncited acceptable limit.
2. **The bather sets the dose.** Humidity is what a sauna is for. How much water is thrown is the bather's choice, so a humidity term would score the ladle, not the vents.
3. **Its harm is thermal.** Condensation on skin and airways is a heat-stress effect, not a breathing one.
4. **Used instead as a tracer.** VTT 1992 used humidity to measure ventilation effectiveness above the seat bench (125 g every 5 min). Its result, that a low inlet plus low exhaust short-circuits, is validation target #7–#8 for C.

Confidence: moderate.

## 4. Feet: review and conditions on D's mapping

**ISO 7730 vertical difference does not work here.** Its formula is PD = 100/(1 + e^(5.76 − 0.856·Δt)), valid for Δt < 8 K. Sauna head-to-ankle differences are 15–50 K (VTT 2002 S5 to S6), where it gives 94–100 % for every layout. As a factor it would zero every score through the product.

**The ISO 7730 draught rate does not work either.** DR = (34 − t)(v − 0.05)^0.62(0.37·v·Tu + 3.14) is valid for 20–26 °C air. It goes to zero or negative above 34 °C, which covers almost all sauna ankle air, so it would rate every layout draught-free. The ISO floor-temperature formula is calibrated for 19–29 °C floors and calls a 40 °C floor too warm. Inverted for a sauna.

**Conditions D's `feetFactor` must meet:**

1. Range 0–1, no floor. The page's "cold feet can halve a score, never zero it" is a hand-set 0.5 floor; I found no standard that gives one. Either D derives a floor or that sentence goes.
2. Non-decreasing in ankle air temperature at a fixed head temperature.
3. Non-increasing in ankle air speed, but only while ankle air is below skin temperature (34 °C is ISO 7730's own cut). Above that, air movement heats the feet.
4. Anchored on sauna data, not office data:
   - VTT 1992 p. 32: foot bench 60–65 °C with the head at 90 °C (a 25–30 K difference) in the recommended layout; foot-bench range 50–80 °C.
   - VTT 2002's verdicts: 15 K "only" (S5), 25 K acceptable "since the level is high enough" (S4), 50 K poor (S6).

   Preferably state it as the head-to-ankle difference. Both VTT reports do, and our thermostat sits at the ceiling above the heater, while VTT 1992's sat at head height.
5. Both bathers count equally (mean), consistent with breathing. The lower bather's ankles at 0.10 m sit in the coldest layer, 24–48 °C in VTT's profiles, and will dominate. D should state whether that bather's feet are on the floor.
6. No direct dependence on CO₂ or fresh-air rate, so nothing is counted twice.
7. Drying vent:
   - Fan off: opening it may not raise feet. A high outlet raises the neutral plane and draws more outdoor air in low.
   - Fan on: it may raise feet. The vent becomes a ceiling inlet and takes inflow away from the floor openings. This direction is physics, not a bug.

## 5. Invariants (E_invariants.js)

| id | tier | invariant | why |
|---|---|---|---|
| H1 | hard | every interface field present, finite | interface |
| H2 | hard | factors in [0, 1]; score an integer in [0, 100] | page structure |
| H3 | hard | score = round(100·min(b·f·l·h, the drying-vent cap)) ±1 | page structure |
| H4 | hard | qOutdoorIn = Σ inflows, qOutdoorOut = Σ outflows, named flows sum = openings sum | bookkeeping |
| H5 | hard | Σρ·q = 0 within 1 %. Uses per-opening ρ or T, else `profile(h)`, else a density band: out/in volume between 1 and ρ(25 °C)/ρ(110 °C) = 1.285 | conservation of mass; outgoing air is never colder than incoming |
| H6 | hard | sealed room: no main or drying-vent flow; result independent of every switch but the heater | brief |
| H7 | hard | qOutdoorIn > 0 in every state | door gaps at two heights in a heated room always exchange air |
| H8 | hard | no fan, no duct: every inflow opening lies below every outflow opening; consistent with the reported neutral plane | indoor-minus-outdoor pressure rises with height whenever the room is warmer than outdoors |
| H9 | hard | no fan, no duct, drying vent shut, inlet above the grille (Above over either grille, Middle over the lower): mainInletQ < 0 and reversed | brief. The 70 cm² undercut keeps the neutral plane below 0.45 m |
| H10 | expected | same conditions with a Low or Floor inlet: runs forward | geometry and areas |
| H11 | hard | no fan, Low or Floor inlet, drying vent shut: lower ≤ upper grille; per grille none ≤ short ≤ long | brief. Applied while the grille carries air out in both states; otherwise noted. Raising an opening that carries air in lowers the exchange, which is real physics |
| H11x | expected | upper grille without duct ≤ lower grille with short duct | the two are within a few % of each other; not a law |
| H12 | hard | no fan, drying vent shut: long ≥ short, any inlet (all sit below 1.18 m), either grille | brief |
| H12d | expected | the same with the drying vent open | a grille can turn into an inlet under an open drying vent |
| H13 | hard | fan on: the fan path extracts; extract ≤ free air × (1 + max stack / shut-off) ≈ 38.5 l/s; extract ≥ no-fan extract; outdoor inflow ≥ no-fan inflow (−2 %); on the module's `fanCurve` within 2 % if exported | fan curve, network monotonicity |
| H13r | expected | reference extract 15–25 l/s and running forward | brief's "about 20 l/s", manuals |
| H14 | expected | fan off: opening the drying vent never raises feet. Fan on: reported only | brief, refined (§4.7) |
| H15 | hard | breathingFactor never rises with CO₂ at the mouth | the score's own monotonicity |
| H16 | expected | more breathing-zone fresh air (by more than 5 %) never lowers breathingFactor | brief. Holds if C's CO₂ falls with qFresh |
| H17 | hard | CO₂ ≥ outdoor; 0 ≤ fraction ≤ 1; qFresh ≤ qOutdoorIn | a fraction is a fraction |
| H18 | expected | no fan: opening the drying vent raises inflow; every vented no-fan state ≥ the sealed room | adding an opening to a stack-driven room never lowers its exchange at fixed temperatures (area theorem) |
| H19 | expected | inlet angle changes inflow ≤ 5 % | the angle aims the jet; it does not change the orifice law |
| H20 | hard | ankle air in [24.5, 95] °C; `profile(h)` non-decreasing if given | stable stratification under a 90 °C ceiling |
| H20b | expected | upper ankles (0.55 m) ≥ lower ankles (0.10 m) | stratification |
| H21 | hard | deterministic | brief |
| H22 | hard | < 1 ms per state | brief |
| H23 | expected | the reference outscores every sealed room | VTT, every manual |

**Self-test.** The stand-in passes every hard invariant. One mutant per target (NaN, score without feet, halved outflows, a leaking sealed room, no reversal, the duct paradox, a grille paradox, 3× fan, the drying vent warming the feet, inverted breathing, qFresh above inflow, non-determinism) is each caught by its target invariant.

## 6. Findings from the stand-in (depend on its placeholders; for A/B/C/D to confirm)

- **F1, the door undercut is a second inlet as large as the real one.** 0.70 × 0.010 m × Cd 0.61 = 43 cm² effective, against 45 cm² for a Ø125 grille with 60 % free area. With the fan on, about half the outdoor air enters under the door at floor level (stand-in: 10.0 of 19.5 l/s).
  - Consequence: the "Mechanical" layout is half floor-fed, so its feet and breathing-zone delivery will fall short of VTT 1992's sealed-door lab.
  - VTT 2002 recommends sealing the door's sides and top and venting under the door only as an exhaust to the washroom.
  - The lead should confirm the 10 mm.
- **F2, with the fan on, an open drying vent is an inlet** (+2 l/s at the ceiling). The old "drying vent halves the feet" has no basis with a fan.
- **F3, the duct paradox disappears.** No fan, Low inlet: no duct 3.1 l/s, upper grille 5.1, short duct 5.9, long duct 7.6.
- **F4, the sealed room exchanges about 1.6 l/s (0.5 ACH).** That puts CO₂ at about 1,900 ppm at 30 min and breathing at 0.63 (the current page has about 0.03).
  - Across all 651 states, breathing runs 0.63–1.00 with a median of 0.91, and every fan state is ≥ 0.995.
  - So under any cited CO₂ criterion and a 30-minute read, **feet will decide most of the ranking**. If the page should punish "no ventilation" harder, the honest levers are the read time (60 min gives 0.33) or a stricter cited zero (UBA 2,000 ppm, EN 16798-1's 4 l/s health minimum), not a factor.
- **F5, a high inlet with the fan on reverses when extract falls below about 5 l/s** with the 10 mm undercut. This matches VTT 2002 S9 qualitatively (reversed at 7.8 l/s, door gap unknown).
- **F6, the inlet duct, modelled as running outside from a mouth at floor level, stalls a reversed layout.** Inlet 0, exchange falls to the door gap's 2.4 l/s, which matches the page's own claim. But lab.js's `IDUCT` comment says it runs *inside* the room. The two readings give opposite physics, so A/B must pick one and the lead must confirm it.

## 7. Constants

| constant | value | source | confidence |
|---|---|---|---|
| standard CO₂ emission | 20 L/h per person | EN 16798-1:2019 Annex B default CO₂ table (reproduced in Olesen, *Revision of EPBD standards*, REHVA 2015) | high |
| Fanger PD | 395·e^(−1.83 q^0.25), q ≥ 0.32 | Fanger 1988, Energy and Buildings 12:1–6; CEN CR 1752:1998 | high |
| Category I rise | 550 ppm (10 l/s per person, 15 %) | EN 16798-1 (Olesen 2015) | high |
| CO₂ limit | 5,000 ppm (9,000 mg/m³) 8-h TWA | OSHA PEL; NIOSH REL; ACGIH TLV; EU IOELV (2006) | high (value), moderate (as zero) |
| outdoor CO₂ | 420 ppm | page; NOAA GML 2024 global mean 422.7 | high |
| UBA bands (rejected as zero) | < 1,000 harmless, 1,000–2,000 conspicuous, > 2,000 unacceptable | UBA ad-hoc group, Bundesgesundheitsblatt 51:1358–1369 (2008) | high |
| ISO 7730 relations (for D, rejected) | vertical, draught and floor formulas above | ISO 7730:2005 | high |
| harness: g, R_air, p | 9.80665, 287.05, 101,300 | physical constants; brief | high |
| harness: hottest outgoing air | 110 °C | bound above the 90 °C setpoint, loosens the H5 band | moderate |
| harness: fan free air | 68.6 CFM = 32.4 l/s | brief (catalogue) | high |
| harness: fan shut-off | 3.0 mmH₂O = 29 Pa | Mechatronics E1225 datasheet, 120×25 mm at 1,800 rpm. The lowest row is the loosest bound; 4.5 mmH₂O at 2,200 rpm and 67 CFM is the closer match | moderate |
| harness: reference band | 15–25 l/s | brief's "about 20 l/s" ±25 % | judgment, stated |
| stand-in only | Cd 0.61 (textbook orifice); grille free area 0.6, linear 45→90 °C profile, duct f 0.02 + K 1.5, 20 l/s lower-zone mixing (all placeholders) | not for the model | n/a |

## 8. Open questions and what to check next

1. **C: the sauna bather's CO₂ emission.** It is the second-largest lever on breathing after read time, and I found no sauna measurement. Check Saunologia's 680 ppm case (target #9) with C's emission.
2. **C: does the undercut's air come from the house?** If so its CO₂ is above outdoor, typically 500–800 ppm, and C should say what it assumes.
3. **Lead: the 30-minute read.** It makes a sealed room look moderate (0.63). That is the honest number for 30 minutes, but the page's teaching may want the session that people actually sit, often 2–3 rounds over an hour.
4. **Lead: the door undercut (F1)** and **the inlet duct, inside or outside (F6)**.
5. **D: feet anchors from VTT data**, and the fate of the page's "never zero it" sentence.
6. **Next run:** run the harness on the integrated `evaluate`, then compare against E_validation #3–#8 with the door gap set to zero. VTT 1992's lab door was sealed.
