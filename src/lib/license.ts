import crypto from "crypto";

/** Generates a license code in the RS-XXXX-XXXX-XXXX format (spec section 14). */
export function generateLicenseCode(): string {
  const block = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `RS-${block()}-${block()}-${block()}`;
}
