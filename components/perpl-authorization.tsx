'use client';
import { useEffect, useRef, useState } from 'react';
import { importApiSigningKey, PerplReadOnlySession, type SessionState } from '@/lib/mot/perpl-session';
import { decodeTradingContext, planMarketOrders, type ProtectionPreferences, type TradeCandidate } from '@/lib/mot/perpl-orders';

type SubmitDetail = { id: string; trade: TradeCandidate; preferences: ProtectionPreferences };

export function PerplAuthorization({ wallet, chain }: { wallet: string; chain: string }) {
  const tokenInput = useRef<HTMLInputElement>(null);
  const secretInput = useRef<HTMLInputElement>(null);
  const session = useRef<PerplReadOnlySession | null>(null);
  const generation = useRef(0);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    async function submit(event: Event) {
      const detail = (event as CustomEvent<SubmitDetail>).detail;
      const reply = (ok: boolean, message: string) => window.dispatchEvent(new CustomEvent('mot:testnet-order-result', { detail: { id: detail?.id, ok, message } }));
      try {
        if (!detail || typeof detail.id !== 'string' || !detail.trade || !detail.preferences) throw new Error('The reviewed instruction is invalid.');
        if (Number(chain) !== 10143 || !session.current || state?.status !== 'authenticated') throw new Error('Connect a verified PERPL testnet API session first.');
        const account = state.accounts.find(item => item.forwarding === true && item.frozen === false);
        if (!account) throw new Error('A verified, unfrozen PERPL account with order forwarding enabled is required.');
        if (account.balance === null || account.lockedBalance === null) throw new Error('PERPL did not provide a verified collateral balance.');
        const required = BigInt(Math.ceil(detail.trade.marginUSD * 1_000_000));
        if (BigInt(account.balance) - BigInt(account.lockedBalance) < required) throw new Error('Available testnet collateral is below the requested opening margin.');
        const response = await fetch('https://testnet.perpl.xyz/api/v1/pub/context', { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load PERPL’s live trading limits.');
        const context = decodeTradingContext(await response.json());
        const market = context.markets.find(item => item.symbol.toUpperCase() === detail.trade.market.toUpperCase());
        if (!market) throw new Error(`${detail.trade.market} is not available on PERPL testnet.`);
        const firstRq = session.current.nextRequestId(account.id);
        const firstCid = session.current.nextCorrelationId();
        const orders = planMarketOrders({ trade: detail.trade, preferences: detail.preferences, market, accountId: account.id, firstRequestId: firstRq, firstCorrelationId: firstCid, head: context.head });
        const admissions = await session.current.submitOrders(orders);
        const rejected = admissions.find(item => !item.accepted);
        if (rejected) throw new Error(rejected.code === 403 ? 'PERPL rejected this API key because it does not have trade scope.' : `PERPL rejected part of the instruction: ${rejected.error || `code ${rejected.code}`}. Check the account on PERPL before trying again.`);
        const filled = admissions.some(item => item.evidence === 'position');
        const forwarded = admissions.some(item => item.evidence === 'forwarded' || item.evidence === 'order');
        reply(true, filled ? 'PERPL confirmed the resulting position. The testnet trade is open.' : forwarded ? `${orders.length} testnet order${orders.length === 1 ? '' : 's'} reached PERPL. Final fill confirmation may arrive separately; check the live position panel before sending another instruction.` : `${orders.length} testnet order${orders.length === 1 ? '' : 's'} accepted for forwarding by PERPL. Acceptance is not proof of a fill; wait for the live position update.`);
      } catch (error) { reply(false, `${error instanceof Error ? error.message : 'The testnet instruction could not be submitted.'} Do not retry automatically; check the live position panel or PERPL first.`); }
    }
    window.addEventListener('mot:submit-testnet-order', submit);
    return () => window.removeEventListener('mot:submit-testnet-order', submit);
  }, [chain, state]);

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
      if (attempt === generation.current) { setState({ status: 'error', accounts: [], positions: [], message: error instanceof Error ? error.message : 'Could not connect this API key.' }); setWorking(false); }
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
    <p>Create a dedicated Read + Trade key at <a href="https://testnet.perpl.xyz/apikeys" target="_blank" rel="noreferrer">PERPL testnet ↗</a> for the same wallet. A read-only key can verify the session but cannot submit an order.</p>
    <p>Only enter PERPL’s API token and API secret below—not your wallet private key or seed phrase. Never send these credentials in chat.</p>
    {!active && <form onSubmit={connect} autoComplete="off">
      <label htmlFor="perpl-api-token">PERPL testnet API token</label>
      <input ref={tokenInput} id="perpl-api-token" type="password" autoComplete="off" spellCheck={false} maxLength={4096} required disabled={working}/>
      <label htmlFor="perpl-api-secret">PERPL API secret (32-byte hex)</label>
      <input ref={secretInput} id="perpl-api-secret" type="password" autoComplete="off" spellCheck={false} maxLength={66} required disabled={working}/>
      <label className="perpl-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={working}/>I understand this is a testnet key. If it has trade scope, MOT may submit only the testnet instruction I explicitly review and confirm.</label>
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
    {active && state.positions.length > 0 && <div className="perpl-account"><strong>Live open positions: {state.positions.length}</strong>{state.positions.map(position => <p key={position.positionId}>Market #{position.marketId} · {position.side} · {position.leverage / 100}x · position #{position.positionId}</p>)}</div>}
    {(working || active) && <button className="wallet-button" onClick={() => { generation.current++; session.current?.disconnect(); session.current = null; setWorking(false); setConsent(false); setState({ status: 'closed', accounts: [], positions: [], message: 'Disconnected. The API key is still valid on PERPL until you revoke it there.' }); }}>Disconnect API session</button>}
    <p className="perpl-security-note">Session-only: credentials are not saved to browser storage or uploaded to MOT’s server. Reloading, changing wallet/network, or disconnecting clears the local session. This does not revoke the key on PERPL. API keys cannot withdraw funds, but a trade-enabled key can open losing positions; use testnet only.</p>
  </div>;
}
