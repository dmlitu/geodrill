export default function LandingPage({ onGoLogin, onGoRegister }) {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1E293B" }}>
      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: "64px",
      }}>
        <div>
          <span style={{ color: "#1B3A6B", fontSize: "22px", fontWeight: "900" }}>Geo</span>
          <span style={{ color: "#2D5BA3", fontSize: "22px", fontWeight: "900" }}>Drill</span>
          <span style={{
            color: "#64748B", fontSize: "10px", letterSpacing: "4px",
            fontWeight: "700", marginLeft: "8px", verticalAlign: "middle"
          }}>INSIGHT</span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onGoLogin} style={{
            padding: "8px 20px", border: "1.5px solid #CBD5E1",
            borderRadius: "8px", background: "white",
            color: "#1B3A6B", fontSize: "14px", fontWeight: "600", cursor: "pointer"
          }}>
            Giriş Yap
          </button>
          <button onClick={onGoRegister} style={{
            padding: "8px 20px", border: "none",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #1B3A6B 0%, #2D5BA3 100%)",
            color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer"
          }}>
            Kayıt Ol
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(160deg, #0F2447 0%, #1B3A6B 45%, #2D5BA3 100%)",
        padding: "100px 48px 120px",
        textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* arka plan daireler */}
        <div style={{
          position: "absolute", top: "-80px", right: "-80px",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "rgba(255,255,255,0.03)", pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute", bottom: "-120px", left: "-60px",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "rgba(255,255,255,0.03)", pointerEvents: "none"
        }} />

        <div style={{ position: "relative", maxWidth: "760px", margin: "0 auto" }}>
          <span style={{
            display: "inline-block", background: "rgba(147,197,253,0.15)",
            border: "1px solid rgba(147,197,253,0.3)",
            color: "#93C5FD", fontSize: "12px", fontWeight: "700",
            letterSpacing: "3px", padding: "6px 16px", borderRadius: "100px",
            marginBottom: "28px"
          }}>
            GEOTEKNİK KARAR DESTEK SİSTEMİ
          </span>

          <h1 style={{
            color: "white", fontSize: "clamp(36px, 5vw, 60px)",
            fontWeight: "900", lineHeight: "1.15", margin: "0 0 24px"
          }}>
            Sondaj Kararlarını<br />
            <span style={{ color: "#93C5FD" }}>Veriye Dayalı</span> Alın
          </h1>

          <p style={{
            color: "rgba(255,255,255,0.72)", fontSize: "18px",
            lineHeight: "1.7", margin: "0 auto 44px", maxWidth: "580px"
          }}>
            Zemin profili, tork hesabı, kasa ihtiyacı, yakıt tüketimi ve ekipman
            uygunluğunu tek platformda yönetin.
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onGoRegister} style={{
              padding: "15px 36px", border: "none", borderRadius: "10px",
              background: "white", color: "#1B3A6B",
              fontSize: "16px", fontWeight: "700", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
            }}>
              Ücretsiz Başla
            </button>
            <button onClick={onGoLogin} style={{
              padding: "15px 36px",
              border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: "10px",
              background: "transparent", color: "white",
              fontSize: "16px", fontWeight: "600", cursor: "pointer"
            }}>
              Giriş Yap →
            </button>
          </div>
        </div>
      </section>

      {/* ── Özellikler ── */}
      <section style={{ padding: "96px 48px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ fontSize: "36px", fontWeight: "800", margin: "0 0 16px", color: "#0F172A" }}>
              Her Şey Tek Yerde
            </h2>
            <p style={{ color: "#64748B", fontSize: "17px", maxWidth: "520px", margin: "0 auto" }}>
              Geoteknik mühendisliğinin en kritik hesaplarını dakikalar içinde tamamlayın.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "24px"
          }}>
            {FEATURES.map(f => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Nasıl Çalışır ── */}
      <section style={{ padding: "96px 48px", background: "white" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 style={{ fontSize: "36px", fontWeight: "800", margin: "0 0 16px", color: "#0F172A" }}>
              Nasıl Çalışır?
            </h2>
            <p style={{ color: "#64748B", fontSize: "17px" }}>
              Üç adımda eksiksiz bir geoteknik analiz.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {STEPS.map((step, i) => (
              <StepRow key={step.title} step={step} index={i} last={i === STEPS.length - 1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{
        background: "linear-gradient(135deg, #1B3A6B 0%, #2D5BA3 100%)",
        padding: "80px 48px", textAlign: "center"
      }}>
        <h2 style={{ color: "white", fontSize: "32px", fontWeight: "800", margin: "0 0 16px" }}>
          Hemen Başlayın
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "17px", margin: "0 0 36px" }}>
          Ücretsiz hesap oluşturun, ilk projenizi birkaç dakikada analiz edin.
        </p>
        <button onClick={onGoRegister} style={{
          padding: "15px 40px", border: "none", borderRadius: "10px",
          background: "white", color: "#1B3A6B",
          fontSize: "16px", fontWeight: "700", cursor: "pointer"
        }}>
          Ücretsiz Kayıt Ol
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: "#0F172A", padding: "40px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "16px"
      }}>
        <div>
          <span style={{ color: "white", fontSize: "18px", fontWeight: "900" }}>Geo</span>
          <span style={{ color: "#93C5FD", fontSize: "18px", fontWeight: "900" }}>Drill</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "3px", marginLeft: "8px" }}>INSIGHT</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", margin: 0 }}>
          © {new Date().getFullYear()} GeoDrill. Geoteknik Karar Destek Sistemi.
        </p>
      </footer>
    </div>
  )
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{
      background: "white", borderRadius: "16px",
      padding: "32px 28px", border: "1px solid #E2E8F0",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-4px)"
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(27,58,107,0.12)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"
      }}
    >
      <div style={{
        width: "52px", height: "52px", borderRadius: "12px",
        background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "24px", marginBottom: "20px"
      }}>
        {icon}
      </div>
      <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: "700", color: "#0F172A" }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: "14px", color: "#64748B", lineHeight: "1.65" }}>
        {desc}
      </p>
    </div>
  )
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({ step, index, last }) {
  return (
    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
      {/* sol: numara + çizgi */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "linear-gradient(135deg, #1B3A6B, #2D5BA3)",
          color: "white", fontWeight: "800", fontSize: "18px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(27,58,107,0.3)"
        }}>
          {index + 1}
        </div>
        {!last && (
          <div style={{ width: "2px", height: "60px", background: "#E2E8F0", margin: "8px 0" }} />
        )}
      </div>
      {/* sağ: içerik */}
      <div style={{ paddingBottom: last ? 0 : "24px" }}>
        <h3 style={{ margin: "8px 0 8px", fontSize: "19px", fontWeight: "700", color: "#0F172A" }}>
          {step.title}
        </h3>
        <p style={{ margin: 0, fontSize: "15px", color: "#64748B", lineHeight: "1.7" }}>
          {step.desc}
        </p>
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🪨",
    title: "Zemin Logu Girişi",
    desc: "SPT, UCS ve RQD değerleriyle zemin katmanlarını tanımlayın; stabilite riski otomatik hesaplanır.",
  },
  {
    icon: "⚙️",
    title: "Tork Hesabı",
    desc: "Her zemin katmanı için gereken tork değerini zemin tipine göre otomatik olarak hesaplayın.",
  },
  {
    icon: "🏗️",
    title: "Kasa İhtiyacı",
    desc: "Yeraltı suyu seviyesi ve stabilite riskine göre gereken kasa uzunluğunu belirleyin.",
  },
  {
    icon: "⛽",
    title: "Yakıt & Süre",
    desc: "Toplam delme süresi ve yakıt tüketimini proje başlamadan önce tahmin edin.",
  },
  {
    icon: "📊",
    title: "Ekipman Analizi",
    desc: "Makine parkınızdaki ekipmanların proje için uygunluğunu karşılaştırmalı matrisde görün.",
  },
  {
    icon: "📋",
    title: "Proje Yönetimi",
    desc: "Tüm projelerinizi kaydedin, geçmiş analizlere dilediğiniz zaman geri dönün.",
  },
]

const STEPS = [
  {
    title: "Zemin Profilini Girin",
    desc: "Saha verilerini (SPT, UCS, RQD, formasyon) katman katman sisteme işleyin. Stabilite riski ve uç tipi önerisi anında gösterilir.",
  },
  {
    title: "Ekipman Parkını Tanımlayın",
    desc: "Kullandığınız sondaj makinelerini (tork, max derinlik, çap kapasitesi) bir kez kaydedin, tüm projelerde kullanın.",
  },
  {
    title: "Analizi Çalıştırın",
    desc: "Tork, kasa, yakıt ve süre hesapları otomatik yapılır. Hangi makinenin proje için uygun olduğunu tek bakışta görün.",
  },
]
