const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

(async () => {
  const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const rulesUri = uri(fs.readFileSync('app/utils/giallo.js', 'utf8'));
  const circuitUri = uri(fs.readFileSync('app/utils/circuit.js', 'utf8'));
  const rules = await import(rulesUri);
  const { gialloClosingPreview } = await import(uri(fs.readFileSync('app/utils/giallo-completion.js', 'utf8').replace('"./giallo"', JSON.stringify(rulesUri)).replace('"./circuit"', JSON.stringify(circuitUri))));
  const { createGiallo, groupGames, setGialloScore, startGialloFinals, gialloStages, gialloFinalStandings, gialloSlug, isGiallo } = rules;
  const tournament = { id: 't1', nome: 'Tappa Giallo', categoria: 'Giallo', stato: 'In Programmazione', circuitRole: 'tappa', circuitName: 'Tour' };
  const make = n => {
    const athletes = Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Atleta ${i + 1}` }));
    let config = createGiallo(athletes);
    for (const group of config.groups) for (const game of groupGames(group)) config = setGialloScore(config, game.id, [21, 15]);
    config = startGialloFinals(config);
    for (let round = 0; round < 20; round++) {
      const pending = gialloStages(config).flatMap(stage => stage.games).filter(game => !config.finals.results[game.id]);
      if (!pending.length) break;
      for (const game of pending) config = setGialloScore(config, game.id, [21, 15]);
    }
    const registrations = athletes.map(a => ({ id: a.id, torneo: tournament.nome, stato: 'Approvata', giocatori: a.name, quotaPagata: 12 }));
    return { config, registrations };
  };
  for (const n of [12, 15, 16, 20, 24]) {
    const { config, registrations } = make(n);
    const preview = gialloClosingPreview(config, tournament, registrations);
    assert.equal(preview.ready, true, `${n}: ${preview.problems.join(', ')}`);
    assert.equal(preview.rows.length, n);
    assert.equal(new Set(preview.rows.map(r => r.registrationId)).size, n);
    for (const place of [1, 2, 3, 4]) assert.equal(preview.rows.filter(r => r.placement === place).length, 2);
    for (const stage of gialloStages(config)) for (const game of stage.games) {
      if (['final', 'bronze'].includes(stage.id)) {
        for (const pair of [game.left, game.right]) {
          const rows = pair.map(a => preview.rows.find(r => r.registrationId === a.id));
          assert.equal(rows[0].placement, rows[1].placement);
          assert.equal(rows[0].points, rows[1].points);
        }
      }
    }
    assert.equal(preview.rows.filter(r => r.placement === 5).length, n <= 15 ? 4 : 8);
    if (n === 15) assert.equal(preview.rows.filter(r => r.placement === 13).length, 3);
    if (n > 16) assert.equal(preview.rows.filter(r => r.placement === 9).length, n - 16);
    assert.equal(gialloFinalStandings(setGialloScore(config, 'bronze-0', null)).ready, false);
    assert.equal(gialloClosingPreview(config, tournament, registrations.slice(1)).ready, false);
    assert(gialloClosingPreview(config, { ...tournament, circuitRole: 'finale' }, registrations).rows.every(r => r.points === 0));
  }

  const source = fs.readFileSync('app/utils/db-server.js', 'utf8');
  const body = source.slice(source.indexOf('export async function manageGialloCompletion'), source.indexOf('export async function saveGironi')).replace('export async function', 'async function');
  const slug = gialloSlug(tournament.nome), fixture = make(12);
  const originalRegistrations = [...fixture.registrations, { ...fixture.registrations[0], torneo: 'Altro', piazzamentoCircuito: 17 }];
  originalRegistrations[0].piazzamentoCircuito = 7;
  let records, writes, failCommit;
  const reset = config => {
    records = new Map([[`giallo/${slug}`, { data: structuredClone(config || fixture.config) }], ['config/iscrizioni', { list: structuredClone(originalRegistrations) }], ['config/tornei', { list: [structuredClone(tournament)] }]]);
    writes = 0; failCommit = false;
  };
  const db = {
    collection: collection => ({ doc: id => `${collection}/${id}` }),
    runTransaction: async callback => {
      const pending = [];
      const result = await callback({
        get: async ref => { assert.equal(pending.length, 0, 'Reads must precede writes'); return { data: () => structuredClone(records.get(ref)) }; },
        set: (ref, value) => pending.push([ref, structuredClone(value)]),
      });
      if (failCommit) throw new Error('Commit failed');
      for (const [ref, value] of pending) records.set(ref, value);
      writes += pending.length;
      return result;
    },
  };
  const context = vm.createContext({ db, isDeepStrictEqual, createHash, gialloSlug, isGiallo, gialloClosingPreview, sanitizeData: structuredClone, Date });
  vm.runInContext(body + '\nthis.manage = manageGialloCompletion;', context);
  const manage = (action, fingerprint, baseline = records.get(`giallo/${slug}`).data) => context.manage(slug, action, fingerprint, 'staff1', baseline);
  reset();
  const preview = await manage('preview');
  assert.equal(writes, 0);
  assert.equal(preview.preview.ready, true);
  const closed = await manage('close', preview.fingerprint);
  assert.equal(writes, 3);
  assert.equal(closed.closed, true);
  assert.equal(records.get('config/tornei').list[0].stato, 'Concluso');
  assert.deepEqual(records.get(`giallo/${slug}`).data.finals, fixture.config.finals);
  assert.equal(records.get('config/iscrizioni').list.at(-1).piazzamentoCircuito, 17, 'Other tournament untouched even with same registration ID');
  for (const row of closed.preview.rows) {
    const registration = records.get('config/iscrizioni').list.find(r => r.id === row.registrationId);
    assert.equal(registration.piazzamentoCircuito, row.placement);
    assert.equal(registration.piazzamentoFinale, row.placement);
    assert.equal(registration.quotaPagata, 12);
  }
  assert.equal((await manage('close', preview.fingerprint)).alreadyClosed, true);
  assert.equal(writes, 3, 'Duplicate close does not write twice');
  const reopening = await manage('preview');
  await manage('reopen', reopening.fingerprint);
  assert.equal(writes, 6);
  assert.deepEqual(records.get('config/iscrizioni').list, originalRegistrations);
  assert.deepEqual(records.get(`giallo/${slug}`).data, fixture.config);
  assert.equal(records.get('config/tornei').list[0].stato, tournament.stato);

  reset();
  await assert.rejects(manage('preview', undefined, {}), { status: 409 });
  const stale = await manage('preview');
  records.get('config/iscrizioni').list[0].quotaPagata = 20;
  await assert.rejects(manage('close', stale.fingerprint), { status: 409 });
  assert.equal(writes, 0);
  reset(setGialloScore(fixture.config, 'bronze-0', null));
  const incomplete = await manage('preview');
  await assert.rejects(manage('close', incomplete.fingerprint), { status: 400 });
  assert.equal(writes, 0);
  reset();
  const rollback = await manage('preview');
  failCommit = true;
  await assert.rejects(manage('close', rollback.fingerprint), /Commit failed/);
  assert.equal(writes, 0);
  assert.equal(records.get('config/tornei').list[0].stato, tournament.stato);
  assert.equal(records.get(`giallo/${slug}`).data.completion, undefined);
  reset();
  await manage('close', (await manage('preview')).fingerprint);
  records.get('config/iscrizioni').list[0].piazzamentoFinale = 24;
  const changed = await manage('preview');
  await assert.rejects(manage('reopen', changed.fingerprint), { status: 409 });
  assert.equal(writes, 3);
  const publicView = rules.publicGiallo({ ...closed.config, groupsPublished: false, finalsPublished: true });
  assert.equal(publicView.completion.rows.length, 12);
  assert.equal(publicView.completion.by, undefined);
  assert.equal(publicView.completion.previousPlacements, undefined);
  assert.equal(rules.publicGiallo({ ...closed.config, groupsPublished: true, finalsPublished: false }).completion, undefined);

  let role = 'staff', userId = 'staff1', calls = 0;
  const apiContext = vm.createContext({
    NextResponse: { json: (data, options = {}) => ({ status: options.status || 200, data }) },
    auth: async () => ({ userId }), currentUser: async () => ({ publicMetadata: { role } }),
    manageGialloCompletion: async () => { calls++; return { closed: true }; },
  });
  const api = fs.readFileSync('app/api/staff/giallo/chiusura/route.js', 'utf8').replace(/^import .+;\r?\n/gm, '').replaceAll('export const ', 'const ').replace('export async function POST', 'async function POST');
  vm.runInContext(api + '\nthis.POST = POST;', apiContext);
  const post = body => apiContext.POST({ json: async () => body });
  const request = { slug, action: 'close', fingerprint: 'a'.repeat(64) };
  userId = null; assert.equal((await post(request)).status, 401);
  userId = 'athlete'; role = 'atleta'; assert.equal((await post(request)).status, 403);
  role = 'staff'; assert.equal((await post({ ...request, fingerprint: 'bad' })).status, 400);
  assert.equal((await post({ ...request, slug: '../bad' })).status, 400);
  assert.equal((await post({ slug, action: 'preview' })).status, 400);
  assert.equal(calls, 0);
  assert.equal((await post(request)).status, 200);
  assert.equal(calls, 1);

  const React = require('react'), swc = require('next/dist/build/swc');
  await swc.loadBindings();
  const compiled = await swc.transform(fs.readFileSync('app/components/tournament/GialloCompletionPanel.js', 'utf8'), { filename: 'completion.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const values = [], refs = []; let cursor, refCursor, confirm = false, mode = 'preview', requests = 0, completed = 0;
  const hooks = { ...React, useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = value; }]; }, useRef(initial) { return refs[refCursor++] ||= { current: initial }; } };
  const ui = { exports: {}, window: { confirm: () => confirm }, fetch: async () => {
    requests++;
    return { ok: mode !== 'failure', json: async () => mode === 'failure' ? { error: 'Offline' } : mode === 'preview' ? { success: true, preview: preview.preview, fingerprint: preview.fingerprint } : { success: true, config: closed.config, tournament: closed.tournament } };
  }, require: name => name === 'react' ? hooks : require(name) };
  vm.runInNewContext(compiled.code, ui);
  const render = (config = fixture.config) => { cursor = refCursor = 0; return ui.exports.default({ config, slug, editable: true, onComplete: () => { completed++; } }); };
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const button = (tree, text) => nodes(tree).find(node => node.type === 'button' && node.props.children === text);
  await button(render(), 'Verifica classifica e chiudi torneo').props.onClick();
  assert(button(render(), 'Conferma classifica e chiudi torneo'));
  await button(render(), 'Conferma classifica e chiudi torneo').props.onClick();
  assert.equal(requests, 1, 'Cancel confirmation cannot close');
  confirm = true; mode = 'failure';
  await button(render(), 'Conferma classifica e chiudi torneo').props.onClick();
  assert.equal(completed, 0, 'Failed writes cannot confirm local state');
  assert(nodes(render()).some(node => node.props?.role === 'alert'));
  assert.equal(button(render({ ...fixture.config }), 'Conferma classifica e chiudi torneo'), undefined, 'Changed local config invalidates review');
  mode = 'close';
  await button(render(), 'Conferma classifica e chiudi torneo').props.onClick();
  assert.equal(completed, 1);
  assert.equal(button(render(), 'Conferma classifica e chiudi torneo'), undefined);
  console.log('Giallo completion: full shared standings for 12/15/16/20/24 athletes, tour points, missing results, changed roster, atomic close/reopen, stale previews, idempotency, other-tournament isolation and rollback passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
