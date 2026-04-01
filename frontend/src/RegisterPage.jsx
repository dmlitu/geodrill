import { useState } from "react"
import { register, login } from "./api"

export default function RegisterPage({ onLogin, onGoLogin }) {
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", password2: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async () => {
    const { fullName, username, email, password, password2 } = form
    if (!username || !email || !password) { setError("Tüm zorunlu alanları doldurun."); return }
    if (password !== password2) { setError("Şifreler eşleşmiyor."); return }
    if (password.length < 8) { setError("Şifre en az 8 karakter olmalı."); return }

    setLoading(true)
    setError("")
    try {
      await register(username, email, fullName, password)
      await login(username, password)
      onLogin(username)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "linear-gradient(160deg, #E0F2FE 0%, #BAE6FD 45%, #7DD3FC 100%)"
    }}>
      {/* Sağ / Orta — form */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "40px 24px"
      }}>
        <div style={{
          background: "white", borderRadius: "20px",
          boxShadow: "0 24px 72px rgba(14,165,233,0.12)",
          padding: "48px 44px", width: "100%", maxWidth: "460px"
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#0C4A6E", fontSize: "30px", fontWeight: "900" }}>Geo</span>
              <span style={{ color: "#0EA5E9", fontSize: "30px", fontWeight: "900" }}>Drill</span>
            </div>
            <div style={{ color: "#0369A1", fontSize: "10px", letterSpacing: "5px", fontWeight: "700" }}>
              — INSIGHT —
            </div>
            <p style={{ color: "#94A3B8", fontSize: "14px", marginTop: "10px", marginBottom: 0 }}>
              Yeni hesap oluşturun
            </p>
          </div>

          {/* Alanlar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Field label="Ad Soyad" placeholder="Ahmet Yılmaz"
              value={form.fullName} onChange={set("fullName")} />

            <Field label="Kullanıcı Adı *" placeholder="kullanici_adi"
              value={form.username} onChange={set("username")} />

            <Field label="E-posta *" type="email" placeholder="ornek@firma.com"
              value={form.email} onChange={set("email")} />

            <Field label="Şifre *" type="password" placeholder="••••••••"
              value={form.password} onChange={set("password")} />

            <Field label="Şifre Tekrar *" type="password" placeholder="••••••••"
              value={form.password2} onChange={set("password2")}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>

          {error && (
            <div style={{
              marginTop: "14px",
              background: "#FEF2F2", border: "1px solid #FECACA",
              color: "#DC2626", padding: "10px 14px",
              borderRadius: "8px", fontSize: "13px"
            }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", padding: "13px", marginTop: "20px",
            border: "none", borderRadius: "8px",
            background: loading ? "#BAE6FD" : "linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)",
            color: "white", fontSize: "15px", fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer"
          }}>
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#64748B" }}>
            Zaten hesabınız var mı?{" "}
            <button onClick={onGoLogin} style={{
              background: "none", border: "none", color: "#0EA5E9",
              fontWeight: "600", cursor: "pointer", fontSize: "14px", padding: 0
            }}>
              Giriş Yap
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, type = "text", placeholder, value, onChange, onKeyDown }) {
  return (
    <div>
      <label style={{
        color: "#374151", fontSize: "13px", fontWeight: "600",
        display: "block", marginBottom: "6px"
      }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          width: "100%", padding: "10px 14px",
          border: "1.5px solid #E2E8F0", borderRadius: "8px",
          fontSize: "14px", outline: "none", boxSizing: "border-box"
        }}
      />
    </div>
  )
}
