/* Saunas 101 · site script: old addresses, units, the footer wordmark, the heater calculator, the masthead, rule anchors. */

/* the old single-page addresses (#heater, #ventilation.state, #construction.rule) go to the pages they named */
(function(){
  const m = location.hash.match(/^#(construction|heater|ventilation)(?:\.([\w-]+))?$/); if(!m) return;
  location.replace('/'+m[1] + (m[2] ? '#'+m[2] : ''));
})();

/* ---------- units ---------- */
let units = 'metric';
try{ if(new URLSearchParams(location.search).get('units')==='imperial') units='imperial'; else if(localStorage.getItem('units')==='imperial') units='imperial'; }catch(e){}
const numOf = s => parseFloat(String(s).replace(',',''));
function inFrac(inches){
  if(inches >= 1.5) return Math.round(inches) + ' in';
  let n = Math.round(inches * 16), d = 16;
  while(n % 2 === 0 && n > 0){ n /= 2; d /= 2; }
  const whole = Math.floor(n / d), rest = n - whole * d;
  return (whole ? whole + (rest ? ' ' : '') : '') + (rest ? rest + '/' + d : '') + ' in';
}
function ftin(m){ const inches=Math.round(m*39.3701); if(inches<36) return inches+' in'; const ft=Math.floor(inches/12), i=inches%12; return i ? ft+' ft '+i+' in' : ft+' ft'; }
function ftinShort(m){ const inches=Math.round(m*39.3701); if(inches<36) return inches+'″'; const ft=Math.floor(inches/12), i=inches%12; return ft+'′'+(i?i+'″':''); }
const N = '(\\d+(?:[.,]\\d+)?)', RNG = N+'(?: to '+N+')?';
function rule(unit, f, tail){ return [new RegExp(RNG+' '+unit+(tail||''),'g'), (m,a,b,rest)=>(b!=null ? f(numOf(a))+' to '+f(numOf(b)) : f(numOf(a)))+(typeof rest==='string'?rest:'')]; }
const RULES = [
  [/about 2 Pa per metre of height/g, 'about 0.6 Pa per foot of height'],
  [/, 1\.7 at 35 °C/g, ', 0.5 at 95 °F'],
  [/2 l\/s per m²/g, '0.4 cfm per ft²'],
  [new RegExp(RNG+' °C(?=\\s+(?:warmer|colder|below|above|hotter|cooler|lower|higher|difference|less|more))','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*1.8)+' to '+Math.round(numOf(b)*1.8) : Math.round(numOf(a)*1.8))+' °F'],
  [new RegExp(RNG+' °C','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*1.8+32)+' to '+Math.round(numOf(b)*1.8+32) : Math.round(numOf(a)*1.8+32))+' °F'],
  [new RegExp(RNG+' m³\\/h','g'), (m,a,b)=>{ const f=x=>x<1?Math.round(x*58.86)/100:Math.round(x*0.5886); return (b!=null ? f(numOf(a))+' to '+f(numOf(b)) : f(numOf(a)))+' cfm'; }],
  [new RegExp(RNG+' m³','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*35.3147)+' to '+Math.round(numOf(b)*35.3147) : Math.round(numOf(a)*35.3147))+' ft³'],
  [new RegExp(RNG+' l\\/s','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*2.11888)+' to '+Math.round(numOf(b)*2.11888) : Math.round(numOf(a)*2.11888))+' cfm'],
  [new RegExp(RNG+' m\\/s','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)*2.23694)+' to '+Math.round(numOf(b)*2.23694) : Math.round(numOf(a)*2.23694))+' mph'],
  [new RegExp(RNG+' mm','g'), (m,a,b)=>{ const f=x=>inFrac(numOf(x)/25.4).replace(/ in$/,''); return (b!=null ? f(a)+' to '+f(b) : f(a))+' in'; }],
  [new RegExp(RNG+' cm','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)/2.54)+' to '+Math.round(numOf(b)/2.54) : Math.round(numOf(a)/2.54))+' in'],
  [/\bm³/g, '35 ft³'],
  [/\bm²/g, '11 ft²']
];
const M_RULE = new RegExp(RNG+' m(?![A-Za-z³²\\/])','g');
function toImperial(t, short){
  let s=t; RULES.forEach(([re,f])=>{ s=s.replace(re,f); });
  const L = short ? ftinShort : ftin;
  return s.replace(M_RULE,(m,a,b)=> b!=null ? L(numOf(a))+' to '+L(numOf(b)) : L(numOf(a)));
}
/* a figure never parts from its unit: a narrow no-break space (U+202F) between them, whatever wrote the text */
const UNIT_RE = /(\d)[ \u2009\u202F](?=(?:mm|cm|km|m³|m²|m|kW|W|°C|°F|l\/s|ppm|Pa|kg|ft³|ft²|ft|in|cfm|h|min|%)(?![A-Za-z0-9²³]))/g;
const tie = t => t.replace(UNIT_RE, '$1\u202F');
function applyUnits(){
  const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while((n=w.nextNode())){
    const p=n.parentNode; if(!p || p.nodeName==='SCRIPT' || p.nodeName==='STYLE' || (p.closest && p.closest('[data-nounits]'))) continue;
    if(n._metric==null) n._metric=n.nodeValue;
    const short = !!(p.classList && p.classList.contains('rulerT'));
    const src = n._metric.replace(/\u202F/g, ' ');
    const v = tie(units==='imperial' ? toImperial(src, short) : src);
    if(v!==n.nodeValue) n.nodeValue=v;
  }
  document.querySelectorAll('#units button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.u===units ? 'true':'false'));
}
document.getElementById('units').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; units=b.dataset.u; try{ localStorage.setItem('units',units); }catch(e){} applyUnits(); renderCalc(true); });

/* ---------- the footer wordmark: the site's flow, loaded when the footer comes near ---------- */
(function(){
  const wm = document.querySelector('[data-lava-flow]'); if(!wm) return;
  const load = () => { const s=document.createElement('script'); s.src='/assets/lava-flow.js'; document.body.appendChild(s); };
  if(!('IntersectionObserver' in window)){ load(); return; }
  const io = new IntersectionObserver(es => { if(es.some(e=>e.isIntersecting)){ io.disconnect(); load(); } }, { rootMargin:'800px' });
  io.observe(wm);
})();

/* heater size calculator: metres inside, shown and typed in the reader's units; the text converter skips its block */
const FT = 0.3048;
const calc = { w:2.1, d:2.1, h:2.1, g:0 };
const CALC_HASH = /^#(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:\+(\d+(?:\.\d+)?))?$/;
const calcNum = x => String(Math.round(x*100)/100);
const calcHash = () => '#' + calcNum(calc.w) + 'x' + calcNum(calc.d) + 'x' + calcNum(calc.h) + (calc.g > 0 ? '+' + calcNum(calc.g) : '');
(function(){ const m = location.hash.match(CALC_HASH); if(!m) return; calc.w = +m[1]; calc.d = +m[2]; calc.h = +m[3]; calc.g = m[4] ? +m[4] : 0; })();
const calcIds = { w:'calcW', d:'calcD', h:'calcH', g:'calcG' };
const calcFmt = x => String(Math.round(x*10)/10);
function renderCalc(fill){
  const out = document.getElementById('calcOut'); if(!out) return;
  const imp = units==='imperial';
  const toShow = (k, m) => k==='g' ? (imp ? m/(FT*FT) : m) : (imp ? m/FT : m);
  if(fill) for(const k in calcIds) document.getElementById(calcIds[k]).value = calcFmt(toShow(k, calc[k]));
  document.querySelectorAll('#calc [data-u="len"]').forEach(s=>{ s.textContent = imp ? 'ft' : 'm'; });
  document.querySelectorAll('#calc [data-u="area"]').forEach(s=>{ s.textContent = imp ? 'ft²' : 'm²'; });
  const vol = calc.w*calc.d*calc.h, eff = vol + 1.2*calc.g, kw = Math.ceil(eff - 1e-9); calc.kw = kw;
  const volTxt = m3 => imp ? Math.round(m3/(FT*FT*FT))+'\u202Fft³' : calcFmt(m3)+'\u202Fm³';
  if(!(vol>0)){ out.textContent = 'Enter the width, depth and height of the room.'; return; }
  out.innerHTML = '<strong>'+volTxt(vol)+'</strong> of room' + (calc.g>0 ? ', counted as <strong>'+volTxt(eff)+'</strong> with the glass' : '') + ', so a heater of about <strong>'+kw+'\u202FkW</strong>. Round up to the next size on sale.';
}
for(const k in calcIds){ const el = document.getElementById(calcIds[k]); if(!el) continue;
  el.addEventListener('input', ()=>{ const n = parseFloat(el.value); const v = isFinite(n) && n>0 ? n : 0; const imp = units==='imperial';
    calc[k] = k==='g' ? (imp ? v*FT*FT : v) : (imp ? v*FT : v); renderCalc(false); try{ history.replaceState(null,'', calcHash()); }catch(x){} }); }
renderCalc(true);

/* share: the system share sheet where there is one and no mouse, the clipboard everywhere else, as on saunaslava.com.br; each control says what it shares */
(function(){
  const copy = text => (navigator.clipboard && navigator.clipboard.writeText) ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'));
  const canonical = () => { const l = document.querySelector('link[rel="canonical"]'); return l ? l.href : location.origin + location.pathname; };
  const payload = {
    calc: () => ({ text: 'Saunas 101: Electric heater calculator ' + calc.kw + '\u202FkW.', url: location.origin + '/heater' + calcHash() }),
    page: b => ({ text: 'Saunas 101: ' + (b.dataset.text || document.title) + '.', url: canonical() }),
    lab: () => { const s = document.getElementById('scoreNum'); return { text: 'Saunas 101: Ventilation diagram with all variables explained, score ' + (s ? s.textContent.trim() : '') + '.', url: canonical() + location.hash }; }
  };
  document.querySelectorAll('.share[data-share]').forEach(b => b.addEventListener('click', ()=>{
    const { text, url } = payload[b.dataset.share](b);
    const noMouse = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if(noMouse && navigator.share){ navigator.share({ title: document.title, text, url }).catch(()=>{}); return; }
    copy(text + ' ' + url).then(()=>{ b.classList.add('is-copied'); clearTimeout(b._t); b._t = setTimeout(()=>b.classList.remove('is-copied'), 2000); }).catch(()=>{ window.prompt('Copy the link', url); });
  }));
})();

/* the masthead is sticky; its measured height feeds the calculator's sticky offset */
function setMasthead(){ const m = document.querySelector('.masthead'); if(m) document.documentElement.style.setProperty('--masthead', Math.round(m.getBoundingClientRect().height)+'px'); }
setMasthead(); window.addEventListener('resize', setMasthead); if(document.fonts && document.fonts.ready) document.fonts.ready.then(setMasthead);

/* a click on a rule puts its anchor in the address, so the view can be shared; a link inside the rule is not a rule click */
document.querySelectorAll('.facts li[id]').forEach(li=>li.addEventListener('click', e=>{ if(e.target.closest('a')) return; try{ history.replaceState(null,'', '#'+li.id); }catch(x){} }));

applyUnits();
