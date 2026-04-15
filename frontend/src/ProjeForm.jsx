import { useState } from "react"
import { createProject, updateProject } from "./api"
import { useToast } from "./Toast"
import { useLang } from "./LangContext"

const inputStyle = {
  width: "100%", padding: "10px 14px",
  border: "1.5px solid var(--input-border)", borderRadius: "8px",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
  color: "var(--input-text)", background: "var(--input-bg)"
}

const labelStyle = {
  color: "var(--text-secondary)", fontSize: "13px",
  fontWeight: "600", display: "block", marginBottom: "6px"
}

const selectStyle = { ...inputStyle, cursor: "pointer" }

function Field({ label, children, hata }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hata && <span style={{ color: "#DC2626", fontSize: "12px", marginTop: "4px", display: "block" }}>{hata}</span>}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "12px",
      border: "1px solid var(--input-border)", padding: "24px",
      marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
    }}>
      <h3 style={{
        color: "var(--heading)", fontSize: "15px",
        fontWeight: "700", marginBottom: "20px",
        paddingBottom: "12px", borderBottom: "2px solid var(--border-subtle)"
      }}>
        {title}
      </h3>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px"}}>
        {children}
      </div>
    </div>
  )
}

function dogrula(data, t) {
  const hatalar = {}
  if (!data.projeAdi || !data.projeAdi.trim()) hatalar.projeAdi = t("validProjectName")
  if (!(Number(data.kazikBoyu) > 0)) hatalar.kazikBoyu = t("validPositive")
  if (!(Number(data.kazikCapi) > 0)) hatalar.kazikCapi = t("validPositive")
  if (!(Number(data.kazikAdedi) > 0)) hatalar.kazikAdedi = t("validPositive")
  return hatalar
}

export default function ProjeForm({ data, onChange, projeId, onProjeIdChange }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [hatalar, setHatalar] = useState({})
  const toast = useToast()
  const { t } = useLang()

  const kaydet = async () => {
    const dogrulamaHatalari = dogrula(data, t)
    if (Object.keys(dogrulamaHatalari).length > 0) {
      setHatalar(dogrulamaHatalari)
      toast.error(t("fillRequired"))
      return
    }
    setHatalar({})
    setKayitDurumu("loading")
    try {
      if (projeId) {
        await updateProject(projeId, data)
      } else {
        const yeni = await createProject(data)
        onProjeIdChange(yeni.id)
      }
      setKayitDurumu(null)
      toast.success(t("projectSaved"))
    } catch (e) {
      setKayitDurumu(null)
      toast.error(e.message)
    }
  }

  return (
    <div>
      <div style={{marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between"}}>
        <div>
          <h2 style={{color: "var(--heading)", fontSize: "22px", fontWeight: "700"}}>
            {t("projectInfoTitle")}
          </h2>
          <p style={{color: "var(--text-muted)", fontSize: "14px", marginTop: "4px"}}>
            {t("projectInfoDesc")}
          </p>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: "12px", flexShrink: 0}}>
          <button
            onClick={kaydet}
            disabled={kayitDurumu === "loading"}
            style={{
              padding: "9px 22px",
              background: kayitDurumu === "loading" ? "#94A3B8" : "linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)",
              color: "white", border: "none", borderRadius: "8px",
              fontSize: "14px", fontWeight: "600",
              cursor: kayitDurumu === "loading" ? "not-allowed" : "pointer"
            }}
          >
            {kayitDurumu === "loading" ? t("saving") : projeId ? t("update") : t("save")}
          </button>
        </div>
      </div>

      <Card title={t("cardProjectDef")}>
        <Field label={t("fieldProjectName")} hata={hatalar.projeAdi}>
          <input
            style={{ ...inputStyle, borderColor: hatalar.projeAdi ? "#FCA5A5" : undefined }}
            value={data.projeAdi}
            onChange={e => { onChange("projeAdi", e.target.value); setHatalar(h => ({ ...h, projeAdi: "" })) }}
            placeholder="Örnek Kazık Projesi" />
        </Field>
        <Field label={t("fieldProjectCode")}>
          <input style={inputStyle} value={data.projeKodu}
            onChange={e => onChange("projeKodu", e.target.value)}
            placeholder="PRJ-001" />
        </Field>
        <Field label={t("fieldSiteCode")}>
          <input style={inputStyle} value={data.sahaKodu}
            onChange={e => onChange("sahaKodu", e.target.value)}
            placeholder="SH-01" />
        </Field>
        <Field label={t("fieldLocation")}>
          <input style={inputStyle} value={data.lokasyon}
            onChange={e => onChange("lokasyon", e.target.value)}
            placeholder="İstanbul" />
        </Field>
        <Field label={t("fieldJobType")}>
          <select style={selectStyle} value={data.isTipi}
            onChange={e => onChange("isTipi", e.target.value)}>
            <option>Fore Kazık</option>
            <option>Ankraj</option>
            <option>Mini Kazık</option>
          </select>
        </Field>
      </Card>

      <Card title={t("cardPileParams")}>
        <Field label={t("fieldPileLength")} hata={hatalar.kazikBoyu}>
          <input
            style={{ ...inputStyle, borderColor: hatalar.kazikBoyu ? "#FCA5A5" : undefined }}
            type="number" value={data.kazikBoyu}
            onChange={e => { onChange("kazikBoyu", parseFloat(e.target.value)); setHatalar(h => ({ ...h, kazikBoyu: "" })) }}
            min="1" step="0.5" />
        </Field>
        <Field label={t("fieldPileDiam")} hata={hatalar.kazikCapi}>
          <input
            style={{ ...inputStyle, borderColor: hatalar.kazikCapi ? "#FCA5A5" : undefined }}
            type="number" value={data.kazikCapi}
            onChange={e => { onChange("kazikCapi", parseInt(e.target.value)); setHatalar(h => ({ ...h, kazikCapi: "" })) }}
            min="100" step="50" />
        </Field>
        <Field label={t("fieldPileCount")} hata={hatalar.kazikAdedi}>
          <input
            style={{ ...inputStyle, borderColor: hatalar.kazikAdedi ? "#FCA5A5" : undefined }}
            type="number" value={data.kazikAdedi}
            onChange={e => { onChange("kazikAdedi", parseInt(e.target.value)); setHatalar(h => ({ ...h, kazikAdedi: "" })) }}
            min="1" />
        </Field>
        <Field label={t("fieldGroundwater")}>
          <input style={inputStyle} type="number" value={data.yeraltiSuyu}
            onChange={e => onChange("yeraltiSuyu", parseFloat(e.target.value))}
            min="0" step="0.5" />
        </Field>
      </Card>

      <Card title={t("cardNotes")}>
        <div style={{gridColumn: "1 / -1"}}>
          <Field label={t("fieldProjectNote")}>
            <textarea style={{...inputStyle, height: "80px", resize: "vertical"}}
              value={data.projeNotu}
              onChange={e => onChange("projeNotu", e.target.value)}
              placeholder={t("placeholderProjectNote")} />
          </Field>
        </div>
        <div style={{gridColumn: "1 / -1"}}>
          <Field label={t("fieldOfferNote")}>
            <textarea style={{...inputStyle, height: "80px", resize: "vertical"}}
              value={data.teklifNotu}
              onChange={e => onChange("teklifNotu", e.target.value)}
              placeholder={t("placeholderOfferNote")} />
          </Field>
        </div>
      </Card>
    </div>
  )
}
