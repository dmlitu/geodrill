import { useState, useRef } from "react"
import { bulkReplaceSoilLayers, fromSnakeLayer } from "./api"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"

const ZEMIN_TIPLERI = ["Dolgu", "Kil", "Silt", "Kum", "Çakıl", "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"]
const KOHEZYON_TIPLERI = ["Kohezyonlu", "Kohezyonsuz", "Kaya"]

const ZEMIN_KOHEZYON_MAP = {
  "Kil": "Kohezyonlu",
  "Silt": "Kohezyonlu",
  "Kum": "Kohezyonsuz",
  "Çakıl": "Kohezyonsuz",
  "Dolgu": "Kohezyonsuz",
  "Ayrışmış Kaya": "Kaya",
  "Kumtaşı": "Kaya",
  "Kireçtaşı": "Kaya",
  "Sert Kaya": "Kaya",
}

const RISK_RENK = {
  "Yüksek": { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  "Orta": { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  "Düşük": { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
}

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

const cellSelect = { ...cellInput, cursor: "pointer" }

function stabiliteRiski(zemTipi, kohezyon, spt, yas, baslangic = 0) {
  if (["Kum", "Çakıl"].includes(zemTipi)) {
    return (yas > 0 && baslangic >= yas) ? "Yüksek" : "Orta"
  }
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

function derinlikUyarilari(satirlar) {
  const uyarilar = []
  for (let i = 0; i < satirlar.length - 1; i++) {
    const curr = satirlar[i]
    const next = satirlar[i + 1]
    if (curr.bitis < next.baslangic) {
      uyarilar.push(`${curr.bitis}–${next.baslangic} m`)
    } else if (curr.bitis > next.baslangic) {
      uyarilar.push(`${next.baslangic}–${curr.bitis} m`)
    }
  }
  return uyarilar
}

export default function ZeminLogu({ data, onChange, yeraltiSuyu, kazikBoyu, projeId }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [showHatalar, setShowHatalar] = useState(false)
  const [silmeOnay, setSilmeOnay] = useState(null)
  const [pdfYukleniyor, setPdfYukleniyor] = useState(false)
  const [pdfOnizleme, setPdfOnizleme] = useState(null)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const satirlar = data.length > 0 ? data : [DEFAULT_ROW()]

  const updateRow = (id, field, value) => {
    const idx = satirlar.findIndex(r => r.id === id)
    let yeni = satirlar.map(r => r.id === id ? { ...r, [field]: value } : r)

    // Auto-set kohezyon when zemTipi changes
    if (field === "zemTipi") {
      const autoKohezyon = ZEMIN_KOHEZYON_MAP[value]
      if (autoKohezyon) {
        yeni = yeni.map(r => r.id === id ? { ...r, kohezyon: autoKohezyon } : r)
      }
    }

    // Auto-link next row's baslangic when bitis changes
    if (field === "bitis" && idx >= 0 && idx < satirlar.length - 1) {
      const nextRow = satirlar[idx + 1]
      yeni = yeni.map(r => r.id === nextRow.id ? { ...r, baslangic: value } : r)
    }

    onChange(yeni)
  }

  const addRow = () => {
    const son = satirlar[satirlar.length - 1]
    const yeni = { ...DEFAULT_ROW(), baslangic: son.bitis, bitis: son.bitis + 3 }
    onChange([...satirlar, yeni])
  }

  const removeRow = (id) => {
    if (satirlar.length === 1) return
    setSilmeOnay(id)
  }

  const confirmRemove = () => {
    onChange(satirlar.filter(r => r.id !== silmeOnay))
    setSilmeOnay(null)
  }

  const kaydet = async () => {
    if (!projeId) {
      toast.error("Önce 'Proje Bilgileri' sekmesinden projeyi kaydedin.")
      return
    }
    const satirHatalari = satirlar.map(satirHatasi)
    const herhangiHata = satirHatalari.some(h => Object.keys(h).length > 0)
    if (herhangiHata) {
      setShowHatalar(true)
      toast.error("Satırlardaki hataları düzeltin.")
      return
    }
    if (kazikBoyu) {
      const maxBitis = Math.max(...satirlar.map(r => r.bitis))
      if (maxBitis < kazikBoyu) {
        setShowHatalar(true)
        toast.error(`Zemin logu kazık boyunu (${kazikBoyu} m) karşılamıyor (max bitiş: ${maxBitis} m).`)
        return
      }
    }
    setShowHatalar(false)
    setKayitDurumu("loading")
    try {
      const kaydedilenler = await bulkReplaceSoilLayers(projeId, satirlar)
      onChange(kaydedilenler.map(fromSnakeLayer))
      setKayitDurumu(null)
      toast.success("Zemin logu kaydedildi.")
    } catch (e) {
      setKayitDurumu(null)
      toast.error(e.message)
    }
  }

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!projeId) { toast.error("Önce projeyi kaydedin."); return }
    setPdfYukleniyor(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const token = localStorage.getItem("gd_token")
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/projects/${projeId}/soil-layers/import-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Hata") }
      const data = await res.json()
      setPdfOnizleme(data.katmanlar)
    } catch (e) {
      toast.error("PDF import hatası: " + e.message)
    } finally {
      setPdfYukleniyor(false)
      e.target.value = ""
    }
  }

  const uyarilar = derinlikUyarilari(satirlar)

  return (
    <div>
      <ConfirmDialog
        open={silmeOnay !== null}
        title="Katman Silinsin mi?"
        message="Bu zemin katmanini silmek istediginize emin misiniz? Bu islem geri alinamaz."
        onConfirm={confirmRemove}
        onCancel={() => setSilmeOnay(null)}
      />

      {pdfOnizleme && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
          <div style={{background:"white",borderRadius:"16px",padding:"28px",width:"100%",maxWidth:"800px",maxHeight:"80vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
            <h3 style={{marginBottom:"16px",fontSize:"18px",fontWeight:"700",color:"#0F172A"}}>PDF'den Çıkarılan Katmanlar</h3>
            <p style={{color:"#64748B",fontSize:"13px",marginBottom:"16px"}}>{pdfOnizleme.length} katman bulundu. "Uygula"ya basarak mevcut zemin logunu değiştirin.</p>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px",marginBottom:"20px"}}>
              <thead>
                <tr style={{background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}>
                  {["Başlangıç","Bitiş","Formasyon","Zemin Tipi","Kohezyon","SPT","UCS","RQD"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:"600",color:"#64748B",fontSize:"11px",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pdfOnizleme.map((r,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #F1F5F9",background:i%2===0?"white":"#F8FAFC"}}>
                    <td style={{padding:"7px 10px"}}>{r.baslangic}</td>
                    <td style={{padding:"7px 10px"}}>{r.bitis}</td>
                    <td style={{padding:"7px 10px"}}>{r.formasyon}</td>
                    <td style={{padding:"7px 10px"}}>{r.zemTipi}</td>
                    <td style={{padding:"7px 10px"}}>{r.kohezyon}</td>
                    <td style={{padding:"7px 10px"}}>{r.spt}</td>
                    <td style={{padding:"7px 10px"}}>{r.ucs}</td>
                    <td style={{padding:"7px 10px"}}>{r.rqd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{display:"flex",gap:"12px",justifyContent:"flex-end"}}>
              <button onClick={()=>setPdfOnizleme(null)} style={{padding:"9px 20px",background:"white",border:"1.5px solid #E2E8F0",borderRadius:"8px",fontSize:"14px",fontWeight:"600",cursor:"pointer",color:"#64748B"}}>İptal</button>
              <button onClick={()=>{ onChange(pdfOnizleme.map(r=>({...r,id:Date.now()+Math.random()}))); setPdfOnizleme(null); toast.success("Zemin logu güncellendi. Kaydetmeyi unutmayın.") }} style={{padding:"9px 20px",background:"linear-gradient(135deg,#0284C7,#0EA5E9)",color:"white",border:"none",borderRadius:"8px",fontSize:"14px",fontWeight:"600",cursor:"pointer"}}>Uygula</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>
            Zemin Logu
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
            Metre metre zemin katmanlarını girin
          </p>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: "12px", flexShrink: 0}}>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{display:"none"}} onChange={handlePdfUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={pdfYukleniyor}
            style={{
              padding: "9px 18px",
              background: pdfYukleniyor ? "#94A3B8" : "white",
              color: pdfYukleniyor ? "white" : "#0284C7",
              border: "1.5px solid #BAE6FD",
              borderRadius: "8px",
              fontSize: "14px", fontWeight: "600",
              cursor: pdfYukleniyor ? "not-allowed" : "pointer"
            }}
          >
            {pdfYukleniyor ? "Okunuyor..." : "PDF Yükle"}
          </button>
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

      {uyarilar.length > 0 && (
        <div style={{
          marginBottom: "16px",
          padding: "12px 16px",
          background: "#FFFBEB",
          border: "1.5px solid #FDE68A",
          borderRadius: "8px",
          color: "#92400E",
          fontSize: "13px",
          fontWeight: "500",
        }}>
          Derinlik boşluğu/çakışması var: {uyarilar.join(", ")} m
        </div>
      )}

      <div style={{
        background: "var(--bg-card)", borderRadius: "12px",
        border: "1px solid var(--input-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr style={{ background: "var(--badge-muted-bg)", borderBottom: "2px solid var(--input-border)" }}>
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
                const risk = stabiliteRiski(row.zemTipi, row.kohezyon, row.spt, yeraltiSuyu, row.baslangic)
                const uc = ucOneri(row.zemTipi, row.ucs)
                const renkler = RISK_RENK[risk]
                const rh = showHatalar ? satirHatasi(row) : {}
                const errStyle = (key) => rh[key] ? { borderColor: "#FCA5A5" } : {}
                return (
                  <tr key={row.id} style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: idx % 2 === 0 ? "var(--bg-card)" : "var(--row-alt)"
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
                      <input
                        list="zemin-tipi-list"
                        style={{ ...cellInput, width: "130px" }}
                        value={row.zemTipi}
                        onChange={e => updateRow(row.id, "zemTipi", e.target.value)}
                        placeholder="Zemin tipi seçin veya yazın"
                      />
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
                        background: "#E0F2FE", color: "#0EA5E9",
                        border: "1px solid #BAE6FD",
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

        {/* datalist for zemTipi combobox */}
        <datalist id="zemin-tipi-list">
          {ZEMIN_TIPLERI.map(t => <option key={t} value={t} />)}
        </datalist>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #F1F5F9" }}>
          <button onClick={addRow} style={{
            padding: "9px 20px",
            background: "#E0F2FE", color: "#0EA5E9",
            border: "1.5px solid #BAE6FD", borderRadius: "8px",
            fontSize: "13px", fontWeight: "600", cursor: "pointer"
          }}>
            + Katman Ekle
          </button>
        </div>
      </div>
    </div>
  )
}
