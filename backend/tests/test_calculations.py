"""
GeoDrill Hesaplama Motoru Unit Testleri
========================================
Kritik geoteknik hesap fonksiyonlarını bağımsız olarak (DB gerektirmeden) test eder.
Her test bir mühendislik senaryosunu temsil eder.

Kapsam:
  - direnc_indeksi: tüm direnç yolları (UCS, su, CPT, SPT, fallback)
  - gerekli_tork_aralik: zemin tork bandı hesabı
  - stabilite_riski: EN 1536 §5.3 kademeleri
  - casing_durum / casing_metre: EN 1536 §5 kararları
  - rop_hesapla: penetrasyon hızı katsayıları
  - tam_cevrim_suresi: üretkenlik tahmini
  - makine_uygunluk: dört bantlı karar
  - sivi_lasma_riski: Seed & Idriss taraması
"""
import math
import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.calculations.engine import (
    gerekli_tork_aralik,
    gerekli_tork,
    stabilite_riski,
    casing_durum,
    casing_metre,
    rop_hesapla,
    tam_cevrim_suresi,
    makine_uygunluk,
    sivi_lasma_riski,
    zemin_sinifi,
)
from modules.calculations.soil_resistance import direnc_indeksi

# ─── Test yardımcıları ────────────────────────────────────────────────────────

def katman(baslangic, bitis, zem_tipi, kohezyon="Kohezyonlu",
           spt=0, ucs=0, rqd=0, su=0, cpt_qc=0):
    return {
        "baslangic": baslangic, "bitis": bitis,
        "zem_tipi": zem_tipi, "kohezyon": kohezyon,
        "spt": spt, "ucs": ucs, "rqd": rqd, "su": su, "cpt_qc": cpt_qc,
        "formasyon": "", "aciklama": "",
    }

MAKINE_STD = {
    "ad": "Test Rig", "tip": "Fore Kazık", "marka": "Bauer",
    "max_derinlik": 30.0, "max_cap": 1200, "tork": 250.0,
    "casing": "Evet", "crowd_force": 0, "dar_alan": "Hayır",
    "yakit_sinifi": "Orta", "kelly_uzunluk": 0,
}


# ─── direnc_indeksi ───────────────────────────────────────────────────────────

class TestDirencIndeksi:
    def test_kaya_ucs_olculmus(self):
        """Ölçülmüş UCS → Yol 1, Sınıf B"""
        r = direnc_indeksi(katman(10, 15, "Kumtaşı", "Kaya", ucs=20))
        assert r["source"] == "ucs"
        assert r["confidence"] == "B"
        assert r["tau_kPa"] == pytest.approx(20 * 1000 / 35, rel=0.01)

    def test_kaya_ucs_varsayilan(self):
        """UCS ölçümü yok → varsayılan UCS, Sınıf C"""
        r = direnc_indeksi(katman(10, 15, "Kumtaşı", "Kaya"))
        assert r["source"] == "ucs_varsayilan"
        assert r["confidence"] == "C"
        assert r["tau_kPa"] > 0

    def test_ayrisimis_kaya_spt_fallback(self):
        """Ayrışmış Kaya + UCS=0 + SPT>0 → granüler yol (EN ISO 14689 WD5/WD6)"""
        r = direnc_indeksi(katman(5, 10, "Ayrışmış Kaya", "Kaya", spt=15))
        assert "spt" in r["source"].lower() or "granüler" in r["source"].lower() or "ayrismis" in r["source"].lower()
        assert r["tau_kPa"] > 0

    def test_kohezyonlu_su_olculmus(self):
        """Ölçülmüş su → Yol 2, Sınıf A"""
        r = direnc_indeksi(katman(0, 5, "Kil", "Kohezyonlu", su=45))
        assert r["source"] == "su"
        assert r["confidence"] == "A"
        assert r["tau_kPa"] == 45.0

    def test_kohezyonlu_su_min_taban(self):
        """Çok küçük su → taban değer (20 kPa)"""
        r = direnc_indeksi(katman(0, 5, "Kil", "Kohezyonlu", su=5))
        assert r["tau_kPa"] >= 20.0

    def test_kohezyonlu_cpt(self):
        """CPT qc → Yol 3, Sınıf B"""
        r = direnc_indeksi(katman(0, 5, "Kil", "Kohezyonlu", cpt_qc=0.5))
        assert r["source"] == "cpt_kohezif"
        assert r["confidence"] == "B"

    def test_kohezyonlu_spt(self):
        """SPT N60 → Yol 4, Sınıf B"""
        r = direnc_indeksi(katman(0, 5, "Kil", "Kohezyonlu", spt=14))
        assert r["source"] == "spt_kohezif"
        assert r["tau_kPa"] == pytest.approx(max(14 * 4, 20), rel=0.01)

    def test_granüler_spt(self):
        """Granüler + SPT → Yol 6, Sınıf C"""
        r = direnc_indeksi(katman(0, 5, "Kum", "Kohezyonsuz", spt=20))
        assert r["source"] == "spt_granüler"
        assert r["confidence"] == "C"

    def test_fallback_veri_yok(self):
        """Hiç veri yok → fallback, Sınıf C"""
        r = direnc_indeksi(katman(0, 5, "Kil", "Kohezyonlu"))
        assert r["confidence"] == "C"
        assert r["tau_kPa"] > 0


# ─── gerekli_tork_aralik ─────────────────────────────────────────────────────

class TestGerekliTorkAralik:
    def test_bos_zemin(self):
        """Zemin yok → nominal=0"""
        r = gerekli_tork_aralik([], 800)
        assert r["nominal"] == 0

    def test_tork_pozitif(self):
        """Normal zemin → pozitif tork"""
        z = [katman(0, 18, "Kil", "Kohezyonlu", spt=14)]
        r = gerekli_tork_aralik(z, 800)
        assert r["nominal"] > 0
        assert r["min"] < r["nominal"] < r["max"]

    def test_kaya_tork_spt_den_buyuk(self):
        """Kaya katmanı, zemin katmanından daha fazla tork gerektirir"""
        z_zemin = [katman(0, 10, "Kil", "Kohezyonlu", spt=10)]
        z_kaya  = [katman(0, 10, "Kumtaşı", "Kaya", ucs=20)]
        t_zemin = gerekli_tork_aralik(z_zemin, 800)["nominal"]
        t_kaya  = gerekli_tork_aralik(z_kaya, 800)["nominal"]
        assert t_kaya > t_zemin

    def test_cap_artinca_tork_artar(self):
        """Çap büyüyünce tork artar (πD³/12 ilişkisi)"""
        z = [katman(0, 10, "Kil", "Kohezyonlu", spt=14)]
        t_800  = gerekli_tork_aralik(z, 800)["nominal"]
        t_1200 = gerekli_tork_aralik(z, 1200)["nominal"]
        assert t_1200 > t_800

    def test_yas_altinda_granüler_tork_artar(self):
        """YAS altındaki granüler zemin → K_gw katsayısı tork artırır"""
        z = [katman(5, 15, "Kum", "Kohezyonsuz", spt=20)]
        t_kuru = gerekli_tork_aralik(z, 800, yas=0)["nominal"]
        t_yas  = gerekli_tork_aralik(z, 800, yas=3)["nominal"]
        assert t_yas > t_kuru

    def test_guven_sinifi_propagasyonu(self):
        """CPT verisi olan katman → Sınıf B döner"""
        z = [katman(0, 10, "Kil", "Kohezyonlu", cpt_qc=0.8)]
        r = gerekli_tork_aralik(z, 800)
        assert r["guven"] in ("A", "B")

    def test_formula_katsayi(self):
        """T = τ × πD³/12 × K_app formül doğrulama (K=1, su=50 kPa, D=0.8m)"""
        z = [katman(0, 5, "Kil", "Kohezyonlu", su=50)]
        r = gerekli_tork_aralik(z, 800, is_tipi="Fore Kazık", yas=0)
        tau = 50.0  # su=50, min=20 → su kullanılır
        cap = 0.8
        k_app = 1.67
        beklenen = tau * (math.pi * cap**3 / 12) * k_app * 1.0 * 1.0 * 1.0 * 1.0
        assert r["nominal"] == pytest.approx(beklenen, rel=0.05)


# ─── stabilite_riski ─────────────────────────────────────────────────────────

class TestStabiliteRiski:
    def test_kum_yas_ustunde(self):
        assert stabilite_riski("Kum", "Kohezyonsuz", 20, 5.0, baslangic=0) == "Orta"

    def test_kum_yas_altinda(self):
        assert stabilite_riski("Kum", "Kohezyonsuz", 20, 5.0, baslangic=6) == "Yüksek"

    def test_organik_kil_her_zaman_yuksek(self):
        assert stabilite_riski("Organik Kil", "Kohezyonlu", 0, 0) == "Yüksek"

    def test_torf_her_zaman_yuksek(self):
        assert stabilite_riski("Torf", "Kohezyonlu", 0, 0) == "Yüksek"

    def test_yumusak_kil_en1536(self):
        """su < 15 kPa → EN 1536 §5.3 Yüksek risk"""
        assert stabilite_riski("Kil", "Kohezyonlu", 0, 0, su=10) == "Yüksek"

    def test_kil_su_orta(self):
        """15 ≤ su < 40 → Orta"""
        assert stabilite_riski("Kil", "Kohezyonlu", 0, 0, su=25) == "Orta"

    def test_kil_su_dusuk(self):
        """su ≥ 40 → Düşük"""
        assert stabilite_riski("Kil", "Kohezyonlu", 0, 0, su=60) == "Düşük"

    def test_cok_gevsek_kohezyonsuz(self):
        """SPT ≤ 10 kohezyonsuz, YAS üstü → Orta (granüler YAS üstünde Orta)"""
        # Kum YAS üstünde → Orta (YAS altı kontrolü baslangic/yas ile)
        assert stabilite_riski("Kum", "Kohezyonsuz", 8, yas=10, baslangic=0) == "Orta"

    def test_sert_kaya_dusuk(self):
        assert stabilite_riski("Sert Kaya", "Kaya", 0, 0) == "Düşük"

    def test_dolgu_yuksek_spt_dusuk(self):
        """Dolgu SPT < 5 → Yüksek risk"""
        assert stabilite_riski("Dolgu", "Kohezyonsuz", 3, 0) == "Yüksek"


# ─── casing_durum ────────────────────────────────────────────────────────────

class TestCasingDurum:
    def test_kum_gerekli(self):
        """Kum katmanı > 0.5 m → Gerekli"""
        z = [katman(0, 5, "Kum", "Kohezyonsuz", spt=20)]
        r = casing_durum(z, 3.0)
        assert r["durum"] == "Gerekli"
        assert r["zorunlu"] is True

    def test_sert_kaya_gerekmeyebilir(self):
        """Sert kaya tek başına → casing gerekmez"""
        z = [katman(0, 15, "Sert Kaya", "Kaya", ucs=80)]
        r = casing_durum(z, 0.0)
        assert r["zorunlu"] is False

    def test_organik_kil_zorunlu(self):
        z = [katman(0, 5, "Organik Kil", "Kohezyonlu")]
        r = casing_durum(z, 0.0)
        assert r["zorunlu"] is True

    def test_torf_zorunlu(self):
        z = [katman(0, 3, "Torf", "Kohezyonlu")]
        r = casing_durum(z, 0.0)
        assert r["zorunlu"] is True

    def test_yumusak_kil_yas_altinda_zorunlu(self):
        """Yumuşak kil (su<25) YAS altında → sıkışma riski → zorunlu"""
        z = [katman(5, 12, "Kil", "Kohezyonlu", su=15)]
        r = casing_durum(z, 3.0)  # YAS = 3m, katman 5m'den başlıyor
        assert r["zorunlu"] is True

    def test_cok_gevsek_kohezyonsuz_zorunlu(self):
        z = [katman(0, 5, "Kum", "Kohezyonsuz", spt=5)]
        r = casing_durum(z, 0.0)
        assert r["zorunlu"] is True

    def test_kil_derin_gerekmeyebilir(self):
        """Sert kil, YAS üstü → casing gerekmeyebilir"""
        z = [katman(0, 15, "Kil", "Kohezyonlu", spt=25)]
        r = casing_durum(z, 20.0)  # YAS çok derin
        assert r["durum"] in ("Gerekmeyebilir", "Şartlı önerilir")


# ─── rop_hesapla ─────────────────────────────────────────────────────────────

class TestRopHesapla:
    def test_kil_pozitif(self):
        assert rop_hesapla("Kil", 0, 800) > 0

    def test_sert_kaya_kil_den_yavas(self):
        rop_kil  = rop_hesapla("Kil", 0, 800)
        rop_kaya = rop_hesapla("Sert Kaya", 80, 800)
        assert rop_kaya < rop_kil

    def test_ucs_artinca_rop_azalir(self):
        r_dusuk = rop_hesapla("Kumtaşı", 10, 800)
        r_yuksek = rop_hesapla("Kumtaşı", 80, 800)
        assert r_yuksek < r_dusuk

    def test_cap_artinca_rop_azalir(self):
        r_800  = rop_hesapla("Kil", 0, 800)
        r_1200 = rop_hesapla("Kil", 0, 1200)
        assert r_1200 < r_800

    def test_yas_altinda_granüler_yavas(self):
        r_kuru = rop_hesapla("Kum", 0, 800, spt=20, yas=0, baslangic=0)
        r_yas  = rop_hesapla("Kum", 0, 800, spt=20, yas=3, baslangic=5)
        assert r_yas < r_kuru

    def test_min_rop_sifir_degil(self):
        """UCS=200 MPa en sert kaya → min_rop tabanını geçmez"""
        r = rop_hesapla("Sert Kaya", 200, 1600)
        assert r >= 0.20

    def test_spt_yogun_granüler_azaltma(self):
        """SPT > 30 → yoğun granüler azaltma uygulanır"""
        r_gevsek = rop_hesapla("Kum", 0, 800, spt=15)
        r_yogun  = rop_hesapla("Kum", 0, 800, spt=50)
        assert r_yogun < r_gevsek


# ─── tam_cevrim_suresi ───────────────────────────────────────────────────────

class TestTamCevrimSuresi:
    def test_pozitif_degerler(self):
        z = [katman(0, 18, "Kil", "Kohezyonlu", spt=14)]
        cs = tam_cevrim_suresi(z, 800, 18, 0)
        assert cs["t_toplam_cevrim"] > 0
        assert cs["t_delme"] > 0
        assert cs["gunluk_uretim_adet"] >= 1  # asla sıfır olmamalı

    def test_yumusak_zemin_birden_fazla_gun(self):
        """Tipik 18m zemin profili → 2+ kazık/gün"""
        z = [
            katman(0, 3,  "Dolgu", "Kohezyonsuz", spt=8),
            katman(3, 10, "Kil",   "Kohezyonlu",  spt=14),
            katman(10, 18, "Kum",  "Kohezyonsuz", spt=22),
        ]
        cs = tam_cevrim_suresi(z, 800, 18, 4)
        assert cs["gunluk_uretim_adet"] >= 2

    def test_sert_kaya_en_az_bir(self):
        """Uzun kaya kazık bile günlük üretim ≥ 1 olmalı"""
        z = [katman(0, 20, "Sert Kaya", "Kaya", ucs=100)]
        cs = tam_cevrim_suresi(z, 1000, 20, 0)
        assert cs["gunluk_uretim_adet"] >= 1

    def test_derin_kazik_ek_sure(self):
        """30m kazık, 18m kazıktan daha uzun toplam süre"""
        z_18 = [katman(0, 18, "Kil", "Kohezyonlu", spt=14)]
        z_30 = [katman(0, 30, "Kil", "Kohezyonlu", spt=14)]
        cs_18 = tam_cevrim_suresi(z_18, 800, 18, 0)
        cs_30 = tam_cevrim_suresi(z_30, 800, 30, 0)
        assert cs_30["t_toplam_cevrim"] > cs_18["t_toplam_cevrim"]

    def test_kaya_gecis_alet_degisimi(self):
        """Zemin→kaya geçişi → alet değişim süresi eklenir"""
        z_tekkat = [katman(0, 15, "Kaya", "Kaya", ucs=30)]
        z_gecis  = [
            katman(0, 5,  "Kil",     "Kohezyonlu", spt=14),
            katman(5, 15, "Kumtaşı", "Kaya",       ucs=30),
        ]
        # Her iki profil aynı ROP ile hesaplanır ama geçişli profil alet değişimi ekler
        cs_tekkat = tam_cevrim_suresi(z_tekkat, 800, 15, 0)
        cs_gecis  = tam_cevrim_suresi(z_gecis, 800, 15, 0)
        # Geçişli profil alet değişimi nedeniyle daha uzun veya eşit olmalı
        assert cs_gecis["t_delme"] >= cs_tekkat["t_delme"] - 0.1


# ─── makine_uygunluk ─────────────────────────────────────────────────────────

class TestMakineUygunluk:
    def test_guçlü_makine_rahat_uygun(self):
        z = [katman(0, 18, "Kil", "Kohezyonlu", spt=14)]
        r = gerekli_tork_aralik(z, 800)
        tork = r["nominal"]
        makine = {**MAKINE_STD, "tork": tork * 2.0}  # 2× kapasite
        sonuc = makine_uygunluk(makine, tork, 18, 800, False)
        assert sonuc["karar"] in ("Rahat Uygun", "Uygun")

    def test_zayif_makine_uygun_degil(self):
        z = [katman(0, 18, "Kumtaşı", "Kaya", ucs=30)]
        r = gerekli_tork_aralik(z, 800)
        tork = r["nominal"]
        makine = {**MAKINE_STD, "tork": tork * 0.5}  # yarım kapasite
        sonuc = makine_uygunluk(makine, tork, 18, 800, False)
        assert sonuc["karar"] == "Uygun Değil"

    def test_derinlik_yetersiz_uygun_degil(self):
        makine = {**MAKINE_STD, "max_derinlik": 15.0}
        sonuc = makine_uygunluk(makine, 100, 25, 800, False)
        assert sonuc["karar"] == "Uygun Değil"

    def test_kelly_bar_yetersiz_uygun_degil(self):
        makine = {**MAKINE_STD, "kelly_uzunluk": 20.0}
        sonuc = makine_uygunluk(makine, 100, 25, 800, False)
        assert sonuc["karar"] == "Uygun Değil"
        assert any("kelly" in s.lower() for s in sonuc["red_sebepler"])

    def test_casing_gerekliyse_casing_yok_uygun_degil(self):
        makine = {**MAKINE_STD, "casing": "Hayır"}
        sonuc = makine_uygunluk(makine, 100, 18, 800, casing_gerekli=True)
        assert sonuc["karar"] == "Uygun Değil"

    def test_yontem_uyumsuz_uygun_degil(self):
        makine = {**MAKINE_STD, "tip": "Ankraj"}
        sonuc = makine_uygunluk(makine, 100, 18, 800, False, is_tipi="Fore Kazık")
        assert sonuc["karar"] == "Uygun Değil"

    def test_tork_orani_hesabi(self):
        """tork_orani = makine.tork / gerekli_tork"""
        sonuc = makine_uygunluk(MAKINE_STD, 200, 20, 800, False)
        assert sonuc["tork_oran"] == pytest.approx(250 / 200, rel=0.02)


# ─── sivi_lasma_riski ────────────────────────────────────────────────────────

class TestSiviLasmaRiski:
    def test_granüler_yas_altinda_spt_dusuk(self):
        r = sivi_lasma_riski("Kum", "Kohezyonsuz", 6, yas=3, baslangic=5)
        assert r == "Yüksek"

    def test_granüler_yas_ustunde(self):
        r = sivi_lasma_riski("Kum", "Kohezyonsuz", 6, yas=10, baslangic=0)
        assert r == "Yok"

    def test_kohezyonlu_yok(self):
        r = sivi_lasma_riski("Kil", "Kohezyonlu", 14, yas=3, baslangic=5)
        assert r == "Yok"

    def test_derin_katman_yok(self):
        """baslangic > 20m → Yok"""
        r = sivi_lasma_riski("Kum", "Kohezyonsuz", 8, yas=3, baslangic=22)
        assert r == "Yok"

    def test_spt_orta_aralik(self):
        """SPT 15-24 → Orta risk"""
        r = sivi_lasma_riski("Kum", "Kohezyonsuz", 20, yas=3, baslangic=5)
        assert r == "Orta"

    def test_spt_yuksek_dusuk_risk(self):
        """SPT ≥ 25 → Düşük risk"""
        r = sivi_lasma_riski("Çakıl", "Kohezyonsuz", 25, yas=3, baslangic=5)
        assert r == "Düşük"


# ─── zemin_sinifi ─────────────────────────────────────────────────────────────

class TestZeminSinifi:
    def test_bilinen_tipler(self):
        assert zemin_sinifi("Kil", "Kohezyonlu") == "kohezyonlu"
        assert zemin_sinifi("Silt", "Kohezyonlu") == "kohezyonlu"
        assert zemin_sinifi("Organik Kil", "Kohezyonlu") == "kohezyonlu"
        assert zemin_sinifi("Torf", "Kohezyonlu") == "kohezyonlu"
        assert zemin_sinifi("Kum", "Kohezyonsuz") == "granüler"
        assert zemin_sinifi("Çakıl", "Kohezyonsuz") == "granüler"
        assert zemin_sinifi("Dolgu", "Kohezyonsuz") == "granüler"
        assert zemin_sinifi("Kumtaşı", "Kaya") == "kaya"
        assert zemin_sinifi("Kireçtaşı", "Kaya") == "kaya"
        assert zemin_sinifi("Sert Kaya", "Kaya") == "kaya"
        assert zemin_sinifi("Ayrışmış Kaya", "Kaya") == "kaya"
