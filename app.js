/* Saunas 101 · the ventilation lab: states, model, drawing, switches, tabs, units. */
/* ---------- the model behind the score and the CO₂ ----------
   head: fresh air reaching the breathing zone, changes per hour (12 m³, 2 bathers need 6)
   feet: 1 warm · 0.5 cold at the heater or the floor · 0.25 a cold layer · 0.1 a draught */
const MODEL = {
  'on|above|riser':    {head:6,   feet:1},
  'on|above|straight': {head:6,   feet:1},
  'off|above|riser':   {head:2.5, feet:1},
  'off|below|riser':   {head:1.5, feet:0.5},
  'off|below|straight':{head:0.9, feet:0.5},
  'on|below|riser':    {head:1.8, feet:0.25},
  'on|below|straight': {head:1.8, feet:0.25},
  'off|above|straight':{head:0.5, feet:0.1},
  'on|middle|riser':   {head:2.4, feet:0.4},
  'on|middle|straight':{head:2.4, feet:0.4},
  'off|middle|riser':  {head:2.0, feet:0.6},
  'off|middle|straight':{head:0.4, feet:0.15},
  'on|bottom|riser':   {head:5.0, feet:0.9},
  'on|bottom|straight':{head:5.0, feet:0.9},
  'off|bottom|riser':  {head:3.2, feet:0.9},
  'off|bottom|straight':{head:1.2, feet:0.9},
  'in0|on|riser':      {head:0.5, feet:0.5},
  'in0|on|straight':   {head:0.5, feet:0.5},
  'in0|off|riser':     {head:0.3, feet:0.6},
  'in0|off|straight':  {head:0.15, feet:0.6},
  'out0|above':        {head:0.3, feet:0.3},
  'out0|middle':       {head:0.6, feet:0.6},
  'out0|below':        {head:0.7, feet:0.5},
  'out0|bottom':       {head:0.9, feet:0.9},
  'none':              {head:0.2, feet:1}
};
const NEED = 6;                      // 6 changes of 12 m³ = 20 l/s, what 2 bathers need for 1,000 ppm
const GEN2 = 3333;                   // ppm per hour added by 2 seated bathers in 12 m³ (0.04 m³/h of CO₂)
const TILT = {
  'on|above|riser':    {f:1,    note:'The jet now aims at the ceiling. At the fan\'s 2.5 m/s it gets there, spreads under it and comes down over the top bench, where the fan collects it as before: the exchange where you breathe does not change. What changes is the sensor. The jet is now pointed at the place where the thermostat lives; keep the sensor 1 m from the louver, or aim the louver into the plume instead.'},
  'on|above|straight': {f:1,    note:'The jet now aims at the ceiling. At the fan\'s 2.5 m/s it gets there, spreads under it and comes down over the top bench, where the fan collects it as before: the exchange where you breathe does not change. What changes is the sensor. The jet is now pointed at the place where the thermostat lives; keep the sensor 1 m from the louver, or aim the louver into the plume instead.'},
  'on|below|riser':    {f:1,    note:'Tilted up, the floor inlet throws its air at the side of the heater. At the fan\'s speed the stream still falls within 50 cm and the fan drags it along the floor to the grille; the short circuit stays. The heater catches a little more of it, not enough to change the number.'},
  'on|below|straight': {f:1,    note:'Tilted up, the floor inlet throws its air at the side of the heater. At the fan\'s speed the stream still falls within 50 cm and the fan drags it along the floor to the grille; the short circuit stays. The heater catches a little more of it, not enough to change the number.'},
  'off|above|riser':   {f:1.07, note:'Buoyancy only counts the heights where the holes meet the outside air. Tilting the hole up puts its outside mouth 14 cm lower, so the chimney from inlet to duct outlet is 14 cm taller: about 7 % more flow. Inside, the air moves at about 1 m/s, climbs some 30 cm off the tilt and falls into the plume as before.'},
  'off|above|straight':{f:0.9, note:'Warm air does go up, and it still comes out of this hole, because it is pushed: at 1 m the room sits about 0.7 Pa above the outside, and that pressure drives air down a short slope without noticing it. What the tilt does is lower the outside mouth by 14 cm, which takes 14 cm off the 74 cm that drive the reversal: about 10 % slower, still backwards. To stop it you would have to bring the inlet\'s outside mouth down to the exhaust\'s height, and then nothing moves at all. Gravity needs the outlet above the inlet; no angle on the inlet changes that.'},
  'off|below|riser':   {f:1.04, note:'The outside mouth drops 14 cm, which adds 14 cm to an already tall chimney: about 4 % more flow. The cold air still arrives at the floor by the heater.'},
  'off|below|straight':{f:1.35, note:'Here the tilt matters: the 2 openings were 16 cm apart in height and the tilt makes it 30 cm, about 35 % more flow from the same weak loop. The catch is that a hole at 10 cm tilted up through the wall meets the outside at ground level; it only works where the sauna floor stands above the ground outside.'},
  'on|middle|riser':   {f:1.3,  note:'Aimed 45° up from 45 cm, the jet lands on the upper part of the heater, near the stones, instead of its middle: a casing catches more of it in the plume, a pillar takes it in higher up. Some 30 % more fresh air where you breathe.'},
  'on|middle|straight':{f:1.3,  note:'Aimed 45° up from 45 cm, the jet lands on the upper part of the heater, near the stones, instead of its middle: a casing catches more of it in the plume, a pillar takes it in higher up. Some 30 % more fresh air where you breathe.'},
  'off|middle|riser':  {f:1.04, note:'The outside mouth drops 14 cm, which adds 14 cm to a 1.65 m chimney: about 4 % more flow.'},
  'off|middle|straight':{f:0.5, note:'The outside mouth drops 14 cm, which takes 14 cm off the 19 cm that drive this reversal. It runs backwards at half the speed, which is to say it barely runs at all. Tilt it a little more and nothing moves in either direction.'},
  'on|bottom|riser':   {f:1,    note:'A hole in the floor has no up to tilt towards; the angle switch does nothing here.'},
  'on|bottom|straight':{f:1,    note:'A hole in the floor has no up to tilt towards; the angle switch does nothing here.'},
  'off|bottom|riser':  {f:1,    note:'A hole in the floor has no up to tilt towards; the angle switch does nothing here.'},
  'off|bottom|straight':{f:1,   note:'A hole in the floor has no up to tilt towards; the angle switch does nothing here.'},
  'none':              {f:1,    note:''}
};
const HEATER = {
  'on|above|riser':    {f:1,   note:'A pillar has no chimney inside it: the air it heats seeps in through the stones on every side and leaves slower over a wider top. The fresh air dropping out of the inlet is still caught and lifted, over a wider area, and the fan does the rest. Same number.'},
  'on|above|straight': {f:1,   note:'A pillar has no chimney inside it: the air it heats seeps in through the stones on every side and leaves slower over a wider top. The fresh air dropping out of the inlet is still caught and lifted, over a wider area, and the fan does the rest. Same number.'},
  'on|below|riser':    {f:0.8, note:'The closed casing worked as a chimney and lifted a share of the floor air past its elements. The pillar has no casing, so it lifts less and the fan drags more of the fresh air straight across the floor: about a fifth less fresh air where you breathe.'},
  'on|below|straight': {f:0.8, note:'The closed casing worked as a chimney and lifted a share of the floor air past its elements. The pillar has no casing, so it lifts less and the fan drags more of the fresh air straight across the floor: about a fifth less fresh air where you breathe.'},
  'off|above|riser':   {f:1,   note:'No change: the chimney that drives this loop is in the duct, not in the heater.'},
  'off|above|straight':{f:1,   note:'No change: the reversal is set by the 2 holes. The heater only heats.'},
  'off|below|riser':   {f:0.9, note:'The casing heater pulls floor air into its base and that pull is part of what makes the low inlet work. The pillar pulls less, so the loop runs about 10 % slower and more of the cold air stays on the floor.'},
  'off|below|straight':{f:0.9, note:'The casing heater pulls floor air into its base and that pull is part of what makes the low inlet work. The pillar pulls less, so the loop runs about 10 % slower and more of the cold air stays on the floor.'},
  'on|middle|riser':   {f:1.875, feet:0.75, note:'This is the layout the pillar was made for. The jet goes in between the stones, is heated on the spot and rises through the pillar into the plume; the fan then brings it down past the benches. Nearly twice the fresh air where you breathe compared with a casing, and warm feet, because little of it ever reaches the floor. The stones on the inlet side run cooler.'},
  'on|middle|straight':{f:1.875, feet:0.75, note:'This is the layout the pillar was made for. The jet goes in between the stones, is heated on the spot and rises through the pillar into the plume; the fan then brings it down past the benches. Nearly twice the fresh air where you breathe compared with a casing, and warm feet, because little of it ever reaches the floor. The stones on the inlet side run cooler.'},
  'off|middle|riser':  {f:1.3,  feet:0.8,  note:'The jet enters the stones directly instead of falling to the floor and waiting for the casing to draw it in: about 30 % more of the fresh air is heated before it spreads, and the floor stays warmer.'},
  'off|middle|straight':{f:1,   note:'No change: the reversal is set by the 2 holes. The heater only heats.'},
  'on|bottom|riser':   {f:0.85, feet:0.85, note:'The pillar stands on short legs over the hole, so the fresh air goes straight into its stone bed, and the hot stones with the air tunnel pull it up as a casing would, through a leakier chimney: about 15 % of the air spills out at the base and the fan drags that part to the grille along the floor.'},
  'on|bottom|straight':{f:0.85, feet:0.85, note:'The pillar stands on short legs over the hole, so the fresh air goes straight into its stone bed, and the hot stones with the air tunnel pull it up as a casing would, through a leakier chimney: about 15 % of the air spills out at the base and the fan drags that part to the grille along the floor.'},
  'off|bottom|riser':  {f:0.85, feet:0.85, note:'The pillar is a leakier chimney than a casing: about 15 % of the air that comes up under it spills out at the base instead of rising through the stones.'},
  'off|bottom|straight':{f:0.85, feet:0.85, note:'The pillar is a leakier chimney than a casing: about 15 % of the air that comes up under it spills out at the base instead of rising through the stones.'},
  'none':              {f:1,   note:''}
};
/* the exhaust under the upper bench, 75 cm up instead of 26: the fan or the stack draws from higher, the floor zone drops out */
const EXH = {
  'on|above|riser':    {f:1,   feet:0.75, note:'The fan now draws from 75 cm up, under the upper bench. The fresh air still comes down past the bather, but the lowest 75 cm, the lower bench and the floor, drop out of the loop and go cool and stale. VTT 1992: the exhaust near the floor gave the most even temperature from floor to ceiling.'},
  'on|above|straight': {f:1,   feet:0.75, note:'The fan now draws from 75 cm up, under the upper bench. The fresh air still comes down past the bather, but the lowest 75 cm, the lower bench and the floor, drop out of the loop and go cool and stale. VTT 1992: the exhaust near the floor gave the most even temperature from floor to ceiling.'},
  'on|below|riser':    {f:1.6, feet:0.5,  note:'With the grille at 75 cm the fan can no longer drag the cold floor air straight out: it has to be heated enough to rise 65 cm first. The short circuit is half broken and more of the fresh air reaches the benches. The floor stays cold.'},
  'on|below|straight': {f:1.6, feet:0.5,  note:'With the grille at 75 cm the fan can no longer drag the cold floor air straight out: it has to be heated enough to rise 65 cm first. The short circuit is half broken and more of the fresh air reaches the benches. The floor stays cold.'},
  'off|above|riser':   {f:1,   feet:0.75, note:'The chimney is the same, inlet to duct outlet; the duct just draws from higher up. The floor zone drops out of the loop.'},
  'off|above|straight':{f:0.6, feet:0.3,  note:'The exhaust at 75 cm is only 25 cm under the inlet, so the reversal has a third of the drive: about 0.3 changes an hour, still backwards, with the cold air now arriving at seat height instead of the ankles.'},
  'off|below|riser':   {f:1,   feet:0.6,  note:'Same chimney, drawn from higher up. The floor below the grille stays colder.'},
  'off|below|straight':{f:2,   feet:0.55, note:'A chimney of 65 cm instead of 16: about twice the flow of Harvia\'s low-low drawing. This is HUUM\'s rule, exhaust up to 60 cm off the floor, taken to its limit.'},
  'on|middle|riser':   {f:1,   feet:0.5},
  'on|middle|straight':{f:1,   feet:0.5},
  'off|middle|riser':  {f:1,   feet:0.65},
  'off|middle|straight':{f:2.5, feet:0.55, note:'The exhaust at 75 cm is now above the 45 cm inlet: the loop turns the right way round on a 30 cm chimney. Weak, about one change an hour, but no longer backwards.'},
  'on|bottom|riser':   {f:1,   feet:0.8},
  'on|bottom|straight':{f:1,   feet:0.8},
  'off|bottom|riser':  {f:1,   feet:0.8},
  'off|bottom|straight':{f:1.6, feet:0.85, note:'A chimney of 75 cm instead of 26, through the heater: about 1.6 times the flow.'},
  'in0|on|riser':      {f:2.5, feet:0.5,  note:'The grille is now 65 cm above the door gap, so the leaking air has to rise before the fan can take it: a little of it reaches the benches on the way.'},
  'in0|on|straight':   {f:2.5, feet:0.5,  note:'The grille is now 65 cm above the door gap, so the leaking air has to rise before the fan can take it: a little of it reaches the benches on the way.'},
  'in0|off|riser':     {f:1.2, feet:0.6},
  'in0|off|straight':  {f:2,   feet:0.6}
};
const WALL = {
  'on|below|riser':    {f:0.75, feet:0.25, note:'A wall heater\'s intake is its underside, 30 cm up. The cold air arriving at 10 cm pools below that and does not climb on its own, so the casing lifts less of it than a floor-standing one and the fan drags more of it across the floor: about a quarter less fresh air where you breathe.'},
  'on|below|straight': {f:0.75, feet:0.25, note:'A wall heater\'s intake is its underside, 30 cm up. The cold air arriving at 10 cm pools below that and does not climb on its own, so the casing lifts less of it than a floor-standing one and the fan drags more of it across the floor: about a quarter less fresh air where you breathe.'},
  'off|below|riser':   {f:0.85, note:'The heater pulls from 30 cm up, above the cold pool the inlet makes at the floor: the loop runs about 15 % slower.'},
  'off|below|straight':{f:0.85, note:'The heater pulls from 30 cm up, above the cold pool the inlet makes at the floor: the loop runs about 15 % slower.'},
  'on|bottom|riser':   {f:0.75, feet:0.8,  note:'Tylö draws its under-the-heater inlet for wall heaters, but as a hole in the wall right under the casing, where the heater\'s draught takes the air at once. A hole in the floor 30 cm below is a different thing: fresh air at 30 °C is heavy and does not climb to the intake by itself. It spreads across the floor, the casing catches the share its own draught pulls up, and the fan drags the rest to the grille: about a quarter less than a floor-standing casing, which sits over the hole and leaves the air nowhere else to go.'},
  'on|bottom|straight':{f:0.75, feet:0.8,  note:'Tylö draws its under-the-heater inlet for wall heaters, but as a hole in the wall right under the casing, where the heater\'s draught takes the air at once. A hole in the floor 30 cm below is a different thing: fresh air at 30 °C is heavy and does not climb to the intake by itself. It spreads across the floor, the casing catches the share its own draught pulls up, and the fan drags the rest to the grille: about a quarter less than a floor-standing casing, which sits over the hole and leaves the air nowhere else to go.'},
  'off|bottom|riser':  {f:0.75, feet:0.8,  note:'The chimney through the heater starts 30 cm up, and the fresh air below it is heavy: only what the casing\'s draught pulls up gets heated, the rest spreads on the floor. Tylö avoids this by putting the inlet in the wall right under the casing.'},
  'off|bottom|straight':{f:0.75, feet:0.8,  note:'The chimney through the heater starts 30 cm up, and the fresh air below it is heavy: only what the casing\'s draught pulls up gets heated, the rest spreads on the floor.'},
};
const HTABLE = {open:HEATER, wall:WALL};
function hmod(k, heater){ const t=HTABLE[heater]; return (t && t[k]) ? t[k] : null; }
/* the inlet duct: a chimney is a column of warm air, and an inlet duct carries cold air. Run inside the room its air warms about halfway,
   worth half the duct's height; its mouth cannot go below the floor. Keyed on the no-exhaust-duct states. */
const IDUCT = {
  'on|above|straight':  {f:1, note:'While the fan runs any pipe is only a longer way in. Switch the fan off to see what it does without one: nothing.'},
  'on|middle|straight': {f:1, note:'While the fan runs any pipe is only a longer way in. Switch the fan off to see what it does without one: nothing.'},
  'on|below|straight':  {f:1, note:'While the fan runs any pipe is only a longer way in. Switch the fan off to see what it does without one: nothing.'},
  'off|above|straight': {f:0.4, feet:0.8, stall:true, note:'The air stalls. With the pipe cold the push runs backwards, as without a pipe: hot air leaves through the hole and goes down the pipe. But that fills the pipe with warm air, and a warm pipe is a piece of the room: now the warm column runs from the mouth at the floor up to the grille at 26 cm and pushes the other way, in at the mouth, out at the grille. The moment it does, cold air climbs the pipe, the pipe cools, and the push flips back. The 2 cancel where a warm plug sits in the top of the pipe and nothing moves: a trickle of warm air creeps down to replace what the pipe wall loses, and that is all. The reversal is gone, and so is everything else: the room is as good as sealed, with no draught at the ankles. The exhaust pipe has no such cancellation, because the air it carries is pushed up and out, and flowing keeps it warm. The old rule, "outlet above inlet", counts the openings where the air changes temperature, not the pipe mouths. Gravity ventilation is the weight difference between the warm column inside and the cold column outside, over the height where the inside is warm. An inlet pipe is full of outside air at outside temperature: it is a piece of the outside that reaches to the wall, so the inlet still counts at the hole, 1 m up. Drop its mouth 10 m down a shaft and nothing changes either. The exhaust pipe is the opposite, a piece of the room full of warm air that reaches above the roof, so the outlet counts at its top. Here the hole at 1 m is still above the grille at 26 cm, the warm column between them still pushes out through its upper opening, and that opening is the inlet. What an inlet pipe is for is practical: a mouth sheltered from wind and rain, away from the exhaust\'s mouth, or a route to a wall you can open.'},
  'off|middle|straight':{f:0.5, feet:0.8, stall:true, note:'The air stalls. Cold, the pipe lets the weak reversal run; the hot air that leaves fills it, and a warm pipe reaches from the floor up to the grille and pushes the other way; cold air climbs, cools it, and the push flips back. A warm plug settles in the top of the pipe and nothing moves beyond a trickle. The room is as good as sealed, without the draught.'},
  'off|below|straight': {f:1, note:'Nothing changes: the loop runs the right way, so the pipe carries outside air at outside temperature the whole time, and a cold pipe is a piece of the outside. The inlet still counts at the hole, 10 cm up. Only a pipe full of warm air moves an opening, and this one never warms.'}
};
const COMBO = {};
function comboOf(k, exhaust, induct){ return (induct && exhaust==='upper' && COMBO[k]) ? COMBO[k] : null; }
const BARE = 0.93;   // a bare exhaust pipe outdoors: its air cools a few degrees on the way up, about 7 % less flow than an insulated one
/* the half pipe: outlet at 1.2 m instead of 2 m. Chimney = pipe top − inlet height; flow ∝ √height */
const HALF = {
  'off|above|riser':  {f:0.45, note:'The pipe top at 1.2 m is only 20 cm above the inlet at 1 m: a 20 cm chimney instead of 1 m. Flow goes with the square root of the height, so under half the flow, about one change an hour. Still the right way round, and it still needs priming.'},
  'off|middle|riser': {f:0.70, note:'Chimney from the 45 cm inlet to the 1.2 m outlet: 75 cm instead of 1.55 m. About 70 % of the flow.'},
  'off|below|riser':  {f:0.76, note:'Chimney from the 10 cm inlet to the 1.2 m outlet: 1.1 m instead of 1.9 m. About 3/4 of the flow.'},
  'off|bottom|riser': {f:0.77, note:'Chimney from the floor to 1.2 m instead of 2 m. About 3/4 of the flow.'},
  'on|above|riser':   {f:1, note:'While the fan runs the pipe\'s height is irrelevant. It matters the day the fan stops: switch it off.'},
  'on|middle|riser':  {f:1, note:'While the fan runs the pipe\'s height is irrelevant. It matters the day the fan stops: switch it off.'},
  'on|below|riser':   {f:1, note:'While the fan runs the pipe\'s height is irrelevant. It matters the day the fan stops: switch it off.'},
  'on|bottom|riser':  {f:1, note:'While the fan runs the pipe\'s height is irrelevant. It matters the day the fan stops: switch it off.'}
};
function headOf(k, angle, heater, exhaust, induct, half){ const c=comboOf(k,exhaust,induct); if(c) return c.head; const m=hmod(k,heater); const bare = (k.startsWith('off|') && k.endsWith('|riser')) ? BARE : 1; return bare * MODEL[k].head * ((angle==='up45' && TILT[k]) ? TILT[k].f : 1) * (m ? m.f : 1) * ((exhaust==='upper' && EXH[k]) ? EXH[k].f : 1) * ((induct && IDUCT[k]) ? IDUCT[k].f : 1) * ((half && HALF[k]) ? HALF[k].f : 1); }
function feetOf(k, heater, exhaust, induct){
  const c=comboOf(k,exhaust,induct); if(c) return c.feet;
  const m=hmod(k,heater); let f = (m && m.feet!=null) ? m.feet : MODEL[k].feet;
  if(exhaust==='upper' && EXH[k] && EXH[k].feet!=null) f = Math.min(f, EXH[k].feet);
  if(induct && IDUCT[k] && IDUCT[k].feet!=null) f = Math.max(f, IDUCT[k].feet);
  return f;
}
function runScore(k, angle, heater, exhaust, induct, half){ return Math.min(headOf(k,angle,heater,exhaust,induct,half)/NEED,1)*(0.5+0.5*feetOf(k,heater,exhaust,induct)); }
function score(k, angle, heater, exhaust, induct, half){ return Math.round(100*runScore(k, angle, heater, exhaust, induct, half)); }
const ROCK_FILLS=['#6a6a6a','#595959','#4e4e4e','#444444','#5f5f5f','#3c3c3c'];
function rock(cx,cy,R,rnd){
  const k=5+Math.floor(rnd()*3), sx=1+rnd()*0.35, rot=rnd()*Math.PI, pts=[];
  for(let i=0;i<k;i++){ const a=rot+i*2*Math.PI/k+(rnd()-0.5)*0.5, r=R*(0.72+rnd()*0.5); pts.push((cx+Math.cos(a)*r*sx).toFixed(1)+','+(cy+Math.sin(a)*r).toFixed(1)); }
  const p=el('polygon',{points:pts.join(' '),class:'rock'}); p.setAttribute('fill',ROCK_FILLS[Math.floor(rnd()*ROCK_FILLS.length)]); return p;
}
function drawHeater(){
  const g=document.getElementById('heaterg'); g.innerHTML='';
  if(state.heater==='open'){
    // a pillar of stones with the horizontal wires of its cage over them, on a short steel base
    g.appendChild(el('rect',{x:55,y:290,width:36,height:8,rx:1,class:'stoveBody'}));
    const st=el('g');
    let seed=7; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    for(let row=0; row<11; row++){ const y=195+row*9.2, off=(row%2)?5.5:0; for(let i=0;i<4;i++){ const x=60+off+i*11+(rnd()-0.5)*2; if(x<58||x>88) continue; st.appendChild(rock(x, y+(rnd()-0.5)*2, 5.6+rnd()*1.4, rnd)); } }
    g.appendChild(st);
    for(let y=197; y<290; y+=12){ const w=el('line',{x1:53,y1:y,x2:93,y2:y}); w.setAttribute('stroke','var(--stone)'); w.setAttribute('stroke-width','1.2'); g.appendChild(w); }
    [53,93].forEach(x=>{ const v=el('line',{x1:x,y1:191,x2:x,y2:290}); v.setAttribute('stroke','var(--stone)'); v.setAttribute('stroke-width','1.2'); g.appendChild(v); });
  } else if(state.heater==='wall'){
    [214,246].forEach(y=>{ const b=el('line',{x1:22,y1:y,x2:54,y2:y}); b.setAttribute('stroke','var(--stone)'); b.setAttribute('stroke-width','2.5'); g.appendChild(b); });
    g.appendChild(el('rect',{x:52,y:201.6,width:42,height:55.4,rx:2,class:'stoveBody'}));
    const st=el('g');
    let seed=11; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    [[59,202,4.8],[68,200,5.2],[78,201,5],[87,202.5,4.4],[63,194,4.4],[73,192.5,4.8],[83,194.5,4.2]].forEach(([cx,cy,r])=>st.appendChild(rock(cx,cy,r,rnd)));
    g.appendChild(st);
  } else {
    g.appendChild(el('rect',{x:52,y:201.6,width:42,height:96.4,rx:2,class:'stoveBody'}));
    const st=el('g');
    let seed=11; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    [[59,202,4.8],[68,200,5.2],[78,201,5],[87,202.5,4.4],[63,194,4.4],[73,192.5,4.8],[83,194.5,4.2]].forEach(([cx,cy,r])=>st.appendChild(rock(cx,cy,r,rnd)));
    g.appendChild(st);
  }
}   // fans taken as always running: a power cut stops the heater too
function co2After(aHead, hours, people){ const a=Math.max(aHead,1e-6); return Math.round((420 + (GEN2*people/2)/a*(1-Math.exp(-a*hours)))/10)*10; }
const scoreGrade = s => s>=70?'good':s>=35?'warn':'bad';

/* ---------- the layouts, ranked ---------- */
const RANK = [
  ['G','on', 'above','riser',   'Inlet above the heater, fan running, with exhaust duct','Best'],
  ['C','on', 'above','straight','Inlet above the heater, fan running, no exhaust duct',  'Best; the duct adds nothing while the fan runs'],
  ['H','off','above','riser',   'Inlet above the heater, no fan, with exhaust duct',     'Slow, the right way round'],
  ['F','off','below','riser',   'Inlet at the bottom, by the heater, no fan, with exhaust duct',     'Slow, cold at the feet'],
  ['E','on', 'below','riser',   'Inlet at the bottom, by the heater, fan running, with exhaust duct','Floor short circuit'],
  ['A','on', 'below','straight','Inlet at the bottom, by the heater, fan running, no exhaust duct',  'Floor short circuit'],
  ['B','off','below','straight','Inlet at the bottom, by the heater, no fan, no exhaust duct',       'Weak, about one change an hour'],
  ['D','off','above','straight','Inlet above the heater, no fan, no exhaust duct',       'Runs backwards'],
  ['I','on', 'bottom','riser',   'Inlet under the heater, fan running, with exhaust duct', 'Tylö\'s inlet with a fan; needs a floor to the outside'],
  ['J','on', 'bottom','straight','Inlet under the heater, fan running, no exhaust duct',   'Tylö\'s inlet with a fan; cannot reverse'],
  ['K','off','bottom','riser',   'Inlet under the heater, no fan, with exhaust duct',      'The heater as the chimney'],
  ['L','on', 'middle','riser',   'Inlet at the heater\'s middle, fan running, with exhaust duct', 'Depends on the heater: a pillar admits, a casing deflects'],
  ['M','on', 'middle','straight','Inlet at the heater\'s middle, fan running, no exhaust duct',   'Depends on the heater: a pillar admits, a casing deflects'],
  ['N','off','middle','riser',   'Inlet at the heater\'s middle, no fan, with exhaust duct',      'Half-height gravity'],
  ['O','off','bottom','straight','Inlet under the heater, no fan, no exhaust duct',        'Weak, cannot reverse'],
  ['P','off','middle','straight','Inlet at the heater\'s middle, no fan, no exhaust duct',        'A weak reversal'],
  ['0','none',null,null,'No ventilation: no inlet, no exhaust','Most saunas in Brazil']
];

/* ---------- state ---------- */
const state = { vent:'yes', fan:'on', inlet:'above', angle:'straight', heater:'closed', exhaust:'lower', duct:'riser', dry:'closed', none:false };
let paused=false;
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const darkUI = document.documentElement.dataset.theme==='dark' || (document.documentElement.dataset.theme!=='light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
const FRESH_HEX = darkUI ? '#63B3D6' : '#378DE2', HOT_HEX = darkUI ? '#F09A52' : '#E8603A';

/* ---------- geometry ---------- */
const IN_ABOVE={x:22,y:160}, IN_MIDDLE={x:22,y:236}, IN_BELOW={x:22,y:283}, IN_BOTTOM={x:73,y:298}, OUT={x:398,y:262}, SENSOR={x:73,y:36};
const DUCT_UP=' C 404 260, 408 200, 408 150 C 408 100, 408 60, 408 8';
const DUCT_UP_HI=' C 404 194, 408 150, 408 110 C 408 70, 408 40, 408 8';
const DUCT_UP_HALF=' C 404 260, 408 230, 408 200 C 408 170, 408 150, 408 128';
const DUCT_UP_HI_HALF=' C 404 194, 408 180, 408 165 C 408 150, 408 140, 408 128';
const HALF_TOP = 132;   // 1.2 m
const OUT_HI={x:398,y:196}, LEAK_IN={x:398,y:290}, LEAK_OUT={x:398,y:60};
function outPos(){ return state.exhaust==='upper' ? OUT_HI : OUT; }
/* with the exhaust under the upper bench every path that met the grille at 262 meets it at 196 */
function toUpper(d){
  if(state.exhaust!=='upper') return d;
  return d.replace(/, (\d+) (\d+), 398 26[02]/g, (m,x,y)=>', '+x+' '+Math.min(+y,212)+', 398 196')
          .replace(/^M398 26\d C (\d+) (\d+),/, 'M398 196 C $1 215,');
}

/* ---------- air states: fan × inlet × duct ---------- */
const AIR = {
  'in0|on|riser': {
    grade:'bad', badge:'Exhaust only',
    title:'Fan on, no inlet, exhaust ducted up',
    summary:'No inlet, so the fan takes its air from wherever the room leaks, and the easiest leak is the gap under the door, 30 cm from the grille. The air crosses that strip of floor and is gone. The room sits under suction, the heater\'s plume goes round and round above, and almost nothing it breathes is replaced. VTT 2002 found exactly this in Helsinki flats: with an exhaust-only fan the door gap took over as the inlet and the designed one stopped working.',
    good:['The fan still removes some moisture','Nothing can reverse: the room is under suction everywhere'],
    bad:['Almost no fresh air where you breathe: the leak and the grille are 30 cm apart','A cold stream along the floor from the door','Where the air actually comes in depends on the building, not on you'],
    says:'<b>VTT 2002</b>: in exhaust-only saunas the door gap was the easier way in and the high inlet ran backwards. <b>Harvia</b> and <b>Helo</b> both require a supply opening.',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:4, n:8}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'in0|on|straight': {
    grade:'bad', badge:'Exhaust only',
    title:'Fan on, no inlet, exhaust straight through the wall',
    summary:'No inlet, so the fan takes its air from wherever the room leaks, and the easiest leak is the gap under the door, 30 cm from the grille. The air crosses that strip of floor and is gone. The room sits under suction, the heater\'s plume goes round and round above, and almost nothing it breathes is replaced. VTT 2002 found exactly this in Helsinki flats: with an exhaust-only fan the door gap took over as the inlet and the designed one stopped working.',
    good:['The fan still removes some moisture','Nothing can reverse: the room is under suction everywhere'],
    bad:['Almost no fresh air where you breathe: the leak and the grille are 30 cm apart','A cold stream along the floor from the door','Where the air actually comes in depends on the building, not on you'],
    says:'<b>VTT 2002</b>: in exhaust-only saunas the door gap was the easier way in and the high inlet ran backwards. <b>Harvia</b> and <b>Helo</b> both require a supply opening.',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:4, n:8}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'in0|off|riser': {
    grade:'bad', badge:'A chimney with nothing to feed it',
    title:'Fan stopped, no inlet, exhaust ducted up',
    summary:'The duct still draws, but the only air it can draw arrives through the gap under the door, right beside the grille. A tiny loop runs along 30 cm of floor and the rest of the room stays as it is.',
    good:['Nothing reverses'],
    bad:['A fraction of a change an hour','The room is as stale as a sealed box, with a draught at the door'],
    says:'<b>Helo</b> and <b>Harvia</b> draw an inlet in every layout; a duct cannot pull air that has no way in.',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:8, n:3, size:2.6}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'in0|off|straight': {
    grade:'bad', badge:'Nearly sealed',
    title:'Fan stopped, no inlet, exhaust straight through the wall',
    summary:'A hole at 26 cm and a gap at the floor on the same wall, 20 cm apart: there is almost no chimney and almost no flow. The room behaves like a sealed box that whistles a little.',
    good:['Keeps its heat'],
    bad:['No fresh air to speak of','CO₂ climbs as in a sealed room'],
    says:'<b>HUUM</b>: the outlet must sit at least 20 cm above the inlet for gravity to move anything; here the 2 are on one wall and nearly level.',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:12, n:2, size:2.4}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'out0|above': {
    grade:'bad', badge:'Inlet only',
    title:'Inlet above the heater, no exhaust',
    summary:'With no exhaust the air can only leave through the leaks, and the biggest leaks are around the door: a gap at the top and a gap at the bottom. Buoyancy sorts them: hot air seeps out at the top of the door and, since the inlet is 1 m up, out through the inlet too; cold air creeps in under the door. A faint reversal through cracks.',
    good:['Keeps its heat: the leaks are small'],
    bad:['A fraction of a change an hour, through cracks you did not design','The inlet works as an exhaust part of the time','Cold draught under the door'],
    says:'<b>Tylö</b>: an exhaust is required with the inlet; without it the inlet above the heater becomes the outlet.',
    paths:[
      {d:'M398 290 C 380 294, 330 292, 270 290 C 210 290, 150 290, 112 282 C 100 278, 98 262, 98 240 C 98 215, 96 200, 96 186 C 92 190, 68 166, 22 160', color:'gradient', dur:14, n:4, size:2.8},
      {d:'M80 190 C 74 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'hot', dur:12, n:3, size:2.6}
    ],
    stagnant:'M105 24 h291 v200 h-291z', revIn:true, leakOut:true, leakIn:true
  },
  'out0|middle': {
    grade:'bad', badge:'Inlet only',
    title:'Inlet at the heater\'s middle, no exhaust',
    summary:'With no exhaust the hot air leaves through the leaks at the top of the door and the cracks, and the inlet at 45 cm feeds the room from below them: a gravity loop with a 1.3 m chimney and a crack for an outlet. It breathes, slowly, the right way round.',
    good:['Right way round: the leaks are above the inlet','Keeps its heat'],
    bad:['Under one change an hour: a door seal is a poor outlet','Depends on leaks you did not design'],
    says:'<b>Helo</b>: the outlet goes at least 1 m above the inlet. Here it is a crack 1.3 m above it.',
    paths:[{d:'M22 236 C 40 240, 50 256, 58 278 C 64 292, 70 296, 74 296 C 76 290, 74 240, 74 200 C 74 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'gradient', dur:14, n:4, size:2.8}],
    stagnant:'M200 60 h190 v150 h-190z', leakOut:true
  },
  'out0|below': {
    grade:'bad', badge:'Inlet only',
    title:'Inlet at the floor by the heater, no exhaust',
    summary:'With no exhaust the hot air leaves through the leaks at the top of the door and the cracks, and the low inlet feeds the room from the floor: Harvia\'s gravity drawing with a crack for an outlet. A 1.65 m chimney drives it, the crack throttles it.',
    good:['Right way round: the leaks are far above the inlet','Keeps its heat'],
    bad:['Under one change an hour: a door seal is a poor outlet','Cold air at the floor by the heater','Depends on leaks you did not design'],
    says:'<b>Harvia</b> draws this inlet with a low exhaust on the far wall, not with none.',
    paths:[{d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'gradient', dur:14, n:4, size:2.8}],
    stagnant:'M200 60 h190 v150 h-190z', leakOut:true
  },
  'out0|bottom': {
    grade:'bad', badge:'Inlet only',
    title:'Inlet in the floor under the heater, no exhaust',
    summary:'The heater draws fresh air up through itself and sends it to the ceiling; with no exhaust it leaves through the leaks at the top of the door. The tallest chimney on the page, 1.75 m, throttled by a crack.',
    good:['Right way round, through the heater: warm feet','Keeps its heat'],
    bad:['About one change an hour at best: a door seal is a poor outlet','Depends on leaks you did not design'],
    says:'<b>Tylö</b> pairs this inlet with a high exhaust on the far wall; the leaks here stand in for it badly.',
    paths:[{d:'M73 312 L 73 200 C 74 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'gradient', dur:13, n:5, size:2.8}],
    stagnant:'M200 60 h190 v150 h-190z', leakOut:true
  },
  'on|middle|riser': {
    grade:'ok', badge:'Depends on the heater',
    title:"Fan on, inlet at the heater's middle, exhaust ducted up",
    summary:"The inlet faces the side of the heater at half its height, and what happens next depends on what it faces. A closed casing is a wall: the jet splits on it, most of the cold air slides down to the floor and the fan drags it to the grille, the rest climbs the hot casing into the plume. An open pillar is a sieve: the jet goes in between the stones, is heated on the spot and rises through the pillar, and the fan then pulls it down past the benches as with the high inlet. No manual draws this position; it is the one layout on this page where the heater switch changes everything.",
    good:["With an open pillar the fresh air is heated before it reaches anyone: warm feet, good exchange","The inlet sits low on the wall, easy to build and out of the sensor's way"],
    bad:["With a closed casing most of the air falls to the floor: a cold layer and a short circuit to the grille","The stones nearest the inlet run cooler, so the löyly comes off the pillar unevenly","No manufacturer draws it and nobody has measured it"],
    says:"<b>No source draws a side inlet.</b> Harvia and Helo put the fan-driven inlet above the heater; Tylö puts the gravity inlet under it. The page reasons from the heater's shape: a casing deflects, a pillar admits.",
    paths:[
      {d:'M22 236 C 40 238, 50 244, 56 262 C 70 290, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:5.5, n:8, duct:true},
      {d:'M22 236 C 44 238, 54 226, 62 200 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.08;0.2;1', dur:7, n:5, duct:true}
    ],
    pathsOpen:[
      {d:'M22 236 C 40 238, 52 236, 64 232 C 74 220, 76 200, 74 186 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.08;0.2;1', dur:6.5, n:9, duct:true},
      {d:'M22 236 C 40 240, 48 256, 56 268 C 70 290, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:6, n:3, size:2.6, duct:true}
    ],
    stagnant:'M200 60 h190 v140 h-190z'
  },
  'on|middle|straight': {
    grade:'ok', badge:'Depends on the heater',
    title:"Fan on, inlet at the heater's middle, exhaust straight through the wall",
    summary:"The inlet faces the side of the heater at half its height, and what happens next depends on what it faces. A closed casing is a wall: the jet splits on it, most of the cold air slides down to the floor and the fan drags it to the grille, the rest climbs the hot casing into the plume. An open pillar is a sieve: the jet goes in between the stones, is heated on the spot and rises through the pillar, and the fan then pulls it down past the benches as with the high inlet. The duct makes no difference while the fan runs.",
    good:["With an open pillar the fresh air is heated before it reaches anyone: warm feet, good exchange","The inlet sits low on the wall, easy to build and out of the sensor's way"],
    bad:["With a closed casing most of the air falls to the floor: a cold layer and a short circuit to the grille","The stones nearest the inlet run cooler, so the löyly comes off the pillar unevenly","When the fan stops the inlet is the higher opening and the room runs backwards"],
    says:"<b>No source draws a side inlet.</b> Harvia and Helo put the fan-driven inlet above the heater; Tylö puts the gravity inlet under it. The page reasons from the heater's shape: a casing deflects, a pillar admits.",
    paths:[
      {d:'M22 236 C 40 238, 50 244, 56 262 C 70 290, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:5.5, n:8},
      {d:'M22 236 C 44 238, 54 226, 62 200 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.08;0.2;1', dur:7, n:5}
    ],
    pathsOpen:[
      {d:'M22 236 C 40 238, 52 236, 64 232 C 74 220, 76 200, 74 186 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.08;0.2;1', dur:6.5, n:9},
      {d:'M22 236 C 40 240, 48 256, 56 268 C 70 290, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:6, n:3, size:2.6}
    ],
    stagnant:'M200 60 h190 v140 h-190z'
  },
  'off|middle|riser': {
    grade:'ok', badge:'Half-height gravity',
    title:"Fan stopped, inlet at the heater's middle, exhaust ducted up",
    summary:"The chimney in the duct draws, and the inlet sits 45 cm up the wall facing the heater. The cold air falls the short way to the floor; with a closed casing the heater's own draught takes much of it in at the base and sends it up, with a pillar the jet enters the stones directly. Either way more of the fresh air is heated before it spreads than with the inlet at the floor, and the chimney from inlet to duct outlet is 1.65 m, taller than with the high inlet.",
    good:["Taller chimney than the high inlet: more buoyancy flow","Most of the fresh air passes the heater before it reaches the benches","Nothing reverses: the duct outlet is far above the inlet"],
    bad:["Still a gravity sauna: 2 to 3 changes an hour at best","Cold air falls to the floor on its way to the heater","Unmeasured: no manual or study covers this position"],
    says:"<b>Helo</b> and <b>HUUM</b> draw the gravity inlet low beside the heater; this is that inlet lifted to half height, with the same low outlet ducted up.",
    paths:[
      {d:'M22 236 C 40 240, 50 256, 58 278 C 64 292, 70 296, 74 296 C 76 290, 74 240, 74 200 C 74 150, 100 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', kt:'0;0.2;0.32;1', dur:10, n:6, duct:true},
      {d:'M22 236 C 40 242, 52 262, 60 280 C 80 292, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:9, n:3, size:2.6, duct:true}
    ],
    pathsOpen:[
      {d:'M22 236 C 40 238, 52 236, 64 232 C 74 220, 76 205, 74 188 C 74 150, 100 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', kt:'0;0.08;0.2;1', dur:9.5, n:7, duct:true},
      {d:'M22 236 C 40 240, 48 256, 56 268 C 70 290, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:9, n:2, size:2.6, duct:true}
    ]
  },
  'off|middle|straight': {
    grade:'bad', badge:'A weak reversal',
    title:"Fan stopped, inlet at the heater's middle, exhaust straight through the wall",
    summary:"Both openings are low, and the inlet is the higher one: 45 cm against 26 cm. Buoyancy runs them backwards, as with the high inlet, only with a quarter of the drive: warm air leaks out of the inlet, cold air seeps in at the grille and creeps along the floor. The flow is small and so is the exchange; the room is close to a sealed box with a cold draught on the ankles.",
    good:["Little heat is lost: the drive is only about 0.4 Pa","Open the drying vent and the loop turns the right way round"],
    bad:["Runs backwards: about half a change an hour, along the floor","CO₂ climbs almost as fast as in a sealed room","The inlet above the outlet is the rule broken here; 19 cm is enough to break it"],
    says:"<b>Tylö</b>: an exhaust to outdoors below the inlet reverses the flow. The height difference decides, not the inlet's angle or the heater.",
    paths:[
      {d:'M398 262 C 380 272, 330 290, 270 290 C 210 291, 150 291, 112 286 C 100 282, 96 270, 96 258 C 94 248, 80 240, 22 236', color:'gradient', kt:'0;0.5;0.68;1', dur:12, n:6, size:2.8}
    ],
    stagnant:'M105 24 h291 v200 h-291z', revIn:true
  },
  'on|bottom|riser': {
    grade:'ok', badge:"Tylö's inlet, with a fan",
    title:"Fan on, inlet in the floor under the heater, exhaust ducted up",
    summary:"The fresh air comes up through the floor into the heater's base. A closed casing is a chimney and takes it all: the air is heated past the elements, leaves over the stones and joins the plume at the ceiling, where the fan pulls it down past the benches to the grille. The room gets the high inlet's mixing with the inlet hidden under the heater. A pillar has no chimney: the air arrives at the base, some rises through the stones, the rest spills out along the floor and the fan drags that part to the grille cold.",
    good:["With a closed casing every litre of fresh air is heated before it spreads: warm feet, full exchange","No hole in a visible wall; the inlet is under the heater","The thermostat sits high on the wall, nowhere near the incoming air"],
    bad:["Needs a floor open to outside air, or a duct from the hole to an outside wall","Löyly water and dirt drain into it: a collar and a screen are not optional","With a pillar a share of the air spills along the floor cold"],
    says:"<b>Tylö</b>: “place the inlet vent straight through the wall directly under the heater”, for its wall-hung heaters, 125 cm² for a family sauna. On a floor-standing heater the same position is a hole in the floor.",
    paths:[
      {d:'M73 312 L 73 200 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.12;0.25;1', dur:6.5, n:9, duct:true},
      {d:'M73 300 C 84 296, 100 292, 130 292 C 200 292, 300 290, 398 262', color:'fresh', dur:6, n:2, size:2.4, duct:true}
    ],
    pathsOpen:[
      {d:'M73 312 L 73 200 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.12;0.25;1', dur:6.5, n:6, duct:true},
      {d:'M73 300 C 84 296, 100 292, 130 292 C 200 292, 300 290, 398 262', color:'fresh', dur:5.5, n:5, duct:true}
    ]
  },
  'on|bottom|straight': {
    grade:'ok', badge:"Tylö's inlet, with a fan",
    title:"Fan on, inlet in the floor under the heater, exhaust straight through the wall",
    summary:"The fresh air comes up through the floor into the heater's base. A closed casing is a chimney and takes it all: the air is heated past the elements, leaves over the stones and joins the plume at the ceiling, where the fan pulls it down past the benches to the grille. A pillar has no chimney: some of the air rises through the stones, the rest spills out along the floor to the grille. The duct makes no difference while the fan runs; without the fan this layout keeps breathing the right way, because the inlet is the lowest opening in the room.",
    good:["With a closed casing every litre of fresh air is heated before it spreads: warm feet, full exchange","No hole in a visible wall","Cannot reverse when the fan stops"],
    bad:["Needs a floor open to outside air, or a duct from the hole to an outside wall","Löyly water and dirt drain into it: a collar and a screen are not optional","With a pillar a share of the air spills along the floor cold"],
    says:"<b>Tylö</b>: “place the inlet vent straight through the wall directly under the heater”, for its wall-hung heaters, 125 cm² for a family sauna. On a floor-standing heater the same position is a hole in the floor.",
    paths:[
      {d:'M73 312 L 73 200 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.12;0.25;1', dur:6.5, n:9},
      {d:'M73 300 C 84 296, 100 292, 130 292 C 200 292, 300 290, 398 262', color:'fresh', dur:6, n:2, size:2.4}
    ],
    pathsOpen:[
      {d:'M73 312 L 73 200 C 74 150, 100 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', kt:'0;0.12;0.25;1', dur:6.5, n:6},
      {d:'M73 300 C 84 296, 100 292, 130 292 C 200 292, 300 290, 398 262', color:'fresh', dur:5.5, n:5}
    ]
  },
  'off|bottom|riser': {
    grade:'ok', badge:'The heater as the chimney',
    title:"Fan stopped, inlet in the floor under the heater, exhaust ducted up",
    summary:"Tylö's gravity inlet with Helo's ducted outlet. The heater draws the fresh air up through itself, heats it and sends it to the ceiling; it comes down the far wall past the benches and leaves at the grille, and the duct outlet 2 m above the inlet gives the tallest chimney on this page. With a closed casing nearly all the air takes that route. With a pillar some spills along the floor first.",
    good:["Tallest chimney of the gravity layouts: about 3 changes an hour","The fresh air is heated before it reaches anyone: the warmest feet of any gravity layout","Cannot reverse: the inlet is the lowest point in the room"],
    bad:["Needs a floor open to the outside, or a duct to one","Depends on the heater being hot: nothing moves during heat-up","A gap under the door is a second inlet at the same height"],
    says:"<b>Tylö</b> draws the inlet under the heater and the exhaust high for gravity saunas. <b>Helo</b> ducts the low exhaust up. This layout takes both.",
    paths:[
      {d:'M73 312 L 73 200 C 74 150, 100 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', kt:'0;0.12;0.28;1', dur:9, n:7, duct:true},
      {d:'M73 312 L 73 200 C 74 150, 120 60, 200 50 C 270 45, 330 90, 340 135 C 345 170, 360 215, 398 262', color:'gradient', kt:'0;0.12;0.28;1', dur:9.8, n:5, duct:true}
    ],
    pathsOpen:[
      {d:'M73 312 L 73 200 C 74 150, 100 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', kt:'0;0.12;0.28;1', dur:9, n:6, duct:true},
      {d:'M73 300 C 84 296, 100 292, 130 292 C 200 292, 300 290, 398 262', color:'fresh', dur:9, n:3, size:2.6, duct:true}
    ]
  },
  'off|bottom|straight': {
    grade:'ok', badge:"Tylö's inlet, a low outlet",
    title:"Fan stopped, inlet in the floor under the heater, exhaust straight through the wall",
    summary:"The inlet is at the floor and the outlet at 26 cm: a chimney of 26 cm, a little more than Harvia's drawing with the inlet beside the heater, and the heater pre-heats the air, which the beside-the-heater inlet does not. It breathes weakly and the right way round, because the inlet is the lowest opening in the room and can never turn into an exhaust.",
    good:["Cannot reverse","Feet warmer than with the inlet beside the heater: the air arrives through the heater"],
    bad:["About one change an hour","Needs a floor open to outside air","Dies as the room cools"],
    says:"<b>Tylö</b> wants the outlet high and diagonal with this inlet; with a low outlet the same inlet gives a fraction of the flow.",
    paths:[
      {d:'M73 312 L 73 200 C 74 150, 100 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', kt:'0;0.12;0.28;1', dur:16, n:5},
      {d:'M73 312 L 73 200 C 74 150, 120 60, 200 50 C 270 45, 330 90, 340 135 C 345 170, 360 215, 398 262', color:'gradient', kt:'0;0.12;0.28;1', dur:17, n:4}
    ],
    pathsOpen:[
      {d:'M73 312 L 73 200 C 74 150, 100 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', kt:'0;0.12;0.28;1', dur:16, n:4},
      {d:'M73 300 C 84 296, 100 292, 130 292 C 200 292, 300 290, 398 262', color:'fresh', dur:15, n:3, size:2.6}
    ]
  },
  'none': {
    grade:'bad', badge:'The sealed box',
    title:'No ventilation: no inlet, no exhaust',
    summary:'The common Brazilian sauna: a closed room with a heater. The heater still moves air, a plume up the wall, across the ceiling, down the far side and back along the floor, but it is the same air going round. Nothing replaces what the bathers breathe out except the gaps around the door, a few tenths of a change an hour. CO₂ climbs about 55 ppm a minute with 2 bathers, 4 times that with 8, and the löyly\'s moisture has no way out either.',
    good:['Warm everywhere, no draught, no fan, nothing to build','Heats fast and holds heat: nothing is thrown away'],
    bad:['No fresh air: with 2 bathers CO₂ passes 2,000 ppm in half an hour, with 8 it passes 5,000, the 8-hour occupational limit (Brazil\'s NR-15 sets 3,900)','Stale, heavy air; the sauna people say "suffocates"','Steam has nowhere to go: the wood stays wet after the session unless the door is left open','Opening the door is the only ventilation, and it dumps the heat'],
    ach:'0.3 / h, door gaps', achG:'bad', head:'about 0.2 / h', headG:'bad', feet:'warm', feetG:'good',
    says:'<b>Harvia</b>, <b>Helo</b> and <b>Tylö</b> manuals all require an inlet and an exhaust. <b>Saunologia</b>: 8 to 10 l/s per bather keeps a sauna under 1,000 ppm; with the ventilation off the level climbs within minutes. <b>Finnish code D2</b> (repealed) gave every occupied room at least 6 l/s.',
    paths:[
      {d:'M80 212 C 70 150, 90 70, 150 48 C 240 30, 340 34, 382 60 C 396 120, 396 220, 380 270 C 330 292, 200 294, 110 290 C 80 288, 72 250, 80 212 Z', color:'hot', dur:12, n:10, size:3},
      {d:'M250 70 C 300 60, 340 90, 320 120 C 300 150, 230 140, 220 110 C 212 90, 230 76, 250 70 Z', color:'stale', dur:14, n:5, size:2.6, noguide:true},
      {d:'M200 160 C 240 150, 300 170, 290 200 C 280 230, 210 230, 200 200 C 194 180, 190 166, 200 160 Z', color:'stale', dur:16, n:4, size:2.4, noguide:true}
    ],
    stagnant:'M105 24 h291 v160 h-291z'
  },
  'on|above|riser': {
    grade:'best', badge:'The reference layout',
    title:'Fan on, inlet above the heater, exhaust ducted up',
    summary:'Fresh air drops out of the high inlet straight into the heater\'s plume and is heated and mixed at once. The fan pulls that mixed air down through the benches and out under the lower bench, past the bather\'s face on the way. The rising duct changes nothing while the fan runs; it is there for the day the fan stops.',
    good:['Air is exchanged where people breathe','Feet 20 to 35 °C warmer than with a low inlet (VTT 1992)','The hottest air under the ceiling is kept, not thrown away','Rate set by the fan: 6 changes an hour, or 8 to 10 l/s per bather'],
    bad:['Needs a duct run and the fan interlocked with the heater','The inlet must keep its distance from the sensor','A gap under the door can steal the inlet\'s job: VTT measured hot air leaving a high inlet with the fan running when the door leaked'],
    ach:'6 / h', achG:'good', head:'6 / h', headG:'good', feet:'warm', feetG:'good', co2:980, co28:2250, co2note:'steady state',
    says:'<b>VTT 1992</b> and <b>2002</b>, <b>Harvia</b>, <b>Helo</b>, <b>HUUM</b>, <b>Saunologia</b> all give this layout for an electric heater with a fan. VTT 2002 and Saunologia add: with an exhaust fan only, seal the door or add a supply fan.',
    paths:[
      {d:'M22 160 C 46 163, 60 172, 70 182 C 78 150, 88 110, 120 70 C 170 40, 260 40, 320 70 C 360 95, 350 150, 330 180 C 315 205, 320 240, 398 262', color:'gradient', dur:6, n:10, duct:true},
      {d:'M22 160 C 50 165, 66 176, 74 186 C 90 130, 110 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', dur:6.8, n:8, duct:true}
    ]
  },
  'on|above|straight': {
    grade:'best', badge:'Works, until the fan stops',
    title:'Fan on, inlet above the heater, exhaust straight through the wall',
    summary:'Identical to the reference layout while the fan runs: the inlet air is caught by the plume, mixed, and pulled down through the benches to the low grille. The difference is hidden. Both openings go straight outside, so the moment the fan dies, buoyancy has a low hole and a high hole to work with.',
    good:['Same air path and the same warm feet as the ducted version','Simplest exhaust to build: one hole, one fan'],
    bad:['No protection when the fan stops: flip the fan switch to see the reversal','Wind on the exhaust wall pushes straight into the room; 3 m/s is about 5 Pa, more than the stack effect','Tylö warns against any exhaust that leads straight outdoors for this reason'],
    ach:'6 / h', achG:'good', head:'6 / h', headG:'good', feet:'warm', feetG:'good', co2:980, co28:2250, co2note:'steady state',
    says:'<b>VTT 1992</b> ran its lab this way, exhaust fan straight out, and it worked because the fan was always on. <b>Tylö</b>: "The air exhaust vent must not lead outdoors. This could cause the ventilation direction to be reversed."',
    paths:[
      {d:'M22 160 C 46 163, 60 172, 70 182 C 78 150, 88 110, 120 70 C 170 40, 260 40, 320 70 C 360 95, 350 150, 330 180 C 315 205, 320 240, 398 262', color:'gradient', dur:6, n:10},
      {d:'M22 160 C 50 165, 66 176, 74 186 C 90 130, 110 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', dur:6.8, n:8}
    ]
  },
  'on|below|riser': {
    grade:'bad', badge:'Short circuit along the floor',
    title:'Fan on, inlet below the heater',
    summary:'The fan pulls, but the fresh air never climbs. Cold air comes in at floor level, pools, and the fan drags it straight across the floor to the low grille, under the benches and under everyone. The heater\'s plume rises to the ceiling and circles there with nothing to carry it down. The room changes its air 6 times an hour on paper and about a third of that at head height, the share the heater manages to lift.',
    good:['The fan still removes some heat and moisture','Nothing reverses: the flow direction is stable'],
    bad:['A cold layer on the floor; VTT measured the foot bench 20 to 35 °C colder than with a high inlet','Head zone starved: in the VTT tracer tests the low-in, low-out layout let humidity at head height climb to 2 or 3 times the high-inlet value','Cold air fed under an electric heater disturbs its thermostat (VTT 1992) and can overheat a heater with a built-in sensor (Saunologia)'],
    ach:'6 / h', achG:'warn', head:'about 2 / h, a third of the fan', headG:'bad', feet:'cold layer', feetG:'bad', co2:2300, co28:5500, co2note:'at head height, steady',
    says:'<b>VTT 1992</b>: a low inlet "lands on the floor", and inlet low with exhaust low is the short-circuit case. <b>Harvia</b> and <b>Narvi</b> give the low inlet only for gravity ventilation, never with a fan. <b>Finnmark</b> and <b>Thermory</b> still draw it low with a fan; the VTT smoke tests contradict them.',
    paths:[
      {d:'M22 283 C 80 288, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:5, n:9, duct:true},
      {d:'M22 280 C 60 284, 110 290, 200 290 C 300 290, 360 272, 398 260', color:'fresh', dur:5.6, n:7, duct:true},
      {d:'M76 190 C 72 150, 84 90, 130 52 C 200 30, 310 40, 350 76 C 330 104, 262 112, 226 92 C 240 72, 290 60, 330 68', color:'hot', dur:7, n:7, noguide:true}
    ],
    stagnant:'M200 60 h190 v140 h-190z'
  },
  'on|below|straight': {
    grade:'bad', badge:'Short circuit along the floor',
    title:'Fan on, inlet below the heater',
    summary:'The fan pulls, but the fresh air never climbs. Cold air comes in at floor level, pools, and the fan drags it straight across the floor to the low grille, under the benches and under everyone. The heater\'s plume lifts about a third of the fresh air; the rest crosses the floor to the grille. The duct makes no difference while the fan runs.',
    good:['The fan still removes some heat and moisture','Nothing reverses while the fan runs'],
    bad:['A cold layer on the floor; VTT measured the foot bench 20 to 35 °C colder than with a high inlet','Head zone starved: the low-in, low-out layout let humidity at head height climb to 2 or 3 times the high-inlet value','Cold air fed under an electric heater disturbs its thermostat (VTT 1992)'],
    ach:'6 / h', achG:'warn', head:'about 2 / h, a third of the fan', headG:'bad', feet:'cold layer', feetG:'bad', co2:2300, co28:5500, co2note:'at head height, steady',
    says:'<b>VTT 1992</b>: a low inlet "lands on the floor", and inlet low with exhaust low is the short-circuit case. <b>Harvia</b> and <b>Narvi</b> give the low inlet only for gravity ventilation, never with a fan.',
    paths:[
      {d:'M22 283 C 80 288, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:5, n:9},
      {d:'M22 280 C 60 284, 110 290, 200 290 C 300 290, 360 272, 398 260', color:'fresh', dur:5.6, n:7},
      {d:'M76 190 C 72 150, 84 90, 130 52 C 200 30, 310 40, 350 76 C 330 104, 262 112, 226 92 C 240 72, 290 60, 330 68', color:'hot', dur:7, n:7, noguide:true}
    ],
    stagnant:'M200 60 h190 v140 h-190z'
  },
  'off|above|riser': {
    grade:'ok', badge:'The fail-safe',
    title:'Fan stopped, inlet above the heater, exhaust ducted up',
    summary:'The fan is gone and the room keeps breathing the right way round, only slower. The duct\'s outlet is higher than the inlet, so the column of warm air in the duct works as a small chimney: it keeps drawing from the low grille, and the high inlet keeps admitting air that falls into the plume. Nothing reverses. The sauna degrades from a fan system to a gravity system, never to a backwards one.',
    good:['Same direction as with the fan: in above the heater, out under the bench','Feet stay warm; no cold draught at floor level','2 or 3 changes an hour from buoyancy alone, enough for 2 bathers','The failure is a slower sauna, not a ruined one'],
    bad:['Weaker than the fan: with 6 or 8 bathers CO₂ climbs past 2,000 ppm','Depends on the duct outlet being well above the inlet: the higher, the stronger','Must be primed: with the pipe cold at start-up the loop can start backwards and stay there, cold air coming down the pipe. A minute of fan, or the drying vent open for a minute, starts it the right way; the low inlet of F needs no priming','A gap under the door competes with the inlet; seal the door'],
    ach:'2 to 3 / h', achG:'warn', head:'2 to 3 / h', headG:'warn', feet:'warm', feetG:'good', co2:1750, co28:4100, co2note:'steady state at 2.5 / h',
    says:'<b>Helo</b> ducts the low exhaust up to the ceiling and, without a fan, places the outlet at least 1 m above the inlet. <b>Sawo</b> allows the under-platform exhaust to be piped to a ceiling vent. <b>VTT 1992</b> calls low-in, high-out the most reliable gravity arrangement; the riser makes a low grille behave as a high outlet.',
    paths:[
      {d:'M22 160 C 46 163, 60 172, 70 182 C 78 150, 88 110, 120 70 C 170 40, 260 40, 320 70 C 360 95, 350 150, 330 180 C 315 205, 320 240, 398 262', color:'gradient', dur:10, n:6, duct:true},
      {d:'M22 160 C 50 165, 66 176, 74 186 C 90 130, 110 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', dur:11, n:5, duct:true}
    ]
  },
  'off|above|straight': {
    grade:'bad', badge:'The reversal',
    title:'Fan stopped, inlet above the heater, exhaust straight through the wall',
    summary:'Nothing pulls at the low grille any more, so buoyancy takes over and runs both openings backwards. Hot room air pushes out through the high inlet above the heater; cool outside air seeps in through the low grille and creeps along the floor. The room turns into a tight low-in, high-out loop that hugs the floor and the heater wall: a cold draught on the ankles, a thickening hot layer under the ceiling, almost no exchange at head height. One of the 2 layouts on this page that run backwards.',
    good:['Heat loss through the vents drops by about 2/3; the heater cycles less','Restart the fan and the proper loop is back within a minute'],
    bad:['The vents run backwards: about 1.5 Pa of stack pressure between the openings, 5 to 7 l/s through 2 100 mm holes, 0.4 to 0.6 kW lost','Cold draught at the feet, hot air thrown away above the heater','Exchange at head height under one change an hour; with 2 bathers CO₂ climbs about 50 ppm a minute','Brazil halves the Finnish pressure, it does not remove it'],
    ach:'1 to 2 / h, backwards', achG:'bad', head:'under 1 / h', headG:'bad', feet:'cold draught', feetG:'bad', co2:1900, co28:4800, co2note:'after 20 minutes, still climbing',
    says:'<b>VTT 2002</b> measured 80 to 100 °C air flowing out of the high inlet in a Helsinki sauna with this layout, with the exhaust fan running, because the door gap was the easier way in. <b>Saunologia</b>: a high gravity inlet "turns into an exhaust pipe". <b>Tylö</b>: an exhaust to outdoors "could cause the ventilation direction to be reversed".',
    paths:[
      {d:'M398 262 C 380 264, 330 288, 270 289 C 210 290, 150 290, 112 282 C 100 278, 98 262, 98 240 C 98 215, 96 200, 96 186 C 92 190, 68 166, 22 160', color:'gradient', kt:'0;0.5;0.68;1', dur:9, n:9, size:3},
      {d:'M398 258 C 370 262, 300 282, 230 284 C 170 286, 130 280, 108 270 C 100 262, 102 236, 104 214 C 104 220, 90 180, 22 162', color:'gradient', kt:'0;0.5;0.68;1', dur:10, n:6, size:2.8, noguide:true}
    ],
    stagnant:'M105 24 h291 v160 h-291z', revIn:true
  },
  'off|below|riser': {
    grade:'ok', badge:'The Finnish gravity sauna',
    title:'Fan stopped, inlet below the heater, exhaust ducted up',
    summary:'This is the classic sauna without a fan, done properly. Cold air enters low beside the heater, is heated, rises to the ceiling, drifts across, comes down the far wall and leaves through the low grille into the rising duct. It works on buoyancy alone and keeps working as long as the heater is hot. Its price is the floor: the cold inlet air pools before the plume lifts it, and the feet pay.',
    good:['No fan, no wiring, works every time the heater is on','The loop passes the benches on its way down the far wall','Keeps more heat than a ceiling exhaust'],
    bad:['Cold draught at floor level near the heater; VTT measured the foot bench 20 to 35 °C colder than with a high inlet','Flow is weak and variable, 2 to 3 changes an hour at best','Cold air under an electric heater can disturb its thermostat'],
    ach:'2 to 3 / h', achG:'warn', head:'1 to 2 / h', headG:'warn', feet:'cold at the heater', feetG:'bad', co2:1750, co28:4100, co2note:'steady state at 2.5 / h',
    says:'<b>Harvia</b> and <b>Narvi</b>, gravity: supply below or next to the heater, exhaust near the floor as far from the heater as possible. <b>Helo</b>: without forced ventilation the inlet goes low and the exhaust at least 1 m higher. <b>Saunologia</b> does not recommend gravity ventilation for electric saunas.',
    paths:[
      {d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', dur:9, n:7, duct:true},
      {d:'M22 283 C 60 283, 76 262, 82 215 C 95 140, 120 60, 200 50 C 270 45, 330 90, 340 135 C 345 170, 360 215, 398 262', color:'gradient', dur:9.8, n:6, duct:true}
    ],
    stagnant:'M240 100 h60 v50 h-60z'
  },
  'off|below|straight': {
    grade:'ok', badge:'Harvia\'s gravity drawing, weak',
    title:'Fan stopped, inlet at the floor by the heater, exhaust straight through the wall',
    summary:'The classic sauna without a fan, as Harvia draws it: air in low beside the heater, heated, up to the ceiling, across, down the far wall and out through the low grille. It breathes only because the outlet is higher than the inlet: here 26 cm against 10 cm, about 0.3 Pa of stack pressure, under HUUM\'s minimum of 20 cm. Put the 2 openings at the same height and nothing moves. Lift the outlet to 1 m above the inlet, Helo\'s rule, or duct it up, and the same room breathes 2 to 3 times as fast.',
    good:['No fan, no wiring, works whenever the heater is hot','The loop passes the benches on its way down the far wall','Keeps more heat than a ceiling exhaust'],
    bad:['Weak: about one change an hour; a 16 cm height difference is a small chimney','Cold air at the floor near the heater; VTT measured the foot bench 20 to 35 °C colder than with a high inlet','Depends on the heater being hot; it does nothing during heat-up and dies as the room cools','A gap under the door at the same height short-circuits it'],
    ach:'about 1 / h', achG:'bad', head:'about 1 / h', headG:'bad', feet:'cold at the floor', feetG:'bad', co2:1900, co28:4800, co2note:'after 20 minutes, still climbing',
    says:'<b>Harvia</b>, gravity: supply below or next to the heater, exhaust near the floor as far from the heater as possible. <b>HUUM</b>, gravity: exhaust at least 20 cm higher than the supply, not above 60 cm. <b>Helo</b>: without forced ventilation the outlet goes at least 1 m above the inlet. <b>Saunologia</b> does not recommend gravity ventilation for electric saunas.',
    paths:[
      {d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', dur:16, n:5},
      {d:'M22 283 C 60 283, 76 262, 82 215 C 95 140, 120 60, 200 50 C 270 45, 330 90, 340 135 C 345 170, 360 215, 398 262', color:'gradient', dur:17, n:4}
    ],
    stagnant:'M200 60 h190 v150 h-190z'
  }
};


const DRY = {
  'on|middle|riser':   {note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong; the floor keeps whatever the heater does not lift.'},
  'on|middle|straight':{note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong; the floor keeps whatever the heater does not lift.'},
  'on|bottom|riser':   {note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong. The heater keeps feeding the plume from below.'},
  'on|bottom|straight':{note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong. The heater keeps feeding the plume from below.'},
  'off|middle|riser':  {grade:'ok', badge:'Low in, high out: the reliable gravity loop', note:'With the ceiling vent open the room runs the classic low-in, high-out loop, VTT\'s most reliable gravity arrangement. It pays in heat: the ceiling vent throws away 90 to 95 °C air, about double the heat of a low exhaust.'},
  'off|middle|straight':{grade:'ok', badge:'The ceiling vent turns it round', note:'The open vent at 1.9 m is now the outlet. Both low openings admit, the weak reversal becomes the classic low-in, high-out loop, and the room breathes 2 to 3 times an hour, at the price of its hottest air.'},
  'off|bottom|riser':  {grade:'ok', badge:'Low in, high out: the reliable gravity loop', note:'With the ceiling vent open the room runs the classic low-in, high-out loop from the lowest inlet there is. It pays in heat: the ceiling vent throws away 90 to 95 °C air, about double the heat of a low exhaust.'},
  'off|bottom|straight':{grade:'ok', badge:'Low in, high out: the reliable gravity loop', note:'With the ceiling vent open the room runs the classic low-in, high-out loop from the lowest inlet there is; the low grille does little now. It pays in heat: the ceiling vent throws away 90 to 95 °C air.'},
  'on|above|riser':   {grade:'ok', badge:'The hottest air leaves at the ceiling', headN:4, head:'about 4 / h', headG:'warn', note:'Which way the vent breathes is a contest between the fan\x27s suction and the stack pressure at the ceiling. A strong fan on a small inlet holds the room about 2 Pa below outside and the vent sucks cool air in, straight onto the top bench. A weaker fan, a bigger inlet or a leaky door drops the suction under 1 Pa, the stack wins, and the vent exhales the hottest air in the room with the löyly, before the fan can bring it down past the benches; drawn here. A 2-person room at 6 changes an hour sits right on that line. Harvia and Narvi: the drying vent stays closed while bathing and is opened afterwards.'},
  'on|above|straight':{grade:'ok', badge:'The hottest air leaves at the ceiling', headN:4, head:'about 4 / h', headG:'warn', note:'Which way the vent breathes is a contest between the fan\x27s suction and the stack pressure at the ceiling. A strong fan on a small inlet holds the room about 2 Pa below outside and the vent sucks cool air in, straight onto the top bench. A weaker fan, a bigger inlet or a leaky door drops the suction under 1 Pa, the stack wins, and the vent exhales the hottest air in the room with the löyly, before the fan can bring it down past the benches; drawn here. A 2-person room at 6 changes an hour sits right on that line. Harvia and Narvi: the drying vent stays closed while bathing and is opened afterwards.'},
  'on|below|riser':   {note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong; the floor short circuit continues underneath either way.'},
  'on|below|straight':{note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong; the floor short circuit continues underneath either way.'},
  'off|above|riser':  {grade:'bad', badge:'The ceiling vent beats the chimney', ach:'2 to 3 / h', achG:'warn', headN:1.5, head:'1 to 2 / h', headG:'warn', feet:'cool draught', feetG:'bad', co2:1750, co28:4100, note:'The open vent at 1.9 m is now the easiest way out, above the inlet and inside the room: hot air leaves there, the high inlet admits, and the low grille turns into a cold inlet despite the duct. The hottest air is thrown away all session.'},
  'off|above|straight':{ach:'2 to 3 / h, backwards', note:'Hot air now leaves through the open vent as well as the inlet; the reversal is stronger and the room loses its hottest air, at 90 °C, all session.'},
  'off|below|riser':  {grade:'ok', badge:'Low in, high out: the reliable gravity loop', ach:'2 to 4 / h', achG:'warn', headN:2.5, head:'2 to 3 / h', headG:'warn', feet:'coldest of all', feetG:'bad', co2:1500, co28:3500, note:'With the ceiling vent open the room runs the classic low-in, high-out loop, VTT\'s most reliable gravity arrangement and the strongest without a fan. It pays twice: the ceiling vent throws away 90 to 95 °C air, about double the heat of a low exhaust, and VTT found the feet coldest of any layout.'},
  'off|below|straight':{grade:'ok', badge:'Low in, high out: the reliable gravity loop', ach:'2 to 4 / h', achG:'warn', headN:2.5, head:'2 to 3 / h', headG:'warn', feet:'coldest of all', feetG:'bad', co2:1500, co28:3500, note:'With the ceiling vent open the room runs the classic low-in, high-out loop, VTT\'s most reliable gravity arrangement; the low grille does little now. It pays twice: the ceiling vent throws away 90 to 95 °C air, about double the heat of a low exhaust, and the feet are the coldest of any layout.'}
};
const DRY_PATHS = {
  offMiddle: [{d:'M22 236 C 40 240, 50 256, 58 278 C 64 292, 70 296, 74 296 C 76 290, 74 240, 74 200 C 74 150, 95 70, 160 48 C 240 32, 330 36, 398 36', color:'gradient', kt:'0;0.2;0.32;1', dur:8, n:7, size:3, noguide:true}],
  offBottom: [{d:'M73 312 L 73 200 C 74 150, 95 70, 160 48 C 240 32, 330 36, 398 36', color:'gradient', kt:'0;0.12;0.28;1', dur:8, n:7, size:3, noguide:true}],
  on:  [{d:'M110 60 C 200 34, 310 36, 398 36', color:'hot', dur:5, n:5, size:2.8, noguide:true}],
  offAbove: [{d:'M60 60 C 180 34, 300 36, 398 36', color:'hot', dur:5, n:5, size:2.8, noguide:true},
             {d:'M398 262 C 370 266, 300 280, 230 284', color:'fresh', dur:5, n:4, size:2.6, noguide:true}],
  offBelow: [{d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 330 36, 398 36', color:'gradient', dur:8, n:7, size:3, noguide:true}]
};

/* ---------- the drying vent left open while bathing ---------- */

/* ---------- drawing helpers ---------- */
const ns='http://www.w3.org/2000/svg';
const el=(t,a={})=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);return e;};

(function(){
  const g=document.getElementById('planks');
  const bg=el('rect',{x:22,y:22,width:376,height:276}); bg.setAttribute('fill','var(--wood1)'); g.appendChild(bg);
  for(let m=0.2;m<2;m+=0.2){const y=298-m*138; g.appendChild(el('line',{x1:22,y1:y,x2:398,y2:y,class:'plank'}));}
  const r=document.getElementById('ruler');
  [[298,'0'],[160,'1 m'],[22,'2 m']].forEach(([y,t])=>{
    r.appendChild(el('line',{x1:-10,y1:y,x2:-2,y2:y,class:'ruler'}));
    const tx=el('text',{x:-14,y:y+3,'text-anchor':'end',class:'rulerT'}); tx.textContent=t; r.appendChild(tx);
  });
  r.appendChild(el('line',{x1:-6,y1:22,x2:-6,y2:298,class:'ruler'}));
})();

function particle(pathD,color,dur,offset,size){
  const c=el('circle',{r:size||3.2}); c.setAttribute('fill',color); c.setAttribute('opacity','0.9');
  c.appendChild(el('animateMotion',{dur:dur+'s',repeatCount:'indefinite',begin:(-offset)+'s',path:pathD}));
  return c;
}
const HEATER_RIGHT = 96, WARM_Y = 120;
function heatKeyTimes(d, fallback){
  const svg=document.getElementById('svg'); if(!svg || !svg.appendChild || !svg.removeChild) return fallback;
  const tmp=el('path',{d:d}); tmp.setAttribute('fill','none'); tmp.setAttribute('stroke','none'); svg.appendChild(tmp);
  if(!tmp.getTotalLength){ svg.removeChild(tmp); return fallback; }
  const L=tmp.getTotalLength(), N=240, P=[];
  if(!L){ svg.removeChild(tmp); return fallback; }
  for(let i=0;i<=N;i++){ const q=tmp.getPointAtLength(L*i/N); P.push([q.x,q.y]); }
  svg.removeChild(tmp);
  let i1=-1;
  for(let i=0;i<N-3;i++){ if(P[i][0] < 22) continue; const dy=P[i][1]-P[i+3][1], dx=Math.abs(P[i+3][0]-P[i][0]); if(dy>1 && dy>dx){ i1=i; break; } }   // climbing steeper than 45° over 3 samples
  if(i1<0) return fallback;
  let i2=-1;
  for(let j=i1;j<=N;j++){ if(P[j][0] > HEATER_RIGHT || P[j][1] < WARM_Y){ i2=j; break; } }
  if(i2<0) i2=Math.min(N, i1+Math.round(N*0.12));
  let t1=Math.max(0.01, i1/N), t2=Math.max(t1+0.06, i2/N); t2=Math.min(0.99,t2);
  return '0;'+t1.toFixed(3)+';'+t2.toFixed(3)+';1';
}
function addParticles(g,p,withDuct){
  const up = state.duct==='half' ? (state.exhaust==='upper'?DUCT_UP_HI_HALF:DUCT_UP_HALF) : (state.exhaust==='upper'?DUCT_UP_HI:DUCT_UP);
  const d = toUpper((withDuct && p.duct) ? p.d+up : p.d);
  for(let k=0;k<p.n;k++){
    const off=(p.dur/p.n)*k;
    if(p.color==='gradient'){
      const a=particle(d,FRESH_HEX,p.dur,off,p.size);
      const kt = p.ktFixed || (k===0 ? (p._kt = heatKeyTimes(d, p.kt||'0;0.18;0.30;1')) : p._kt);
      a.appendChild(el('animate',{attributeName:'fill',values:FRESH_HEX+';'+FRESH_HEX+';'+HOT_HEX+';'+HOT_HEX,keyTimes:kt,dur:p.dur+'s',repeatCount:'indefinite',begin:(-off)+'s'}));
      g.appendChild(a);
    } else g.appendChild(particle(d,'var(--'+p.color+')',p.dur,off,p.size));
  }
}
function ventEl(x,y,label,cls,onLeft,slope,rot){
  const g=el('g'); const geo=el('g'); if(rot) geo.setAttribute('transform','rotate('+rot+' '+x+' '+y+')');
  const f = xx => (slope && onLeft) ? -(xx - x) : 0;   // the hole's axis climbs into the room at 45°
  const quad = (xa,xb,yo) => [xa,y-yo+f(xa), xb,y-yo+f(xb), xb,y+yo+f(xb), xa,y+yo+f(xa)].join(' ');
  // a hole is 2 lines through the wall; a closed vent is 3 lines on a solid wall
  // every vent is a hole through the wall: a cut plus 2 edge lines; a closed vent adds a flap line across its room-side mouth
  const open = cls!=='ventIdle', half=7, reach=9;
  const gap=el('polygon',{points: quad(onLeft?x-1.5:x-2.5, onLeft?x+2.5:x+1.5, half)}); gap.setAttribute('fill','var(--wood1)'); geo.appendChild(gap);
  { const outer=el('polygon',{points: onLeft ? quad(x-2.5, x-1, half) : quad(x+1, x+4.5, half)}); outer.setAttribute('fill','var(--paper)'); geo.appendChild(outer); }   // white beyond the wall face, over the duct line
  const cut=el('polygon',{points: quad(onLeft?x:x-2.5, onLeft?x+2.5:x, half)}); cut.setAttribute('fill','var(--wood1)'); geo.appendChild(cut);
  const stroke=s=>{ s.setAttribute('stroke','var(--ink)'); s.setAttribute('stroke-width','2'); s.setAttribute('stroke-linecap','round'); geo.appendChild(s); };
  [y-half, y+half].forEach(yy=>stroke(el('line',{x1:x-reach,y1:yy+f(x-reach),x2:x+reach,y2:yy+f(x+reach)})));
  if(!open){ const mx = onLeft ? x+reach : x-reach; stroke(el('line',{x1:mx,y1:y-half+f(mx),x2:mx,y2:y+half+f(mx)})); }
  g.appendChild(geo);
  const tx = label.x!=null ? label.x : (onLeft?x+14:x-14), ty = label.y!=null ? label.y : y+4;
  const t=el('text',{x:tx, y:ty, 'text-anchor':onLeft?'start':'end', class:'lbl lblHalo '+(label.c||'')});
  label.t.split('|').forEach((line,i)=>{ const ts=el('tspan',{x:tx, dy:i?10:0}); ts.textContent=line; t.appendChild(ts); });
  g.appendChild(t);
  return g;
}
function fanEl(x,y,on){
  const f=el('g',{transform:`translate(${x} ${y})`});
  const back=el('circle',{cx:0,cy:0,r:8}); back.setAttribute('fill','var(--paper)'); f.appendChild(back);
  const c=el('circle',{cx:0,cy:0,r:7,class:'fanBlade'+(on?'':' fanOff')}); f.appendChild(c);
  const b=el('path',{d:'M0 -6 L2 0 L0 6 L-2 0 Z M-6 0 L0 2 L6 0 L0 -2 Z',class:'fanBlade'+(on?'':' fanOff')});
  if(on && !reduce) b.appendChild(el('animateTransform',{attributeName:'transform',type:'rotate',from:'0',to:'360',dur:'0.8s',repeatCount:'indefinite'}));
  f.appendChild(b); return f;
}

/* ---------- units ---------- */
let units = 'metric';
try{ if(new URLSearchParams(location.search).get('units')==='imperial') units='imperial'; else if(localStorage.getItem('units')==='imperial') units='imperial'; }catch(e){}
const numOf = s => parseFloat(String(s).replace(',',''));
function ftin(m){ const inches=Math.round(m*39.3701); if(inches<36) return inches+' in'; const ft=Math.floor(inches/12), i=inches%12; return i ? ft+' ft '+i+' in' : ft+' ft'; }
function ftinShort(m){ const inches=Math.round(m*39.3701); if(inches<36) return inches+'″'; const ft=Math.floor(inches/12), i=inches%12; return ft+'′'+(i?i+'″':''); }
const N = '(\\d+(?:[.,]\\d+)?)', RNG = N+'(?: to '+N+')?';
function rule(unit, f, tail){ return [new RegExp(RNG+' '+unit+(tail||''),'g'), (m,a,b,rest)=>(b!=null ? f(numOf(a))+' to '+f(numOf(b)) : f(numOf(a)))+(typeof rest==='string'?rest:'')]; }
const RULES = [
  [/about 2 Pa per metre of height/g, 'about 0.6 Pa per foot of height'],
  [/, 1\.7 at 35 °C/g, ', 0.5 at 95 °F'],
  [/2 l\/s per m²/g, '0.4 cfm per ft²'],
  [/per m³/g, 'per 35 ft³'],
  [/per m²/g, 'per 11 ft²'],
  [new RegExp(RNG+' °C(?=\\s+(?:warmer|colder|below|above|hotter|cooler|lower|higher|difference|less|more))','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*1.8)+' to '+Math.round(numOf(b)*1.8) : Math.round(numOf(a)*1.8))+' °F'],
  [new RegExp(RNG+' °C','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*1.8+32)+' to '+Math.round(numOf(b)*1.8+32) : Math.round(numOf(a)*1.8+32))+' °F'],
  [new RegExp(RNG+' m³\\/h','g'), (m,a,b)=>{ const f=x=>x<1?Math.round(x*58.86)/100:Math.round(x*0.5886); return (b!=null ? f(numOf(a))+' to '+f(numOf(b)) : f(numOf(a)))+' cfm'; }],
  [new RegExp(RNG+' m³','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*35.3147)+' to '+Math.round(numOf(b)*35.3147) : Math.round(numOf(a)*35.3147))+' ft³'],
  [new RegExp(RNG+' l\\/s','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*2.11888)+' to '+Math.round(numOf(b)*2.11888) : Math.round(numOf(a)*2.11888))+' cfm'],
  [new RegExp(RNG+' m\\/s','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*2.23694)+' to '+Math.round(numOf(b)*2.23694) : Math.round(numOf(a)*2.23694))+' mph'],
  [new RegExp(RNG+' mm','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)/25.4)+' to '+Math.round(numOf(b)/25.4) : Math.round(numOf(a)/25.4))+' in'],
  [new RegExp(RNG+' cm','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)/2.54)+' to '+Math.round(numOf(b)/2.54) : Math.round(numOf(a)/2.54))+' in']
];
const M_RULE = new RegExp(RNG+' m(?![A-Za-z³²\\/])','g');
function toImperial(t, short){
  let s=t; RULES.forEach(([re,f])=>{ s=s.replace(re,f); });
  const L = short ? ftinShort : ftin;
  return s.replace(M_RULE,(m,a,b)=> b!=null ? L(numOf(a))+' to '+L(numOf(b)) : L(numOf(a)));
}
function applyUnits(){
  const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while((n=w.nextNode())){
    const p=n.parentNode; if(!p || p.nodeName==='SCRIPT' || p.nodeName==='STYLE') continue;
    if(n._metric==null) n._metric=n.nodeValue;
    const short = !!(p.classList && p.classList.contains('rulerT'));
    const v = units==='imperial' ? toImperial(n._metric, short) : n._metric;
    if(v!==n.nodeValue) n.nodeValue=v;
  }
  document.querySelectorAll('#units button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.u===units ? 'true':'false'));
}

const TILT_PATHS = [
  ['M22 160 C 46 163, 60 172, 70 182', 'M22 160 C 40 142, 56 134, 66 154 C 72 170, 72 180, 70 182'],
  ['M22 160 C 50 165, 66 176, 74 186', 'M22 160 C 42 140, 60 132, 70 154 C 76 172, 76 182, 74 186'],
  ['M22 283 C 80 288, 180 292, 280 288', 'M22 283 C 38 266, 54 260, 64 270 C 90 286, 180 292, 280 288'],
  ['M22 280 C 60 284, 110 290, 200 290', 'M22 280 C 36 264, 52 258, 62 268 C 90 284, 130 290, 200 290'],
  ['M22 283 C 60 282, 74 262, 80 215', 'M22 283 C 40 266, 66 250, 80 215'],
  ['M22 236 C 40 238, 50 244, 56 262', 'M22 236 C 36 220, 48 216, 54 232 C 56 246, 56 256, 56 262'],
  ['M22 236 C 44 238, 54 226, 62 200', 'M22 236 C 36 220, 50 212, 58 206 C 60 204, 61 202, 62 200'],
  ['M22 236 C 40 238, 52 236, 64 232', 'M22 236 C 34 222, 48 216, 58 224 C 62 228, 63 230, 64 232'],
  ['M22 236 C 40 240, 50 256, 58 278', 'M22 236 C 36 222, 48 220, 54 240 C 57 256, 58 268, 58 278'],
  ['M22 236 C 40 242, 52 262, 60 280', 'M22 236 C 36 222, 48 222, 54 244 C 58 262, 59 272, 60 280'],
  ['M22 236 C 40 240, 48 256, 56 268', 'M22 236 C 36 222, 48 220, 54 240 C 56 254, 56 262, 56 268'],
  ['M22 283 C 60 283, 76 262, 82 215', 'M22 283 C 40 266, 68 250, 82 215']
];
let ANGLE_EFF='straight';
function tilt(d){ if(ANGLE_EFF!=='up45') return d; for(const [a,b] of TILT_PATHS){ if(d.startsWith(a)) return b + d.slice(a.length); } return d; }

/* a drawn element that stands for a switch: hover lights the switch card, click flips it */
let hotKey = null;
function cardOf(key){ const seg=document.querySelector('[data-key="'+key+'"]'); return seg && seg.closest ? seg.closest('.sw') : null; }
function linkToSwitch(g, key, flip){
  g.classList.add('hit');
  g.addEventListener('mouseenter',()=>{ hotKey=key; const c=cardOf(key); if(c) c.classList.add('sw--hot'); });
  g.addEventListener('mouseleave',()=>{ hotKey=null; const c=cardOf(key); if(c) c.classList.remove('sw--hot'); });
  g.addEventListener('click',()=>{ flip(); render(); });
}

const STALL_PATHS = {
  'off|above|straight': [
    {d:'M60 154 C 48 156, 36 158, 22 160 L11 161 L11 291 L-2 291', color:'hot', dur:16, n:2, size:2.6},
    {d:'M398 262 C 380 268, 340 276, 300 280', color:'fresh', dur:14, n:2, size:2.4}
  ],
  'off|middle|straight': [
    {d:'M60 230 C 48 232, 36 234, 22 236 L11 237 L11 291 L-2 291', color:'hot', dur:16, n:2, size:2.6},
    {d:'M398 262 C 380 268, 340 276, 300 280', color:'fresh', dur:14, n:2, size:2.4}
  ]
};

function render(){
  const none = state.vent==='none'; state.none = none;
  if(state.duct==='inletduct' && state.inlet==='bottom') state.duct='straight';   // a floor hole has no duct to drop
  const induct = !none && state.duct==='inletduct';
  const half = !none && state.duct==='half';
  const key = none ? 'none' : [state.fan,state.inlet,(state.duct==='riser'||half)?'riser':'straight'].join('|');
  const base=AIR[key];
  const dryOpen = !none && state.dry==='open';
  let o = dryOpen ? Object.assign({}, base, DRY[key]||{}) : base;
  const flipped = !none && state.exhaust==='upper' && key==='off|middle|straight' && !induct;
  const stall = induct && IDUCT[key] && IDUCT[key].stall;
  if(stall) o = Object.assign({}, o, {paths:STALL_PATHS[key], pathsOpen:null, stagnant:'M105 24 h291 v250 h-291z', revIn:false, stall:true});
  if(flipped){ const r=AIR[key.replace('straight','riser')]; o=Object.assign({}, o, {paths:r.paths, pathsOpen:r.pathsOpen, stagnant:r.stagnant, revIn:false}); }
  const withDuct = !none && (state.duct==='riser' || half);
  if(state.inlet==='bottom' || induct) state.angle='straight';   // a floor hole has no angle, and a duct has none
  const angleEff = state.angle; ANGLE_EFF = angleEff;
  drawHeater();
  const dyn=document.getElementById('dyn'); dyn.innerHTML='';
  const glow=document.getElementById('glow'); glow.innerHTML=''; glow.appendChild(el('path',{d:'M52 200 C 40 140, 60 60, 100 40 L 130 30 C 100 90, 110 140, 94 200 Z',class:'heatglow'}));
  // stagnant air: grey balls circling slowly inside the zone, instead of a grey wash
  const zone = o.stagnant && o.stagnant.match(/M(\d+) (\d+) h(\d+) v(\d+)/);
  if(zone){
    const [zx,zy,zw,zh]=zone.slice(1).map(Number);
    const n=Math.max(3, Math.min(12, Math.round(zw*zh/5500)));
    let seed=zx*7+zy*13+zw; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    for(let i=0;i<n;i++){
      const r=8+rnd()*7, cx=zx+r+rnd()*(zw-2*r), cy=zy+r+rnd()*(zh-2*r), dur=9+rnd()*7;
      const d=`M${(cx+r).toFixed(1)} ${cy.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx-r).toFixed(1)} ${cy.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx+r).toFixed(1)} ${cy.toFixed(1)}`;
      const b=particle(d,'var(--stale)',dur,rnd()*dur,2.7); b.setAttribute('opacity','0.7'); dyn.appendChild(b);
    }
  }
  const legStale=document.getElementById('legStale'); if(legStale) legStale.hidden=!zone;
  const viaDuct = d => { if(!induct) return d; const y=({above:160, middle:236, below:283})[state.inlet]; return d.replace(/^M22 (\d+) /, (m,yy)=>'M-2 291 L11 291 L11 '+yy+' L22 '+yy+' ').replace(/, 22 16[02]$/, m=>m+' L11 161 L11 291 L-2 291'); };
  ((state.heater==='open' && o.pathsOpen) ? o.pathsOpen : o.paths).forEach(p=>addParticles(dyn,Object.assign({},p,{d:viaDuct(tilt(p.d))}),withDuct));
  if(dryOpen) ((state.fan==='on' ? DRY_PATHS.on : ({above:DRY_PATHS.offAbove, middle:DRY_PATHS.offMiddle, below:DRY_PATHS.offBelow, bottom:DRY_PATHS.offBottom})[state.inlet]) || []).forEach(p=>addParticles(dyn,Object.assign({},p,{d:tilt(p.d)}),false));
  if(o.revIn){ // hot air leaking out of the high inlet, down the slope if the hole is tilted
    const leak = state.inlet==='middle' ? (angleEff==='up45' ? 'M58 220 C 46 222, 34 228, 22 236' : 'M60 230 C 48 232, 36 234, 22 236') : (angleEff==='up45' ? 'M58 144 C 46 146, 34 152, 22 160' : 'M60 154 C 48 156, 36 158, 22 160');
    for(let k=0;k<3;k++) dyn.appendChild(particle(induct ? leak+' L11 161 L11 291 L-2 291' : leak,'var(--hot)',induct?4:2.4,0.8*k,2.6));
  }

  // duct
  const dg=document.getElementById('duct'); dg.innerHTML='';
  if(none){
    // solid wall, nothing to draw
  } else if(induct){
    const yIn=({above:160, middle:236, below:283})[state.inlet];
    dg.appendChild(el('path',{d:'M13 '+(yIn-7)+' H4 V284 H-2 M18 '+(yIn+7)+' V298 H-2',class:'duct'}));
    const t=el('text',{x:15,y:278,class:'lbl',transform:'rotate(-90 15 278)'}); t.textContent='INLET PIPE · OUTSIDE'; dg.appendChild(t);
  } else if(withDuct){
    const top = half ? HALF_TOP : 4;
    dg.appendChild(el('path',{d:'M400 '+top+' V'+(outPos().y+12)+' H416 V'+top,class:'duct'}));
    const t=el('text',{x:418,y:top+10,class:'lbl',transform:'rotate(90 418 '+(top+10)+')'}); t.textContent= half ? 'EXHAUST PIPE · OUTSIDE · OUTLET AT 1.2 m' : 'EXHAUST PIPE · OUTSIDE · OUTLET ABOVE THE INLET'; dg.appendChild(t);
  }

  // vents
  const vents=document.getElementById('vents'); vents.innerHTML='';
  if(none){
    const t=el('text',{x:392,y:290,class:'lbl lblBad','text-anchor':'end'}); t.textContent='NO INLET · NO EXHAUST · DOOR GAPS ONLY'; vents.appendChild(t);
  }
  const inPos = ({above:IN_ABOVE, middle:IN_MIDDLE, below:IN_BELOW, bottom:IN_BOTTOM})[state.inlet];
  let inLabel, outLabel, inCls='vent', outCls='vent';
  if(o.idle){ inLabel={t:'IN · NO FLOW',c:''}; outLabel={t:'OUT · NO FLOW',c:''}; inCls=outCls='ventIdle'; }
  else if(o.stall){ inLabel={t:'IN · STALLED, A WARM PLUG|SITS IN THE PIPE',c:'lblBad'}; outLabel={t:'OUT · A TRICKLE',c:'lblBad'}; }
  else if(o.revIn){ inLabel={t:'IN · NOW LEAKS HOT AIR OUT',c:'lblBad'}; outLabel={t:'OUT · NOW LETS COLD AIR IN',c:'lblBad'}; }
  else { inLabel={t: ({above:'IN · 20 cm ABOVE THE STONES', middle: state.heater==='open' ? 'IN · 45 cm, INTO THE STONES' : 'IN · 45 cm, AT THE CASING', below:'IN · 10 cm, BY THE HEATER', bottom:'IN · FLOOR, UNDER THE HEATER'})[state.inlet], c:'lblIn'}; outLabel={t: state.fan==='on' ? 'OUT · FAN' : 'OUT · BUOYANCY', c:'lblOut'}; }
  if(!none){
  const lblAt = ({above:{}, middle:{x:100,y:233}, below:{x:100,y:280}, bottom:{x:100,y:283}, none:{}})[state.inlet];
  if(o.leakIn) vents.appendChild(ventEl(LEAK_IN.x,LEAK_IN.y,{t:'DOOR GAP|AIR LEAKS IN',c:'lblIn',x:384,y:277},'vent',false));
  if(o.leakOut) vents.appendChild(ventEl(LEAK_OUT.x,LEAK_OUT.y,{t:'LEAKS OUT|DOOR TOP, CRACKS',c:'lblOut'},'vent',false));
  if(state.inlet!=='none'){
  if(state.inlet!=='above' && inLabel.t.indexOf('|')<0) inLabel = Object.assign({}, inLabel, {t: inLabel.t.replace(', ','|').replace(' · NOW','|NOW')});
  if(state.inlet==='bottom') vents.appendChild(ventEl(inPos.x,inPos.y,Object.assign({},lblAt,inLabel),inCls,true,false,-90));
  else vents.appendChild(ventEl(inPos.x,inPos.y,Object.assign({},lblAt,inLabel),inCls,true, angleEff==='up45'));
  }
  if(state.exhaust!=='none'){
  const op=outPos();
  vents.appendChild(ventEl(op.x,op.y,outLabel,outCls,false));
  if(state.fan==='on') vents.appendChild(fanEl(op.x,op.y,true));
  }
  }
  if(!none){
    const dry=ventEl(398,36, dryOpen ? {t: 'DRYING VENT|HOT AIR OUT', c:'lblBad'} : {t:'DRYING VENT',c:''}, dryOpen?'vent':'ventIdle', false);
    linkToSwitch(dry, 'dry', ()=>{ state.dry = state.dry==='open' ? 'closed' : 'open'; });
    vents.appendChild(dry);
  }

  // the sensor has one correct place: high on the wall above the heater, clear of every inlet
  const sg=document.getElementById('sensorg'); sg.innerHTML='';
  const sgrp=el('g',{class:'sensorHit'});
  const hit=el('rect',{x:SENSOR.x-7,y:SENSOR.y-7,width:14,height:14}); hit.setAttribute('fill','transparent'); sgrp.appendChild(hit);
  sgrp.appendChild(el('path',{d:`M${SENSOR.x-4} ${SENSOR.y-4} L${SENSOR.x+4} ${SENSOR.y+4} M${SENSOR.x+4} ${SENSOR.y-4} L${SENSOR.x-4} ${SENSOR.y+4}`,class:'sensor'}));
  const st=el('text',{x:SENSOR.x+9,y:SENSOR.y+3,class:'lbl lblHalo'}); st.textContent='TEMPERATURE SENSOR'; sgrp.appendChild(st);
  sg.appendChild(sgrp);
  const tipText='The temperature sensor goes on the wall directly above the heater, about 10 cm below the ceiling, where it reads the heat rising off the stones.';
  const showTip=()=>{ const t=document.getElementById('tip'), room=t&&t.parentNode; if(!t||!room||!sgrp.getBoundingClientRect) return; const r=sgrp.getBoundingClientRect(), c=room.getBoundingClientRect(); t.textContent=tipText; t.style.left=Math.max(8,r.left-c.left)+'px'; t.style.top=(r.bottom-c.top+8)+'px'; t.classList.add('on'); };
  const hideTip=()=>{ const t=document.getElementById('tip'); if(t) t.classList.remove('on'); };
  sgrp.addEventListener('mouseenter',showTip); sgrp.addEventListener('mouseleave',hideTip);
  sgrp.addEventListener('click',()=>{ const t=document.getElementById('tip'); if(t&&t.classList.contains('on')) hideTip(); else showTip(); });

  // verdict
  const label={best:'Best choice',ok:'Acceptable',bad:'Avoid'}[o.grade];
  document.getElementById('verdict').innerHTML=`
    <h2>${o.title}</h2>
    <p>${o.summary}</p>
    ${dryOpen && o.note ? `<p><b>With the drying vent open:</b> ${o.note}</p>` : ''}
    ${(!none && state.angle==='up45' && TILT[key] && TILT[key].note) ? `<p><b>With the inlet tilted 45° up:</b> ${TILT[key].note}</p>` : ''}
    ${(!none && state.heater==='open' && HEATER[key] && HEATER[key].note) ? `<p><b>With an open heater:</b> ${HEATER[key].note}</p>` : ''}
    ${(!none && state.heater==='wall' && WALL[key] && WALL[key].note) ? `<p><b>With a wall heater:</b> ${WALL[key].note}</p>` : ''}
    ${(!none && state.exhaust==='upper' && EXH[key] && EXH[key].note && !comboOf(key,'upper',induct) && !stall) ? `<p><b>With the exhaust under the upper bench:</b> ${EXH[key].note}</p>` : ''}
    ${(induct && (comboOf(key,state.exhaust,true) || IDUCT[key])) ? `<p><b>With an inlet duct:</b> ${(comboOf(key,state.exhaust,true) || IDUCT[key]).note}</p>` : ''}
    ${(half && HALF[key]) ? `<p><b>With the exhaust pipe to 1.2 m:</b> ${HALF[key].note}</p>` : ''}
    <div class="pros-cons">
      <div class="col good"><h3>Good</h3><ul>${o.good.map(x=>`<li>${x}</li>`).join('')}</ul></div>
      <div class="col bad"><h3>Bad</h3><ul>${o.bad.map(x=>`<li>${x}</li>`).join('')}</ul></div>
    </div>
    <div class="says">${o.says}</div>`;

  document.querySelectorAll('.seg').forEach(seg=>{
    const k=seg.dataset.key; const air = k!=='vent' && k!=='heater';   // with no ventilation only the heater keeps a selection
    seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', (!(none&&air) && b.dataset.v===state[k]) ? 'true':'false'));
  });
  document.querySelectorAll('.sw:not(.sw--score)').forEach(c=>{ const seg=c.querySelector('.seg'); c.classList.toggle('sw--off', none && !(seg && (seg.dataset.key==='vent' || seg.dataset.key==='heater'))); });
  document.querySelectorAll('.sw--hot').forEach(c=>c.classList.remove('sw--hot'));
  if(hotKey){ const c=cardOf(hotKey); if(c) c.classList.add('sw--hot'); }
  const sNow = score(key, angleEff, state.heater, state.exhaust, induct, half), card=document.getElementById('scoreCard');
  if(card){ const g=scoreGrade(sNow); card.dataset.g = g; document.getElementById('scoreNum').textContent = sNow; document.getElementById('scoreWord').textContent = {good:'Best choice',warn:'Acceptable',bad:'Avoid'}[g]; }
  const dimSeg=(k,off)=>{ const seg=document.querySelector('[data-key="'+k+'"]'); if(!seg) return; if(seg.closest('.sw')) seg.closest('.sw').classList.toggle('sw--off', none || off); seg.querySelectorAll('button').forEach(b=>{ b.disabled = off; }); };
  dimSeg('angle', state.inlet==='bottom' || induct);
  document.querySelectorAll('[data-key="duct"] button[data-v="inletduct"]').forEach(b=>{ b.disabled = state.inlet==='bottom'; });
  if(rankList.dataset.variant!==state.angle+state.heater+state.exhaust){ buildRank(); rankList.dataset.variant=state.angle+state.heater+state.exhaust; }
  document.querySelectorAll('.rk').forEach(b=>b.setAttribute('aria-pressed', (b.dataset.none ? none : (!none && b.dataset.fan===state.fan && b.dataset.inlet===state.inlet && b.dataset.duct===state.duct)) ? 'true':'false'));
  applyPause();
  labState = none ? 'none' : key.replace(/\|/g,'-')+(state.dry==='open'?'-open':'')+(state.angle==='up45'?'-up45':'')+(state.heater==='open'?'-pillar':state.heater==='wall'?'-wall':'')+(state.exhaust==='upper'?'-upper':'')+(induct?'-induct':'')+(half?'-half':'');
  if(tab==='ventilation') writeHash();
  applyUnits();
}
function applyPause(){
  const svg=document.getElementById('svg');
  if(paused||reduce) svg.pauseAnimations(); else svg.unpauseAnimations();
  document.getElementById('toggle').textContent = (paused||reduce)?'Play':'Pause';
}
document.querySelectorAll('.seg').forEach(seg=>{
  seg.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(seg.dataset.key!=='vent' && seg.dataset.key!=='heater') state.vent='yes'; state[seg.dataset.key]=b.dataset.v; render(); });
});
document.getElementById('toggle').addEventListener('click',()=>{paused=!paused; applyPause();});
const rankList=document.getElementById('rank');
function buildRank(){
rankList.innerHTML='';
const ranked = RANK.map(r=>{ const k = r[1]==='none' ? 'none' : [r[1],r[2],r[3]].join('|'); return {r, k, s:score(k, state.angle, state.heater, state.exhaust)}; });
ranked.sort((a,b)=>b.s-a.s || RANK.indexOf(a.r)-RANK.indexOf(b.r));
ranked.forEach(({r:[L,fan,inlet,duct,text,word],k,s},i)=>{
  const isNone = fan==='none';
  const g = scoreGrade(s);
  const li=document.createElement('li');
  li.innerHTML='<button type="button" class="rk '+g+(isNone?' rk--base':'')+'"'+(isNone?' data-none="1"':' data-fan="'+fan+'" data-inlet="'+inlet+'" data-duct="'+duct+'"')+'>'
    +'<span class="rk-l">'+(i+1)+'.</span><span class="rk-t">'+text+'</span><span class="rk-g '+g+'">'+word+'</span>'
    +'<span class="rk-s">'+s+'</span><span class="rk-bar"><i style="width:'+s+'%"></i></span></button>'
    +'<span class="rk-gm" title="'+(isNone?'No ventilation':fan==='on'?'Mechanical: an exhaust fan moves the air':'Gravity: buoyancy alone moves the air')+'">'+(isNone?'':fan==='on'?'M':'G')+'</span>';
  rankList.appendChild(li);
});
}
rankList.addEventListener('click',e=>{ const b=e.target.closest('.rk'); if(!b) return; if(b.dataset.none){ state.vent='none'; } else { state.vent='yes'; state.fan=b.dataset.fan; state.inlet=b.dataset.inlet; state.duct=b.dataset.duct; } render(); });
if(reduce) paused=true;
document.getElementById('units').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; units=b.dataset.u; try{ localStorage.setItem('units',units); }catch(e){} applyUnits(); });

/* ---------- the address: #tab or #tab.state ---------- */
const TABS = ['construction','heater','ventilation'];
let tab = 'construction', labState = '', ruleId = '';
function writeHash(){
  const st = tab==='ventilation' ? labState : ruleId;
  try{ history.replaceState(null,'', '#'+tab+(st?'.'+st:'')); }catch(e){}
}
function applyLabState(st){
  const m = st.split('-');
  if(m[0]==='none'){ state.vent='none'; return; }
  if(m.length>=3 && AIR[[m[0],m[1],m[2]].join('|')]){
    state.vent='yes'; state.fan=m[0]; state.inlet=m[1]; state.duct=m[2];
    state.dry = m.slice(3).includes('open') ? 'open' : 'closed';
    state.angle = m.includes('up45') ? 'up45' : 'straight';
    state.heater = m.includes('pillar') ? 'open' : m.includes('wall') ? 'wall' : 'closed';
    state.exhaust = m.includes('upper') ? 'upper' : 'lower';
    if(m.includes('induct')) state.duct='inletduct'; else if(m.includes('half')) state.duct='half';
  }
}
function showTab(t, st){
  tab = TABS.includes(t) ? t : 'ventilation';
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected', b.dataset.tab===tab ? 'true':'false'));
  document.querySelectorAll('.tab').forEach(s=>{ s.hidden = s.id!=='tab-'+tab; });
  if(tab==='ventilation'){ if(st) applyLabState(st); render(); }
  else { ruleId = (st && document.querySelector('#tab-'+tab+' #rule-'+st)) ? st : ''; writeHash(); if(ruleId) document.getElementById('rule-'+ruleId).scrollIntoView({block:'start'}); }
}
function readHash(){
  const raw = location.hash.replace('#',''); const dot = raw.indexOf('.');
  return { t: dot<0 ? raw : raw.slice(0,dot), st: dot<0 ? '' : raw.slice(dot+1) };
}
document.getElementById('tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b){ ruleId=''; showTab(b.dataset.tab); } });
window.addEventListener('hashchange',()=>{ const {t,st}=readHash(); if(t!==tab || st!==(tab==='ventilation'?labState:ruleId)) showTab(t,st); });
document.querySelectorAll('.tab').forEach(p=>p.addEventListener('click',e=>{ const li=e.target.closest('li[id^="rule-"]'); if(!li) return; ruleId=li.id.slice(5); writeHash(); }));
(function(){ const {t,st}=readHash(); showTab(t||'ventilation', st); })();

/* ---------- the footer wordmark: the site's flow, loaded when the footer comes near ---------- */
(function(){
  const wm = document.querySelector('[data-lava-flow]'); if(!wm) return;
  const load = () => { const s=document.createElement('script'); s.src='assets/lava-flow.js'; document.body.appendChild(s); };
  if(!('IntersectionObserver' in window)){ load(); return; }
  const io = new IntersectionObserver(es => { if(es.some(e=>e.isIntersecting)){ io.disconnect(); load(); } }, { rootMargin:'800px' });
  io.observe(wm);
})();
