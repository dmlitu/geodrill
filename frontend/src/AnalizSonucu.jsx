import { useState, useMemo } from "react"
import { downloadPdfReport, downloadSoilLayersCsv } from "./api"
import { ZeminProfilDiyagrami, TorkDerinlikGrafigi, GanttSemasi, SenaryoKarsilastirma } from "./Gorseller"
import {
  gerekliTork, stabiliteRiski, casingDurum, casingMetreHesapla,
  kazikSuresi, mazotTahmini, kritikKatman, makinaUygunluk,
} from "./hesaplamalar"

// ── Kart bileşeni ───────────────────────────────────────
function MetrikKart({ baslik, deger, renk, alt }) {
  return (
    <div style={{
      background: renk, borderRadius: "12px",
      padding: "20px", color: "white",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <div style={{fontSize: "13px", opacity: 0.85, marginBottom: "8px"}}>{baslik}</div>
      <div style={{fontSize: "22px", fontWeight: "700"}}>{deger}</div>
      {alt && <div style={{fontSize: "12px", opacity: 0.7, marginTop: "4px"}}>{alt}</div>}
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

  const handlePdf = async () => {
    if (!projeId) return
    setPdfYukleniyor(true)
    try { await downloadPdfReport(projeId) } finally { setPdfYukleniyor(false) }
  }

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
      <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center"}}>
        <div style={{fontSize: "48px", marginBottom: "16px"}}>⚠️</div>
        <h2 style={{color: "#1B3A6B", fontSize: "20px", fontWeight: "700", marginBottom: "8px"}}>Zemin verisi eksik</h2>
        <p style={{color: "#94A3B8", fontSize: "14px"}}>Lütfen önce Zemin Logu sayfasından zemin verilerini girin.</p>
      </div>
    )
  }

  const { tork, casingDur, gerekce, casingM, sure, mBasi, topMazot, kritik, gunlukUretim, toplamGun, ucOneri, makineUygunluklari } = analiz

  return (
    <div>
      <div style={{marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px"}}>
        <div>
          <h2 style={{color: "#1B3A6B", fontSize: "22px", fontWeight: "700"}}>Analiz Sonucu</h2>
          <p style={{color: "#94A3B8", fontSize: "14px", marginTop: "4px"}}>
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
              <button onClick={handlePdf} disabled={pdfYukleniyor}
                style={{padding: "8px 16px", border: "none", borderRadius: "8px", background: "linear-gradient(135deg, #1B3A6B, #2D5BA3)", color: "white", fontSize: "13px", fontWeight: "600", cursor: pdfYukleniyor ? "wait" : "pointer"}}>
                {pdfYukleniyor ? "Oluşturuluyor..." : "PDF Rapor"}
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
      <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px"}}>
        <MetrikKart baslik="Gerekli Min. Tork" deger={`${tork} kNm`} renk="#1B3A6B" />
        <MetrikKart baslik="Muhafaza Borusu" deger={casingDur} renk="#7C3AED" alt={`${casingM} m tahmini`} />
        <MetrikKart baslik="1 Kazık Süresi" deger={`${sure} saat`} renk="#0F766E" alt={`~${gunlukUretim} kazık/gün`} />
        <MetrikKart baslik="Toplam İş Süresi" deger={`${toplamGun} gün`} renk="#B45309" alt={`${proje.kazikAdedi} kazık`} />
        <MetrikKart
          baslik="Stabilite Skoru"
          deger={`${Math.round(zemin.reduce((s, r) => s + (stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Yüksek" ? 70 : stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu) === "Orta" ? 40 : 15), 0) / zemin.length)}/100`}
          renk="#DC2626"
        />
      </div>

      {/* İki kolon */}
      <div style={{display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px", marginBottom: "20px"}}>
        {/* Sol — Proje özeti */}
        <div style={{background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
          <h3 style={{color: "#1B3A6B", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid #EFF6FF"}}>
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
            <div key={k} style={{display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F8FAFC"}}>
              <span style={{color: "#64748B", fontSize: "13px"}}>{k}</span>
              <span style={{color: "#1E293B", fontSize: "13px", fontWeight: "600"}}>{v}</span>
            </div>
          ))}

          <h3 style={{color: "#1B3A6B", fontSize: "15px", fontWeight: "700", margin: "20px 0 12px", paddingBottom: "10px", borderBottom: "2px solid #EFF6FF"}}>
            🔧 Teknik Öneriler
          </h3>
          {[
            ["Uç Önerisi", ucOneri],
            ["Metre Başı Mazot", `${mBasi} L/m`],
            ["Bir Kazık Mazot", `${topMazot} L`],
            ["Toplam Mazot", `${Math.round(topMazot * proje.kazikAdedi)} L`],
          ].map(([k, v]) => (
            <div key={k} style={{display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F8FAFC"}}>
              <span style={{color: "#64748B", fontSize: "13px"}}>{k}</span>
              <span style={{color: "#1E293B", fontSize: "13px", fontWeight: "600"}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Sağ — Kritik katman + casing */}
        <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
          {kritik && (
            <div style={{background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
              <h3 style={{color: "#1B3A6B", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid #EFF6FF"}}>
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
                <div key={k} style={{display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F8FAFC"}}>
                  <span style={{color: "#64748B", fontSize: "13px"}}>{k}</span>
                  <span style={{color: "#1E293B", fontSize: "13px", fontWeight: "600"}}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
            <h3 style={{color: "#1B3A6B", fontSize: "15px", fontWeight: "700", marginBottom: "12px", paddingBottom: "10px", borderBottom: "2px solid #EFF6FF"}}>
              🔩 Casing Değerlendirmesi
            </h3>
            {gerekce.map((g, i) => (
              <div key={i} style={{fontSize: "13px", color: "#475569", padding: "5px 0", borderBottom: "1px solid #F8FAFC"}}>
                • {g}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Görselleştirmeler */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "20px", marginBottom: "20px", alignItems: "start" }}>
        <div style={{ background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <ZeminProfilDiyagrami zemin={zemin} yeraltiSuyu={proje.yeraltiSuyu} kazikBoyu={proje.kazikBoyu} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <TorkDerinlikGrafigi zemin={zemin} kazikCapi={proje.kazikCapi} />
          </div>
          <div style={{ background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <GanttSemasi kazikAdedi={proje.kazikAdedi} sure={sure} toplamGun={toplamGun} />
          </div>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
        <SenaryoKarsilastirma zemin={zemin} kazikCapi={proje.kazikCapi} kazikBoyu={proje.kazikBoyu} kazikAdedi={proje.kazikAdedi} />
      </div>

      {/* Makine uygunluk */}
      {makineUygunluklari.length > 0 && (
        <div style={{background: "white", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"}}>
          <h3 style={{color: "#1B3A6B", fontSize: "15px", fontWeight: "700", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid #EFF6FF"}}>
            ⚙️ Makine Uygunluk Sonuçları
          </h3>

          {/* Özet sayılar */}
          <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px"}}>
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
            <table style={{width: "100%", borderCollapse: "collapse"}}>
              <thead>
                <tr style={{background: "#F8FAFC", borderBottom: "2px solid #E2E8F0"}}>
                  {["Makine", "Marka", "Tork (kNm)", "Max Derinlik", "Max Çap", "Casing", "Karar", "Gerekçe"].map(h => (
                    <th key={h} style={{padding: "10px 14px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#64748B", whiteSpace: "nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {makineUygunluklari.map((m, i) => (
                  <tr key={m.id || i} style={{borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "white" : "#FAFAFA"}}>
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