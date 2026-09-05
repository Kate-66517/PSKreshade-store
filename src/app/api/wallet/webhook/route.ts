import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payment";
import { applyWalletDelta } from "@/lib/wallet";
import { generateLicenseCode } from "@/lib/license";

/**
 * Payment gateway webhook. This is the ONLY place an order can transition
 * PENDING -> PAID for gateway payments — never the client callback/redirect.
 *
 * Idempotency: Payment.providerPaymentId has a unique constraint, and we
 * short-circuit if that payment row is already SUCCEEDED, so a replayed
 * webhook (or the provider retrying delivery) cannot double-grant products
 * or double-credit anything.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  const provider = getPaymentProvider();
  const result = provider.handleWebhook(rawBody, signature);

  if (!result.valid || !result.providerPaymentId) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: result.providerPaymentId },
    include: { order: { include: { items: { include: { product: true } } } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
  }

  // Idempotent: already processed, acknowledge without reprocessing.
  if (payment.status === "SUCCEEDED") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  if (result.status !== "SUCCEEDED") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "PAID" } });

    for (const item of payment.order.items) {
      // Skip if somehow already granted (defensive; unique constraint also guards this).
      const existing = await tx.userProduct.findUnique({
        where: { userId_productId: { userId: payment.order.userId, productId: item.productId } },
      });
      if (existing) continue;

      await tx.userProduct.create({
        data: { userId: payment.order.userId, productId: item.productId, orderId: payment.orderId },
      });
      await tx.license.create({
        data: {
          code: generateLicenseCode(),
          userId: payment.order.userId,
          productId: item.productId,
          orderId: payment.orderId,
          status: "ACTIVE",
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
