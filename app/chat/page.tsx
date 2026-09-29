"use client";
import { useEffect, useRef, useState } from "react";
import { PerplSetup } from "@/components/perpl-setup";
import {
  ArrowUp,
  Mic,
  Wallet,
  Settings2,
  MessageSquare,
  ShieldCheck,
  Activity,
  Bell,
  ExternalLink,
  Square,
  X,
  LogOut,
  Plus,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PerplPosition } from "@/lib/mot/perpl-session";
import { useMotWallet } from "@/components/dynamic-wallet-provider";
import { createPublicClient, http } from "viem";
type TradeCandidate = {
  market: string;
  side: "long" | "short";
  marginUSD: number;
  leverage: number;
};
type TradePreferences = {
  slOn: boolean;
  sl: number;
  tpOn: boolean;
  tp: number;
};
type KuruSwapCandidate = {
  chainId: 143;
  marketAddress: string;
  direction: "MON_TO_USDC";
  amountInMon: number;
  expectedOutUsdc: number;
  minimumOutUsdc: number;
  slippageBps: number;
  data: `0x${string}`;
  value: `0x${string}`;
};
type UniswapSwapCandidate = {
  chainId: 143;
  routerAddress: string;
  direction: "MON_TO_USDC";
  amountInMon: number;
  expectedOutUsdc: number;
  minimumOutUsdc: number;
  slippageBps: number;
  expiresAt: number;
  data: `0x${string}`;
  value: `0x${string}`;
};
type RelayCandidate = {
  requestId: string;
  amount: number;
  tokenSymbol: string;
  originChainId: number;
  originChainName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  quotedAt: number;
  transactions: Array<{
    step: "approve" | "deposit" | "transaction";
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }>;
};
function validRelayCandidate(value: any): value is RelayCandidate {
  return Boolean(
    value &&
      /^0x[a-fA-F0-9]{64}$/.test(value.requestId) &&
      Number.isFinite(value.amount) &&
      value.amount > 0 &&
      /^[A-Za-z0-9]{2,12}$/.test(value.tokenSymbol) &&
      Number.isSafeInteger(value.originChainId) &&
      value.originChainId > 0 &&
      typeof value.originChainName === "string" &&
      /^https:\/\//.test(value.rpcUrl) &&
      Number.isFinite(value.quotedAt) &&
      value.nativeCurrency &&
      typeof value.nativeCurrency.name === "string" &&
      typeof value.nativeCurrency.symbol === "string" &&
      Number.isInteger(value.nativeCurrency.decimals) &&
      Array.isArray(value.transactions) &&
      value.transactions.length > 0 &&
      value.transactions.length <= 4 &&
      value.transactions.some(
        (transaction: any) => transaction.step === "deposit",
      ) &&
      value.transactions.every(
        (transaction: any) =>
          ["approve", "deposit", "transaction"].includes(transaction.step) &&
          /^0x[a-fA-F0-9]{40}$/.test(transaction.to) &&
          /^0x(?:[a-fA-F0-9]{2})*$/.test(transaction.data) &&
          /^\d{1,80}$/.test(transaction.value),
      ),
  );
}
type KuruMarket = {
  market: string;
  bestBid: number;
  bestAsk: number;
  midpoint: number;
  spreadPercent: number;
  blockNumber: number;
};
type Message = {
  id: string;
  role: "mot" | "user";
  text: string;
  generationUrl?: string;
  tradeCandidate?: TradeCandidate;
  tradePreferences?: TradePreferences;
  kuruCandidate?: KuruSwapCandidate;
  uniswapCandidate?: UniswapSwapCandidate;
  relayCandidate?: RelayCandidate;
  submission?: "submitting" | "submitted" | "confirmed" | "failed";
};
type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};
const messageId = () => crypto.randomUUID();
const initial: Message = {
  id: "welcome",
  role: "mot",
  text: "Hey, I’m MOT. Ask about a market or tell me what you want to do across Monad. You can type or use your voice. PERPL testnet orders, wallet-confirmed swaps, and Relay bridges to Monad are available.",
};
const defaults = {
  slOn: true,
  sl: 50,
  tpOn: false,
  tp: 100,
  maxMargin: 10,
  maxLeverage: 10,
  totalMargin: 50,
  expiry: 24,
  notification: "app",
};
export default function Home() {
  const dynamicWallet = useMotWallet();
  const [aiReady, setAiReady] = useState(false);
  const [envioReady, setEnvioReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/mot/chat")
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setAiReady(d.aiConfigured === true);
          setEnvioReady(d.envioConfigured === true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [messages, setMessages] = useState<Message[]>([initial]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyOwner, setHistoryOwner] = useState("");
  const [input, setInput] = useState("");
  const [wallet, setWallet] = useState("");
  const [walletMenu, setWalletMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState(false);
  const [coming, setComing] = useState("");
  const [prefs, setPrefs] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketError, setMarketError] = useState("");
  const [kuru, setKuru] = useState<KuruMarket | null>(null);
  const [kuruError, setKuruError] = useState("");
  const [perpl, setPerpl] = useState<{
    verified: boolean;
    positions: PerplPosition[];
  }>({ verified: false, positions: [] });
  const end = useRef<HTMLDivElement>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<any>(null);
  useEffect(() => {
    try {
      const p = localStorage.getItem("mot.preferences");
      if (p) setPrefs({ ...defaults, ...JSON.parse(p) });
    } catch {}
    setLoaded(true);
    return () => recognition.current?.abort();
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem("mot.preferences", JSON.stringify(prefs));
  }, [prefs, loaded]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  useEffect(() => {
    if (!walletMenu) return;
    const close = (event: MouseEvent) => {
      if (!walletMenuRef.current?.contains(event.target as Node))
        setWalletMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalletMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [walletMenu]);
  useEffect(() => {
    if (dynamicWallet.address) {
      setWallet(dynamicWallet.address);
      return;
    }
    const provider = (window as any).ethereum;
    if (!provider) return;
    const changed = (a: string[]) => setWallet(a[0] || "");
    provider
      .request({ method: "eth_accounts" })
      .then(changed)
      .catch(() => {});
    provider.on?.("accountsChanged", changed);
    return () => provider.removeListener?.("accountsChanged", changed);
  }, [dynamicWallet.address]);
  useEffect(() => {
    if (!loaded) return;
    setHistoryLoaded(false);
    const owner = wallet.toLowerCase() || "guest";
    setHistoryOwner("");
    try {
      const raw = localStorage.getItem(`mot.conversations:${owner}`);
      const saved = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved) && saved.length) {
        const safe = saved
          .filter(
            (item: any) =>
              item &&
              typeof item.id === "string" &&
              typeof item.title === "string" &&
              Array.isArray(item.messages),
          )
          .slice(0, 50);
        if (safe.length) {
          setConversations(safe);
          setActiveConversation(safe[0].id);
          setMessages(safe[0].messages.length ? safe[0].messages : [initial]);
          setHistoryOwner(owner);
          setHistoryLoaded(true);
          return;
        }
      }
    } catch {}
    const id = messageId();
    const fresh = {
      id,
      title: "New conversation",
      updatedAt: Date.now(),
      messages: [initial],
    };
    setConversations([fresh]);
    setActiveConversation(id);
    setMessages([initial]);
    setHistoryOwner(owner);
    setHistoryLoaded(true);
  }, [wallet, loaded]);
  useEffect(() => {
    if (!historyLoaded || !activeConversation) return;
    const owner = wallet.toLowerCase() || "guest";
    if (historyOwner !== owner) return;
    setConversations((current) => {
      const next = current
        .map((thread) =>
          thread.id === activeConversation
            ? {
                ...thread,
                title:
                  messages
                    .find((message) => message.role === "user")
                    ?.text.slice(0, 38) || "New conversation",
                updatedAt: Date.now(),
                messages,
              }
            : thread,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
      try {
        localStorage.setItem(
          `mot.conversations:${owner}`,
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  }, [messages, activeConversation, historyLoaded, historyOwner, wallet]);
  useEffect(() => {
    let active = true;
    async function fetchMarkets() {
      try {
        const r = await fetch("/api/markets");
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) {
          setMarkets(d.markets || []);
          setMarketError("");
        }
      } catch {
        if (active)
          setMarketError(
            "PERPL market data is unavailable. Prices are not estimated.",
          );
      }
    }
    fetchMarkets();
    const timer = setInterval(fetchMarkets, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    let active = true;
    async function fetchKuru() {
      try {
        const r = await fetch("/api/kuru/markets");
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) {
          setKuru(d.markets?.[0] || null);
          setKuruError("");
        }
      } catch {
        if (active) setKuruError("Kuru order book unavailable.");
      }
    }
    fetchKuru();
    const timer = setInterval(fetchKuru, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function connect() {
    if (dynamicWallet.configured) {
      dynamicWallet.open();
      return;
    }
    try {
      const e = (window as any).ethereum;
      if (!e) {
        setNotice(
          "Dynamic sign-in is not configured yet. Open MOTBOT in a wallet-enabled browser or install a wallet extension.",
        );
        return;
      }
      const a = await e.request({ method: "eth_requestAccounts" });
      setWallet(a[0] || "");
      setNotice(
        "Browser wallet connected. Every transaction still requires confirmation.",
      );
    } catch {
      setNotice(
        "Wallet connection was declined or unavailable. You can try again.",
      );
    }
  }
  function newConversation() {
    if (busy) return;
    const id = messageId();
    const thread = {
      id,
      title: "New conversation",
      updatedAt: Date.now(),
      messages: [initial],
    };
    setConversations((current) => [thread, ...current]);
    setActiveConversation(id);
    setMessages([initial]);
    setInput("");
  }
  function openConversation(id: string) {
    if (busy || id === activeConversation) return;
    const thread = conversations.find((item) => item.id === id);
    if (!thread) return;
    setActiveConversation(id);
    setMessages(thread.messages);
    setInput("");
  }
  function deleteConversation(id: string) {
    if (busy) return;
    const remaining = conversations.filter((item) => item.id !== id);
    let stored = remaining;
    if (remaining.length) {
      setConversations(remaining);
      if (id === activeConversation) {
        setActiveConversation(remaining[0].id);
        setMessages(remaining[0].messages);
      }
    } else {
      const nextId = messageId();
      const fresh = {
        id: nextId,
        title: "New conversation",
        updatedAt: Date.now(),
        messages: [initial],
      };
      setConversations([fresh]);
      setActiveConversation(nextId);
      setMessages([initial]);
      stored = [fresh];
    }
    const owner = wallet.toLowerCase() || "guest";
    try {
      localStorage.setItem(
        `mot.conversations:${owner}`,
        JSON.stringify(stored),
      );
    } catch {}
  }
  async function disconnect() {
    setWalletMenu(false);
    try {
      if (dynamicWallet.address) await dynamicWallet.disconnect();
      setWallet("");
      setPerpl({ verified: false, positions: [] });
      setNotice(
        dynamicWallet.address
          ? "Wallet disconnected from MOTBOT."
          : "Wallet disconnected from this MOTBOT session. Revoke site access inside your wallet extension if you also want to remove its permission.",
      );
    } catch {
      setNotice(
        "MOTBOT could not disconnect the wallet. Please try again or disconnect this site from your wallet settings.",
      );
    }
  }
  async function submitWalletTransaction(
    chainId: number,
    to: `0x${string}`,
    data: `0x${string}`,
    value: string,
    network?: Pick<
      RelayCandidate,
      "originChainName" | "rpcUrl" | "explorerUrl" | "nativeCurrency"
    >,
  ) {
    if (dynamicWallet.address)
      return dynamicWallet.sendTransaction({
        chainId,
        to,
        data,
        value: BigInt(value),
      });
    const provider = (window as any).ethereum;
    if (!provider || !wallet) throw Error("Connect a wallet first.");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error?.code !== 4902 || !network) throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${chainId.toString(16)}`,
            chainName: network.originChainName,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: [network.rpcUrl],
            blockExplorerUrls: network.explorerUrl ? [network.explorerUrl] : [],
          },
        ],
      });
    }
    const transactionValue = `0x${BigInt(value).toString(16)}`;
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: wallet, to, data, value: transactionValue }],
    });
    if (typeof hash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(hash))
      throw Error("Wallet did not return a transaction hash.");
    return hash as `0x${string}`;
  }
  async function trackWithEnvio(
    messageId: string,
    hash: string,
    appName: string,
  ) {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) =>
        setTimeout(resolve, attempt === 0 ? 1500 : 3000),
      );
      try {
        const response = await fetch(
          `/api/envio/transaction?hash=${encodeURIComponent(hash)}`,
          { cache: "no-store" },
        );
        const status: any = await response.json();
        if (response.status === 503) return;
        if (!response.ok || status.state === "pending") continue;
        const outcome =
          status.state === "confirmed"
            ? `confirmed in Monad block ${status.blockNumber}`
            : "reverted onchain";
        setMessages((all) =>
          all.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  text: `${item.text}\n\nEnvio HyperRPC: ${appName} transaction ${outcome}. Gas used: ${status.gasUsed ?? "unavailable"}.`,
                  submission:
                    status.state === "confirmed" ? "confirmed" : "failed",
                }
              : item,
          ),
        );
        return;
      } catch {
        return;
      }
    }
  }
  function voice() {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const C =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!C) {
      setNotice(
        "Voice input is unavailable in this browser. You can always type your command.",
      );
      return;
    }
    const r = new C();
    recognition.current = r;
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e: any) => setInput(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      setNotice(
        "Could not capture your voice. Check microphone permissions or type instead.",
      );
    };
    try {
      r.start();
      setListening(true);
    } catch {
      setNotice("Microphone could not start. Please try again.");
    }
  }
  async function send(text = input) {
    if (!text.trim() || busy) return;
    if (text.length > 3000) {
      setNotice("Please keep each message under 3,000 characters.");
      return;
    }
    const history = messages
      .slice(1)
      .slice(-10)
      .map((m) => ({
        role: m.role === "mot" ? "assistant" : "user",
        content: m.text.slice(0, 3000),
      }));
    while (history.reduce((n, m) => n + m.content.length, 0) > 10000)
      history.shift();
    const requestPrefs = { ...prefs };
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: messageId(), role: "user", text }]);
    try {
      const r = await fetch("/api/mot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          settings: requestPrefs,
          wallet: !!wallet,
          walletAddress: wallet || null,
          aiConsent: true,
          perpl: {
            verified: perpl.verified,
            positions: perpl.positions.map(
              ({
                marketId,
                positionId,
                side,
                collateral,
                entryPrice,
                size,
                leverage,
              }) => ({
                marketId,
                positionId,
                side,
                collateral,
                entryPrice,
                size,
                leverage,
              }),
            ),
          },
        }),
      });
      const d: any = await r.json();
      const candidate =
        d.tradeCandidate &&
        typeof d.tradeCandidate.market === "string" &&
        ["long", "short"].includes(d.tradeCandidate.side) &&
        Number.isFinite(d.tradeCandidate.marginUSD) &&
        Number.isFinite(d.tradeCandidate.leverage)
          ? d.tradeCandidate
          : undefined;
      const kuruCandidate =
        d.kuruCandidate &&
        d.kuruCandidate.chainId === 143 &&
        d.kuruCandidate.direction === "MON_TO_USDC" &&
        /^0x[a-fA-F0-9]{40}$/.test(d.kuruCandidate.marketAddress) &&
        /^0x[a-fA-F0-9]+$/.test(d.kuruCandidate.data) &&
        /^0x[a-fA-F0-9]+$/.test(d.kuruCandidate.value) &&
        Number.isFinite(d.kuruCandidate.amountInMon) &&
        Number.isFinite(d.kuruCandidate.minimumOutUsdc)
          ? d.kuruCandidate
          : undefined;
      const uniswapCandidate =
        d.uniswapCandidate &&
        d.uniswapCandidate.chainId === 143 &&
        d.uniswapCandidate.direction === "MON_TO_USDC" &&
        /^0x[a-fA-F0-9]{40}$/.test(d.uniswapCandidate.routerAddress) &&
        /^0x[a-fA-F0-9]+$/.test(d.uniswapCandidate.data) &&
        /^0x[a-fA-F0-9]+$/.test(d.uniswapCandidate.value) &&
        Number.isFinite(d.uniswapCandidate.amountInMon) &&
        Number.isFinite(d.uniswapCandidate.minimumOutUsdc) &&
        Number.isInteger(d.uniswapCandidate.expiresAt)
          ? d.uniswapCandidate
          : undefined;
      const relayCandidate = validRelayCandidate(d.relayCandidate)
        ? d.relayCandidate
        : undefined;
      setMessages((m) => [
        ...m,
        {
          id: messageId(),
          role: "mot",
          text:
            d.reply || "I could not process that request. Please try again.",
          tradeCandidate: candidate,
          tradePreferences: candidate
            ? {
                slOn: requestPrefs.slOn,
                sl: requestPrefs.sl,
                tpOn: requestPrefs.tpOn,
                tp: requestPrefs.tp,
              }
            : undefined,
          kuruCandidate,
          uniswapCandidate,
          relayCandidate,
          generationUrl:
            typeof d.generationUrl === "string" &&
            /^\/chat\/[a-f0-9-]+$/.test(d.generationUrl)
              ? d.generationUrl
              : undefined,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: messageId(),
          role: "mot",
          text: "Connection interrupted. No trade was submitted.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  function submitTestnet(message: Message) {
    if (
      !message.tradeCandidate ||
      !message.tradePreferences ||
      message.submission === "submitting" ||
      message.submission === "submitted"
    )
      return;
    if (!wallet) {
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\nConnect the same testnet wallet and its PERPL API session before submitting.`,
                submission: "failed",
              }
            : item,
        ),
      );
      return;
    }
    setMessages((all) =>
      all.map((item) =>
        item.id === message.id ? { ...item, submission: "submitting" } : item,
      ),
    );
    window.dispatchEvent(
      new CustomEvent("mot:submit-testnet-order", {
        detail: {
          id: message.id,
          trade: message.tradeCandidate,
          preferences: message.tradePreferences,
        },
      }),
    );
  }
  async function submitKuru(message: Message) {
    const candidate = message.kuruCandidate;
    if (
      !candidate ||
      message.submission === "submitting" ||
      message.submission === "submitted"
    )
      return;
    if (!wallet || (!dynamicWallet.address && !(window as any).ethereum)) {
      setNotice("Connect the wallet that will make this Kuru swap first.");
      return;
    }
    if (
      candidate.marketAddress.toLowerCase() !==
        "0x065c9d28e428a0db40191a54d33d5b7c71a9c394" ||
      !candidate.data.startsWith("0x532c46db")
    ) {
      setNotice("MOT rejected unexpected Kuru transaction data.");
      return;
    }
    setMessages((all) =>
      all.map((item) =>
        item.id === message.id ? { ...item, submission: "submitting" } : item,
      ),
    );
    try {
      const hash = await submitWalletTransaction(
        143,
        candidate.marketAddress as `0x${string}`,
        candidate.data,
        candidate.value,
      );
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\nSwap submitted to Kuru. Envio is checking finality. Transaction: https://monadscan.com/tx/${hash}`,
                submission: "submitted",
              }
            : item,
        ),
      );
      void trackWithEnvio(message.id, hash, "Kuru");
    } catch (error: any) {
      const declined = error?.code === 4001;
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\n${declined ? "Wallet confirmation was declined." : "Kuru swap was not submitted. Check your MON balance and try a fresh quote."}`,
                submission: "failed",
              }
            : item,
        ),
      );
    }
  }
  async function submitUniswap(message: Message) {
    const candidate = message.uniswapCandidate;
    if (
      !candidate ||
      message.submission === "submitting" ||
      message.submission === "submitted"
    )
      return;
    if (!wallet || (!dynamicWallet.address && !(window as any).ethereum)) {
      setNotice("Connect the wallet that will make this Uniswap swap first.");
      return;
    }
    if (
      candidate.routerAddress.toLowerCase() !==
        "0x4b2ab38dbf28d31d467aa8993f6c2585981d6804" ||
      !candidate.data.startsWith("0x7ff36ab5")
    ) {
      setNotice("MOT rejected unexpected Uniswap transaction data.");
      return;
    }
    if (candidate.expiresAt <= Math.floor(Date.now() / 1000)) {
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\nThis quote expired. Send a fresh Uniswap command before confirming.`,
                submission: "failed",
              }
            : item,
        ),
      );
      return;
    }
    setMessages((all) =>
      all.map((item) =>
        item.id === message.id ? { ...item, submission: "submitting" } : item,
      ),
    );
    try {
      const hash = await submitWalletTransaction(
        143,
        candidate.routerAddress as `0x${string}`,
        candidate.data,
        candidate.value,
      );
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\nSwap submitted to Uniswap. Envio is checking finality. Transaction: https://monadscan.com/tx/${hash}`,
                submission: "submitted",
              }
            : item,
        ),
      );
      void trackWithEnvio(message.id, hash, "Uniswap");
    } catch (error: any) {
      const declined = error?.code === 4001;
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\n${declined ? "Wallet confirmation was declined." : "Uniswap swap was not submitted. Check your MON balance and request a fresh quote."}`,
                submission: "failed",
              }
            : item,
        ),
      );
    }
  }
  async function submitRelay(message: Message) {
    const quotedCandidate = message.relayCandidate;
    if (
      !quotedCandidate ||
      message.submission === "submitting" ||
      message.submission === "submitted"
    )
      return;
    if (!wallet || (!dynamicWallet.address && !(window as any).ethereum)) {
      setNotice("Connect the wallet that will fund this Relay bridge first.");
      return;
    }
    setMessages((all) =>
      all.map((item) =>
        item.id === message.id ? { ...item, submission: "submitting" } : item,
      ),
    );
    try {
      const quoteResponse = await fetch("/api/relay/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: wallet,
          amount: quotedCandidate.amount,
          tokenSymbol: quotedCandidate.tokenSymbol,
          originChain: quotedCandidate.originChainName,
        }),
      });
      const quoteData: any = await quoteResponse.json();
      const candidate = quoteData?.quote?.candidate;
      if (!quoteResponse.ok || !validRelayCandidate(candidate))
        throw Error(
          quoteData?.error || "Relay did not return safe transaction steps.",
        );
      const chain = {
        id: candidate.originChainId,
        name: candidate.originChainName,
        nativeCurrency: candidate.nativeCurrency,
        rpcUrls: { default: { http: [candidate.rpcUrl] } },
      } as const;
      const client = createPublicClient({
        chain,
        transport: http(candidate.rpcUrl),
      });
      const hashes: string[] = [];
      for (const transaction of candidate.transactions) {
        const hash = await submitWalletTransaction(
          candidate.originChainId,
          transaction.to,
          transaction.data,
          transaction.value,
          candidate,
        );
        hashes.push(hash);
        const receipt = await client.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
        });
        if (receipt.status !== "success")
          throw Error(`${transaction.step} transaction reverted`);
      }
      const lastHash = hashes.at(-1)!;
      const transactionUrl = candidate.explorerUrl
        ? `${candidate.explorerUrl.replace(/\/$/, "")}/tx/${lastHash}`
        : lastHash;
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\nRelay deposit confirmed on ${candidate.originChainName}. Relay is processing delivery to Monad. Source transaction: ${transactionUrl}\nRelay request: ${candidate.requestId}`,
                submission: "submitted",
              }
            : item,
        ),
      );
    } catch (error: any) {
      const declined =
        error?.code === 4001 || error?.code === "ACTION_REJECTED";
      setMessages((all) =>
        all.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: `${item.text}\n\n${declined ? "Wallet confirmation was declined." : "Relay bridge was not fully submitted. Check the source-network balance and request a fresh quote before retrying."}`,
                submission: "failed",
              }
            : item,
        ),
      );
    }
  }
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (
        event as CustomEvent<{ id: string; ok: boolean; message: string }>
      ).detail;
      if (!detail?.id) return;
      setMessages((all) =>
        all.map((item) =>
          item.id === detail.id
            ? {
                ...item,
                text: `${item.text}\n\n${detail.message}`,
                submission: detail.ok ? "submitted" : "failed",
              }
            : item,
        ),
      );
    };
    window.addEventListener("mot:testnet-order-result", receive);
    return () =>
      window.removeEventListener("mot:testnet-order-result", receive);
  }, []);
  useEffect(() => {
    const c = (document as any).modelContext;
    if (!c?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        c.registerTool(
          {
            name: "open_trading_settings",
            description:
              "Open the visible MOTBOT trading settings dialog. Does not authorize or execute trades.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: (input: any) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw Error("No arguments accepted");
              setSettings(true);
              return { opened: true };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  const set = (key: string, value: any) =>
    setPrefs((p) => ({ ...p, [key]: value }));
  return (
    <div className="app-shell">
      <header className="topbar site-topbar">
        <a className="brand" href="/" aria-label="MOTBOT home">
          <span className="brandmark">m</span>MOTBOT
          <span className="network">ON MONAD</span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="/apps">Apps</a>
          <a href="/chat">Talk to MOT</a>
          <a href="/about">About</a>
          <a href="/roadmap">Roadmap</a>
        </nav>
        <div className="wallet-menu-wrap" ref={walletMenuRef}>
          {wallet ? (
            <>
              <button
                className="wallet-button"
                onClick={() => setWalletMenu((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={walletMenu}
              >
                <Wallet size={17} />
                {`${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
              </button>
              {walletMenu && (
                <div className="wallet-menu" role="menu">
                  <button
                    role="menuitem"
                    className="disconnect-wallet"
                    onClick={disconnect}
                  >
                    <LogOut size={16} />
                    Disconnect wallet
                  </button>
                </div>
              )}
            </>
          ) : (
            <button className="wallet-button" onClick={connect}>
              <Wallet size={17} />
              {dynamicWallet.configured
                ? "Sign in with Dynamic"
                : "Connect wallet"}
            </button>
          )}
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="side-title chat-history-title">
            <span>YOUR CHATS</span>
            <button
              onClick={newConversation}
              aria-label="Start new conversation"
              title="New conversation"
            >
              <Plus size={16} />
            </button>
          </div>
          <button className="new-chat-button" onClick={newConversation}>
            <Plus size={17} /> New conversation
          </button>
          <div className="conversation-list">
            {conversations.map((thread) => (
              <div
                className={`conversation-item ${thread.id === activeConversation ? "selected" : ""}`}
                key={thread.id}
              >
                <button
                  onClick={() => openConversation(thread.id)}
                  title={thread.title}
                >
                  <MessageSquare size={15} />
                  <span>{thread.title}</span>
                </button>
                <button
                  onClick={() => deleteConversation(thread.id)}
                  aria-label={`Delete ${thread.title}`}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="side-link" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            Trading settings
          </button>
          <div className="side-divider" />
          <div className="side-title">EXECUTION</div>
          <div className="execution-note">
            <ShieldCheck size={21} />
            <strong>You give the instruction.</strong>
            <p>MOT never opens a trade from its own analysis.</p>
          </div>
          <div className="sidebar-bottom">
            <span className="version">EARLY ACCESS · WALLET CONFIRMATION</span>
            <a
              href="https://docs.perpl.xyz/resources/for-developers"
              target="_blank"
              rel="noreferrer"
            >
              PERPL documentation <ExternalLink size={14} />
            </a>
          </div>
        </aside>
        <main className="conversation">
          <div className="conversation-top">
            <div>
              <h1>Talk to MOT</h1>
              <p>Your Monad action workspace. In your own words.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Open trading settings"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={20} />
            </button>
          </div>
          <div className="availability">
            <Activity size={16} />
            <span>
              Dynamic wallet · Kuru execution · Envio finality · Confirmation
              required
            </span>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="ai-status">
            <span>
              {aiReady
                ? "AI conversation is active · Never enter wallet secrets."
                : "Live prices and instruction previews available · AI activation pending"}
            </span>
          </div>
          <div className="messages" aria-live="polite">
            {messages.length === 1 && (
              <div className="welcome">
                <span className="mot-emblem">m</span>
                <h2>What’s your next move?</h2>
                <p>A conversation is a good place to start.</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`message ${m.role}`}>
                <span className="message-label">
                  {m.role === "mot" ? "MOT" : "YOU"}
                </span>
                <p>{m.text}</p>
                {m.tradeCandidate && !m.submission && (
                  <button
                    className="trade-submit"
                    onClick={() => submitTestnet(m)}
                  >
                    Submit this testnet order
                  </button>
                )}
                {m.kuruCandidate && !m.submission && (
                  <button
                    className="trade-submit"
                    onClick={() => submitKuru(m)}
                  >
                    Review and confirm Kuru swap
                  </button>
                )}
                {m.uniswapCandidate && !m.submission && (
                  <button
                    className="trade-submit"
                    onClick={() => submitUniswap(m)}
                  >
                    Review and confirm Uniswap swap
                  </button>
                )}
                {m.relayCandidate && !m.submission && (
                  <button
                    className="trade-submit"
                    onClick={() => submitRelay(m)}
                  >
                    Review and confirm Relay bridge
                  </button>
                )}
                {m.submission === "submitting" && (
                  <button className="trade-submit" disabled>
                    {m.kuruCandidate || m.uniswapCandidate || m.relayCandidate
                      ? "Waiting for wallet…"
                      : "Submitting to PERPL…"}
                  </button>
                )}
                {m.generationUrl && (
                  <a href={m.generationUrl}>View saved response</a>
                )}
              </div>
            ))}
            {busy && (
              <div className="message mot">
                <span className="message-label">MOT</span>
                <p>Checking your request…</p>
              </div>
            )}
            <div ref={end} />
          </div>
          {messages.length === 1 && (
            <div className="suggestions">
              {[
                "Swap 0.01 MON to USDC on Uniswap",
                "Bridge 0.001 ETH from Base to Monad using Relay",
                "Short BTC with $10 at 10x",
              ].map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                  <ArrowUp size={14} />
                </button>
              ))}
            </div>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              id="command"
              aria-label="Message MOT"
              placeholder={
                listening
                  ? "Listening… press stop when you finish"
                  : "Ask a question or give a trading instruction…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
            />
            <div className="composer-bottom">
              <span>
                <ShieldCheck size={14} />
                Your wallet. Your instructions.
              </span>
              <div>
                <button
                  type="button"
                  className={`voice-button ${listening ? "recording" : ""}`}
                  onClick={voice}
                  aria-label={
                    listening ? "Stop recording" : "Start voice input"
                  }
                >
                  {listening ? <Square size={17} /> : <Mic size={18} />}
                </button>
                <button
                  className="send-button"
                  aria-label="Send message"
                  disabled={!input.trim() || busy}
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </div>
          </form>
          <p className="composer-hint">
            Voice or text, anytime. Voice commands appear here for you to send.
          </p>
        </main>
        <aside className="market-panel">
          <div className="panel-title">
            MARKET WATCH <span>PERPL</span>
          </div>
          {marketError ? (
            <div className="empty-market">
              <Activity size={24} />
              <p>{marketError}</p>
            </div>
          ) : markets.length ? (
            markets.slice(0, 4).map((m) => (
              <button
                className="market-row"
                key={m.symbol}
                onClick={() => send(`What is the price of ${m.symbol}?`)}
              >
                <span>
                  {m.symbol}
                  <small>Perpetual</small>
                </span>
                <strong>
                  {m.price
                    ? `$${Number(m.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : "—"}
                </strong>
              </button>
            ))
          ) : (
            <p className="muted">Loading PERPL markets…</p>
          )}
          <div className="panel-title integration-panel-title">
            SPONSOR STACK <span>LIVE / READY</span>
          </div>
          <div className="sponsor-stack">
            <div>
              <strong>DYNAMIC</strong>
              <span>
                {dynamicWallet.configured
                  ? "Authentication + EVM signing ready"
                  : "Awaiting environment ID"}
              </span>
            </div>
            <div>
              <strong>KURU</strong>
              <span>Direct order-book swaps live</span>
            </div>
            <div>
              <strong>ENVIO</strong>
              <span>
                {envioReady
                  ? "HyperRPC finality monitoring ready"
                  : "Awaiting API token"}
              </span>
            </div>
          </div>
          <div className="panel-title integration-panel-title">
            KURU ORDER BOOK <span>SWAPS LIVE</span>
          </div>
          {kuru ? (
            <button
              className="market-row"
              onClick={() => send("Show the Kuru MON order book")}
            >
              <span>
                MON / USDC<small>Spot midpoint</small>
              </span>
              <strong>${kuru.midpoint.toFixed(6)}</strong>
            </button>
          ) : (
            <p className="muted">{kuruError || "Loading Kuru market…"}</p>
          )}
          <section className="limits">
            <div className="panel-title">
              YOUR DEFAULTS
              <button
                aria-label="Edit defaults"
                onClick={() => setSettings(true)}
              >
                <Settings2 size={15} />
              </button>
            </div>
            <dl>
              <div>
                <dt>Margin per trade</dt>
                <dd>≤ ${prefs.maxMargin}</dd>
              </div>
              <div>
                <dt>Leverage</dt>
                <dd>≤ {prefs.maxLeverage}x</dd>
              </div>
              <div>
                <dt>Stop-loss</dt>
                <dd>{prefs.slOn ? `${prefs.sl}% of margin` : "Off"}</dd>
              </div>
              <div>
                <dt>Take-profit</dt>
                <dd>{prefs.tpOn ? `${prefs.tp}% of margin` : "Off"}</dd>
              </div>
            </dl>
            <p>
              Defaults apply to new trades. A trade-specific instruction
              overrides its corresponding default.
            </p>
          </section>
          <PerplSetup
            wallet={wallet}
            connect={connect}
            onSessionChange={setPerpl}
          />
          <section className="positions">
            <div className="panel-title">OPEN POSITIONS</div>
            <div className="empty-positions">
              <Wallet size={25} />
              <h3>Live PERPL updates</h3>
              <p>
                Connect the testnet API session above. Open positions will
                appear in its live position card.
              </p>
            </div>
          </section>
          <div className="referral-note">
            Referral registration will be added in a future update.
          </div>
        </aside>
      </div>
      <Dialog
        open={!!coming}
        onOpenChange={(o) => {
          if (!o) setComing("");
        }}
      >
        <DialogContent>
          <DialogTitle>{coming}</DialogTitle>
          <DialogDescription>
            Coming soon. The first MOTBOT integration focuses on PERPL perpetual
            trading. Orders are not routed to this platform yet.
          </DialogDescription>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="settings-dialog">
          <DialogTitle>Trading settings</DialogTitle>
          <DialogDescription>
            Choose your limits and defaults. These preferences do not grant
            trading authorization.
          </DialogDescription>
          <div className="settings-fields">
            {[
              ["Maximum margin per trade ($)", "maxMargin"],
              ["Maximum leverage (x)", "maxLeverage"],
              ["Maximum total open margin ($)", "totalMargin"],
              ["Conditional instruction expiry (hours)", "expiry"],
            ].map(([label, key]) => (
              <label className="number-row" key={key}>
                {label}
                <input
                  aria-label={label}
                  type="number"
                  min="1"
                  max={key === "maxLeverage" ? 100 : 100000}
                  value={(prefs as any)[key]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 1 && n <= 100000)
                      set(key, n);
                  }}
                />
              </label>
            ))}
            <div className="setting-block">
              <label htmlFor="default-sl">Default stop-loss</label>
              <Switch
                id="default-sl"
                checked={prefs.slOn}
                onCheckedChange={(v) => set("slOn", v)}
              />
              <p>
                When off, no automatic loss protection is applied unless
                requested for a trade.
              </p>
              {prefs.slOn && (
                <label className="number-row">
                  Loss as % of opening margin
                  <input
                    aria-label="Default stop loss percent"
                    type="number"
                    min="1"
                    max="100"
                    value={prefs.sl}
                    onChange={(e) => {
                      const n = +e.target.value;
                      if (n > 0 && n <= 100) set("sl", n);
                    }}
                  />
                </label>
              )}
            </div>
            <div className="setting-block">
              <label htmlFor="default-tp">Default take-profit</label>
              <Switch
                id="default-tp"
                checked={prefs.tpOn}
                onCheckedChange={(v) => set("tpOn", v)}
              />
              <p>
                Target profit as a percentage of each trade’s opening margin.
              </p>
              {prefs.tpOn && (
                <label className="number-row">
                  Profit as % of opening margin
                  <input
                    aria-label="Default take profit percent"
                    type="number"
                    min="1"
                    value={prefs.tp}
                    onChange={(e) => {
                      const n = +e.target.value;
                      if (n > 0 && n <= 100000) set("tp", n);
                    }}
                  />
                </label>
              )}
            </div>
            <label className="notification-choice">
              Alert delivery
              <Select
                value={prefs.notification}
                onValueChange={(v) => set("notification", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="app">In-app only</SelectItem>
                  <SelectItem value="email">Email only</SelectItem>
                  <SelectItem value="both">Email and in-app</SelectItem>
                </SelectContent>
              </Select>
              <span>
                Email delivery and background alerts are not active yet.
              </span>
            </label>
          </div>
          <button
            className="save-button"
            onClick={() => {
              setSettings(false);
              setNotice(
                "Preferences saved on this device. Trading authorization is still pending.",
              );
            }}
          >
            Save preferences
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
