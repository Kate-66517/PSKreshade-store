import { prisma } from "./prisma";
import type { Prisma, WalletTxType } from "@prisma/client";

export class InsufficientBalanceError extends Error {
  constructor() {
    super("INSUFFICIENT_BALANCE");
  }
}

/**
 * Applies a signed delta to a user's wallet balance inside a DB transaction.
 *
 * Why this is safe under concurrency:
 * - The UPDATE's WHERE clause includes `balance + delta >= 0`, so the guard
 *   against negative balances is enforced BY THE DATABASE ROW LOCK, not by an
 *   application-level "read balance, check, then write" sequence (which is
 *   vulnerable to two concurrent requests both reading the same stale value).
 * - `updateMany` returns a count; if 0 rows matched, either the wallet
 *   doesn't exist or the guard failed (would go negative) — both are
 *   reported as InsufficientBalanceError for a debit.
 * - Every change writes an immutable WalletTransaction row with
 *   balanceBefore/balanceAfter for audit purposes (spec section 37/43).
 *
 * Callers MUST pass an active `tx` (from `prisma.$transaction(async (tx) => ...)`)
 * so this can be combined atomically with order/license creation.
 */
export async function applyWalletDelta(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    delta: number; // positive for credit (topup/refund), negative for debit (purchase)
    type: WalletTxType;
    referenceId?: string;
    reason?: string;
  }
) {
  const { userId, delta, type, referenceId, reason } = params;

  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("WALLET_NOT_FOUND");

  const balanceBefore = wallet.balance;

  // Guarded, atomic update: only succeeds if resulting balance would be >= 0.
  const result = await tx.wallet.updateMany({
    where: {
      id: wallet.id,
      balance: { gte: delta < 0 ? -delta : 0 }, // if debiting, require enough balance
    },
    data: {
      balance: { increment: delta },
    },
  });

  if (result.count === 0) {
    throw new InsufficientBalanceError();
  }

  const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type,
      amount: Math.abs(delta),
      balanceBefore,
      balanceAfter: updated.balance,
      referenceId,
      reason,
    },
  });

  return updated.balance;
}

/** Read-only balance fetch for display purposes. */
export async function getWalletBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}
