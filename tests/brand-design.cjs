const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');
const postcss = require('postcss');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  await swc.loadBindings();
  let pathname = '/', role = 'atleta';
  const compile = async (file, requireMock = require) => {
    const result = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const context = { exports: {}, require: requireMock };
    vm.runInNewContext(result.code, context); return context.exports.default;
  };
  const Icon = await compile('app/components/StaffIcon.js');
  const mocked = (name) => {
    if (name === 'react') return { ...React, useState: (initial) => [initial, () => {}], useEffect: () => {}, useRef: () => ({ current: null }) };
    if (name === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ push: () => {} }) };
    if (name === '@clerk/nextjs') return { useUser: () => ({ isLoaded: true, user: { firstName: 'Anna', publicMetadata: { role } } }), useClerk: () => ({ signOut: () => {} }) };
    if (name === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
    if (name === 'next/image') return ({ src, alt, width, height, className }) => React.createElement('img', { src, alt, width, height, className });
    if (name.endsWith('/StaffIcon')) return Icon;
    return require(name);
  };
  const Theme = await compile('app/components/BrandTheme.js', mocked);
  const renderTheme = (path) => { pathname = path; return renderToStaticMarkup(React.createElement(Theme, null, React.createElement('main', null, 'Content'))); };
  assert.match(renderTheme('/'), /bvi-theme bvi-public/);
  assert.match(renderTheme('/atleta/dashboard'), /bvi-theme bvi-athlete/);
  assert.match(renderTheme('/atleta/registrati'), /bvi-athlete/);
  assert.match(renderTheme('/live'), /bvi-live/); assert.match(renderTheme('/gironi'), /bvi-live/);
  assert.equal(renderTheme('/staff/dashboard'), '<main>Content</main>');
  assert.equal(renderTheme('/staff'), '<main>Content</main>');
  const Header = await compile('app/components/PublicHeader.js', mocked);
  let html = renderToStaticMarkup(React.createElement(Header, { active: 'Tour' }));
  for (const route of ['/#tornei', '/tour', '/atleta']) assert.ok(html.includes(`href="${route}"`));
  assert.ok(!html.includes('href="/live"'), 'Live entry points belong to tournaments, not the main header');
  assert.ok(!html.includes('href="/classifica"'), 'Standings belong to tournament detail pages, not the main header');
  assert.match(html, /href="\/tour" aria-current="page"/);
  const TournamentView = await compile('app/tornei/[id]/TournamentPublicView.js', name => {
    if (name === 'react') return { ...React, useState: initial => [initial, () => {}], useEffect() {}, useMemo: compute => compute() };
    if (name.endsWith('/giallo')) return { isGiallo: tournament => /giallo/i.test(tournament.categoria) };
    if (name.endsWith('/GialloTournament')) return () => null;
    if (name.endsWith('/ranking')) return { calculateSingleGroupStats: () => [], calculateUnifiedRanking: () => [] };
    return mocked(name);
  });
  for (const categoria of ['Giallo', 'Misto']) for (const stato of ['In Corso', 'Live', 'Iscrizioni Aperte', 'In Programmazione', 'Concluso']) {
    const nome = 'Tappa Gialla & Misto / Estate';
    const detail = renderToStaticMarkup(React.createElement(TournamentView, {
      tournament: { id: 'event', nome, categoria, stato }, confirmedRegistrations: [], gironiData: null, bracketData: null,
      isIndividual: categoria === 'Giallo', capacity: 24, isOpen: stato === 'Iscrizioni Aperte', isFull: false, placesLeft: 24,
      category: categoria, participantLabel: 'Atleti', heroImage: '/logo.png',
    }));
    assert.equal(detail.includes(`href="/live?tour=${encodeURIComponent(nome)}"`), ['In Corso', 'Live'].includes(stato), `${categoria}/${stato}: live link visibility`);
    assert.equal(detail.includes('Segui il Live'), ['In Corso', 'Live'].includes(stato));
  }
  const AthleteHeader = await compile('app/components/AthleteHeader.js', mocked);
  pathname = '/atleta/gironi'; role = 'atleta';
  html = renderToStaticMarkup(React.createElement(AthleteHeader));
  for (const route of ['/atleta/dashboard', '/atleta/iscrizioni', '/atleta/gironi', '/atleta/iscriviti', '/atleta/profilo', '/atleta/notifiche', '/tour']) assert.ok(html.includes(`href="${route}"`));
  assert.ok(!html.includes('href="/staff/dashboard"'));
  assert.match(html, /href="\/atleta\/gironi" aria-current="page"/);
  role = 'admin'; html = renderToStaticMarkup(React.createElement(AthleteHeader)); assert.ok(html.includes('href="/staff/dashboard"'));
  const BottomNav = await compile('app/components/AthleteBottomNav.js', mocked);
  html = renderToStaticMarkup(React.createElement(BottomNav, { notificheCount: 12 }));
  assert.match(html, /aria-label="Partite" aria-current="page"/); assert.match(html, /9\+/);
  const source = fs.readFileSync('app/components/AthleteHeader.js', 'utf8');
  assert.match(source, /event.key === "Escape"/); assert.match(source, /event.key !== "Tab"/); assert.match(source, /redirectUrl: "\/"/);
  postcss.parse(fs.readFileSync('app/brand.css', 'utf8')).walkRules((rule) => assert.ok(rule.selector.trim().startsWith('.bvi-theme'), `Unscoped brand style: ${rule.selector}`));
  for (const file of ['app/live/page.js', 'app/gironi/page.js']) {
    const liveSource = fs.readFileSync(file, 'utf8');
    assert.match(liveSource, /SponsorBanner/); assert.match(liveSource, /Fasi Finali/);
    assert.match(liveSource, /viewMode/); assert.ok(!liveSource.includes('<PublicLive />'), 'Keep the existing public Live workflow');
  }
  console.log('Unified brand: public/athlete styling, staff isolation, complete navigation, role-aware links, mobile match navigation, notifications and original Live structure passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
