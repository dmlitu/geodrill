export default function LandingPage({ onGoLogin, onGoRegister }) {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FFFFFF", color: "#0C4A6E", overflowX: "hidden" }}>
      <style>{`
        .nav-btn-ghost {
          padding: 8px 20px;
          border: 1px solid #BAE6FD;
          border-radius: 6px;
          background: transparent;
          color: #64748B;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          letter-spacing: 0.02em;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .nav-btn-ghost:hover { color: #0369A1; border-color: #0EA5E9; background: #F0F9FF; }

        .nav-btn-accent {
          padding: 8px 20px;
          border: none;
          border-radius: 6px;
          background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%);
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          letter-spacing: 0.02em;
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .nav-btn-accent:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(14,165,233,0.3); }

        .strata-track {
          animation: strataScroll 28s linear infinite;
        }

        .feature-card {
          background: white;
          border: 1px solid #E0F2FE;
          border-radius: 12px;
          padding: 28px 24px;
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .feature-card:hover {
          border-color: #BAE6FD;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(14,165,233,0.08);
        }

        .cta-primary {
          padding: 14px 36px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(14,165,233,0.35);
        }

        .cta-secondary {
          padding: 14px 36px;
          border: 1.5px solid #BAE6FD;
          border-radius: 8px;
          background: transparent;
          color: #0369A1;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .cta-secondary:hover { color: #0284C7; border-color: #0EA5E9; background: #F0F9FF; }

        .step-num {
          font-family: 'Fraunces', serif;
          font-size: 72px;
          font-weight: 900;
          line-height: 1;
          color: #E0F2FE;
          transition: color 0.2s;
        }
        .step-item:hover .step-num { color: #0EA5E9; }

        .stat-val {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 40px;
          color: #0EA5E9;
          line-height: 1;
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E0F2FE",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: "60px",
      }}>
        <Logo />
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="nav-btn-ghost" onClick={onGoLogin}>Giriş Yap</button>
          <button className="nav-btn-accent" onClick={onGoRegister}>Kayıt Ol</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>

        {/* Animasyonlu strata arka planı */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div className="strata-track" style={{ position: "absolute", left: 0, right: 0, top: 0, height: "200%" }}>
            {STRATA_BANDS.concat(STRATA_BANDS).map((band, i) => (
              <div key={i} style={{
                height: band.h,
                background: band.color,
                opacity: band.opacity,
              }} />
            ))}
          </div>
          {/* Açık overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(255,255,255,0.92) 0%, rgba(240,249,255,0.85) 50%, rgba(255,255,255,0.95) 100%)",
          }} />
          {/* Sondaj kolon göstergesi */}
          <div style={{
            position: "absolute", right: "10%", top: "10%", bottom: "10%",
            width: "1px", background: "linear-gradient(to bottom, transparent, #BAE6FD 20%, #BAE6FD 80%, transparent)",
            opacity: 0.5,
          }} />
          <div style={{
            position: "absolute", right: "calc(10% - 5px)", top: "15%",
            width: "11px", height: "11px", borderRadius: "50%",
            background: "#0EA5E9", opacity: 0.7,
            animation: "pulseBlue 3s ease-in-out infinite",
          }} />
        </div>

        {/* Hero içeriği */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "80px 48px", textAlign: "center" }}>
          <div style={{
            display: "inline-block",
            border: "1px solid #BAE6FD",
            borderLeft: "3px solid #0EA5E9",
            color: "#64748B",
            fontSize: "11px", fontWeight: "700",
            letterSpacing: "4px", padding: "6px 16px",
            marginBottom: "32px",
            background: "rgba(14,165,233,0.05)",
            borderRadius: "4px",
          }}>
            GEOTEKNİK KARAR DESTEK SİSTEMİ
          </div>

          <h1 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(44px, 7vw, 80px)",
            fontWeight: "900",
            lineHeight: "1.1",
            margin: "0 0 28px",
            letterSpacing: "-0.02em",
            color: "#0C4A6E",
          }}>
            Sondaj Kararlarını<br />
            <em style={{ color: "#0EA5E9", fontStyle: "italic" }}>Zemine Dayalı</em> Alın
          </h1>

          <p style={{
            color: "#64748B",
            fontSize: "18px",
            lineHeight: "1.75",
            margin: "0 auto 48px",
            maxWidth: "540px",
            fontWeight: "400",
          }}>
            Zemin profili, tork hesabı, kasa ihtiyacı, yakıt tüketimi ve ekipman uygunluğunu tek platformda yönetin.
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-primary" onClick={onGoRegister}>Ücretsiz Başla</button>
            <button className="cta-secondary" onClick={onGoLogin}>Giriş Yap →</button>
          </div>
        </div>
      </section>

      {/* ── İstatistik şeridi ── */}
      <div style={{
        background: "#F0F9FF",
        borderTop: "1px solid #E0F2FE",
        borderBottom: "1px solid #E0F2FE",
        padding: "40px 48px",
      }}>
        <div style={{
          maxWidth: "900px", margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "32px", textAlign: "center",
        }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div className="stat-val">{s.value}</div>
              <div style={{ marginTop: "6px", color: "#94A3B8", fontSize: "12px", fontWeight: "600", letterSpacing: "2px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Özellikler ── */}
      <section style={{ padding: "100px 48px", background: "white" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SectionLabel>MODÜLLER</SectionLabel>
          <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: "800",
            margin: "16px 0 56px",
            letterSpacing: "-0.02em",
            color: "#0C4A6E",
          }}>
            Her Şey Tek Yerde
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card" style={{ borderLeftColor: f.accent }}>
                <style>{`.feature-card:nth-child(${i + 1})::before { background: ${f.accent}; }`}</style>
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px",
                }}>
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "2px",
                    background: f.accent, flexShrink: 0,
                  }} />
                  <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", letterSpacing: "0.01em" }}>
                    {f.title}
                  </h3>
                </div>
                <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Nasıl Çalışır ── */}
      <section style={{ padding: "100px 48px", background: "#F0F9FF" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionLabel>SÜREÇ</SectionLabel>
          <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: "800",
            margin: "16px 0 64px",
            letterSpacing: "-0.02em",
            color: "#0C4A6E",
          }}>
            Üç Adımda Eksiksiz Analiz
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0" }}>
            {STEPS.map((step, i) => (
              <div key={step.title} className="step-item" style={{
                padding: "32px",
                borderLeft: i === 0 ? "none" : "1px solid #E0F2FE",
                position: "relative",
              }}>
                <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                <h3 style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "20px", fontWeight: "700",
                  margin: "16px 0 12px",
                  color: "#0C4A6E",
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "100px 48px",
        background: "white",
        borderTop: "1px solid #E0F2FE",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "300px",
          background: "radial-gradient(ellipse, rgba(14,165,233,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <SectionLabel>BAŞLANGIÇ</SectionLabel>
          <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: "800",
            margin: "16px 0 20px",
            letterSpacing: "-0.02em",
            color: "#0C4A6E",
          }}>
            İlk Projenizi Bugün Analiz Edin
          </h2>
          <p style={{ color: "#64748B", fontSize: "16px", margin: "0 0 40px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
            Ücretsiz hesap oluşturun, zemin profilinizi girin ve dakikalar içinde eksiksiz bir sondaj analizi alın.
          </p>
          <button className="cta-primary" onClick={onGoRegister}>
            Ücretsiz Kayıt Ol
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: "#F0F9FF",
        borderTop: "1px solid #E0F2FE",
        padding: "32px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "16px",
      }}>
        <Logo small />
        <p style={{ color: "#94A3B8", fontSize: "12px", margin: 0, letterSpacing: "0.02em" }}>
          © {new Date().getFullYear()} GeoDrill Insight. Geoteknik Karar Destek Sistemi.
        </p>
      </footer>
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ small }) {
  const size = small ? "16px" : "20px"
  const dotSize = small ? "6px" : "7px"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {["#0369A1", "#0EA5E9", "#7DD3FC"].map((c, i) => (
          <div key={i} style={{ width: dotSize, height: dotSize, borderRadius: "1px", background: c }} />
        ))}
      </div>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: size, color: "#0C4A6E" }}>Geo</span>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: size, color: "#0EA5E9" }}>Drill</span>
        <span style={{ color: "#94A3B8", fontSize: "9px", letterSpacing: "3px", fontWeight: "700", marginLeft: "6px", verticalAlign: "middle" }}>INSIGHT</span>
      </div>
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
      <span style={{ color: "#0EA5E9", fontSize: "11px", fontWeight: "700", letterSpacing: "3px" }}>
        {children}
      </span>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STRATA_BANDS = [
  { h: "18px",  color: "#BAE6FD", opacity: 0.4 },
  { h: "6px",   color: "#7DD3FC", opacity: 0.3 },
  { h: "28px",  color: "#38BDF8", opacity: 0.25 },
  { h: "4px",   color: "#0EA5E9", opacity: 0.2 },
  { h: "22px",  color: "#0284C7", opacity: 0.18 },
  { h: "8px",   color: "#BAE6FD", opacity: 0.3 },
  { h: "40px",  color: "#7DD3FC", opacity: 0.2 },
  { h: "6px",   color: "#38BDF8", opacity: 0.15 },
  { h: "18px",  color: "#0EA5E9", opacity: 0.2 },
  { h: "10px",  color: "#0284C7", opacity: 0.15 },
  { h: "34px",  color: "#0369A1", opacity: 0.12 },
  { h: "6px",   color: "#BAE6FD", opacity: 0.25 },
  { h: "50px",  color: "#7DD3FC", opacity: 0.15 },
  { h: "8px",   color: "#38BDF8", opacity: 0.2 },
  { h: "26px",  color: "#E0F2FE", opacity: 0.35 },
  { h: "12px",  color: "#BAE6FD", opacity: 0.2 },
]

const STATS = [
  { value: "6+",   label: "HESAP MODÜLÜ" },
  { value: "∞",    label: "PROJE SAYISI" },
  { value: "100%", label: "WEB TABANLI" },
  { value: "PDF",  label: "RAPOR ÇIKTI" },
]

const FEATURES = [
  {
    title: "Zemin Logu Girişi",
    desc: "SPT, UCS ve RQD değerleriyle zemin katmanlarını tanımlayın. Stabilite riski ve uç tipi önerisi anında hesaplanır.",
    accent: "#0369A1",
  },
  {
    title: "Tork Hesabı",
    desc: "Her zemin katmanı için gereken tork değerini zemin tipine ve formasyon özelliklerine göre otomatik hesaplayın.",
    accent: "#0EA5E9",
  },
  {
    title: "Kasa İhtiyacı",
    desc: "Yeraltı suyu seviyesi ve stabilite riskine göre gereken casing uzunluğunu otomatik belirleyin.",
    accent: "#0891B2",
  },
  {
    title: "Yakıt & Süre Tahmini",
    desc: "Toplam kazık süresi ve yakıt tüketimini proje başlamadan önce sahaya göre öngörün.",
    accent: "#14B8A6",
  },
  {
    title: "Ekipman Uygunluk Matrisi",
    desc: "Makine parkınızdaki ekipmanların bu proje için uygunluğunu karşılaştırmalı tabloda görün.",
    accent: "#6366F1",
  },
  {
    title: "PDF Rapor",
    desc: "Tüm hesap sonuçlarını tek tıkla profesyonel PDF raporuna dönüştürün, müşteriye doğrudan iletin.",
    accent: "#38BDF8",
  },
]

const STEPS = [
  {
    title: "Zemin Profilini Girin",
    desc: "Saha verilerini katman katman sisteme işleyin. Stabilite riski ve uç tipi önerisi anında gösterilir.",
  },
  {
    title: "Makine Parkınızı Tanımlayın",
    desc: "Sondaj makinelerinizi bir kez kaydedin — tork kapasitesi, derinlik ve çap limitleriyle birlikte.",
  },
  {
    title: "Analizi Çalıştırın",
    desc: "Tork, kasa, yakıt ve süre hesapları otomatik yapılır. Hangi makinenin uygun olduğunu tek bakışta görün.",
  },
]
