/**
 * Private object storage abstraction. Swap the body of this function for a
 * real S3-compatible presigned-URL call (AWS SDK v3 `getSignedUrl` +
 * `GetObjectCommand`, or your provider's equivalent) before going to
 * production. Files must live in a PRIVATE bucket — never a public one —
 * per spec section 34.
 *
 * Not implemented here because it requires real bucket credentials
 * (STORAGE_BUCKET / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY) that don't
 * exist yet in this environment.
 */
export async function getSignedGetUrlForKey(storageKey: string, fileName: string): Promise<string> {
  if (!process.env.STORAGE_BUCKET) {
    throw new Error(
      "Object storage is not configured. Set STORAGE_BUCKET / STORAGE_ENDPOINT / " +
        "STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY and implement getSignedGetUrlForKey " +
        "using your storage provider's SDK (e.g. @aws-sdk/s3-request-presigner)."
    );
  }

  // Example shape once wired up (AWS SDK v3):
  //
  // const client = new S3Client({ endpoint: process.env.STORAGE_ENDPOINT, ... });
  // const command = new GetObjectCommand({
  //   Bucket: process.env.STORAGE_BUCKET,
  //   Key: storageKey,
  //   ResponseContentDisposition: `attachment; filename="${fileName}"`,
  // });
  // return getSignedUrl(client, command, { expiresIn: 300 });

  throw new Error("getSignedGetUrlForKey: implement with your storage provider's SDK");
}
