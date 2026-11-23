const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  await swc.loadBindings();
  const calendar = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync('app/utils/athlete-area.js', 'utf8')).toString('base64')}`);
  const fixtures = [
    { id: 1, nome: 'Vecchio squadre', stato: 'Concluso', data: '15 Agosto 2026' },
    { id: 2, nome: 'Data assente', stato: 'Concluso', data: '' },
    { id: 3, nome: 'Novembre squadre', stato: 'Concluso', data: '01/11/2026' },
    { id: 4, nome: 'Tappa gialla', categoria: 'Giallo', stato: 'Concluso', data: '23 Novembre 2026' },
    { id: 5, nome: 'Secondo novembre', stato: 'Concluso', data: '2026-11-16' },
    { id: 6, nome: 'Futura aperta', stato: 'Iscrizioni Aperte', data: '31 Dicembre 2026' },
    { id: 7, nome: 'Data non valida', stato: 'Concluso', data: '31/02/2026' },
    { id: 8, nome: 'Stesso giorno', stato: 'Concluso', data: '2026-11-23' },
  ];
  const before = JSON.stringify(fixtures);
  let list = fixtures, values = [], cursor = 0, effects = [];
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useEffect(callback) { effects.push(callback); },
  };
  const source = fs.readFileSync('app/page.js', 'utf8');
  const compiled = await swc.transform(source, { filename: 'home.js', jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const context = { exports: {}, require: name => {
    if (name === 'react') return hooks;
    if (name === 'next/image') return props => React.createElement('img', { src: props.src, alt: props.alt });
    if (name.endsWith('/athlete-area')) return calendar;
    if (name.endsWith('/db')) return { getTornei: async () => list, getPublicIscrizioni: async () => [] };
    if (name.startsWith('@/app/components/')) return () => null;
    return require(name);
  } };
  vm.runInNewContext(compiled.code, context);
  const render = () => { cursor = 0; effects = []; return context.exports.default(); };
  const load = async input => { list = input; values = []; render(); effects[0](); await Promise.resolve(); return render(); };
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const text = node => node == null || node === false ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
  const archive = tree => nodes(tree).find(node => node.type === 'section' && text(node).includes('I tornei passati'));
  const names = tree => nodes(archive(tree)).filter(node => node.type === 'h3').map(text);
  const toggle = tree => nodes(archive(tree)).find(node => node.type === 'button');
  let tree = await load(fixtures);
  assert.deepEqual(names(tree), ['Tappa gialla', 'Stesso giorno', 'Secondo novembre']);
  assert.equal(toggle(tree).props['aria-expanded'], false);
  assert.equal(toggle(tree).props['aria-controls'], 'archivio-tornei');
  assert.match(text(toggle(tree)), /Mostra tutti/);
  assert.doesNotMatch(text(archive(tree)), /Tutte le classifiche/);
  toggle(tree).props.onClick(); tree = render();
  assert.deepEqual(names(tree), ['Tappa gialla', 'Stesso giorno', 'Secondo novembre', 'Novembre squadre', 'Vecchio squadre', 'Data assente', 'Data non valida']);
  assert.equal(toggle(tree).props['aria-expanded'], true);
  assert.match(text(toggle(tree)), /Mostra meno/);
  const html = renderToStaticMarkup(archive(tree));
  assert.match(html, /href="\/tornei\/4"/);
  assert.doesNotMatch(html, /href="\/classifica/);
  for (const article of nodes(archive(tree)).filter(node => node.type === 'article')) {
    const link = nodes(article).find(node => node.type === 'a' && text(node) === 'Vedi torneo →');
    assert(link, 'Every archived tournament must link to its complete detail page');
    assert.match(link.props.href, /^\/tornei\/\d+$/);
    assert.equal(link.props.href, nodes(article).find(node => node.type === 'h3').props.children.props.href);
    assert.match(link.props['aria-label'], /^Vedi torneo: /);
  }
  toggle(tree).props.onClick(); tree = render();
  assert.equal(names(tree).length, 3);
  assert.equal(JSON.stringify(fixtures), before, 'Sorting cannot mutate fetched tournaments');
  for (const count of [1, 2, 3]) {
    tree = await load(fixtures.filter(t => t.stato === 'Concluso').slice(0, count));
    assert.equal(names(tree).length, count); assert.equal(toggle(tree), undefined);
  }
  tree = await load([]); assert.equal(archive(tree), undefined);
  console.log('Home archive: all closed categories, newest-first written/Italian/ISO dates, stable ties, invalid dates last, three-card limit, expand/collapse, links and empty states passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
