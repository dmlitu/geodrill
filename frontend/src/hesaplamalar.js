// ─── GeoDrill Hesaplamalar v3.0 ────────────────────────────────────────────────
// Geoteknik delgi karar destek motoru — backend engine.py'nin tam mirror'u.
// Herhangi bir hesap değişikliği HER İKİ dosyada da uygulanmalıdır.
//
// v3.0 değişiklikleri:
//   - Yeni tork formülü: T = τ_eff × (π×D³/8) × K_app × K_method × K_gw × K_depth × K_uncertainty
//   - Direnç yolu önceliği: kaya > su > CPT > SPT > çıkarımsal
//   - Dört bantlı makine uygunluğu: RAHAT UYGUN / UYGUN / SINIRDA / UYGUN DEĞİL
//   - Tam çevrim süresi: tamCevrimSuresi() ile beton, donatı, lojistik dahil
//   - Güven puanlaması: guvenAnalizi() ile 0-100 arası puan + seviye
//   - Türkçe açıklama motoru: aciklamaUret() her makine için profesyonel metin
//   - Geriye dönük uyumluluk: v2 çağrıları değiştirilmeden çalışmaya devam eder
//
// KAYNAK HİYERARŞİSİ:
//   1. EN 1536:2010 / TS EN 1536 — fore kazık uygulaması
//   2. FHWA GEC 10 (2010) — delgi şaftları / fore kazık yapımı
//   3. FHWA GEC 5 — zemin parametresi geliştirme ve korelasyonlar
//   4. OEM üretici verileri — makine kapasite limitleri
//   5. Zayed & Halpin (2005) — zaman/maliyet üretkenlik modelleri
//   6. Muhafazakâr mühendislik yargısı (aşağıda belgelenmiş)
//
// GÜVENİLİRLİK SINIFLARI:
//   A — Ölçülmüş / doğrudan proje verisi (lab, yerinde)
//   B — Tanınan yerinde testlerden korelasyon (SPT, UCS, CPT)
//   C — Yalnızca niteliksel log / çıkarımsal

// ─── Katsayı Kayıt Defteri ────────────────────────────────────────────────────
// Tüm mühendislik sabitleri kaynak notlarıyla burada merkezileştirilmiştir.
// Kalibrasyon için yalnızca bu dosyayı güncelleyin; sihirli sayı yasaktır.

export const KATSAYILAR = {

  tork: {
    // ── Kohezyonlu yol ──────────────────────────────────────────────────────
    // SPT→Su: k_su = 4 kPa/darbe (muhafazakâr; FHWA GEC 5 Tablo 3-1, aralık 4–6)
    kohezyon_spt:    4.0,
    kohezyon_su_min: 20.0,   // kPa tabanı (çok yumuşak kil)

    // CPT→Su kohezyonlu için: Su ≈ (qc − σv₀) / Nkt, Nkt≈15-20
    // Basitleştirilmiş: Su ≈ qc_MPa × 1000 / Nkt. B Sınıfı.
    cpt_nkt:    17.5,        // Su türetimi için koni faktörü (boyutsuz)
    cpt_su_min: 20.0,        // CPT türetmeli Su için kPa tabanı

    // ── Kohezyonsuz yol ─────────────────────────────────────────────────────
    // SPT→mobilize sürtünme proxy (kPa/darbe). C Sınıfı.
    kohezyon_siz_spt:     2.0,
    kohezyon_siz_tau_min: 15.0,  // kPa

    // CPT→sürtünme kohezyonsuz: τ ≈ qc_MPa × 1000 / K_qc. B Sınıfı.
    cpt_kqc_kohezyon_siz: 100.0, // K_qc faktörü (boyutsuz, aralık 80-120 kPa/MPa)

    // ── Kaya yolu ───────────────────────────────────────────────────────────
    // τ = UCS_MPa × 1000 / K_ucs (FHWA GEC 10 §7.4, B Sınıfı)
    kaya_ucs_tau_boleni: 35.0,
    kaya_ucs_varsayilan: {
      "Ayrışmış Kaya": 5.0,   // çok ayrışmış, çok yumuşak kaya
      "Kumtaşı":       15.0,  // yumuşak-orta kumtaşı (Trakya-tipi)
      "Kireçtaşı":     20.0,  // orta kireçtaşı
      "Sert Kaya":     60.0,  // sert kaya alt sınırı
    },

    // ── RQD belirsizlik faktörleri ───────────────────────────────────────────
    // Daha düşük RQD → daha yüksek belirsizlik → muhafazakâr yukarı marj
    // Kaynak: FHWA GEC 10 §7.4 kaya kalitesi + muhafazakâr yargı
    rqd_faktor: { 75: 1.00, 50: 1.10, 25: 1.20, 0: 1.35 },

    // ── Uygulama faktörü ─────────────────────────────────────────────────────
    // Takım geometrisi + verimlilik + homojen olmama (Kelly rotary)
    // Saha telemetrisiyle güncelleyin.
    uygulama_faktoru: 1.25,

    // ── Çıktı belirsizlik bandı ──────────────────────────────────────────────
    alt_bant: 0.80,   // alt limit = nominal × 0.80
    ust_bant: 1.30,   // üst limit = nominal × 1.30
  },

  // ── Yöntem katsayıları ────────────────────────────────────────────────────
  // Farklı delgi teknikleri farklı tork talepleri oluşturur.
  // Fore Kazık referans yöntemdir (1.00).
  // Kaynak: FHWA GEC 10 §7; OEM uygulama kılavuzları; muhafazakâr yargı. C Sınıfı.
  yontem: {
    carpan: {
      "Fore Kazık":          1.00,  // Kelly rotary — referans yöntem
      "CFA Kazık":           1.10,  // helezoni tork ~%10 ek
      "Kısmi Yerinden Etme": 1.30,  // kısmi yerinden etme — yanal gerilme + sürtünme
      "Yerinden Etme":       1.55,  // tam yerinden etme / FDP / DD — en yüksek talep
      "Ankraj":              0.90,  // küçük çap, doğrudan itme/dönme
      "Mini Kazık":          0.85,  // küçük çap, yüksek hız
    },
    varsayilan: 1.00,
    // Yerinden etme yöntemi uygunluk limitleri
    displacement_spt_uyari: 30,   // N > 30: şartlı
    displacement_spt_red:   40,   // N > 40: önerilmez
    ucs_red:                5.0,  // UCS > 5 MPa: kaya, yerinden etme uygulanamaz
  },

  // ── Yeraltı suyu katsayıları ─────────────────────────────────────────────
  // YAS altındaki kohezyonsuz zeminler gözenek basıncı artışı yaşar → daha yüksek tork.
  // Kaynak: EN 1536:2010 §5; muhafazakâr mühendislik yargısı. C Sınıfı.
  zeminSuyu: {
    tork_kohezyonlu:   1.05,  // küçük yumuşama etkisi
    tork_kohezyon_siz: 1.12,  // boru akışı riski, azaltılmış destek
    tork_kaya:         1.00,  // kaya için ihmal edilebilir

    rop_kohezyonlu:    0.92,  // hafif yavaşlama (yumuşama, süspansiyon)
    rop_kohezyon_siz:  0.85,  // önemli yavaşlama (göçme, moloz)
    rop_kaya:          0.95,  // minor (su yıkama yardımcı veya engelleyici olabilir)
  },

  // ── Derinlik katsayıları ─────────────────────────────────────────────────
  // Derinlik arttıkça helezoni yük ve Kelly bar bükülmesi artar.
  // Kaynak: Muhafazakâr mühendislik yargısı + FHWA GEC 10 §7. C Sınıfı.
  derinlik: {
    // Derinlik eşiği (m) → kümülatif çarpan
    esikler: { 40: 1.20, 30: 1.12, 20: 1.07, 12: 1.03, 0: 1.00 },
  },

  // ── ROP katsayıları ──────────────────────────────────────────────────────
  rop: {
    // Zemin tipine göre taban ROP (m/saat) Ø800 mm referans çapında
    // Kaynak: FHWA GEC 10 §7 + Türkiye saha kayıtları. C Sınıfı.
    baz: {
      "Dolgu":         10.0,
      "Kil":            8.0,
      "Silt":           9.0,
      "Kum":            7.0,
      "Çakıl":          4.5,
      "Ayrışmış Kaya": 10.0,
      "Kumtaşı":        7.0,
      "Kireçtaşı":      4.0,
      "Sert Kaya":      1.2,
      varsayilan:       5.0,
    },
    ucs_azaltma_katsayi:  0.75,  // UCS=100 MPa'da çarpan ≈ 0.25
    ucs_azaltma_min:      0.20,  // UCS azaltması için mutlak alt sınır
    referans_cap_m:       0.80,  // ROP tablosu için referans çap
    cap_azaltma_katsayi:  0.50,  // referans üzerinde her metre için
    cap_azaltma_min:      0.40,  // çap azaltması için alt sınır
    spt_azaltma_esigi:    30,    // SPT N > bu eşik → yoğunluk azaltması uygula
    spt_azaltma_katsayi:  0.012, // eşik üzerinde her darbe için
    min_rop:              0.20,  // mutlak alt sınır (çok sert kaya), m/saat
  },

  // ── Tam çevrim süresi katsayıları ────────────────────────────────────────
  // Kaynak: Zayed & Halpin (2005) §4 + Türkiye saha kalibrasyonu
  cevrim: {
    kurulum:            0.25,  // rig konumlandırma + kurulum, saat/kazık
    yeniden_konumlama:  0.20,  // bir sonraki kazık pozisyonuna geçiş
    alet_degisim:       0.50,  // zemin→kaya geçişinde bit/takım değişimi, saat
    casing_saat_m:      0.10,  // muhafaza borusu kurulumu, saat/m
    // Kelly bar derinlik ekleri (rod bağlantısı, uzatma süresi)
    derinlik_ek:        { 40: 0.50, 30: 0.30, 20: 0.10, 0: 0.00 },
    // Paralel/sıralı operasyonlar
    beton_saat_m:       0.040, // beton yerleştirme, saat/m (tremie)
    donati_saat_m:      0.025, // donatı kafesi indirme, saat/m
    bekleme_test:       0.10,  // betondan önce muayene beklemesi, saat
    beklenmedik_oran:   0.08,  // 8% acil durum payı
    gunluk_calisma:     9.0,   // günlük üretken çalışma saati
  },

  // ── Casing katsayıları ───────────────────────────────────────────────────
  // Kaynak: EN 1536:2010 §5
  casing: {
    kum_cakil_min_kalinlik: 0.50,  // m — kum/çakıl üstünde → zorunlu
    dolgu_sartli_kalinlik:  2.00,  // m — kalın dolgu → şartlı
    cok_gevsek_spt:         10,    // N < 10 kohezyonsuz → zorunlu
    yuksek_risk_oran:       1.00,  // yüksek riskli katmanın %100'ü
    orta_risk_oran:         0.50,  // orta riskli katmanın %50'si
  },

  // ── Stabilite katsayıları ────────────────────────────────────────────────
  stabilite: {
    puan:          { "Yüksek": 70, "Orta": 40, "Düşük": 15 },
    yuksek_esigi:  50,
    orta_esigi:    30,
    cok_gevsek_spt: 10,
    orta_spt:       30,
  },

  // ── Makine uygunluk bantları ─────────────────────────────────────────────
  // T_oran = T_makine / T_gerekli_peak
  // Kaynak: Muhafazakâr mühendislik yargısı + OEM uygulama notları. C Sınıfı.
  makine: {
    bantlar: {
      rahat_esigi:  1.30,  // T_oran >= 1.30 → RAHAT UYGUN
      uygun_esigi:  1.10,  // T_oran >= 1.10 → UYGUN
      sinirda_esigi: 0.85, // T_oran >= 0.85 → SINIRDA
      // T_oran < 0.85 → UYGUN DEĞİL
    },
    // Crowd force tahmini (T_kNm × katsayi / D_m → kN gerekli crowd force)
    crowd_force_katsayi: 2.5,
    // Yöntem uyumluluk (proje tipi → uyumlu makine tipleri)
    method_uyumluluk: {
      "Fore Kazık":          ["Fore Kazık"],
      "CFA Kazık":           ["Fore Kazık", "CFA Kazık"],
      "Yerinden Etme":       ["Fore Kazık", "CFA Kazık"],
      "Kısmi Yerinden Etme": ["Fore Kazık", "CFA Kazık"],
      "Ankraj":              ["Ankraj"],
      "Mini Kazık":          ["Ankraj", "Mini Kazık"],
    },
  },

  // ── Güven puanlama ───────────────────────────────────────────────────────
  guven: {
    cpt_puan:          35,  // CPT qc ölçümü
    su_olculmus_puan:  25,  // Su doğrudan ölçülmüş
    spt_puan:          20,  // SPT N60 ölçülmüş
    yas_bilinen_puan:  10,  // Yeraltı suyu seviyesi biliniyor
    ucs_olculmus_puan: 25,  // UCS doğrudan ölçülmüş (kaya)
    rqd_olculmus_puan: 10,  // RQD ölçülmüş (kaya)
    tam_kaplama_puan:  10,  // Zemin logu kazık boyunu tam kapsıyor
    yuksek_esigi:      65,  // HIGH güven eşiği
    orta_esigi:        35,  // MEDIUM güven eşiği
  },

  // ── Yakıt tahmini ────────────────────────────────────────────────────────
  mazot: {
    // Tork bantlı yakıt modeli (L/m). C Sınıfı — saha ölçer verisiyle kalibre edin.
    dilimler: [
      { tork_ust: 100,      baz: 8.0,  katsayi: 0.040 },
      { tork_ust: 200,      baz: 12.0, katsayi: 0.080 },
      { tork_ust: Infinity, baz: 20.0, katsayi: 0.075 },
    ],
  },

  // ── Kritik katman ağırlıklandırması ─────────────────────────────────────
  kritikKatman: {
    sinif_agirlik: { kaya: 3.0, granüler: 1.5, kohezyonlu: 1.0, belirsiz: 0.8 },
  },
}

// Geriye dönük uyumluluk takma adı: eski KATSAYILAR.sure → KATSAYILAR.cevrim
KATSAYILAR.sure = KATSAYILAR.cevrim

// ─── Zemin Sınıflandırması ────────────────────────────────────────────────────

const STANDART_TIPLER = [
  "Dolgu", "Kil", "Silt", "Kum", "Çakıl",
  "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya",
]

// Kaya bileşik adları — zemin anahtar kelimelerinden önce kontrol edilir
const KAYA_ANAHTAR = [
  { r: /sert\s*kaya|granit|bazalt|diyabaz|gnays|mermer|kuvarsit|riyolit|andezit|gabro/i, tip: "Sert Kaya" },
  { r: /kireçtaşı|kalker|kalkerli|fosilli\s*k|nümmülit|mikritik\s*k|biyoklastik|rudist/i, tip: "Kireçtaşı" },
  { r: /kumtaşı|grovak|arenit|çakıltaşı|konglomera|brekş/i, tip: "Kumtaşı" },
  { r: /ayrışmış\s*kaya|bozuşmuş\s*kaya/i, tip: "Ayrışmış Kaya" },
]
const ZEMIN_ANAHTAR = [
  { r: /dolgu|moloz|yapay/i, tip: "Dolgu" },
  { r: /çakıl/i, tip: "Çakıl" },
  { r: /kum/i,   tip: "Kum" },
  { r: /silt/i,  tip: "Silt" },
  { r: /kil/i,   tip: "Kil" },
]

/**
 * Herhangi bir serbest metin jeolojik tanımını standart 9 hesap tipinden birine eşler.
 * Türkçe sondaj logu pratiğinde baskın fraksiyon son kelime olduğundan
 * karışık adlarda son eşleşen kelime kazanır ("killi siltli kum" → "Kum").
 * @returns {string|null} Standart tip veya gerçekten bilinmiyorsa null
 */
export function zeminHesapTipi(zemTipi, kohezyon = null) {
  if (!zemTipi) return "Kum"
  const s = zemTipi.trim()
  if (STANDART_TIPLER.includes(s)) return s

  // Kaya bileşik adları önce kontrol edilir
  for (const { r, tip } of KAYA_ANAHTAR) {
    if (r.test(s)) return tip
  }

  // Zemin anahtar kelimeleri — son eşleşme baskın fraksiyondur
  let lastTip = null, lastIdx = -1
  for (const { r, tip } of ZEMIN_ANAHTAR) {
    const m = s.search(r)
    if (m !== -1 && m > lastIdx) { lastIdx = m; lastTip = tip }
  }
  if (lastTip) return lastTip

  // Yedek: yalnızca kohezyon sınıfı açıkça biliniyorsa
  if (kohezyon === "Kohezyonlu")  return "Kil"
  if (kohezyon === "Kaya")        return "Ayrışmış Kaya"
  if (kohezyon === "Kohezyonsuz") return "Kum"

  return null  // gerçekten bilinmiyor — çağrılar kendi varsayılanlarını kullanır
}

/**
 * Genel zemin sınıfını döndürür: "kohezyonlu" | "granüler" | "kaya" | "belirsiz"
 */
export function zeminSinifi(zemTipi, kohezyon = null) {
  const tip = zeminHesapTipi(zemTipi, kohezyon)
  if (!tip)                                                                    return "belirsiz"
  if (["Kil", "Silt"].includes(tip))                                           return "kohezyonlu"
  if (["Kum", "Çakıl", "Dolgu"].includes(tip))                                return "granüler"
  if (["Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(tip))  return "kaya"
  return "belirsiz"
}

/**
 * v3.0: Su ve CPT qc alanlarını da dikkate alır.
 * Geriye dönük uyumlu katman bazlı güvenilirlik sınıfı.
 */
export function guvenSinifi(row) {
  const su    = parseFloat(row.su    || 0)
  const cptQc = parseFloat(row.cptQc || row.cpt_qc || 0)
  const ucs   = parseFloat(row.ucs   || 0)
  const spt   = parseFloat(row.spt   || 0)
  const sinif = zeminSinifi(row.zemTipi || row.zem_tipi, row.kohezyon)

  if (sinif === "kaya" && ucs > 0)
    return { sinif: "B", aciklama: "UCS ölçümünden türetilmiş (Sınıf B)" }
  if (sinif !== "kaya" && su > 0)
    return { sinif: "A", aciklama: "Ölçülmüş su kullanıldı (Sınıf A)" }
  if (cptQc > 0)
    return { sinif: "B", aciklama: "CPT qc korelasyonundan türetilmiş (Sınıf B)" }
  if (ucs > 0)
    return { sinif: "B", aciklama: "UCS ölçümünden türetilmiş (Sınıf B)" }
  if (spt > 0)
    return { sinif: "B", aciklama: "SPT korelasyonundan türetilmiş (Sınıf B)" }
  return { sinif: "C", aciklama: "Yalnızca niteliksel zemin adı (Sınıf C)" }
}

// ─── Direnç İndeksi ───────────────────────────────────────────────────────────

/**
 * Tek zemin katmanı için efektif kayma direncini (τ_eff, kPa) hesaplar.
 *
 * Öncelikli direnç yolları (yüksek → düşük veri kalitesi):
 *   1. Kaya   → τ = UCS_eff × 1000 / 35 (FHWA GEC 10 §7.4)
 *   2. Koh. + Su ölçülmüş → τ = max(su, 20) kPa       [A Sınıfı]
 *   3. Koh. + CPT qc      → τ = max(qc×1000/Nkt, 20)  [B Sınıfı]
 *   4. Koh. + SPT N60     → τ = max(N60×4, 20) kPa    [B Sınıfı]
 *   5. Gran. + CPT qc     → τ = max(qc×100, 15) kPa   [B Sınıfı]
 *   6. Gran. + SPT N60    → τ = max(N60×2, 15) kPa    [C Sınıfı]
 *
 * @param {object} row - zemTipi, kohezyon, spt, ucs, rqd, cptQc (opt.), su (opt.)
 * @returns {{ tauKPa, source, confidence, rawValue, rawUnit, notes }}
 */
export function direncIndeksi(row) {
  const K = KATSAYILAR.tork
  const notes = []

  const zemTipi = row.zemTipi || row.zem_tipi || ""
  const kohezyon = row.kohezyon || ""
  const spt    = parseFloat(row.spt    || 0)
  const ucs    = parseFloat(row.ucs    || 0)
  const rqd    = parseFloat(row.rqd    || 0)
  const cptQc  = parseFloat(row.cptQc  || row.cpt_qc || 0)
  const su     = parseFloat(row.su     || 0)

  const sinif  = zeminSinifi(zemTipi, kohezyon)
  const hesapTip = zeminHesapTipi(zemTipi, kohezyon)

  // ── Yol 1: Kaya (UCS tabanlı) ────────────────────────────────────────────
  if (sinif === "kaya") {
    let ucsEff, source, confidence, rawValue, rawUnit
    if (ucs > 0) {
      ucsEff = ucs; source = "ucs"; confidence = "B"
      rawValue = ucs; rawUnit = "MPa"
      notes.push(
        `Ölçülmüş UCS=${ucs} MPa → τ=${(ucs*1000/K.kaya_ucs_tau_boleni).toFixed(1)} kPa ` +
        `(UCS×1000/${K.kaya_ucs_tau_boleni}, FHWA GEC 10 §7.4, Sınıf B)`
      )
    } else {
      ucsEff = K.kaya_ucs_varsayilan[hesapTip] || 10.0
      source = "ucs_varsayilan"; confidence = "C"
      rawValue = ucsEff; rawUnit = "MPa"
      notes.push(
        `UCS ölçümü yok; ${hesapTip} için varsayılan UCS=${ucsEff} MPa ` +
        `(FHWA GEC 10 Tablo 7.1, Sınıf C)`
      )
    }
    if (rqd > 0) notes.push(`RQD=${rqd}% — belirsizlik faktörü dahil edildi`)
    return {
      tauKPa: Math.round(ucsEff * 1000 / K.kaya_ucs_tau_boleni * 100) / 100,
      source, confidence, rawValue, rawUnit, notes,
    }
  }

  // ── Yol 2: Kohezyonlu + Su ölçülmüş ──────────────────────────────────────
  if (sinif === "kohezyonlu" && su > 0) {
    const tauKPa = Math.max(su, K.cpt_su_min)
    notes.push(
      `Ölçülmüş su=${su} kPa. τ = max(su, ${K.cpt_su_min}) = ${tauKPa} kPa. A Sınıfı.`
    )
    return { tauKPa, source: "su", confidence: "A", rawValue: su, rawUnit: "kPa", notes }
  }

  // ── Yol 3: Kohezyonlu + CPT qc ───────────────────────────────────────────
  if (sinif === "kohezyonlu" && cptQc > 0) {
    const tauKPa = Math.max(cptQc * 1000 / K.cpt_nkt, K.cpt_su_min)
    notes.push(
      `CPT qc=${cptQc} MPa → su≈${(cptQc*1000/K.cpt_nkt).toFixed(1)} kPa ` +
      `(qc×1000/Nkt=${K.cpt_nkt}, Robertson & Campanella 1983). τ=${tauKPa} kPa. B Sınıfı.`
    )
    return { tauKPa, source: "cpt_kohezif", confidence: "B", rawValue: cptQc, rawUnit: "MPa", notes }
  }

  // ── Yol 4: Kohezyonlu + SPT ──────────────────────────────────────────────
  if (sinif === "kohezyonlu" && spt > 0) {
    const tauKPa = Math.max(spt * K.kohezyon_spt, K.kohezyon_su_min)
    notes.push(
      `SPT N60=${spt} → su≈${(spt*K.kohezyon_spt).toFixed(1)} kPa ` +
      `(N×${K.kohezyon_spt}, FHWA GEC 5 Tablo 3-1). τ=${tauKPa} kPa. B Sınıfı.`
    )
    return { tauKPa, source: "spt_kohezif", confidence: "B", rawValue: spt, rawUnit: "darbe", notes }
  }

  // ── Yol 5: Kohezyonsuz + CPT qc ──────────────────────────────────────────
  if (sinif === "granüler" && cptQc > 0) {
    const tauKPa = Math.max(cptQc * K.tork.cpt_kqc_kohezyon_siz, K.kohezyon_siz_tau_min)
    notes.push(
      `CPT qc=${cptQc} MPa → τ≈${(cptQc*K.tork.cpt_kqc_kohezyon_siz).toFixed(1)} kPa ` +
      `(qc×${K.tork.cpt_kqc_kohezyon_siz}, FHWA GEC 5). τ=${tauKPa} kPa. B Sınıfı.`
    )
    return { tauKPa, source: "cpt_granüler", confidence: "B", rawValue: cptQc, rawUnit: "MPa", notes }
  }

  // ── Yol 6: Kohezyonsuz + SPT ─────────────────────────────────────────────
  if (sinif === "granüler" && spt > 0) {
    const tauKPa = Math.max(spt * K.kohezyon_siz_spt, K.kohezyon_siz_tau_min)
    notes.push(
      `SPT N60=${spt} → τ≈${(spt*K.kohezyon_siz_spt).toFixed(1)} kPa ` +
      `(N×${K.kohezyon_siz_spt}, granüler proxy, Sınıf C). τ=${tauKPa} kPa. C Sınıfı.`
    )
    return { tauKPa, source: "spt_granüler", confidence: "C", rawValue: spt, rawUnit: "darbe", notes }
  }

  // ── Yedek: ölçülebilir veri yok ──────────────────────────────────────────
  const tauKPa = sinif === "kohezyonlu" ? K.kohezyon_su_min : K.kohezyon_siz_tau_min
  notes.push(
    `Ölçüm yok; ${sinif} zemin tabanı τ=${tauKPa} kPa kullanıldı. Sınıf C — veri yetersiz.`
  )
  return { tauKPa, source: "belirsiz", confidence: "C", rawValue: 0, rawUnit: "—", notes }
}

// ─── Yardımcı Katsayı Fonksiyonları ─────────────────────────────────────────

/** Yöntem çarpanı K_method */
function yontemKatsayisi(isTipi) {
  return KATSAYILAR.yontem.carpan[isTipi] ?? KATSAYILAR.yontem.varsayilan
}

/** Yeraltı suyu tork düzeltme faktörü K_gw */
function zeminSuyuKatsayisi(sinif, baslangic, yas) {
  const GW = KATSAYILAR.zeminSuyu
  if (!yas || yas <= 0 || baslangic < yas) return 1.00
  if (sinif === "kaya")       return GW.tork_kaya
  if (sinif === "kohezyonlu") return GW.tork_kohezyonlu
  return GW.tork_kohezyon_siz
}

/** Derinlik faktörü K_depth */
function derinlikKatsayisi(bitis) {
  const esikler = KATSAYILAR.derinlik.esikler
  const sortedKeys = Object.keys(esikler).map(Number).sort((a, b) => b - a)
  for (const esik of sortedKeys) {
    if (bitis >= esik) return esikler[esik]
  }
  return 1.00
}

// ─── Stabilite Riski ──────────────────────────────────────────────────────────

/**
 * Katman bazlı stabilite riski.
 * Kaynak: EN 1536:2010 §5, FHWA GEC 10 §4
 */
export function stabiliteRiski(tip, kohezyon, spt, yas, baslangic = 0) {
  const C = KATSAYILAR.stabilite
  const hesapTip = zeminHesapTipi(tip, kohezyon)
  if (["Kum", "Çakıl"].includes(hesapTip))
    return (yas > 0 && baslangic >= yas) ? "Yüksek" : "Orta"
  if (kohezyon === "Kohezyonsuz" && spt <= C.cok_gevsek_spt) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= C.orta_spt)       return "Orta"
  if (hesapTip === "Dolgu")                                   return "Orta"
  return "Düşük"
}

// ─── Casing Kararı ────────────────────────────────────────────────────────────

/**
 * Muhafaza borusu gerekliliği.
 * Kaynak: EN 1536:2010 §5, FHWA GEC 10 §7.3
 */
export function casingDurum(zemin, yas) {
  const C = KATSAYILAR.casing
  const gerekce = []
  let zorunlu = false, sartli = false

  for (const row of zemin) {
    const spt      = parseFloat(row.spt || 0)
    const k        = (row.bitis || 0) - (row.baslangic || 0)
    const hesapTip = zeminHesapTipi(row.zemTipi, row.kohezyon)
    const bas      = row.baslangic || 0

    if (["Kum", "Çakıl"].includes(hesapTip) && k > C.kum_cakil_min_kalinlik) {
      zorunlu = true
      gerekce.push(`${row.zemTipi} (${bas}–${row.bitis} m, ${k} m) — EN 1536 §5 gereği`)
    }
    if (row.kohezyon === "Kohezyonsuz" && yas > 0 && bas >= yas) {
      zorunlu = true
      gerekce.push(`Kohezyonsuz (${bas}–${row.bitis} m) YAS (${yas} m) altında`)
    }
    if (spt < C.cok_gevsek_spt && row.kohezyon === "Kohezyonsuz") {
      zorunlu = true
      gerekce.push(`SPT=${spt}<${C.cok_gevsek_spt} (${bas}–${row.bitis} m) — çok gevşek`)
    }
    if (hesapTip === "Dolgu" && k > C.dolgu_sartli_kalinlik) {
      sartli = true
      gerekce.push(`Dolgu (${bas}–${row.bitis} m, ${k} m) — kalın dolgu, önerilir`)
    }
  }

  const durum = zorunlu ? "Gerekli" : sartli ? "Şartlı önerilir" : "Gerekmeyebilir"
  return { durum, gerekce, zorunlu }
}

export function casingMetreHesapla(zemin, yas) {
  const C = KATSAYILAR.casing
  let toplam = 0
  for (const row of zemin) {
    const k    = (row.bitis || 0) - (row.baslangic || 0)
    const risk = stabiliteRiski(row.zemTipi, row.kohezyon, row.spt, yas, row.baslangic)
    if      (risk === "Yüksek") toplam += k * C.yuksek_risk_oran
    else if (risk === "Orta")   toplam += k * C.orta_risk_oran
  }
  return Math.round(toplam * 10) / 10
}

// ─── Penetrasyon Hızı (ROP) ───────────────────────────────────────────────────

/**
 * Tahmini penetrasyon hızı (m/saat).
 * v3.0 eklemeleri: SPT bazlı yoğun granüler azaltma, YAS ROP düzeltmesi.
 * Kaynak: FHWA GEC 10 §7; Zayed & Halpin (2005); Türkiye saha verisi. C Sınıfı.
 *
 * @param {string} tip - Zemin tipi etiketi
 * @param {number} ucs - UCS (MPa), kaya değilse veya ölçülmemişse 0
 * @param {number} capMm - Kazık çapı (mm)
 * @param {string} kohezyon - Kohezyon sınıfı
 * @param {number} spt - SPT N60
 * @param {number} yas - Yeraltı suyu derinliği (m), 0 = veri yok
 * @param {number} baslangic - Katman başlangıç derinliği (m)
 */
export function ropHesapla(tip, ucs, capMm, kohezyon = null, spt = 0, yas = 0, baslangic = 0) {
  const R       = KATSAYILAR.rop
  const capM    = capMm / 1000
  const hesapTip = zeminHesapTipi(tip, kohezyon)
  let baz       = (hesapTip && R.baz[hesapTip] !== undefined) ? R.baz[hesapTip] : R.baz.varsayilan

  // UCS azaltması kaya için
  if (ucs > 0)
    baz *= Math.max(R.ucs_azaltma_min, 1 - (ucs / 100) * R.ucs_azaltma_katsayi)

  // Çap cezası
  baz *= Math.max(R.cap_azaltma_min, 1 - (capM - R.referans_cap_m) * R.cap_azaltma_katsayi)

  // SPT bazlı yoğun granüler azaltma
  const sinif = zeminSinifi(tip, kohezyon)
  if (sinif === "granüler" && spt > R.spt_azaltma_esigi) {
    const sptFaktor = Math.max(0.30, 1 - (spt - R.spt_azaltma_esigi) * R.spt_azaltma_katsayi)
    baz *= sptFaktor
  }

  // YAS ROP düzeltmesi
  const GW = KATSAYILAR.zeminSuyu
  if (yas > 0 && baslangic >= yas) {
    if      (sinif === "kohezyonlu") baz *= GW.rop_kohezyonlu
    else if (sinif === "granüler")   baz *= GW.rop_kohezyon_siz
    else if (sinif === "kaya")       baz *= GW.rop_kaya
  }

  return Math.max(baz, R.min_rop)
}

// ─── Gerekli Tork — Aralık Çıktısı ──────────────────────────────────────────

/**
 * Kelly/rotary fore kazık delgisi için gerekli tork aralığı.
 *
 * v3.0 formülü:
 *   T = τ_eff × (π × D³ / 8) × K_app × K_method × K_gw × K_depth × K_uncertainty
 *
 * @param {Array} zemin - Zemin katmanı dizisi
 * @param {number} capMm - Kazık çapı (mm)
 * @param {string} isTipi - Proje iş tipi (K_method etkiler)
 * @param {number} yas - Yeraltı suyu derinliği (m), varsayılan 0
 * @returns {{ nominal, min, max, guven, aciklama, uyarilar, katmanDetaylari }}
 */
export function gerekliTorkAralik(zemin, capMm, isTipi = "Fore Kazık", yas = 0) {
  const capM = capMm / 1000
  const K    = KATSAYILAR.tork
  const aciklama = []
  const uyarilar = []
  const katmanDetaylari = []
  let maxNominal = 0
  const guvenSiniflari = []

  const kMethod = yontemKatsayisi(isTipi)
  if (!KATSAYILAR.yontem.carpan[isTipi])
    uyarilar.push(`UYARI: '${isTipi}' için tork çarpanı tanımlı değil; Fore Kazık (1.00) varsayıldı.`)
  if (isTipi === "Ankraj" || isTipi === "Mini Kazık")
    uyarilar.push(`UYARI: '${isTipi}' için bu tork modeli yaklaşıktır — ankraj/mini kazık sistemleri farklı direnç mekanizmaları kullanır.`)

  if (!zemin || zemin.length === 0)
    return { nominal: 0, min: 0, max: 0, guven: "C", aciklama: ["Zemin verisi yok"], uyarilar, katmanDetaylari: [] }

  for (const row of zemin) {
    const baslangic = parseFloat(row.baslangic || 0)
    const bitis     = parseFloat(row.bitis     || 0)
    const ucs       = parseFloat(row.ucs       || 0)
    const rqd       = parseFloat(row.rqd       || 0)
    const sinif     = zeminSinifi(row.zemTipi, row.kohezyon)

    const gs = guvenSinifi(row)
    guvenSiniflari.push(gs.sinif)

    // Direnç yolu önceliği
    const direnc  = direncIndeksi(row)
    const tauEff  = direnc.tauKPa

    // K katsayıları
    const kGw    = zeminSuyuKatsayisi(sinif, baslangic, yas)
    const kDepth = derinlikKatsayisi(bitis)

    // K_uncertainty: kaya katmanlar için RQD belirsizlik faktörü
    let rqdFaktor = 1.0
    if (sinif === "kaya") {
      const testRqd = (rqd > 0 || ucs > 0) ? rqd : -1
      for (const e of [75, 50, 25, 0]) {
        if (testRqd >= e) { rqdFaktor = K.rqd_faktor[e]; break }
      }
    }

    // Tam tork formülü
    const tNominal = (
      tauEff
      * (Math.PI * Math.pow(capM, 3) / 8)
      * K.uygulama_faktoru
      * kMethod
      * kGw
      * kDepth
      * rqdFaktor
    )

    // Katman detay kaydı
    const katmanKayit = {
      baslangic, bitis,
      zemTipi:    row.zemTipi,
      sinif,
      tauEffKPa:  tauEff,
      source:     direnc.source,
      confidence: direnc.confidence,
      kMethod,
      kGw,
      kDepth,
      kRqd:       rqdFaktor,
      tKatmanKNm: Math.round(tNominal * 10) / 10,
      notes:      direnc.notes,
    }
    katmanDetaylari.push(katmanKayit)

    if (tNominal > maxNominal) {
      maxNominal = tNominal
      aciklama.length = 0
      aciklama.push(
        `Belirleyici katman: ${row.zemTipi} (${baslangic}–${bitis} m)`,
        `τ_eff=${tauEff} kPa [kaynak: ${direnc.source}, Sınıf ${direnc.confidence}]`,
        `K_method=${kMethod}, K_gw=${kGw}, K_depth=${kDepth}, K_rqd=${rqdFaktor}`,
        `T_nom = ${Math.round(tNominal * 10) / 10} kNm`,
      )
    }
  }

  const nominal = Math.round(maxNominal * 10) / 10
  const guven   = guvenSiniflari.includes("C") ? "C" : guvenSiniflari.includes("B") ? "B" : "A"

  return {
    nominal,
    min: Math.round(nominal * K.alt_bant * 10) / 10,
    max: Math.round(nominal * K.ust_bant * 10) / 10,
    guven, aciklama, uyarilar, katmanDetaylari,
  }
}

/** Geriye dönük uyumlu tek değer sarmalayıcı */
export function gerekliTork(zemin, capMm) {
  return gerekliTorkAralik(zemin, capMm).nominal
}

// ─── Kritik Katman ────────────────────────────────────────────────────────────

/**
 * Jeoteknik olarak en kritik (karmaşık) katmanı bulur.
 * Skor = τ_eff × sınıf_ağırlığı × katman_kalınlığı
 */
export function kritikKatman(zemin) {
  if (!zemin.length) return null
  const W = KATSAYILAR.kritikKatman.sinif_agirlik
  let maxSkor = -1, kritik = null

  for (const row of zemin) {
    const sinif  = zeminSinifi(row.zemTipi, row.kohezyon)
    const direnc = direncIndeksi(row)
    const w      = W[sinif] ?? 0.8
    const kalinlik = Math.max((row.bitis || 0) - (row.baslangic || 0), 0.5)
    const skor   = direnc.tauKPa * w * kalinlik

    if (skor > maxSkor) {
      maxSkor = skor
      kritik = { ...row, sinif, kritikSkor: Math.round(skor * 100) / 100 }
    }
  }
  return kritik
}

// ─── Tam Çevrim Süresi ───────────────────────────────────────────────────────

/**
 * Kazık başına tam çevrim süresi hesabı.
 *
 * Bileşenler:
 *   t_cevrim = t_delme + t_beton + t_donati + t_casing + t_kurulum +
 *              t_rekonumlama + t_beklenmedik
 *
 * @param {Array} zemin - Zemin katmanı dizisi
 * @param {number} capMm - Kazık çapı (mm)
 * @param {number} kazikBoyu - Kazık boyu (m)
 * @param {number} casingM - Gerekli casing uzunluğu (m)
 * @param {string} isTipi - İş tipi
 * @returns {{ tDelme, tBeton, tDonati, tCasingOps, tKurulum, tRekonumlama,
 *             tBeklenmedik, tToplamCevrim, kazikBasiGun, gunlukUretimAdet }}
 */
export function tamCevrimSuresi(zemin, capMm, kazikBoyu, casingM, isTipi = "Fore Kazık") {
  const CV = KATSAYILAR.cevrim
  const KAYA_TIPLERI = ["Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya"]

  // ── Delme süresi ──────────────────────────────────────────────────────────
  let tDelme = 0
  let ucDeg  = 0
  let oncekiTip = null

  for (const row of zemin) {
    const k       = (row.bitis || 0) - (row.baslangic || 0)
    const hesapTip = zeminHesapTipi(row.zemTipi, row.kohezyon)
    const rop     = ropHesapla(
      row.zemTipi, row.ucs || 0, capMm, row.kohezyon,
      row.spt || 0, 0, row.baslangic || 0
    )
    tDelme += k / rop

    if (KAYA_TIPLERI.includes(hesapTip) && oncekiTip !== null && !KAYA_TIPLERI.includes(oncekiTip))
      ucDeg++
    oncekiTip = hesapTip
  }

  tDelme += ucDeg * CV.alet_degisim

  // Derinlik eki (rod bağlantısı süresi)
  const ekSure = kazikBoyu >= 40 ? CV.derinlik_ek[40]
               : kazikBoyu >= 30 ? CV.derinlik_ek[30]
               : kazikBoyu >= 20 ? CV.derinlik_ek[20]
               : CV.derinlik_ek[0]
  tDelme += ekSure

  // ── Paralel / sıralı operasyonlar ────────────────────────────────────────
  const tBeton      = kazikBoyu * CV.beton_saat_m       // beton yerleştirme
  const tDonati     = kazikBoyu * CV.donati_saat_m      // donatı kafesi
  const tCasingOps  = (casingM || 0) * CV.casing_saat_m // muhafaza borusu

  // ── Lojistik ─────────────────────────────────────────────────────────────
  const tKurulum      = CV.kurulum
  const tRekonumlama  = CV.yeniden_konumlama

  // ── Acil durum payı ──────────────────────────────────────────────────────
  const tBeklenmedik = (tDelme + tBeton + tDonati) * CV.beklenmedik_oran

  // ── Toplam çevrim ────────────────────────────────────────────────────────
  const tToplamCevrim = (
    tDelme + tBeton + tDonati + tCasingOps
    + tKurulum + tRekonumlama + tBeklenmedik
  )

  // ── Üretkenlik ───────────────────────────────────────────────────────────
  const gunlukUretimAdet = tToplamCevrim > 0
    ? Math.floor(CV.gunluk_calisma / tToplamCevrim)
    : 0
  const kazikBasiGun = Math.round(tToplamCevrim / CV.gunluk_calisma * 10) / 10

  return {
    tDelme:           Math.round(tDelme * 10) / 10,
    tBeton:           Math.round(tBeton * 10) / 10,
    tDonati:          Math.round(tDonati * 10) / 10,
    tCasingOps:       Math.round(tCasingOps * 10) / 10,
    tKurulum:         Math.round(tKurulum * 10) / 10,
    tRekonumlama:     Math.round(tRekonumlama * 10) / 10,
    tBeklenmedik:     Math.round(tBeklenmedik * 10) / 10,
    tToplamCevrim:    Math.round(tToplamCevrim * 10) / 10,
    kazikBasiGun,
    gunlukUretimAdet,
  }
}

/**
 * Geriye dönük uyumlu: yalnızca delme süresini döndürür.
 * Beton, donatı ve lojistik dahil tam çevrim için tamCevrimSuresi() kullanın.
 */
export function kazikSuresi(zemin, capMm, kazikBoyu, casingM) {
  const cs = tamCevrimSuresi(zemin, capMm, kazikBoyu, casingM)
  return Math.round((cs.tDelme + cs.tCasingOps) * 10) / 10
}

// ─── Yakıt Tahmini ────────────────────────────────────────────────────────────

/** Yakıt tüketim tahmini. C Sınıfı — saha ölçer verisiyle kalibre edin. */
export function mazotTahmini(tork, kazikBoyu) {
  const d = KATSAYILAR.mazot.dilimler
  let mBasi
  if      (tork < 100) mBasi = d[0].baz + tork          * d[0].katsayi
  else if (tork < 200) mBasi = d[1].baz + (tork - 100)  * d[1].katsayi
  else                 mBasi = d[2].baz + (tork - 200)  * d[2].katsayi
  mBasi = Math.round(mBasi * 10) / 10
  return { mBasi, toplam: Math.round(mBasi * kazikBoyu * 10) / 10 }
}

// ─── Güven Analizi ───────────────────────────────────────────────────────────

/**
 * Tam proje analizi için veri güveni puanı ve seviyesini hesaplar.
 *
 * Puan aralığı: 0–100 (toplamlı; 100 ile sınırlandırılmış).
 * Seviyeler: HIGH (≥ 65), MEDIUM (35–64), LOW (< 35).
 *
 * @param {Array} zemin - Zemin katmanı dizisi
 * @param {number} yas - Yeraltı suyu derinliği (m). >0 bilindiğini gösterir.
 * @param {number} kazikBoyu - Kazık tasarım boyu (m)
 * @returns {{ puan, seviye, sebepler, eksikVeriler }}
 */
export function guvenAnalizi(zemin, yas, kazikBoyu) {
  const GV = KATSAYILAR.guven
  let puan = 0
  const sebepler = []
  const eksikVeriler = []

  if (!zemin || zemin.length === 0) {
    return {
      puan: 0, seviye: "LOW",
      sebepler:    ["Zemin katmanı verisi yok"],
      eksikVeriler: ["Zemin logu", "SPT/CPT", "Yüzey bilgisi"],
    }
  }

  let hasCpt = false, hasSu = false, hasSpt = false
  let hasUcs = false, hasRqd = false
  const yasKnown = yas > 0

  for (const row of zemin) {
    if (parseFloat(row.cptQc || row.cpt_qc || 0) > 0) hasCpt = true
    if (parseFloat(row.su  || 0) > 0) hasSu  = true
    if (parseFloat(row.spt || 0) > 0) hasSpt  = true
    if (parseFloat(row.ucs || 0) > 0) hasUcs  = true
    if (parseFloat(row.rqd || 0) > 0) hasRqd  = true
  }

  if (hasCpt) {
    puan += GV.cpt_puan
    sebepler.push(`CPT qc ölçümü mevcut (+${GV.cpt_puan} puan)`)
  } else { eksikVeriler.push("CPT qc profili") }

  if (hasSu) {
    puan += GV.su_olculmus_puan
    sebepler.push(`Ölçülmüş su (laboratuvar/arazi) mevcut (+${GV.su_olculmus_puan} puan)`)
  } else { eksikVeriler.push("Ölçülmüş drenajsız kayma dayanımı (su)") }

  if (hasSpt) {
    puan += GV.spt_puan
    sebepler.push(`SPT N değerleri mevcut (+${GV.spt_puan} puan)`)
  } else { eksikVeriler.push("SPT değerleri") }

  if (yasKnown) {
    puan += GV.yas_bilinen_puan
    sebepler.push(`Yeraltı suyu seviyesi bilinmekte (+${GV.yas_bilinen_puan} puan)`)
  } else { eksikVeriler.push("Yeraltı suyu seviyesi") }

  if (hasUcs) {
    puan += GV.ucs_olculmus_puan
    sebepler.push(`UCS ölçümü mevcut (+${GV.ucs_olculmus_puan} puan)`)
  } else { eksikVeriler.push("UCS (tek eksenli basınç dayanımı)") }

  if (hasRqd) {
    puan += GV.rqd_olculmus_puan
    sebepler.push(`RQD değerleri mevcut (+${GV.rqd_olculmus_puan} puan)`)
  } else { eksikVeriler.push("RQD (kaya kalite göstergesi)") }

  if (zemin.length > 0) {
    const maxBitis = Math.max(...zemin.map(r => r.bitis || 0))
    if (maxBitis >= kazikBoyu) {
      puan += GV.tam_kaplama_puan
      sebepler.push(`Zemin logu kazık boyunu tam kapsamakta (+${GV.tam_kaplama_puan} puan)`)
    } else {
      eksikVeriler.push(`Zemin logu kazık boyunu kapsamıyor (log=${maxBitis} m < kazık=${kazikBoyu} m)`)
    }
  }

  puan = Math.min(puan, 100)
  const seviye = puan >= GV.yuksek_esigi ? "HIGH" : puan >= GV.orta_esigi ? "MEDIUM" : "LOW"

  return { puan, seviye, sebepler, eksikVeriler }
}

// ─── Makine Uygunluğu — Dört Bantlı Karar ────────────────────────────────────

/**
 * Ekipman uygunluk değerlendirmesi — dört bantlı karar sistemi.
 *
 * Bantlar (T_oran = makine.tork / T_gerekli_peak):
 *   RAHAT UYGUN : T_oran >= 1.30
 *   UYGUN       : 1.10 <= T_oran < 1.30
 *   SINIRDA     : 0.85 <= T_oran < 1.10
 *   UYGUN DEĞİL : T_oran < 0.85
 *
 * @param {object} makine - Makine kaydı (ad, tip, tork, maxDerinlik, maxCap, casing, crowdForce)
 * @param {number} tork - Gerekli tork (kNm) — peak değer
 * @param {number} kazikBoyu - Kazık derinliği (m)
 * @param {number} kazikCapi - Kazık çapı (mm)
 * @param {boolean} casingGerekli - Muhafaza borusu zorunlu mu
 * @param {string} isTipi - Proje iş tipi
 * @param {Array|null} zemin - Zemin katmanları (yerinden etme kontrolü için)
 * @param {number} yas - Yeraltı suyu derinliği (m)
 * @returns {{ karar, kararBant, gerekce, redSebepler, uyarilar, torkOran,
 *             crowdForceOk, displacementOk, uretkenlikNotu }}
 */
export function makinaUygunluk(
  makine, tork, kazikBoyu, kazikCapi,
  casingGerekli, isTipi = "Fore Kazık",
  zemin = null, yas = 0
) {
  const M = KATSAYILAR.makine
  const B = M.bantlar
  const Y = KATSAYILAR.yontem
  const red = []
  const uyarilar = []
  let crowdForceOk   = true
  let displacementOk = true

  const makineAd       = makine.ad           || "Makine"
  const makineTip      = makine.tip          || ""
  const makineTork     = parseFloat(makine.tork        || 0)
  const makineMaxD     = parseFloat(makine.maxDerinlik || makine.max_derinlik || 0)
  const makineMaxCap   = parseFloat(makine.maxCap      || makine.max_cap      || 0)
  const makineCasing   = makine.casing       || "Hayır"
  const makineCrowd    = parseFloat(makine.crowdForce  || makine.crowd_force  || 0)

  // ── 1. Yöntem uyumluluğu ─────────────────────────────────────────────────
  const desteklenenler = M.method_uyumluluk[isTipi] || [isTipi]
  if (!desteklenenler.includes(makineTip)) {
    return {
      karar:           "Uygun Değil",
      kararBant:       "UYGUN DEĞİL",
      gerekce:         `Method uyumsuz: proje '${isTipi}' — makine '${makineTip}'`,
      redSebepler:     [`Method uyumsuzluğu: ${makineTip} ≠ ${isTipi}`],
      uyarilar:        [],
      torkOran:        0,
      crowdForceOk:    true,
      displacementOk:  false,
      uretkenlikNotu:  "Method uyumsuzluğu nedeniyle üretkenlik değerlendirilemedi.",
    }
  }

  // ── 2. Fiziksel geometri kontrolleri ──────────────────────────────────────
  if (makineMaxD > 0 && makineMaxD < kazikBoyu)
    red.push(`Derinlik yetersiz: ${makineMaxD} m < ${kazikBoyu} m`)
  if (makineMaxCap > 0 && makineMaxCap < kazikCapi)
    red.push(`Çap yetersiz: ${makineMaxCap} mm < ${kazikCapi} mm`)

  // ── 3. Tork oranı ─────────────────────────────────────────────────────────
  const torkOran = tork > 0 ? makineTork / tork : 999
  if (torkOran < B.sinirda_esigi)
    red.push(
      `Tork yetersiz: ${makineTork} kNm < gerekli minimum ` +
      `${Math.round(tork * B.sinirda_esigi)} kNm ` +
      `(oran=${Math.round(torkOran * 100)}%, eşik=%${Math.round(B.sinirda_esigi * 100)})`
    )

  if (red.length > 0)
    return {
      karar: "Uygun Değil", kararBant: "UYGUN DEĞİL",
      gerekce: red[0], redSebepler: red, uyarilar: [],
      torkOran: Math.round(torkOran * 1000) / 1000,
      crowdForceOk: true, displacementOk: true,
      uretkenlikNotu: "Temel kriter başarısız; üretkenlik değerlendirilemedi.",
    }

  // ── 4. Casing kontrolü ───────────────────────────────────────────────────
  if (casingGerekli && makineCasing === "Hayır") {
    return {
      karar: "Uygun Değil", kararBant: "UYGUN DEĞİL",
      gerekce: "Casing kapasitesi yok; yardımcı ekipman gerektirir",
      redSebepler: ["Casing gerekli ancak makine casing donanımına sahip değil"],
      uyarilar: ["Casing gerektirir — uygun ekipman temin edin"],
      torkOran: Math.round(torkOran * 1000) / 1000,
      crowdForceOk: true, displacementOk: true,
      uretkenlikNotu: "Casing eksikliği giderilirse yeniden değerlendirin.",
    }
  }
  if (casingGerekli && makineCasing === "Şartlı")
    uyarilar.push("Casing kapasitesi şartlı — konfigürasyonu doğrulayın")

  // ── 5. Yerinden etme yöntemi zemin kontrolü ──────────────────────────────
  const displacementMethods = new Set(["Yerinden Etme", "Kısmi Yerinden Etme"])
  if (displacementMethods.has(isTipi) && zemin) {
    for (const row of zemin) {
      const sptRow = parseFloat(row.spt || 0)
      const ucsRow = parseFloat(row.ucs || 0)
      if (sptRow > Y.displacement_spt_red) {
        displacementOk = false
        uyarilar.push(
          `YERİNDEN ETME REDDİ: ${row.zemTipi} ` +
          `(${row.baslangic}–${row.bitis} m) SPT=${sptRow} > ${Y.displacement_spt_red} (FHWA GEC 8)`
        )
      } else if (sptRow > Y.displacement_spt_uyari) {
        uyarilar.push(
          `Yerinden etme uyarısı: SPT=${sptRow} > ${Y.displacement_spt_uyari} ` +
          `(${row.zemTipi} ${row.baslangic}–${row.bitis} m)`
        )
      }
      if (ucsRow > Y.ucs_red) {
        displacementOk = false
        uyarilar.push(
          `Yerinden etme metodu kaya formasyonda uygulanamaz: UCS=${ucsRow} MPa > ${Y.ucs_red} MPa ` +
          `(${row.zemTipi} ${row.baslangic}–${row.bitis} m)`
        )
      }
    }
  }

  // ── 6. Crowd force kontrolü ──────────────────────────────────────────────
  if (makineCrowd > 0 && tork > 0 && kazikCapi > 0) {
    const capM = kazikCapi / 1000
    const gerekli = tork * M.crowd_force_katsayi / capM
    if (makineCrowd < gerekli) {
      crowdForceOk = false
      uyarilar.push(
        `Crowd force düşük: ${makineCrowd} kN < tahmini gerekli ${Math.round(gerekli)} kN ` +
        `(T×${M.crowd_force_katsayi}/D, Sınıf C)`
      )
    }
  }

  // ── 7. Dört bantlı karar ─────────────────────────────────────────────────
  let karar, kararBant, gerekce, uretkenlikNotu

  if (torkOran >= B.rahat_esigi) {
    karar = "Rahat Uygun"; kararBant = "RAHAT UYGUN"
    gerekce = `Rahat uygun — tork marjı +%${Math.round((torkOran - 1) * 100)}. Derinlik: ${makineMaxD} m, Çap: ${makineMaxCap} mm.`
    uretkenlikNotu = "Tork rezervi yeterli, optimum üretkenlik beklenir."
  } else if (torkOran >= B.uygun_esigi) {
    karar = "Uygun"; kararBant = "UYGUN"
    gerekce = `Uygun — tork oranı %${Math.round(torkOran * 100)}. Yeterli operasyonel marj.`
    uretkenlikNotu = "Normal operasyonel marjda çalışma. Beklenmedik sertleşmelerde tork izlenmelidir."
  } else if (torkOran >= B.sinirda_esigi) {
    karar = "Şartlı Uygun"; kararBant = "SINIRDA"
    gerekce = `Sınırda — tork oranı %${Math.round(torkOran * 100)}. Dikkatli izleme gereklidir.`
    uyarilar.push(`Sınır koşullarda çalışma: tork %${Math.round(torkOran * 100)} kapasitede.`)
    uretkenlikNotu = "Marjinal tork üretkenliği düşürür. Rotasyon hızını kısıtlayın; sürekli izleme önerilebilir."
  } else {
    karar = "Uygun Değil"; kararBant = "UYGUN DEĞİL"
    gerekce = `Tork yetersiz: oran %${Math.round(torkOran * 100)}`
    uretkenlikNotu = "Yetersiz kapasite — üretkenlik değerlendirilemedi."
  }

  // Yerinden etme uygulanamıyorsa karar'ı düşür
  if (!displacementOk && displacementMethods.has(isTipi)) {
    karar = "Uygun Değil"; kararBant = "UYGUN DEĞİL"
    gerekce = "Yerinden etme metodu mevcut zemin/kaya koşullarında uygulanamaz."
    uretkenlikNotu = "Yerinden etme yöntemi reddedildi — metodu değiştirin."
  }

  return {
    karar, kararBant, gerekce,
    redSebepler: red, uyarilar,
    torkOran: Math.round(torkOran * 1000) / 1000,
    crowdForceOk, displacementOk, uretkenlikNotu,
  }
}

// ─── Türkçe Açıklama Motoru ──────────────────────────────────────────────────

/**
 * Makine uygunluk kararı için 2-3 cümlelik profesyonel Türkçe geoteknik
 * değerlendirme metni üretir.
 *
 * @param {string} makineAd - Makine adı/tanımlayıcı
 * @param {string} karar - makinaUygunluk() kararı
 * @param {number} torkOran - T_makine / T_gerekli oranı
 * @param {object|null} kritikKatmanRow - kritikKatman() sonucu
 * @param {object} guven - guvenAnalizi() sonucu
 * @param {string} isTipi - Proje iş tipi
 * @param {Array|null} zemin - Zemin katmanları
 * @param {number} yas - Yeraltı suyu derinliği (m)
 * @returns {string} Profesyonel değerlendirme metni
 */
export function aciklamaUret(makineAd, karar, torkOran, kritikKatmanRow, guven, isTipi, zemin = null, yas = 0) {
  const oranStr = `%${Math.round(torkOran * 100)}`

  // Cümle 1: Karar ifadesi
  let c1
  if (karar === "Rahat Uygun")
    c1 = `${makineAd}, ${isTipi} projesi için gerekli tork kapasitesinin ${oranStr}'ine sahip olup rahat uygun kategorisindedir.`
  else if (karar === "Uygun")
    c1 = `${makineAd}, proje gereksinimleri için yeterli tork kapasitesine (${oranStr}) sahip olup ${isTipi} için uygun değerlendirilmektedir.`
  else if (karar === "Şartlı Uygun")
    c1 = `${makineAd}, tork kapasitesi ${oranStr} olup sınır koşullarda çalışma gerektirmekte; ${isTipi} için şartlı uygun olarak değerlendirilmektedir.`
  else
    c1 = `${makineAd}, ${isTipi} projesi için gerekli koşulları karşılayamamaktadır (tork oranı: ${oranStr}).`

  // Cümle 2: Kritik katman / zemin bağlamı
  let c2 = ""
  if (kritikKatmanRow) {
    const zem  = kritikKatmanRow.zemTipi || "bilinmeyen zemin"
    const bas  = kritikKatmanRow.baslangic ?? "?"
    const bit  = kritikKatmanRow.bitis ?? "?"
    const sinif = kritikKatmanRow.sinif || ""
    if (sinif === "kaya")
      c2 = `Belirleyici katman ${bas}–${bit} m derinliğindeki ${zem} kaya formasyonudur; kaya soketleme tork ihtiyacını artırmaktadır.`
    else if (sinif === "granüler" && yas > 0)
      c2 = `Kritik katman ${bas}–${bit} m derinliğindeki ${zem} olup yeraltı suyu etkisi ile boru kararsızlık riski değerlendirmeyi etkilemektedir.`
    else
      c2 = `Belirleyici katman ${bas}–${bit} m arasındaki ${zem}'dir; bu bölge tork ve stabilite açısından en kritik bölgeyi oluşturmaktadır.`
  }

  // Cümle 3: Güven seviyesi notu
  let c3 = ""
  if (guven?.seviye === "LOW")
    c3 = `Mevcut zemin verisi sınırlı (güven puanı: ${guven.puan}/100); ek SPT veya CPT ölçümü yapılması halinde sonuçlar güncellenmelidir.`
  else if (guven?.seviye === "MEDIUM")
    c3 = `Veri kalitesi orta düzeyde (güven puanı: ${guven.puan}/100); sonuçlar makul doğrulukta olup ek zemin araştırması tavsiye edilir.`
  else if (guven?.seviye === "HIGH")
    c3 = `Kapsamlı zemin verisi mevcuttur (güven puanı: ${guven.puan}/100); hesap sonuçları güvenilir kabul edilebilir.`

  return [c1, c2, c3].filter(Boolean).join(" ")
}

// ─── Katman Bazlı Teknik Çıktı ───────────────────────────────────────────────

/**
 * Her katman için tork + bit tipi önerisi üretir.
 * v3.0: direncIndeksi() kullanır.
 */
export function katmanTeknikCikti(zemin, capMm, isTipi = "Fore Kazık", yas = 0) {
  const capM = capMm / 1000
  const K    = KATSAYILAR.tork
  const kMethod = yontemKatsayisi(isTipi)

  return zemin.map(row => {
    const baslangic = parseFloat(row.baslangic || 0)
    const bitis     = parseFloat(row.bitis     || 0)
    const ucs       = parseFloat(row.ucs       || 0)
    const rqd       = parseFloat(row.rqd       || 0)
    const sinif     = zeminSinifi(row.zemTipi, row.kohezyon)

    const direnc = direncIndeksi(row)
    const tauEff = direnc.tauKPa

    const kGw    = zeminSuyuKatsayisi(sinif, baslangic, yas)
    const kDepth = derinlikKatsayisi(bitis)

    let rqdFaktor = 1.0
    if (sinif === "kaya") {
      for (const e of [75, 50, 25, 0]) {
        if (rqd >= e) { rqdFaktor = K.rqd_faktor[e]; break }
      }
    }

    const katmanTork = Math.round(
      tauEff * (Math.PI * Math.pow(capM, 3) / 8) * K.uygulama_faktoru
      * kMethod * kGw * kDepth * rqdFaktor * 10
    ) / 10

    const hesapTip = zeminHesapTipi(row.zemTipi, row.kohezyon)
    const uc = ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(hesapTip) || ucs >= 25
      ? "Kaya ucu"
      : hesapTip === "Ayrışmış Kaya" || (ucs >= 10 && ucs < 25)
      ? "Geçiş ucu"
      : "Standart uç"

    const gs = guvenSinifi(row)
    return {
      ...row, katmanTork, uc,
      guven: gs.sinif, guvenAciklama: gs.aciklama,
      direnc: direnc.source, tauEff, kGw, kDepth,
    }
  })
}

// ─── Operasyon Önerileri ──────────────────────────────────────────────────────

export function operasyonOnerisi(zemin, yas) {
  const ucDegisimler = [], kritikDerinlikler = [], riskliZonlar = []
  let oncekiUc = null

  for (const row of zemin) {
    const spt = parseFloat(row.spt || 0)
    const ucs = parseFloat(row.ucs || 0)
    const hesapTip = zeminHesapTipi(row.zemTipi, row.kohezyon)
    const uc  = ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(hesapTip) || ucs >= 25
      ? "Kaya ucu"
      : hesapTip === "Ayrışmış Kaya" || (ucs >= 10 && ucs < 25)
      ? "Geçiş ucu"
      : "Standart uç"

    if (oncekiUc && uc !== oncekiUc)
      ucDegisimler.push({ derinlik: row.baslangic, eskiUc: oncekiUc, yeniUc: uc })

    if (spt >= 50 || ucs >= 20)
      kritikDerinlikler.push({
        baslangic: row.baslangic, bitis: row.bitis,
        neden: ucs >= 20 ? `UCS=${ucs} MPa` : `SPT=${spt}`,
        zemTipi: row.zemTipi,
      })

    const risk = stabiliteRiski(row.zemTipi, row.kohezyon, spt, yas, row.baslangic)
    if (risk === "Yüksek")
      riskliZonlar.push({
        derinlik: row.baslangic, bitis: row.bitis,
        risk, zemTipi: row.zemTipi,
      })

    oncekiUc = uc
  }

  return { ucDegisimler, kritikDerinlikler, riskliZonlar }
}

// ─── Fiyat Analizi ────────────────────────────────────────────────────────────

/**
 * Bileşen bazlı maliyet tahmini. Sınıf C — saha ve market verileriyle kalibre edin.
 */
export function fiyatAnalizi(tork, kazikBoyu, kazikCapi, kazikAdedi, makineTork) {
  const capM = kazikCapi / 1000
  const alanM2 = Math.PI * Math.pow(capM / 2, 2)

  const birimFiyatlar = {
    beton:   4500,   // TL/m³
    donati:  180,    // TL/kg
    delgi:   tork < 150 ? 800 : tork < 300 ? 1200 : 1800,  // TL/m (tork bantlı)
    casing:  400,    // TL/m
    mobilizasyon: 80000,
  }

  const betonHacmi = alanM2 * kazikBoyu * 1.10  // 10% israf payı
  const donatiKg   = alanM2 * kazikBoyu * 120    // 120 kg/m³ tipik donatı yoğunluğu

  const birinciKazik = {
    delgi:   kazikBoyu * birimFiyatlar.delgi,
    beton:   betonHacmi * birimFiyatlar.beton,
    donati:  donatiKg  * birimFiyatlar.donati,
  }

  const toplamBirim = Object.values(birinciKazik).reduce((a, b) => a + b, 0)
  const toplamProje = toplamBirim * kazikAdedi + birimFiyatlar.mobilizasyon

  return {
    birimFiyatlar,
    betonHacmi:   Math.round(betonHacmi * 10) / 10,
    donatiKg:     Math.round(donatiKg),
    birinciKazik: Object.fromEntries(
      Object.entries(birinciKazik).map(([k, v]) => [k, Math.round(v)])
    ),
    toplamBirim:   Math.round(toplamBirim),
    toplamProje:   Math.round(toplamProje),
    mobilizasyon:  birimFiyatlar.mobilizasyon,
  }
}
