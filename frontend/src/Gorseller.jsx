import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts"
import { ropHesapla } from "./hesaplamalar"
import { useLang } from "./LangContext"

// ─── Renk haritası ────────────────────────────────────────────────────────────

const ZEMIN_RENK = {
  "Dolgu":         "#94A3B8",
  "Kil":           "#D97706",
  "Silt":          "#F59E0B",
  "Kum":           "#FBBF24",
  "Çakıl":         "#92400E",
  "Ayrışmış Kaya": "#6B7280",
  "Kumtaşı":       "#9CA3AF",
  "Kireçtaşı":     "#60A5FA",
  "Sert Kaya":     "#0C4A6E",
}

// ─── 1. Zemin Profili Diyagramı (SVG) ────────────────────────────────────────

export function ZeminProfilDiyagrami({ zemin, yeraltiSuyu, kazikBoyu }) {
  const [hover, setHover] = useState(null)
  const { t } = useLang()

  if (!zemin.length) return null

  const maxDepth = Math.max(kazikBoyu || 0, ...zemin.map(r => r.bitis))
  const W = 220
  const H = 440
  const LEFT = 48
  const CHART_W = 110
  const depthToY = d => (d / maxDepth) * H

  return (
    <div style={{ position: "relative" }}>
      <h3 style={{ color: "#0369A1", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid #E0F2FE" }}>
        {t("soilProfile")}
      </h3>
      <svg width={W + 60} height={H + 20} style={{ overflow: "visible" }}>
        {/* Katmanlar */}
        {zemin.map((row, i) => {
          const y1 = depthToY(row.baslangic)
          const y2 = depthToY(row.bitis)
          const renk = ZEMIN_RENK[row.zemTipi] || "#CBD5E1"
          const isHovered = hover === i
          return (
            <g key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x={LEFT} y={y1} width={CHART_W} height={y2 - y1}
                fill={renk} stroke={isHovered ? "#0C4A6E" : "white"} strokeWidth={isHovered ? 2 : 1} opacity={isHovered ? 1 : 0.85} />
              {(y2 - y1) >= 18 && (
                <text x={LEFT + CHART_W / 2} y={(y1 + y2) / 2 + 4}
                  textAnchor="middle" fontSize={9} fill="white" fontWeight="600" pointerEvents="none">
                  {row.zemTipi}
                </text>
              )}
            </g>
          )
        })}

        {/* Derinlik ekseni sol */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const d = Math.round(maxDepth * p * 10) / 10
          const y = depthToY(d)
          return (
            <g key={p}>
              <line x1={LEFT - 4} y1={y} x2={LEFT + CHART_W} y2={y}
                stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,2" />
              <text x={LEFT - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#64748B">{d}m</text>
            </g>
          )
        })}

        {/* Yeraltı suyu */}
        {yeraltiSuyu > 0 && yeraltiSuyu <= maxDepth && (
          <g>
            <line x1={LEFT - 4} x2={LEFT + CHART_W + 4}
              y1={depthToY(yeraltiSuyu)} y2={depthToY(yeraltiSuyu)}
              stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="6,3" />
            <text x={LEFT + CHART_W + 6} y={depthToY(yeraltiSuyu) + 4}
              fontSize={9} fill="#3B82F6" fontWeight="600">{t("gwt")}</text>
          </g>
        )}

        {/* Kazık boyu */}
        {kazikBoyu > 0 && (
          <g>
            <line x1={LEFT + CHART_W / 2 - 6} x2={LEFT + CHART_W / 2 + 6}
              y1={depthToY(kazikBoyu)} y2={depthToY(kazikBoyu)}
              stroke="#DC2626" strokeWidth={2} />
            <text x={LEFT + CHART_W + 6} y={depthToY(kazikBoyu) + 4}
              fontSize={9} fill="#DC2626" fontWeight="600">{t("pileEnd")}</text>
          </g>
        )}

        {/* Başlık */}
        <text x={LEFT + CHART_W / 2} y={-8} textAnchor="middle" fontSize={10} fill="#0369A1" fontWeight="700">
          {t("depthLabel")}
        </text>
      </svg>

      {/* Hover tooltip */}
      {hover !== null && zemin[hover] && (
        <div style={{
          marginTop: "8px", padding: "10px 14px",
          background: "#0C4A6E", color: "white", borderRadius: "8px",
          fontSize: "12px", lineHeight: "1.6",
          animation: "fadeUp 0.15s ease",
        }}>
          <strong>{zemin[hover].zemTipi}</strong> — {zemin[hover].baslangic}m ~ {zemin[hover].bitis}m
          <br />SPT: {zemin[hover].spt} | UCS: {zemin[hover].ucs} MPa | RQD: {zemin[hover].rqd}%
          {zemin[hover].formasyon && <><br />{t("formationLabel")}: {zemin[hover].formasyon}</>}
        </div>
      )}

      {/* Lejant */}
      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[...new Set(zemin.map(r => r.zemTipi))].map(tip => (
          <span key={tip} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#475569" }}>
            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: ZEMIN_RENK[tip] || "#CBD5E1" }} />
            {tip}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#3B82F6" }}>
          <span style={{ display: "inline-block", width: "14px", height: "2px", background: "#3B82F6", borderTop: "2px dashed #3B82F6" }} />
          {t("gwt")}
        </span>
      </div>
    </div>
  )
}

// ─── 2. Tork-Derinlik Grafiği (Recharts) ─────────────────────────────────────

function katmanTork(row, capMm) {
  const capM = capMm / 1000
  const spt = parseFloat(row.spt || 0)
  const ucs = parseFloat(row.ucs || 0)
  const rqd = parseFloat(row.rqd || 0)
  let tau = ucs > 0 ? (ucs * 1000) / 10 : row.kohezyon === "Kohezyonlu" ? Math.max(spt * 4, 20) : Math.max(spt * 2, 15)
  if (rqd > 0) tau *= rqd < 25 ? 1.35 : rqd < 50 ? 1.20 : rqd < 75 ? 1.10 : 1.0
  return Math.round(tau * Math.PI * Math.pow(capM, 3) / 8 * 1.25 * 10) / 10
}

export function TorkDerinlikGrafigi({ zemin, kazikCapi }) {
  const { t } = useLang()

  if (!zemin.length) return null

  const torkLabel = t("torqueUnit")

  const data = zemin.map(row => ({
    derinlik: `${row.baslangic}-${row.bitis}m`,
    [torkLabel]: katmanTork(row, kazikCapi),
    tip: row.zemTipi,
  }))

  return (
    <div>
      <h3 style={{ color: "#0369A1", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid #E0F2FE" }}>
        {t("torqueDepthChart")}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: `${torkLabel} (kNm)`, position: "insideBottom", offset: -4, fontSize: 11 }} />
          <YAxis type="category" dataKey="derinlik" tick={{ fontSize: 10 }} width={60} />
          <Tooltip
            formatter={(v) => [`${v} kNm`, torkLabel]}
            contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
          />
          <Bar dataKey={torkLabel} radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={ZEMIN_RENK[entry.tip] || "#0EA5E9"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── 3. Gantt Şeması (SVG) ────────────────────────────────────────────────────

export function GanttSemasi({ kazikAdedi, sure, toplamGun }) {
  const { t } = useLang()

  const mobilize = 1
  const delmeSure = Math.ceil((sure * kazikAdedi) / 10)
  const bekleme = Math.ceil(delmeSure * 0.1)
  const demobilize = 1
  const toplam = mobilize + delmeSure + bekleme + demobilize

  const fazlar = [
    { ad: t("ganttMobilization"), sure: mobilize, renk: "#6366F1" },
    { ad: t("ganttDrilling"), sure: delmeSure, renk: "#0284C7" },
    { ad: t("ganttWaiting"), sure: bekleme, renk: "#0EA5E9" },
    { ad: t("ganttDemobilization"), sure: demobilize, renk: "#94A3B8" },
  ]

  const W = 420
  const H_ROW = 32
  const H = fazlar.length * (H_ROW + 6) + 40
  const LEFT = 120
  const BAR_W = W - LEFT

  let baslangicGun = 0
  return (
    <div>
      <h3 style={{ color: "#0369A1", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid #E0F2FE" }}>
        {t("projectTimeline")}
      </h3>
      <svg width={W + 60} height={H} style={{ overflow: "visible" }}>
        {/* Gün grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const x = LEFT + p * BAR_W
          const gun = Math.round(toplam * p)
          return (
            <g key={p}>
              <line x1={x} y1={0} x2={x} y2={H - 30} stroke="#E2E8F0" strokeWidth={1} />
              <text x={x} y={H - 14} textAnchor="middle" fontSize={9} fill="#64748B">{gun}g</text>
            </g>
          )
        })}
        <text x={LEFT + BAR_W / 2} y={H - 2} textAnchor="middle" fontSize={10} fill="#94A3B8">
          {t("totalDays").replace("{n}", toplamGun)}
        </text>

        {fazlar.map((faz, i) => {
          const x = LEFT + (baslangicGun / toplam) * BAR_W
          const w = (faz.sure / toplam) * BAR_W
          const y = i * (H_ROW + 6)
          baslangicGun += faz.sure
          return (
            <g key={faz.ad}>
              <text x={LEFT - 8} y={y + H_ROW / 2 + 4} textAnchor="end" fontSize={10} fill="#475569">{faz.ad}</text>
              <rect x={x} y={y} width={w} height={H_ROW} rx={4} fill={faz.renk} opacity={0.85} />
              {w > 30 && (
                <text x={x + w / 2} y={y + H_ROW / 2 + 4} textAnchor="middle" fontSize={10} fill="white" fontWeight="600">
                  {faz.sure}g
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── 4. Senaryo Karşılaştırması ───────────────────────────────────────────────

function senaryoTork(zemin, capMm) {
  return Math.max(...zemin.map(r => katmanTork(r, capMm)))
}

function sureTahmini(zemin, capMm, kazikBoyu) {
  let sure = 0.75
  let ucDeg = 0, onceki = null
  for (const row of zemin) {
    const kalinlik = row.bitis - row.baslangic
    sure += kalinlik / ropHesapla(row.zemTipi, row.ucs, capMm)
    if (["Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya"].includes(row.zemTipi) && row.zemTipi !== onceki) ucDeg++
    onceki = row.zemTipi
  }
  sure += ucDeg * 0.6 + (Math.PI * Math.pow(capMm / 1000 / 2, 2) * kazikBoyu * (20 / 60))
  if (kazikBoyu >= 30) sure += 1.5
  else if (kazikBoyu >= 20) sure += 0.8
  return Math.round(sure * 10) / 10
}

export function SenaryoKarsilastirma({ zemin, kazikCapi, kazikBoyu, kazikAdedi }) {
  const { t } = useLang()

  if (!zemin.length) return null

  const torkKey = `${t("torqueUnit")} (kNm)`
  const pileKey = `${t("onePileHours")}`

  const senaryolar = [-400, -200, 0, 200, 400].map(delta => {
    const cap = kazikCapi + delta
    if (cap <= 0) return null
    const tork = senaryoTork(zemin, cap)
    const sure = sureTahmini(zemin, cap, kazikBoyu)
    return { cap, tork, sure, toplamGun: Math.round((sure * kazikAdedi) / 10 * 10) / 10, isMain: delta === 0 }
  }).filter(Boolean)

  const data = senaryolar.map(s => ({
    name: `Ø${s.cap}mm`,
    [torkKey]: s.tork,
    [pileKey]: s.sure,
    isMain: s.isMain,
  }))

  return (
    <div>
      <h3 style={{ color: "#0369A1", fontSize: "15px", fontWeight: "700", marginBottom: "8px", paddingBottom: "10px", borderBottom: "2px solid #E0F2FE" }}>
        {t("scenarioComparison")}
      </h3>
      <p style={{ color: "#94A3B8", fontSize: "12px", marginBottom: "16px" }}>
        {t("scenarioBaseDesc").replace("{d}", kazikCapi)}
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="tork" orientation="left" tick={{ fontSize: 10 }} label={{ value: "kNm", angle: -90, position: "insideLeft", fontSize: 10 }} />
          <YAxis yAxisId="sure" orientation="right" tick={{ fontSize: 10 }} label={{ value: "h", angle: 90, position: "insideRight", fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar yAxisId="tork" dataKey={torkKey} radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isMain ? "#0284C7" : "#7DD3FC"} />
            ))}
          </Bar>
          <Bar yAxisId="sure" dataKey={pileKey} radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isMain ? "#0891B2" : "#A5F3FC"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
