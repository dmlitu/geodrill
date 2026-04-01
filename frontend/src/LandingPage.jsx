import { useEffect, useRef, useState } from "react"

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function RevealSection({ children, style, delay = 0 }) {
  const [ref, visible] = useScrollReveal()
  return (
    <div ref={ref} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      {children}
    </div>
  )
}

// ─── Demo Talep Formu (Slide-in Panel) ───────────────────────────────────────

function DemoForm({ open, onClose }) {
  const [form, setForm] = useState({ ad: "", firma: "", pozisyon: "", telefon: "", mesaj: "" })
  const [gonderildi, setGonderildi] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const gonder = async (e) => {
    e.preventDefault()
    if (!form.ad || !form.firma) return
    setLoading(true)
    // Gerçek entegrasyon için: fetch("/api/demo-request", { method: "POST", body: JSON.stringify(form) })
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    setGonderildi(true)
  }

  const inputS = {
    width: "100%", padding: "10px 14px",
    border: "1.5px solid #E0F2FE", borderRadius: "8px",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
    background: "white", color: "#0C4A6E",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "border-color 0.2s",
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(12,74,110,0.35)", backdropFilter: "blur(4px)",
      }} />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
        width: "min(420px, 100vw)",
        background: "white",
        boxShadow: "-8px 0 48px rgba(12,74,110,0.15)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.3s ease",
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: "1px solid #E0F2FE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: "800", fontSize: "18px", color: "#0C4A6E" }}>Demo Talep Et</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>Ekibimiz 24 saat içinde dönüş yapar</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "22px", lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
          {gonderildi ? (
            <div style={{ textAlign: "center", paddingTop: "40px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: "700", color: "#0C4A6E", marginBottom: "8px" }}>Talebiniz Alındı</div>
              <p style={{ color: "#64748B", fontSize: "14px", lineHeight: "1.6" }}>
                Ekibimiz en kısa sürede <strong>{form.firma}</strong> firmanıza ait demo erişimini hazırlayacak ve iletişime geçecek.
              </p>
              <button onClick={onClose} style={{
                marginTop: "24px", padding: "11px 28px",
                background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
                color: "white", border: "none", borderRadius: "8px",
                fontSize: "14px", fontWeight: "600", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>Kapat</button>
            </div>
          ) : (
            <form onSubmit={gonder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>AD SOYAD *</label>
                <input style={inputS} placeholder="Ahmet Yılmaz" value={form.ad} onChange={set("ad")} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>FİRMA ADI *</label>
                <input style={inputS} placeholder="Örnek Sondaj A.Ş." value={form.firma} onChange={set("firma")} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>POZİSYON</label>
                <input style={inputS} placeholder="Geoteknik Mühendisi" value={form.pozisyon} onChange={set("pozisyon")} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>TELEFON</label>
                <input style={inputS} placeholder="+90 5xx xxx xx xx" value={form.telefon} onChange={set("telefon")} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>KULLANIM AMACI</label>
                <textarea style={{ ...inputS, resize: "vertical", minHeight: "80px" }}
                  placeholder="Hangi proje tipi için kullanmayı planlıyorsunuz?"
                  value={form.mesaj} onChange={set("mesaj")} />
              </div>
              <button type="submit" disabled={loading || !form.ad || !form.firma} style={{
                padding: "13px", border: "none", borderRadius: "8px",
                background: (loading || !form.ad || !form.firma) ? "#BAE6FD" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
                color: "white", fontSize: "15px", fontWeight: "700",
                cursor: (loading || !form.ad || !form.firma) ? "not-allowed" : "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                marginTop: "4px",
              }}>
                {loading ? "Gönderiliyor..." : "Demo Talep Et"}
              </button>
              <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", marginTop: "4px" }}>
                Bilgileriniz yalnızca demo sürecinde kullanılır.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────

export default function LandingPage({ onGoLogin, onGoRegister }) {
  const [demoAcik, setDemoAcik] = useState(false)

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

        .strata-track { animation: strataScroll 28s linear infinite; }

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
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(14,165,233,0.35); }

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

        .trust-card {
          background: #F8FAFF;
          border: 1px solid #E0F2FE;
          border-radius: 10px;
          padding: 20px 24px;
        }

        @keyframes pulseBlue {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(14,165,233,0); }
        }
      `}</style>

      <DemoForm open={demoAcik} onClose={() => setDemoAcik(false)} />

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E0F2FE",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: "60px",
      }}>
        <Logo />
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="nav-btn-ghost" onClick={onGoLogin}>Giriş Yap</button>
          <button className="nav-btn-accent" onClick={() => setDemoAcik(true)}>Demo Talep Et</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden" }}>
        {/* Animasyonlu strata arka planı */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div className="strata-track" style={{ position: "absolute", left: 0, right: 0, top: 0, height: "200%" }}>
            {STRATA_BANDS.concat(STRATA_BANDS).map((band, i) => (
              <div key={i} style={{ height: band.h, background: band.color, opacity: band.opacity }} />
            ))}
          </div>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(255,255,255,0.94) 0%, rgba(240,249,255,0.88) 50%, rgba(255,255,255,0.96) 100%)",
          }} />
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
        <div style={{ position: "relative", zIndex: 1, maxWidth: "820px", margin: "0 auto", padding: "80px 48px", textAlign: "center" }}>
          <div style={{
            display: "inline-block",
            border: "1px solid #BAE6FD",
            borderLeft: "3px solid #0EA5E9",
            color: "#0369A1",
            fontSize: "11px", fontWeight: "700",
            letterSpacing: "4px", padding: "6px 16px",
            marginBottom: "32px",
            background: "rgba(14,165,233,0.05)",
            borderRadius: "4px",
          }}>
            SONDAJ PROJE YÖNETİM SİSTEMİ
          </div>

          <h1 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: "clamp(40px, 6.5vw, 72px)",
            fontWeight: "900",
            lineHeight: "1.1",
            margin: "0 0 24px",
            letterSpacing: "-0.02em",
            color: "#0C4A6E",
          }}>
            Sahaya Gitmeden Önce<br />
            <em style={{ color: "#0EA5E9", fontStyle: "italic" }}>Makineyi Seçin</em>
          </h1>

          <p style={{
            color: "#64748B",
            fontSize: "18px",
            lineHeight: "1.75",
            margin: "0 auto 16px",
            maxWidth: "580px",
            fontWeight: "400",
          }}>
            Zemin profili, tork hesabı, casing ihtiyacı ve ekipman uygunluğu —
            geoteknik mühendisleri ve sondaj şirketleri için.
          </p>

          <p style={{
            color: "#94A3B8",
            fontSize: "14px",
            margin: "0 auto 44px",
            maxWidth: "480px",
          }}>
            SPT, UCS ve RQD değerlerinizi girin. Hangi makinenin bu projeye uygun olduğunu dakikalar içinde öğrenin.
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-primary" onClick={() => setDemoAcik(true)}>Demo Talep Et</button>
            <button className="cta-secondary" onClick={onGoLogin}>Giriş Yap →</button>
          </div>

          <p style={{ marginTop: "28px", color: "#CBD5E1", fontSize: "12px", letterSpacing: "0.03em" }}>
            Erişim kurumsal başvuru ile sağlanır · Kişiselleştirilmiş demo
          </p>
        </div>
      </section>

      {/* ── Metodoloji Trust Şeridi ── */}
      <RevealSection>
        <div style={{
          background: "#F0F9FF",
          borderTop: "1px solid #E0F2FE",
          borderBottom: "1px solid #E0F2FE",
          padding: "36px 48px",
        }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <p style={{ textAlign: "center", fontSize: "11px", fontWeight: "700", letterSpacing: "3px", color: "#94A3B8", marginBottom: "24px" }}>
              HESAP METODOLOJİSİ
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}>
              {METODOLOJI.map(m => (
                <div key={m.baslik} className="trust-card">
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#0EA5E9", letterSpacing: "2px", marginBottom: "6px" }}>{m.baslik}</div>
                  <div style={{ fontSize: "13px", color: "#0C4A6E", fontWeight: "600", marginBottom: "4px" }}>{m.referans}</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8" }}>{m.aciklama}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ── Neden GeoDrill? ── */}
      <RevealSection>
        <section style={{ padding: "80px 48px", background: "white" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
                <span style={{ color: "#0EA5E9", fontSize: "11px", fontWeight: "700", letterSpacing: "3px" }}>POZİSYONLAMA</span>
              </div>
              <h2 style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(26px, 3.5vw, 38px)",
                fontWeight: "800",
                margin: "0 0 20px",
                letterSpacing: "-0.02em",
                color: "#0C4A6E",
                lineHeight: "1.2",
              }}>
                Operatör Tecrübesini<br />Dijitalleştirin
              </h2>
              <p style={{ color: "#64748B", fontSize: "15px", lineHeight: "1.75", margin: "0 0 28px" }}>
                Excel tablolar ve kişisel deneyime dayanan kararlar taşınamaz, belgelenemez ve standartlaştırılamaz. GeoDrill, sondaj mühendisliği bilgisini sisteme aktarır.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {POZISYON_ITEMS.map(item => (
                  <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#F0F9FF", border: "1px solid #BAE6FD", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0EA5E9" }} />
                    </div>
                    <div>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#0C4A6E" }}>{item.baslik}: </span>
                      <span style={{ fontSize: "14px", color: "#64748B" }}>{item.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {RAKIP_KARSILASTIRMA.map(row => (
                <div key={row.konu} style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "10px", padding: "16px 20px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "2px", marginBottom: "10px" }}>{row.konu}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>Excel / Tecrübe</div>
                      <div style={{ fontSize: "13px", color: "#DC2626", fontWeight: "500" }}>{row.eski}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#0EA5E9", marginBottom: "4px" }}>GeoDrill</div>
                      <div style={{ fontSize: "13px", color: "#0C4A6E", fontWeight: "600" }}>{row.yeni}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── Özellikler ── */}
      <RevealSection>
        <section style={{ padding: "80px 48px", background: "#F8FAFF" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "16px" }}>
                <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
                <span style={{ color: "#0EA5E9", fontSize: "11px", fontWeight: "700", letterSpacing: "3px" }}>MODÜLLER</span>
                <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
              </div>
              <h2 style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(26px, 3.5vw, 40px)",
                fontWeight: "800",
                margin: "0",
                letterSpacing: "-0.02em",
                color: "#0C4A6E",
              }}>
                Her Şey Tek Platformda
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
              {FEATURES.map((f, i) => (
                <div key={f.title} className="feature-card" style={{ borderLeftColor: f.accent }}>
                  <style>{`.feature-card:nth-child(${i + 1})::before { background: ${f.accent}; }`}</style>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: f.accent, flexShrink: 0 }} />
                    <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", letterSpacing: "0.01em" }}>{f.title}</h3>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── Nasıl Çalışır ── */}
      <RevealSection>
        <section style={{ padding: "80px 48px", background: "white" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "16px" }}>
                <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
                <span style={{ color: "#0EA5E9", fontSize: "11px", fontWeight: "700", letterSpacing: "3px" }}>SÜREÇ</span>
                <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
              </div>
              <h2 style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(26px, 3.5vw, 40px)",
                fontWeight: "800", margin: "0",
                letterSpacing: "-0.02em", color: "#0C4A6E",
              }}>
                Dört Adımda Eksiksiz Analiz
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0" }}>
              {STEPS.map((step, i) => (
                <div key={step.title} className="step-item" style={{
                  padding: "28px 24px",
                  borderLeft: i === 0 ? "none" : "1px solid #E0F2FE",
                }}>
                  <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: "700", margin: "12px 0 10px", color: "#0C4A6E" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── CTA ── */}
      <RevealSection>
        <section style={{
          padding: "100px 48px",
          background: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 50%, #0284C7 100%)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)",
            width: "600px", height: "300px",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative" }}>
            <h2 style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: "800",
              margin: "0 0 16px",
              color: "white",
              letterSpacing: "-0.02em",
            }}>
              Projelerinizi Konuşalım
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "16px", margin: "0 0 40px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
              Geoteknik analizlerinizi nasıl dijitalleştirebileceğinizi birlikte değerlendirelim. Demo için formu doldurun.
            </p>
            <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setDemoAcik(true)} style={{
                padding: "15px 40px", border: "none", borderRadius: "8px",
                background: "white", color: "#0284C7",
                fontSize: "16px", fontWeight: "700", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "transform 0.15s, box-shadow 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                Demo Talep Et
              </button>
              <button onClick={onGoLogin} style={{
                padding: "15px 36px",
                border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "8px",
                background: "transparent", color: "rgba(255,255,255,0.9)",
                fontSize: "15px", fontWeight: "600", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                Giriş Yap →
              </button>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ── Footer ── */}
      <footer style={{
        background: "#0C4A6E",
        padding: "32px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "16px",
      }}>
        <Logo dark />
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", margin: 0, letterSpacing: "0.02em" }}>
          © {new Date().getFullYear()} GeoDrill Insight · Geoteknik Karar Destek Sistemi
        </p>
      </footer>
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {["#0369A1", "#0EA5E9", "#7DD3FC"].map((c, i) => (
          <div key={i} style={{ width: "6px", height: "6px", borderRadius: "1px", background: dark ? `rgba(255,255,255,${0.6 - i * 0.15})` : c }} />
        ))}
      </div>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "19px", color: dark ? "white" : "#0C4A6E" }}>Geo</span>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "19px", color: dark ? "#7DD3FC" : "#0EA5E9" }}>Drill</span>
        <span style={{ color: dark ? "rgba(255,255,255,0.35)" : "#94A3B8", fontSize: "9px", letterSpacing: "3px", marginLeft: "6px", verticalAlign: "middle", fontWeight: "700" }}>INSIGHT</span>
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STRATA_BANDS = [
  { h: "18px", color: "#E0F2FE", opacity: 0.8 },
  { h: "6px",  color: "#BAE6FD", opacity: 0.6 },
  { h: "28px", color: "#F0F9FF", opacity: 0.9 },
  { h: "4px",  color: "#7DD3FC", opacity: 0.4 },
  { h: "22px", color: "#E0F2FE", opacity: 0.8 },
  { h: "8px",  color: "#BFDBFE", opacity: 0.5 },
  { h: "40px", color: "#F0F9FF", opacity: 1   },
  { h: "6px",  color: "#BAE6FD", opacity: 0.5 },
  { h: "18px", color: "#DBEAFE", opacity: 0.7 },
  { h: "10px", color: "#BFDBFE", opacity: 0.6 },
  { h: "34px", color: "#EFF6FF", opacity: 1   },
  { h: "8px",  color: "#E0F2FE", opacity: 0.6 },
  { h: "50px", color: "#F0F9FF", opacity: 0.9 },
  { h: "6px",  color: "#BAE6FD", opacity: 0.4 },
  { h: "26px", color: "#E0F2FE", opacity: 0.8 },
]

const METODOLOJI = [
  { baslik: "TORK HESABI", referans: "Meyerhof (1976)", aciklama: "τ × π × d³/8 × güvenlik faktörü" },
  { baslik: "ZEMİN SINIFLAMASI", referans: "ASTM D2487 / USCS", aciklama: "Birleşik zemin sınıflama sistemi" },
  { baslik: "KAYA KALİTESİ", referans: "ISRM Standardı", aciklama: "RQD ve UCS bazlı değerlendirme" },
  { baslik: "CASING TASARIMI", referans: "Eurocode 7 / TS EN 1997", aciklama: "Yeraltı suyu ve stabilite riski" },
]

const POZISYON_ITEMS = [
  { baslik: "Hata riski", text: "Formül tabanlı hesap, kişisel yoruma bağımlılığı ortadan kaldırır" },
  { baslik: "Belgeleme", text: "Her karar gerekçesiyle birlikte PDF olarak kaydedilir" },
  { baslik: "Standartlaştırma", text: "Farklı mühendisler aynı metodoloji ile çalışır" },
  { baslik: "Hız", text: "Manuel hesaplama saatlerden dakikalara iner" },
]

const RAKIP_KARSILASTIRMA = [
  { konu: "KARAR HIZI", eski: "Saatler, bazen günler", yeni: "3–5 dakika" },
  { konu: "BELGELEME", eski: "Kayıt yok veya Excel", yeni: "Otomatik PDF rapor" },
  { konu: "STANDARTLAŞMA", eski: "Mühendisten mühendise değişir", yeni: "Her projede aynı metodoloji" },
  { konu: "MAKİNE SEÇİMİ", eski: "Tecrübeye dayalı", yeni: "Tork + derinlik + çap karşılaştırması" },
]

const FEATURES = [
  { title: "Zemin Profili Analizi", desc: "SPT, UCS ve RQD değerleriyle katman katman zemin tanımı. Stabilite riski ve casing ihtiyacı otomatik hesaplanır.", accent: "#0284C7" },
  { title: "Tork Hesabı", desc: "Meyerhof formülüne dayalı gerekli minimum tork hesabı. Zemin tipine ve kaya kalitesine göre otomatik ayar.", accent: "#0EA5E9" },
  { title: "Makine Uygunluk Matrisi", desc: "Makine parkınızdaki tüm ekipmanlar için uygunluk değerlendirmesi. Tek ekranda karşılaştırmalı karar.", accent: "#0369A1" },
  { title: "Casing Uzunluğu", desc: "Yeraltı suyu seviyesi ve stabilite riskine göre gerekli muhafaza borusu uzunluğu. Gerekçeli değerlendirme.", accent: "#38BDF8" },
  { title: "Süre & Maliyet Tahmini", desc: "Toplam delme süresi ve yakıt tüketimi tahmini. Günlük üretim hedefi ve Gantt şeması.", accent: "#0EA5E9" },
  { title: "Profesyonel PDF Rapor", desc: "Proje özeti, teknik analiz ve yönetici özetiyle birlikte kurumsal kalitede rapor çıktısı.", accent: "#0284C7" },
]

const STEPS = [
  { title: "Zemin Profilini Girin", desc: "Saha verilerini (SPT, UCS, RQD) katman katman işleyin. Stabilite riski anında görülür." },
  { title: "Makine Parkını Tanımlayın", desc: "Sahada kullandığınız sondaj makinelerini tork, derinlik ve çap kapasiteleriyle kaydedin." },
  { title: "Hesabı Çalıştırın", desc: "Tork, casing, yakıt ve süre otomatik hesaplanır. Sistem en uygun makineyi önerir." },
  { title: "Raporu İndirin", desc: "Yönetici özeti ve teknik detaylarla birlikte kurumsal PDF raporu tek tıkla oluşturun." },
]
