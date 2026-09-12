import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const source = readFileSync(new URL('../dist/password-setup.js', import.meta.url), 'utf8');
const loginSource = readFileSync(new URL('../dist/staff-login.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../dist/staff-login.html', import.meta.url), 'utf8');
const access = 'fictional.access.signature';
const refresh = 'fictional-refresh-must-be-discarded';
const password = 'Fictional-password-42!';
function page(fragment, respond = async () => Response.json({passwordUpdated: true})) {
  const requests = [], replacements = [];
  const nodes = {
    '#auth-view': {innerHTML: 'original-view'},
    '#auth-message': {textContent: '', setAttribute(name, value) { this[name] = value; }},
    h1: {textContent: 'Masuk ke Top Hills.'}
  };
  const fields = {password: {value: ''}, passwordConfirm: {value: ''}};
  const button = {disabled: false, textContent: 'Simpan kata sandi'};
  const form = {
    elements: {namedItem: name => fields[name]},
    querySelector: selector => selector === '[type=submit]' ? button : null,
    reset() { for (const field of Object.values(fields)) field.value = ''; }
  };
  const document = {
    querySelector(selector) {
      if (selector === '#password-setup-form') return nodes['#auth-view'].innerHTML.includes('id="password-setup-form"') ? form : null;
      return nodes[selector] || null;
    },
    get cookie() { throw Error('The setup page must not read cookies'); },
    set cookie(_) { throw Error('The setup page must not store browser credentials'); }
  };
  const context = {
    document,
    location: {hash: fragment, pathname: '/login', search: '?welcome=1'},
    history: {replaceState(_state, _title, target) { replacements.push(target); context.location.hash = ''; }},
    URLSearchParams, AbortSignal,
    THCopy: {error: text => text},
    fetch: async (url, options) => { requests.push({url, options}); return respond(url, options); }
  };
  for (const storage of ['localStorage', 'sessionStorage'])
    Object.defineProperty(context, storage, {get() { throw Error('Credentials must stay in page memory'); }});
  context.console = {log() { throw Error('Credentials must not be logged'); }, error() { throw Error('Credentials must not be logged'); }};
  new Script(source).runInNewContext(context);
  return {
    context, requests, replacements, nodes, fields, form, button,
    async submit(value = password, confirm = value) {
      fields.password.value = value; fields.passwordConfirm.value = confirm;
      await form.onsubmit({preventDefault() {}});
    }
  };
}

test('Invite callback is removed before rendering and ordinary login does not overwrite password setup', () => {
  const p = page('#access_token=' + access + '&refresh_token=' + refresh + '&type=invite');
  assert.equal(p.context.THPasswordSetupActive, true);
  assert.equal(p.context.location.hash, '');
  assert.deepEqual(p.replacements, ['/login?welcome=1']);
  assert.match(p.nodes['#auth-view'].innerHTML, /passwordConfirm/);
  assert(!p.nodes['#auth-view'].innerHTML.includes(access));
  assert(!p.nodes['#auth-view'].innerHTML.includes(refresh));
  assert(!Object.values(p.context).includes(access));
  new Script(loginSource).runInNewContext(p.context);
  assert.equal(p.requests.length, 0);
  assert.match(p.nodes.h1.textContent, /Buat kata sandi/);
  assert(html.indexOf('/password-setup.js') < html.indexOf('/staff-login.js'));
});

test('Setup posts only the in-memory token and matching passwords, then clears credentials and offers login', async () => {
  const p = page('#type=invite&access_token=' + access + '&refresh_token=' + refresh + '&role=Owner&email=untrusted@example.test');
  await p.submit();
  assert.equal(p.requests.length, 1);
  const {url, options} = p.requests[0];
  assert.equal(url, '/api/auth/set-password');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers['X-Top-Hills'], '1');
  assert.deepEqual(JSON.parse(options.body), {accessToken: access, password, passwordConfirm: password});
  assert(!options.body.includes(refresh));
  assert.match(p.nodes['#auth-view'].innerHTML, /href="\/login"/);
  assert.equal(p.fields.password.value, '');
  assert.equal(p.fields.passwordConfirm.value, '');
  assert.equal(p.button.disabled, true);
  await p.submit();
  assert.equal(p.requests.length, 1, 'a completed setup no longer has a token to submit');
});

test('Mismatched and short passwords are rejected before calling the server', async () => {
  const p = page('#type=invite&access_token=' + access);
  await p.submit(password, password + 'different');
  assert.equal(p.requests.length, 0);
  assert.match(p.nodes['#auth-message'].textContent, /belum sama/);
  await p.submit('short');
  assert.equal(p.requests.length, 0);
  assert.match(p.nodes['#auth-message'].textContent, /minimal 12/);
});

test('Missing, duplicated or error callback credentials show a safe message without any network request', () => {
  for (const fragment of [
    '#type=invite',
    '#type=recovery&access_token=',
    '#type=invite&access_token=' + access + '&access_token=second',
    '#type=invite&type=recovery&access_token=' + access,
    '#type=invite&access_token=' + access + '&error=access_denied&error_description=private-text'
  ]) {
    const p = page(fragment);
    assert.equal(p.context.THPasswordSetupActive, true);
    assert.equal(p.context.location.hash, '');
    assert.equal(p.requests.length, 0);
    assert.equal(p.form.onsubmit, undefined);
    assert.match(p.nodes['#auth-message'].textContent, /Tautan tidak dapat digunakan/);
    assert(!p.nodes['#auth-message'].textContent.includes('private-text'));
  }
});

test('Recovery links use the same verified password setup while signup and unrelated fragments stay untouched', async () => {
  const recovery = page('#type=recovery&access_token=' + access);
  assert.match(recovery.nodes.h1.textContent, /Atur ulang/);
  await recovery.submit();
  assert.equal(recovery.requests.length, 1);
  for (const fragment of ['#type=signup&access_token=' + access, '#access_token=' + access, '#section']) {
    const p = page(fragment);
    assert.equal(p.context.THPasswordSetupActive, undefined);
    assert.equal(p.context.location.hash, fragment);
    assert.deepEqual(p.replacements, []);
    assert.equal(p.nodes['#auth-view'].innerHTML, 'original-view');
  }
});

test('Expired tokens are cleared, and server validation errors allow correction without saving passwords', async () => {
  const expired = page('#type=invite&access_token=' + access, async () => Response.json({error: 'expired'}, {status: 401}));
  await expired.submit();
  assert.match(expired.nodes['#auth-message'].textContent, /Tautan tidak dapat digunakan/);
  assert.equal(expired.fields.password.value, '');
  await expired.submit();
  assert.equal(expired.requests.length, 1);
  const weak = page('#type=invite&access_token=' + access, async () => Response.json({error: 'Gunakan kata sandi yang lebih kuat.'}, {status: 400}));
  await weak.submit();
  assert.match(weak.nodes['#auth-message'].textContent, /lebih kuat/);
  assert.equal(weak.fields.password.value, '');
  assert.equal(weak.button.disabled, false);
});

test('A failed or ambiguous response never reports a successful password update or prints exception secrets', async () => {
  for (const respond of [
    async () => Response.json({}),
    async () => { throw Error('Private provider token: ' + access); },
    async () => Response.json({error: 'Private provider token: ' + access}, {status: 503})
  ]) {
    const p = page('#type=invite&access_token=' + access, respond);
    await p.submit();
    assert(!p.nodes['#auth-message'].textContent.includes(access));
    assert(!p.nodes['#auth-message'].textContent.includes('Kata sandi tersimpan.'));
    assert.match(p.nodes['#auth-view'].innerHTML, /password-setup-form/);
    assert.equal(p.fields.password.value, '');
  }
});
