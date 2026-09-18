import { createPublicClient, http, isAddress } from 'viem';
import { NextResponse } from 'next/server';

const exchange = '0x1964c32f0be608e7d29302aff5e61268e72080cc' as const;
const client = createPublicClient({ transport: http('https://testnet-rpc.monad.xyz', { timeout: 8000, retryCount: 0 }) });
const abi = [{ type: 'function', name: 'getAccountByAddr', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'account', type: 'uint256' }] }] as const;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get('address');
  if (!address || !isAddress(address)) return NextResponse.json({ error: 'A valid wallet address is required.' }, { status: 400 });
  try {
    const [chainId, code] = await Promise.all([client.getChainId(), client.getCode({ address: exchange })]);
    if (chainId !== 10143 || !code || code === '0x') throw new Error('Unverified network');
    const account = await client.readContract({ address: exchange, abi, functionName: 'getAccountByAddr', args: [address], account: address });
    return NextResponse.json({ chainId, accountId: account.toString(), accountExists: account !== BigInt(0), tradingEnabled: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // A revert or outage is not proof that an account is missing.
    return NextResponse.json({ error: 'Could not verify this PERPL testnet account. No transactions were submitted. Try again or check on PERPL.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
