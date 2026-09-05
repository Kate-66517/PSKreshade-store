import { NextRequest, NextResponse } from "next/server";
import { verifyDownloadToken } from "@/lib/downloadToken";
import { prisma } from "@/lib/prisma";
import { getSignedGetUrlForKey } from "@/lib/storage";

/**
 * This route is the only thing the browser ever hits to fetch bytes.
 * It re-verifies the signed token (signature + expiry) on every request —
 * the token from /api/downloads/:productId is not itself trusted blindly,
 * it's re-checked here, and ownership is re-confirmed against the DB too,
 * in case the license was revoked in the window between issuing the token
 * and it being used.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });

  const payload = verifyDownloadToken(token);
  if (!payload) return NextResponse.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, { status: 403 });

  const license = await (prisma as any).license.findFirst({
    where: { userId: payload.userId, productId: payload.productId, status: "ACTIVE" },
  });
  if (!license) return NextResponse.json({ error: "LICENSE_NOT_ACTIVE" }, { status: 403 });

  const file = await (prisma as any).productFile.findUnique({ where: { id: payload.fileId } });
  if (!file) return NextResponse.json({ error: "FILE_NOT_FOUND" }, { status: 404 });

  // Redirect to a short-lived, provider-signed URL for the actual bytes
  // (S3 presigned GET, etc.) rather than proxying the whole file through
  // this process. The storage-level URL also expires quickly and points at
  // a private bucket key, never a public path.
  const signedStorageUrl = await getSignedGetUrlForKey(file.storageKey, file.fileName);
  return NextResponse.redirect(signedStorageUrl);
}