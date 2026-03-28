import { useState } from "react"
import { bulkReplaceSoilLayers, fromSnakeLayer } from "./api"

const ZEMIN_TIPLERI = ["Dolgu", "Kil", "Silt", "Kum", "Çakıl", "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"]
const KOHEZYON_TIPLERI = ["Kohezyonlu", "Kohezyonsuz", "Kaya"]

const RISK_RENK = {
  "Yüksek": { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  "Orta": { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  "Düşük": { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
}

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

const cellSelect = { ...cellInput, cursor: "pointer", background: "white" }

function stabiliteRiski(zemTipi, kohezyon, spt, yas) {
  if (["Kum", "Çakıl"].includes(zemTipi) && yas >= 0) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= 10) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= 30) return "Orta"
  if (zemTipi === "Dolgu") return "Orta"
  return "Düşük"
}

function ucOneri(zemTipi, ucs) {
  if (["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(zemTipi) || ucs >= 25)
    return "Kaya ucu"
  if (zemTipi === "Ayrışmış Kaya" || (ucs >= 10 && ucs < 25))
    return "Geçiş ucu"
  return "Standart uç"
}

const DEFAULT_ROW = () => ({
  id: Date.now() + Math.random(),
  baslangic: 0, bitis: 3,
  formasyon: "Dolgu", zemTipi: "Dolgu",
  kohezyon: "Kohezyonsuz",
  spt: 10, ucs: 0, rqd: 0,
  aciklama: ""
})

function satirHatasi(row) {
  const h = {}
  if (row.bitis <= row.baslangic) h.derinlik = "Bitiş > Başlangıç olmalı"
  if (row.spt < 0 || row.spt > 300) h.spt = "0–300 arası"
  if (row.ucs < 0) h.ucs = "≥ 0 olmalı"
  if (row.rqd < 0 || row.rqd > 100) h.rqd = "0–100 arası"
  return h
}

export default function ZeminLogu({ data, onChange, yeraltiSuyu, kazikBoyu, projeId }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [hata, setHata] = useState("")
  const [showHatalar, setShowHatalar] = useState(false)

  const satirlar = data.length > 0 ? data : [DEFAULT_ROW()]

  const updateRow = (id, field, value) => {
    const yeni = satirlar.map(r => r.id === id ? { ...r, [field]: value } : r)
    onChange(yeni)
  }

  const addRow = () => {
    const son = satirlar[satirlar.length - 1]
    const yeni = { ...DEFAULT_ROW(), baslangic: son.bitis, bitis: son.bitis + 3 }
    onChange([...satirlar, yeni])
  }

  const removeRow = (id) => {
    if (satirlar.length === 1) return
    onChange(satirlar.filter(r => r.id !== id))
  }

  const kaydet = async () => {
    if (!projeId) {
      setHata("Önce 'Proje Bilgileri' sekmesinden projeyi kaydedin.")
      setKayitDurumu("error")
      return
    }
    // Satır validasyonu
    const satirHatalari = satirlar.map(satirHatasi)
    const herhangiHata = satirHatalari.some(h => Object.keys(h).length > 0)
    if (herhangiHata) {
      setShowHatalar(true)
      setHata("Satırlardaki hataları düzeltin.")
      setKayitDurumu("error")
      return
    }
    // Kapsama kontrolü
    if (kazikBoyu) {
      const maxBitis = Math.max(...satirlar.map(r => r.bitis))
      if (maxBitis < kazikBoyu) {
        setShowHatalar(true)
        setHata(`Zemin logu kazık boyunu (${kazikBoyu} m) karşılamıyor (max bitiş: ${maxBitis} m).`)
        setKayitDurumu("error")
        return
      }
    }
    setShowHatalar(false)
    setKayitDurumu("loading")
    setHata("")
    try {
      const kaydedilenler = await bulkReplaceSoilLayers(projeId, satirlar)
      onChange(kaydedilenler.map(fromSnakeLayer))
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
            Zemin Logu
          </h2>
          <p style={{ color: "#94A3B8", fontSize: "14px", marginTop: "4px" }}>
            Metre metre zemin katmanlarını girin
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                <th style={thStyle}>Başlangıç (m)</th>
                <th style={thStyle}>Bitiş (m)</th>
                <th style={thStyle}>Formasyon</th>
                <th style={thStyle}>Zemin Tipi</th>
                <th style={thStyle}>Kohezyon</th>
                <th style={thStyle}>SPT</th>
                <th style={thStyle}>UCS (MPa)</th>
                <th style={thStyle}>RQD</th>
                <th style={thStyle}>Stabilite</th>
                <th style={thStyle}>Uç</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((row, idx) => {
                const risk = stabiliteRiski(row.zemTipi, row.kohezyon, row.spt, yeraltiSuyu)
                const uc = ucOneri(row.zemTipi, row.ucs)
                const renkler = RISK_RENK[risk]
                const rh = showHatalar ? satirHatasi(row) : {}
                const errStyle = (key) => rh[key] ? { borderColor: "#FCA5A5" } : {}
                return (
                  <tr key={row.id} style={{
                    borderBottom: "1px solid #F1F5F9",
                    background: idx % 2 === 0 ? "white" : "#FAFAFA"
                  }}>
                    <td style={tdStyle}>
                      <input style={{ ...cellInput, width: "80px", ...errStyle("derinlik") }} type="number"
                        title={rh.derinlik || ""}
                        value={row.baslangic} step="0.5"
                        onChange={e => updateRow(row.id, "baslangic", parseFloat(e.target.value))} />
                    </td>
                    <td style={tdStyle}>
                      <input style={{ ...cellInput, width: "80px", ...errStyle("derinlik") }} type="number"
                        title={rh.derinlik || ""}
                        value={row.bitis} step="0.5"
                        onChange={e => updateRow(row.id, "bitis", parseFloat(e.target.value))} />
                    </td>
                    <td style={tdStyle}>
                      <input style={{ ...cellInput, width: "110px" }}
                        value={row.formasyon}
                        onChange={e => updateRow(row.id, "formasyon", e.target.value)}
                        placeholder="Formasyon adı" />
                    </td>
                    <td style={tdStyle}>
                      <select style={{ ...cellSelect, width: "130px" }}
                        value={row.zemTipi}
                        onChange={e => updateRow(row.id, "zemTipi", e.target.value)}>
                        {ZEMIN_TIPLERI.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <select style={{ ...cellSelect, width: "120px" }}
                        value={row.kohezyon}
                        onChange={e => updateRow(row.id, "kohezyon", e.target.value)}>
                        {KOHEZYON_TIPLERI.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input style={{ ...cellInput, width: "70px", ...errStyle("spt") }} type="number"
                        title={rh.spt || ""}
                        value={row.spt} min="0" max="300"
                        onChange={e => updateRow(row.id, "spt", parseInt(e.target.value))} />
                    </td>
                    <td style={tdStyle}>
                      <input style={{ ...cellInput, width: "80px", ...errStyle("ucs") }} type="number"
                        title={rh.ucs || ""}
                        value={row.ucs} min="0" step="0.5"
                        onChange={e => updateRow(row.id, "ucs", parseFloat(e.target.value))} />
                    </td>
                    <td style={tdStyle}>
                      <input style={{ ...cellInput, width: "70px", ...errStyle("rqd") }} type="number"
                        title={rh.rqd || ""}
                        value={row.rqd} min="0" max="100"
                        onChange={e => updateRow(row.id, "rqd", parseInt(e.target.value))} />
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "20px",
                        fontSize: "12px", fontWeight: "600",
                        background: renkler.bg, color: renkler.color,
                        border: `1px solid ${renkler.border}`,
                        whiteSpace: "nowrap"
                      }}>
                        {risk}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "20px",
                        fontSize: "12px", fontWeight: "600",
                        background: "#EFF6FF", color: "#2D5BA3",
                        border: "1px solid #BFDBFE",
                        whiteSpace: "nowrap"
                      }}>
                        {uc}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => removeRow(row.id)}
                        style={{
                          background: "none", border: "none",
                          cursor: "pointer", color: "#CBD5E1",
                          fontSize: "18px", padding: "4px",
                          borderRadius: "4px"
                        }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #F1F5F9" }}>
          <button onClick={addRow} style={{
            padding: "9px 20px",
            background: "#EFF6FF", color: "#2D5BA3",
            border: "1.5px solid #BFDBFE", borderRadius: "8px",
            fontSize: "13px", fontWeight: "600", cursor: "pointer"
          }}>
            + Katman Ekle
          </button>
        </div>
      </div>
    </div>
  )
}
