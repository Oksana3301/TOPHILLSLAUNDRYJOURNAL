import {createHash, randomBytes} from 'node:crypto';
import {readFile, writeFile, lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, '.env.vercel.local');
const origin = 'https://tophillslaundryjournal.vercel.app';
const projectURL = 'https://dkiqgwziefazwrcieavq.supabase.co';
let content;
try {
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) throw new Error('File pengaturan tidak valid.');
  content = await readFile(target, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  content = [
    'TOP_HILLS_SITE_ORIGIN=' + origin,
    'SUPABASE_URL=' + projectURL,
    'SUPABASE_BACKEND_TOKEN=' + randomBytes(32).toString('hex'),
    'AUTH_SESSION_KEY=' + randomBytes(32).toString('hex'),
    ''
  ].join('\n');
  await writeFile(target, content, {flag: 'wx', mode: 0o600});
}
const env = Object.fromEntries(content.trim().split('\n').map(line => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
if (env.TOP_HILLS_SITE_ORIGIN !== origin || env.SUPABASE_URL !== projectURL ||
    !['SUPABASE_BACKEND_TOKEN', 'AUTH_SESSION_KEY'].every(key => /^[a-f0-9]{64}$/.test(env[key] || ''))) {
  throw new Error('Pengaturan lokal tidak sesuai. File tidak diubah.');
}
const digest = value => createHash('sha256').update(value).digest('hex');
const report = {origin, tokenHash: digest(env.SUPABASE_BACKEND_TOKEN), sessionKeyHash: digest(env.AUTH_SESSION_KEY)};
console.log('Pengaturan Vercel tersimpan di .env.vercel.local (jangan dikirim atau dimasukkan Git).');
if (process.argv.includes('--copy')) {
  if (process.platform !== 'darwin') throw new Error('--copy tersedia untuk Mac. Gunakan import file .env melalui dashboard.');
  const copied = spawnSync('pbcopy', [], {input: content, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe']});
  if (copied.error || copied.status !== 0) throw new Error('Clipboard belum berhasil diisi; file pengaturan tetap tersimpan.');
  console.log('Pengaturan disalin ke clipboard. Tempel hanya di Environment Variables proyek Vercel.');
}
console.log('Salin laporan hash berikut untuk mengaktifkan backend. Laporan ini tidak berisi secret:');
console.log(JSON.stringify(report, null, 2));
