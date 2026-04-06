import { useState, useRef, useMemo, useCallback } from "react"
import { bulkReplaceSoilLayers, fromSnakeLayer } from "./api"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"
import { zeminHesapTipi } from "./hesaplamalar"

// ─── Geological classification constants ─────────────────────────────────────

const ZEMIN_TIPLERI = [
  "Dolgu", "Kil", "Silt", "Kum", "Çakıl",
  "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya",
  "Organik Kil", "Torf",
]
const KOHEZYON_TIPLERI = ["Kohezyonlu", "Kohezyonsuz", "Kaya"]
const KAYA_TIPLERI = ["Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"]

const ZEMIN_KOHEZYON_MAP = {
  "Kil": "Kohezyonlu", "Silt": "Kohezyonlu",
  "Organik Kil": "Kohezyonlu", "Torf": "Kohezyonlu",
  "Kum": "Kohezyonsuz", "Çakıl": "Kohezyonsuz", "Dolgu": "Kohezyonsuz",
  "Ayrışmış Kaya": "Kaya", "Kumtaşı": "Kaya", "Kireçtaşı": "Kaya", "Sert Kaya": "Kaya",
}

// USCS-based geological colors — standard Turkish geotechnical practice
// Patterns follow standard borehole log conventions (TS EN ISO 14688 / USCS)
const ZEMIN_RENK = {
  "Dolgu":         { bg: "#78909C", light: "#ECEFF1", abbr: "DL", pattern: "fill-hatch" },
  "Kil":           { bg: "#8D6E63", light: "#F5F0EB", abbr: "CL", pattern: "clay" },
  "Silt":          { bg: "#A1887F", light: "#F9F5F2", abbr: "ML", pattern: "silt" },
  "Kum":           { bg: "#C0A030", light: "#FEF9E2", abbr: "SP", pattern: "sand" },
  "Çakıl":         { bg: "#A0522D", light: "#FEF0E6", abbr: "GP", pattern: "gravel" },
  "Ayrışmış Kaya": { bg: "#7B68AA", light: "#F4F0FB", abbr: "WR", pattern: "weathered" },
  "Kumtaşı":       { bg: "#C07028", light: "#FEF2E2", abbr: "Ss", pattern: "sandstone" },
  "Kireçtaşı":     { bg: "#4682B4", light: "#EDF4FC", abbr: "Ls", pattern: "limestone" },
  "Sert Kaya":     { bg: "#37474F", light: "#ECEFF1", abbr: "Hr", pattern: "hardrock" },
  "Organik Kil":   { bg: "#4E342E", light: "#EFEBE9", abbr: "OH", pattern: "organic" },
  "Torf":          { bg: "#2E7D32", light: "#E8F5E9", abbr: "Pt", pattern: "peat" },
}
const DEFAULT_RENK = { bg: "#90A4AE", light: "#ECEFF1", abbr: "??" }

function zemRengi(zemTipi) {
  return ZEMIN_RENK[zemTipi] || DEFAULT_RENK
}

// ─── Geotechnical descriptions ────────────────────────────────────────────────
// Clay/silt consistency from SPT: Terzaghi & Peck (1948), BS EN ISO 14688-2
// Sand/gravel density from SPT: Gibbs & Holtz (1957), BS EN ISO 14688-2
// Rock strength from UCS: ISRM (1979), TS EN ISO 14689

function kivamTanimi(zemTipi, kohezyon, spt, ucs) {
  if (KAYA_TIPLERI.includes(zemTipi) || ucs > 0) {
    if (!ucs) return "—"
    if (ucs < 1)   return "Çok Zayıf"
    if (ucs < 5)   return "Zayıf"
    if (ucs < 25)  return "Orta"
    if (ucs < 50)  return "Sağlam"
    if (ucs < 100) return "Çok Sağlam"
    return "Aşırı Sağlam"
  }
  if (["Organik Kil", "Torf"].includes(zemTipi)) return "Organik/Yüksek Plastik"
  if (!spt) return "—"
  if (kohezyon === "Kohezyonlu" || ["Kil", "Silt"].includes(zemTipi)) {
    if (spt < 2)  return "Çok Yumuşak"
    if (spt < 4)  return "Yumuşak"
    if (spt < 8)  return "Orta Katı"
    if (spt < 15) return "Katı"
    if (spt < 30) return "Çok Katı"
    return "Sert"
  }
  if (spt < 4)  return "Çok Gevşek"
  if (spt < 10) return "Gevşek"
  if (spt < 30) return "Orta Sıkı"
  if (spt < 50) return "Sıkı"
  return "Çok Sıkı"
}

const RISK_RENK = {
  "Yüksek": { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  "Orta":   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  "Düşük":  { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
}

function stabiliteRiski(zemTipi, kohezyon, spt, yas, baslangic = 0, su = 0) {
  // Organik kil ve torf — her zaman yüksek risk
  if (["Organik Kil", "Torf"].includes(zemTipi)) return "Yüksek"
  // Granüler: YAS kontrolü
  if (["Kum", "Çakıl"].includes(zemTipi))
    return (yas > 0 && baslangic >= yas) ? "Yüksek" : "Orta"
  // Kohezyonlu: su varsa EN 1536 §5.3
  const isKohezif = ["Kil", "Silt", "Organik Kil"].includes(zemTipi) || kohezyon === "Kohezyonlu"
  if (isKohezif && su > 0) {
    if (su < 15) return "Yüksek"
    if (su < 40) return "Orta"
    return "Düşük"
  }
  if (isKohezif && spt > 0) {
    if (spt < 2) return "Yüksek"
    if (spt < 8) return "Orta"
    return "Düşük"
  }
  if (kohezyon === "Kohezyonsuz" && spt <= 10) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= 30) return "Orta"
  if (zemTipi === "Dolgu") {
    if (spt > 0 && spt < 5) return "Yüksek"
    return "Orta"
  }
  return "Düşük"
}

function ucOneri(zemTipi, ucs) {
  if (["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(zemTipi) || ucs >= 25)
    return { label: "Kaya ucu", color: "#37474F", bg: "#ECEFF1" }
  if (zemTipi === "Ayrışmış Kaya" || (ucs >= 10 && ucs < 25))
    return { label: "Geçiş ucu", color: "#7B68AA", bg: "#F4F0FB" }
  return { label: "Standart", color: "#0369A1", bg: "#E0F2FE" }
}

function satirHatasi(row) {
  const h = {}
  if (row.bitis <= row.baslangic) h.derinlik = "Bitiş > Başlangıç olmalı"
  if (row.spt < 0 || row.spt > 300) h.spt = "0–300 arası"
  if (row.ucs < 0) h.ucs = "≥ 0 olmalı"
  if (row.rqd < 0 || row.rqd > 100) h.rqd = "0–100 arası"
  return h
}

function derinlikUyarilari(satirlar) {
  const u = []
  for (let i = 0; i < satirlar.length - 1; i++) {
    const c = satirlar[i], n = satirlar[i + 1]
    if (c.bitis < n.baslangic) u.push(`Boşluk ${c.bitis}–${n.baslangic} m`)
    else if (c.bitis > n.baslangic) u.push(`Çakışma ${n.baslangic}–${c.bitis} m`)
  }
  return u
}

const DEFAULT_ROW = () => ({
  id: Date.now() + Math.random(),
  baslangic: 0, bitis: 3,
  formasyon: "", zemTipi: "Dolgu",
  kohezyon: "Kohezyonsuz",
  spt: 0, ucs: 0, rqd: 0, aciklama: "",
})

// ─── Borehole Profile SVG ─────────────────────────────────────────────────────

function SondajProfili({ satirlar, yeraltiSuyu, kazikBoyu }) {
  if (!satirlar.length) return null

  const maxD = Math.max(kazikBoyu || 0, ...satirlar.map(r => r.bitis || 0))
  if (maxD <= 0) return null

  const SCALE = Math.max(12, Math.min(28, 300 / maxD)) // px/m, 12–28 range
  const totalH = maxD * SCALE
  const AX = 28   // axis width
  const CW = 34   // soil column width
  const BW = 38   // SPT bar area width
  const SVG_W = AX + CW + BW + 8

  const maxSPT = Math.max(10, ...satirlar.filter(r => r.spt > 0).map(r => r.spt))
  const tickInt = maxD > 40 ? 10 : maxD > 20 ? 5 : maxD > 10 ? 2 : 1
  const ticks = []
  for (let d = 0; d <= maxD; d += tickInt) ticks.push(d)

  return (
    <div style={{
      width: SVG_W + "px", flexShrink: 0,
      borderRight: "2px solid var(--input-border)",
      background: "var(--bg-card)",
    }}>
      <div style={{
        padding: "10px 0 8px",
        textAlign: "center",
        fontSize: "10px", fontWeight: "800",
        color: "var(--text-secondary)", textTransform: "uppercase",
        letterSpacing: "0.6px",
        background: "var(--badge-muted-bg)",
        borderBottom: "2px solid var(--input-border)",
      }}>
        Profil
      </div>
      <div style={{ overflowY: "auto", maxHeight: "600px" }}>
        <svg width={SVG_W} height={totalH + 32} style={{ display: "block" }}>
          <defs>
            {/* Dolgu — cross-hatch (fill material) */}
            <pattern id="zl-fill-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#78909C" strokeWidth="1.2" />
            </pattern>
            {/* Kil — horizontal brick lines (clay standard) */}
            <pattern id="zl-clay" patternUnits="userSpaceOnUse" width="10" height="5">
              <rect width="10" height="5" fill="#D7C4BC" />
              <line x1="0" y1="2.5" x2="10" y2="2.5" stroke="#8D6E63" strokeWidth="0.8" />
              <line x1="5" y1="0" x2="5" y2="2.5" stroke="#8D6E63" strokeWidth="0.5" />
              <line x1="0" y1="5" x2="0" y2="2.5" stroke="#8D6E63" strokeWidth="0.5" />
              <line x1="10" y1="5" x2="10" y2="2.5" stroke="#8D6E63" strokeWidth="0.5" />
            </pattern>
            {/* Silt — horizontal dashes (silt standard) */}
            <pattern id="zl-silt" patternUnits="userSpaceOnUse" width="8" height="4">
              <rect width="8" height="4" fill="#D9CDCA" />
              <line x1="0" y1="2" x2="4" y2="2" stroke="#A1887F" strokeWidth="0.9" />
            </pattern>
            {/* Kum — stippled dots (sand standard) */}
            <pattern id="zl-sand" patternUnits="userSpaceOnUse" width="5" height="5">
              <rect width="5" height="5" fill="#EEE0A0" />
              <circle cx="1.5" cy="1.5" r="0.9" fill="#C0A030" opacity="0.8" />
              <circle cx="4" cy="3.5" r="0.9" fill="#C0A030" opacity="0.8" />
            </pattern>
            {/* Çakıl — pebble ovals (gravel standard) */}
            <pattern id="zl-gravel" patternUnits="userSpaceOnUse" width="10" height="8">
              <rect width="10" height="8" fill="#E8D0B8" />
              <ellipse cx="3" cy="3" rx="2.2" ry="1.5" fill="none" stroke="#A0522D" strokeWidth="0.9" />
              <ellipse cx="8" cy="6" rx="2" ry="1.4" fill="none" stroke="#A0522D" strokeWidth="0.9" />
            </pattern>
            {/* Ayrışmış Kaya — irregular hatch (weathered rock) */}
            <pattern id="zl-weathered" patternUnits="userSpaceOnUse" width="8" height="8">
              <rect width="8" height="8" fill="#DED8F0" />
              <line x1="0" y1="4" x2="4" y2="0" stroke="#7B68AA" strokeWidth="0.8" />
              <line x1="4" y1="8" x2="8" y2="4" stroke="#7B68AA" strokeWidth="0.8" />
              <circle cx="6" cy="2" r="0.8" fill="#7B68AA" opacity="0.5" />
            </pattern>
            {/* Kumtaşı — parallel diagonal (sandstone) */}
            <pattern id="zl-sandstone" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(30)">
              <rect width="6" height="6" fill="#EDD8B0" />
              <line x1="0" y1="3" x2="6" y2="3" stroke="#C07028" strokeWidth="1" />
            </pattern>
            {/* Kireçtaşı — brick pattern (limestone standard) */}
            <pattern id="zl-limestone" patternUnits="userSpaceOnUse" width="12" height="6">
              <rect width="12" height="6" fill="#C8DDEF" />
              <rect width="12" height="6" fill="none" stroke="#4682B4" strokeWidth="0.8" />
              <line x1="6" y1="0" x2="6" y2="3" stroke="#4682B4" strokeWidth="0.8" />
              <line x1="0" y1="3" x2="6" y2="3" stroke="#4682B4" strokeWidth="0.8" />
              <line x1="6" y1="3" x2="12" y2="3" stroke="#4682B4" strokeWidth="0.8" />
            </pattern>
            {/* Sert Kaya — cross-hatch dark (hard rock) */}
            <pattern id="zl-hardrock" patternUnits="userSpaceOnUse" width="6" height="6">
              <rect width="6" height="6" fill="#B0BEC5" />
              <line x1="0" y1="0" x2="6" y2="6" stroke="#37474F" strokeWidth="0.9" />
              <line x1="6" y1="0" x2="0" y2="6" stroke="#37474F" strokeWidth="0.9" />
            </pattern>
          </defs>

          {/* Grid lines and depth ticks */}
          {ticks.map(d => (
            <g key={d}>
              <line x1={AX - 4} y1={d * SCALE} x2={AX + CW} y2={d * SCALE}
                stroke="#E2E8F0" strokeWidth="0.8" />
              <text x={AX - 6} y={d * SCALE + 4}
                textAnchor="end" fontSize="8.5" fill="#94A3B8" fontFamily="monospace">
                {d}
              </text>
            </g>
          ))}

          {/* Soil column */}
          {satirlar.map((row, i) => {
            const y = (row.baslangic || 0) * SCALE
            const h = Math.max(0, ((row.bitis || 0) - (row.baslangic || 0)) * SCALE)
            if (h < 1) return null
            const r = zemRengi(row.zemTipi)
            const fillId = r.pattern ? `url(#zl-${r.pattern})` : r.bg
            return (
              <g key={row.id || i}>
                <rect x={AX} y={y} width={CW} height={h}
                  fill={fillId} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
                {h >= 18 && (
                  <text x={AX + CW / 2} y={y + h / 2 + 4}
                    textAnchor="middle" fontSize="8.5" fontWeight="800"
                    fill="white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                    {r.abbr}
                  </text>
                )}
              </g>
            )
          })}

          {/* Column border */}
          <rect x={AX} y={0} width={CW} height={totalH}
            fill="none" stroke="#B0BEC5" strokeWidth="1" />

          {/* SPT mini bars */}
          {satirlar.filter(r => r.spt > 0).map((row, i) => {
            const midY = ((row.baslangic + row.bitis) / 2) * SCALE
            const bw = Math.max(3, (row.spt / maxSPT) * (BW - 8))
            return (
              <g key={"spt" + i}>
                <rect x={AX + CW + 3} y={midY - 5}
                  width={bw} height={9}
                  fill="#0EA5E9" opacity="0.55" rx="2" />
                {bw > 10 && (
                  <text x={AX + CW + 5} y={midY + 2}
                    fontSize="7.5" fill="#0369A1" fontWeight="700" fontFamily="monospace">
                    {row.spt}
                  </text>
                )}
              </g>
            )
          })}

          {/* Groundwater level */}
          {yeraltiSuyu > 0 && yeraltiSuyu <= maxD && (
            <g>
              <line x1={AX - 5} y1={yeraltiSuyu * SCALE}
                x2={AX + CW + BW + 5} y2={yeraltiSuyu * SCALE}
                stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="5 3" />
              <text x={AX + CW + 2} y={yeraltiSuyu * SCALE - 3}
                fontSize="8" fill="#3B82F6" fontWeight="800">YAS</text>
            </g>
          )}

          {/* Pile tip marker */}
          {kazikBoyu > 0 && kazikBoyu <= maxD && (
            <polygon
              points={`
                ${AX + CW / 2 - 9},${kazikBoyu * SCALE}
                ${AX + CW / 2 + 9},${kazikBoyu * SCALE}
                ${AX + CW / 2},${kazikBoyu * SCALE + 13}
              `}
              fill="#EF4444" opacity="0.85"
            />
          )}

          {/* SPT column header */}
          <text x={AX + CW + 3} y={totalH + 20}
            fontSize="8" fill="#94A3B8" fontWeight="700" textTransform="uppercase">SPT</text>
        </svg>
      </div>
    </div>
  )
}

// ─── PDF Preview Modal ────────────────────────────────────────────────────────

function PdfOnizlemeModal({ katmanlar, onUygula, onIptal }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      zIndex: 1000, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px",
    }}>
      <div style={{
        background: "white", borderRadius: "16px", padding: "28px 28px 24px",
        width: "100%", maxWidth: "900px", maxHeight: "80vh",
        overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "10px",
            background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", margin: 0 }}>
              PDF'den Çıkarılan Zemin Katmanları
            </h3>
            <p style={{ color: "#64748B", fontSize: "13px", margin: "3px 0 0" }}>
              {katmanlar.length} katman bulundu — inceleyip onaylayın
            </p>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", marginBottom: "20px", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                {["#", "Derinlik", "Formasyon", "Zemin Tipi", "Kohezyon", "SPT", "UCS", "RQD"].map(h => (
                  <th key={h} style={{
                    padding: "10px 12px", textAlign: "left", fontWeight: "700",
                    color: "#64748B", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.3px",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {katmanlar.map((r, i) => {
                const renk = zemRengi(r.zemTipi)
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "22px", height: "22px", borderRadius: "50%",
                        background: renk.bg, color: "white", fontSize: "9px", fontWeight: "800",
                      }}>{i + 1}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                      {r.baslangic}–{r.bitis} m
                    </td>
                    <td style={{ padding: "9px 12px", color: "#64748B" }}>{r.formasyon || "—"}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "3px 9px", borderRadius: "5px",
                        background: renk.light, border: `1px solid ${renk.bg}50`,
                        fontSize: "12px", fontWeight: "700", color: renk.bg,
                      }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: renk.bg, flexShrink: 0 }} />
                        {r.zemTipi}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", color: "#475569", fontSize: "12px" }}>{r.kohezyon}</td>
                    <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>{r.spt || "—"}</td>
                    <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>{r.ucs || "—"}</td>
                    <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>{r.rqd || "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onIptal} style={{
            padding: "9px 22px", background: "white", border: "1.5px solid #E2E8F0",
            borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", color: "#64748B",
          }}>İptal</button>
          <button onClick={onUygula} style={{
            padding: "9px 22px", background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
            color: "white", border: "none", borderRadius: "8px",
            fontSize: "14px", fontWeight: "600", cursor: "pointer",
          }}>Uygula</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ZeminLogu({ data, onChange, yeraltiSuyu, kazikBoyu, projeId }) {
  const [kayitDurumu, setKayitDurumu] = useState(null)
  const [showHatalar, setShowHatalar] = useState(false)
  const [silmeOnay, setSilmeOnay] = useState(null)
  const [pdfYukleniyor, setPdfYukleniyor] = useState(false)
  const [pdfOnizleme, setPdfOnizleme] = useState(null)
  const fileInputRef = useRef(null)
  const toast = useToast()

  const satirlar = useMemo(
    () => data.length > 0 ? data : [DEFAULT_ROW()],
    [data]
  )

  const updateRow = useCallback((id, field, value) => {
    onChange(prev => {
      const rows = prev.length > 0 ? prev : [DEFAULT_ROW()]
      const idx = rows.findIndex(r => r.id === id)
      let yeni = rows.map(r => r.id === id ? { ...r, [field]: value } : r)
      if (field === "zemTipi") {
        const autoK = ZEMIN_KOHEZYON_MAP[value]
        if (autoK) yeni = yeni.map(r => r.id === id ? { ...r, kohezyon: autoK } : r)
        // Kaya türlerinde SPT geçersizdir (ASTM D1586) — otomatik sıfırla
        if (KAYA_TIPLERI.includes(value))
          yeni = yeni.map(r => r.id === id ? { ...r, spt: 0 } : r)
      }
      if (field === "bitis" && idx >= 0 && idx < rows.length - 1) {
        const nextId = rows[idx + 1].id
        yeni = yeni.map(r => r.id === nextId ? { ...r, baslangic: value } : r)
      }
      return yeni
    })
  }, [onChange])

  const addRow = useCallback(() => {
    onChange(prev => {
      const rows = prev.length > 0 ? prev : [DEFAULT_ROW()]
      const son = rows[rows.length - 1]
      return [...rows, { ...DEFAULT_ROW(), baslangic: son.bitis, bitis: son.bitis + 3 }]
    })
  }, [onChange])

  const removeRow = useCallback((id) => {
    if (satirlar.length > 1) setSilmeOnay(id)
  }, [satirlar.length])

  const confirmRemove = useCallback(() => {
    onChange(prev => prev.filter(r => r.id !== silmeOnay))
    setSilmeOnay(null)
  }, [onChange, silmeOnay])

  const kaydet = async () => {
    if (!projeId) { toast.error("Önce projeyi kaydedin."); return }
    const hataVar = satirlar.map(satirHatasi).some(h => Object.keys(h).length > 0)
    if (hataVar) { setShowHatalar(true); toast.error("Hataları düzeltin."); return }
    if (kazikBoyu && Math.max(...satirlar.map(r => r.bitis)) < kazikBoyu) {
      setShowHatalar(true)
      toast.error(`Zemin logu kazık boyunu (${kazikBoyu} m) karşılamıyor.`)
      return
    }
    setShowHatalar(false); setKayitDurumu("loading")
    try {
      const saved = await bulkReplaceSoilLayers(projeId, satirlar)
      onChange(saved.map(fromSnakeLayer))
      setKayitDurumu(null); toast.success("Zemin logu kaydedildi.")
    } catch (e) { setKayitDurumu(null); toast.error(e.message) }
  }

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!projeId) { toast.error("Önce projeyi kaydedin."); return }
    setPdfYukleniyor(true)
    try {
      const fd = new FormData(); fd.append("file", file)
      const token = localStorage.getItem("gd_token")
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/projects/${projeId}/soil-layers/import-pdf`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }
      )
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Hata") }
      const d = await res.json(); setPdfOnizleme(d.katmanlar)
    } catch (e) {
      toast.error("PDF import hatası: " + e.message)
    } finally { setPdfYukleniyor(false); e.target.value = "" }
  }

  // Memoize per-row derived values — avoids recomputing stabilite/uc/kivam for
  // every row on every render when only one field in one row changes.
  const satirTurev = useMemo(() => satirlar.map(row => ({
    risk: stabiliteRiski(row.zemTipi, row.kohezyon, row.spt, yeraltiSuyu, row.baslangic, row.su || 0),
    uc: ucOneri(row.zemTipi, row.ucs),
    kivam: kivamTanimi(row.zemTipi, row.kohezyon, row.spt, row.ucs),
    renk: zemRengi(row.zemTipi),
    isKaya: KAYA_TIPLERI.includes(row.zemTipi),
  })), [satirlar, yeraltiSuyu])

  const uyarilar = useMemo(() => derinlikUyarilari(satirlar), [satirlar])
  const maxBitis = useMemo(() => Math.max(...satirlar.map(r => r.bitis || 0)), [satirlar])
  const kapsamYuzde = kazikBoyu ? Math.min(100, Math.round((maxBitis / kazikBoyu) * 100)) : null

  const stats = useMemo(() => ({
    katmanSayisi: satirlar.length,
    toplamDerinlik: maxBitis,
    kayaBaslangic: satirlar.find(r => KAYA_TIPLERI.includes(r.zemTipi))?.baslangic ?? null,
    maxSPT: Math.max(0, ...satirlar.map(r => r.spt || 0)),
  }), [satirlar, maxBitis])

  // Shared input styles
  const inp = {
    padding: "6px 8px", border: "1.5px solid var(--input-border)", borderRadius: "5px",
    fontSize: "12.5px", outline: "none", boxSizing: "border-box",
    color: "var(--input-text)", background: "var(--input-bg)",
  }
  const sel = { ...inp, cursor: "pointer" }
  const dimmed = { background: "var(--badge-muted-bg)", color: "var(--text-muted)", border: "1.5px solid #E8ECF0" }
  const thSt = {
    padding: "10px 8px", textAlign: "left", fontSize: "10.5px", fontWeight: "700",
    color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.4px",
    whiteSpace: "nowrap", background: "var(--badge-muted-bg)",
    borderBottom: "2px solid var(--input-border)",
  }
  const tdSt = { padding: "5px 5px", verticalAlign: "middle" }

  return (
    <div>
      <ConfirmDialog
        open={silmeOnay !== null}
        title="Katman Silinsin mi?"
        message="Bu zemin katmanını silmek istediğinize emin misiniz?"
        onConfirm={confirmRemove}
        onCancel={() => setSilmeOnay(null)}
      />

      {pdfOnizleme && (
        <PdfOnizlemeModal
          katmanlar={pdfOnizleme}
          onIptal={() => setPdfOnizleme(null)}
          onUygula={() => {
            onChange(pdfOnizleme.map(r => ({ ...r, id: Date.now() + Math.random() })))
            setPdfOnizleme(null)
            toast.success("Zemin logu güncellendi. Kaydetmeyi unutmayın.")
          }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h2 style={{ color: "var(--heading)", fontSize: "20px", fontWeight: "700", margin: 0 }}>Zemin Logu</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "3px 0 0" }}>
            Sondaj bazlı jeolojik profil — {stats.katmanSayisi} katman, {stats.toplamDerinlik} m
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePdfUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={pdfYukleniyor} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
            background: "white", color: "#0369A1",
            border: "1.5px solid #BAE6FD", borderRadius: "8px",
            fontSize: "13px", fontWeight: "600",
            cursor: pdfYukleniyor ? "not-allowed" : "pointer",
            opacity: pdfYukleniyor ? 0.6 : 1,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <polyline points="17,8 12,3 7,8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            {pdfYukleniyor ? "Okunuyor..." : "PDF Yükle"}
          </button>
          <button onClick={kaydet} disabled={kayitDurumu === "loading"} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 20px",
            background: kayitDurumu === "loading" ? "#94A3B8" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
            color: "white", border: "none", borderRadius: "8px",
            fontSize: "13px", fontWeight: "600",
            cursor: kayitDurumu === "loading" ? "not-allowed" : "pointer",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {kayitDurumu === "loading" ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "14px" }}>
        {[
          {
            label: "Katman Sayısı", val: `${stats.katmanSayisi}`,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="3" rx="1" fill="currentColor" opacity=".4"/><rect x="2" y="12" width="20" height="3" rx="1" fill="currentColor" opacity=".7"/><rect x="2" y="17" width="20" height="3" rx="1" fill="currentColor"/></svg>,
            color: "#0369A1",
          },
          {
            label: "Toplam Derinlik", val: `${stats.toplamDerinlik} m`,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><polyline points="8,18 12,22 16,18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            color: "#0369A1",
          },
          {
            label: "Maks. SPT", val: stats.maxSPT > 0 ? `N = ${stats.maxSPT}` : "—",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-1-1a1 1 0 010-1.4l8-8a1 1 0 011.4 0l1 1z" fill="currentColor" opacity=".5"/><path d="M20 17l-3-3 2-2 3 3a1.4 1.4 0 010 2v0a1.4 1.4 0 01-2 0z" fill="currentColor"/></svg>,
            color: "#0369A1",
          },
          {
            label: "Kaya Başlangıcı", val: stats.kayaBaslangic !== null ? `${stats.kayaBaslangic} m` : "—",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 19h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            color: "#0369A1",
          },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--bg-card)", borderRadius: "8px",
            border: "1px solid var(--input-border)",
            padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px",
          }}>
            <div style={{ color: s.color, flexShrink: 0, opacity: 0.7 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: "10.5px", color: "var(--text-secondary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.3px" }}>{s.label}</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--heading)", lineHeight: 1.2, marginTop: "2px" }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Coverage bar ───────────────────────────────────────────── */}
      {kazikBoyu > 0 && (
        <div style={{
          marginBottom: "10px", padding: "9px 14px",
          background: kapsamYuzde >= 100 ? "#F0FDF4" : "#FFFBEB",
          border: `1px solid ${kapsamYuzde >= 100 ? "#BBF7D0" : "#FDE68A"}`,
          borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "12.5px", fontWeight: "600", color: kapsamYuzde >= 100 ? "#15803D" : "#92400E", whiteSpace: "nowrap" }}>
            {kapsamYuzde >= 100 ? "Kapsam tam" : `Kapsam ${kapsamYuzde}%`}
            <span style={{ fontWeight: "400", marginLeft: "6px" }}>({maxBitis} / {kazikBoyu} m)</span>
          </span>
          <div style={{ flex: 1, height: "5px", background: "#E2E8F0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "3px",
              background: kapsamYuzde >= 100 ? "#22C55E" : "#F59E0B",
              width: `${Math.min(100, kapsamYuzde)}%`, transition: "width 0.4s",
            }} />
          </div>
        </div>
      )}

      {/* ── Depth warnings ─────────────────────────────────────────── */}
      {uyarilar.length > 0 && (
        <div style={{
          marginBottom: "10px", padding: "9px 14px",
          background: "#FEF3C7", border: "1px solid #FCD34D",
          borderRadius: "8px", color: "#92400E",
          fontSize: "12.5px", fontWeight: "500",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#D97706" strokeWidth="2"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="1" fill="#D97706"/>
          </svg>
          {uyarilar.join("  ·  ")}
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
        {ZEMIN_TIPLERI.map(t => {
          const r = zemRengi(t)
          return (
            <span key={t} style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "3px 9px", borderRadius: "4px",
              background: r.light, border: `1px solid ${r.bg}50`,
              fontSize: "11px", fontWeight: "700", color: r.bg,
              letterSpacing: "0.1px",
            }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: r.bg, flexShrink: 0 }} />
              {t} <span style={{ opacity: 0.6, fontSize: "10px" }}>{r.abbr}</span>
            </span>
          )
        })}
      </div>

      {/* ── Main card ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", background: "var(--bg-card)",
        borderRadius: "12px", border: "1px solid var(--input-border)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)", overflow: "hidden",
      }}>
        {/* Borehole profile */}
        <SondajProfili satirlar={satirlar} yeraltiSuyu={yeraltiSuyu} kazikBoyu={kazikBoyu} />

        {/* Data table */}
        <div style={{ flex: 1, overflowX: "auto", minWidth: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: "130px" }}>Derinlik (m)</th>
                <th style={{ ...thSt, width: "10px", padding: "10px 4px" }}></th>
                <th style={{ ...thSt }}>Formasyon / Birim</th>
                <th style={{ ...thSt, minWidth: "140px" }}>Zemin Tanımı</th>
                <th style={{ ...thSt, width: "105px" }}>Sınıf</th>
                <th style={{ ...thSt, width: "62px" }}>
                  <span title="SPT N60 değeri">SPT N</span>
                </th>
                <th style={{ ...thSt, width: "74px" }}>
                  <span title="Tek eksenli basınç dayanımı">UCS (MPa)</span>
                </th>
                <th style={{ ...thSt, width: "60px" }}>
                  <span title="Kaya kalitesi göstergesi">RQD %</span>
                </th>
                <th style={{ ...thSt, minWidth: "100px" }}>Kıvam / Yoğ.</th>
                <th style={{ ...thSt, width: "72px" }}>Stabilite</th>
                <th style={{ ...thSt, width: "80px" }}>Uç Tipi</th>
                <th style={{ ...thSt, minWidth: "120px" }}>Açıklama</th>
                <th style={{ ...thSt, width: "34px" }}></th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((row, idx) => {
                const { risk, uc, kivam, renk, isKaya } = satirTurev[idx]
                const renkler = RISK_RENK[risk]
                const rh = showHatalar ? satirHatasi(row) : {}
                const err = (k) => rh[k] ? { borderColor: "#FCA5A5" } : {}

                return (
                  <tr key={row.id} style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: idx % 2 === 0 ? "var(--bg-card)" : "var(--row-alt)",
                  }}>
                    {/* Depth range */}
                    <td style={tdSt}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          style={{ ...inp, width: "52px", textAlign: "center", ...err("derinlik") }}
                          type="number" value={row.baslangic} step="0.5" min="0"
                          title={rh.derinlik}
                          onChange={e => updateRow(row.id, "baslangic", parseFloat(e.target.value) || 0)}
                        />
                        <span style={{ color: "#CBD5E1", fontWeight: "700", fontSize: "11px" }}>–</span>
                        <input
                          style={{ ...inp, width: "52px", textAlign: "center", ...err("derinlik") }}
                          type="number" value={row.bitis} step="0.5" min="0"
                          title={rh.derinlik}
                          onChange={e => updateRow(row.id, "bitis", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </td>

                    {/* Soil type color swatch */}
                    <td style={{ ...tdSt, paddingLeft: "6px", paddingRight: "2px" }}>
                      <div style={{
                        width: "6px", height: "30px", borderRadius: "3px", background: renk.bg,
                      }} />
                    </td>

                    {/* Formation */}
                    <td style={tdSt}>
                      <input
                        style={{ ...inp, width: "108px" }}
                        value={row.formasyon}
                        onChange={e => updateRow(row.id, "formasyon", e.target.value)}
                        placeholder="Trakya Fm., vb."
                      />
                    </td>

                    {/* Soil type (free text combobox) + inferred calculation type badge */}
                    <td style={tdSt}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <input
                          list="zemin-tipi-list"
                          style={{ ...inp, width: "136px" }}
                          value={row.zemTipi}
                          onChange={e => updateRow(row.id, "zemTipi", e.target.value)}
                          placeholder="killi siltli kum..."
                          title="Serbest jeolojik tanım — hesaplamada kullanılacak standart tip otomatik belirlenir"
                        />
                        {!ZEMIN_TIPLERI.includes(row.zemTipi) && row.zemTipi && (() => {
                          const ht = zeminHesapTipi(row.zemTipi, row.kohezyon)
                          const r  = zemRengi(ht)
                          return (
                            <span title={`Hesaplamada "${ht}" olarak kullanılır`} style={{
                              display: "inline-flex", alignItems: "center", gap: "4px",
                              padding: "1px 6px", borderRadius: "3px",
                              background: r.light, border: `1px solid ${r.bg}55`,
                              fontSize: "10px", fontWeight: "700", color: r.bg,
                              letterSpacing: "0.1px", maxWidth: "136px",
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "1px", background: r.bg, flexShrink: 0 }} />
                              hesap: {ht}
                            </span>
                          )
                        })()}
                      </div>
                    </td>

                    {/* Kohezyon class */}
                    <td style={tdSt}>
                      <select
                        style={{ ...sel, width: "101px" }}
                        value={row.kohezyon}
                        onChange={e => updateRow(row.id, "kohezyon", e.target.value)}
                      >
                        {KOHEZYON_TIPLERI.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>

                    {/* SPT — dimmed for rock */}
                    <td style={tdSt}>
                      <input
                        style={{ ...inp, width: "55px", textAlign: "center", ...err("spt"), ...(isKaya ? dimmed : {}) }}
                        type="number" value={row.spt} min="0" max="300"
                        title={isKaya ? "Kaya için SPT uygulanmaz" : (rh.spt || "SPT N60")}
                        onChange={e => updateRow(row.id, "spt", parseInt(e.target.value) || 0)}
                      />
                    </td>

                    {/* UCS — dimmed for soil */}
                    <td style={tdSt}>
                      <input
                        style={{ ...inp, width: "62px", textAlign: "center", ...err("ucs"), ...(!isKaya ? dimmed : {}) }}
                        type="number" value={row.ucs} min="0" step="1"
                        title={!isKaya ? "Zemin için UCS uygulanmaz" : (rh.ucs || "UCS MPa")}
                        onChange={e => updateRow(row.id, "ucs", parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* RQD — dimmed for soil */}
                    <td style={tdSt}>
                      <input
                        style={{ ...inp, width: "52px", textAlign: "center", ...err("rqd"), ...(!isKaya ? dimmed : {}) }}
                        type="number" value={row.rqd} min="0" max="100"
                        title={!isKaya ? "Zemin için RQD uygulanmaz" : (rh.rqd || "RQD %")}
                        onChange={e => updateRow(row.id, "rqd", parseInt(e.target.value) || 0)}
                      />
                    </td>

                    {/* Kıvam / Density */}
                    <td style={tdSt}>
                      <span style={{
                        fontSize: "12px", fontWeight: "600",
                        color: kivam === "—" ? "#CBD5E1" : renk.bg,
                        letterSpacing: "0.1px",
                      }}>
                        {kivam}
                      </span>
                    </td>

                    {/* Stability risk */}
                    <td style={tdSt}>
                      <span style={{
                        padding: "3px 8px", borderRadius: "12px",
                        fontSize: "11px", fontWeight: "700",
                        background: renkler.bg, color: renkler.color,
                        border: `1px solid ${renkler.border}`, whiteSpace: "nowrap",
                      }}>
                        {risk}
                      </span>
                    </td>

                    {/* Tool type recommendation */}
                    <td style={tdSt}>
                      <span style={{
                        padding: "3px 8px", borderRadius: "12px",
                        fontSize: "11px", fontWeight: "700",
                        background: uc.bg, color: uc.color,
                        border: `1px solid ${uc.color}30`, whiteSpace: "nowrap",
                      }}>
                        {uc.label}
                      </span>
                    </td>

                    {/* Description / notes */}
                    <td style={tdSt}>
                      <input
                        style={{ ...inp, width: "116px", fontSize: "12px" }}
                        value={row.aciklama || ""}
                        onChange={e => updateRow(row.id, "aciklama", e.target.value)}
                        placeholder="Katkılı, plastik, vb."
                        title="Jeolojik açıklama / saha notu"
                      />
                    </td>

                    {/* Delete */}
                    <td style={{ ...tdSt, textAlign: "center" }}>
                      <button onClick={() => removeRow(row.id)} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#CBD5E1", fontSize: "15px", padding: "4px",
                        borderRadius: "4px", lineHeight: 1,
                      }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <datalist id="zemin-tipi-list">
            {ZEMIN_TIPLERI.map(t => <option key={t} value={t} />)}
          </datalist>

          {/* Footer */}
          <div style={{
            padding: "12px 14px", borderTop: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <button onClick={addRow} style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 16px", background: "#F0F9FF", color: "#0369A1",
              border: "1.5px solid #BAE6FD", borderRadius: "7px",
              fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Katman Ekle
            </button>
            <div style={{ display: "flex", gap: "16px", fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: "600" }}>
              <span>{stats.katmanSayisi} katman</span>
              <span>·</span>
              <span>{maxBitis} m toplam</span>
              {yeraltiSuyu > 0 && <><span>·</span><span style={{ color: "#3B82F6" }}>YAS {yeraltiSuyu} m</span></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
