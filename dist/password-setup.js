'use strict';
(() => {
  // Supabase consumes the email link. Its session token is kept only in this page's memory.
  function callback() {
    const fields = new URLSearchParams(location.hash.slice(1));
    const kind = fields.get('type');
    if (!['invite', 'recovery'].includes(kind)) return null;
    const accessToken = fields.get('access_token') || '';
    const valid = fields.getAll('type').length === 1 &&
      fields.getAll('access_token').length === 1 &&
      accessToken.length >= 10 && accessToken.length <= 8192 && !/\s/.test(accessToken) &&
      !fields.has('error') && !fields.has('error_code');
    return {kind, accessToken: valid ? accessToken : '', valid};
  }
  let entry = callback();
  if (!entry) return;
  globalThis.THPasswordSetupActive = true;
  let accessToken = entry.accessToken;
  const kind = entry.kind;
  let valid = entry.valid;
  entry.accessToken = '';
  entry = null;
  // Remove all fragment credentials before rendering or making a network request.
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch { accessToken = ''; valid = false; }
  const $ = selector => document.querySelector(selector);
  const view = $('#auth-view'), notice = $('#auth-message');
  const title = $('h1');
  if (title) title.textContent = kind === 'invite' ? 'Buat kata sandi Top Hills.' : 'Atur ulang kata sandi.';
  function message(text, error = false) {
    notice.className = 'alert ' + (error ? 'error' : 'success');
    notice.setAttribute('role', error ? 'alert' : 'status');
    notice.textContent = THCopy.error(text);
  }
  const loginLink = '<a class="button" href="/login">Kembali ke Masuk</a>';
  function unavailable() {
    accessToken = '';
    view.innerHTML = '<div class="card"><p>Tautan belum lengkap, sudah digunakan, atau kedaluwarsa. Minta undangan baru atau gunakan Lupa kata sandi.</p>' + loginLink + '</div>';
    message('Tautan tidak dapat digunakan. Buka tautan terbaru dari email Anda.', true);
  }
  if (!valid) { unavailable(); return; }
  view.innerHTML = '<div class="card"><p>Buat kata sandi sendiri untuk masuk dengan email di Top Hills. Tautan ini akan diperiksa saat kata sandi disimpan.</p>' +
    '<form id="password-setup-form" class="grid">' +
    '<label>Kata sandi baru<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>' +
    '<label>Ulangi kata sandi baru<input name="passwordConfirm" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>' +
    '<p class="muted">Gunakan 12–128 karakter, dengan kombinasi huruf besar, huruf kecil, angka, dan simbol.</p>' +
    '<button class="primary" type="submit">Simpan kata sandi</button></form></div>';
  const form = $('#password-setup-form'), button = form.querySelector('[type=submit]');
  let busy = false;
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy || !accessToken) return;
    const password = form.elements.namedItem('password').value;
    const passwordConfirm = form.elements.namedItem('passwordConfirm').value;
    if (password.length < 12 || password.length > 128) {
      message('Kata sandi baru minimal 12, maksimal 128 karakter.', true); return;
    }
    if (password !== passwordConfirm) {
      message('Kedua kata sandi belum sama. Periksa kembali.', true); return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = 'Menyimpan…';
    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: {'Content-Type': 'application/json', 'X-Top-Hills': '1'},
        body: JSON.stringify({accessToken, password, passwordConfirm}),
        signal: AbortSignal.timeout(20000)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { unavailable(); return; }
        const safe = typeof result?.error === 'string' && result.error.length <= 500 &&
          !result.error.includes(accessToken) ? result.error : 'Kata sandi belum tersimpan. Coba kembali sebentar lagi.';
        message(safe, true);
        return;
      }
      if (result?.passwordUpdated !== true) {
        message('Hasil penyimpanan belum dapat dipastikan. Coba masuk dengan kata sandi baru atau gunakan Lupa kata sandi.', true);
        return;
      }
      accessToken = '';
      form.reset();
      view.innerHTML = '<div class="card"><p>Kata sandi sudah tersimpan. Masuk menggunakan email dan kata sandi baru Anda.</p>' + loginLink + '</div>';
      message('Kata sandi tersimpan. Anda sudah bisa masuk dengan email.');
    } catch (error) {
      message(error?.name === 'TimeoutError' ?
        'Koneksi lambat. Hasil penyimpanan belum dapat dipastikan. Coba masuk dengan kata sandi baru atau gunakan Lupa kata sandi.' :
        'Koneksi terputus. Hasil penyimpanan belum dapat dipastikan. Coba masuk dengan kata sandi baru atau gunakan Lupa kata sandi.', true);
    } finally {
      form.reset();
      busy = false;
      button.disabled = !accessToken;
      button.textContent = 'Simpan kata sandi';
    }
  };
})();
