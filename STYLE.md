# Saunas 101 · style

The page follows saunaslava.com.br: EB Garamond for headings, Manrope for text, the cream background, a content column that starts where the site's header logo starts (1100 px wide, centred: half the space beyond 1200 px plus 50 px, measured on the live site; 20 px gutters under 990 px).

## Writing

1. Numbers are always digits: 2 bathers, 3 changes an hour, 20 cm, 90 °C. The only number written as a word is one. Fractions stay words: half, a third, a quarter.
2. Units as symbols, never spelled out: 20 cm, 90 °C, 6 l/s, 1 kW per m³. A figure never parts from its unit at a line break: the build puts a narrow no-break space (U+202F) between them in every page, and `site.js` does the same in every text it writes or converts, so the sources can use a plain space. A spelled-out metre does not convert and reads wrong in Imperial. Metric is the source; the Imperial toggle converts every figure on the page, so never hand-write an imperial value.
3. Short sentences. No exclamation marks. No "the user". No brand names in the rules, and no mention of Lava anywhere: the page reads as an objective guide.
4. Rule titles name the rule in words and carry no figures and no final full stop (Low ceiling, Warm feet); the figures go in the description, which runs 2 lines on desktop: between 140 and 160 characters, checked at build. Rules are numbered in the title's own type and the numbers run on across pages (construction 1 to 9, heater 10 on): the build writes them, the sources carry none.
5. Rules are about building. Upkeep (restacking stones, cleaning) is not a rule.
6. Links inside text look as on saunaslava.com.br: no underline, the muted brown (#7C6A64), a shade darker on hover.

## Pages and addresses

Three pages, one per section, each with its own title, description, canonical address and place in `sitemap.xml`:

1. `/construction` is Construction (`construction.html`). The root `/` (`index.html`) serves the same page and names `/construction` as its canonical address, so the home is never empty and search engines count one page.
2. `/heater` (`heater.html`; GitHub Pages serves the file at the extensionless address).
3. `/ventilation` (`ventilation.html`).

The path names the page; the fragment names the view inside it. A rule's anchor is its id: `/construction#ceiling`, `/heater#glass`. A click on a rule puts its anchor in the address. The calculator's sizes live in the fragment of the heater page, in metres: `/heater#2.1x2.1x2.1` (width × depth × height) and `/heater#2.1x2.1x2.1+1` with 1 m² of glass; the calculator rewrites it on every input, and the Share control under it copies one line and that link (the system share sheet on touch devices, "Link copied" for 2 s elsewhere), the control copied from saunaslava.com.br. The same control sits under the construction pictures and under the ventilation drawing; `data-share` names the payload. The lines are fixed wording, with no figure next to the 101: "Saunas 101: Construction rules for building a proper Finnish sauna." (the button's `data-text`), "Saunas 101: Electric heater calculator 10 kW." and "Saunas 101: Ventilation diagram with all variables explained, score 100.", each followed by the link that reopens the view. The lab's layout lives in the fragment of the ventilation page: `/ventilation#on-above-riser` (fan, inlet, duct, then `-open`, `-up45`, `-pillar` or `-wall`, `-upper`, `-induct` or `-half`, or `none`; the heater defaults to the open pillar, so the landing state is `#on-above-riser-pillar`, and a hash without a heater token still means the closed casing); the lab rewrites it on every change, so the address always reopens the same view. Never a query string: a query would make every layout a crawlable address. No units in any address: units are the reader's preference, kept in localStorage. The one exception is Imperial: while it is on, the address carries `?units=imperial` (set by the toggle and on load from the stored preference), so a copied address or a Share line reopens the same view for the recipient; Metric, the default, carries nothing. The page honours the parameter without storing it, and the canonical tag keeps search engines on the plain address. The old single-page addresses (`/#heater`, `/#ventilation.state`, `/#construction.rule`) are forwarded by `site.js` to the page they named.

## Columns

Every page is two columns from 1200 px up: the text column at the left (`minmax(0,1fr)`, 582 px inside the 1100 px content column) and the tool column at the right (`--col-tool`, 470 px, 43 % of the content column), 48 px apart. The text column is wider than the paragraphs' 64ch (about 530 px), so rule descriptions keep their 2 lines. Left holds everything that is read: rules, ranked list, notes. Right holds only a tool: the pictures, the calculator, the ventilation card with its score, drawing and switches. Under 1200 px the pages are one column.

## Heater calculator

The Heater page carries a small calculator, a white card to the right of the rules from 1200 px up and after the rules below that (never between rules), styled as a tool (eyebrow title, plain labels) so it never reads as a rule, and sticky under the masthead on wide screens until the rules end (the masthead height is measured into `--masthead`): width, depth, height and the area of glass or bare wall give the room volume (plus 1.2 m³ per m² of bare wall) and the heater size, 1 kW per m³ rounded to the nearest kilowatt, on two lines: the volume, then "It needs an electric heater of about N kW." It keeps its figures in metres and renders them itself in the reader's units, so its block is marked `data-nounits` and the text converter skips it.

## Construction pictures

The first 3 rules are drawn: three white cards at the right of the rules (sticky like the calculator, after the rules under 1200 px), each an inline SVG in the lab's own style: wood interior, black outline, the lab's benches and heater block, the lab's white seated figure (`#bather`, defined once in the first picture and reused with `use`), a red ✗ over each wrong room and a green ✓ over the right one, a mono label under each room. Rooms are to scale within a picture (40 px per metre in the first two, 30 in the third); the hot layer is the top 60 cm of the room. Sizes and figures are built from `src/construction.html`'s markup only; no image files.

## Ventilation page

The löyly rule opens the page (it is the reason ventilation matters); the ranked list, the notes and the model note follow it in the text column, one column wide; there is no verdict text, the score, the drawing and the ranked list's one line per layout carry the explanation. The tool column holds one white card, sticky under the masthead until the left column ends (plain on screens under 780 px tall, where it would not fit): a score line starting at the room's left wall, its parts on one baseline; the drawing; a line under it with the legend at the left wall and the pause icon at the right wall (a legend on the score line would wrap to 2 rows whenever the third entry, the stagnant zone, shows); then the 8 switches, one row each, no divider, the small uppercase title (10 px) in a column that starts at the room's left wall and the segmented control (10 px) beside it (in this order: Ventilation, Inlet, Exhaust, Exhaust fan, Duct, Heater, Inlet angle, Drying vent; option B of the card board), all one colour, the one-line job as the title's tooltip, small pills (3 px above and below the word, 2 px of track) so all 8 rows fit under the drawing on a laptop viewport of about 816 px. The HEATER label sits inside the drawing, over the stones, so the drawing carries no band under the floor. Under 1200 px the order is rule, card, ranked list, notes; the masthead scrolls away and only the tabs stay sticky (14 px of air above them, 22 px under the subtitle, 36 px in all as on wide screens). Under 560 px the card splits: the score line and the drawing stay under the tabs while the switches scroll beneath them, so a phone can flip a switch and watch the air at once; there the switches are a grid of 2 columns, the 4-way pills (Inlet, Duct) fold into 2 rows of 2, Exhaust stacks its 2 options, and the buttons tighten to 7 px of side padding, so the widest switch (Heater, 3 options) fits half of a 360 px screen. The Duct options read None, Long, Short, Inlet.

## Masthead

The title is a link to `/`, styled as plain text, so it can be opened in a new tab or used to get home from any page.

## Footer

Every page ends with "Powered by" and the Lava wordmark, the site's own: `assets/lava-wordmark.png` as a mask over the WebGL flow in `assets/lava-flow.js` with the six pattern tiles, copied from the saunaslava.com.br theme (lava-hero.js, lava-e1…6.jpg at 1024 px). The wordmark is a link to https://saunaslava.com.br, dofollow, in a new tab, with the anchor text "Lava, saunas e aquecedores feitos no Brasil". The flow script loads only when the footer comes within 800 px of the viewport.

## Code

1. Content lives in `src/`: `layout.html` is the document (head, masthead, tabs, footer slot, scripts), `construction.html`, `heater.html` and `ventilation.html` are the page bodies, `footer.html` the shared footer, `404.html` the not-found page. `build.js` holds the page table (titles, descriptions, scripts) and numbers the rules, writes the pages and the sitemap; it fails the build on a rule that breaks the writing rules, a duplicate id or an inline style.
2. All CSS lives in `styles.css`; `site.js` runs on every page (old addresses, units, calculator, masthead, footer, rule anchors) and `lab.js` only on the ventilation page. No inline `style` attributes; the only style set from script is data (a bar's width, the masthead height).
3. Run `node build.js` before every push and commit the built pages with the sources. The script links carry a hash of the file's content as `?v=`, so a changed file is fetched fresh past GitHub Pages' 10-minute cache and an unchanged one stays cached.
4. Paths in the pages are absolute (`/styles.css`, `/assets/…`), so the folder must be served over HTTP to be viewed locally.
5. Line endings are LF (`.gitattributes`). No dependencies.
