# Architecture

## High-level components

```
                 ┌────────────────────────┐
                 │   Next.js Frontend      │  (React, App Router pages)
                 │  /shop /product /cart   │
                 │  /dashboard /admin      │
                 └───────────┬─────────────┘
                             │ fetch (same-origin, session cookie)
                 ┌───────────▼─────────────┐
                 │  Next.js API Routes      │  <- ALL business logic +
                 │  /api/*                  │     ALL trust decisions live
                 └───────────┬─────────────┘     here, never in the client
        ┌────────────────────┼─────────────────────┐
        │                    │                      │
┌───────▼──────┐   ┌─────────▼─────────┐   ┌────────▼────────┐
│ PostgreSQL    │   │ Payment Provider   │   │ Private Object   │
│ (Prisma)      │   │ (webhook verified) │   │ Storage (S3-like)│
└───────────────┘   └────────────────────┘   └──────────────────┘
```

## Core trust rule

**Every price, discount, ownership, wallet balance, and license check is
recomputed server-side from the database on every request.** The frontend
cart/checkout UI is only a presentation of state the server already
validated; on submit, the server re-derives totals from `Product.price`,
active `Coupon` rows, and current `Wallet` balance — the client's numbers are
never written to `Order`.

## Purchase flow

1. Client POSTs `{ productIds, couponCode? }` to `/api/checkout`
2. Server: for each productId, verify `Product.status === AVAILABLE`
3. Server: check `UserProduct` — if user already owns it, reject the item
   with `ALREADY_OWNED` instead of allowing a duplicate purchase
4. Server: recompute subtotal/discount/total from DB rows only
5. Server: if `paymentMethod === WALLET`, run debit + order creation in a
   single `prisma.$transaction` (see Wallet flow below); else create a
   `PENDING` order and hand off to `PaymentProvider.createPayment()`
6. On payment success (webhook, signature-verified, idempotent by
   `providerPaymentId` unique constraint) → `Order.status = PAID` →
   in the same transaction, insert one `UserProduct` row per item and one
   `License` row per item

## Wallet flow (race-condition safe)

Balance is not a bare mutable integer edited ad hoc. Every change goes
through `WalletTransaction` (TOPUP / PURCHASE / REFUND / ADJUSTMENT) and the
balance mutation happens **inside `prisma.$transaction`** using an
`UPDATE ... SET balance = balance + :delta WHERE id = :walletId AND balance +
:delta >= 0`-style guarded update (see `src/lib/wallet.ts`), so:

- Two simultaneous purchases can't both read a stale balance and both
  succeed (no lost-update race)
- Balance can never go negative (guard is enforced by the WHERE clause,
  not by an application-level check-then-write)
- Every balance change has an immutable audit row with `balanceBefore` /
  `balanceAfter`

## Secure download flow

```
User clicks Download
   → POST /api/downloads/:productId
   → verify session
   → verify UserProduct exists (ownership) AND License.status === ACTIVE
   → verify per-product download limit not exceeded (count Download rows)
   → generate short-lived signed token: HMAC(productId+userId+expiry, DOWNLOAD_SECRET)
   → insert Download row (user, product, ip, userAgent, timestamp)
   → return { url: `/api/downloads/stream?token=...`, expiresAt }
User's browser hits the signed URL within the TTL (default 10 min)
   → server re-verifies signature + expiry + re-checks ownership
   → streams file from private storage (never a public bucket URL)
```

No product file ever gets a permanent public URL. The signed token is
single-purpose and expires; re-downloading issues a brand new token and a
new logged `Download` row (subject to the product's download limit).

## Role/authorization boundary

`User.role` is `USER | ADMIN`. Every `/api/admin/*` route re-checks
`session.user.role === 'ADMIN'` server-side (never trusts a client-side
route guard alone). Ownership checks (`userId === session.user.id`) are
applied to every order/wallet/license/download lookup so User A cannot ever
fetch User B's rows by guessing an ID (IDOR prevention).
