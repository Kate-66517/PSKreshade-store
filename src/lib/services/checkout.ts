import { prisma } from '@/lib/prisma';

export async function processWalletPurchase(userId: string, productId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Product and verify ownership
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'AVAILABLE') {
      throw new Error('Product unavailable or not found');
    }

    const existingOwnership = await tx.userProduct.findUnique({
      where: { userId_productId: { userId, productId } }
    });
    if (existingOwnership) {
      throw new Error('You already own this product license');
    }

    // 2. Fetch Wallet with strict row lock or verification
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance.lessThan(product.price)) {
      throw new Error('Insufficient wallet balance');
    }

    const newBalance = wallet.balance.minus(product.price);

    // 3. Deduct Balance
    await tx.wallet.update({
      where: { userId },
      data: { balance: newBalance }
    });

    // 4. Record Wallet Transaction
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'PURCHASE',
        amount: product.price,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `Purchased ReShade: ${product.name}`
      }
    });

    // 5. Create Completed Order
    const order = await tx.order.create({
      data: {
        userId,
        totalAmount: product.price,
        status: 'COMPLETED',
        items: {
          create: {
            productId: product.id,
            price: product.price
          }
        }
      }
    });

    // 6. Grant Ownership
    await tx.userProduct.create({
      data: { userId, productId: product.id }
    });

    // 7. Generate PSK License
    const licenseKey = `PSK-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await tx.license.create({
      data: {
        licenseKey,
        userId,
        productId: product.id,
        orderId: order.id,
        status: 'ACTIVE'
      }
    });

    return { success: true, orderId: order.id, licenseKey };
  });
}