import { useState, useEffect } from "react"
import { getDashboard, getRecentAnalyses } from "./api"
import { useToast } from "./Toast"

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function RiskBar({ dagilim }) {
  const toplam = Object.values(dagilim).reduce((a, b) => a + b, 0)
  if (toplam === 0) return (
    <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
      Henüz analiz kaydedilmemiş
    </div>
  )

  const segmentler = [
    { key: "Yüksek", renk: "#EF4444", bg: "#FEF2F2" },
    { key: "Orta",   renk: "#F59E0B", bg: "#FFFBEB" },
    { key: "Düşük",  renk: "#10B981", bg: "#F0FDF4" },
  ]

  return (
    <div>
      <div style={{ display: "flex", gap: "2px", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "10px" }}>
        {segmentler.map(({ key, renk }) => {
          const pct = toplam ? (dagilim[key] || 0) / toplam * 100 : 0
          return pct > 0 ? (
            <div key={key} style={{ width: `${pct}%`, background: renk, transition: "width 0.5s ease" }} />
          ) : null
        })}
      </div>
      <div style={{ display: "flex", gap: "14px" }}>
        {segmentler.map(({ key, renk }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: renk }} />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {key}: <strong style={{ color: "var(--text-primary)" }}>{dagilim[key] || 0}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }) {
  const config = {
    free:       { label: "Free",       renk: "#64748B", bg: "#F1F5F9", border: "#E2E8F0" },
    pro:        { label: "Pro",        renk: "#0369A1", bg: "#E0F2FE", border: "#BAE6FD" },
    enterprise: { label: "Enterprise", renk: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  }[plan] || { label: plan, renk: "#64748B", bg: "#F1F5F9", border: "#E2E8F0" }

  return (
    <span style={{
      padding: "2px 10px", borderRadius: "20px",
      background: config.bg, border: `1px solid ${config.border}`,
      color: config.renk, fontSize: "11px", fontWeight: "700",
      letterSpacing: "0.04em", textTransform: "uppercase",
    }}>
      {config.label}
    </span>
  )
}

// ─── Usage bar ────────────────────────────────────────────────────────────────

function KullarimBar({ used, limit }) {
  if (limit === 0) return (
    <div style={{ fontSize: "12px", color: "#10B981", fontWeight: "600" }}>Sınırsız analiz</div>
  )
  const pct = Math.min(100, (used / limit) * 100)
  const renk = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#10B981"

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Bu ay kullanım</span>
        <span style={{ fontSize: "12px", fontWeight: "700", color: renk }}>{used} / {limit}</span>
      </div>
      <div style={{ height: "6px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: renk, borderRadius: "3px", transition: "width 0.6s ease" }} />
      </div>
      {pct >= 80 && (
        <div style={{ fontSize: "11px", color: renk, marginTop: "5px", fontWeight: "600" }}>
          {pct >= 100
            ? "Aylık limit doldu — Pro plana geçin"
            : `Limitin %${Math.round(pct)}'ine ulaştınız`}
        </div>
      )}
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetrikKart({ baslik, deger, alt, renk = "#0EA5E9", ikon }) {
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "14px",
      border: "1px solid var(--input-border)",
      padding: "20px 22px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: "4px",
        height: "100%", background: renk, borderRadius: "0 14px 14px 0",
      }} />
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{ikon}</div>
      <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--heading)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {deger}
      </div>
      <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", marginTop: "4px", letterSpacing: "0.03em", textTransform: "uppercase" }}>
        {baslik}
      </div>
      {alt && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>{alt}</div>
      )}
    </div>
  )
}

// ─── Recent project row ───────────────────────────────────────────────────────

function ProjeRow({ proje, onAc }) {
  const tarih = new Date(proje.updated_at || proje.created_at).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric"
  })

  return (
    <div
      onClick={() => onAc(proje.id)}
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "12px 16px", borderRadius: "10px", cursor: "pointer",
        border: "1px solid var(--border-subtle)", background: "var(--bg-surface)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--accent)"
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(14,165,233,0.1)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border-subtle)"
        e.currentTarget.style.boxShadow = "none"
      }}
    >
      <div style={{
        width: "36px", height: "36px", borderRadius: "8px",
        background: "#E0F2FE", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "16px", flexShrink: 0,
      }}>📋</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {proje.proje_adi || "İsimsiz Proje"}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
          {proje.is_tipi} · Ø{proje.kazik_capi}mm · {proje.kazik_boyu}m · {proje.kazik_adedi} kazık
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tarih}</div>
        <div style={{
          fontSize: "11px", fontWeight: "600", marginTop: "2px",
          color: "#0369A1",
        }}>Düzenle →</div>
      </div>
    </div>
  )
}

// ─── Recent analysis row ──────────────────────────────────────────────────────

function AnalizRow({ analiz }) {
  const tarih = new Date(analiz.created_at).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric"
  })
  const riskRenk = {
    "Yüksek": "#EF4444",
    "Orta": "#F59E0B",
    "Düşük": "#10B981",
  }[analiz.risk_ozeti] || "#94A3B8"

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 14px", borderRadius: "8px",
      border: "1px solid var(--border-subtle)", background: "var(--bg-surface)",
    }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: riskRenk, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {analiz.ad || "İsimsiz Analiz"}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
          {analiz.tork_nominal ? `${analiz.tork_nominal} kNm` : "—"}
          {analiz.guven_seviyesi ? ` · Sınıf ${analiz.guven_seviyesi}` : ""}
        </div>
      </div>
      <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>{tarih}</span>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ username, onYeniAnaliz, onProjeAc }) {
  const [veri, setVeri] = useState(null)
  const [sonAnalizler, setSonAnalizler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const toast = useToast()

  useEffect(() => {
    const yukle = async () => {
      setYukleniyor(true)
      try {
        const [dashVeri, analizVeri] = await Promise.all([
          getDashboard(),
          getRecentAnalyses(5).catch(() => []),
        ])
        setVeri(dashVeri)
        setSonAnalizler(analizVeri)
      } catch (e) {
        toast.error("Dashboard yüklenemedi: " + e.message)
      } finally {
        setYukleniyor(false)
      }
    }
    yukle()
  }, [])

  const saat = new Date().getHours()
  const selamlama = saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar"

  if (yukleniyor) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: i === 1 ? "80px" : "160px", borderRadius: "14px",
          background: "var(--bg-card)", border: "1px solid var(--input-border)",
          animation: "shimmer 1.5s ease infinite",
          backgroundImage: "linear-gradient(90deg, var(--bg-card) 25%, var(--row-alt) 50%, var(--bg-card) 75%)",
          backgroundSize: "200% 100%",
        }} />
      ))}
    </div>
  )

  if (!veri) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Selamlama + CTA */}
      <div style={{
        background: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 60%, #0EA5E9 100%)",
        borderRadius: "16px", padding: "28px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 20px rgba(14,165,233,0.2)",
        flexWrap: "wrap", gap: "16px",
      }}>
        <div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>
            {selamlama}
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "white", fontFamily: "'Fraunces', serif" }}>
            {username}
          </div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>
            {veri.proje_sayisi} aktif proje · {veri.analiz_sayisi} kayıtlı analiz
          </div>
        </div>
        <button
          onClick={onYeniAnaliz}
          style={{
            padding: "12px 24px", background: "white",
            color: "#0369A1", border: "none", borderRadius: "10px",
            fontSize: "14px", fontWeight: "700", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          + Yeni Analiz Başlat
        </button>
      </div>

      {/* Metrik kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
        <MetrikKart
          ikon="📂" baslik="Aktif Proje" deger={veri.proje_sayisi}
          alt="kayıtlı proje" renk="#0EA5E9"
        />
        <MetrikKart
          ikon="📊" baslik="Kayıtlı Analiz" deger={veri.analiz_sayisi}
          alt="analiz snapshot" renk="#10B981"
        />
        <MetrikKart
          ikon="⚙️" baslik="Toplam Kazık" deger={veri.toplam_kazik.toLocaleString("tr-TR")}
          alt="planlanan kazık" renk="#8B5CF6"
        />
        <MetrikKart
          ikon="🕒" baslik="Son Güncelleme"
          deger={veri.son_aktivite
            ? new Date(veri.son_aktivite).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
            : "—"}
          alt="son aktivite" renk="#F59E0B"
        />
      </div>

      {/* Alt satır: Risk dağılımı + Plan + Son projeler */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* Risk dağılımı */}
        <div style={{
          background: "var(--bg-card)", borderRadius: "14px",
          border: "1px solid var(--input-border)", padding: "22px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "14px" }}>
            Risk Dağılımı (Kayıtlı Analizler)
          </div>
          <RiskBar dagilim={veri.risk_dagilim} />
        </div>

        {/* Plan & kullanım */}
        <div style={{
          background: "var(--bg-card)", borderRadius: "14px",
          border: "1px solid var(--input-border)", padding: "22px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Plan & Kullanım
            </div>
            <PlanBadge plan={veri.plan} />
          </div>
          <KullarimBar used={veri.analyses_used} limit={veri.analyses_limit} />

          {veri.plan === "free" && (
            <button style={{
              marginTop: "14px", width: "100%", padding: "10px",
              background: "linear-gradient(135deg, #0369A1, #0EA5E9)",
              color: "white", border: "none", borderRadius: "8px",
              fontSize: "13px", fontWeight: "700", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              Pro'ya Geç → Sınırsız Analiz
            </button>
          )}
        </div>
      </div>

      {/* Son projeler */}
      {veri.son_projeler.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "14px",
          border: "1px solid var(--input-border)", padding: "22px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Son Projeler
            </div>
            <span style={{ fontSize: "12px", color: "var(--accent)", cursor: "pointer", fontWeight: "600" }}
              onClick={() => onProjeAc && onProjeAc("onceki")}>
              Tümünü Gör →
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {veri.son_projeler.map(p => (
              <ProjeRow key={p.id} proje={p} onAc={id => onProjeAc && onProjeAc(id)} />
            ))}
          </div>
        </div>
      )}

      {/* Son analizler */}
      {sonAnalizler.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "14px",
          border: "1px solid var(--input-border)", padding: "22px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "14px" }}>
            Son Kaydedilen Analizler
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sonAnalizler.map(a => (
              <AnalizRow key={a.id} analiz={a} />
            ))}
          </div>
        </div>
      )}

      {/* Boş durum */}
      {veri.proje_sayisi === 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "14px",
          border: "2px dashed var(--border-subtle)", padding: "48px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏗️</div>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--heading)", marginBottom: "8px" }}>
            İlk Projenizi Oluşturun
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px", maxWidth: "360px", margin: "0 auto 24px" }}>
            Zemin verilerini girin, makineleri seçin ve dakikalar içinde profesyonel geoteknik analiz alın.
          </div>
          <button
            onClick={onYeniAnaliz}
            style={{
              padding: "12px 32px", background: "var(--accent)",
              color: "white", border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: "700", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Yeni Analiz Başlat
          </button>
        </div>
      )}
    </div>
  )
}
