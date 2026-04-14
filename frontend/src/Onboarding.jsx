/**
 * Onboarding Wizard — ilk giriş deneyimi
 * 4 adım: Hoş Geldin → Firma Kurulumu → İlk Proje → Hazırsın
 */
import { useState } from "react"
import { createCompany, joinCompany } from "./api"

const S = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 9200,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(12, 74, 110, 0.55)", backdropFilter: "blur(8px)",
  },
  card: {
    background: "white", borderRadius: "24px",
    width: "100%", maxWidth: "520px",
    padding: "48px 44px 40px",
    boxShadow: "0 40px 100px rgba(14,165,233,0.22)",
    animation: "fadeUp 0.35s ease",
    position: "relative",
    overflow: "hidden",
  },
  accent: {
    position: "absolute", top: 0, left: 0, right: 0, height: "4px",
    background: "linear-gradient(90deg, #0284C7, #0EA5E9, #38BDF8)",
  },
  step: {
    fontSize: "11px", fontWeight: "700", color: "#0EA5E9",
    letterSpacing: "4px", textTransform: "uppercase", marginBottom: "12px",
  },
  h: {
    fontFamily: "'Fraunces', serif", fontWeight: "900",
    fontSize: "26px", color: "#0C4A6E", marginBottom: "10px",
  },
  sub: {
    fontSize: "14px", color: "#64748B", lineHeight: "1.7", marginBottom: "32px",
  },
  btn: {
    width: "100%", padding: "14px",
    border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
    color: "white", fontSize: "15px", fontWeight: "700",
    cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
    boxShadow: "0 4px 16px rgba(14,165,233,0.3)",
    transition: "opacity 0.2s",
  },
  btnGhost: {
    width: "100%", padding: "13px",
    border: "1.5px solid #E2E8F0", borderRadius: "10px",
    background: "white", color: "#475569",
    fontSize: "14px", fontWeight: "600",
    cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  inp: {
    width: "100%", padding: "11px 14px",
    border: "1.5px solid #BAE6FD", borderRadius: "8px",
    fontSize: "14px", outline: "none",
    boxSizing: "border-box", color: "#0C4A6E",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  label: {
    fontSize: "12px", fontWeight: "600", color: "#64748B",
    display: "block", marginBottom: "6px", letterSpacing: "0.04em",
  },
  progress: {
    display: "flex", gap: "6px", marginBottom: "32px",
  },
  dot: (active, done) => ({
    height: "4px", flex: 1, borderRadius: "2px",
    background: done ? "#0EA5E9" : active ? "#7DD3FC" : "#E2E8F0",
    transition: "background 0.3s",
  }),
}

// ── Logo ────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {["#0369A1","#0EA5E9","#7DD3FC"].map((c, i) => (
          <div key={i} style={{ width: "5px", height: "5px", borderRadius: "1px", background: c }} />
        ))}
      </div>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "18px", color: "#0C4A6E" }}>Geo</span>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "18px", color: "#0EA5E9" }}>Drill</span>
        <span style={{ color: "#94A3B8", fontSize: "8px", letterSpacing: "3px", marginLeft: "6px", verticalAlign: "middle", fontWeight: "700" }}>INSIGHT</span>
      </div>
    </div>
  )
}

// ── Adım göstergesi ─────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div style={S.progress}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={S.dot(i === step, i < step)} />
      ))}
    </div>
  )
}

// ── Adım 1: Hoş Geldin ──────────────────────────────────────────────────────

function Adim1({ username, onNext, onSkip }) {
  return (
    <div>
      <Logo />
      <ProgressBar step={0} total={4} />
      <div style={S.step}>ADIM 1 / 4</div>
      <div style={S.h}>Hoş geldiniz, {username}!</div>
      <div style={S.sub}>
        GeoDrill Insight, kazık sondajı kararlarınızı veri ile destekler. Birkaç adımda
        hesaplama motorunu yapılandıralım — toplam 2 dakika sürer.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
        {[
          { icon: "🪨", label: "Zemin profili", desc: "SPT / UCS / RQD" },
          { icon: "⚙️", label: "Makine kararı", desc: "Tork & crowd analizi" },
          { icon: "📊", label: "Risk değerlendirmesi", desc: "Güven puanı ile" },
          { icon: "💰", label: "Maliyet motoru", desc: "Piyasa karşılaştırması" },
        ].map(f => (
          <div key={f.label} style={{ background: "#F0F9FF", borderRadius: "10px", padding: "14px 12px", border: "1px solid #BAE6FD" }}>
            <div style={{ fontSize: "18px", marginBottom: "6px" }}>{f.icon}</div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#0C4A6E", marginBottom: "2px" }}>{f.label}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <button style={S.btn} onClick={onNext}>Başlayalım →</button>
        <button style={S.btnGhost} onClick={onSkip}>Atla, doğrudan uygulamaya git</button>
      </div>
    </div>
  )
}

// ── Adım 2: Firma Kurulumu ──────────────────────────────────────────────────

function Adim2({ onNext, onSkip }) {
  const [mode, setMode] = useState(null) // "create" | "join"
  const [firmaAdi, setFirmaAdi] = useState("")
  const [slug, setSlug] = useState("")
  const [joinSlug, setJoinSlug] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const autoSlug = (name) => name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

  const handleCreate = async () => {
    if (!firmaAdi.trim()) { setError("Firma adı gerekli"); return }
    setLoading(true); setError("")
    try {
      await createCompany({ name: firmaAdi.trim(), slug: slug || autoSlug(firmaAdi) })
      onNext()
    } catch (e) {
      setError(e.message || "Firma oluşturulamadı")
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!joinSlug.trim()) { setError("Firma kodu gerekli"); return }
    setLoading(true); setError("")
    try {
      await joinCompany(joinSlug.trim())
      onNext()
    } catch (e) {
      setError(e.message || "Firmaya katılamadı")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Logo />
      <ProgressBar step={1} total={4} />
      <div style={S.step}>ADIM 2 / 4</div>
      <div style={S.h}>Firma Kurulumu</div>
      <div style={S.sub}>
        Analizlerinizi firmanızla paylaşmak ve ortak proje geçmişi oluşturmak için
        çalışma alanı belirleyin. İstediğiniz zaman ayarlardan değiştirebilirsiniz.
      </div>

      {!mode && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <button onClick={() => setMode("create")} style={{ ...S.btn, background: "linear-gradient(135deg,#0284C7,#0EA5E9)" }}>
            + Yeni Firma Oluştur
          </button>
          <button onClick={() => setMode("join")} style={S.btnGhost}>
            Mevcut Firmaya Katıl
          </button>
        </div>
      )}

      {mode === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px" }}>
          <div>
            <label style={S.label}>FİRMA ADI</label>
            <input style={S.inp} value={firmaAdi} placeholder="Örn: Temel İnşaat A.Ş."
              onChange={e => { setFirmaAdi(e.target.value); setSlug(autoSlug(e.target.value)) }} />
          </div>
          <div>
            <label style={S.label}>ÇALIŞMA ALANI KODU (opsiyonel)</label>
            <input style={S.inp} value={slug} placeholder="temel-insaat"
              onChange={e => setSlug(autoSlug(e.target.value))} />
            <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>Ekip arkadaşlarınız bu kodla katılır</div>
          </div>
          {error && <div style={{ color: "#DC2626", fontSize: "13px", background: "#FEF2F2", padding: "10px 12px", borderRadius: "8px" }}>{error}</div>}
          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={handleCreate} disabled={loading}>
            {loading ? "Oluşturuluyor..." : "Firma Oluştur →"}
          </button>
          <button style={S.btnGhost} onClick={() => { setMode(null); setError("") }}>Geri</button>
        </div>
      )}

      {mode === "join" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px" }}>
          <div>
            <label style={S.label}>FİRMA KODU</label>
            <input style={S.inp} value={joinSlug} placeholder="temel-insaat"
              onChange={e => setJoinSlug(e.target.value)} />
            <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>Firma yöneticisinden alın</div>
          </div>
          {error && <div style={{ color: "#DC2626", fontSize: "13px", background: "#FEF2F2", padding: "10px 12px", borderRadius: "8px" }}>{error}</div>}
          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={handleJoin} disabled={loading}>
            {loading ? "Katılınıyor..." : "Katıl →"}
          </button>
          <button style={S.btnGhost} onClick={() => { setMode(null); setError("") }}>Geri</button>
        </div>
      )}

      {!mode && (
        <button style={{ ...S.btnGhost, marginTop: "4px", color: "#94A3B8", border: "none", fontSize: "13px" }} onClick={onSkip}>
          Şimdilik atla →
        </button>
      )}
    </div>
  )
}

// ── Adım 3: İlk Proje ───────────────────────────────────────────────────────

function Adim3({ onDemo, onBos }) {
  return (
    <div>
      <Logo />
      <ProgressBar step={2} total={4} />
      <div style={S.step}>ADIM 3 / 4</div>
      <div style={S.h}>İlk Projenizi Başlatın</div>
      <div style={S.sub}>
        Gerçek verilerle başlamak için demo projeyi yükleyin, ya da sıfırdan
        kendiniz oluşturun. Her iki durumda da tam sistemi kullanabilirsiniz.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "8px" }}>
        {/* Demo kart */}
        <button onClick={onDemo} style={{
          padding: "20px 22px", borderRadius: "12px", textAlign: "left",
          background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(14,165,233,0.35)",
          color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif",
          transition: "transform 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <div style={{ fontSize: "22px", marginBottom: "8px" }}>🏗️</div>
          <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Demo Proje Yükle (Önerilen)</div>
          <div style={{ fontSize: "12px", opacity: 0.85, lineHeight: "1.5" }}>
            İstanbul / Kadıköy Metro temel kazıkları — kil, kum, kaya katmanlı gerçek profil.
            Tüm hesaplamalar çalışır halde.
          </div>
        </button>

        {/* Boş kart */}
        <button onClick={onBos} style={{
          padding: "20px 22px", borderRadius: "12px", textAlign: "left",
          background: "white", border: "1.5px solid #E2E8F0", cursor: "pointer",
          color: "#334155", fontFamily: "'Plus Jakarta Sans', sans-serif",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#7DD3FC"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(14,165,233,0.12)" }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none" }}
        >
          <div style={{ fontSize: "22px", marginBottom: "8px" }}>📋</div>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", marginBottom: "4px" }}>Boş Proje ile Başla</div>
          <div style={{ fontSize: "12px", color: "#64748B", lineHeight: "1.5" }}>
            Proje bilgilerini ve zemin katmanlarını kendiniz gireceksiniz.
          </div>
        </button>
      </div>
    </div>
  )
}

// ── Adım 4: Hazırsınız ──────────────────────────────────────────────────────

function Adim4({ onBitir, demoYuklendi }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ textAlign: "center" }}>
      <Logo />
      <ProgressBar step={3} total={4} />
      <div style={S.step}>ADIM 4 / 4</div>

      {/* Check animasyonu */}
      <div style={{
        width: "80px", height: "80px", borderRadius: "50%",
        background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
        boxShadow: "0 8px 32px rgba(14,165,233,0.4)",
        animation: "fadeUp 0.4s ease",
        fontSize: "36px",
      }}>
        ✓
      </div>

      <div style={{ ...S.h, textAlign: "center" }}>Her şey hazır!</div>
      <div style={{ ...S.sub, textAlign: "center" }}>
        {demoYuklendi
          ? "Demo proje yüklendi. Zemin profilini, tork hesabını ve maliyet analizini inceleyebilirsiniz."
          : "Boş proje oluşturuldu. Proje formunu doldurup zemin katmanlarını ekleyerek başlayabilirsiniz."
        }
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "32px" }}>
        {[
          { icon: "📋", label: "Proje Bilgileri", desc: "İlk adım" },
          { icon: "🪨", label: "Zemin Logu", desc: "Katman girin" },
          { icon: "📊", label: "Analiz", desc: "Sonuçları gör" },
        ].map(s => (
          <div key={s.label} style={{ background: "#F0F9FF", borderRadius: "10px", padding: "14px 10px", border: "1px solid #BAE6FD", textAlign: "center" }}>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>{s.icon}</div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#0C4A6E", marginBottom: "2px" }}>{s.label}</div>
            <div style={{ fontSize: "10px", color: "#64748B" }}>{s.desc}</div>
          </div>
        ))}
      </div>

      <button
        style={{
          ...S.btn,
          background: hover ? "linear-gradient(135deg, #0369A1, #0284C7)" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
          transform: hover ? "translateY(-1px)" : "none",
          boxShadow: hover ? "0 8px 24px rgba(14,165,233,0.4)" : "0 4px 16px rgba(14,165,233,0.3)",
          transition: "all 0.2s",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onBitir}
      >
        Uygulamaya Geç →
      </button>
    </div>
  )
}

// ── Ana Bileşen ─────────────────────────────────────────────────────────────

export default function OnboardingWizard({ username, onComplete, onDemoYukle }) {
  const [adim, setAdim] = useState(0)
  const [demoYuklendi, setDemoYuklendi] = useState(false)

  const handleSkip = () => {
    localStorage.setItem("gd_onboarded", "1")
    onComplete()
  }

  const handleDemo = () => {
    onDemoYukle()
    setDemoYuklendi(true)
    setAdim(3)
  }

  const handleBos = () => {
    setAdim(3)
  }

  const handleBitir = () => {
    localStorage.setItem("gd_onboarded", "1")
    onComplete()
  }

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.accent} />
        {adim === 0 && <Adim1 username={username} onNext={() => setAdim(1)} onSkip={handleSkip} />}
        {adim === 1 && <Adim2 onNext={() => setAdim(2)} onSkip={() => setAdim(2)} />}
        {adim === 2 && <Adim3 onDemo={handleDemo} onBos={handleBos} />}
        {adim === 3 && <Adim4 onBitir={handleBitir} demoYuklendi={demoYuklendi} />}
      </div>
    </div>
  )
}
