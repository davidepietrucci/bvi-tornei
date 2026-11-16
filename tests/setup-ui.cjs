// Render real setup components with isolated hook state; never connects to Clerk/Firestore.
// --serve provides a local, read-only visual preview of these fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const swc = require('next/dist/build/swc');

(async () => {
  await swc.loadBindings();
  const ruleSource = fs.readFileSync('app/utils/giallo.js', 'utf8');
  const rules = await import(`data:text/javascript;base64,${Buffer.from(ruleSource).toString('base64')}`);
  const tournament = { id: 'preview', nome: 'Giallo di prova', categoria: 'Giallo', stato: 'In Programmazione' };
  const athletes = Array.from({ length: 24 }, (_, i) => ({ id: String(i), name: `Atleta di prova ${i + 1}` }));
  let config = rules.createGiallo(athletes);
  for (const group of config.groups) for (const game of rules.groupGames(group)) config = rules.setGialloScore(config, game.id, [21, 16]);
  config = rules.startGialloFinals(config);
  const stageIds = ['prepare', 'groups', 'ranking', 'finals'];
  let states = [], cursor = 0;
  const load = async (file) => {
    const transformed = await swc.transform(fs.readFileSync(file, 'utf8'), {
      filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
    });
    const compiledModule = { exports: {} };
    const context = vm.createContext({ exports: compiledModule.exports, module: compiledModule, structuredClone, console, URLSearchParams,
      require: (name) => {
        if (name === 'react') return { ...React, useEffect() {}, useState(initial) {
          const value = cursor < states.length ? states[cursor] : initial;
          cursor++;
          return [value, () => {}];
        } };
        if (name === '@/app/utils/giallo') return rules;
        if (name === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
        return require(name);
      },
    });
    vm.runInContext(transformed.code, context);
    return compiledModule.exports.default;
  };
  const Giallo = await load('app/components/GialloTournament.js');
  const Header = await load('app/components/TournamentSetupHeader.js');
  const header = renderToStaticMarkup(React.createElement(Header, { family: 'giallo', tournaments: [tournament], selected: tournament.nome, onSelect() {} }));
  assert.match(header, /href="\/staff\/giallo/);
  assert.match(header, /href="\/staff\/gironi/);
  assert.match(header, /aria-label="Torneo giallo"/);
  const empty = renderToStaticMarkup(React.createElement(Header, { tournaments: [], onSelect() {} }));
  assert.match(empty, /Nessun torneo disponibile/);
  assert.match(empty, /disabled=""/);
  const pages = {};
  for (const stage of stageIds) {
    cursor = 0;
    states = [stage, 'A', config, athletes, false, false, '', '', 0, false];
    const markup = renderToStaticMarkup(React.createElement(Giallo, { tournament, editable: true, embedded: true }));
    assert.equal((markup.match(/aria-current="step"/g) || []).length, 1);
    assert.match(markup, /24/);
    assert.match(markup, /Dalle semifinali le coppie restano fisse/);
    assert.match(markup, /<details[^>]*><summary[^>]*>Modifica il sorteggio/);
    const groupSection = markup.match(/<div(?: hidden="")? class="space-y-5"><div><h3 class="text-xl font-bold">2\. Inserisci/);
    assert.ok(groupSection);
    assert.equal(groupSection[0].includes('hidden=""'), stage !== 'groups');
    pages[stage] = header + markup;
  }
  cursor = 0; states = ['prepare', 'A', null, [], false, false, '', '', 0, false];
  const noPlayers = renderToStaticMarkup(React.createElement(Giallo, { tournament, editable: true, embedded: true }));
  assert.match(noPlayers, /Numero non supportato/);
  assert.match(noPlayers, /disabled=""/);
  pages.empty = header + noPlayers;
  console.log('Setup UI: separate tournament paths, empty states, one active step and preserved hidden score forms passed.');
  if (!process.argv.includes('--serve') && !process.argv.includes('--write-preview')) return;

  // Only compiled CSS and synthetic HTML are exposed. No app API or production data.
  const cssRoot = path.join(process.cwd(), '.next', 'static');
  const css = fs.readdirSync(cssRoot, { recursive: true }).filter((name) => name.endsWith('.css'))
    .map((name) => fs.readFileSync(path.join(cssRoot, name), 'utf8')).join('\n');
  const html = (stage) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><title>Anteprima locale · Giallo</title></head><body style="margin:0;background:#f5f7fa;color:#0a1628"><p style="padding:12px;background:#fff7cc;font-size:12px">ANTEPRIMA LOCALE · Dati sintetici · Nessun salvataggio</p><main class="mx-auto max-w-7xl px-4 py-8">${pages[stage] || pages.prepare}</main></body></html>`;
  if (process.argv.includes('--write-preview')) {
    const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'bvi-setup-preview-'));
    for (const stage of Object.keys(pages)) fs.writeFileSync(path.join(directory, `${stage}.html`), html(stage));
    console.log(JSON.stringify({ directory }));
    return;
  }
  const server = require('node:http').createServer((request, response) => {
    if (request.url === '/preview.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); return; }
    const stage = new URL(request.url, 'http://127.0.0.1:4179').searchParams.get('stage') || 'prepare';
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html(stage));
  });
  server.listen(4179, '127.0.0.1', () => console.log('Read-only UI preview: http://127.0.0.1:4179/?stage=prepare'));
})().catch((error) => { console.error(error); process.exitCode = 1; });
