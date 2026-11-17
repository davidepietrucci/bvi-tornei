const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  const rankingUrl = `data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/ranking.js', 'utf8')).toString('base64')}`;
  const source = fs.readFileSync('app/utils/match-scoring.js', 'utf8').replace('"./ranking"', JSON.stringify(rankingUrl));
  const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const { validateMatchSets, applyTeamGroupScore, teamGroupMatches, completedMatch } = rules;
  assert.deepEqual(validateMatchSets([['21', '0']], 1, 21), [[21, 0]]);
  assert.deepEqual(validateMatchSets([[21, 18], [17, 21], [15, 10]], 3), [[21, 18], [17, 21], [15, 10]]);
  assert.deepEqual(validateMatchSets([[21, 18], [21, 19], ['', '']], 3), [[21, 18], [21, 19]]);
  for (const score of [[['', '']], [[21, '']], [[21, 21]], [[-1, 21]], [['1e3', 10]], [[1.5, 10]]]) assert.throws(() => validateMatchSets(score));
  assert.throws(() => validateMatchSets([[21, 20]], 1, 21), /vantaggio/);
  assert.throws(() => validateMatchSets([[21, 15]], 3), /due/);
  assert.throws(() => validateMatchSets([[21, 15], [21, 15], [21, 15]], 3), /già conclusa/);
  assert.throws(() => validateMatchSets([[21, 15], ['', ''], [21, 15]], 3), /ordine/);
  const config = { numGironi: 1, teamCounts: { A: 4 }, gironeSets: { A: '1 set' }, gironeTypes: { A: 'Pool' },
    gironeAssignments: { A: { 0: 'Squadra A', 1: 'Squadra B', 2: 'Squadra C', 3: 'Squadra D' } }, matchMetadata: {} };
  assert.equal(teamGroupMatches(config)[0].matches[2].ready, false);
  assert.throws(() => applyTeamGroupScore(config, 'A-2', [[21, 10]]), /attende/);
  let next = applyTeamGroupScore(config, 'A-0', [[21, 15]]).config;
  next = applyTeamGroupScore(next, 'A-1', [[21, 17]]).config;
  assert.equal(teamGroupMatches(next)[0].matches[2].ready, true);
  next = applyTeamGroupScore(next, 'A-2', [[21, 12]]).config;
  next.matchMetadata['A-2'].court = '2'; next.matchMetadata['A-2'].time = '16:00';
  const corrected = applyTeamGroupScore(next, 'A-0', [[15, 21]]);
  assert.ok(corrected.cleared.includes('A-2'));
  assert.equal(corrected.config.matchMetadata['A-2'].s1L, undefined);
  assert.equal(corrected.config.matchMetadata['A-2'].court, '2');
  assert.equal(corrected.config.matchMetadata['A-2'].time, '16:00');
  assert.equal(next.matchMetadata['A-2'].s1L, '21', 'Original config must not be mutated');
  assert.equal(completedMatch({ bestOf: 1, score: [[21, 10]], ready: false }), false);
  const threeSets = { ...config, gironeSets: { A: '3 set' }, matchMetadata: { 'A-0': { s3L: '10', s3R: '15', court: '1' } } };
  const straight = applyTeamGroupScore(threeSets, 'A-0', [[15, 10], [15, 12]]).config;
  assert.equal(straight.matchMetadata['A-0'].s3L, undefined);
  assert.equal(straight.matchMetadata['A-0'].court, '1');
  const removed = applyTeamGroupScore(next, 'A-0', null);
  assert.equal(rules.matchStatus(teamGroupMatches(removed.config)[0].matches[0]), 'scheduled');
  assert.equal(removed.config.matchMetadata['A-0'].s1L, undefined);
  assert.equal(removed.config.matchMetadata['A-2'].s1L, undefined);
  assert.equal(removed.config.matchMetadata['A-2'].court, '2');
  const live = rules.applyTeamMatchDetails(config, 'A-0', { court: ' Sabbia A ', time: '14:05', status: 'in_progress' });
  assert.equal(live.matchMetadata['A-0'].court, 'Sabbia A');
  assert.equal(rules.matchStatus(teamGroupMatches(live)[0].matches[0]), 'in_progress');
  assert.equal(live.matchMetadata['A-0'].s1L, undefined, 'Scheduling must not fabricate a result');
  assert.equal(config.matchMetadata['A-0'], undefined, 'Scheduling must not mutate the source');
  assert.throws(() => rules.applyTeamMatchDetails(config, 'A-0', { court: '1', time: '25:00', status: 'scheduled' }), /orario/);
  assert.throws(() => rules.applyTeamMatchDetails(config, 'A-0', { court: '1', time: '', status: 'finished' }), /risultato valido/);
  assert.throws(() => rules.applyTeamMatchDetails(config, 'A-2', { court: '1', time: '', status: 'in_progress' }), /squadre/);
  const finished = applyTeamGroupScore(live, 'A-0', [[21, 15]]).config;
  assert.equal(finished.matchMetadata['A-0'].status, 'finished');
  assert.equal(finished.matchMetadata['A-0'].court, 'Sabbia A');
  assert.throws(() => rules.applyTeamMatchDetails(finished, 'A-0', { court: '1', time: '', status: 'scheduled' }), /Rimuovi/);
  const moved = rules.applyTeamMatchDetails(finished, 'A-0', { court: '2', time: '15:00', status: 'finished' });
  assert.equal(moved.matchMetadata['A-0'].s1L, '21');
  assert.equal(applyTeamGroupScore(moved, 'A-0', null).config.matchMetadata['A-0'].court, '2');

  // Run the actual UI handlers with a minimal hook harness, without production APIs.
  await swc.loadBindings();
  const transformed = await swc.transform(fs.readFileSync('app/components/tournament/MatchScoreEntry.js', 'utf8'), {
    filename: 'score-entry.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  let state = [], cursor = 0, refs = [], refCursor = 0, effects = [], effectCursor = 0, jobs = [], saves = [], dirty = 0;
  let groups = ['A', 'B'].map((id) => ({ id, label: `Girone ${id}`, matches: [0, 1, 2].map((i) => ({ id: `${id}-${i}`, left: ['Marco', 'Luca'], right: ['Paolo', 'Andrea'], bestOf: 1, target: 21, ready: true, score: [] })) }));
  const compiledModule = { exports: {} };
  const context = vm.createContext({ exports: compiledModule.exports, module: compiledModule, console, window: { addEventListener() {}, removeEventListener() {}, confirm: () => true },
    require: (id) => {
      if (id === 'react') return { ...React,
        useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; },
        useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; },
        useMemo: (fn) => fn(),
        useEffect(fn, deps) { const i = effectCursor++; if (!effects[i] || deps.some((v, n) => v !== effects[i][n])) { effects[i] = deps; jobs.push(fn); } },
      };
      if (id === '@/app/utils/match-scoring') return rules;
      return require(id);
    },
  });
  vm.runInContext(transformed.code, context);
  let saveBehavior = async (match, score) => {
    groups = groups.map((g) => ({ ...g, matches: g.matches.map((m) => m.id === match.id ? { ...m, score } : m) }));
    return true;
  };
  let detailBehavior = async (match, details) => {
    groups = groups.map((g) => ({ ...g, matches: g.matches.map((m) => m.id === match.id ? { ...m, ...details } : m) }));
    return true;
  };
  const render = () => {
    cursor = 0; refCursor = 0; effectCursor = 0; jobs = [];
    const tree = compiledModule.exports.default({ groups, onDirtyChange: (n) => { dirty = n; }, onSave: async (m, s, details) => { saves.push(m.id); return saveBehavior(m, s, details); }, onSaveDetails: (m, details) => detailBehavior(m, details) });
    for (const effect of jobs) effect();
    return tree;
  };
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    return React.Children.toArray(node.props?.children).map((child) => find(child, predicate)).find(Boolean);
  };
  const input = (tree, side) => find(tree, (n) => n.type === 'input' && n.props['aria-label'] === `Punti coppia ${side}, set 1`);
  const form = (tree) => find(tree, (n) => n.type === 'form');
  let tree = render();
  input(tree, 1).props.onChange({ target: { value: '21' } }); tree = render();
  input(tree, 2).props.onChange({ target: { value: '18' } }); tree = render();
  assert.equal(saves.length, 0, 'Typing must never persist partial scores');
  assert.equal(dirty, 1);
  const groupButton = (t, id) => find(t, (n) => n.type === 'button' && React.Children.toArray(n.props.children)[0] === `Girone ${id}`);
  groupButton(tree, 'B').props.onClick(); tree = render();
  groupButton(tree, 'A').props.onClick(); tree = render();
  assert.equal(input(tree, 1).props.value, '21');
  assert.equal(input(tree, 2).props.value, '18');
  saveBehavior = async () => { throw new Error('Connessione assente'); };
  const selectedBeforeSave = state[1];
  await form(tree).props.onSubmit({ preventDefault() {} }); tree = render();
  assert.equal(state[1], selectedBeforeSave);
  assert.equal(input(tree, 2).props.value, '18');
  assert.equal(find(tree, (n) => n.props?.role === 'alert').props.children, 'Connessione assente');
  let finish;
  saveBehavior = (m, score) => new Promise((resolve) => { finish = () => { groups = groups.map((g) => ({ ...g, matches: g.matches.map((n) => n.id === m.id ? { ...n, score } : n) })); resolve(true); }; });
  const pending = form(tree).props.onSubmit({ preventDefault() {} }); tree = render();
  assert.equal(state[1], selectedBeforeSave, 'Next match must wait for server confirmation');
  finish(); await pending; tree = render(); tree = render();
  assert.equal(state[1], 'A-1'); assert.equal(dirty, 0);
  assert.equal(completedMatch(groups[0].matches[0]), true);
  assert.equal(input(tree, 1).props.value, '');
  const field = (t, label) => find(t, (n) => n.props?.['aria-label'] === label);
  const detailsButton = (t) => find(t, (n) => n.type === 'button' && n.props.children === 'Salva gestione partita');
  field(tree, 'Campo').props.onChange({ target: { value: 'Sabbia A' } }); tree = render();
  field(tree, 'Orario').props.onChange({ target: { value: '14:30' } }); tree = render();
  field(tree, 'Stato partita').props.onChange({ target: { value: 'in_progress' } }); tree = render();
  assert.equal(dirty, 1);
  groupButton(tree, 'B').props.onClick(); tree = render();
  groupButton(tree, 'A').props.onClick(); tree = render();
  assert.equal(field(tree, 'Campo').props.value, 'Sabbia A');
  assert.equal(field(tree, 'Stato partita').props.value, 'in_progress');
  detailBehavior = async () => { throw new Error('Errore gestione partita'); };
  await detailsButton(tree).props.onClick(); tree = render();
  assert.equal(field(tree, 'Orario').props.value, '14:30');
  assert.equal(find(tree, (n) => n.props?.role === 'alert').props.children, 'Errore gestione partita');
  detailBehavior = async (match, details) => {
    groups = groups.map((g) => ({ ...g, matches: g.matches.map((m) => m.id === match.id ? { ...m, ...details } : m) }));
    return true;
  };
  await detailsButton(tree).props.onClick(); tree = render();
  assert.equal(dirty, 0); assert.equal(state[1], 'A-1', 'Scheduling must not advance to another match');
  assert.equal(groups[0].matches[1].score.length, 0);
  field(tree, 'Campo').props.onChange({ target: { value: 'Campo finale' } }); tree = render();
  input(tree, 1).props.onChange({ target: { value: '21' } }); tree = render();
  input(tree, 2).props.onChange({ target: { value: '16' } }); tree = render();
  saveBehavior = async (match, score, details) => {
    assert.equal(details.court, 'Campo finale'); assert.equal(details.status, 'finished');
    groups = groups.map((g) => ({ ...g, matches: g.matches.map((m) => m.id === match.id ? { ...m, score, ...details } : m) }));
    return true;
  };
  await form(tree).props.onSubmit({ preventDefault() {} }); render(); tree = render();
  assert.equal(dirty, 0); assert.equal(groups[0].matches[1].status, 'finished');
  console.log('Match scoring: validation, best-of-three, zero points, pool dependencies, local drafts, failed saves and save-before-next passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
