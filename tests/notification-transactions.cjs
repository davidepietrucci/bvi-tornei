const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');

(async () => {
  const records = new Map([
    ['gironi/test', { data: { pubblicato: false } }],
    ['config/iscrizioni', { list: [] }], ['config/tornei', { list: [{ nome: 'Test' }] }],
  ]);
  let failCommit = false, sequence = 0;
  const ref = (key) => ({ key,
    get: async () => snapshot(key),
    set: async (data, options) => records.set(key, options?.merge ? { ...records.get(key), ...structuredClone(data) } : structuredClone(data)),
    create: async (data) => { if (records.has(key)) throw new Error('Exists'); records.set(key, structuredClone(data)); },
  });
  const snapshot = (key) => ({ exists: records.has(key), data: () => structuredClone(records.get(key)) });
  const db = {
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`), orderBy: () => ({ limit: (count) => ({ get: async () => ({ docs: [...records].filter(([key]) => key.startsWith(`${name}/`)).sort((a, b) => (b[1].data || '').localeCompare(a[1].data || '')).slice(0, count).map(([key]) => ({ id: key.split('/')[1], data: () => structuredClone(records.get(key)) })) }) }) }) }),
    runTransaction: async (callback) => {
      const writes = [];
      const outcome = await callback({ get: async (reference) => { assert.equal(writes.length, 0, 'Firestore requires reads before writes'); return snapshot(reference.key); },
        set: (reference, data) => writes.push({ key: reference.key, data, merge: false }),
        update: (reference, data) => writes.push({ key: reference.key, data, merge: true }),
      });
      if (failCommit) throw new Error('Commit rejected');
      writes.forEach(({ key, data, merge }) => records.set(key, structuredClone(merge ? { ...records.get(key), ...data } : data)));
      return outcome;
    },
  };
  const source = fs.readFileSync('app/utils/db-server.js', 'utf8');
  const helpers = source.slice(source.indexOf('export async function saveGironi'), source.indexOf('export async function getUsers')).replaceAll('export async function ', 'async function ');
  const context = vm.createContext({ db, randomUUID: () => `op-${++sequence}`, sanitizeData: (value) => structuredClone(value), saveLocalFileDb() {}, saveSpecificDoc() {}, getSpecificDoc() {},
    tournamentNotifications: (_, before, after) => after.pubblicato && !isDeepStrictEqual(before, after) ? [{ titolo: 'Updated', data: '2026-11-17T12:00:00Z', audience: { type: 'tournament', tournamentName: 'Test' } }] : [],
  });
  vm.runInContext(`${helpers}\nthis.save = saveGironi; this.preferences = updateNotificationPreferences; this.read = getNotificationPreferences; this.events = getNotificationEvents; this.create = createNotificationEvent; this.archive = archiveNotificationEvent;`, context);
  const changed = { pubblicato: true, version: 1 };
  await context.save('test', changed);
  assert.deepEqual(records.get('gironi/test').data, changed);
  assert.equal([...records.keys()].filter(key => key.startsWith('notifications/')).length, 1);
  await context.save('test', changed);
  assert.equal([...records.keys()].filter(key => key.startsWith('notifications/')).length, 1, 'An unchanged save must not create duplicates');
  failCommit = true;
  await assert.rejects(context.save('test', { pubblicato: true, version: 2 }), /Commit rejected/);
  assert.deepEqual(records.get('gironi/test').data, changed);
  assert.equal([...records.keys()].filter(key => key.startsWith('notifications/')).length, 1, 'Failed match save and notification must both roll back');
  failCommit = false; records.set('config/notification_settings', { automaticEnabled: false });
  await context.save('test', { pubblicato: true, version: 3 });
  assert.equal([...records.keys()].filter(key => key.startsWith('notifications/')).length, 1, 'Staff can disable automatic notices');
  await context.preferences('user_A', { read: ['a'], enabled: false });
  await context.preferences('user_A', { read: ['b'] });
  let state = await context.read('user_A'); assert.deepEqual(Array.from(state.read), ['a', 'b']); assert.equal(state.enabled, false);
  assert.equal((await context.read('user_B')).read.length, 0);
  await context.preferences('user_A', { read: ['a'] }); assert.equal((await context.read('user_A')).read.length, 2);
  const manual = await context.create({ titolo: 'Manual', data: '2026-11-17T13:00:00Z', archived: false });
  assert.equal((await context.events()).length, 2);
  assert.equal(await context.archive(manual.id, 'staff'), true);
  assert.equal(records.get(`notifications/${manual.id}`).archivedBy, 'staff');
  assert.equal(await context.archive('missing', 'staff'), false);
  assert.equal((await context.events())[0].archived, true);
  console.log('Notification transactions: atomic match/event writes, unchanged-save deduplication, failure rollback, automatic opt-out, per-account read merging and archive persistence passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
