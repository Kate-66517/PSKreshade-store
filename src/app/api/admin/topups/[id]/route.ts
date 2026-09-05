import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, assertAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyWalletDelta } from "@/lib/wallet";
import { z } from "zod";

const ActionSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]), reason: z.string().optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  try {
    assertAdmin(session as any);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const adminId = (session!.user as any).id as string;

  const parsed = ActionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const topUp = await tx.topUp.findUnique({ where: { id: params.id } });
    if (!topUp) throw new Error("NOT_FOUND");
    if (topUp.status !== "PENDING") throw new Error("ALREADY_REVIEWED");

    if (parsed.data.action === "APPROVE") {
      await applyWalletDelta(tx, {
        userId: topUp.userId,
        delta: topUp.amount,
        type: "TOPUP",
        referenceId: topUp.id,
        reason: "Top-up approved by admin",
      });
    }

    const updated = await tx.topUp.update({
      where: { id: topUp.id },
      data: {
        status: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: `TOPUP_${parsed.data.action}`,
        details: JSON.stringify({ topUpId: topUp.id, amount: topUp.amount, reason: parsed.data.reason }),
      },
    });

    return updated;
  });

  return NextResponse.json({ topUp: result });
}