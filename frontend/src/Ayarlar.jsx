import { useState, useEffect } from "react"
import { useToast } from "./Toast"
import { getMyCompany, createCompany, joinCompany } from "./api"
import { useLang } from "./LangContext"

const card = {
  background: "var(--bg-card)", borderRadius: "14px",
  border: "1px solid var(--input-border)", padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px",
}

const inp = {
  width: "100%", padding: "10px 14px",
  border: "1.5px solid var(--input-border)", borderRadius: "8px",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
  color: "var(--input-text)", background: "var(--input-bg)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}

const lbl = {
  display: "block", fontSize: "11px", fontWeight: "700",
  color: "var(--text-secondary)", letterSpacing: "0.05em",
  textTransform: "uppercase", marginBottom: "5px",
}

// ─── Plan kartları ────────────────────────────────────────────────────────────
const PLANLAR = [
  {
    id: "free", ad: "Free", renk: "#64748B", bg: "#F8FAFC", border: "#E2E8F0",
    fiyat: "Ücretsiz",
    ozellikler: ["5 analiz/ay", "3 proje", "PDF & Excel export", "Zemin log girişi"],
    eksik:      ["Firma dashboard", "Analiz arşivi", "Maliyet motoru", "Ekip hesapları"],
  },
  {
    id: "pro", ad: "Pro", renk: "#0369A1", bg: "#EFF6FF", border: "#BFDBFE",
    fiyat: "₺1.490 / ay",
    ozellikler: ["Sınırsız analiz", "Sınırsız proje", "Analiz arşivi & karşılaştırma", "Maliyet motoru", "Firma dashboard", "PDF kurumsal rapor", "Öncelikli destek"],
    eksik:      ["Ekip hesapları", "API erişimi"],
    populer: true,
  },
  {
    id: "enterprise", ad: "Enterprise", renk: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",
    fiyat: "Özel Teklif",
    ozellikler: ["Her şey Pro'da +", "Sınırsız ekip üyesi", "White-label PDF", "API erişimi", "SLA garantisi", "Özel eğitim"],
    eksik: [],
  },
]

function PlanKarti({ plan, aktif }) {
  const { t } = useLang()
  return (
    <div style={{
      background: plan.bg,
      border: `1.5px solid ${aktif ? plan.renk : plan.border}`,
      borderRadius: "12px", padding: "20px",
      boxShadow: aktif ? `0 4px 16px ${plan.renk}25` : "none",
      position: "relative",
    }}>
      {plan.populer && (
        <div style={{
          position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
          background: plan.renk, color: "white", fontSize: "10px", fontWeight: "700",
          padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.05em",
        }}>{t("popularBadge")}</div>
      )}
      {aktif && (
        <div style={{
          position: "absolute", top: "12px", right: "12px",
          background: plan.renk, color: "white", fontSize: "9px", fontWeight: "700",
          padding: "2px 8px", borderRadius: "20px", letterSpacing: "0.04em",
        }}>{t("activeBadge")}</div>
      )}
      <div style={{ fontSize: "15px", fontWeight: "800", color: plan.renk, marginBottom: "4px" }}>{plan.ad}</div>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>{plan.fiyat}</div>
      {plan.ozellikler.map(o => (
        <div key={o} style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "3px 0", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: plan.renk, fontWeight: "700" }}>✓</span> {o}
        </div>
      ))}
      {plan.eksik.map(o => (
        <div key={o} style={{ fontSize: "12px", color: "var(--text-muted)", padding: "3px 0", display: "flex", alignItems: "center", gap: "6px", opacity: 0.6 }}>
          <span>✗</span> {o}
        </div>
      ))}
      {!aktif && plan.id !== "enterprise" && (
        <button style={{
          marginTop: "14px", width: "100%", padding: "9px",
          background: plan.renk, color: "white", border: "none",
          borderRadius: "8px", fontSize: "12px", fontWeight: "700",
          cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {plan.id === "pro" ? t("upgradeBtn") : t("getQuote")}
        </button>
      )}
      {plan.id === "enterprise" && !aktif && (
        <button style={{
          marginTop: "14px", width: "100%", padding: "9px",
          background: "transparent", color: plan.renk,
          border: `1.5px solid ${plan.renk}`, borderRadius: "8px",
          fontSize: "12px", fontWeight: "700", cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {t("contactUs")}
        </button>
      )}
    </div>
  )
}

// ─── Şirket paneli ────────────────────────────────────────────────────────────
function SirketPaneli() {
  const [sirket, setSirket] = useState(null)
  const [sub, setSub] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [mod, setMod] = useState(null)  // "olustur" | "katil"
  const [form, setForm] = useState({ name: "", slug: "" })
  const [islem, setIslem] = useState(false)
  const toast = useToast()
  const { t } = useLang()

  useEffect(() => {
    getMyCompany()
      .then(d => { setSirket(d.company); setSub(d.subscription) })
      .catch(() => {})
      .finally(() => setYukleniyor(false))
  }, [])

  const slugOlustur = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

  const handleOlustur = async () => {
    if (!form.name.trim()) { toast.error(t("companyNameRequired")); return }
    setIslem(true)
    try {
      const slug = form.slug || slugOlustur(form.name)
      const yeni = await createCompany(form.name, slug)
      setSirket(yeni)
      setSub({ plan: "free", analyses_used: 0, analyses_limit: 5 })
      setMod(null)
      toast.success(t("companyCreated"))
    } catch (e) { toast.error(e.message) }
    finally { setIslem(false) }
  }

  const handleKatil = async () => {
    if (!form.slug.trim()) { toast.error(t("companySlugRequired")); return }
    setIslem(true)
    try {
      const yeni = await joinCompany(form.slug)
      setSirket(yeni)
      setMod(null)
      toast.success(t("companyJoined"))
    } catch (e) { toast.error(e.message) }
    finally { setIslem(false) }
  }

  if (yukleniyor) return <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "13px" }}>{t("loading")}</div>

  return (
    <div>
      {sirket ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "linear-gradient(135deg, #0369A1, #0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "18px", fontWeight: "700" }}>
              {sirket.name[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{sirket.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                <code style={{ background: "var(--row-alt)", padding: "1px 6px", borderRadius: "4px" }}>{sirket.slug}</code>
                {" "}· {sirket.plan?.toUpperCase()} plan
              </div>
            </div>
          </div>
          {sub && (
            <div style={{ padding: "10px 14px", background: "var(--row-alt)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em", marginBottom: "6px" }}>{t("usageThisMonthShort")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("analyses")}</span>
                <span style={{ fontSize: "12px", fontWeight: "700" }}>
                  {sub.analyses_used} / {sub.analyses_limit === 0 ? "∞" : sub.analyses_limit}
                </span>
              </div>
              {sub.analyses_limit > 0 && (
                <div style={{ height: "5px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, (sub.analyses_used / sub.analyses_limit) * 100)}%`,
                    height: "100%", background: sub.analyses_used >= sub.analyses_limit ? "#EF4444" : "#0EA5E9",
                    borderRadius: "3px",
                  }} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
            {t("noCompany")}
          </p>
          {!mod && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setMod("olustur")} style={{ padding: "9px 18px", background: "#0369A1", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                {t("createCompanyBtn")}
              </button>
              <button onClick={() => setMod("katil")} style={{ padding: "9px 18px", background: "transparent", color: "#0369A1", border: "1.5px solid #0369A1", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                {t("joinCompanyBtn")}
              </button>
            </div>
          )}
          {mod === "olustur" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div><label style={lbl}>{t("companyNameLabel")}</label>
                <input style={inp} value={form.name} placeholder="ABC Geoteknik A.Ş."
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugOlustur(e.target.value) }))} />
              </div>
              <div><label style={lbl}>{t("slugLabel")}</label>
                <input style={inp} value={form.slug} placeholder="abc-geoteknik"
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleOlustur} disabled={islem} style={{ padding: "9px 18px", background: "#0369A1", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                  {islem ? t("creating") : t("createBtn")}
                </button>
                <button onClick={() => setMod(null)} style={{ padding: "9px 18px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
          {mod === "katil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div><label style={lbl}>{t("companySlugLabel")}</label>
                <input style={inp} value={form.slug} placeholder="abc-geoteknik"
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleKatil} disabled={islem} style={{ padding: "9px 18px", background: "#0369A1", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                  {islem ? t("joining") : t("joinBtn")}
                </button>
                <button onClick={() => setMod(null)} style={{ padding: "9px 18px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export default function Ayarlar({ username, dark, onToggleDark }) {
  const [firmaBilgisi, setFirmaBilgisi] = useState({
    firmaAdi:    localStorage.getItem("gd_firma_adi") || "",
    firmaUnvan:  localStorage.getItem("gd_firma_unvan") || "",
    telefon:     localStorage.getItem("gd_telefon") || "",
    adres:       localStorage.getItem("gd_adres") || "",
  })
  const toast = useToast()
  const { t } = useLang()

  const set = (key) => (e) => setFirmaBilgisi(p => ({ ...p, [key]: e.target.value }))

  const kaydet = () => {
    localStorage.setItem("gd_firma_adi",    firmaBilgisi.firmaAdi)
    localStorage.setItem("gd_firma_unvan",  firmaBilgisi.firmaUnvan)
    localStorage.setItem("gd_telefon",      firmaBilgisi.telefon)
    localStorage.setItem("gd_adres",        firmaBilgisi.adres)
    toast.success(t("settingsSaved"))
  }

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>{t("settingsTitle")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>{t("settingsDesc")}</p>
      </div>

      {/* Hesap */}
      <div style={card}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          {t("accountSection")}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "20px", fontWeight: "700", flexShrink: 0 }}>
            {(username || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{username}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>GeoDrill Insight</div>
          </div>
        </div>
      </div>

      {/* Şirket / Workspace */}
      <div style={card}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          {t("companyWorkspaceSection")}
        </h3>
        <SirketPaneli />
      </div>

      {/* Firma bilgileri (PDF rapor için) */}
      <div style={card}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "4px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          {t("companyInfoSection")}
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>{t("companyInfoDesc")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {[
            { key: "firmaAdi",   label: t("companyNameLabel"), placeholder: "ABC Sondaj A.Ş." },
            { key: "firmaUnvan", label: t("fieldPosition"),    placeholder: "Geoteknik Mühendisi" },
            { key: "telefon",    label: t("fieldPhone"),       placeholder: "+90 212 xxx xx xx" },
            { key: "adres",      label: t("fieldAddressLoc"),  placeholder: "İstanbul, Türkiye" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <input style={inp} placeholder={placeholder} value={firmaBilgisi[key]} onChange={set(key)} />
            </div>
          ))}
        </div>
        <button onClick={kaydet} style={{ marginTop: "14px", padding: "10px 24px", border: "none", borderRadius: "8px", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "white", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
          {t("save")}
        </button>
      </div>

      {/* Görünüm */}
      <div style={card}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          {t("appearanceSection")}
        </h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>{t("darkMode")}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{t("darkModeDesc")}</div>
          </div>
          <button onClick={onToggleDark} style={{ width: "48px", height: "26px", borderRadius: "13px", border: "none", background: dark ? "#0EA5E9" : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: dark ? "25px" : "3px", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
      </div>

      {/* Abonelik planları */}
      <div style={card}>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "6px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          {t("subscriptionSection")}
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
          {t("upgradeEmailPre")}{" "}
          <a href="mailto:hello@geodrillinsight.com" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: "600" }}>
            hello@geodrillinsight.com
          </a>{" "}{t("upgradeEmailPost")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          {PLANLAR.map(plan => (
            <PlanKarti key={plan.id} plan={plan} aktif={plan.id === "free"} />
          ))}
        </div>
      </div>
    </div>
  )
}
