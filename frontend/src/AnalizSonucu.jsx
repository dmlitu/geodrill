import { useState, useMemo, useCallback } from "react"
import { downloadPdfReport, downloadSoilLayersCsv } from "./api"
import { ZeminProfilDiyagrami, TorkDerinlikGrafigi, GanttSemasi, SenaryoKarsilastirma } from "./Gorseller"
import {
  gerekliTork, gerekliTorkAralik, stabiliteRiski, casingDurum, casingMetreHesapla,
  kazikSuresi, kafesBetonSuresi, mazotTahmini, kritikKatman, makinaUygunluk,
  katmanTeknikCikti, operasyonOnerisi,
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
    const torkAralik = gerekliTorkAralik(zemin, proje.kazikCapi, proje.isTipi)
    const tork = torkAralik.nominal
    const { durum: casingDur, gerekce, zorunlu } = casingDurum(zemin, proje.yeraltiSuyu)
    const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
    const sure = kazikSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM)
    const kafesBetonS = kafesBetonSuresi(proje.kazikCapi, proje.kazikBoyu)
    const { mBasi, toplam: topMazot } = mazotTahmini(tork, proje.kazikBoyu)
    const kritik = kritikKatman(zemin)
    const gunlukUretim = Math.max(1, Math.round(10 / sure))
    // Total working days = (rig hrs/pile × pile count) / 10 hrs per workday
    const toplamGun = Math.round((sure * proje.kazikAdedi / 10) * 10) / 10
    const ucOneri = zemin.some(r => ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(r.zemTipi) || r.ucs >= 25)
      ? "Kaya ucu gerekli" : zemin.some(r => r.zemTipi === "Ayrışmış Kaya" || r.ucs >= 10)
      ? "Geçiş tipi uç" : "Standart uç yeterli"
    const makineUygunluklari = makineler.map(m => ({ ...m, ...makinaUygunluk(m, tork, proje.kazikBoyu, proje.kazikCapi, zorunlu, proje.isTipi) }))
    // Stabilite skoru — bir kez hesapla
    const stabiliteSkor = zemin.length > 0
      ? Math.round(zemin.reduce((s, r) => {
          const risk = stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu, r.baslangic)
          return s + (risk === "Yüksek" ? 70 : risk === "Orta" ? 40 : 15)
        }, 0) / zemin.length)
      : 0
    // Sistem Kararı — en uygun makineyi belirle
    const uygunMakineler = makineUygunluklari.filter(m => m.karar === "Uygun")
    const riskliMakineler = makineUygunluklari.filter(m => m.karar === "Riskli" || m.karar === "Şartlı Uygun")
    const sistemKarari = uygunMakineler.length > 0
      ? { makine: uygunMakineler.reduce((best, m) => m.tork < best.tork ? m : best, uygunMakineler[0]), durum: "Uygun", renk: "#16A34A", bg: "#F0FDF4" }
      : riskliMakineler.length > 0
      ? { makine: riskliMakineler[0], durum: riskliMakineler[0].karar, renk: "#D97706", bg: "#FFFBEB" }
      : { makine: null, durum: "Uygun makine yok", renk: "#DC2626", bg: "#FEF2F2" }
    const katmanCiktilar = katmanTeknikCikti(zemin, proje.kazikCapi)
    const opOneri = operasyonOnerisi(zemin, proje.yeraltiSuyu)
    return { tork, torkAralik, casingDur, gerekce, zorunlu, casingM, sure, kafesBetonS, mBasi, topMazot, kritik, gunlukUretim, toplamGun, ucOneri, makineUygunluklari, stabiliteSkor, sistemKarari, katmanCiktilar, opOneri }
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

  const { tork, torkAralik, casingDur, gerekce, casingM, sure, kafesBetonS, mBasi, topMazot, kritik, gunlukUretim, toplamGun, ucOneri, makineUygunluklari, stabiliteSkor, sistemKarari, katmanCiktilar, opOneri } = analiz

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

      {/* Makine Kararı kutusu — tam ✔/❌ kararı */}
      <div style={{
        background: sistemKarari.bg,
        border: `1.5px solid ${sistemKarari.renk}40`,
        borderLeft: `5px solid ${sistemKarari.renk}`,
        borderRadius: "12px", padding: "20px 24px",
        marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: sistemKarari.renk, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
              Makine Kararı
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <span style={{ fontSize: "28px", lineHeight: 1 }}>
                {sistemKarari.durum === "Uygun" ? "✔" : sistemKarari.durum === "Uygun makine yok" ? "❌" : "⚠️"}
              </span>
              <div>
                {sistemKarari.makine ? (
                  <div style={{ fontSize: "20px", fontWeight: "800", color: "#0C4A6E" }}>
                    {sistemKarari.makine.ad}{sistemKarari.makine.marka ? ` — ${sistemKarari.makine.marka}` : ""}
                  </div>
                ) : (
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#DC2626" }}>Uygun Makine Bulunamadı</div>
                )}
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                  {sistemKarari.makine
                    ? `Gerekli tork: ${tork} kNm (bant: ${torkAralik?.min}–${torkAralik?.max} kNm, Sınıf ${torkAralik?.guven}) · Makine: ${sistemKarari.makine.tork} kNm · ${sistemKarari.makine.gerekce}`
                    : "Makine parkına uygun rig ekleyin"}
                </div>
              </div>
            </div>
          </div>
          <span style={{
            padding: "10px 22px", borderRadius: "20px", fontSize: "14px", fontWeight: "700",
            color: sistemKarari.renk, background: "white",
            border: `1.5px solid ${sistemKarari.renk}60`, whiteSpace: "nowrap", alignSelf: "flex-start"
          }}>
            {sistemKarari.durum}
          </span>
        </div>

        {/* Uygun değilse gerekli özellikler */}
        {(!sistemKarari.makine || sistemKarari.durum === "Uygun Değil") && (
          <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${sistemKarari.renk}30` }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#DC2626", marginBottom: "10px" }}>
              Bu proje için şu özelliklerde bir makine gereklidir:
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {[
                { k: "Minimum Tork", v: `${tork} kNm` },
                { k: "Max Derinlik", v: `≥ ${proje.kazikBoyu} m` },
                { k: "Max Çap", v: `≥ ${proje.kazikCapi} mm` },
                { k: "Casing Sistemi", v: analiz.zorunlu ? "Zorunlu" : "Opsiyonel" },
              ].map(({ k, v }) => (
                <div key={k} style={{ background: "white", border: "1px solid #FECACA", borderRadius: "8px", padding: "8px 14px" }}>
                  <div style={{ fontSize: "10px", color: "#94A3B8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#DC2626" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI yorum */}
        <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748B", paddingTop: "12px", borderTop: `1px solid ${sistemKarari.renk}20`, fontStyle: "italic" }}>
          {zemin.some(r => ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(r.zemTipi))
            ? "Benzer projelerde kaya formasyonu içeren bu zemin profilinde genellikle yüksek torklu, kelly bar sistemli makineler tercih edilmektedir."
            : zemin.some(r => ["Kum", "Çakıl"].includes(r.zemTipi))
            ? "Benzer projelerde kum/çakıl içeren bu zemin profilinde casing sistemi olan makineler tercih edilmektedir."
            : "Bu analiz saha zemin verileri ile uyumludur. Yerinde inceleme sonuçları değerlendirmede dikkate alınmalıdır."}
        </div>
      </div>

      {/* Metrik kartlar */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px"}}>
        <MetrikKart baslik="Gerekli Min. Tork" deger={`${tork} kNm`} renk="#0284C7"
          alt={tork < 100 ? "Hafif zemin" : tork < 200 ? "Orta zorluk" : "Agir zemin"}
          oran={Math.min(100, (tork / 300) * 100)} />
        <MetrikKart baslik="Muhafaza Borusu" deger={casingDur} renk="#6366F1" alt={`${casingM} m tahmini`}
          oran={(casingM / proje.kazikBoyu) * 100} />
        <MetrikKart baslik="1 Kazık Süresi (Rig)" deger={`${sure} saat`} renk="#0891B2" alt={`+${kafesBetonS}s kafes+beton | ~${gunlukUretim} kazık/gün`}
          oran={Math.min(100, (sure / 8) * 100)} />
        <MetrikKart baslik="Toplam Is Suresi" deger={`${toplamGun} gun`} renk="#0EA5E9" alt={`${proje.kazikAdedi} kazik`}
          oran={Math.min(100, (toplamGun / 60) * 100)} />
        <MetrikKart
          baslik="Stabilite Skoru"
          deger={`${stabiliteSkor}/100`}
          renk={stabiliteSkor > 50 ? "#DC2626" : stabiliteSkor > 30 ? "#D97706" : "#16A34A"}
          alt={stabiliteSkor > 50 ? "Yüksek risk" : stabiliteSkor > 30 ? "Orta risk" : "Düşük risk"}
          oran={stabiliteSkor}
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

      {/* Teknik Çıktılar — katman bazlı tork ve uç */}
      <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
        <h3 style={{ color: "var(--heading)", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
          ⚡ Teknik Çıktılar — Katman Bazlı Analiz
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--badge-muted-bg)", borderBottom: "2px solid var(--input-border)" }}>
                {["Derinlik (m)", "Zemin Tipi", "SPT", "UCS (MPa)", "Beklenen Tork (kNm)", "Önerilen Uç"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {katmanCiktilar.map((row, i) => (
                <tr key={row.id || i} style={{ borderBottom: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--row-alt)" }}>
                  <td style={{ padding: "9px 14px", fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{row.baslangic}–{row.bitis} m</td>
                  <td style={{ padding: "9px 14px", fontSize: "13px", color: "var(--text-secondary)" }}>{row.zemTipi}</td>
                  <td style={{ padding: "9px 14px", fontSize: "13px", color: "var(--text-secondary)" }}>{row.spt}</td>
                  <td style={{ padding: "9px 14px", fontSize: "13px", color: "var(--text-secondary)" }}>{row.ucs}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: row.katmanTork > tork * 0.8 ? "#DC2626" : row.katmanTork > tork * 0.5 ? "#D97706" : "#0369A1" }}>
                      {row.katmanTork} kNm
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600",
                      background: row.uc === "Kaya ucu" ? "#FEF2F2" : row.uc === "Geçiş ucu" ? "#FFFBEB" : "#F0FDF4",
                      color: row.uc === "Kaya ucu" ? "#DC2626" : row.uc === "Geçiş ucu" ? "#D97706" : "#16A34A" }}>
                      {row.uc}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operasyon Önerisi */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {/* Uç Değişim Noktaları */}
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "12px" }}>🔄 Uç Değişim Noktaları</h3>
          {opOneri.ucDegisimler.length === 0
            ? <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Bu projede uç değişimi öngörülmemektedir.</p>
            : opOneri.ucDegisimler.map((u, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", marginBottom: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#92400E" }}>{u.derinlik} m derinliğinde</div>
                <div style={{ fontSize: "12px", color: "#78350F" }}>{u.eskiUc} → {u.yeniUc} · {u.zemin}</div>
              </div>
            ))}
        </div>

        {/* Kritik Derinlikler */}
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "12px" }}>⚠️ Kritik Derinlikler</h3>
          {opOneri.kritikDerinlikler.length === 0
            ? <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tanımlanmış kritik derinlik bulunmuyor.</p>
            : opOneri.kritikDerinlikler.map((k, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", marginBottom: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#991B1B" }}>{k.baslangic}–{k.bitis} m · {k.zemin}</div>
                <div style={{ fontSize: "12px", color: "#7F1D1D" }}>{k.neden}</div>
              </div>
            ))}
        </div>

        {/* Riskli Zonlar */}
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "12px" }}>🔴 Riskli Zonlar</h3>
          {opOneri.riskliZonlar.length === 0
            ? <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Yüksek riskli zon tespit edilmedi.</p>
            : opOneri.riskliZonlar.map((r, i) => (
              <div key={i} style={{ padding: "8px 12px", background: r.risk === "Yüksek" ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${r.risk === "Yüksek" ? "#FECACA" : "#FDE68A"}`, borderRadius: "8px", marginBottom: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: r.risk === "Yüksek" ? "#991B1B" : "#92400E" }}>{r.baslangic}–{r.bitis} m · {r.zemin}</div>
                <div style={{ fontSize: "12px", color: r.risk === "Yüksek" ? "#7F1D1D" : "#78350F" }}>{r.neden} · Risk: {r.risk}</div>
              </div>
            ))}
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