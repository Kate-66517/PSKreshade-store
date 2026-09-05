import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDownloadToken } from "@/lib/downloadToken";

export async function POST(req: NextRequest, { params }: { params: { productId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const productId = params.productId;

  // 1. Ownership check — this is the IDOR-prevention boundary (spec section 41).
  const owned = await prisma.userProduct.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (!owned) {
    return NextResponse.json({ error: "NOT_OWNED" }, { status: 403 });
  }

  // 2. License must be ACTIVE.
  const license = await prisma.license.findFirst({
    where: { userId, productId, status: "ACTIVE" },
  });
  if (!license) {
    return NextResponse.json({ error: "LICENSE_NOT_ACTIVE" }, { status: 403 });
  }

  // 3. Per-product download limit (spec section 11).
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });

  if (product.downloadLimit != null) {
    const usedCount = await prisma.download.count({ where: { userId, productId } });
    if (usedCount >= product.downloadLimit) {
      return NextResponse.json({ error: "DOWNLOAD_LIMIT_REACHED" }, { status: 403 });
    }
  }

  // 4. Latest file for the current/newest version.
  const latestFile = await prisma.productFile.findFirst({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestFile) return NextResponse.json({ error: "NO_FILE_AVAILABLE" }, { status: 404 });

  // 5. Issue a short-lived signed token — never a permanent public URL.
  const { token, expiresAt } = createDownloadToken(userId, productId, latestFile.id);

  // 6. Log the download attempt immediately (spec section 15/43).
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  await prisma.download.create({ data: { userId, productId, ip, userAgent } });

  return NextResponse.json({
    url: `/api/downloads/stream?token=${encodeURIComponent(token)}`,
    expiresAt,
  });
}
