# GeoDrill — Delgi Süresi Hesap Metodolojisi

**Revizyon:** v3.3 (Nisan 2026)  
**Güven Sınıfı:** C — Saha verisiyle kalibre edilmesini önerir  
**Kaynaklar:** FHWA GEC 10 (2010), EN 1536:2010, Zayed & Halpin (2005), EFFC/DFI Üretkenlik Raporu 2019

---

## 1. Genel Çerçeve

Sistem, kazık başına iki ayrı süre hesaplar:

| Çıktı | İçerik | Kullanım amacı |
|---|---|---|
| **Delgi Süresi** | Yalnızca delme operasyonu (dönme + ilerleme) | Ekipman seçimi, yakıt tahmini |
| **Tam Çevrim Süresi** | Delme + beton + donatı + casing + lojistik + beklenmedik | Üretim planlaması, gün/kazık tahmini |

**Önemli:** Bu iki değer birbirinden bağımsız gösterilir; karıştırılmamalıdır.

---

## 2. Penetrasyon Hızı (ROP) Modeli

### 2.1 Temel yapı

Her zemin katmanı için penetrasyon hızı aşağıdaki zinciriyle hesaplanır:

```
ROP_katman = BAZ_ROP × F_UCS × F_RQD × F_Çap × F_SPT × F_YAS
```

Katman delme süresi:

```
t_katman = Katman_kalınlığı (m) / ROP_katman (m/saat)
```

Toplam delgi süresi = tüm katmanların `t_katman` değerlerinin toplamı.

> **Not:** En yavaş katmanın hızı tüm pile yayılmaz. Her katman yalnızca kendi derinlik aralığını etkiler.

---

### 2.2 Taban ROP Değerleri

Ø800 mm referans çapında, zemin sınıflandırmasına göre taban hız değerleri:

| Zemin Tipi | Taban ROP (m/saat) | Temsil ettiği durum |
|---|---|---|
| Dolgu | 15.0 | Gevşek, karışık dolgu |
| Kil | 12.0 | Yumuşak–orta kil (SPT 5–20) |
| Silt | 13.0 | Siltli zemin, düşük kohezyon |
| Kum | 12.0 | Gevşek–orta kum |
| Çakıl | 6.0 | Çakıl — takım aşınması riski |
| Ayrışmış Kaya | 5.0 | Tam ayrışmış kaya (WD5/WD6), UCS < 15 MPa |
| Kumtaşı | 4.0 | Zayıf–orta kumtaşı; UCS girilince azaltılır |
| Kireçtaşı | 2.5 | Orta kireçtaşı; UCS girilince azaltılır |
| Sert Kaya | 2.0 | UCS verisi yok durumu için baz |
| Organik Kil | 2.0 | Yüksek plastisite, gaz riski |
| Torf | 1.5 | Çok sıkıştırılabilir, instabil |

**Kalibrasyon notu:** Kaya taban değerleri "UCS ölçümü yok, standart saha koşulu" varsayımına göre ayarlanmıştır. UCS girildiğinde power-law modeli bu baz değerden geriye doğru azaltma uygular.

---

### 2.3 UCS Azaltma Faktörü — Kaya Katmanları

Kaya sınıfındaki katmanlar için (`Kumtaşı`, `Kireçtaşı`, `Sert Kaya`, `Ayrışmış Kaya`):

```
F_UCS = max( 0.20,  (UCS_ref / max(UCS, UCS_ref)) ^ n )
```

**Parametreler:**

| Sembol | Değer | Açıklama |
|---|---|---|
| `UCS_ref` | 40 MPa | Referans UCS — bu değerin altında ceza uygulanmaz |
| `n` | 0.55 | Güç-yasa üssü (boyutsuz) |
| Minimum faktör | 0.20 | Çok yüksek UCS'de ROP tabanı |

**Örnek hesaplar:**

| UCS (MPa) | Faktör | Kireçtaşı ROP (m/saat) |
|---|---|---|
| 0 (ölçülmemiş) | 1.00 | 2.50 (taban) |
| 20 | 1.00 | 2.50 (ceza yok, UCS < ref) |
| 40 | 1.00 | 2.50 (tam referans) |
| 60 | 0.80 | 2.00 |
| 80 | 0.68 | 1.71 |
| 100 | 0.61 | 1.52 |
| 150 | 0.50 | 1.26 |

**Kaynak:** Warren (1987); Winters et al. (1987); Zijsling (1987) PDC/roller-cone bit performansı; FHWA GEC 10 §7.

> **Önceki sürümle fark:** v3.2 ve öncesinde frontend'de doğrusal model kullanılıyordu (`F_UCS = 1 − UCS/100 × 0.75`). UCS=60 MPa için bu `×0.55` faktör veriyordu; aynı durum için güç-yasa modeli `×0.80` verir. Kaya katmanlarında hesaplanan delme süresinde ~%30–50 iyileşme sağlar.

---

### 2.4 RQD Azaltma Faktörü — Kaya Katmanları

RQD (Rock Quality Designation) girilmişse ek bir azaltma uygulanır:

```
F_RQD = max( 0.60,  1 − RQD × 0.004 )
```

**Mantık:** Yüksek RQD = sağlam, masif kaya = yüzey kesmesi daha zordur.

| RQD (%) | Faktör | Açıklama |
|---|---|---|
| 0 (girilmemiş) | 1.00 | Veri yok → ceza yok (standart saha varsayımı) |
| 25 | 0.90 | Parçalı kaya, görece kolay kesme |
| 50 | 0.80 | Orta kaliteli kaya |
| 75 | 0.70 | İyi kaliteli kaya |
| 100 | 0.60 | Masif, çok sağlam kaya |

> **Dikkat:** RQD girilmediğinde (0 veya boş) ceza uygulanmaz. Bu, "worst-case" değil, standart saha varsayımıdır. Sırt verisine sahip projeler için RQD girilmesi önerilir.

---

### 2.5 Çap Azaltma Faktörü

Ø800 mm referans çapı üzerindeki büyük çaplarda ilerleme hızı düşer:

```
F_Çap = max( 0.40,  1 − (D_m − 0.80) × 0.50 )
```

| Çap (mm) | Faktör | Açıklama |
|---|---|---|
| 600 | 1.10 | Küçük çap, hızlı |
| 800 | 1.00 | Referans |
| 1000 | 0.90 | −10% |
| 1200 | 0.80 | −20% |
| 1600 | 0.60 | −40% |
| ≥2000 | 0.40 | Alt sınır |

---

### 2.6 SPT Azaltma Faktörü — Granüler Katmanlar

Yalnızca `Kum`, `Çakıl`, `Dolgu` sınıfındaki katmanlara, SPT N > 30 ise uygulanır:

```
F_SPT = max( 0.40,  1 − (N − 30) × 0.008 )
```

| SPT N | Faktör | Kum ROP (m/saat) |
|---|---|---|
| ≤ 30 | 1.00 | 12.0 (taban) |
| 40 | 0.92 | 11.0 |
| 50 | 0.84 | 10.1 |
| 75 | 0.64 | 7.7 |
| 100 | 0.44 | 5.3 |

> SPT azaltma faktörü 0.40'ın altına düşmez. Çok yoğun kumda bile 4.8 m/saat tabanı korunur.

---

### 2.7 Yeraltı Suyu Düzeltmesi (YAS)

Katman YAS altındaysa (`başlangıç_derinliği ≥ YAS_derinliği`):

| Zemin sınıfı | ROP faktörü | Gerekçe |
|---|---|---|
| Kohezyonlu (Kil, Silt) | 0.92 | Yumuşama ve süspansiyon |
| Granüler (Kum, Çakıl) | 0.85 | Göçme riski, moloz oluşumu |
| Kaya | 0.95 | Yıkama etkisi ihmal edilebilir |

YAS derinliği girilmemişse (0) düzeltme uygulanmaz.

---

## 3. Tam Çevrim Süresi Modeli

Delgi süresi çevrim süresinin yalnızca bir bileşenidir. Tam çevrim:

```
t_çevrim = t_delme + t_beton + t_donatı + t_casing
         + t_kurulum + t_rekonumlama + t_beklenmedik
```

### Bileşen değerleri

| Bileşen | Değer | Kaynak |
|---|---|---|
| `t_beton` | 0.025 saat/m | Modern beton pompası (30–50 m³/saat), tremie kurulum dahil |
| `t_donatı` | 0.025 saat/m | Donatı kafesi vinçle indirilmesi |
| `t_casing` | 0.10 saat/m | Muhafaza borusu kurulumu |
| `t_kurulum` | 0.25 saat/kazık | Rig konumlandırma + setup |
| `t_rekonumlama` | 0.20 saat/kazık | Bir sonraki kazık pozisyonuna geçiş |
| `t_beklenmedik` | (t_delme + t_beton + t_donatı) × 0.08 | %8 acil durum payı |

### Alet değişim eki

Zemin katmanından kaya katmanına ilk geçişte (`Kumtaşı`, `Kireçtaşı`, `Sert Kaya`):

```
t_alet_degisim = 0.50 saat (Kelly kova → kaya kesici, geçiş başına)
```

### Derinlik eki (rod bağlantısı)

| Kazık boyu | Ek süre |
|---|---|
| < 20 m | 0.00 saat |
| 20–29 m | 0.10 saat |
| 30–39 m | 0.30 saat |
| ≥ 40 m | 0.50 saat |

### Günlük üretim

```
Günlük üretim (adet) = floor( 10.0 saat / t_çevrim )
Kazık başı gün       = t_çevrim / 10.0
```

Günlük çalışma süresi 10 saat (Türkiye standart 1-vardiya).

---

## 4. Sayısal Örnek

**Proje:** Ø800 mm, L = 13 m, yeraltı suyu yok

**Zemin profili:**

| Derinlik | Zemin | SPT | UCS (MPa) | RQD (%) |
|---|---|---|---|---|
| 0–5 m | Kil | 15 | — | — |
| 5–13 m | Kireçtaşı | — | 60 | — |

**Adım 1 — ROP hesabı:**

*Kil (0–5 m):*
- Taban: 12.0 m/saat
- F_UCS: yok (UCS girilmemiş)
- F_SPT: yok (SPT=15 < eşik 30)
- F_Çap: 1.0 (Ø800mm referans)
- **ROP = 12.0 m/saat**

*Kireçtaşı (5–13 m):*
- Taban: 2.5 m/saat
- F_UCS: (40/60)^0.55 = 0.80
- F_RQD: girilmemiş → 1.0
- F_Çap: 1.0
- **ROP = 2.5 × 0.80 = 2.0 m/saat**

**Adım 2 — Katman delme süreleri:**

| Katman | Kalınlık | ROP | Süre katkısı |
|---|---|---|---|
| Kil | 5 m | 12.0 m/saat | **0.42 saat** |
| Kireçtaşı | 8 m | 2.0 m/saat | **4.00 saat** |
| **Toplam delme** | 13 m | — | **4.42 saat** |

**Adım 3 — Tam çevrim:**

| Bileşen | Süre |
|---|---|
| Delme | 4.42 saat |
| Beton (13 m × 0.025) | 0.33 saat |
| Donatı (13 m × 0.025) | 0.33 saat |
| Casing (0 m) | 0.00 saat |
| Kurulum | 0.25 saat |
| Rekonumlama | 0.20 saat |
| Alet değişimi (1 kez) | 0.50 saat |
| Beklenmedik (%8) | 0.41 saat |
| **Toplam çevrim** | **6.44 saat** |

**Sonuç:** ~1.5 kazık/gün (10 saatlik vardiyada)

---

## 5. Model Güven Sınıfı ve Sınırlamalar

Tüm ROP katsayıları **Sınıf C** (kalitatif/ampirik) güven düzeyindedir:

| Sınırlama | Açıklama |
|---|---|
| Takım tipi modellenmedi | Kelly kova ve kaya kesici için ayrı kalibrasyon yok |
| Rig gücü etkisi yok | Farklı rig sınıfları (150 kNm vs 300 kNm) ayırt edilmiyor |
| Karst ve boşluklar | Kireçtaşı için boşluk geçişi modellenmedi |
| Sıcaklık/mevsim | Kış koşulları, don vb. etkiler yok |
| Yoğunlaşma yok | Birden fazla geçici casing kullanımı modellenmedi |

**Öneri:** Şantiyeden ilk 5–10 kazık verisi alındıktan sonra `KATSAYILAR.rop.baz` değerlerini gerçek hız ölçümleriyle kalibre edin. Tüm katsayılar tek bir konfigürasyon dosyasında (`configs/geotech_coefficients.py` ve `hesaplamalar.js → KATSAYILAR.rop`) toplanmıştır.

---

## 6. Formüller Özet Tablosu

| Adım | Formül | Uygulama koşulu |
|---|---|---|
| Taban ROP | `BAZ[zemin_tipi]` | Her katman |
| UCS (kaya) | `× max(0.20, (40/max(UCS,40))^0.55)` | Kaya + UCS > 0 |
| UCS (kaya değil) | `× max(0.25, 1 − UCS/100 × 0.75)` | Kaya dışı + UCS > 0 |
| RQD (kaya) | `× max(0.60, 1 − RQD × 0.004)` | Kaya + RQD > 0 |
| Çap | `× max(0.40, 1 − (D_m − 0.80) × 0.50)` | Her zaman |
| SPT (granüler) | `× max(0.40, 1 − (N−30) × 0.008)` | Granüler + N > 30 |
| YAS (kaya) | `× 0.95` | Kaya + derinlik ≥ YAS |
| YAS (kohezyonlu) | `× 0.92` | Kohezyon + derinlik ≥ YAS |
| YAS (granüler) | `× 0.85` | Granüler + derinlik ≥ YAS |
| Katman süresi | `t = kalınlık / ROP` | Her katman |
| Toplam delgi | `Σ t_katman + t_alet_deg + t_derinlik_eki` | Tüm katmanlar |
