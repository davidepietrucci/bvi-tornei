const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const { renderToStaticMarkup } = require('react-dom/server');
const postcss = require('postcss');

(async () => {
  await swc.loadBindings();
  let state = [], cursor = 0, effects = [], pathname = '/staff/pagamenti', user = { id: 'staff', firstName: 'Davide', publicMetadata: { role: 'staff' } };
  const pushes = [], exits = [];
  const fakeReact = { ...React, useState: (initial) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; }, useEffect: (effect) => { effects.push(effect); }, useRef: () => ({ current: null }) };
  const compile = async (file, mockedRequire) => {
    const compiled = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const context = { exports: {}, require: mockedRequire || require, console,
      fetch: async () => ({ json: async () => ({ status: { isConnected: true } }) }),
    };
    vm.runInNewContext(compiled.code, context); return context.exports;
  };
  const Icon = (await compile('app/components/StaffIcon.js')).default;
  const Header = (await compile('app/components/StaffHeader.js', (name) => {
    if (name === 'react') return fakeReact;
    if (name === 'next/navigation') return { useRouter: () => ({ push: (href) => pushes.push(href) }), usePathname: () => pathname };
    if (name === '@clerk/nextjs') return { useUser: () => ({ user, isLoaded: true }), useClerk: () => ({ signOut: (options) => exits.push(options) }) };
    if (name === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
    if (name === 'next/image') return (props) => React.createElement('img', props);
    if (name.endsWith('/StaffIcon')) return Icon;
    return require(name);
  })).default;
  const render = ({ role = 'staff', open = false, path = '/staff/pagamenti' } = {}) => {
    pathname = path; state = [open, role, 'Davide', true, 'Cloud connesso']; cursor = 0; effects = [];
    return renderToStaticMarkup(React.createElement(Header));
  };
  let html = render();
  for (const path of ['dashboard', 'tornei', 'gestione-torneo', 'tour', 'iscrizioni', 'pagamenti', 'notifiche', 'sponsors']) assert.ok(html.includes(`href="/staff/${path}"`));
  assert.ok(!html.includes('href="/staff/atleti"'), 'Admin-only menu item must remain hidden for staff');
  assert.match(html, /href="\/staff\/pagamenti"[^>]*aria-current="page"/);
  assert.match(html, /Sito pubblico/); assert.match(html, /Vai al contenuto/); assert.match(html, /Cloud connesso/);
  assert.match(html, /Organizzazione/); assert.match(html, /Amministrazione/);
  html = render({ role: 'admin', path: '/staff/tornei/nuovo' });
  assert.ok(html.includes('href="/staff/atleti"')); assert.match(html, /Nuovo torneo/);
  assert.match(html, /href="\/staff\/tornei"[^>]*aria-current="page"/);
  html = render({ open: true }); assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/); assert.match(html, /aria-expanded="true"/);
  user = null; render(); effects[0](); assert.ok(pushes.includes('/staff'));
  user = { id: 'A', firstName: 'Anna', publicMetadata: { role: 'staff' } }; render({ path: '/staff/atleti' }); effects[0](); assert.ok(pushes.includes('/staff/dashboard'));
  const headerSource = fs.readFileSync('app/components/StaffHeader.js', 'utf8');
  assert.match(headerSource, /event.key === "Escape"/); assert.match(headerSource, /event.key !== "Tab"/);
  assert.match(headerSource, /desktop.removeEventListener/); assert.match(headerSource, /redirectUrl: "\/staff"/);
  const css = fs.readFileSync('app/staff/staff.css', 'utf8');
  const parsed = postcss.parse(css);
  parsed.walkRules((rule) => assert.ok(rule.selector.trim().startsWith('.staff-workspace'), `Staff CSS must be scoped: ${rule.selector}`));
  assert.match(css, /--staff-blue: #0a1628/); assert.match(css, /--staff-yellow: #ffd700/);
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /focus-visible/);
  assert.match(css, /padding-left: 15rem/); assert.match(css, /max-width: 1600px/);
  assert.match(css, /\.staff-tournament-header/);
  assert.match(css, /\.staff-tournament-next[^}]*border-left: 3px solid var\(--staff-yellow\)/);
  assert.match(css, /Filtra partite per stato/);
  const managementSource = fs.readFileSync('app/staff/gestione-torneo/page.js', 'utf8');
  assert.match(managementSource, /staff-tournament-workspace/);
  const overviewSource = fs.readFileSync('app/components/tournament/TournamentOverview.js', 'utf8');
  assert.match(overviewSource, /staff-panel staff-tournament-next/);
  assert.match(overviewSource, /staff-button staff-button-yellow/);
  assert.ok(!overviewSource.includes('p-6 text-white'), 'Next action must use the shared light staff panel');
  const Layout = (await compile('app/staff/layout.js', (name) => name.endsWith('.css') ? {} : require(name))).default;
  html = renderToStaticMarkup(React.createElement(Layout, null, React.createElement('main', null, 'Staff content')));
  assert.match(html, /class="staff-workspace"/); assert.match(html, /Staff content/);
  const Heading = (await compile('app/components/StaffPageHeading.js')).default;
  html = renderToStaticMarkup(React.createElement(Heading, { title: 'Tornei', description: 'Gestione', actions: React.createElement('button', null, 'Nuovo') }));
  assert.match(html, /<h1/); assert.match(html, /Nuovo/);
  const dashboard = fs.readFileSync('app/staff/dashboard/page.js', 'utf8');
  assert.match(dashboard, /staff-stat/); assert.match(dashboard, /staff-quick-link/); assert.match(dashboard, /<details className="staff-danger-zone/);
  console.log('Staff design: scoped blue/yellow theme, all navigation sections, active nested routes, staff/admin permissions, tablet drawer accessibility, shared layout, dashboard and readable controls passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
