// Converter: bare m²/m³ rules with real word boundaries; millimetres under about 1.5 in as sixteenths.
const fs = require("fs");
let a = fs.readFileSync("app.js", "utf8");
const rep = (x, y) => { if (!a.includes(x)) throw new Error("missing: " + x.slice(0, 70)); a = a.replace(x, y); };

/* the two bare-unit rules, written with a real \b this time */
rep(",\n  [/bm³/g, '35 ft³'],\n  [/bm²/g, '11 ft²']", ",\n  [/\\bm³/g, '35 ft³'],\n  [/\\bm²/g, '11 ft²']");

/* millimetres: fractions of an inch below 1.5 in, whole inches above */
rep("function ftin(m){", `function inFrac(inches){
  if(inches >= 1.5) return Math.round(inches) + ' in';
  let n = Math.round(inches * 16), d = 16;
  while(n % 2 === 0 && n > 0){ n /= 2; d /= 2; }
  const whole = Math.floor(n / d), rest = n - whole * d;
  return (whole ? whole + (rest ? ' ' : '') : '') + (rest ? rest + '/' + d : '') + ' in';
}
function ftin(m){`);
rep("[new RegExp(RNG+' mm','g'), (m,a,b)=>(b!=null ? Math.round(numOf(a)/25.4)+' to '+Math.round(numOf(b)/25.4) : Math.round(numOf(a)/25.4))+' in'],",
    "[new RegExp(RNG+' mm','g'), (m,a,b)=>{ const f=x=>inFrac(numOf(x)/25.4).replace(/ in$/,''); return (b!=null ? f(a)+' to '+f(b) : f(a))+' in'; }],");

fs.writeFileSync("app.js", a);
new Function(a);
const r = new Function(a.slice(a.indexOf("function inFrac"), a.indexOf("function ftin(m){")) + "return inFrac;")();
console.log("5 mm →", r(5 / 25.4), "· 10 mm →", r(10 / 25.4), "· 12 mm →", r(12 / 25.4), "· 16 mm →", r(16 / 25.4), "· 100 mm →", r(100 / 25.4), "· 25 mm →", r(25 / 25.4));
