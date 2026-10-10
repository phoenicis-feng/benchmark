import {readFileSync,writeFileSync} from 'node:fs';
const out=readFileSync('template.html','utf8').replace('/* STYLES */',readFileSync('style.css','utf8')).replace('/* ENGINE */',readFileSync('engine.js','utf8')).replace('/* UI */',readFileSync('ui.js','utf8'));
writeFileSync('index.html',out);console.log('Built standalone index.html ('+Math.round(out.length/1024)+' KB)');
