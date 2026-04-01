import { useState } from "react"
import { bulkReplaceEquipment, fromSnakeMakine } from "./api"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"

const MAKINE_TIPLERI = ["Fore Kazık", "Ankraj", "Mini Kazık"]
const CASING_SECENEKLER = ["Evet", "Hayır", "Şartlı"]
const DAR_ALAN = ["Evet", "Hayır"]
const YAKIT_SINIFI = ["Düşük", "Orta", "Yüksek"]

const thStyle = {
  padding: "12px 14px", textAlign: "left",
  fontSize: "12px", fontWeight: "700",
  color: "var(--text-secondary)", textTransform: "uppercase",
  letterSpacing: "0.5px", whiteSpace: "nowrap"
}

const tdStyle = { padding: "8px 6px", verticalAlign: "middle" }

const cellInput = {
  width: "100%", padding: "7px 10px",
  border: "1.5px solid var(--input-border)", borderRadius: "6px",
  fontSize: "13px", outline: "none", boxSizing: "border-box",
  color: "var(--input-text)", background: "var(--input-bg)"
}

const DEFAULT_MAKINE = () => ({
  id: Date.now() + Math.random(),
  ad: "", tip: "Fore Kazık", marka: "",
  maxDerinlik: 24, maxCap: 1000, tork: 180,
  casing: "Evet", darAlan: "Hayır", yakitSinifi: "Orta", not: ""
})

const DEFAULT_MAKINELER = [
  { id: 1, ad: "Rig A", tip: "Fore Kazık", marka: "Bauer BG", maxDerinlik: 24, maxCap: 1000, tork: 180, casing: "Evet", darAlan: "Hayır", yakitSinifi: "Orta", not: "Standart saha makinesi" },
  { id: 2, ad: "Rig B", tip: "Fore Kazık", marka: "Soilmec SR", maxDerinlik: 36, maxCap: 1500, tork: 260, casing: "Evet", darAlan: "Hayır", yakitSinifi: "Yüksek", not: "Yüksek kapasiteli" },
  { id: 3, ad: "Rig C", tip: "Fore Kazık", marka: "Klemm KR", maxDerinlik: 20, maxCap: 800, tork: 130, casing: "Hayır", darAlan: "Evet", yakitSinifi: "Düşük", not: "Dar alan için uygun" },
]

function makineHatasi(m) {
  const h = {}
  if (!m.ad || !m.ad.trim()) h.ad = "Makine adı zorunlu"
  if (!(Number(m.tork) > 0)) h.tork = "> 0 olmalı"
  if (!(Number(m.maxDerinlik) > 0)) h.maxDerinlik = "> 0 olmalı"
  if (!(Number(m.maxCap) > 0)) h.maxCap = "> 0 olmalı"
  return h
}

export default function MakinePark({ data, onChange }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [showHatalar, setShowHatalar] = useState(false)
  const [silmeOnay, setSilmeOnay] = useState(null)
  const toast = useToast()

  const makineler = data.length > 0 ? data : DEFAULT_MAKINELER

  const updateRow = (id, field, value) => {
    onChange(makineler.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const addRow = () => onChange([...makineler, DEFAULT_MAKINE()])

  const removeRow = (id) => {
    if (makineler.length === 1) return
    setSilmeOnay(id)
  }

  const confirmRemove = () => {
    onChange(makineler.filter(m => m.id !== silmeOnay))
    setSilmeOnay(null)
  }

  const kaydet = async () => {
    const tumHatalar = makineler.map(makineHatasi)
    const herhangiHata = tumHatalar.some(h => Object.keys(h).length > 0)
    if (herhangiHata) {
      setShowHatalar(true)
      toast.error("Satırlardaki hataları düzeltin.")
      return
    }
    setShowHatalar(false)
    setKayitDurumu("loading")
    try {
      const kaydedilenler = await bulkReplaceEquipment(makineler)
      onChange(kaydedilenler.map(fromSnakeMakine))
      setKayitDurumu(null)
      toast.success("Makine parkı kaydedildi.")
    } catch (e) {
      setKayitDurumu(null)
      toast.error(e.message)
    }
  }

  return (
    <div>
      <ConfirmDialog
        open={silmeOnay !== null}
        title="Makine Silinsin mi?"
        message="Bu makineyi silmek istediginize emin misiniz? Bu islem geri alinamaz."
        onConfirm={confirmRemove}
        onCancel={() => setSilmeOnay(null)}
      />
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>
            Makine Parkı
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
            Bu projede kullanılabilecek makineleri düzenleyin
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
            {kayitDurumu === "loading" ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div style={{
        background: "var(--bg-card)", borderRadius: "12px",
        border: "1px solid var(--input-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
            <thead>
              <tr style={{ background: "var(--badge-muted-bg)", borderBottom: "2px solid var(--input-border)" }}>
                <th style={thStyle}>Makine Adı</th>
                <th style={thStyle}>Tip</th>
                <th style={thStyle}>Marka/Model</th>
                <th style={thStyle}>Max Derinlik (m)</th>
                <th style={thStyle}>Max Çap (mm)</th>
                <th style={thStyle}>Tork (kNm)</th>
                <th style={thStyle}>Casing</th>
                <th style={thStyle}>Dar Alan</th>
                <th style={thStyle}>Yakıt</th>
                <th style={thStyle}>Not</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {makineler.map((m, idx) => {
                const mh = showHatalar ? makineHatasi(m) : {}
                const errStyle = (key) => mh[key] ? { borderColor: "#FCA5A5" } : {}
                return (
                <tr key={m.id} style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  background: idx % 2 === 0 ? "var(--bg-card)" : "var(--row-alt)"
                }}>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "110px", ...errStyle("ad") }}
                      value={m.ad} placeholder="Rig A"
                      title={mh.ad || ""}
                      onChange={e => updateRow(m.id, "ad", e.target.value)} />
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "120px", cursor: "pointer", background: "var(--input-bg)" }}
                      value={m.tip} onChange={e => updateRow(m.id, "tip", e.target.value)}>
                      {MAKINE_TIPLERI.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "120px" }}
                      value={m.marka} placeholder="Bauer BG"
                      onChange={e => updateRow(m.id, "marka", e.target.value)} />
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "80px", ...errStyle("maxDerinlik") }} type="number"
                      value={m.maxDerinlik} min="1" title={mh.maxDerinlik || ""}
                      onChange={e => updateRow(m.id, "maxDerinlik", parseInt(e.target.value))} />
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "90px", ...errStyle("maxCap") }} type="number"
                      value={m.maxCap} min="100" step="50" title={mh.maxCap || ""}
                      onChange={e => updateRow(m.id, "maxCap", parseInt(e.target.value))} />
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "80px", ...errStyle("tork") }} type="number"
                      value={m.tork} min="0" title={mh.tork || ""}
                      onChange={e => updateRow(m.id, "tork", parseInt(e.target.value))} />
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "90px", cursor: "pointer", background: "var(--input-bg)" }}
                      value={m.casing} onChange={e => updateRow(m.id, "casing", e.target.value)}>
                      {CASING_SECENEKLER.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "80px", cursor: "pointer", background: "var(--input-bg)" }}
                      value={m.darAlan} onChange={e => updateRow(m.id, "darAlan", e.target.value)}>
                      {DAR_ALAN.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "90px", cursor: "pointer", background: "var(--input-bg)" }}
                      value={m.yakitSinifi} onChange={e => updateRow(m.id, "yakitSinifi", e.target.value)}>
                      {YAKIT_SINIFI.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "140px" }}
                      value={m.not} placeholder="Notlar..."
                      onChange={e => updateRow(m.id, "not", e.target.value)} />
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => removeRow(m.id)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#CBD5E1", fontSize: "18px", padding: "4px", borderRadius: "4px"
                    }}>✕</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #F1F5F9" }}>
          <button onClick={addRow} style={{
            padding: "9px 20px", background: "#E0F2FE", color: "#0EA5E9",
            border: "1.5px solid #BAE6FD", borderRadius: "8px",
            fontSize: "13px", fontWeight: "600", cursor: "pointer"
          }}>
            + Makine Ekle
          </button>
        </div>
      </div>
    </div>
  )
}
