import { useState } from "react"
import { bulkReplaceEquipment, fromSnakeMakine } from "./api"

const MAKINE_TIPLERI = ["Fore Kazık", "Ankraj", "Mini Kazık"]
const CASING_SECENEKLER = ["Evet", "Hayır", "Şartlı"]
const DAR_ALAN = ["Evet", "Hayır"]
const YAKIT_SINIFI = ["Düşük", "Orta", "Yüksek"]

const thStyle = {
  padding: "12px 14px", textAlign: "left",
  fontSize: "12px", fontWeight: "700",
  color: "#64748B", textTransform: "uppercase",
  letterSpacing: "0.5px", whiteSpace: "nowrap"
}

const tdStyle = { padding: "8px 6px", verticalAlign: "middle" }

const cellInput = {
  width: "100%", padding: "7px 10px",
  border: "1.5px solid #E2E8F0", borderRadius: "6px",
  fontSize: "13px", outline: "none", boxSizing: "border-box"
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

export default function MakinePark({ data, onChange }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [hata, setHata] = useState("")

  const makineler = data.length > 0 ? data : DEFAULT_MAKINELER

  const updateRow = (id, field, value) => {
    onChange(makineler.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const addRow = () => onChange([...makineler, DEFAULT_MAKINE()])

  const removeRow = (id) => {
    if (makineler.length === 1) return
    onChange(makineler.filter(m => m.id !== id))
  }

  const kaydet = async () => {
    setKayitDurumu("loading")
    setHata("")
    try {
      const kaydedilenler = await bulkReplaceEquipment(makineler)
      onChange(kaydedilenler.map(fromSnakeMakine))
      setKayitDurumu("ok")
      setTimeout(() => setKayitDurumu(null), 2000)
    } catch (e) {
      setHata(e.message)
      setKayitDurumu("error")
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ color: "#1B3A6B", fontSize: "22px", fontWeight: "700" }}>
            Makine Parkı
          </h2>
          <p style={{ color: "#94A3B8", fontSize: "14px", marginTop: "4px" }}>
            Bu projede kullanılabilecek makineleri düzenleyin
          </p>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: "12px", flexShrink: 0}}>
          {kayitDurumu === "ok" && (
            <span style={{color: "#16A34A", fontSize: "13px", fontWeight: "600"}}>✓ Kaydedildi</span>
          )}
          {kayitDurumu === "error" && (
            <span style={{color: "#DC2626", fontSize: "13px"}}>{hata}</span>
          )}
          <button
            onClick={kaydet}
            disabled={kayitDurumu === "loading"}
            style={{
              padding: "9px 22px",
              background: kayitDurumu === "loading" ? "#94A3B8" : "linear-gradient(135deg, #1B3A6B 0%, #2D5BA3 100%)",
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
        background: "white", borderRadius: "12px",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
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
              {makineler.map((m, idx) => (
                <tr key={m.id} style={{
                  borderBottom: "1px solid #F1F5F9",
                  background: idx % 2 === 0 ? "white" : "#FAFAFA"
                }}>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "110px" }}
                      value={m.ad} placeholder="Rig A"
                      onChange={e => updateRow(m.id, "ad", e.target.value)} />
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "120px", cursor: "pointer", background: "white" }}
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
                    <input style={{ ...cellInput, width: "80px" }} type="number"
                      value={m.maxDerinlik} min="1"
                      onChange={e => updateRow(m.id, "maxDerinlik", parseInt(e.target.value))} />
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "90px" }} type="number"
                      value={m.maxCap} min="100" step="50"
                      onChange={e => updateRow(m.id, "maxCap", parseInt(e.target.value))} />
                  </td>
                  <td style={tdStyle}>
                    <input style={{ ...cellInput, width: "80px" }} type="number"
                      value={m.tork} min="0"
                      onChange={e => updateRow(m.id, "tork", parseInt(e.target.value))} />
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "90px", cursor: "pointer", background: "white" }}
                      value={m.casing} onChange={e => updateRow(m.id, "casing", e.target.value)}>
                      {CASING_SECENEKLER.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "80px", cursor: "pointer", background: "white" }}
                      value={m.darAlan} onChange={e => updateRow(m.id, "darAlan", e.target.value)}>
                      {DAR_ALAN.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select style={{ ...cellInput, width: "90px", cursor: "pointer", background: "white" }}
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
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #F1F5F9" }}>
          <button onClick={addRow} style={{
            padding: "9px 20px", background: "#EFF6FF", color: "#2D5BA3",
            border: "1.5px solid #BFDBFE", borderRadius: "8px",
            fontSize: "13px", fontWeight: "600", cursor: "pointer"
          }}>
            + Makine Ekle
          </button>
        </div>
      </div>
    </div>
  )
}
