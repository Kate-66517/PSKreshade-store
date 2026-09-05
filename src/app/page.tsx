import { prisma } from "@/lib/prisma";
import Link from "next/link";

function formatPrice(cents: number) {
  return `฿${(cents / 100).toFixed(0)}`;
}

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { category: true },
  });

  return (
    <main style={{ minHeight: "100vh", paddingBottom: "3rem" }}>
      {/* Navigation Bar */}
      <nav className="navbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2rem", borderBottom: "1 border-solid rgba(255,255,255,0.1)" }}>
        <strong>RESHADE.STORE</strong>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
          <Link href="/products" style={{ color: "inherit", textDecoration: "none" }}>ReShade</Link>
          <Link href="/topup" style={{ color: "inherit", textDecoration: "none" }}>เติมเงิน</Link>
          <Link href="/history" style={{ color: "inherit", textDecoration: "none" }}>ประวัติการสั่งซื้อ</Link>
          <Link href="/login" className="btn" style={{ textDecoration: "none", padding: "0.4rem 1rem", fontSize: "0.9rem" }}>
            เข้าสู่ระบบ
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Transform Your FiveM Experience</h1>
        <p style={{ color: "var(--muted)", maxWidth: "600px", margin: "0 auto 2rem auto" }}>
          Premium ReShade presets designed to transform the look and atmosphere
          of your FiveM gameplay.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyCenter: "center", justifyContent: "center" }}>
          <Link href="/products" className="btn" style={{ textDecoration: "none" }}>Explore ReShade</Link>
          <Link href="/topup" className="btn secondary" style={{ textDecoration: "none" }}>เติมเงินเครดิต</Link>
        </div>
      </section>

      {/* Quick Action Grid */}
      <section style={{ maxWidth: "1200px", margin: "0 auto 3rem auto", padding: "0 2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <Link href="/products" className="card" style={{ padding: "1.2rem", textAlign: "center", textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🛒</div>
            <strong style={{ display: "block" }}>เลือกซื้อสินค้า</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>คลัง ReShade ทั้งหมด</span>
          </Link>
          <Link href="/topup" className="card" style={{ padding: "1.2rem", textAlign: "center", textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>💳</div>
            <strong style={{ display: "block" }}>เติมเงิน</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>ระบบเติมเงินอัตโนมัติ</span>
          </Link>
          <Link href="/history" className="card" style={{ padding: "1.2rem", textAlign: "center", textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📦</div>
            <strong style={{ display: "block" }}>ประวัติการสั่งซื้อ</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>รับไฟล์ ReShade ย้อนหลัง</span>
          </Link>
          <a href="https://discord.gg" target="_blank" rel="noreferrer" className="card" style={{ padding: "1.2rem", textAlign: "center", textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>💬</div>
            <strong style={{ display: "block" }}>ติดต่อสอบถาม</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>แจงปัญหาผ่าน Discord</span>
          </a>
        </div>
      </section>

      {/* Product Section */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>New Releases</h2>
        <div className="grid">
          {products.map((p) => (
            <Link href={`/products/${p.slug}`} key={p.id} className="card" style={{ color: "inherit", textDecoration: "none", display: "flex", flexDirection: "column", justifyBetween: "space-between" }}>
              <div>
                <div style={{ height: 160, background: "#1a1a24", borderRadius: "8px 8px 0 0" }} />
                <div className="card-body">
                  <span className="badge">{p.category?.name || "ReShade"}</span>
                  <h3 style={{ margin: "0.5rem 0" }}>{p.name}</h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>{p.shortDescription}</p>
                </div>
              </div>
              <div className="card-body" style={{ paddingTop: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="price">{formatPrice(p.price)}</span>
                  {p.originalPrice && (
                    <span className="original-price" style={{ marginLeft: "0.5rem", textDecoration: "line-through", opacity: 0.5, fontSize: "0.85rem" }}>
                      {formatPrice(p.originalPrice)}
                    </span>
                  )}
                </div>
                <span className="btn" style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}>สั่งซื้อ</span>
              </div>
            </Link>
          ))}
          {products.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No products yet — run the seed script.</p>
          )}
        </div>
      </div>
    </main>
  );
}