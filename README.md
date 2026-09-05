# ReShade / FiveM Premium Digital Store — Foundation Build

This is a **real, working full-stack foundation** (not a UI mockup) for a premium
ReShade preset marketplace for FiveM. It implements the architecture, database
schema, authentication, product catalog, cart/checkout, wallet (with
transaction-safe balance updates), and secure time-limited digital downloads +
licensing, following the spec's Phase 1–5 priorities.

Given the scope of the full spec (50 sections — admin dashboard, coupons,
bundles, reviews, notifications, full payment gateway integration, SEO,
CI testing, etc.), this build focuses on getting the **hard, security-critical
core correct first**, since everything else (admin CRUD screens, marketing
pages) is comparatively low-risk to add afterward. Sections not yet built are
listed at the bottom so nothing is silently skipped.

## Stack

- **Next.js 14 (App Router)** — frontend + backend API routes in one codebase
- **PostgreSQL + Prisma ORM** — relational integrity, transactions, indexes
- **NextAuth.js (credentials + session)** — authentication
- **bcrypt** — password hashing
- **Signed, expiring download tokens (HMAC + short TTL)** — no permanent public
  file URLs, ever
- **Wallet ledger design** — balance is *derived from* an append-only
  transaction log inside DB transactions, not a mutable counter, so
  double-spend/race conditions are structurally harder to hit

## Why architecture-first

Per the spec's own instruction ("อย่าเริ่มด้วยการทำ UI อย่างเดียว... ก่อนเขียนโค้ด
ให้แสดง Architecture, Database Schema และ Flow ของระบบก่อน"), see:

- `ARCHITECTURE.md` — system diagram, request flow for purchase + download
- `prisma/schema.prisma` — full database schema (all 22+ entities from
  spec section 40)
- `src/lib/*` — the trust boundary: every price, ownership, and balance check
  happens here, server-side, never trusting client input

## Getting started

```bash
cp .env.example .env        # fill in DATABASE_URL, AUTH_SECRET, DOWNLOAD_SECRET
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

## What is implemented (real, working code)

- [x] Database schema — all core + most extended entities
- [x] Auth: register / login / session (NextAuth credentials, bcrypt hashing)
- [x] Product catalog API + listing page (real DB queries, not mock data)
- [x] Cart (server-validated) + Checkout (server recomputes price/discount —
      never trusts frontend totals)
- [x] Wallet: balance derived in a DB transaction from a `WalletTransaction`
      ledger; top-up request → admin approval → balance increment, all
      inside `prisma.$transaction`
- [x] Orders: PENDING → PAID → COMPLETED, grants `UserProduct` ownership
      row only after payment is verified server-side
- [x] License generation (`RS-XXXX-XXXX-XXXX`) tied to User+Product+Version
- [x] Secure download flow: ownership check → signed URL with 10-minute
      expiry and one-time-use token → download logged (user, ip, UA, time)
- [x] Duplicate-purchase guard ("You already own this")
- [x] Basic admin product management API (create/edit/disable), gated by
      role check server-side

## What is scaffolded but needs a real integration before production

- [ ] **Payment gateway**: `src/lib/payment.ts` defines the
      `PaymentProvider` interface (`createPayment/verifyPayment/handleWebhook/
      refundPayment`) with a `MockPaymentProvider` used only when
      `PAYMENT_MODE=test`. **You must wire a real provider** (Omise, Stripe,
      PromptPay, etc.) before going live — the interface + webhook signature
      verification + idempotency key handling are in place, but there is no
      real gateway credential flow yet.
- [ ] File storage: schema + service assume an S3-compatible private bucket
      (`src/lib/storage.ts`), but no bucket is provisioned — swap in real
      credentials.
- [ ] Slip-upload top-up flow (manual bank transfer): DB model + admin
      approve/reject endpoints exist; the image-upload UI does not yet.

## Not yet built (from the spec, prioritized as later phases)

Admin dashboard charts/analytics UI, coupon system, bundle system, reviews,
wishlists, notifications UI, 2FA, before/after slider component, SEO
metadata/sitemap, full test suite, CI/CD, rate limiting middleware.

These are all straightforward additions on top of this foundation — say the
word and I'll build the next phase.
