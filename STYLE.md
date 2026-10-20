# Saunas 101 · style

The page follows saunaslava.com.br: EB Garamond for headings, Manrope for text, the cream background, a content column that starts where the site's header logo starts (1100 px wide, centred: half the space beyond 1200 px plus 50 px, measured on the live site; 20 px gutters under 990 px).

## Writing

1. Numbers are always digits: 2 bathers, 3 changes an hour, 20 cm, 90 °C. The only number written as a word is one. Fractions stay words: half, a third, a quarter.
2. Units as symbols with a thin space, never spelled out: 20 cm, 90 °C, 6 l/s, 1 kW per m³. A spelled-out metre does not convert and reads wrong in Imperial. Metric is the source; the Imperial toggle converts every figure on the page, so never hand-write an imperial value.
3. Short sentences. No exclamation marks. No "the user". No brand names in the rules, and no mention of Lava anywhere: the page reads as an objective guide.
4. Rule titles name the rule in words and carry no figures and no final full stop (Low ceiling, Warm feet); the figures go in the description, which runs 2 lines on desktop: between 140 and 160 characters, checked at build. Rules are numbered 1., 2., 3. in the title's own type.

## Heater calculator

The Heater tab carries a small calculator between the sizing rules and the stone rules: width, depth, height and the area of glass or bare wall give the room volume (plus 1.2 m³ per m² of bare wall) and the heater size, 1 kW per m³ rounded up. It keeps its figures in metres and renders them itself in the reader's units, so its block is marked `data-nounits` and the text converter skips it. Rules after the calculator sit in a second list with class `cont`, which keeps counting from the first.

## Addresses

The hash names the tab and, after a dot, the view inside it: `#construction`, `#construction.ceiling` (a rule id), `#heater`, `#ventilation`, `#ventilation.on-above-riser-upper` (a lab state). No units in the address: units are the reader's preference. The hash is rewritten on every tab switch, rule click and lab change, so the address bar always reopens the same view. With no hash, or an unknown one, the page opens on Construction. A rule description may link to another tab with a plain `#tab` href; a click on that link is not a rule click.

## Footer

Every tab ends with "Powered by" and the Lava wordmark, the site's own: `assets/lava-wordmark.png` as a mask over the WebGL flow in `assets/lava-flow.js` with the six pattern tiles, copied from the saunaslava.com.br theme (lava-hero.js, lava-e1…6.jpg at 1024 px). The wordmark is a link to https://saunaslava.com.br, dofollow, in a new tab, with the anchor text "Lava, saunas e aquecedores feitos no Brasil". The flow script loads only when the footer comes within 800 px of the viewport.

## Code

1. `index.html` is markup only. All CSS lives in `styles.css`, all JavaScript in `app.js`. No inline `style` attributes; the only style set from script is data (a bar's width).
2. Bump the `?v=` stamp on both links in `index.html` on every deploy: GitHub Pages caches for 10 minutes.
3. Line endings are LF (`.gitattributes`).
4. No build step. The whole site is these files.
