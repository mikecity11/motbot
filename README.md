# MOTBOT

Conversational trading workspace for PERPL on Monad. Initial reviewable product slice.

## Available
- Responsive conversation workspace; text and browser-supported speech transcription.
- Existing browser-wallet connection without spending permissions.
- PERPL public context market reference data; explicit unavailable states.
- Structured previews of simple commands. No orders are transmitted.
- Device-local settings for TP/SL toggles, margin/leverage limits, expiry, and notification preference.
- LEVR and Polymarket coming-soon dialogs.

## Integration work remaining
- PERPL origin whitelisting and wallet-authorized Ed25519 key enrollment.
- Funded exchange-account creation and allowOrderForwarding authorization.
- Authenticated sessions, encrypted key storage, durable request deduplication and execution checks.
- Trading WebSocket, confirmed position reconciliation and position-linked reduce-only TP/SL orders.
- Full model-backed conversational intelligence, scheduled conditions and notification delivery.
- Referral registration. Deferred by user; no fresh-wallet restriction is enforced.

Voice transcription is submitted only when the user presses Send. No seed phrase is requested.
All execution requests return executed=false. Preferences are not an authorization.

## Development
Install with the package manager pinned in package.json.
Run `pnpm dev` for development, `pnpm typecheck` for type checking and `pnpm build` for production.

## Hosting
Deploy as a Next.js project on Vercel. Build command: `pnpm build`.
Referral registration is deferred. No API credentials are needed for this preview version.
