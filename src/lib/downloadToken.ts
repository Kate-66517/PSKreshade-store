import crypto from "crypto";

const TTL_SECONDS = Number(process.env.DOWNLOAD_URL_TTL_SECONDS ?? 600);

interface TokenPayload {
  userId: string;
  productId: string;
  fileId: string;
  exp: number; // unix seconds
}

function sign(payload: string): string {
  const secret = process.env.DOWNLOAD_SECRET;
  if (!secret) throw new Error("DOWNLOAD_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Creates a signed, short-lived download token. Never a permanent public URL. */
export function createDownloadToken(userId: string, productId: string, fileId: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload: TokenPayload = { userId, productId, fileId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return { token: `${encoded}.${signature}`, expiresAt: new Date(exp * 1000) };
}

/** Verifies a token's signature and expiry, and returns its payload if valid. */
export function verifyDownloadToken(token: string): TokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  // Constant-time comparison to avoid timing side-channels
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const payload: TokenPayload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired

  return payload;
}
