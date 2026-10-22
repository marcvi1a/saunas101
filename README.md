# Saunas 101

A guide to building a proper Finnish sauna with an electric heater, in 3 pages: construction rules, the heater with a size calculator, and an interactive ventilation lab.

Live at https://saunas101.com

## Working on it

1. Edit the page content in `src/`, the styles in `styles.css`, the scripts in `site.js` (every page) and `lab.js` (the ventilation lab). The ventilation scores come from the physical model in `model/`: `build.js` runs it when it changes and writes `scores.js`; never edit that file by hand.
2. Run `node build.js`. It writes `index.html`, `construction.html`, `heater.html`, `ventilation.html`, `404.html` and `sitemap.xml` from `src/layout.html`, checks the rules against STYLE.md, and stamps the stylesheet and script links with a hash of their content.
3. Commit the sources and the built pages together, and push `main`. GitHub Pages serves it as is.

To look at it locally, serve the folder over HTTP (the pages use absolute paths): `npx serve .` or any static server.
