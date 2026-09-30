'use client';
import { useEffect, useState } from 'react';
import { PerplAuthorization } from '@/components/perpl-authorization';
import { PERPL_NETWORKS, type PerplNetwork, type PerplPosition } from '@/lib/mot/perpl-session';

type Check = { address: string; accountExists?: boolean; accountId?: string; error?: string };
type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (event: string, fn: (value: string) => void) => void; removeListener?: (event: string, fn: (value: string) => void) => void };

export function PerplSetup({ wallet, connect, onSessionChange }: { wallet: string; connect: () => void; onSessionChange?: (snapshot: { verified: boolean; network: PerplNetwork; positions: PerplPosition[] }) => void }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [chain, setChain] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [networkError, setNetworkError] = useState('');
  const [network, setNetwork] = useState<PerplNetwork>('testnet');
  const config = PERPL_NETWORKS[network];
  useEffect(() => {
    const provider = (window as unknown as { ethereum?: Provider }).ethereum;
    if (!provider) return;
    let active = true;
    const changed = (id: string) => { if (active) { setChain(id); setNetworkError(''); } };
    provider.request({ method: 'eth_chainId' }).then(id => changed(String(id))).catch(() => { if (active) setChain(''); });
    provider.on?.('chainChanged', changed);
    return () => { active = false; provider.removeListener?.('chainChanged', changed); };
  }, [wallet]);
  useEffect(() => {
    if (!wallet || network === 'mainnet') return;
    const controller = new AbortController();
    setCheck(null);
    fetch(`/api/perpl/setup?address=${encodeURIComponent(wallet)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (!controller.signal.aborted) setCheck({ address: wallet, ...data }); })
      .catch(error => { if (!controller.signal.aborted) setCheck({ address: wallet, error: error instanceof Error ? error.message : 'Account check unavailable.' }); });
    return () => controller.abort();
  }, [wallet, refresh, network]);
  async function switchNetwork() {
    try {
      const provider = (window as unknown as { ethereum?: Provider }).ethereum;
      if (!provider) throw new Error('Wallet unavailable');
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${config.chainId.toString(16)}` }] });
      setChain(String(await provider.request({ method: 'eth_chainId' })));
      setNetworkError('');
    } catch { setNetworkError(`Network switch unavailable or declined. Add or select Monad ${network} in your wallet, then retry.`); }
  }
  const current = check?.address === wallet ? check : null;
  return <section className="limits perpl-setup" aria-label={`PERPL ${network} setup`}>
    <div className="panel-title">PERPL SETUP <span>{network.toUpperCase()}</span></div>
    <label className="perpl-network-picker" htmlFor="perpl-network">Trading network</label>
    <select id="perpl-network" value={network} onChange={event => { setNetwork(event.target.value as PerplNetwork); setCheck(null); setNetworkError(''); }}>
      <option value="testnet">Testnet · practice funds</option>
      <option value="mainnet">Mainnet · real funds</option>
    </select>
    {network === 'mainnet' && <p className="perpl-mainnet-warning"><strong>Mainnet uses real funds.</strong> Check the market, margin, leverage, and protection orders before confirming.</p>}
    {!wallet ? <><p>Connect your wallet for a read-only account check. Never share your seed phrase.</p><button className="wallet-button" onClick={connect}>Connect wallet</button></> : <>
      <p>Wallet network: {chain ? Number(chain) === config.chainId ? `Monad ${network}` : `Other network (${Number(chain)})` : 'Not verified'}</p>
      {Number(chain) !== config.chainId && <button className="wallet-button" onClick={switchNetwork}>Switch to Monad {network}</button>}
      {networkError && <p role="status">{networkError}</p>}
      {network === 'testnet' && <><p role="status">{!current ? 'Checking testnet account…' : current.error ? current.error : current.accountExists ? `Exchange account verified · ID ${current.accountId}` : 'No exchange account found on testnet.'}</p><button className="wallet-button" onClick={() => setRefresh(value => value + 1)}>Refresh account check</button></>}
      {network === 'mainnet' && <p>Your mainnet exchange account is verified through the PERPL API session below.</p>}
      <p><a href={config.appUrl} target="_blank" rel="noreferrer">Open PERPL {network} to create or fund an account ↗</a></p>
      <p><a href={config.apiKeysUrl} target="_blank" rel="noreferrer">PERPL {network} API keys ↗</a></p>
      <PerplAuthorization key={network} wallet={wallet} chain={chain} network={network} onSessionChange={onSessionChange}/>
      <p>After API authentication and forwarding are verified, a complete chat instruction can be reviewed and submitted on {network}.</p>
    </>}
    <p>MOT never deposits, withdraws, or changes wallet approvals. Every PERPL order requires your explicit confirmation.</p>
  </section>;
}
