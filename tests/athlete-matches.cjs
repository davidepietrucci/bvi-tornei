const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const swc = require('next/dist/build/swc');

(async () => {
  const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const { personalMatchGroups, tournamentRegistrations } = await import(url(fs.readFileSync('app/utils/athlete-matches.js', 'utf8')));
  const registrations = [
    { id: 'mine', torneo: 'Test', stato: 'Approvata', giocatori: 'Anna Rossi & Bea Verdi' },
    { id: 'pending', torneo: 'Test', stato: 'In Attesa', giocatori: 'Pending' },
    { id: 'cancelled', torneo: 'Test', stato: 'Annullata', giocatori: 'Cancelled' },
    { id: 'other', torneo: 'Another', stato: 'Approvata', giocatori: 'Other' },
  ];
  const match = (id, left, right) => ({ id, left: [left], right: [right] });
  const model = { individual: false,
    groups: [{ label: 'Girone A', matches: [match('mine', 'Bea Verdi / Anna Rossi', 'Opponent'), match('not-mine', 'Anna Rossi & Another', 'Opponent'), match('partial', 'Rossi', 'Opponent')] }],
    finals: [{ label: 'Semifinali', matches: [match('semi', 'Opponent', ' Anna Rossi & Bea Verdi '), match('waiting', 'Vincente A', 'Vincente B')] }],
  };
  assert.equal(tournamentRegistrations(registrations, ' test ').length, 1);
  assert.deepEqual(personalMatchGroups(model, registrations, 'Test').flatMap((g) => g.matches.map((m) => m.id)), ['mine', 'semi']);
  assert.deepEqual(personalMatchGroups(model, registrations, 'Unknown'), []);
  assert.deepEqual(personalMatchGroups(model, [], 'Test'), []);
  assert.equal(model.groups[0].matches.length, 3, 'Personal filtering must not mutate the full view');
  const giallo = { individual: true, groups: [{ label: 'A', matches: [
    { id: 'first', left: ['Same Name'], right: ['Partner'], leftIds: ['mine'], rightIds: ['x'] },
    { id: 'homonym', left: ['Same Name'], right: ['Partner'], leftIds: ['someone-else'], rightIds: ['x'] },
  ] }], finals: [{ label: 'Finale', matches: [{ id: 'final', left: ['Changed partner'], right: ['Same Name'], leftIds: ['z'], rightIds: ['mine'] }] }] };
  assert.deepEqual(personalMatchGroups(giallo, registrations, 'Test').flatMap((g) => g.matches.map((m) => m.id)), ['first', 'final']);
  assert.deepEqual(personalMatchGroups(giallo, registrations.filter((r) => r.id !== 'mine'), 'Test'), []);
  const source = fs.readFileSync('app/components/AthletePersonalMatches.js', 'utf8');
  assert.match(source, /\/api\/atleta\/iscrizioni/);
  assert.match(source, /snapshot\?\.userId === userId/);
  assert.match(source, /snapshot\.tournament === selectedTorneo/);
  assert.match(source, /current !== request/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /setInterval\(load, 10000\)/);
  assert.match(source, /response\.ok/);
  assert.match(source, /role="alert"/);
  const page = fs.readFileSync('app/atleta/gironi/page.js', 'utf8');
  assert.match(page, /useState\("personal"\)/);
  assert.match(page, /Le mie partite/); assert.match(page, /Intero torneo/);
  assert.ok(!page.includes('Davide P.'));
  await swc.loadBindings();
  let states, cursor;
  const compiled = await swc.transform(source, { filename: 'AthletePersonalMatches.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const context = { exports: {}, require: (name) => {
    if (name === 'react') return { ...React, useEffect: () => {}, useState: () => [states[cursor++], () => {}] };
    if (name.endsWith('/athlete-matches')) return { personalMatchGroups, tournamentRegistrations };
    if (name.endsWith('/public-live')) return { filterLiveMatches: (groups) => groups.flatMap((g) => g.matches.map((m) => ({ ...m, group: g.label }))) };
    if (name.endsWith('/LiveMatchCard')) return ({ match }) => React.createElement('div', { 'data-match': match.id }, [...match.left, ...match.right].join(' vs '));
    if (name.endsWith('/AthleteCalendarLayout')) return ({ children, viewControl }) => React.createElement('main', null, viewControl, children);
    if (name.startsWith('@/app/components/')) return () => null;
    if (name.startsWith('@/app/utils/')) return {};
    return require(name);
  } };
  vm.runInNewContext(compiled.code, context);
  const snapshot = { userId: 'account-A', tournament: 'Test', tournaments: [{ nome: 'Test' }], registrations, model };
  const render = (data, error = '', selectedTorneo = 'Test') => {
    states = [data, error, 0]; cursor = 0;
    return renderToStaticMarkup(React.createElement(context.exports.default, { userId: 'account-A', selectedTorneo, onSelect: () => {}, viewControl: 'Intero torneo' }));
  };
  let html = render(snapshot);
  assert.match(html, /data-match="mine"/); assert.match(html, /data-match="semi"/);
  assert.ok(!html.includes('data-match="not-mine"'));
  html = render({ ...snapshot, userId: 'account-B' });
  assert.ok(!html.includes('data-match='), 'Never show the previous account’s fixtures');
  html = render(snapshot, '', 'Another');
  assert.ok(!html.includes('data-match='), 'Never show the previous tournament’s fixtures');
  html = render(snapshot, 'Network failure');
  assert.match(html, /role="alert"/); assert.ok(!html.includes('data-match='));
  html = render({ ...snapshot, registrations: [] });
  assert.match(html, /Non risultano iscrizioni approvate/);
  const layoutSource = fs.readFileSync('app/components/AthleteCalendarLayout.js', 'utf8');
  const layoutCompiled = await swc.transform(layoutSource, { filename: 'AthleteCalendarLayout.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const layoutContext = { exports: {}, require: (name) => {
    if (name.endsWith('/SponsorBanner')) return () => React.createElement('aside', null, 'Configured sponsors');
    if (name.startsWith('@/app/components/')) return () => null;
    return require(name);
  } };
  vm.runInNewContext(layoutCompiled.code, layoutContext);
  const { athleteCalendarBackground, default: Layout } = layoutContext.exports;
  assert.equal(athleteCalendarBackground({ categoria: '2x2 Maschile' }), '/images/maschile-bg.jpg');
  assert.equal(athleteCalendarBackground({ categoria: 'Femminile' }), '/images/femminile-bg.jpg');
  assert.equal(athleteCalendarBackground({ sfondo: '/custom.jpg' }), '/custom.jpg');
  assert.equal(athleteCalendarBackground({ categoria: 'Giallo' }), null);
  html = renderToStaticMarkup(React.createElement(Layout, { tournament: { nome: 'Test', stato: 'In corso', sfondo: '/custom.jpg' }, viewControl: 'Le mie partite / Intero torneo' }, 'Fixture content'));
  assert.match(html, /BVI Live · Area atleta/); assert.match(html, /Configured sponsors/);
  assert.match(html, /Fixture content/); assert.match(html, /Le mie partite \/ Intero torneo/);
  assert.match(html, /custom.jpg/); assert.match(html, /In corso/);
  console.log('Personal matches: account registrations, exact full-team labels, reversed pairs, giallo IDs/homonyms, finals, excluded registrations, unchanged full model and stale-request safeguards passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
