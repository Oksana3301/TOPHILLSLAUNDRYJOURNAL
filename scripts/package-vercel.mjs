import {cp, lstat, mkdir, readdir, rm, access, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {vercelHostConfig} from './vercel-host-config.mjs';

const source = path.resolve('dist');
const output = path.resolve('vercel-public');
const disabledTraining = new Set(['demo.html', 'demo.js', 'sop-demo.html', 'sop-demo.js']);

// dist contains both authored public assets and generated Sites server output.
// Copy only public assets; never publish the Worker bundle or hosting metadata.
async function copyPublic(directory, target) {
  await mkdir(target, {recursive: true});
  for (const name of await readdir(directory)) {
    if (name.startsWith('.') || name === 'server' || disabledTraining.has(name)) continue;
    const from = path.join(directory, name);
    const to = path.join(target, name);
    const info = await lstat(from);
    if (info.isSymbolicLink()) throw new Error('Public build must not contain symbolic links');
    if (info.isDirectory()) await copyPublic(from, to);
    else if (info.isFile()) {
      if (name.endsWith('.html')) {
        let html = await readFile(from, 'utf8');
        if (from === path.join(source, 'staff-login.html')) {
          // ChatGPT identity stays on its existing trusted Site; email accounts use a separate sign-in.
          const ownerAccess = '<section class="card" aria-labelledby="chatgpt-access-title"><h2 id="chatgpt-access-title">Sudah punya akses lewat ChatGPT?</h2><p>Buka situs Top Hills sebelumnya dan masuk dengan akun ChatGPT yang sama. Akses Owner tetap mengikuti akun tersebut.</p><a class="button primary" href="https://top-hills-co-journal.atikadewi.chatgpt.site/login" target="_top">Buka login ChatGPT ↗</a><p class="muted">Formulir email di bawah menggunakan akun Top Hills yang didaftarkan terpisah.</p></section>';
          html = html.replace('<div id="auth-message"', ownerAccess + '<div id="auth-message"');
        }
        await writeFile(to, html.replace('</head>', '<script src="/host-config.js"></script></head>'));
      } else await cp(from, to);
    }
  }
}

await access(path.join(source, 'index.html'));
await rm(output, {recursive: true, force: true});
await copyPublic(source, output);
await writeFile(path.join(output, 'host-config.js'), vercelHostConfig(process.env));
for (const entry of ['index.html', 'staff-login.html', 'laundry-desk.html', 'portal.html', 'sop-coverage.html']) {
  await access(path.join(output, entry));
}
console.log('Prepared Vercel public assets and page routes. Backend migration is separate.');

await import('./check-vercel-backend.mjs');
