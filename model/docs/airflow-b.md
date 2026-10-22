# Agent B: independent airflow network

Agent B's cross-check of the sauna's airflow network. It was built without reading any `A_` file.

Files in this folder:
- `B_airflow.js` is the module. It exports `airflow(state, profile, opts)` and `defaultProfile(h)`.
- `B_airflow.csv` holds all 651 valid states, in the brief's column order.
- `B_airflow_branches.csv` holds the 144 states whose exhaust duct has more than one possible flow branch.
- `B_run.js` regenerates both CSVs and runs the checks.
- `B_sens.js` runs the sensitivity table.
- `B_survey.js` prints every layout with the open heater.

## 1. Method

The room is a single zone with a vertical temperature profile T(h). The model has one unknown: p0, the room pressure at the floor relative to outdoor air at the floor. Every flow path k connects the room at a height h_k to outdoors. Its mass flow m_k (positive into the room) satisfies:

```
S(h_k) − p0 + J_k(m_k) = 0
S(h)  = g · ( ∫0^h ρ_room(z) dz − ρ_out · h )          outdoor-minus-room pressure at h when p0 = 0
J_k(m) = B_k(m) + F_k(m) − L_k(m)                        duct buoyancy + fan pressure − signed loss
Σ_k m_k(p0) = 0                                          room mass balance, solved for p0
```

This is the hydrostatic, neutral-pressure-plane formulation. Its basis is the stack equation of ASHRAE Handbook, Fundamentals (2021), ch. 16 "Ventilation and Infiltration": Δp_s = (ρ_o − ρ_i) g (H_NPL − H). The model writes it with the stratified integral instead of a mean density.

The neutral plane is the height where S(h) = p0. When p0 lies outside the room's range it is extrapolated with the density at the floor or at the ceiling, so the value can fall above the ceiling or below the floor.

How the solve works:
1. The outer loop is Illinois (modified regula falsi) on p0.
2. Each ducted path gets its own inner root-solve for m_k, because duct buoyancy depends on the path's own flow.
3. Plain openings and cracks are inverted in closed form.

### 1.1 Openings

All openings are Ø125 mm (A = 0.01227 m²) with one grille on the room side. Every loss is referred to the velocity head ρv²/2 in the Ø125 sleeve, and the density is that of the air passing.

| element | loss coefficient ζ | source |
|---|---|---|
| grille: thin perforated plate, free-area ratio f = 65/122.7 = 0.530 | orifice in a duct: ζ = [(1−f) + 0.707(1−f)^0.375]² / f². Written as (1/(εf) − 1)², this fixes the jet contraction ε | Idelchik, Handbook of Hydraulic Resistance, 3rd ed., Begell House 1994, diagram 4‑14, p. 221, Re ≥ 1e5 (as cited by the Modelica Standard Library). Moderate confidence |
| grille at the room end, air entering the room | all jet energy is lost: ζ = (1/(εf))² = [1 + 0.707(1−f)^0.375]² / f² = 8.37 | derived from the row above |
| grille at the room end, air leaving the room into the sleeve | contraction from a free space (f → 1 gives the sharp entry, 0.50): ζ = (1.707/f − 1)² = 4.94 | derived from the same relation. Moderate-to-low confidence |
| sharp flush entry from outdoors | 0.5 | Idelchik, inlet sections. High |
| free discharge of a duct into a large space | 1.0 | Idelchik. High |
| projecting thin-walled duct end used as an inlet (re-entrant) | 1.0 | Idelchik. Moderate |
| 90° elbow, R/D = 1 | A1·B1·C1 = 1.0 · 0.21 · 1.0 = 0.21 | Idelchik diagram 6‑1. Moderate |
| friction | λ = max(64/Re, 0.1·(1.46 Δ/D + 100/Re)^0.25), with Δ = 0.15 mm | Idelchik's transition-region formula (Altshul) and Poiseuille. Roughness of galvanised steel: Idelchik's range 0.10–0.15 mm. Moderate. Below 3 % of path loss everywhere |

Loss in a run: Δp = (Σζ + λ L/D) · ρ v²/2.

Without a duct, an exhaust fan discharges straight outdoors. In that case no separate exit loss is added, because the fan's static-pressure curve already spends its own outlet velocity head.

Resulting effective areas, A/√Σζ:
- Inlet, inflow: 41 cm².
- Exhaust, outflow: 50 cm².
- Under-door gap: 57 cm². This difference drives the largest surprise below.

### 1.2 Door gaps (cracks)

The door gaps use the quadratic crack law of Baker, Sharples & Ward, "Air flow through cracks", Building and Environment 22(4) 293–304, 1987, eqs. (9)–(10). This was read from the paper. High confidence.

```
Δp = A·Q + B·Q²,   A = 12 μ z / (L d³),   B = ρ C / (2 d² L²),   C = 1.5 (straight-through: entry 0.5 + exit 1.0)
Q  = (−A + √(A² + 4B|Δp|)) / (2B)
```

| quantity | value |
|---|---|
| crack length L | 0.70 m |
| crack depth z | 8 mm, the glass thickness. Harvia glass doors, for example DA71905 "glass door satin 7x19", use 8 mm tempered glass (harvia.com product pages). High |
| under-door gap d | 10 mm, centred at 0.005 m |
| top gap d | 2 mm, centred at 1.911 m (glass from 0.010 to 1.910 m) |

The door's far side is taken at outdoor temperature and pressure, 25 °C. This is an assumption: the adjoining room is treated as connected to outdoors.

### 1.3 Ducts: geometry, cooling, buoyancy

The exhaust duct is a bare galvanised Ø125 duct outdoors. It runs through the wall sleeve, turns up in one elbow, and rises vertically from the grille height to its outlet: 2.17 m for the long duct, 1.18 m for the short one.

Buoyancy of the duct column, for outflow:

```
B = − g · ( ρ_out · L_v − (p/R) ∫ dz / T_d(z) )
```

When the flow is reversed, outdoor air comes down the duct at 25 °C, so B = 0.

Cooling of the duct air:
- Inside the duct the temperature decays as T_d(s) = T_s + (T_in − T_s) · exp(−U π D s / (ṁ c_p)).
- The integral ∫dz/T is taken in closed form per segment.
- U = 1 / (1/h_i + 1/h_o). The steel wall resistance is neglected.

The inside coefficient h_i:
- Laminar (Re ≤ 2300): Hausen thermal-entry correlation, Nu = 3.66 + 0.0668 Gz / (1 + 0.04 Gz^(2/3)), with Gz = (D/L) Re Pr.
- Turbulent (Re ≥ 3000): Gnielinski, with the Petukhov friction factor.
- Between the two, a linear blend.
- Source: Incropera et al., Fundamentals of Heat and Mass Transfer, 6th ed., eqs. 8.57, 8.62, 8.21. High.

The outside coefficient h_o:
- Natural convection: Churchill–Chu on a vertical surface of the duct's length (Incropera eq. 9.26). Calm air. Moderate, because the D/L condition is marginal.
- Grey radiation: εσ(T_w² + T_s²)(T_w + T_s). The wall temperature comes from 4 fixed-point steps.

Emissivity of galvanised steel:
- Outdoors, weathered: 0.28 (Engineers Edge table, "galvanized, dirty").
- Indoors, new: 0.23 (CIBSE Guide C, table 3.7, via the IES VE help page).
- Moderate confidence.

Air properties:
- Dry air, p = 101.3 kPa, R = 287.05 J/kg·K, c_p = 1006 J/kg·K.
- Viscosity and conductivity from Sutherland's law: μ0 = 1.716e‑5 Pa·s with S = 110.4 K, and k0 = 0.0241 W/m·K with S = 194 K (White, Viscous Fluid Flow).
- Humidity is ignored (see §5).

Result: on the long duct at 6.7 l/s, the air cools from 46.7 to 43.1 °C. The bare duct then carries 3.4 % less flow than an insulated one; on the short duct the deficit is 1.9 %. lab.js uses `BARE = 0.93`, a 7 % deficit, so the computed effect is about half the site's figure.

### 1.4 The inlet duct: how I read IDUCT

The comment above `IDUCT` in lab.js says: "a chimney is a column of warm air, and an inlet duct carries cold air. Run inside the room its air warms about halfway, worth half the duct's height; its mouth cannot go below the floor."

**My reading:**
1. Outdoor air enters a wall penetration at floor level, the mouth. Its centre is at D/2 = 0.0625 m.
2. The air rises in a bare duct inside the hot room. The duct exchanges heat with the room profile T(z) by convection plus radiation, with ε = 0.23.
3. The air discharges through the grille at the inlet height. The path has two elbows.
4. A warmed column inside the duct aids the inflow:

```
B = + g · ( ρ_out · L_v − (p/R) ∫ dz/T_d )
```

This lowers the inlet's effective height. The model computes the warming instead of assuming "about halfway".

**Flag:** the drawing (`render()`, the duct at x = 4…18) puts the duct *outside* the heater wall, which contradicts "run inside the room". The STALL_PATHS block and its "a warm plug sits in the duct" label agree with the comment, so the comment is the main reading. `opts.inletDuctInRoom = false` gives the drawn version. There the duct air stays at 25 °C, the duct adds only friction, and a high inlet reverses (−0.25 l/s for the inlet above, no fan). lab.js also forces the angle to straight with the inlet duct; the brief does not, and the angle has no airflow effect here anyway.

### 1.5 Fan

The curve comes from **Same Sky CFM‑A225BG‑123‑374**: 120×120×25 mm, 2,300 rpm, 80.17 CFM free air, 0.17 inH₂O. Source: datasheet "CFM‑A2BG", rev 1.04, 2026‑08‑19, p. 3. I digitised it by eye from the plotted points, ±0.1 mmH₂O and ±1 CFM. The points, as (CFM, mmH₂O):

(0, 4.40), (7.3, 3.95), (17.4, 3.38), (26.3, 2.88), (35.2, 2.30), (44.1, 2.03), (51.6, 1.95), (62.5, 1.45), (71.0, 0.55), (80.17, 0).

Scaling and density correction:
- The curve is scaled by the fan laws to the site's fan, 68.6 CFM free air. The speed ratio s = 68.6/80.17 = 0.856 corresponds to 1,968 rpm, so Q·s and P·s².
- Pressure is then scaled with density, P ∝ ρ at fixed speed and volume flow (fan laws, ASHRAE HVAC Systems & Equipment, Fans chapter). The test density is 1.184 kg/m³, from the datasheet's 25 °C.
- Scaled values: free air 32.4 l/s, shut-off 31.6 Pa, and 14.2 Pa at 20 l/s.
- Outside the published range the curve is extended with its end segments: backflow, and overdriven past free air.

Confidence:
- Moderate for the shape.
- Low for this curve being the Ultrar's. I found no Ultrar datasheet online, and the class-typical shut-off pressure, scaled from the 1,500 rpm model instead, is 33.9 Pa.

The fan is not tuned. The reference system (inlet above, lower grille, no duct) lands at **22.3 l/s** through the fan and 20.8 l/s of outdoor air.

### 1.6 Floor inlet and the casing heater's chimney

The floor opening is a Ø125 grille through a 0.10 m floor, fed from a crawlspace open to outdoor air at h = 0. That is the first of the brief's two readings. If it were ducted to the outside wall, about 0.36 m of duct and one elbow would add roughly 0.3 to Σζ, which is around 9.

With the open pillar heater and the wall heater, the floor opening discharges into the room at h = 0. The pillar is open on all sides, and the wall heater's intake is 0.30 m higher.

With the **closed** heater, the casing base is a second node C:

```
floor:   outdoors(0) → C                     plain-opening law, Δ = −p_C
intake:  room(0) ↔ C                         m_i = A_int √(2ρ|p0 − p_C| / 1.5)   (sharp entry 0.5 + velocity head 1.0)
chimney: C → room at H_c = 0.76 m            (p_C − p0) + g(I(H_c) − (p/R)∫dz/T_c) = stones + exit
stones:  Ergun, Δp/L = 150 μ(1−ε)²u/(ε³d²) + 1.75 ρ(1−ε)u²/(ε³d)      Ergun 1952, Chem. Eng. Prog. 48:89. High
T_c:     linear from T_mix to T_top = T_mix + P_conv/(ṁ c_p)
```

The two balances (room on p0, node on p_C) are solved nested. The node residual is at most 8.8e‑15 kg/s.

Inputs for the casing:

| input | value | source and confidence |
|---|---|---|
| casing plan | 0.29 × 0.29 m | width from the brief; depth = width is an assumption |
| H_c, top of the stones | 0.76 m | the drawing |
| stone layer | 0.09 m deep | the drawing |
| stone size d | 75 mm | Harvia manuals say 5–10 cm |
| void fraction | 0.45 | typical for broken stone; low confidence, uncited |
| intake area A_int | the full casing section | an open base: the geometric upper bound |
| P_conv | 12 kW × 0.75 = 9 kW | elements on. The 0.75 convective share is low confidence: the only number I found is a CFD-Online forum report of a measured radiative:convective split of 3:7 to 2:8. Agent D should replace it |

## 2. Results: the 8 sanity layouts

Settings: open heater, straight angle, drying vent shut, default profile.

Units and sign:
- Flows are in l/s at the opening's own air conditions; positive means into the room.
- "Outdoor in" is the total inflow converted to 25 °C.
- ACH = outdoor-in × 3600 / 12 m³.

| layout | main inlet | exhaust | door low | door top | **outdoor in** | **ACH** | NPL (m) | branch |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| no fan, low inlet, lower grille | +1.03 | −1.58 | +2.32 | −2.29 | **3.35** | **1.01** | 0.18 | unique |
| no fan, low inlet, upper grille | +2.20 | −4.50 | +3.54 | −2.22 | **5.74** | **1.72** | 0.34 | unique |
| no fan, low inlet, short duct | +2.49 | −4.91 | +3.89 | −2.20 | **6.38** | **1.91** | 0.39 | runs warm (only steady state) |
| no fan, low inlet, long duct | +3.21 | −6.71 | +4.79 | −2.13 | **8.00** | **2.40** | 0.53 | runs warm (only steady state) |
| fan, inlet above, lower grille | +7.47 | −22.29 | +12.94 | +0.37 | **20.78** | **6.23** | 2.00 | unique |
| fan, inlet above, long duct | +7.22 | −21.47 | +12.66 | +0.14 | **20.02** | **6.01** | 1.94 | unique |
| fan, inlet low, lower grille | +8.81 | −22.47 | +12.32 | −0.23 | **21.14** | **6.34** | 1.86 | unique |
| no ventilation (door gaps only) | – | – | +1.89 | −2.30 | **1.89** | **0.57** | 0.13 | unique |

Fan operating points:
- Reference system: 22.29 l/s at 11.95 Pa, with the air at 46.7 °C.
- Across all 324 fan-on states: 21.3 to 22.9 l/s.

**Mass balance.** Over all 651 states, the largest |Σṁ| is 2.3e‑13 kg/s, and the casing node closes within 8.8e‑15 kg/s. Both are below 1e‑9 in every state.

**Speed.** After JIT warm-up, measured as the median of 7 runs per state: p50 0.14 ms, p95 0.38 ms, max 0.78 ms. No state goes over 1 ms. The first, cold call can take up to a few ms.

**Physical expectations**, all checked on every heater × angle × dry combination by `B_run.js`:
1. Raising the outlet never lowers the no-fan exhaust flow with a low or floor inlet. It holds: 0 failures on the exhaust flow.
2. A long duct beats a short one, and a short duct beats none. It holds: 0 failures on the exhaust flow.
3. Total outdoor air goes down slightly in 45 cases, all with the **drying vent open**. There the vent at 1.94 m is the room's outlet (about 10–11 l/s) and the grille becomes an *inlet*, so raising it moves an inlet toward the neutral plane. This is not a violation, because the grille is no longer an outlet.
4. Fan-on extract sits near the fan's operating point. It holds: 21.3–22.9 l/s against the reference 22.3 l/s. Stack pressures, at most about 1.5 Pa, are small next to the roughly 12 Pa the fan develops.

**Angle and heater.** Neither changes the network, except for the closed heater with the floor inlet. The default profile does not depend on the heater, so the three `vent: none` rows are identical. Agent D's heater-dependent profile will separate them.

## 3. Surprising results (reported, not tuned)

1. **The 10 mm door undercut is the room's main inlet.** Its open area is 70 cm² against the grille's 65 cm², and its loss coefficient is 1.5 against the grille's roughly 8.9 (see §1.1). With the fan on, it supplies **58–62 % of the outdoor air**, about 12–13 of 21 l/s. The inlet above the heater supplies only 7.5 l/s. Without a fan it supplies about 60–70 % of the inflow. Sealing the door (sensitivity, §5) cuts the fan flow to 15.4 l/s and the no-fan flows by 40–63 %. This matters most to agent C: most fresh air enters at the floor by the door, not at the heater.

2. **Bare outdoor ducts without a fan can be bistable.** A duct carrying room air warms and draws. A duct carrying outdoor air downward stays cold and keeps flowing in. Across the 651 states:

   | class | count | where |
   |---|---:|---|
   | bistable: both steady states close the mass balance | 87 | 24 with the drying vent shut: inlet above or middle, lower grille, short or long duct. The other 63 have the vent open |
   | reversed only: the duct cannot run warm | 15 | all with the drying vent open |
   | runs warm only: unique | 42 | |

   Branch rule: the session starts with a cold duct and nothing in the model kicks it. So **the cold-start state is shown** wherever it is a consistent steady state, and the running state is returned in `alt` (and in `B_airflow_branches.csv`). `opts.branch = 'warm'` flips the choice.

   Example, inlet in the middle, lower grille, long duct:
   - Cold start: the duct is reversed (+0.94 l/s in), and outdoor air is 4.2 l/s.
   - Running: −6.4 l/s out, and outdoor air is 7.7 l/s.

   The brief's gravity layouts (low inlet, drying vent shut) all have a unique running state, so the expectations above do not depend on this rule. The theory is known; see Li, Delsante et al., "Some examples of solution multiplicity in natural ventilation", Building and Environment 36 (2001) 851–858. I recalled this reference and did not re-check it this session.

3. **Without a fan, the inlet above the heater flows backwards in every layout with the lower grille, even with a running duct.** With no duct: −6.1 l/s out through the inlet, and +2.5 l/s in through the grille. With the long duct running warm, the inlet still flows out at −2.1 l/s, and the door undercut supplies 7.5 l/s. The site's "off|above|riser: 2–3/h, warm feet" assumes the duct turns the flow around; in this model it does not.

4. **The in-room inlet duct stalls with no fan when the inlet is above or middle.** Inflow is 0.02–0.03 l/s and the duct air reaches the room temperature (73.8 °C at the top). The reason: any inflow fills the duct with cold, heavy air, which raises the inlet's effective height above the neutral plane. This matches lab.js's "stall" flag, and it is computed, not assumed. With the fan on, the duct warms the air only 0.7–2.8 K and changes the flow by less than 0.2 l/s. With the low inlet it does nothing, because the duct is only 6 cm long.

5. **The casing chimney barely feeds the floor inlet when the casing's base is open.** It pulls only 0.02–0.05 Pa at the floor hole: +0.3 l/s without a fan, +0.02 l/s with one. It matters only if the base is closed around the hole:

   | base intake | floor flow, no fan | door undercut |
   |---|---:|---|
   | open (primary) | 1.86 l/s | inflow |
   | 30 mm slot | 2.8 l/s | inflow |
   | 10 mm slot | 5.3 l/s | reverses to outflow |
   | 2 mm slot | 7.9 l/s | outflow |

   Air leaves the casing top at about 390 °C, because the stone bed limits the casing flow to about 25 g/s. If the convective power is cut to 3 kW, about the mean power once the thermostat cycles, the floor flow drops by only 0.1 l/s.

6. **With the upper grille, the fan sees 69.9 °C air**, right at the Same Sky fan's 70 °C limit. Agent E or the page should flag it.

7. **Door gaps alone give 0.57 ACH**, against the site's 0.3/h for no ventilation.

## 4. Assumptions I am least sure of (in order)

1. **Grille free area and its loss model.** The free area is 53 % (Tecnosystemi G.C.I. 11104046, an ABS grille with insect screen, "air passage 65 cm²"; datasheet rev. 01, 2025‑06‑20). The grille is modelled with Idelchik's thin-orifice treatment. A real sauna grille is wood or metal. At 40 % or 70 % free area the reference fan flow is 16.5 or 24.3 l/s, and the inlet-versus-door split moves with it. This is the largest lever in the model.
2. **The bistable branch rule.** Cold start is shown, running warm goes in `alt`. This changes 24 drying-vent-shut states by up to about 3.5 l/s of outdoor air.
3. **Door gaps as straight-through 8 mm cracks into a space at outdoor temperature and pressure.** They dominate both the fan make-up air and the gravity flows. If the dressing room is warmer than 25 °C, or if the top gap is an L-shaped crack (C = 2.5) behind a frame stop, the door's share changes.

Also uncertain, with smaller effect:
- The default profile: Saari et al. 2002, sauna B, scaled to 90 °C at the sensor. Agent D owns it.
- The fan curve's identity with the Ultrar.
- The casing internals.
- The 0.75 convective share.
- Calm air outdoors: wind would roughly double the outside coefficient h_o and also act on every opening.

## 5. Sensitivity (outdoor air in, l/s; exhaust grille flow in brackets)

| layout | base | humid air* | door sealed | grille 40 % | grille 70 % | duct insulated | fan curve from 1,500 rpm model | linear fan curve |
|---|---|---|---|---|---|---|---|---|
| no fan low/lower | 3.35 (1.6) | 3.78 (2.0) | 1.24 (1.3) | 2.98 (1.2) | 3.85 (2.1) | 3.35 | 3.35 | 3.35 |
| no fan low/upper | 5.74 (4.5) | 6.29 (5.1) | 3.07 (3.5) | 4.74 (3.3) | 7.03 (6.0) | 5.74 | 5.74 | 5.74 |
| no fan low/short | 6.38 (4.9) | 7.17 (5.8) | 3.54 (3.8) | 5.25 (3.7) | 7.76 (6.4) | 6.47 (5.0) | 6.38 | 6.38 |
| no fan low/long | 8.00 (6.7) | 9.01 (7.9) | 4.81 (5.2) | 6.50 (5.1) | 9.82 (8.7) | 8.21 (6.9) | 8.00 | 8.00 |
| fan above/lower | 20.78 (22.3) | 20.46 (22.2) | 15.41 (16.5) | 16.48 (17.2) | 24.30 (26.1) | 20.78 | 21.31 (22.9) | 19.47 (20.8) |
| fan above/long | 20.02 (21.5) | 20.07 (21.7) | 15.29 (16.4) | 16.35 (17.0) | 23.21 (24.9) | 20.03 | 20.51 (22.0) | 19.06 (20.2) |
| fan low/lower | 21.14 (22.5) | 21.12 (22.5) | 15.87 (17.0) | 16.89 (17.3) | 24.55 (26.2) | 21.14 | 21.49 (23.0) | 20.07 (21.0) |
| no ventilation | 1.89 | 2.02 | 0.00 | 1.89 | 1.89 | 1.89 | 1.89 | 1.89 |

\* Humid air: a virtual-temperature shift with 50 g/kg inside (Saari measured 45–55 g/kg) and 12 g/kg outside. Moist sauna air is lighter, so the stack flows rise by 7–13 %. **I propose adding humidity to the shared parameters.**

## 6. Constants (summary)

| constant | value | source | confidence |
|---|---|---|---|
| g | 9.80665 m/s² | standard | high |
| R (dry air), c_p | 287.05 J/kg·K, 1006 J/kg·K | standard | high |
| outdoor air, pressure | 25 °C, 101.3 kPa | brief | given |
| geometry heights | as in the brief and the drawing; sensor 1.946 m from lab.js `SENSOR` y = 22 | brief, lab.js | given |
| room profile | Saari et al. 2002, sauna B: 40/49/66/74/83/84 °C at 0.10/0.40/0.70/1.20/1.80/2.10 m, excess over 25 °C × 1.111 so the sensor reads 90 °C. Floor 38.3, grilles 46.7 / 69.9, inlet above 75.5 °C | Saari, Pallari, Salonvaara et al., "Healthy sauna", Indoor Air 2002 Proceedings, p. 397, fig. 4 | moderate as a stand-in |
| grille free area | 65 cm², f = 0.530 | Tecnosystemi G.C.I. 11104046 datasheet | moderate |
| ζ: grille exit / grille entry / sharp entry / exit / re-entrant / elbow | 8.37 / 4.94 / 0.5 / 1.0 / 1.0 / 0.21 | Idelchik 1994 | moderate |
| duct roughness | 0.15 mm | Idelchik | moderate (negligible effect) |
| wall and floor sleeve length | 0.10 m | assumed | low, under 1 % effect |
| door gaps, depth, crack C | 10 mm / 2 mm, 8 mm, 1.5 | brief; Harvia; Baker et al. 1987 | high / high / high |
| fan | Same Sky curve scaled to 68.6 CFM: 32.4 l/s free air, 31.6 Pa shut-off | datasheet + fan laws | moderate |
| emissivity | 0.28 outdoors, 0.23 indoors | Engineers Edge; CIBSE Guide C t. 3.7 | moderate |
| heat transfer correlations | Hausen, Gnielinski, Churchill–Chu | Incropera 6th ed. | high |
| stones | d 75 mm, ε 0.45, 0.09 m layer | Harvia manual; typical; drawing | moderate / low / low |
| convective share | 0.75 | CFD-Online forum report | low |

## 7. CSV notes

- `B_airflow.csv` has 651 rows plus a header, in the brief's column order. The flow columns are named `mainInlet_ls, exhaust_ls, dry_ls, doorLow_ls, doorTop_ls`, so they do not clash with the `exhaust` switch column.
- Flows are in l/s at the opening's own conditions, positive into the room, with 4 decimals. `qOutdoorIn_ls` is at 25 °C.
- `neutralPlaneH_m` is in metres and is extrapolated outside the room.
- `reversed` is 1 when the main inlet flows out or the exhaust flows in, and 0 otherwise. 210 rows have it set.
- The `vent: none` rows have `-` in every switch column except `heater`.
- The row order is the nested loops inlet, exhaust, fan, duct, heater, angle, dry, followed by the three `none` rows.
- Rows where my branch rule chose the cold-start state are listed with their alternative in `B_airflow_branches.csv`.

## 8. What I would check next

1. Real sauna grille free areas and loss coefficients, from wooden louvre grilles and disc valves such as the Fläkt KSOS‑125 and Lindab KSUS. A measured ζ would tighten the fan flow and the door split.
2. The real undercut and frame of Harvia or Tylö glass doors, and whether the top gap is an L-shaped crack.
3. A measured P–Q curve for the Ultrar fan, and its temperature rating.
4. Re-running with agent D's profile. The bistable class boundaries and the inlet-duct stall are sensitive to the bottom 0.5 m of the profile.
5. A transient warm-up run, to confirm which bistable branch a real session reaches. Opening the door at the start of a session could tip the duct into the running state.
