const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');

(async () => {
  const source = fs.readFileSync('app/utils/giallo.js', 'utf8');
  const rules = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const { createGiallo, groupGames, gialloRanking, validGialloScore, groupsComplete,
    startGialloFinals, gialloStages, setGialloScore, validateGiallo, approvedGialloAthletes, addFifthGialloAthletes } = rules;
  const athletes = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Atleta ${i + 1}` }));
  const completeGroups = (config) => {
    for (const group of config.groups) for (const game of groupGames(group)) config = setGialloScore(config, game.id, [21, 15]);
    return config;
  };
  for (const invalid of [0, 4, 8, 11, 13, 18, 22, 23, 25, 28]) assert.throws(() => createGiallo(athletes(invalid)), /nessuno verrà escluso/);
  for (const valid of [[21, 0], [21, 19], [22, 20], [29, 31]]) assert.equal(validGialloScore(valid), true);
  for (const invalid of [[21, 20], [20, 18], [22, 19], [0, 0], [-1, 21], ['21', 15], [21.5, 10], [21], null]) assert.equal(validGialloScore(invalid), false);
  assert.equal(approvedGialloAthletes([
    { id: 'a', torneo: 'Giallo', stato: 'Approvata', giocatori: 'A' },
    { id: 'b', torneo: 'Giallo', stato: 'In Attesa', giocatori: 'B' },
    { id: 'c', torneo: 'Altro', stato: 'Approvata', giocatori: 'C' },
    { id: 'd', torneo: 'Giallo', stato: 'Annullata', giocatori: 'D' },
  ], 'Giallo').length, 1);
  assert.throws(() => approvedGialloAthletes([{ torneo: 'Giallo', stato: 'Approvata', giocatori: 'A' }], 'Giallo'));

  const existingGroups = { ...createGiallo(athletes(12)), published: true, groupsPublished: true, finalsPublished: false };
  const untouched = structuredClone(existingGroups);
  const allFifteen = athletes(15);
  const manual = addFifthGialloAthletes(existingGroups, allFifteen, { A: '13', B: '14', C: '15' });
  assert.deepEqual(existingGroups, untouched, 'The existing saved draw cannot be mutated');
  assert.equal(manual.groupsPublished, true);
  for (const [i, group] of manual.groups.entries()) {
    assert.deepEqual(group.athletes.slice(0, 4), existingGroups.groups[i].athletes);
    assert.equal(group.athletes[4].id, String(13 + i));
  }
  assert.equal(validateGiallo(manual), true);
  assert.throws(() => addFifthGialloAthletes(existingGroups, allFifteen, { A: '13', B: '13', C: '15' }), /diverso/);
  assert.throws(() => addFifthGialloAthletes(existingGroups, allFifteen.slice(0, 14), { A: '13', B: '14', C: '15' }), /15 iscrizioni/);
  for (let oldIndex = 0; oldIndex < 3; oldIndex++) {
    const oldId = `group-A-${oldIndex}`;
    const previous = { ...existingGroups, results: { [oldId]: [21, 15] }, matchMetadata: { [oldId]: { court: '1', status: 'finished' } } };
    const migrated = addFifthGialloAthletes(previous, allFifteen, { A: '13', B: '14', C: '15' });
    const before = groupGames(previous.groups[0])[oldIndex];
    const after = groupGames(migrated.groups[0])[0];
    assert.deepEqual(after.left, before.left);
    assert.deepEqual(after.right, before.right);
    assert.deepEqual(migrated.results['group-A-0'], [21, 15]);
    assert.equal(migrated.matchMetadata['group-A-0'].court, '1');
    assert.equal(validateGiallo(migrated), true);
    assert.equal(gialloRanking(migrated).filter(a => a.played === 1).length, 4);
  }
  assert.throws(() => addFifthGialloAthletes({ ...existingGroups, results: { 'group-A-0': [21, 15], 'group-A-1': [21, 12] } }, allFifteen, { A: '13', B: '14', C: '15' }), /più partite/);

  // Fifteen athletes: three groups of five, all ten partnerships and one rest each.
  let fifteen = createGiallo(athletes(15));
  assert.deepEqual(fifteen.groups.map(g => g.athletes.length), [5, 5, 5]);
  assert.equal(validateGiallo(fifteen), true);
  for (const group of fifteen.groups) {
    const games = groupGames(group), pairs = new Set(), rests = new Set();
    assert.equal(games.length, 5);
    for (const game of games) {
      const players = [...game.left, ...game.right];
      assert.equal(new Set(players.map(a => a.id)).size, 4);
      assert(!players.some(a => a.id === game.rest.id));
      rests.add(game.rest.id);
      for (const pair of [game.left, game.right]) pairs.add(pair.map(a => a.id).sort().join(','));
    }
    assert.equal(pairs.size, 10);
    assert.equal(rests.size, 5);
  }
  const first = groupGames(fifteen.groups[0])[0];
  fifteen = setGialloScore(fifteen, first.id, [21, 15]);
  let individual = new Map(gialloRanking(fifteen).map(a => [a.id, a]));
  for (const a of first.left) assert.deepEqual([individual.get(a.id).wins, individual.get(a.id).pf, individual.get(a.id).ps], [1, 21, 15]);
  for (const a of first.right) assert.deepEqual([individual.get(a.id).wins, individual.get(a.id).pf, individual.get(a.id).ps], [0, 15, 21]);
  assert.equal(individual.get(first.rest.id).played, 0);
  fifteen = completeGroups(fifteen);
  assert(groupsComplete(fifteen));
  assert(gialloRanking(fifteen).every(a => a.played === 4));
  assert.equal(validateGiallo(fifteen), true);
  const ranking15 = gialloRanking(fifteen);
  let fifteenFinals = startGialloFinals(fifteen);
  assert.deepEqual(fifteenFinals.finals.seeds.map(a => a.id), ranking15.slice(0, 12).map(a => a.id));
  assert.equal(validateGiallo(fifteenFinals), true);
  const spareggi15 = gialloStages(fifteenFinals)[0];
  assert.equal(spareggi15.id, 'playoff');
  assert.deepEqual(spareggi15.byes.map(a => a.id), ranking15.slice(0, 4).map(a => a.id));
  assert.deepEqual(new Set(spareggi15.games.flatMap(g => [...g.left, ...g.right].map(a => a.id))), new Set(ranking15.slice(4, 12).map(a => a.id)));
  assert.equal(spareggi15.games.length, 2);
  for (const game of spareggi15.games) fifteenFinals = setGialloScore(fifteenFinals, game.id, [21, 15]);
  const semi15 = gialloStages(fifteenFinals).at(-1);
  assert.equal(semi15.id, 'semis');
  assert.equal(semi15.games.length, 2);
  const finalAthletes = semi15.games.flatMap(g => [...g.left, ...g.right].map(a => a.id));
  for (const id of ranking15.slice(12).map(a => a.id)) assert(!finalAthletes.includes(id));
  for (const game of semi15.games) fifteenFinals = setGialloScore(fifteenFinals, game.id, [21, 15]);
  const final15 = gialloStages(fifteenFinals).at(-1).games[0];
  assert.deepEqual([final15.left, final15.right], semi15.games.map(g => g.left));
  fifteenFinals = setGialloScore(fifteenFinals, final15.id, [21, 17]);
  assert.equal(validateGiallo(fifteenFinals), true);
  assert.equal(gialloStages(fifteenFinals).flatMap(s => s.games).length, 5);
  assert.equal(setGialloScore(fifteenFinals, 'group-A-0', [21, 18]).finals, null);
  const invalidFifteen = structuredClone(fifteen);
  invalidFifteen.groups[0].athletes.pop();
  assert.throws(() => validateGiallo(invalidFifteen), /Gironi o atleti/);

  for (const count of [12, 16, 20, 24]) {
    for (let simulation = 0; simulation < 40; simulation++) {
      let config = createGiallo(athletes(count));
      assert.equal(config.groups.length, count / 4);
      assert.equal(new Set(config.groups.flatMap((g) => g.athletes.map((a) => a.id))).size, count);
      assert.throws(() => startGialloFinals(config), /Completa/);
      for (const group of config.groups) {
        const games = groupGames(group);
        for (const athlete of group.athletes) {
          const partners = [], opponents = [];
          for (const game of games) {
            const pair = game.left.some((a) => a.id === athlete.id) ? game.left : game.right;
            partners.push(...pair.filter((a) => a.id !== athlete.id).map((a) => a.id));
            opponents.push(...(pair === game.left ? game.right : game.left).map((a) => a.id));
          }
          assert.equal(new Set(partners).size, 3);
          assert.equal(new Set(opponents).size, 3);
          for (const id of new Set(opponents)) assert.equal(opponents.filter((n) => n === id).length, 2);
        }
      }
      config = completeGroups(config);
      assert.equal(groupsComplete(config), true);
      assert.ok(gialloRanking(config).every((a) => a.played === 3 && a.pf + a.ps === 108));
      config = startGialloFinals(config);
      assert.equal(validateGiallo(config), true);
      const initialStages = gialloStages(config);
      assert.equal(initialStages.length, 1);
      assert.equal(initialStages[0].id, count === 16 ? 'quarters' : 'playoff');
      if (count === 24) { assert.equal(initialStages[0].byes.length, 8); assert.equal(initialStages[0].games.length, 4); }
      if (count === 20) { assert.equal(initialStages[0].byes.length, 12); assert.equal(initialStages[0].games.length, 2); }
      if (count === 12) { assert.equal(initialStages[0].byes.length, 4); assert.equal(initialStages[0].games.length, 2); }
      while (!config.finals.results['final-0']) {
        const stage = gialloStages(config).at(-1);
        const roundPlayers = stage.games.flatMap((g) => [...g.left, ...g.right].map((a) => a.id));
        assert.equal(new Set(roundPlayers).size, roundPlayers.length);
        for (const game of stage.games) config = setGialloScore(config, game.id, Math.random() < .5 ? [21, 13] : [19, 21]);
        assert.equal(validateGiallo(config), true);
      }
      const stages = gialloStages(config);
      assert.equal(stages.flatMap((s) => s.games).length, count / 2 - 1);
      const pairs = new Set();
      for (const stage of stages.filter((s) => s.id !== 'final')) for (const game of stage.games) for (const pair of [game.left, game.right]) {
        const key = pair.map((a) => a.id).sort().join(',');
        assert.equal(pairs.has(key), false, 'Final-stage partners must change until semifinals'); pairs.add(key);
      }
      const semis = stages.find((s) => s.id === 'semis');
      const final = stages.at(-1).games[0];
      const winningPairs = semis.games.map((g) => config.finals.results[g.id][0] > config.finals.results[g.id][1] ? g.left : g.right);
      assert.deepEqual([final.left, final.right], winningPairs);
      const firstGame = stages[0].games[0];
      const corrected = setGialloScore(config, firstGame.id, [21, 17]);
      for (const stage of stages.slice(1)) for (const game of stage.games) assert.equal(corrected.finals.results[game.id], undefined);
      const removed = setGialloScore(config, firstGame.id, null);
      assert.equal(gialloStages(removed).length, 1);
      const reset = setGialloScore(config, groupGames(config.groups[0])[0].id, [21, 18]);
      assert.equal(reset.finals, null);
    }
  }

  // Actual Firestore transaction helper, exercised with an isolated double (no production writes).
  const dbSource = fs.readFileSync('app/utils/db-server.js', 'utf8');
  const helper = dbSource.slice(dbSource.indexOf('export async function saveGialloIfUnchanged'), dbSource.indexOf('export async function saveGironi'))
    .replace('export async function', 'async function');
  let saved = null, registrations = athletes(24).map((a) => ({ id: a.id, giocatori: a.name, torneo: 'Giallo', stato: 'Approvata' }));
  const db = { collection: (collection) => ({ doc: (id) => `${collection}/${id}` }), runTransaction: async (callback) => callback({
    get: async (ref) => ({ data: () => ref.startsWith('giallo/') ? { data: saved } : ref === 'config/notification_settings' ? { automaticEnabled: false } : { list: registrations } }),
    set: (_, value) => { saved = value.data; },
  }) };
  const context = vm.createContext({ db, randomUUID: () => 'operation', isDeepStrictEqual, approvedGialloAthletes, sanitizeData: (v) => structuredClone(v) });
  vm.runInContext(`${helper}\nthis.save = saveGialloIfUnchanged;`, context);
  const config = createGiallo(athletes(24));
  assert.equal(await context.save('test', config, null, 'Giallo'), 'saved');
  assert.equal(await context.save('test', config, null, 'Giallo'), 'conflict');
  const next = createGiallo(athletes(20));
  assert.equal(await context.save('test', next, config, 'Giallo'), 'registrations_changed');
  assert.deepEqual(saved, config);
  saved = existingGroups;
  registrations = allFifteen.map(a => ({ id: a.id, giocatori: a.name, torneo: 'Giallo', stato: 'Approvata' }));
  assert.equal(await context.save('test', manual, existingGroups, 'Giallo'), 'saved');
  assert.deepEqual(saved.groups.map(g => g.athletes.slice(0, 4)), existingGroups.groups.map(g => g.athletes));
  assert.equal(await context.save('test', manual, existingGroups, 'Giallo'), 'conflict');
  saved = existingGroups;
  registrations[14].stato = 'In Attesa';
  assert.equal(await context.save('test', manual, existingGroups, 'Giallo'), 'registrations_changed');
  assert.deepEqual(saved, existingGroups);
  console.log('Giallo: rotations, ranking, 160 full tournaments, scores, downstream resets and save-conflict tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
