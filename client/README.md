# SkillSwap web app

React 19 + Vite single-page app. See the [root README](../README.md) for the product overview, architecture and setup.

```bash
cp .env.example .env     # VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL
npm install
npm run dev              # http://localhost:5173
npm run lint && npm run build
```

Notable code:

- `src/lib/call.js`: the WebRTC engine behind live sessions (media, negotiation, reconnection, screen share, stats).
- `src/pages/Session.jsx`: pre-join lobby, call UI, post-call confirmation.
- `src/pages/TeachApply.jsx` and `src/components/teach/`: the teacher application, mailbox verification and teaching settings.
- `src/components/PayoutPanel.jsx`: earnings, Stripe Connect setup and withdrawals. `src/components/admin/`: verification and payout review queues.
- `src/components/SkillPicker.jsx`: picks skills from the server's tech catalog (`GET /api/catalog`); free-text skills are not accepted anywhere.
- `src/lib/hooks.js`: `useQuery` (data + polling), plus small UI hooks written to satisfy the React Compiler lint rules.
- `src/styles/`: design tokens and light/dark themes (`base.css`), app shell and pages (`app.css`), marketing site (`marketing.css`), call surface (`session.css`).
