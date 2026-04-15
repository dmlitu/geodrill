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
import ProjeKalibrasyonu from "./ProjeKalibrasyonu"
import OncekiAnalizler from "./OncekiAnalizler"
import Ayarlar from "./Ayarlar"
import DashboardPage from "./Dashboard"
import OnboardingWizard from "./Onboarding"
import { downloadExcelReport } from "./api"
import {
  login, logout, getToken,
  listProjects, getProject,
  listEquipment,
  fromSnake, fromSnakeLayer, fromSnakeMakine,
  setOnUnauthorized,
} from "./api"
import { LangProvider, useLang } from "./LangContext"

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundaryInner extends Component {
  constructor(props) { super(props); this.state = { hata: null } }
  static getDerivedStateFromError(err) { return { hata: err.message || "Bilinmeyen hata" } }
  render() {
    if (this.state.hata) return (
      <div style={{
        background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: "12px",
        padding: "32px", color: "#DC2626", fontSize: "14px"
      }}>
        <strong>{this.props.errorTitle}</strong>
        <pre style={{ marginTop: "8px", fontSize: "12px", whiteSpace: "pre-wrap" }}>{this.state.hata}</pre>
        <button onClick={() => this.setState({ hata: null })} style={{
          marginTop: "16px", padding: "8px 18px", border: "none",
          borderRadius: "8px", background: "#DC2626", color: "white",
          fontSize: "13px", fontWeight: "600", cursor: "pointer"
        }}>{this.props.retryLabel}</button>
      </div>
    )
    return this.props.children
  }
}

function ErrorBoundary({ children }) {
  const { t } = useLang()
  return (
    <ErrorBoundaryInner errorTitle={t("errorTitle")} retryLabel={t("retry")}>
      {children}
    </ErrorBoundaryInner>
  )
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

// Sidebar grupları
function getSidebarGroups(t) {
  return [
    {
      group: null,
      items: [
        { id: "dashboard", label: t("navDashboard"), icon: "🏠" },
        { id: "yeniAnaliz", label: t("navNewAnalysis"), icon: "⚡", accent: true },
      ]
    },
    {
      group: t("groupProject"),
      items: [
        { id: "guncel", label: t("navCurrentProject"), icon: "📂" },
        { id: "onceki", label: t("navPrevAnalyses"), icon: "🕒" },
      ]
    },
    {
      group: t("groupOutputs"),
      items: [
        { id: "raporlar", label: t("navReports"), icon: "📄" },
        { id: "fiyat", label: t("navPricing"), icon: "💰" },
      ]
    },
    {
      group: t("groupAccount"),
      items: [
        { id: "ayarlar", label: t("navSettings"), icon: "⚙️" },
      ]
    },
  ]
}

// Proje wizard alt sekmeleri (Güncel Proje içinde)
function getWizardTabs(t) {
  return [
    { id: "proje", label: t("tabProject"), icon: "📋" },
    { id: "zemin", label: t("tabSoil"), icon: "🪨" },
    { id: "makine", label: t("tabMachine"), icon: "⚙️" },
    { id: "analiz", label: t("tabAnalysis"), icon: "📊" },
    { id: "wizardFiyat", label: t("tabPrice"), icon: "💰" },
    { id: "kalibrasyon", label: t("tabCalibration"), icon: "🎯" },
  ]
}

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
  const { t } = useLang()

  const handleLogin = async () => {
    if (!username || !password) { setError(t("usernameLabel") + " / " + t("passwordLabel")); return }
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
            {t("backToHome")}
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
            {t("loginSubtitle")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ color: "#64748B", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px", letterSpacing: "0.04em" }}>
              {t("usernameLabel")}
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
              {t("passwordLabel")}
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
            {loading ? t("loggingIn") : t("loginBtn")}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#94A3B8" }}>
          {t("noAccount")}{" "}
          <button onClick={onGoRegister} style={{
            background: "none", border: "none", color: "#0EA5E9",
            fontWeight: "600", cursor: "pointer", fontSize: "13px", padding: 0,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {t("registerLink")}
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

function Sidebar({ active, onNav, open, onClose, projeAdi }) {
  const { t } = useLang()
  const SIDEBAR_GROUPS = getSidebarGroups(t)
  return (
    <>
      {open && (
        <div onClick={onClose} aria-hidden="true"
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.3)", display: "none" }}
          className="sidebar-overlay" />
      )}
      <div role="navigation" aria-label="Ana menü"
        style={{ width: "230px", minHeight: "100vh", background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", flexShrink: 0, position: "relative", zIndex: 50 }}
        className={`sidebar${open ? " sidebar-open" : ""}`}
      >
        {/* Logo */}
        <div style={{ padding: "20px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          <button onClick={onClose} aria-label="Close menu"
            style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "18px", cursor: "pointer", display: "none" }}
            className="sidebar-close-btn">✕</button>
        </div>

        {/* Nav grupları */}
        <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
          {SIDEBAR_GROUPS.map((grp, gi) => (
            <div key={gi} style={{ marginBottom: grp.group ? "4px" : "2px" }}>
              {grp.group && (
                <div style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "3px", padding: "10px 12px 4px", textTransform: "uppercase" }}>
                  {grp.group}
                </div>
              )}
              {grp.items.map(item => {
                const isActive = active === item.id || (item.id === "guncel" && ["proje","zemin","makine","analiz","wizardFiyat"].includes(active))
                return (
                  <button key={item.id} onClick={() => { onNav(item.id); onClose() }}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      gap: "10px", padding: item.accent ? "9px 12px" : "9px 12px",
                      background: item.accent
                        ? "linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)"
                        : isActive ? "var(--bg-card-hover)" : "transparent",
                      border: item.accent ? "none"
                        : isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                      borderLeft: item.accent ? "none"
                        : isActive ? "3px solid var(--accent)" : "3px solid transparent",
                      borderRadius: "8px",
                      color: item.accent ? "white" : isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      fontSize: "13px", fontWeight: item.accent ? "700" : isActive ? "600" : "400",
                      cursor: "pointer", marginBottom: item.accent ? "10px" : "2px", textAlign: "left",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: "all 0.15s",
                      boxShadow: item.accent ? "0 2px 8px rgba(14,165,233,0.3)" : "none",
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: "14px" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.id === "guncel" && projeAdi && (
                      <span style={{ fontSize: "9px", color: item.accent ? "rgba(255,255,255,0.7)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70px" }}>{projeAdi}</span>
                    )}
                  </button>
                )
              })}
            </div>
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
  const { lang, toggleLang, t } = useLang()
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
        aria-label="Open menu"
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
        onClick={toggleLang}
        style={{
          padding: "5px 11px",
          border: "1px solid var(--border-medium)",
          borderRadius: "6px",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: "11px", cursor: "pointer",
          fontFamily: "'DM Mono', monospace",
          fontWeight: "700", letterSpacing: "0.06em",
          transition: "color 0.15s, border-color 0.15s",
        }}
      >
        {lang === "tr" ? "TR" : "EN"}
      </button>
      <button
        onClick={onLogout}
        aria-label="Sign out"
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
        {t("logoutBtn")}
      </button>
    </header>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function WelcomeModal({ onDemoYukle, onKapat }) {
  const { t } = useLang()
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "white", borderRadius: "20px", width: "100%", maxWidth: "480px", padding: "40px 40px 32px", boxShadow: "0 32px 80px rgba(14,165,233,0.18)", animation: "fadeUp 0.3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ marginBottom: "6px" }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "28px", color: "#0C4A6E" }}>Geo</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "28px", color: "#0EA5E9" }}>Drill</span>
          </div>
          <div style={{ color: "#0369A1", fontSize: "9px", letterSpacing: "5px", fontWeight: "700", marginBottom: "16px" }}>— INSIGHT —</div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0C4A6E", marginBottom: "10px" }}>{t("welcomeTitle")}</h2>
          <p style={{ fontSize: "14px", color: "#64748B", lineHeight: "1.7" }}>
            {t("welcomeDesc")}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={onDemoYukle} style={{ padding: "13px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {t("loadDemo")}
          </button>
          <button onClick={onKapat} style={{ padding: "12px", border: "1.5px solid #E2E8F0", borderRadius: "10px", background: "white", color: "#475569", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {t("startBlank")}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px" }}>
          {t("demoNote")}
        </p>
      </div>
    </div>
  )
}

// ─── Ana Ekran (home dashboard) ──────────────────────────────────────────────
function HomeDashboard({ onYeniAnaliz, onOnceki, onRaporlar, proje, projeId, zemin, onGuncel, username }) {
  const { t } = useLang()
  const kaydedildi = projeId && proje.projeAdi
  return (
    <div style={{ animation: "fadeUp 0.3s ease" }}>
      {/* Karşılama */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "26px", fontWeight: "800", color: "var(--heading)", marginBottom: "6px" }}>
          {t("homeGreeting").replace("{name}", username)}
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{t("platformSubtitle")}</p>
      </div>

      {/* 3 Büyük Aksiyon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          { icon: "⚡", label: t("startNewAnalysis"), desc: t("startNewDesc"), onClick: onYeniAnaliz, bg: "linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)", color: "white", accent: true },
          { icon: "🕒", label: t("prevAnalysesMenu"), desc: t("prevAnalysesDesc"), onClick: onOnceki, bg: "var(--bg-card)", color: "var(--text-primary)" },
          { icon: "📄", label: t("reportsMenu"), desc: t("reportsDesc"), onClick: onRaporlar, bg: "var(--bg-card)", color: "var(--text-primary)" },
        ].map(b => (
          <button key={b.label} onClick={b.onClick} style={{
            padding: "24px 20px", borderRadius: "12px", border: `1px solid ${b.accent ? "transparent" : "var(--input-border)"}`,
            background: b.bg, color: b.color, cursor: "pointer", textAlign: "left",
            boxShadow: b.accent ? "0 4px 16px rgba(14,165,233,0.3)" : "0 1px 3px rgba(0,0,0,0.04)",
            transition: "transform 0.15s, box-shadow 0.2s",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = b.accent ? "0 8px 24px rgba(14,165,233,0.4)" : "0 4px 16px rgba(0,0,0,0.08)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = b.accent ? "0 4px 16px rgba(14,165,233,0.3)" : "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>{b.icon}</div>
            <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>{b.label}</div>
            <div style={{ fontSize: "12px", opacity: b.accent ? 0.85 : undefined, color: b.accent ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>{b.desc}</div>
          </button>
        ))}
      </div>

      {/* Güncel Proje Banner */}
      {kaydedildi && (
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1.5px solid var(--accent)", padding: "20px 24px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>{t("currentProjectLabel")}</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--heading)" }}>{proje.projeAdi}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{proje.isTipi} · {proje.kazikBoyu}m / Ø{proje.kazikCapi}mm · {proje.kazikAdedi} {t("piles")} · {zemin.length} {t("colSoilType")}</div>
          </div>
          <button onClick={onGuncel} style={{ padding: "10px 22px", border: "none", borderRadius: "8px", background: "var(--accent)", color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            {t("continueBtn")}
          </button>
        </div>
      )}

      {/* İpuçları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        {[
          { icon: "🪨", title: t("tipSoilTitle"), desc: t("tipSoilDesc") },
          { icon: "⚙️", title: t("tipMachineTitle"), desc: t("tipMachineDesc") },
          { icon: "📊", title: t("tipDecisionTitle"), desc: t("tipDecisionDesc") },
          { icon: "💰", title: t("tipPriceTitle"), desc: t("tipPriceDesc") },
        ].map(k => (
          <div key={k.title} style={{ background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--input-border)", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "20px", marginBottom: "8px" }}>{k.icon}</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--heading)", marginBottom: "4px" }}>{k.title}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>{k.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Dashboard({ username, onLogout }) {
  const { t } = useLang()
  const [activePage, setActivePage] = useState("dashboard")
  const [wizardTab, setWizardTab] = useState("proje")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projeId, setProjeId] = useState(null)
  const [proje, setProje] = useState(BOS_PROJE)
  const [zemin, setZemin] = useState([])
  const [makineler, setMakineler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [onboarding, setOnboarding] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem("gd_theme") === "dark")
  const [kalibrasyon, setKalibrasyon] = useState({ aktif: false, katsayi: 1.0 })

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
          // İlk kez giriş — onboarding wizard göster
          const onboarded = localStorage.getItem("gd_onboarded")
          if (!onboarded) setOnboarding(true)
        }

        if (ekipmanlar.length > 0) {
          setMakineler(ekipmanlar.map(fromSnakeMakine))
        }
      } catch {
        // İlk açılışta hata olursa boş başla
        const onboarded = localStorage.getItem("gd_onboarded")
        if (!onboarded) setOnboarding(true)
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
  }

  const handleLogout = () => {
    logout()
    onLogout()
  }

  const handleYeniAnaliz = () => {
    setProje(BOS_PROJE)
    setZemin([])
    setProjeId(null)
    setKalibrasyon({ aktif: false, katsayi: 1.0 })
    setWizardTab("proje")
    setActivePage("guncel")
  }

  const handleDuzenle = async (id) => {
    try {
      const p = await getProject(id)
      setProjeId(p.id)
      setProje(fromSnake(p))
      setZemin((p.soil_layers || []).map(fromSnakeLayer))
      setKalibrasyon({ aktif: false, katsayi: 1.0 })
      setWizardTab("proje")
      setActivePage("guncel")
    } catch (e) {
      console.error("Proje yüklenemedi:", e)
    }
  }

  const handleNav = (id) => {
    if (id === "yeniAnaliz") {
      handleYeniAnaliz()
    } else {
      setActivePage(id)
    }
  }

  if (yukleniyor) {
    return (
      <div style={{display: "flex", minHeight: "100vh"}}>
        <Sidebar active={activePage} onNav={handleNav} open={false} onClose={() => {}} projeAdi={proje.projeAdi} />
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
      {onboarding && (
        <OnboardingWizard
          username={username}
          onDemoYukle={handleDemoYukle}
          onComplete={() => { setOnboarding(false); setActivePage("guncel") }}
        />
      )}
      <Sidebar active={activePage} onNav={handleNav} open={sidebarOpen} onClose={() => setSidebarOpen(false)} projeAdi={proje.projeAdi} />
      <div style={{flex: 1, display: "flex", flexDirection: "column", minWidth: 0}}>
        <Header username={username} onLogout={handleLogout} onMenuOpen={() => setSidebarOpen(true)} dark={dark} onToggleDark={toggleDark} />
        <main style={{flex: 1, padding: "32px 28px", background: "var(--bg-base)", overflowY: "auto"}}>
          <div key={activePage} style={{ animation: "fadeUp 0.3s ease" }}>
            {activePage === "dashboard" && (
              <DashboardPage
                username={username}
                onYeniAnaliz={handleYeniAnaliz}
                onProjeAc={(idOrPage) => {
                  if (typeof idOrPage === "number") {
                    handleDuzenle(idOrPage)
                  } else {
                    setActivePage(idOrPage || "onceki")
                  }
                }}
              />
            )}
            {activePage === "guncel" && (
              <>
                <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "var(--bg-card)", borderRadius: "10px", padding: "4px", border: "1px solid var(--input-border)" }}>
                  {getWizardTabs(t).map(tab => (
                    <button key={tab.id} onClick={() => setWizardTab(tab.id)}
                      style={{
                        flex: 1, padding: "8px 4px", border: "none", borderRadius: "7px",
                        background: wizardTab === tab.id ? "var(--accent)" : "transparent",
                        color: wizardTab === tab.id ? "white" : "var(--text-secondary)",
                        fontSize: "12px", fontWeight: wizardTab === tab.id ? "700" : "500",
                        cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ marginRight: "4px" }}>{tab.icon}</span>{tab.label}
                    </button>
                  ))}
                </div>
                {wizardTab === "proje" && (
                  <ProjeForm data={proje} onChange={handleProjeChange} projeId={projeId} onProjeIdChange={setProjeId} />
                )}
                {wizardTab === "zemin" && (
                  <ZeminLogu data={zemin} onChange={setZemin} yeraltiSuyu={proje.yeraltiSuyu} kazikBoyu={proje.kazikBoyu} projeId={projeId} />
                )}
                {wizardTab === "makine" && (
                  <MakinePark data={makineler} onChange={setMakineler} />
                )}
                {wizardTab === "analiz" && (
                  <ErrorBoundary>
                    <AnalizSonucu proje={proje} zemin={zemin} makineler={makineler} projeId={projeId} kalibrasyon={kalibrasyon} />
                  </ErrorBoundary>
                )}
                {wizardTab === "wizardFiyat" && (
                  <ErrorBoundary>
                    <FiyatAnalizi proje={proje} zemin={zemin} projeId={projeId} />
                  </ErrorBoundary>
                )}
                {wizardTab === "kalibrasyon" && (
                  <ErrorBoundary>
                    <ProjeKalibrasyonu proje={proje} zemin={zemin} kalibrasyon={kalibrasyon} onKalibrasyon={setKalibrasyon} />
                  </ErrorBoundary>
                )}
              </>
            )}
            {activePage === "onceki" && (
              <OncekiAnalizler onDuzenle={handleDuzenle} />
            )}
            {activePage === "raporlar" && (
              <OncekiAnalizler onDuzenle={handleDuzenle} />
            )}
            {activePage === "fiyat" && (
              <ErrorBoundary>
                <FiyatAnalizi proje={proje} zemin={zemin} />
              </ErrorBoundary>
            )}
            {activePage === "ayarlar" && (
              <Ayarlar username={username} dark={dark} onToggleDark={toggleDark} />
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

  const handleLogout = useCallback(() => {
    localStorage.removeItem("gd_username")
    setUser(null)
    setAuthPage("landing")
  }, [])

  // Register soft-logout handler so api.js 401s go through React state,
  // not window.location.reload() which would destroy all component state.
  useEffect(() => {
    setOnUnauthorized(handleLogout)
    return () => setOnUnauthorized(null)
  }, [handleLogout])

  if (user) return <LangProvider><ToastProvider><Dashboard username={user} onLogout={handleLogout} /></ToastProvider></LangProvider>

  if (authPage === "register")
    return (
      <LangProvider>
        <RegisterPage
          onLogin={handleLogin}
          onGoLogin={() => setAuthPage("login")}
        />
      </LangProvider>
    )

  if (authPage === "login")
    return (
      <LangProvider>
        <LoginPage
          onLogin={handleLogin}
          onGoRegister={() => setAuthPage("register")}
          onGoLanding={() => setAuthPage("landing")}
        />
      </LangProvider>
    )

  return (
    <LangProvider>
      <LandingPage
        onGoLogin={() => setAuthPage("login")}
        onGoRegister={() => setAuthPage("register")}
      />
    </LangProvider>
  )
}
