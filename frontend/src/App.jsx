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

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #0F2447 0%, #1B3A6B 45%, #2D5BA3 100%)"
    }}>
      <div style={{
        background: "white", borderRadius: "20px",
        boxShadow: "0 24px 72px rgba(0,0,0,0.25)",
        padding: "48px 44px", width: "100%", maxWidth: "420px"
      }}>
        <div style={{textAlign: "center", marginBottom: "36px"}}>
          {onGoLanding && (
            <button onClick={onGoLanding} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#94A3B8", fontSize: "13px", marginBottom: "16px",
              display: "flex", alignItems: "center", gap: "4px", margin: "0 auto 16px"
            }}>
              ← Ana Sayfa
            </button>
          )}
          <div style={{marginBottom: "4px"}}>
            <span style={{color: "#1B3A6B", fontSize: "32px", fontWeight: "900"}}>Geo</span>
            <span style={{color: "#2D5BA3", fontSize: "32px", fontWeight: "900"}}>Drill</span>
          </div>
          <div style={{color: "#1B3A6B", fontSize: "11px", letterSpacing: "5px", fontWeight: "700"}}>
            — INSIGHT —
          </div>
          <p style={{color: "#94A3B8", fontSize: "13px", marginTop: "10px", marginBottom: 0}}>
            Geoteknik Karar Destek Sistemi
          </p>
        </div>

        <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
          <div>
            <label style={{color: "#374151", fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "6px"}}>
              Kullanıcı Adı
            </label>
            <input type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="kullanici_adi"
              style={{width: "100%", padding: "11px 14px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box"}}
            />
          </div>
          <div>
            <label style={{color: "#374151", fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "6px"}}>
              Şifre
            </label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              style={{width: "100%", padding: "11px 14px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box"}}
            />
          </div>

          {error && (
            <div style={{background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: "8px", fontSize: "13px"}}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? "#94A3B8" : "linear-gradient(135deg, #1B3A6B 0%, #2D5BA3 100%)",
            color: "white", border: "none", borderRadius: "8px",
            fontSize: "15px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", marginTop: "4px"
          }}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </div>

        <p style={{textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#64748B"}}>
          Hesabınız yok mu?{" "}
          <button onClick={onGoRegister} style={{
            background: "none", border: "none", color: "#2D5BA3",
            fontWeight: "600", cursor: "pointer", fontSize: "14px", padding: 0
          }}>
            Kayıt Ol
          </button>
        </p>

        <p style={{color: "#CBD5E1", fontSize: "12px", textAlign: "center", marginTop: "12px"}}>
          Demo: <strong>demo</strong> / <strong>demo</strong>
        </p>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active, onNav, open, onClose }) {
  return (
    <>
      {/* Mobil overlay */}
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "rgba(0,0,0,0.45)",
            display: "none"
          }}
          className="sidebar-overlay"
        />
      )}
      <div
        role="navigation"
        aria-label="Ana menü"
        style={{
          width: "240px", minHeight: "100vh",
          background: "#1B3A6B", display: "flex",
          flexDirection: "column", flexShrink: 0,
          position: "relative", zIndex: 50
        }}
        className={`sidebar${open ? " sidebar-open" : ""}`}
      >
        <div style={{padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <div>
            <span style={{color: "white", fontSize: "20px", fontWeight: "900"}}>Geo</span>
            <span style={{color: "#93C5FD", fontSize: "20px", fontWeight: "900"}}>Drill</span>
            <div style={{color: "rgba(255,255,255,0.5)", fontSize: "9px", letterSpacing: "4px", fontWeight: "600"}}>INSIGHT</div>
          </div>
          {/* Mobil kapat butonu */}
          <button
            onClick={onClose}
            aria-label="Menüyü kapat"
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.6)",
              fontSize: "20px", cursor: "pointer", lineHeight: 1,
              display: "none"
            }}
            className="sidebar-close-btn"
          >✕</button>
        </div>
        <nav style={{padding: "16px 12px", flex: 1}}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); onClose() }}
              aria-current={active === item.id ? "page" : undefined}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: "10px", padding: "11px 14px",
                background: active === item.id ? "rgba(255,255,255,0.15)" : "transparent",
                border: "none", borderRadius: "8px",
                color: active === item.id ? "white" : "rgba(255,255,255,0.65)",
                fontSize: "14px", fontWeight: active === item.id ? "600" : "400",
                cursor: "pointer", marginBottom: "4px", textAlign: "left"
              }}
            >
              <span aria-hidden="true">{item.icon}</span>
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
      height: "60px", background: "white",
      borderBottom: "1px solid #E2E8F0",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px", gap: "16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
    }}>
      {/* Mobil hamburger */}
      <button
        onClick={onMenuOpen}
        aria-label="Menüyü aç"
        aria-expanded="false"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#1B3A6B", fontSize: "22px", lineHeight: 1,
          padding: "4px", display: "none"
        }}
        className="hamburger-btn"
      >
        ☰
      </button>

      <span style={{color: "#64748B", fontSize: "14px", marginLeft: "auto"}}>
        Hoş geldin, <strong style={{color: "#1B3A6B"}}>{username}</strong>
      </span>
      <button
        onClick={onLogout}
        aria-label="Oturumu kapat"
        style={{
          padding: "7px 16px", border: "1.5px solid #E2E8F0",
          borderRadius: "8px", background: "white",
          color: "#64748B", fontSize: "13px", cursor: "pointer"
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
        <div style={{flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC"}}>
          <p style={{color: "#94A3B8", fontSize: "15px"}}>Veriler yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{display: "flex", minHeight: "100vh"}}>
      <Sidebar active={activePage} onNav={setActivePage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{flex: 1, display: "flex", flexDirection: "column", minWidth: 0}}>
        <Header username={username} onLogout={handleLogout} onMenuOpen={() => setSidebarOpen(true)} />
        <main style={{flex: 1, padding: "32px 28px", background: "#F8FAFC", overflowY: "auto"}}>
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
