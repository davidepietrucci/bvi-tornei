const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const ranking = url(fs.readFileSync('app/utils/ranking.js', 'utf8'));
  const scoring = url(fs.readFileSync('app/utils/match-scoring.js', 'utf8').replace('"./ranking"', JSON.stringify(ranking)));
  const scoringRules = await import(scoring);
  const progression = url(fs.readFileSync('app/utils/final-progression.js', 'utf8'));
  const rules = await import(url(fs.readFileSync('app/utils/final-scoring.js', 'utf8').replace('"./match-scoring"', JSON.stringify(scoring)).replace('"./final-progression"', JSON.stringify(progression))));
  const base = { phaseType: 'single', subPhaseType: 'direct', bracketSize: 4, bracketAssignments: { 'gold-s1-L': 'A', 'gold-s1-R': 'B', 'gold-s2-L': 'C', 'gold-s2-R': 'D' }, bracketMetadata: {}, tabellonePubblicato: true };
  const games = (config) => rules.finalMatchGroups(config).flatMap((g) => g.matches);
  const get = (config, id) => games(config).find((g) => g.id === id);
  const win = [[21, 17], [21, 15]], lose = [[15, 21], [18, 21]];
  assert.equal(get(base, 'gold-s1').bestOf, 3);
  assert.equal(get(base, 'gold-f1').ready, false);
  assert.throws(() => rules.applyFinalScore(base, 'gold-f1', win), /attende/);
  assert.throws(() => rules.applyFinalScore(base, 'gold-s1', [[21, 17]]), /Completa/);
  let config = rules.applyFinalScore(base, 'gold-s1', win).config;
  assert.equal(config.bracketMetadata['gold-s1'].scoreL, '2');
  assert.equal(config.bracketAssignments['gold-f1-L'], 'A');
  assert.equal(config.bracketAssignments['gold-f3-L'], 'B');
  assert.equal(get(config, 'gold-f1').ready, false);
  config = rules.applyFinalScore(config, 'gold-s2', win).config;
  assert.equal(get(config, 'gold-f1').ready, true);
  config = rules.applyFinalScore(config, 'gold-f1', win).config;
  config = rules.applyFinalScore(config, 'gold-f3', win).config;
  config = rules.applyFinalDetails(config, 'gold-f1', { court: '2', time: '18:00', status: 'finished' });
  assert.equal(config.bracketMetadata['gold-f1'].s1L, '21');
  const sameWinner = rules.applyFinalScore(config, 'gold-s1', [[21, 0], [21, 10]]);
  assert.deepEqual(sameWinner.cleared, []);
  const corrected = rules.applyFinalScore(config, 'gold-s1', lose);
  assert.ok(corrected.cleared.includes('gold-f1')); assert.ok(corrected.cleared.includes('gold-f3'));
  assert.equal(corrected.config.bracketAssignments['gold-f1-L'], 'B');
  assert.equal(corrected.config.bracketMetadata['gold-f1'].scoreL, undefined);
  assert.equal(corrected.config.bracketMetadata['gold-f1'].court, '2');
  assert.equal(corrected.config.bracketMetadata['gold-f1'].time, '18:00');
  assert.equal(config.bracketMetadata['gold-f1'].scoreL, '2', 'Source must not be mutated');
  const removed = rules.applyFinalScore(config, 'gold-s1', null);
  assert.equal(get(removed.config, 'gold-f1').ready, false);
  assert.equal(removed.config.bracketMetadata['gold-f1'].scoreL, undefined);
  const changedPair = rules.applyFinalAssignment(config, 'gold-s1-L', 'New team');
  assert.ok(changedPair.cleared.includes('gold-s1'));
  assert.ok(changedPair.cleared.includes('gold-f1'));
  const legacy = { ...base, bracketMetadata: { 'gold-s1': { scoreL: '21', scoreR: '0' }, 'gold-s2': { scoreL: '2', scoreR: '1' } } };
  assert.equal(get(legacy, 'gold-s1').bestOf, 1);
  assert.equal(get(legacy, 'gold-s1').score[0][1], '0');
  assert.equal(get(legacy, 'gold-s2').legacyResult, '2–1');
  assert.equal(rules.applyFinalDetails(legacy, 'gold-s2', { court: '3', time: '', status: 'finished' }).bracketMetadata['gold-s2'].s1L, undefined);
  const bye = rules.reconcileFinals({ ...base, bracketAssignments: { ...base.bracketAssignments, 'gold-s1-R': '—' } }).config;
  assert.equal(bye.bracketAssignments['gold-f1-L'], 'A');
  assert.equal(get(bye, 'gold-s1').ready, false);
  for (const size of [4, 8, 12, 16]) {
    const assignments = {}, prefix = size === 4 ? 's' : size === 8 ? 'q' : 'o', count = size === 4 ? 2 : size === 8 ? 4 : size === 12 ? 4 : 8;
    for (let i = 1; i <= count; i++) { assignments[`gold-${prefix}${i}-L`] = `Team ${i}A`; assignments[`gold-${prefix}${i}-R`] = `Team ${i}B`; }
    if (size === 12) for (let i = 1; i <= 4; i++) assignments[`gold-q${i}-L`] = `Bye ${i}`;
    let run = { ...base, bracketSize: size, bracketAssignments: assignments, bracketMetadata: {} };
    for (let pass = 0; pass < 40; pass++) {
      const game = games(run).find((g) => g.ready && !run.bracketMetadata[g.id]?.scoreL);
      if (!game) break;
      run = rules.applyFinalScore(run, game.id, game.bestOf === 3 ? win : [[21, 15]]).config;
    }
    assert.equal(run.bracketMetadata['gold-f1'].scoreL, '2', `Complete ${size}-team bracket`);
  }
  const intermediate = { ...base, phaseType: 'gold_silver', subPhaseType: 'groups', numGoldGironi: 2, teamsPerGoldGirone: 4, bracketAssignments: {}, bracketMetadata: {} };
  for (const group of ['A', 'B']) for (let i = 0; i < 4; i++) intermediate.bracketAssignments[`gold-${group}-${i}`] = `Gold ${group}${i}`;
  let rr = intermediate;
  assert.equal(get(rr, 'gold-s1').ready, false);
  for (const group of rules.finalMatchGroups(intermediate).filter((g) => /^gold-[AB]$/.test(g.id))) for (const game of group.matches) rr = rules.applyFinalScore(rr, game.id, [[21, 15]]).config;
  assert.equal(get(rr, 'gold-s1').ready, true);
  const pool = { ...intermediate, subPhaseType: 'pool_stepladder' };
  let poolRun = rules.applyFinalScore(pool, 'gold-A-m0', [[21, 0]]).config;
  poolRun = rules.applyFinalScore(poolRun, 'gold-A-m1', [[21, 15]]).config;
  assert.equal(get(poolRun, 'gold-A-m2').ready, true);
  poolRun = rules.applyFinalScore(poolRun, 'gold-A-m2', [[21, 16]]).config;
  const poolCorrection = rules.applyFinalScore(poolRun, 'gold-A-m0', [[15, 21]]);
  assert.ok(poolCorrection.cleared.includes('gold-A-m2'));
  let special = { ...intermediate, subPhaseType: 'custom_18', numGoldGironi: 4, numSilverGironi: 2, bracketAssignments: {}, bracketMetadata: {} };
  for (const category of ['gold', 'silver']) for (const group of category === 'gold' ? ['A', 'B', 'C', 'D'] : ['A', 'B']) for (let i = 0; i < 3; i++) special.bracketAssignments[`${category}-${group}-${i}`] = `${category} ${group}${i}`;
  let preSpecialFinal;
  for (let pass = 0; pass < 60; pass++) {
    const game = games(special).find((g) => g.ready && !special.bracketMetadata[g.id]?.scoreL);
    if (!game) break;
    if (game.id === 'pool-gold-1-m0') preSpecialFinal = structuredClone(special);
    special = rules.applyFinalScore(special, game.id, game.bestOf === 3 ? win : [[21, 16]]).config;
  }
  assert.equal(special.bracketMetadata['gold-f1'].scoreL, '2');
  assert.equal(special.bracketMetadata['silver-f1'].scoreL, '2');
  assert.ok(preSpecialFinal);
  const specialCorrection = rules.applyFinalScore(special, 'pool-gold-1-m0', [[16, 21]]);
  assert.ok(specialCorrection.cleared.includes('pool-gold-1-m2'), 'Custom pool correction must invalidate dynamically resolved downstream games');
  const double = { ...base, phaseType: 'double', bracketAssignments: { 'wb-s1-L': 'A', 'wb-s1-R': 'B', 'wb-s2-L': 'C', 'wb-s2-R': 'D' } };
  const doubleNext = rules.applyFinalScore(double, 'wb-s1', [[21, 15]]).config;
  assert.equal(doubleNext.bracketAssignments['wb-s1-L'], 'A', 'Do not clear seeded double-elimination semifinals when quarters do not exist');
  assert.equal(doubleNext.bracketAssignments['wb-f-L'], 'A');
  const oldDouble = { ...double, bracketAssignments: { ...double.bracketAssignments, 'wb-f1-L': 'A', 'wb-f1-R': 'C' }, bracketMetadata: { 'wb-s1': { scoreL: '21', scoreR: '15' }, 'wb-s2': { scoreL: '21', scoreR: '15' }, 'wb-f1': { scoreL: '21', scoreR: '15' } } };
  assert.equal(games(oldDouble).filter((g) => /^wb-f/.test(g.id)).length, 1, 'Historical double final must not be duplicated');
  assert.equal(rules.reconcileFinals(oldDouble).config.bracketAssignments['grand-final-L'], 'A');

  // Exercise the actual management save handler, including failed persistence and mode guard.
  await swc.loadBindings();
  const panelCode = await swc.transform(fs.readFileSync('app/components/tournament/FinalsSetupPanel.js', 'utf8'), { filename: 'setup.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const panelModule = { exports: {} };
  vm.runInNewContext(panelCode.code, { module: panelModule, exports: panelModule.exports, require });
  const markup = require('react-dom/server').renderToStaticMarkup(React.createElement(panelModule.exports.default, { config: { ...base, groupCompositionMethod: 'classifica' }, onChange() {}, onGenerate() {}, onSave() {}, onDelete() {}, onResults() {}, hasBracket: true }));
  assert.match(markup, /1 · Formula/); assert.match(markup, /2 · Qualificazioni/); assert.match(markup, /3 · Abbinamenti/);
  assert.doesNotMatch(markup, /Punti coppia|Punteggio finale/);
  const transformed = await swc.transform(fs.readFileSync('app/components/tournament/TeamFinals.js', 'utf8'), { filename: 'finals.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  let state = [], cursor = 0, writes = [], fail = false;
  const ScoreEntry = () => null, Setup = () => null;
  const mod = { exports: {} };
  vm.runInNewContext(transformed.code, { module: mod, exports: mod.exports, console, clearTimeout, URLSearchParams, window: { confirm: () => true },
    require(id) {
      if (id === 'react') return { ...React, useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; }, useEffect() {}, useMemo: (fn) => fn(), useRef: (v) => ({ current: v }), useImperativeHandle() {} };
      if (id === 'next/navigation') return { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() };
      if (id === '@/app/utils/final-scoring') return rules;
      if (id === '@/app/utils/match-scoring') return scoringRules;
      if (id === '@/app/components/tournament/MatchScoreEntry') return ScoreEntry;
      if (id === '@/app/components/tournament/FinalsSetupPanel') return Setup;
      if (id === '@/app/utils/giallo') return { isGiallo: () => false };
      if (id === '@/app/utils/tournament-workflow') return { saveWorkflowConfig: async (...args) => { if (fail) throw new Error('Offline'); writes.push(structuredClone(args)); } };
      if (id.startsWith('@/')) return {};
      return require(id);
    },
  });
  const render = () => { cursor = 0; const child = mod.exports.default({ tournament: { nome: 'Closed', stato: 'Concluso' }, embedded: true }).props.children; return child.type(child.props); };
  const find = (n, predicate) => !n || typeof n !== 'object' ? null : predicate(n) ? n : React.Children.toArray(n.props?.children).map((c) => find(c, predicate)).find(Boolean);
  state[2] = 'single'; state[4] = 4; state[5] = base.bracketAssignments; state[6] = {}; state[7] = true;
  let tree = render();
  assert.ok(find(tree, (n) => n.type === Setup));
  let editor = find(tree, (n) => n.type === ScoreEntry).props;
  fail = true;
  await assert.rejects(editor.onSave(get(base, 'gold-s1'), win), /Offline/);
  assert.equal(Object.keys(state[6]).length, 0, 'Failed save must not update persisted local score');
  fail = false;
  await editor.onSave(get(base, 'gold-s1'), win);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][2].bracketAssignments['gold-f1-L'], 'A', 'Save result and qualified teams atomically');
  tree = render(); editor = find(tree, (n) => n.type === ScoreEntry).props;
  editor.onDirtyChange(1); tree = render();
  const switchButton = find(tree, (n) => n.type === 'button' && n.props.children === 'Partite e risultati');
  await switchButton.props.onClick();
  assert.ok(find(render(), (n) => n.props?.role === 'alert'));
  console.log('Finals: 4/8/12/16 teams, intermediate groups, pool, byes, legacy scores, downstream resets and atomic UI saves passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
