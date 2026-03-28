import { useState, useEffect, Component } from "react"
import AnalizSonucu from "./AnalizSonucu"
import MakinePark from "./MakinePark"
import ZeminLogu from "./ZeminLogu"
import ProjeForm from "./ProjeForm"
import LandingPage from "./LandingPage"
import RegisterPage from "./RegisterPage"
import {
  login, logout, getToken,
  listProjects, getProject,
  listEquipment,
  fromSnake, fromSnakeLayer, fromSnakeMakine,
} from "./api"

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hata: null } }
  static getDerivedStateFromError(err) { return { hata: err.message || "Bilinmeyen hata" } }
  render() {
    if (this.state.hata) return (
      <div style={{
        background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: "12px",
        padding: "32px", color: "#DC2626", fontSize: "14px"
      }}>
        <strong>Analiz hesaplanırken bir hata oluştu:</strong>
        <pre style={{ marginTop: "8px", fontSize: "12px", whiteSpace: "pre-wrap" }}>{this.state.hata}</pre>
        <button onClick={() => this.setState({ hata: null })} style={{
          marginTop: "16px", padding: "8px 18px", border: "none",
          borderRadius: "8px", background: "#DC2626", color: "white",
          fontSize: "13px", fontWeight: "600", cursor: "pointer"
        }}>Tekrar Dene</button>
      </div>
    )
    return this.props.children
  }
}

const NAV_ITEMS = [
  { id: "proje", label: "Proje Bilgileri", icon: "📋" },
  { id: "zemin", label: "Zemin Logu", icon: "🪨" },
  { id: "makine", label: "Makine Parkı", icon: "⚙️" },
  { id: "analiz", label: "Analiz Sonucu", icon: "📊" },
]

const BOS_PROJE = {
  projeAdi: "", projeKodu: "", sahaKodu: "",
  lokasyon: "İstanbul", isTipi: "Fore Kazık",
  kazikBoyu: 18, kazikCapi: 800, kazikAdedi: 30,
  yeraltiSuyu: 4, projeNotu: "", teklifNotu: ""
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

function LoginPage({ onLogin, onGoRegister, onGoLanding }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) { setError("Kullanıcı adı ve şifre gerekli."); return }
    setLoading(true)
    setError("")
    try {
      await login(username, password)
      onLogin(username)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width: "100%", padding: "11px 14px",
    border: "1px solid var(--border-medium)",
    borderRadius: "6px", fontSize: "14px", outline: "none",
    boxSizing: "border-box",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Hafif arka plan tonu */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(ellipse, rgba(201,138,44,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        padding: "48px 44px", width: "100%", maxWidth: "400px",
        position: "relative",
      }}>
        {onGoLanding && (
          <button onClick={onGoLanding} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "12px",
            display: "flex", alignItems: "center", gap: "4px",
            marginBottom: "28px", fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "0.02em",
          }}>
            ← Ana Sayfa
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {["#6B3D1C","#6A7870","#242C2A"].map((c, i) => (
                <div key={i} style={{ width: "6px", height: "6px", borderRadius: "1px", background: c }} />
              ))}
            </div>
            <div>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "26px", color: "var(--text-primary)" }}>Geo</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "26px", color: "var(--amber)" }}>Drill</span>
              <span style={{ color: "var(--text-muted)", fontSize: "9px", letterSpacing: "3px", marginLeft: "6px", verticalAlign: "middle" }}>INSIGHT</span>
            </div>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", letterSpacing: "0.03em" }}>
            Geoteknik Karar Destek Sistemi
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px", letterSpacing: "0.04em" }}>
              KULLANICI ADI
            </label>
            <input type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="kullanici_adi"
              style={inp}
            />
          </div>
          <div>
            <label style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px", letterSpacing: "0.04em" }}>
              ŞİFRE
            </label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              style={inp}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)",
              color: "#F87171", padding: "10px 14px", borderRadius: "6px", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? "var(--border-medium)" : "var(--amber)",
            color: loading ? "var(--text-muted)" : "#0A0806",
            border: "none", borderRadius: "6px",
            fontSize: "14px", fontWeight: "700",
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: "4px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "0.02em",
            transition: "background 0.2s",
          }}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--text-muted)" }}>
          Hesabınız yok mu?{" "}
          <button onClick={onGoRegister} style={{
            background: "none", border: "none", color: "var(--amber)",
            fontWeight: "600", cursor: "pointer", fontSize: "13px", padding: 0,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Kayıt Ol
          </button>
        </p>

        <p style={{ color: "var(--text-muted)", fontSize: "11px", textAlign: "center", marginTop: "16px", fontFamily: "'DM Mono', monospace" }}>
          demo / demo
        </p>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active, onNav, open, onClose }) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)", display: "none" }}
          className="sidebar-overlay"
        />
      )}
      <div
        role="navigation"
        aria-label="Ana menü"
        style={{
          width: "220px", minHeight: "100vh",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column", flexShrink: 0,
          position: "relative", zIndex: 50,
        }}
        className={`sidebar${open ? " sidebar-open" : ""}`}
      >
        {/* Logo */}
        <div style={{
          padding: "20px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {["#6B3D1C","#6A7870","#242C2A"].map((c, i) => (
                <div key={i} style={{ width: "5px", height: "5px", borderRadius: "1px", background: c }} />
              ))}
            </div>
            <div>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "17px", color: "var(--text-primary)" }}>Geo</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "17px", color: "var(--amber)" }}>Drill</span>
              <div style={{ color: "var(--text-muted)", fontSize: "8px", letterSpacing: "3px", fontWeight: "600", marginTop: "1px" }}>INSIGHT</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Menüyü kapat"
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer", display: "none" }}
            className="sidebar-close-btn"
          >✕</button>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); onClose() }}
              aria-current={active === item.id ? "page" : undefined}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: "10px", padding: "10px 12px",
                background: active === item.id ? "var(--bg-card)" : "transparent",
                border: active === item.id ? "1px solid var(--border-subtle)" : "1px solid transparent",
                borderLeft: active === item.id ? "3px solid var(--amber)" : "3px solid transparent",
                borderRadius: "6px",
                color: active === item.id ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: active === item.id ? "600" : "400",
                cursor: "pointer", marginBottom: "4px", textAlign: "left",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "14px" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ username, onLogout, onMenuOpen }) {
  return (
    <header style={{
      height: "54px",
      background: "var(--bg-surface)",
      borderBottom: "1px solid var(--border-subtle)",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px", gap: "16px",
    }}>
      <button
        onClick={onMenuOpen}
        aria-label="Menüyü aç"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-secondary)", fontSize: "20px", lineHeight: 1,
          padding: "4px", display: "none",
        }}
        className="hamburger-btn"
      >
        ☰
      </button>

      <span style={{ color: "var(--text-muted)", fontSize: "13px", marginLeft: "auto" }}>
        <span style={{ color: "var(--text-secondary)" }}>{username}</span>
      </span>
      <button
        onClick={onLogout}
        aria-label="Oturumu kapat"
        style={{
          padding: "6px 14px",
          border: "1px solid var(--border-medium)",
          borderRadius: "6px",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: "12px", cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: "600", letterSpacing: "0.02em",
          transition: "color 0.15s, border-color 0.15s",
        }}
      >
        Çıkış
      </button>
    </header>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ username, onLogout }) {
  const [activePage, setActivePage] = useState("proje")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projeId, setProjeId] = useState(null)
  const [proje, setProje] = useState(BOS_PROJE)
  const [zemin, setZemin] = useState([])
  const [makineler, setMakineler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  // Giriş sonrası veri yükleme
  useEffect(() => {
    async function yukle() {
      try {
        const [projeler, ekipmanlar] = await Promise.all([
          listProjects(),
          listEquipment(),
        ])

        if (projeler.length > 0) {
          // En son güncellenen projeyi yükle (API zaten desc döndürüyor)
          const sonPraje = await getProject(projeler[0].id)
          setProjeId(sonPraje.id)
          setProje(fromSnake(sonPraje))
          setZemin((sonPraje.soil_layers || []).map(fromSnakeLayer))
        }

        if (ekipmanlar.length > 0) {
          setMakineler(ekipmanlar.map(fromSnakeMakine))
        }
      } catch {
        // İlk açılışta hata olursa boş başla
      } finally {
        setYukleniyor(false)
      }
    }
    yukle()
  }, [])

  const handleProjeChange = (key, value) => {
    setProje(prev => ({...prev, [key]: value}))
  }

  const handleLogout = () => {
    logout()
    onLogout()
  }

  if (yukleniyor) {
    return (
      <div style={{display: "flex", minHeight: "100vh"}}>
        <Sidebar active={activePage} onNav={setActivePage} open={false} onClose={() => {}} />
        <div style={{flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)"}}>
          <p style={{color: "var(--text-muted)", fontSize: "14px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em"}}>yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{display: "flex", minHeight: "100vh"}}>
      <Sidebar active={activePage} onNav={setActivePage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{flex: 1, display: "flex", flexDirection: "column", minWidth: 0}}>
        <Header username={username} onLogout={handleLogout} onMenuOpen={() => setSidebarOpen(true)} />
        <main style={{flex: 1, padding: "32px 28px", background: "var(--bg-base)", overflowY: "auto"}}>
          {activePage === "proje" && (
            <ProjeForm
              data={proje}
              onChange={handleProjeChange}
              projeId={projeId}
              onProjeIdChange={setProjeId}
            />
          )}
          {activePage === "zemin" && (
            <ZeminLogu
              data={zemin}
              onChange={setZemin}
              yeraltiSuyu={proje.yeraltiSuyu}
              kazikBoyu={proje.kazikBoyu}
              projeId={projeId}
            />
          )}
          {activePage === "makine" && (
            <MakinePark
              data={makineler}
              onChange={setMakineler}
            />
          )}
          {activePage === "analiz" && (
            <ErrorBoundary>
              <AnalizSonucu
                proje={proje}
                zemin={zemin}
                makineler={makineler}
                projeId={projeId}
              />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(() => {
    if (!getToken()) return null
    return localStorage.getItem("gd_username") || null
  })
  // "landing" | "login" | "register"
  const [authPage, setAuthPage] = useState("landing")

  const handleLogin = (username) => {
    localStorage.setItem("gd_username", username)
    setUser(username)
  }

  const handleLogout = () => {
    localStorage.removeItem("gd_username")
    setUser(null)
    setAuthPage("landing")
  }

  if (user) return <Dashboard username={user} onLogout={handleLogout} />

  if (authPage === "register")
    return (
      <RegisterPage
        onLogin={handleLogin}
        onGoLogin={() => setAuthPage("login")}
      />
    )

  if (authPage === "login")
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoRegister={() => setAuthPage("register")}
        onGoLanding={() => setAuthPage("landing")}
      />
    )

  return (
    <LandingPage
      onGoLogin={() => setAuthPage("login")}
      onGoRegister={() => setAuthPage("register")}
    />
  )
}
