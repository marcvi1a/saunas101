# Saunas 101 ventilation model: shared brief for the five agents

## Why this exists

saunas101.com/ventilation scores 771 switch states of a sauna's ventilation from 0 to 100. The current model (`C:\Users\marcv\dev\saunas101\lab.js`, lines 1 to 230 and `runScore` near line 140) multiplies hand-set factors (`MODEL`, `TILT`, `HEATER`, `EXH`, `WALL`, `IDUCT`, `HALF`, `COMBO`, `DRY_*`, `BARE`). They contradict each other: with a low inlet and no fan, a grille under the upper bench scores 23, and adding a 2 m exhaust duct drops it to 16, which is physically backwards.

**The rule for the new model: nothing hand-set.** Every number must be one of:
1. a physical constant (g, gas constant, air properties at a stated temperature),
2. a geometry value from the drawing (table below) or from the shared parameters below,
3. a manufacturer or standard value with a citation (title, publisher, year, page or URL),
4. or derived from the above by a formula you write down.

Where physics genuinely needs an empirical coefficient (discharge coefficient, plume entrainment constant, draught-rate constants), take it from a cited standard or textbook, say which, and give a confidence level (high, moderate, low). No fudge factors to match an expected result. If a result surprises you, report it; do not tune it away.

Do not edit anything under `C:\Users\marcv\dev\saunas101`. Read it freely. Write only into `C:\Users\marcv\AppData\Local\Temp\claude\c--Users-marcv-dev-brain\c24e1e8a-a23b-48bd-9718-2761a4d65050\scratchpad\ventmodel\`.

## The switches (internal values as lab.js uses them)

| switch | values | meaning |
|---|---|---|
| vent | `yes`, `none` | `none` = no inlet, no exhaust, door gaps only; then only `heater` matters |
| inlet | `above`, `middle`, `below`, `bottom` | Above = 20 cm above the stones, centre 0.98 m off the floor, heater wall. Middle = 0.45 m, facing the heater's side. Low (`below`) = 0.12 m, beside the heater. Floor (`bottom`) = through the floor directly under the heater; the floor is open to outside air or ducted to an outside wall |
| exhaust | `lower`, `upper` | grille on the wall opposite the heater, under the lower bench (centre 0.25 m) or under the upper bench (centre 0.69 m); each grille's top edge is 5 cm under its bench |
| fan | `on`, `off` | an exhaust fan in the exhaust path, outside the hot room, runs whenever the heater runs |
| duct | `straight`, `riser`, `half`, `inletduct` | None; Long = bare Ø125 duct from the grille up to an outlet at 2.17 m (above the room); Short = same to an outlet at 1.18 m; Inlet = a bare duct from a mouth at floor level up to the inlet (read the comment above `IDUCT` in lab.js for how it is meant; flag any ambiguity) |
| heater | `open`, `closed`, `wall` | Open = stone pillar, no casing, stones exposed on every side (Harvia Legend, HUUM Hive type). Closed = floor-standing casing heater, a sheet-metal chimney with the elements inside, air drawn in at the base, stones on top. Wall = short casing heater hung on the wall, its intake 30 cm off the floor |
| angle | `straight`, `up45` | the inlet hole's axis is horizontal, or climbs into the room at 45°. Disabled with the floor inlet |
| dry | `closed`, `open` | drying vent high on the exhaust wall, centre 1.94 m; meant to stay shut while bathing |

Disabled combinations: with `inlet: bottom`, `angle` is fixed (no effect) and `duct: inletduct` is not allowed. Valid states: enumerate inlet × exhaust × fan × duct × heater × angle × dry, drop the disallowed ones and collapse angle for the floor inlet, plus 3 `vent: none` states (one per heater).

Read the tooltips in `C:\Users\marcv\dev\saunas101\src\ventilation.html` and the comments in lab.js for each option's intent.

## Geometry (from the drawing; h in metres above the floor)

Drawing units: h = (300 − y) × 2.1 / 300. x is horizontal, the heater wall at x = 22, the exhaust wall at x = 398 (2.63 m apart).

| thing | value |
|---|---|
| ceiling | y = 8, h = 2.04 m |
| room volume | 12 m³ (width 2.63, height 2.04, depth 2.24 m) |
| inlet centres | above 0.98, middle 0.45, low 0.12, floor 0 (under the heater, x = 73) |
| exhaust grille centres | lower 0.25, upper 0.69 |
| duct outlet heights | long 2.17, short 1.18 |
| drying vent centre | 1.94 m, exhaust wall |
| benches (top surface) | upper 0.88 m (x 230 to 398), lower 0.45 m (x 200 to 398) |
| bather on the upper bench | seat 0.88 m, head centre 1.70 m, mouth about 1.62 m, feet resting on the lower bench, ankles about 0.55 m |
| a bather on the lower bench (when 2 are present) | seat 0.45 m, mouth about 1.20 m, ankles about 0.10 m |
| open pillar heater | 0.28 m wide, stones from 0.06 to 0.76 m, on a short base; x 53 to 93 |
| closed casing heater | 0.29 m wide, 0.67 m tall, floor-standing, intake at the base |
| wall heater | casing from 0.29 to 0.68 m, intake 0.30 m off the floor |
| temperature sensor | on the ceiling above the heater (thermostat) |

## Shared parameters (use these; propose changes in your report, do not silently change them)

| parameter | value | note |
|---|---|---|
| outdoor air | 25 °C, 101.3 kPa | Brazil, where the site's readers are |
| thermostat | 90 °C at the sensor, ceiling above the heater | |
| heater | 12 kW rated, a ceiling the steady losses (2.2–2.8 kW) never reach, so the rating does not move the scores | at steady state it supplies the losses; split into convective and radiant per a cited source |
| inlet, exhaust openings | Ø125 mm each, grille free area per a cited typical value | |
| drying vent | Ø125 mm | |
| door | 0.70 × 1.90 m glass door, 10 mm gap under it, 2 mm gap along the top; rest of the envelope sealed by the foil barrier | |
| ducts | Ø125 mm, bare galvanised steel, outdoors (so their air cools on the way); friction per a cited method | |
| fan | sized by the site's rule 17: about 5 l/s per seat, 4 seats, so about 20 l/s installed in the reference system (inlet above, lower grille, no duct). Model it as a real fan curve (free-air flow and shut-off pressure from typical data for a 120 × 25 mm axial fan around 1,800 to 2,000 rpm, cited), so its operating point moves when the system changes (ducts, drying vent open, stack aiding or opposing) | the catalogue fan the site recommends: Ultrar EF12025ML2BP7T0, 68.6 CFM free air |
| occupancy | 2 bathers present (4 seats; the single-speed fan is sized for half the bench) | |
| session | read results 30 minutes into a session unless your part needs steady state | |

## The interface everything must fit

Each agent writes a CommonJS module (plain Node, no dependencies, deterministic, under 1 ms per state). Function names and outputs:

- **Airflow (agents A and B):** `airflow(state, profile)` returns `{ openings: [{name, h, q}], qOutdoorIn, qOutdoorOut, mainInletQ, mainExhaustQ, dryQ, doorLowQ, doorTopQ, neutralPlaneH, reversed, notes }`. `q` in m³/s at the opening, positive = into the room. `profile(h)` returns the room air temperature in °C at height h; use `defaultProfile` (export it) until agent D's replaces it.
- **Breathing-zone delivery (agent C):** `breathing(state, flows)` returns `{ fractionToBreathingZone, qFreshAtBreathingZone, co2AtMouth, notes }`, given the airflow object.
- **Feet (agent D):** `profile(state, flows)` returns a function `T(h)`; `feet(state, flows)` returns `{ ankleT_upper, ankleT_lower, ankleV, feetFactor, notes }`.
- **Score (agent E):** `score({ breathing, feet, flows, state })` returns `{ breathingFactor, feetFactor, score }`; plus `invariants.js` that checks any `evaluate(state)` implementation.

Each agent also writes a CSV over all valid states of its own outputs (use the simplest physically honest stand-in for inputs another agent owns, and mark it), and a Markdown report: method, every equation, every constant with its source and confidence, results, surprises, and what you would check next.
