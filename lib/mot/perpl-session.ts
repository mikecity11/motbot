// Browser-only, session-only PERPL testnet authentication. No order sender lives here.
export const PERPL_TESTNET_CHAIN = 10143;
export const PERPL_TESTNET_SOCKET = 'wss://testnet.perpl.xyz/ws/v1/trading';

export type PerplAccount = {
  id: number;
  instance: number;
  forwarding: boolean | null;
  frozen: boolean | null;
  balance: string | null;
  lockedBalance: string | null;
};
export type SessionState = {
  status: 'connecting' | 'authenticated' | 'closed' | 'error';
  accounts: PerplAccount[];
  message: string;
};
type Frame = Record<string, unknown>;
type SocketLike = Pick<WebSocket, 'send' | 'close' | 'readyState' | 'onopen' | 'onmessage' | 'onclose' | 'onerror'>;
type SessionOptions = {
  wallet: string;
  apiKey: string;
  signingKey: CryptoKey;
  onState: (state: SessionState) => void;
  socketFactory?: (url: string) => SocketLike;
};

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function importApiSigningKey(secret: string): Promise<CryptoKey> {
  const hex = secret.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('Use the 32-byte hexadecimal API secret shown by PERPL. Never enter a wallet private key or seed phrase.');
  if (!crypto.subtle) throw new Error('This browser does not support secure key import. Use a current browser over HTTPS.');
  // RFC 8410 PKCS#8 wrapper for a 32-byte Ed25519 seed.
  const prefix = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];
  const encoded = new Uint8Array([...prefix, ...hex.match(/../g)!.map(byte => parseInt(byte, 16))]);
  try {
    return await crypto.subtle.importKey('pkcs8', encoded, { name: 'Ed25519' }, false, ['sign']);
  } catch {
    throw new Error('Secure Ed25519 signing is unavailable in this browser. Try a current Chrome or Firefox browser.');
  } finally { encoded.fill(0); }
}

export async function createTestnetSignIn(apiKey: string, signingKey: CryptoKey) {
  const token = apiKey.trim();
  if (!token || token.length > 4096 || /\s/.test(token)) throw new Error('Enter the API token provided by PERPL.');
  const timestamp = Date.now().toString();
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const canonical = [PERPL_TESTNET_CHAIN, 'trading-ws-signin', timestamp, nonce].join('\n');
  const signature = await crypto.subtle.sign('Ed25519', signingKey, new TextEncoder().encode(canonical));
  return { mt: 29, chain_id: PERPL_TESTNET_CHAIN, api_key: token, timestamp, nonce, signature: base64url(new Uint8Array(signature)) };
}

function object(value: unknown): value is Frame { return !!value && typeof value === 'object' && !Array.isArray(value); }
function positiveId(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function amount(value: unknown): string | null { return typeof value === 'string' && /^\d+$/.test(value) ? value : null; }
export function decodeAccount(value: unknown): PerplAccount {
  if (!object(value) || !positiveId(value.id) || !positiveId(value.in)) throw new Error('Invalid account snapshot.');
  return {
    id: value.id, instance: value.in,
    forwarding: typeof value.fw === 'boolean' ? value.fw : null,
    frozen: typeof value.fr === 'boolean' ? value.fr : null,
    balance: amount(value.b), lockedBalance: amount(value.lb),
  };
}

export function decodeWalletSnapshot(frame: unknown, wallet: string): PerplAccount[] {
  if (!object(frame) || frame.mt !== 19 || typeof frame.addr !== 'string' || frame.addr.toLowerCase() !== wallet.toLowerCase()) {
    throw new Error('This API key does not match the connected wallet.');
  }
  if (frame.as === undefined) return [];
  if (!Array.isArray(frame.as)) throw new Error('Invalid wallet snapshot.');
  return frame.as.map(decodeAccount);
}

export class PerplReadOnlySession {
  private socket: SocketLike | null = null;
  private options: SessionOptions | null;
  private accounts: PerplAccount[] = [];
  private authenticated = false;
  private lastSequence: number | null = null;
  private authenticationTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private freshnessTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessage = Date.now();
  private ended = false;

  constructor(options: SessionOptions) { this.options = options; }

  start() {
    if (this.socket || this.ended || !this.options) return;
    this.emit('connecting', 'Connecting to PERPL testnet. No orders will be sent.');
    try {
      this.socket = (this.options.socketFactory ?? (url => new WebSocket(url)))(PERPL_TESTNET_SOCKET);
      this.authenticationTimer = setTimeout(() => this.fail('PERPL did not return a verified wallet snapshot. Check the key, connection, and application-origin approval.'), 15000);
      this.socket.onopen = async () => {
        if (!this.options || this.ended) return;
        try {
          const frame = await createTestnetSignIn(this.options.apiKey, this.options.signingKey);
          if (this.ended || this.socket?.readyState !== 1) return;
          this.socket.send(JSON.stringify(frame)); // Always the first outbound frame.
        } catch { this.fail('Could not sign in with this API key. No orders were sent.'); }
      };
      this.socket.onmessage = event => this.receive(event.data);
      this.socket.onerror = () => this.fail('PERPL connection failed. Check connectivity and whether this application origin is allowed.');
      this.socket.onclose = event => {
        if (!this.ended) this.fail(event.code === 3401 ? 'PERPL rejected this API key. Check the token, secret, expiry, IP restrictions, and device clock.' : 'PERPL disconnected. Account and forwarding status are no longer verified. Reconnect to check again.');
      };
    } catch { this.fail('PERPL testnet connection could not start.'); }
  }

  private receive(raw: unknown) {
    if (this.ended || !this.options) return;
    try {
      if (typeof raw !== 'string' || raw.length > 1000000) throw new Error('Invalid frame');
      const frame: unknown = JSON.parse(raw);
      if (!object(frame)) throw new Error('Invalid frame');
      this.lastMessage = Date.now();
      if (frame.mt === 19) {
        this.accounts = decodeWalletSnapshot(frame, this.options.wallet);
        if (typeof frame.sn !== 'number' || !Number.isSafeInteger(frame.sn) || frame.sn < 0) throw new Error('Invalid sequence');
        this.lastSequence = frame.sn;
        this.authenticated = true;
        if (this.authenticationTimer) clearTimeout(this.authenticationTimer);
        this.authenticationTimer = null;
        // Keep the CryptoKey/token only in this in-memory session; no storage or server upload.
        this.emit('authenticated', 'API authentication verified. Trade scope is not verified; order execution remains disabled.');
        if (!this.keepAlive) this.keepAlive = setInterval(() => {
          if (!this.ended && this.socket?.readyState === 1) {
            try { this.socket.send(JSON.stringify({ mt: 1, t: Date.now() })); } catch { this.fail('PERPL connection interrupted.'); }
          }
        }, 30000);
        if (!this.freshnessTimer) this.freshnessTimer = setInterval(() => {
          if (Date.now() - this.lastMessage > 45000) this.fail('PERPL updates have stopped. Reconnect to verify current status.');
        }, 5000);
      } else if (frame.mt === 21 && this.authenticated) {
        const account = decodeAccount(frame);
        const index = this.accounts.findIndex(item => item.id === account.id && item.instance === account.instance);
        if (index < 0) throw new Error('Unexpected account');
        this.accounts = this.accounts.map((item, i) => i === index ? account : item);
        this.emit('authenticated', 'Account status updated. Order execution remains disabled.');
      } else if (frame.mt === 100 && this.authenticated) {
        if (typeof frame.sn !== 'number' || frame.sn !== this.lastSequence! + 1) throw new Error('Sequence gap');
        this.lastSequence = frame.sn;
      }
      // Orders/positions/other frame types are deliberately not acted on in this stage.
    } catch { this.fail('Wallet verification failed or account updates were incomplete. Disconnecting safely; no orders were sent.'); }
  }

  private emit(status: SessionState['status'], message: string) { this.options?.onState({ status, accounts: status === 'authenticated' ? [...this.accounts] : [], message }); }
  private fail(message: string) { if (this.ended) return; this.emit('error', message); this.dispose(); }

  disconnect() { if (this.ended) return; this.emit('closed', 'Session disconnected. Revoke the API key on PERPL to remove its permissions.'); this.dispose(); }

  private dispose() {
    this.ended = true;
    if (this.authenticationTimer) clearTimeout(this.authenticationTimer);
    if (this.keepAlive) clearInterval(this.keepAlive);
    if (this.freshnessTimer) clearInterval(this.freshnessTimer);
    if (this.socket) {
      this.socket.onopen = null; this.socket.onmessage = null; this.socket.onclose = null; this.socket.onerror = null;
      this.socket.close(); this.socket = null;
    }
    this.options = null; this.accounts = []; this.authenticated = false;
  }
}
