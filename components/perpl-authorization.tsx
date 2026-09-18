'use client';
import { useEffect, useRef, useState } from 'react';
import { importApiSigningKey, PerplReadOnlySession, type SessionState } from '@/lib/mot/perpl-session';

export function PerplAuthorization({ wallet, chain }: { wallet: string; chain: string }) {
  const tokenInput = useRef<HTMLInputElement>(null);
  const secretInput = useRef<HTMLInputElement>(null);
  const session = useRef<PerplReadOnlySession | null>(null);
  const generation = useRef(0);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    function clear() {
      generation.current++;
      session.current?.disconnect(); session.current = null;
      if (tokenInput.current) tokenInput.current.value = '';
      if (secretInput.current) secretInput.current.value = '';
    }
    clear(); setState(null); setWorking(false); setConsent(false);
    window.addEventListener('pagehide', clear);
    return () => { window.removeEventListener('pagehide', clear); clear(); };
  }, [wallet, chain]);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !consent || Number(chain) !== 10143) return;
    const attempt = ++generation.current;
    session.current?.disconnect(); session.current = null;
    setWorking(true); setState(null);
    try {
      const apiKey = tokenInput.current?.value.trim() ?? '';
      if (!apiKey || apiKey.length > 4096 || /\s/.test(apiKey)) throw new Error('Enter the API token provided by PERPL.');
      const signingKey = await importApiSigningKey(secretInput.current?.value ?? '');
      if (attempt !== generation.current) return;
      const next = new PerplReadOnlySession({ wallet, apiKey, signingKey, onState: value => {
        if (attempt !== generation.current) return;
        setState(value); setWorking(value.status === 'connecting');
      } });
      session.current = next; next.start();
    } catch (error) {
      if (attempt === generation.current) { setState({ status: 'error', accounts: [], message: error instanceof Error ? error.message : 'Could not connect this API key.' }); setWorking(false); }
    } finally {
      if (attempt === generation.current) {
        if (tokenInput.current) tokenInput.current.value = '';
        if (secretInput.current) secretInput.current.value = '';
      }
    }
  }

  const active = state?.status === 'authenticated';
  return <div className="perpl-auth">
    <h3>Connect a testnet API key</h3>
    <p>Create a dedicated key at <a href="https://testnet.perpl.xyz/apikeys" target="_blank" rel="noreferrer">PERPL testnet ↗</a> for the same wallet. A read-only key is sufficient for this setup check.</p>
    <p>Only enter PERPL’s API token and API secret below—not your wallet private key or seed phrase. Never send these credentials in chat.</p>
    {!active && <form onSubmit={connect} autoComplete="off">
      <label htmlFor="perpl-api-token">PERPL testnet API token</label>
      <input ref={tokenInput} id="perpl-api-token" type="password" autoComplete="off" spellCheck={false} maxLength={4096} required disabled={working}/>
      <label htmlFor="perpl-api-secret">PERPL API secret (32-byte hex)</label>
      <input ref={secretInput} id="perpl-api-secret" type="password" autoComplete="off" spellCheck={false} maxLength={66} required disabled={working}/>
      <label className="perpl-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={working}/>I understand this key belongs to my testnet wallet. MOT will use it only to verify this session, not to submit orders.</label>
      <button className="wallet-button" disabled={!consent || working || Number(chain) !== 10143}>{working ? 'Verifying session…' : 'Verify API session'}</button>
      {Number(chain) !== 10143 && <p>Select Monad testnet in your wallet first.</p>}
    </form>}
    {state && <p role="status">{state.message}</p>}
    {active && <>
      {state.accounts.length ? state.accounts.map(account => <div className="perpl-account" key={`${account.instance}:${account.id}`}>
        <strong>Account {account.id} · instance {account.instance}</strong>
        <p>Order forwarding: {account.forwarding === null ? 'Not verified' : account.forwarding ? 'Enabled' : 'Disabled'}</p>
        <p>Account frozen: {account.frozen === null ? 'Not verified' : account.frozen ? 'Yes' : 'No'}</p>
      </div>) : <p>API authentication works, but this wallet snapshot has no exchange account. Create and fund one on PERPL testnet.</p>}
      <p>To enable forwarding, use PERPL’s One-Click Trading setting. MOT does not change this permission for you.</p>
    </>}
    {(working || active) && <button className="wallet-button" onClick={() => { generation.current++; session.current?.disconnect(); session.current = null; setWorking(false); setConsent(false); setState({ status: 'closed', accounts: [], message: 'Disconnected. The API key is still valid on PERPL until you revoke it there.' }); }}>Disconnect API session</button>}
    <p className="perpl-security-note">Session-only: credentials are not saved to browser storage or uploaded to MOT’s server. Reloading, changing wallet/network, or disconnecting clears the local session. This does not revoke the key on PERPL. API keys cannot withdraw funds, but a trade-enabled key can open losing positions; use testnet only.</p>
  </div>;
}
