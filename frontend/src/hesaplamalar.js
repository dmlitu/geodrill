// ─── GeoDrill Hesaplamalar v2.0 ────────────────────────────────────────────────
// Method-aware, reference-driven, confidence-scored geotechnical calculation engine.
//
// SOURCE HIERARCHY:
//   1. EN 1536:2010 / TS EN 1536 — bored pile execution
//   2. FHWA GEC 10 (2010) — drilled shafts / bored pile construction
//   3. FHWA GEC 5 — soil parameter development and correlations
//   4. OEM manufacturer data — machine capability limits
//   5. Conservative engineering judgment where literature gives no single formula
//
// CONFIDENCE CLASSES:
//   A — Measured / direct project data (lab, in-situ)
//   B — Correlated from recognised in-situ tests (SPT, UCS measurement)
//   C — Qualitative log / inferred only (soil name alone, no measured parameter)

// ─── Coefficient Registry ─────────────────────────────────────────────────────
// All engineering constants are centralised here with source notes.
// Update this object to calibrate; do not scatter magic numbers.

export const KATSAYILAR = {

  tork: {
    // Cohesive SPT→su correlation factor (kPa per blow)
    // Source: FHWA GEC 5 Table 3-1 / Terzaghi & Peck (1967). Class B.
    // Conservative k_su = 4 (literature range 4–6).
    kohezyon_spt: 4,
    kohezyon_su_min: 20,        // kPa — floor for near-zero SPT

    // Cohesionless: SPT→mobilised friction proxy (kPa per blow). Class C.
    // Not undrained strength — qualitative proxy only. CPT preferred.
    kohezyon_siz_spt: 2,
    kohezyon_siz_tau_min: 15,   // kPa

    // Rock face shear: tau ≈ UCS/35 (conservative lower bound for rotary cutting)
    // Source: FHWA GEC 10 §7.4 rock-socket interface shear. Class B.
    // Note: FHWA gives interface shear UCS/20–UCS/5; applying full τ to face-cutting
    // model T=τ×πd³/8 over-predicts torque (τ acts on cutter tips, not full face).
    // UCS/35 calibrates face-cutting model to field torque records for Kelly boring.
    kaya_ucs_tau_boleni: 35,    // tau [kPa] = UCS [MPa] × 1000 / 35

    // RQD variability factors — lower RQD = higher uncertainty → conservative upward margin
    // Source: FHWA GEC 10 §7.4 rock quality + conservative judgment
    rqd_faktor: { 75: 1.00, 50: 1.10, 25: 1.20, 0: 1.35 },

    // Application factor (tool geometry, efficiency, non-homogeneity)
    // Calibrated against OEM reference curves for Kelly rotary boring.
    // Editable: update with field telemetry when available.
    uygulama_faktoru: 1.25,

    // Output uncertainty band around nominal
    alt_bant: 0.80,   // lower limit = nominal × 0.80
    ust_bant: 1.30,   // upper limit = nominal × 1.30
  },

  rop: {
    // Base ROP by soil type (m/hr) at Ø800 mm reference diameter
    // Source: FHWA GEC 10 §7 + generalised industry data. Class C.
    baz: {
      "Dolgu": 8.0, "Kil": 6.0, "Silt": 6.5,
      "Kum": 5.0, "Çakıl": 3.5, "Ayrışmış Kaya": 2.0,
      "Kumtaşı": 1.2, "Kireçtaşı": 0.9, "Sert Kaya": 0.5,
      varsayilan: 3.0,
    },
    ucs_azaltma_katsayi: 0.75,  // at UCS=100 MPa → multiplier 0.25
    ucs_azaltma_min: 0.25,
    referans_cap_m: 0.80,
    cap_azaltma_katsayi: 0.50,
    cap_azaltma_min: 0.45,
    min_rop: 0.25,              // absolute floor (hard rock), m/hr
  },

  sure: {
    kurulum_saat: 0.50,         // rig positioning + setup, hrs (Zayed & Halpin 2005 §4)
    alet_degisim_saat: 0.60,    // bit/tool change at rock transition, hrs
    casing_saat_m: 0.10,        // casing installation, hrs/m
    kafes_sure_saat: 0.40,      // reinforcement cage lowering, hrs (Zayed & Halpin 2005 §4)
    // Concrete: tremie pour rate 20 m³/hr + vibration allowance
    // Source: Zayed & Halpin (2005) §4.3 — field data range 15–40 m³/hr; use 20 m³/hr conservative
    beton_katsayi: 1 / 20,      // hrs/m³ = 0.05 → 20 m³/hr pour rate
    // Depth surcharges (extra Kelly extensions, concrete delivery logistics)
    derinlik_ek: { 30: 0.8, 20: 0.4, 0: 0.0 },
  },

  mazot: {
    // Torque-banded fuel model (L/m). Class C — calibrate with site meter data.
    dilimler: [
      { tork_ust: 100,      baz: 8.0,  katsayi: 0.040 },
      { tork_ust: 200,      baz: 12.0, katsayi: 0.080 },
      { tork_ust: Infinity, baz: 20.0, katsayi: 0.075 },
    ],
  },

  casing: {
    // Source: EN 1536:2010 §5 — hole stability and casing design
    kum_cakil_min_kalinlik: 0.50, // m — sand/gravel above this → required
    dolgu_sartli_kalinlik: 2.00,  // m — thick fill → conditional
    cok_gevsek_spt: 10,           // SPT N < 10 cohesionless → required
    yuksek_risk_oran: 1.00,       // 100% of high-risk layer
    orta_risk_oran: 0.50,         // 50% of medium-risk layer
  },

  stabilite: {
    puan: { "Yüksek": 70, "Orta": 40, "Düşük": 15 },
    yuksek_esigi: 50,
    orta_esigi: 30,
    cok_gevsek_spt: 10,
    orta_spt: 30,
  },

  makine: {
    tork_min_oran: 0.80,   // < 80% → UYGUN DEĞİL
    tork_uygun_oran: 1.00, // 80–100% → ŞARTLI; ≥ 100% → UYGUN
    // Method compatibility: project type ↔ machine type
    // Source: EN 1536 method classification + OEM specs
    method_uyumluluk: {
      "Fore Kazık": ["Fore Kazık"],
      "CFA Kazık":  ["Fore Kazık", "CFA Kazık"],
      "Ankraj":     ["Ankraj"],
      "Mini Kazık": ["Ankraj", "Mini Kazık"],
    },
  },

  kritikKatman: {
    // Difficulty index weights — engineering judgment
    spt_agirlik: 0.5,
    ucs_agirlik: 2.0,
    rqd_eksik_agirlik: 0.3,  // (100 − RQD): lower RQD = more fractured = harder
  },
}

// ─── Soil Classification ──────────────────────────────────────────────────────

export function zeminSinifi(zemTipi) {
  if (["Kil", "Silt"].includes(zemTipi))                                          return "kohezyonlu"
  if (["Kum", "Çakıl", "Dolgu"].includes(zemTipi))                               return "granüler"
  if (["Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(zemTipi)) return "kaya"
  return "belirsiz"
}

/** Data-quality confidence class for a soil layer */
export function guvenSinifi(row) {
  if ((parseFloat(row.ucs) || 0) > 0) return { sinif: "B", aciklama: "UCS ölçümünden türetilmiş (Sınıf B)" }
  if ((parseFloat(row.spt) || 0) > 0) return { sinif: "B", aciklama: "SPT korelasyonundan türetilmiş (Sınıf B)" }
  return { sinif: "C", aciklama: "Yalnızca niteliksel zemin adı — ölçülen parametre yok (Sınıf C)" }
}

// ─── Required Torque — Range Output ──────────────────────────────────────────

/**
 * Required torque range for Kelly/rotary bored pile drilling.
 * Model: face-cutting shear torque = τ × (π d³/8) × application_factor
 *
 * Source: FHWA GEC 10 §7, EN 1536:2010 §8
 *
 * Returns { nominal, min, max, guven, aciklama, uyarilar }
 * nominal — reference for equipment selection (kNm)
 * min     — lower band, favourable conditions
 * max     — upper band, peak-risk conditions
 * guven   — A | B | C
 */
export function gerekliTorkAralik(zemin, capMm, isTipi = "Fore Kazık") {
  const capM = capMm / 1000
  const K = KATSAYILAR.tork
  const aciklama = []
  const uyarilar = []
  let maxNominal = 0
  const guvenSiniflari = []

  if (isTipi !== "Fore Kazık") {
    uyarilar.push(
      `UYARI: Tork modeli yalnızca Kelly/Rotary (Fore Kazık) için doğrulanmıştır. ` +
      `'${isTipi}' için farklı hesap motoru gereklidir — sonuçlar yüksek belirsizlikle işaretlenmiştir.`
    )
  }

  if (!zemin || zemin.length === 0) {
    return { nominal: 0, min: 0, max: 0, guven: "C", aciklama: ["Zemin verisi yok"], uyarilar }
  }

  for (const row of zemin) {
    const spt = parseFloat(row.spt) || 0
    const ucs = parseFloat(row.ucs) || 0
    const rqd = parseFloat(row.rqd) || 0
    const sinif = zeminSinifi(row.zemTipi)
    guvenSiniflari.push(guvenSinifi(row).sinif)

    let tau, tauIz
    if (ucs > 0) {
      tau   = (ucs * 1000) / K.kaya_ucs_tau_boleni
      tauIz = `UCS=${ucs} MPa → τ=${Math.round(tau)} kPa (UCS/35, FHWA GEC 10 §7.4, Sınıf B)`
    } else if (sinif === "kohezyonlu") {
      tau   = Math.max(spt * K.kohezyon_spt, K.kohezyon_su_min)
      tauIz = `SPT=${spt} → su≈${Math.round(tau)} kPa (N×${K.kohezyon_spt}, FHWA GEC 5, Sınıf B)`
    } else {
      tau   = Math.max(spt * K.kohezyon_siz_spt, K.kohezyon_siz_tau_min)
      tauIz = `SPT=${spt} → τ≈${Math.round(tau)} kPa (granüler proxy, Sınıf C — CPT tercih edilir)`
    }

    // RQD variability factor — conservative upward margin for fractured rock
    let rqdFaktor = 1.0
    if (rqd > 0 || ucs > 0) {
      for (const e of [75, 50, 25, 0]) {
        if (rqd >= e) { rqdFaktor = K.rqd_faktor[e]; break }
      }
    }

    const t = tau * rqdFaktor * Math.PI * Math.pow(capM, 3) / 8 * K.uygulama_faktoru
    if (t > maxNominal) {
      maxNominal = t
      aciklama.length = 0
      aciklama.push(
        `Belirleyici katman: ${row.zemTipi} (${row.baslangic}–${row.bitis} m)`,
        tauIz + (rqdFaktor !== 1.0 ? ` × RQD-faktör ${rqdFaktor} (RQD=${rqd}%)` : ""),
        `Tnom = ${Math.round(t * 10) / 10} kNm`
      )
    }
  }

  const nominal = Math.round(maxNominal * 10) / 10
  const guven   = guvenSiniflari.includes("C") ? "C" : guvenSiniflari.includes("B") ? "B" : "A"

  return {
    nominal,
    min: Math.round(nominal * K.alt_bant * 10) / 10,
    max: Math.round(nominal * K.ust_bant * 10) / 10,
    guven, aciklama, uyarilar,
  }
}

/** Backward-compatible single-value wrapper */
export function gerekliTork(zemin, capMm) {
  return gerekliTorkAralik(zemin, capMm).nominal
}

// ─── Stability Risk ───────────────────────────────────────────────────────────

/**
 * Per-layer stability risk.
 * Source: EN 1536:2010 §5, FHWA GEC 10 §4
 */
export function stabiliteRiski(tip, kohezyon, spt, yas, baslangic = 0) {
  const C = KATSAYILAR.stabilite
  if (["Kum", "Çakıl"].includes(tip))
    return (yas > 0 && baslangic >= yas) ? "Yüksek" : "Orta"
  if (kohezyon === "Kohezyonsuz" && spt <= C.cok_gevsek_spt) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= C.orta_spt)       return "Orta"
  if (tip === "Dolgu")                                        return "Orta"
  return "Düşük"
}

// ─── Casing Decision ──────────────────────────────────────────────────────────

/**
 * Casing/temporary support requirement.
 * Source: EN 1536:2010 §5, FHWA GEC 10 §7.3
 */
export function casingDurum(zemin, yas) {
  const C = KATSAYILAR.casing
  const gerekce = []
  let zorunlu = false, sartli = false

  for (const row of zemin) {
    const spt = parseFloat(row.spt) || 0
    const k   = row.bitis - row.baslangic

    if (["Kum", "Çakıl"].includes(row.zemTipi) && k > C.kum_cakil_min_kalinlik) {
      zorunlu = true
      gerekce.push(`${row.zemTipi} (${row.baslangic}–${row.bitis} m, ${k} m) — EN 1536 §5 gereği`)
    }
    if (row.kohezyon === "Kohezyonsuz" && yas > 0 && row.baslangic >= yas) {
      zorunlu = true
      gerekce.push(`Kohezyonsuz (${row.baslangic}–${row.bitis} m) YAS (${yas} m) altında — göçme riski`)
    }
    if (spt < C.cok_gevsek_spt && row.kohezyon === "Kohezyonsuz") {
      zorunlu = true
      gerekce.push(`SPT=${spt}<${C.cok_gevsek_spt} (${row.baslangic}–${row.bitis} m) — çok gevşek`)
    }
    if (row.zemTipi === "Dolgu" && k > C.dolgu_sartli_kalinlik) {
      sartli = true
      gerekce.push(`Dolgu (${row.baslangic}–${row.bitis} m, ${k} m) — kalın dolgu, önerilir`)
    }
  }

  const durum = zorunlu ? "Gerekli" : sartli ? "Şartlı önerilir" : "Gerekmeyebilir"
  return { durum, gerekce, zorunlu }
}

export function casingMetreHesapla(zemin, yas) {
  const C = KATSAYILAR.casing
  let toplam = 0
  for (const row of zemin) {
    const k    = row.bitis - row.baslangic
    const risk = stabiliteRiski(row.zemTipi, row.kohezyon, row.spt, yas, row.baslangic)
    if      (risk === "Yüksek") toplam += k * C.yuksek_risk_oran
    else if (risk === "Orta")   toplam += k * C.orta_risk_oran
  }
  return Math.round(toplam * 10) / 10
}

// ─── Rate of Penetration ─────────────────────────────────────────────────────

/**
 * Estimated penetration rate (m/hr). Class C.
 * Source: FHWA GEC 10 §7 + industry generalisation.
 */
export function ropHesapla(tip, ucs, capMm) {
  const R    = KATSAYILAR.rop
  const capM = capMm / 1000
  let baz    = R.baz[tip] ?? R.baz.varsayilan
  if (ucs > 0)
    baz *= Math.max(R.ucs_azaltma_min, 1 - (ucs / 100) * R.ucs_azaltma_katsayi)
  baz *= Math.max(R.cap_azaltma_min, 1 - (capM - R.referans_cap_m) * R.cap_azaltma_katsayi)
  return Math.max(baz, R.min_rop)
}

// ─── Pile Duration ────────────────────────────────────────────────────────────

/** Single-pile drilling cycle time (hours). Class C. */
export function kazikSuresi(zemin, capMm, kazikBoyu, casingM) {
  const capM = capMm / 1000
  const S    = KATSAYILAR.sure
  let sure   = S.kurulum_saat
  let ucDeg  = 0
  let oncekiTip = null

  for (const row of zemin) {
    const k = row.bitis - row.baslangic
    sure += k / ropHesapla(row.zemTipi, row.ucs, capMm)
    if (["Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya"].includes(row.zemTipi)
        && oncekiTip !== row.zemTipi) ucDeg++
    oncekiTip = row.zemTipi
  }

  sure += ucDeg * S.alet_degisim_saat
  sure += casingM * S.casing_saat_m
  // Reinforcement cage lowering (Zayed & Halpin 2005 §4)
  sure += S.kafes_sure_saat
  // Concrete: pile volume (m³) × pour rate factor (hrs/m³)
  // Volume = π × (d/2)² × L; pour rate = 20 m³/hr (Zayed & Halpin 2005 §4.3)
  sure += Math.PI * Math.pow(capM / 2, 2) * kazikBoyu * S.beton_katsayi

  const ekSure = kazikBoyu >= 30 ? S.derinlik_ek[30]
               : kazikBoyu >= 20 ? S.derinlik_ek[20]
               : S.derinlik_ek[0]
  sure += ekSure
  return Math.round(sure * 10) / 10
}

// ─── Fuel Estimate ────────────────────────────────────────────────────────────

/** Fuel consumption estimate. Class C — calibrate with site meter data. */
export function mazotTahmini(tork, kazikBoyu) {
  const d = KATSAYILAR.mazot.dilimler
  let mBasi
  if      (tork < 100) mBasi = d[0].baz + tork          * d[0].katsayi
  else if (tork < 200) mBasi = d[1].baz + (tork - 100)  * d[1].katsayi
  else                 mBasi = d[2].baz + (tork - 200)  * d[2].katsayi
  mBasi = Math.round(mBasi * 10) / 10
  return { mBasi, toplam: Math.round(mBasi * kazikBoyu * 10) / 10 }
}

// ─── Critical Layer ───────────────────────────────────────────────────────────

export function kritikKatman(zemin) {
  if (!zemin.length) return null
  const W = KATSAYILAR.kritikKatman
  const skor = r => (r.spt || 0) * W.spt_agirlik + (r.ucs || 0) * W.ucs_agirlik + (100 - (r.rqd || 0)) * W.rqd_eksik_agirlik
  return zemin.reduce((max, row) => skor(row) > skor(max) ? row : max, zemin[0])
}

// ─── Machine Suitability — Multi-criteria ─────────────────────────────────────

/**
 * Equipment suitability: method + geometry + torque + casing checks.
 *
 * Decision hierarchy:
 *   1. Method incompatibility       → UYGUN DEĞİL
 *   2. Depth insufficient           → UYGUN DEĞİL
 *   3. Diameter insufficient        → UYGUN DEĞİL
 *   4. Torque < 80% required        → UYGUN DEĞİL
 *   5. Casing required, machine can't → ŞARTLI UYGUN
 *   6. Torque 80–100%               → ŞARTLI UYGUN
 *   7. All criteria met             → UYGUN
 *
 * Source: FHWA GEC 10 §7, EN 1536, OEM technical specifications
 */
export function makinaUygunluk(makine, tork, kazikBoyu, kazikCapi, casingGerekli, isTipi = "Fore Kazık") {
  const M          = KATSAYILAR.makine
  const redSebepler = []
  const uyarilar    = []

  // 1. Method
  const desteklenenler = M.method_uyumluluk[isTipi] || [isTipi]
  if (!desteklenenler.includes(makine.tip)) {
    return {
      karar: "Uygun Değil",
      gerekce: `Method uyumsuz: proje '${isTipi}' — makine tipi '${makine.tip}'`,
      redSebepler: [`Method uyumsuzluğu: ${makine.tip} ≠ ${isTipi}`],
      uyarilar: [], marj: null,
    }
  }

  // 2. Depth
  if ((makine.maxDerinlik || 0) < kazikBoyu)
    redSebepler.push(`Derinlik yetersiz: ${makine.maxDerinlik} m < gerekli ${kazikBoyu} m`)

  // 3. Diameter
  if ((makine.maxCap || 0) < kazikCapi)
    redSebepler.push(`Çap yetersiz: ${makine.maxCap} mm < gerekli ${kazikCapi} mm`)

  // 4. Torque hard limit
  const torkOran = tork > 0 ? (makine.tork || 0) / tork : 999
  if (torkOran < M.tork_min_oran)
    redSebepler.push(
      `Tork yetersiz: ${makine.tork} kNm < minimum ${Math.round(tork * M.tork_min_oran)} kNm` +
      ` (%${Math.round(torkOran * 100)} kapasite)`
    )

  if (redSebepler.length > 0)
    return { karar: "Uygun Değil", gerekce: redSebepler[0], redSebepler, uyarilar, marj: torkOran }

  // 5. Casing
  if (casingGerekli && makine.casing === "Hayır") {
    uyarilar.push("Casing gerekli ancak makine casing donanımına sahip değil")
    return {
      karar: "Şartlı Uygun",
      gerekce: "Casing kapasitesi yok; yardımcı casing ekipmanı ile değerlendirilebilir",
      redSebepler: [], uyarilar, marj: torkOran,
    }
  }

  // 6. Torque margin band
  if (torkOran < M.tork_uygun_oran) {
    uyarilar.push(`Tork sınırda: %${Math.round(torkOran * 100)} kapasite kullanımı`)
    return {
      karar: "Şartlı Uygun",
      gerekce: `Tork nominalin %${Math.round(torkOran * 100)}'i — sınır koşullarda çalışma`,
      redSebepler: [], uyarilar, marj: torkOran,
    }
  }

  // 7. Suitable
  if (casingGerekli && makine.casing === "Şartlı")
    uyarilar.push("Casing kapasitesi şartlı — konfigürasyonu doğrulayın")

  return {
    karar: "Uygun",
    gerekce: `Tüm kriterler karşılandı. Tork marjı +%${Math.round((torkOran - 1) * 100)}. Derinlik: ${makine.maxDerinlik} m. Çap: ${makine.maxCap} mm`,
    redSebepler: [], uyarilar, marj: torkOran,
  }
}

// ─── Per-layer Technical Output ───────────────────────────────────────────────

export function katmanTeknikCikti(zemin, capMm) {
  const capM = capMm / 1000
  const K    = KATSAYILAR.tork
  return zemin.map(row => {
    const spt   = parseFloat(row.spt) || 0
    const ucs   = parseFloat(row.ucs) || 0
    const rqd   = parseFloat(row.rqd) || 0
    const sinif = zeminSinifi(row.zemTipi)

    let tau
    if (ucs > 0)                     tau = (ucs * 1000) / K.kaya_ucs_tau_boleni
    else if (sinif === "kohezyonlu") tau = Math.max(spt * K.kohezyon_spt, K.kohezyon_su_min)
    else                             tau = Math.max(spt * K.kohezyon_siz_spt, K.kohezyon_siz_tau_min)

    let rqdFaktor = 1.0
    if (rqd > 0 || ucs > 0) {
      for (const e of [75, 50, 25, 0]) {
        if (rqd >= e) { rqdFaktor = K.rqd_faktor[e]; break }
      }
    }

    const katmanTork = Math.round(tau * rqdFaktor * Math.PI * Math.pow(capM, 3) / 8 * K.uygulama_faktoru * 10) / 10

    const uc = ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(row.zemTipi) || ucs >= 25
      ? "Kaya ucu"
      : row.zemTipi === "Ayrışmış Kaya" || (ucs >= 10 && ucs < 25)
      ? "Geçiş ucu"
      : "Standart uç"

    const gs = guvenSinifi(row)
    return { ...row, katmanTork, uc, guven: gs.sinif, guvenAciklama: gs.aciklama }
  })
}

// ─── Operation Recommendations ────────────────────────────────────────────────

export function operasyonOnerisi(zemin, yas) {
  const ucDegisimler = [], kritikDerinlikler = [], riskliZonlar = []
  let oncekiUc = null

  for (const row of zemin) {
    const spt = parseFloat(row.spt) || 0
    const ucs = parseFloat(row.ucs) || 0
    const uc  = ["Kumtaşı", "Kireçtaşı", "Sert Kaya"].includes(row.zemTipi) || ucs >= 25
      ? "Kaya ucu"
      : row.zemTipi === "Ayrışmış Kaya" || (ucs >= 10 && ucs < 25)
      ? "Geçiş ucu"
      : "Standart uç"

    if (oncekiUc && uc !== oncekiUc)
      ucDegisimler.push({ derinlik: row.baslangic, eskiUc: oncekiUc, yeniUc: uc })

    if (spt >= 50 || ucs >= 20)
      kritikDerinlikler.push({
        baslangic: row.baslangic, bitis: row.bitis,
        neden: ucs >= 20
          ? `UCS: ${ucs} MPa — sert formasyon (FHWA GEC 10 §7 kritik derinlik)`
          : `SPT: ${spt} — çok sıkı/sert; düşük ROP ve ekipman yükü riski`
      })

    if (["Kum", "Çakıl"].includes(row.zemTipi) || (row.kohezyon === "Kohezyonsuz" && spt <= 10)) {
      const suAlti = yas > 0 && row.baslangic >= yas
      riskliZonlar.push({
        baslangic: row.baslangic, bitis: row.bitis,
        risk: suAlti ? "Yüksek" : "Orta",
        neden: suAlti
          ? `${row.zemTipi} YAS altında — casing zorunlu (EN 1536 §5)`
          : `${row.zemTipi} — casing veya destek sıvısı değerlendirilmeli`
      })
    }
    oncekiUc = uc
  }
  return { ucDegisimler, kritikDerinlikler, riskliZonlar }
}

// ─── Cost Analysis ────────────────────────────────────────────────────────────

/**
 * Component-based cost estimate.
 * WARNING: All unit prices are configured inputs, NOT market truth. Class C.
 * Calibrate with current contract unit prices before use in tendering.
 */
export function fiyatAnalizi(
  { mazotFiyati, makineKirasi, iscilikSaat, sarfMalzeme, karPayiYuzde },
  proje, mBasi, topMazot, sure
) {
  const kazikAdedi = proje.kazikAdedi || 1
  const kazikBoyu  = proje.kazikBoyu  || 1

  const mazotMaliyeti       = Math.round(mBasi * kazikBoyu * kazikAdedi * mazotFiyati)
  const amortismanMaliyeti  = Math.round(sure * kazikAdedi * makineKirasi)
  const iscilikMaliyeti     = Math.round(sure * kazikAdedi * iscilikSaat)
  const sarfMalzemeMaliyeti = Math.round(kazikBoyu * kazikAdedi * sarfMalzeme)

  const altToplam = mazotMaliyeti + amortismanMaliyeti + iscilikMaliyeti + sarfMalzemeMaliyeti
  const karPayi   = Math.round(altToplam * (karPayiYuzde / 100))
  const toplam    = altToplam + karPayi
  const kazikBasi = Math.round(toplam / kazikAdedi)
  const metreBasi = Math.round(toplam / (kazikAdedi * kazikBoyu))

  return {
    mazotMaliyeti, amortismanMaliyeti, iscilikMaliyeti, sarfMalzemeMaliyeti,
    altToplam, karPayi, toplam, kazikBasi, metreBasi,
    uyari: "Yapılandırılmış tahmin — piyasa fiyatı değildir. Güncel sözleşme birim fiyatları ile kalibre edilmelidir.",
    guvenSinifi: "C",
  }
}
