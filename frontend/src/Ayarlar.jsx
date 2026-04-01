import { useState } from "react"
import { useToast } from "./Toast"

const cardStyle = {
  background: "var(--bg-card)", borderRadius: "12px",
  border: "1px solid var(--input-border)", padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px"
}

const inputStyle = {
  width: "100%", padding: "10px 14px",
  border: "1.5px solid var(--input-border)", borderRadius: "8px",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
  color: "var(--input-text)", background: "var(--input-bg)",
  fontFamily: "'Plus Jakarta Sans', sans-serif"
}

export default function Ayarlar({ username, dark, onToggleDark }) {
  const [firmaBilgisi, setFirmaBilgisi] = useState({
    firmaAdi: localStorage.getItem("gd_firma_adi") || "",
    firmaUnvan: localStorage.getItem("gd_firma_unvan") || "",
    telefon: localStorage.getItem("gd_telefon") || "",
    adres: localStorage.getItem("gd_adres") || "",
  })
  const toast = useToast()

  const set = (key) => (e) => setFirmaBilgisi(p => ({ ...p, [key]: e.target.value }))

  const kaydet = () => {
    Object.entries(firmaBilgisi).forEach(([k, v]) => localStorage.setItem(`gd_${k.replace(/([A-Z])/g, '_$1').toLowerCase()}`, v))
    localStorage.setItem("gd_firma_adi", firmaBilgisi.firmaAdi)
    localStorage.setItem("gd_firma_unvan", firmaBilgisi.firmaUnvan)
    localStorage.setItem("gd_telefon", firmaBilgisi.telefon)
    localStorage.setItem("gd_adres", firmaBilgisi.adres)
    toast.success("Ayarlar kaydedildi.")
  }

  const PLAN_OZELLIKLERI = [
    { plan: "Free", renk: "#64748B", bg: "#F8FAFC", ozellikler: ["5 analiz hakkı", "Demo verisi", "Export yok"] },
    { plan: "Pro", renk: "#0284C7", bg: "#F0F9FF", ozellikler: ["Sınırsız analiz", "PDF & Excel export", "Fiyat analizi", "Proje arşivi"] },
    { plan: "Enterprise", renk: "#7C3AED", bg: "#F5F3FF", ozellikler: ["Firma dashboard", "Sınırsız analiz", "Proje arşivi", "Ekip kullanımı", "Öncelikli destek"] },
  ]

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>Ayarlar</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>Hesap ve firma bilgilerinizi yönetin</p>
      </div>

      {/* Hesap bilgisi */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          Hesap Bilgileri
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "20px", fontWeight: "700" }}>
            {(username || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{username}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Pro Plan · GeoDrill Insight</div>
          </div>
        </div>
      </div>

      {/* Firma bilgileri */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          Firma Bilgileri
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[
            { key: "firmaAdi", label: "Firma Adı", placeholder: "Örnek Sondaj A.Ş." },
            { key: "firmaUnvan", label: "Unvan / Pozisyon", placeholder: "Geoteknik Mühendisi" },
            { key: "telefon", label: "Telefon", placeholder: "+90 212 xxx xx xx" },
            { key: "adres", label: "Adres / Lokasyon", placeholder: "İstanbul, Türkiye" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</label>
              <input style={inputStyle} placeholder={placeholder} value={firmaBilgisi[key]} onChange={set(key)} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: "16px" }}>
          <button onClick={kaydet} style={{ padding: "10px 24px", border: "none", borderRadius: "8px", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            Kaydet
          </button>
        </div>
      </div>

      {/* Görünüm */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          Görünüm
        </h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Karanlık Mod</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Koyu renk temasını kullan</div>
          </div>
          <button
            onClick={onToggleDark}
            style={{
              width: "48px", height: "26px", borderRadius: "13px", border: "none",
              background: dark ? "#0EA5E9" : "#CBD5E1",
              cursor: "pointer", position: "relative", transition: "background 0.2s"
            }}
          >
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%", background: "white",
              position: "absolute", top: "3px", transition: "left 0.2s",
              left: dark ? "25px" : "3px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
            }} />
          </button>
        </div>
      </div>

      {/* Plan */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          Abonelik Planı
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          {PLAN_OZELLIKLERI.map(({ plan, renk, bg, ozellikler }) => (
            <div key={plan} style={{ background: bg, border: `1.5px solid ${renk}30`, borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", color: renk, marginBottom: "10px" }}>{plan}</div>
              {ozellikler.map(o => (
                <div key={o} style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "3px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: renk, fontSize: "10px" }}>✓</span> {o}
                </div>
              ))}
              {plan === "Pro" && (
                <div style={{ marginTop: "10px", padding: "5px 10px", background: renk, color: "white", borderRadius: "6px", fontSize: "11px", fontWeight: "700", textAlign: "center" }}>Aktif Plan</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
