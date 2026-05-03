import { useState, useMemo, useCallback } from "react"
import { downloadPdfReport, downloadExcelReport, saveAnalysis } from "./api"
import { useToast } from "./Toast"
import { useLang } from "./LangContext"
import { ZeminProfilDiyagrami, TorkDerinlikGrafigi, GanttSemasi, SenaryoKarsilastirma } from "./Gorseller"
import {
  gerekliTorkAralik, stabiliteRiski, casingDurum, casingMetreHesapla,
  kazikSuresi, mazotTahmini, kritikKatman, makinaUygunluk,
  katmanTeknikCikti, operasyonOnerisi,
  tamCevrimSuresi, guvenAnalizi, aciklamaUret,
  ucTipiVeModifier,
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


// ── Ana bileşen ─────────────────────────────────────────
export default function AnalizSonucu({ proje, zemin, makineler, projeId, kalibrasyon = null }) {
  const [pdfYukleniyor, setPdfYukleniyor] = useState(false)
  const [excelYukleniyor, setExcelYukleniyor] = useState(false)
  const [kaydetYukleniyor, setKaydetYukleniyor] = useState(false)
  const [kaydetBasarili, setKaydetBasarili] = useState(false)
  const toast = useToast()
  const { t } = useLang()

  const handlePdf = useCallback(async () => {
    if (!projeId) return
    setPdfYukleniyor(true)
    try {
      await downloadPdfReport(projeId)
    } catch (e) {
      toast.error(t("pdfError") + ": " + e.message)
    } finally {
      setPdfYukleniyor(false)
    }
  }, [projeId, toast, t])

  const handleExcel = async () => {
    if (!analiz) return
    setExcelYukleniyor(true)
    try {
      await downloadExcelReport(proje, zemin, analiz, proje.projeKodu)
    } catch (e) {
      toast.error(t("excelError") + ": " + e.message)
    } finally {
      setExcelYukleniyor(false)
    }
  }

  const handleKaydet = async () => {
    if (!projeId || !analiz) return
    setKaydetYukleniyor(true)
    setKaydetBasarili(false)
    try {
      const { tork, torkAralik, casingM, sure, guven, makineUygunluklari, sistemKarari } = analiz
      const riskOzeti = sistemKarari.durum === "Uygun" || sistemKarari.durum === "Rahat Uygun"
        ? "Düşük" : sistemKarari.durum === "Şartlı Uygun" || sistemKarari.durum === "Sınırda"
        ? "Orta" : "Yüksek"

      await saveAnalysis(projeId, {
        ad: `${proje.projeAdi} — ${new Date().toLocaleDateString("tr-TR")}`,
        tork_nominal: tork,
        tork_max: torkAralik?.max,
        casing_m: casingM,
        sure_saat: sure,
        guven_seviyesi: guven?.seviye || null,
        guven_puan: guven?.puan || null,
        risk_ozeti: riskOzeti,
        motor_version: "v3.1",
        analiz_json: {
          tork, torkAralik, casingM, sure,
          guven, toplamGun: analiz.toplamGun,
          makineUygunluklari: makineUygunluklari.map(m => ({
            ad: m.ad, karar: m.karar, torkOran: m.torkOran, gerekce: m.gerekce,
          })),
        },
      })
      setKaydetBasarili(true)
      toast.success("Analiz kaydedildi. Dashboard'dan erişebilirsiniz.")
      setTimeout(() => setKaydetBasarili(false), 3000)
    } catch (e) {
      toast.error(e.message.includes("402")
        ? "Aylık analiz limitine ulaştınız. Pro plana geçin."
        : "Kaydetme başarısız: " + e.message
      )
    } finally {
      setKaydetYukleniyor(false)
    }
  }

  // useMemo: zemin veya proje değişmediğinde hesaplamalar yeniden yapılmaz
  const analiz = useMemo(() => {
    if (!zemin.length) return null
    try {
    const torkAralik = gerekliTorkAralik(zemin, proje.kazikCapi, proje.isTipi, proje.yeraltiSuyu)
    const tork = torkAralik.nominal
    const { durum: casingDur, gerekce, zorunlu } = casingDurum(zemin, proje.yeraltiSuyu)
    const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
    const sure = kazikSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM, kalibrasyon)
    const cevrim = tamCevrimSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM, proje.isTipi, kalibrasyon)
    const guven = guvenAnalizi(zemin, proje.yeraltiSuyu, proje.kazikBoyu)
    const { mBasi, toplam: topMazot } = mazotTahmini(tork, proje.kazikBoyu)
    const kritik = kritikKatman(zemin)
    const gunlukUretim = cevrim.gunlukUretimAdet
    const kazikBasiGun = cevrim.kazikBasiGun   // days per pile (> 1 when pile takes longer than a workday)
    const toplamGun = Math.ceil(proje.kazikAdedi / gunlukUretim)
    // Uç tipi önerisi — baskın formasyon sınıfına göre
    const ucTipiAnalizleri = zemin.map(r => ucTipiVeModifier(r, proje.yeraltiSuyu))
    const kayaTipleri = ["Kumtaşı", "Kireçtaşı", "Sert Kaya"]
    const ucOneri = zemin.some(r => kayaTipleri.includes(r.zemTipi) || (r.ucs || 0) >= 25)
      ? "Kaya ucu gerekli" : zemin.some(r => r.zemTipi === "Ayrışmış Kaya" || ((r.ucs || 0) >= 10))
      ? "Geçiş tipi uç" : "Standart uç yeterli"
    // Baskın uç tipi önerisi (en yaygın katman)
    const ucTipiOneri = ucTipiAnalizleri.length > 0
      ? ucTipiAnalizleri.reduce((prev, cur) => {
          // Sert kaya varsa onu baskın say
          if (cur.uc === "karot_kes") return cur
          if (prev.uc === "karot_kes") return prev
          if (cur.uc === "kaya_helezoni" && prev.uc !== "karot_kes") return cur
          return prev
        }, ucTipiAnalizleri[0])
      : null

    const makineUygunluklari = makineler.map(m => {
      const uyg = makinaUygunluk(m, tork, proje.kazikBoyu, proje.kazikCapi, zorunlu, proje.isTipi, zemin, proje.yeraltiSuyu)
      const aciklama = aciklamaUret(m.ad, uyg.karar, uyg.torkOran, kritik, guven, proje.isTipi, zemin, proje.yeraltiSuyu)
      return { ...m, ...uyg, aciklama }
    })
    // Stabilite skoru — bir kez hesapla
    const stabiliteSkor = zemin.length > 0
      ? Math.round(zemin.reduce((s, r) => {
          const risk = stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, proje.yeraltiSuyu, r.baslangic)
          return s + (risk === "Yüksek" ? 70 : risk === "Orta" ? 40 : 15)
        }, 0) / zemin.length)
      : 0
    // Sistem Kararı — en uygun makineyi belirle
    const uygunMakineler = makineUygunluklari.filter(m => m.karar === "Uygun" || m.karar === "Rahat Uygun")
    const sinirdaMakineler = makineUygunluklari.filter(m => m.karar === "Şartlı Uygun" || m.karar === "Sınırda")
    const sistemKarari = uygunMakineler.length > 0
      ? { makine: uygunMakineler.reduce((best, m) => m.tork < best.tork ? m : best, uygunMakineler[0]), durum: "Uygun", renk: "#16A34A", bg: "#F0FDF4" }
      : sinirdaMakineler.length > 0
      ? { makine: sinirdaMakineler[0], durum: sinirdaMakineler[0].karar, renk: "#D97706", bg: "#FFFBEB" }
      : { makine: null, durum: "Uygun makine yok", renk: "#DC2626", bg: "#FEF2F2" }
    // ── Fizik tabanlı performans analizi — en iyi makine ile çevrim yeniden hesapla ──
    const enIyiMakine = uygunMakineler.length > 0
      ? uygunMakineler.reduce((best, m) => parseFloat(m.tork) < parseFloat(best.tork) ? m : best, uygunMakineler[0])
      : sinirdaMakineler.length > 0 ? sinirdaMakineler[0] : null
    const enIyiMakineTork = enIyiMakine ? parseFloat(enIyiMakine.tork || 0) : 0

    // Makine tork bilgisiyle çevrim süresi yeniden hesapla (makine-zemin etkileşimi devrede)
    const cevrimMakineIle = enIyiMakineTork > 0 && tork > 0
      ? tamCevrimSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM, proje.isTipi, kalibrasyon, enIyiMakineTork, tork)
      : cevrim

    const torkKullanimOrani = enIyiMakineTork > 0 && tork > 0
      ? Math.round(enIyiMakineTork / tork * 100)
      : null
    const netRop = cevrimMakineIle.tDelme > 0
      ? Math.round(proje.kazikBoyu / cevrimMakineIle.tDelme * 10) / 10
      : 0
    const cevrimVerimiPct = cevrimMakineIle.cevrimVerimi ?? 0
    const sinirlayanFaktor = cevrimMakineIle.sinirlayanFaktor ?? "—"

    // Günlük üretim ve toplam gün — makine torklu çevrimden
    const gunlukUretimFizik = cevrimMakineIle.gunlukUretimAdet
    const toplamGunFizik = Math.ceil(proje.kazikAdedi / gunlukUretimFizik)

    const katmanCiktilar = katmanTeknikCikti(zemin, proje.kazikCapi)
    const opOneri = operasyonOnerisi(zemin, proje.yeraltiSuyu)
    return {
      tork, torkAralik, casingDur, gerekce, zorunlu, casingM, sure, cevrim, guven, mBasi, topMazot,
      kritik, gunlukUretim, kazikBasiGun, toplamGun, ucOneri, makineUygunluklari, stabiliteSkor,
      sistemKarari, katmanCiktilar, opOneri, ucTipiOneri,
      // Fizik tabanlı performans metrikleri (en iyi makine ile)
      cevrimMakineIle, torkKullanimOrani, netRop, cevrimVerimiPct, sinirlayanFaktor,
      enIyiMakine, gunlukUretimFizik, toplamGunFizik,
    }
    } catch (err) {
      console.error("[GeoDrill] Hesaplama hatası:", err, { zemin, proje })
      return null
    }
  }, [zemin, proje, makineler, kalibrasyon])

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
        <h2 style={{color: "#0369A1", fontSize: "20px", fontWeight: "700", marginBottom: "8px"}}>{t("noSoilTitle")}</h2>
        <p style={{color: "#94A3B8", fontSize: "14px", maxWidth: "320px", lineHeight: "1.6"}}>
          {t("noSoilDesc")}<br />
          <strong style={{color: "#64748B"}}>{t("noSoilHint")}</strong> {t("noSoilHint2")}
        </p>
      </div>
    )
  }

  if (!analiz) {
    return (
      <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", textAlign: "center"}}>
        <div style={{fontSize: "40px", marginBottom: "16px"}}>⚠️</div>
        <h2 style={{color: "#DC2626", fontSize: "18px", fontWeight: "700", marginBottom: "8px"}}>Hesaplama Hatası</h2>
        <p style={{color: "#64748B", fontSize: "14px", maxWidth: "360px", lineHeight: "1.6"}}>
          Zemin verilerinden analiz hesaplanamadı. Lütfen zemin katmanlarını kontrol edin ve sayfayı yenileyin.
        </p>
        <p style={{color: "#94A3B8", fontSize: "12px", marginTop: "8px"}}>Detaylar için tarayıcı konsolunu inceleyin.</p>
      </div>
    )
  }

  const {
    tork, torkAralik, casingDur, gerekce, casingM, sure, cevrim, guven, mBasi, topMazot,
    kritik, gunlukUretim, kazikBasiGun, toplamGun, ucOneri, makineUygunluklari, stabiliteSkor,
    sistemKarari, katmanCiktilar, opOneri, ucTipiOneri,
    cevrimMakineIle, torkKullanimOrani, netRop, cevrimVerimiPct, sinirlayanFaktor,
    enIyiMakine, gunlukUretimFizik, toplamGunFizik,
  } = analiz

  return (
    <div>
      {kalibrasyon?.aktif && (
        <div style={{
          background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: "10px",
          padding: "10px 16px", marginBottom: "18px",
          display: "flex", alignItems: "center", gap: "10px", fontSize: "13px",
        }}>
          <span>🎯</span>
          <span style={{ color: "#166534", fontWeight: "600" }}>
            {t("calibrationActive").replace("{val}", (kalibrasyon?.katsayi ?? 0).toFixed(4))}
          </span>
        </div>
      )}
      <div style={{marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px"}}>
        <div>
          <h2 style={{color: "var(--heading)", fontSize: "22px", fontWeight: "700"}}>{t("analysisTitle")}</h2>
          <p style={{color: "var(--text-muted)", fontSize: "14px", marginTop: "4px"}}>
            {proje.projeAdi || "Proje"} — {proje.kazikBoyu}m / Ø{proje.kazikCapi}mm / {proje.kazikAdedi} adet
          </p>
        </div>
        <div style={{display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, flexWrap: "wrap"}} className="no-print">
          {/* Excel — client-side, always available */}
          <button
            onClick={handleExcel}
            disabled={excelYukleniyor}
            style={{
              padding: "8px 16px", border: "1.5px solid #BBF7D0", borderRadius: "8px",
              background: "#F0FDF4", color: "#16A34A", fontSize: "13px", fontWeight: "600",
              cursor: excelYukleniyor ? "wait" : "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {excelYukleniyor ? "..." : t("excelExport")}
          </button>

          {projeId ? (
            <>
              <button
                onClick={handleKaydet}
                disabled={kaydetYukleniyor || kaydetBasarili}
                style={{
                  padding: "8px 16px", border: "none", borderRadius: "8px",
                  background: kaydetBasarili
                    ? "linear-gradient(135deg, #16A34A, #22C55E)"
                    : "linear-gradient(135deg, #7C3AED, #8B5CF6)",
                  color: "white", fontSize: "13px", fontWeight: "700",
                  cursor: kaydetYukleniyor ? "wait" : "pointer",
                  boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {kaydetYukleniyor ? t("saving") : kaydetBasarili ? t("savedOk") : t("saveAnalysis")}
              </button>
              <button
                onClick={handlePdf}
                disabled={pdfYukleniyor}
                style={{
                  padding: "8px 16px", border: "none", borderRadius: "8px",
                  background: pdfYukleniyor ? "#94A3B8" : "linear-gradient(135deg, #0284C7, #0EA5E9)",
                  color: "white", fontSize: "13px", fontWeight: "600",
                  cursor: pdfYukleniyor ? "wait" : "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {pdfYukleniyor ? t("generating") : t("pdfReport")}
              </button>
            </>
          ) : (
            <span style={{
              fontSize: "11px", color: "var(--text-muted)",
              padding: "8px 12px", border: "1px dashed var(--border-medium)",
              borderRadius: "8px", maxWidth: "180px", lineHeight: "1.4",
            }}>
              {t("saveProjectForPdf")}
            </span>
          )}

          <button
            onClick={() => window.print()}
            style={{padding: "8px 16px", border: "1.5px solid var(--border-medium)", borderRadius: "8px", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer"}}
          >
            {t("printBtn")}
          </button>
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
            <div style={{ fontSize: "11px", fontWeight: "700", color: sistemKarari.renk, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{t("machineDecision")}</div>
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
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#DC2626" }}>{t("noSuitableMachine")}</div>
                )}
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                  {sistemKarari.makine
                    ? `Gerekli tork: ${tork} kNm (bant: ${torkAralik?.min}–${torkAralik?.max} kNm, Sınıf ${torkAralik?.guven}) · Makine: ${sistemKarari.makine.tork} kNm · ${sistemKarari.makine.gerekce}`
                    : t("addSuitableRig")}
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
              {t("minTorque")}:
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {[
                { k: t("minTorque"), v: `${tork} kNm` },
                { k: t("maxDepth"), v: `≥ ${proje.kazikBoyu} m` },
                { k: t("maxDiam"), v: `≥ ${proje.kazikCapi} mm` },
                { k: t("casingSystem"), v: analiz.zorunlu ? t("required") : t("optional") },
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

      {/* Güven Bandı */}
      {guven && (
        <div style={{
          background: guven.seviye === "HIGH" ? "#F0FDF4" : guven.seviye === "MEDIUM" ? "#FFFBEB" : "#FEF2F2",
          border: `1px solid ${guven.seviye === "HIGH" ? "#BBF7D0" : guven.seviye === "MEDIUM" ? "#FDE68A" : "#FECACA"}`,
          borderRadius: "12px", padding: "16px 20px", marginBottom: "16px",
        }}>
          {/* Başlık satırı + puan barı */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "20px" }}>{guven.seviye === "HIGH" ? "🟢" : guven.seviye === "MEDIUM" ? "🟡" : "🔴"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "700", fontSize: "13px", color: guven.seviye === "HIGH" ? "#15803D" : guven.seviye === "MEDIUM" ? "#92400E" : "#991B1B", marginBottom: "4px" }}>
                {t("calcConfidence")}: {guven.seviye === "HIGH" ? t("high") : guven.seviye === "MEDIUM" ? t("medium") : t("low")} — {guven.puan}/100
              </div>
              <div style={{ height: "6px", background: "rgba(0,0,0,0.08)", borderRadius: "3px", overflow: "hidden", maxWidth: "320px" }}>
                <div style={{
                  height: "100%", borderRadius: "3px", transition: "width 0.6s ease",
                  width: `${guven.puan}%`,
                  background: guven.seviye === "HIGH" ? "#16A34A" : guven.seviye === "MEDIUM" ? "#D97706" : "#DC2626",
                }} />
              </div>
            </div>
          </div>

          {/* Karşılaştırmalı kriter tablosu */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {/* Mevcut kriterler */}
            {(guven.sebepler || []).length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#15803D", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  {t("presentData")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {(guven.sebepler || []).map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#166534" }}>
                      <span style={{ color: "#16A34A", fontWeight: "700", flexShrink: 0 }}>✓</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Eksik kriterler / öneriler */}
            {(guven.eksikVeriler || []).length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                  {t("addForConfidence")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {(guven.eksikVeriler || []).map((e, i) => {
                    const puan = e.includes("CPT") ? "+35" : e.includes("su") || e.includes("Su") ? "+25" : e.includes("UCS") ? "+25" : e.includes("SPT") ? "+20" : e.includes("RQD") ? "+10" : e.includes("suyu") ? "+10" : e.includes("kapsamıyor") ? "+10" : null
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "12px", color: "#92400E" }}>
                        <span style={{ color: "#D97706", fontWeight: "700", flexShrink: 0, marginTop: "1px" }}>+</span>
                        <span style={{ flex: 1 }}>{e}</span>
                        {puan && <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: "8px", background: "#FDE68A", color: "#92400E", fontSize: "11px", fontWeight: "700" }}>{puan} puan</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {torkAralik?.uyarilar?.length > 0 && (
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: "12px", color: "#92400E", fontStyle: "italic" }}>
              {torkAralik.uyarilar.join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Metrik kartlar */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px"}}>
        <MetrikKart baslik="Gerekli Min. Tork" deger={`${tork ?? "—"} kNm`} renk="#0284C7"
          alt={`Bant: ${torkAralik?.min ?? "—"}–${torkAralik?.max ?? "—"} kNm`}
          oran={Math.min(100, ((tork ?? 0) / 300) * 100)} />
        <MetrikKart baslik="Muhafaza Borusu" deger={casingDur ?? "—"} renk="#6366F1" alt={`${casingM ?? 0} m tahmini`}
          oran={proje.kazikBoyu > 0 ? ((casingM ?? 0) / proje.kazikBoyu) * 100 : 0} />
        <MetrikKart baslik="1 Kazık Net Delgi" deger={`${cevrimMakineIle?.tDelme ?? "—"} saat`} renk="#0891B2"
          alt={`Çevrim: ${cevrimMakineIle?.tToplamCevrim ?? "—"} saat · Verim: %${cevrimVerimiPct ?? 0}`}
          oran={Math.min(100, ((cevrimMakineIle?.tDelme ?? 0) / 8) * 100)} />
        <MetrikKart baslik="Toplam İş Süresi" deger={`${toplamGunFizik} gün`} renk="#0EA5E9"
          alt={`${proje.kazikAdedi} kazık · ~${gunlukUretimFizik} kazık/gün`}
          oran={Math.min(100, (toplamGunFizik / 60) * 100)} />
        <MetrikKart
          baslik="Stabilite Skoru"
          deger={`${stabiliteSkor}/100`}
          renk={stabiliteSkor > 50 ? "#DC2626" : stabiliteSkor > 30 ? "#D97706" : "#16A34A"}
          alt={stabiliteSkor > 50 ? "Yüksek risk" : stabiliteSkor > 30 ? "Orta risk" : "Düşük risk"}
          oran={stabiliteSkor}
        />
      </div>

      {/* Tam Çevrim Süresi Kartı */}
      {cevrim && (
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "14px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
            ⏱ Tam Çevrim Süresi Dökümü (1 Kazık)
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            {[
              { label: "Delme", val: cevrim.tDelme, unit: "saat", renk: "#0284C7" },
              { label: "Beton", val: cevrim.tBeton, unit: "saat", renk: "#6366F1" },
              { label: "Donatı Kafesi", val: cevrim.tDonati, unit: "saat", renk: "#0891B2" },
              { label: "Casing Ops.", val: cevrim.tCasingOps, unit: "saat", renk: "#7C3AED" },
              { label: "Lojistik", val: Math.round((cevrim.tKurulum + cevrim.tRekonumlama) * 10) / 10, unit: "saat", renk: "#64748B" },
              { label: "Beklenmedik", val: cevrim.tBeklenmedik, unit: "saat", renk: "#D97706" },
            ].map(({ label, val, unit, renk }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: "8px", padding: "10px 14px", borderLeft: `3px solid ${renk}` }}>
                <div style={{ fontSize: "11px", color: "#64748B", fontWeight: "600", marginBottom: "4px" }}>{label}</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#0C4A6E" }}>{val} <span style={{ fontSize: "11px", color: "#94A3B8" }}>{unit}</span></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "13px", color: "#475569" }}>
              <span style={{ fontWeight: "700", color: "#0C4A6E" }}>Toplam: {cevrim.tToplamCevrim} saat/kazık</span>
            </div>
            <div style={{ fontSize: "13px", color: "#475569" }}>
              {kazikBasiGun > 1
                ? <>1 kazık: <span style={{ fontWeight: "700", color: "#D97706" }}>~{kazikBasiGun} gün</span></>
                : <>Günlük üretim: <span style={{ fontWeight: "700", color: "#0C4A6E" }}>~{gunlukUretim} kazık/gün</span></>
              }
            </div>
            <div style={{ fontSize: "13px", color: "#475569" }}>
              Tahmini toplam: <span style={{ fontWeight: "700", color: "#0C4A6E" }}>{toplamGun} gün</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fizik Tabanlı Delgi Performans Analizi ─── */}
      {enIyiMakine && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "12px",
          border: "1px solid #BAE6FD", padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "4px" }}>
            ⚡ Delgi Performans Analizi
          </h3>
          <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "14px", fontFamily: "'DM Mono', monospace" }}>
            Makine: <strong>{enIyiMakine.ad}</strong> ({enIyiMakine.tork} kNm)
            {torkKullanimOrani && <> · Tork kullanım oranı: <strong>%{torkKullanimOrani}</strong></>}
          </div>

          {/* Metrik grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "14px" }}>
            {[
              { label: "Tork Kullanım Oranı", val: torkKullanimOrani ? `%${torkKullanimOrani}` : "—",
                renk: torkKullanimOrani >= 130 ? "#16A34A" : torkKullanimOrani >= 100 ? "#0369A1" : torkKullanimOrani >= 85 ? "#D97706" : "#DC2626",
                aciklama: torkKullanimOrani >= 130 ? "Rahat marj" : torkKullanimOrani >= 100 ? "Yeterli" : torkKullanimOrani >= 85 ? "Sınırda" : "Yetersiz" },
              { label: "Ort. Net ROP", val: `${netRop} m/saat`, renk: "#0369A1", aciklama: "Makine tork etkisi dahil" },
              { label: "Net Delme Süresi", val: `${cevrimMakineIle.tDelme} saat`, renk: "#0891B2", aciklama: "Sadece zemin kesimi" },
              { label: "Toplam Çevrim", val: `${cevrimMakineIle.tToplamCevrim} saat`, renk: "#7C3AED", aciklama: "Beton+donatı+lojistik dahil" },
              { label: "Çevrim Verimi", val: `%${cevrimVerimiPct}`, renk: cevrimVerimiPct >= 50 ? "#16A34A" : cevrimVerimiPct >= 35 ? "#D97706" : "#DC2626", aciklama: "Net delme / toplam çevrim" },
              { label: "Günlük Üretim", val: `~${gunlukUretimFizik} kazık/gün`, renk: "#16A34A", aciklama: "10 saatlik iş günü" },
            ].map(({ label, val, renk, aciklama }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: "8px", padding: "10px 14px", borderLeft: `3px solid ${renk}` }}>
                <div style={{ fontSize: "11px", color: "#64748B", fontWeight: "600", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontSize: "17px", fontWeight: "700", color: renk }}>{val}</div>
                <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "2px" }}>{aciklama}</div>
              </div>
            ))}
          </div>

          {/* Sınırlayan faktör */}
          <div style={{
            background: "#EFF6FF", borderRadius: "8px", padding: "10px 14px",
            fontSize: "12px", color: "#1E40AF", borderLeft: "3px solid #3B82F6",
          }}>
            <span style={{ fontWeight: "700" }}>Sınırlayan Faktör: </span>{sinirlayanFaktor}
          </div>

          {/* Uç tipi önerisi */}
          {ucTipiOneri && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#475569", display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", borderRadius: "6px", padding: "3px 10px", fontWeight: "700", fontSize: "11px" }}>
                ÖNERİLEN UÇ
              </span>
              <span><strong>{ucTipiOneri.ucTr}</strong> — {ucTipiOneri.aciklama}</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Tork Formülü Şeffaflık Paneli ─── */}
      {torkAralik?.katmanDetaylari?.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "12px",
          border: "1px solid var(--input-border)", padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "4px" }}>
            Tork Hesabı — Katman Detayları
          </h3>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "14px", fontFamily: "'DM Mono', monospace" }}>
            T = τ_eff × (π×D³/12) × K_app(1.67) × K_method × K_gw × K_depth × K_rqd
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#0C3B6E", color: "white" }}>
                  {["Derinlik (m)", "Zemin Tipi", "τ_eff (kPa)", "Kaynak", "K_gw", "K_depth", "K_rqd", "T (kNm)", "Güven"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: "700", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {torkAralik.katmanDetaylari.map((kd, i) => {
                  const isMax = kd.tKatmanKNm === Math.max(...torkAralik.katmanDetaylari.map(d => d.tKatmanKNm))
                  return (
                    <tr key={i} style={{ background: isMax ? "#EFF6FF" : i % 2 === 0 ? "#F8FAFC" : "white" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace", fontWeight: isMax ? "700" : "400" }}>
                        {kd.baslangic}–{kd.bitis}
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: "600" }}>{kd.zemTipi || kd.zem_tipi || "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>{kd.tauEffKPa ?? kd.tau_eff_kPa ?? "—"}</td>
                      <td style={{ padding: "6px 10px", color: "#64748B", fontSize: "11px" }}>{kd.source || "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>{kd.kGw ?? kd.k_gw ?? "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>{kd.kDepth ?? kd.k_depth ?? "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>{kd.kRqd ?? kd.k_rqd ?? "—"}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace", fontWeight: "700", color: isMax ? "#0369A1" : "inherit" }}>
                        {kd.tKatmanKNm ?? kd.t_katman_kNm ?? "—"}
                        {isMax && <span style={{ marginLeft: "4px", fontSize: "10px", color: "#0369A1" }}>★</span>}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700",
                          background: (kd.confidence || kd.confidence) === "A" ? "#F0FDF4"
                            : (kd.confidence) === "B" ? "#FFFBEB" : "#FEF2F2",
                          color: (kd.confidence) === "A" ? "#15803D"
                            : (kd.confidence) === "B" ? "#92400E" : "#991B1B",
                        }}>
                          {kd.confidence || "—"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
            ★ Belirleyici katman (en yüksek tork) · Güven: A=ölçülmüş, B=korelasyon, C=çıkarımsal
          </div>
        </div>
      )}

      {/* ─── Katman Bazlı ROP Şeffaflık Paneli ─── */}
      {cevrim?.katmanRopDetaylari?.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "12px",
          border: "1px solid var(--input-border)", padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "20px",
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "4px" }}>
            Penetrasyon Hızı (ROP) — Katman Detayları
          </h3>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "14px", fontFamily: "'DM Mono', monospace" }}>
            ROP = Baz_ROP × F_ucs × F_cap × F_spt × F_gw × F_machine · Net_sure = kalınlık / ROP
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#0C3B6E", color: "white" }}>
                  {["Derinlik (m)", "Zemin Tipi", "ROP (m/saat)", "Net Süre (saat)", "Kalınlık (m)", "Not"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: "700", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cevrim.katmanRopDetaylari.map((kd, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#F8FAFC" : "white" }}>
                    <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>
                      {kd.baslangic}–{kd.bitis}
                    </td>
                    <td style={{ padding: "6px 10px", fontWeight: "600" }}>{kd.zemTipi || "—"}</td>
                    <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace", fontWeight: "700", color: "#0369A1" }}>
                      {kd.ropMhr ?? "—"}
                    </td>
                    <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>{kd.sureSaat ?? "—"}</td>
                    <td style={{ padding: "6px 10px", fontFamily: "'DM Mono', monospace" }}>
                      {((kd.bitis || 0) - (kd.baslangic || 0)).toFixed(1)}
                    </td>
                    <td style={{ padding: "6px 10px", fontSize: "11px", color: kd.duzeltildi ? "#D97706" : "#64748B" }}>
                      {kd.duzeltildi ? "⚠ Kaya alt sınırı" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "12px", color: "#475569" }}>
            <span>
              Net delme süresi: <strong style={{ color: "#0C4A6E" }}>{cevrim.tDelme} saat</strong>
            </span>
            <span>
              Ortalama ROP: <strong style={{ color: "#0C4A6E", fontFamily: "'DM Mono', monospace" }}>
                {cevrim.tDelme > 0 ? (proje.kazikBoyu / cevrim.tDelme).toFixed(2) : "—"} m/saat
              </strong>
            </span>
            {kalibrasyon?.aktif && (
              <span style={{ color: "#0369A1", fontWeight: "600" }}>
                Kalibrasyon ×{(kalibrasyon?.katsayi ?? 0).toFixed(4)} uygulandı
              </span>
            )}
          </div>
        </div>
      )}

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
                {["Derinlik (m)", "Zemin Tipi", "SPT", "UCS (MPa)", "Beklenen Tork (kNm)", "Delgi Hızı (m/saat)", "Süre Katkısı (saat)", "Önerilen Uç"].map(h => (
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
                    <span style={{ fontSize: "13px", fontWeight: "700",
                      color: row.rop < 1 ? "#DC2626" : row.rop < 4 ? "#D97706" : "#16A34A" }}>
                      {row.rop} m/saat
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    {row.surKatkisi} saat
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
                <div style={{ fontSize: "12px", color: "#78350F" }}>{u.eskiUc} → {u.yeniUc}</div>
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
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#991B1B" }}>{k.baslangic}–{k.bitis} m · {k.zemTipi}</div>
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
                <div style={{ fontSize: "13px", fontWeight: "700", color: r.risk === "Yüksek" ? "#991B1B" : "#92400E" }}>{r.derinlik}–{r.bitis} m · {r.zemTipi}</div>
                <div style={{ fontSize: "12px", color: r.risk === "Yüksek" ? "#7F1D1D" : "#78350F" }}>Risk: {r.risk}</div>
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
                  {["Makine", "Marka", "Tork (kNm)", "Max Derinlik", "Max Çap", "Casing", "Karar", "Gerekçe", "Mühendis Notu"].map(h => (
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
                    <td style={{padding: "10px 14px", fontSize: "12px", color: "#475569", maxWidth: "260px", lineHeight: "1.5"}}>{m.aciklama}</td>
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