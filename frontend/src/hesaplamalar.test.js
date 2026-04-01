// ─── GeoDrill Engineering Test Suite v2.0 ────────────────────────────────────
// Gold-standard scenarios for the geotechnical calculation engine.

import { describe, it, expect } from "vitest"
import {
  gerekliTork, gerekliTorkAralik, stabiliteRiski, casingDurum, casingMetreHesapla,
  ropHesapla, kazikSuresi, mazotTahmini, kritikKatman, makinaUygunluk,
  katmanTeknikCikti, operasyonOnerisi, zeminSinifi, guvenSinifi, KATSAYILAR,
} from "./hesaplamalar"

// ─── Coefficient Registry ─────────────────────────────────────────────────────

describe("KATSAYILAR registry", () => {
  it("has all required coefficient groups", () => {
    expect(KATSAYILAR.tork).toBeDefined()
    expect(KATSAYILAR.rop).toBeDefined()
    expect(KATSAYILAR.sure).toBeDefined()
    expect(KATSAYILAR.casing).toBeDefined()
    expect(KATSAYILAR.stabilite).toBeDefined()
    expect(KATSAYILAR.makine).toBeDefined()
  })
  it("application factor is between 1.0 and 2.0", () => {
    expect(KATSAYILAR.tork.uygulama_faktoru).toBeGreaterThanOrEqual(1.0)
    expect(KATSAYILAR.tork.uygulama_faktoru).toBeLessThanOrEqual(2.0)
  })
  it("torque band brackets the nominal", () => {
    expect(KATSAYILAR.tork.alt_bant).toBeLessThan(1.0)
    expect(KATSAYILAR.tork.ust_bant).toBeGreaterThan(1.0)
  })
})

// ─── Soil Classification ─────────────────────────────────────────────────────

describe("zeminSinifi", () => {
  it("clay and silt → kohezyonlu", () => {
    expect(zeminSinifi("Kil")).toBe("kohezyonlu")
    expect(zeminSinifi("Silt")).toBe("kohezyonlu")
  })
  it("sand, gravel, fill → granüler", () => {
    expect(zeminSinifi("Kum")).toBe("granüler")
    expect(zeminSinifi("Çakıl")).toBe("granüler")
    expect(zeminSinifi("Dolgu")).toBe("granüler")
  })
  it("rock types → kaya", () => {
    expect(zeminSinifi("Sert Kaya")).toBe("kaya")
    expect(zeminSinifi("Kumtaşı")).toBe("kaya")
    expect(zeminSinifi("Kireçtaşı")).toBe("kaya")
    expect(zeminSinifi("Ayrışmış Kaya")).toBe("kaya")
  })
  it("unknown → belirsiz", () => {
    expect(zeminSinifi("XYZ")).toBe("belirsiz")
  })
})

describe("guvenSinifi", () => {
  it("UCS present → B", () => {
    expect(guvenSinifi({ ucs: 20, spt: 0 }).sinif).toBe("B")
  })
  it("SPT present, no UCS → B", () => {
    expect(guvenSinifi({ ucs: 0, spt: 15 }).sinif).toBe("B")
  })
  it("neither SPT nor UCS → C", () => {
    expect(guvenSinifi({ ucs: 0, spt: 0 }).sinif).toBe("C")
  })
})

// ─── Scenario 1: Soft cohesive, moderate depth, no GWT ───────────────────────

describe("Scenario 1: Soft cohesive, no GWT", () => {
  const zemin = [
    { baslangic: 0, bitis: 8,  zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 8,  ucs: 0, rqd: 0 },
    { baslangic: 8, bitis: 18, zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 15, ucs: 0, rqd: 0 },
  ]
  it("torque nominal > 0 and < 100 kNm at Ø800", () => {
    const tork = gerekliTork(zemin, 800)
    expect(tork).toBeGreaterThan(0)
    expect(tork).toBeLessThan(100)
  })
  it("confidence is B (SPT-based)", () => {
    expect(gerekliTorkAralik(zemin, 800).guven).toBe("B")
  })
  it("min < nominal < max", () => {
    const { min, nominal, max } = gerekliTorkAralik(zemin, 800)
    expect(min).toBeLessThan(nominal)
    expect(max).toBeGreaterThan(nominal)
  })
  it("no casing required", () => {
    expect(casingDurum(zemin, 0).durum).toBe("Gerekmeyebilir")
  })
  it("casing metres = 0", () => {
    expect(casingMetreHesapla(zemin, 0)).toBe(0)
  })
  it("all layers low stability risk", () => {
    zemin.forEach(r => {
      expect(stabiliteRiski(r.zemTipi, r.kohezyon, r.spt, 0)).toBe("Düşük")
    })
  })
})

// ─── Scenario 2: Granular below GWT, casing required ─────────────────────────

describe("Scenario 2: Sand below GWT", () => {
  const zemin = [
    { baslangic: 0, bitis: 3,  zemTipi: "Kil", kohezyon: "Kohezyonlu",  spt: 12, ucs: 0, rqd: 0 },
    { baslangic: 3, bitis: 15, zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 18, ucs: 0, rqd: 0 },
  ]
  const yas = 4
  it("sand below GWT → Yüksek risk", () => {
    expect(stabiliteRiski("Kum", "Kohezyonsuz", 18, yas, 4)).toBe("Yüksek")
  })
  it("casing is Gerekli", () => {
    const { durum, zorunlu } = casingDurum(zemin, yas)
    expect(durum).toBe("Gerekli")
    expect(zorunlu).toBe(true)
  })
  it("casing metres > 0 and ≤ total depth", () => {
    const cm = casingMetreHesapla(zemin, yas)
    expect(cm).toBeGreaterThan(0)
    expect(cm).toBeLessThanOrEqual(15)
  })
})

// ─── Scenario 3: Dense granular — higher demand than soft clay ────────────────

describe("Scenario 3: Dense granular demand > soft clay", () => {
  const clay = [{ baslangic: 0, bitis: 18, zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 8, ucs: 0, rqd: 0 }]
  const dense = [
    { baslangic: 0, bitis: 5,  zemTipi: "Kil", kohezyon: "Kohezyonlu",  spt: 15, ucs: 0, rqd: 0 },
    { baslangic: 5, bitis: 18, zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 55, ucs: 0, rqd: 0 },
  ]
  it("dense SPT55 sand torque > soft clay torque", () => {
    expect(gerekliTork(dense, 800)).toBeGreaterThan(gerekliTork(clay, 800))
  })
  it("dense sand SPT55 appears in critical depths", () => {
    const oneri = operasyonOnerisi(dense, 0)
    const crit = oneri.kritikDerinlikler.find(d => d.baslangic === 5)
    expect(crit).toBeTruthy()
  })
})

// ─── Scenario 4: Rock socketing ───────────────────────────────────────────────

describe("Scenario 4: Weathered rock / rock socketing", () => {
  const zemin = [
    { baslangic: 0,  bitis: 8,  zemTipi: "Kil",          kohezyon: "Kohezyonlu", spt: 20, ucs: 0,  rqd: 0  },
    { baslangic: 8,  bitis: 14, zemTipi: "Ayrışmış Kaya", kohezyon: "Kohezyonlu", spt: 0,  ucs: 8,  rqd: 40 },
    { baslangic: 14, bitis: 20, zemTipi: "Kumtaşı",       kohezyon: "Kohezyonlu", spt: 0,  ucs: 25, rqd: 65 },
  ]
  it("sandstone layer → Kaya ucu", () => {
    const cikti = katmanTeknikCikti(zemin, 800)
    expect(cikti.find(r => r.zemTipi === "Kumtaşı").uc).toBe("Kaya ucu")
  })
  it("weathered rock → Geçiş ucu", () => {
    const cikti = katmanTeknikCikti(zemin, 800)
    expect(cikti.find(r => r.zemTipi === "Ayrışmış Kaya").uc).toBe("Geçiş ucu")
  })
  it("rock torque > clay torque", () => {
    const clayOnly = [{ baslangic: 0, bitis: 20, zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 15, ucs: 0, rqd: 0 }]
    expect(gerekliTork(zemin, 800)).toBeGreaterThan(gerekliTork(clayOnly, 800))
  })
  it("bit change is recorded at soil→rock transition", () => {
    const oneri = operasyonOnerisi(zemin, 0)
    expect(oneri.ucDegisimler.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Scenario 5: Qualitative-only input → Class C confidence ─────────────────

describe("Scenario 5: No measured parameters — Class C", () => {
  const zemin = [{ baslangic: 0, bitis: 10, zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 0, ucs: 0, rqd: 0 }]
  it("confidence is C", () => {
    expect(gerekliTorkAralik(zemin, 800).guven).toBe("C")
  })
  it("nominal torque uses floor value (> 0)", () => {
    expect(gerekliTork(zemin, 800)).toBeGreaterThan(0)
  })
})

// ─── Scenario 6: Machine at limit ────────────────────────────────────────────

describe("Scenario 6: Machine close to limit", () => {
  const tork = 180
  const base = { ad: "Test Rig", tip: "Fore Kazık", maxDerinlik: 25, maxCap: 1000, casing: "Evet" }
  it("tork=200 vs required=180 → Uygun (>100%)", () => {
    expect(makinaUygunluk({ ...base, tork: 200 }, tork, 20, 800, false, "Fore Kazık").karar).toBe("Uygun")
  })
  it("tork=160 vs required=180 → Şartlı Uygun (89%)", () => {
    expect(makinaUygunluk({ ...base, tork: 160 }, tork, 20, 800, false, "Fore Kazık").karar).toBe("Şartlı Uygun")
  })
  it("tork=140 vs required=180 → Uygun Değil (78% < 80%)", () => {
    expect(makinaUygunluk({ ...base, tork: 140 }, tork, 20, 800, false, "Fore Kazık").karar).toBe("Uygun Değil")
  })
})

// ─── Scenario 7: Undersized machine / method mismatch ────────────────────────

describe("Scenario 7: Undersized / method mismatch", () => {
  const tork = 200
  const mini = { ad: "Mini", tip: "Fore Kazık", tork: 80, maxDerinlik: 12, maxCap: 600, casing: "Hayır" }
  it("depth too short → Uygun Değil", () => {
    const r = makinaUygunluk(mini, tork, 20, 800, false, "Fore Kazık")
    expect(r.karar).toBe("Uygun Değil")
    expect(r.redSebepler.length).toBeGreaterThan(0)
  })
  it("Ankraj rig for Fore Kazık → Uygun Değil (method mismatch)", () => {
    const ankraj = { ad: "Ankraj Rig", tip: "Ankraj", tork: 300, maxDerinlik: 30, maxCap: 900, casing: "Evet" }
    const r = makinaUygunluk(ankraj, 180, 20, 800, false, "Fore Kazık")
    expect(r.karar).toBe("Uygun Değil")
    expect(r.gerekce).toMatch(/Method uyumsuz/)
  })
  it("Fore Kazık rig for Ankraj project → Uygun Değil", () => {
    const fore = { ad: "Fore Rig", tip: "Fore Kazık", tork: 300, maxDerinlik: 30, maxCap: 900, casing: "Evet" }
    const r = makinaUygunluk(fore, 80, 15, 200, false, "Ankraj")
    expect(r.karar).toBe("Uygun Değil")
  })
})

// ─── Scenario 8: Fuel and drilling time sensitivity ──────────────────────────

describe("Scenario 8: Output sensitivity", () => {
  it("larger diameter → higher torque", () => {
    const zemin = [{ baslangic: 0, bitis: 20, zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 30, ucs: 0, rqd: 0 }]
    expect(gerekliTork(zemin, 1000)).toBeGreaterThan(gerekliTork(zemin, 600))
  })
  it("higher torque → higher fuel", () => {
    expect(mazotTahmini(250, 20).mBasi).toBeGreaterThan(mazotTahmini(50, 20).mBasi)
  })
  it("fuel total ≈ mBasi × length", () => {
    const { mBasi, toplam } = mazotTahmini(150, 30)
    expect(toplam).toBeCloseTo(mBasi * 30, 0)
  })
  it("casing adds to drilling time", () => {
    const zemin = [{ baslangic: 0, bitis: 18, zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 20, ucs: 0, rqd: 0 }]
    expect(kazikSuresi(zemin, 800, 18, 10)).toBeGreaterThan(kazikSuresi(zemin, 800, 18, 0))
  })
})

// ─── ROP ─────────────────────────────────────────────────────────────────────

describe("ropHesapla", () => {
  it("clay > hard rock ROP", () => {
    expect(ropHesapla("Kil", 0, 800)).toBeGreaterThan(ropHesapla("Sert Kaya", 0, 800))
  })
  it("high UCS reduces ROP", () => {
    expect(ropHesapla("Kumtaşı", 80, 800)).toBeLessThan(ropHesapla("Kumtaşı", 0, 800))
  })
  it("never below minimum floor", () => {
    expect(ropHesapla("Sert Kaya", 200, 2000)).toBeGreaterThanOrEqual(KATSAYILAR.rop.min_rop)
  })
})

// ─── Method warning for unsupported methods ───────────────────────────────────

describe("gerekliTorkAralik — method warning", () => {
  const zemin = [{ baslangic: 0, bitis: 10, zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 20, ucs: 0, rqd: 0 }]
  it("no warning for Fore Kazık", () => {
    expect(gerekliTorkAralik(zemin, 800, "Fore Kazık").uyarilar.length).toBe(0)
  })
  it("warning for Ankraj (unsupported torque model)", () => {
    const r = gerekliTorkAralik(zemin, 800, "Ankraj")
    expect(r.uyarilar.length).toBeGreaterThan(0)
    expect(r.uyarilar[0]).toMatch(/UYARI/)
  })
})
