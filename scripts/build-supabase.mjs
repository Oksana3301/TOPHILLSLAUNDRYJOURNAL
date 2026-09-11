import {build} from 'esbuild';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
// Only the protected fixture download uses assets in the API backend.
// The existing Site continues to serve the complete visual application.
const fixture = '/assets/Bukti-latihan-Top-Hills.pdf';
const assets = JSON.parse(await readFile('.sites-runtime/assets.json', 'utf8'));
await mkdir('.sites-runtime/supabase', {recursive: true});
await build({entryPoints: ['supabase/functions/tophills-api/index.ts'], outfile: '.sites-runtime/supabase/index.ts',
  bundle: true, platform: 'neutral', format: 'esm', target: 'es2022', external: ['npm:postgres@3.4.9'],
  plugins: [{name: 'api-fixture-only', setup(build) {build.onLoad({filter: /assets\.json$/}, () => ({contents: JSON.stringify({[fixture]: assets[fixture]}), loader: 'json'}));}}]});
await writeFile('.sites-runtime/supabase/deno.json', JSON.stringify({compilerOptions: {allowJs: true}}));
console.log('Built protected Supabase API; no deployment or production access.');
