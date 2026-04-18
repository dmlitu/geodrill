import { useEffect, useMemo, useRef, useState } from "react"
import BlogPost from "./BlogPost"
import { useLang } from "./LangContext"

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function RevealSection({ children, style, delay = 0 }) {
  const [ref, visible] = useScrollReveal()
  return (
    <div ref={ref} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      {children}
    </div>
  )
}

function SectionEyebrow({ children, centered = false }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      justifyContent: centered ? "center" : "flex-start",
      marginBottom: "16px",
    }}>
      <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
      <span style={{ color: "#0EA5E9", fontSize: "11px", fontWeight: "700", letterSpacing: "3px" }}>{children}</span>
      {centered && <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />}
    </div>
  )
}

function SectionHeading({ title, centered = false, maxWidth = "720px" }) {
  return (
    <div style={{ textAlign: centered ? "center" : "left", marginBottom: "24px" }}>
      <h2 style={{
        fontFamily: "'Fraunces', serif",
        fontSize: "clamp(26px, 3.5vw, 40px)",
        fontWeight: "800",
        margin: 0,
        letterSpacing: "-0.02em",
        color: "#0C4A6E",
        maxWidth,
        marginLeft: centered ? "auto" : 0,
        marginRight: centered ? "auto" : 0,
      }}>
        {title}
      </h2>
    </div>
  )
}

function AnimatedStat({ target, suffix = "", label, sublabel, color = "#0284C7", dark = false }) {
  const elRef = useRef(null)
  const [count, setCount] = useState(0)
  const startedRef = useRef(false)
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startedRef.current) {
        startedRef.current = true
        const start = performance.now()
        const step = (now) => {
          const progress = Math.min((now - start) / 1200, 1)
          const ease = 1 - Math.pow(1 - progress, 3)
          setCount(Math.round(ease * target))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        obs.disconnect()
      }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])
  return (
    <div ref={elRef} style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(44px, 5vw, 60px)", fontWeight: "900", color, lineHeight: 1, marginBottom: "8px" }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: "14px", fontWeight: "700", color: dark ? "rgba(255,255,255,0.88)" : "#0C4A6E", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "12px", color: dark ? "rgba(255,255,255,0.38)" : "#94A3B8" }}>{sublabel}</div>
    </div>
  )
}

// ─── Demo Talep Formu (Slide-in Panel) ───────────────────────────────────────

function DemoForm({ open, onClose }) {
  const [form, setForm] = useState({ ad: "", firma: "", pozisyon: "", telefon: "", mesaj: "" })
  const [gonderildi, setGonderildi] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useLang()

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const gonder = async (e) => {
    e.preventDefault()
    if (!form.ad || !form.firma) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    setGonderildi(true)
  }

  const inputS = {
    width: "100%", padding: "10px 14px",
    border: "1.5px solid #E0F2FE", borderRadius: "8px",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
    background: "white", color: "#0C4A6E",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "border-color 0.2s",
  }

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(12,74,110,0.35)", backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
        width: "min(420px, 100vw)",
        background: "white",
        boxShadow: "-8px 0 48px rgba(12,74,110,0.15)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.3s ease",
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <div style={{ padding: "24px 28px", borderBottom: "1px solid #E0F2FE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: "800", fontSize: "18px", color: "#0C4A6E" }}>{t("demoFormTitle")}</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>{t("demoFormSubtitle")}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "22px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
          {gonderildi ? (
            <div style={{ textAlign: "center", paddingTop: "40px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: "700", color: "#0C4A6E", marginBottom: "8px" }}>{t("demoFormReceived")}</div>
              <p style={{ color: "#64748B", fontSize: "14px", lineHeight: "1.6" }}>
                {t("demoFormReceivedDesc").replace("{firma}", form.firma)}
              </p>
              <button onClick={onClose} style={{
                marginTop: "24px", padding: "11px 28px",
                background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
                color: "white", border: "none", borderRadius: "8px",
                fontSize: "14px", fontWeight: "600", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>{t("close")}</button>
            </div>
          ) : (
            <form onSubmit={gonder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>{t("demoFormNameLabel")}</label>
                <input style={inputS} placeholder="Ahmet Yılmaz" value={form.ad} onChange={set("ad")} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>{t("demoFormCompanyLabel")}</label>
                <input style={inputS} placeholder="Örnek Sondaj A.Ş." value={form.firma} onChange={set("firma")} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>{t("demoFormPositionLabel")}</label>
                <input style={inputS} placeholder="Geoteknik Mühendisi" value={form.pozisyon} onChange={set("pozisyon")} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>{t("demoFormPhoneLabel")}</label>
                <input style={inputS} placeholder="+90 5xx xxx xx xx" value={form.telefon} onChange={set("telefon")} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }}>{t("demoFormPurposeLabel")}</label>
                <textarea style={{ ...inputS, resize: "vertical", minHeight: "80px" }}
                  placeholder={t("demoFormPurposePlaceholder")}
                  value={form.mesaj} onChange={set("mesaj")} />
              </div>
              <button type="submit" disabled={loading || !form.ad || !form.firma} style={{
                padding: "13px", border: "none", borderRadius: "8px",
                background: (loading || !form.ad || !form.firma) ? "#BAE6FD" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
                color: "white", fontSize: "15px", fontWeight: "700",
                cursor: (loading || !form.ad || !form.firma) ? "not-allowed" : "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                marginTop: "4px",
              }}>
                {loading ? t("demoFormSending") : t("demoFormSubmit")}
              </button>
              <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", marginTop: "4px" }}>
                {t("demoFormPrivacy")}
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────

export default function LandingPage({ onGoLogin, onGoRegister }) {
  const [demoAcik, setDemoAcik] = useState(false)
  const [activePage, setActivePage] = useState("home")
  const [selectedPost, setSelectedPost] = useState(null)
  const [mobMenu, setMobMenu] = useState(false)
  const { t, lang, setLang } = useLang()

  const featuredPosts = useMemo(() => {
    const featured = ALL_BLOG_POSTS.filter(post => post.featured)
    const rest = ALL_BLOG_POSTS.filter(post => !post.featured)
    return [...featured, ...rest].slice(0, 3)
  }, [])

  const handleLangChange = (l) => { setLang(l); localStorage.setItem("gd_lang", l) }

  const goHome = () => { setActivePage("home"); setSelectedPost(null); setMobMenu(false); window.scrollTo(0, 0) }
  const goPost = (post) => { setSelectedPost(post); setActivePage("post"); setMobMenu(false); window.scrollTo(0, 0) }
  const goPage = (page) => { setActivePage(page); setMobMenu(false); window.scrollTo(0, 0) }

  if (activePage === "post" && selectedPost) {
    return <BlogPost post={selectedPost} allPosts={ALL_BLOG_POSTS} onBack={() => goPage("blog")} onGoPost={goPost} />
  }
  if (activePage === "hakkimizda") {
    return <HakkimizdaSayfasi onGoHome={goHome} onGoLogin={onGoLogin} onGoPage={goPage} setDemoAcik={setDemoAcik} />
  }
  if (activePage === "blog") {
    return <BlogSayfasi onGoHome={goHome} onGoLogin={onGoLogin} onGoPost={goPost} onGoPage={goPage} posts={ALL_BLOG_POSTS} />
  }
  if (activePage === "sss") {
    return <SSSSayfasi onGoHome={goHome} onGoLogin={onGoLogin} onGoPage={goPage} setDemoAcik={setDemoAcik} />
  }
  if (activePage === "iletisim") {
    return <IletisimSayfasi onGoHome={goHome} onGoPage={goPage} setDemoAcik={setDemoAcik} />
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FFFFFF", color: "#0C4A6E", overflowX: "hidden" }}>
      <style>{`
        .nav-btn-ghost {
          padding: 8px 20px;
          border: 1px solid #BAE6FD;
          border-radius: 6px;
          background: transparent;
          color: #64748B;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          letter-spacing: 0.02em;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .nav-btn-ghost:hover { color: #0369A1; border-color: #0EA5E9; background: #F0F9FF; }

        .nav-btn-accent {
          padding: 8px 20px;
          border: none;
          border-radius: 6px;
          background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%);
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          letter-spacing: 0.02em;
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .nav-btn-accent:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(14,165,233,0.3); }

        .strata-track { animation: strataScroll 28s linear infinite; }

        .feature-card {
          background: white;
          border: 1px solid #E0F2FE;
          border-radius: 12px;
          padding: 28px 24px;
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .feature-card:hover {
          border-color: #BAE6FD;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(14,165,233,0.08);
        }

        .cta-primary {
          padding: 14px 36px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: transform 0.15s, box-shadow 0.2s;
        }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(14,165,233,0.35); }

        .cta-secondary {
          padding: 14px 36px;
          border: 1.5px solid #BAE6FD;
          border-radius: 8px;
          background: transparent;
          color: #0369A1;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .cta-secondary:hover { color: #0284C7; border-color: #0EA5E9; background: #F0F9FF; }

        .step-num {
          font-family: 'Fraunces', serif;
          font-size: 72px;
          font-weight: 900;
          line-height: 1;
          color: #E0F2FE;
          transition: color 0.2s;
        }
        .step-item:hover .step-num { color: #0EA5E9; }

        .trust-card {
          background: #F8FAFF;
          border: 1px solid #E0F2FE;
          border-radius: 10px;
          padding: 20px 24px;
        }

        .preview-card {
          background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%);
          border: 1px solid #E0F2FE;
          border-radius: 18px;
          box-shadow: 0 16px 40px rgba(12,74,110,0.08);
        }

        .mini-stat {
          background: white;
          border: 1px solid #E0F2FE;
          border-radius: 12px;
          padding: 18px 16px;
        }

        @keyframes pulseBlue {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(14,165,233,0); }
        }

        @keyframes strataScroll {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }

        .nav-link {
          padding: 6px 12px; border: none; border-radius: 6px;
          background: transparent; color: #64748B; font-size: 13px;
          font-weight: 600; cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: color 0.2s, background 0.2s; white-space: nowrap;
        }
        .nav-link:hover { color: #0369A1; background: #F0F9FF; }

        .hamburger-btn {
          display: none; flex-direction: column; gap: 5px;
          background: none; border: none; cursor: pointer; padding: 6px;
        }
        .hamburger-btn span {
          display: block; width: 22px; height: 2px;
          background: #0C4A6E; border-radius: 1px;
          transition: background 0.2s;
        }

        .desktop-nav-links { display: flex; gap: 2px; align-items: center; }

        @media (max-width: 980px) {
          .hero-layout,
          .positioning-grid,
          .preview-grid,
          .contact-grid {
            grid-template-columns: 1fr !important;
          }
          .step-flow {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
          }
        }

        @media (max-width: 840px) {
          .desktop-nav-links { display: none !important; }
          .hamburger-btn { display: flex !important; }
          nav { padding: 0 20px !important; }
        }

        @media (max-width: 720px) {
          .hero-section,
          .section-pad,
          .cta-section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .hero-panel {
            padding: 32px 24px !important;
          }
          .hero-actions,
          .cta-actions {
            flex-direction: column;
            align-items: stretch !important;
          }
          .hero-actions button,
          .cta-actions button {
            width: 100%;
          }
          .hero-proof-grid,
          .mini-stat-grid,
          .blog-grid-home {
            grid-template-columns: 1fr !important;
          }
        }

        .sss-item { border: 1px solid #E0F2FE; border-radius: 10px; overflow: hidden; margin-bottom: 8px; }
        .sss-trigger {
          width: 100%; padding: 17px 20px; display: flex; align-items: center;
          justify-content: space-between; background: white; border: none;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
          text-align: left; transition: background 0.15s;
        }
        .sss-trigger:hover { background: #F8FAFF; }

        .blog-card {
          background: white; border: 1px solid #E0F2FE; border-radius: 14px;
          padding: 0; text-align: left; cursor: pointer; overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .blog-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(14,165,233,0.1); border-color: #BAE6FD; }
      `}</style>

      <DemoForm open={demoAcik} onClose={() => setDemoAcik(false)} />

      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E0F2FE",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: "60px",
      }}>
        <button onClick={goHome} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Logo /></button>

        <div className="desktop-nav-links">
          {[[t("navAbout"), "hakkimizda"], [t("navBlog"), "blog"], [t("navFAQ"), "sss"], [t("navContact"), "iletisim"]].map(([label, id]) => (
            <button key={id} className="nav-link" onClick={() => goPage(id)}>{label}</button>
          ))}
          <div style={{ width: "1px", height: "20px", background: "#E0F2FE", margin: "0 8px" }} />
          <div
            role="group"
            aria-label="Language"
            style={{
              display: "flex",
              border: "1px solid #BAE6FD",
              borderRadius: "6px",
              overflow: "hidden",
              marginRight: "4px",
            }}
          >
            {["tr", "en", "ru"].map((l, i) => (
              <button
                key={l}
                onClick={() => handleLangChange(l)}
                aria-pressed={lang === l}
                style={{
                  padding: "5px 8px",
                  border: "none",
                  borderRight: i < 2 ? "1px solid #BAE6FD" : "none",
                  background: lang === l ? "#0EA5E9" : "transparent",
                  color: lang === l ? "white" : "#64748B",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: "700",
                  letterSpacing: "0.06em",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="nav-btn-ghost" onClick={onGoLogin}>{t("navLoginBtn")}</button>
          <button className="nav-btn-accent" onClick={() => setDemoAcik(true)}>{t("navDemoRequest")}</button>
        </div>

        <button className="hamburger-btn" onClick={() => setMobMenu(p => !p)} aria-label={t("navAbout")}>
          <span /><span /><span />
        </button>
      </nav>

      {mobMenu && (
        <div onClick={() => setMobMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(12,74,110,0.25)" }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: "60px", left: 0, right: 0,
            background: "white", borderBottom: "1px solid #E0F2FE",
            padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: "2px",
          }}>
            {[[t("navAbout"), "hakkimizda"], [t("navBlog"), "blog"], [t("navFAQ"), "sss"], [t("navContact"), "iletisim"]].map(([label, id]) => (
              <button key={id} onClick={() => goPage(id)} style={{
                background: "none", border: "none", padding: "11px 8px",
                fontSize: "15px", fontWeight: "600", color: "#0C4A6E",
                cursor: "pointer", textAlign: "left",
                borderBottom: "1px solid #F0F9FF",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>{label}</button>
            ))}
            <div style={{ display: "flex", gap: "4px", marginTop: "12px", marginBottom: "4px" }}>
              {["tr", "en", "ru"].map((l) => (
                <button
                  key={l}
                  onClick={() => { handleLangChange(l); setMobMenu(false) }}
                  aria-pressed={lang === l}
                  style={{
                    flex: 1, padding: "8px 4px",
                    border: `1px solid ${lang === l ? "#0EA5E9" : "#BAE6FD"}`,
                    borderRadius: "6px",
                    background: lang === l ? "#0EA5E9" : "transparent",
                    color: lang === l ? "white" : "#64748B",
                    fontSize: "12px", cursor: "pointer",
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: "700", letterSpacing: "0.06em",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button className="nav-btn-ghost" style={{ flex: 1 }} onClick={() => { onGoLogin(); setMobMenu(false) }}>{t("navLoginBtn")}</button>
              <button className="nav-btn-accent" style={{ flex: 1 }} onClick={() => { setDemoAcik(true); setMobMenu(false) }}>{t("navDemoRequest")}</button>
            </div>
          </div>
        </div>
      )}

      <section className="hero-section" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden", padding: "0 48px" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div className="strata-track" style={{ position: "absolute", left: 0, right: 0, top: 0, height: "200%" }}>
            {STRATA_BANDS.concat(STRATA_BANDS).map((band, i) => (
              <div key={i} style={{ height: band.h, background: band.color, opacity: band.opacity }} />
            ))}
          </div>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(255,255,255,0.94) 0%, rgba(240,249,255,0.88) 50%, rgba(255,255,255,0.96) 100%)",
          }} />
          <div style={{
            position: "absolute", right: "10%", top: "10%", bottom: "10%",
            width: "1px", background: "linear-gradient(to bottom, transparent, #BAE6FD 20%, #BAE6FD 80%, transparent)",
            opacity: 0.5,
          }} />
          <div style={{
            position: "absolute", right: "calc(10% - 5px)", top: "15%",
            width: "11px", height: "11px", borderRadius: "50%",
            background: "#0EA5E9", opacity: 0.7,
            animation: "pulseBlue 3s ease-in-out infinite",
          }} />
        </div>

        <div className="hero-layout" style={{ position: "relative", zIndex: 1, maxWidth: "1180px", margin: "0 auto", width: "100%", padding: "100px 0 80px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "40px", alignItems: "center" }}>
          <div>
            <div style={{
              display: "inline-block",
              border: "1px solid #BAE6FD",
              borderLeft: "3px solid #0EA5E9",
              color: "#0369A1",
              fontSize: "11px", fontWeight: "700",
              letterSpacing: "4px", padding: "6px 16px",
              marginBottom: "24px",
              background: "rgba(14,165,233,0.05)",
              borderRadius: "4px",
            }}>
              {t("heroTagline")}
            </div>

            <h1 style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(36px, 5.5vw, 60px)",
              fontWeight: "900",
              lineHeight: "1.08",
              margin: "0 0 20px",
              letterSpacing: "-0.03em",
              color: "#0C4A6E",
              maxWidth: "640px",
            }}>
              Fore kazık kararını
              <br />
              <em style={{ color: "#0EA5E9", fontStyle: "italic" }}>veriye dayandırın.</em>
            </h1>

            <p style={{
              color: "#475569",
              fontSize: "17px",
              lineHeight: "1.75",
              margin: "0 0 32px",
              maxWidth: "560px",
            }}>
              Zemin logu, makine seçimi ve maliyet analizi — tek akışta. Teklif öncesi belirsizliği azaltmak için tasarlandı.
            </p>

            <div className="hero-actions" style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", marginBottom: "22px" }}>
              <button className="cta-primary" onClick={() => setDemoAcik(true)}>Canlı demo talep et</button>
              <button className="cta-secondary" onClick={onGoRegister || onGoLogin}>Hemen başlayın</button>
            </div>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#64748B", fontSize: "13px", fontWeight: "600" }}>
              <span>✓ Teknik ekip için tasarlandı</span>
              <span>✓ Teklif öncesi net öngörü</span>
            </div>
          </div>

          <div className="hero-panel preview-card" style={{ padding: "28px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.16em", color: "#0EA5E9", marginBottom: "6px" }}>SAHA ÖN İNCELEME</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: "800", color: "#0C4A6E" }}>Demo görünümü</div>
              </div>
              <div style={{ padding: "6px 10px", borderRadius: "999px", background: "#ECFEFF", color: "#0284C7", fontSize: "11px", fontWeight: "700" }}>
                Örnek proje
              </div>
            </div>

            <div style={{ background: "#0C4A6E", borderRadius: "14px", padding: "18px", color: "white", marginBottom: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginBottom: "6px" }}>Proje</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>Maslak Ofis Temeli · Fore Kazık</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {["SPT + UCS veri seti", "3 kritik katman", "Su tablası mevcut"].map(tag => (
                      <span key={tag} style={{ fontSize: "11px", padding: "5px 8px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>Uygunluk skoru</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "34px", fontWeight: "900", color: "#7DD3FC", lineHeight: 1 }}>92</div>
                </div>
              </div>
            </div>

            <div className="mini-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
              {[
                { label: "Tahmini delgi süresi", value: "18.4 sa" },
                { label: "Önerilen makine", value: "BG 28 H" },
                { label: "Saatlik maliyet", value: "₺14.850" },
              ].map(item => (
                <div key={item.label} className="mini-stat">
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>{item.label}</div>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "#0C4A6E" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0C4A6E" }}>Sistem önerisi</div>
                <div style={{ fontSize: "11px", color: "#16A34A", fontWeight: "700" }}>Yüksek güven</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  "Kumtaşı geçişinde yüksek tork ihtiyacı işaretlendi.",
                  "Casing boyu su tablası etkisine göre otomatik güncellendi.",
                  "Makine parkınızdaki iki model teknik olarak elendi.",
                ].map(text => (
                  <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#E0F2FE", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284C7", fontSize: "11px", flexShrink: 0 }}>✓</div>
                    <div style={{ fontSize: "12px", lineHeight: "1.65", color: "#475569" }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ margin: "16px 0 0", color: "#94A3B8", fontSize: "12px", lineHeight: "1.6" }}>
              Demo sırasında kendi proje veriniz veya örnek saha senaryosu üzerinden bu akışı birlikte inceliyoruz.
            </p>
          </div>
        </div>
      </section>

      <RevealSection>
        <section className="section-pad" style={{ background: "#FFFFFF", padding: "36px 48px 0" }}>
          <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
            <div className="hero-proof-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "16px" }}>
              <div style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "16px", padding: "24px" }}>
                <div style={{ fontSize: "11px", letterSpacing: "0.18em", fontWeight: "700", color: "#0EA5E9", marginBottom: "10px" }}>NEDEN EKİPLER GEOdrill İLE İLERLİYOR?</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: "800", color: "#0C4A6E", lineHeight: "1.2", marginBottom: "10px" }}>
                  Teknik kararları daha hızlı ve daha görünür hale getirir.
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748B", lineHeight: "1.7" }}>
                  Tek bir projede dahi, teklif öncesi değerlendirme süresini kısaltmak ve ekip içi belirsizliği azaltmak için tasarlanmıştır.
                </p>
              </div>

              {[
                { value: "Tek akış", label: "Zemin logu → makine → süre → maliyet" },
                { value: "Standart bazlı", label: "FHWA, EN 1536 ve saha kalibrasyonu yaklaşımı" },
                { value: "Demo odaklı", label: "Gerçek proje senaryosu üzerinden hızlı değerlendirme" },
              ].map(item => (
                <div key={item.label} style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "16px", padding: "24px" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", fontWeight: "900", color: "#0284C7", marginBottom: "10px" }}>{item.value}</div>
                  <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.7" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <div style={{
          background: "#F0F9FF",
          borderTop: "1px solid #E0F2FE",
          borderBottom: "1px solid #E0F2FE",
          padding: "36px 48px",
          marginTop: "56px",
        }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <p style={{ textAlign: "center", fontSize: "11px", fontWeight: "700", letterSpacing: "3px", color: "#94A3B8", marginBottom: "24px" }}>
              {t("methodologyTagline")}
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}>
              {[
                { baslik: t("met1Title"), referans: t("met1Ref"), aciklama: t("met1Desc") },
                { baslik: t("met2Title"), referans: t("met2Ref"), aciklama: t("met2Desc") },
                { baslik: t("met3Title"), referans: t("met3Ref"), aciklama: t("met3Desc") },
                { baslik: t("met4Title"), referans: t("met4Ref"), aciklama: t("met4Desc") },
              ].map(m => (
                <div key={m.baslik} className="trust-card">
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#0EA5E9", letterSpacing: "2px", marginBottom: "6px" }}>{m.baslik}</div>
                  <div style={{ fontSize: "13px", color: "#0C4A6E", fontWeight: "600", marginBottom: "4px" }}>{m.referans}</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8" }}>{m.aciklama}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection>
        <section className="section-pad" style={{ padding: "88px 48px", background: "white" }}>
          <div className="positioning-grid" style={{ maxWidth: "1080px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <div>
              <SectionEyebrow>{t("positioningTagline")}</SectionEyebrow>
              <SectionHeading title={t("positioningTitle")} />
              <p style={{ color: "#64748B", fontSize: "15px", lineHeight: "1.75", margin: "0 0 28px" }}>
                {t("positioningDesc")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { baslik: t("pos1Label"), text: t("pos1Text") },
                  { baslik: t("pos2Label"), text: t("pos2Text") },
                  { baslik: t("pos3Label"), text: t("pos3Text") },
                  { baslik: t("pos4Label"), text: t("pos4Text") },
                ].map(item => (
                  <div key={item.baslik} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#F0F9FF", border: "1px solid #BAE6FD", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0EA5E9" }} />
                    </div>
                    <div>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#0C4A6E" }}>{item.baslik}: </span>
                      <span style={{ fontSize: "14px", color: "#64748B" }}>{item.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { konu: t("comp1Topic"), eski: t("comp1Old"), yeni: t("comp1New") },
                { konu: t("comp2Topic"), eski: t("comp2Old"), yeni: t("comp2New") },
                { konu: t("comp3Topic"), eski: t("comp3Old"), yeni: t("comp3New") },
                { konu: t("comp4Topic"), eski: t("comp4Old"), yeni: t("comp4New") },
              ].map(row => (
                <div key={row.konu} style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "10px", padding: "16px 20px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "2px", marginBottom: "10px" }}>{row.konu}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "4px" }}>{t("excelCol")}</div>
                      <div style={{ fontSize: "13px", color: "#DC2626", fontWeight: "500" }}>{row.eski}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#0EA5E9", marginBottom: "4px" }}>{t("geodrillCol")}</div>
                      <div style={{ fontSize: "13px", color: "#0C4A6E", fontWeight: "600" }}>{row.yeni}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="section-pad" style={{ padding: "88px 48px", background: "#F8FAFF" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <SectionEyebrow centered>{t("modulesTagline")}</SectionEyebrow>
            <SectionHeading centered title={t("modulesTitle")} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
              {[
                { title: t("f1Title"), desc: t("f1Desc"), accent: "#0284C7" },
                { title: t("f2Title"), desc: t("f2Desc"), accent: "#0EA5E9" },
                { title: t("f3Title"), desc: t("f3Desc"), accent: "#0369A1" },
                { title: t("f4Title"), desc: t("f4Desc"), accent: "#38BDF8" },
                { title: t("f5Title"), desc: t("f5Desc"), accent: "#0EA5E9" },
                { title: t("f6Title"), desc: t("f6Desc"), accent: "#0284C7" },
              ].map((f, i) => (
                <div key={f.title} className="feature-card" style={{ borderLeftColor: f.accent }}>
                  <style>{`.feature-card:nth-child(${i + 1})::before { background: ${f.accent}; }`}</style>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: f.accent, flexShrink: 0 }} />
                    <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", letterSpacing: "0.01em", margin: 0 }}>{f.title}</h3>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="section-pad" style={{ padding: "88px 48px", background: "white" }}>
          <div className="preview-grid" style={{ maxWidth: "1080px", margin: "0 auto", display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "44px", alignItems: "center" }}>
            <div>
              <SectionEyebrow>DEMO AKIŞI</SectionEyebrow>
              <SectionHeading title="İlk 20 dakikada ne görürsünüz?" />
              <p style={{ color: "#64748B", fontSize: "15px", lineHeight: "1.75", margin: "0 0 24px" }}>
                Demo süreci sade ve teknik ekipler için nettir. Formasyon, makine parkı ve hedef kazık senaryosu üzerinden sistemin nasıl öneri ürettiğini birlikte izlersiniz.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  { step: "01", title: "Proje bağlamı", desc: "Kazık tipi, saha koşulları ve hedef üretim senaryosu netleştirilir." },
                  { step: "02", title: "Veri girişi", desc: "SPT, UCS, RQD ve katman yapısı ile örnek zemin logu içeri alınır." },
                  { step: "03", title: "Sistem önerileri", desc: "Makine seçimi, delgi süresi, casing ve maliyet çıktıları yorumlanır." },
                ].map(item => (
                  <div key={item.step} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: "14px", alignItems: "start" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#EFF6FF", border: "1px solid #BAE6FD", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", color: "#0284C7" }}>{item.step}</div>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", marginBottom: "4px" }}>{item.title}</div>
                      <div style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "28px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button className="cta-primary" onClick={() => setDemoAcik(true)}>Projemle demo planla</button>
                <button className="cta-secondary" onClick={() => goPage("iletisim")}>Teknik ekiple konuş</button>
              </div>
            </div>

            <div className="preview-card" style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.14em", marginBottom: "6px" }}>ÜRÜN ÖN İZLEME</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: "800", color: "#0C4A6E" }}>Karar paneli</div>
                </div>
                <div style={{ padding: "6px 10px", borderRadius: "999px", background: "#F0F9FF", color: "#0284C7", fontSize: "11px", fontWeight: "700" }}>Canlı yorumlanır</div>
              </div>

              <div style={{ border: "1px solid #E0F2FE", borderRadius: "14px", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ background: "#F8FAFF", padding: "12px 16px", borderBottom: "1px solid #E0F2FE", display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.8fr", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8" }}>KATMAN</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8" }}>RİSK</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8" }}>AKSİYON</span>
                </div>
                {[
                  ["Dolgu + gevşek kum", "Orta", "Kısa casing"],
                  ["Silt / kil geçişi", "Düşük", "Standart ilerleme"],
                  ["Kumtaşı lensi", "Yüksek", "Yüksek tork uyarısı"],
                ].map(row => (
                  <div key={row[0]} style={{ padding: "14px 16px", borderBottom: "1px solid #F0F9FF", display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.8fr", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "#0C4A6E", fontWeight: "600" }}>{row[0]}</span>
                    <span style={{ fontSize: "12px", color: row[1] === "Yüksek" ? "#DC2626" : row[1] === "Orta" ? "#D97706" : "#16A34A", fontWeight: "700" }}>{row[1]}</span>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>{row[2]}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {[
                  { title: "Makine adayları", value: "4 → 2 uygun" },
                  { title: "Tahmini teklif bandı", value: "₺2.8M - ₺3.1M" },
                  { title: "Kritik veri eksiği", value: "UCS doğrulama" },
                  { title: "Önerilen sonraki adım", value: "Operasyon planı" },
                ].map(item => (
                  <div key={item.title} style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "7px" }}>{item.title}</div>
                    <div style={{ fontSize: "14px", color: "#0C4A6E", fontWeight: "700" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="section-pad" style={{ padding: "88px 48px", background: "white" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <SectionEyebrow centered>{t("processTagline")}</SectionEyebrow>
            <SectionHeading centered title={t("processTitle")} />
            <div className="step-flow" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0" }}>
              {[
                { title: t("how1Title"), desc: t("how1Desc") },
                { title: t("how2Title"), desc: t("how2Desc") },
                { title: t("how3Title"), desc: t("how3Desc") },
                { title: t("how4Title"), desc: t("how4Desc") },
                { title: t("how5Title"), desc: t("how5Desc") },
              ].map((step, i) => (
                <div key={step.title} className="step-item" style={{
                  padding: "28px 24px",
                  borderLeft: i === 0 ? "none" : "1px solid #E0F2FE",
                }}>
                  <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                  <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: "700", margin: "12px 0 10px", color: "#0C4A6E" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="section-pad" style={{ padding: "80px 48px", background: "white" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <SectionEyebrow centered>KULLANICI GERİ BİLDİRİMLERİ</SectionEyebrow>
            <SectionHeading centered title="Mühendisler ne diyor?" maxWidth="480px" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              {TESTIMONIALS.map((item, i) => (
                <div key={i} style={{
                  background: "#F8FAFF",
                  border: "1px solid #E0F2FE",
                  borderRadius: "16px",
                  padding: "32px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}>
                  <div style={{ fontSize: "36px", color: "#BAE6FD", fontFamily: "'Fraunces', serif", lineHeight: 1 }}>"</div>
                  <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.8", margin: 0, fontStyle: "italic", flexGrow: 1 }}>{item.quote}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: "1px solid #E0F2FE", paddingTop: "18px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `linear-gradient(135deg, ${item.renk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", color: "white", flexShrink: 0 }}>{item.avatar}</div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#0C4A6E" }}>{item.ad}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>{item.unvan}</div>
                    </div>
                    <div style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: "20px", background: "#E0F2FE", color: "#0284C7", fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em" }}>BETA</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="section-pad" style={{ padding: "88px 48px", background: "#F8FAFF" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", marginBottom: "32px" }}>
              <div>
                <SectionEyebrow>BLOGDAN SEÇİLENLER</SectionEyebrow>
                <SectionHeading title="Teknik içgörülerle ekibinizi aynı sayfada tutun." maxWidth="560px" />
                <p style={{ margin: 0, fontSize: "15px", color: "#64748B", lineHeight: "1.75", maxWidth: "620px" }}>
                  Saha deneyimleri, hesap metodolojileri ve makine seçimi üzerine güncel notlar. Demo öncesi hızlı bir teknik çerçeve edinmek için öne çıkan yazılar.
                </p>
              </div>
              <button className="cta-secondary" onClick={() => goPage("blog")}>Tüm yazıları incele</button>
            </div>

            <div className="blog-grid-home" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px" }}>
              {featuredPosts.map(post => (
                <LandingBlogCard key={post.id} post={post} onClick={() => goPost(post)} />
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section style={{ background: "#0C4A6E", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "700px", height: "200px", background: "radial-gradient(ellipse, rgba(14,165,233,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ maxWidth: "1180px", margin: "0 auto", position: "relative" }}>
            <div style={{ textAlign: "center", paddingTop: "48px", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "3px", color: "rgba(255,255,255,0.35)" }}>ÜRÜN RAKAMLARI</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {[
                { target: 9, suffix: "", label: "Zemin Tipi", sublabel: "Dolgu'dan Sert Kaya'ya", color: "#7DD3FC" },
                { target: 8, suffix: "+", label: "Hesap Modülü", sublabel: "Tork · ROP · Casing · Maliyet", color: "#38BDF8" },
                { target: 3, suffix: "", label: "Rapor Formatı", sublabel: "PDF · CSV · Yazdır", color: "#7DD3FC" },
                { target: 3, suffix: "", label: "Dil Desteği", sublabel: "Türkçe · English · Русский", color: "#38BDF8" },
              ].map((s, i) => (
                <div key={s.label} style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <AnimatedStat target={s.target} suffix={s.suffix} label={s.label} sublabel={s.sublabel} color={s.color} dark />
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="cta-section" style={{
          padding: "100px 48px",
          background: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 50%, #0284C7 100%)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)",
            width: "600px", height: "300px",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", maxWidth: "760px", margin: "0 auto" }}>
            <h2 style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: "800",
              margin: "0 0 16px",
              color: "white",
              letterSpacing: "-0.02em",
            }}>
              Sonraki teklifinizde tahmine değil veriye yaslanın.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "16px", margin: "0 0 34px", lineHeight: "1.75" }}>
              GeoDrill demo görüşmesinde; mevcut saha sürecinizi, veri giriş akışını ve hangi kararların otomatikleşebileceğini birlikte değerlendiriyoruz.
            </p>
            <div className="cta-actions" style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setDemoAcik(true)} style={{
                padding: "15px 40px", border: "none", borderRadius: "8px",
                background: "white", color: "#0284C7",
                fontSize: "16px", fontWeight: "700", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "transform 0.15s, box-shadow 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                Demo görüşmesi planla
              </button>
              <button onClick={() => goPage("iletisim")} style={{
                padding: "15px 36px",
                border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "8px",
                background: "transparent", color: "rgba(255,255,255,0.9)",
                fontSize: "15px", fontWeight: "600", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                Teknik sorumu ilet
              </button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "22px", letterSpacing: "0.03em" }}>
              Kısa başvuru formu · ekip uygunluğuna göre dönüş · örnek senaryo üzerinden demo
            </p>
          </div>
        </section>
      </RevealSection>

      <footer style={{ background: "#07304A", padding: "56px 48px 28px" }}>
        <style>{`
          .footer-grid {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 48px;
            margin-bottom: 44px;
          }
          @media (max-width: 900px) {
            .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
          }
          @media (max-width: 560px) {
            .footer-grid { grid-template-columns: 1fr; gap: 28px; }
            footer { padding: 40px 24px 24px !important; }
          }
          .footer-link {
            background: none; border: none; padding: 0;
            color: rgba(255,255,255,0.55); font-size: 13px;
            cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
            text-align: left; display: block; margin-bottom: 10px;
            transition: color 0.15s;
          }
          .footer-link:hover { color: rgba(255,255,255,0.9); }
        `}</style>
        <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
          <div className="footer-grid">
            <div>
              <Logo dark />
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: "1.8", margin: "18px 0 20px", maxWidth: "280px" }}>
                Geoteknik karar destek sistemi. Zemin logunu makine seçimine ve maliyet analizine bağlar.
              </p>
              <a href="mailto:info@geodrillinsight.com" style={{ color: "#7DD3FC", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
                info@geodrillinsight.com
              </a>
            </div>

            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "3px", color: "rgba(255,255,255,0.28)", marginBottom: "18px" }}>ÜRÜN</div>
              {["Analiz Sonucu", "Zemin Logu", "Makine Parkı", "Raporlar (PDF/CSV)"].map(link => (
                <button key={link} className="footer-link" onClick={onGoLogin}>{link}</button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "3px", color: "rgba(255,255,255,0.28)", marginBottom: "18px" }}>ŞİRKET</div>
              {[["Hakkımızda", "hakkimizda"], ["Blog", "blog"], ["SSS", "sss"], ["İletişim", "iletisim"]].map(([label, id]) => (
                <button key={id} className="footer-link" onClick={() => goPage(id)}>{label}</button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "3px", color: "rgba(255,255,255,0.28)", marginBottom: "18px" }}>PLATFORMA GİRİŞ</div>
              <button onClick={onGoLogin} style={{
                width: "100%", padding: "10px 16px", marginBottom: "8px",
                border: "1px solid rgba(255,255,255,0.18)", borderRadius: "6px",
                background: "transparent", color: "rgba(255,255,255,0.75)",
                fontSize: "13px", fontWeight: "600", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center",
                transition: "border-color 0.15s, color 0.15s",
              }}>Giriş Yap</button>
              <button onClick={() => setDemoAcik(true)} style={{
                width: "100%", padding: "10px 16px",
                border: "none", borderRadius: "6px",
                background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
                color: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "center",
              }}>Demo Talep Et</button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <p style={{ color: "rgba(255,255,255,0.22)", fontSize: "12px", margin: 0 }}>
              © {new Date().getFullYear()} GeoDrill Insight · {t("footerCopyright")}
            </p>
            <p style={{ color: "rgba(255,255,255,0.22)", fontSize: "12px", margin: 0 }}>
              geodrillinsight.com
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {["#0369A1", "#0EA5E9", "#7DD3FC"].map((c, i) => (
          <div key={i} style={{ width: "6px", height: "6px", borderRadius: "1px", background: dark ? `rgba(255,255,255,${0.6 - i * 0.15})` : c }} />
        ))}
      </div>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "19px", color: dark ? "white" : "#0C4A6E" }}>Geo</span>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "19px", color: dark ? "#7DD3FC" : "#0EA5E9" }}>Drill</span>
        <span style={{ color: dark ? "rgba(255,255,255,0.35)" : "#94A3B8", fontSize: "9px", letterSpacing: "3px", marginLeft: "6px", verticalAlign: "middle", fontWeight: "700" }}>INSIGHT</span>
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "SPT verilerinden elle tork hesabı yaparken saatler harcıyorduk. Bu akış, teklif hazırlığını gerçekten hızlandırdı.",
    ad: "A. Kaya",
    unvan: "Kıdemli Geoteknik Mühendisi",
    avatar: "AK",
    renk: "#0284C7",
  },
  {
    quote: "Makine uygunluk matrisini görmek bizi şaşırttı. Eleme sürecimiz artık çok daha sistematik ve savunulabilir.",
    ad: "S. Öztürk",
    unvan: "Saha Operasyonları Sorumlusu",
    avatar: "SÖ",
    renk: "#0369A1",
  },
  {
    quote: "Casing karar mantığı ve risk renklendirmesi sayesinde proje risklerini müşteriye anlatmak kolaylaştı.",
    ad: "M. Arslan",
    unvan: "İnşaat Mühendisi",
    avatar: "MA",
    renk: "#0EA5E9",
  },
]

const STRATA_BANDS = [
  { h: "18px", color: "#E0F2FE", opacity: 0.8 },
  { h: "6px", color: "#BAE6FD", opacity: 0.6 },
  { h: "28px", color: "#F0F9FF", opacity: 0.9 },
  { h: "4px", color: "#7DD3FC", opacity: 0.4 },
  { h: "22px", color: "#E0F2FE", opacity: 0.8 },
  { h: "8px", color: "#BFDBFE", opacity: 0.5 },
  { h: "40px", color: "#F0F9FF", opacity: 1 },
  { h: "6px", color: "#BAE6FD", opacity: 0.5 },
  { h: "18px", color: "#DBEAFE", opacity: 0.7 },
  { h: "10px", color: "#BFDBFE", opacity: 0.6 },
  { h: "34px", color: "#EFF6FF", opacity: 1 },
  { h: "8px", color: "#E0F2FE", opacity: 0.6 },
  { h: "50px", color: "#F0F9FF", opacity: 0.9 },
  { h: "6px", color: "#BAE6FD", opacity: 0.4 },
  { h: "26px", color: "#E0F2FE", opacity: 0.8 },
]

// ─── SSS Akordeon Bileşeni ────────────────────────────────────────────────────

function SSSItem({ item }) {
  const [acik, setAcik] = useState(false)
  return (
    <div className="sss-item" style={{ boxShadow: acik ? "0 4px 16px rgba(14,165,233,0.07)" : "none" }}>
      <button className="sss-trigger" onClick={() => setAcik(p => !p)} style={{ background: acik ? "#F0F9FF" : "white" }}>
        <span style={{ fontSize: "15px", fontWeight: "600", color: "#0C4A6E", paddingRight: "12px" }}>{item.soru}</span>
        <span style={{ fontSize: "20px", color: "#0EA5E9", flexShrink: 0, transition: "transform 0.2s", transform: acik ? "rotate(45deg)" : "none", lineHeight: 1 }}>+</span>
      </button>
      {acik && (
        <div style={{ padding: "2px 20px 18px", background: "#F0F9FF", borderTop: "1px solid #E0F2FE" }}>
          <p style={{ margin: "14px 0 0", fontSize: "14px", color: "#64748B", lineHeight: "1.75" }}>{item.cevap}</p>
        </div>
      )}
    </div>
  )
}

// ─── Landing Blog Kartı ───────────────────────────────────────────────────────

function LandingBlogCard({ post, onClick }) {
  const { t } = useLang()
  return (
    <button className="blog-card" onClick={onClick}>
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${post.resimRenk}, #38BDF8)` }} />
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <span style={{ padding: "3px 10px", background: `${post.resimRenk}18`, color: post.resimRenk, borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em" }}>
            {post.kategori.toUpperCase()}
          </span>
          <span style={{ color: "#CBD5E1", fontSize: "11px" }}>·</span>
          <span style={{ fontSize: "11px", color: "#94A3B8" }}>{post.okumaSuresi} {t("minRead")}</span>
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0C4A6E", lineHeight: "1.4", margin: "0 0 10px" }}>{post.baslik}</h3>
        <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.65", margin: "0 0 20px" }}>{post.ozet}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `linear-gradient(135deg, ${post.resimRenk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "white", flexShrink: 0 }}>
            {post.yazar.avatar}
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#0C4A6E" }}>{post.yazar.ad}</div>
            <div style={{ fontSize: "11px", color: "#94A3B8" }}>{post.tarih}</div>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── İletişim Formu ───────────────────────────────────────────────────────────

function IletisimForm({ onDemoAc }) {
  const [form, setForm] = useState({ ad: "", email: "", mesaj: "" })
  const [gonderildi, setGonderildi] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useLang()
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const gonder = async (e) => {
    e.preventDefault()
    if (!form.ad || !form.email) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    setGonderildi(true)
  }

  const inputS = {
    width: "100%", padding: "10px 14px",
    border: "1.5px solid #E0F2FE", borderRadius: "8px",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
    background: "white", color: "#0C4A6E",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "border-color 0.2s",
  }
  const labelS = { display: "block", fontSize: "11px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", marginBottom: "6px" }

  if (gonderildi) {
    return (
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "18px", fontWeight: "700", color: "#15803D", marginBottom: "8px" }}>{t("contactSuccessTitle")}</div>
        <p style={{ fontSize: "13px", color: "#64748B" }}>{t("contactSuccessDesc")}</p>
      </div>
    )
  }

  return (
    <form onSubmit={gonder} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <label style={labelS}>{t("contactNameLabel")}</label>
        <input style={inputS} placeholder="Ahmet Yılmaz" value={form.ad} onChange={set("ad")} required
          onFocus={e => e.target.style.borderColor = "#0EA5E9"} onBlur={e => e.target.style.borderColor = "#E0F2FE"} />
      </div>
      <div>
        <label style={labelS}>{t("contactEmailLabel")}</label>
        <input style={inputS} type="email" placeholder="ahmet@firma.com" value={form.email} onChange={set("email")} required
          onFocus={e => e.target.style.borderColor = "#0EA5E9"} onBlur={e => e.target.style.borderColor = "#E0F2FE"} />
      </div>
      <div>
        <label style={labelS}>{t("contactMsgLabel")}</label>
        <textarea style={{ ...inputS, resize: "vertical", minHeight: "90px" }} placeholder="Örnek: Fore kazık projelerimiz için makine seçimi ve süre tahmini akışını görmek istiyorum."
          value={form.mesaj} onChange={set("mesaj")}
          onFocus={e => e.target.style.borderColor = "#0EA5E9"} onBlur={e => e.target.style.borderColor = "#E0F2FE"} />
      </div>
      <button type="submit" disabled={loading || !form.ad || !form.email} style={{
        padding: "13px", border: "none", borderRadius: "8px",
        background: (loading || !form.ad || !form.email) ? "#BAE6FD" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
        color: "white", fontSize: "15px", fontWeight: "700",
        cursor: (loading || !form.ad || !form.email) ? "not-allowed" : "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {loading ? t("contactSending") : "Mesajı gönder"}
      </button>
      <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", margin: 0 }}>
        Teknik değerlendirme görmek istiyorsanız <button onClick={onDemoAc} type="button" style={{ background: "none", border: "none", color: "#0EA5E9", fontWeight: "700", cursor: "pointer", fontSize: "12px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>demo talebi bırakın</button> — ekibimiz uygun akışı paylaşsın.
      </p>
    </form>
  )
}

// ─── Shared Sub-Page Layout ───────────────────────────────────────────────────

function SubPageNav({ onGoHome, onGoLogin, onGoPage, activeId }) {
  const [mobMenu, setMobMenu] = useState(false)
  const { t } = useLang()
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid #E0F2FE",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 48px", height: "60px",
    }}>
      <style>{`
        @media (max-width: 840px) {
          .spn-links { display: none !important; }
          .spn-ham { display: flex !important; }
          nav { padding: 0 20px !important; }
        }
        .spn-ham { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 6px; }
        .spn-ham span { display: block; width: 22px; height: 2px; background: #0C4A6E; border-radius: 1px; }
        .spn-link { padding: 6px 12px; border: none; border-radius: 6px; background: transparent; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: color 0.2s, background 0.2s; white-space: nowrap; }
        .spn-link:hover { background: #F0F9FF; }
        .nav-btn-ghost { padding: 8px 20px; border: 1px solid #BAE6FD; border-radius: 6px; background: transparent; color: #64748B; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.02em; transition: color 0.2s, border-color 0.2s, background 0.2s; }
        .nav-btn-ghost:hover { color: #0369A1; border-color: #0EA5E9; background: #F0F9FF; }
        .nav-btn-accent { padding: 8px 20px; border: none; border-radius: 6px; background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%); color: white; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.02em; transition: transform 0.15s, box-shadow 0.2s; }
        .nav-btn-accent:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(14,165,233,0.3); }
      `}</style>
      <button onClick={onGoHome} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Logo /></button>
      <div className="spn-links" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        {[[t("navAbout"), "hakkimizda"], [t("navBlog"), "blog"], [t("navFAQ"), "sss"], [t("navContact"), "iletisim"]].map(([label, id]) => (
          <button key={id} className="spn-link" onClick={() => onGoPage(id)} style={{ color: activeId === id ? "#0284C7" : "#64748B", background: activeId === id ? "#F0F9FF" : "transparent" }}>{label}</button>
        ))}
        <div style={{ width: "1px", height: "20px", background: "#E0F2FE", margin: "0 8px" }} />
        {onGoLogin && <button className="nav-btn-ghost" onClick={onGoLogin}>{t("navLoginBtn")}</button>}
      </div>
      <button className="spn-ham" onClick={() => setMobMenu(p => !p)}><span /><span /><span /></button>
      {mobMenu && (
        <div onClick={() => setMobMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(12,74,110,0.25)" }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: "60px", left: 0, right: 0,
            background: "white", borderBottom: "1px solid #E0F2FE",
            padding: "12px 20px 20px",
          }}>
            {[[t("navAbout"), "hakkimizda"], [t("navBlog"), "blog"], [t("navFAQ"), "sss"], [t("navContact"), "iletisim"]].map(([label, id]) => (
              <button key={id} onClick={() => { onGoPage(id); setMobMenu(false) }} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "12px 8px", fontSize: "15px", fontWeight: "600", color: activeId === id ? "#0284C7" : "#0C4A6E", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #F0F9FF", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</button>
            ))}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button onClick={onGoHome} className="nav-btn-ghost" style={{ flex: 1 }}>{t("navHomeMobile")}</button>
              {onGoLogin && <button onClick={onGoLogin} className="nav-btn-accent" style={{ flex: 1 }}>{t("navLoginBtn")}</button>}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

function SubPageFooter({ onGoHome }) {
  const { t } = useLang()
  return (
    <footer style={{ background: "#0C4A6E", padding: "32px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
      <button onClick={onGoHome} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Logo dark /></button>
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", margin: 0, letterSpacing: "0.02em" }}>
        © {new Date().getFullYear()} GeoDrill Insight · {t("footerCopyright")}
      </p>
    </footer>
  )
}

// ─── Hakkımızda Sayfası ───────────────────────────────────────────────────────

function HakkimizdaSayfasi({ onGoHome, onGoLogin, onGoPage, setDemoAcik }) {
  const { t } = useLang()
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#fff", color: "#0C4A6E", minHeight: "100vh" }}>
      <style>{`
        .hk-stat { background: #F8FAFF; border: 1px solid #E0F2FE; border-radius: 12px; padding: 24px; text-align: center; }
        .hk-team { background: white; border: 1px solid #E0F2FE; border-radius: 14px; padding: 24px; transition: box-shadow 0.2s, transform 0.2s; }
        .hk-team:hover { box-shadow: 0 8px 24px rgba(14,165,233,0.1); transform: translateY(-2px); }
        .hk-value { background: #F8FAFF; border-radius: 12px; padding: 24px; border-left: 3px solid #0EA5E9; }
        .hk-method-row { display: grid; grid-template-columns: 180px 1fr 1fr; gap: 0; border-bottom: 1px solid #E0F2FE; }
        @media (max-width: 640px) {
          .hk-method-row { grid-template-columns: 1fr; }
          .hk-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .hk-team-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <SubPageNav onGoHome={onGoHome} onGoLogin={onGoLogin} onGoPage={onGoPage} activeId="hakkimizda" />

      <section style={{ background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F8FAFF 100%)", padding: "72px 48px 64px", borderBottom: "1px solid #E0F2FE" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <SectionEyebrow>{t("aboutTagline")}</SectionEyebrow>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: "900", margin: "0 0 24px", color: "#0C4A6E", letterSpacing: "-0.03em", lineHeight: "1.1" }}>
            {t("aboutTitle")}
          </h1>
          <p style={{ fontSize: "18px", color: "#475569", lineHeight: "1.8", maxWidth: "640px", margin: "0 0 36px" }}>
            {t("aboutSubtitle")}
          </p>
          <button onClick={() => setDemoAcik(true)} style={{
            padding: "13px 32px", border: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
            color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>{t("navDemoRequest")}</button>
        </div>
      </section>

      <section style={{ padding: "60px 48px", background: "white" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className="hk-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            {[
              { sayi: t("aboutStat1Count"), baslik: t("aboutStat1Title"), alt: t("aboutStat1Sub") },
              { sayi: t("aboutStat2Count"), baslik: t("aboutStat2Title"), alt: t("aboutStat2Sub") },
              { sayi: t("aboutStat3Count"), baslik: t("aboutStat3Title"), alt: t("aboutStat3Sub") },
              { sayi: t("aboutStat4Count"), baslik: t("aboutStat4Title"), alt: t("aboutStat4Sub") },
            ].map(s => (
              <div key={s.baslik} className="hk-stat">
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "32px", fontWeight: "900", color: "#0284C7", marginBottom: "4px" }}>{s.sayi}</div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0C4A6E", marginBottom: "4px" }}>{s.baslik}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{s.alt}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "64px 48px", background: "#F8FAFF" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "60px", alignItems: "center" }}>
          <div>
            <SectionEyebrow>{t("storyTagline")}</SectionEyebrow>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 3vw, 34px)", fontWeight: "800", margin: "0 0 20px", color: "#0C4A6E", letterSpacing: "-0.02em" }}>{t("storyTitle")}</h2>
            <p style={{ fontSize: "15px", color: "#64748B", lineHeight: "1.85", marginBottom: "16px" }}>{t("storyP1")}</p>
            <p style={{ fontSize: "15px", color: "#64748B", lineHeight: "1.85", marginBottom: "16px" }}>{t("storyP2")}</p>
            <p style={{ fontSize: "15px", color: "#64748B", lineHeight: "1.85" }}>{t("storyP3")}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { baslik: t("val1Title"), desc: t("val1Desc") },
              { baslik: t("val2Title"), desc: t("val2Desc") },
              { baslik: t("val3Title"), desc: t("val3Desc") },
              { baslik: t("val4Title"), desc: t("val4Desc") },
            ].map(v => (
              <div key={v.baslik} className="hk-value">
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#0C4A6E", marginBottom: "4px" }}>{v.baslik}</div>
                <div style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.65" }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "64px 48px", background: "white" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionEyebrow>{t("methodPageTagline")}</SectionEyebrow>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 3vw, 34px)", fontWeight: "800", margin: "0 0 32px", color: "#0C4A6E", letterSpacing: "-0.02em" }}>
            {t("methodPageTitle")}
          </h2>
          <div style={{ border: "1px solid #E0F2FE", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#F8FAFF", padding: "14px 20px", borderBottom: "1px solid #E0F2FE" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.04em" }}>{t("methodColMod")}</span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.04em" }}>{t("methodColRef")}</span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.04em" }}>{t("methodColFormula")}</span>
            </div>
            {[
              { modul: t("amethod1Mod"), ref: t("amethod1Ref"), formul: t("amethod1Formula") },
              { modul: t("amethod2Mod"), ref: t("amethod2Ref"), formul: t("amethod2Formula") },
              { modul: t("amethod3Mod"), ref: t("amethod3Ref"), formul: t("amethod3Formula") },
              { modul: t("amethod4Mod"), ref: t("amethod4Ref"), formul: t("amethod4Formula") },
              { modul: t("amethod5Mod"), ref: t("amethod5Ref"), formul: t("amethod5Formula") },
              { modul: t("amethod6Mod"), ref: t("amethod6Ref"), formul: t("amethod6Formula") },
            ].map((row, i) => (
              <div key={row.modul} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "16px 20px", background: i % 2 === 0 ? "white" : "#FAFCFF", borderBottom: i < 5 ? "1px solid #E0F2FE" : "none", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0C4A6E" }}>{row.modul}</span>
                <span style={{ fontSize: "12px", color: "#0EA5E9", fontWeight: "600" }}>{row.ref}</span>
                <span style={{ fontSize: "12px", color: "#64748B", fontFamily: "'DM Mono', monospace" }}>{row.formul}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "64px 48px", background: "#F8FAFF" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionEyebrow>{t("teamTagline")}</SectionEyebrow>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(24px, 3vw, 34px)", fontWeight: "800", margin: "0 0 32px", color: "#0C4A6E", letterSpacing: "-0.02em" }}>
            {t("teamTitle")}
          </h2>
          <div className="hk-team-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {[
              { ad: "Damla Akyüz", unvan: "Kurucu · Zemin Mühendisi", bio: "İTÜ İnşaat Mühendisliği mezunu. 8 yıl saha deneyimi. Fore kazık ve ankraj projelerinde uzman.", avatar: "DA", renk: "#0284C7" },
              { ad: "Mert Doğan", unvan: "Teknik Direktör · MSc Geoteknik", bio: "Boğaziçi Üniversitesi. Trakya ve Marmara bölgesi zemin etüdleri. ROP kalibrasyonu araştırmacısı.", avatar: "MD", renk: "#0369A1" },
              { ad: "Selin Yıldız", unvan: "Yazılım Mühendisi", bio: "ODTÜ Bilgisayar Mühendisliği. Hesap motoru ve veri modeli geliştirme. Geoteknik hesaplama sistemleri.", avatar: "SY", renk: "#0EA5E9" },
            ].map(p => (
              <div key={p.ad} className="hk-team">
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: `linear-gradient(135deg, ${p.renk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "white", flexShrink: 0 }}>{p.avatar}</div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E" }}>{p.ad}</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600" }}>{p.unvan}</div>
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: 0 }}>{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 48px", background: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 50%, #0284C7 100%)", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: "800", margin: "0 0 16px", color: "white", letterSpacing: "-0.02em" }}>
          {t("aboutCtaTitle")}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "16px", margin: "0 0 36px" }}>
          {t("aboutCtaDesc")}
        </p>
        <button onClick={() => setDemoAcik(true)} style={{ padding: "14px 36px", border: "none", borderRadius: "8px", background: "white", color: "#0284C7", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {t("navDemoRequest")}
        </button>
      </section>

      <SubPageFooter onGoHome={onGoHome} />
    </div>
  )
}

// ─── Blog Sayfası ─────────────────────────────────────────────────────────────

const ALL_BLOG_POSTS = [
  {
    id: 1,
    kategori: "Saha Deneyimi",
    baslik: "Trakya Formasyonunda Fore Kazık Delgi Sürelerini Etkileyen Faktörler",
    ozet: "Silivri ve Çerkezköy bölgelerinde yürütülen 40+ projenin verileri ışığında, kumtaşı dominantlı Trakya formasyonunda penetrasyon hızını etkileyen parametreler incelendi.",
    yazar: { ad: "Mert Doğan", unvan: "Geoteknik Müh., MSc", avatar: "MD" },
    tarih: "28 Mart 2026", okumaSuresi: 6,
    resimRenk: "#0284C7", etiketler: ["Kumtaşı", "ROP", "Trakya"],
    featured: true,
  },
  {
    id: 2,
    kategori: "Teknik Rehber",
    baslik: "SPT Verilerinden Makine Seçimine: Adım Adım Karar Analizi",
    ozet: "N-değeri bazlı SPT sonuçlarını doğrudan tork hesabına nasıl entegre edersiniz? Kelly rotary sistemleri için pratik bir metodoloji.",
    yazar: { ad: "Damla Akyüz", unvan: "Zemin Mühendisi", avatar: "DA" },
    tarih: "15 Mart 2026", okumaSuresi: 8,
    resimRenk: "#0369A1", etiketler: ["SPT", "Makine Seçimi", "Tork"],
  },
  {
    id: 3,
    kategori: "Mühendislik Notu",
    baslik: "Casing Tasarımında Yeraltı Suyu Tablasının Etkisi",
    ozet: "EN 1536 ve Eurocode 7 çerçevesinde yeraltı suyu seviyesinin casing uzunluğu kararlarına nasıl yansıtıldığı ve GeoDrill'in bu kararı nasıl otomatikleştirdiği.",
    yazar: { ad: "Mert Doğan", unvan: "Geoteknik Müh., MSc", avatar: "MD" },
    tarih: "5 Mart 2026", okumaSuresi: 5,
    resimRenk: "#0EA5E9", etiketler: ["Casing", "Yeraltı Suyu", "EN 1536"],
  },
  {
    id: 4,
    kategori: "Teknik Rehber",
    baslik: "RQD Değerini Doğru Okumak: Saha Kaydından Hesap Motoruna",
    ozet: "Rock Quality Designation'ı yalnızca bir yüzde olarak değil, zemin katmanı sertlik ve kırılganlık göstergesi olarak nasıl yorumlarsınız? GeoDrill'in RQD kullanım mantığı.",
    yazar: { ad: "Selin Yıldız", unvan: "Yazılım Mühendisi", avatar: "SY" },
    tarih: "20 Şubat 2026", okumaSuresi: 7,
    resimRenk: "#0284C7", etiketler: ["RQD", "Kaya Kalitesi", "ISRM"],
  },
  {
    id: 5,
    kategori: "Saha Deneyimi",
    baslik: "İstanbul Avrupa Yakası'nda Kireçtaşı Formasyonu: Vaka Çalışması",
    ozet: "Bakırköy ve Bahçelievler ekseninde yürütülen 12 projenin zemin raporu verileri analiz edilerek kireçtaşı formasyonunda tork ve ROP değişkenliği incelendi.",
    yazar: { ad: "Damla Akyüz", unvan: "Zemin Mühendisi", avatar: "DA" },
    tarih: "8 Şubat 2026", okumaSuresi: 9,
    resimRenk: "#0369A1", etiketler: ["Kireçtaşı", "İstanbul", "Vaka Çalışması"],
  },
  {
    id: 6,
    kategori: "Mühendislik Notu",
    baslik: "Fore Kazık Maliyet Analizi: Saatlik Maliyet Hesabının Detayları",
    ozet: "Yakıt tüketimi, amortisman, operatör maliyeti ve sarf malzeme kalemlerini birleştiren eksiksiz maliyet modeli. GeoDrill Fiyat Analizi modülünün hesap mantığı.",
    yazar: { ad: "Mert Doğan", unvan: "Geoteknik Müh., MSc", avatar: "MD" },
    tarih: "28 Ocak 2026", okumaSuresi: 6,
    resimRenk: "#0EA5E9", etiketler: ["Maliyet", "Fiyat Analizi", "Amortisman"],
  },
]

function BlogSayfasi({ onGoHome, onGoLogin, onGoPost, onGoPage, posts }) {
  const [aktifKategori, setAktifKategori] = useState("Tümü")
  const kategoriler = ["Tümü", "Saha Deneyimi", "Teknik Rehber", "Mühendislik Notu"]
  const sourcePosts = posts?.length ? posts : ALL_BLOG_POSTS
  const filtered = aktifKategori === "Tümü" ? sourcePosts : sourcePosts.filter(p => p.kategori === aktifKategori)
  const featured = sourcePosts.find(p => p.featured)
  const { t } = useLang()

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#fff", color: "#0C4A6E", minHeight: "100vh" }}>
      <SubPageNav onGoHome={onGoHome} onGoLogin={onGoLogin} onGoPage={onGoPage} activeId="blog" />

      <section style={{ background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F8FAFF 100%)", padding: "64px 48px 48px", borderBottom: "1px solid #E0F2FE" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionEyebrow>{t("blogTagline")}</SectionEyebrow>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(30px, 4.5vw, 48px)", fontWeight: "900", margin: "0 0 16px", color: "#0C4A6E", letterSpacing: "-0.03em", lineHeight: "1.1" }}>
            {t("blogTitle")}
          </h1>
          <p style={{ fontSize: "17px", color: "#475569", lineHeight: "1.75", maxWidth: "560px", margin: 0 }}>
            {t("blogSubtitle")}
          </p>
        </div>
      </section>

      {featured && aktifKategori === "Tümü" && (
        <section style={{ padding: "48px 48px 0", maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#0EA5E9", letterSpacing: "3px" }}>{t("featuredTag")}</span>
          </div>
          <button onClick={() => onGoPost(featured)} style={{
            width: "100%", background: "white", border: "1px solid #E0F2FE", borderRadius: "16px",
            padding: "0", textAlign: "left", cursor: "pointer", overflow: "hidden",
            transition: "box-shadow 0.2s, transform 0.2s", fontFamily: "'Plus Jakarta Sans', sans-serif",
            borderTop: `4px solid ${featured.resimRenk}`,
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 16px 40px rgba(14,165,233,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div style={{ padding: "32px 36px", display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
                  <span style={{ padding: "4px 12px", background: `${featured.resimRenk}18`, color: featured.resimRenk, borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em" }}>{featured.kategori.toUpperCase()}</span>
                  <span style={{ color: "#CBD5E1", fontSize: "11px" }}>·</span>
                  <span style={{ fontSize: "12px", color: "#94A3B8" }}>{featured.okumaSuresi} {t("minRead")}</span>
                </div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(20px, 2.5vw, 26px)", fontWeight: "800", margin: "0 0 12px", color: "#0C4A6E", lineHeight: "1.25", letterSpacing: "-0.02em" }}>{featured.baslik}</h2>
                <p style={{ fontSize: "14px", color: "#64748B", lineHeight: "1.7", margin: "0 0 20px" }}>{featured.ozet}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `linear-gradient(135deg, ${featured.resimRenk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: "white" }}>{featured.yazar.avatar}</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0C4A6E" }}>{featured.yazar.ad}</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8" }}>{featured.tarih}</div>
                  </div>
                </div>
              </div>
              <div style={{ color: "#BAE6FD", fontSize: "64px", fontFamily: "'Fraunces', serif", fontWeight: "900", lineHeight: 1, userSelect: "none" }}>01</div>
            </div>
          </button>
        </section>
      )}

      <section style={{ padding: "32px 48px 0", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {kategoriler.map(k => (
            <button key={k} onClick={() => setAktifKategori(k)} style={{
              padding: "7px 18px", borderRadius: "20px", border: "1.5px solid",
              borderColor: aktifKategori === k ? "#0EA5E9" : "#E0F2FE",
              background: aktifKategori === k ? "#EFF6FF" : "white",
              color: aktifKategori === k ? "#0284C7" : "#64748B",
              fontSize: "13px", fontWeight: "600", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 0.15s",
            }}>{k === "Tümü" ? t("allFilter") : k}</button>
          ))}
        </div>
      </section>

      <section style={{ padding: "32px 48px 80px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {filtered.filter(p => !(p.featured && aktifKategori === "Tümü")).map(post => (
            <LandingBlogCard key={post.id} post={post} onClick={() => onGoPost(post)} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
            <div style={{ fontSize: "14px" }}>{t("noBlogPosts")}</div>
          </div>
        )}
      </section>

      <SubPageFooter onGoHome={onGoHome} />
    </div>
  )
}

// ─── SSS Sayfası ─────────────────────────────────────────────────────────────

const SSS_KATEGORILER = [
  {
    baslik: "Genel",
    icon: "📋",
    sorular: [
      { soru: "GeoDrill hangi zemin tiplerini destekler?", cevap: "Dolgu, Kil, Silt, Kum, Çakıl, Ayrışmış Kaya, Kumtaşı, Kireçtaşı ve Sert Kaya — toplam 9 zemin tipi. Her tip için ayrı stabilite, ROP ve tork katsayıları uygulanmaktadır." },
      { soru: "Birden fazla kullanıcı sistemi kullanabilir mi?", cevap: "Evet. Her kullanıcı kendi hesabıyla giriş yapar; projeler ve makine parkı kişiye özel ayrı tutulur. Firmalar demo hesabı talebiyle başlayabilir, ihtiyaca göre hesap sayısı artırılabilir." },
      { soru: "Mobil cihazlarda çalışıyor mu?", cevap: "Evet, tüm modern tarayıcılarda ve mobil cihazlarda çalışmaktadır. Saha koşullarında tablet veya telefon üzerinden veri girişi yapılabilmektedir." },
      { soru: "Verilerim güvende mi?", cevap: "Tüm veriler şifreli bağlantı (HTTPS) üzerinden iletilir, sunucu tarafında JWT kimlik doğrulama ile korunur. Her kullanıcı yalnızca kendi projelerine erişebilir." },
    ]
  },
  {
    baslik: "Teknik",
    icon: "⚙️",
    sorular: [
      { soru: "Hesaplamalar ne kadar doğru?", cevap: "Hesap motoru FHWA GEC 10, EN 1536:2010 ve Eurocode 7 standartlarına dayanmaktadır. ROP tahminleri Trakya, Marmara ve İç Anadolu bölgesi saha verileriyle kalibre edilmiştir. SPT, UCS ve CPT girildiğinde hesap güveni 'Yüksek' bandına çıkar." },
      { soru: "Yeraltı suyu verisi girilmezse ne olur?", cevap: "Sistem güvenli tarafta kalır: kohezyonsuz katmanlarda su varlığı varsayılmaz, ancak hesap güven puanından 10 puan düşer ve casing kararında 'şartlı' değerlendirme yapılır. Saha ölçümü girmek her zaman daha doğru sonuç üretir." },
      { soru: "Hangi kazık tipleri destekleniyor?", cevap: "Fore Kazık, Ankraj ve Mini Kazık tipleri desteklenmektedir. Her tip için farklı tork katsayıları ve casing gereksinimleri uygulanmaktadır." },
      { soru: "Birden fazla zemin katmanı girilebilir mi?", cevap: "Evet, teorik olarak sınırsız zemin katmanı tanımlanabilir. Her katman için derinlik aralığı, zemin tipi, SPT, UCS ve RQD ayrı ayrı girilir. Tork hesabında kritik katman otomatik belirlenir." },
      { soru: "Kazık çapı ve boyu neyi etkiler?", cevap: "Kazık çapı tork hesabını doğrudan etkiler (d³ ile orantılı). Kazık boyu toplam delme süresini ve yakıt tüketimini belirler. Casing hesabında zemin katmanlarının boyu ile kazık boyu birlikte değerlendirilir." },
    ]
  },
  {
    baslik: "Raporlar",
    icon: "📄",
    sorular: [
      { soru: "PDF raporlar kurumsal sunumlara uygun mu?", cevap: "Evet. Raporlar proje özeti, teknik analiz tabloları, makine uygunluk matrisi ve hesap gerekçelerini içermektedir. Logosu ve renk teması GeoDrill standardındadır; kurumsal ihtiyaçlar için özelleştirme planlanmaktadır." },
      { soru: "CSV dışa aktarım yapılabiliyor mu?", cevap: "Evet. Zemin log verisi ve analiz sonuçları CSV formatında indirilebilir. Bu veriler Excel veya farklı hesaplama araçlarında kullanılabilir." },
      { soru: "Raporlar hangi dillerde üretilebilir?", cevap: "Şu anda tüm raporlar Türkçe üretilmektedir. İngilizce rapor desteği yol haritasında yer almaktadır." },
    ]
  },
]

function SSSSayfasi({ onGoHome, onGoLogin, onGoPage, setDemoAcik }) {
  const [aktifKat, setAktifKat] = useState(0)
  const { t } = useLang()
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#fff", color: "#0C4A6E", minHeight: "100vh" }}>
      <SubPageNav onGoHome={onGoHome} onGoLogin={onGoLogin} onGoPage={onGoPage} activeId="sss" />

      <section style={{ background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F8FAFF 100%)", padding: "64px 48px 56px", borderBottom: "1px solid #E0F2FE" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <SectionEyebrow centered>{t("faqTagline")}</SectionEyebrow>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(30px, 4.5vw, 46px)", fontWeight: "900", margin: "0 0 16px", color: "#0C4A6E", letterSpacing: "-0.03em" }}>
            {t("faqTitle")}
          </h1>
          <p style={{ fontSize: "17px", color: "#475569", lineHeight: "1.75", margin: 0 }}>
            {t("faqSubtitle")}
          </p>
        </div>
      </section>

      <section style={{ padding: "48px 48px 80px" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "32px", flexWrap: "wrap" }}>
            {[
              { icon: "📋", label: t("sssKat1"), items: SSS_KATEGORILER[0].sorular },
              { icon: "⚙️", label: t("sssKat2"), items: SSS_KATEGORILER[1].sorular },
              { icon: "📄", label: t("sssKat3"), items: SSS_KATEGORILER[2].sorular },
            ].map((kat, i) => (
              <button key={i} onClick={() => setAktifKat(i)} style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "9px 20px", borderRadius: "8px",
                border: "1.5px solid", borderColor: aktifKat === i ? "#0EA5E9" : "#E0F2FE",
                background: aktifKat === i ? "#EFF6FF" : "white",
                color: aktifKat === i ? "#0284C7" : "#64748B",
                fontSize: "14px", fontWeight: "600", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
              }}>
                <span>{kat.icon}</span>
                {kat.label}
              </button>
            ))}
          </div>

          <div>
            {SSS_KATEGORILER[aktifKat].sorular.map((item, i) => <SSSItem key={i} item={item} />)}
          </div>

          <div style={{ marginTop: "48px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "14px", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", marginBottom: "6px" }}>Yanıtınızı bulamadınız mı?</div>
              <div style={{ fontSize: "13px", color: "#64748B" }}>Makine seçimi, veri seti uygunluğu veya demo kapsamı gibi daha spesifik sorular için ekibimize yazın.</div>
            </div>
            <button onClick={() => onGoPage("iletisim")} style={{
              padding: "10px 24px", border: "none", borderRadius: "8px",
              background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
              color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap",
            }}>Sorumu ilet</button>
          </div>

          <div style={{ marginTop: "14px", background: "white", border: "1px solid #E0F2FE", borderRadius: "14px", padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", marginBottom: "6px" }}>Canlı örnek görmek daha mı faydalı olur?</div>
              <div style={{ fontSize: "13px", color: "#64748B" }}>Kendi proje senaryonuzla sistemin nasıl öneri verdiğini demo akışında birlikte inceleyebiliriz.</div>
            </div>
            <button onClick={() => setDemoAcik(true)} style={{
              padding: "10px 24px", borderRadius: "8px", border: "1.5px solid #BAE6FD",
              background: "white", color: "#0284C7", fontSize: "14px", fontWeight: "700",
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>Demo talep et</button>
          </div>
        </div>
      </section>

      <SubPageFooter onGoHome={onGoHome} />
    </div>
  )
}

// ─── İletişim Sayfası ─────────────────────────────────────────────────────────

function IletisimSayfasi({ onGoHome, onGoPage, setDemoAcik }) {
  const { t } = useLang()
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#fff", color: "#0C4A6E", minHeight: "100vh" }}>
      <SubPageNav onGoHome={onGoHome} onGoPage={onGoPage} activeId="iletisim" />

      <section style={{ background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F8FAFF 100%)", padding: "64px 48px 56px", borderBottom: "1px solid #E0F2FE" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <SectionEyebrow>{t("contactTagline")}</SectionEyebrow>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(30px, 4.5vw, 46px)", fontWeight: "900", margin: "0 0 16px", color: "#0C4A6E", letterSpacing: "-0.03em" }}>
            {t("contactTitle")}
          </h1>
          <p style={{ fontSize: "17px", color: "#475569", lineHeight: "1.75", maxWidth: "620px", margin: 0 }}>
            Demo planlamak, veri yapınızın uygunluğunu değerlendirmek veya teknik sorularınızı iletmek için bize yazın.
          </p>
        </div>
      </section>

      <section style={{ padding: "64px 48px 80px" }}>
        <div className="contact-grid" style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "64px", alignItems: "start" }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: "800", margin: "0 0 28px", color: "#0C4A6E" }}>{t("contactChannelsTitle")}</h2>
            {[
              { icon: "✉️", baslik: t("contactItemEmail"), deger: "info@geodrillinsight.com", alt: "Genel sorular, demo planlama ve ürün bilgilendirme için." },
              { icon: "💼", baslik: t("contactItemPartner"), deger: "partner@geodrillinsight.com", alt: "İş ortaklığı, entegrasyon ve kurum içi kullanım senaryoları için." },
              { icon: "📍", baslik: t("contactItemOffice"), deger: "Maslak, İstanbul", alt: "Görüşmeler ağırlıklı olarak çevrim içi yapılır, ofis buluşmaları planlanabilir." },
              { icon: "🕐", baslik: t("contactItemResponse"), deger: t("contactItemResponseVal"), alt: "Demo taleplerinde kapsam ve uygunluk bilgisi ile dönüş yapılır." },
            ].map(c => (
              <div key={c.baslik} style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px", padding: "16px", background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "10px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#EFF6FF", border: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.04em", marginBottom: "3px" }}>{c.baslik.toUpperCase()}</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#0C4A6E", marginBottom: "3px" }}>{c.deger}</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8" }}>{c.alt}</div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: "12px", background: "linear-gradient(135deg, #0C4A6E, #0284C7)", borderRadius: "14px", padding: "24px", color: "white" }}>
              <div style={{ fontSize: "15px", fontWeight: "800", fontFamily: "'Fraunces', serif", marginBottom: "8px" }}>Demo için ideal misiniz?</div>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 16px", lineHeight: "1.6" }}>
                Elinizde örnek zemin logu, hedef kazık tipi veya makine parkı bilgisi varsa demo görüşmesinde çok daha net çıktı alırsınız.
              </p>
              <button onClick={() => setDemoAcik(true)} style={{ padding: "10px 22px", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "8px", background: "transparent", color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Demo talep et
              </button>
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: "800", margin: "0 0 10px", color: "#0C4A6E" }}>Bize kısa bir not bırakın</h2>
            <p style={{ fontSize: "13px", color: "#64748B", lineHeight: "1.7", margin: "0 0 24px" }}>
              İsterseniz ürün hakkında genel bilgi isteyin, isterseniz doğrudan “fore kazık için süre ve maliyet akışını görmek istiyorum” gibi somut bir ihtiyaç paylaşın.
            </p>
            <IletisimForm onDemoAc={() => setDemoAcik(true)} />
          </div>
        </div>
      </section>

      <section style={{ padding: "0 48px 64px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "14px", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#0C4A6E", marginBottom: "6px" }}>Önce sık sorulan teknik detaylara mı bakmak istersiniz?</div>
              <div style={{ fontSize: "13px", color: "#64748B" }}>Desteklenen veri tipleri, hesap doğruluğu ve raporlama mantığı için SSS sayfasını inceleyebilirsiniz.</div>
            </div>
            <button onClick={() => onGoPage("sss")} style={{ padding: "10px 24px", border: "1.5px solid #BAE6FD", borderRadius: "8px", background: "white", color: "#0284C7", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SSS sayfasına git
            </button>
          </div>
        </div>
      </section>

      <SubPageFooter onGoHome={onGoHome} />
    </div>
  )
}