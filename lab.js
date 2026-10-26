/* Saunas 101 · the ventilation lab: states, the scores and the air from scores.js (the model), drawing, switches, layouts. Needs site.js first (units) and scores.js. */
/* ---------- the score ----------
   Every state's score comes from model/ (airflow, breathing, the temperature profile), computed by build.js into scores.js: SCORES by address, BEST_STATE the model's top layout. */
const ROCK_FILLS=['#6a6a6a','#595959','#4e4e4e','#444444','#5f5f5f','#3c3c3c'];
function rock(cx,cy,R,rnd){
  const k=5+Math.floor(rnd()*3), sx=1+rnd()*0.35, rot=rnd()*Math.PI, pts=[];
  for(let i=0;i<k;i++){ const a=rot+i*2*Math.PI/k+(rnd()-0.5)*0.5, r=R*(0.72+rnd()*0.5); pts.push((cx+Math.cos(a)*r*sx).toFixed(1)+','+(cy+Math.sin(a)*r).toFixed(1)); }
  const p=el('polygon',{points:pts.join(' '),class:'rock'}); p.setAttribute('fill',ROCK_FILLS[Math.floor(rnd()*ROCK_FILLS.length)]); return p;
}
/* the heater's plume: straight up over the stones (the model's plume has no tilt), widening a little from the stones (x 52-94 at
   y 200) to a flat top under the ceiling (x 46-100 at y 10), strongest on the stones and fading up (#heatFade). Its edges ripple
   with a wave that climbs the column, still at the stones and 6 units at most near the top, the two edges out of phase (8 frames
   over 4.5 s, the last equal to the first); it breathes from 100 to 70 % over 6.3 s and a light haze bends it by up to 2 units
   (#heatHaze). Slower and fainter than the air, so the dots stay the thing to watch. */
let HEAT_D=null;
function heatFrames(){
  const r1=v=>Math.round(v*10)/10, N=7, TOP=10, AMP=6, FRAMES=8, out=[];
  const chain=pts=>{ let d=''; for(let i=0;i<pts.length-1;i++){ const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
    d+=' C '+r1(p1[0]+(p2[0]-p0[0])/6)+' '+r1(p1[1]+(p2[1]-p0[1])/6)+', '+r1(p2[0]-(p3[0]-p1[0])/6)+' '+r1(p2[1]-(p3[1]-p1[1])/6)+', '+r1(p2[0])+' '+r1(p2[1]); } return d; };
  for(let f=0;f<=FRAMES;f++){
    const tau=f/FRAMES, L=[], R=[];
    for(let i=0;i<=N;i++){ const h=i/N, y=200+(TOP-200)*h, a=i===0?0:AMP*(0.15+h), w=2*Math.PI*(1.4*h-tau);
      L.push([52-6*h+a*Math.sin(w), y]); R.push([94+6*h+a*Math.sin(w+1.9), y]); }
    out.push('M'+r1(L[0][0])+' '+r1(L[0][1])+chain(L)+' L'+r1(R[N][0])+' '+r1(R[N][1])+chain(R.slice().reverse())+' Z');
  }
  return out;
}
function heatColumn(){
  if(!HEAT_D) HEAT_D=heatFrames();
  const g=el('g',{});
  g.appendChild(el('animate',{attributeName:'opacity',dur:'6.3s',repeatCount:'indefinite',calcMode:'spline',keyTimes:'0;.5;1',keySplines:'.45 0 .55 1;.45 0 .55 1',values:'1;.7;1'}));
  const p=el('path',{d:HEAT_D[0],class:'heatglow',fill:'url(#heatFade)',filter:'url(#heatHaze)'});
  p.appendChild(el('animate',{attributeName:'d',dur:'4.5s',repeatCount:'indefinite',values:HEAT_D.join(';')}));
  g.appendChild(p); return g;
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
const scoreGrade = s => s>=70?'good':s>=35?'warn':'bad';

/* ---------- the layouts, ranked ---------- */
/* the 4 layouts the page names: every switch fixed, so each score is a constant of the model */
const PRESETS = [
  {name:'No ventilation',         vent:'none', heater:'open'},
  {name:'Gravity ventilation',    vent:'yes', fan:'off', inlet:'below', duct:'straight', exhaust:'upper', heater:'open', angle:'straight', dry:'closed'},
  {name:'Mechanical ventilation', vent:'yes', fan:'on',  inlet:'above', duct:'straight', exhaust:'lower', heater:'open', angle:'straight', dry:'closed'},
  Object.assign({name:'Absolute best'}, BEST_STATE)
];
const PRESET_KEYS = ['fan','inlet','duct','exhaust','heater','angle','dry'];

/* ---------- state ---------- */
const state = { vent:'yes', fan:'on', inlet:'above', angle:'straight', heater:'open', exhaust:'lower', duct:'straight', dry:'closed', none:false };
/* the address: 7 words in switch order (inlet, exhaust, fan, duct, heater, inlet angle, drying vent), the switches' own words; no ventilation is no-<heater> */
const HASH_WORD = { inlet:{above:'above', middle:'middle', below:'low', bottom:'floor'}, fan:{on:'exhaust', off:'none'}, duct:{straight:'none', riser:'long', half:'short', inletduct:'inlet'}, angle:{straight:'straight', up45:'45'} };
const HASH_KEY = {}; for(const k in HASH_WORD){ HASH_KEY[k]={}; for(const v in HASH_WORD[k]) HASH_KEY[k][HASH_WORD[k][v]]=v; }
const hashOf = st => st.vent==='none' ? 'no-'+st.heater : [HASH_WORD.inlet[st.inlet], st.exhaust, HASH_WORD.fan[st.fan], HASH_WORD.duct[st.duct], st.heater, HASH_WORD.angle[st.angle], st.dry].join('-');
const HEATERS = ['open','closed','wall'];
let paused=false;
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const darkUI = document.documentElement.dataset.theme==='dark' || (document.documentElement.dataset.theme!=='light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
const FRESH_HEX = darkUI ? '#63B3D6' : '#378DE2', HOT_HEX = darkUI ? '#F09A52' : '#E8603A';

/* ---------- geometry ---------- */
const IN_ABOVE={x:22,y:160}, IN_MIDDLE={x:22,y:236}, IN_BELOW={x:22,y:283}, IN_BOTTOM={x:73,y:298}, OUT={x:398,y:270.4}, SENSOR={x:73,y:22};
const HALF_TOP = 132;   // 1.2 m
const OUT_HI={x:398,y:209.7}, LEAK_IN={x:398,y:290}, LEAK_OUT={x:398,y:60};
function outPos(){ return state.exhaust==='upper' ? OUT_HI : OUT; }
/* ---------- drawing helpers ---------- */
const ns='http://www.w3.org/2000/svg';
const el=(t,a={})=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);return e;};

(function(){
  const g=document.getElementById('planks');
  const bg=el('rect',{x:22,y:8,width:376,height:290}); bg.setAttribute('fill','var(--wood1)'); g.appendChild(bg);
  for(let m=0.2;m<2.1;m+=0.2){const y=298-m*138; g.appendChild(el('line',{x1:22,y1:y,x2:398,y2:y,class:'plank'}));}
})();

function particle(pathD,color,dur,offset,size,kp,km,lane){
  const c=el('circle',{r:size||3.2}); if(lane){ c.setAttribute('cx',lane.toFixed(1)); c.setAttribute('cy',(-0.8*lane).toFixed(1)); } c.setAttribute('fill',color); c.setAttribute('opacity','0.9');
  const m=el('animateMotion',{dur:dur+'s',repeatCount:'indefinite',begin:(-offset)+'s',path:pathD});
  if(kp){ m.setAttribute('calcMode','linear'); m.setAttribute('keyPoints',kp); m.setAttribute('keyTimes',km); }
  c.appendChild(m);
  return c;
}
/* ---------- the air the drawing shows ----------
   Every stream comes from the model (AIRS, written by build.js from model/): each opening's flow, where its outdoor air goes first (into the heater,
   along the floor, to the benches), the part that leaves without reaching the benches, the outlets, the heater's plume, and how stale the air is.
   One moving dot stands for Q_DOT l/s; the dots move faster when more air moves. */
const Q_DOT = 1.2, FLOOR_Y = 280, PLUME_TOP = 186, STILL = 0.15;   // the floor stretch runs 18 units (13 cm) above the floor line, clear of it
const fx = v => String(Math.round(v*10)/10);
function spline(P){   // a smooth path through the points: Catmull-Rom as cubic Béziers
  let d = 'M'+fx(P[0][0])+' '+fx(P[0][1]);
  for(let i=0;i<P.length-1;i++){
    const a=P[Math.max(0,i-1)], b=P[i], c=P[i+1], e=P[Math.min(P.length-1,i+2)];
    d += ' C '+fx(b[0]+(c[0]-a[0])/6)+' '+fx(b[1]+(c[1]-a[1])/6)+', '+fx(c[0]-(e[0]-b[0])/6)+' '+fx(c[1]-(e[1]-b[1])/6)+', '+fx(c[0])+' '+fx(c[1]);
  }
  return d;
}
function polyLen(P, upto){ let L=0; const n = upto==null ? P.length-1 : upto; for(let i=1;i<=n;i++) L+=Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]); return L; }
function inletY(){ return ({above:IN_ABOVE.y, middle:IN_MIDDLE.y, below:IN_BELOW.y, bottom:298})[state.inlet]; }
function ductTop(){ return state.duct==='half' ? HALF_TOP : -6; }
const RIGHT = {e:1, d:1, l:1, t:1};   // openings on the exhaust wall
/* from outside to the room side of an opening, for air coming in */
function entryPts(op){
  const y = inletY(), gy = outPos().y;
  if(op==='i'){
    if(state.inlet==='bottom') return [[73,316],[73,298]];
    const P = state.duct==='inletduct' ? [[-2,291],[11,291],[11,y],[22,y]] : [[6,y],[22,y]];
    if(state.angle==='up45' && state.duct!=='inletduct') P.push([40,y-16]);
    return P;
  }
  if(op==='e') return (state.duct==='riser'||state.duct==='half') ? [[408,ductTop()],[408,(ductTop()+gy)/2],[405,gy-12],[398,gy]] : [[414,gy],[398,gy]];
  if(op==='d') return [[414,22],[398,22]];
  if(op==='l') return [[414,291],[398,291]];
  return [[414,60],[398,60]];
}
/* from the room side of an opening to outside, for air going out */
function exitPts(op){ return entryPts(op).slice().reverse(); }
/* the last stretch to an outlet, from the bench zone */
function approachPts(op){
  const y = inletY(), gy = outPos().y;
  if(op==='e') return gy > 230 ? [[350,206],[372,248]] : [[350,150],[372,188]];
  if(op==='d') return [[338,50],[372,36]];
  if(op==='t') return [[340,76],[372,66]];
  if(op==='l') return [[352,258],[372,278]];
  return state.inlet==='bottom' ? [[112,262],[84,280]] : [[150,y-16],[48,y-6]];
}
/* along the floor into an outlet that drains it */
function floorOutPts(op, fromRight){
  const gy = outPos().y;
  if(fromRight){
    if(op==='e') return gy > 230 ? [[372,272]] : [[370,262],[372,226]];
    if(op==='l') return [[372,282]];
    return [[370,252],[372,130]];
  }
  if(op==='e') return gy > 230 ? [[330,FLOOR_Y],[370,272]] : [[330,FLOOR_Y],[366,262],[372,226]];
  if(op==='l') return [[350,FLOOR_Y],[372,282]];
  if(op==='i') return [[100,FLOOR_Y],[48,inletY()+2]];
  return [[336,FLOOR_Y],[368,250],[372,130]];
}
/* into the heater and up through it to the top of the stones */
function heaterPts(op, P0){
  const h = state.heater, floorIn = op==='i' && state.inlet==='bottom', right = !!RIGHT[op];
  if(op==='i' && state.inlet==='above') return [[48,166],[66,176],[80,166]];   // the jet drops into the plume above the stones
  if(h==='open'){
    if(floorIn) return [[73,290],[73,240],[73,200],[73,PLUME_TOP]];
    const yy = Math.max(204, Math.min(284, right ? 284 : P0[1]));
    return [[right?93:53, yy],[73, yy-14],[73,200],[73,PLUME_TOP]];
  }
  if(h==='closed') return floorIn ? [[73,294],[73,240],[73,200],[73,PLUME_TOP]] : [[right?90:56,294],[73,280],[73,230],[73,198],[73,PLUME_TOP]];
  return floorIn ? [[73,286],[73,262],[73,230],[73,198],[73,PLUME_TOP]] : [[right?86:60,264],[73,260],[73,230],[73,198],[73,PLUME_TOP]];   // wall heater, its intake 30 cm up
}
const PLUME_UP = [[76,150],[76,96],[78,44],[96,24],[200,28],[300,36]],   // straight up the heater's column (x 46-100) to just under the ceiling, then along it
      PLUME_DOWN = [[358,50],[378,96],[380,160]], BENCH = [312,118];
/* the floor stretch from where a stream comes in, and its rise into the room once the floor has warmed it */
function floorPts(op, P0){
  if(op==='d' || op==='t') return [[358,66],[340,170],[330,FLOOR_Y],[215,FLOOR_Y]];   // cold air from high up falls clear of the wall, then spreads
  if(RIGHT[op]) return [[366,FLOOR_Y],[300,FLOOR_Y],[215,FLOOR_Y]];
  if(op==='i' && state.inlet==='bottom') return [[100,FLOOR_Y],[160,FLOOR_Y]];
  return [[P0[0]+18,FLOOR_Y-2],[120,FLOOR_Y],[190,FLOOR_Y]];
}
const RISE = [[202,262],[214,214],[262,160]];
/* straight into the bench zone */
function benchPts(op){
  const y = inletY(), gy = outPos().y;
  if(op==='i'){
    if(state.inlet==='bottom') return [[100,282],[180,236],[250,170]];
    if(state.inlet==='above') return [[50,y+4],[68,y-8],[84,y-42],[100,y-76],[126,y-94],[190,y-98],[240,y-96],[282,y-94],[305,y-87],[324,y-68],[337,y-40],[342,y-6],[342,y+28]];   // the jet crosses the plume inside the column, which heats and lifts it (hot by its right edge, the 4th point), arcs across at head height, turns down on evenly spaced points of a quarter ellipse (60 across, 88 down), the same as the heater loop's corner, so it never rises before it falls, and drops steeply in front of the bather to the benches
    if(state.inlet==='below') return [[60,FLOOR_Y-2],[140,FLOOR_Y],[200,268],[215,215]];   // the warm floor lifts it
    return [[60,y-8],[150,y-40],[230,170]];
  }
  if(op==='l') return [[364,FLOOR_Y],[290,FLOOR_Y-3],[215,258],[225,205]];
  if(op==='t') return [[364,76],[340,96]];
  if(op==='d') return [[364,42],[345,64]];
  return [[362,gy+4],[340,gy-30]];   // the grille running backwards
}
/* how many dots a flow gets, shared among outlets by their flow (largest remainder) */
function share(f, outs){
  const n = f >= 0.3 ? Math.max(1, Math.round(f/Q_DOT)) : 0, tot = outs.reduce((a,o)=>a+o[1],0);
  if(!n || !tot) return [];
  const raw = outs.map(o=>[o[0], n*o[1]/tot]); const res = raw.map(([op,x])=>[op, Math.floor(x), x-Math.floor(x)]);
  let left = n - res.reduce((a,r)=>a+r[1],0); res.slice().sort((a,b)=>b[2]-a[2]).forEach(r=>{ if(left>0){ r[1]++; left--; } });
  return res.filter(r=>r[1]>0).map(r=>[r[0], r[1]]);
}
/* a stream: its points, how many dots, and where its air warms (kt) or that it stays cold or hot */
/* a stream of dots along the points P at speed v (units a second); warm: 'cold', 'hot' or the two point indices between which it
   turns from fresh to hot; inCol: the two point indices where it runs inside the heater's column. Long, nearly level stretches meander
   a little (WAVE_AMP units across, a wave every WAVE_LEN units), as room air does; BAND spreads a stream's dots across a narrow band
   (lane spacing in units) instead of single file. */
/* speeds (138 units a metre): room air moves at ROOM of the airflow-scaled speed, so the fan layout crosses the room at about 0.36 m/s
   and gravity at about 0.19 m/s; inside the column FAST brings it to about 1.2 m/s (the plume) and through the openings OPEN to
   about 1 m/s (the jets). The speed changes smoothly (stretches in units): after an inlet it falls to the room's over JET_OUT, as the
   jet spreads; it rises into the column over COL_IN and falls back over COL_OUT, as the plume mixes with the room; toward an outlet
   it rises only over the last SINK_IN, as air drawn into an opening does. ROOM_R is the room's right wall. */
const ROOM = 0.65, FAST = 3.4, WAVE_AMP = 1.4, WAVE_LEN = 70, OPEN = 2.8, BAND = 1.1;
const JET_OUT = 34, COL_IN = 14, COL_OUT = 48, SINK_IN = 28;
const ROOM_R = 398;
function wavy(P){
  if(!(WAVE_AMP > 0)) return { P, map: P.map((p, i) => i) };
  const out = [P[0]], map = [0];
  for(let i = 1; i < P.length; i++){
    const a = P[i-1], b = P[i], dx = b[0]-a[0], dy = b[1]-a[1], L = Math.hypot(dx, dy);
    if(L > 50 && Math.abs(dy) < 0.4*Math.abs(dx)){
      const k = Math.max(2, Math.round(2*L/WAVE_LEN)), nx = -dy/L, ny = dx/L;
      for(let j = 1; j < k; j++){ const t = j/k, w = (j%2 ? 1 : -1)*WAVE_AMP; out.push([a[0]+dx*t+nx*w, a[1]+dy*t+ny*w]); }
    }
    out.push(b); map.push(out.length-1);
  }
  return { P: out, map };
}
function stream(P0, n, v, warm, inCol){
  const W = wavy(P0), P = W.P, ix = i => W.map[i];
  const L = polyLen(P), s = {d: spline(P), n, dur: Math.max(2.5, L/v), size: 3};
  const len = i => polyLen(P, i), frac = i => len(i)/L;
  const inside = p => p[0] > 30 && p[0] < ROOM_R - 8 && p[1] > 16 && p[1] < 290;
  const ease = t => 0.5 - 0.5*Math.cos(Math.PI*Math.max(0, Math.min(1, t)));   /* 0 → 1, smooth at both ends */
  /* the openings: the path's wall points (the last point outside before the room, the first one outside after it) */
  const i0 = P.findIndex(inside), i1 = P.length-1-P.slice().reverse().findIndex(inside);
  const wallIn = OPEN > 1 && i0 > 0 ? len(i0-1) : null, wallOut = OPEN > 1 && i0 >= 0 && i1 < P.length-1 ? len(i1+1) : null;
  const ca = inCol && FAST > 1 ? len(ix(inCol[0])) : null, cb = inCol && FAST > 1 ? len(ix(inCol[1])) : null;
  const loop = Math.hypot(P[0][0]-P[P.length-1][0], P[0][1]-P[P.length-1][1]) < 1;
  /* a jet that reaches the column before it has slowed goes straight from the jet's speed to the plume's */
  const bridge = wallIn != null && ca != null && ca > wallIn && ca - wallIn < JET_OUT + COL_IN;
  const speed = x => {
    if(bridge && x >= wallIn && x <= ca) return OPEN + (FAST-OPEN)*ease((x-wallIn)/(ca-wallIn));
    let m = 1;
    if(wallIn != null) m = Math.max(m, x <= wallIn ? OPEN : 1 + (OPEN-1)*(1 - ease((x-wallIn)/JET_OUT)));
    if(wallOut != null) m = Math.max(m, x >= wallOut ? OPEN : 1 + (OPEN-1)*Math.pow(Math.max(0, 1 - (wallOut-x)/SINK_IN), 2));
    if(ca != null){
      let c = x < ca ? 1 + (FAST-1)*ease(1 - (ca-x)/COL_IN) : x <= cb ? FAST : 1 + (FAST-1)*(1 - ease((x-cb)/COL_OUT));
      if(loop && ca < 1e-6) c = Math.max(c, 1 + (FAST-1)*ease(1 - (L-x)/COL_IN));   /* a closed loop eases back into the column at its end */
      m = Math.max(m, c);
    }
    return m;
  };
  /* where the speed can change: the ramps get a point every 5 units, the rest only its ends */
  const xs = new Set([0, L]), addRamp = (x0, x1) => { const a = Math.max(0, Math.min(x0, x1)), b = Math.min(L, Math.max(x0, x1)); for(let x = a; x < b; x += 5) xs.add(x); xs.add(b); };
  if(wallIn != null){ xs.add(wallIn); if(!bridge) addRamp(wallIn, wallIn + JET_OUT); }
  if(wallOut != null){ xs.add(wallOut); addRamp(wallOut - SINK_IN, wallOut); }
  if(ca != null){ addRamp(ca - COL_IN, ca); xs.add(cb); addRamp(cb, cb + COL_OUT); if(loop && ca < 1e-6) addRamp(L - COL_IN, L); }
  const X0 = [...xs].filter(x => x >= 0 && x <= L).sort((p, q) => p - q), X = X0.filter((x, i) => i === 0 || i === X0.length-1 || (x - X0[i-1] > 2.5 && X0[X0.length-1] - x > 2.5));   /* no stretch shorter than 2.5 units */
  let at = u => u;
  if(X.length > 2 && (wallIn != null || wallOut != null || ca != null)){
    /* time per stretch: ∫ dx / speed, by Simpson's rule */
    const T = [0];
    for(let i = 1; i < X.length; i++){ const a = X[i-1], b = X[i], h = b - a; T.push(T[i-1] + h/6*(1/speed(a) + 4/speed((a+b)/2) + 1/speed(b))); }
    const total = T[T.length-1];
    at = u => { const x = u*L; let i = 1; while(i < X.length-1 && X[i] < x) i++; const t = T[i-1] + (T[i]-T[i-1])*(x-X[i-1])/Math.max(1e-9, X[i]-X[i-1]); return Math.min(1, t/total); };
    s.dur = Math.max(2.5, total/v);
    s.kp = X.map(x => (x/L).toFixed(4)).join(';'); s.km = T.map(t => (t/total).toFixed(4)).join(';');
  }
  if(warm==='cold') s.color='fresh'; else if(warm==='hot') s.color='hot';
  else { const a = Math.min(0.9, Math.max(0.01, frac(ix(warm[0])))), b = Math.min(0.99, Math.max(a+0.03, frac(ix(warm[1])))); s.kt = '0;'+at(a).toFixed(3)+';'+at(b).toFixed(3)+';1'; }
  return s;
}
function airStreams(A){
  const qIn = A.s.reduce((a,s)=>a+s[1],0), v = (30 + 50*Math.min(1, qIn/20))*ROOM, out = [];
  /* the door's gaps are in the model and the score but not in the drawing: their streams are left out, and what leaves through them is drawn leaving through the designed outlets */
  const DOOR = {l:1, t:1};
  const outs = A.o.filter(o=>!DOOR[o[0]]).map(o=>[o[0], o[1], o[2]]);
  if(!outs.length) return [heaterLoop(A)];
  const ceilOuts = outs.filter(o=>o[2]==='c'), downOuts = outs.filter(o=>o[2]!=='c');
  const toOutlet = (P, op) => P.concat(op==='d'||op==='t' ? [] : PLUME_DOWN.filter(()=>false), approachPts(op), exitPts(op));
  for(const [op, q, toHeater, toFloor, short, shortToModel, toBenches, heaterShort] of A.s){
    if(DOOR[op]) continue;
    const shortTo = DOOR[shortToModel] ? ((outs.find(o=>o[2]!=='c') || outs[0])[0]) : shortToModel;
    const E = entryPts(op), P0 = E[E.length-1];
    /* into the heater, up the plume, then down through the benches to an outlet (or straight out at the ceiling) */
    /* from the exhaust wall the air crosses the floor to the heater; from high up it first falls clear of the wall */
    const pre = (op==='d' || op==='t') ? [[358,66],[340,170],[330,FLOOR_Y],[250,FLOOR_Y],[130,FLOOR_Y]] : RIGHT[op] ? [[366,FLOOR_Y],[250,FLOOR_Y],[130,FLOOR_Y]] : [];
    const viaHeater = E.concat(pre, heaterPts(op, P0));
    const iIn = E.length + pre.length, iTop = viaHeater.length-1;
    for(const [dst, n] of share(toHeater-heaterShort, downOuts.length ? downOuts : outs)){
      const P = viaHeater.concat(PLUME_UP, (dst==='d'||dst==='t') ? [] : PLUME_DOWN, approachPts(dst), exitPts(dst));
      out.push(stream(P, n, v, [iIn, iTop], [iTop, iTop+4]));
    }
    for(const [dst, n] of share(heaterShort, ceilOuts.length ? ceilOuts : outs)){
      const P = viaHeater.concat(PLUME_UP, approachPts(dst), exitPts(dst));
      out.push(stream(P, n, v, [iIn, iTop], [iTop, iTop+4]));
    }
    /* along the floor: the part the outlets drain before it reaches the benches stays cold all the way out */
    const F = E.concat(floorPts(op, P0));
    if(short >= 0.3 && shortTo){ const P = E.concat((op==='d' || op==='t') ? [[358,66],[340,170],[340,FLOOR_Y]] : RIGHT[op] ? [[366,FLOOR_Y]] : floorPts(op, P0).slice(0,2), floorOutPts(shortTo, !!RIGHT[op]), exitPts(shortTo)); out.push(stream(P, Math.max(1, Math.round(short/Q_DOT)), v*0.8, 'cold')); }
    for(const [dst, n] of share(toFloor-short, downOuts.length ? downOuts : outs)){
      const P = F.concat(RISE, [BENCH], approachPts(dst), exitPts(dst));
      out.push(stream(P, n, v*0.8, [F.length-1, F.length+RISE.length]));
    }
    /* straight to the benches, warming as it mixes */
    /* the jet from above the stones is heated in the column, not along the way, and drops steeply on its own line, so it skips the
       bench point and any approach point not below where it ends */
    const crosses = op==='i' && state.inlet==='above';
    const B = E.concat(benchPts(op), crosses ? [] : [BENCH]);
    for(const [dst, n] of share(toBenches, downOuts.length ? downOuts : outs)){
      const P = B.concat(crosses ? approachPts(dst).filter(p => p[1] > B[B.length-1][1] + 10 && p[0] >= B[B.length-1][0]) : approachPts(dst), exitPts(dst));
      out.push(stream(P, n, v, crosses ? [E.length, E.length+3] : [E.length-1, B.length-1], crosses ? [E.length, E.length+3] : null));
    }
  }
  out.push(heaterLoop(A));
  return out;
}
/* the heater's own loop: up the plume, across the ceiling, down past the benches and back along the floor */
function heaterLoop(A){
  const loop = [[73,PLUME_TOP],[74,120],[76,52],[94,26],[200,30],[322,38],[345,45],[364,64],[377,92],[382,126],[382,160],[370,204],[340,234],[260,252],[160,262],[110,254],[100,226],[88,200],[73,PLUME_TOP]];
  return Object.assign(stream(loop, Math.max(2, Math.min(6, Math.round(A.p/25))), 70*ROOM, 'hot', [0, 3]), {size: 2.8});
}
function drawStream(g, s){
  for(let k=0;k<s.n;k++){
    const off=(s.dur/s.n)*k, lane=BAND ? ((k*3)%5-2)*BAND : 0;
    if(s.kt){ const a=particle(s.d,FRESH_HEX,s.dur,off,s.size,s.kp,s.km,lane); a.appendChild(el('animate',{attributeName:'fill',values:FRESH_HEX+';'+FRESH_HEX+';'+HOT_HEX+';'+HOT_HEX,keyTimes:s.kt,dur:s.dur+'s',repeatCount:'indefinite',begin:(-off)+'s'})); g.appendChild(a); }
    else g.appendChild(particle(s.d,'var(--'+s.color+')',s.dur,off,s.size,s.kp,s.km,lane));
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

/* a drawn element that stands for a switch: hover lights the switch card, click flips it */
let hotKey = null;
function cardOf(key){ const seg=document.querySelector('[data-key="'+key+'"]'); return seg && seg.closest ? seg.closest('.sw') : null; }
function cycle(key){ const seg=document.querySelector('.seg[data-key="'+key+'"]'); if(!seg) return; const bs=[...seg.querySelectorAll('button')]; const i=bs.findIndex(b=>b.dataset.v===state[key]); let nb=null; for(let s=1;s<=bs.length;s++){ const c=bs[(i+s)%bs.length]; if(!c.disabled){ nb=c; break; } } if(!nb) return; if(key!=='vent' && key!=='heater') state.vent='yes'; state[key]=nb.dataset.v; }
/* after every draw, each live element gets a transparent rect over its box, 6 units of padding, at least 24 square, so hovering the area counts, not only the lines */
function fitHits(){
  document.querySelectorAll('#svg .hit').forEach(g=>{
    g.querySelectorAll(':scope > rect.hitbox').forEach(r=>r.remove());
    const texts=[...g.querySelectorAll('text')]; texts.forEach(t=>{ t.style.display='none'; });   // the frame fits the drawn thing, not its words
    let b; try{ b=g.getBBox(); }catch(e){ b=null; }
    texts.forEach(t=>{ t.style.display=''; });
    if(!b) return;
    if(!b || (b.width===0 && b.height===0)) return;
    const pad=6, w=Math.max(b.width+2*pad, 24), h=Math.max(b.height+2*pad, 24);
    // the frame stays 2 units inside the drawing's top and sides; the bottom is open so the floor inlet's frame is whole (the svg overflows visibly)
    const own=g.hasAttribute('transform');   // a group drawn in its own coordinates (the fan) keeps its full frame
    const x0=own?b.x+b.width/2-w/2:Math.max(b.x+b.width/2-w/2, -12), y0=own?b.y+b.height/2-h/2:Math.max(b.y+b.height/2-h/2, -10), x1=own?b.x+b.width/2+w/2:Math.min(b.x+b.width/2+w/2, 432), y1=b.y+b.height/2+h/2;   // the bottom is free: the floor inlet's frame may run below the picture, over the legend
    g.appendChild(el('rect',{class:'hitbox', x:x0, y:y0, width:x1-x0, height:y1-y0, rx:3, fill:'none', 'pointer-events':'all'}));
  });
}
/* below 1200 px a change from a switch, a layout or the drawing brings the score and the animation fully into view:
   up when they sit under the tabs, down when they run past the bottom of the screen; nothing moves when they are already whole */
const NARROW = window.matchMedia('(max-width:1199px)');
function showDrawing(){
  if(!NARROW.matches) return;
  const top=document.querySelector('.lab-top'), tabs=document.querySelector('.tabs'); if(!top) return;
  const r=top.getBoundingClientRect(), lo=(tabs ? tabs.getBoundingClientRect().bottom : 0) + 12, hi=window.innerHeight - 8;
  let dy=0;
  if(r.top < lo - 1) dy = r.top - lo;
  else if(r.bottom > hi + 1) dy = Math.min(r.bottom - hi, r.top - lo);
  if(Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function linkToSwitch(g, key, flip){
  g.classList.add('hit'); g.dataset.sw=key;
  g.addEventListener('mouseenter',()=>{ hotKey=key; const c=cardOf(key); if(c) c.classList.add('sw--hot'); });
  g.addEventListener('mouseleave',()=>{ hotKey=null; const c=cardOf(key); if(c) c.classList.remove('sw--hot'); });
  g.addEventListener('click',()=>{ flip(); render(); showDrawing(); });
}

function render(){
  const none = state.vent==='none'; state.none = none;
  if(state.duct==='inletduct' && state.inlet==='bottom') state.duct='straight';   // a floor hole has no duct to drop
  const induct = !none && state.duct==='inletduct';
  const half = !none && state.duct==='half';
  const dryOpen = !none && state.dry==='open';
  const withDuct = !none && (state.duct==='riser' || half);
  if(state.inlet==='bottom' || induct) state.angle='straight';   // a floor hole has no angle, and a duct has none
  const angleEff = state.angle;
  const A = AIRS[hashOf(state)];
  drawHeater();
  const dyn=document.getElementById('dyn'); dyn.innerHTML='';
  const glow=document.getElementById('glow'); glow.innerHTML=''; glow.appendChild(heatColumn());
  // CO₂: grey dots circling in the bench zone, as many as the model counts (one per 500 ppm at the mouth beyond the first 500; 20 in a sealed room)
  const nStale = A.st;
  if(nStale){
    const zx=105, zy=24, zw=291, zh=220;
    let seed=zx*7+zy*13+zw; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
    for(let i=0;i<nStale;i++){
      const r=8+rnd()*7, cx=zx+r+rnd()*(zw-2*r), cy=zy+r+rnd()*(zh-2*r), dur=9+rnd()*7;
      const d=`M${(cx+r).toFixed(1)} ${cy.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx-r).toFixed(1)} ${cy.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx+r).toFixed(1)} ${cy.toFixed(1)}`;
      const b=particle(d,'var(--stale)',dur,rnd()*dur,2.7); b.setAttribute('opacity','0.7'); dyn.appendChild(b);
    }
  }
  const streams=airStreams(A); streams.forEach(s=>drawStream(dyn, s));
  // the legend lists only the dots drawn; a stream that warms on its way shows both fresh and heated air
  const drawn = c => streams.some(s=>s.n>0 && (s.kt || s.color===c));
  const leg = {legFresh: drawn('fresh'), legHot: drawn('hot'), legStale: nStale>0};
  for(const id in leg){ const e=document.getElementById(id); if(e) e.hidden=!leg[id]; }

  // duct
  const dg=document.getElementById('duct'); dg.innerHTML='';
  if(none){
    // solid wall, nothing to draw
  } else if(induct){
    const yIn=({above:160, middle:236, below:283})[state.inlet];
    dg.appendChild(el('path',{d:'M13 '+(yIn-7)+' H4 V284 H-2 M18 '+(yIn+7)+' V298 H-2',class:'duct'}));
    const t=el('text',{x:15,y:278,class:'lbl',transform:'rotate(-90 15 278)'}); t.textContent='INLET DUCT'; dg.appendChild(t);
  } else if(withDuct){
    const top = half ? HALF_TOP : -10;
    dg.appendChild(el('path',{d:'M400 '+top+' V'+(outPos().y+12)+' H416 V'+top,class:'duct'}));
    const t=el('text',{x:418,y:top+10,class:'lbl',transform:'rotate(90 418 '+(top+10)+')'}); t.textContent='EXHAUST DUCT'; dg.appendChild(t);
  }

  // vents
  const vents=document.getElementById('vents'); vents.innerHTML='';
  if(none){
    const t=el('text',{x:392,y:290,class:'lbl lblBad','text-anchor':'end'}); t.textContent='NO INLET · NO EXHAUST · DOOR GAPS ONLY'; vents.appendChild(t);
  }
  const inPos = ({above:IN_ABOVE, middle:IN_MIDDLE, below:IN_BELOW, bottom:IN_BOTTOM})[state.inlet];
  const [qi, qe, qd, ql, qt] = A.q;
  let inLabel, outLabel, inCls='vent', outCls='vent';
  const inWhere = ({above:'IN · 20 cm ABOVE THE STONES', middle: state.heater==='open' ? 'IN · 45 cm, INTO THE STONES' : 'IN · 45 cm, AT THE CASING', below:'IN · 10 cm, BY THE HEATER', bottom:'IN · FLOOR, UNDER THE HEATER'})[state.inlet];
  if(Math.abs(qi) <= STILL) inLabel = induct ? {t:'IN · STALLED, A WARM PLUG|SITS IN THE DUCT', c:'lblBad'} : {t:'IN · ALMOST NO FLOW', c:'lblBad'};
  else if(qi < 0) inLabel = {t:'IN · NOW LEAKS HOT AIR OUT', c:'lblBad'};
  else inLabel = {t:inWhere, c:'lblIn'};
  if(Math.abs(qe) <= STILL) outLabel = {t:'OUT · ALMOST NO FLOW', c:'lblBad'};
  else if(qe > 0) outLabel = {t:'OUT · NOW LETS COLD AIR IN', c:'lblBad'};
  else outLabel = {t: state.fan==='on' ? 'OUT · FAN' : 'OUT · BUOYANCY', c:'lblOut'};
  if(!none){
  const lblAt = ({above:{}, middle:{x:100,y:233}, below:{x:100,y:280}, bottom:{x:100,y:283}, none:{}})[state.inlet];
  if(state.inlet!=='none'){
  if(state.inlet!=='above' && inLabel.t.indexOf('|')<0) inLabel = Object.assign({}, inLabel, {t: inLabel.t.replace(', ','|').replace(' · NOW','|NOW')});
  { const inG = state.inlet==='bottom' ? ventEl(inPos.x,inPos.y,Object.assign({},lblAt,inLabel),inCls,true,false,-90) : ventEl(inPos.x,inPos.y,Object.assign({},lblAt,inLabel),inCls,true, angleEff==='up45'); linkToSwitch(inG,'inlet',()=>cycle('inlet')); vents.appendChild(inG); }
  }
  if(state.exhaust!=='none'){
  const op=outPos();
  { const outG=ventEl(op.x,op.y,outLabel,outCls,false); linkToSwitch(outG,'exhaust',()=>cycle('exhaust')); vents.appendChild(outG); }
  if(state.fan==='on'){ const fG=fanEl(op.x,op.y,true); linkToSwitch(fG,'fan',()=>cycle('fan')); vents.appendChild(fG); }
  }
  }
  if(!none){
    const dry=ventEl(398,22, {t:'DRYING VENT',c:''}, dryOpen?'vent':'ventIdle', false);
    linkToSwitch(dry,'dry',()=>cycle('dry')); vents.appendChild(dry);
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

  document.querySelectorAll('.seg').forEach(seg=>{
    const k=seg.dataset.key; const air = k!=='vent' && k!=='heater';   // with no ventilation only the heater keeps a selection
    seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', (!(none&&air) && b.dataset.v===state[k]) ? 'true':'false'));
  });
  document.querySelectorAll('.sw:not(.sw--score)').forEach(c=>{ const seg=c.querySelector('.seg'); c.classList.toggle('sw--off', none && !(seg && (seg.dataset.key==='vent' || seg.dataset.key==='heater'))); });
  document.querySelectorAll('.sw--hot').forEach(c=>c.classList.remove('sw--hot'));
  if(hotKey){ const c=cardOf(hotKey); if(c) c.classList.add('sw--hot'); }
  fitHits();
  relight();
  const sNow = SCORES[hashOf(state)], card=document.getElementById('scoreCard');
  if(card){ const g=scoreGrade(sNow); card.dataset.g = g; document.getElementById('scoreNum').textContent = sNow; document.getElementById('scoreWord').textContent = {good:'Best choice',warn:'Acceptable',bad:'Avoid'}[g]; }
  const dimSeg=(k,off)=>{ const seg=document.querySelector('[data-key="'+k+'"]'); if(!seg) return; if(seg.closest('.sw')) seg.closest('.sw').classList.toggle('sw--off', none || off); seg.querySelectorAll('button').forEach(b=>{ b.disabled = off; }); };
  dimSeg('angle', state.inlet==='bottom' || induct);
  document.querySelectorAll('[data-key="duct"] button[data-v="inletduct"]').forEach(b=>{ b.disabled = state.inlet==='bottom'; });
  if(!rankList.dataset.built){ buildRank(); rankList.dataset.built='1'; }
  document.querySelectorAll('.rk').forEach(b=>{ const p=PRESETS[+b.dataset.i]; const on = p.vent==='none' ? none : (!none && PRESET_KEYS.every(f=>state[f]===p[f])); b.setAttribute('aria-pressed', on ? 'true':'false'); });
  applyPause();
  labState = hashOf(state);
  writeHash();
  applyUnits();
}
function applyPause(){
  const svg=document.getElementById('svg');
  if(paused||reduce) svg.pauseAnimations(); else svg.unpauseAnimations();
  const t=document.getElementById('toggle'), p=(paused||reduce); t.dataset.state = p?'paused':'playing'; t.setAttribute('aria-label', p?'Play':'Pause'); t.title = p?'Play':'Pause';
}
document.querySelectorAll('.seg').forEach(seg=>{
  seg.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(seg.dataset.key!=='vent' && seg.dataset.key!=='heater') state.vent='yes'; state[seg.dataset.key]=b.dataset.v; render(); showDrawing(); });
});
document.getElementById('toggle').addEventListener('click',()=>{paused=!paused; applyPause();});
linkToSwitch(document.getElementById('duct'),'duct',()=>cycle('duct'));
linkToSwitch(document.getElementById('heaterg'),'heater',()=>cycle('heater'));
/* a hovered switch row lights itself and its element; render() calls relight() so the light survives the redraw a click causes */
let litKey=null;
function relight(){ document.querySelectorAll('#svg .lit').forEach(g=>g.classList.remove('lit')); if(!litKey) return; document.querySelectorAll('#svg .hit[data-sw="'+litKey+'"]').forEach(g=>g.classList.add('lit')); const c=cardOf(litKey); if(c) c.classList.add('sw--hot'); }
document.querySelectorAll('.lab-card .sw').forEach(sw=>{ const seg=sw.querySelector('.seg'); if(!seg) return; const key=seg.dataset.key;
  sw.addEventListener('mouseenter',()=>{ litKey=key; relight(); });
  sw.addEventListener('mouseleave',()=>{ litKey=null; sw.classList.remove('sw--hot'); relight(); }); });
const rankList=document.getElementById('rank');
function buildRank(){
rankList.innerHTML='';
PRESETS.forEach((p,i)=>{
  const s = SCORES[hashOf(p)], g = scoreGrade(s);
  const li=document.createElement('li');
  li.innerHTML='<button type="button" class="rk '+g+'" data-i="'+i+'">'
    +'<span class="rk-t">'+p.name+'</span>'
    +'<span class="rk-s">'+s+'</span><span class="rk-bar"><i style="width:'+s+'%"></i></span></button>';
  rankList.appendChild(li);
});
}
rankList.addEventListener('click',e=>{ const b=e.target.closest('.rk'); if(!b) return; const p=PRESETS[+b.dataset.i]; if(!p) return; if(p.vent==='none'){ state.vent='none'; state.heater=p.heater; } else { state.vent='yes'; PRESET_KEYS.forEach(f=>{ state[f]=p[f]; }); } render(); showDrawing(); });
if(reduce) paused=true;


/* ---------- the address: #state names the layout on show ---------- */
let labState = '';
function writeHash(){ try{ history.replaceState(null,'', '#'+labState); }catch(e){} }
function applyLabState(st){
  const m = st.split('-');
  if(m[0]==='no'){ state.vent='none'; if(HEATERS.includes(m[1])) state.heater=m[1]; return; }
  if(m.length!==7) return;
  const inlet=HASH_KEY.inlet[m[0]], exhaust=(m[1]==='lower'||m[1]==='upper')?m[1]:null, fan=HASH_KEY.fan[m[2]], duct=HASH_KEY.duct[m[3]], heater=HEATERS.includes(m[4])?m[4]:null, angle=HASH_KEY.angle[m[5]], dry=(m[6]==='closed'||m[6]==='open')?m[6]:null;
  if(!inlet||!exhaust||!fan||!duct||!heater||!angle||!dry) return;
  Object.assign(state,{vent:'yes', inlet, exhaust, fan, duct, heater, angle, dry});
}
window.addEventListener('hashchange',()=>{ const st = location.hash.slice(1); if(st!==labState){ applyLabState(st); render(); } });
(function(){ const st = location.hash.slice(1); if(st) applyLabState(st); render(); })();
