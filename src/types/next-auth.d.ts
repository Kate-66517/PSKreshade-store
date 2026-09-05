await prisma.auditLog.create({
  data: {
    userId: (session!.user as any).id, // เปลี่ยนจาก actorId เป็น userId
    action: "PRODUCT_CREATE",
    details: JSON.stringify({ productId: product.id, name: product.name }), // เช็กฟิลด์ details หรือ metadata ตามโค้ดเดิมของคุณ
  },
});