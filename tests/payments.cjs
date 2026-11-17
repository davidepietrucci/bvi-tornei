const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  const helpers = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/payments.js', 'utf8')).toString('base64')}`);
  const { moneyCents, paymentModel, paymentVersion, updatePayment } = helpers;
  const tournaments = [{ nome: 'Coppie', quota: 40, categoria: '2x2 Maschile' }, { nome: 'Giallo', quota: 25, categoria: 'Giallo' }];
  const pair = { id: '1', torneo: 'Coppie', giocatori: 'Anna & Bea', stato: 'Approvata', quotaPagata: 0 };
  const single = { ...pair, id: '2', torneo: 'Giallo', giocatori: 'Carla', formatoIscrizione: 'singola' };
  const apply = (registration, amounts, mode = 'add', reason = '') => updatePayment(registration, tournaments, { amounts, mode, reason }, 'staff', '2026-11-17T12:00:00Z');
  assert.equal(moneyCents('12,50'), 1250); assert.equal(moneyCents('0.01'), 1);
  for (const value of ['-1', 'NaN', Infinity, '', '1.001', '1e3', true, null]) assert.throws(() => moneyCents(value));
  assert.deepEqual(paymentModel(pair, tournaments).shares, [2000, 2000]);
  assert.deepEqual(paymentModel(single, tournaments).shares, [2500]);
  assert.deepEqual(paymentModel({ ...pair, giocatori: 'Anna / Bea' }, tournaments).players, ['Anna', 'Bea']);
  assert.deepEqual(paymentModel({ ...pair, giocatori: 'Anna - Bea' }, tournaments).players, ['Anna', 'Bea']);
  assert.deepEqual(paymentModel({ ...pair, giocatori: 'Jean-Luc & Bea' }, tournaments).players, ['Jean-Luc', 'Bea']);
  assert.deepEqual(paymentModel({ ...pair, quotaTotale: 41.01 }, tournaments).shares, [2051, 2050]);
  let paid = apply(pair, ['10.50', '0']);
  assert.equal(paid.quotaPagata, 10.5); assert.equal(paid.versatoAtleta1, 10.5); assert.equal(paid.pagatoPlayer1, false);
  paid = apply(paid, ['9.50', '5']);
  assert.equal(paid.quotaPagata, 25); assert.equal(paid.pagatoPlayer1, true); assert.equal(paid.pagatoPlayer2, false);
  assert.equal(paymentModel(paid, tournaments).remaining, 1500);
  paid = apply(paid, ['0', '15']);
  assert.equal(paid.quotaPagata, 40); assert.equal(paymentModel(paid, tournaments).status, 'paid');
  assert.equal(paid.paymentHistory.length, 3); assert.equal(paid.paymentHistory[2].by, 'staff');
  assert.throws(() => apply(paid, ['0.01', '0']), /supera/);
  assert.throws(() => apply(pair, ['0', '0']), /almeno/);
  assert.throws(() => apply(pair, ['5']), /validi/);
  assert.equal(apply(single, ['5']).quotaPagata, 5);
  assert.equal(apply(single, ['25']).pagatoPlayer2, false);
  const legacy = { ...pair, quotaPagata: 20 };
  assert.equal(paymentModel(legacy, tournaments).needsReview, true);
  assert.deepEqual(paymentModel(legacy, tournaments).paid, [0, 0], 'Do not guess who paid a historical total');
  assert.throws(() => apply(legacy, ['5', '0']), /precedenti/);
  assert.throws(() => apply(legacy, ['10', '5'], 'allocate'), /invariato/);
  const allocated = apply(legacy, ['0', '20'], 'allocate');
  assert.equal(allocated.quotaPagata, 20); assert.equal(allocated.pagatoPlayer2, true);
  assert.equal(paymentModel(allocated, tournaments).needsReview, false);
  assert.deepEqual(paymentModel({ ...legacy, pagatoPlayer1: true, pagatoPlayer2: false }, tournaments).paid, [2000, 0]);
  assert.equal(paymentModel({ ...pair, quotaPagata: 40, pagatoPlayer1: true, pagatoPlayer2: true }, tournaments).status, 'paid');
  assert.throws(() => apply(paid, ['0', '0'], 'correct'), /motivo/);
  assert.equal(apply(paid, ['0', '20'], 'correct', 'Importo errato').quotaPagata, 20);
  assert.throws(() => apply({ ...pair, stato: 'Annullata' }, ['5', '0']), /annullate/);
  assert.throws(() => apply({ ...pair, torneo: 'Missing' }, ['5', '0']), /Quota mancante/);
  assert.equal(pair.quotaPagata, 0, 'Original registration must not mutate');

  class NextResponse extends Response { static json(data, options) { return new NextResponse(JSON.stringify(data), options); } }
  let role = 'staff', userId = 'S', stored = [pair, single], fail = false, writes = 0;
  const context = vm.createContext({ Response, NextResponse, console, ...helpers,
    auth: async () => ({ userId, sessionClaims: {} }), currentUser: async () => ({ publicMetadata: { role } }),
    getIscrizioni: async () => stored, getTornei: async () => tournaments,
    updateRegistrationsAtomically: async (fn) => {
      if (fail) throw new Error('Database unavailable');
      const outcome = await fn(stored, tournaments);
      if (outcome instanceof Response) return outcome;
      stored = outcome.registrations; writes++; return outcome.result;
    },
  });
  const api = fs.readFileSync('app/api/staff/pagamenti/route.js', 'utf8').replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '').replaceAll('export const ', 'const ').replaceAll('export async function ', 'async function ');
  vm.runInContext(`${api}\nthis.get = GET; this.post = POST;`, context);
  const request = (body) => ({ json: async () => body });
  let response = await context.get(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = { id: '1', version: paymentVersion(pair, tournaments), mode: 'add', amounts: ['5', '10'] };
  userId = null; assert.equal((await context.post(request(body))).status, 401);
  userId = 'S'; role = 'atleta'; assert.equal((await context.get()).status, 403); assert.equal((await context.post(request(body))).status, 403);
  role = 'staff'; assert.equal((await context.post(request({ ...body, id: 'missing' }))).status, 404);
  response = await context.post(request(body)); assert.equal(response.status, 200); assert.equal(stored[0].quotaPagata, 15); assert.equal(stored[1], single);
  assert.equal((await context.post(request(body))).status, 409, 'A replay must not double-count the payment');
  assert.equal(writes, 1);
  const currentBody = { ...body, version: paymentVersion(stored[0], tournaments) };
  tournaments[0].quota = 50;
  assert.equal((await context.post(request(currentBody))).status, 200, 'Saved historical quote should stay fixed');
  const invalidBody = { ...body, version: paymentVersion(stored[0], tournaments), amounts: ['999', '0'] };
  assert.equal((await context.post(request(invalidBody))).status, 400);
  fail = true; assert.equal((await context.post(request(invalidBody))).status, 500); fail = false;

  await swc.loadBindings();
  let states = [], index = 0;
  const compiled = await swc.transform(fs.readFileSync('app/staff/pagamenti/page.js', 'utf8'), { filename: 'payments-page.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const ui = { exports: {}, require: (name) => name === 'react' ? { ...React, useEffect: () => {}, useRef: () => ({ current: null }), useState: () => [states[index++], () => {}] } : name.endsWith('/payments') ? helpers : name.endsWith('/StaffHeader') ? () => null : require(name) };
  vm.runInNewContext(compiled.code, ui);
  const render = (error = '', status = 'all') => {
    states = [{ registrations: [pair, single, { ...pair, id: 'cancel', stato: 'Annullata' }], tournaments }, error, '', '', '', status, false, null, false, '', 0]; index = 0;
    return renderToStaticMarkup(React.createElement(ui.exports.default));
  };
  let html = render(); assert.match(html, /Anna/); assert.match(html, /Bea/); assert.match(html, /Carla/);
  assert.match(html, /<table/); assert.match(html, /rowspan="2"/i);
  assert.match(html, /Quota atleta/); assert.match(html, /Versato atleta/); assert.match(html, /Residuo atleta/);
  assert.match(html, /Registro pagamenti scorrevole/);
  const pageSource = fs.readFileSync('app/staff/pagamenti/page.js', 'utf8');
  assert.match(pageSource, /max-w-\[1600px\]/);
  assert.match(pageSource, /max-w-3xl/); assert.match(pageSource, /md:grid-cols-2/);
  assert.match(pageSource, /sticky right-0/); assert.match(pageSource, /sticky top-0/);
  assert.ok(!html.includes('#cancel')); assert.match(html, /Stato pagamento/); assert.match(html, /Residuo/);
  html = render('Network failure'); assert.match(html, /role="alert"/); assert.match(html, /disabled=""/);
  html = render('', 'paid'); assert.match(html, /Nessuna iscrizione con questi filtri/);
  console.log('Payments: individual/pair shares, cents, partial payments, legacy attribution, corrections, audit history, staff permissions, stale/replayed writes, failed saves and UI states passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
