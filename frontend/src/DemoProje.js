// Demo proje verisi — ilk giriş modalında "Demo Proje Yükle" ile kullanılır
export const DEMO_PROJE = {
  projeAdi: "Kadıköy Metro İstasyonu Temel Kazıkları",
  projeKodu: "KDK-2024-001",
  sahaKodu: "S-04",
  lokasyon: "Kadıköy, İstanbul",
  isTipi: "Fore Kazık",
  kazikBoyu: 24,
  kazikCapi: 800,
  kazikAdedi: 48,
  yeraltiSuyu: 6,
}

export const DEMO_ZEMIN = [
  { id: 1, baslangic: 0, bitis: 3, formasyon: "Dolgu", zemTipi: "Dolgu", kohezyon: "Kohezyonsuz", spt: 8, ucs: 0, rqd: 0, aciklama: "Yüzey dolgusu" },
  { id: 2, baslangic: 3, bitis: 8, formasyon: "Alüvyon", zemTipi: "Kil", kohezyon: "Kohezyonlu", spt: 12, ucs: 0, rqd: 0, aciklama: "Yumuşak kil" },
  { id: 3, baslangic: 8, bitis: 14, formasyon: "Alüvyon", zemTipi: "Kum", kohezyon: "Kohezyonsuz", spt: 22, ucs: 0, rqd: 0, aciklama: "Orta sıkı kum" },
  { id: 4, baslangic: 14, bitis: 19, formasyon: "Alüvyon", zemTipi: "Çakıl", kohezyon: "Kohezyonsuz", spt: 38, ucs: 0, rqd: 0, aciklama: "Sıkı çakıl" },
  { id: 5, baslangic: 19, bitis: 24, formasyon: "Trakya Formasyonu", zemTipi: "Ayrışmış Kaya", kohezyon: "Kaya", spt: 50, ucs: 8, rqd: 35, aciklama: "Ayrışmış şist" },
]

export const DEMO_MAKINELER = [
  { id: 1, ad: "Bauer BG 18", tip: "Fore Kazık", marka: "Bauer BG 18", maxDerinlik: 28, maxCap: 1200, tork: 180, casing: "Evet", darAlan: "Hayır", yakitSinifi: "Orta", not: "Ana rig" },
  { id: 2, ad: "Soilmec SR-30", tip: "Fore Kazık", marka: "Soilmec SR-30", maxDerinlik: 36, maxCap: 1500, tork: 260, casing: "Evet", darAlan: "Hayır", yakitSinifi: "Yüksek", not: "Yedek rig" },
  { id: 3, ad: "Junttan PMx22", tip: "Fore Kazık", marka: "Junttan PMx22", maxDerinlik: 24, maxCap: 800, tork: 130, casing: "Hayır", darAlan: "Evet", yakitSinifi: "Düşük", not: "Dar alan" },
]
