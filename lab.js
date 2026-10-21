/* Saunas 101 · the ventilation lab: states, model, drawing, switches, ranked list. Needs site.js first (units). */
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
  'on|above|riser':    {f:1},
  'on|above|straight': {f:1},
  'on|below|riser':    {f:1},
  'on|below|straight': {f:1},
  'off|above|riser':   {f:1.07},
  'off|above|straight':{f:0.9},
  'off|below|riser':   {f:1.04},
  'off|below|straight':{f:1.35},
  'on|middle|riser':   {f:1.3},
  'on|middle|straight':{f:1.3},
  'off|middle|riser':  {f:1.04},
  'off|middle|straight':{f:0.5},
  'on|bottom|riser':   {f:1},
  'on|bottom|straight':{f:1},
  'off|bottom|riser':  {f:1},
  'off|bottom|straight':{f:1},
  'none':              {f:1}
};
const HEATER = {
  'on|above|riser':    {f:1},
  'on|above|straight': {f:1},
  'on|below|riser':    {f:0.8},
  'on|below|straight': {f:0.8},
  'off|above|riser':   {f:1},
  'off|above|straight':{f:1},
  'off|below|riser':   {f:0.9},
  'off|below|straight':{f:0.9},
  'on|middle|riser':   {f:1.875, feet:0.75},
  'on|middle|straight':{f:1.875, feet:0.75},
  'off|middle|riser':  {f:1.3,  feet:0.8},
  'off|middle|straight':{f:1},
  'on|bottom|riser':   {f:0.85, feet:0.85},
  'on|bottom|straight':{f:0.85, feet:0.85},
  'off|bottom|riser':  {f:0.85, feet:0.85},
  'off|bottom|straight':{f:0.85, feet:0.85},
  'none':              {f:1}
};
/* the exhaust under the upper bench, 75 cm up instead of 26: the fan or the stack draws from higher, the floor zone drops out */
const EXH = {
  'on|above|riser':    {f:1,   feet:0.75},
  'on|above|straight': {f:1,   feet:0.75},
  'on|below|riser':    {f:1.6, feet:0.5},
  'on|below|straight': {f:1.6, feet:0.5},
  'off|above|riser':   {f:1,   feet:0.75},
  'off|above|straight':{f:0.6, feet:0.3},
  'off|below|riser':   {f:1,   feet:0.6},
  'off|below|straight':{f:2,   feet:0.55},
  'on|middle|riser':   {f:1,   feet:0.5},
  'on|middle|straight':{f:1,   feet:0.5},
  'off|middle|riser':  {f:1,   feet:0.65},
  'off|middle|straight':{f:2.5, feet:0.55},
  'on|bottom|riser':   {f:1,   feet:0.8},
  'on|bottom|straight':{f:1,   feet:0.8},
  'off|bottom|riser':  {f:1,   feet:0.8},
  'off|bottom|straight':{f:1.6, feet:0.85},
  'in0|on|riser':      {f:2.5, feet:0.5},
  'in0|on|straight':   {f:2.5, feet:0.5},
  'in0|off|riser':     {f:1.2, feet:0.6},
  'in0|off|straight':  {f:2,   feet:0.6}
};
const WALL = {
  'on|below|riser':    {f:0.75, feet:0.25},
  'on|below|straight': {f:0.75, feet:0.25},
  'off|below|riser':   {f:0.85},
  'off|below|straight':{f:0.85},
  'on|bottom|riser':   {f:0.75, feet:0.8},
  'on|bottom|straight':{f:0.75, feet:0.8},
  'off|bottom|riser':  {f:0.75, feet:0.8},
  'off|bottom|straight':{f:0.75, feet:0.8},
};
const HTABLE = {open:HEATER, wall:WALL};
function hmod(k, heater){ const t=HTABLE[heater]; return (t && t[k]) ? t[k] : null; }
/* the inlet duct: a chimney is a column of warm air, and an inlet duct carries cold air. Run inside the room its air warms about halfway,
   worth half the duct's height; its mouth cannot go below the floor. Keyed on the no-exhaust-duct states. */
const IDUCT = {
  'on|above|straight':  {f:1},
  'on|middle|straight': {f:1},
  'on|below|straight':  {f:1},
  'off|above|straight': {f:0.4, feet:0.8, stall:true},
  'off|middle|straight':{f:0.5, feet:0.8, stall:true},
  'off|below|straight': {f:1}
};
const COMBO = {};
function comboOf(k, exhaust, induct){ return (induct && exhaust==='upper' && COMBO[k]) ? COMBO[k] : null; }
const BARE = 0.93;   // a bare exhaust duct outdoors: its air cools a few degrees on the way up, about 7 % less flow than an insulated one
/* the half duct: outlet at 1.2 m instead of 2 m. Chimney = duct top − inlet height; flow ∝ √height */
const HALF = {
  'off|above|riser':  {f:0.45},
  'off|middle|riser': {f:0.70},
  'off|below|riser':  {f:0.76},
  'off|bottom|riser': {f:0.77},
  'on|above|riser':   {f:1},
  'on|middle|riser':  {f:1},
  'on|below|riser':   {f:1},
  'on|bottom|riser':  {f:1}
};
function headOf(k, angle, heater, exhaust, induct, half){ const c=comboOf(k,exhaust,induct); if(c) return c.head; const m=hmod(k,heater); const bare = (k.startsWith('off|') && k.endsWith('|riser')) ? BARE : 1; return bare * MODEL[k].head * ((angle==='up45' && TILT[k]) ? TILT[k].f : 1) * (m ? m.f : 1) * ((exhaust==='upper' && EXH[k]) ? EXH[k].f : 1) * ((induct && IDUCT[k]) ? IDUCT[k].f : 1) * ((half && HALF[k]) ? HALF[k].f : 1); }
function feetOf(k, heater, exhaust, induct){
  const c=comboOf(k,exhaust,induct); if(c) return c.feet;
  const m=hmod(k,heater); let f = (m && m.feet!=null) ? m.feet : MODEL[k].feet;
  if(exhaust==='upper' && EXH[k] && EXH[k].feet!=null) f = Math.min(f, EXH[k].feet);
  if(induct && IDUCT[k] && IDUCT[k].feet!=null) f = Math.max(f, IDUCT[k].feet);
  return f;
}
/* the drying vent open while bathing: the hottest air leaves at the ceiling, so the feet term halves, and the head air is capped at the figure the vent's own verdict gives (or cut by a fifth where it gives none); it never raises a score */
const DRY_HEAD = 0.8, DRY_FEET = 0.5;
function runScore(k, angle, heater, exhaust, induct, half, dry){
  let head = headOf(k,angle,heater,exhaust,induct,half), feet = feetOf(k,heater,exhaust,induct);
  if(dry){ const d = DRY[k]; head = Math.min(head, (d && d.headN!=null) ? d.headN : head*DRY_HEAD); feet = feet*DRY_FEET; }
  return Math.min(head/NEED,1)*(0.5+0.5*feet);
}
function score(k, angle, heater, exhaust, induct, half, dry){ return Math.round(100*runScore(k, angle, heater, exhaust, induct, half, dry)); }
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
/* the 4 layouts the page names: every switch fixed, so each score is a constant of the model */
const PRESETS = [
  {name:'No ventilation',         vent:'none', heater:'open'},
  {name:'Gravity ventilation',    vent:'yes', fan:'off', inlet:'below', duct:'straight', exhaust:'upper', heater:'open', angle:'straight', dry:'closed'},
  {name:'Mechanical ventilation', vent:'yes', fan:'on',  inlet:'above', duct:'straight', exhaust:'lower', heater:'open', angle:'straight', dry:'closed'},
  {name:'Absolute best',          vent:'yes', fan:'on',  inlet:'above', duct:'riser',    exhaust:'lower', heater:'open', angle:'straight', dry:'closed'}
];
const PRESET_KEYS = ['fan','inlet','duct','exhaust','heater','angle','dry'];

/* ---------- state ---------- */
const state = { vent:'yes', fan:'on', inlet:'above', angle:'straight', heater:'open', exhaust:'lower', duct:'straight', dry:'closed', none:false };
/* the address: 7 words in switch order (inlet, exhaust, fan, duct, heater, inlet angle, drying vent), the switches' own words; no ventilation is no-<heater> */
const HASH_WORD = { inlet:{above:'above', middle:'middle', below:'low', bottom:'floor'}, fan:{on:'exhaust', off:'none'}, duct:{straight:'none', riser:'long', half:'short', inletduct:'inlet'}, angle:{straight:'straight', up45:'45'} };
const HASH_KEY = {}; for(const k in HASH_WORD){ HASH_KEY[k]={}; for(const v in HASH_WORD[k]) HASH_KEY[k][HASH_WORD[k][v]]=v; }
const HEATERS = ['open','closed','wall'];
let paused=false;
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const darkUI = document.documentElement.dataset.theme==='dark' || (document.documentElement.dataset.theme!=='light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
const FRESH_HEX = darkUI ? '#63B3D6' : '#378DE2', HOT_HEX = darkUI ? '#F09A52' : '#E8603A';

/* ---------- geometry ---------- */
const IN_ABOVE={x:22,y:160}, IN_MIDDLE={x:22,y:236}, IN_BELOW={x:22,y:283}, IN_BOTTOM={x:73,y:298}, OUT={x:398,y:262}, SENSOR={x:73,y:22};
const DUCT_UP=' C 404 260, 408 200, 408 150 C 408 100, 408 50, 408 -6';
const DUCT_UP_HI=' C 404 194, 408 150, 408 110 C 408 60, 408 30, 408 -6';
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
    grade:'bad',
    title:'Fan on, no inlet, exhaust ducted up',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:4, n:8}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'in0|on|straight': {
    grade:'bad',
    title:'Fan on, no inlet, exhaust straight through the wall',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:4, n:8}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'in0|off|riser': {
    grade:'bad',
    title:'Fan stopped, no inlet, exhaust ducted up',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:8, n:3, size:2.6}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'in0|off|straight': {
    grade:'bad',
    title:'Fan stopped, no inlet, exhaust straight through the wall',
    paths:[{d:'M398 290 C 380 294, 340 296, 300 294 C 320 280, 360 268, 398 262', color:'fresh', dur:12, n:2, size:2.4}],
    stagnant:'M105 24 h291 v220 h-291z', leakIn:true
  },
  'out0|above': {
    grade:'bad',
    title:'Inlet above the heater, no exhaust',
    paths:[
      {d:'M398 290 C 380 294, 330 292, 270 290 C 210 290, 150 290, 112 282 C 100 278, 98 262, 98 240 C 98 215, 96 200, 96 186 C 92 190, 68 166, 22 160', color:'gradient', dur:14, n:4, size:2.8},
      {d:'M80 190 C 74 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'hot', dur:12, n:3, size:2.6}
    ],
    stagnant:'M105 24 h291 v200 h-291z', revIn:true, leakOut:true, leakIn:true
  },
  'out0|middle': {
    grade:'bad',
    title:'Inlet at the heater\'s middle, no exhaust',
    paths:[{d:'M22 236 C 40 240, 50 256, 58 278 C 64 292, 70 296, 74 296 C 76 290, 74 240, 74 200 C 74 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'gradient', dur:14, n:4, size:2.8}],
    stagnant:'M200 60 h190 v150 h-190z', leakOut:true
  },
  'out0|below': {
    grade:'bad',
    title:'Inlet at the floor by the heater, no exhaust',
    paths:[{d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'gradient', dur:14, n:4, size:2.8}],
    stagnant:'M200 60 h190 v150 h-190z', leakOut:true
  },
  'out0|bottom': {
    grade:'bad',
    title:'Inlet in the floor under the heater, no exhaust',
    paths:[{d:'M73 312 L 73 200 C 74 150, 95 70, 160 48 C 240 32, 330 45, 398 60', color:'gradient', dur:13, n:5, size:2.8}],
    stagnant:'M200 60 h190 v150 h-190z', leakOut:true
  },
  'on|middle|riser': {
    grade:'ok',
    title:"Fan on, inlet at the heater's middle, exhaust ducted up",
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
    grade:'ok',
    title:"Fan on, inlet at the heater's middle, exhaust straight through the wall",
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
    grade:'ok',
    title:"Fan stopped, inlet at the heater's middle, exhaust ducted up",
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
    grade:'bad',
    title:"Fan stopped, inlet at the heater's middle, exhaust straight through the wall",
    paths:[
      {d:'M398 262 C 380 272, 330 290, 270 290 C 210 291, 150 291, 112 286 C 100 282, 96 270, 96 258 C 94 248, 80 240, 22 236', color:'gradient', kt:'0;0.5;0.68;1', dur:12, n:6, size:2.8}
    ],
    stagnant:'M105 24 h291 v200 h-291z', revIn:true
  },
  'on|bottom|riser': {
    grade:'ok',
    title:"Fan on, inlet in the floor under the heater, exhaust ducted up",
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
    grade:'ok',
    title:"Fan on, inlet in the floor under the heater, exhaust straight through the wall",
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
    grade:'ok',
    title:"Fan stopped, inlet in the floor under the heater, exhaust ducted up",
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
    grade:'ok',
    title:"Fan stopped, inlet in the floor under the heater, exhaust straight through the wall",
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
    grade:'bad',
    title:'No ventilation: no inlet, no exhaust',
    ach:'0.3 / h, door gaps', achG:'bad', head:'about 0.2 / h', headG:'bad', feet:'warm', feetG:'good',
    paths:[
      {d:'M80 212 C 70 150, 90 70, 150 48 C 240 30, 340 34, 382 60 C 396 120, 396 220, 380 270 C 330 292, 200 294, 110 290 C 80 288, 72 250, 80 212 Z', color:'hot', dur:12, n:10, size:3},
      {d:'M250 70 C 300 60, 340 90, 320 120 C 300 150, 230 140, 220 110 C 212 90, 230 76, 250 70 Z', color:'stale', dur:14, n:5, size:2.6, noguide:true},
      {d:'M200 160 C 240 150, 300 170, 290 200 C 280 230, 210 230, 200 200 C 194 180, 190 166, 200 160 Z', color:'stale', dur:16, n:4, size:2.4, noguide:true}
    ],
    stagnant:'M105 24 h291 v160 h-291z'
  },
  'on|above|riser': {
    grade:'best',
    title:'Fan on, inlet above the heater, exhaust ducted up',
    ach:'6 / h', achG:'good', head:'6 / h', headG:'good', feet:'warm', feetG:'good', co2:980, co28:2250, co2note:'steady state',
    paths:[
      {d:'M22 160 C 46 163, 60 172, 70 182 C 78 150, 88 110, 120 70 C 170 40, 260 40, 320 70 C 360 95, 350 150, 330 180 C 315 205, 320 240, 398 262', color:'gradient', dur:6, n:10, duct:true},
      {d:'M22 160 C 50 165, 66 176, 74 186 C 90 130, 110 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', dur:6.8, n:8, duct:true}
    ]
  },
  'on|above|straight': {
    grade:'best',
    title:'Fan on, inlet above the heater, exhaust straight through the wall',
    ach:'6 / h', achG:'good', head:'6 / h', headG:'good', feet:'warm', feetG:'good', co2:980, co28:2250, co2note:'steady state',
    paths:[
      {d:'M22 160 C 46 163, 60 172, 70 182 C 78 150, 88 110, 120 70 C 170 40, 260 40, 320 70 C 360 95, 350 150, 330 180 C 315 205, 320 240, 398 262', color:'gradient', dur:6, n:10},
      {d:'M22 160 C 50 165, 66 176, 74 186 C 90 130, 110 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', dur:6.8, n:8}
    ]
  },
  'on|below|riser': {
    grade:'bad',
    title:'Fan on, inlet below the heater',
    ach:'6 / h', achG:'warn', head:'about 2 / h, a third of the fan', headG:'bad', feet:'cold layer', feetG:'bad', co2:2300, co28:5500, co2note:'at head height, steady',
    paths:[
      {d:'M22 283 C 80 288, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:5, n:9, duct:true},
      {d:'M22 280 C 60 284, 110 290, 200 290 C 300 290, 360 272, 398 260', color:'fresh', dur:5.6, n:7, duct:true},
      {d:'M76 190 C 72 150, 84 90, 130 52 C 200 30, 310 40, 350 76 C 330 104, 262 112, 226 92 C 240 72, 290 60, 330 68', color:'hot', dur:7, n:7, noguide:true}
    ],
    stagnant:'M200 60 h190 v140 h-190z'
  },
  'on|below|straight': {
    grade:'bad',
    title:'Fan on, inlet below the heater',
    ach:'6 / h', achG:'warn', head:'about 2 / h, a third of the fan', headG:'bad', feet:'cold layer', feetG:'bad', co2:2300, co28:5500, co2note:'at head height, steady',
    paths:[
      {d:'M22 283 C 80 288, 180 292, 280 288 C 340 284, 376 266, 398 262', color:'fresh', dur:5, n:9},
      {d:'M22 280 C 60 284, 110 290, 200 290 C 300 290, 360 272, 398 260', color:'fresh', dur:5.6, n:7},
      {d:'M76 190 C 72 150, 84 90, 130 52 C 200 30, 310 40, 350 76 C 330 104, 262 112, 226 92 C 240 72, 290 60, 330 68', color:'hot', dur:7, n:7, noguide:true}
    ],
    stagnant:'M200 60 h190 v140 h-190z'
  },
  'off|above|riser': {
    grade:'ok',
    title:'Fan stopped, inlet above the heater, exhaust ducted up',
    ach:'2 to 3 / h', achG:'warn', head:'2 to 3 / h', headG:'warn', feet:'warm', feetG:'good', co2:1750, co28:4100, co2note:'steady state at 2.5 / h',
    paths:[
      {d:'M22 160 C 46 163, 60 172, 70 182 C 78 150, 88 110, 120 70 C 170 40, 260 40, 320 70 C 360 95, 350 150, 330 180 C 315 205, 320 240, 398 262', color:'gradient', dur:10, n:6, duct:true},
      {d:'M22 160 C 50 165, 66 176, 74 186 C 90 130, 110 80, 170 55 C 240 35, 300 60, 300 110 C 300 150, 280 190, 280 225 C 280 245, 330 252, 398 262', color:'gradient', dur:11, n:5, duct:true}
    ]
  },
  'off|above|straight': {
    grade:'bad',
    title:'Fan stopped, inlet above the heater, exhaust straight through the wall',
    ach:'1 to 2 / h, backwards', achG:'bad', head:'under 1 / h', headG:'bad', feet:'cold draught', feetG:'bad', co2:1900, co28:4800, co2note:'after 20 minutes, still climbing',
    paths:[
      {d:'M398 262 C 380 264, 330 288, 270 289 C 210 290, 150 290, 112 282 C 100 278, 98 262, 98 240 C 98 215, 96 200, 96 186 C 92 190, 68 166, 22 160', color:'gradient', kt:'0;0.5;0.68;1', dur:9, n:9, size:3},
      {d:'M398 258 C 370 262, 300 282, 230 284 C 170 286, 130 280, 108 270 C 100 262, 102 236, 104 214 C 104 220, 90 180, 22 162', color:'gradient', kt:'0;0.5;0.68;1', dur:10, n:6, size:2.8, noguide:true}
    ],
    stagnant:'M105 24 h291 v160 h-291z', revIn:true
  },
  'off|below|riser': {
    grade:'ok',
    title:'Fan stopped, inlet below the heater, exhaust ducted up',
    ach:'2 to 3 / h', achG:'warn', head:'1 to 2 / h', headG:'warn', feet:'cold at the heater', feetG:'bad', co2:1750, co28:4100, co2note:'steady state at 2.5 / h',
    paths:[
      {d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 340 50, 372 100 C 385 140, 380 200, 398 262', color:'gradient', dur:9, n:7, duct:true},
      {d:'M22 283 C 60 283, 76 262, 82 215 C 95 140, 120 60, 200 50 C 270 45, 330 90, 340 135 C 345 170, 360 215, 398 262', color:'gradient', dur:9.8, n:6, duct:true}
    ],
    stagnant:'M240 100 h60 v50 h-60z'
  },
  'off|below|straight': {
    grade:'ok',
    title:'Fan stopped, inlet at the floor by the heater, exhaust straight through the wall',
    ach:'about 1 / h', achG:'bad', head:'about 1 / h', headG:'bad', feet:'cold at the floor', feetG:'bad', co2:1900, co28:4800, co2note:'after 20 minutes, still climbing',
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
  'off|middle|riser':  {grade:'ok'},
  'off|middle|straight':{grade:'ok'},
  'off|bottom|riser':  {grade:'ok'},
  'off|bottom|straight':{grade:'ok'},
  'on|above|riser':   {grade:'ok', headN:4, head:'about 4 / h', headG:'warn'},
  'on|above|straight':{grade:'ok', headN:4, head:'about 4 / h', headG:'warn'},
  'on|below|riser':   {note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong; the floor short circuit continues underneath either way.'},
  'on|below|straight':{note:'The open vent exhales the hottest air at the ceiling, or sucks cool air onto the top bench if the fan is strong; the floor short circuit continues underneath either way.'},
  'off|above|riser':  {grade:'bad', ach:'2 to 3 / h', achG:'warn', headN:1.5, head:'1 to 2 / h', headG:'warn', feet:'cool draught', feetG:'bad', co2:1750, co28:4100},
  'off|above|straight':{ach:'2 to 3 / h, backwards'},
  'off|below|riser':  {grade:'ok', ach:'2 to 4 / h', achG:'warn', headN:2.5, head:'2 to 3 / h', headG:'warn', feet:'coldest of all', feetG:'bad', co2:1500, co28:3500},
  'off|below|straight':{grade:'ok', ach:'2 to 4 / h', achG:'warn', headN:2.5, head:'2 to 3 / h', headG:'warn', feet:'coldest of all', feetG:'bad', co2:1500, co28:3500}
};
const DRY_PATHS = {
  offMiddle: [{d:'M22 236 C 40 240, 50 256, 58 278 C 64 292, 70 296, 74 296 C 76 290, 74 240, 74 200 C 74 150, 95 70, 160 48 C 240 32, 330 24, 398 22', color:'gradient', kt:'0;0.2;0.32;1', dur:8, n:7, size:3, noguide:true}],
  offBottom: [{d:'M73 312 L 73 200 C 74 150, 95 70, 160 48 C 240 32, 330 24, 398 22', color:'gradient', kt:'0;0.12;0.28;1', dur:8, n:7, size:3, noguide:true}],
  on:  [{d:'M110 60 C 200 34, 310 24, 398 22', color:'hot', dur:5, n:5, size:2.8, noguide:true}],
  offAbove: [{d:'M60 60 C 180 34, 300 24, 398 22', color:'hot', dur:5, n:5, size:2.8, noguide:true},
             {d:'M398 262 C 370 266, 300 280, 230 284', color:'fresh', dur:5, n:4, size:2.6, noguide:true}],
  offBelow: [{d:'M22 283 C 60 282, 74 262, 80 215 C 92 150, 95 70, 160 48 C 240 32, 330 24, 398 22', color:'gradient', dur:8, n:7, size:3, noguide:true}]
};

/* ---------- the drying vent left open while bathing ---------- */

/* ---------- drawing helpers ---------- */
const ns='http://www.w3.org/2000/svg';
const el=(t,a={})=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);return e;};

(function(){
  const g=document.getElementById('planks');
  const bg=el('rect',{x:22,y:8,width:376,height:290}); bg.setAttribute('fill','var(--wood1)'); g.appendChild(bg);
  for(let m=0.2;m<2.1;m+=0.2){const y=298-m*138; g.appendChild(el('line',{x1:22,y1:y,x2:398,y2:y,class:'plank'}));}
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
function cycle(key){ const seg=document.querySelector('.seg[data-key="'+key+'"]'); if(!seg) return; const bs=[...seg.querySelectorAll('button')]; const i=bs.findIndex(b=>b.dataset.v===state[key]); const nb=bs[(i+1)%bs.length]; if(key!=='vent' && key!=='heater') state.vent='yes'; state[key]=nb.dataset.v; }
/* after every draw, each live element gets a transparent rect over its box, 6 units of padding, at least 24 square, so hovering the area counts, not only the lines */
function fitHits(){
  document.querySelectorAll('#svg .hit').forEach(g=>{
    g.querySelectorAll(':scope > rect.hitbox').forEach(r=>r.remove());
    let b; try{ b=g.getBBox(); }catch(e){ return; }
    if(!b || (b.width===0 && b.height===0)) return;
    const pad=6, w=Math.max(b.width+2*pad, 24), h=Math.max(b.height+2*pad, 24);
    g.appendChild(el('rect',{class:'hitbox', x:b.x+b.width/2-w/2, y:b.y+b.height/2-h/2, width:w, height:h, fill:'none', 'pointer-events':'all'}));
  });
}
function linkToSwitch(g, key, flip){
  g.classList.add('hit'); g.dataset.sw=key;
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
  const glow=document.getElementById('glow'); glow.innerHTML=''; glow.appendChild(el('path',{d:'M52 200 C 40 140, 60 48, 100 26 L 130 16 C 100 80, 110 140, 94 200 Z',class:'heatglow'}));
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
  let inLabel, outLabel, inCls='vent', outCls='vent';
  if(o.idle){ inLabel={t:'IN · NO FLOW',c:''}; outLabel={t:'OUT · NO FLOW',c:''}; inCls=outCls='ventIdle'; }
  else if(o.stall){ inLabel={t:'IN · STALLED, A WARM PLUG|SITS IN THE DUCT',c:'lblBad'}; outLabel={t:'OUT · A TRICKLE',c:'lblBad'}; }
  else if(o.revIn){ inLabel={t:'IN · NOW LEAKS HOT AIR OUT',c:'lblBad'}; outLabel={t:'OUT · NOW LETS COLD AIR IN',c:'lblBad'}; }
  else { inLabel={t: ({above:'IN · 20 cm ABOVE THE STONES', middle: state.heater==='open' ? 'IN · 45 cm, INTO THE STONES' : 'IN · 45 cm, AT THE CASING', below:'IN · 10 cm, BY THE HEATER', bottom:'IN · FLOOR, UNDER THE HEATER'})[state.inlet], c:'lblIn'}; outLabel={t: state.fan==='on' ? 'OUT · FAN' : 'OUT · BUOYANCY', c:'lblOut'}; }
  if(!none){
  const lblAt = ({above:{}, middle:{x:100,y:233}, below:{x:100,y:280}, bottom:{x:100,y:283}, none:{}})[state.inlet];
  if(o.leakIn) vents.appendChild(ventEl(LEAK_IN.x,LEAK_IN.y,{t:'DOOR GAP|AIR LEAKS IN',c:'lblIn',x:384,y:277},'vent',false));
  if(o.leakOut) vents.appendChild(ventEl(LEAK_OUT.x,LEAK_OUT.y,{t:'LEAKS OUT|DOOR TOP, CRACKS',c:'lblOut'},'vent',false));
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
    const dry=ventEl(398,22, dryOpen ? {t: 'DRYING VENT|HOT AIR OUT', c:'lblBad'} : {t:'DRYING VENT',c:''}, dryOpen?'vent':'ventIdle', false);
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
  const sNow = score(key, angleEff, state.heater, state.exhaust, induct, half, dryOpen), card=document.getElementById('scoreCard');
  if(card){ const g=scoreGrade(sNow); card.dataset.g = g; document.getElementById('scoreNum').textContent = sNow; document.getElementById('scoreWord').textContent = {good:'Best choice',warn:'Acceptable',bad:'Avoid'}[g]; }
  const dimSeg=(k,off)=>{ const seg=document.querySelector('[data-key="'+k+'"]'); if(!seg) return; if(seg.closest('.sw')) seg.closest('.sw').classList.toggle('sw--off', none || off); seg.querySelectorAll('button').forEach(b=>{ b.disabled = off; }); };
  dimSeg('angle', state.inlet==='bottom' || induct);
  document.querySelectorAll('[data-key="duct"] button[data-v="inletduct"]').forEach(b=>{ b.disabled = state.inlet==='bottom'; });
  if(!rankList.dataset.built){ buildRank(); rankList.dataset.built='1'; }
  document.querySelectorAll('.rk').forEach(b=>{ const p=PRESETS[+b.dataset.i]; const on = p.vent==='none' ? none : (!none && PRESET_KEYS.every(f=>state[f]===p[f])); b.setAttribute('aria-pressed', on ? 'true':'false'); });
  applyPause();
  labState = none ? 'no-'+state.heater : [HASH_WORD.inlet[state.inlet], state.exhaust, HASH_WORD.fan[state.fan], HASH_WORD.duct[state.duct], state.heater, HASH_WORD.angle[state.angle], state.dry].join('-');
  writeHash();
  applyUnits();
}
function applyPause(){
  const svg=document.getElementById('svg');
  if(paused||reduce) svg.pauseAnimations(); else svg.unpauseAnimations();
  const t=document.getElementById('toggle'), p=(paused||reduce); t.dataset.state = p?'paused':'playing'; t.setAttribute('aria-label', p?'Play':'Pause'); t.title = p?'Play':'Pause';
}
document.querySelectorAll('.seg').forEach(seg=>{
  seg.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(seg.dataset.key!=='vent' && seg.dataset.key!=='heater') state.vent='yes'; state[seg.dataset.key]=b.dataset.v; render(); });
});
document.getElementById('toggle').addEventListener('click',()=>{paused=!paused; applyPause();});
linkToSwitch(document.getElementById('duct'),'duct',()=>cycle('duct'));
linkToSwitch(document.getElementById('heaterg'),'heater',()=>cycle('heater'));
document.querySelectorAll('.lab-card .sw').forEach(sw=>{ const seg=sw.querySelector('.seg'); if(!seg) return; const key=seg.dataset.key;
  sw.addEventListener('mouseenter',()=>document.querySelectorAll('#svg .hit[data-sw="'+key+'"]').forEach(g=>g.classList.add('lit')));
  sw.addEventListener('mouseleave',()=>document.querySelectorAll('#svg .lit').forEach(g=>g.classList.remove('lit'))); });
const rankList=document.getElementById('rank');
function buildRank(){
rankList.innerHTML='';
PRESETS.forEach((p,i)=>{
  const k = p.vent==='none' ? 'none' : [p.fan,p.inlet,p.duct].join('|');
  const s = score(k, p.angle||'straight', p.heater, p.exhaust||'lower', false, false, false), g = scoreGrade(s);
  const li=document.createElement('li');
  li.innerHTML='<button type="button" class="rk '+g+'" data-i="'+i+'">'
    +'<span class="rk-t">'+p.name+'</span>'
    +'<span class="rk-s">'+s+'</span><span class="rk-bar"><i style="width:'+s+'%"></i></span></button>';
  rankList.appendChild(li);
});
}
rankList.addEventListener('click',e=>{ const b=e.target.closest('.rk'); if(!b) return; const p=PRESETS[+b.dataset.i]; if(!p) return; if(p.vent==='none'){ state.vent='none'; state.heater=p.heater; } else { state.vent='yes'; PRESET_KEYS.forEach(f=>{ state[f]=p[f]; }); } render(); });
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
