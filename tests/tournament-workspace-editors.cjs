const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  await swc.loadBindings();
  const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const rankingUrl = url(fs.readFileSync('app/utils/ranking.js', 'utf8'));
  const scoringUrl = url(fs.readFileSync('app/utils/match-scoring.js', 'utf8').replace('"./ranking"', JSON.stringify(rankingUrl)));
  const scoring = await import(scoringUrl);
  const ranking = await import(rankingUrl);
  const progressionUrl = url(fs.readFileSync('app/utils/final-progression.js', 'utf8'));
  const finals = await import(url(fs.readFileSync('app/utils/final-scoring.js', 'utf8').replace('"./match-scoring"', JSON.stringify(scoringUrl)).replace('"./final-progression"', JSON.stringify(progressionUrl))));
  const groupConfig = { numGironi: 1, teamCounts: { A: 4 }, gironeTypes: { A: 'Pool' }, gironeSets: { A: '1 set' }, gironeAssignments: { A: { 0: 'A', 1: 'B', 2: 'C', 3: 'D' } }, matchMetadata: {}, pubblicato: false, rankingType: 'avulsa' };
  const finalConfig = { phaseType: 'single', subPhaseType: 'direct', bracketSize: 4, bracketAssignments: { 'gold-s1-L': 'A', 'gold-s1-R': 'B', 'gold-s2-L': 'C', 'gold-s2-R': 'D' }, bracketMetadata: {}, tabellonePubblicato: false };
  const nodes = (n) => !n || typeof n !== 'object' ? [] : [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)];
  const ScoreEntry = () => null;

  async function harness(kind, config) {
    const states = [], refs = [], memos = [], effects = [];
    let si, ri, mi, ei, jobs, reads = 0, failSave = false, writes = 0, flush, publish;
    const changed = (old, next) => !old || !next || old.length !== next.length || next.some((v, i) => !Object.is(v, old[i]));
    const hooks = { ...React,
      useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
      useRef(initial) { const i = ri++; return refs[i] ||= { current: initial }; },
      useMemo(fn, deps) { const i = mi++; if (!memos[i] || changed(memos[i].deps, deps)) memos[i] = { deps, value: fn() }; return memos[i].value; },
      useEffect(fn, deps) { const i = ei++; if (!effects[i] || changed(effects[i].deps, deps)) jobs.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
      useImperativeHandle(ref, fn) { const methods = fn(); flush = methods.flush; publish = methods.publish; },
    };
    const file = `app/components/tournament/Team${kind}.js`;
    const result = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const mod = { exports: {} };
    vm.runInNewContext(result.code, { module: mod, exports: mod.exports, console, URLSearchParams,
      clearTimeout() {}, setTimeout: () => 1, window: { confirm: () => true },
      require(id) {
        if (id === 'react') return hooks;
        if (id === 'next/navigation') return { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() };
        if (id === '@/app/utils/match-scoring') return scoring;
        if (id === '@/app/utils/final-scoring') return finals;
        if (id === '@/app/utils/ranking') return ranking;
        if (id === '@/app/utils/giallo') return { isGiallo: () => false };
        if (id === '@/app/utils/db') return { getIscrizioni: async () => [], syncAssignmentsWithIscrizioni: (a) => a };
        if (id === '@/app/utils/tournament-workflow') return {
          readWorkflowConfig: async (type) => { reads++; return structuredClone(type === 'gironi' ? kind === 'Groups' ? config : groupConfig : config); },
          saveWorkflowConfig: async () => { if (failSave) throw new Error('Offline'); writes++; },
        };
        if (id === '@/app/components/tournament/MatchScoreEntry') return ScoreEntry;
        if (id.startsWith('@/')) return () => null;
        return require(id);
      },
    });
    const summary = {}, notifications = [];
    const notify = (value) => { notifications.push(value); Object.assign(summary, value); };
    const props = { tournament: { nome: 'Workspace' }, embedded: true, active: true, onSummary: notify };
    function render() {
      si = ri = mi = ei = 0; jobs = [];
      let tree = mod.exports.default(props);
      if (kind === 'Finals') tree = tree.props.children.type(tree.props.children.props);
      for (const job of jobs) job();
      return tree;
    }
    async function settle() { let tree; for (let i = 0; i < 4; i++) { tree = render(); await Promise.resolve(); await Promise.resolve(); } return tree; }
    return { props, summary, notifications, render, settle, get reads() { return reads; }, get writes() { return writes; }, flush: () => flush(), publish: () => publish(), fail: (value) => { failSave = value; } };
  }

  for (const kind of ['Groups', 'Finals']) {
    const h = await harness(kind, kind === 'Groups' ? groupConfig : finalConfig);
    let tree = await h.settle();
    const nav = (t) => nodes(t).find((n) => n.type === 'nav');
    const editor = (t) => nodes(t).find((n) => n.type === ScoreEntry);
    const resultSection = (t) => nodes(t).find((n) => n.type === 'section' && nodes(n).some((child) => child.type === ScoreEntry));
    assert.equal(nav(tree).props.hidden, false, 'Standalone mode retains navigation');
    const matchCount = editor(tree).props.groups.flatMap((g) => g.matches).length;
    assert.equal(h.summary[kind === 'Groups' ? 'groupMatches' : 'finalMatches'], matchCount);
    assert.equal(h.summary[kind === 'Groups' ? 'groupsConfigured' : 'finalsConfigured'], true);
    assert.equal(h.summary[kind === 'Groups' ? 'groupCompleted' : 'finalCompleted'], 0);
    const initialReads = h.reads;
    const initialNotifications = h.notifications.length;
    h.props.onSummary = (value) => { h.notifications.push(value); Object.assign(h.summary, value); };
    await h.settle();
    assert.equal(h.reads, initialReads, 'Callback identity must not reload config');
    assert.equal(h.notifications.length, initialNotifications, 'Callback identity must not loop');
    h.props.workspaceMode = 'prepare'; tree = await h.settle();
    assert.equal(nav(tree).props.hidden, true);
    assert.equal(resultSection(tree).props.hidden, true);
    assert.ok(editor(tree), 'Prepare hides rather than unmounts the editor');
    h.props.workspaceMode = 'day'; tree = await h.settle();
    assert.equal(resultSection(tree).props.hidden, false);
    if (kind === 'Finals') assert.equal(nodes(tree).find((n) => n.props?.['aria-label'] === 'Visibilità pubblica della fase finale').props.hidden, true);
    const game = editor(tree).props.groups.flatMap((g) => g.matches).find((m) => m.ready);
    const score = game.bestOf === 3 ? [[21, 10], [21, 12]] : [[21, 10]];
    h.fail(true);
    await assert.rejects(editor(tree).props.onSave(game, score), /Offline/);
    tree = await h.settle();
    assert.equal(h.summary[kind === 'Groups' ? 'groupCompleted' : 'finalCompleted'], 0);
    h.fail(false);
    await editor(tree).props.onSave(game, score);
    tree = await h.settle();
    assert.equal(h.summary[kind === 'Groups' ? 'groupCompleted' : 'finalCompleted'], 1);
    await editor(tree).props.onClear(game);
    tree = await h.settle();
    assert.equal(h.summary[kind === 'Groups' ? 'groupCompleted' : 'finalCompleted'], 0);
    editor(tree).props.onDirtyChange(1); tree = await h.settle();
    assert.equal(h.summary.scoreDrafts, 1);
    await assert.rejects(h.flush(), /modifiche/);
    h.props.workspaceMode = 'prepare'; tree = await h.settle();
    assert.equal(h.summary.scoreDrafts, 1, 'Presentation changes preserve drafts and flush guards');
    const oldEditor = editor(tree);
    h.props.active = false; await h.settle();
    const count = h.notifications.length;
    await oldEditor.props.onSave(game, score);
    await h.settle();
    assert.equal(h.notifications.length, count, 'Inactive effects and async handlers do not publish stale summaries');
  }
  const partial = structuredClone(groupConfig);
  for (const kind of ['Groups', 'Finals']) {
    const p = await harness(kind, kind === 'Groups' ? groupConfig : finalConfig);
    p.props.sharedPublication = true; p.props.active = false;
    let tree = await p.settle();
    p.fail(true);
    await assert.rejects(p.publish(), /non confermata/);
    await p.settle();
    assert.equal(Boolean(p.summary[kind === 'Groups' ? 'groupsPublished' : 'finalsPublished']), false, 'Failed publication cannot change the header status');
    p.fail(false);
    assert.equal(await p.publish(), true);
    tree = await p.settle();
    assert.equal(p.summary[kind === 'Groups' ? 'groupsPublished' : 'finalsPublished'], true, 'Header publishing must work from another section');
    const scoreEditor = nodes(tree).find(node => node.type === ScoreEntry);
    scoreEditor.props.onDirtyChange(1); await p.settle();
    await assert.rejects(p.publish(), /bozze/);
  }
  delete partial.gironeAssignments.A[3];
  const h = await harness('Groups', partial);
  await h.settle();
  assert.equal(h.summary.groupsConfigured, false, 'Partial assignments are not fully configured');
  assert.ok(scoring.teamGroupMatches(groupConfig).flatMap((g) => g.matches).some((m) => !m.ready), 'Configured pools still await earlier results');
  console.log('Workspace editors: controlled modes, mounted editor, validated counts, callback stability, active gating, drafts and failed saves passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
