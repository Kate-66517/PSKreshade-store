await prisma.auditLog.create({
  data: {
    userId: (session!.user as any).id,
    action: "PRODUCT_CREATE",
    details: JSON.stringify({ productId: product.id, name: product.name }),
  },
});