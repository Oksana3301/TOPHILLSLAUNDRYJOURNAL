import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {vercelHostConfig} from '../scripts/vercel-host-config.mjs';

const canonical = 'https://tophillslaundryjournal.vercel.app';
function run(env, address) {
  const url = new URL(address), redirects = [];
  const window = {location: {
    origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash,
    replace: target => redirects.push(target)
  }};
  new Script(vercelHostConfig(env)).runInNewContext({window});
  return {redirects, settings: window.THHosting};
}
test('Production deployment aliases open login on the canonical origin without redirect loops', () => {
  const result = run({VERCEL_ENV: 'production'},
    'https://tophillslaundryjournal-build-example.vercel.app/login');
  assert.deepEqual(result.redirects, [canonical + '/login']);
  assert.deepEqual(run({VERCEL_ENV: 'production'}, canonical + '/login').redirects, []);
  assert.equal(result.settings.chatgptLogin, false);
  assert.equal(result.settings.maxUploadBytes, 4000000);
});
test('Production redirect preserves QR paths, query parameters and fragments and has a fixed destination', () => {
  const suffix = '/checkin?room=C03&next=https%3A%2F%2Fevil.example#fictional-capability';
  const result = run({VERCEL_ENV: 'production'}, 'https://tophillslaundryjournal-git-main-oksana3301s-projects.vercel.app' + suffix);
  assert.deepEqual(result.redirects, [canonical + suffix]);
  assert.equal(new URL(result.redirects[0]).origin, canonical);
});
test('Preview and local pages stay on their own origin and retain hosting flags', () => {
  for (const env of [{}, {VERCEL_ENV: 'preview'}, {VERCEL_ENV: 'development'}]) {
    const result = run(env, 'https://preview.example/login');
    assert.deepEqual(result.redirects, []);
    assert.equal(result.settings.chatgptLogin, false);
  }
});
