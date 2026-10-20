# Saunas 101 · style

The page follows saunaslava.com.br: EB Garamond for headings, Manrope for text, the cream background, a content column that starts where the site's header logo starts (1136 px wide, centred, 20 px gutters under 990 px).

## Writing

1. Numbers are always digits: 2 bathers, 3 changes an hour, 20 cm, 90 °C. The only number written as a word is one. Fractions stay words: half, a third, a quarter.
2. Units with a thin space: 20 cm, 90 °C, 6 l/s. Metric is the source; the Imperial toggle converts every figure on the page, so never hand-write an imperial value.
3. Short sentences. No exclamation marks. No "the user".
4. Titles are sentences with a full stop when they state a rule (Ceiling at 2.1 to 2.3 m.) and bare when they name a thing (Drying vent).

## Addresses

The hash names the tab and, after a dot, the view inside it: `#construction`, `#construction.ceiling` (a rule id), `#heater`, `#ventilation`, `#ventilation.on-above-riser-upper` (a lab state). No units in the address: units are the reader's preference. The hash is rewritten on every tab switch, rule click and lab change, so the address bar always reopens the same view. With no hash, or an unknown one, the page opens on Ventilation.

## Code

1. `index.html` is markup only. All CSS lives in `styles.css`, all JavaScript in `app.js`. No inline `style` attributes; the only style set from script is data (a bar's width).
2. Bump the `?v=` stamp on both links in `index.html` on every deploy: GitHub Pages caches for 10 minutes.
3. Line endings are LF (`.gitattributes`).
4. No build step. The whole site is these files.
