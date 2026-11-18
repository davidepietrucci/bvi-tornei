const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

(async () => {
  const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const urls = {}, helpers = {};
  for (const [name, dependencies] of [['ranking', []], ['match-scoring', ['ranking']], ['final-progression', []], ['final-scoring', ['match-scoring', 'final-progression']], ['giallo', []], ['circuit', []], ['athlete-area', []], ['public-live', ['match-scoring', 'final-scoring', 'giallo', 'ranking']], ['notifications', ['circuit', 'public-live', 'match-scoring']]]) {
    let source = fs.readFileSync(`app/utils/${name}.js`, 'utf8');
    for (const dependency of dependencies) source = source.replaceAll(`"./${dependency}"`, JSON.stringify(urls[dependency]));
    urls[name] = url(source); helpers[name] = await import(urls[name]);
  }
  const { visibleNotifications, tournamentNotifications, validateNotificationText } = helpers.notifications;
  const registrations = [
    { id: 'r1', torneo: 'Test', giocatori: 'Anna & Bea', atletaUserId1: 'user_A', atletaEmail1: 'anna@example.test', atletaUserId2: 'user_B', stato: 'Approvata' },
    { id: 'r2', torneo: 'Test', giocatori: 'Carla & Dora', atletaUserId1: 'user_C', stato: 'Approvata' },
    { id: 'r3', torneo: 'Test', giocatori: 'Elena & Fede', atletaUserId1: 'user_E', stato: 'Approvata' },
    { id: 'cancelled', torneo: 'Cancelled', atletaUserId1: 'user_A', stato: 'Annullata' },
  ];
  const notices = [
    { id: 'all', audience: { type: 'all' }, titolo: 'General' },
    { id: 'tour', audience: { type: 'tournament', tournamentName: 'Test' }, titolo: 'Test', createdBy: 'secret', href: '/atleta/gironi?tour=Test' },
    { id: 'private', audience: { type: 'athlete', userId: 'user_A' } },
    { id: 'other', audience: { type: 'athlete', userId: 'user_C' } },
    { id: 'match', audience: { type: 'registrations', registrationIds: ['r1'] } },
    { id: 'cancel', audience: { type: 'tournament', tournamentName: 'Cancelled' } },
    { id: 'archived', archived: true, audience: { type: 'all' } },
    { id: 'expired', expiresAt: '2000-01-01', audience: { type: 'all' } },
    { id: 'unsafe', href: 'javascript:alert(1)', audience: { type: 'all' } },
    { id: 'invalid', audience: { type: 'unknown' } },
  ];
  const visible = visibleNotifications(notices, 'user_A', 'anna@example.test', registrations);
  assert.deepEqual(visible.map(n => n.id), ['all', 'tour', 'private', 'match', 'unsafe']);
  assert.equal(visible.find(n => n.id === 'unsafe').href, undefined);
  assert.equal(visible[1].createdBy, undefined); assert.equal(visible[1].audience, undefined);
  assert.deepEqual(visibleNotifications(notices, 'user_B', '', registrations).map(n => n.id), ['all', 'tour', 'match', 'unsafe'], 'A registered partner must receive tournament and match notices');
  assert.deepEqual(visibleNotifications(notices, 'new-account', 'anna@example.test', registrations).map(n => n.id), ['all', 'tour', 'match', 'unsafe'], 'Legacy registrations can match the verified account email, but personal notices require account ID');
  assert.deepEqual(visibleNotifications(notices, 'outsider', '', registrations).map(n => n.id), ['all', 'unsafe']);
  assert.throws(() => validateNotificationText({ titolo: '', messaggio: 'test', tipo: 'info' }));
  assert.throws(() => validateNotificationText({ titolo: 'A', messaggio: 'B'.repeat(2001), tipo: 'info' }));
  assert.throws(() => validateNotificationText({ titolo: {}, messaggio: 'test', tipo: 'info' }));
  assert.equal(validateNotificationText({ titolo: ' A ', messaggio: ' B ', tipo: 'info' }).titolo, 'A');
  const groups = { pubblicato: true, numGironi: 1, teamCounts: { A: 3 }, gironeTypes: {}, gironeSets: { A: '1 set' }, gironeAssignments: { A: { 0: 'Anna & Bea', 1: 'Carla & Dora', 2: 'Elena & Fede' } }, matchMetadata: {} };
  const time = '2026-11-17T12:00:00Z';
  assert.equal(tournamentNotifications('gironi', null, groups, 'Test', registrations, time)[0].audience.type, 'tournament');
  assert.equal(tournamentNotifications('gironi', groups, groups, 'Test', registrations, time).length, 0);
  assert.equal(tournamentNotifications('gironi', groups, { ...groups, pubblicato: false }, 'Test', registrations, time).length, 0);
  let changed = { ...groups, matchMetadata: { 'A-0': { court: '2', time: '15:20' } } };
  let automatic = tournamentNotifications('gironi', groups, changed, 'Test', registrations, time);
  assert.equal(automatic.length, 1); assert.match(automatic[0].titolo, /Campo o orario/); assert.equal(automatic[0].audience.registrationIds.length, 2);
  assert.equal(automatic[0].data, time); assert.ok(automatic[0].href.startsWith('/atleta/gironi?'));
  changed = { ...groups, matchMetadata: { 'A-0': { status: 'in_progress' } } };
  assert.match(tournamentNotifications('gironi', groups, changed, 'Test', registrations, time)[0].titolo, /in corso/);
  changed = { ...groups, matchMetadata: { 'A-0': { s1L: '21', s1R: '15', status: 'finished' } } };
  assert.match(tournamentNotifications('gironi', groups, changed, 'Test', registrations, time)[0].titolo, /Risultato/);
  assert.match(tournamentNotifications('gironi', changed, groups, 'Test', registrations, time)[0].titolo, /Risultato/);
  const finals = { tabellonePubblicato: true, phaseType: 'single', bracketSize: 4, bracketAssignments: { 'gold-s1-L': 'Anna & Bea', 'gold-s1-R': 'Carla & Dora' }, bracketMetadata: {} };
  assert.match(tournamentNotifications('bracket', null, finals, 'Test', registrations, time)[0].titolo, /Fasi finali/);
  assert.equal(tournamentNotifications('bracket', finals, { ...finals, bracketMetadata: { 'gold-s1': { court: '3' } } }, 'Test', registrations, time).length, 1);
  const yellow = helpers.giallo.createGiallo(Array.from({ length: 12 }, (_, i) => ({ id: `y${i}`, name: `Atleta ${i}` })));
  yellow.published = true;
  const game = helpers.giallo.groupGames(yellow.groups[0])[0];
  automatic = tournamentNotifications('giallo', yellow, { ...yellow, matchMetadata: { [game.id]: { court: '1' } } }, 'Giallo', [], time);
  assert.equal(automatic.length, 1); assert.equal(automatic[0].audience.registrationIds.length, 4);
  const groupsOnly = { ...yellow, groupsPublished: true, finalsPublished: false };
  assert.equal(tournamentNotifications('giallo', groupsOnly, { ...groupsOnly, finalsPublished: true }, 'Giallo', [], time)[0].titolo, 'Fasi finali pubblicate');
  assert.equal(tournamentNotifications('giallo', groupsOnly, { ...groupsOnly, groupsPublished: false }, 'Giallo', [], time).length, 0);
  assert.equal(helpers['public-live'].publicLiveModel(null, null, { ...yellow, groupsPublished: false, finalsPublished: false }).groups.length, 0);
  assert.deepEqual(helpers.giallo.gialloVisibility(yellow), { groups: true, finals: true }, 'Legacy publication must retain both phases');
  assert.deepEqual(helpers.giallo.gialloVisibility({ ...yellow, published: false, groupsPublished: true, finalsPublished: false }), { groups: true, finals: false });

  class NextResponse extends Response { static json(value, options) { return new NextResponse(JSON.stringify(value), options); } }
  const strip = (file) => fs.readFileSync(file, 'utf8').replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '').replaceAll('export const ', 'const ').replaceAll('export async function ', 'async function ');
  let actor = null, created = [], archived = [], automaticEnabled = true, unavailable = false, lookups = 0;
  const staff = vm.createContext({ NextResponse, URL, console, validateNotificationText,
    notificationActor: async () => actor,
    getNotificationEvents: async () => { if (unavailable) throw new Error('Offline'); return created; },
    getTornei: async () => [{ id: 't1', nome: 'Test', secret: true }],
    getNotificationDeliverySettings: async () => ({ automaticEnabled }), setNotificationDeliverySettings: async (value) => { automaticEnabled = value; },
    createNotificationEvent: async (value) => { if (unavailable) throw new Error('Offline'); const result = { ...value, id: 'new' }; created.push(result); return result; },
    archiveNotificationEvent: async (id, by) => { archived.push({ id, by }); return id === 'new'; },
    clerkClient: async () => ({ users: {
      getUserList: async () => { lookups++; return { data: [{ id: 'user_A', firstName: 'Anna', lastName: 'Rossi', emailAddresses: [{ emailAddress: 'anna@example.test' }], privateMetadata: { secret: 1 } }] }; },
      getUser: async (id) => { if (id !== 'user_A') throw new Error('Not found'); return { id, firstName: 'Anna', lastName: 'Rossi' }; },
    } }),
  });
  vm.runInContext(`${strip('app/api/staff/notifiche/route.js')}\nthis.get = GET; this.post = POST;`, staff);
  const request = (body) => ({ json: async () => body });
  const createBody = { action: 'create', titolo: 'Avviso', messaggio: 'Test', tipo: 'info', audience: { type: 'all' }, createdBy: 'forged' };
  assert.equal((await staff.post(request(createBody))).status, 401);
  actor = { userId: 'user_A', role: 'atleta' }; assert.equal((await staff.get({ url: 'https://test?search=Anna' })).status, 403); assert.equal(lookups, 0);
  actor = { userId: 'user_staff', role: 'staff' };
  let response = await staff.get({ url: 'https://test?search=Anna' }); assert.equal(response.status, 200);
  const search = await response.json(); assert.equal(search.athletes[0].privateMetadata, undefined);
  response = await staff.post(request(createBody)); assert.equal(response.status, 200); assert.equal(created[0].createdBy, 'user_staff');
  assert.equal((await staff.post(request({ ...createBody, audience: { type: 'tournament', tournamentId: 'missing' } }))).status, 400);
  assert.equal((await staff.post(request({ ...createBody, audience: { type: 'tournament', tournamentId: 't1', tournamentName: 'forged' } }))).status, 200);
  assert.equal(created.at(-1).audience.tournamentName, 'Test');
  assert.equal((await staff.post(request({ ...createBody, audience: { type: 'athlete', userId: 'user_A', label: 'Fake' } }))).status, 200);
  assert.equal(created.at(-1).audience.label, 'Anna Rossi');
  assert.equal((await staff.post(request({ action: 'archive', id: '../secret' }))).status, 400);
  assert.equal((await staff.post(request({ action: 'archive', id: 'new' }))).status, 200); assert.equal(archived[0].by, 'user_staff');
  assert.equal((await staff.post(request({ action: 'settings', automaticEnabled: false }))).status, 200); assert.equal(automaticEnabled, false);
  unavailable = true; assert.equal((await staff.post(request(createBody))).status, 500); unavailable = false;

  let preferences = { enabled: true, read: [] }, updates = [];
  const athlete = vm.createContext({ NextResponse, console,
    notificationActor: async () => actor,
    athleteNotificationFeed: async () => ({ data: visibleNotifications(notices, actor.userId, actor.email, registrations), settings: preferences }),
    updateNotificationPreferences: async (id, update) => { updates.push({ id, update }); preferences = { enabled: update.enabled ?? preferences.enabled, read: [...new Set([...preferences.read, ...update.read])] }; return preferences; },
  });
  vm.runInContext(`${strip('app/api/atleta/notifiche/route.js')}\nthis.get = GET; this.post = POST;`, athlete);
  actor = null; assert.equal((await athlete.get()).status, 401);
  actor = { userId: 'user_A', email: 'anna@example.test' };
  response = await athlete.get(); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.ok(!(await response.json()).data.some(n => n.id === 'other'));
  assert.equal((await athlete.post(request({ userId: 'user_C', read: ['private'], enabled: false }))).status, 200);
  assert.equal(updates[0].id, 'user_A', 'Preference ownership must come from authentication');
  assert.equal((await athlete.post(request({ read: ['other'] }))).status, 409);
  assert.equal(updates.length, 1); assert.equal((await athlete.post(request({ read: [], enabled: 'false' }))).status, 400);
  actor = { userId: 'user_C', email: '' }; response = await athlete.get(); assert.ok(!(await response.json()).data.some(n => n.id === 'private'));

  const feed = vm.createContext({ createHash, ...helpers['athlete-area'], visibleNotifications,
    getNotificationEvents: async () => notices, getNotifiche: async () => [{ id: 1, titolo: 'Legacy', data: '17/11/2026' }],
    getNotificationRegistrations: async () => registrations, getNotificationPreferences: async () => preferences,
  });
  vm.runInContext(`${strip('app/utils/notification-server.js')}\nthis.feed = athleteNotificationFeed;`, feed);
  const first = await feed.feed({ userId: 'user_A', email: '' });
  const second = await feed.feed({ userId: 'user_A', email: '' });
  assert.equal(first.data.find(n => n.titolo === 'Legacy').id, second.data.find(n => n.titolo === 'Legacy').id);
  assert.ok(first.data.every(n => !('audience' in n) && !('createdBy' in n)));
  const generic = vm.createContext({ NextResponse, URL, console,
    auth: async () => ({ userId: actor?.userId, sessionClaims: {} }), currentUser: async () => ({ publicMetadata: { role: actor?.role } }),
    getNotifiche: async () => notices,
  });
  vm.runInContext(`${strip('app/api/db/route.js')}\nthis.get = GET; this.post = POST;`, generic);
  for (const current of [null, { userId: 'user_A', role: 'atleta' }, { userId: 'staff', role: 'staff' }]) {
    actor = current;
    response = await generic.get({ url: 'https://test/api/db?type=notifiche&public=true' });
    assert.deepEqual((await response.json()).data, [], 'Public database endpoint must never expose targeted notices');
  }
  response = await generic.post(request({ type: 'notifiche', data: [] })); assert.equal(response.status, 403, 'Legacy bulk writes must not bypass dedicated notification authorization');
  console.log('Notifications: recipient privacy, partners, legacy IDs, input limits, manual staff actions, account-owned cloud reads, automatic groups/finals/giallo events and failed delivery handling passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
