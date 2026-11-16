const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  const loadUtil = async (file) => import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(file, 'utf8')).toString('base64')}`);
  const workflow = await loadUtil('app/utils/tournament-workflow.js');
  const giallo = await loadUtil('app/utils/giallo.js');
  const name = 'Tappa "Giallo & misto"';
  const url = new URL(workflow.managementHref({ tour: name, family: 'giallo', step: 'finals' }), 'https://example.test');
  assert.equal(url.searchParams.get('tour'), name);
  assert.equal(url.searchParams.get('fase'), 'finals');
  assert.match(workflow.managementHref({ step: 'invalid' }), /fase=prepare/);
  const originalFetch = global.fetch;
  const originalStorage = global.localStorage;
  let written = [], releases = [];
  global.localStorage = { setItem() {} };
  global.fetch = async (_, request) => {
    written.push(JSON.parse(request.body));
    return new Promise((resolve) => releases.push(() => resolve({ ok: true, json: async () => ({ success: true }) })));
  };
  try {
    const first = workflow.saveWorkflowConfig('gironi', 'test', { score: 1 });
    const second = workflow.saveWorkflowConfig('gironi', 'test', { score: 2 });
    await new Promise(setImmediate);
    assert.equal(written.length, 1);
    releases.shift()(); await first; await new Promise(setImmediate);
    assert.equal(written.length, 2);
    releases.shift()(); await second;
    assert.deepEqual(written.map((w) => w.data.score), [1, 2]);
    global.fetch = async () => ({ ok: false, json: async () => ({ error: 'Offline' }) });
    await assert.rejects(workflow.saveWorkflowConfig('gironi', 'test', {}), /Offline/);
    await assert.rejects(workflow.readWorkflowConfig('gironi', 'test'), /Offline/);
    global.fetch = async () => ({ ok: true, json: async () => ({ success: false }) });
    await assert.rejects(workflow.saveWorkflowConfig('gironi', 'test', {}), /Salvataggio non riuscito/);
    global.fetch = async () => ({ ok: true, json: async () => ({ success: true }) });
    await workflow.saveWorkflowConfig('gironi', 'test', {});
  } finally { global.fetch = originalFetch; global.localStorage = originalStorage; }

  // Exercise the real management navigation handlers without a browser or a database.
  await swc.loadBindings();
  const transformed = await swc.transform(fs.readFileSync('app/staff/gestione-torneo/page.js', 'utf8'), {
    filename: 'management.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  const Header = () => null;
  const tournament = { id: '1', nome: 'Prova', categoria: 'Maschile 2x2' };
  let stateValues, cursor, changes, replaced, flush;
  const compiledModule = { exports: {} };
  const context = vm.createContext({ module: compiledModule, exports: compiledModule.exports, console, URLSearchParams,
    window: { history: { state: {}, replaceState: (_, __, href) => replaced.push(href) }, confirm: () => true },
    require: (id) => {
      if (id === 'react') return { ...React, useEffect() {}, useCallback: (fn) => fn, useRef: () => ({ current: { flush: () => flush() } }),
        useState: (initial) => { const index = cursor++; return [index < stateValues.length ? stateValues[index] : initial, (value) => changes.push({ index, value })]; } };
      if (id === 'next/dynamic') return () => () => null;
      if (id === '@/app/components/TournamentSetupHeader') return Header;
      if (id.startsWith('@/app/components/')) return () => null;
      if (id === '@/app/utils/giallo') return giallo;
      if (id === '@/app/utils/tournament-workflow') return workflow;
      return require(id);
    },
  });
  vm.runInContext(transformed.code, context);
  const findHeader = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === Header) return node;
    return React.Children.toArray(node.props?.children).map(findHeader).find(Boolean);
  };
  const render = () => {
    cursor = 0; changes = []; replaced = [];
    stateValues = [[tournament], 'teams', tournament.nome, 'groups', {}, false, false, '', 0];
    return findHeader(compiledModule.exports.default()).props;
  };
  let props = render();
  let finishSave;
  flush = () => new Promise((resolve) => { finishSave = resolve; });
  const navigation = props.onStepChange('ranking');
  assert.equal(changes.some((c) => c.index === 3), false, 'Navigation must wait for save');
  finishSave(); await navigation;
  assert.equal(changes.find((c) => c.index === 3).value, 'ranking');
  assert.match(replaced[0], /fase=ranking/);
  props = render(); flush = async () => { throw new Error('Salvataggio fallito'); };
  await props.onStepChange('finals');
  assert.equal(changes.some((c) => c.index === 3), false);
  assert.equal(replaced.length, 0);
  assert.equal(changes.find((c) => c.index === 7 && c.value).value, 'Salvataggio fallito');
  for (const [file, step] of [['gironi', 'groups'], ['tabellone', 'finals'], ['classifica', 'ranking']]) {
    const legacy = fs.readFileSync(`app/staff/${file}/page.js`, 'utf8');
    assert.match(legacy, new RegExp(`step: "${step}"`));
    assert.match(legacy, /tour: params.tour/);
  }
  console.log('Unified workflow: encoded links, legacy routes, ordered saves, failed saves and save-before-navigation passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
