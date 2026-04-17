// ─── Proje Kalibrasyonu ────────────────────────────────────────────────────────
// İki katmanlı kalibrasyon sistemi:
//   1. Mühendislik Faktörleri — saha, operatör ve makine verimliliği çarpanları
//   2. Ölçüm Kalibrasyonu    — gerçek kazık süresiyle model kıyaslaması

import { useState, useMemo, useCallback } from "react"
import { casingMetreHesapla, tamCevrimSuresi } from "./hesaplamalar"
import { useLang } from "./LangContext"

const DEFAULT_FAKTÖRLER = { sahaVerimi: 1.0, operatorYetenegi: 1.0, makineDurumu: 1.0 }

export default function ProjeKalibrasyonu({ proje, zemin, kalibrasyon, onKalibrasyon }) {
  const { t } = useLang()

  // Bağımsız mühendislik faktörleri — sliderlar
  const [sahaVerimi,       setSahaVerimi]       = useState(kalibrasyon?.sahaVerimi       ?? 1.0)
  const [operatorYetenegi, setOperatorYetenegi] = useState(kalibrasyon?.operatorYetenegi ?? 1.0)
  const [makineDurumu,     setMakineDurumu]     = useState(kalibrasyon?.makineDurumu     ?? 1.0)

  // Ölçüm kalibrasyonu — gerçek süre girişi
  const [gercekSure, setGercekSure] = useState("")
  const [olcumKatsayi, setOlcumKatsayi] = useState(kalibrasyon?.olcumKatsayi ?? 1.0)

  // Model süresi (kalibrasyon uygulanmadan)
  const modelSonuc = useMemo(() => {
    if (!zemin.length || !proje.kazikBoyu) return null
    const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
    const cevrim  = tamCevrimSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM, proje.isTipi, null)
    const modelRop = proje.kazikBoyu / (cevrim.tDelme || 1)
    return { tDelme: cevrim.tDelme, modelRop }
  }, [zemin, proje])

  const hesap = useMemo(() => {
    const sure = parseFloat(gercekSure)
    if (!modelSonuc || !sure || sure <= 0) return null
    const gercekRop    = proje.kazikBoyu / sure
    const katsayi      = gercekRop / modelSonuc.modelRop
    const yuzde        = ((katsayi - 1) * 100).toFixed(1)
    const yonSembol    = katsayi > 1.005 ? "▲" : katsayi < 0.995 ? "▼" : "="
    const yonRenk      = katsayi > 1.005 ? "#16A34A" : katsayi < 0.995 ? "#DC2626" : "#0EA5E9"
    return { gercekRop, katsayi, yuzde, yonSembol, yonRenk }
  }, [gercekSure, modelSonuc, proje.kazikBoyu])

  // Birleşik kalibrasyon katsayısı
  const bilesik = useMemo(() => {
    const muh = sahaVerimi * operatorYetenegi * makineDurumu
    return Math.round(muh * olcumKatsayi * 10000) / 10000
  }, [sahaVerimi, operatorYetenegi, makineDurumu, olcumKatsayi])

  const muhendislikFaktoru = Math.round(sahaVerimi * operatorYetenegi * makineDurumu * 1000) / 1000
  const degisiklikVar = muhendislikFaktoru !== 1.0 || olcumKatsayi !== 1.0

  const handleUygulaOlcum = () => {
    if (!hesap) return
    setOlcumKatsayi(hesap.katsayi)
    uygula(hesap.katsayi)
  }

  const uygula = useCallback((newOlcumKatsayi) => {
    const olk = newOlcumKatsayi ?? olcumKatsayi
    const combined = Math.round(sahaVerimi * operatorYetenegi * makineDurumu * olk * 10000) / 10000
    onKalibrasyon({
      aktif:            combined !== 1.0,
      katsayi:          combined,
      sahaVerimi,
      operatorYetenegi,
      makineDurumu,
      olcumKatsayi:     olk,
    })
  }, [sahaVerimi, operatorYetenegi, makineDurumu, olcumKatsayi, onKalibrasyon])

  const handleSifirla = () => {
    setSahaVerimi(1.0)
    setOperatorYetenegi(1.0)
    setMakineDurumu(1.0)
    setOlcumKatsayi(1.0)
    setGercekSure("")
    onKalibrasyon({ aktif: false, katsayi: 1.0, sahaVerimi: 1.0, operatorYetenegi: 1.0, makineDurumu: 1.0, olcumKatsayi: 1.0 })
  }

  const inp = {
    padding: "8px 12px",
    border: "1.5px solid var(--input-border)",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--text-primary)",
    background: "var(--bg-card)",
    fontFamily: "'DM Mono', monospace",
    outline: "none",
    width: "120px",
  }

  const faktörItems = [
    {
      id: "sahaVerimi",
      label: "Saha Verimliliği (η_site)",
      desc: "Saha lojistiği, erişim, organizasyon. Karmaşık sahalar düşürün.",
      min: 0.60, max: 1.20, step: 0.05,
      value: sahaVerimi, set: setSahaVerimi,
      renk: "#0369A1",
      bands: [
        { label: "Kötü saha",    renk: "#DC2626" },
        { label: "Orta saha",    renk: "#D97706" },
        { label: "Standart",     renk: "#16A34A" },
        { label: "İdeal saha",   renk: "#0369A1" },
      ],
    },
    {
      id: "operatorYetenegi",
      label: "Operatör Yetkinliği (η_op)",
      desc: "Operatör deneyimi ve zemin bilgisi. Acemi operatörde düşürün.",
      min: 0.70, max: 1.10, step: 0.05,
      value: operatorYetenegi, set: setOperatorYetenegi,
      renk: "#7C3AED",
      bands: [
        { label: "Acemi",        renk: "#DC2626" },
        { label: "Orta",         renk: "#D97706" },
        { label: "Deneyimli",    renk: "#16A34A" },
        { label: "Uzman",        renk: "#0369A1" },
      ],
    },
    {
      id: "makineDurumu",
      label: "Makine Kondisyonu (η_mc)",
      desc: "Rig bakım durumu ve yaşı. Bakımsız ekipmanda düşürün.",
      min: 0.70, max: 1.00, step: 0.05,
      value: makineDurumu, set: setMakineDurumu,
      renk: "#D97706",
      bands: [
        { label: "Bakımsız",     renk: "#DC2626" },
        { label: "Bakım gerek",  renk: "#D97706" },
        { label: "İyi bakımlı",  renk: "#16A34A" },
      ],
    },
  ]

  return (
    <div style={{ animation: "fadeUp 0.3s ease", maxWidth: "720px" }}>
      {/* Başlık */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: "800", color: "var(--heading)", marginBottom: "6px" }}>
          {t("calibTitle")}
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6" }}>
          İki katmanlı kalibrasyon: <strong>mühendislik faktörleri</strong> (saha/operatör/makine) ve
          ölçüm bazlı ince ayar. Birleşik katsayı ROP hesabına çarpan olarak uygulanır.
        </p>
      </div>

      {/* ── 1. MÜHENDİSLİK FAKTÖRLERİ ── */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "14px",
        border: "1.5px solid var(--input-border)",
        padding: "24px", marginBottom: "20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#0369A1", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            1. Mühendislik Faktörleri
          </div>
          <div style={{
            background: muhendislikFaktoru === 1.0 ? "#F1F5F9" : "#EFF6FF",
            border: `1px solid ${muhendislikFaktoru === 1.0 ? "#CBD5E1" : "#BAE6FD"}`,
            borderRadius: "8px", padding: "4px 12px", fontSize: "12px", fontWeight: "700",
            color: muhendislikFaktoru === 1.0 ? "#64748B" : "#0369A1", fontFamily: "'DM Mono', monospace",
          }}>
            η_total = {muhendislikFaktoru.toFixed(3)}
          </div>
        </div>

        {faktörItems.map(({ id, label, desc, min, max, step, value, set, renk, bands }) => (
          <div key={id} style={{ marginBottom: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>{label}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{desc}</div>
              </div>
              <div style={{
                fontSize: "18px", fontWeight: "800", color: renk,
                fontFamily: "'DM Mono', monospace", minWidth: "48px", textAlign: "right",
              }}>
                {value.toFixed(2)}
              </div>
            </div>
            <div style={{ position: "relative", marginBottom: "4px" }}>
              <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={e => set(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: renk, cursor: "pointer" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)" }}>
              <span>{min}</span>
              {bands.map((b, i) => <span key={i} style={{ color: b.renk, fontWeight: "600" }}>{b.label}</span>)}
              <span>{max}</span>
            </div>
          </div>
        ))}

        <div style={{
          marginTop: "8px", paddingTop: "16px",
          borderTop: "1px solid var(--input-border)",
          display: "flex", gap: "24px", flexWrap: "wrap",
        }}>
          {[
            { label: "Saha",   val: sahaVerimi,       renk: "#0369A1" },
            { label: "Oper.",  val: operatorYetenegi,  renk: "#7C3AED" },
            { label: "Makine", val: makineDurumu,      renk: "#D97706" },
            { label: "Birleşik", val: muhendislikFaktoru, renk: "#0C3B6E", bold: true },
          ].map(({ label, val, renk, bold }) => (
            <div key={label}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: "16px", fontWeight: bold ? "800" : "700", color: renk, fontFamily: "'DM Mono', monospace" }}>
                ×{val.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. ÖLÇÜM KALİBRASYONU ── */}
      {modelSonuc && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "14px",
          border: "1.5px solid var(--input-border)",
          padding: "24px", marginBottom: "20px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#7C3AED", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
            2. Ölçüm Kalibrasyonu (opsiyonel)
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.5" }}>
            Sahadan ölçülen gerçek delme süresini girerek model hatası tespit edin. Mühendislik faktörlerine ek olarak uygulanır.
          </p>

          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "4px" }}>MODEL DELME SÜRESİ</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
                {modelSonuc.tDelme} <span style={{ fontSize: "12px", fontWeight: "400", color: "var(--text-muted)" }}>saat</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "4px" }}>MODEL ORT. ROP</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
                {modelSonuc.modelRop.toFixed(2)} <span style={{ fontSize: "12px", fontWeight: "400", color: "var(--text-muted)" }}>m/saat</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", marginBottom: "6px" }}>
                GERÇEK DELME SÜRESİ (saat)
              </label>
              <input
                type="number" min="0.1" step="0.1"
                value={gercekSure}
                onChange={e => setGercekSure(e.target.value)}
                placeholder="örn. 3.5"
                style={inp}
              />
            </div>
          </div>

          {hesap && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "12px", marginBottom: "16px",
            }}>
              <Kart baslik="Gerçek ROP"    deger={`${hesap.gercekRop.toFixed(2)} m/saat`} renk="#0369A1" />
              <Kart baslik="Fark"          deger={`${hesap.yonSembol} ${Math.abs(hesap.yuzde)}%`} renk={hesap.yonRenk} />
              <Kart baslik="Ölçüm Katsayısı" deger={hesap.katsayi.toFixed(4)} renk={hesap.yonRenk} />
            </div>
          )}

          <button
            onClick={handleUygulaOlcum}
            disabled={!hesap}
            style={{
              padding: "10px 20px", border: "none", borderRadius: "9px",
              background: hesap ? "linear-gradient(135deg, #7C3AED, #8B5CF6)" : "#E2E8F0",
              color: hesap ? "white" : "#94A3B8",
              fontSize: "13px", fontWeight: "700", cursor: hesap ? "pointer" : "not-allowed",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Ölçüm Katsayısını Uygula
          </button>
        </div>
      )}

      {/* ── BİRLEŞİK SONUÇ ── */}
      <div style={{
        background: degisiklikVar ? "#EFF6FF" : "var(--bg-surface)",
        border: `1.5px solid ${degisiklikVar ? "#BAE6FD" : "var(--input-border)"}`,
        borderRadius: "14px", padding: "20px 24px", marginBottom: "20px",
      }}>
        <div style={{ fontSize: "12px", fontWeight: "800", color: "#0C3B6E", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
          Birleşik Kalibrasyon Katsayısı
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#0369A1", fontFamily: "'DM Mono', monospace" }}>
            ×{bilesik.toFixed(4)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            = η_site({sahaVerimi.toFixed(2)}) × η_op({operatorYetenegi.toFixed(2)}) × η_mc({makineDurumu.toFixed(2)}) × ölçüm({olcumKatsayi.toFixed(4)})
            <br />Tüm ROP hesaplamalarına bu çarpan uygulanır.
          </div>
        </div>
      </div>

      {/* ── BUTONLAR ── */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => uygula()}
          style={{
            padding: "11px 28px", border: "none", borderRadius: "9px",
            background: "linear-gradient(135deg, #0284C7, #0EA5E9)",
            color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Projeye Uygula
        </button>
        {degisiklikVar && (
          <button
            onClick={handleSifirla}
            style={{
              padding: "11px 20px", border: "1.5px solid #FECACA", borderRadius: "9px",
              background: "white", color: "#DC2626",
              fontSize: "13px", fontWeight: "600", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Sıfırla (×1.0)
          </button>
        )}
      </div>

      {!zemin.length && (
        <div style={{ marginTop: "28px", color: "var(--text-muted)", fontSize: "13px" }}>
          {t("noSoilForCalib")}
        </div>
      )}
    </div>
  )
}

function Kart({ baslik, deger, renk }) {
  return (
    <div style={{
      background: "var(--bg-surface)", borderRadius: "8px",
      border: "1px solid var(--input-border)",
      padding: "12px 14px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: renk }} />
      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.04em", marginBottom: "4px", textTransform: "uppercase" }}>{baslik}</div>
      <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>{deger}</div>
    </div>
  )
}
