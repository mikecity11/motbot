function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { code?: unknown; cause?: { code?: unknown } };
  return value.code ?? value.cause?.code;
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    const value = error as Error & {
      shortMessage?: string;
      details?: string;
      cause?: { shortMessage?: string; message?: string };
    };
    return [value.shortMessage, value.details, value.cause?.shortMessage, value.cause?.message, value.message]
      .find((item) => typeof item === "string" && item.trim())
      ?.trim() ?? "";
  }
  return typeof error === "string" ? error.trim() : "";
}

export function walletSubmissionError(error: unknown) {
  const code = errorCode(error);
  const detail = errorText(error);
  const normalized = detail.toLowerCase();
  if (code === 4001 || code === "ACTION_REJECTED" || /user rejected|user denied|declined/.test(normalized))
    return "Wallet confirmation was declined. No transaction was submitted.";
  if (code === 4902 || /unknown chain|unrecognized chain|unsupported chain|chain.*not (?:configured|supported)|network.*not (?:configured|supported)/.test(normalized))
    return "Monad mainnet is not available in the connected wallet. Add or select Monad (chain 143), then request a fresh quote.";
  if (/insufficient funds|exceeds balance/.test(normalized))
    return "The wallet does not have enough MON for the swap amount plus network gas. Reduce the amount and request a fresh quote.";
  if (/chain mismatch|wrong network|different chain/.test(normalized))
    return "The wallet is on the wrong network. Switch it to Monad mainnet (chain 143), then request a fresh quote.";
  if (/execution reverted|transaction may fail|estimate gas/.test(normalized))
    return "Monad rejected the swap during simulation, so MOTBOT did not submit it. The quote may have moved or expired; request a fresh quote.";
  const safeDetail = detail.replace(/https?:\/\/\S+/g, "").replace(/0x[a-fA-F0-9]{64,}/g, "[hidden]").replace(/\s+/g, " ").slice(0, 180).trim();
  return safeDetail
    ? `The wallet could not submit the swap: ${safeDetail}`
    : "The wallet could not submit the swap. Make sure Monad mainnet is selected, then request a fresh quote.";
}
