const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class NextResponse extends Response {
  static json(body, options = {}) { return new NextResponse(JSON.stringify(body), { ...options, headers: { 'Content-Type': 'application/json' } }); }
}
const copy = (value) => structuredClone(value);
let state;
let queue = Promise.resolve();
let partner;
let sentEmails;
const user = { firstName: 'Atleta', lastName: 'Test', fullName: 'Atleta Test', primaryEmailAddress: { emailAddress: 'atleta@example.test' } };
const context = vm.createContext({
  Response, NextResponse, console, Date,
  auth: async () => ({ userId: 'user_1' }),
  currentUser: async () => user,
  clerkClient: async () => ({ users: { getUser: async () => partner } }),
  updateRegistrationsAtomically: (fn) => {
    const call = queue.then(async () => {
      const result = await fn(copy(state.registrations), copy(state.tournaments));
      if (result instanceof Response) return result;
      state = { registrations: result.registrations, tournaments: result.tournaments };
      return result.result;
    });
    queue = call.catch(() => {});
    return call;
  },
  sendConfirmationEmail: async () => { sentEmails++; },
  sendPartnerInviteEmail: async () => { sentEmails++; },
  normalizeCircuitName: (s) => String(s || '').trim().toLowerCase(),
  registrationIncludesAthlete: (r, id, email) =>
    (id && [r.atletaUserId1, r.atletaUserId2].includes(id)) || (email && [r.atletaEmail1, r.atletaEmail2].includes(email)),
  getCircuitLeaderboard: () => [], findCircuitAthlete: () => null,
});
vm.runInContext(fs.readFileSync('app/utils/athleteIdentity.js', 'utf8').replace('export function', 'function'), context);
function load(path, name) {
  const source = fs.readFileSync(path, 'utf8')
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '')
    .replace('export async function POST', `async function ${name}`);
  vm.runInContext(`${source}\nthis.${name} = ${name};`, context, { filename: path });
}
load('app/api/iscrizioni/registra/route.js', 'register');
load('app/api/atleta/iscrizioni/annulla/route.js', 'cancel');
const request = (data) => ({ json: async () => data });
const base = { torneo: 'Torneo Test', tel: '123456', giocatore2: 'Compagno Test', email2: 'partner@example.test', atletaUserId2: 'user_2' };
function reset() {
  user.firstName = 'Atleta'; user.lastName = 'Test'; user.username = 'nickname';
  state = { registrations: [], tournaments: [{ id: '1', nome: 'Torneo Test', stato: 'Iscrizioni Aperte', formato: 'coppia', maxSquadre: 1, iscritti: 0 }] };
  partner = { id: 'user_2', firstName: 'Compagno', lastName: 'Test', primaryEmailAddressId: 'e1', emailAddresses: [{ id: 'e1', emailAddress: 'partner@example.test', verification: { status: 'verified' } }] };
  sentEmails = 0;
}
(async () => {
  for (const missing of [{ firstName: '' }, { lastName: null }, { firstName: '  ', lastName: '\t' }]) {
    reset(); Object.assign(user, missing);
    const rejected = await context.register(request({ ...base, giocatore1: 'Nome Falsificato' }));
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).code, 'ATHLETE_PROFILE_INCOMPLETE');
    assert.equal(state.registrations.length, 0); assert.equal(sentEmails, 0);
  }
  reset(); partner.lastName = '  ';
  assert.equal((await context.register(request(base))).status, 400);
  assert.equal(state.registrations.length, 0); assert.equal(sentEmails, 0);
  reset();
  user.firstName = '  Anna Maria '; user.lastName = " D’Èlia ";
  assert.equal((await context.register(request({ ...base, giocatore1: 'nickname', giocatore2: 'Altro nickname' }))).status, 200);
  assert.equal(state.registrations[0].atleta1Nome, 'Anna Maria D’Èlia');
  assert.equal(state.registrations[0].atleta2Nome, 'Compagno Test');
  reset();
  state.tournaments[0].formato = 'singolo';
  assert.equal((await context.register(request({ torneo: base.torneo, tel: base.tel }))).status, 200);
  assert.equal(state.registrations[0].giocatori, 'Atleta Test');
  reset();
  let response = await context.register(request({ ...base, email2: 'wrong@example.test' }));
  assert.equal(response.status, 400); assert.equal(state.registrations.length, 0); assert.equal(sentEmails, 0);
  reset();
  state.tournaments[0].stato = 'Chiuso';
  response = await context.register(request(base));
  assert.equal(response.status, 409); assert.equal(state.registrations.length, 0);
  reset();
  const simultaneous = await Promise.all([context.register(request(base)), context.register(request(base))]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
  assert.equal(state.registrations.length, 1); assert.equal(state.tournaments[0].iscritti, 1); assert.equal(sentEmails, 2);
  const id = state.registrations[0].id;
  state.registrations[0].quotaPagata = 10;
  response = await context.cancel(request({ id }));
  assert.equal(response.status, 409); assert.equal(state.registrations[0].stato, 'In Attesa');
  state.registrations[0].quotaPagata = 0;
  response = await context.cancel(request({ id }));
  assert.equal(response.status, 200); assert.equal(state.registrations[0].stato, 'Annullata'); assert.equal(state.tournaments[0].iscritti, 0);
  response = await context.cancel(request({ id })); assert.equal(response.status, 409);
  console.log('OK: compagno non corrispondente, torneo chiuso, doppia iscrizione, annullamento pagato e annullamento ripetuto');
})().catch((error) => { console.error(error); process.exitCode = 1; });
