/* Saunas 101 build: every page from one layout, with the writing checks. Run `node build.js` before a push. */
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

const SITE = "https://saunas101.com";
const PAGES = [
  { out: "construction.html", path: "/construction", src: "src/construction.html", page: "construction", title: "Construction · Saunas 101",
    description: "8 rules for building a proper Finnish sauna: size, benches, ceiling, wood, metal, door, floor and walls.", scripts: ["site.js"] },
  { out: "index.html", path: "/", canonical: "/construction", src: "src/construction.html", page: "construction", title: "Saunas 101 · How a proper Finnish sauna works",
    description: "8 rules for building a proper Finnish sauna: size, benches, ceiling, wood, metal, door, floor and walls.", scripts: ["site.js"] },
  { out: "heater.html", path: "/heater", src: "src/heater.html", page: "heater", title: "Heater · Saunas 101",
    description: "How to size an electric sauna heater, with a calculator, and the rules on stones, warm-up time, the sensor and safety.", scripts: ["site.js"] },
  { out: "ventilation.html", path: "/ventilation", src: "src/ventilation.html", page: "ventilation", title: "Ventilation · Saunas 101",
    description: "What löyly is, and an interactive lab that scores every sauna ventilation layout from its physics: inlet, exhaust, fan, duct, heater and drying vent.", scripts: ["site.js", "scores.js", "lab.js"] },
  { out: "404.html", path: null, src: "src/404.html", page: "notfound", title: "Not found · Saunas 101", description: "", scripts: ["site.js"] }
];
const TABS = [{ href: "/construction", label: "Construction", page: "construction" }, { href: "/heater", label: "Heater", page: "heater" }, { href: "/ventilation", label: "Ventilation", page: "ventilation" }];
const BRANDS = /harvia|huum|tyl[oö]|sawo|helo|narvi|iki|kota|lava/i;

const fail = m => { console.error("build failed: " + m); process.exit(1); };
const must = (ok, m) => { if (!ok) fail(m); };
const read = f => fs.readFileSync(f, "utf8");
const stamp = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
const lastmod = f => { try { return execSync("git log -1 --format=%cs -- " + f, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null; } catch (e) { return null; } };
const UNIT_RE = /(\d)[ \u2009\u202F](?=(?:mm|cm|km|m³|m²|m|kW|W|°C|°F|l\/s|ppm|Pa|kg|ft³|ft²|ft|in|cfm|h|min|%)(?![A-Za-z0-9²³]))/g;
const tie = html => html.replace(/>([^<]*)</g, (m, t) => ">" + t.replace(UNIT_RE, "$1\u202F") + "<");
const fill = (t, map) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => { must(k in map, "unknown placeholder " + k); return map[k]; });

/* the rules: a title in words with no full stop, a description of 140 to 160 characters, units as symbols, no brands */
const RULE = /<li id="([a-z-]+)"><h4>(.*?)<\/h4><p>([\s\S]*?)<\/p><\/li>/g;
function checkRules(html, page) {
  const re = new RegExp(RULE.source, "g");
  let m, n = 0;
  while ((m = re.exec(html))) {
    n++;
    const [, id, title, desc] = m, text = desc.replace(/<[^>]+>/g, "");
    must(!/\d/.test(title), page + " rule " + id + ": a figure in the title");
    must(!/\.$/.test(title), page + " rule " + id + ": a full stop at the end of the title");
    must(text.length >= 140 && text.length <= 160, page + " rule " + id + ": description is " + text.length + " characters, not 140 to 160");
    must(!/metre|centimetre|millimetre/i.test(text), page + " rule " + id + ": a unit spelled out");
    must(!BRANDS.test(title + " " + text), page + " rule " + id + ": a brand name");
  }
  return n;
}
function checkIds(html, out) {
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(x => x[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  must(!dup.length, out + ": duplicate ids " + dup.join(", "));
}

/* rule numbers run on from page to page in the order above: the sources carry none, the build writes them */
const starts = {};
{ let n = 0; for (const p of PAGES) { if (p.src in starts) continue; starts[p.src] = n; n += (read(p.src).match(RULE) || []).length; } }
const number = (html, from) => { let n = from; return html.replace(/(<li id="[a-z-]+"><h4>)/g, m => m + (++n) + ". "); };

/* the ventilation scores: model/ runs over every switch state, its physical invariants must hold or the build stops, and the scores, scaled so the model's best state reads 100, go into scores.js; skipped while model/ is unchanged */
const MODEL_SRC = ["airflow.js", "breathing.js", "feet.js", "score.js", "invariants.js", "evaluate.js", "check/routes.js"].map(f => "model/" + f).concat("build.js");
const modelHash = crypto.createHash("sha1").update(MODEL_SRC.map(f => fs.readFileSync(f, "utf8")).join("\n")).digest("hex").slice(0, 12);
if (!(fs.existsSync("scores.js") && fs.readFileSync("scores.js", "utf8").includes("(model " + modelHash + ")"))) {
  const MOD = require("./model/evaluate.js"), INV = require("./model/invariants.js");
  const run = INV.runInvariants(MOD.evaluate, { module: MOD });
  if (run.hardFail) { INV.report(run); fail("the ventilation model breaks a physical invariant"); }
  try { require("child_process").execFileSync(process.execPath, ["model/check/routes.js"], { stdio: "pipe" }); } catch (e) { console.error(String(e.stdout || "").slice(-2000)); fail("the air routes the drawing follows break a check"); }
  const BR = require("./model/breathing.js");
  /* the drawing's air, packed (openings i inlet, e exhaust, d drying vent, l door gap low, t door gap top; zones c ceiling, b bench, f floor): q = [inlet, exhaust, drying vent, door gap low, door gap top] in l/s, + into the room; s = streams [from, q, toHeater, toFloor, floorToOutlet, floorOutlet, toBenches, heaterToOutlet]; o = outlets [to, q, zone]; p = plume l/s; f = floor layer [h m, T °C, stable]; st = how stale, 0 to 1 */
  const r1 = x => Math.round(x * 10) / 10, OP = { inlet: "i", exhaust: "e", dry: "d", doorLow: "l", doorTop: "t" }, ZONE = { ceiling: "c", bench: "b", floor: "f" };
  const code = (m, k) => { if (!(k in m)) fail("the drawing has no code for " + k); return m[k]; };
  const pack = (s, r) => { const R = BR.routes(s, r.flows, r.breathing), f = r.flows;
    return { q: [f.mainInletQ, f.mainExhaustQ, f.dryQ, f.doorLowQ, f.doorTopQ].map(v => r1((v || 0) * 1000)),
      s: R.streams.map(x => [code(OP, x.from), r1(x.q), r1(x.toHeater), r1(x.toFloor), r1(x.floorToOutlet), x.floorOutlet ? code(OP, x.floorOutlet) : "", r1(x.toBenches), r1(x.heaterToOutlet)]),
      o: R.outlets.map(x => [code(OP, x.to), r1(x.q), code(ZONE, x.fromZone)]), p: Math.round(R.plume), f: [Math.round(R.floorLayer.h * 100) / 100, Math.round(R.floorLayer.T), R.floorLayer.stable ? 1 : 0], st: Math.round(R.stale * 100) / 100 }; };
  /* only the states the page can reach: the inlet duct, like the floor hole, has no angle to choose */
  const reachable = s => !(s.vent === "yes" && s.duct === "inletduct" && s.angle !== "straight");
  const rows = MOD.allStates().filter(reachable).map(s => { const r = MOD.evaluate(s); return { s, raw: r.raw, air: pack(s, r) }; });
  const best = rows.reduce((a, r) => r.raw > a.raw ? r : a);
  const SC = {}, AIRS = {}; rows.forEach(r => { SC[MOD.hashKey(r.s)] = Math.round(100 * r.raw / best.raw); AIRS[MOD.hashKey(r.s)] = r.air; });
  /* the Absolute best layout: the top score on the page; among layouts tied there, the one that keeps the most points if its fan stops (the score itself never counts a stopped fan) */
  const topScore = Math.max(...Object.values(SC)), fanOff = s => s.vent === "yes" ? Object.assign({}, s, { fan: "off" }) : s;
  const top = rows.filter(r => SC[MOD.hashKey(r.s)] === topScore).reduce((a, r) => { const fa = SC[MOD.hashKey(fanOff(a.s))], fr = SC[MOD.hashKey(fanOff(r.s))]; return (fr > fa || (fr === fa && r.raw > a.raw)) ? r : a; });
  fs.writeFileSync("scores.js", "/* generated by build.js from model/ (model " + modelHash + "); do not edit. Every switch state's score, scaled so the model's best state reads 100, and the air the drawing shows. */\nconst SCORES = " + JSON.stringify(SC) + ";\nconst BEST_STATE = " + JSON.stringify(top.s) + ";\nconst AIRS = " + JSON.stringify(AIRS) + ";\n");
  console.log("model              " + rows.length + " reachable states, every hard invariant holds, Absolute best " + MOD.hashKey(top.s));
} else console.log("model              unchanged (" + modelHash + ")");
const V = { "styles.css": stamp("styles.css"), "site.js": stamp("site.js"), "scores.js": stamp("scores.js"), "lab.js": stamp("lab.js") };
const layout = read("src/layout.html"), footer = read("src/footer.html").replace(/\n$/, "");
for (const p of PAGES) {
  const content = read(p.src).replace(/\n$/, "");
  must(!/ style="/.test(content), p.src + ": an inline style");
  const rules = checkRules(content, p.page);
  const tabs = TABS.map(t => '<a href="' + t.href + '"' + (t.page === p.page ? ' aria-current="page"' : "") + ">" + t.label + "</a>").join("\n    ");
  const url = SITE + (p.canonical || p.path);
  const head = p.path
    ? ['<meta name="description" content="' + p.description + '">',
       '<link rel="canonical" href="' + url + '">',
       '<meta property="og:title" content="' + p.title + '">',
       '<meta property="og:description" content="' + p.description + '">',
       '<meta property="og:url" content="' + url + '">',
       '<meta property="og:type" content="website">'].join("\n")
    : '<meta name="robots" content="noindex">';
  const scripts = p.scripts.map(s => '<script src="/' + s + "?v=" + V[s] + '" defer></script>').join("\n");
  const html = fill(layout, { title: p.title, head, tabs, page: p.page, content: number(content, starts[p.src]), footer, scripts, css: V["styles.css"] });
  checkIds(html, p.out);
  fs.writeFileSync(p.out, tie(html));
  console.log(p.out.padEnd(18) + (rules ? rules + " rules, " + (starts[p.src] + 1) + " to " + (starts[p.src] + rules) : ""));
}

const today = new Date().toISOString().slice(0, 10);
const urls = PAGES.filter(p => p.path && !p.canonical).map(p => "  <url><loc>" + SITE + p.path + "</loc><lastmod>" + (lastmod(p.src) || today) + "</lastmod></url>");
fs.writeFileSync("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n");
console.log("sitemap.xml        " + urls.length + " urls");
console.log("stamps             " + Object.entries(V).map(([k, v]) => k + " " + v).join(", "));
