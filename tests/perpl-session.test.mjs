import test from 'node:test';
import assert from 'node:assert/strict';
import { importApiSigningKey, createTestnetSignIn, decodeAccount, decodeWalletSnapshot, PerplReadOnlySession, PERPL_TESTNET_SOCKET } from '../lib/mot/perpl-session.ts';

// Public RFC 8032 vector, never a real wallet/API credential.
const seed = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const publicKey = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
const wallet = '0x1111111111111111111111111111111111111111';
const account = { id: 1, in: 1, fw: true, fr: false, b: '100000000', lb: '0' };
const snapshot = { mt: 19, addr: wallet, sn: 10, as: [account] };

class FakeSocket {
  readyState = 1;
  onopen = null; onmessage = null; onclose = null; onerror = null;
  frames = []; closed = false;
  send(raw) { this.frames.push(JSON.parse(raw)); }
  close() { this.closed = true; this.readyState = 3; }
  receive(frame) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
async function fixture(t) {
  const socket = new FakeSocket();
  const states = [];
  const session = new PerplReadOnlySession({ wallet, apiKey: 'test-token', signingKey: await importApiSigningKey(seed), socketFactory: url => { assert.equal(url, PERPL_TESTNET_SOCKET); return socket; }, onState: state => states.push(state) });
  t.after(() => session.disconnect());
  session.start();
  await socket.onopen();
  return { socket, states, session };
}

test('imports a non-extractable Ed25519 key and verifies canonical sign-in', async () => {
  const key = await importApiSigningKey(`0x${seed}`);
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('pkcs8', key));
  const frame = await createTestnetSignIn('test-token', key);
  assert.equal(frame.mt, 29); assert.equal(frame.chain_id, 10143);
  assert.equal(Buffer.from(frame.nonce, 'base64url').length, 16);
  assert.equal(Buffer.from(frame.signature, 'base64url').length, 64);
  const verifier = await crypto.subtle.importKey('raw', Buffer.from(publicKey, 'hex'), 'Ed25519', false, ['verify']);
  assert.equal(await crypto.subtle.verify('Ed25519', verifier, Buffer.from(frame.signature, 'base64url'), new TextEncoder().encode([10143, 'trading-ws-signin', frame.timestamp, frame.nonce].join('\n'))), true);
  const next = await createTestnetSignIn('test-token', key);
  assert.notEqual(next.nonce, frame.nonce);
});

test('rejects malformed secrets and tokens without opening a connection', async () => {
  for (const value of ['', 'seed phrase words', 'ab'.repeat(31), 'zz'.repeat(32)]) await assert.rejects(importApiSigningKey(value));
  const key = await importApiSigningKey(seed);
  for (const value of ['', 'token with space', 'a'.repeat(4097)]) await assert.rejects(createTestnetSignIn(value, key));
});

test('requires the authenticated wallet to match, allowing case differences', () => {
  assert.equal(decodeWalletSnapshot({ ...snapshot, addr: wallet.toUpperCase() }, wallet).length, 1);
  assert.throws(() => decodeWalletSnapshot({ ...snapshot, addr: '0x2222222222222222222222222222222222222222' }, wallet));
  assert.throws(() => decodeWalletSnapshot({ ...snapshot, as: {} }, wallet));
  assert.deepEqual(decodeWalletSnapshot({ mt: 19, addr: wallet }, wallet), []);
});

test('never assumes omitted forwarding/frozen fields are verified', () => {
  const decoded = decodeAccount({ id: 1, in: 1 });
  assert.equal(decoded.forwarding, null); assert.equal(decoded.frozen, null);
  assert.equal(decoded.balance, null);
  assert.throws(() => decodeAccount({ id: Number.MAX_SAFE_INTEGER + 1, in: 1 }));
});

test('sign-in alone is not authentication; the first frame is testnet sign-in', async t => {
  const { socket, states } = await fixture(t);
  assert.deepEqual(socket.frames.map(frame => frame.mt), [29]);
  assert.equal(states.at(-1).status, 'connecting');
  socket.receive(snapshot);
  assert.equal(states.at(-1).status, 'authenticated');
  assert.equal(states.at(-1).accounts[0].forwarding, true);
  assert.match(states.at(-1).message, /scope is not verified/);
});

test('reflects revoked forwarding and frozen status from account updates', async t => {
  const { socket, states } = await fixture(t);
  socket.receive(snapshot);
  socket.receive({ mt: 21, ...account, fw: false, fr: true });
  assert.equal(states.at(-1).accounts[0].forwarding, false);
  assert.equal(states.at(-1).accounts[0].frozen, true);
});

test('a mismatched wallet closes the session and clears verified accounts', async t => {
  const { socket, states } = await fixture(t);
  socket.receive({ ...snapshot, addr: '0x2222222222222222222222222222222222222222' });
  assert.equal(states.at(-1).status, 'error');
  assert.equal(socket.closed, true); assert.deepEqual(states.at(-1).accounts, []);
});

test('heartbeat gaps invalidate authentication instead of using stale state', async t => {
  const { socket, states } = await fixture(t);
  socket.receive(snapshot); socket.receive({ mt: 100, sn: 11 });
  assert.equal(states.at(-1).status, 'authenticated');
  socket.receive({ mt: 100, sn: 13 });
  assert.equal(states.at(-1).status, 'error'); assert.equal(socket.closed, true);
});

test('malformed frames fail closed', async t => {
  const { socket, states } = await fixture(t);
  socket.onmessage({ data: '{bad json' });
  assert.equal(states.at(-1).status, 'error'); assert.equal(socket.closed, true);
});

test('unknown account updates fail closed', async t => {
  const { socket, states } = await fixture(t);
  socket.receive(snapshot); socket.receive({ mt: 21, ...account, id: 99 });
  assert.equal(states.at(-1).status, 'error'); assert.equal(socket.closed, true);
});

test('disconnect drops handlers and cannot restart or send orders', async t => {
  const { socket, states, session } = await fixture(t);
  socket.receive(snapshot); session.disconnect(); session.start();
  assert.equal(states.at(-1).status, 'closed'); assert.equal(socket.closed, true);
  assert.equal(socket.onopen, null); assert.equal(socket.onmessage, null);
  assert.deepEqual(socket.frames.map(frame => frame.mt), [29]);
  assert.equal('sendOrder' in session, false);
});

test('PERPL authentication rejection leaves no authenticated state', async t => {
  const { socket, states } = await fixture(t);
  socket.onclose({ code: 3401 });
  assert.equal(states.at(-1).status, 'error'); assert.match(states.at(-1).message, /rejected/);
  assert.deepEqual(states.at(-1).accounts, []);
});

test('authentication timeout closes the socket without sending an order', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { socket, states } = await fixture(t);
  t.mock.timers.tick(15001);
  assert.equal(states.at(-1).status, 'error'); assert.equal(socket.closed, true);
  assert.deepEqual(socket.frames.map(frame => frame.mt), [29]);
});

test('keep-alive uses only ping frames and stale updates clear authentication', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const { socket, states } = await fixture(t);
  socket.receive(snapshot);
  t.mock.timers.tick(30000);
  assert.deepEqual(socket.frames.map(frame => frame.mt), [29, 1]);
  t.mock.timers.tick(20000);
  assert.equal(states.at(-1).status, 'error'); assert.equal(socket.closed, true);
  assert.deepEqual(states.at(-1).accounts, []);
  assert.ok(socket.frames.every(frame => frame.mt === 29 || frame.mt === 1));
});

test('disconnect during signing prevents a late authentication frame', async t => {
  const socket = new FakeSocket();
  const session = new PerplReadOnlySession({ wallet, apiKey: 'test-token', signingKey: await importApiSigningKey(seed), socketFactory: () => socket, onState: () => {} });
  t.after(() => session.disconnect());
  session.start(); const pending = socket.onopen(); session.disconnect(); await pending;
  assert.deepEqual(socket.frames, []); assert.equal(socket.closed, true);
});
