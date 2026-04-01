import { useState } from "react"
import { bulkReplaceEquipment, fromSnakeMakine } from "./api"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"
import { MAKINE_KATALOGU } from "./MakineKatalogu"

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

function KatalogModal({ onClose, onEkle, mevcutAdlar }) {
  const [secili, setSecili] = useState(new Set())
  const toggle = (i) => setSecili(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })
  const ekleSecilenleri = () => { onEkle(MAKINE_KATALOGU.filter((_, i) => secili.has(i))); onClose() }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "16px", width: "100%", maxWidth: "640px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>Makine Kataloğu</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Eklemek istediğiniz makineleri seçin</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {MAKINE_KATALOGU.map((m, i) => {
            const zatenVar = mevcutAdlar.includes(m.ad)
            const aktif = secili.has(i)
            return (
              <div key={i} onClick={() => !zatenVar && toggle(i)} style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px",
                borderRadius: "10px", marginBottom: "6px", cursor: zatenVar ? "default" : "pointer",
                border: `1.5px solid ${aktif ? "#0EA5E9" : "var(--input-border)"}`,
                background: zatenVar ? "var(--row-alt)" : aktif ? "#F0F9FF" : "var(--bg-card)",
                opacity: zatenVar ? 0.5 : 1, transition: "all 0.15s"
              }}>
                <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${aktif ? "#0EA5E9" : "#CBD5E1"}`, background: aktif ? "#0EA5E9" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {aktif && <span style={{ color: "white", fontSize: "11px", fontWeight: "700" }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{m.ad} {zatenVar && <span style={{ fontSize: "11px", color: "#94A3B8" }}>(zaten var)</span>}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{m.tip} — {m.tork} kNm — Maks {m.maxDerinlik}m / Ø{m.maxCap}mm — {m.not}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--input-border)", borderRadius: "8px", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>İptal</button>
          <button onClick={ekleSecilenleri} disabled={secili.size === 0} style={{ padding: "9px 22px", border: "none", borderRadius: "8px", background: secili.size === 0 ? "#94A3B8" : "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "white", fontSize: "13px", fontWeight: "600", cursor: secili.size === 0 ? "not-allowed" : "pointer" }}>
            Ekle ({secili.size})
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MakinePark({ data, onChange }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [showHatalar, setShowHatalar] = useState(false)
  const [silmeOnay, setSilmeOnay] = useState(null)
  const [katalogAcik, setKatalogAcik] = useState(false)
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

  const ekleKatalogdan = (yeniMakineler) => {
    const eklenecekler = yeniMakineler.map(m => ({ ...m, id: Date.now() + Math.random() }))
    onChange([...makineler, ...eklenecekler])
  }

  return (
    <div>
      {katalogAcik && (
        <KatalogModal
          onClose={() => setKatalogAcik(false)}
          onEkle={ekleKatalogdan}
          mevcutAdlar={makineler.map(m => m.ad)}
        />
      )}
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
            onClick={() => setKatalogAcik(true)}
            style={{
              padding: "9px 18px",
              background: "#F0F9FF", color: "#0284C7",
              border: "1.5px solid #BAE6FD", borderRadius: "8px",
              fontSize: "14px", fontWeight: "600", cursor: "pointer"
            }}
          >
            Katalogdan Ekle
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
