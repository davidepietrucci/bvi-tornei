const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  const url = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  const circuitUrl = url(fs.readFileSync('app/utils/circuit.js', 'utf8'));
  const rules = await import(circuitUrl);
  const view = await import(url(fs.readFileSync('app/utils/tour-view.js', 'utf8').replace('"./circuit"', JSON.stringify(circuitUrl))));
  const name = 'Giallo & BVI 2026';
  const stages = [1, 2, 3].map((i) => ({ id: String(i), nome: `Tappa ${i}`, data: `2026-0${i}-03`, location: 'Spiaggia', categoria: 'Giallo', circuitName: name, circuitRole: 'tappa', stato: 'Concluso' }));
  const final = { id: '4', nome: 'Finale', categoria: 'Giallo', circuitName: name, circuitRole: 'finale', stato: 'Iscrizioni Aperte', circuitPlayoffDecision: { fingerprint: 'private-fingerprint', athleteKeys: ['id:private-user'] } };
  let tournaments = [...stages, final];
  const registrations = [1, 2, 3].map((i) => ({ id: `reg-${i}`, torneo: `Tappa ${i}`, stato: 'Approvata', piazzamentoCircuito: i, atleta1Nome: 'Anna Test', atletaUserId1: 'private-user', atletaEmail1: 'secret@example.test', tel: 'private-phone', note: 'private-note' }));
  assert.equal(view.serializePublicTour(tournaments, registrations, name), null);
  assert.equal(view.isTourPublished(tournaments, name), false);
  let overview = view.getTourOverview(tournaments, registrations, name);
  assert.equal(overview.status, 'Finale'); assert.equal(overview.completed, 3); assert.equal(overview.qualifiedCount, 1);
  assert.equal(overview.action.label, 'Gestisci la finale');
  const wrong = view.getTourOverview([{ ...stages[0], stato: 'In Programmazione' }], [], name);
  assert.equal(wrong.status, 'In preparazione'); assert.ok(wrong.warnings.length > 0);
  const dates = view.getTourOverview([{ ...stages[2], data: '03/03/2026' }, { ...stages[0], data: '2026-01-03' }, { ...stages[1], data: '03/02/2026' }, final], registrations, name);
  assert.deepEqual(dates.stages.map((t) => t.id), ['1', '2', '3']);
  assert.equal(new URL(view.tourHref(name), 'https://example.test').searchParams.get('tour'), name);
  const withMissing = view.getTourOverview(tournaments, [...registrations, { ...registrations[0], id: 'missing', atletaUserId1: 'missing-user', piazzamentoCircuito: null }], name);
  assert.equal(withMissing.action.label, 'Completa i piazzamenti');
  assert.equal(new URL(withMissing.action.href, 'https://example.test').searchParams.get('tour'), 'Tappa 1');
  tournaments = tournaments.map((t) => ({ ...t, circuitPublic: true }));
  assert.equal(view.isTourPublished(tournaments, name), true);
  assert.equal(view.isTourPublished(tournaments.map((t) => t.id === '4' ? { ...t, circuitPublic: false } : t), name), false, 'Conflicting publication flags must fail closed');
  const data = view.serializePublicTour(tournaments, registrations, name);
  assert.equal(data.athletes[0].nome, 'Anna Test'); assert.equal(data.athletes[0].qualificato, true);
  for (const secret of ['private-user', 'secret@example.test', 'private-phone', 'private-note', 'private-fingerprint', 'athleteKeys', 'userIds', 'emails']) assert.equal(JSON.stringify(data).includes(secret), false, secret);
  const unnamed = registrations.map((r) => ({ ...r, atleta1Nome: '', giocatori: '' }));
  assert.equal(view.serializePublicTour(tournaments, unnamed, name).athletes[0].nome, 'Atleta', 'Historical email fallbacks must not become public display names');

  class NextResponse extends Response { static json(body, options = {}) { return new NextResponse(JSON.stringify(body), options); } }
  let currentTournaments = tournaments, reads = 0;
  const context = vm.createContext({ NextResponse, URL, console, ...rules, ...view,
    getTornei: async () => currentTournaments, getIscrizioni: async () => { reads++; return registrations; },
  });
  const loadHandler = (file) => {
    const source = fs.readFileSync(file, 'utf8').replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '').replaceAll('export const ', 'const ').replaceAll('export async function ', 'async function ');
    vm.runInContext(`${source}\nthis.GET = GET;`, context);
  };
  loadHandler('app/api/tour/route.js');
  let response = await context.GET({ url: 'https://example.test/api/tour' });
  assert.equal(response.status, 200); assert.equal(reads, 0, 'The index must not load registrations');
  assert.deepEqual(await response.json(), { data: [{ name }] });
  response = await context.GET({ url: `https://example.test/api/tour?${new URLSearchParams({ tour: name })}` });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).data.athletes.length, 1);
  currentTournaments = tournaments.map((t) => ({ ...t, circuitPublic: false }));
  const before = reads;
  assert.equal((await context.GET({ url: `https://example.test/api/tour?${new URLSearchParams({ tour: name })}` })).status, 404);
  assert.equal(reads, before, 'Hidden tours must not load registration data');
  assert.deepEqual(await (await context.GET({ url: 'https://example.test/api/tour' })).json(), { data: [] });
  assert.equal((await context.GET({ url: `https://example.test/api/tour?tour=${'x'.repeat(301)}` })).status, 400);

  // The old public tournament-list endpoint must not leak newly stored playoff account identifiers.
  const dbContext = vm.createContext({ NextResponse, Response, URL, console, auth: async () => ({ userId: null }), getTornei: async () => tournaments });
  const dbSource = fs.readFileSync('app/api/db/route.js', 'utf8').replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '').replaceAll('export const ', 'const ').replaceAll('export async function ', 'async function ');
  vm.runInContext(`${dbSource}\nthis.GET = GET;`, dbContext);
  const listed = await (await dbContext.GET({ url: 'https://example.test/api/db?type=tornei' })).json();
  assert.equal(JSON.stringify(listed).includes('athleteKeys'), false);
  assert.equal(listed.data.length, 4);
  dbContext.auth = async () => ({ userId: 'staff' });
  dbContext.currentUser = async () => ({ publicMetadata: { role: 'staff' } });
  const staffList = await (await dbContext.GET({ url: 'https://example.test/api/db?type=tornei' })).json();
  assert.equal(JSON.stringify(staffList).includes('athleteKeys'), true, 'Staff must retain access to playoff management data');
  const staffPublicList = await (await dbContext.GET({ url: 'https://example.test/api/db?type=tornei&public=true' })).json();
  assert.equal(JSON.stringify(staffPublicList).includes('athleteKeys'), false);

  await swc.loadBindings();
  const components = {};
  let hookValues = null, cursor = 0;
  async function load(file) {
    const compiled = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const mod = { exports: {} };
    vm.runInNewContext(compiled.code, { module: mod, exports: mod.exports, console, URLSearchParams, window: { history: { state: {}, replaceState() {} } }, require(id) {
      if (id === 'react') return { ...React, useEffect() {}, useState(initial) { const i = cursor++; return [i in hookValues ? hookValues[i] : initial, (v) => { hookValues[i] = v; }]; } };
      if (id === '@/app/utils/circuit') return rules;
      if (id === '@/app/utils/tour-view') return view;
      if (components[id]) return components[id];
      if (id === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
      return require(id);
    } });
    return mod.exports.default;
  }
  components['@/app/components/TourJourney'] = await load('app/components/TourJourney.js');
  components['@/app/components/TourStandings'] = await load('app/components/TourStandings.js');
  components['@/app/components/PublicHeader'] = () => null;
  const Journey = components['@/app/components/TourJourney'];
  const journeyHtml = renderToStaticMarkup(React.createElement(Journey, { stages: data.stages, finals: data.finals }));
  assert.equal((journeyHtml.match(/<li /g) || []).length, 4);
  assert.doesNotMatch(journeyHtml, /\/staff\//);
  const Page = await load('app/tour/page.js');
  hookValues = [[{ name }], name, data, false, '', 0]; cursor = 0;
  let html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /Anna Test/); assert.match(html, /Conteggiata/); assert.match(html, /Scartata/);
  assert.doesNotMatch(html, /Pubblica tour|Conferma esito|private-user|secret@example|\/staff\//);
  hookValues = [[], name, null, false, 'Questo tour non è disponibile al pubblico.', 0]; cursor = 0;
  html = renderToStaticMarkup(React.createElement(Page));
  assert.doesNotMatch(html, /Anna Test/);

  const Card = await load('app/components/AthleteTourCards.js');
  const personal = { circuiti: [{ nome: name, regole: { giallo: true }, tappe: 1, punti: 100, posizione: 1, finali: [{ torneo: 'Finale', qualificato: false, statoQualificazione: 'minimum_stages' }], tourPubblico: true }], punteggi: [{ circuito: name, torneo: 'Tappa 1', stato: 'Approvata' }] };
  hookValues = [personal, '', 0]; cursor = 0;
  html = renderToStaticMarkup(React.createElement(Card, { openTournaments: [{ ...stages[1], stato: 'Iscrizioni Aperte' }, final] }));
  assert.match(html, /manca 1 tappa valida/); assert.doesNotMatch(html, /Sei qualificato|Iscriviti alla finale/);
  assert.match(html, /Iscriviti alla prossima tappa/);
  const proxy = fs.readFileSync('proxy.js', 'utf8');
  assert.ok(proxy.includes("'/tour'")); assert.ok(proxy.includes("'/api/tour'"));
  console.log('Tour views: overview actions, ordered journey, explicit publication, public API privacy, revocation and personal eligibility cards passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
