// Vice Coast Cover Lab — the program that hands the entry in (Node 22, standard
// library only). The app is this directory's app/ folder: plain static files a
// desktop browser loads offline (app/index.html and its ES modules, no library,
// no network request). This program copies app/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Authored check before handing in: the app entry point must exist, and the
// screenshots folder must hold 3 or 4 images (the gate's own range). Failing
// fast here beats a silent bad dossier later.
const indexHtml = join(here, 'app', 'index.html');
if (!existsSync(indexHtml)) throw new Error('missing app/index.html — nothing to hand in');
const shotDir = join(here, 'screenshots');
const shotCount = existsSync(shotDir)
  ? readdirSync(shotDir).filter((n) => !n.startsWith('.')).length
  : 0;
if (shotCount < 3 || shotCount > 4) throw new Error(`expected 3-4 screenshots, found ${shotCount}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(`vice-coast-cover-lab: handed in ${shotCount} screenshots to ${out}`);
