import { useState, useEffect } from "react"
import { listProjects, getProject, deleteProject, downloadPdfReport, downloadExcelReport, fromSnake, fromSnakeLayer } from "./api"
import { gerekliTork, casingDurum, casingMetreHesapla, kazikSuresi, mazotTahmini, katmanTeknikCikti, makinaUygunluk } from "./hesaplamalar"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"

const RISK_RENK = {
  "Yüksek": { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  "Orta": { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  "Düşük": { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
}

function ProjeKarti({ proje, onDuzenle, onSil }) {
  const [acik, setAcik] = useState(false)
  const [detay, setDetay] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState(null)
  const [pdfYukleniyor, setPdfYukleniyor] = useState(false)
  const [xlsxYukleniyor, setXlsxYukleniyor] = useState(false)
  const toast = useToast()

  const yukleDetay = async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const tam = await getProject(proje.id)
      const zemin = (tam.soil_layers || []).map(fromSnakeLayer)
      const projeData = fromSnake(tam)
      let analiz = null
      if (zemin.length) {
        const tork = gerekliTork(zemin, projeData.kazikCapi)
        const { durum: casingDur, zorunlu } = casingDurum(zemin, projeData.yeraltiSuyu)
        const casingM = casingMetreHesapla(zemin, projeData.yeraltiSuyu)
        const sure = kazikSuresi(zemin, projeData.kazikCapi, projeData.kazikBoyu, casingM)
        const { mBasi, toplam: topMazot } = mazotTahmini(tork, projeData.kazikBoyu)
        const toplamGun = Math.round(sure * projeData.kazikAdedi * 10) / 10
        const katmanCiktilar = katmanTeknikCikti(zemin, projeData.kazikCapi)
        analiz = { tork, casingDur, casingM, sure, mBasi, topMazot, toplamGun, zorunlu, katmanCiktilar }
      }
      setDetay({ zemin, proje: projeData, analiz })
    } catch (e) {
      const agHatasi = e instanceof TypeError || e.message === "Load failed" || e.message === "Failed to fetch"
      setHata(agHatasi
        ? "Sunucuya bağlanılamadı. Backend çalışıyor mu? Tekrar deneyin."
        : "Yükleme hatası: " + e.message
      )
    } finally {
      setYukleniyor(false)
    }
  }

  const toggle = async () => {
    if (!acik && !detay && !yukleniyor) {
      setAcik(true)
      await yukleDetay()
    } else if (!yukleniyor) {
      setAcik(p => !p)
    }
  }

  const handlePdf = async () => {
    setPdfYukleniyor(true)
    try { await downloadPdfReport(proje.id) }
    catch (e) { toast.error("PDF indirilemedi: " + e.message) }
    finally { setPdfYukleniyor(false) }
  }

  const handleXlsx = async () => {
    if (!detay) return
    setXlsxYukleniyor(true)
    try { await downloadExcelReport(detay.proje, detay.zemin, detay.analiz, proje.proje_kodu) }
    catch (e) { toast.error("Excel indirilemedi: " + e.message) }
    finally { setXlsxYukleniyor(false) }
  }

  const tarih = new Date(proje.updated_at || proje.created_at || Date.now())
    .toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "12px",
      border: `1px solid ${acik ? "var(--accent)" : "var(--input-border)"}`,
      boxShadow: acik ? "0 4px 16px rgba(14,165,233,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
      overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s",
    }}>
      {/* Başlık satırı */}
      <div
        onClick={toggle}
        style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px" }}
      >
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px",
          background: "var(--badge-muted-bg)", border: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", flexShrink: 0
        }}>📋</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {proje.proje_adi || "İsimsiz Proje"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {proje.proje_kodu || "—"} · {proje.is_tipi || "Fore Kazık"} · {proje.kazik_boyu}m / Ø{proje.kazik_capi}mm
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tarih}</span>
          <button
            onClick={e => { e.stopPropagation(); onDuzenle(proje.id) }}
            style={{ padding: "5px 12px", border: "1px solid var(--input-border)", borderRadius: "6px", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
          >Düzenle</button>
          <button
            onClick={e => { e.stopPropagation(); handlePdf() }}
            disabled={pdfYukleniyor}
            style={{ padding: "5px 12px", border: "1px solid #BAE6FD", borderRadius: "6px", background: "#F0F9FF", color: "#0369A1", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
          >{pdfYukleniyor ? "..." : "PDF"}</button>
          <button
            onClick={e => { e.stopPropagation(); toggle().then(() => handleXlsx()) }}
            disabled={xlsxYukleniyor}
            style={{ padding: "5px 12px", border: "1px solid #BBF7D0", borderRadius: "6px", background: "#F0FDF4", color: "#16A34A", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
          >{xlsxYukleniyor ? "..." : "Excel"}</button>
          <button
            onClick={e => { e.stopPropagation(); onSil(proje.id, proje.proje_adi) }}
            style={{ padding: "5px 10px", border: "none", borderRadius: "6px", background: "none", color: "#CBD5E1", fontSize: "16px", cursor: "pointer" }}
          >✕</button>
          <span style={{ color: "var(--text-muted)", fontSize: "16px", transition: "transform 0.2s", transform: acik ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
      </div>

      {/* Accordion içerik */}
      {acik && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "20px", background: "var(--row-alt)" }}>
          {yukleniyor ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: "8px" }}>⟳</span>
              Yükleniyor...
            </div>
          ) : hata ? (
            <div style={{ textAlign: "center", padding: "16px", background: "#FEF2F2", borderRadius: "8px", border: "1px solid #FECACA" }}>
              <div style={{ fontSize: "13px", color: "#DC2626", marginBottom: "10px" }}>{hata}</div>
              <button
                onClick={e => { e.stopPropagation(); yukleDetay() }}
                style={{ padding: "6px 18px", border: "none", borderRadius: "6px", background: "#DC2626", color: "white", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
              >Tekrar Dene</button>
            </div>
          ) : detay ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              {/* Analiz özeti */}
              {detay.analiz && (
                <div style={{ background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--input-border)", padding: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "10px" }}>Analiz Özeti</div>
                  {[
                    ["Gerekli Tork", `${detay.analiz.tork} kNm`],
                    ["Casing", `${detay.analiz.casingDur} (${detay.analiz.casingM} m)`],
                    ["1 Kazık Süresi", `${detay.analiz.sure} saat`],
                    ["Toplam Süre", `${detay.analiz.toplamGun} gün`],
                    ["Metre Başı Mazot", `${detay.analiz.mBasi} L/m`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{k}</span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Zemin özeti */}
              <div style={{ background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--input-border)", padding: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Zemin Logu ({detay.zemin.length} katman)
                </div>
                {detay.zemin.length === 0
                  ? <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Zemin verisi girilmemiş.</p>
                  : detay.zemin.slice(0, 6).map((z, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{z.baslangic}–{z.bitis} m</span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{z.zemTipi} / SPT:{z.spt}</span>
                    </div>
                  ))}
                {detay.zemin.length > 6 && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>...ve {detay.zemin.length - 6} katman daha</div>
                )}
              </div>

              {/* Tork dağılımı */}
              {detay.analiz?.katmanCiktilar && (
                <div style={{ background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--input-border)", padding: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "10px" }}>Tork Dağılımı</div>
                  {detay.analiz.katmanCiktilar.map((r, i) => (
                    <div key={i} style={{ marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.baslangic}–{r.bitis}m</span>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-primary)" }}>{r.katmanTork} kNm</span>
                      </div>
                      <div style={{ height: "4px", background: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, (r.katmanTork / detay.analiz.tork) * 100)}%`, height: "100%", background: "#0EA5E9", borderRadius: "2px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function OncekiAnalizler({ onDuzenle }) {
  const [projeler, setProjeler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [aramaMetni, setAramaMetni] = useState("")
  const [silOnay, setSilOnay] = useState(null)
  const toast = useToast()

  const yukle = async () => {
    setYukleniyor(true)
    try {
      const liste = await listProjects()
      setProjeler(liste)
    } catch (e) {
      toast.error("Projeler yüklenemedi: " + e.message)
    } finally {
      setYukleniyor(false)
    }
  }

  useEffect(() => { yukle() }, [])

  const handleSil = (id, ad) => setSilOnay({ id, ad })

  const confirmSil = async () => {
    try {
      await deleteProject(silOnay.id)
      setProjeler(p => p.filter(x => x.id !== silOnay.id))
      toast.success("Proje silindi.")
    } catch (e) {
      toast.error("Silinemedi: " + e.message)
    } finally {
      setSilOnay(null)
    }
  }

  const filtrelenmis = projeler.filter(p =>
    !aramaMetni || (p.proje_adi || "").toLowerCase().includes(aramaMetni.toLowerCase()) || (p.proje_kodu || "").toLowerCase().includes(aramaMetni.toLowerCase())
  )

  return (
    <div>
      <ConfirmDialog
        open={silOnay !== null}
        title="Proje Silinsin mi?"
        message={`"${silOnay?.ad || "Bu proje"}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        onConfirm={confirmSil}
        onCancel={() => setSilOnay(null)}
      />

      <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ color: "var(--heading)", fontSize: "22px", fontWeight: "700" }}>Önceki Analizler</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
            {projeler.length} proje · Tıklayarak detayları görün
          </p>
        </div>
        <input
          value={aramaMetni}
          onChange={e => setAramaMetni(e.target.value)}
          placeholder="Proje adı veya kod ara..."
          style={{
            padding: "9px 14px", border: "1.5px solid var(--input-border)", borderRadius: "8px",
            fontSize: "13px", outline: "none", background: "var(--input-bg)", color: "var(--input-text)",
            width: "220px"
          }}
        />
      </div>

      {yukleniyor ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "70px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--input-border)", animation: "shimmer 1.5s ease infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, var(--bg-card) 25%, var(--row-alt) 50%, var(--bg-card) 75%)" }} />
          ))}
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🕒</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--heading)", marginBottom: "8px" }}>
            {aramaMetni ? "Eşleşen proje bulunamadı" : "Henüz kayıtlı analiz yok"}
          </div>
          <div style={{ fontSize: "13px" }}>
            {aramaMetni ? "Farklı bir arama terimi deneyin." : "Yeni Analiz Başlat ile ilk projeyi oluşturun."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtrelenmis.map(p => (
            <ProjeKarti
              key={p.id}
              proje={p}
              onDuzenle={onDuzenle}
              onSil={handleSil}
            />
          ))}
        </div>
      )}
    </div>
  )
}
