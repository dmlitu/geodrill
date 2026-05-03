import { useState, useMemo, useCallback } from "react"
import {
  gerekliTork, casingMetreHesapla, kazikSuresi, mazotTahmini
} from "./hesaplamalar"
import { useToast } from "./Toast"
import { useLang } from "./LangContext"
import { BASE } from "./api"

// ─── Piyasa benchmark referansları ───────────────────────────────────────────
const BENCHMARK = {
  "Fore Kazık": { min: 3500, max: 7000 },
  "Ankraj":     { min: 2500, max: 5000 },
  "Mini Kazık": { min: 4000, max: 9000 },
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const card = {
  background: "var(--bg-card)", borderRadius: "14px",
  border: "1px solid var(--input-border)", padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
}

const label = {
  display: "block", fontSize: "11px", fontWeight: "700",
  color: "var(--text-secondary)", letterSpacing: "0.05em",
  textTransform: "uppercase", marginBottom: "5px",
}

const inp = {
  width: "100%", padding: "9px 12px",
  border: "1.5px solid var(--input-border)", borderRadius: "8px",
  fontSize: "13px", outline: "none", boxSizing: "border-box",
  color: "var(--input-text)", background: "var(--input-bg)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
}

const DEFAULTS = {
  mazotFiyati:   45,
  makineKirasi:  800,
  iscilikSaat:   200,
  sarfMalzeme:   150,
  mobilizasyon:  0,
  betonM3Fiyat:  0,
  donatiKgFiyat: 0,
  donatiKgM:     0,
  genelGiderPct: 15,
  karPayiPct:    10,
}

// ─── Yerel hesap (frontend mirror — anında geri bildirim) ─────────────────────
function hesaplaLocal(p, proje, zemin) {
  if (!zemin.length) return null
  const tork    = gerekliTork(zemin, proje.kazikCapi)
  const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
  const sure    = kazikSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM)
  const { mBasi } = mazotTahmini(tork, proje.kazikBoyu)

  const boy   = Number(proje.kazikBoyu)  || 0
  const adet  = Number(proje.kazikAdedi) || 1
  const r     = (proje.kazikCapi / 1000) / 2
  const hacim = Math.PI * r * r * boy

  const yakıt   = Math.round(mBasi * boy * adet * p.mazotFiyati)
  const makine  = Math.round(sure * adet * p.makineKirasi)
  const iscil   = Math.round(sure * adet * p.iscilikSaat)
  const sarf    = Math.round(boy * adet * p.sarfMalzeme)
  const mobil   = Math.round(p.mobilizasyon)
  const beton   = p.betonM3Fiyat > 0 ? Math.round(hacim * adet * p.betonM3Fiyat) : 0
  const donati  = (p.donatiKgFiyat > 0 && p.donatiKgM > 0)
    ? Math.round(p.donatiKgM * boy * adet * p.donatiKgFiyat) : 0

  const altToplam = yakıt + makine + iscil + sarf + mobil + beton + donati
  const genelGider = Math.round(altToplam * p.genelGiderPct / 100)
  const karPayi   = Math.round((altToplam + genelGider) * p.karPayiPct / 100)
  const toplam    = altToplam + genelGider + karPayi
  const kazikBasi = adet ? Math.round(toplam / adet) : 0
  const metreBasi = adet && boy ? Math.round(toplam / (boy * adet)) : 0

  const kalemler = [
    { ad: "Yakıt (Mazot)",        tutar: yakıt,  bilgi: `${mBasi} L/m × ${boy}m × ${adet} kzk × ${p.mazotFiyati}₺/L` },
    { ad: "Makine Kira/Amort.",   tutar: makine, bilgi: `${sure} sa/kzk × ${adet} kzk × ${p.makineKirasi}₺/sa` },
    { ad: "İşçilik",             tutar: iscil,  bilgi: `${sure} sa/kzk × ${adet} kzk × ${p.iscilikSaat}₺/sa` },
    { ad: "Sarf Malzeme",        tutar: sarf,   bilgi: `${boy}m × ${adet} kzk × ${p.sarfMalzeme}₺/m` },
    { ad: "Mobilizasyon",        tutar: mobil,  bilgi: "Sabit" },
    { ad: "Beton",               tutar: beton,  bilgi: `${hacim.toFixed(2)}m³/kzk` },
    { ad: "Donatı",              tutar: donati, bilgi: `${p.donatiKgM}kg/m × ${boy}m × ${adet}kzk` },
  ].filter(k => k.tutar > 0).map(k => ({
    ...k,
    yuzde: toplam ? Math.round(k.tutar / toplam * 100) : 0,
  }))

  const bm = BENCHMARK[proje.isTipi] || BENCHMARK["Fore Kazık"]
  let yorum, yorumRenk
  if (metreBasi < bm.min * 0.85) {
    yorum = `${metreBasi.toLocaleString("tr-TR")} ₺/m — piyasa alt sınırının altında, parametreleri kontrol edin.`
    yorumRenk = "#D97706"
  } else if (metreBasi > bm.max * 1.15) {
    yorum = `${metreBasi.toLocaleString("tr-TR")} ₺/m — piyasa üst sınırının üzerinde.`
    yorumRenk = "#DC2626"
  } else {
    yorum = `${metreBasi.toLocaleString("tr-TR")} ₺/m — tipik piyasa aralığında (${bm.min.toLocaleString("tr-TR")}–${bm.max.toLocaleString("tr-TR")} ₺/m).`
    yorumRenk = "#16A34A"
  }

  return { tork, sure, mBasi, kalemler, altToplam, genelGider, karPayi, toplam, kazikBasi, metreBasi, bm, yorum, yorumRenk }
}

// ─── Sub-bileşenler ───────────────────────────────────────────────────────────

function Alan({ label: l, value, onChange, birim, min = 0, step = 1 }) {
  return (
    <div>
      <label style={label}>{l}</label>
      <div style={{ position: "relative" }}>
        <input type="number" min={min} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...inp, paddingRight: birim ? "50px" : "12px" }}
        />
        {birim && (
          <span style={{
            position: "absolute", right: "10px", top: "50%",
            transform: "translateY(-50%)", fontSize: "11px",
            color: "var(--text-muted)", fontWeight: "700", pointerEvents: "none",
          }}>{birim}</span>
        )}
      </div>
    </div>
  )
}

const KALEM_KEYS = {
  "Yakıt (Mazot)":      "kalemYakit",
  "Makine Kira/Amort.": "kalemMakine",
  "İşçilik":            "kalemIscil",
  "Sarf Malzeme":       "kalemSarf",
  "Mobilizasyon":       "kalemMobil",
  "Beton":              "kalemBeton",
  "Donatı":             "kalemDonati",
}

function KalemSatiri({ kalem, toplam }) {
  const { t } = useLang()
  const pct = toplam ? (kalem.tutar / toplam * 100) : 0
  const adText = KALEM_KEYS[kalem.ad] ? t(KALEM_KEYS[kalem.ad]) : kalem.ad
  const bilgiText = kalem.bilgi === "Sabit" ? t("fixedCost") : kalem.bilgi
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{adText}</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>{bilgiText}</span>
        </div>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {kalem.tutar.toLocaleString("tr-TR")} ₺
        </span>
      </div>
      <div style={{ height: "3px", background: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: "#0EA5E9", borderRadius: "2px" }} />
      </div>
    </div>
  )
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function FiyatAnalizi({ proje, zemin, projeId }) {
  const [p, setP] = useState(DEFAULTS)
  const [kaydetYukleniyor, setKaydetYukleniyor] = useState(false)
  const [gelismis, setGelismis] = useState(false)
  const toast = useToast()
  const { t } = useLang()

  const set = useCallback((key) => (val) => setP(prev => ({ ...prev, [key]: val })), [])

  const hesap = useMemo(() => hesaplaLocal(p, proje, zemin), [p, proje, zemin])

  const handleKaydet = async () => {
    if (!projeId || !hesap) return
    setKaydetYukleniyor(true)
    try {
      const token = localStorage.getItem("gd_token")
      const body = {
        mazot_fiyati:    p.mazotFiyati,
        makine_kirasi:   p.makineKirasi,
        iscilik_saat:    p.iscilikSaat,
        sarf_malzeme:    p.sarfMalzeme,
        mobilizasyon:    p.mobilizasyon,
        beton_m3_fiyat:  p.betonM3Fiyat,
        donati_kg_fiyat: p.donatiKgFiyat,
        donati_kg_m:     p.donatiKgM,
        genel_gider_pct: p.genelGiderPct,
        kar_pct:         p.karPayiPct,
        kaydet: true,
      }
      const res = await fetch(`${BASE}/projects/${projeId}/cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Maliyet analizi kaydedildi.")
    } catch (e) {
      toast.error("Kaydetme başarısız: " + e.message)
    } finally {
      setKaydetYukleniyor(false)
    }
  }

  if (!zemin.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
      <h2 style={{ color: "var(--heading)", fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>{t("noSoilRequired")}</h2>
      <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{t("noSoilRequiredDesc")}</p>
    </div>
  )

  return (
    <div>
      {/* Başlık */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>{t("costTitle")}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
            {proje.projeAdi || "Proje"} — {proje.kazikBoyu}m × {proje.kazikAdedi} adet · {proje.isTipi}
          </p>
        </div>
        {projeId && hesap && (
          <button onClick={handleKaydet} disabled={kaydetYukleniyor} style={{
            padding: "9px 20px", border: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED, #8B5CF6)",
            color: "white", fontSize: "13px", fontWeight: "700",
            cursor: kaydetYukleniyor ? "wait" : "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {kaydetYukleniyor ? t("saving") : t("saveCost")}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>

        {/* Sol: Parametreler */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={card}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px" }}>
              {t("basicParamsSection")}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Alan label={t("labelFuel")}         value={p.mazotFiyati}   onChange={set("mazotFiyati")}   birim="₺/L"    min={1} />
              <Alan label={t("labelMachineRent")} value={p.makineKirasi}  onChange={set("makineKirasi")}  birim="₺/sa"   min={0} />
              <Alan label={t("labelLabor")}       value={p.iscilikSaat}   onChange={set("iscilikSaat")}   birim="₺/sa"   min={0} />
              <Alan label={t("labelConsumables")} value={p.sarfMalzeme}   onChange={set("sarfMalzeme")}   birim="₺/m"    min={0} />
              <Alan label={t("labelMobilization")}value={p.mobilizasyon}  onChange={set("mobilizasyon")}  birim="₺"      min={0} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <Alan label={t("labelOverhead")} value={p.genelGiderPct} onChange={set("genelGiderPct")} birim="%" min={0} />
                <Alan label={t("labelProfit")}   value={p.karPayiPct}    onChange={set("karPayiPct")}    birim="%" min={0} />
              </div>
            </div>
          </div>

          {/* Gelişmiş — beton/donatı */}
          <div style={card}>
            <button
              onClick={() => setGelismis(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: 0 }}
            >
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", flex: 1, textAlign: "left" }}>
                {t("betonDonatiSection")}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>{gelismis ? "▲" : "▼"}</span>
            </button>
            {gelismis && (
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <Alan label={t("labelConcrete")}      value={p.betonM3Fiyat}  onChange={set("betonM3Fiyat")}  birim="₺/m³" min={0} />
                <Alan label={t("labelRebar")}         value={p.donatiKgFiyat} onChange={set("donatiKgFiyat")} birim="₺/kg" min={0} />
                <Alan label={t("labelRebarPerMeter")} value={p.donatiKgM}     onChange={set("donatiKgM")}     birim="kg/m" min={0} step={0.1} />
              </div>
            )}
          </div>

          {/* Zemin hesap özeti */}
          {hesap && (
            <div style={{ ...card, background: "var(--row-alt)" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "10px" }}>
                {t("fromSoilCalc")}
              </div>
              {[
                [t("reqTorqueLine"),    `${hesap.tork} kNm`],
                [t("onePileDuration"),  `${hesap.sure} saat`],
                [t("fuelPerMeterLine"), `${hesap.mBasi} L/m`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sağ: Sonuçlar */}
        {hesap && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Maliyet özet banner */}
            <div style={{
              background: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 60%, #0EA5E9 100%)",
              borderRadius: "14px", padding: "24px",
              boxShadow: "0 4px 16px rgba(14,165,233,0.2)",
            }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.65)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>
                {t("totalProjectCost")}
              </div>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "white", fontVariantNumeric: "tabular-nums" }}>
                {hesap.toplam.toLocaleString("tr-TR")} ₺
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>
                {proje.kazikAdedi} {t("piles")} × {proje.kazikBoyu}m — {t("profitIncluded")}
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                {[
                  [t("perPile"), `${hesap.kazikBasi.toLocaleString("tr-TR")} ₺`],
                  [t("perMeter"), `${hesap.metreBasi.toLocaleString("tr-TR")} ₺/m`],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: "rgba(255,255,255,0.12)", borderRadius: "8px", padding: "10px 14px", flex: 1 }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "white", marginTop: "2px" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Piyasa karşılaştırması */}
            <div style={{ ...card, borderLeft: `4px solid ${hesap.yorumRenk}` }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>
                {t("marketComparison")}
              </div>
              <div style={{ fontSize: "13px", color: hesap.yorumRenk, fontWeight: "600", lineHeight: "1.5" }}>
                {hesap.yorum}
              </div>
              <div style={{ marginTop: "10px", position: "relative", height: "8px", background: "var(--border-subtle)", borderRadius: "4px" }}>
                {/* Piyasa bandı */}
                {(() => {
                  const full = hesap.bm.max * 1.4
                  const bandLeft = hesap.bm.min / full * 100
                  const bandW    = (hesap.bm.max - hesap.bm.min) / full * 100
                  const pct      = Math.min(100, hesap.metreBasi / full * 100)
                  return (
                    <>
                      <div style={{ position: "absolute", left: `${bandLeft}%`, width: `${bandW}%`, height: "100%", background: "rgba(16,185,129,0.25)", borderRadius: "4px" }} />
                      <div style={{ position: "absolute", left: `${pct}%`, top: "-3px", width: "14px", height: "14px", borderRadius: "50%", background: hesap.yorumRenk, transform: "translateX(-50%)", border: "2px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                    </>
                  )
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>0</span>
                <span style={{ fontSize: "10px", color: "#10B981", fontWeight: "600" }}>
                  {t("marketLabel")} {hesap.bm.min.toLocaleString("tr-TR")}–{hesap.bm.max.toLocaleString("tr-TR")} ₺/m
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{(hesap.bm.max * 1.4).toLocaleString("tr-TR")}</span>
              </div>
            </div>

            {/* Kalem dökümü */}
            <div style={card}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--heading)", marginBottom: "12px" }}>{t("costBreakdown")}</h3>
              {hesap.kalemler.map(k => <KalemSatiri key={k.ad} kalem={k} toplam={hesap.toplam} />)}
              <div style={{ padding: "10px 0", borderTop: "2px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{t("subtotal")}</span>
                <span style={{ fontSize: "13px", fontWeight: "700" }}>{hesap.altToplam.toLocaleString("tr-TR")} ₺</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("overhead")} (%{p.genelGiderPct})</span>
                <span style={{ fontSize: "12px", fontWeight: "600" }}>{hesap.genelGider.toLocaleString("tr-TR")} ₺</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>{t("profit")} (%{p.karPayiPct})</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#16A34A" }}>{hesap.karPayi.toLocaleString("tr-TR")} ₺</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", borderTop: "2px solid var(--border-subtle)", marginTop: "4px" }}>
                <span style={{ fontSize: "16px", fontWeight: "800", color: "#0284C7" }}>{t("total").toUpperCase()}</span>
                <span style={{ fontSize: "20px", fontWeight: "900", color: "#0284C7", fontVariantNumeric: "tabular-nums" }}>{hesap.toplam.toLocaleString("tr-TR")} ₺</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
