'use client';
import { useEffect, useState } from 'react';
import { PerplAuthorization } from '@/components/perpl-authorization';

type Check = { address: string; accountExists?: boolean; accountId?: string; error?: string };
type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (event: string, fn: (value: string) => void) => void; removeListener?: (event: string, fn: (value: string) => void) => void };

export function PerplSetup({ wallet, connect }: { wallet: string; connect: () => void }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [chain, setChain] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [networkError, setNetworkError] = useState('');
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
    if (!wallet) return;
    const controller = new AbortController();
    setCheck(null);
    fetch(`/api/perpl/setup?address=${encodeURIComponent(wallet)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (!controller.signal.aborted) setCheck({ address: wallet, ...data }); })
      .catch(error => { if (!controller.signal.aborted) setCheck({ address: wallet, error: error instanceof Error ? error.message : 'Account check unavailable.' }); });
    return () => controller.abort();
  }, [wallet, refresh]);
  async function switchNetwork() {
    try {
      const provider = (window as unknown as { ethereum?: Provider }).ethereum;
      if (!provider) throw new Error('Wallet unavailable');
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      setChain(String(await provider.request({ method: 'eth_chainId' })));
      setNetworkError('');
    } catch { setNetworkError('Network switch unavailable or declined. Add or select Monad testnet in your wallet, then retry.'); }
  }
  const current = check?.address === wallet ? check : null;
  return <section className="limits perpl-setup" aria-label="PERPL testnet setup">
    <div className="panel-title">PERPL SETUP <span>TESTNET</span></div>
    {!wallet ? <><p>Connect your wallet for a read-only account check. Never share your seed phrase.</p><button className="wallet-button" onClick={connect}>Connect wallet</button></> : <>
      <p>Wallet network: {chain ? Number(chain) === 10143 ? 'Monad testnet' : `Other network (${Number(chain)})` : 'Not verified'}</p>
      {Number(chain) !== 10143 && <button className="wallet-button" onClick={switchNetwork}>Switch to Monad testnet</button>}
      {networkError && <p role="status">{networkError}</p>}
      <p role="status">{!current ? 'Checking testnet account…' : current.error ? current.error : current.accountExists ? `Exchange account verified · ID ${current.accountId}` : 'No exchange account found on testnet.'}</p>
      <button className="wallet-button" onClick={() => setRefresh(value => value + 1)}>Refresh account check</button>
      <p><a href="https://testnet.perpl.xyz" target="_blank" rel="noreferrer">Open PERPL testnet to create or fund an account ↗</a></p>
      <p><a href="https://testnet.perpl.xyz/apikeys" target="_blank" rel="noreferrer">PERPL testnet API keys ↗</a></p>
      <PerplAuthorization wallet={wallet} chain={chain}/>
      <p>After API authentication and forwarding are verified, a complete chat instruction can be reviewed and submitted on testnet.</p>
    </>}
    <p>MOT never deposits, withdraws, or changes wallet approvals. Testnet orders require your explicit confirmation.</p>
  </section>;
}
