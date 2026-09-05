import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, assertAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  shortDescription: z.string(),
  description: z.string(),
  price: z.number().int().nonnegative(),
  originalPrice: z.number().int().nonnegative().optional(),
  categoryId: z.string(),
  tags: z.array(z.string()).default([]),
  performanceLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  isFree: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const parsed = ProductSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.create({ data: parsed.data });

  await prisma.auditLog.create({
    data: {
      actorId: (session!.user as any).id,
      action: "PRODUCT_CREATE",
      metadata: { productId: product.id, name: product.name },
    },
  });

  return NextResponse.json({ product });
}

export async function GET() {
  // Admin listing includes UNAVAILABLE/HIDDEN products too, unlike the public API.
  const session = await getServerSession(authOptions);
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}
