const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  const rules = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/giallo.js', 'utf8')).toString('base64')}`);
  const complete = n => {
    let config = rules.createGiallo(Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Atleta ${i}` })));
    for (const group of config.groups) for (const game of rules.groupGames(group)) config = rules.setGialloScore(config, game.id, [21, 15]);
    config = rules.startGialloFinals(config);
    for (let i = 0; i < 10; i++) {
      const pending = rules.gialloStages(config).flatMap(stage => stage.games).filter(game => !config.finals.results[game.id]);
      if (!pending.length) break;
      for (const game of pending) config = rules.setGialloScore(config, game.id, [21, 0]);
    }
    return { ...config, groupsPublished: true, finalsPublished: true };
  };
  for (const n of [12, 15, 16, 20, 24]) {
    const result = rules.publicGialloFinalResult(complete(n));
    assert.equal(result.complete, true); assert.equal(result.confirmed, false);
    assert.equal(result.rows.length, n);
    for (const place of [1, 2, 3, 4]) assert.equal(result.rows.filter(row => row.placement === place).length, 2);
  }
  const config = complete(12);
  const official = { ...config, completion: { by: 'secret-staff', previousPlacements: { secret: 3 }, rows: rules.gialloFinalStandings(config).rows.map(row => ({ ...row, points: 100, internal: 'secret' })) } };
  const confirmed = rules.publicGialloFinalResult(official);
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.rows[0].points, 100);
  assert.doesNotMatch(JSON.stringify(confirmed), /secret|internal|previousPlacements/);
  assert.equal(rules.publicGialloFinalResult({ ...official, finalsPublished: false }).rows.length, 0);
  const partial = rules.publicGialloFinalResult(rules.setGialloScore(config, 'bronze-0', null));
  assert.equal(partial.complete, false); assert.equal(partial.rows.length, 4);
  assert(partial.rows.every(row => row.placement <= 2));
  assert.equal(rules.publicGialloFinalResult(null).rows.length, 0);

  await swc.loadBindings();
  const compile = async (file, mocks) => {
    const compiled = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const context = { exports: {}, console, require: name => name in mocks ? mocks[name] : require(name) };
    vm.runInNewContext(compiled.code, context); return context.exports.default;
  };
  const Link = ({ children, ...props }) => React.createElement('a', props, children);
  const common = { 'next/link': Link, '@/app/utils/giallo': rules, '@/app/components/PublicHeader': () => null };
  let raw = official, yellowReads = 0;
  const tournament = { id: 'yellow', nome: 'Giallo concluso', stato: 'Concluso', categoria: 'Giallo' };
  const View = () => null;
  const ServerPage = await compile('app/tornei/[id]/page.js', { ...common,
    './TournamentPublicView': View, 'next/navigation': { notFound: () => { throw new Error('Not found'); } },
    '@/app/utils/db-server': { getTornei: async () => [tournament], getIscrizioni: async () => [], getGironi: async () => null, getBracket: async () => null, getGiallo: async () => { yellowReads++; return raw; } },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const props = async () => nodes(await ServerPage({ params: Promise.resolve({ id: 'yellow' }) })).find(node => node.type === View).props;
  let actual = await props();
  assert.equal(actual.gialloFinalResult.rows.length, 12);
  assert.doesNotMatch(JSON.stringify(actual.gialloFinalResult), /secret/);
  raw = { ...official, finalsPublished: false };
  assert.equal((await props()).gialloFinalResult.rows.length, 0);
  tournament.stato = 'In Corso';
  const count = yellowReads;
  assert.equal((await props()).gialloFinalResult, null); assert.equal(yellowReads, count);
  tournament.stato = 'Concluso'; raw = official;
  actual = await props();
  let stateCursor = 0;
  const states = [];
  const GialloDetails = () => React.createElement('p', null, 'Tutti gli incontri pubblicati');
  const ClientView = await compile('app/tornei/[id]/TournamentPublicView.js', { ...common,
    react: { ...React, useState(initial) { const index = stateCursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; }, useEffect() {}, useMemo: compute => compute() },
    'next/image': ({ src, alt }) => React.createElement('img', { src, alt }),
    '@/app/components/GialloTournament': GialloDetails,
    '@/app/utils/ranking': { calculateSingleGroupStats: () => [], calculateUnifiedRanking: () => [] },
  });
  const tree = props => { stateCursor = 0; return ClientView(props); };
  const render = props => renderToStaticMarkup(tree(props));
  let html = render(actual);
  assert.match(html, /Classifica finale del torneo giallo/); assert.match(html, /Confermata alla chiusura/);
  for (let i = 0; i < 12; i++) assert(html.includes(`Atleta ${i}`));
  assert.doesNotMatch(html, /Apri classifica e tabellone/);
  assert.doesNotMatch(html, /Tutti gli incontri pubblicati/);
  let details = nodes(tree(actual)).find(node => node.type === 'details' && node.props.id === 'partite-risultati-giallo');
  assert.equal(details.props.open, false, 'Results must be collapsed initially');
  assert.equal(nodes(tree(actual)).filter(node => node.type === GialloDetails).length, 0, 'Do not load or poll match details while collapsed');
  details.props.onToggle({ currentTarget: { open: true } });
  html = render(actual);
  assert.match(html, /Tutti gli incontri pubblicati/); assert.match(html, /Riduci/);
  assert.match(html, /Classifica finale del torneo giallo/);
  assert.equal(nodes(tree(actual)).filter(node => node.type === GialloDetails).length, 1);
  details = nodes(tree(actual)).find(node => node.type === 'details' && node.props.id === 'partite-risultati-giallo');
  details.props.onToggle({ currentTarget: { open: false } });
  assert.doesNotMatch(render(actual), /Tutti gli incontri pubblicati/);
  const activeProps = { ...actual, tournament: { ...actual.tournament, stato: 'In Corso' } };
  const openLink = nodes(tree(activeProps)).find(node => node.type === 'a' && node.props.href === '#partite-risultati-giallo');
  openLink.props.onClick();
  assert.match(render(activeProps), /Tutti gli incontri pubblicati/);
  nodes(tree(actual)).find(node => node.type === 'details').props.onToggle({ currentTarget: { open: false } });
  html = render({ ...actual, gialloFinalResult: partial });
  assert.match(html, /Piazzamenti disponibili/); assert.doesNotMatch(html, /Confermata alla chiusura/);
  html = render({ ...actual, gialloFinalResult: { rows: [] } });
  assert.match(html, /non è ancora disponibile o pubblicata/);
  assert.doesNotMatch(html, /Atleta 0/);
  // Existing closed-team podium remains available when switching away from giallo.
  html = render({ ...actual, tournament: { ...tournament, categoria: 'Misto' }, bracketData: { phaseType: 'single', bracketAssignments: { 'gold-f1-L': 'Coppia campione', 'gold-f1-R': 'Coppia argento' }, bracketMetadata: { 'gold-f1': { scoreL: 2, scoreR: 0 } } } });
  assert.match(html, /Coppia campione/); assert.match(html, /Coppia argento/);
  assert.doesNotMatch(html, /partite-risultati-giallo/);
  console.log('Public final standings: complete 12/15/16/20/24 athlete tables, shared places, confirmed and legacy results, partial podium, hidden-finals privacy, safe server props and existing team podium passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
