// Cover Art Studio — gta6-cover-art-01 entry program (Node 22, stdlib only).
//
// The app lives in this directory's app/ folder: plain static files a desktop
// browser loads offline (app/index.html plus its own CSS and JS, no libraries,
// no network requests at runtime). This program hands the entry in: it copies
// app/ and screenshots/ from beside this file into the output directory and
// writes output/dossier.json, the summary the judge reads, using the vendored
// make.fun library (vendor/makefun-app.ts, unchanged).
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const appSource = join(repoRoot, 'app');
const shotSource = join(repoRoot, 'screenshots');
const appTarget = join(outputDir, 'app');
const shotTarget = join(outputDir, 'screenshots');

mkdirSync(outputDir, { recursive: true });
cpSync(appSource, appTarget, { recursive: true });
mkdirSync(shotTarget, { recursive: true });
if (existsSync(shotSource)) {
  cpSync(shotSource, shotTarget, { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files in all, or a path under app/ over 1000 bytes. app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`entry written to ${outputDir}`);
