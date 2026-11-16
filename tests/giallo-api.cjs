const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class NextResponse extends Response {
  static json(data, options = {}) { return new NextResponse(JSON.stringify(data), options); }
}

(async () => {
  const rulesSource = fs.readFileSync('app/utils/giallo.js', 'utf8');
  const rules = await import(`data:text/javascript;base64,${Buffer.from(rulesSource).toString('base64')}`);
  let role = 'staff', userId = 'staff-1', stored = null, outcome = 'saved', writes = 0, unavailable = false;
  const valid = rules.createGiallo(Array.from({ length: 24 }, (_, i) => ({ id: String(i), name: `Atleta ${i}` })));
  const context = vm.createContext({
    Response, NextResponse, URL, console: { error() {} },
    auth: async () => ({ userId, sessionClaims: {} }),
    currentUser: async () => ({ publicMetadata: { role } }),
    getTornei: async () => [{ nome: 'Prova Giallo', categoria: 'Giallo' }],
    getGiallo: async () => { if (unavailable) throw new Error('Offline'); return stored; },
    saveGialloIfUnchanged: async () => { writes++; if (unavailable) throw new Error('Offline'); return outcome; },
    validateGiallo: rules.validateGiallo, isGiallo: rules.isGiallo, gialloSlug: rules.gialloSlug,
  });
  const source = fs.readFileSync('app/api/db/route.js', 'utf8')
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '')
    .replaceAll('export const ', 'const ').replaceAll('export async function ', 'async function ');
  vm.runInContext(`${source}\nthis.GET = GET; this.POST = POST;`, context);
  const post = (body = {}) => context.POST({ json: async () => ({ type: 'giallo', slug: 'prova_giallo', data: valid, baseline: null, ...body }) });
  const get = (slug = 'prova_giallo') => context.GET({ url: `https://example.test/api/db?type=giallo&slug=${encodeURIComponent(slug)}` });
  userId = null; role = 'atleta';
  assert.equal((await post()).status, 401);
  userId = 'athlete-1';
  assert.equal((await post()).status, 403);
  assert.equal(writes, 0);
  stored = valid;
  assert.equal((await (await get()).json()).data, null, 'Unpublished drafts must stay private');
  userId = null;
  assert.equal((await (await get()).json()).data, null);
  stored = { ...valid, published: true };
  assert.equal((await (await get()).json()).data.groups.length, 6, 'Published tournaments must be public');
  assert.equal((await get('../other')).status, 400);
  userId = 'staff-1'; role = 'staff'; stored = valid;
  assert.equal((await (await get()).json()).data.groups.length, 6, 'Staff can read drafts');
  assert.equal((await post()).status, 200);
  assert.equal(writes, 1);
  assert.equal((await post({ baseline: undefined })).status, 400);
  assert.equal((await post({ data: { ...valid, results: { 'group-A-0': [21, 20] } } })).status, 400);
  assert.equal((await post({ data: { ...valid, groups: [valid.groups[0]] } })).status, 400);
  assert.equal((await post({ slug: 'other' })).status, 404);
  outcome = 'conflict'; assert.equal((await post()).status, 409);
  outcome = 'registrations_changed'; assert.equal((await post()).status, 409);
  outcome = 'saved'; unavailable = true;
  assert.equal((await post()).status, 500, 'Database errors cannot masquerade as successful saves');
  assert.equal((await get()).status, 500);
  console.log('Giallo API: authorization, draft privacy, validation, stale registrations, save conflicts and database-failure tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
