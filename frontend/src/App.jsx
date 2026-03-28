import AnalizSonucu from "./AnalizSonucu"
import MakinePark from "./MakinePark"
import ZeminLogu from "./ZeminLogu"
import ProjeForm from "./ProjeForm"
import { useState } from "react"

const USERS = {
  "firma1": "1234",
  "admin": "admin123",
  "demo": "demo"
}

const NAV_ITEMS = [
  { id: "proje", label: "Proje Bilgileri", icon: "📋" },
  { id: "zemin", label: "Zemin Logu", icon: "🪨" },
  { id: "makine", label: "Makine Parkı", icon: "⚙️" },
  { id: "analiz", label: "Analiz Sonucu", icon: "📊" },
]

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = () => {
    if (USERS[username] === password) {
      onLogin(username)
    } else {
      setError("Kullanıcı adı veya şifre hatalı.")
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

          <button onClick={handleLogin} style={{
            width: "100%", padding: "13px",
            background: "linear-gradient(135deg, #1B3A6B 0%, #2D5BA3 100%)",
            color: "white", border: "none", borderRadius: "8px",
            fontSize: "15px", fontWeight: "600", cursor: "pointer", marginTop: "4px"
          }}>
            Giriş Yap
          </button>
        </div>

        <p style={{color: "#CBD5E1", fontSize: "12px", textAlign: "center", marginTop: "24px"}}>
          Demo: <strong>demo</strong> / <strong>demo</strong>
        </p>
      </div>
    </div>
  )
}

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

function PlaceholderPage({ title, desc }) {
  return (
    <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center"}}>
      <div style={{fontSize: "48px", marginBottom: "16px"}}>🚧</div>
      <h2 style={{color: "#1B3A6B", fontSize: "20px", fontWeight: "700", marginBottom: "8px"}}>{title}</h2>
      <p style={{color: "#94A3B8", fontSize: "14px"}}>{desc}</p>
    </div>
  )
}

function Dashboard({ username, onLogout }) {
  const [activePage, setActivePage] = useState("proje")

  const [proje, setProje] = useState({
    projeAdi: "", projeKodu: "", sahaKodu: "",
    lokasyon: "İstanbul", isTipi: "Fore Kazık",
    kazikBoyu: 18, kazikCapi: 800, kazikAdedi: 30,
    yeraltiSuyu: 4, projeNotu: "", teklifNotu: ""
  })

  const [zemin, setZemin] = useState([])
  const [makineler, setMakineler] = useState([])

  const handleProjeChange = (key, value) => {
    setProje(prev => ({...prev, [key]: value}))
  }

  return (
    <div style={{display: "flex", minHeight: "100vh"}}>
      <Sidebar active={activePage} onNav={setActivePage} />
      <div style={{flex: 1, display: "flex", flexDirection: "column"}}>
        <Header username={username} onLogout={onLogout} />
        <main style={{flex: 1, padding: "32px 28px", background: "#F8FAFC", overflowY: "auto"}}>
          {activePage === "proje" && (
            <ProjeForm data={proje} onChange={handleProjeChange} />
          )}
          {activePage === "zemin" && (
            <ZeminLogu
              data={zemin}
              onChange={setZemin}
              yeraltiSuyu={proje.yeraltiSuyu}
            />
          )}
          {activePage === "makine" && (
            <MakinePark data={makineler} onChange={setMakineler} />
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

export default function App() {
  const [user, setUser] = useState(null)
  if (!user) return <LoginPage onLogin={setUser} />
  return <Dashboard username={user} onLogout={() => setUser(null)} />
}