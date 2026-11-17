const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  const rules = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/circuit.js', 'utf8')).toString('base64')}`);
  const circuitUrl = `data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/circuit.js', 'utf8')).toString('base64')}`;
  const tourView = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/tour-view.js', 'utf8').replace('"./circuit"', JSON.stringify(circuitUrl))).toString('base64')}`);
  const stages = [1, 2, 3].map((i) => ({ id: String(i), nome: `Tappa ${i}`, categoria: 'Giallo', circuitRole: 'tappa', circuitName: 'Tour Test', stato: 'Concluso' }));
  const final = { id: '4', nome: 'Finale', categoria: 'Giallo', circuitRole: 'finale', circuitName: 'Tour Test', circuitQualifiers: 24, stato: 'Iscrizioni Aperte' };
  const tournaments = [...stages, final];
  const reg = (id, stage, place, extra = {}) => ({ id: `${id}-${stage}`, torneo: `Tappa ${stage}`, stato: 'Approvata', atletaUserId1: id, atletaEmail1: `${id}@example.test`, atleta1Nome: id, piazzamentoCircuito: place, ...extra });
  let registrations = [reg('A', 1, 1), reg('A', 2, 3), reg('B', 1, 2), reg('B', 2, 2), reg('B', 3, 24), reg('C', 1, 1)];
  const leaderboard = rules.getCircuitLeaderboard(tournaments, registrations, ' tour test ');
  const a = leaderboard.find((r) => r.nome === 'A'), b = leaderboard.find((r) => r.nome === 'B'), c = leaderboard.find((r) => r.nome === 'C');
  assert.equal(a.punti, 180); assert.equal(b.punti, 180);
  assert.ok(leaderboard.indexOf(b) < leaderboard.indexOf(a), 'Attendance breaks equal best-two totals');
  assert.equal(b.risultati.find((r) => r.punti === 2).conteggiata, false);
  assert.equal(c.idoneo, false);
  assert.equal(rules.getCircuitFinalists(tournaments, registrations, final).athletes.find((r) => r.nome === 'C').qualificato, false);
  assert.equal(rules.getCircuitFinalists(tournaments, registrations, final).limit, 16);
  assert.equal(rules.getCircuitFinalists(tournaments, registrations, final).ready, true);
  assert.equal(rules.getCircuitFinalists(tournaments.slice(0, 2), registrations, final).ready, false);
  assert.equal(rules.getCircuitFinalists(tournaments.map((t) => t.id === '3' ? { ...t, stato: 'In Programmazione' } : t), registrations, final).ready, false);
  assert.equal(rules.getCircuitFinalists(tournaments, [...registrations, reg('D', 1, null)], final).ready, false);
  assert.equal(rules.getCircuitFinalists(tournaments, registrations.map((r) => r.id === 'B-3' ? { ...r, piazzamentoCircuito: 25 } : r), final).ready, false);
  assert.equal(rules.getCircuitFinalists([...tournaments, { ...stages[0], id: 'extra', nome: 'Tappa extra' }], registrations, final).ready, false);
  assert.equal(rules.getPlacementPoints(stages[0], 24), 2);
  assert.equal(rules.getPlacementPoints(stages[0], 17), 16);
  assert.equal(Object.keys(rules.getCircuitPointTable(stages[0])).length, 24);
  assert.equal(rules.getPlacementPoints({ ...stages[0], circuitPointTable: { 1: 77 } }, 1), 77, 'Preserve custom tables');
  assert.equal(rules.getPlacementPoints({ ...stages[0], circuitPointTable: { 16: 2 } }, 17), 0, 'Do not create a mixed old/new table where 17th beats 16th');
  const tiedBest = rules.getCircuitLeaderboard(tournaments, [reg('E', 1, 1), reg('E', 2, 3), reg('F', 1, 2), reg('F', 2, 2)], 'Tour Test');
  assert.equal(tiedBest[0].nome, 'E', 'Best counted single result breaks equal points and attendance');
  const duplicates = rules.getCircuitLeaderboard(tournaments, [reg('A', 1, 1, { atletaUserId1: '', atletaEmail1: 'a@example.test' }), reg('A', 1, 1, { atletaEmail1: '', atletaUserId1: 'A' }), reg('A', 2, 2, { atletaEmail1: 'a@example.test' })], 'Tour Test');
  assert.equal(duplicates.length, 1); assert.equal(duplicates[0].punti, 190); assert.equal(duplicates[0].tappe, 2);
  const legacyTournaments = tournaments.map((t) => ({ ...t, categoria: 'Misto 2x2' }));
  const legacy = rules.getCircuitLeaderboard(legacyTournaments, [reg('A', 1, 1), reg('A', 2, 1), reg('A', 3, 1)], 'Tour Test');
  assert.equal(legacy[0].punti, 300, 'Non-giallo tours keep cumulative ranking');
  assert.equal(rules.getPlacementPoints({ categoria: 'Misto 2x2', circuitPointTable: { 64: 5 } }, 64), 5, 'Do not remove custom places beyond 24 from unrelated legacy tours');

  registrations = [];
  for (let i = 0; i < 15; i++) for (const n of [1, 2, 3]) registrations.push(reg(`Seed ${i}`, n, 1));
  for (const name of ['Zulu', 'Alpha']) for (const n of [1, 2]) registrations.push(reg(name, n, 2));
  let data = rules.getCircuitFinalists(tournaments, registrations, final);
  assert.equal(data.athletes.filter((r) => r.qualificato).length, 15);
  assert.equal(data.playoff.athletes.length, 2); assert.equal(data.playoff.places, 1);
  assert.ok(data.playoff.athletes.every((a) => data.athletes.find((r) => r.nome === a.nome).statoQualificazione === 'playoff'));
  const zulu = data.playoff.athletes.find((r) => r.nome === 'Zulu');
  const decided = { ...final, circuitPlayoffDecision: { fingerprint: data.playoff.fingerprint, athleteKeys: [rules.circuitAthleteKey(zulu)] } };
  data = rules.getCircuitFinalists(tournaments, registrations, decided);
  assert.equal(data.athletes.filter((r) => r.qualificato).length, 16);
  assert.equal(data.athletes.find((r) => r.nome === 'Zulu').qualificato, true, 'Alphabetical order does not award the place');
  assert.equal(data.athletes.find((r) => r.nome === 'Alpha').qualificato, false);
  assert.equal(rules.getCircuitFinalists(tournaments, registrations, { ...decided, circuitPlayoffDecision: { ...decided.circuitPlayoffDecision, athleteKeys: ['id:outsider'] } }).playoff.resolved, false);
  const changed = registrations.map((r) => ['Seed 0-1', 'Seed 0-2'].includes(r.id) ? { ...r, piazzamentoCircuito: 24 } : r);
  assert.equal(rules.getCircuitFinalists(tournaments, changed, decided).playoff.resolved, false);
  const withFinal = [...registrations, reg('Zulu', 1, 1, { torneo: 'Finale' })];
  assert.equal(rules.getCircuitLeaderboard(tournaments, withFinal, 'Tour Test').find((r) => r.nome === 'Zulu').punti, 180, 'Final starts from zero and does not add qualification points');

  // The real registration endpoint must enforce these rules even when called directly.
  class NextResponse extends Response { static json(body, options) { return new NextResponse(JSON.stringify(body), options); } }
  let apiRegistrations = registrations, apiTournaments = [...stages, { ...decided, formato: 'singolo', maxSquadre: 16 }], userId = 'Zulu', writes = 0;
  const context = vm.createContext({ ...rules, Response, NextResponse, console, auth: async () => ({ userId }), currentUser: async () => ({ firstName: 'Nome', lastName: 'Cognome', primaryEmailAddress: { emailAddress: `${userId}@example.test` } }), getAthleteName: () => 'Nome Cognome',
    updateRegistrationsAtomically: async (fn) => { const result = await fn(apiRegistrations, apiTournaments); if (result instanceof Response) return result; writes++; return result.result; }, sendConfirmationEmail: async () => ({ success: true }), sendPartnerInviteEmail: async () => ({ success: true }),
  });
  const route = fs.readFileSync('app/api/iscrizioni/registra/route.js', 'utf8').replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '').replace('export async function POST', 'async function POST');
  vm.runInContext(`${route}\nthis.post = POST;`, context);
  const post = () => context.post({ json: async () => ({ torneo: 'Finale', tel: '123' }) });
  assert.equal((await post()).status, 200); assert.equal(writes, 1);
  userId = 'Alpha'; assert.equal((await post()).status, 403); assert.equal(writes, 1);
  apiTournaments = [...stages, final]; userId = 'Zulu'; assert.equal((await post()).status, 403, 'Unresolved cutoff tie must be blocked on the server');
  apiRegistrations = [reg('Zulu', 1, 1), ...registrations.filter((r) => !r.id.startsWith('Zulu-'))];
  assert.equal((await post()).status, 403, 'One-stage participant cannot bypass eligibility through the API');

  // Render actual forms: all 24 inputs and tour sections must remain accessible.
  await swc.loadBindings();
  const displayComponents = {};
  for (const name of ['TourJourney', 'TourStandings']) {
    const result = await swc.transform(fs.readFileSync(`app/components/${name}.js`, 'utf8'), { filename: `${name}.js`, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const component = { exports: {} };
    vm.runInNewContext(result.code, { module: component, exports: component.exports, URLSearchParams, require: (id) => id === 'next/link' ? ({ children, ...props }) => React.createElement('a', props, children) : require(id) });
    displayComponents[`@/app/components/${name}`] = component.exports.default;
  }
  for (const [file, props] of [['app/components/CircuitFields.js', { value: { categoria: 'Giallo', circuitRole: 'tappa' }, onChange() {} }], ['app/components/GialloTourManagement.js', { tournaments, registrations, selectedCircuit: 'Tour Test', circuits: ['Tour Test'], onSelect() {}, onRefresh() {} }]]) {
    const compiled = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const mod = { exports: {} };
    vm.runInNewContext(compiled.code, { module: mod, exports: mod.exports, URLSearchParams, console, require(id) {
      if (id === '@/app/utils/circuit') return rules;
      if (id === '@/app/utils/tour-view') return tourView;
      if (displayComponents[id]) return displayComponents[id];
      if (id === '@/app/components/StaffHeader') return () => null;
      if (id === '@/app/utils/db') return {};
      if (id === 'next/link') return ({ children, href, ...rest }) => React.createElement('a', { href, ...rest }, children);
      return require(id);
    } });
    const html = require('react-dom/server').renderToStaticMarkup(React.createElement(mod.exports.default, props));
    if (file.includes('CircuitFields')) assert.match(html, /Punti per il 24° posto/);
    else { assert.match(html, /Finale e qualificati/); assert.match(html, /Punti tour 24° posto/); assert.match(html, /Spareggio al limite/); }
  }
  const ui = await swc.transform(fs.readFileSync('app/components/GialloTourManagement.js', 'utf8'), { filename: 'tour-ui.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  let values = [], cursor = 0, savedTours = [], latestEntries = registrations;
  const otherTour = { id: 'other', nome: 'Non modificare', categoria: 'Giallo', circuitName: 'Altro tour', circuitRole: 'tappa', circuitPointTable: { 1: 999 } };
  let latestTours = [...tournaments, otherTour];
  const uiModule = { exports: {} };
  vm.runInNewContext(ui.code, { module: uiModule, exports: uiModule.exports, console, URLSearchParams, window: { confirm: () => true }, require(id) {
    if (id === 'react') return { ...React, useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], (v) => { values[i] = typeof v === 'function' ? v(values[i]) : v; }]; } };
    if (id === '@/app/utils/circuit') return rules;
    if (id === '@/app/utils/tour-view') return tourView;
    if (displayComponents[id]) return displayComponents[id];
    if (id === '@/app/components/StaffHeader') return () => null;
    if (id === '@/app/utils/db') return { getTornei: async () => latestTours, getIscrizioni: async () => latestEntries, saveTornei: async (list) => { savedTours.push(structuredClone(list)); latestTours = list; } };
    if (id === 'next/link') return () => null;
    return require(id);
  } });
  const render = () => { cursor = 0; return uiModule.exports.default({ tournaments, registrations, selectedCircuit: 'Tour Test', circuits: ['Tour Test'], onSelect() {}, onRefresh() {} }); };
  const find = (n, predicate) => !n || typeof n !== 'object' ? null : predicate(n) ? n : React.Children.toArray(n.props?.children).map((child) => find(child, predicate)).find(Boolean);
  let tree = render();
  await find(tree, (n) => n.type === 'button' && n.props.children === 'Applica scala a tutto il tour').props.onClick();
  assert.equal(savedTours.length, 1);
  assert.equal(savedTours[0].find((t) => t.id === '1').circuitPointTable[24], 2);
  assert.deepEqual(savedTours[0].find((t) => t.id === 'other'), otherTour, 'Point-table change must stay within the selected tour');
  values[2] = { 4: ['id:Zulu'] }; tree = render();
  await find(tree, (n) => n.type === 'button' && n.props.children === 'Conferma esito dello spareggio').props.onClick();
  assert.equal(savedTours.length, 2);
  assert.deepEqual(savedTours[1].find((t) => t.id === '4').circuitPlayoffDecision.athleteKeys, ['id:Zulu']);
  latestEntries = changed; tree = render();
  await find(tree, (n) => n.type === 'button' && n.props.children === 'Conferma esito dello spareggio').props.onClick();
  assert.equal(savedTours.length, 2, 'A stale leaderboard must not save playoff decisions');
  assert.match(find(render(), (n) => n.props?.role === 'alert').props.children, /classifica è cambiata/);
  tree = render();
  await find(tree, (n) => n.type === 'button' && n.props.children === 'Pubblica tour').props.onClick();
  assert.equal(savedTours.length, 3);
  assert.equal(savedTours[2].find((t) => t.id === '1').circuitPublic, true);
  assert.equal(savedTours[2].find((t) => t.id === 'other').circuitPublic, undefined, 'Publication must not affect other tours');
  assert.deepEqual(savedTours[2].find((t) => t.id === '1').circuitPointTable, savedTours[1].find((t) => t.id === '1').circuitPointTable, 'Publication must not change scoring');
  console.log('Tour: best 2/3, attendance, 24-point table, cutoff playoff, stale decisions, legacy tours, API eligibility and UI passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
