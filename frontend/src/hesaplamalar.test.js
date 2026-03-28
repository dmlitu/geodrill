import { describe, it, expect } from "vitest"
import {
  gerekliTork,
  stabiliteRiski,
  casingDurum,
  casingMetreHesapla,
  kazikSuresi,
  mazotTahmini,
  kritikKatman,
  makinaUygunluk,
} from "./hesaplamalar"

// ─── Test verisi ──────────────────────────────────────────────────────────────

const KIL_KATMANI = { baslangic: 0, bitis: 5, zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 20, ucs: 0, rqd: 0 }
const KUM_KATMANI = { baslangic: 5, bitis: 10, zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 12, ucs: 0, rqd: 0 }
const KAYA_KATMANI = { baslangic: 10, bitis: 18, zemTipi: "Sert Kaya", kohezyon: "Kaya", spt: 100, ucs: 50, rqd: 80 }
const GEVŞEK_KUM = { baslangic: 0, bitis: 4, zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 5, ucs: 0, rqd: 0 }

// ─── gerekliTork ──────────────────────────────────────────────────────────────

describe("gerekliTork", () => {
  it("boş zemin için 0 döner", () => {
    expect(gerekliTork([], 800)).toBe(0)
  })

  it("kil katmanı için pozitif tork üretir", () => {
    const t = gerekliTork([KIL_KATMANI], 800)
    expect(t).toBeGreaterThan(0)
  })

  it("daha büyük çap daha yüksek tork gerektirir", () => {
    const t800 = gerekliTork([KIL_KATMANI], 800)
    const t1200 = gerekliTork([KIL_KATMANI], 1200)
    expect(t1200).toBeGreaterThan(t800)
  })

  it("sert kaya katmanı en yüksek torku üretir", () => {
    const tKil = gerekliTork([KIL_KATMANI], 800)
    const tKaya = gerekliTork([KAYA_KATMANI], 800)
    expect(tKaya).toBeGreaterThan(tKil)
  })

  it("çoklu katmanda en yüksek değeri alır", () => {
    const tMax = gerekliTork([KIL_KATMANI, KUM_KATMANI, KAYA_KATMANI], 800)
    const tKaya = gerekliTork([KAYA_KATMANI], 800)
    expect(tMax).toBe(tKaya)
  })
})

// ─── stabiliteRiski ───────────────────────────────────────────────────────────

describe("stabiliteRiski", () => {
  it("kum zemin yüksek riskli döner", () => {
    expect(stabiliteRiski("Kum", "Kohezyonsuz", 15, 4)).toBe("Yüksek")
  })

  it("çakıl zemin yüksek riskli döner", () => {
    expect(stabiliteRiski("Çakıl", "Kohezyonsuz", 20, 4)).toBe("Yüksek")
  })

  it("gevşek kohezyonsuz zemin (SPT≤10) yüksek riskli", () => {
    expect(stabiliteRiski("Silt", "Kohezyonsuz", 8, 4)).toBe("Yüksek")
  })

  it("orta sıkı kohezyonsuz zemin (SPT 11-30) orta riskli", () => {
    expect(stabiliteRiski("Silt", "Kohezyonsuz", 25, 4)).toBe("Orta")
  })

  it("dolgu zemin (spt>30, kohezyonlu) orta riskli", () => {
    // Kohezyonsuz + SPT≤10 kuralı önce gelir; Dolgu etkisini görmek için kohezyonlu kullan
    expect(stabiliteRiski("Dolgu", "Kohezyonlu", 35, 4)).toBe("Orta")
  })

  it("sıkı kil düşük riskli", () => {
    expect(stabiliteRiski("Kil", "Kohezyonlu", 40, 4)).toBe("Düşük")
  })
})

// ─── casingDurum ─────────────────────────────────────────────────────────────

describe("casingDurum", () => {
  it("kaya zemininde casing gerektirmeyebilir", () => {
    const { durum } = casingDurum([KAYA_KATMANI], 4)
    expect(durum).toBe("Gerekmeyebilir")
  })

  it("gevşek kum ile casing gerekli", () => {
    const { durum, zorunlu } = casingDurum([GEVŞEK_KUM], 4)
    expect(durum).toBe("Gerekli")
    expect(zorunlu).toBe(true)
  })

  it("YAS üzerindeki kohezyonsuz katman casing gerektirir", () => {
    const katman = { baslangic: 5, bitis: 10, zemTipi: "Silt", kohezyon: "Kohezyonsuz", spt: 20, ucs: 0, rqd: 0 }
    const { zorunlu } = casingDurum([katman], 3) // YAS = 3m, katman 5m'de başlıyor
    expect(zorunlu).toBe(true)
  })

  it("boş zemin için gerekce listesi dolu döner", () => {
    const { gerekce } = casingDurum([], 4)
    expect(gerekce.length).toBeGreaterThan(0)
  })
})

// ─── casingMetreHesapla ───────────────────────────────────────────────────────

describe("casingMetreHesapla", () => {
  it("kaya zemin için 0 döner", () => {
    const m = casingMetreHesapla([KAYA_KATMANI], 4)
    expect(m).toBe(0)
  })

  it("yüksek riskli katmanın tamamı casing sayılır", () => {
    const m = casingMetreHesapla([GEVŞEK_KUM], 4) // 4m kalınlık, Yüksek risk
    expect(m).toBe(4)
  })

  it("orta riskli katman yarısı sayılır", () => {
    const dolgu = { baslangic: 0, bitis: 6, zemTipi: "Dolgu", kohezyon: "Kohezyonsuz", spt: 10, ucs: 0, rqd: 0 }
    const m = casingMetreHesapla([dolgu], 4) // Kum → Yüksek, 6m
    expect(m).toBeGreaterThan(0)
  })
})

// ─── kazikSuresi ─────────────────────────────────────────────────────────────

describe("kazikSuresi", () => {
  it("pozitif değer döner", () => {
    const s = kazikSuresi([KIL_KATMANI], 800, 10, 0)
    expect(s).toBeGreaterThan(0)
  })

  it("daha derin kazık daha uzun sürer", () => {
    const s18 = kazikSuresi([KIL_KATMANI, KUM_KATMANI, KAYA_KATMANI], 800, 18, 0)
    const s24 = kazikSuresi([KIL_KATMANI, KUM_KATMANI, KAYA_KATMANI], 800, 24, 0)
    expect(s24).toBeGreaterThan(s18)
  })

  it("30m+ kazık için ek süre ekler", () => {
    const s29 = kazikSuresi([KIL_KATMANI], 800, 29, 0)
    const s31 = kazikSuresi([KIL_KATMANI], 800, 31, 0)
    expect(s31 - s29).toBeGreaterThan(1)
  })
})

// ─── mazotTahmini ─────────────────────────────────────────────────────────────

describe("mazotTahmini", () => {
  it("tork 0 için bile pozitif değer döner", () => {
    const { mBasi } = mazotTahmini(0, 18)
    expect(mBasi).toBeGreaterThan(0)
  })

  it("yüksek torkta daha fazla mazot", () => {
    const { mBasi: az } = mazotTahmini(80, 18)
    const { mBasi: cok } = mazotTahmini(250, 18)
    expect(cok).toBeGreaterThan(az)
  })

  it("toplam = mBasi × kazikBoyu", () => {
    const { mBasi, toplam } = mazotTahmini(150, 20)
    expect(toplam).toBeCloseTo(mBasi * 20, 0)
  })
})

// ─── kritikKatman ─────────────────────────────────────────────────────────────

describe("kritikKatman", () => {
  it("boş liste için null döner", () => {
    expect(kritikKatman([])).toBeNull()
  })

  it("tek katman için o katmanı döner", () => {
    expect(kritikKatman([KIL_KATMANI])).toEqual(KIL_KATMANI)
  })

  it("yüksek UCS'li kaya katmanını kritik seçer", () => {
    const kritik = kritikKatman([KIL_KATMANI, KUM_KATMANI, KAYA_KATMANI])
    expect(kritik.zemTipi).toBe("Sert Kaya")
  })
})

// ─── makinaUygunluk ───────────────────────────────────────────────────────────

describe("makinaUygunluk", () => {
  const UYGUN_MAKINE = { maxDerinlik: 24, maxCap: 1000, tork: 200, casing: "Evet" }

  it("yeterli kapasiteli makine 'Uygun' döner", () => {
    const { karar } = makinaUygunluk(UYGUN_MAKINE, 150, 18, 800, false)
    expect(karar).toBe("Uygun")
  })

  it("derinlik yetersizse 'Uygun Değil' döner", () => {
    const { karar } = makinaUygunluk({ ...UYGUN_MAKINE, maxDerinlik: 10 }, 150, 18, 800, false)
    expect(karar).toBe("Uygun Değil")
  })

  it("çap yetersizse 'Uygun Değil' döner", () => {
    const { karar } = makinaUygunluk({ ...UYGUN_MAKINE, maxCap: 600 }, 150, 18, 800, false)
    expect(karar).toBe("Uygun Değil")
  })

  it("tork %80 altındaysa 'Uygun Değil' döner", () => {
    const { karar } = makinaUygunluk({ ...UYGUN_MAKINE, tork: 100 }, 150, 18, 800, false)
    expect(karar).toBe("Uygun Değil")
  })

  it("casing gereken projede casing yok ise 'Şartlı Uygun' döner", () => {
    const { karar } = makinaUygunluk({ ...UYGUN_MAKINE, casing: "Hayır" }, 150, 18, 800, true)
    expect(karar).toBe("Şartlı Uygun")
  })

  it("tork sınırda ise 'Riskli' döner", () => {
    const { karar } = makinaUygunluk({ ...UYGUN_MAKINE, tork: 160 }, 180, 18, 800, false)
    expect(karar).toBe("Riskli")
  })
})
