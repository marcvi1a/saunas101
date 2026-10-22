# Agent D: room temperature profile and feet comfort — version 2

Files:
- `D_feet.js` (version 2)
- `D_feet.v1.js` (version 1, kept unchanged)
- `D_feet.csv`: 651 states through the integrated pipeline (`X_evaluate.js`: agent A's airflow iterated with this profile), door gap 2 mm
- this report

## 0. What changed in version 2 (integrator follow-up)

**1. Mixing low in the room.** Two physically present processes, derived and not fitted:
- Natural-convection boundary layers on every vertical surface (walls, door glass, the bathers). They come from the Squire–Eckert laminar and Eckert–Jackson turbulent integral solutions (Holman, *Heat Transfer*, ch. 7).
- Radiation from the casing heater's casing at its measured temperatures (72 °C sides, 60 °C underside; Fan, Holmberg & Heikkinen 1994, Table 2). Version 1 used those temperatures for convection but left out their radiation.

VTT 1992 residual at the foot-bench height (0.55 m), 12 layouts each, before → after:

| floor | v1 | v2 |
|---|---|---|
| concrete | 9.2 K | 8.5 K |
| insulated | 9.7 K | 8.6 K |

The bias pattern survives: low inlet with a high exhaust is 12–13 K too cold, and a captured inlet with a low exhaust 10–11 K too warm. The model still overstates how much inlet height changes the ankle temperature: 25 K between T1 and T3 with exhaust P3, against 14 K measured; version 1 had 28 K. §3.13 explains why: boundary layers mix within each zone but stop at the interface the plume sets. I found no unfitted law for mixing across that interface.

**2. Comfort mapping.** My own heat-flux scaling of ISO 7730 is replaced by the two ASHRAE 55 local-discomfort models that take the whole-body thermal sensation TS as an input:
- the vertical-gradient model of ASHRAE 55-2020 Addendum a (Liu et al. 2020);
- the ankle-draft model of ASHRAE 55 (Liu et al. 2016).

TS is set to +3 ("hot"), the top of the scale they were fitted on (§3.12).

**3. Drying-vent flags (H14).**
- The integrator's example (inlet above, upper grille, closed heater, 0.1575 → 0.1814) was physics, not a bug: opening the vent reverses the flow pattern, the heater rises 2377 → 2772 W, the upper ankle warms 1.9 K, and version 1's lower-bather curve was saturated at PD 95–98 %, so the warmer upper ankle carried the average.
- A real bug turned up while checking (§3.9): the averaging window could restart after accumulating, which inflated a few results up to 1.4× (one v1 CSV row visibly, the H14 outlier `middle|upper|off|half|open|up45`).
- With the fix and the new physics, E's harness shows **no no-fan state where opening the vent warms the feet**. All hard invariants hold. The remaining flags (H10, H11x, H19) are airflow-side.

**4. Door gap: 2 mm**, consistent with `A.PARAMS.doorGapLow = 0.002`. The undercut now admits 0.2–2.9 l/s over all states (8–49 % of the outdoor inflow, median 13 %), against 7–11 l/s with the fan at 10 mm.

**5. Runtime.** About 16 ms per state through the integrated pipeline. That is no longer a constraint (build time).

## 1. Interface

```js
const D = require('./D_feet.js');
const T = D.profile(state, flows);   // T(h) in degC, h in m; non-decreasing in h
const f = D.feet(state, flows);      // { ankleT_upper, ankleT_lower, ankleV, feetFactor, feetFactor_upper, feetFactor_lower, notes, detail }
```

- `flows`: agent A's format. The module reads `mainInletQ`, `mainExhaustQ`, `dryQ`, `doorLowQ` and `doorTopQ`.
- `feetFactor` weights the two bathers equally; `feetFactor_upper` is the upper-bench bather alone.
- Without `flows`, a marked stand-in network is used: Cd 0.61 orifices, fan fixed at 20 l/s, door gap 2 mm.
- 651 valid states (the brief's enumeration; lab.js's 771 includes the disabled combinations).

## 2. Results for the eight named layouts (open stones, agent A's flows, door gap 2 mm)

"dT" is mouth minus ankle (upper bather 1.62/0.55 m, lower bather 1.20/0.10 m); "gradient" is dT divided by that height. PPD_VG is the ASHRAE 55-2020 vertical-gradient dissatisfaction at TS = +3. The ankle-draft PPD is under 1 % in all eight (no jet reaches an ankle at 2 mm).

| layout | in / ex / door l/s | T 0.10 / 0.55 / 1.62 | dT up / low K | gradient up / low K/m | PPD_VG up / low % | **feet, equal** | **feet, upper only** | v1 mapping (equal) |
|---|---|---|---|---|---|---|---|---|
| 1 no fan, low inlet, lower grille | 2.0 / −0.5 / 0.4 | 50.4 / 61.9 / 87.8 | 25.9 / 31.7 | 24.2 / 28.9 | 55 / 60 | **0.421** | **0.444** | 0.545 |
| 2 no fan, low inlet, upper grille | 3.7 / −3.0 / 0.7 | 47.6 / 60.6 / 87.9 | 27.3 / 34.5 | 25.5 / 31.3 | 57 / 62 | **0.405** | **0.428** | 0.464 |
| 3 no fan, low inlet, short duct | 4.5 / −4.1 / 0.8 | 46.6 / 61.1 / 87.8 | 26.7 / 35.7 | 25.0 / 32.5 | 56 / 62 | **0.405** | **0.435** | 0.457 |
| 4 no fan, low inlet, long duct | 5.9 / −6.2 / 1.1 | 45.2 / 60.8 / 87.9 | 27.0 / 37.1 | 25.3 / 33.7 | 57 / 63 | **0.401** | **0.431** | 0.432 |
| 5 fan, inlet above, lower grille | 12.6 / −20.4 / 2.8 | 57.6 / 76.8 / 89.5 | 12.8 / 29.9 | 11.9 / 27.2 | 24 / 59 | **0.584** | **0.758** | 0.783 |
| 6 fan, inlet above, long duct | 13.1 / −21.3 / 2.9 | 58.0 / 76.7 / 89.6 | 12.8 / 29.8 | 12.0 / 27.1 | 24 / 59 | **0.583** | **0.755** | 0.788 |
| 7 fan, low inlet, lower grille | 13.9 / −20.9 / 2.8 | 35.1 / 62.3 / 88.0 | 25.7 / 50.2 | 24.0 / 45.6 | 55 / 65 | **0.394** | **0.447** | 0.387 |
| 8 no ventilation | 0 / 0 / 1.2 | 52.0 / 62.3 / 87.8 | 25.5 / 30.3 | 23.9 / 27.5 | 55 / 59 | **0.429** | **0.449** | 0.587 |

- The upper bather's head-to-ankle difference without a fan is now 26–27 K, inside VTT's measured "typical 25–30 K" (version 1: 17–19 K). The boundary layers cool the 0.55 m level.
- Over all 651 states, with the gradient term the score no longer uses: (1 − PPD_VG)(1 − PPD_AD) (equal weight) is 0.347–0.621 (median 0.393), and upper-only is 0.349–0.815.
- The new mapping compresses the scale. ASHRAE's gradient model caps dissatisfaction at 65.5 %, so the floor is 0.345, and every no-fan wall-inlet layout lands at 0.40–0.43.
- With TS = +2 instead of +3, every factor rises by 0.01–0.03; the ranking is unchanged.

**Sanity checks:**
1. An inlet above the stones with a fan gives the warmest upper-bench feet of the wall-inlet layouts (76.8 °C, 12 K/m). Only the floor inlet under the heater beats it (78.8 °C).
2. A low inlet with a fan gives the coldest floor (35.1 °C at 0.10 m).
3. A low inlet without a fan feeding a higher outlet gives colder feet (0.421 → 0.401).
4. Opening the drying vent without a fan never warms the feet (H14 passes). With the fan on it can (notes in H14, e.g. closed heater, inlet above: 0.421 → 0.533). The vent becomes an inlet at the ceiling (+7 l/s); that cold air entrains the hottest air as it falls and is inserted at 0.55–0.9 m, warmer than the air there, so the upper ankle warms 57.6 → 63.6 °C while 0.9–1.2 m cools. That is a physical consequence of a fan-driven ceiling inflow, not a bug.

## 3. Method (equations; v2 changes in 3.5b, 3.6, 3.9, 3.12, 3.13)

### 3.1 Room and layers
2.63 × 2.24 × 2.04 m, N = 34 layers (6 cm), steady state. ρ = p/(R(T+273.15)), c_p = 1007 J/kgK.

### 3.2 Envelope (EN ISO 6946, EN ISO 10456)
Wall U = 0.305 W/m²K: 15 mm spruce, 20 mm foil-faced cavity (Annex D, R = 0.58), 100 mm mineral wool (λ 0.037) with 12 % timber studs, 12.5 mm gypsum, Rsi = Rse = 0.13. Ceiling U = 0.311. Glass door: U = 3.73 over 0.70 × 1.90 m, starting 2 mm above the floor.

### 3.3 Floor slab
Semi-infinite concrete (λ 1.65, ρ 2200, c 1000, e = 1905 W s^½/m²K). With a surface ramp over t_h = 1 h, read at t = 1.5 h:

  U_floor = e (2/√π)(√t − √(t − t_h))/t_h = 18.6 W/m²K

(Carslaw & Jaeger; heat-up time from VTT 1992 p. 13.)

### 3.4 Long-wave radiation
Exact view factors of the box (Incropera, aligned parallel rectangles). Perimeter bands exchange through S(a,b) = P(b−a) − 2A_f(1 − F_par(b−a)), with X = ½[S(a,d) − S(a,c) − S(b,d) + S(b,c)]. Exchange is linearised at h_r = 7.5 W/m²K.

### 3.5 Surface balance
q_abs + Σ h_r F (T_k − T_j) + h_c (T_air − T_j) + g_b (T_skin − T_j) = U′ (T_j − T_amb).

Free convection (McAdams, ASHRAE Fundamentals ch. 4): vertical 1.31 ΔT^(1/3); horizontal unstable 1.52 ΔT^(1/3); horizontal stable 0.59 (ΔT/L)^(1/4).

### 3.5b Boundary layers on vertical surfaces (new)
The convective heat of each wall band, door band and bather band no longer goes straight into its layer. It goes into a natural-convection boundary layer that runs up a warm surface or down a cool one.

Volume flux per unit width at distance x from the layer's leading edge, with Gr = gβΔT x³/ν² and Pr = 0.70 (Holman, *Heat Transfer*, ch. 7):
- laminar, Squire–Eckert integral solution: u = U₁(y/δ)(1 − y/δ)², δ/x = 3.93 Pr^−½(0.952 + Pr)^¼ Gr^−¼, U₁ = 5.17 ν (0.952 + Pr)^−½ Gr^½/x, giving Q′ = U₁δ/12;
- turbulent, Eckert & Jackson (1951): u = U₁(y/δ)^(1/7)(1 − y/δ)⁴, δ/x = 0.565 Gr^−0.1 Pr^−8/15 (1 + 0.494 Pr^⅔)^0.1, U₁ = 1.185 (ν/x) Gr^½ (1 + 0.494 Pr^⅔)^−½, giving Q′ = U₁ δ B(8/7, 5);
- the larger of the two is used; they cross near Gr ≈ 3·10⁸.

ν(T) is interpolated from Incropera Table A.4 (300–350 K). ΔT is the mean surface–air difference over the run so far.

How the layer moves through the room:
- It entrains ρ ΔQ from each layer it passes and carries that band's convective heat.
- It leaves the surface as soon as it is no longer buoyant against the local air: (T_bl − T_air)·direction ≤ 0.
- It is then inserted at the height where the room's temperature equals its own (filling-box insertion).

Magnitude: a 10 K surface–air difference over 0.6 m drives about 4 l/s per metre of wall, about 35 l/s around the room, of the order of the heater plume. Confidence: moderate for the flux law; low for its use in a 1-D column, because a stratified cavity's boundary layers exchange fluid with the interior continuously.

### 3.6 Heater
- **Thermostat:** the plume's mean temperature at the ceiling is held at 90 °C.
- **Open stones:** a stone bed, the same law as breathing.js's `heaterFlow` (one open heater for the whole model). Room air is drawn in evenly along the stone height, buoyancy against the bed's Ergun loss (stones Ø75 mm, voidage 0.40), and leaves at the top as the plume's source. The outer stones follow the bed air, the local room air at the bottom and the outlet air at the top, linear in 7 bands (breathing.js's `bedSplit`); each band radiates εσA(T⁴ − T_rs⁴) with ε = 0.90 and spreads it by its own view, so the cool bottom stones face the floor and the hot top faces the ceiling; the rest of the output leaves with the bed's air. Over all states: radiant share 26–38 %, top stones 195–269 °C, bed flow 10–11 l/s, output 2.4–3.9 kW. Thermal images of open mesh heaters show the shape: a cool bottom near room air, 150–220 °C upper sides, 200–300 °C on top (Saunologia's Harvia Spirit 9 kW test, https://saunologia.fi/testi-harvia-spirit-9kw/, and HUUM Drop 9 kW test, https://saunologia.fi/test-huum-drop-9-kw-uku-wifi/; moderate confidence, heat-up states). No measured radiant split exists for any sauna heater; Fan, Holmberg & Heikkinen's 1994 figure of 73 % comes from an arithmetic slip (a space resistance used as a conductance) and corrects to about 0.46 kW from the stone top. The bed's draw along the stones is the line sink that captures a middle or low inlet jet, and a floor jet goes through the bed. The earlier envelope balance (one surface radiating and convecting, no air through the stones) gave 70–75 % radiant at 259–359 °C and twice the output, heating the floor slab to 50 °C; breathing.js already had the bed, so the two modules disagreed by three times.
- **Casing heaters:**
  - stones on top radiate at 285 °C (measured 260–310);
  - **new in v2: the casing sides radiate at the measured 72 °C and the underside of the wall heater at the measured 60 °C**, with εσA(T⁴ − T_rs⁴), capped at 90 % of P;
  - a casing boundary layer rises at 72 °C;
  - the channel air is 4.1 l/s × (P_th h/(1.2 kW · 0.55 m))^⅓ (Fan et al. 1994 for all four casing values).

### 3.7 Plume
MTT top-hat with α = 0.10: dQ/dz = 2√π α M^½; d(M²)/dz = 2 g′ Q²; enthalpy with a distributed source. It detrains at its neutral height.

### 3.8 Inflows
- Vena-contracta jets: U₀ = q/(0.61 A).
- Inlet above the stones: momentum-flux merge with the plume.
- Middle and low inlets: line-sink capture width e/U.
- Floor inlet: captured by open stones and a floor-standing casing; under the wall heater, a fountain (2.46 M^¾F^−½).
- Uncaptured air: Ricou–Spalding jet phase over l_M = M^¾/F^½, then a falling MTT plume inserted at its neutral height.

### 3.9 Solver
- Upwind layer balance solved by Thomas, convective adjustment, inner air–surface sweeps, and a Newton step on P with rescaling of the temperature field.
- It stops when settled (< 0.05 K per iteration, sensor within 0.25 K), then averages 10 iterations.
- **Bug fixed in v2:** if "settled" fired within the last 10 iterations of the cap, the averaging window was restarted after it had begun accumulating, so up to 13 tenths were summed (a profile inflated up to 1.4×; one visible case in the v1 CSV, at 126 °C). The window is now fixed once.

### 3.10 Bathers
Skin at 40 °C (Sohar et al. 1976: 40.4 ± 1 °C), 1.8 m² each, spread over height by the rule of nines. Convection 2.38|ΔT|^0.25, radiation 4·0.95·σ·0.70·T³. In v2 their convection runs through boundary layers (§3.5b).

### 3.11 Ankle streams
Jet decay 5.8 U₀d/s (attached jets with √2·d), wall-jet half-width 0.048 s, free-jet half-width 0.094 s, ΔT ratio 0.8. Gravity currents with Fr = 1.19 count for the lower bather only.

### 3.12 Comfort mapping (new in v2)
Two ASHRAE 55 models, both conditioned on the whole-body thermal sensation TS:
- **Vertical gradient**, ASHRAE 55-2020 Addendum a, from Liu, Wang, Schiavon et al. 2020 (*Energy and Buildings* 110085):

  PPD_VG = 100·e^z/(1 + e^z) − 34.5 (0 if negative), z = 0.13 (TS − 1.91)² + 0.15 G − 1.6, G in K/m

  I read this from the addendum's text, whose formula layout was garbled in extraction. I checked my reading against the addendum's own limit line, G ≤ 7.82 − 0.87(TS − 1.91)², which is the PPD_VG = 5 % contour: my code returns 4.94 % on it.
- **Ankle draft**, ASHRAE 55, from Liu, Schiavon et al. (2016, *Indoor Air* 27:852):

  PPD_AD = 100·e^y/(1 + e^y), y = −2.58 + 3.05 v_ankle − 1.06 TS

  This agrees with the published reference implementation's example (18.6 % at v = 0.3 m/s near neutral TS).
- feetFactor_k = 1 − PPD_AD/100, the ankle draught only. PPD_VG is still computed and reported, but the score leaves it out: the heat factor (evaluate.js) already measures how warm the body is from ankles to mouth, and the gradient would count the same cold lower zone twice. At TS +3 the draught term is 0.98–1.00 in every state, so the score leaves it out: dropping it changed 42 of 579 reachable layouts by 1 point and none of the 4 named layouts. feetFactor is the mean of the two bathers; feetFactor_upper is the upper bather alone.

**TS = +3.** PMV cannot be computed at 60–90 °C air (the model's range ends at 30 °C), and a sauna bather's whole-body sensation is at least "hot", the top of the seven-point scale these models were fitted on.

**Why these rather than v1's scaling.** ISO 7730's curve was fitted on thermally neutral subjects. Liu et al. showed that dissatisfaction with a vertical gradient depends on whole-body sensation, and ASHRAE adopted that dependence. Taking whole-body warmth into account is exactly what the sauna needs. The ankle-draft model encodes the same physiology (a warm body tolerates ankle air movement), consistent with thermal alliesthesia (Cabanac 1971).

**What remains extrapolation.** Liu et al. tested gradients of 0.4–8.4 K/m on clothed, seated, near-neutral subjects. The sauna has 11–50 K/m at TS ≥ 3, and the logistic caps PPD_VG at 65.5 %. No sauna comfort votes exist; VTT 1992 notes the bathers' own perceptions were never studied. Version 1's mapping is kept in the CSV (`feetFactor_v1mapping`) for comparison.

### 3.13 Why the residual survives
Below the plume's source, the 1-D model only has advection, the boundary layers and radiation.
- Upward boundary layers from the lower walls are warmer than the cold floor layer. They carry its heat up and leave it at the top of the cold zone.
- Downward layers from the cool upper walls are warmer than the cold zone. They stop at the interface.

So neither crosses the interface, and the measured, diffuse VTT interface (a linear 35 → 80 °C from 0.05 to 0.95 m) is reproduced only partly. The candidates are turbulent entrainment across the interface (laws of the form u_e/u′ = A·Ri^−n, which need a stirring velocity and a coefficient I can't derive here), 3-D jet stirring, and thermostat cycling moving the interface. All need a fitted coefficient or a transient 3-D model. I did not fit any.

## 4. Constants (v2 additions marked)

| constant | value | source | confidence |
|---|---|---|---|
| g, R, c_p, σ | standard | physical | high |
| outdoor, slab start, set point | 25 °C, 25 °C, 90 °C in the plume at the ceiling | brief; sensor reading = plume mean (mine) | moderate |
| heat-up / read time | 1 h / +0.5 h | VTT 1992; brief | moderate |
| concrete, wool, spruce, gypsum, glass λ | 1.65, 0.037, 0.13, 0.25, 1.0 | EN ISO 10456 | moderate |
| convection coefficients | 1.31, 1.52, 0.59, 1.42 | McAdams / ASHRAE ch. 4 | moderate |
| **boundary-layer flux** | Squire–Eckert, Eckert–Jackson integral solutions | Holman ch. 7 | moderate (law), low (1-D use) |
| **ν(T), Pr** | 1.589e-5 + 1.006e-7 (T − 26.85) m²/s, 0.70 | Incropera Table A.4 | high |
| ε | 0.9 | Fan et al. 1994 | moderate |
| stones (casing heater), casing sides, **underside** | 285, 72, **60 °C** | Fan et al. 1994 Table 2 | low–moderate |
| channel air | 4.1 l/s, ≈1.2 kW, 0.55 m casing | Fan et al. 1994 | low–moderate |
| plume α, jet 0.32, 5.8, 0.094, wall jet 0.048, 0.8, fountain 2.46, Fr 1.19, Cd 0.61 | as v1 | MTT/Linden, Ricou–Spalding, Hussein et al., Launder–Rodi, ASHRAE, Turner, Huppert–Simpson | moderate |
| skin, body area, A_r/A_D, ε_skin, h_c body | 40 °C, 1.8 m², 0.70, 0.95, 2.38 ΔT^0.25 | Sohar 1976; ASHRAE ch. 9; ISO 7730 | moderate–high |
| **PPD_VG coefficients** | 0.13, 1.91, 0.15, 1.6, 34.5 | ASHRAE 55-2020 Add. a; Liu et al. 2020 | high (fit), low (sauna transfer) |
| **PPD_AD coefficients** | −2.58, 3.05, −1.06 | ASHRAE 55; Liu et al. 2016 | moderate–high (fit), low (transfer) |
| **TS** | +3 | top of the fitted scale; PMV undefined | low |
| **door gap** | 2 mm low, 2 mm top | integrator; A's PARAMS | given |

## 5. Check against VTT 1992 (Äikäs & Holmberg, VTT Tiedotteita 1431)

The test sauna: 2 × 2 × 2 m, HELO 8 kW casing heater on a 0.2 m stand, Ø160 openings, 13.3 g/s extract, 20 °C inlet, thermostat 90 °C at 1.65 m, no bathers, sealed door. Floor heated 3 h. The table gives temperature at 0.55 m in °C (model v1, measured, model v2) and the model error in K.

| exhaust/inlet | v1 | measured | v2 | error v1 | error v2 |
|---|---|---|---|---|---|
| P1/T1 | 69.4 | 65.0 | 67.7 | +4.4 | +2.7 |
| P1/T2 | 70.2 | 65.0 | 68.3 | +5.2 | +3.3 |
| P1/T3 | 79.8 | 70.0 | 80.1 | +9.8 | +10.1 |
| P1/T4 | 80.0 | 69.0 | 80.0 | +11.0 | +11.0 |
| P2/T1 | 44.5 | 58.0 | 45.5 | −13.5 | −12.5 |
| P2/T2 | 44.6 | 59.0 | 45.7 | −14.4 | −13.3 |
| P2/T3 | 76.3 | 74.6 | 73.6 | +1.7 | −1.0 |
| P2/T4 | 76.4 | 72.5 | 73.6 | +3.9 | +1.1 |
| P3/T1 | 44.3 | 57.4 | 45.2 | −13.1 | −12.2 |
| P3/T2 | 44.6 | 57.4 | 45.5 | −12.8 | −11.9 |
| P3/T3 | 72.3 | 71.8 | 70.4 | +0.5 | −1.4 |
| P3/T4 | 72.4 | 68.7 | 70.9 | +3.7 | +2.2 |
| **RMS** | | | | **9.2** | **8.5** |

At 0.05 m the RMS goes 6.2 → 5.8 K. The insulated-floor series (12 layouts, ankle point 0.10 m above the original floor) goes 9.7 → 8.6 K at 0.55 m and 10.4 → 9.2 K at 0.10 m. No coefficient was changed to get these numbers; all v2 additions come from cited laws or measured temperatures.

## 6. Surprises
1. The boundary layers move as much air as the heater plume (tens of l/s), but they do not fix the lower-zone bias: they homogenise each zone and stop at the plume's interface.
2. ASHRAE's gradient model caps dissatisfaction at 65.5 %. Every sauna layout lands in a narrow band (0.35–0.62), and the heater-type gap of v1 (0.53 versus 0.14–0.21) shrinks to 0.44 versus 0.39–0.40.
3. With the fan on, opening the drying vent can warm the upper ankles (a ceiling inflow carries hot air down). Without the fan it never does.
4. The v1 averaging bug (§3.9) was invisible in the per-iteration traces and only showed when E's harness compared neighbouring states.
5. At 10 mm the door undercut took 40–50 % of the fan's make-up air at floor level; at 2 mm it takes 8–49 % of the outdoor inflow (median 13 %), at most 2.9 l/s.

## 7. The three assumptions I am least sure of
1. **TS = +3 and the extrapolation of Liu's models** from ≤ 8.4 K/m to 11–50 K/m. The 65.5 % cap sets the scale's floor.
2. **Mixing across the interface below the plume source** is missing. The ankle temperature still responds about 1.8× too strongly to inlet height: low inlet with high exhaust 12 K too cold, captured inlet with low exhaust 10 K too warm.
3. **The heater's radiant share** (open stones 26–38 % from the stone bed's through-flow and the measured shape of its stone temperatures, no measured split for any heater; casing heaters from one VTT heater's measured temperatures).

## 8. Next checks
- A measured sauna profile with bathers and an open-stone heater.
- A cited interfacial-mixing law for plume-driven filling boxes.
- Sauna thermal-sensation and comfort votes per body part.
- Agent A's grille free area and fan curve are already in the CSV flows.

## Sources
- Äikäs & Holmberg (1992) VTT Tiedotteita 1431 (read in full).
- Fan, Holmberg & Heikkinen (1994) *Building Research & Information* 22(6):307 (read in full).
- ANSI/ASHRAE Addendum a to Standard 55-2020 (read; text layer extracted): https://www.ashrae.org/file%20library/technical%20resources/standards%20and%20guidelines/standards%20addenda/55_2020_a_20210430.pdf
- Liu, Wang, Schiavon, He, Luo, Zhang & Arens (2020) *Energy and Buildings* 110085, doi 10.1016/j.enbuild.2020.110085 (via ASHRAE; study range 0.4–8.4 K/m per the eScholarship record).
- Liu, Schiavon, Kabanshi & Nazaroff (2016/17) *Indoor Air* 27(4):852, doi 10.1111/ina.12364 (coefficients checked against the comf/pythermalcomfort example).
- Sohar et al. (1976) *Isr J Med Sci* 12:1275.
- Cabanac (1971) *Science* 173:1103 (alliesthesia).
- Cited from knowledge, not re-read in this session: Holman, *Heat Transfer* ch. 7 (Squire–Eckert, Eckert–Jackson 1951 NACA Rep. 1015); Incropera & DeWitt (view factors, Table A.4); ISO 7730:2005; EN ISO 6946 and 10456; ASHRAE Fundamentals ch. 4, 9, 20; Carslaw & Jaeger; Morton, Taylor & Turner (1956); Linden (1999); Ricou & Spalding (1961); Hussein, Capp & George (1994); Launder & Rodi (1983); Turner (1966); Huppert & Simpson (1980); McAdams (1954).
