import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "MOTBOT Blog — Building the conversational layer for Monad",
  description:
    "Product updates, integration notes and ideas from the team building MOTBOT on Monad.",
};

export default function BlogPage() {
  return (
    <div className="content-page blog-page">
      <SiteHeader />
      <main>
        <section className="page-hero blog-hero">
          <div className="section-kicker">MOTBOT JOURNAL</div>
          <h1>
            Ideas, progress and the road to a <span>conversational Monad.</span>
          </h1>
          <p>
            Product updates, ecosystem integrations and the thinking behind one
            interface for every action on Monad.
          </p>
        </section>

        <section className="blog-grid" aria-label="MOTBOT articles">
          <article className="blog-card blog-card-featured">
            <div className="blog-card-topline">
              <span>PRODUCT VISION</span>
              <time dateTime="2026-09-30">30 September 2026</time>
            </div>
            <h2>Why Monad needs a conversational super-app</h2>
            <p>
              The next wave of onchain adoption will not come from asking users
              to master more dashboards. It will come from turning intent into a
              clear, reviewable action.
            </p>
            <Link href="/blog/why-monad-needs-a-conversational-super-app">
              Read the story <ArrowUpRight size={16} />
            </Link>
          </article>

          <article className="blog-card blog-card-upcoming">
            <div className="blog-card-topline"><span>BUILD LOG</span><span>COMING NEXT</span></div>
            <h2>Inside MOTBOT’s integration architecture</h2>
            <p>How MOT routes a single conversation across trading, swaps, bridges and future Monad apps.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
