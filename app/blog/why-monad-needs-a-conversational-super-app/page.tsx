import type { Metadata } from "next";
import Image from "next/image";
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

          <figure className="article-hero-visual">
            <Image
              src="/blog/motbot-conversational-super-app.png"
              alt="MOTBOT connecting trading, swaps, bridges, gaming and prediction markets through one conversational interface"
              width={1672}
              height={941}
              priority
              sizes="(max-width: 980px) 100vw, 924px"
            />
            <figcaption>
              One conversation. Many protocols. One connected Monad experience.
            </figcaption>
          </figure>

          <div className="article-body">
            <p className="article-lead">
              Monad is becoming home to trading platforms, exchanges, bridges,
              games, prediction markets and many other onchain experiences. That
              growth is exciting, but it also creates a new problem: users must
              keep learning where to go and how every interface works.
            </p>

            <h2>Why we built MOTBOT</h2>
            <p>
              We built MOTBOT after seeing the same gap appear again and again:
              powerful onchain products were being created, but using them still
              demanded too much context from the user. People had to know the right
              app, network, asset and sequence of steps before they could even begin.
            </p>
            <p>
              One simple goal can require several tabs. A user may need to bridge
              funds, find liquidity, compare a price, connect a wallet and learn a
              new transaction flow. Every protocol can be excellent on its own while
              the journey between them remains fragmented. That fragmentation is the
              problem MOTBOT is designed to solve.
            </p>

            <blockquote>
              One conversation should be enough to discover and interact with the
              whole Monad ecosystem.
            </blockquote>

            <h2>What makes MOTBOT different</h2>
            <p>
              MOTBOT does not begin with a protocol menu. It begins with intent. A
              person can type or speak what they want to achieve, and MOT translates
              that request into a clear route across the right Monad applications.
              The result is not another dashboard: it is a conversational action
              layer built above the ecosystem.
            </p>

            <div className="article-principles">
              <section><span>01</span><h3>One interface for many apps</h3><p>Trade, swap, bridge and discover without learning a new interface for every protocol.</p></section>
              <section><span>02</span><h3>Voice and text by default</h3><p>Natural language makes complex onchain actions approachable without hiding important details.</p></section>
              <section><span>03</span><h3>User-controlled execution</h3><p>MOT prepares the action, but the connected wallet keeps authority and confirms onchain transactions.</p></section>
              <section><span>04</span><h3>Built to expand with Monad</h3><p>Each new integration becomes another capability inside the same familiar conversation.</p></section>
            </div>

            <aside className="article-callout">
              <span>NOT JUST A TRADING BOT</span>
              <strong>Trading is one capability. The product is a universal interface for the wider Monad ecosystem.</strong>
            </aside>

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
              and multi-network bridges into Monad through Relay. Dynamic supports
              wallet onboarding, while Envio helps MOT verify onchain activity and
              provide clearer transaction feedback.
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
            <p>
              Our measure of success is simple: a new user should be able to arrive
              with a goal, express it in their own words and confidently complete it
              without first becoming an expert in every underlying product. That is
              how MOTBOT can help Monad feel less like a collection of separate apps
              and more like one connected economy.
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
