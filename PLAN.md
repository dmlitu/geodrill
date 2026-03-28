# GeoDrill — Development Plan

## Proje Özeti

GeoDrill, kazık sondaj projelerini yönetmek için geliştirilmiş bir geoteknik karar destek sistemidir.

**Stack:** React 19 + Vite (frontend) · FastAPI + SQLite/SQLAlchemy (backend)

---

## ✅ FAZ 1 — Backend Temel Altyapısı *(Tamamlandı)*

| Dosya | İçerik |
|-------|--------|
| `backend/requirements.txt` | Tüm bağımlılıklar (bcrypt 4.0.1 uyumluluk notu dahil) |
| `backend/database.py` | SQLAlchemy engine, SessionLocal, Base, `get_db` dependency |
| `backend/models.py` | `User`, `Project`, `SoilLayer`, `Equipment` ORM modelleri |
| `backend/schemas.py` | Pydantic request/response şemaları |
| `backend/auth.py` | bcrypt hash/verify, JWT üretimi/doğrulaması, `get_current_user` |
| `backend/routers/auth.py` | `POST /auth/login`, `GET /auth/me`, `POST /auth/register` |
| `backend/main.py` | Router entegrasyonu, DB startup, demo kullanıcı seed |
| `frontend/.env` | `VITE_API_URL=http://localhost:8000` |

**Demo kullanıcılar:** `demo/demo` · `firma1/1234` · `admin/admin123`

---

## ✅ FAZ 2 — CRUD API + Frontend Entegrasyonu *(Tamamlandı)*

### Backend — Yeni Endpoint'ler

| Endpoint | Açıklama |
|----------|----------|
| `POST /projects` | Proje oluştur |
| `GET /projects` | Kullanıcının projeleri |
| `GET /projects/{id}` | Proje detayı (zemin katmanlarıyla birlikte) |
| `PUT /projects/{id}` | Proje güncelle |
| `DELETE /projects/{id}` | Proje sil |
| `PUT /projects/{id}/soil-layers/bulk` | Zemin katmanlarını toplu kaydet |
| `GET /equipment` | Ekipman listesi |
| `PUT /equipment/bulk` | Ekipman listesini toplu kaydet |
| `POST /equipment` | Ekipman ekle |
| `PUT /equipment/{id}` | Ekipman güncelle |
| `DELETE /equipment/{id}` | Ekipman sil |

### Frontend — Değişen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `frontend/src/api.js` | Yeni — token yönetimi, tüm API çağrıları, snake/camelCase dönüşümleri |
| `frontend/src/App.jsx` | Login backend'e bağlandı; oturum token'ı localStorage'da; giriş sonrası otomatik veri yükleme |
| `frontend/src/ProjeForm.jsx` | Kaydet/Güncelle butonu, loading ve hata state'leri |
| `frontend/src/ZeminLogu.jsx` | Kaydet butonu, proje kaydedilmeden uyarı |
| `frontend/src/MakinePark.jsx` | Kaydet butonu, backend senkronizasyonu |

---

## ✅ FAZ 3 — Landing Page & Auth UI *(Tamamlandı)*

### Landing Page (`/`)
- [x] **Hero section** — ürün başlığı, kısa açıklama, CTA butonları ("Giriş Yap" / "Kayıt Ol")
- [x] **Özellikler bölümü** — tork hesabı, zemin logu, analiz, ekipman yönetimi kartları
- [x] **Nasıl çalışır?** — 3 adımlı akış (zemin gir → analiz et → rapor al)
- [x] **Footer** — proje adı, linkler
- [x] Giriş yapmış kullanıcılar direkt uygulamaya yönlendirilsin

### Sign Up Sayfası
- [x] **`RegisterPage.jsx`** — ad, e-posta, kullanıcı adı, şifre, şifre tekrar alanları
- [x] `POST /auth/register` endpoint'ine bağlan (Faz 1'de mevcut)
- [x] Başarılı kayıt sonrası otomatik login ve uygulamaya yönlendirme
- [x] Login sayfasından "Hesap oluştur" linki; Register sayfasından "Giriş yap" linki

### Login Sayfası İyileştirmeleri
- [x] Tasarım tutarlılığı (Landing ile aynı stil/renk paleti)
- [x] "← Ana Sayfa" geri linki
- [ ] "Şifremi unuttum" placeholder (Faz 7'ye ertelendi, link deaktif)

---

## ✅ FAZ 4 — Validasyon & Hata Yönetimi *(Tamamlandı)*

### Frontend Validasyonları

- [x] **ProjeForm** — Proje adı boş bırakılamaz; kazık boyu > 0, çap > 0, adet > 0; inline kırmızı border + mesaj
- [x] **ZeminLogu** — başlangıç ≥ bitiş uyarısı; SPT 0–300, UCS ≥ 0, RQD 0–100 aralık kontrolü; kazık boyunu karşılama kontrolü; `kazikBoyu` prop eklendi
- [x] **MakinePark** — makine adı boş bırakılamaz; tork, derinlik, çap > 0; inline kırmızı border + tooltip
- [x] **React Error Boundary** — AnalizSonucu çökerse kırmızı hata kutusu + "Tekrar Dene" butonu

### Backend Validasyonları

- [x] `SoilLayerCreate`'e `model_validator` eklendi: `bitis > baslangic` kontrolü
- [x] Backend validation hataları zaten `request()` wrapper'ı aracılığıyla frontend'e iletiliyor

---

## ✅ FAZ 5 — Rapor & Dışa Aktarma *(Tamamlandı)*

- [x] **PDF Raporu** — `GET /projects/{id}/report`; ReportLab ile proje özeti, zemin logu (renkli stabilite), ekipman uygunluk tablosu
- [x] **Zemin Logu CSV** — pandas ile `GET /projects/{id}/soil-layers/export`; UTF-8 BOM ile Türkçe uyumlu
- [x] **Analiz Sonucu CSV** — client-side; tork, casing, süre, yakıt + makine uygunluk verileri
- [x] **Tarayıcı baskı stili** — `@media print` CSS; sidebar/header gizle, gölge kaldır
- [x] **Butonlar** — AnalizSonucu başlığına "Analiz CSV", "Zemin CSV", "PDF Rapor", "Yazdır" butonları eklendi

---

## ✅ FAZ 6 — Görselleştirme *(Tamamlandı)*

- [x] **Zemin profili diyagramı** — SVG ile derinlik eksenli, zemin tipine göre renklendirilmiş katman çizimi; YAS ve kazık ucu işaretleri
- [x] **Tork-derinlik grafiği** — Recharts BarChart; her katman için tork değeri, zemin rengine göre renklendirilmiş barlar
- [x] **Gantt şeması** — SVG; mobilizasyon, kazık delme, bekleme/test, demobilizasyon fazları
- [x] **Senaryo karşılaştırması** — ±200/±400 mm çap değişimi için tork ve süre karşılaştırmalı Recharts BarChart; mevcut senaryo koyu renk
- [x] **`Gorseller.jsx`** — tüm görsel bileşenler ayrı dosyaya taşındı; recharts kuruldu

---

## ✅ FAZ 7 — Refactor & Kalite *(Tamamlandı)*

- [x] **`hesaplamalar.js`** — tüm hesaplama fonksiyonları ayrı modüle çıkarıldı; AnalizSonucu ve Gorseller import ediyor
- [x] **useMemo optimizasyonu** — AnalizSonucu hesapları `useMemo([zemin, proje, makineler])` ile cache'lendi
- [x] **Vitest** — 33 birim testi; gerekliTork, stabiliteRiski, casingDurum, kazikSuresi, mazotTahmini, kritikKatman, makinaUygunluk
- [x] **pytest** — 20 entegrasyon testi; auth, projects CRUD, soil layer validasyon; StaticPool ile izole in-memory DB
- [x] **Mobil sidebar** — CSS `transform` ile slide-in; overlay backdrop; hamburger butonu; kapat (✕) butonu
- [x] **Erişilebilirlik** — `role="navigation"`, `aria-label`, `aria-current="page"`, `aria-hidden`, `aria-label` (butonlar)
- [ ] **Tailwind CSS tam dönüşüm** — ~7600 satır inline stil (kapsam çok geniş, ayrı sprint gerektirir)

---

## Bilinen Eksiklikler (Sonraki Fazlarda Ele Alınacak)

| Konu | Durum |
|------|-------|
| Hesaplama formülleri dökümante değil (`* 1.25`, `* 0.80` sabitleri) | Faz 6 |
| Güvenlik katsayısı (FS) hiçbir hesapta yok | Faz 6 |
| Yakıt/ROP hesabı basitleştirilmiş (saha koşulları, rakım yok) | Faz 6 |
| Giriş denemeleri için rate-limiting yok | Faz 6 |
| CI/CD pipeline yok | Faz 6 |
| Loglama yok (backend) | Faz 6 |
| `SECRET_KEY` ortam değişkeninden alınmalı (production) | Faz 6 |

---

## Sunucu Başlatma

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Frontend (ayrı terminal)
cd frontend
npm run dev
```

API Dokümantasyonu: http://localhost:8000/docs
