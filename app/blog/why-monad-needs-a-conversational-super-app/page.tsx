import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Why Monad needs a conversational super-app — MOTBOT",
  description:
    "MOTBOT is building a conversational layer that helps people discover, understand and interact with apps across Monad.",
};

export default function ArticlePage() {
  return (
    <div className="content-page article-page">
      <SiteHeader />
      <main>
        <article className="article-shell">
          <Link className="article-back" href="/blog"><ArrowLeft size={15} /> Back to the journal</Link>
          <header className="article-header">
            <div className="section-kicker">PRODUCT VISION · 6 MIN READ</div>
            <h1>Why Monad needs a conversational super-app</h1>
            <p className="article-deck">
              A blockchain can be fast without feeling simple. MOTBOT is our
              attempt to make the whole Monad ecosystem feel like one clear
              conversation.
            </p>
            <div className="article-meta"><span>MOTBOT</span><time dateTime="2026-09-30">30 September 2026</time></div>
          </header>

          <div className="article-body">
            <p className="article-lead">
              Monad is becoming home to trading platforms, exchanges, bridges,
              games, prediction markets and many other onchain experiences. That
              growth is exciting, but it also creates a new problem: users must
              keep learning where to go and how every interface works.
            </p>

            <h2>More apps should not mean more friction</h2>
            <p>
              Today, one simple goal can require several tabs. A user may need to
              bridge funds, find a market, compare a price, connect a wallet and
              then learn a completely different transaction flow. Each app may be
              excellent on its own, yet the journey between them remains fragmented.
            </p>
            <p>
              MOTBOT starts from the user’s intent instead. You can type or speak
              what you want to do, and MOT identifies the relevant integration,
              explains the action and prepares it for review.
            </p>

            <blockquote>
              One conversation should be enough to discover and interact with the
              whole Monad ecosystem.
            </blockquote>

            <h2>Conversation is the interface—not the authority</h2>
            <p>
              Simplicity must not remove control. MOT can analyse a request and
              prepare an action, but it does not invent trades or move funds by
              itself. The user remains the decision-maker and confirms every
              onchain action from the connected wallet.
            </p>
            <p>
              This distinction matters most for leveraged trading and mainnet
              transactions. MOTBOT shows the selected network, margin, leverage
              and available protection settings before an instruction is sent.
            </p>

            <h2>What works today</h2>
            <p>
              The current release connects conversational instructions to PERPL
              testnet and mainnet, wallet-confirmed swaps through Kuru and Uniswap,
              and multi-network bridges to Monad through Relay. Dynamic supports
              wallet onboarding, while Envio helps verify transaction finality.
            </p>
            <p>
              These integrations are the beginning, not the boundary. The long-term
              goal is a shared action layer for the wider Monad ecosystem—from DeFi
              and payments to prediction markets, games, collectibles and social apps.
            </p>

            <h2>The road ahead</h2>
            <p>
              We are building MOTBOT as an independent interface, not as a front end
              for one protocol. Every new integration must be useful, technically
              reliable and honest about what is live. As Monad grows, MOT should make
              that growth easier to navigate.
            </p>

            <div className="article-cta">
              <div><span>TRY THE CURRENT RELEASE</span><h2>Tell MOT what you want to do.</h2></div>
              <Link className="primary-cta" href="/chat">Talk to MOT <ArrowUpRight size={16} /></Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
