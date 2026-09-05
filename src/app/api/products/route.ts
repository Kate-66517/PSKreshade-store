import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const sort = searchParams.get("sort") ?? "newest";

  const products = await prisma.product.findMany({
    where: {
      status: "AVAILABLE",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { tags: { has: q } },
            ],
          }
        : {}),
      ...(category ? { category: { slug: category } } : {}),
    },
    include: { category: true, features: true },
    orderBy:
      sort === "price_asc"
        ? { price: "asc" }
        : sort === "price_desc"
        ? { price: "desc" }
        : { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}
