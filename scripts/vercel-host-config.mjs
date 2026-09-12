export function vercelHostConfig(env = {}) {
  const config = 'window.THHosting = Object.freeze({chatgptLogin: false, maxUploadBytes: 4000000});\n';
  if (env.VERCEL_ENV !== 'production') return config;
  // Staff sessions and backend credentials belong to the canonical production origin.
  // Preserve customer QR parameters and fragments while moving off deployment aliases.
  const origin = 'https://tophillslaundryjournal.vercel.app';
  return config + 'if (window.location.origin !== ' + JSON.stringify(origin) + ') {\n' +
    '  window.location.replace(' + JSON.stringify(origin) +
    ' + window.location.pathname + window.location.search + window.location.hash);\n}\n';
}
