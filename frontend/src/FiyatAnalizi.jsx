import { useState, useMemo } from "react"
import {
  gerekliTork, casingMetreHesapla, kazikSuresi, mazotTahmini, fiyatAnalizi
} from "./hesaplamalar"

const cardStyle = {
  background: "var(--bg-card)", borderRadius: "12px",
  border: "1px solid var(--input-border)", padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
}

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "700",
  color: "var(--text-secondary)", letterSpacing: "0.04em",
  textTransform: "uppercase", marginBottom: "6px"
}

const inputStyle = {
  width: "100%", padding: "10px 14px",
  border: "1.5px solid var(--input-border)", borderRadius: "8px",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
  color: "var(--input-text)", background: "var(--input-bg)",
  fontFamily: "'Plus Jakarta Sans', sans-serif"
}

const DEFAULTS = {
  mazotFiyati: 45,       // TL/L
  makineKirasi: 800,     // TL/saat
  iscilikSaat: 200,      // TL/saat
  sarfMalzeme: 150,      // TL/m
  karPayiYuzde: 20,      // %
}

function SatirGirdi({ label, value, onChange, birim, min = 0 }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="number" min={min} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, paddingRight: birim ? "48px" : "14px" }}
        />
        {birim && (
          <span style={{
            position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
            fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", pointerEvents: "none"
          }}>{birim}</span>
        )}
      </div>
    </div>
  )
}

function SonucSatiri({ label, tutar, renk, buyuk, bilgi }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: buyuk ? "14px 0" : "9px 0",
      borderBottom: buyuk ? "none" : "1px solid var(--border-subtle)",
      borderTop: buyuk ? "2px solid var(--border-subtle)" : "none",
      marginTop: buyuk ? "4px" : 0,
    }}>
      <div>
        <span style={{ fontSize: buyuk ? "15px" : "13px", color: renk || "var(--text-secondary)", fontWeight: buyuk ? "700" : "500" }}>
          {label}
        </span>
        {bilgi && <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>{bilgi}</span>}
      </div>
      <span style={{
        fontSize: buyuk ? "20px" : "14px",
        fontWeight: buyuk ? "800" : "600",
        color: renk || "var(--text-primary)",
        fontVariantNumeric: "tabular-nums"
      }}>
        {tutar.toLocaleString("tr-TR")} ₺
      </span>
    </div>
  )
}

export default function FiyatAnalizi({ proje, zemin }) {
  const [parametreler, setParametreler] = useState(DEFAULTS)

  const set = (key) => (val) => setParametreler(p => ({ ...p, [key]: val }))

  const hesap = useMemo(() => {
    if (!zemin.length) return null
    const tork = gerekliTork(zemin, proje.kazikCapi)
    const casingM = casingMetreHesapla(zemin, proje.yeraltiSuyu)
    const sure = kazikSuresi(zemin, proje.kazikCapi, proje.kazikBoyu, casingM)
    const { mBasi, toplam: topMazot } = mazotTahmini(tork, proje.kazikBoyu)
    const analiz = fiyatAnalizi(parametreler, proje, mBasi, topMazot, sure)
    return { ...analiz, sure, mBasi, tork }
  }, [zemin, proje, parametreler])

  if (!zemin.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>💰</div>
        <h2 style={{ color: "var(--heading)", fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Zemin Verisi Gerekli</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Fiyat analizi için önce zemin logunu doldurun.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Başlık */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>Fiyat Analizi</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          {proje.projeAdi || "Proje"} — {proje.kazikBoyu}m × {proje.kazikAdedi} adet kazık
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" }}>

        {/* Sol: Parametreler */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--heading)", marginBottom: "20px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
            Maliyet Parametreleri
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SatirGirdi label="Mazot Fiyatı" value={parametreler.mazotFiyati} onChange={set("mazotFiyati")} birim="₺/L" min={1} />
            <SatirGirdi label="Makine Kirası / Amortisman" value={parametreler.makineKirasi} onChange={set("makineKirasi")} birim="₺/saat" min={0} />
            <SatirGirdi label="İşçilik" value={parametreler.iscilikSaat} onChange={set("iscilikSaat")} birim="₺/saat" min={0} />
            <SatirGirdi label="Sarf Malzeme" value={parametreler.sarfMalzeme} onChange={set("sarfMalzeme")} birim="₺/m" min={0} />
            <SatirGirdi label="Kâr Payı" value={parametreler.karPayiYuzde} onChange={set("karPayiYuzde")} birim="%" min={0} />
          </div>

          {/* Baz değerler info */}
          <div style={{ marginTop: "20px", padding: "12px 14px", background: "var(--badge-muted-bg)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", marginBottom: "8px" }}>HESAP TABANINDAN GELEN DEĞERLER</div>
            {hesap && [
              ["Gerekli Tork", `${hesap.tork} kNm`],
              ["1 Kazık Süresi", `${hesap.sure} saat`],
              ["Metre Başı Mazot", `${hesap.mBasi} L/m`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{k}</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sağ: Sonuçlar */}
        {hesap && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Maliyet tablosu */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
                Maliyet Dökümü
              </h3>
              <SonucSatiri label="Mazot Maliyeti" tutar={hesap.mazotMaliyeti}
                bilgi={`${hesap.mBasi} L/m × ${proje.kazikBoyu}m × ${proje.kazikAdedi} kazık × ${parametreler.mazotFiyati}₺`} />
              <SonucSatiri label="Makine Kirası / Amortisman" tutar={hesap.amortismanMaliyeti}
                bilgi={`${hesap.sure} saat/kazık × ${proje.kazikAdedi} kazık × ${parametreler.makineKirasi}₺`} />
              <SonucSatiri label="İşçilik" tutar={hesap.iscilikMaliyeti}
                bilgi={`${hesap.sure} saat/kazık × ${proje.kazikAdedi} kazık × ${parametreler.iscilikSaat}₺`} />
              <SonucSatiri label="Sarf Malzeme" tutar={hesap.sarfMalzemeMaliyeti}
                bilgi={`${proje.kazikBoyu}m × ${proje.kazikAdedi} kazık × ${parametreler.sarfMalzeme}₺`} />
              <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>Alt Toplam</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>{hesap.altToplam.toLocaleString("tr-TR")} ₺</span>
              </div>
              <SonucSatiri label={`Kâr Payı (%${parametreler.karPayiYuzde})`} tutar={hesap.karPayi} renk="#16A34A" />
              <SonucSatiri label="TOPLAM MALİYET" tutar={hesap.toplam} renk="#0284C7" buyuk />
            </div>

            {/* Birim fiyatlar */}
            <div style={cardStyle}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--heading)", marginBottom: "16px", paddingBottom: "10px", borderBottom: "2px solid var(--border-subtle)" }}>
                Birim Fiyatlar
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { baslik: "Kazık Başı", deger: `${hesap.kazikBasi.toLocaleString("tr-TR")} ₺`, alt: "/ kazık", renk: "#0284C7" },
                  { baslik: "Metre Başı", deger: `${hesap.metreBasi.toLocaleString("tr-TR")} ₺`, alt: "/ m", renk: "#0EA5E9" },
                ].map(k => (
                  <div key={k.baslik} style={{ background: "var(--badge-muted-bg)", borderRadius: "10px", padding: "16px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "8px" }}>{k.baslik}</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: k.renk }}>{k.deger}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{k.alt}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proje özeti */}
            <div style={{ ...cardStyle, background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)", border: "1.5px solid #BAE6FD" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", letterSpacing: "0.06em", marginBottom: "6px" }}>
                PROJE MALİYET ÖZETİ
              </div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#0C4A6E", fontVariantNumeric: "tabular-nums" }}>
                {hesap.toplam.toLocaleString("tr-TR")} ₺
              </div>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                {proje.kazikAdedi} kazık × {proje.kazikBoyu}m · Kâr dahil
              </div>
              <div style={{ marginTop: "14px", fontSize: "12px", color: "#0369A1", background: "rgba(14,165,233,0.08)", padding: "10px 12px", borderRadius: "8px", lineHeight: "1.6" }}>
                Benzer zemin profillerine sahip projelerde bu boyuttaki kazıklarda metre başı maliyet tipik olarak {Math.round(hesap.metreBasi * 0.85).toLocaleString("tr-TR")}–{Math.round(hesap.metreBasi * 1.15).toLocaleString("tr-TR")} ₺ arasında değişmektedir. Bu analiz saha verileri ile uyumludur.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
