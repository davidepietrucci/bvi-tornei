const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const swc = require('next/dist/build/swc');

const source = fs.readFileSync('app/components/tournament/MatchScoreEntry.js', 'utf8');
const loaded = (async () => {
  const rankingUrl = `data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/ranking.js', 'utf8')).toString('base64')}`;
  const rulesSource = fs.readFileSync('app/utils/match-scoring.js', 'utf8').replace('"./ranking"', JSON.stringify(rankingUrl));
  const rules = await import(`data:text/javascript;base64,${Buffer.from(rulesSource).toString('base64')}`);
  await swc.loadBindings();
  const { code } = await swc.transform(source, {
    filename: 'match-status-filters.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
  });
  return { code, rules };
})();

const fixture = () => [{ id: 'A', label: 'Girone A', matches: [
  { id: 'scheduled' },
  { id: 'live', status: 'in_progress' },
  { id: 'scored', score: [[21, 10]], status: 'in_progress' },
  { id: 'legacy', legacyResult: '21–18' },
  { id: 'waiting', ready: false, status: 'in_progress', score: [[21, 10]] },
  { id: 'invalid', status: 'finished', score: [[21, 21]] },
].map((m) => ({ left: ['Marco', 'Luca'], right: ['Paolo', 'Andrea'], bestOf: 1, target: 21, ready: true, score: [], ...m })) },
{ id: 'B', label: 'Girone B', matches: [] }];

function compile(code, rules, react, window) {
  const compiledModule = { exports: {} };
  vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, ...(window ? { window } : {}), require: (id) => {
    if (id === 'react') return react;
    if (id === '@/app/utils/match-scoring') return rules;
    return require(id);
  } });
  return compiledModule.exports.default;
}

const findAll = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => findAll(child, predicate))];
};
const find = (tree, predicate) => findAll(tree, predicate)[0];
const textOf = (node) => node === null || node === undefined || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : React.Children.toArray(node.props?.children).map(textOf).join('');
const tabs = (tree) => findAll(tree, (n) => n.props.role === 'tab');
const tab = (tree, index) => tabs(tree)[index];
const nav = (tree) => find(tree, (n) => n.props['aria-label'] === 'Scegli la partita');
const choices = (tree) => nav(tree) ? React.Children.toArray(nav(tree).props.children) : [];
const field = (tree, label) => find(tree, (n) => n.props['aria-label'] === label);
const button = (tree, label) => find(tree, (n) => n.type === 'button' && textOf(n) === label);
const groupButton = (tree, id) => find(tree, (n) => n.type === 'button' && textOf(n).startsWith(`Girone ${id}`));
const form = (tree) => find(tree, (n) => n.type === 'form');

function harness(code, rules) {
  let states = [], refs = [], effects = [], jobs = [], cursor, refCursor, effectCursor;
  const listeners = new Set();
  const h = { groups: fixture(), dirty: 0, calls: [], disabled: false, confirm: true };
  const Component = compile(code, rules, { ...React,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; },
    useMemo: (fn) => fn(),
    useEffect(fn, deps) {
      const i = effectCursor++;
      if (!effects[i] || deps.some((v, n) => v !== effects[i].deps[n])) jobs.push(() => {
        effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() };
      });
    },
  }, { confirm: () => h.confirm, addEventListener: (name, fn) => listeners.add(fn), removeEventListener: (name, fn) => listeners.delete(fn) });
  h.update = (match, changes) => { h.groups = h.groups.map((g) => ({ ...g, matches: g.matches.map((m) => m.id === match.id ? { ...m, ...changes } : m) })); };
  h.save = async (m, score, details) => { h.update(m, { score, ...details }); return true; };
  h.saveDetails = async (m, details) => { h.update(m, details); return true; };
  h.render = () => {
    cursor = 0; refCursor = 0; effectCursor = 0; jobs = [];
    const tree = Component({ groups: h.groups, disabled: h.disabled, onDirtyChange: (n) => { h.dirty = n; },
      onSave: (...args) => { h.calls.push(args[0].id); return h.save(...args); },
      onSaveDetails: (...args) => h.saveDetails(...args),
      onClear: async (m) => { h.update(m, { score: [], legacyResult: '', status: 'scheduled' }); return true; },
    });
    jobs.forEach((fn) => fn());
    return tree;
  };
  h.listeners = listeners;
  h.states = states;
  return h;
}

test('status filters count saved states, select visible matches and support keyboard navigation', async () => {
  const { code, rules } = await loaded;
  const h = harness(code, rules);
  let tree = h.render();
  assert.deepEqual(tabs(tree).map(textOf), ['Tutte6', 'Da giocare3', 'In corso1', 'Terminate2']);
  assert.equal(tab(tree, 0).props['aria-selected'], true);
  assert.equal(tab(tree, 0).props.tabIndex, 0);
  assert.equal(choices(tree).length, 6);
  tab(tree, 1).props.onClick(); tree = h.render();
  assert.deepEqual(choices(tree).map((n) => n.key), ['.$scheduled', '.$waiting', '.$invalid']);
  assert.match(textOf(choices(tree)[1]), /Partita 5.*In attesa di squadre/);
  choices(tree)[1].props.onClick(); tree = h.render();
  assert.equal(field(tree, 'Punti coppia 1, set 1').props.value, 21);
  assert.equal(find(tree, (n) => n.type === 'fieldset' && textOf(n).includes('Punteggio finale')).props.disabled, true);
  tab(tree, 0).props.onClick(); tree = h.render();
  assert.equal(choices(tree)[4].props['aria-pressed'], true, 'Keep current selection when still visible');
  tab(tree, 2).props.onClick(); tree = h.render();
  assert.equal(choices(tree).length, 1);
  assert.equal(choices(tree)[0].props['aria-pressed'], true);
  assert.match(textOf(form(tree)), /Partita 2 di 6/);
  tab(tree, 3).props.onClick(); tree = h.render();
  assert.equal(choices(tree).length, 2, 'Valid scores and legacy results override metadata');
  let focused = -1, prevented = false;
  tab(tree, 3).props.onKeyDown({ key: 'ArrowRight', preventDefault() { prevented = true; }, currentTarget: { parentElement: { querySelectorAll: () => [0, 1, 2, 3].map((i) => ({ focus() { focused = i; } })) } } });
  tree = h.render();
  assert.equal(prevented, true); assert.equal(focused, 0); assert.equal(tab(tree, 0).props['aria-selected'], true);
  for (const [key, expected] of [['End', 3], ['Home', 0], ['ArrowLeft', 3]]) {
    const active = tabs(tree).find((n) => n.props['aria-selected']);
    active.props.onKeyDown({ key, preventDefault() {}, currentTarget: { parentElement: { querySelectorAll: () => tabs(tree).map((n, i) => ({ focus() { focused = i; } })) } } });
    tree = h.render(); assert.equal(focused, expected); assert.equal(tab(tree, expected).props.tabIndex, 0);
  }
});

test('score and detail drafts survive empty filters/groups; discard and unload warnings remain available', async () => {
  const { code, rules } = await loaded;
  const h = harness(code, rules);
  let tree = h.render();
  field(tree, 'Punti coppia 1, set 1').props.onChange({ target: { value: '21' } }); tree = h.render();
  field(tree, 'Campo').props.onChange({ target: { value: 'Sabbia A' } }); tree = h.render();
  field(tree, 'Stato partita').props.onChange({ target: { value: 'in_progress' } }); tree = h.render();
  assert.equal(h.dirty, 1); assert.equal(h.listeners.size, 1);
  assert.equal(textOf(tab(tree, 1)), 'Da giocare3', 'Unsaved status must not change filtering');
  tab(tree, 2).props.onClick(); tree = h.render();
  field(tree, 'Punti coppia 2, set 1').props.onChange({ target: { value: '18' } }); tree = h.render();
  assert.equal(h.dirty, 2);
  groupButton(tree, 'B').props.onClick(); tree = h.render();
  assert.equal(form(tree), undefined); assert.ok(button(tree, 'Scarta le bozze')); assert.equal(h.dirty, 2);
  assert.deepEqual(tabs(tree).map(textOf), ['Tutte0', 'Da giocare0', 'In corso0', 'Terminate0']);
  groupButton(tree, 'A').props.onClick(); tree = h.render();
  assert.equal(field(tree, 'Punti coppia 2, set 1').props.value, '18');
  tab(tree, 1).props.onClick(); tree = h.render();
  assert.equal(field(tree, 'Punti coppia 1, set 1').props.value, '21');
  assert.equal(field(tree, 'Campo').props.value, 'Sabbia A');
  assert.equal(field(tree, 'Stato partita').props.value, 'in_progress');
  h.groups = h.groups.map((g) => ({ ...g, matches: g.matches.filter((m) => m.id !== 'live') }));
  tab(tree, 2).props.onClick(); tree = h.render();
  assert.equal(form(tree), undefined);
  assert.match(textOf(tree), /Nessuna partita con questo stato/);
  assert.ok(groupButton(tree, 'A')); assert.equal(tabs(tree).length, 4);
  h.confirm = false; button(tree, 'Scarta le bozze').props.onClick(); tree = h.render(); assert.equal(h.dirty, 1);
  h.confirm = true; button(tree, 'Scarta le bozze').props.onClick(); tree = h.render();
  assert.equal(h.dirty, 0); assert.equal(h.listeners.size, 0); assert.equal(h.calls.length, 0);
});

test('save lock protects selection and drafts, failures retain drafts and saved statuses refresh filters', async () => {
  const { code, rules } = await loaded;
  const h = harness(code, rules);
  let tree = h.render();
  tab(tree, 2).props.onClick(); tree = h.render();
  field(tree, 'Punti coppia 1, set 1').props.onChange({ target: { value: '21' } }); tree = h.render();
  field(tree, 'Punti coppia 2, set 1').props.onChange({ target: { value: '18' } }); tree = h.render();
  let finish;
  h.save = () => new Promise((resolve) => { finish = resolve; });
  const pending = button(tree, 'Salva risultato').props.onClick();
  // Old handlers in the same tick must respect the ref lock, before disabled props rerender.
  tab(tree, 0).props.onClick(); groupButton(tree, 'B').props.onClick(); button(tree, 'Scarta le bozze').props.onClick();
  await button(tree, 'Salva risultato').props.onClick();
  tree = h.render(); assert.equal(h.calls.length, 1); assert.equal(h.dirty, 1);
  assert.equal(tab(tree, 2).props['aria-selected'], true); assert.equal(groupButton(tree, 'A').props['aria-pressed'], true);
  assert.ok(tabs(tree).every((n) => n.props.disabled));
  finish(false); await pending; tree = h.render();
  assert.equal(field(tree, 'Punti coppia 2, set 1').props.value, '18'); assert.match(textOf(tree), /Salvataggio non confermato/);
  h.save = async () => { throw new Error('Offline'); };
  await button(tree, 'Salva risultato').props.onClick(); tree = h.render(); assert.match(textOf(tree), /Offline/); assert.equal(h.dirty, 1);
  h.save = async (m, score, details) => { h.update(m, { score, ...details }); return true; };
  await form(tree).props.onSubmit({ preventDefault() {} }); h.render(); tree = h.render();
  assert.equal(form(tree), undefined, 'Do not advance to a match outside the active filter');
  assert.equal(h.dirty, 0); assert.equal(textOf(tab(tree, 3)), 'Terminate3');
  tab(tree, 1).props.onClick(); tree = h.render();
  field(tree, 'Stato partita').props.onChange({ target: { value: 'in_progress' } }); tree = h.render();
  await button(tree, 'Salva gestione partita').props.onClick(); tree = h.render();
  assert.equal(textOf(tab(tree, 1)), 'Da giocare2'); assert.equal(textOf(tab(tree, 2)), 'In corso1');
  assert.match(textOf(choices(tree)[0]), /Partita 5/);
  tab(tree, 3).props.onClick(); tree = h.render();
  await button(tree, 'Rimuovi risultato salvato').props.onClick(); tree = h.render();
  assert.equal(textOf(tab(tree, 3)), 'Terminate2'); assert.equal(textOf(tab(tree, 1)), 'Da giocare3');
  h.disabled = true; tree = h.render(); tab(tree, 0).props.onClick(); tree = h.render();
  assert.equal(tab(tree, 3).props['aria-selected'], true);
});

test('server rendering works without window for populated, empty and missing groups', async () => {
  const { code, rules } = await loaded;
  const Component = compile(code, rules, React);
  for (const groups of [fixture(), [{ id: 'empty', label: 'Vuoto', matches: [] }], []]) {
    const html = renderToStaticMarkup(React.createElement(Component, { groups, onSave: async () => true }));
    assert.match(html, /role="tablist"/); assert.match(html, /aria-selected="true"/); assert.match(html, /role="tabpanel"/);
    if (!groups[0]?.matches.length) assert.match(html, /Non ci sono partite da segnare/);
  }
});
