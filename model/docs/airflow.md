# Agent A: the airflow network

Files: `A_airflow.js` (module + CLI), `A_airflow.csv` (651 rows), this report.
Run `node A_airflow.js` to regenerate the CSV. Interface as in the brief: `airflow(state, profile)` and `defaultProfile(h)`.

## 1. What the model does

One zone, one unknown: `pRef`, the room's static pressure at floor level minus the outdoor static pressure at floor level (Pa). Every opening is a path with a room end at height `h` and an outdoor end at height `he` (equal for a hole in the wall, different for a duct). For a given `pRef` each path's mass flow follows from its drive and its loss law; `pRef` is solved so the mass flows sum to zero. Positive flow is into the room.

The room is stratified: the hydrostatic integral uses the profile `T(h)` point by point (Simpson's rule on 5 mm cells), never a mean temperature.

Couplings that depend on the flow (friction factors, the density at each loss, the air temperature along a duct, the closed heater's chimney heat) are frozen within a pass and iterated. The duct column is the one strong coupling and is solved as a one-dimensional root (section 6), which matters because it can have two solutions.

## 2. Equations

**(1) Air density.** ρ(T) = P / (R·T), P = 101 300 Pa, R = 287.05 J/(kg·K), T in kelvin. Dry air. ρ_out = ρ(25 °C) = 1.18363 kg/m³.

**(2) Room and outdoor hydrostatics.**
P_room(h) = P0 + pRef − g·I(h), with I(h) = ∫₀ʰ ρ(T(z)) dz.
P_out(h) = P0 − g·ρ_out·h.

**(3) Drive of a path (positive pushes air in).**
Δ = g·[ I(h) − ρ_out·he − J ] − pRef, with J = ∫_he^h ρ_path(z) dz (signed).
For a hole in the wall he = h and J = 0, so Δ = g·∫₀ʰ (ρ_room − ρ_out) dz − pRef. A duct moves the outdoor end to `he` and replaces the outdoor column between `he` and `h` with its own air column.

**(4) Loss law (each direction has its own a, b).**
Δ = a·ṁ + b·ṁ² for inflow and Δ = −(a'·|ṁ| + b'·ṁ²) for outflow, where
b = Σ K_j / (2·ρ_j·A²) + Σ f_j·(L_j/D) / (2·ρ_j·A²) (fittings, plus turbulent friction),
a = Σ (f·Re)_j·μ_j·L_j / (2·D²·ρ_j·A) (laminar friction, which is linear in ṁ).
Each loss uses the density of the air passing at that point: outdoor air at the outer end, the duct's mean air in the duct, the arriving air at the grille on inflow, and room air at h on outflow.
Inversion: ṁ = 2Δ / (a + √(a² + 4bΔ)).

**(5) Grille.** It is modelled as a perforated plate on the room face of the Ø125 sleeve, free area ratio n = 0.5.
- Outflow, where the grille is the entry into the sleeve: ζ = C₀ = 3.8 (ASHRAE fitting 6-8, n = 0.5, t/d = 0.2). Then the sleeve exits to outdoors with K = 1.0.
- Inflow, where the grille discharges into the room: the jets lose their whole velocity head. By Borda–Carnot, the in-duct loss is ζ = (1/(nε) − 1)², which gives 1/(nε) = 1 + √3.8 = 2.949, and the discharge loss is ζ = (1/(nε))² = (1 + √3.8)² = **8.70**. This replaces the sleeve's exit loss.

The resulting wall-opening loss coefficients, referred to the Ø125 velocity:
- Inflow: K_in = 0.5 + 8.70 = 9.20, an effective area A/√K = 0.00405 m².
- Outflow: K_out = 3.8 + 1.0 = 4.80, an effective area 0.00560 m².
- Both directions add the friction of the 0.15 m sleeve.

**(6) Door gaps (crack law).** Δ = 12·μ·L·V/g² + ζ·ρ·V²/2, with V = ṁ/(ρ·A), L = 8 mm (glass leaf), g the gap height, and A = 0.70 m × g.
- Bottom gap: g = 10 mm, ζ = 1/0.61² = 2.69 (sharp slot, L/g = 0.8), centre at 0.005 m.
- Top gap: g = 2 mm, ζ = 1.5 (straight-through crack, L/g = 4), centre at 1.899 m.
- Both lead to air at 25 °C at outdoor pressure.

**(7) Fan.** Static pressure rise: Δp_f(Q) = (ρ_f/ρ_rated)·s²·p_base(Q/s), with s = 68.6/80.17 = 0.8557 (affinity laws, Q ∝ N and p ∝ N²) and Q the volume flow at the fan's air density ρ_f (room air at the grille).
- Path balance: Δ = loss(ṁ) + Δp_f(−ṁ/ρ_f). Solved per evaluation; it is monotone, so the root is unique.
- The duct or sleeve exit loss directly downstream of the fan is dropped, because a static-pressure rating already charges the fan its own discharge velocity head.
- The curve is extrapolated linearly beyond its ends: reverse flow above shut-off, and the fan acting as a resistance above free delivery.

**(8) Air temperature in a bare duct.** dT/ds = (T_amb(z) − T)/ℓ, with ℓ = ṁ·c_p/U′ and U′ = π·D / (1/h_i + 1/(h_o + h_r)) (thin steel wall).
- The march is integrated exactly per step with an exponential integrator over 24 steps. The column J uses Simpson's rule over the same nodes.
- T_amb is 25 °C for an outdoor duct and the room profile for a duct inside the room.
- The air enters at T_out on inflow and at T_room(h) on outflow.
- At zero flow the duct takes T_amb.

**(9) Inside heat transfer h_i (VDI Heat Atlas G1, Gnielinski).**
- Laminar: Nu = [3.66³ + 0.7³ + (1.615·X^(1/3) − 0.7)³ + ((2/(1+22Pr))^(1/6)·X^(1/2))³]^(1/3), with X = Re·Pr·D/L.
- Turbulent: Nu = (ξ/8)·Re·Pr / (1 + 12.7·√(ξ/8)·(Pr^(2/3) − 1))·(1 + (D/L)^(2/3)), with ξ = (1.8·log₁₀Re − 1.5)^−2.
- Between Re 2 300 and 10⁴ the two are blended linearly.

**(10) Outside heat transfer h_o and radiation h_r.**
- h_o (Churchill & Chu, vertical surface, all Ra): Nu_L = {0.825 + 0.387·Ra_L^(1/6) / [1 + (0.492/Pr)^(9/16)]^(8/27)}², with properties at the film temperature.
- h_r = ε·σ·(T_w² + T_a²)·(T_w + T_a).
- The wall temperature comes from splitting the series resistance; this is iterated four times.

**(11) Friction (Darcy).**
- Laminar: apparent friction for developing flow (Shah 1978). f_F·Re = 3.44/√x⁺ + (1.25/(4x⁺) + 16 − 3.44/√x⁺)/(1 + 0.00021·x⁺^−2), with x⁺ = L/(D·Re) and f_D = 4·f_F.
- Turbulent: Haaland, 1/√f = −1.8·log₁₀[(ε/D/3.7)^1.11 + 6.9/Re].
- Between Re 2 300 and 4 000 the two are blended linearly.

**(12) Mass balance.** Σ ṁ_i(pRef) = 0. It is solved by a secant method on `pRef` from a warm start, falling back to a bracketed Brent, with tolerance |Σṁ| ≤ 10⁻¹⁴ kg/s.

**(13) Duct column fixed point.** Hold the column at a mean density ρ̄ and solve everything else; the resulting flow produces a column Φ(ρ̄). A steady state is a root of H(ρ̄) = Φ(ρ̄) − ρ̄.
- The search starts from the no-flow column, where a still duct holds the temperature of what surrounds it (25 °C outdoors, the room profile inside). It then marches the way H points, which is the way the duct's temperature would actually drift.
- A second search from the opposite start detects a second steady state (section 6).

**(14) Neutral plane.** Height where a plain hole would carry no flow: g·[I(h) − ρ_out·h] = pRef. It is solved by bisection on [−50, 50] m with the profile clamped beyond the room, so it can be virtual: below 0 or above the ceiling.

**(15) Closed casing heater over the floor inlet (a node at the casing foot, pressure p_b).**
- Node balance: ṁ_floor(−p_b) + ṁ_slot(pRef − p_b) = ṁ_casing.
- Casing flow solves: Ergun(stone heap) + ½ρ(V_s/ε)² = p_b − pRef + g·[I(H_c) − J_c].
- The column is J_c = (P/R)·H_c·ln(T₂/T₁)/(T₂ − T₁), with T₂ = T₁ + Q_c/(ṁ_c·c_p) (uniform heating along the casing height). T₁ is the mix of floor air and room air entering the foot.
- Ergun: ΔP/L = 150·μ(1−ε)²V/(ε³d²) + 1.75·ρ(1−ε)V²/(ε³d).
- The room sees only the net ṁ_floor: the casing returns what the slot takes from the room.

**(16) Outputs.**
- `q` is the volume flow at the opening: ṁ divided by the density of the air passing it (arriving air on inflow, room air at h on outflow).
- `qOutdoorIn` = Σ ṁ⁺ / ρ_out, the outdoor air entering at 25 °C, in m³/s. ACH = 3600·qOutdoorIn / 12 m³.
- `qOutdoorOut` = Σ |q⁻|, the volume leaving at the density where it leaves.
- `reversed` = the main inlet carries outflow, or the exhaust carries inflow.

## 3. How each opening is built

| Path | Heights (room end / outdoor end) | Inflow losses | Outflow losses | Column |
|---|---|---|---|---|
| Inlet above / middle / low | 0.98 / 0.45 / 0.12, same | entry 0.5, sleeve 0.15 m, grille 8.70 | grille 3.8, sleeve, exit 1.0 | none |
| Floor inlet | 0 / 0 (ventilated crawl space at outdoor conditions) | entry 0.5, 0.10 m sleeve, grille 8.70 | grille 3.8, sleeve, exit 1.0 | none (closed heater: node, eq. 15) |
| Inlet duct, inside reading | inlet height / 0.0625 (floor-level wall penetration) | entry 0.5, sleeve, elbow 0.22, riser, elbow 0.22, grille 8.70 | grille 3.8, elbow, riser, elbow, sleeve, exit 1.0 | room-ambient duct |
| Inlet duct, outside reading | inlet height / 0.0625 (mouth outdoors) | projecting entry 1.0, riser, elbow, sleeve, grille 8.70 | grille 3.8, sleeve, elbow, riser, exit 1.0 | outdoor-ambient duct |
| Exhaust grille, no duct | 0.25 / 0.69, same | entry 0.5, sleeve, grille 8.70 | grille 3.8, sleeve, exit 1.0 (dropped with fan) | none |
| Exhaust + long / short duct | grille / 2.17 or 1.18 | projecting entry 1.0, riser, elbow, sleeve, grille 8.70 | grille 3.8, sleeve, elbow 0.22, riser, exit 1.0 (dropped with fan) | outdoor-ambient duct, cools on the way up |
| Drying vent | 1.94, same | as a wall opening | as a wall opening | none |
| Door gap, bottom / top | 0.005 / 1.899 | crack law (6) | crack law (6) | none |

The fan, when on, sits in the exhaust path just outside the wall (at the duct foot when ducted), handling room air at the grille temperature.

## 4. Constants: value, source, confidence

| Constant | Value | Source | Confidence |
|---|---|---|---|
| g | 9.80665 m/s² | standard gravity (CGPM 1901) | high |
| R (dry air) | 287.05 J/(kg·K) | ISO 2533 standard atmosphere | high |
| c_p | 1007 J/(kg·K) | Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer*, 6th ed., Table A.4, air at 300 K | high |
| μ(T) | Sutherland, μ₀ = 1.716e-5 Pa·s, S = 110.4 K | White, *Viscous Fluid Flow*, 3rd ed., Table 1-2 | high |
| k(T) | Sutherland form, k₀ = 0.0241 W/(m·K), S = 194 K | White, Table 1-3 | high |
| σ | 5.670374e-8 W/(m²·K⁴) | CODATA | high |
| Outdoor air | 25 °C, 101.3 kPa, dry | brief | given |
| Geometry (heights, Ø125, door 0.70 × 1.90, gaps 10 and 2 mm, duct tops 2.17 and 1.18, casing 0.29 × 0.67) | see brief | brief and drawing | given |
| Inlet-duct mouth centre | 0.0625 m | Ø125 resting on the floor; the drawing's particle path enters at y 291, which is 0.063 m | moderate |
| Grille free area n | 0.50 | Duco, "RIBA approved CPD: louvre and grille specification" (duco.eu): 50 % is the usual specified free area. Physical free areas of real louvres run 47–68 %. | low to moderate |
| Grille ζ (in-duct, n 0.5, t/d 0.2) | 3.8 | ASHRAE, *Fitting Loss Coefficients* (online supplement to *Principles of HVAC*, 9th ed., 2021), fitting 6-8, from Idelchik et al. 1986, Diagram 8-6 | moderate (a louvred grille is not a perforated plate) |
| Grille discharging into the room | (1 + √3.8)² = 8.70 | derived, Borda–Carnot (eq. 5) | moderate |
| Flush entry | 0.5 | ASHRAE fitting 1-1 (Idelchik 3-1), t/D ≥ 0.05 | high |
| Projecting thin-wall entry | 1.0 | ASHRAE fitting 1-1, t/D ≈ 0, L/D ≥ 0.5 | high |
| Exit | 1.0 | ASHRAE fitting 2-1 (Idelchik 11-1), uniform velocity | high |
| 90° elbow | 0.22 | ASHRAE fitting 3-1 (Locklin 1950), smooth radius, r/D = 1.0; no low-Re correction | moderate |
| Duct roughness | 0.09 mm | ASHRAE Handbook, Fundamentals, Duct Design chapter, galvanised steel "medium smooth" | moderate (negligible effect) |
| Sleeve length (wall) / floor | 0.15 / 0.10 m | assumed from the site's own build-up (panel, 10 mm gap, 50–100 mm insulation, outer skin) | low (effect under 1 %) |
| Door leaf thickness | 8 mm | usual tempered-glass sauna door | low to moderate |
| Slot discharge coefficient | 0.61 | sharp-edged orifice, classical value (Idelchik; Etheridge & Sandberg) | moderate |
| Crack ζ and viscous term | 1.5, 12·μ·L/g² | Etheridge & Sandberg, *Building Ventilation: Theory and Measurement*, Wiley 1996 (quadratic crack law); Baker, Sharples & Ward, *Building and Environment* 22(4), 1987 | moderate |
| Fan base curve | P-Q points below | Same Sky CFM-A2BG datasheet (sameskydevices.com/product/resource/cfm-a2bg.pdf, dated 08/19/2026, p. 3), model CFM-A225BG-123-374: 120×120×25 mm, 2 300 rpm, 80.17 CFM, 0.17 inH₂O (4.32 mmH₂O, used at Q = 0). The curve is digitised by eye, ±0.1 mmH₂O. | moderate |
| Site fan free air | 68.6 CFM (32.38 l/s) | brief (Ultrar EF12025ML2BP7T0). Its own P-Q curve was not found online. | given |
| Speed scaling | s = 0.8557, so 1 968 rpm equivalent | fan affinity laws | high (law), moderate (curve shape) |
| Fan rated density | 1.1748 kg/m³ (25 °C, 65 % RH, 101.325 kPa) | datasheet test condition, moist-air density | high |
| Laminar friction | Shah 1978 | Shah, R.K., *J. Fluids Eng.* 100:177–179, 1978 | high |
| Turbulent friction | Haaland 1983 | Haaland, S.E., *J. Fluids Eng.* 105(1):89–90, 1983 | high |
| Inside heat transfer | VDI G1 | *VDI Heat Atlas*, 2nd ed., Springer 2010, ch. G1 (Gnielinski) | high (correlation), moderate (use: mixed convection, short duct) |
| Outside natural convection | Churchill & Chu 1975 | *Int. J. Heat Mass Transfer* 18:1323–1329; Incropera eq. 9.26. Still air, cylinder treated as a plate. | moderate |
| Galvanised steel emissivity | 0.25 | common table value, new 0.23 to weathered 0.28 | low to moderate |
| Room profile (stand-in for agent D) | T = 40 + 50·h/2.044 °C, clamped | lab.js's own stack stand-in (40 → 92.5 °C) moved to the brief's 90 °C thermostat | low (to be replaced) |
| **Closed-casing stand-ins (24 states)** | | | |
| Casing plan | 0.29 × 0.29 m | brief gives the width only; square assumed | low |
| Foot intake slot | 20 mm all round | assumption, not in the brief | low |
| Stone heap on top | 0.10 m deep, d 0.075 m, voidage 0.40 | drawing (y 192–205), site rule 5–10 cm stones, Duffie & Beckman pebble beds (~0.4) | low |
| Ergun law | | Ergun 1952, *Chem. Eng. Prog.* 48:89 | high (law), low (use) |
| Mean heater power | envelope UA·ΔT + ventilation enthalpy, about 1.1–1.5 kW | stand-in for agent D. Walls: 75 mm mineral wool (λ 0.037), 15 mm pine (λ 0.13), ISO 6946 surface resistances. Door: 8 mm glass. Floor: ISO 13370 uninsulated slab, λ_ground 2.0. | low |
| Convective fraction through the casing | 1.0 (upper bound) | stand-in for agent D; no cited sauna value found | low |

**Fan curve used, at the rated density** (l/s : Pa):
0 : 31.0, 2.83 : 28.4, 7.07 : 24.3, 10.7 : 20.7, 14.3 : 16.5, 17.8 : 14.7, 20.8 : 14.0, 25.0 : 10.6, 28.7 : 3.95, 32.4 : 0.

The datasheet's operating limit is 70 °C. Exhaust air is 46 °C at the lower grille and 57 °C at the upper grille with the stand-in profile.

## 5. The inlet duct: reading and flag

The comment above `IDUCT` in lab.js says: *"Run inside the room its air warms about halfway, worth half the duct's height; its mouth cannot go below the floor."* My primary reading is therefore **inside**: the wall penetration is at floor level (mouth centre at 0.0625 m), and a bare Ø125 duct rises inside the hot room along the heater wall to the inlet height, its air exchanging heat with the room profile.

**Flag:** the drawing contradicts it. It draws the duct at x = 4–18, beyond the heater wall line at x = 22, with the mouth outdoors at x = −2. The `outside` reading is implemented as `opts.inletDuctReading = 'outside'` (the duct runs outdoors at 25 °C).

**It barely matters, because both readings stall the same way.**
- With a fan, the inside duct warms its air by only about 2 K (25 → 27.4 °C at 9 l/s), not "halfway". The inside heat-transfer coefficient is 3–5 W/(m²·K).
- Without a fan, a high inlet tries to run backwards. Room air entering the duct is hot and has to flow *down* against its own buoyancy, so it plugs the duct. The flow settles at a trickle: inside reading +0.02 l/s, outside −0.25 l/s, against −5.4 l/s with no duct (above inlet, lower grille). This is lab.js's "stall, a warm plug sits in the duct", now derived.
- For the low inlet the duct is 6 cm tall and does nothing.

lab.js also forces `angle` to straight with the inlet duct, so the UI has 579 distinct states. I kept the brief's 651 rows. Angle has no effect in the network either way, since a 45° bore changes no area or loss coefficient worth modelling.

## 6. Two steady states

A bare exhaust duct with no fan can hold two states:
- **Cold and backwards:** outdoor air flows down the duct and keeps it cold.
- **Warm and forwards:** room air flows up and keeps the column light.

This happens when the room's own stack opposes the duct's: an inlet above the grille, or the drying vent open. The model reports the state reached from **still ducts**, meaning the duct starts at 25 °C, as after a cold start with the fan off. It finds the other state from the opposite start and reports it in `alt` and in the CSV columns `alt_*`. 81 of 651 states are bistable, all of them fan-off.

| Layout (no fan, drying vent shut) | Reported (from cold) | Primed (warm duct) |
|---|---|---|
| above inlet, lower grille, long duct | inlet −5.25, exhaust +2.51 l/s (backwards) | inlet +0.52, exhaust −4.89 l/s |
| above inlet, upper grille, long duct | inlet −4.22, exhaust +0.89 | inlet +2.03, exhaust −7.25 |
| middle inlet, lower grille, long duct | inlet −2.32, exhaust +1.17 | inlet +2.92, exhaust −6.32 |

The cold start is the physical history for a sauna heated with the fan off, and the warm state needs priming (a fan run, wind). If the score should credit a primed duct, E can use the `alt` columns.

## 7. Results

### Sanity table: the 8 layouts

Open heater, straight angle, drying vent shut. The grille is the lower one unless named.

| Layout | Outdoor air in, l/s | ACH | Main inlet q | Exhaust q | Door bottom / top q | Neutral plane |
|---|---|---|---|---|---|---|
| No fan, low inlet, lower grille | 3.06 | 0.92 | +1.16 | −1.45 | +1.90 / −2.06 | 0.20 m |
| No fan, low inlet, upper grille | 5.29 | 1.59 | +2.38 | −4.04 | +2.91 / −1.98 | 0.39 m |
| No fan, low inlet, short duct | 6.00 | 1.80 | +2.74 | −4.71 | +3.26 / −1.94 | 0.47 m |
| No fan, low inlet, long duct | 7.78 | 2.33 | +3.64 | −6.71 | +4.14 / −1.82 | 0.68 m |
| Fan, inlet above, lower grille (reference) | 21.64 | 6.49 | +9.13 | −23.17 | +11.01 / +1.50 | 2.62 m (virtual) |
| Fan, inlet above, long duct | 21.68 | 6.51 | +9.15 | −23.22 | +11.03 / +1.51 | 2.63 m |
| Fan, low inlet, lower grille | 21.84 | 6.55 | +9.94 | −23.38 | +10.58 / +1.31 | 2.48 m |
| No ventilation | 1.72 | 0.52 | – | – | +1.72 / −2.08 | 0.16 m |

- **Reference fan operating point:** 23.17 l/s of 46 °C air at 11.36 Pa static (the curve is density-corrected to 1.105 kg/m³). That is 21.6 l/s of outdoor air, 6.5 ACH: "about 20 l/s" with no tuning.
- Across all 324 fan-on states, the fan moves 23.1 to 24.4 l/s.

Volume flows differ in and out because the air leaves warmer than it enters. Mass balances.

### All layouts, open heater

Each cell is outdoor air in l/s, followed by (inlet q / exhaust q). R = reversed, B = bistable.

**Fan off, drying vent shut**

| inlet | exhaust | no duct | short duct | long duct | inlet duct |
|---|---|---|---|---|---|
| above | lower | 6.3 (−5.4 / 2.7) R | 6.2 (−5.3 / 2.5) R | 6.2 (−5.3 / 2.5) R B | 2.2 (0.0 / −0.5) |
| above | upper | 5.3 (−4.3 / 0.9) R | 5.2 (−4.2 / 0.9) R B | 5.2 (−4.2 / 0.9) R B | 3.8 (0.1 / −2.5) |
| middle | lower | 3.9 (−2.4 / 1.3) R | 3.8 (−2.3 / 1.2) R B | 3.8 (−2.3 / 1.2) R B | 2.2 (0.0 / −0.5) |
| middle | upper | 4.5 (1.1 / −3.3) | 6.4 (2.3 / −5.3) | 8.7 (3.7 / −8.1) | 4.6 (1.2 / −3.3) |
| low | lower | 3.1 (1.2 / −1.4) | 6.0 (2.7 / −4.7) | 7.8 (3.6 / −6.7) | 3.0 (1.1 / −1.4) |
| low | upper | 5.3 (2.4 / −4.0) | 6.8 (3.2 / −5.8) | 9.0 (4.3 / −8.4) | 5.3 (2.3 / −4.0) |
| floor | lower | 3.4 (1.7 / −1.8) | 6.1 (3.0 / −4.8) | 7.9 (3.8 / −6.8) | – |
| floor | upper | 5.4 (2.7 / −4.2) | 6.9 (3.4 / −5.9) | 9.1 (4.4 / −8.5) | – |

**Fan on, drying vent shut**

| inlet | exhaust | no duct | short duct | long duct | inlet duct |
|---|---|---|---|---|---|
| above | lower | 21.6 (9.1 / −23.2) | 21.5 (9.1 / −23.1) | 21.7 (9.1 / −23.2) | 21.6 (9.0 / −23.1) |
| above | upper | 21.2 (8.9 / −23.5) | 21.1 (8.9 / −23.4) | 21.5 (9.1 / −23.8) | 21.2 (8.8 / −23.4) |
| middle | lower | 21.8 (9.7 / −23.3) | 21.7 (9.7 / −23.2) | 21.8 (9.7 / −23.4) | 21.7 (9.5 / −23.3) |
| middle | upper | 21.3 (9.5 / −23.6) | 21.3 (9.5 / −23.6) | 21.6 (9.6 / −23.9) | 21.3 (9.4 / −23.6) |
| low | lower | 21.8 (9.9 / −23.4) | 21.7 (9.9 / −23.3) | 21.9 (10.0 / −23.4) | 21.8 (9.8 / −23.3) |
| low | upper | 21.4 (9.8 / −23.7) | 21.3 (9.7 / −23.6) | 21.6 (9.9 / −24.0) | 21.4 (9.6 / −23.7) |
| floor | lower | 21.9 (10.0 / −23.4) | 21.8 (10.0 / −23.3) | 21.9 (10.0 / −23.4) | – |
| floor | upper | 21.4 (9.8 / −23.7) | 21.4 (9.8 / −23.6) | 21.7 (9.9 / −24.0) | – |

**Fan off, drying vent open.** The vent takes 10–11 l/s out. Every state is reversed, because the exhaust grille becomes an inlet.

| inlet | exhaust | no duct | short duct | long duct | inlet duct |
|---|---|---|---|---|---|
| above | lower | 9.9 (−0.2 / 4.6) R | 9.7 (0.1 / 4.3) R | 9.7 (0.2 / 4.2) R | 10.1 (0.9 / 4.2) R |
| above | upper | 9.6 (0.9 / 3.2) R | 9.6 (1.1 / 3.1) R | 9.6 (1.1 / 3.0) R B | 9.7 (1.5 / 3.0) R |
| middle | lower | 10.6 (2.8 / 3.5) R | 10.6 (2.9 / 3.3) R | 10.6 (2.9 / 3.3) R B | 10.6 (2.7 / 3.5) R |
| middle | upper | 10.3 (3.3 / 2.1) R | 10.2 (3.4 / 2.0) R B | 10.2 (3.4 / 2.0) R B | 10.2 (3.3 / 2.2) R |
| low | lower | 10.8 (3.6 / 3.2) R | 10.8 (3.6 / 3.0) R | 10.8 (3.7 / 3.0) R B | 10.8 (3.5 / 3.2) R |
| low | upper | 10.4 (4.1 / 1.7) R | 10.4 (4.1 / 1.7) R B | 10.4 (4.1 / 1.6) R B | 10.4 (4.0 / 1.8) R |
| floor | lower | 10.9 (3.8 / 3.1) R | 10.9 (3.8 / 3.0) R | 10.8 (3.9 / 2.9) R B | – |
| floor | upper | 10.5 (4.3 / 1.6) R | 10.5 (4.3 / 1.6) R B | 10.4 (4.3 / 1.5) R B | – |

**Fan on, drying vent open.** The vent becomes an inlet at 3–4 l/s. The fan moves 23.6–24.4 l/s and outdoor air is 21.6–22.3 l/s. No state is reversed.

**Heater.** The heater changes nothing in the network except for the floor inlet under the closed casing (section 9). Angle changes nothing anywhere.

## 8. Checks

| Check | Result |
|---|---|
| Mass balance | max \|Σṁ\| = 9.8e-15 kg/s over 651 states (requirement 1e-9). Every state converged. |
| Raising the outlet never lowers no-fan flow with a low or floor inlet (drying vent shut) | Passes for every duct and heater. Low inlet: 3.06 → 5.29 (no duct), 6.00 → 6.82 (short), 7.78 → 9.03 (long). **With the drying vent open it fails slightly** (10.85 → 10.43): the vent is then the outlet and the "exhaust" grille is an inlet, so raising it takes it closer to the neutral plane. This is physical, not a bug. |
| Long duct beats short beats none (no fan, low or floor inlet, vent shut) | Passes in every case. Same caveat with the vent open: the cold duct then runs backwards and the order inverts by under 1 %. |
| Fan-on total extract equals the fan's operating point | It is the operating point by construction (exhaust q = fan Q exactly). The point moves 23.1–24.4 l/s with the layout, against 23.2 l/s in the reference. |
| An inlet higher than the outlet with no fan runs backwards | Above inlet with either grille, and middle inlet with the lower grille: reversed for every heater with no duct. Ducts do not self-start (section 6). |
| Stack sign | The neutral plane is low (0.16–0.9 m) without a fan and above the ceiling (2.4–2.6 m) with it, so the whole envelope is under suction. |
| Profile integrated, not averaged | A uniform 65 °C room (the linear profile's mean) gives no-fan flows **29 % higher** (3.96 against 3.06 l/s, low inlet and lower grille) because it overstates the density deficit between low openings. |
| Speed | Mean 0.22–0.36 ms per state (cold JIT included), maximum 1.8 ms for the closed-casing states with an exhaust duct, which run a nested node solve and the bistability check. 0.26 ms mean with a fresh profile closure per state, as agent D will pass. |

## 9. Sensitivities (outdoor air, l/s)

| Case | NF low/lower | NF low/upper | NF low/short | NF low/long | F above/lower | F above/long | F low/lower | none |
|---|---|---|---|---|---|---|---|---|
| base | 3.06 | 5.29 | 6.00 | 7.78 | 21.64 | 21.68 | 21.84 | 1.72 |
| grille n = 0.4 | 2.77 | 4.52 | 5.11 | 6.45 | 17.81 | 18.08 | 17.99 | 1.72 |
| grille n = 0.6 | 3.36 | 6.08 | 6.94 | 9.03 | 24.09 | 24.01 | 24.25 | 1.72 |
| insulated ducts (no cooling) | 3.06 | 5.29 | 6.13 | 8.06 | 21.64 | 21.72 | 21.84 | 1.72 |
| door gaps sealed | 1.24 | 2.91 | 3.46 | 4.76 | 15.98 | 16.26 | 16.37 | – |
| curved profile (90 − 50(1 − h/H)²) | 3.33 | 5.89 | 6.66 | 8.62 | 21.21 | 21.44 | 21.45 | 1.90 |
| uniform 65 °C | 3.96 | 6.41 | 7.81 | 9.99 | 20.48 | 21.13 | 20.76 | 1.85 |

**Floor inlet under the closed casing** (floor inlet q / outdoor air, l/s):

| Layout | Open heater (no coupling) | 20 mm foot gap (base) | 5 mm | 2 mm | 50 mm | convective fraction 0.5 | stones 0.3 m |
|---|---|---|---|---|---|---|---|
| no fan, no duct | 1.66 / 3.39 | 2.43 / 3.83 | 3.86 / 4.40 | 4.52 / 4.52 | 1.86 / 3.51 | 2.11 / 3.65 | 2.05 / 3.62 |
| no fan, long duct | 3.84 / 7.88 | 4.08 / 8.01 | 4.84 / 8.38 | 5.28 / 8.57 | 3.89 / 7.91 | 3.93 / 7.93 | 3.91 / 7.92 |
| fan, no duct | 10.02 / 21.85 | 10.02 / 21.85 | 10.02 / 21.86 | 10.03 / 21.86 | 10.02 / 21.85 | 10.00 / 21.85 | 9.99 / 21.85 |

With a fan the casing does nothing. Without one its chimney adds 12–170 % to the floor inlet (46 % at the 20 mm stand-in), depending on a foot geometry the brief does not give.

## 10. Surprises

1. **The 10 mm door undercut is as big as the inlet.**
   - Its effective area (0.70 × 0.010 × 0.61 = 0.0043 m²) matches the Ø125 inlet behind a 50 % grille (0.0040 m²).
   - With the fan on, the door supplies 11 of the 21.6 l/s of make-up air and the designed inlet only 9 (42 %). Agent C should know that half the fresh air enters at the door bottom.
   - Sealing the door gaps drops the reference fan flow to 17.1 l/s, all through the inlet.
2. **Without a fan the 2 mm gap at the door top is a main outlet** (about 2 l/s), as large as the lower exhaust grille (1.45 l/s).
   - The low-inlet, lower-grille layout ventilates 3.1 l/s (0.9 ACH), of which only 1.45 l/s leaves through the grille.
   - "No ventilation" still gives 1.7 l/s (0.5 ACH) through the door.
3. **Exhaust ducts without a fan are bistable when the room's stack opposes them** (section 6). From a cold start a long duct behind a high inlet runs backwards and stays that way. Primed, it runs forwards at 5–7 l/s.
4. **The inlet duct stalls** for the above and middle inlets without a fan, in both readings. It warms its air by about 2 K, not "halfway", when air actually flows.
5. **The drying vent open with no fan** becomes the outlet (10–11 l/s) and turns the exhaust grille into an inlet: about 3 ACH of outdoor air, all short-circuiting to the ceiling. With the fan it becomes a 3–4 l/s inlet high on the wall, as lab.js's DRY note anticipated.
6. **The fan makes the layout nearly irrelevant to the flow.** Stack is at most about 1 Pa against the fan's 11 Pa, and ducts move fan flow by under 2 %. With a fan the layout matters only for *where* the air goes (agent C), not how much.
7. **The bare duct's cooling costs about 5 % of the duct flow** (long duct, low inlet: 6.71 against 7.03 l/s insulated; 3.5 % of outdoor air). The air cools 46 → 42 °C over 1.9 m in still air, with U′ = 0.75 W/(m·K): the inside coefficient is about 3.3 and outside convection plus radiation about 4.4 W/(m²·K). lab.js's `BARE = 0.93` (7 %) overstates it by about half again.
8. **The upper grille ventilates more than the lower one without a fan in every layout, but slightly less outdoor air with the fan** (21.2 against 21.6 l/s). The fan moves volume, the upper grille's air is 11 K hotter, and so it carries less mass.

## 11. The three assumptions I am least sure of

1. **The grille.** Free area 0.5 and the perforated-plate coefficients (3.8 out, 8.70 discharging in) set every vent flow. n = 0.4 or 0.6 moves no-fan results by ∓10 to 17 % and fan-on results by −18 % / +11 %. A real sauna valve's datasheet loss coefficient would fix this.
2. **Which steady state a bistable duct is in** (81 fan-off states), plus the still-air heat transfer that decides the bistability's extent. I report the cold-start state. Wind, sun on the duct, or a fan run would prime the other one.
3. **The closed casing's foot geometry and convective heat** (stand-ins), which change the no-fan floor inlet by a factor of up to 2.7. The door gaps are a close fourth: whether they really open to 25 °C air, and their real size, decide half the fan-on make-up air.

## 12. What I would check next

1. Iterate with agent D's profile, which depends on the flows, until both converge.
2. Get a measured loss coefficient for a typical sauna valve and the Ultrar fan's own P-Q curve.
3. Add wind pressure on the duct outlet and the inlet, and sun on a bare duct. Both bear on which bistable branch survives.
4. Model two-way flow within the Ø125 openings near the neutral plane (the drying vent, the upper grille), and the radiant heating of an inlet duct running beside the heater.
5. Use a real floor-standing heater's foot and stone geometry for the casing node.

## 13. Interface notes for the other agents

`airflow(state, profile, opts?)` returns the brief's fields:
- `openings` [{name, role, h, q, mdot, T}, plus duct temperatures and heat-transfer coefficients, fanQ and fanDp, and casing node values].
- `qOutdoorIn`, `qOutdoorOut`, `mainInletQ`, `mainExhaustQ`, `dryQ`, `doorLowQ`, `doorTopQ`, `neutralPlaneH`, `reversed`, `notes`.

Extras: `pRef`, `massIn`, `massOut`, `residual`, `converged`, `ach`, `bistable`, `alt`.

`role` is one of inlet, exhaust, dry, doorLow, doorTop. q is in m³/s at the opening, positive into the room. For the floor inlet under the closed heater, `q` is the outdoor air entering the casing foot.

`profile` is any `T(h)` function in °C. It is sampled on 0–2.30 m and cached per function object, so do not pass a function whose output changes between calls. `opts` overrides any field of `PARAMS` for sensitivity runs: `inletDuctReading`, `grilleFreeArea`, `ductHeatFactor`, `doorGapLow`, `doorGapTop`, `casingBaseGap`, `heaterConvFraction`, and the rest.
