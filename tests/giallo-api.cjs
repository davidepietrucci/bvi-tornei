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
    validateGiallo: rules.validateGiallo, isGiallo: rules.isGiallo, gialloSlug: rules.gialloSlug, publicGiallo: rules.publicGiallo,
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
  let fifteen = rules.createGiallo(Array.from({ length: 15 }, (_, i) => ({ id: String(i), name: `Atleta ${i}` })));
  fifteen = rules.setGialloScore(fifteen, 'group-C-4', [21, 15]);
  assert.equal((await post({ data: fifteen })).status, 200, 'Three groups of five and their fifth match must be accepted');
  stored = { ...fifteen, published: true };
  userId = null;
  const publicFifteen = (await (await get()).json()).data;
  assert.deepEqual(publicFifteen.groups.map(g => g.athletes.length), [5, 5, 5]);
  assert.deepEqual(publicFifteen.results['group-C-4'], [21, 15]);
  userId = 'staff-1'; stored = valid;
  assert.equal((await post({ baseline: undefined })).status, 400);
  assert.equal((await post({ data: { ...valid, results: { 'group-A-0': [21, 20] } } })).status, 400);
  assert.equal((await post({ data: { ...valid, groups: [valid.groups[0]] } })).status, 400);
  assert.equal((await post({ slug: 'other' })).status, 404);
  const matchMetadata = { 'group-A-0': { court: 'Sabbia A', time: '14:30', status: 'in_progress' } };
  assert.equal((await post({ data: { ...valid, matchMetadata } })).status, 200);
  for (const invalid of [{ time: '26:00' }, { status: 'finished' }, { court: 'x'.repeat(41) }, { status: 'unknown' }]) {
    assert.equal((await post({ data: { ...valid, matchMetadata: { 'group-A-0': { ...matchMetadata['group-A-0'], ...invalid } } } })).status, 400);
  }
  assert.equal((await post({ data: { ...valid, matchMetadata: { nonexistent: matchMetadata['group-A-0'] } } })).status, 400);
  let completedGroups = valid;
  for (const group of valid.groups) for (const game of rules.groupGames(group)) completedGroups = rules.setGialloScore(completedGroups, game.id, [21, 15]);
  const finals = rules.startGialloFinals(completedGroups);
  assert.equal((await post({ data: { ...finals, finals: { ...finals.finals, results: { 'bronze-0': [21, 15] } } } })).status, 400, 'Bronze cannot be scored before the semifinals');
  let podium = finals;
  while (!rules.gialloStages(podium).some(stage => stage.id === 'bronze')) {
    for (const game of rules.gialloStages(podium).at(-1).games) podium = rules.setGialloScore(podium, game.id, [21, 15]);
  }
  podium = rules.setGialloScore(podium, 'bronze-0', [21, 18]);
  podium.matchMetadata['bronze-0'] = { court: '3', time: '18:30', status: 'finished' };
  assert.equal((await post({ data: podium })).status, 200, 'Bronze result and match details must save through the staff API');
  assert.equal((await post({ data: { ...podium, matchMetadata: { ...podium.matchMetadata, 'bronze-1': { court: '3', time: '18:30', status: 'scheduled' } } } })).status, 400);
  stored = { ...podium, published: true, groupsPublished: false, finalsPublished: true };
  role = 'atleta'; userId = 'athlete-1';
  const publicPodium = (await (await get()).json()).data;
  assert.equal(publicPodium.groups.length, 0);
  assert.equal(rules.gialloStages(publicPodium).find(stage => stage.id === 'bronze').games[0].id, 'bronze-0');
  assert.deepEqual(publicPodium.finals.results['bronze-0'], [21, 18]);
  stored.finalsPublished = false;
  assert.equal((await (await get()).json()).data, null, 'Hidden finals must also hide the bronze match');
  role = 'staff'; userId = 'staff-1';
  const finalGame = rules.gialloStages(finals)[0].games[0];
  let withFinalScore = rules.setGialloScore(finals, finalGame.id, [21, 16]);
  withFinalScore.matchMetadata[finalGame.id] = { court: '4', time: '18:00', status: 'finished' };
  assert.equal((await post({ data: withFinalScore })).status, 200);
  for (const [groupsPublished, finalsPublished] of [[true, false], [false, true], [false, false], [true, true]]) {
    stored = { ...withFinalScore, published: true, groupsPublished, finalsPublished };
    const original = JSON.stringify(stored);
    role = 'atleta'; userId = 'athlete-1';
    const publicData = (await (await get()).json()).data;
    if (!groupsPublished && !finalsPublished) assert.equal(publicData, null);
    else {
      assert.equal(publicData.groups.length, groupsPublished ? 6 : 0);
      assert.equal(Object.keys(publicData.results).length, groupsPublished ? 18 : 0);
      assert.equal(Boolean(publicData.finals), finalsPublished);
      assert.equal(rules.gialloStages(publicData).length > 0, finalsPublished);
      assert.equal(Object.keys(publicData.matchMetadata).some(id => !id.startsWith('group-')), finalsPublished);
      assert.ok(!JSON.stringify(publicData).includes('"seeds"'), 'Private finals seeds must not be returned');
    }
    role = 'staff'; userId = 'staff-1';
    assert.equal(JSON.stringify((await (await get()).json()).data), original, 'Staff source must remain complete');
    const preview = await context.GET({ url: 'https://example.test/api/db?type=giallo&slug=prova_giallo&public=true' });
    assert.deepEqual((await preview.json()).data, publicData, 'Staff public preview must use the same visibility rules');
    assert.equal(JSON.stringify(stored), original, 'Publication filtering cannot mutate stored data');
  }
  assert.equal((await post({ data: { ...withFinalScore, groupsPublished: 'yes' } })).status, 400);
  assert.equal((await post({ data: { ...withFinalScore, finalsPublished: null } })).status, 400);
  assert.equal((await post({ data: rules.publicGiallo({ ...withFinalScore, published: true }) })).status, 400, 'Public projections cannot overwrite staff configuration');
  const regenerated = rules.startGialloFinals(withFinalScore);
  assert.equal(regenerated.matchMetadata[finalGame.id].status, 'scheduled');
  assert.equal(regenerated.matchMetadata[finalGame.id].court, '4');
  assert.equal((await post({ data: regenerated })).status, 200);
  outcome = 'conflict'; assert.equal((await post()).status, 409);
  outcome = 'registrations_changed'; assert.equal((await post()).status, 409);
  outcome = 'saved'; unavailable = true;
  assert.equal((await post()).status, 500, 'Database errors cannot masquerade as successful saves');
  assert.equal((await get()).status, 500);
  console.log('Giallo API: authorization, draft privacy, validation, stale registrations, save conflicts and database-failure tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
