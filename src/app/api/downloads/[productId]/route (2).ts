import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_KEY!,
  },
});

export async function GET(req: NextRequest, { params }: { params: { productId: string } }) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const productId = params.productId;

  // 1. Verify Ownership
  const ownership = await prisma.userProduct.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (!ownership) {
    return NextResponse.json({ error: 'Access denied: Product not owned' }, { status: 403 });
  }

  // 2. Fetch Latest Product Version
  const currentVersion = await prisma.productVersion.findFirst({
    where: { productId, isCurrent: true },
  });

  if (!currentVersion) {
    return NextResponse.json({ error: 'No active file found for this preset' }, { status: 404 });
  }

  // 3. Log Download Attempt
  await prisma.downloadLog.create({
    data: {
      userId,
      productId,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Unknown',
    },
  });

  // 4. Generate Expiring Presigned S3 URL (10 Minutes)
  const command = new GetObjectCommand({
    Bucket: process.env.STORAGE_BUCKET!,
    Key: currentVersion.filePath,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

  return NextResponse.json({ downloadUrl: signedUrl, expiresIn: '10 minutes' });
}