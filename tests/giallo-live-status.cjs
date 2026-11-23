const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const swc = require('next/dist/build/swc');

(async () => {
  await swc.loadBindings();
  const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const rankingUrl = url(fs.readFileSync('app/utils/ranking.js', 'utf8'));
  const scoringUrl = url(fs.readFileSync('app/utils/match-scoring.js', 'utf8').replace('"./ranking"', JSON.stringify(rankingUrl)));
  const finalsUrl = url(fs.readFileSync('app/utils/final-scoring.js', 'utf8').replace('"./match-scoring"', JSON.stringify(scoringUrl)).replace('"./final-progression"', JSON.stringify(url(fs.readFileSync('app/utils/final-progression.js', 'utf8')))));
  const gialloUrl = url(fs.readFileSync('app/utils/giallo.js', 'utf8'));
  const rules = await import(gialloUrl);
  const ranking = await import(rankingUrl);
  const live = await import(url(fs.readFileSync('app/utils/public-live.js', 'utf8').replace('"./match-scoring"', JSON.stringify(scoringUrl)).replace('"./final-scoring"', JSON.stringify(finalsUrl)).replace('"./giallo"', JSON.stringify(gialloUrl)).replace('"./ranking"', JSON.stringify(rankingUrl))));
  const compile = async (file, mocks) => {
    const compiled = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const context = { exports: {}, console, URLSearchParams, AbortController, require: name => name in mocks ? mocks[name] : require(name) };
    vm.runInNewContext(compiled.code, context); return context.exports.default;
  };
  const Content = await compile('app/components/GialloLiveContent.js', { '@/app/utils/public-live': live });
  const tournament = { id: 'yellow', nome: 'Giallo live', categoria: 'Giallo', stato: 'In Corso' };
  let config = rules.createGiallo(Array.from({ length: 15 }, (_, i) => ({ id: String(i), name: `Atleta Numero${i}` })));
  for (const group of config.groups) for (const game of rules.groupGames(group)) config = rules.setGialloScore(config, game.id, [21, 0]);
  config = rules.startGialloFinals(config);
  for (let n = 0; n < 10; n++) {
    const pending = rules.gialloStages(config).flatMap(stage => stage.games).filter(game => !config.finals.results[game.id]);
    if (!pending.length) break;
    for (const game of pending) config = rules.setGialloScore(config, game.id, [21, 0]);
  }
  config = { ...config, groupsPublished: true, finalsPublished: true, completion: { at: '2026-11-23', rows: rules.gialloFinalStandings(config).rows } };
  const declarations = [...fs.readFileSync('app/live/page.js', 'utf8').matchAll(/const \[(\w+),[^\]]+\] = useState\(/g)].map(match => match[1]);
  let cursor, state;
  const hooks = { ...React, useEffect() {}, useState(initial) { const key = declarations[cursor++]; return [key in state ? state[key] : initial, () => {}]; } };
  const Page = await compile('app/live/page.js', {
    react: hooks, 'next/image': props => React.createElement('img', { alt: props.alt }),
    '@/app/utils/db': {}, '@/app/utils/ranking': ranking, '@/app/utils/giallo': rules,
    '@/app/components/SponsorBanner': () => React.createElement('aside', null, 'Sponsor condivisi'),
    '@/app/components/GialloLiveContent': Content,
  });
  const render = (tab, data = rules.publicGiallo(config), selected = tournament.nome) => {
    cursor = 0; state = { tornei: [tournament], selectedTorneo: selected, config: null, bracketConfig: null, requestedTab: tab, loading: false, yellowLive: { tournament: tournament.nome, data } };
    return renderToStaticMarkup(Page());
  };
  let html = render('gironi');
  assert.match(html, /Sponsor condivisi/);
  assert.match(html, /Composizione Gironi/);
  assert.match(html, /5 atleti/);
  assert.match(html, /In corso/);
  assert.match(html, /fixed bottom-0/);
  assert.match(html, /Fasi Finali/);
  html = render('partite');
  assert.match(html, /Per orario/); assert.match(html, /Per girone/);
  assert.match(html, /Riposa: Atleta Numero/);
  assert.match(html, /Terminata/); assert.match(html, />21<.*?>0</s);
  assert.doesNotMatch(html, /\(0-0/);
  html = render('classifica');
  assert.match(html, /Classifica individuale dei gironi/);
  html = render('finali');
  assert.match(html, /3°\/4° posto/); assert.match(html, /Classifica finale/);
  assert.doesNotMatch(html, /\(0-0/);
  const hidden = rules.publicGiallo({ ...config, groupsPublished: false, finalsPublished: true });
  html = render('gironi', hidden);
  assert.match(html, /Classifica finale/);
  assert.doesNotMatch(html, /Composizione Gironi/);
  html = render('gironi', null);
  assert.match(html, /Calendario in Elaborazione/); assert.doesNotMatch(html, /Atleta Numero/);
  html = render('gironi', rules.publicGiallo(config), 'Altro torneo');
  assert.doesNotMatch(html, /Atleta Numero/);

  let records, writes, failCommit;
  const reset = () => { records = new Map([['config/tornei', { list: [structuredClone(tournament), { id: 'other', nome: 'Altro', stato: 'Iscrizioni Aperte' }] }], [`giallo/${rules.gialloSlug(tournament.nome)}`, { data: { results: { game: [21, 0] }, groupsPublished: true } }]]); writes = 0; failCommit = false; };
  reset();
  const db = { collection: collection => ({ doc: id => `${collection}/${id}` }), runTransaction: async callback => {
    const pending = [];
    const result = await callback({ get: async ref => { assert.equal(pending.length, 0); return { data: () => structuredClone(records.get(ref)) }; }, set: (ref, value) => pending.push([ref, structuredClone(value)]) });
    if (failCommit) throw new Error('Offline');
    for (const [ref, value] of pending) records.set(ref, value);
    writes += pending.length; return result;
  } };
  const server = fs.readFileSync('app/utils/db-server.js', 'utf8');
  const body = server.slice(server.indexOf('export async function updateTournamentStatus'), server.indexOf('let parsedServiceAccount')).replace('export async function', 'async function');
  const context = vm.createContext({ db, isGiallo: rules.isGiallo, gialloSlug: rules.gialloSlug, sanitizeData: structuredClone });
  vm.runInContext(body + '\nthis.update = updateTournamentStatus;', context);
  const update = (stato, baseline = 'In Corso', extra = {}) => context.update({ id: tournament.id, nome: tournament.nome, stato, baseline, ...extra });
  await update('Iscrizioni Aperte');
  assert.equal(records.get('config/tornei').list[0].stato, 'Iscrizioni Aperte');
  assert.equal(records.get('config/tornei').list[1].stato, 'Iscrizioni Aperte');
  assert.deepEqual(records.get(`giallo/${rules.gialloSlug(tournament.nome)}`).data.results.game, [21, 0]);
  await assert.rejects(update('In Programmazione'), { status: 409 });
  assert.equal(writes, 1);
  await update('In Corso', 'Iscrizioni Aperte');
  assert.equal(writes, 2);
  await update('In Corso'); assert.equal(writes, 2);
  await assert.rejects(update('Concluso'), { status: 400 });
  await assert.rejects(update('In Corso', 'In Corso', { id: 'missing' }), { status: 404 });
  records.get(`giallo/${rules.gialloSlug(tournament.nome)}`).data.completion = {};
  await assert.rejects(update('Iscrizioni Aperte'), { status: 409 });
  reset(); records.get('config/tornei').list[0].stato = 'Concluso';
  await assert.rejects(update('In Corso', 'Concluso'), { status: 409 });
  reset(); failCommit = true;
  await assert.rejects(update('Iscrizioni Aperte'), /Offline/);
  assert.equal(writes, 0); assert.equal(records.get('config/tornei').list[0].stato, 'In Corso');

  let role = 'staff', userId = 'staff', calls = 0;
  const apiContext = vm.createContext({ auth: async () => ({ userId }), currentUser: async () => ({ publicMetadata: { role } }), updateTournamentStatus: async () => { calls++; return tournament; }, NextResponse: { json: (data, options = {}) => ({ status: options.status || 200, data }) } });
  const api = fs.readFileSync('app/api/staff/tornei/stato/route.js', 'utf8').replace(/^import .+;\r?\n/gm, '').replace('export async function', 'async function');
  vm.runInContext(api + '\nthis.POST = POST;', apiContext);
  const post = (body = { nome: tournament.nome, stato: 'In Corso', baseline: 'Iscrizioni Aperte' }) => apiContext.POST({ json: async () => body });
  userId = null; assert.equal((await post()).status, 401);
  userId = 'athlete'; role = 'atleta'; assert.equal((await post()).status, 403);
  role = 'staff'; assert.equal((await post({})).status, 400);
  assert.equal(calls, 0); assert.equal((await post()).status, 200); assert.equal(calls, 1);
  console.log('Giallo Live: shared header/sponsors/cards/navigation, 21–0 single-set finals, bronze, standings and publication privacy; status: authorization, concurrency, atomic writes, rollback and closed tournament protection passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
