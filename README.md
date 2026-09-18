# MOTBOT

Conversational trading workspace for PERPL on Monad. Initial reviewable product slice.

## AI conversation setup

The new `/api/mot/chat` endpoint supports bounded conversation history, structured AI responses, saved risk preferences, and verified fresh PERPL quotes. It has no execution tools. Prices and simple previews work without an AI key; general conversation stays explicitly unavailable until activation.

Activation requires a dedicated private Neon/Postgres database, an AI Gateway key, and a random server-only session secret of at least 32 characters. Configure the names in `.env.example` through Vercel environment settings, run `db/mot-ai.sql` on the dedicated database, then set `MOT_AI_ENABLED=true` and redeploy. Never commit credentials or paste them into chat. Do not reuse a production database without reviewing this migration. No database is provisioned or migration applied automatically.

Users must explicitly enable AI consent. Requests send their message, up to 10 recent conversation turns (10,000 characters total), non-secret preferences, a wallet-connected boolean, and fresh public quotes to the provider. Wallet addresses and PERPL API credentials are not sent. Common secret formats are rejected, but detection is not exhaustive: never enter any secret in chat. AI replies, prompt context, model, usage, estimated cost when pricing is configured, and timestamps are stored privately. Saved `/chat/[id]` responses require the original HTTP-only browser cookie; they are not public sharing links. There is no account-level history, export, deletion interface, or automatic retention policy yet. Cookie expiry is 30 days; database records do not expire automatically. Review privacy/retention before enabling public AI access.

Database-backed limits default to 50 model attempts globally per rolling 24 hours and five per browser/IP per minute. These are conservative development safeguards, not full abuse protection. Failed reserved attempts count toward the quota. Configure provider spending limits separately. Optional token pricing must be in USD per token; missing pricing is recorded as unknown, not free. AI configuration status does not prove a successful provider/database connection. Test live conversation after activation before claiming readiness.

`pnpm test` covers preview limits, credential detection, role/context validation, price freshness and existing testnet authentication. No paid AI call or trade is made by the test suite.

## Available
- Responsive conversation workspace; text and browser-supported speech transcription.
- Existing browser-wallet connection without spending permissions.
- PERPL public context market reference data; explicit unavailable states.
- Structured previews of simple commands. No orders are transmitted.
- Device-local settings for TP/SL toggles, margin/leverage limits, expiry, and notification preference.
- LEVR and Polymarket coming-soon dialogs.
- Read-only PERPL testnet exchange-account checks and wallet network switching.
- Browser-only API-key sign-in for PERPL testnet, verified against the connected wallet's snapshot; live account freeze and forwarding status updates.

## Integration work remaining
- PERPL origin whitelisting and wallet-authorized Ed25519 key enrollment.
- Funded exchange-account creation and allowOrderForwarding authorization.
- Persistent authenticated sessions, encrypted key storage, durable request deduplication and execution checks.
- Trading WebSocket, confirmed position reconciliation and position-linked reduce-only TP/SL orders.
- Full model-backed conversational intelligence, scheduled conditions and notification delivery.
- Referral registration. Deferred by user; no fresh-wallet restriction is enforced.

Voice transcription is submitted only when the user presses Send. No seed phrase is requested.
All execution requests return executed=false. Preferences are not an authorization.

## Development
Install with the package manager pinned in package.json.
Run `pnpm dev` for development, `pnpm typecheck` for type checking and `pnpm build` for production.
Run `pnpm test` for API signing, snapshot validation, and session lifecycle tests (Node 22.18+).

## Testnet API setup
1. Connect your wallet and select Monad testnet (chain 10143).
2. Create a dedicated API key at https://testnet.perpl.xyz/apikeys with the same wallet. Read scope is enough for this stage. Prefer a short expiry.
3. Enter the PERPL API token and **PERPL API secret** in the setup form, not in chat. Never enter a wallet key or seed phrase.
4. Verify the API session. MOT marks it authenticated only after a matching wallet snapshot arrives; sending a sign-in frame alone is not success.
5. Check the forwarding/frozen state. If needed, enable One-Click Trading through PERPL itself. MOT does not change permissions or send orders in this stage.

The API secret is imported as a non-extractable Ed25519 WebCrypto key in browser memory. The token and key are not saved to local/session storage, cookies, or a database, and are not uploaded to MOT's backend. Signed authentication frames go directly to PERPL's testnet WebSocket, with the actual browser origin. No origin spoofing or allow-list bypass is used. Connection rejection requires PERPL's approval or correction of credentials, not a proxy workaround.

Disconnect, wallet/network changes, page exit, authentication failures, or stale/gapped updates close the connection and drop local credential references. JavaScript garbage collection is not a guaranteed memory wipe; the raw secret input is cleared after import. Disconnecting does **not** revoke a key on PERPL: revoke it at `/apikeys`. Browser sessions do not run in the background after the page closes. Trade scope is **not verified** by a successful read-only sign-in.

The only outbound WebSocket frames implemented here are sign-in (`mt:29`) and keep-alive (`mt:1`). No order (`mt:22`), deposit, withdrawal, or wallet-spending transaction can be sent by this module. Chat remains a preview, irrespective of account or authentication status.

Protocol sources: https://github.com/PerplFoundation/api-docs/blob/main/authentication.md and https://github.com/PerplFoundation/api-docs/blob/main/websocket.md.

## Hosting
Deploy as a Next.js project on Vercel. Build command: `pnpm build`.
Referral registration is deferred. Public market data and previews need no API credentials. Optional testnet account verification needs a user-created PERPL testnet API key. Real-fund trading is not supported.
