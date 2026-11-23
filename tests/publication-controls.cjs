const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const rules = await import(url(fs.readFileSync('app/utils/giallo.js', 'utf8')));
  let config = rules.createGiallo(Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `Atleta ${i}` })));
  for (const group of config.groups) for (const game of rules.groupGames(group)) config = rules.setGialloScore(config, game.id, [21, 15]);
  config = { ...rules.startGialloFinals(config), published: true };
  const original = structuredClone(config);
  const source = fs.readFileSync('app/components/GialloTournament.js', 'utf8');
  const keys = [...source.slice(source.indexOf('function GialloPanel')).matchAll(/const \[(\w+),[^\]]+\]\s*=\s*useState\(/g)].map(m => m[1]);
  const values = {}, refs = []; let cursor, refCursor, pending = null, mode = 'success';
  const writes = [], saveRef = { current: null };
  const hooks = { ...React, useEffect() {}, useState(initial) {
    const key = keys[cursor++];
    if (!(key in values)) values[key] = key === 'config' ? config : key === 'loading' ? false : typeof initial === 'function' ? initial() : initial;
    return [values[key], value => { values[key] = typeof value === 'function' ? value(values[key]) : value; }];
  }, useRef(initial) { return refs[refCursor++] ||= { current: initial }; }, useImperativeHandle(ref, factory) { if (ref) ref.current = factory(); } };
  await swc.loadBindings();
  const compiled = await swc.transform(source, { filename: 'giallo-publication.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const context = { exports: {}, console, URLSearchParams, fetch: async (_, options) => {
    writes.push(JSON.parse(options.body));
    if (mode === 'pending') return new Promise(resolve => { pending = resolve; });
    return { ok: mode !== 'conflict', status: mode === 'conflict' ? 409 : 200, json: async () => ({ success: mode === 'success', ...(mode === 'success' ? {} : { error: 'Invio non confermato' }) }) };
  }, require(name) {
    if (name === 'react') return hooks;
    if (name.endsWith('/giallo')) return rules;
    if (name.endsWith('/match-scoring')) return {};
    if (name.endsWith('/MatchScoreEntry')) return () => null;
    if (name.endsWith('/GialloCompletionPanel')) return () => null;
    return require(name);
  } };
  vm.runInNewContext(compiled.code, context);
  function render() {
    cursor = refCursor = 0;
    const wrapper = context.exports.default({ tournament: { nome: 'Giallo' }, editable: true, saveRef, sharedPublication: true, workspaceMode: 'prepare', workflowView: 'summary' });
    const panel = React.Children.toArray(wrapper.props.children).find(child => typeof child.type === 'function');
    panel.type(panel.props);
  }
  render();
  assert.equal(await saveRef.current.publish('groups'), false);
  assert.equal(values.config.groupsPublished, false);
  assert.equal(values.config.finalsPublished, true, 'Hiding legacy groups cannot hide finals');
  assert.equal(JSON.stringify(values.config.groups), JSON.stringify(original.groups));
  assert.equal(JSON.stringify(values.config.finals), JSON.stringify(original.finals));
  render();
  mode = 'failure'; const before = JSON.stringify(values.config);
  await assert.rejects(saveRef.current.publish('finals'), /non confermata/);
  assert.equal(JSON.stringify(values.config), before, 'Failed writes cannot optimistically change visibility');
  render(); mode = 'pending';
  const request = saveRef.current.publish('finals');
  const count = writes.length;
  await assert.rejects(saveRef.current.publish('groups'), /Attendi/);
  assert.equal(writes.length, count, 'Double clicks must not send concurrent full-config writes');
  pending({ ok: true, json: async () => ({ success: true }) }); await request;
  render(); values.scoreDrafts = 1; render();
  await assert.rejects(saveRef.current.publish('groups'), /bozze/);
  values.scoreDrafts = 0; render(); mode = 'conflict';
  await assert.rejects(saveRef.current.publish('groups'), /non confermata/);
  assert.equal(values.conflict, true, 'Conflict must block future publication until reloading');
  render(); await assert.rejects(saveRef.current.publish('groups'), /Attendi/);
  assert.equal(JSON.stringify(original), JSON.stringify(config));
  console.log('Publication controls: legacy independence, preserved scores, confirmation-only state, double-click lock, draft guards and stale baseline conflicts passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
