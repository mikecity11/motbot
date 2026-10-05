import { getMonadWalletBalances } from "@/lib/mot/wallet-balances";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") || "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(address))
    return Response.json(
      { error: "Connect a valid wallet first." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const balances = await getMonadWalletBalances(address);
    return Response.json(
      { chainId: 143, network: "Monad mainnet", balances },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Monad wallet balances are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
