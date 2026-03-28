import { useState, useEffect } from "react"
import AnalizSonucu from "./AnalizSonucu"
import MakinePark from "./MakinePark"
import ZeminLogu from "./ZeminLogu"
import ProjeForm from "./ProjeForm"
import {
  login, logout, getToken,
  listProjects, getProject,
  listEquipment,
  fromSnake, fromSnakeLayer, fromSnakeMakine,
} from "./api"

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

function LoginPage({ onLogin }) {
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
      background: "linear-gradient(135deg, #1B3A6B 0%, #2D5BA3 100%)"
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        padding: "48px 40px", width: "100%", maxWidth: "420px"
      }}>
        <div style={{textAlign: "center", marginBottom: "36px"}}>
          <div style={{marginBottom: "4px"}}>
            <span style={{color: "#1B3A6B", fontSize: "32px", fontWeight: "900"}}>Geo</span>
            <span style={{color: "#2D5BA3", fontSize: "32px", fontWeight: "900"}}>Drill</span>
          </div>
          <div style={{color: "#1B3A6B", fontSize: "11px", letterSpacing: "5px", fontWeight: "700"}}>
            — INSIGHT —
          </div>
          <p style={{color: "#94A3B8", fontSize: "13px", marginTop: "10px"}}>
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

        <p style={{color: "#CBD5E1", fontSize: "12px", textAlign: "center", marginTop: "24px"}}>
          Demo: <strong>demo</strong> / <strong>demo</strong>
        </p>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active, onNav }) {
  return (
    <div style={{width: "240px", minHeight: "100vh", background: "#1B3A6B", display: "flex", flexDirection: "column", flexShrink: 0}}>
      <div style={{padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)"}}>
        <div>
          <span style={{color: "white", fontSize: "20px", fontWeight: "900"}}>Geo</span>
          <span style={{color: "#93C5FD", fontSize: "20px", fontWeight: "900"}}>Drill</span>
        </div>
        <div style={{color: "rgba(255,255,255,0.5)", fontSize: "9px", letterSpacing: "4px", fontWeight: "600"}}>
          INSIGHT
        </div>
      </div>
      <nav style={{padding: "16px 12px", flex: 1}}>
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => onNav(item.id)} style={{
            width: "100%", display: "flex", alignItems: "center",
            gap: "10px", padding: "11px 14px",
            background: active === item.id ? "rgba(255,255,255,0.15)" : "transparent",
            border: "none", borderRadius: "8px",
            color: active === item.id ? "white" : "rgba(255,255,255,0.65)",
            fontSize: "14px", fontWeight: active === item.id ? "600" : "400",
            cursor: "pointer", marginBottom: "4px", textAlign: "left"
          }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ username, onLogout }) {
  return (
    <header style={{
      height: "60px", background: "white",
      borderBottom: "1px solid #E2E8F0",
      display: "flex", alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 28px", gap: "16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
    }}>
      <span style={{color: "#64748B", fontSize: "14px"}}>
        Hoş geldin, <strong style={{color: "#1B3A6B"}}>{username}</strong>
      </span>
      <button onClick={onLogout} style={{
        padding: "7px 16px", border: "1.5px solid #E2E8F0",
        borderRadius: "8px", background: "white",
        color: "#64748B", fontSize: "13px", cursor: "pointer"
      }}>
        Çıkış
      </button>
    </header>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ username, onLogout }) {
  const [activePage, setActivePage] = useState("proje")
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
        <Sidebar active={activePage} onNav={setActivePage} />
        <div style={{flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC"}}>
          <p style={{color: "#94A3B8", fontSize: "15px"}}>Veriler yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{display: "flex", minHeight: "100vh"}}>
      <Sidebar active={activePage} onNav={setActivePage} />
      <div style={{flex: 1, display: "flex", flexDirection: "column"}}>
        <Header username={username} onLogout={handleLogout} />
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
            <AnalizSonucu
              proje={proje}
              zemin={zemin}
              makineler={makineler}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(() => {
    // Token varsa otomatik oturumu sürdür
    if (!getToken()) return null
    return localStorage.getItem("gd_username") || null
  })

  const handleLogin = (username) => {
    localStorage.setItem("gd_username", username)
    setUser(username)
  }

  const handleLogout = () => {
    localStorage.removeItem("gd_username")
    setUser(null)
  }

  if (!user) return <LoginPage onLogin={handleLogin} />
  return <Dashboard username={user} onLogout={handleLogout} />
}
