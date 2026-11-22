// Builds watch.html: the private claude.ai page for watching a cloud run from a phone.
// It is island.html in "live viewer" mode (no test controls, no simulation of its own),
// reshaped for the Artifact page contract (no doctype/html/head/body wrappers).
const fs = require('fs'), path = require('path');
let s = fs.readFileSync(path.join(__dirname, '..', 'island.html'), 'utf8');
s = s.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
     .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
     .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
s = s.replace('<title>Watchable Island</title>', '<title>Watchable Island</title>');
s = s.replace('#app{display:grid;grid-template-rows:auto 1fr;height:100vh}', '#app{display:grid;grid-template-rows:auto 1fr;height:100%}');
s = s.replace(':root{\n', ':root{color-scheme:dark;\n');
s = s.replace('html,body{margin:0;height:100%;', 'html,body{margin:0;height:100%;');
s = s.replace("<script>\n'use strict';\n(function(){", "<script>window.ISLAND_LIVE_VIEWER=true;</script>\n<script>\n'use strict';\n(function(){");
if (!s.includes('ISLAND_LIVE_VIEWER=true')) throw new Error('could not insert live flag');
const out = path.join(__dirname, 'watch.html');
fs.writeFileSync(out, s);
console.log('wrote', out, (s.length / 1024).toFixed(0) + ' KB');
