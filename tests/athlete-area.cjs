const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const swc = require('next/dist/build/swc');

(async () => {
  await swc.loadBindings();
  const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const helpers = await import(url(fs.readFileSync('app/utils/athlete-area.js', 'utf8')));
  const { calendarDay, nextAthleteRegistration, athletePhaseVisibility, notificationKey, sortNotifications, fetchAthleteData } = helpers;
  assert.equal(calendarDay('31/02/2026'), null);
  assert.equal(calendarDay('invalid'), null);
  assert.equal(calendarDay('2026-11-17'), calendarDay('17/11/2026'));
  assert.equal(calendarDay('22 novembre 2026'), calendarDay('2026-11-22'));
  assert.equal(calendarDay('12 Dicembre 2026'), calendarDay('2026-12-12'));
  assert.equal(calendarDay('31 febbraio 2026'), null);
  const now = new Date(2026, 10, 17, 18);
  const tournaments = [
    { nome: 'Concluso', data: '2026-12-01', stato: 'Concluso' },
    { nome: 'Passato', data: '2026-11-01', stato: 'Iscrizioni Chiuse' },
    { nome: 'Oggi', data: '17/11/2026', stato: 'Iscrizioni Chiuse' },
    { nome: 'Domani', data: '2026-11-18', stato: 'Iscrizioni Aperte' },
    { nome: 'No data', data: '', stato: 'Iscrizioni Aperte' },
  ];
  const registrations = tournaments.map((t) => ({ torneo: t.nome, data: '01/01/2026', stato: 'Approvata' }));
  assert.equal(nextAthleteRegistration(registrations, tournaments, now).torneo, 'Oggi');
  assert.equal(nextAthleteRegistration(registrations, tournaments, now).dataTorneo, '17/11/2026');
  assert.equal(nextAthleteRegistration(registrations.map((r) => r.torneo === 'Oggi' ? { ...r, stato: 'Rifiutata' } : r), tournaments, now).torneo, 'Domani');
  assert.equal(nextAthleteRegistration(registrations.map((r) => ({ ...r, stato: 'Annullata' })), tournaments, now), null);
  assert.equal(nextAthleteRegistration([{ torneo: 'Mancante', stato: 'Approvata' }], tournaments, now), null);
  assert.equal(nextAthleteRegistration([{ torneo: 'Tappa', stato: 'Approvata' }], [{ nome: 'Tappa', stato: 'Iscrizioni Aperte', data: '22 novembre 2026' }], now).dataTorneo, '22 novembre 2026');
  const publicBracket = { tabellonePubblicato: true, phaseType: 'gold_silver', subPhaseType: 'custom_18', bracketAssignments: {}, bracketMetadata: {}, numGoldGironi: 0, numSilverGironi: 0 };
  assert.deepEqual(athletePhaseVisibility(null, publicBracket), { initial: false, finals: true, intermediate: true });
  assert.equal(athletePhaseVisibility({ pubblicato: true }, { ...publicBracket, tabellonePubblicato: false }).finals, false);
  assert.equal(athletePhaseVisibility(null, { ...publicBracket, subPhaseType: 'pool_stepladder' }).intermediate, true);
  const notifications = [{ id: 1, titolo: 'A', data: '16/11/2026' }, { id: 2, titolo: 'B', data: '2026-11-17T18:00:00Z' }, { id: 3, data: '2026-11-17T19:00:00Z' }];
  assert.deepEqual(sortNotifications(notifications).map((n) => n.id), [3, 2, 1]);
  assert.notEqual(notificationKey(notifications[0]), notificationKey({ ...notifications[0], titolo: 'Edited' }));
  const originalFetch = global.fetch;
  try {
    let requestUrl;
    global.fetch = async (url) => { requestUrl = url; return { ok: true, json: async () => ({ data: [] }) }; };
    assert.deepEqual(await fetchAthleteData('tornei', { array: true }), []);
    assert.equal(new URL(requestUrl, 'https://example.test').searchParams.get('public'), 'true');
    global.fetch = async () => ({ ok: false });
    await assert.rejects(fetchAthleteData('notifiche', { array: true }), /Caricamento/);
    global.fetch = async () => ({ ok: true, json: async () => ({ data: null }) });
    await assert.rejects(fetchAthleteData('tornei', { array: true }), /non valida/);
    assert.equal(await fetchAthleteData('bracket'), null);
  } finally { global.fetch = originalFetch; }

  let states = [], cursor = 0;
  const fakeReact = { ...React, useEffect: () => {}, useState: (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  } };
  const storage = new Map();
  const localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  const compile = async (file, requireMock, extra = {}) => {
    const compiled = await swc.transform(fs.readFileSync(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
    const context = { exports: {}, require: requireMock, console, ...extra };
    vm.runInNewContext(compiled.code, context, { filename: file });
    return context.exports;
  };
  const hook = await compile('app/components/useAthleteNotifications.js', (name) => name === 'react' ? fakeReact : name.includes('athlete-area') ? helpers : require(name), { window: { localStorage, dispatchEvent: () => {} }, Event: class {} });
  let settings = hook.default('account-A');
  settings.markRead([notifications[0]]);
  cursor = 0; settings = hook.default('account-A');
  assert.equal(settings.isUnread(notifications[0]), false);
  assert.equal(settings.isUnread(notifications[1]), true);
  settings.toggle(); cursor = 0;
  assert.equal(hook.default('account-A').enabled, false);
  cursor = 0;
  assert.equal(hook.default('account-B').isUnread(notifications[0]), true, 'Read state must not leak across accounts');
  assert.equal(hook.readNotificationSettings(localStorage, 'account-B').enabled, true);
  assert.deepEqual(Array.from(hook.readNotificationSettings({ getItem: () => '{broken' }, 'account-A').read), []);
  localStorage.setItem = () => { throw new Error('Storage denied'); };
  cursor = 0; hook.default('account-A').toggle(); cursor = 0;
  assert.match(hook.default('account-A').error, /non permette/);

  const fakeComponent = () => null;
  const groupsPage = (await compile('app/atleta/gironi/page.js', (name) => {
    if (name === 'react') return fakeReact;
    if (name === 'next/navigation') return { useRouter: () => ({ push: () => {} }) };
    if (name === '@clerk/nextjs') return { useUser: () => ({ isLoaded: true, user: { id: 'A', fullName: 'Anna Test' } }) };
    if (name.includes('athlete-area')) return helpers;
    if (name.endsWith('/ranking')) return { getSchedule: () => [] };
    if (name.endsWith('/giallo')) return { isGiallo: () => false };
    if (name.startsWith('@/app/components/')) return fakeComponent;
    return require(name);
  })).default;
  function renderGroups(groups, bracket, tab = 'iniziali', loaded = 'Test') {
    states = [[{ id: 1, nome: 'Test', categoria: '2x2' }], 'Test', groups, bracket, tab, 'A', '', loaded, 0]; cursor = 0;
    return renderToStaticMarkup(React.createElement(groupsPage));
  }
  let html = renderGroups(null, publicBracket);
  assert.ok(html.includes('Fasi Finali'));
  assert.ok(!html.includes('Gironi Iniziali'));
  assert.ok(!html.includes('Gironi in Elaborazione'));
  assert.ok(html.includes('Gironi Intermedi'));
  html = renderGroups(null, publicBracket, 'finali', 'Previous tournament');
  assert.ok(!html.includes('Fasi Finali'), 'Never render the previous tournament after selection changes');
  html = renderGroups(null, { ...publicBracket, tabellonePubblicato: false });
  assert.ok(!html.includes('Fasi Finali'), 'Hidden bracket must remain hidden');
  let uiSettings = { enabled: true, error: '', isUnread: () => true, toggle: () => {}, markRead: () => {} };
  const wrapper = ({ children }) => React.createElement('div', null, children);
  wrapper.Content = wrapper; wrapper.Label = wrapper;
  const uiRequire = (name) => {
    if (name === 'react') return fakeReact;
    if (name === 'next/navigation') return { useRouter: () => ({ push: () => {} }) };
    if (name === '@clerk/nextjs') return { useUser: () => ({ isLoaded: true, user: { id: 'A', fullName: 'Anna Test', firstName: 'Anna' } }) };
    if (name.includes('athlete-area')) return helpers;
    if (name.includes('athleteIdentity')) return { getAthleteName: () => 'Anna Test' };
    if (name.includes('useAthleteNotifications')) return () => uiSettings;
    if (name === '@heroui/react') return { Card: wrapper, Button: wrapper, Chip: wrapper };
    if (name.startsWith('@/app/components/')) return fakeComponent;
    return require(name);
  };
  const dashboard = (await compile('app/atleta/dashboard/page.js', uiRequire)).default;
  const future = [{ id: 1, nome: 'Future beach tournament', data: '2099-11-18', stato: 'Iscrizioni Aperte' }];
  const mine = [{ torneo: 'Future beach tournament', data: '01/01/2026', stato: 'Approvata' }];
  states = [mine, future, notifications, false, '', 0, future]; cursor = 0;
  html = renderToStaticMarkup(React.createElement(dashboard));
  assert.ok(html.includes('2099-11-18')); assert.ok(!html.includes('01/01/2026'));
  states = [[], [], [], false, 'Network unavailable', 0, []]; cursor = 0;
  html = renderToStaticMarkup(React.createElement(dashboard));
  assert.ok(html.includes('role="alert"')); assert.ok(html.includes('Riprova'));
  assert.ok(!html.includes('Nessun torneo in programma'), 'A failed request must not masquerade as no registrations');
  const notificationPage = (await compile('app/atleta/notifiche/page.js', uiRequire)).default;
  states = [notifications, false, '', 0]; cursor = 0;
  html = renderToStaticMarkup(React.createElement(notificationPage));
  assert.ok(html.includes('Segna tutte come lette')); assert.ok(html.includes('Segna come letta'));
  assert.ok(!html.includes('Invalid Date'));
  states = [[], false, 'Network unavailable', 0]; cursor = 0;
  html = renderToStaticMarkup(React.createElement(notificationPage));
  assert.ok(html.includes('role="alert"')); assert.ok(!html.includes('Nessuna notifica'));
  console.log('Athlete area: upcoming event/date, independent finals, intermediate navigation, strict fetch errors, notification read state and account isolation passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
