import { useState, useEffect, useCallback, Component } from "react"
import AnalizSonucu from "./AnalizSonucu"
import MakinePark from "./MakinePark"
import ZeminLogu from "./ZeminLogu"
import ProjeForm from "./ProjeForm"
import LandingPage from "./LandingPage"
import RegisterPage from "./RegisterPage"
import { ToastProvider } from "./Toast"
import { DEMO_PROJE, DEMO_ZEMIN, DEMO_MAKINELER } from "./DemoProje"
import FiyatAnalizi from "./FiyatAnalizi"
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

function SkeletonBlock({ width = "100%", height = "16px", radius = "6px" }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, #E0F2FE 25%, #F0F9FF 50%, #E0F2FE 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s ease infinite",
    }} />
  )
}

function SkeletonLoader() {
  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>
      <div style={{ marginBottom: "24px" }}>
        <SkeletonBlock width="200px" height="24px" />
        <div style={{ marginTop: "8px" }}><SkeletonBlock width="300px" height="14px" /></div>
      </div>
      {[1, 2].map(i => (
        <div key={i} style={{
          background: "white", borderRadius: "12px", border: "1px solid #E2E8F0",
          padding: "24px", marginBottom: "20px",
        }}>
          <SkeletonBlock width="140px" height="18px" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "20px" }}>
            {[1,2,3,4].map(j => (
              <div key={j}>
                <SkeletonBlock width="80px" height="12px" />
                <div style={{ marginTop: "8px" }}><SkeletonBlock height="40px" radius="8px" /></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const NAV_ITEMS = [
  { id: "proje", label: "Proje Bilgileri", icon: "📋" },
  { id: "zemin", label: "Zemin Logu", icon: "🪨" },
  { id: "makine", label: "Makine Parkı", icon: "⚙️" },
  { id: "analiz", label: "Analiz Sonucu", icon: "📊" },
  { id: "fiyat", label: "Fiyat Analizi", icon: "💰" },
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
    border: "1.5px solid #BAE6FD",
    borderRadius: "8px", fontSize: "14px", outline: "none",
    boxSizing: "border-box",
    background: "white",
    color: "#0C4A6E",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #E0F2FE 0%, #F0F9FF 40%, #FFFFFF 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Hafif arka plan tonu */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        background: "white",
        border: "1px solid #E0F2FE",
        borderRadius: "16px",
        padding: "48px 44px", width: "100%", maxWidth: "400px",
        position: "relative",
        boxShadow: "0 8px 32px rgba(14,165,233,0.08)",
      }}>
        {onGoLanding && (
          <button onClick={onGoLanding} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#94A3B8", fontSize: "12px",
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
              {["#0369A1","#0EA5E9","#7DD3FC"].map((c, i) => (
                <div key={i} style={{ width: "6px", height: "6px", borderRadius: "1px", background: c }} />
              ))}
            </div>
            <div>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "26px", color: "#0C4A6E" }}>Geo</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "26px", color: "#0EA5E9" }}>Drill</span>
              <span style={{ color: "#94A3B8", fontSize: "9px", letterSpacing: "3px", marginLeft: "6px", verticalAlign: "middle" }}>INSIGHT</span>
            </div>
          </div>
          <p style={{ color: "#94A3B8", fontSize: "12px", letterSpacing: "0.03em" }}>
            Geoteknik Karar Destek Sistemi
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ color: "#64748B", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px", letterSpacing: "0.04em" }}>
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
            <label style={{ color: "#64748B", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px", letterSpacing: "0.04em" }}>
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
              background: "#FEF2F2", border: "1px solid #FECACA",
              color: "#DC2626", padding: "10px 14px", borderRadius: "8px", fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? "#BAE6FD" : "linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)",
            color: "white",
            border: "none", borderRadius: "8px",
            fontSize: "14px", fontWeight: "700",
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: "4px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "0.02em",
            transition: "background 0.2s",
            boxShadow: loading ? "none" : "0 4px 12px rgba(14,165,233,0.25)",
          }}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#94A3B8" }}>
          Hesabınız yok mu?{" "}
          <button onClick={onGoRegister} style={{
            background: "none", border: "none", color: "#0EA5E9",
            fontWeight: "600", cursor: "pointer", fontSize: "13px", padding: 0,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Kayıt Ol
          </button>
        </p>

        <p style={{ color: "#94A3B8", fontSize: "11px", textAlign: "center", marginTop: "16px", fontFamily: "'DM Mono', monospace" }}>
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
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.3)", display: "none" }}
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
              {["#0369A1","#0EA5E9","#7DD3FC"].map((c, i) => (
                <div key={i} style={{ width: "5px", height: "5px", borderRadius: "1px", background: c }} />
              ))}
            </div>
            <div>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "17px", color: "var(--text-primary)" }}>Geo</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "17px", color: "var(--accent)" }}>Drill</span>
              <div style={{ color: "var(--text-muted)", fontSize: "8px", letterSpacing: "3px", fontWeight: "600", marginTop: "1px" }}>INSIGHT</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Menüyü kapat"
            style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "18px", cursor: "pointer", display: "none" }}
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
                background: active === item.id ? "var(--bg-card-hover)" : "transparent",
                border: active === item.id ? "1px solid var(--border-medium)" : "1px solid transparent",
                borderLeft: active === item.id ? "3px solid var(--accent)" : "3px solid transparent",
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

function DarkModeToggle({ dark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      style={{
        width: "36px", height: "20px", borderRadius: "10px",
        border: "none", cursor: "pointer", position: "relative",
        background: dark ? "#475569" : "#E0F2FE",
        transition: "background 0.25s ease",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: "2px",
        left: dark ? "18px" : "2px",
        width: "16px", height: "16px", borderRadius: "50%",
        background: dark ? "#38BDF8" : "#0EA5E9",
        transition: "left 0.25s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "9px",
      }}>
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  )
}

function Header({ username, onLogout, onMenuOpen, dark, onToggleDark }) {
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
      <DarkModeToggle dark={dark} onToggle={onToggleDark} />
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

function WelcomeModal({ onDemoYukle, onKapat }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "white", borderRadius: "20px", width: "100%", maxWidth: "480px", padding: "40px 40px 32px", boxShadow: "0 32px 80px rgba(14,165,233,0.18)", animation: "fadeUp 0.3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ marginBottom: "6px" }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "28px", color: "#0C4A6E" }}>Geo</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "28px", color: "#0EA5E9" }}>Drill</span>
          </div>
          <div style={{ color: "#0369A1", fontSize: "9px", letterSpacing: "5px", fontWeight: "700", marginBottom: "16px" }}>— INSIGHT —</div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0C4A6E", marginBottom: "10px" }}>Hoş geldiniz!</h2>
          <p style={{ fontSize: "14px", color: "#64748B", lineHeight: "1.7" }}>
            Hızlı başlamak için gerçek bir saha verisini temel alan demo projeyi yükleyebilirsiniz. İstediğiniz zaman düzenleyebilirsiniz.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={onDemoYukle} style={{ padding: "13px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Demo Proje Yükle
          </button>
          <button onClick={onKapat} style={{ padding: "12px", border: "1.5px solid #E2E8F0", borderRadius: "10px", background: "white", color: "#475569", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Boş Başla
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px" }}>
          Demo proje İstanbul / Kadıköy Metro temel kazıkları verisini kullanır
        </p>
      </div>
    </div>
  )
}

function Dashboard({ username, onLogout }) {
  const [activePage, setActivePage] = useState("proje")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projeId, setProjeId] = useState(null)
  const [proje, setProje] = useState(BOS_PROJE)
  const [zemin, setZemin] = useState([])
  const [makineler, setMakineler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [welcomeModal, setWelcomeModal] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem("gd_theme") === "dark")

  const toggleDark = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light")
      localStorage.setItem("gd_theme", next ? "dark" : "light")
      return next
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light")
  }, [dark])

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
        } else {
          // İlk kez giriş — welcome modal göster
          const daha_once = localStorage.getItem("gd_welcomed")
          if (!daha_once) setWelcomeModal(true)
        }

        if (ekipmanlar.length > 0) {
          setMakineler(ekipmanlar.map(fromSnakeMakine))
        }
      } catch {
        // İlk açılışta hata olursa boş başla
        const daha_once = localStorage.getItem("gd_welcomed")
        if (!daha_once) setWelcomeModal(true)
      } finally {
        setYukleniyor(false)
      }
    }
    yukle()
  }, [])

  const handleProjeChange = (key, value) => {
    setProje(prev => ({...prev, [key]: value}))
  }

  const handleDemoYukle = () => {
    setProje(DEMO_PROJE)
    setZemin(DEMO_ZEMIN)
    setMakineler(DEMO_MAKINELER)
    setProjeId(null)
    localStorage.setItem("gd_welcomed", "1")
    setWelcomeModal(false)
  }

  const handleWelcomeKapat = () => {
    localStorage.setItem("gd_welcomed", "1")
    setWelcomeModal(false)
  }

  const handleLogout = () => {
    logout()
    onLogout()
  }

  if (yukleniyor) {
    return (
      <div style={{display: "flex", minHeight: "100vh"}}>
        <Sidebar active={activePage} onNav={setActivePage} open={false} onClose={() => {}} />
        <div style={{flex: 1, display: "flex", flexDirection: "column", minWidth: 0}}>
          <Header username={username} onLogout={handleLogout} onMenuOpen={() => {}} dark={dark} onToggleDark={toggleDark} />
          <main style={{flex: 1, padding: "32px 28px", background: "var(--bg-base)"}}>
            <SkeletonLoader />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div style={{display: "flex", minHeight: "100vh"}}>
      {welcomeModal && <WelcomeModal onDemoYukle={handleDemoYukle} onKapat={handleWelcomeKapat} />}
      <Sidebar active={activePage} onNav={setActivePage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{flex: 1, display: "flex", flexDirection: "column", minWidth: 0}}>
        <Header username={username} onLogout={handleLogout} onMenuOpen={() => setSidebarOpen(true)} dark={dark} onToggleDark={toggleDark} />
        <main style={{flex: 1, padding: "32px 28px", background: "var(--bg-base)", overflowY: "auto"}}>
          <div key={activePage} style={{ animation: "fadeUp 0.3s ease" }}>
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
            {activePage === "fiyat" && (
              <ErrorBoundary>
                <FiyatAnalizi proje={proje} zemin={zemin} />
              </ErrorBoundary>
            )}
          </div>
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

  if (user) return <ToastProvider><Dashboard username={user} onLogout={handleLogout} /></ToastProvider>

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
