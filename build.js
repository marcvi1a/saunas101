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
    description: "How to size an electric sauna heater, with a calculator, and the rules on stones, clearances, the sensor and the wiring.", scripts: ["site.js"] },
  { out: "ventilation.html", path: "/ventilation", src: "src/ventilation.html", page: "ventilation", title: "Ventilation · Saunas 101",
    description: "What löyly is, and an interactive lab that scores 17 sauna ventilation layouts: inlet position and angle, exhaust height, fan, duct and heater type.", scripts: ["site.js", "lab.js"] },
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

const V = { "styles.css": stamp("styles.css"), "site.js": stamp("site.js"), "lab.js": stamp("lab.js") };
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
