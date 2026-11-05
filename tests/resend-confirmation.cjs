const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class NextResponse extends Response {
  static json(data, options = {}) { return new NextResponse(JSON.stringify(data), options); }
}
let role = 'staff';
let sendResult = { success: true };
let sent = [];
const context = vm.createContext({
  Response, NextResponse, console,
  auth: async () => ({ userId: 'staff', sessionClaims: {} }),
  currentUser: async () => ({ publicMetadata: { role } }),
  getIscrizioni: async () => [{ id: '1', stato: 'In Attesa', torneo: 'Prova', giocatori: 'A & B', atletaEmail1: 'a@example.test', atletaEmail2: 'b@example.test' }],
  getTornei: async () => [{ nome: 'Prova' }],
  sendConfirmationEmail: async ({ email }) => { sent.push(email); return sendResult; },
  sendPartnerInviteEmail: async ({ email }) => { sent.push(email); return sendResult; },
  sendRegistrationApprovedEmail: async () => ({}),
  sendRegistrationRejectedEmail: async () => ({}),
});
const source = fs.readFileSync('app/api/staff/iscrizioni/notifica/route.js', 'utf8')
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '')
  .replace('export const dynamic', 'const dynamic')
  .replace('export async function POST', 'async function POST');
vm.runInContext(`${source}\nthis.POST = POST;`, context);
const request = (body) => ({ json: async () => body });
(async () => {
  role = 'atleta';
  let response = await context.POST(request({ action: 'resend_confirmation', id: '1' }));
  assert.equal(response.status, 403); assert.equal(sent.length, 0);
  role = 'staff';
  response = await context.POST(request({ action: 'resend_confirmation', id: 'missing' }));
  assert.equal(response.status, 404); assert.equal(sent.length, 0);
  response = await context.POST(request({ action: 'resend_confirmation', id: '1', emails: ['attacker@example.test'] }));
  assert.equal((await response.json()).success, true);
  assert.deepEqual(sent, ['a@example.test', 'b@example.test']);
  sent = []; sendResult = { success: false, error: '401' };
  response = await context.POST(request({ action: 'resend_confirmation', id: '1' }));
  assert.equal((await response.json()).success, false);
  sendResult = { success: true, isMock: true };
  response = await context.POST(request({ action: 'resend_confirmation', id: '1' }));
  assert.equal((await response.json()).success, false);
  console.log('OK: permessi staff, iscrizione mancante, destinatari salvati, errore e invio simulato');
})().catch((error) => { console.error(error); process.exitCode = 1; });
