#!/usr/bin/env node
// Uso: node scripts/import-inap.js examen.txt plantilla.txt "2024-LI-A"
// Convierte el cuestionario oficial del INAP (texto) + su plantilla de respuestas en preguntas de la app.
const fs = require('fs'), path = require('path');
const [, , qFile, aFile, tag] = process.argv;
if (!qFile || !aFile || !tag) { console.log('Uso: node scripts/import-inap.js examen.txt plantilla.txt "2024-LI-A"'); process.exit(1); }
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const qt = fs.readFileSync(qFile, 'utf8').replace(/\r/g, '');
const at = fs.readFileSync(aFile, 'utf8').replace(/\r/g, '');

// 1) Respuestas de la primera parte
let aSec = at.slice(Math.max(0, at.search(/primera parte/i)));
const aEnd = aSec.search(/^\s*(preguntas de )?reserva\s*$/im);
if (aEnd > 0) aSec = aSec.slice(0, aEnd);
const key = {}, pending = [];
// Lee pares "N. x" y también columnas separadas (números por un lado, letras por otro). ANULADA = se omite.
for (const m of aSec.matchAll(/(\d{1,3})\s*[.\-)]|\b(ANULADA)\b|\b([a-dA-D])\b/g)) {
  if (m[1]) pending.push(+m[1]);
  else if (pending.length) { const n = pending.shift(); if (m[3]) key[n] = 'abcd'.indexOf(m[3].toLowerCase()); }
}

// 2) Preguntas de la primera parte
let body = qt.slice(Math.max(0, qt.search(/^\s*PRIMERA PARTE\s*$/m)));
const qe = body.search(/^\s*Preguntas de reserva\s*$/im);
if (qe > 0) body = body.slice(0, qe);
body = body.replace(/^.*(lOMoARcPSD|messages\.|studocu).*$/gim, '').replace(/^\s*\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\s*$/gim, '').replace(/^\s*\d{1,3}\s*$/gm, '');
body = body.replace(/\d{4}\s*[-–]\s*TAI[^\n]*?P[aá]gina\s+\d+\s+de\s+\d+/gi, '\n').replace(/^\s*P[aá]gina \d+ de \d+\s*$/gim, '');

const starts = []; let pos = 0;
for (let n = 1; n <= 200; n++) {
  const re = new RegExp('(?:^|\\n)\\s*' + n + '(?:\\.[-–]?|[-–])\\s+', 'g'); re.lastIndex = pos;
  const m = re.exec(body); if (!m) break;
  starts.push({ n, i: m.index, len: m[0].length }); pos = m.index + m[0].length;
}
const findOpt = (txt, l, from) => { const re = new RegExp('(?:^|\\s)' + l + '\\)\\s', 'g'); re.lastIndex = from; const m = re.exec(txt); return m ? { i: m.index, end: m.index + m[0].length } : null; };

const out = [], skipped = [];
starts.forEach((s, k) => {
  const text = body.slice(s.i + s.len, k + 1 < starts.length ? starts[k + 1].i : body.length);
  const idx = []; let from = 0;
  for (const l of 'abcd') { const f = findOpt(text, l, from); if (!f) break; idx.push(f); from = f.end; }
  if (idx.length < 4 || key[s.n] === undefined) { skipped.push(s.n); return; }
  out.push({ id: `${tag}-${s.n}`, tema: `Examen ${tag}`, q: clean(text.slice(0, idx[0].i)),
    o: idx.map((f, j) => clean(text.slice(f.end, j < 3 ? idx[j + 1].i : text.length))), c: key[s.n], e: '' });
});

// 3) Mezclar con el banco existente (sin duplicar preguntas que ya estén, aunque vengan en otro orden/modelo)

const file = path.resolve(__dirname, '../src/data/questions.json');
const old = JSON.parse(fs.readFileSync(file, 'utf8')).filter((q) => !q.id.startsWith(tag + '-'));
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/g, ' ').trim();
const sig = (q) => norm(q.q) + '|' + q.o.map(norm).sort().join('|');
const seen = new Map(old.map((q) => [sig(q), q]));
const fresh = [], dup = [], conflict = [];
for (const q of out) {
  const prev = seen.get(sig(q));
  if (!prev) { fresh.push(q); continue; }
  dup.push(q.id);
  if (norm(prev.o[prev.c]) !== norm(q.o[q.c])) conflict.push(`${q.id} vs ${prev.id}`);
}
fs.writeFileSync(file, JSON.stringify([...old, ...fresh], null, 1));
console.log(`Nuevas: ${fresh.length}. Repetidas (ya estaban): ${dup.length}. Banco total: ${old.length + fresh.length}.`);
if (conflict.length) console.log('OJO, misma pregunta con distinta respuesta correcta:', conflict.join(', '));
if (skipped.length) console.log('No importadas (anuladas o ilegibles):', skipped.join(', '));
