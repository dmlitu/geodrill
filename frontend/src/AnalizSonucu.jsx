import { useState, useMemo, useCallback } from "react"
import { downloadPdfReport, downloadSoilLayersCsv } from "./api"
import { ZeminProfilDiyagrami, TorkDerinlikGrafigi, GanttSemasi, SenaryoKarsilastirma } from "./Gorseller"
import {
  gerekliTork, stabiliteRiski, casingDurum, casingMetreHesapla,
  kazikSuresi, mazotTahmini, kritikKatman, makinaUygunluk,
} from "./hesaplamalar"

// ── Kart bileşeni ───────────────────────────────────────
function MetrikKart({ baslik, deger, renk, alt, oran }) {
  return (
    <div style={{
      background: "white", borderRadius: "12px",
      padding: "20px", border: "1px solid #E2E8F0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "4px",
        background: renk,
      }} />
      <div style={{fontSize: "12px", color: "#64748B", fontWeight: "600", marginBottom: "8px", letterSpacing: "0.02em"}}>{baslik}</div>
      <div style={{fontSize: "24px", fontWeight: "700", color: "#0C4A6E"}}>{deger}</div>
      {alt && <div style={{fontSize: "12px", color: "#94A3B8", marginTop: "4px"}}>{alt}</div>}
      {oran !== undefined && (
        <div style={{ marginTop: "10px", height: "4px", background: "#F1F5F9", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, oran))}%`, height: "100%",
            background: renk, borderRadius: "2px",
            transition: "width 0.6s ease",
          }} />
        </div>
      )}
    </div>
  )
}

// ── PDF Önizleme Modal ──────────────────────────────────
function PdfOnizleme({ open, onClose, onDownload, yukleniyor, proje, analiz, zemin, makineUygunluklari }) {
  if (!open || !analiz) return null
  const { tork, casingDur, casingM, sure, mBasi, topMazot, toplamGun } = analiz

  const rows = [
    ["Proje Adi", proje.projeAdi || "—"],
    ["Lokasyon", proje.lokasyon || "—"],
    ["Is Tipi", proje.isTipi],
    ["Kazik", `${proje.kazikBoyu}m / Ø${proje.kazikCapi}mm / ${proje.kazikAdedi} adet`],
  ]
  const metrikler = [
    ["Gerekli Min. Tork", `${tork} kNm`],
    ["Muhafaza Borusu", `${casingDur} (${casingM} m)`],
    ["1 Kazik Suresi", `${sure} saat`],
    ["Toplam Is Suresi", `${toplamGun} gun`],
    ["Metre Basi Mazot", `${mBasi} L/m`],
    ["Toplam Mazot", `${Math.round(topMazot * proje.kazikAdedi)} L`],
  ]

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        animation: "fadeUp 0.15s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)", borderRadius: "16px",
          width: "100%", maxWidth: "520px", maxHeight: "85vh",
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
          animation: "fadeUp 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>PDF Rapor Onizleme</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Rapor icerigi asagidaki gibi olusturulacak</p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "20px", padding: "4px",
          }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* Fake PDF page */}
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: "8px",
            padding: "24px", color: "#0C4A6E", fontSize: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ textAlign: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "2px solid #0284C7" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "16px", fontWeight: "800", color: "#0C4A6E" }}>
                GeoDrill — Analiz Raporu
              </div>
              <div style={{ fontSize: "10px", color: "#64748B", marginTop: "4px" }}>
                {proje.projeAdi} | {proje.lokasyon} | {new Date().toLocaleDateString("tr-TR")}
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", marginBottom: "6px" }}>Proje Bilgileri</div>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ color: "#64748B" }}>{k}</span>
                  <span style={{ fontWeight: "600" }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", marginBottom: "6px" }}>Analiz Sonuclari</div>
              {metrikler.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ color: "#64748B" }}>{k}</span>
                  <span style={{ fontWeight: "600" }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", marginBottom: "6px" }}>Zemin Logu ({zemin.length} katman)</div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {zemin.map((z, i) => (
                  <span key={i} style={{
                    padding: "2px 8px", borderRadius: "4px", fontSize: "10px",
                    background: "#F0F9FF", border: "1px solid #E0F2FE", color: "#0369A1",
                  }}>
                    {z.zemTipi} ({z.baslangic}-{z.bitis}m)
                  </span>
                ))}
              </div>
            </div>

            {makineUygunluklari.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", marginBottom: "6px", marginTop: "10px" }}>
                  Ekipman ({makineUygunluklari.length} makine)
                </div>
                {makineUygunluklari.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ color: "#64748B" }}>{m.ad} ({m.marka})</span>
                    <span style={{ fontWeight: "600", color: m.renk }}>{m.karar}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid #E2E8F0", fontSize: "9px", color: "#94A3B8", textAlign: "center" }}>
              GeoDrill Insight — {new Date().toLocaleDateString("tr-TR")}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--border-subtle)",
          display: "flex", gap: "10px", justifyContent: "flex-end",
        }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", border: "1px solid var(--input-border)",
            borderRadius: "8px", background: "var(--bg-surface)",
            color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600",
            cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Kapat
          </button>
          <button onClick={onDownload} disabled={yukleniyor} style={{
            padding: "10px 24px", border: "none", borderRadius: "8px",
            background: yukleniyor ? "#94A3B8" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
            color: "white", fontSize: "13px", fontWeight: "600",
            cursor: yukleniyor ? "wait" : "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {yukleniyor ? "Olusturuluyor..." : "PDF Indir"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSV indirme (client-side) ─────────────────────────────
function analizCsvIndir(proje, tork, casingDur, casingM, sure, toplamGun, mBasi, topMazot, makineUygunluklari) {
  const satirlar = [
    ["Metrik", "Değer"],
    ["Gerekli Min. Tork (kNm)", tork],
    ["Casing Durumu", casingDur],
    ["Tahmini Casing (m)", casingM],
    ["1 Kazık Süresi (saat)", sure],
    ["Toplam İş Süresi (gün)", toplamGun],
    ["Metre Başı Mazot (L/m)", mBasi],
    ["Toplam Mazot (L)", Math.round(topMazot * proje.kazikAdedi)],
    [],
    ["Makine", "Karar", "Gerekçe"],
    ...makineUygunluklari.map(m => [m.ad, m.karar, m.gerekce]),
  ]
  const csv = satirlar.map(r => r.join(";")).join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `analiz_${proje.projeKodu || "sonucu"}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Ana bileşen ─────────────────────────────────────────
export default function AnalizSonucu({ proje, zemin, makineler, projeId }) {
  const [pdfYukleniyor, setPdfYukleniyor] = useState(false)
  const [csvYukleniyor, setCsvYukleniyor] = useState(false)
  const [pdfOnizlemeAcik, setPdfOnizlemeAcik] = useState(false)

  const handlePdf = useCallback(async () => {
    if (!projeId) return
    setPdfYukleniyor(true)
    try { await downloadPdfReport(projeId) } finally { setPdfYukleniyor(false); setPdfOnizlemeAcik(false) }
  }, [projeId])

  const handleZeminCsv = async () => {
    if (!projeId) return
    setCsvYukleniyor(true)
    try { await downloadSoilLayersCsv(projeId) } finally { setCsvYukleniyor(false) }
  }

  // useMemo: zemin veya proje değişmediğinde hesaplamalar yeniden yapılmaz
  const analiz = useMemo(() => {
    if (!zemin.length) return null
    const tork = gerekliTork(zemin, proje.kazikCapi)
    const { durum: casingDur, gerekce, zorunlu } = casingDurum(zemin, proje.yeraltiSuyu)
    const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
    const sure = kazikSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM)
    const { mBasi, toplam: topMazot } = mazotTahmini(tork, proje.kazikBoyu)
    const kritik = kritikKatman(zemin)
    const gunlukUretim = Math.max(1, Math.round(10 / sure))
    const toplamGun = Math.round((sure * proje.kazikAdedi) / 10 * 10) / 10
    const ucOneri = zemin.some(r => ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(r.zemTipi) || r.ucs >= 25)
      ? "Kaya ucu gerekli" : zemin.some(r => r.zemTipi === "Ayrışmış Kaya" || r.ucs >= 10)
      ? "Geçiş tipi uç" : "Standart uç yeterli"
    const makineUygunluklari = makineler.map(m => ({ ...m, ...makinaUygunluk(m, tork, proje.kazikBoyu, proje.kazikCapi, zorunlu) }))
    return { tork, casingDur, gerekce, zorunlu, casingM, sure, mBasi, topMazot, kritik, gunlukUretim, toplamGun, ucOneri, makineUygunluklari }
  }, [zemin, proje, makineler])

  if (!zemin.length) {
    return (
      <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center", animation: "fadeUp 0.4s ease"}}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: "24px" }}>
          <rect x="20" y="30" width="80" height="70" rx="6" fill="#E0F2FE" stroke="#BAE6FD" strokeWidth="2" />
          <rect x="32" y="45" width="56" height="4" rx="2" fill="#BAE6FD" />
          <rect x="32" y="55" width="40" height="4" rx="2" fill="#BAE6FD" />
          <rect x="32" y="65" width="48" height="4" rx="2" fill="#BAE6FD" />
          <rect x="32" y="75" width="32" height="4" rx="2" fill="#BAE6FD" />
          <circle cx="90" cy="30" r="18" fill="#FEF2F2" stroke="#FECACA" strokeWidth="2" />
          <path d="M84 24L96 36M96 24L84 36" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h2 style={{color: "#0369A1", fontSize: "20px", fontWeight: "700", marginBottom: "8px"}}>Zemin Verisi Eksik</h2>
        <p style={{color: "#94A3B8", fontSize: "14px", maxWidth: "320px", lineHeight: "1.6"}}>
          Analiz icin zemin katman verilerine ihtiyac var.<br />
          <strong style={{color: "#64748B"}}>Zemin Logu</strong> sayfasindan verileri girin.
        </p>
      </div>
    )
  }

  const { tork, casingDur, gerekce, casingM, sure, mBasi, topMazot, kritik, gunlukUretim, toplamGun, ucOneri, makineUygunluklari } = analiz

  return (
    <div>
      <PdfOnizleme
        open={pdfOnizlemeAcik}
        onClose={() => setPdfOnizlemeAcik(false)}
        onDownload={handlePdf}
        yukleniyor={pdfYukleniyor}
        proje={proje}
        analiz={analiz}
        zemin={zemin}
        makineUygunluklari={makineUygunluklari}
      />
      <div style={{marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px"}}>
        <div>
          <h2 style={{color: "var(--heading)", fontSize: "22px", fontWeight: "700"}}>Analiz Sonucu</h2>
          <p style={{color: "var(--text-muted)", fontSize: "14px", marginTop: "4px"}}>
            {proje.projeAdi || "Proje"} — {proje.kazikBoyu}m / Ø{proje.kazikCapi}mm / {proje.kazikAdedi} adet
          </p>
        </div>
        <div style={{display: "flex", gap: "8px", flexShrink: 0}} className="no-print">
          {projeId && (
            <>
              <button onClick={() => analizCsvIndir(proje, tork, casingDur, casingM, sure, toplamGun, mBasi, topMazot, makineUygunluklari)}
                style={{padding: "8px 16px", border: "1.5px solid #E2E8F0", borderRadius: "8px", background: "white", color: "#475569", fontSize: "13px", fontWeight: "600", cursor: "pointer"}}>
                Analiz CSV
              </button>
              <button onClick={handleZeminCsv} disabled={csvYukleniyor}
                style={{padding: "8px 16px", border: "1.5px solid #E2E8F0", borderRadius: "8px", background: "white", color: "#475569", fontSize: "13px", fontWeight: "600", cursor: csvYukleniyor ? "wait" : "pointer"}}>
                {csvYukleniyor ? "..." : "Zemin CSV"}
              </button>
              <button onClick={() => setPdfOnizlemeAcik(true)}
                style={{padding: "8px 16px", border: "none", borderRadius: "8px", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer"}}>
                PDF Rapor
              </button>
              <button onClick={() => window.print()}
                style={{padding: "8px 16px", border: "1.5px solid #E2E8F0", borderRadius: "8px", background: "white", color: "#475569", fontSize: "13px", fontWeight: "600", cursor: "pointer"}}>
                Yazdır
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrik kartlar */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px"}}>
        <MetrikKart baslik="Gerekli Min. Tork" deger={`${tork} kNm`} renk="#0284C7"
          alt={tork < 100 ? "Hafif zemin" : tork < 200 ? "Orta zorluk" : "Agir zemin"}
          oran={Math.min(100, (tork / 300) * 100)} />
        <MetrikKart baslik="Muhafaza Borusu" deger={casingDur} renk="#6366F1" alt={`${casingM} m tahmini`}
          oran={(casingM / proje.kazikBoyu) * 100} />
        <MetrikKart baslik="1 Kazik Suresi" deger={`${sure} saat`} renk="#0891B2" alt={`~${gunlukUretim} kazik/gun`}
          oran={Math.min(100, (sure / 12) * 100)} />
        <MetrikKart baslik="Toplam Is Suresi" deger={`${toplamGun} gun`} renk="#0EA5E9" alt={`${proje.kazikAdedi} kazik`}
          oran={Math.min(100, (toplamGun / 60) * 100)} />
        <MetrikKart
          baslik="Stabilite Skoru"
          deger={(() => { const skor = Math.round(zemin.reduce((s, r) => s + (stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Yüksek" ? 70 : stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Orta" ? 40 : 15), 0) / zemin.length); return `${skor}/100` })()}
          renk={(() => { const skor = Math.round(zemin.reduce((s, r) => s + (stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Yüksek" ? 70 : stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Orta" ? 40 : 15), 0) / zemin.length); return skor > 50 ? "#DC2626" : skor > 30 ? "#D97706" : "#16A34A" })()}
          alt={(() => { const skor = Math.round(zemin.reduce((s, r) => s + (stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Yüksek" ? 70 : stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Orta" ? 40 : 15), 0) / zemin.length); return skor > 50 ? "Yuksek risk" : skor > 30 ? "Orta risk" : "Dusuk risk" })()}
          oran={Math.round(zemin.reduce((s, r) => s + (stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Yüksek" ? 70 : stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Orta" ? 40 : 15), 0) / zemin.length)}
        />
      </div>

      {/* İki kolon */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px", marginBottom: "20px"}}>
        {/* Sol — Proje özeti */}
        <div style={{background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
          <h3 style={{color: "var(--heading)", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)"}}>
            📋 Proje Özeti
          </h3>
          {[
            ["Proje", proje.projeAdi || "—"],
            ["Proje Kodu", proje.projeKodu || "—"],
            ["Saha Kodu", proje.sahaKodu || "—"],
            ["İş Tipi", proje.isTipi],
            ["Kazık Boyu", `${proje.kazikBoyu} m`],
            ["Kazık Çapı", `${proje.kazikCapi} mm`],
            ["Kazık Adedi", proje.kazikAdedi],
            ["Yeraltı Suyu", `${proje.yeraltiSuyu} m`],
          ].map(([k, v]) => (
            <div key={k} style={{display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)"}}>
              <span style={{color: "#64748B", fontSize: "13px"}}>{k}</span>
              <span style={{color: "#1E293B", fontSize: "13px", fontWeight: "600"}}>{v}</span>
            </div>
          ))}

          <h3 style={{color: "var(--heading)", fontSize: "15px", fontWeight: "700", margin: "20px 0 12px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)"}}>
            🔧 Teknik Öneriler
          </h3>
          {[
            ["Uç Önerisi", ucOneri],
            ["Metre Başı Mazot", `${mBasi} L/m`],
            ["Bir Kazık Mazot", `${topMazot} L`],
            ["Toplam Mazot", `${Math.round(topMazot * proje.kazikAdedi)} L`],
          ].map(([k, v]) => (
            <div key={k} style={{display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)"}}>
              <span style={{color: "#64748B", fontSize: "13px"}}>{k}</span>
              <span style={{color: "#1E293B", fontSize: "13px", fontWeight: "600"}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Sağ — Kritik katman + casing */}
        <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
          {kritik && (
            <div style={{background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
              <h3 style={{color: "var(--heading)", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)"}}>
                🪨 Kritik Zemin Katmanı
              </h3>
              {[
                ["Formasyon", kritik.formasyon],
                ["Derinlik", `${kritik.baslangic} – ${kritik.bitis} m`],
                ["Zemin Tipi", kritik.zemTipi],
                ["SPT", kritik.spt],
                ["UCS", `${kritik.ucs} MPa`],
                ["RQD", kritik.rqd],
              ].map(([k, v]) => (
                <div key={k} style={{display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)"}}>
                  <span style={{color: "#64748B", fontSize: "13px"}}>{k}</span>
                  <span style={{color: "#1E293B", fontSize: "13px", fontWeight: "600"}}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
            <h3 style={{color: "var(--heading)", fontSize: "15px", fontWeight: "700", marginBottom: "12px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)"}}>
              🔩 Casing Değerlendirmesi
            </h3>
            {gerekce.map((g, i) => (
              <div key={i} style={{fontSize: "13px", color: "#475569", padding: "5px 0", borderBottom: "1px solid var(--border-subtle)"}}>
                • {g}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Görselleştirmeler */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px", alignItems: "start" }}>
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <ZeminProfilDiyagrami zemin={zemin} yeraltiSuyu={proje.yeraltiSuyu} kazikBoyu={proje.kazikBoyu} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <TorkDerinlikGrafigi zemin={zemin} kazikCapi={proje.kazikCapi} />
          </div>
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <GanttSemasi kazikAdedi={proje.kazikAdedi} sure={sure} toplamGun={toplamGun} />
          </div>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
        <SenaryoKarsilastirma zemin={zemin} kazikCapi={proje.kazikCapi} kazikBoyu={proje.kazikBoyu} kazikAdedi={proje.kazikAdedi} />
      </div>

      {/* Makine uygunluk */}
      {makineUygunluklari.length > 0 && (
        <div style={{background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
          <h3 style={{color: "var(--heading)", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)"}}>
            ⚙️ Makine Uygunluk Sonuçları
          </h3>

          {/* Özet sayılar */}
          <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "20px"}}>
            {[
              ["Uygun", makineUygunluklari.filter(m => m.karar === "Uygun").length, "#16A34A", "#F0FDF4"],
              ["Şartlı Uygun", makineUygunluklari.filter(m => m.karar === "Şartlı Uygun").length, "#D97706", "#FFFBEB"],
              ["Riskli", makineUygunluklari.filter(m => m.karar === "Riskli").length, "#DC2626", "#FEF2F2"],
              ["Uygun Değil", makineUygunluklari.filter(m => m.karar === "Uygun Değil").length, "#6B7280", "#F9FAFB"],
            ].map(([label, sayi, renk, bg]) => (
              <div key={label} style={{background: bg, border: `1px solid ${renk}30`, borderRadius: "10px", padding: "14px", textAlign: "center"}}>
                <div style={{fontSize: "24px", fontWeight: "700", color: renk}}>{sayi}</div>
                <div style={{fontSize: "12px", color: renk, fontWeight: "600"}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Tablo */}
          <div style={{overflowX: "auto"}}>
            <table className="data-table" style={{width: "100%", borderCollapse: "collapse"}}>
              <thead>
                <tr style={{background: "var(--badge-muted-bg)", borderBottom: "2px solid var(--input-border)"}}>
                  {["Makine", "Marka", "Tork (kNm)", "Max Derinlik", "Max Çap", "Casing", "Karar", "Gerekçe"].map(h => (
                    <th key={h} style={{padding: "10px 14px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748B", whiteSpace: "nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {makineUygunluklari.map((m, i) => (
                  <tr key={m.id || i} style={{borderBottom: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--row-alt)"}}>
                    <td style={{padding: "10px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B"}}>{m.ad}</td>
                    <td style={{padding: "10px 14px", fontSize: "13px", color: "#475569"}}>{m.marka}</td>
                    <td style={{padding: "10px 14px", fontSize: "13px", color: "#475569"}}>{m.tork}</td>
                    <td style={{padding: "10px 14px", fontSize: "13px", color: "#475569"}}>{m.maxDerinlik} m</td>
                    <td style={{padding: "10px 14px", fontSize: "13px", color: "#475569"}}>{m.maxCap} mm</td>
                    <td style={{padding: "10px 14px", fontSize: "13px", color: "#475569"}}>{m.casing}</td>
                    <td style={{padding: "10px 14px"}}>
                      <span style={{padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", color: m.renk, background: m.bg, border: `1px solid ${m.renk}30`, whiteSpace: "nowrap"}}>
                        {m.karar}
                      </span>
                    </td>
                    <td style={{padding: "10px 14px", fontSize: "12px", color: "#64748B"}}>{m.gerekce}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}