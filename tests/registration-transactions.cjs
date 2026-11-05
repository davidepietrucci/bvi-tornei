const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');

// Run the actual transaction functions with an isolated in-memory Firestore double.
const source = fs.readFileSync('app/utils/db-server.js', 'utf8');
const start = source.indexOf('export async function updateRegistrationsAtomically');
const end = source.indexOf('export async function getGironi', start);
assert.ok(start >= 0 && end > start);
const functions = source.slice(start, end).replaceAll('export async function', 'async function');

const data = { iscrizioni: [], tornei: [{ id: '1', maxSquadre: 1, iscritti: 0 }] };
let queue = Promise.resolve();
const db = {
  collection: () => ({ doc: (id) => id }),
  runTransaction: (callback) => {
    const run = queue.then(async () => {
      const staged = {};
      const transaction = {
        get: async (id) => ({ data: () => ({ list: structuredClone(data[id]) }) }),
        set: (id, value) => { staged[id] = structuredClone(value.list); },
      };
      const result = await callback(transaction);
      Object.assign(data, staged);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  },
};
const context = vm.createContext({ db, Response, isDeepStrictEqual, sanitizeData: (v) => JSON.parse(JSON.stringify(v)) });
vm.runInContext(`${functions}\nthis.update = updateRegistrationsAtomically; this.save = saveConfigIfUnchanged;`, context);

(async () => {
  const oldRegistrations = structuredClone(data.iscrizioni);
  const register = (id) => context.update(async (registrations, tournaments) => {
    if (registrations.length >= tournaments[0].maxSquadre) return new Response('full', { status: 409 });
    return { registrations: [...registrations, { id }], tournaments: [{ ...tournaments[0], iscritti: registrations.length + 1 }], result: id };
  });
  const results = await Promise.all([register('a'), register('b')]);
  assert.equal(results.filter((r) => r instanceof Response && r.status === 409).length, 1);
  assert.equal(data.iscrizioni.length, 1);
  assert.equal(data.tornei[0].iscritti, 1);
  assert.equal(await context.save('iscrizioni', [], oldRegistrations), false);
  assert.equal(data.iscrizioni.length, 1);

  const baseline = [{ id: '1', iscritti: 1, maxSquadre: 1 }];
  assert.equal(await context.save('tornei', data.tornei, baseline), true);
  const before = structuredClone(data);
  await assert.rejects(context.update(async () => { throw new Error('errore simulato'); }));
  assert.deepEqual(data, before);
  console.log('OK: ultimo posto concorrente, conflitto staff, ordine campi e errore atomico');
})().catch((error) => { console.error(error); process.exitCode = 1; });
