// ─── Proje Kalibrasyonu ────────────────────────────────────────────────────────
// Saha ölçüm verisinden ROP kalibrasyon katsayısı türetir.
// Gerçek kazık süresi girilerek model ile karşılaştırma yapılır.

import { useState, useMemo } from "react"
import { casingMetreHesapla, tamCevrimSuresi } from "./hesaplamalar"
import { useLang } from "./LangContext"

export default function ProjeKalibrasyonu({ proje, zemin, kalibrasyon, onKalibrasyon }) {
  const [gercekSure, setGercekSure] = useState("")
  const { t } = useLang()

  // Model ROP: kalibrasyon uygulanmamış hali (katsayi=null)
  const modelSonuc = useMemo(() => {
    if (!zemin.length || !proje.kazikBoyu) return null
    const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
    const cevrim  = tamCevrimSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM, proje.isTipi, null)
    const modelRop = proje.kazikBoyu / cevrim.tDelme
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

  const handleUygula = () => {
    if (!hesap) return
    onKalibrasyon({ aktif: true, katsayi: Math.round(hesap.katsayi * 10000) / 10000 })
  }

  const handleSifirla = () => {
    onKalibrasyon({ aktif: false, katsayi: 1.0 })
    setGercekSure("")
  }

  const inp = {
    width: "180px",
    padding: "10px 14px",
    border: "1.5px solid var(--input-border)",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: "600",
    color: "var(--text-primary)",
    background: "var(--bg-card)",
    fontFamily: "'DM Mono', monospace",
    outline: "none",
  }

  return (
    <div style={{ animation: "fadeUp 0.3s ease", maxWidth: "680px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: "800", color: "var(--heading)", marginBottom: "6px" }}>
          {t("calibTitle")}
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6" }}>
          {t("calibDescFull")}
        </p>
      </div>

      {/* Model Bilgisi */}
      {modelSonuc && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "12px",
          border: "1px solid var(--input-border)",
          padding: "20px 24px", marginBottom: "24px",
          display: "flex", gap: "32px", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>{t("modelDrillTimeLabel")}</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
              {modelSonuc.tDelme} <span style={{ fontSize: "13px", fontWeight: "400", color: "var(--text-muted)" }}>{t("unitHours")}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>{t("modelAvgRopLabel")}</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
              {modelSonuc.modelRop.toFixed(2)} <span style={{ fontSize: "13px", fontWeight: "400", color: "var(--text-muted)" }}>{t("unitMperHour")}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>{t("pileLengthLabelCap")}</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
              {proje.kazikBoyu} <span style={{ fontSize: "13px", fontWeight: "400", color: "var(--text-muted)" }}>m</span>
            </div>
          </div>
        </div>
      )}

      {/* Giriş */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "12px",
        border: "1px solid var(--input-border)",
        padding: "24px", marginBottom: "24px",
      }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em", marginBottom: "10px" }}>
          {t("realDrillTimeInput")}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={gercekSure}
            onChange={e => setGercekSure(e.target.value)}
            placeholder="örn. 3.5"
            style={inp}
          />
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {t("realDrillNote")}
          </span>
        </div>
      </div>

      {/* Hesap Sonuçları */}
      {hesap && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "12px",
          border: "1.5px solid var(--input-border)",
          padding: "24px", marginBottom: "24px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em", marginBottom: "16px" }}>
            {t("calibrationResults")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
            <Kart baslik={t("modelRopLabel")} deger={`${modelSonuc.modelRop.toFixed(2)} m/saat`} renk="#0EA5E9" />
            <Kart baslik={t("realRopLabel")} deger={`${hesap.gercekRop.toFixed(2)} m/saat`} renk="#0369A1" />
            <Kart
              baslik={t("diffLabel")}
              deger={`${hesap.yonSembol} ${Math.abs(hesap.yuzde)}%`}
              renk={hesap.yonRenk}
            />
            <Kart
              baslik={t("calibFactorLabel")}
              deger={hesap.katsayi.toFixed(4)}
              renk={hesap.yonRenk}
            />
          </div>
        </div>
      )}

      {/* Aktif Kalibrasyon Bildirimi */}
      {kalibrasyon?.aktif && (
        <div style={{
          background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: "10px",
          padding: "14px 18px", marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "18px" }}>✅</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#166534" }}>
              {t("calibActiveMsg").replace("{k}", kalibrasyon.katsayi.toFixed(4))}
            </div>
            <div style={{ fontSize: "12px", color: "#4ADE80", marginTop: "2px" }}>
              {t("calibAppliedMsg")}
            </div>
          </div>
        </div>
      )}

      {/* Butonlar */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={handleUygula}
          disabled={!hesap}
          style={{
            padding: "11px 24px", border: "none", borderRadius: "9px",
            background: hesap ? "linear-gradient(135deg, #0284C7, #0EA5E9)" : "#E2E8F0",
            color: hesap ? "white" : "#94A3B8",
            fontSize: "14px", fontWeight: "700", cursor: hesap ? "pointer" : "not-allowed",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: "all 0.15s",
          }}
        >
          {t("applyToProject")}
        </button>
        {kalibrasyon?.aktif && (
          <button
            onClick={handleSifirla}
            style={{
              padding: "11px 20px", border: "1.5px solid #FECACA", borderRadius: "9px",
              background: "white", color: "#DC2626",
              fontSize: "13px", fontWeight: "600", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {t("resetCalibration")}
          </button>
        )}
      </div>

      {!zemin.length && (
        <div style={{ marginTop: "32px", color: "var(--text-muted)", fontSize: "13px" }}>
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
      padding: "14px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: renk }} />
      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "0.04em", marginBottom: "6px" }}>{baslik}</div>
      <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>{deger}</div>
    </div>
  )
}
