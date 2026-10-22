# Agent C: where the fresh air goes, and CO₂ at the mouth

Module `C_breathing.js`, export `breathing(state, flows[, profile[, opts]])` → `{ fractionToBreathingZone, qFreshAtBreathingZone, co2AtMouth, notes, … }`. Data `C_breathing.csv`: 651 valid states. Flows come from agent A's `A_airflow.js` (its current version, with the shared stand-in profile 40 °C at the floor to 90 °C at the ceiling). Two extra column sets are included. The thermal-limit sensitivity is §5.2. My own stand-in airflow (§7) is kept for comparison.

**Definition.** `fractionToBreathingZone` is the share of the outdoor air entering the room (every opening, door gaps included) that reaches the upper zone U before it leaves. U holds both mouths. `qFreshAtBreathingZone` is that fraction times `qOutdoorIn`. `co2AtMouth` is the upper-bench mouth (1.62 m) 30 minutes into a session with 2 bathers, starting from outdoor air. Extras: `fractionMainInlet` (the main inlet's own air only), `co2Steady`, `floorLayerH`, `heater`, `nodes`, `layer`.

## 1. Results for the named layouts

Open pillar heater, angle straight, drying vent shut, A's flows.

| # | Layout | outdoor in l/s | fraction (main inlet) | fresh at bench l/s | CO₂ 30 min | CO₂ steady |
|---|---|---|---|---|---|---|
| 1 | No fan, low inlet, lower grille | 3.1 | 1.00 (1.00) | 3.1 | 1,915 | 4,109 |
| 2 | No fan, low inlet, upper grille | 5.3 | 0.98 (0.98) | 5.2 | 1,900 | 2,591 |
| 3 | No fan, low inlet, lower grille, short duct | 6.0 | 0.80 (0.80) | 4.8 | 1,805 | 2,769 |
| 4 | No fan, low inlet, lower grille, long duct | 7.8 | 0.43 (0.42) | 3.3 | 2,079 | 3,836 |
| 4b | No fan, low inlet, upper grille, long duct | 9.0 | 0.84 (0.84) | 7.6 | 1,685 | 1,916 |
| 5 | Fan, inlet above, lower grille | 21.6 | 0.69 (1.00) | 15.0 | 1,140 | 1,178 |
| 6 | Fan, inlet above, lower grille, long duct | 21.7 | 0.69 (1.00) | 15.0 | 1,139 | 1,176 |
| 7 | Fan, low inlet, lower grille | 21.8 | 0.24 (0.16) | 5.2 | 1,884 | 2,592 |
| 7b | Fan, low inlet, upper grille | 21.4 | 0.49 (0.45) | 10.4 | 1,440 | 1,510 |
| 8 | No ventilation (door gaps) | 1.7 | 0.98 | 1.7 | 2,235 | 7,088 |

The same layouts with the other heaters. Each cell is fraction / CO₂ at 30 min.

| # | open | closed | wall |
|---|---|---|---|
| 1 | 1.00 / 1,915 | 1.00 / 1,915 | 1.00 / 1,915 |
| 2 | 0.98 / 1,900 | 1.00 / 1,686 | 0.99 / 1,781 |
| 3 | 0.80 / 1,805 | 1.00 / 1,624 | 0.93 / 1,681 |
| 4 | 0.43 / 2,079 | 0.93 / 1,537 | 0.61 / 1,844 |
| 5 | 0.69 / 1,140 | 0.78 / 1,066 | 0.72 / 1,112 |
| 6 | 0.69 / 1,139 | 0.78 / 1,065 | 0.72 / 1,111 |
| 7 | 0.24 / 1,884 | 0.39 / 1,514 | 0.35 / 1,608 |
| 8 | 0.98 / 2,235 | 1.00 / 2,081 | 0.99 / 2,231 |

The same room with the door undercut sealed and the fan at 20 l/s: inlet above with the lower grille gives 1.00 and 971 ppm for every heater. Low inlet with the lower grille gives 0.33 / 0.48 / 0.41 (open / closed / wall).

## 2. Method, step by step

### 2.1 Heat balance at steady state → convective output (not assumed)

`P = Q_env + Q_vent + Q_bathers`, capped at 12 kW.

1. `Q_env = Σ U·A·(T̄ − 25 °C)` over the walls (18.6 m²), ceiling (5.9), floor (5.9) and glass door (1.33), with T̄ the profile mean over each surface's height.
   1. Walls: U = 1/(R_si + 0.015/0.13 + 0.075/0.037 + R_si) = 0.416 W/m²K.
   2. Ceiling: 0.427 W/m²K.
   3. Floor (150 mm concrete over a 25 °C space): 2.47 W/m²K.
   4. Glass (8 mm): 3.73 W/m²K.
2. `Q_vent = Σ_out ṁ·cp·(T(h_out) − 25)`.
3. `Q_bathers = Σ A_D (h_c + h_r)(T̄_air − T_skin)`, with h_c = 2.38·|ΔT|^0.25 and h_r = 4εσ(A_r/A_D)·T_mean³. The air is averaged over 0.88–1.80 m (upper bather) and 0.45–1.30 m (lower bather).
4. Reference layout: envelope 881 W, ventilation 545 W, bathers 1,111 W, total P = 2.54 kW. That is 21 % of the 12 kW rating.
5. Radiant split:
   1. Closed and wall casings: radiant fraction 0.10 (natural convector).
   2. Open pillar: derived. `Q_rad = ε σ A_ext (T_s⁴ − T_w⁴)`, with the outer stone surface T_s taken as the bed's mean air temperature, A_ext = 0.86 m² and T_w the mean room temperature. This is a fixed point with the bed flow and gives a radiant fraction of 0.24.
6. Convective output Q_c: 1,925 W (open), 2,283 W (closed and wall).

### 2.2 The heater's own through-flow

Draught `g·H·(ρ_a − ρ_m)` (+ jet momentum `ṁU₀/A` for a floor inlet underneath) = losses.

1. ΔT = Q_c/(ρ_a cp V), with T_m = T_a + ΔT/2.
2. Ergun for the stones: `Δp/L = 150 μ(1−ε)² v/(ε³d²) + 1.75 ρ(1−ε) v²/(ε³d)`.
3. Open pillar: 0.28 × 0.28 × 0.70 m bed. Side intake is uniform over 0.06–0.76 m, since in the inertial regime draught and path both scale with the height above entry. The parcel entering lowest sees the viscous term × H/2 and the inertial term × H/3, plus the exit loss.
4. Closed casing: chimney from its foot to 0.67 m, with stone depth L_b = m_s/(A ρ_r (1−ε)) = 0.136 m (Harvia Vega Pro: 50 kg on 0.435 × 0.47 m), plus entry 0.5 and exit 1.0. Wall heater: the same over 0.30–0.68 m.
5. Results: open 10.7 l/s (ΔT ≈ 166 K), closed 14.4 l/s, wall 11.5 l/s.

### 2.3 The plume (MTT top-hat, Boussinesq)

1. Buoyancy flux: `B = g Q_c/(ρ cp T)`.
2. Volume flux: `V(z) = C_v B^{1/3} (z − z_v)^{5/3}`, with `C_v = (6α/5)(9α/10)^{1/3} π^{2/3} = 0.1435` (α = 0.118).
3. Virtual origin from flux matching at the source top: `z_v = z_s − (V_s/(C_v B^{1/3}))^{3/5}`. This gives 0.23–0.38 m.
4. Radius: b = 6α(z − z_v)/5, never less than half the source width.
5. Plume temperature: T_p = T + Q_c/(ρ cp V).
6. Flux at the ceiling: 126 (open), 154 (closed), 145 (wall) l/s. That is 6–7× the ventilation, which justifies one mixed upper zone.
7. Not modelled: the plume's response to the room's stratification (it builds that stratification itself, as a filling box) and the hot outer casing's own boundary layer (≈ 1–2 l/s drawn from a 15 cm layer, estimated, §6).

### 2.4 The inlet as a cold jet

Top-hat integral buoyant jet in the stratified room: `dQ/ds = 2√π α √M`, `dM_z/ds = g′Q/w`, `w = M/Q`, `b = Q/√(πM)`, `g′ = g(T_j − T)/T`. The jet temperature mixes with entrained room air at its height.

1. Entrainment, Priestley–Ball: `α = α_j + (α_p − α_j)·min(1, |Ri|/Ri_p)`, with `Ri = g′b/w²` and `Ri_p = 8α_p/5`. The value α_j = 0.0757 reproduces Ricou–Spalding's Q/Q₀ = 0.32 x/d within 5 %.
2. Initial velocity U₀ = q/(C_d·φ·A), with φ the grille free area. Archimedes number Ar = g′d₀/U₀².
3. The 45° aim is the launch angle.
4. A jet ends when it meets:
   1. the plume column;
   2. the heater body;
   3. the floor, a wall or the ceiling;
   4. or when it slows to the plume-driven circulation speed `V_pH/(W·H)` ≈ 0.03 m/s.
5. Whatever is left goes to its **neutral level** (the height where the room is at the jet's mixed temperature): U if above the floor layer, L if not.
6. **Capture by the plume** (Pratte & Baines): penetration `y = 2.05 r d (s/(r d))^{0.28}`, with `r = w_jet/w_plume` and s the plume's remaining rise. Captured if y ≤ 2b. Otherwise it passes through the plume, entraining 2√π α_j √M × 2b of plume air at T_p, and carries on.
7. **Stone bed hit:** the bed takes `min(Q, V_bed/4 + v_f·A_f)`, the face's share of the bed draw plus what the stagnation pressure ½ρw² forces through 0.28 m of stones (Ergun).
8. **Casing hit:** the circular-segment share of the jet above the casing top enters the plume. The rest spills. On the wall heater the spill runs past the intake at the casing foot, which takes up to its spare capacity.
9. **Floor inlet:** the casing or bed swallows up to its draught-plus-jet flow; the rest spills to the floor. Under the wall heater the vertical cold jet must first rise 0.29 m to the intake.

### 2.5 Floor currents

These are the low inlet (horizontal), a reversed lower grille and the door undercut.

1. Entrainment `dQ/dx = E(Ri)·u·W`, with `E = (0.08 − 0.1 Ri)/(1 + 5 Ri)` for Ri < 0.8 and 0 above (Ellison & Turner as fitted by Turner 1986).
2. `u = max(M/Q, (g′q)^{1/3})`, momentum-driven until the critical gravity-current speed takes over. Then `h = q/u` and `Ri = g′h/u²`.
3. Width grows at 2 × 0.26 per metre while momentum-driven (3D wall jet) and at π per metre (radial) as a gravity current, capped by the room.
4. **Run-up** at the far wall: `½u² = ∫ g (T(z) − T_c)/T(z) dz`, against the room's own stratification.
5. **Direct short circuit:** an outlet on the arrival wall overlapped by the run-up takes its draw from the arriving current first. `D_j = min(X_j, A_j)`, and the current loses the share `s = D_j/A_j × overlap`, together with that share of its entrained layer air.

### 2.6 The floor layer L

1. **Depth h_L** is the larger of:
   1. the currents' run-up: a jet that runs up the far wall and falls back stirs a recirculation cell that deep;
   2. a gravity current's depth `(q²/g′)^{1/3}`;
   3. the depth where `drains(h) = fresh landing on the floor`, with `drains = heater intake below h + Σ φ_j X_j + s·Ent`.
2. **Selective withdrawal** for every point-like sink (grilles, door slots, closed and wall heater intakes): `S_c = 0.69 (Q²/g′)^{1/5}` (Lubin & Springer 1967), with `φ(d) = ½(1 − d/S_c)` for |d| < S_c, d being the sink height above the layer top. The linear ramp between the two exact ends (0 at the critical distance, ½ at the interface) is my interpolation.
3. Open bed intake is proportional to the bed height inside the layer, plus plume entrainment if the layer rises above the stones.
4. **Stability.** Floor heat `Q_floor` comes from the floor surface balance `h_r(T_mrt − T_f) + q_heater→floor = (T_f − 25)/(L/λ + R_si) + 1.52 (T_f − T_L)^{4/3}`.
   1. T_mrt is floor-to-ceiling view-factor weighted (aligned parallel rectangles).
   2. The heater's radiation reaches the floor with a 2D differential view factor ½(1 − z/√(z² + D²)) per face.
   3. Mixed limit: `T_L = T_mix + Q_floor/(ṁ cp)`. The layer **dissolves** into U when T_L ≥ T(h_L).
   4. Reference values: floor surface 53–54 °C, Q_floor 150–190 W, T_L ≈ 45 °C under 50 °C air.
5. **Layer-top exchange**, two-way: `J = E(Ri)·u·A`, with `Ri = g′h_L/u²`, u the floor current speed and the same Ellison–Turner law.

### 2.7 Fraction to the breathing zone

```
π_L = (E_L(1 − δ_P) + R + J) / (E_L + X_L + s·Ent_L + R + J)
F   = [ f_P(1 − δ_P) + f_U + π_L·S_L ] / ṁ_in
```

1. f_P: fresh captured by the plume or heater. f_U: fresh mixing directly into U. S_L: fresh landing in L, net of the direct short circuit. E_L: the heater's draw from L. X_L: outlets drawing from L.
2. R: overflow L → U, only if the drains cannot keep up.
3. δ_P: share of the plume taken by ceiling outlets (drying vent, door top gap) inside the ceiling jet (thickness 0.1 × the source-to-ceiling height) before it turns down to the benches.

### 2.8 CO₂

1. Generation per bather: O₂ = M·A_D/(21(0.23 RQ + 0.77)) mL/s at STP, and CO₂ = RQ × O₂. At 1.2 met, A_D 1.8 m² and RQ 0.83 this is 5.17 mL/s STP, 20.3 L/h at 25 °C, 2.31·10⁻⁴ mol/s.
2. Two zones in mass, ppm × kg:
   - `N_U ċ_U = G_U + (ṁ_pH − P_out)c_P + (R + J)c_L − (E_U + U_out + D + J)c_U`
   - `N_L ċ_L = G_L + (D + J)c_U − (E_L + X_L + R + J)c_L`
   - `c_P = (E_L c_L + E_U c_U)/ṁ_pH`
3. N_U and N_L are the hot-air masses of each zone from the profile, about 10 kg for the whole room. Hot air holds fewer moles, so the time constant is shorter than V/Q.
4. Solved exactly with the 2×2 matrix exponential, c(0) = 0 (outdoor), t = 1,800 s.
5. Both mouths (1.62 and 1.20 m) sit in U unless the layer reaches them. Outdoor CO₂ is 425.6 ppm.

## 3. Constants

| Constant | Value | Source | Conf. |
|---|---|---|---|
| Jet / plume entrainment, top-hat | 0.0757 / 0.118 (Gaussian 0.0535 / 0.0833 × √2) | Fischer, List, Koh, Imberger & Brooks, *Mixing in Inland and Coastal Waters*, Academic Press 1979, ch. 9 | high (value), moderate (applied to a hot, lazy heater plume; Heskestad's fire-plume coefficient 0.071 kg/s·kW⁻¹ᐟ³m⁻⁵ᐟ³, SFPE Handbook 5th ed. ch. 13, implies ~35 % more entrainment) |
| Jet entrainment check | Q/Q₀ = 0.32 x/d | Ricou & Spalding, J. Fluid Mech. 11:21–32, 1961 | high |
| Plume similarity | C_v = (6α/5)(9α/10)^{1/3}π^{2/3}, Ri_p = 8α/5 | Morton, Taylor & Turner, Proc. R. Soc. A 234:1–23, 1956 (derived) | high |
| Variable entrainment | α linear in Ri/Ri_p | Priestley & Ball, Q. J. R. Meteorol. Soc. 81:144–157, 1955 | moderate |
| Jet in crossflow | y/(rd) = 2.05 (s/(rd))^0.28 | Pratte & Baines, J. Hydraul. Div. ASCE 93(HY6):53–64, 1967 | moderate |
| Gravity-current and layer-top entrainment (revision 2) | E = 0.075/(1 + 718 Ri^2.4)^½, continuous | Parker, Garcia, Fukushima & Yu, J. Hydraul. Res. 25:123–147, 1987, as eq. 5 in Alves et al., LNEC 2010; a continuous fit through Ellison & Turner (J. Fluid Mech. 6:423–448, 1959). Replaces Turner 1986's (0.08 − 0.1 Ri)/(1 + 5 Ri), which cuts off at Ri = 0.8 | moderate |
| 3D wall jet lateral spread | dz½/dx ≈ 0.26 | Launder & Rodi, Annu. Rev. Fluid Mech. 15:429–459, 1983 | moderate–low (from memory, not re-verified) |
| Selective withdrawal | S_c = 0.69 (Q²/g′)^{1/5} | Lubin & Springer, J. Fluid Mech. 29:385–390, 1967, as eq. 15 in Hassan, McKeon & James, arXiv:2011.04598 | moderate |
| Ergun | 150, 1.75 | Ergun, Chem. Eng. Prog. 48:89–94, 1952 | high |
| Stone size | Ø 5–10 cm → 0.075 m | Harvia Vega Pro product data (harvia.com); HUUM Hive retail data | moderate |
| Bed voidage | 0.40 | pebble beds ≈ 0.4 (Duffie & Beckman, *Solar Engineering of Thermal Processes*, rock-bed storage; same value as agent A) | moderate |
| Closed-heater stones | 50 kg on 0.435 × 0.47 m | Harvia Vega Pro BC135 product page | moderate |
| Rock density | 3,000 kg/m³ | olivine diabase / peridotite | low–moderate |
| Entry / exit loss | 0.5 / 1.0 | Idelchik; ASHRAE fittings 1-1, 2-1 | high |
| Radiant fraction, casing | 0.10 | "natural convector", IES VE Apache Table 13 (CIBSE Guide A origin, not verified in the Guide itself) | low–moderate |
| Stone / floor emissivity | 0.90 | typical rough rock, tile, concrete | moderate |
| Discharge coefficient | 0.61 | sharp-edged orifice | high |
| Grille free area | 0.5 | agent A's choice; products range 0.30 (mesh, Tecnosystemi) to 0.91 (Swegon GRCb 125) | low |
| Ceiling-jet thickness | 0.1 × source-to-ceiling height | Alpert, SFPE Handbook ch. "Ceiling jet flows" (order of magnitude) | low |
| Walls | 75 mm wool (Harvia: 50–100 mm), λ 0.037; 15 mm pine λ 0.13 | Harvia heater manuals; EN ISO 10456 | moderate |
| Concrete / glass λ | 2.3 / 1.0 W/mK | EN ISO 10456 | high |
| Surface resistances | 0.13 / 0.10 / 0.17 m²K/W | EN ISO 6946 | high |
| Floor construction | 150 mm uninsulated slab over 25 °C | **assumption, not in the brief** | low |
| Upward hot-plate convection | h = 1.52 ΔT^{1/3} | ASHRAE Fundamentals ch. 4, simplified air correlations | moderate |
| View factor, parallel rectangles | formula | Incropera & DeWitt, Table 13.2 | high |
| Bather convection | h_c = 2.38 ΔT^0.25 | ISO 7730:2005 | high |
| Bather radiation | ε 0.95, A_r/A_D 0.70, A_D 1.8 m² | ASHRAE Fundamentals ch. 9 | high |
| Skin temperature | 38.5 °C | Martin 1765 as reported by the Finnish Sauna Society (sauna.fi): 38–39 °C | low–moderate |
| Metabolic rate | 1.2 met, RQ 0.83 | ASHRAE 62.1 App. C (sedentary adult); oxycaloric equivalent ASHRAE Fundamentals ch. 9 | moderate (see §5.4) |
| Outdoor CO₂ | 425.62 ppm | NOAA GML global annual mean 2025, co2_annmean_gl.txt | high |
| Air | ρ = PM/RT, cp 1007, Sutherland μ | Incropera Table A.4; White | high |

## 4. Sanity checks and validation

1. **Inlet above with a fan delivers ≈ 1.** The main inlet's own air reaches the bench in full (1.00) for every heater and every duct. With a sealed door, F = 1.00 and CO₂ = 971 ppm (E's target #11: 950–960, well-mixed). The overall fraction with A's flows is 0.69–0.78, because the door undercut carries 11 of the 21.6 l/s (§5.1).
2. **A low inlet with a fan and a low grille short-circuits.**
   1. F = 0.24 / 0.39 / 0.35 (open / closed / wall); the main inlet alone 0.16 / 0.29 / 0.25.
   2. Sealed door at VTT's 48 kg/h: low/high ratio 0.45 (open), 0.60 (closed), 0.55 (wall), against VTT 1992's 0.25–0.35 (E #7). Matching the high inlet takes 2–2.5× the flow (VTT: 3–4×), so the model short-circuits a little less than VTT measured.
   3. The upper grille removes most of it: low inlet with the upper grille gives 0.71–1.00 of the high inlet's value (E #8: ±30 %, passes).
3. **Reversed flow gives poor delivery: does NOT hold, and I believe the model.** Across the 216 reversed states F = 0.91–1.00 (median 0.95). Reversal sends outdoor air in low (reversed lower grille, door undercut), where the heater lifts it or floor heat dissolves the trickle, while the inlet over the stones exhausts upper-zone air. Reversal costs flow (≈ 6–10 l/s, against 21 with a fan) and comfort (cold inflow at the feet, agent D), not delivery.
4. **More fresh air never raises CO₂ at the mouth.** Tested by scaling every flow ×1.1, ×1.25 and ×1.5 in all 651 states.
   1. Fan states: steady CO₂ never rises (0 of 972). The 30-minute value rises in 6 of 972, by a few ppm.
   2. No-fan states: the 30-minute value rises in 73 of 972 and the steady value in 27 of 972. Two real mechanisms, both regime changes in a sharp-interface model:
      1. More cold air makes the floor layer stable instead of dissolved. The layer then holds pure outdoor air, so the bathers' CO₂ dilutes into ~3 m³ less volume and the 30-minute reading rises while the steady state falls. Example: middle inlet, upper grille, no fan: 1,757 → 1,905 ppm at 30 min, 2,911 → 2,446 steady.
      2. A colder layer pushes the layer-top Richardson number past 0.8, where Ellison–Turner switches mixing off, so the steady state rises. Example: low inlet, lower grille, long duct, 45°: steady 2,642 → 3,481.
      3. Field data (Princevac et al. 2005) say entrainment does not switch off that sharply, so the size of these steps is overstated.
5. **E #9 (Saunologia, 1 bather, 14 m³, 11 l/s, 15 min):** 731 ppm with this generation rate (target 650–760). **E #10** (no ventilation, 27 min): 1,118–1,213 ppm (target 1,000–1,200).
6. **Speed:** median 0.20 ms, worst 0.90 ms per state (mean of 20 warm calls). Deterministic.
7. **Mass:** every node closes; the U-balance check is in the code and never fires on the 651 states.

## 5. Surprises

1. **The door undercut is the reference layout's leak.** In A's network the 10 mm × 0.70 m gap carries 11 of the fan's 21.6 l/s. It enters as a fast floor jet, builds a 40 cm stirred layer, and the lower grille draws 55–70 % of it straight back out. The main inlet over the stones works as the page says (1.00); the room as a whole delivers 0.69–0.78. Two fixes:
   1. Move the grille under the upper bench: fan, inlet above, upper grille gives 0.83 / 1.00 / 1.00, 950–1,055 ppm.
   2. Or seal the undercut: 1.00, 971 ppm.
2. **The fan jet over the stones is not captured by the plume.** At 2–3 m/s through a Ø125 grille its penetration (1.1–1.2 m) is four times the 0.28 m plume, so it punches through, leaves at ~83 °C after mixing with plume air, and ends on the far wall at 1.4–1.5 m. It still delivers fully, by mixing into U, not by being carried up the plume as the drawing shows. A 45° aim meets the plume at 1.18 m and also passes through.
3. **Heater type matters most for low inlets.** The closed casing draws 14 l/s at floor level and drains a cold layer. The wall heater draws at 0.30 m, above a shallow layer. The open pillar draws only 10.7 l/s, spread over 0.06–0.76 m. Example, no fan, low inlet, lower grille, long duct: 0.43 open, 0.61 wall, 0.93 closed.
4. **Without a fan, a duct on the lower grille does not buy breathing-zone air (open pillar):** 3.1 → 4.8 → 3.3 l/s for no duct, short and long. The extra stack flow mostly drains the floor layer. On the upper grille the long duct helps (5.2 → 7.6 l/s, 1,900 → 1,685 ppm). So the old model's complaint is right in direction for the upper grille, and the better advice for a low grille is to move it up, not to duct it.
5. **The steady heat load is small and the bathers are its largest part:** 2.2–2.8 kW of 12 kW, of which 2 bathers absorb ~1.1 kW. The heater runs at about a fifth of its rating; the plume still recirculates 6–7× the ventilation.
6. **Exhaled breath sinks in a sauna.** Breath at 37 °C, saturated, is ≈ 1.11 kg/m³ against ≈ 1.0 kg/m³ for 80 °C air at the head. Not modelled, because the plume's 120–155 l/s recirculation mixes U far faster; it would slightly lower CO₂ at the upper mouth and raise it at the lower one.
7. **The only measured sauna VO₂ I found is three times rest:** Podstawski et al., Biology 11(3):471, 2022, 13.7 mL/kg/min ≈ 3.9 MET at 90 °C over 10 min, by mask. Using it would triple every CO₂ excess. Saunologia's measured 680 ppm matches 20 L/h per person within 3 %, so I kept 1.2 met and treat the Podstawski value as an artefact or upper bound.

### 5.1 The door undercut and its location
The brief gives the gap, not the wall. Lab.js draws the leaks on the exhaust wall, but the benches fill that wall, so I put the door on a side wall, mid-room (x ≈ 0.88 m): its floor jet crosses the room depth and arrives at a wall with no outlet. If the door were on the exhaust wall beside the lower grille, the short circuit would be direct and worse.

### 5.2 Sensitivity: the floor layer (the dominant uncertainty)
`opts.floorEscape = true` lets the floor heat leave as thermals (Churchill–Usagi split of natural and forced convection, Incropera & DeWitt §9.9) instead of warming the layer. It flips several results:

| Layout | fraction, primary | fraction, thermal limit |
|---|---|---|
| 5. fan, inlet above, lower grille | 0.69 | 0.95 |
| 7. fan, low inlet, lower grille | 0.24 | 0.71 |
| 4. no fan, low inlet, lower grille, long duct | 0.43 | 0.98 |

It is in the CSV as `thermalLimit_*`. I made the mixed limit primary because VTT 1992 measured 33–40 °C floor air from 18–20 °C inflow under a fan (E #4): the floor heat warms the layer, and the layer persists. The thermal limit would keep that air near the inflow temperature.

### 5.3 What the layer depth hinges on
For fan jets the layer depth is the Bernoulli run-up at the far wall against the stratification, with no loss coefficient: 44–48 cm at A's flows. At 20 l/s through the inlet alone (sealed door) it reaches 78 cm and the upper grille, which is why the sealed-door upper-grille case shows a short circuit.

### 5.4 Metabolic rate
1.2 met is ASHRAE's sedentary adult. Heat should raise it by the van 't Hoff effect (≈ 10–13 % per °C of core rise) and by cardiac and respiratory work, but I could not verify a sauna-specific value. The cross-check that holds is Saunologia's CO₂ trace.

## 6. Assumptions I am least sure of, and what to check next

1. **The floor layer's heat budget and mixing (mixed limit, run-up cell, Ellison–Turner cut-off).** Floor construction is not in the brief (I assumed 150 mm uninsulated concrete over 25 °C). Whether floor heat warms the layer or escapes as thermals moves the low-inlet results by a factor of 2–3. Next: agent D's profile near the floor, a stated floor build-up, and a check against VTT 1992 Figs. 11–12 (air at 0.05 and 0.55 m).
2. **The door undercut as a floor jet from a side wall, with a 0.5 grille free area.** The undercut carries half the fan's air and its position decides the short circuit. Next: fix the door wall in the drawing; A to confirm the undercut flow; a real grille free area, since jet momentum and run-up scale with it.
3. **Metabolic rate 1.2 met.** Measured sauna VO₂ (Podstawski 2022) says 3×. CO₂ excess scales linearly, while fractions and ranking do not.

Also worth checking: the open pillar's outer-stone temperature (sets its radiant fraction, 0.24) and the hot casings' outside boundary layers (an extra ~1–2 l/s floor drain).

## 7. Interfaces and stand-in

1. **Input.** `breathing` reads A's `openings[]` (role, `mdot`, pass temperature T) and the named fields; it falls back to `q` × density.
   1. Outflows are taken at the room temperature at their height; inflows at their pass temperature, so a warmed inlet-duct inflow is handled.
   2. Optional `profile(h)` (D's) as the third argument or `flows.profile`.
   3. Optional `flows.grilleFreeArea`.
2. **For agent A.** In short-circuit states the lower grille draws cold layer air (≈ 45 °C, not the profile's 46–50 °C at 0.25 m), which weakens a ducted stack. The coupling is small at the stand-in profile; with a colder floor it matters. The layer temperature is in `layer.TL`.
3. **For agent E.** `fractionToBreathingZone` counts door-gap air. `fractionMainInlet` isolates the switchable inlet. `thermalLimit_*` brackets the main uncertainty.
4. **Ambiguities read.**
   1. "Low, beside the heater": the horizontal low jet passes the heater (laterally offset), while the 45° low jet rises into it, as lab.js draws it.
   2. The inlet duct is taken as A's "inside" reading; only its inflow temperature reaches this model.
   3. Angle with the inlet duct is kept physical, while the site forces it straight.
5. **My stand-in airflow** (`standInAirflow`, CSV columns `standIn_*`):
   1. Fixed 20 l/s fan at the grille temperature.
   2. Orifices with C_d 0.61 and free area 0.5, plus door gaps and drying vent, solved for the room pressure by bisection.
   3. Exhaust-duct column at the grille temperature with no cooling; the inlet duct treated as a plain inlet.
   4. It agrees with A's pattern; fractions differ by up to 0.2 in no-fan states near the layer threshold.

Scratch checks (prefix `_C_`): `_C_valid.js` (VTT sealed-door analogue), `_C_mono2.js` (monotonicity), `_C_final.js` (tables), `_C_extra.js` (reversed flow, drying vent, angles), `_C_perf.js` (timing).

## 8. Revision 2 (integration with A, D and E)

1. **Entrainment law.** The hard Ellison–Turner cut-off (E = 0 at Ri ≥ 0.8) is replaced by the continuous Parker et al. (1987) fit, E = 0.075/(1 + 718 Ri^2.4)^½. It is used for the floor currents and for the layer-top exchange.
2. **Steady state.** `CONST.sessionS = Infinity` returns the exact steady state −A⁻¹g. The transient now uses the eigenvalue form e^{λt}, so long times no longer overflow (`sessionS = 86400` used to give NaN).
3. **Fraction clamp.** `fractionToBreathingZone` and `fractionMainInlet` are clamped to [0, 1], fixing round-off of 1.0000000000000002.
4. **Identity.** At steady state, CO₂ at the mouth = 425.6 + G/(ρ_out·qFreshAtBreathingZone) exactly (checked to 1e-12 in all 651 states). Breathing-zone fresh air therefore orders CO₂ strictly.
5. **E's H16 through X_evaluate.js:**

   | Door gap | v1 | v2, 30 min | v2, steady state |
   |---|---|---|---|
   | 10 mm | 292 failing | 265 | 0 |
   | 2 mm | — | 153 | 0 |

6. **What the 30-minute failures are.** Every one is a state with a stable floor layer: that layer holds outdoor air and takes volume out of the zone the CO₂ mixes into, so the reading rises faster while its steady state is lower.
7. **Within a family.** Scaling every flow (×1.1, ×1.25, ×1.5) still lowers breathing-zone air in 74 of 1,953 cases at 2 mm and 21 at 10 mm, mostly middle or low inlets with a lower grille. The mechanism is the cold pool strengthening: more cold inflow makes the floor layer colder and more stable, so less of it mixes upward or dissolves, and more drains out of the low outlets. The remaining sharpness comes from the layer's dissolve/stable switch.
8. **Eight layouts at steady state, 2 mm door gap** (integrated model: A's airflow iterated with D's profile; open heater, angle straight, drying vent shut):

| # | Layout | outdoor in l/s | fraction | CO₂ steady |
|---|---|---|---|---|
| 1 | no fan, low inlet, lower grille | 2.5 | 1.00 | 4,937 |
| 2 | no fan, low inlet, upper grille | 4.6 | 1.00 | 2,852 |
| 3 | no fan, low inlet, lower grille, short duct | 5.6 | 0.87 | 2,722 |
| 4 | no fan, low inlet, lower grille, long duct | 7.2 | 0.72 | 2,591 |
| 5 | fan, inlet above, lower grille | 17.4 | 1.00 | 1,072 |
| 6 | fan, inlet above, lower grille, long duct | 18.5 | 1.00 | 1,035 |
| 7 | fan, low inlet, lower grille | 19.2 | 0.45 | 1,726 |
| 8 | no ventilation | 1.3 | 1.00 | 9,344 |

With the 2 mm gap the undercut stops short-circuiting the reference layout (fraction 1.00 against 0.70 at 10 mm). The CSV is regenerated with this law at A's default 10 mm gap and the 30-minute reading.
