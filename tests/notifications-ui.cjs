const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  await swc.loadBindings();
  const file = 'app/staff/notifiche/page.js', source = fs.readFileSync(file, 'utf8');
  const names = [...source.matchAll(/const \[(\w+),[^\]]+\] = useState\(/g)].map(match => match[1]);
  let states = [], cursor = 0, confirm = false, resolveRequest, calls = [];
  const hooks = { ...React, useEffect() {}, useRef: (initial) => ({ current: initial }), useState(initial) {
    const i = cursor++; if (!(i in states)) states[i] = initial;
    return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  } };
  const compiled = await swc.transform(source, { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const context = { exports: {}, console, window: { confirm: () => confirm },
    fetch: async (url, options) => { calls.push(JSON.parse(options.body)); return new Promise((resolve) => { resolveRequest = resolve; }); },
    require(name) { if (name === 'react') return hooks; if (name === '@clerk/nextjs') return { useUser: () => ({ user: { id: 'staff' }, isLoaded: true }) }; if (name.endsWith('/StaffHeader')) return () => null; return require(name); },
  };
  vm.runInNewContext(compiled.code, context);
  const Page = context.exports.default;
  const notice = { id: 'n1', titolo: 'Test', messaggio: 'Aggiornamento', tipo: 'info', source: 'manual', data: '2026-11-17T12:00:00Z', archived: false, audience: { type: 'all' } };
  const seed = (values = {}) => {
    states = []; cursor = 0;
    for (const [key, value] of Object.entries({ snapshot: { data: [notice], tournaments: [{ id: 't1', nome: 'Test' }], settings: { automaticEnabled: true } }, loading: false, titolo: 'Nuovo avviso', messaggio: 'Testo di prova', ...values })) states[names.indexOf(key)] = value;
    return Page();
  };
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  let tree = seed();
  let html = renderToStaticMarkup(tree);
  assert.match(html, /Solo nel portale/); assert.match(html, /push non sono attive/); assert.match(html, /Ultimi 200 avvisi/);
  assert.match(html, /Nuova notifica/); assert.match(html, /Notifiche automatiche/);
  const submit = nodes(tree).find(node => node.type === 'form').props.onSubmit;
  submit({ preventDefault() {} }); assert.equal(calls.length, 0, 'Cancellation must not send a message');
  confirm = true;
  submit({ preventDefault() {} }); submit({ preventDefault() {} });
  assert.equal(calls.length, 1, 'Repeated clicks must not send duplicate requests');
  assert.equal(calls[0].audience.type, 'all');
  assert.equal(states[names.indexOf('titolo')], 'Nuovo avviso', 'Keep the draft until server confirmation');
  resolveRequest({ ok: true, status: 200, json: async () => ({ success: true }) });
  await new Promise(setImmediate);
  assert.equal(states[names.indexOf('titolo')], ''); assert.match(states[names.indexOf('success')], /creata/);
  tree = seed(); nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  resolveRequest({ ok: false, status: 500, json: async () => ({ error: 'Database offline' }) });
  await new Promise(setImmediate);
  assert.equal(states[names.indexOf('titolo')], 'Nuovo avviso'); assert.equal(states[names.indexOf('success')], ''); assert.match(states[names.indexOf('error')], /offline/);
  tree = seed({ loadError: 'Network failure' }); html = renderToStaticMarkup(tree);
  assert.match(html, /role="alert"/); assert.match(html, /disabled=""/);
  tree = seed({ archived: 'archived' }); html = renderToStaticMarkup(tree); assert.match(html, /Nessuna notifica nei filtri/);
  assert.match(source, /controller.abort\(\)/); assert.match(source, /350/); assert.match(source, /json.success !== true/);
  console.log('Notification staff UI: portal-only scope, confirmation, duplicate-click lock, save-before-clearing, failed-save draft retention, filters and aborted athlete search passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
