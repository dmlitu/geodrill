// Tüm geoteknik hesaplama fonksiyonları — AnalizSonucu ve Gorseller tarafından kullanılır.
// Bu dosya frontend bağımlılığı olmadığından Vitest ile doğrudan test edilebilir.

export function gerekliTork(zemin, capMm) {
  const capM = capMm / 1000
  let maxTork = 0
  for (const row of zemin) {
    const spt = parseFloat(row.spt) || 0
    const ucs = parseFloat(row.ucs) || 0
    const rqd = parseFloat(row.rqd) || 0
    let tau = ucs > 0 ? (ucs * 1000) / 10 : row.kohezyon === "Kohezyonlu" ? Math.max(spt * 4, 20) : Math.max(spt * 2, 15)
    if (rqd > 0) tau *= rqd < 25 ? 1.35 : rqd < 50 ? 1.20 : rqd < 75 ? 1.10 : 1.0
    const t = tau * Math.PI * Math.pow(capM, 3) / 8 * 1.25
    if (t > maxTork) maxTork = t
  }
  return Math.round(maxTork * 10) / 10
}

export function stabiliteRiski(tip, kohezyon, spt, yas) {
  if (["Kum", "Çakıl"].includes(tip) && yas >= 0) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= 10) return "Yüksek"
  if (kohezyon === "Kohezyonsuz" && spt <= 30) return "Orta"
  if (tip === "Dolgu") return "Orta"
  return "Düşük"
}

export function casingDurum(zemin, yas) {
  const gerekce = []
  let zorunlu = false, sartli = false
  for (const row of zemin) {
    const spt = parseFloat(row.spt) || 0
    const kalinlik = row.bitis - row.baslangic
    if (["Kum", "Çakıl"].includes(row.zemTipi) && kalinlik > 0.5) { zorunlu = true; gerekce.push(`${row.baslangic}-${row.bitis}m: ${row.zemTipi} - casing zorunlu`) }
    if (row.kohezyon === "Kohezyonsuz" && yas > 0 && row.baslangic >= yas) { zorunlu = true; gerekce.push(`${row.baslangic}-${row.bitis}m: Kohezyonsuz + YAS`) }
    if (spt < 10 && row.kohezyon === "Kohezyonsuz") { zorunlu = true; gerekce.push(`${row.baslangic}-${row.bitis}m: Çok gevşek (SPT=${spt})`) }
    if (row.zemTipi === "Dolgu" && kalinlik > 2) { sartli = true; gerekce.push(`${row.baslangic}-${row.bitis}m: Kalın dolgu`) }
  }
  if (!gerekce.length) gerekce.push("Zemin koşulları casing gerektirmiyor")
  const durum = zorunlu ? "Gerekli" : sartli ? "Şartlı önerilir" : "Gerekmeyebilir"
  return { durum, gerekce, zorunlu }
}

export function casingMetreHesapla(zemin, yas) {
  let toplam = 0
  for (const row of zemin) {
    const kalinlik = row.bitis - row.baslangic
    const risk = stabiliteRiski(row.zemTipi, row.kohezyon, row.spt, yas)
    if (risk === "Yüksek") toplam += kalinlik
    else if (risk === "Orta") toplam += kalinlik * 0.5
  }
  return Math.round(toplam * 10) / 10
}

export function ropHesapla(tip, ucs, capMm) {
  const capM = capMm / 1000
  let baz = { "Dolgu": 8, "Kil": 6, "Silt": 6.5, "Kum": 5, "Çakıl": 3.5, "Ayrışmış Kaya": 2, "Kumtaşı": 1.2, "Kireçtaşı": 0.9, "Sert Kaya": 0.5 }[tip] || 3
  if (ucs > 0) baz *= Math.max(0.25, 1 - (ucs / 100) * 0.75)
  baz *= Math.max(0.45, 1 - (capM - 0.8) * 0.5)
  return Math.max(baz, 0.25)
}

export function kazikSuresi(zemin, capMm, kazikBoyu, casingM) {
  let sure = 0.75
  let ucDeg = 0
  let oncekiTip = null
  for (const row of zemin) {
    const kalinlik = row.bitis - row.baslangic
    const rop = ropHesapla(row.zemTipi, row.ucs, capMm)
    sure += kalinlik / rop
    if (["Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya"].includes(row.zemTipi) && oncekiTip !== row.zemTipi) ucDeg++
    oncekiTip = row.zemTipi
  }
  sure += ucDeg * 0.6
  sure += casingM * 0.1
  const capM = capMm / 1000
  sure += Math.PI * Math.pow(capM / 2, 2) * kazikBoyu * (20 / 60)
  if (kazikBoyu >= 30) sure += 1.5
  else if (kazikBoyu >= 20) sure += 0.8
  return Math.round(sure * 10) / 10
}

export function mazotTahmini(tork, kazikBoyu) {
  let mBasi = tork < 100 ? 8 + tork * 0.04 : tork < 200 ? 12 + (tork - 100) * 0.08 : 20 + (tork - 200) * 0.075
  mBasi = Math.round(mBasi * 10) / 10
  return { mBasi, toplam: Math.round(mBasi * kazikBoyu * 10) / 10 }
}

export function kritikKatman(zemin) {
  if (!zemin.length) return null
  return zemin.reduce((max, row) => {
    const skor = (row.spt || 0) * 0.5 + (row.ucs || 0) * 2 + (100 - (row.rqd || 0)) * 0.3
    const maxSkor = (max.spt || 0) * 0.5 + (max.ucs || 0) * 2 + (100 - (max.rqd || 0)) * 0.3
    return skor > maxSkor ? row : max
  }, zemin[0])
}

export function makinaUygunluk(makine, tork, kazikBoyu, kazikCapi, casingGerekli) {
  if (makine.maxDerinlik < kazikBoyu) return { karar: "Uygun Değil", gerekce: `Derinlik yetersiz (${makine.maxDerinlik}m < ${kazikBoyu}m)`, renk: "#DC2626", bg: "#FEF2F2" }
  if (makine.maxCap < kazikCapi) return { karar: "Uygun Değil", gerekce: `Çap yetersiz (${makine.maxCap}mm)`, renk: "#DC2626", bg: "#FEF2F2" }
  if (makine.tork < tork * 0.80) return { karar: "Uygun Değil", gerekce: `Tork yetersiz (${makine.tork} / ${tork} kNm)`, renk: "#DC2626", bg: "#FEF2F2" }
  if (casingGerekli && makine.casing === "Hayır") return { karar: "Şartlı Uygun", gerekce: "Casing yeteneği yok", renk: "#D97706", bg: "#FFFBEB" }
  if (makine.tork < tork) return { karar: "Riskli", gerekce: `Tork sınırda (${makine.tork} / ${tork} kNm)`, renk: "#D97706", bg: "#FFFBEB" }
  return { karar: "Uygun", gerekce: `Yeterli kapasite (${makine.tork} kNm)`, renk: "#16A34A", bg: "#F0FDF4" }
}
