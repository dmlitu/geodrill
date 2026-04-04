import { useState, useEffect, useRef } from "react"

// ─── Blog Post Sayfası ────────────────────────────────────────────────────────

export default function BlogPost({ post, allPosts, onBack, onGoPost }) {
  const [progress, setProgress] = useState(0)
  const contentRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [post.id])

  useEffect(() => {
    const handleScroll = () => {
      const el = contentRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = Math.max(1, el.offsetHeight - window.innerHeight)
      setProgress(Math.min(100, (Math.max(0, -rect.top) / total) * 100))
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [post.id])

  const related = allPosts.filter(p => p.id !== post.id).slice(0, 2)
  const content = ARTICLE_CONTENT[post.id] || []

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#fff", color: "#0C4A6E", minHeight: "100vh" }}>
      <style>{`
        .bp-back { display:flex; align-items:center; gap:6px; background:none; border:1px solid #E0F2FE; border-radius:6px; padding:7px 14px; font-size:13px; font-weight:600; color:#64748B; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:color 0.2s,border-color 0.2s; }
        .bp-back:hover { color:#0369A1; border-color:#BAE6FD; }
        .bp-rel { background:#F8FAFF; border:1px solid #E0F2FE; border-radius:10px; padding:14px; text-align:left; cursor:pointer; transition:border-color 0.2s,transform 0.15s; font-family:'Plus Jakarta Sans',sans-serif; width:100%; }
        .bp-rel:hover { border-color:#BAE6FD; transform:translateY(-1px); }
        .bp-card { background:white; border:1px solid #E0F2FE; border-radius:12px; padding:0; text-align:left; cursor:pointer; overflow:hidden; transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s; font-family:'Plus Jakarta Sans',sans-serif; }
        .bp-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(14,165,233,0.1); border-color:#BAE6FD; }
        @media (max-width:860px) {
          .bp-grid { grid-template-columns:1fr !important; }
          .bp-sidebar { position:static !important; }
          .bp-hero, .bp-body, .bp-author-sec, .bp-related-sec { padding-left:24px !important; padding-right:24px !important; }
          .bp-nav-inner { padding:0 20px !important; }
          .bp-footer-inner { padding:20px 24px !important; }
        }
      `}</style>

      {/* Okuma ilerleme çubuğu */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", background: "#E0F2FE", zIndex: 300 }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg, #0284C7, #38BDF8)", width: `${progress}%`, transition: "width 0.12s linear" }} />
      </div>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E0F2FE" }}>
        <div className="bp-nav-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: "60px" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><BpLogo /></button>
          <button className="bp-back" onClick={onBack}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Tüm Yazılar
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="bp-hero" style={{ borderBottom: "1px solid #E0F2FE", padding: "52px 48px 44px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <span style={{ padding: "4px 12px", background: `${post.resimRenk}18`, color: post.resimRenk, borderRadius: "20px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.05em" }}>
              {post.kategori.toUpperCase()}
            </span>
            <span style={{ color: "#CBD5E1" }}>·</span>
            <span style={{ color: "#94A3B8", fontSize: "12px" }}>{post.tarih}</span>
          </div>

          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: "900", lineHeight: "1.15", margin: "0 0 20px", color: "#0C4A6E", letterSpacing: "-0.02em" }}>
            {post.baslik}
          </h1>

          <p style={{ fontSize: "17px", color: "#475569", lineHeight: "1.75", margin: "0 0 28px" }}>{post.ozet}</p>

          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${post.resimRenk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: "white" }}>
                {post.yazar.avatar}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0C4A6E" }}>{post.yazar.ad}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>{post.yazar.unvan}</div>
              </div>
            </div>
            <div style={{ width: "1px", height: "28px", background: "#E0F2FE" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748B", fontSize: "13px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {post.okumaSuresi} dakika okuma
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {post.etiketler.map(e => (
                <span key={e} style={{ padding: "2px 10px", background: "#F0F9FF", border: "1px solid #E0F2FE", borderRadius: "12px", fontSize: "11px", color: "#0369A1", fontWeight: "600" }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Makale gövdesi */}
      <div className="bp-body" ref={contentRef} style={{ maxWidth: "1100px", margin: "0 auto", padding: "52px 48px 80px" }}>
        <div className="bp-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "56px", alignItems: "start" }}>

          {/* İçerik */}
          <article>
            {content.map((block, i) => <ContentBlock key={i} block={block} />)}
          </article>

          {/* Kenar çubuğu */}
          <aside className="bp-sidebar" style={{ position: "sticky", top: "80px" }}>
            {/* Yazar kartı */}
            <div style={{ background: "#F8FAFF", border: "1px solid #E0F2FE", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${post.resimRenk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", color: "white" }}>
                  {post.yazar.avatar}
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "13px", color: "#0C4A6E" }}>{post.yazar.ad}</div>
                  <div style={{ fontSize: "11px", color: "#94A3B8" }}>{post.yazar.unvan}</div>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "#64748B", lineHeight: "1.65", margin: 0 }}>
                {YAZAR_BIO[post.yazar.avatar] || "GeoDrill platform geliştirici ekibinden geoteknik uzman."}
              </p>
            </div>

            {/* İlgili yazılar */}
            {related.length > 0 && (
              <div>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", letterSpacing: "3px", marginBottom: "12px" }}>İLGİLİ YAZILAR</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {related.map(p => (
                    <button key={p.id} className="bp-rel" onClick={() => { onGoPost(p); window.scrollTo(0, 0) }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: p.resimRenk, letterSpacing: "0.05em", marginBottom: "5px" }}>{p.kategori.toUpperCase()}</div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#0C4A6E", lineHeight: "1.4", marginBottom: "8px" }}>{p.baslik}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>{p.okumaSuresi} dk · {p.tarih}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Yazar bio (tam) */}
      <section className="bp-author-sec" style={{ background: "#F0F9FF", borderTop: "1px solid #E0F2FE", padding: "52px 48px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", gap: "28px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${post.resimRenk}, #38BDF8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700", color: "white" }}>
            {post.yazar.avatar}
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", letterSpacing: "3px", marginBottom: "8px" }}>YAZAR HAKKINDA</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "22px", fontWeight: "800", color: "#0C4A6E", marginBottom: "4px" }}>{post.yazar.ad}</div>
            <div style={{ fontSize: "13px", color: "#0EA5E9", fontWeight: "600", marginBottom: "14px" }}>{post.yazar.unvan}</div>
            <p style={{ fontSize: "14px", color: "#64748B", lineHeight: "1.8", margin: 0, maxWidth: "560px" }}>
              {YAZAR_UZUN_BIO[post.yazar.avatar] || YAZAR_BIO[post.yazar.avatar]}
            </p>
          </div>
        </div>
      </section>

      {/* İlgili yazılar (alt ızgara) */}
      {related.length > 0 && (
        <section className="bp-related-sec" style={{ padding: "60px 48px", borderTop: "1px solid #E0F2FE" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ width: "24px", height: "1px", background: "#0EA5E9" }} />
              <span style={{ color: "#0EA5E9", fontSize: "11px", fontWeight: "700", letterSpacing: "3px" }}>DEVAM EDİN</span>
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "28px", fontWeight: "800", color: "#0C4A6E", margin: "0 0 28px" }}>Diğer Yazılar</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {related.map(p => (
                <RelatedCard key={p.id} post={p} onClick={() => { onGoPost(p); window.scrollTo(0, 0) }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ background: "#0C4A6E" }}>
        <div className="bp-footer-inner" style={{ padding: "28px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <BpLogo dark />
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", margin: 0 }}>© {new Date().getFullYear()} GeoDrill Insight · Geoteknik Karar Destek Sistemi</p>
        </div>
      </footer>
    </div>
  )
}

// ─── İçerik Blok Bileşeni ─────────────────────────────────────────────────────

function ContentBlock({ block }) {
  switch (block.type) {
    case "h2":
      return <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "24px", fontWeight: "800", color: "#0C4A6E", margin: "44px 0 16px", letterSpacing: "-0.01em", paddingBottom: "12px", borderBottom: "1px solid #E0F2FE" }}>{block.text}</h2>
    case "h3":
      return <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0C4A6E", margin: "28px 0 10px" }}>{block.text}</h3>
    case "p":
      return <p style={{ fontSize: "16px", color: "#475569", lineHeight: "1.85", margin: "0 0 20px" }}>{block.text}</p>
    case "callout":
      return (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderLeft: "4px solid #0EA5E9", borderRadius: "8px", padding: "16px 20px", margin: "28px 0", display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "20px", flexShrink: 0, lineHeight: 1, marginTop: "2px" }}>{block.icon}</span>
          <div>
            {block.title && <div style={{ fontWeight: "700", color: "#0369A1", fontSize: "13px", marginBottom: "6px" }}>{block.title}</div>}
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.7", margin: 0 }}>{block.text}</p>
          </div>
        </div>
      )
    case "table":
      return (
        <div style={{ overflowX: "auto", margin: "28px 0", borderRadius: "10px", border: "1px solid #E0F2FE" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#F0F9FF" }}>
                {block.headers.map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontWeight: "700", color: "#0369A1", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "2px solid #BAE6FD" }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#F8FAFF" }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: "10px 16px", color: j === 0 ? "#0C4A6E" : "#475569", fontWeight: j === 0 ? "600" : "400", borderBottom: "1px solid #F0F9FF" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "li":
      return (
        <div style={{ margin: "20px 0 28px" }}>
          {block.baslik && <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "3px", marginBottom: "12px" }}>{block.baslik.toUpperCase()}</div>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "9px" }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "15px", color: "#475569", lineHeight: "1.6" }}>
                <span style={{ color: "#0EA5E9", fontWeight: "700", flexShrink: 0, marginTop: "2px" }}>→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )
    default:
      return null
  }
}

// ─── İlgili Yazı Kartı ────────────────────────────────────────────────────────

function RelatedCard({ post, onClick }) {
  return (
    <button className="bp-card" onClick={onClick}>
      <div style={{ height: "3px", background: `linear-gradient(90deg, ${post.resimRenk}, #38BDF8)` }} />
      <div style={{ padding: "20px" }}>
        <span style={{ padding: "3px 10px", background: `${post.resimRenk}18`, color: post.resimRenk, borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em" }}>
          {post.kategori.toUpperCase()}
        </span>
        <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0C4A6E", lineHeight: "1.45", margin: "10px 0 8px" }}>{post.baslik}</h3>
        <p style={{ fontSize: "12px", color: "#64748B", lineHeight: "1.55", margin: "0 0 14px" }}>{post.ozet.slice(0, 100)}...</p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94A3B8" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {post.okumaSuresi} dk · {post.tarih}
        </div>
      </div>
    </button>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function BpLogo({ dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {["#0369A1", "#0EA5E9", "#7DD3FC"].map((c, i) => (
          <div key={i} style={{ width: "6px", height: "6px", borderRadius: "1px", background: dark ? `rgba(255,255,255,${0.6 - i * 0.15})` : c }} />
        ))}
      </div>
      <div>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "19px", color: dark ? "white" : "#0C4A6E" }}>Geo</span>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: "900", fontSize: "19px", color: dark ? "#7DD3FC" : "#0EA5E9" }}>Drill</span>
        <span style={{ color: dark ? "rgba(255,255,255,0.35)" : "#94A3B8", fontSize: "9px", letterSpacing: "3px", marginLeft: "6px", verticalAlign: "middle", fontWeight: "700" }}>INSIGHT</span>
      </div>
    </div>
  )
}

// ─── Makale İçerikleri ────────────────────────────────────────────────────────

const ARTICLE_CONTENT = {
  1: [
    { type: "p", text: "Trakya Havzası, Türkiye'nin kuzeybatısında yer alan Paleosen-Eosen yaşlı sedimanter kayaçlardan oluşmaktadır. Silivri, Çerkezköy, Tekirdağ ve Lüleburgaz çevresinde yürütülen fore kazık projelerinde bu formasyonun delgi karakterini doğru modellemek; zaman, maliyet ve ekipman planlaması açısından kritik önem taşır." },
    { type: "callout", icon: "📊", title: "Temel Gözlem", text: "40'tan fazla proje verisine dayanan analizimizde Ø800 mm çaplı fore kazıklarda 1 m Dolgu + 14 m Kumtaşı için ortalama delgi süresi 1,3–1,7 saat arasında ölçülmüştür." },
    { type: "h2", text: "Trakya Formasyonu: Genel Özellikler" },
    { type: "p", text: "Trakya Grubu kayaçları ağırlıklı olarak kumtaşı, siltaş ve şeyl ardalanmasından oluşur. Genellikle düşük-orta sertlik aralığında yer alan bu birimler fore kazık açısından avantajlı bir zemin karakteri sunar. Bölgedeki kumtaşı horizonları; düşük UCS değerleri (8–45 MPa), iyi derecelenme ve düşük aşındırıcılık ile tanımlanır." },
    { type: "h2", text: "Penetrasyon Hızını Etkileyen Parametreler" },
    { type: "h3", text: "1. UCS — Tek Eksenli Basınç Dayanımı" },
    { type: "p", text: "UCS, penetrasyon hızı (ROP) üzerindeki en belirleyici parametredir. Trakya kumtaşları tipik olarak 10–40 MPa aralığına düşmekte olup bu aralıkta standart Kelly kova ile yüksek ROP elde edilebilmektedir. UCS = 20 MPa için Ø800 mm'de ölçülen ROP yaklaşık 8–9 m/saat civarındadır. UCS girilmediğinde sistem ihtiyatlı tahmini 10 m/saat baz alır." },
    { type: "h3", text: "2. Çap Etkisi" },
    { type: "p", text: "Kesme alanı çapın karesiyle orantılı büyür; dolayısıyla çap arttıkça birim güçte daha az ilerleme sağlanır. Ø800 mm referans çap alındığında Ø1000 mm geçişi yaklaşık %20–25 ROP kaybına, Ø600 mm ise benzer ölçüde kazanıma yol açar." },
    { type: "h3", text: "3. Alet Tipi: Kova mı, Kaya Kesici mi?" },
    { type: "p", text: "Trakya kumtaşına geçişte Kelly kova değişimine gerek kalmayışı önemli zaman tasarrufu sağlar. Sert kaya (UCS > 80 MPa) veya kireçtaşı formasyonlarında zorunlu olan rock auger/DTH geçişi, bu bölgede büyük ölçüde ortadan kalkmaktadır. Saha kayıtları, alet değişimi adımının atlanmasıyla 30–45 dakikalık tasarruf sağlandığını göstermektedir." },
    {
      type: "table",
      headers: ["Parametre", "Değer Aralığı", "ROP Etkisi"],
      rows: [
        ["UCS", "8 – 45 MPa", "Taban ROP %75–100 aralığında"],
        ["Çap", "Ø600 – Ø1200 mm", "Her 100 mm artış ≈ −5%"],
        ["SPT N", "15 – 60", "N > 30 → ek %10–20 yavaşlama"],
        ["Yeraltı suyu", "Su altında kum/silt", "−10–15% (drenajsız)"],
        ["Alet tipi", "Kova (bucket)", "Kaya kesici gerekmez"],
      ],
    },
    { type: "h2", text: "GeoDrill v3.0 Kalibrasyonu" },
    { type: "p", text: "GeoDrill v3.0 hesap motoruna entegre edilen Trakya kalibrasyonunda kumtaşı baz penetrasyon hızı 10,0 m/saat olarak belirlenmiş; alet değişimi (0,5 saat) ise yalnızca Kireçtaşı ve Sert Kaya geçişlerinde tetiklenmektedir. Bu sayede 1 m Dolgu + 14 m Kumtaşı + Ø800 mm senaryosunda hesaplanan delgi süresi 1,5 saate inmekte ve saha ölçümleriyle örtüşmektedir." },
    { type: "callout", icon: "✅", title: "Kalibrasyon Özeti", text: "Trakya bölgesi için önerilen parametreler: Kumtaşı ROP = 10 m/saat, alet değişimi yok. UCS > 0 girildiğinde azaltma katsayısı (FHWA GEC 10 §7) otomatik uygulanır." },
    { type: "h2", text: "Sonuç ve Öneriler" },
    { type: "p", text: "Trakya formasyonunda fore kazık delgi planlaması yaparken aşağıdaki pratik kuralları uygulayın. Özellikle UCS verisi yoksa baz değerleri kullanmak güvenli taraftadır; ancak güven puanının düşük kalacağını unutmayın." },
    { type: "li", baslik: "Özet Öneriler", items: ["Kumtaşı baz ROP: 10 m/saat (Ø800 mm referans)", "UCS = 20 MPa için beklenen ROP: ~8,5 m/saat", "Dolgu → Kumtaşı geçişinde alet değişimi planlamayın", "Yeraltı suyu altında kum/silt varsa %10–15 süre payı bırakın", "1 m Dolgu + 14 m Kumtaşı + Ø800 mm → 1,5 saat delgi"] },
  ],
  2: [
    { type: "p", text: "SPT (Standart Penetrasyon Testi) N-değeri, zemin mekaniğinde en yaygın kullanılan arazi deney parametrelerinden biridir. Bu rehberde SPT sonuçlarını doğrudan makine seçim kararına nasıl bağlayabileceğinizi adım adım açıklıyoruz." },
    { type: "h2", text: "SPT N-Değerinden Tork Hesabına" },
    { type: "p", text: "GeoDrill v3.0 tork motorunda direnç yolu öncelik sıralaması: kaya dayanımı → ölçülmüş su (Su) → CPT qc → SPT N → çıkarımsal tahmin. SPT değeri mevcut ancak CPT ve Su yoksa, sistem τ_eff = f(N) ilişkisiyle efektif kayma gerilmesi hesaplayarak oradan gerekli tork bant aralığına ulaşır." },
    { type: "callout", icon: "⚠️", title: "Kritik Eşik", text: "SPT N > 50 (ret sayılan zemin) durumunda tork hesabı otomatik olarak üst bant katsayılarına geçer. Bu eşikte Şartlı Uygun veya Uygun Değil kararı sıklaşır." },
    { type: "h2", text: "Dört Bantlı Makine Uygunluğu" },
    { type: "p", text: "Hesaplanan minimum tork, makine parkınızdaki her rig'in nominal kapasitesiyle karşılaştırılır. GeoDrill dört karar bandı kullanır: Rahat Uygun (≤%70 kapasite), Uygun (%70–90), Şartlı Uygun (%90–110) ve Uygun Değil (>%110)." },
    {
      type: "table",
      headers: ["Karar", "Tork Oranı", "Açıklama"],
      rows: [
        ["Rahat Uygun", "≤ %70", "Kapasite bolluğu var, güvenli"],
        ["Uygun", "%70 – %90", "Normal çalışma aralığı"],
        ["Şartlı Uygun", "%90 – %110", "Dikkatli uygulama gerekir"],
        ["Uygun Değil", "> %110", "Aşırı yüklenme riski"],
      ],
    },
    { type: "h2", text: "Veri Kalitesi ve Güven Puanı" },
    { type: "p", text: "Yalnızca SPT verisiyle çalışıldığında hesap güven puanı 20 üzerinde başlar. CPT qc eklenirse +35, ölçülmüş drenajsız kayma dayanımı (Su) eklenirse +25 puan kazanılır. Bu parametreleri Zemin Logu sayfasındaki ilgili sütunlara girerek hesap kalitesini artırabilirsiniz." },
    { type: "li", baslik: "Makine Seçim Adımları", items: ["Zemin Logu'na her katman için SPT N değerini girin", "Varsa UCS ve RQD değerlerini ekleyin (kaya için zorunlu)", "CPT ve Su girilirse sistem daha güvenilir tork aralığı üretir", "Analiz Sonucu ekranındaki makine matrisini inceleyin", "Şartlı Uygun makine için mühendis notundaki koşulları okuyun"] },
  ],
  3: [
    { type: "p", text: "Yeraltı suyu tablası, fore kazık tasarımında göz ardı edilemeyen kritik bir parametredir. EN 1536:2010 ve Eurocode 7 çerçevesinde su tablası konumu, casing uzunluğunu doğrudan belirleyen en önemli faktörlerden biridir." },
    { type: "h2", text: "Su Tablası ve Stabilite İlişkisi" },
    { type: "p", text: "Kohezyonsuz zeminlerde (kum, çakıl) su tablasının üzerinde dahi yeterli stabilite sağlanamayabilir; su altındaki granüler katmanlar için muhafaza borusu zorunluluğu EN 1536 §6.4 kapsamında değerlendirilir. GeoDrill bu kararı zemin tipi, SPT N-değeri ve yeraltı suyu girişini birlikte analiz ederek otomatik verir." },
    { type: "callout", icon: "💧", title: "Tasarım Prensibi (EN 1536)", text: "Kohezyonsuz zeminlerde su altında kalan katmanlar için casing zorunludur. SPT N < 10 olan gevşek granüler katmanlarda su seviyesinden bağımsız olarak casing önerilir." },
    { type: "h2", text: "GeoDrill Karar Mantığı" },
    { type: "p", text: "Yeraltı suyu seviyesi girildiğinde sistem, su altında kalan her granüler katmanı 'Yüksek Risk' olarak etiketler ve %100 casing oranı uygular. Orta riskli katmanlar (SPT N: 10–30 arası kohezyonsuz) için %50 casing oranı kullanılır. Kaya katmanları kural dışıdır." },
    {
      type: "table",
      headers: ["Durum", "Casing Kararı", "Oran"],
      rows: [
        ["Kum/Çakıl + su altı", "Zorunlu", "%100"],
        ["Kum/Çakıl + SPT < 10", "Zorunlu", "%100"],
        ["Kum/Çakıl orta yoğun", "Şartlı", "%50"],
        ["Kil/Silt (kohezif)", "Genellikle yok", "0%"],
        ["Kaya (UCS > 5 MPa)", "Yok", "0%"],
      ],
    },
    { type: "h2", text: "Hesap Güvenine Etkisi" },
    { type: "p", text: "Yeraltı suyu seviyesi bilinmediğinde sistem güvenli tarafta kalır: suya dair varsayım yapılmaz, ancak hesap güven puanı 10 puan eksik olur. Saha ölçümü veya komşu kuyu verisiyle su seviyesi girilmesi hem casing doğruluğunu artırır hem de güven bandını Orta'dan Yüksek'e taşır." },
    { type: "callout", icon: "✅", title: "Öneri", text: "Proje saha koordinatlarına yakın kuyulardaki statik su seviyeleri kayıt altına alın. Mevsimsel dalgalanma için ortalama değeri değil, en yüksek gözlenen seviyeyi kullanmak güvenli tasarım açısından tercih edilir." },
  ],
}

const YAZAR_BIO = {
  MD: "Geoteknik mühendisliğinde 10+ yıl deneyim. Trakya ve Marmara bölgelerinde 200'den fazla fore kazık projesinde zemin araştırması ve tasarım danışmanlığı.",
  DA: "Zemin mekaniği ve temel mühendisliği uzmanı. SPT bazlı zemin sınıflaması ve makine seçim metodolojileri üzerine çalışmalar yürütmektedir.",
}

const YAZAR_UZUN_BIO = {
  MD: "10 yılı aşkın geoteknik mühendislik deneyimiyle fore kazık, ankraj ve mini kazık projelerinde uzmanlaşmış. Trakya, Marmara ve İç Anadolu bölgelerinde 200'den fazla projede zemin araştırması ve tasarım danışmanlığı yaptı. GeoDrill platformunu sektördeki hesaplama standartlarını dijitalleştirmek amacıyla geliştirdi. FHWA GEC 10, EN 1536 ve Eurocode 7 çerçevesinde kalibrasyon çalışmaları yürüttü.",
  DA: "Zemin mekaniği ve temel mühendisliği alanında uzman. SPT bazlı zemin sınıflaması, makine seçim metodolojileri ve veri kalitesi değerlendirmesi üzerine çalışmalar yürütmektedir. GeoDrill platformunun hesap motoru geliştirme sürecinde aktif rol aldı.",
}
