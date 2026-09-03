// ─── CAD Analizi ────────────────────────────────────────────────────────────
// DWG/DXF projesi yükleyip otomatik kazık/ankraj tespiti — backend'deki
// modules/cad motoru (layer/block/geometri kural motoru) ile çalışır.

import { useEffect, useRef, useState } from "react"
import { analyzeCadFile } from "./api"
import { useToast } from "./Toast"

const BAND_RENK = { HIGH: "var(--success)", MEDIUM: "var(--warning)", LOW: "var(--danger)" }
const BAND_ETIKET = { HIGH: "Yüksek Güven", MEDIUM: "Orta Güven", LOW: "Düşük Güven" }

function MetrikKart({ baslik, deger, renk, alt }) {
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "12px", padding: "20px",
      border: "1.5px solid var(--input-border)", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: renk }} />
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", marginBottom: "8px", letterSpacing: "0.02em" }}>{baslik}</div>
      <div style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>{deger}</div>
      {alt && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{alt}</div>}
    </div>
  )
}

function GuvenRozeti({ band }) {
  const renk = BAND_RENK[band] || "var(--text-muted)"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700",
      background: `color-mix(in srgb, ${renk} 15%, transparent)`, color: renk,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: renk }} />
      {BAND_ETIKET[band] || band}
    </span>
  )
}

function ElemanTablosu({ baslik, items }) {
  const [acik, setAcik] = useState(false)
  const gosterilen = acik ? items : items.slice(0, 8)
  if (!items.length) return null
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1.5px solid var(--input-border)", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--input-border)", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
        {baslik} <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>({items.length} adet)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface)" }}>
              {["ID", "X", "Y", "Layer", "Block", "Tespit", "Güven"].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: "700", fontSize: "10.5px", letterSpacing: "0.03em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gosterilen.map(it => (
              <tr key={it.id} style={{ borderTop: "1px solid var(--input-border)" }}>
                <td style={{ padding: "7px 12px", fontFamily: "'DM Mono', monospace", color: "var(--text-secondary)" }}>{it.id}</td>
                <td style={{ padding: "7px 12px", fontFamily: "'DM Mono', monospace" }}>{it.x.toFixed(2)}</td>
                <td style={{ padding: "7px 12px", fontFamily: "'DM Mono', monospace" }}>{it.y.toFixed(2)}</td>
                <td style={{ padding: "7px 12px", color: "var(--text-secondary)" }}>{it.layer || "—"}</td>
                <td style={{ padding: "7px 12px", color: "var(--text-secondary)" }}>{it.blockName || "—"}</td>
                <td style={{ padding: "7px 12px", color: "var(--text-muted)", fontSize: "11px" }}>{it.detectedBy}</td>
                <td style={{ padding: "7px 12px" }} title={it.evidence?.length ? it.evidence.join("\n") : undefined}>
                  <GuvenRozeti band={it.confidenceBand} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 8 && (
        <button onClick={() => setAcik(v => !v)} style={{
          width: "100%", padding: "9px", border: "none", borderTop: "1px solid var(--input-border)",
          background: "var(--bg-surface)", color: "var(--accent-dark)", fontSize: "12px", fontWeight: "600", cursor: "pointer",
        }}>
          {acik ? "Daha az göster ▲" : `Tümünü göster (${items.length}) ▼`}
        </button>
      )}
    </div>
  )
}

export default function CadAnalizi({ projeId }) {
  const [analiz, setAnaliz] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)
  const [dosyaAdi, setDosyaAdi] = useState("")
  const [detayAcik, setDetayAcik] = useState(false)
  const [gecenSaniye, setGecenSaniye] = useState(0)
  const inputRef = useRef(null)
  const toast = useToast()

  // Real elapsed time, not a fake progress bar — the backend does the whole
  // convert+parse+detect pass in one request/response, so there's no
  // per-stage signal to show honestly. Large/complex DWG files can
  // genuinely take upwards of a minute (see CadAnalizi upload timeout),
  // so a plain frozen "Analiz ediliyor…" reads as stuck; a running clock
  // at least confirms something is actively happening.
  useEffect(() => {
    if (!yukleniyor) { setGecenSaniye(0); return }
    const start = Date.now()
    const timer = setInterval(() => setGecenSaniye(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [yukleniyor])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!projeId) { toast.error("Önce projeyi kaydedin."); e.target.value = ""; return }
    setDosyaAdi(file.name)
    setYukleniyor(true)
    setSonuc(null)
    try {
      const result = await analyzeCadFile(projeId, file)
      setSonuc(result)
      setAnaliz(true)
      const { pileCount, anchorCount } = result.summary
      toast.success(
        `CAD analizi tamamlandı: ${pileCount === null ? "belirsiz sayıda" : pileCount} kazık, ` +
        `${anchorCount === null ? "belirsiz sayıda" : anchorCount} ankraj tespit edildi.`
      )
    } catch (err) {
      toast.error("CAD analizi başarısız: " + err.message)
    } finally {
      setYukleniyor(false)
      e.target.value = ""
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: "800", color: "var(--heading)", marginBottom: "6px" }}>
          CAD Analizi
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6" }}>
          İksa projesine ait AutoCAD dosyasını (.dwg veya .dxf) yükleyin; sistem layer, block ve geometri bilgisinden
          kazık ve ankraj sayısını otomatik tespit etsin.
        </p>
      </div>

      <div style={{
        background: "var(--bg-card)", borderRadius: "14px", border: "1.5px dashed var(--input-border)",
        padding: "32px", textAlign: "center", marginBottom: "24px",
      }}>
        <input ref={inputRef} type="file" accept=".dwg,.dxf" onChange={handleFile} style={{ display: "none" }} />
        <div style={{ fontSize: "32px", marginBottom: "10px" }}>📐</div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={yukleniyor}
          style={{
            padding: "11px 26px", border: "none", borderRadius: "8px",
            background: yukleniyor ? "var(--border-medium)" : "linear-gradient(135deg, var(--accent-dark), var(--accent))",
            color: "white", fontSize: "13.5px", fontWeight: "700", cursor: yukleniyor ? "not-allowed" : "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {yukleniyor
            ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: "7px" }}>⟳</span>Analiz ediliyor… ({gecenSaniye} sn)</>
            : "DWG / DXF Yükle"}
        </button>
        {dosyaAdi && (
          <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>
            {dosyaAdi}
          </div>
        )}
        {yukleniyor && gecenSaniye >= 8 && (
          <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6", maxWidth: "360px", marginLeft: "auto", marginRight: "auto" }}>
            Büyük veya karmaşık DWG dosyalarının dönüştürülmesi ve analizi birkaç dakika sürebilir.
            Bağlantı kopmadı, işlem sürüyor — sayfayı kapatmayın.
          </div>
        )}
      </div>

      {analiz && sonuc && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            <MetrikKart baslik="Kazık"
              deger={sonuc.summary.pileStatus === "uncertain" ? "Belirlenemedi" : `${sonuc.summary.pileCount} adet`}
              renk={sonuc.summary.pileStatus === "uncertain" ? "var(--warning)" : "var(--accent-dark)"}
              alt={sonuc.summary.pileStatus === "uncertain" ? "Kanıt var, sayı doğrulanamadı — belirsiz adaylara bakın" : undefined} />
            <MetrikKart baslik="Ankraj"
              deger={sonuc.summary.anchorStatus === "uncertain" ? "Belirlenemedi" : `${sonuc.summary.anchorCount} adet`}
              renk={sonuc.summary.anchorStatus === "uncertain" ? "var(--warning)" : "var(--teal)"}
              alt={sonuc.summary.anchorStatus === "uncertain" ? "Kanıt var, sayı doğrulanamadı — belirsiz adaylara bakın" : undefined} />
            <MetrikKart baslik="Birim" deger={sonuc.diagnostics.units.toUpperCase()} renk="var(--accent)"
              alt={`${sonuc.diagnostics.modelSpaceEntityCount} model space eleman`} />
            <MetrikKart baslik="Gözden Geçirme" deger={sonuc.needsReview ? "Gerekli" : "Gerekmiyor"}
              renk={sonuc.needsReview ? "var(--warning)" : "var(--success)"}
              alt={`${sonuc.uncertainCandidates.length} belirsiz aday`} />
          </div>

          {sonuc.warnings.length > 0 && (
            <div style={{
              background: "color-mix(in srgb, var(--warning) 10%, transparent)",
              border: "1.5px solid var(--warning)", borderRadius: "10px",
              padding: "14px 18px", marginBottom: "20px", fontSize: "12.5px", color: "var(--text-primary)",
            }}>
              {sonuc.warnings.map((w, i) => <div key={i} style={{ marginBottom: i < sonuc.warnings.length - 1 ? "6px" : 0 }}>⚠️ {w}</div>)}
            </div>
          )}

          <button onClick={() => setDetayAcik(v => !v)} style={{
            display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none",
            color: "var(--accent-dark)", fontSize: "13px", fontWeight: "700", cursor: "pointer",
            padding: "0 0 14px", fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {detayAcik ? "▲" : "▼"} Analiz detayları
          </button>

          {detayAcik && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                background: "var(--bg-card)", borderRadius: "12px", border: "1.5px solid var(--input-border)",
                padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px",
              }}>
                {[
                  ["DXF Sürümü", sonuc.diagnostics.dxfVersion],
                  ["Analiz Edilen Layer", sonuc.diagnostics.layersAnalyzed],
                  ["Analiz Edilen Block", sonuc.diagnostics.blocksAnalyzed],
                  ["Paper Space Sayfası", sonuc.diagnostics.paperSpaceLayoutCount],
                  ["XREF Sayısı", sonuc.diagnostics.xrefCount],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "3px" }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>{val}</div>
                  </div>
                ))}
              </div>

              <ElemanTablosu baslik="Tespit Edilen Kazıklar" items={sonuc.piles.items} />
              <ElemanTablosu baslik="Tespit Edilen Ankrajlar" items={sonuc.anchors.items} />

              {sonuc.uncertainCandidates.length > 0 && (
                <div style={{
                  background: "var(--bg-card)", borderRadius: "12px", border: "1.5px solid var(--input-border)", overflow: "hidden",
                }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--input-border)", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                    Belirsiz Adaylar <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>({sonuc.uncertainCandidates.length} adet — sayıya dahil edilmedi)</span>
                  </div>
                  <div style={{ padding: "12px 18px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.7" }}>
                    Sistem bu nesnelerin kazık/ankraj olup olmadığından emin olamadı; bu yüzden onaylı sayıya dahil
                    edilmediler. Genellikle isimlendirme kuralına uymayan layer'lardaki tekrarlı geometrilerdir —
                    aşağıdaki eleman tablosuna manuel göz atmanız önerilir.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
