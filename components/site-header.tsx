import Link from 'next/link';

export function SiteHeader(){return <header className="topbar site-topbar global-header">
  <Link className="brand" href="/"><span className="brandmark">m</span>MOTBOT<span className="network">ON MONAD</span></Link>
  <nav className="site-nav" aria-label="Main navigation"><Link href="/apps">Apps</Link><Link href="/chat">Talk to MOT</Link><Link href="/about">About</Link><Link href="/roadmap">Roadmap</Link></nav>
  <Link className="wallet-button header-launch" href="/chat">Launch MOTBOT</Link>
</header>}
