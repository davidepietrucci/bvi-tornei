const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const swc = require('next/dist/build/swc');

(async () => {
  await swc.loadBindings();
  const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const rankingUrl = dataUrl(fs.readFileSync('app/utils/ranking.js', 'utf8'));
  const scoringUrl = dataUrl(fs.readFileSync('app/utils/match-scoring.js', 'utf8').replace('"./ranking"', JSON.stringify(rankingUrl)));
  const scoringRules = await import(scoringUrl);
  const progressionUrl = dataUrl(fs.readFileSync('app/utils/final-progression.js', 'utf8'));
  const finalRules = await import(dataUrl(fs.readFileSync('app/utils/final-scoring.js', 'utf8').replace('"./match-scoring"', JSON.stringify(scoringUrl)).replace('"./final-progression"', JSON.stringify(progressionUrl))));
  let states = [], cursor = 0, jobs = [], saves = [], failSave = false;
  const tournament = { id: 'closed', nome: 'Torneo concluso', stato: 'Concluso', categoria: '2x2' };
  const assignments = { 'gold-s1-L': 'Squadra salvata A', 'gold-s1-R': 'Squadra salvata B' };
  const metadata = { 'gold-s1': { s1L: '21', s1R: '17', court: '2', time: '16:00' } };
  const hooks = { ...React,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useEffect(fn) { jobs.push(fn); }, useMemo: (fn) => fn(), useRef: (v) => ({ current: v }), useImperativeHandle() {},
  };
  async function load(file) {
    const result = await swc.transform(fs.readFileSync(file, 'utf8'), {
      filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' },
    });
    const mod = { exports: {} };
    vm.runInNewContext(result.code, { module: mod, exports: mod.exports, console, URLSearchParams, clearTimeout,
      require(id) {
        if (id === 'react') return hooks;
        if (id === 'next/navigation') return { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() };
        if (id === '@/app/utils/giallo') return { isGiallo: () => false, gialloVisibility: () => ({ groups: false, finals: false }) };
        if (id === '@/app/utils/tournament-workflow') return { saveWorkflowConfig: async (...args) => { if (failSave) throw new Error('Salvataggio fallito'); saves.push(structuredClone(args)); }, readWorkflowConfig: async () => null };
        if (id === '@/app/utils/ranking') return { calculateUnifiedRanking: () => [], getSchedule: () => [] };
        if (id === '@/app/utils/match-scoring') return { ...scoringRules, teamGroupMatches: () => [] };
        if (id === '@/app/utils/final-scoring') return finalRules;
        if (id.startsWith('@/')) return {};
        return require(id);
      },
    });
    return mod.exports.default;
  }
  const nodes = (n) => !n || typeof n !== 'object' ? [] : [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)];
  const text = (n) => n == null || n === false ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.props?.children);
  const Finals = await load('app/components/tournament/TeamFinals.js');
  const renderFinals = () => { cursor = 0; jobs = []; const child = Finals({ tournament, embedded: true, active: true }).props.children; return child.type(child.props); };
  states = []; states[2] = 'single'; states[4] = 4; states[5] = assignments; states[6] = metadata; states[7] = true;
  let tree = renderFinals();
  assert.doesNotMatch(text(tree), /Nessun torneo selezionato|Nessun Torneo Attivo/);
  assert.ok(nodes(tree).some((n) => n.type === 'input' && (n.props.value || n.props.defaultValue) === 'Squadra salvata A') || text(tree).includes('Squadra salvata A'));
  assert.match(text(tree), /Torneo concluso: tabellone e risultati restano consultabili/);
  await nodes(tree).find((n) => n.type === 'button' && text(n) === 'Pubblica fase finale').props.onClick();
  assert.equal(saves[0][2].tabellonePubblicato, true);
  assert.deepEqual(saves[0][2].bracketAssignments, assignments);
  assert.deepEqual(saves[0][2].bracketMetadata, metadata);
  tree = renderFinals();
  failSave = true;
  await nodes(tree).find((n) => n.type === 'button' && text(n) === 'Nascondi fase finale al pubblico').props.onClick();
  assert.match(text(renderFinals()), /Fase finale visibile al pubblico/);
  assert.match(text(renderFinals()), /Salvataggio fallito/);
  failSave = false;
  await nodes(renderFinals()).find((n) => n.type === 'button' && text(n) === 'Nascondi fase finale al pubblico').props.onClick();
  assert.equal(saves.at(-1)[2].tabellonePubblicato, false);
  assert.deepEqual(saves.at(-1)[2].bracketMetadata, metadata);

  const Groups = await load('app/components/tournament/TeamGroups.js');
  states = []; states[5] = { A: { 0: 'Squadra salvata A' } }; states[8] = metadata; states[9] = true; states[10] = true;
  const renderGroups = () => { cursor = 0; jobs = []; return Groups({ tournament, embedded: true, active: true }); };
  await nodes(renderGroups()).find((n) => n.type === 'button' && text(n) === 'Nascondi gironi al pubblico').props.onClick();
  assert.equal(saves.at(-1)[0], 'gironi');
  assert.equal(saves.at(-1)[2].pubblicato, false);
  assert.deepEqual(saves.at(-1)[2].matchMetadata, metadata);
  assert.equal(saves.at(-1)[2].gironeAssignments.A[0], 'Squadra salvata A');

  // Public screens must allow finals-only publication and hide each section independently.
  for (const file of ['app/gironi/page.js', 'app/live/page.js']) {
    const Page = await load(file);
    const source = fs.readFileSync(file, 'utf8');
    const declarations = [...source.matchAll(/const \[(\w+),[^\]]+\] = useState\(/g)].map((m) => m[1]);
    const seed = (name, value) => { const i = declarations.indexOf(name); assert.notEqual(i, -1, name); states[i] = value; };
    for (const [groups, finals] of [[false, true], [true, false], [false, false], [true, true]]) {
      states = []; cursor = 0; jobs = [];
      seed('tornei', [tournament]); seed('selectedTorneo', tournament.nome); seed('loading', false);
      seed('config', groups ? { pubblicato: true, numGironi: 0, gironeAssignments: {} } : null);
      seed('bracketConfig', finals ? { tabellonePubblicato: true, phaseType: 'single', bracketSize: 4, bracketAssignments: assignments, bracketMetadata: metadata } : null);
      tree = Page();
      const buttons = nodes(tree).filter((n) => n.type === 'button').map(text);
      assert.equal(buttons.some((t) => t.includes('Fasi Finali')), finals, `${file}: finals navigation`);
      assert.equal(buttons.some((t) => t.trim() === 'Gironi'), groups, `${file}: groups navigation`);
      if (finals && !groups) assert.match(text(tree), /Squadra salvata A/);
    }
  }

  // Real GET handler: hidden data stays private, including on public pages visited by staff.
  class NextResponse extends Response { static json(body, opts) { return new NextResponse(JSON.stringify(body), opts); } }
  let role = 'atleta', userId = null, published = false;
  const api = vm.createContext({ NextResponse, URL, console,
    auth: async () => ({ userId, sessionClaims: {} }), currentUser: async () => ({ publicMetadata: { role } }),
    getGironi: async () => ({ pubblicato: published, matchMetadata: metadata }),
    getBracket: async () => ({ tabellonePubblicato: published, bracketMetadata: metadata }),
  });
  const apiSource = fs.readFileSync('app/api/db/route.js', 'utf8').replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '').replaceAll('export const ', 'const ').replaceAll('export async function ', 'async function ');
  vm.runInContext(`${apiSource}\nthis.get = GET;`, api);
  for (const type of ['gironi', 'bracket']) {
    for (const actor of ['guest', 'atleta', 'staff', 'admin']) {
      role = actor; userId = actor === 'guest' ? null : actor;
      for (published of [false, true]) {
        for (const publicView of [false, true]) {
          const response = await api.get({ url: `https://example.test/api/db?type=${type}&slug=closed&public=${publicView}` });
          assert.equal(response.status, 200);
          const body = await response.json();
          assert.equal(body.data !== null, published || (!publicView && ['staff', 'admin'].includes(actor)));
        }
      }
    }
  }
  // Real client readers: server null must clear an old cached published bracket.
  const dbSource = fs.readFileSync('app/utils/db.js', 'utf8');
  let serverData = null, publicFlag;
  const cache = new Map([['bvi_bracket_v1_closed', JSON.stringify({ tabellonePubblicato: true })]]);
  const db = vm.createContext({ window: {}, localStorage: { getItem: (k) => cache.get(k), setItem: (k,v) => cache.set(k,v), removeItem: (k) => cache.delete(k) },
    fetchFromServerDb: async (_, __, flag) => { publicFlag = flag; return serverData; },
  });
  for (const name of ['Gironi', 'Bracket']) {
    const fn = dbSource.slice(dbSource.indexOf(`export async function get${name}(`), dbSource.indexOf(`export async function save${name}(`)).replace('export async function', 'async function');
    vm.runInContext(`${fn}\nthis.read = get${name};`, db);
    assert.equal(await db.read('closed', { publicView: true }), null);
    assert.equal(publicFlag, true);
    serverData = { publishedFixture: true };
    assert.equal((await db.read('closed')).publishedFixture, true);
    serverData = null;
    assert.equal(await db.read('closed', { publicView: true }), null);
  }
  assert.equal(cache.has('bvi_bracket_v1_closed'), false);
  console.log('Tournament visibility: closed finals, preserved scores, failed saves, independent public sections, role permissions and stale cache passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
