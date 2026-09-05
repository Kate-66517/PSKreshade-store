const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PSK ReShade Store Database...');

  // 1. Create Categories
  const cinematicCat = await prisma.category.upsert({
    where: { slug: 'cinematic' },
    update: {},
    create: { name: 'Cinematic', slug: 'cinematic' },
  });

  const realisticCat = await prisma.category.upsert({
    where: { slug: 'realistic' },
    update: {},
    create: { name: 'Realistic', slug: 'realistic' },
  });

  // 2. Create Main Product
  const prod1 = await prisma.product.upsert({
    where: { slug: 'psk-ultra-realism-v2' },
    update: {},
    create: {
      name: 'PSK Ultra Realism ReShade V2',
      slug: 'psk-ultra-realism-v2',
      shortDescription: 'Next-generation ambient lighting, ray-traced shadows, and photorealistic colors for FiveM.',
      description: 'The ultimate ReShade pack crafted specifically for high-end FiveM roleplay servers.',
      price: 490.00,
      originalPrice: 690.00,
      status: 'AVAILABLE',
      requiredReshadeVersion: '5.9.2+',
      recommendedGpu: 'RTX 3060 / RX 6600 or higher',
      performanceLevel: 'HIGH',
      categoryId: realisticCat.id,
      features: {
        create: [
          { label: 'Ray-Traced Ambient Occlusion' },
          { label: 'Dynamic Color Grading' },
          { label: 'Cinematic Depth of Field' },
          { label: 'Optimized Night Vision' }
        ]
      }
    },
  });

  // 3. Create Version for Product
  const version1 = await prisma.productVersion.create({
    data: {
      version: 'v2.0.0',
      changelog: 'Initial v2 launch with completely rewritten SSR and bloom filters.',
      productId: prod1.id,
    }
  });

  // 4. Create File connected to both Product and Version
  // หมายเหตุ: ถ้าใน schema.prisma ตั้งชื่อโมเดลไว้ว่า File ให้เปลี่ยน productFile เป็น file นะครับ
  await prisma.productFile.create({
    data: {
      fileName: 'psk-ultra-realism-v2.zip',
      storageKey: 'psk-ultra-realism-v2.zip',
      sizeBytes: 15400000,
      productId: prod1.id,
      versionId: version1.id,
    }
  });

  console.log('Database Seeding Completed Successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });