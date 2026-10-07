'use client';
import { useEffect, useRef, useState } from 'react';
import { importApiSigningKey, PERPL_NETWORKS, PerplReadOnlySession, type PerplNetwork, type PerplPosition, type SessionState } from '@/lib/mot/perpl-session';
import { assertMarketLiquidity, decodeTradingContext, planMarketOrders, type ProtectionPreferences, type TradeCandidate } from '@/lib/mot/perpl-orders';

type SubmitDetail = { id: string; trade: TradeCandidate; preferences: ProtectionPreferences };

export function PerplAuthorization({ wallet, chain, network, onSessionChange }: { wallet: string; chain: string; network: PerplNetwork; onSessionChange?: (snapshot: { verified: boolean; network: PerplNetwork; positions: PerplPosition[] }) => void }) {
  const tokenInput = useRef<HTMLInputElement>(null);
  const secretInput = useRef<HTMLInputElement>(null);
  const session = useRef<PerplReadOnlySession | null>(null);
  const generation = useRef(0);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    onSessionChange?.({ verified: state?.status === 'authenticated', network, positions: state?.status === 'authenticated' ? state.positions : [] });
  }, [state, network, onSessionChange]);

  useEffect(() => {
    async function submit(event: Event) {
      const detail = (event as CustomEvent<SubmitDetail>).detail;
      const reply = (ok: boolean, message: string) => window.dispatchEvent(new CustomEvent('mot:perpl-order-result', { detail: { id: detail?.id, ok, message } }));
      try {
        const config = PERPL_NETWORKS[network];
        if (!detail || typeof detail.id !== 'string' || !detail.trade || !detail.preferences) throw new Error('The reviewed instruction is invalid.');
        if (Number(chain) !== config.chainId || !session.current || state?.status !== 'authenticated') throw new Error(`Connect a verified PERPL ${network} API session first.`);
        const account = state.accounts.find(item => item.forwarding === true && item.frozen === false);
        if (!account) throw new Error('A verified, unfrozen PERPL account with order forwarding enabled is required.');
        if (account.balance === null || account.lockedBalance === null) throw new Error('PERPL did not provide a verified collateral balance.');
        const required = BigInt(Math.ceil(detail.trade.marginUSD * 1_000_000));
        if (BigInt(account.balance) - BigInt(account.lockedBalance) < required) throw new Error(`Available ${network} collateral is below the requested opening margin.`);
        const response = await fetch(config.contextUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load PERPL’s live trading limits.');
        const context = decodeTradingContext(await response.json());
        const market = context.markets.find(item => item.symbol.toUpperCase() === detail.trade.market.toUpperCase());
        if (!market) throw new Error(`${detail.trade.market} is not available on PERPL ${network}.`);
        const firstRq = session.current.nextRequestId(account.id);
        const firstCid = session.current.nextCorrelationId();
        const orders = planMarketOrders({ trade: detail.trade, preferences: detail.preferences, market, accountId: account.id, firstRequestId: firstRq, firstCorrelationId: firstCid, head: context.head });
        const bookUrl = config.contextUrl.replace('/pub/context', `/market-data/${market.id}/book?levels=100`);
        const bookResponse = await fetch(bookUrl, { cache: 'no-store' });
        if (!bookResponse.ok) throw new Error('Could not verify PERPL liquidity. No order was submitted.');
        assertMarketLiquidity(await bookResponse.json(), orders[0], market);
        const admissions = await session.current.submitOrders(orders);
        const rejected = admissions.find(item => !item.accepted);
        if (rejected) throw new Error(rejected.code === 403 ? 'PERPL rejected this API key because it does not have trade scope.' : `PERPL rejected part of the instruction: ${rejected.error || `code ${rejected.code}`}. Check the account on PERPL before trying again.`);
        const filled = admissions[0]?.evidence === 'position';
        const forwarded = admissions.some(item => item.evidence === 'forwarded' || item.evidence === 'order');
        reply(true, filled ? `PERPL confirmed the resulting position. The ${network} trade is open.` : forwarded ? `${network} request submitted. ${admissions.map(item => item.error).join(' ')} An open position is not yet confirmed; check PERPL ${network} Order History and Positions before sending another instruction.` : `${orders.length} ${network} order${orders.length === 1 ? '' : 's'} accepted for forwarding by PERPL. Acceptance is not proof of a fill; wait for the live position update.`);
      } catch (error) { reply(false, `${error instanceof Error ? error.message : `The ${network} instruction could not be submitted.`} Do not retry automatically; check the live position panel or PERPL first.`); }
    }
    window.addEventListener('mot:submit-perpl-order', submit);
    return () => window.removeEventListener('mot:submit-perpl-order', submit);
  }, [chain, network, state]);

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
  }, [wallet, chain, network]);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const config = PERPL_NETWORKS[network];
    if (working || !consent || Number(chain) !== config.chainId) return;
    const attempt = ++generation.current;
    session.current?.disconnect(); session.current = null;
    setWorking(true); setState(null);
    try {
      const apiKey = tokenInput.current?.value.trim() ?? '';
      if (!apiKey || apiKey.length > 4096 || /\s/.test(apiKey)) throw new Error('Enter the API token provided by PERPL.');
      const signingKey = await importApiSigningKey(secretInput.current?.value ?? '');
      if (attempt !== generation.current) return;
      const next = new PerplReadOnlySession({ wallet, apiKey, signingKey, network, onState: value => {
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
  const config = PERPL_NETWORKS[network];
  return <div className="perpl-auth">
    <h3>Connect a {network} API key</h3>
    <p>Create a dedicated Read + Trade key at <a href={config.apiKeysUrl} target="_blank" rel="noreferrer">PERPL {network} ↗</a> for the same wallet. A read-only key can verify the session but cannot submit an order.</p>
    <p>Only enter PERPL’s API token and API secret below—not your wallet private key or seed phrase. Never send these credentials in chat.</p>
    {!active && <form onSubmit={connect} autoComplete="off">
      <label htmlFor="perpl-api-token">PERPL {network} API token</label>
      <input ref={tokenInput} id="perpl-api-token" type="password" autoComplete="off" spellCheck={false} maxLength={4096} required disabled={working}/>
      <label htmlFor="perpl-api-secret">PERPL API secret (32-byte hex)</label>
      <input ref={secretInput} id="perpl-api-secret" type="password" autoComplete="off" spellCheck={false} maxLength={66} required disabled={working}/>
      <label className="perpl-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={working}/>I understand this is a {network} key. {network === 'mainnet' ? 'Mainnet orders use real funds. ' : ''}MOT may submit only an instruction I explicitly review and confirm.</label>
      <button className="wallet-button" disabled={!consent || working || Number(chain) !== config.chainId}>{working ? 'Verifying session…' : 'Verify API session'}</button>
      {Number(chain) !== config.chainId && <p>Select Monad {network} in your wallet first.</p>}
    </form>}
    {state && <p role="status">{state.message}</p>}
    {active && <>
      {state.accounts.length ? state.accounts.map(account => <div className="perpl-account" key={`${account.instance}:${account.id}`}>
        <strong>Account {account.id} · instance {account.instance}</strong>
        <p>Order forwarding: {account.forwarding === null ? 'Not verified' : account.forwarding ? 'Enabled' : 'Disabled'}</p>
        <p>Account frozen: {account.frozen === null ? 'Not verified' : account.frozen ? 'Yes' : 'No'}</p>
      </div>) : <p>API authentication works, but this wallet snapshot has no exchange account. Create and fund one on PERPL {network}.</p>}
      <p>To enable forwarding, use PERPL’s One-Click Trading setting. MOT does not change this permission for you.</p>
    </>}
    {active && state.positions.length > 0 && <div className="perpl-account"><strong>Live open positions: {state.positions.length}</strong>{state.positions.map(position => <p key={position.positionId}>Market #{position.marketId} · {position.side} · {position.leverage / 100}x · position #{position.positionId}</p>)}</div>}
    {(working || active) && <button className="wallet-button" onClick={() => { generation.current++; session.current?.disconnect(); session.current = null; setWorking(false); setConsent(false); setState({ status: 'closed', accounts: [], positions: [], message: 'Disconnected. The API key is still valid on PERPL until you revoke it there.' }); }}>Disconnect API session</button>}
    <p className="perpl-security-note">Enter the key once per browser session—not once per trade. Credentials are not saved to browser storage or uploaded to MOT’s server. Reloading, changing wallet/network, or disconnecting clears the session. This does not revoke the key on PERPL. API keys cannot withdraw funds, but a trade-enabled key can open losing positions{network === 'mainnet' ? ' with real funds' : ''}.</p>
  </div>;
}
