import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const TopUpSchema = z.object({
  amount: z.number().int().positive(),
  slipImageUrl: z.string().url().optional(),
});

// Creating a TopUp request never credits the wallet by itself — spec section
// 19: "การ Upload Slip ต้องไม่ทำให้ Wallet เพิ่มเงินทันที" (uploading a slip
// must not add money immediately). Only the admin-approve route touches balance.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = TopUpSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const topUp = await prisma.topUp.create({
    data: {
      userId: (session.user as any).id,
      amount: parsed.data.amount,
      slipImageUrl: parsed.data.slipImageUrl,
      status: "PENDING",
    },
  });

  return NextResponse.json({ topUpId: topUp.id, status: topUp.status });
}
