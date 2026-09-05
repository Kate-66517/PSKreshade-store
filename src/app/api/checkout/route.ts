import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyWalletDelta, InsufficientBalanceError } from "@/lib/wallet";
import { generateLicenseCode } from "@/lib/license";
import { getPaymentProvider } from "@/lib/payment";
import { z } from "zod";

const CheckoutSchema = z.object({
  productIds: z.array(z.string()).min(1),
  couponCode: z.string().optional(),
  paymentMethod: z.enum(["WALLET", "GATEWAY"]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const parsed = CheckoutSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const { productIds, couponCode, paymentMethod } = parsed.data;

  // 1. Load products fresh from DB — never trust client-sent prices.
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "AVAILABLE" },
  });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "PRODUCT_UNAVAILABLE" }, { status: 400 });
  }

  // 2. Reject items the user already owns (spec section 16/17).
  const owned = await prisma.userProduct.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });
  if (owned.length > 0) {
    return NextResponse.json(
      { error: "ALREADY_OWNED", productIds: owned.map((o) => o.productId) },
      { status: 409 }
    );
  }

  const subtotal = products.reduce((sum, p) => sum + Number(p.price), 0);

  // 3. Recompute discount from a real Coupon row, never from client input.
  let discount = 0;
  let coupon: any = null;
  if (couponCode) {
    coupon = await (prisma as any).coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      return NextResponse.json({ error: "INVALID_COUPON" }, { status: 400 });
    }
    if (subtotal < Number(coupon.minPurchase)) {
      return NextResponse.json({ error: "COUPON_MIN_PURCHASE_NOT_MET" }, { status: 400 });
    }
    const usageCount = await (prisma as any).couponUsage.count({ where: { couponId: coupon.id } });
    if (coupon.usageLimit != null && usageCount >= coupon.usageLimit) {
      return NextResponse.json({ error: "COUPON_LIMIT_REACHED" }, { status: 400 });
    }
    const perUserCount = await (prisma as any).couponUsage.count({ where: { couponId: coupon.id, userId } });
    if (coupon.perUserLimit != null && perUserCount >= coupon.perUserLimit) {
      return NextResponse.json({ error: "COUPON_ALREADY_USED" }, { status: 400 });
    }
    const couponValue = Number(coupon.value);
    discount =
      coupon.type === "PERCENTAGE" ? Math.floor((subtotal * couponValue) / 100) : couponValue;
    if (coupon.maxDiscount != null) discount = Math.min(discount, Number(coupon.maxDiscount));
  }

  const total = Math.max(subtotal - discount, 0);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: "PENDING",
          paymentMethod,
          subtotal,
          discount,
          total,
          couponId: coupon?.id,
          items: {
            create: products.map((p) => ({ productId: p.id, unitPrice: p.price, quantity: 1 })),
          },
        },
      } as any);

      if (coupon) {
        await (tx as any).couponUsage.create({ data: { couponId: coupon.id, userId } });
      }

      if (paymentMethod === "WALLET") {
        // Debit wallet and complete the order atomically.
        await applyWalletDelta(tx, {
          userId,
          delta: -total,
          type: "PURCHASE",
          referenceId: order.id,
          reason: `Purchase of order ${order.id}`,
        });

        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });

        for (const p of products) {
          await (tx as any).userProduct.create({ data: { userId, productId: p.id, orderId: order.id } });
          await (tx as any).license.create({
            data: {
              code: generateLicenseCode(),
              userId,
              productId: p.id,
              orderId: order.id,
              status: "ACTIVE",
            },
          });
        }
      }

      return order;
    });

    if (paymentMethod === "GATEWAY") {
      const provider = getPaymentProvider();
      const payment = await provider.createPayment({
        orderId: order.id,
        amount: total,
        currency: "THB",
      });
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "mock",
          providerPaymentId: payment.providerPaymentId,
          amount: total,
          status: "PENDING",
        },
      });
      return NextResponse.json({ orderId: order.id, redirectUrl: payment.redirectUrl });
    }

    return NextResponse.json({ orderId: order.id, status: "PAID" });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: "INSUFFICIENT_BALANCE" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "CHECKOUT_FAILED" }, { status: 500 });
  }
}