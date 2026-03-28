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

## 🔲 FAZ 3 — Validasyon & Hata Yönetimi *(Sıradaki)*

### Frontend Validasyonları

- [ ] **ProjeForm** — Proje adı boş bırakılamaz; kazık boyu > 0, çap > 0, adet > 0 zorunlu
- [ ] **ZeminLogu** — başlangıç ≥ bitiş uyarısı; katmanlar arası boşluk/çakışma tespiti; SPT 0–300, UCS ≥ 0, RQD 0–100 aralık kontrolü; katman toplamının kazık boyunu karşılaması kontrolü
- [ ] **MakinePark** — makine adı boş bırakılamaz; tork, derinlik, çap > 0 kontrolü
- [ ] **React Error Boundary** — herhangi bir hesap hatası tüm sayfayı çökertmesin

### Backend Validasyonları

- [ ] Pydantic şemalarına `validator` ekle: `bitis > baslangic` kontrolü soil layer'da
- [ ] Backend'den dönen validation hatalarını frontend'de okunabilir şekilde göster

---

## 🔲 FAZ 4 — Rapor & Dışa Aktarma

- [ ] **PDF Raporu** — `GET /projects/{id}/report` endpoint'i; ReportLab ile proje özeti, zemin logu, analiz sonuçları
- [ ] **Zemin Logu CSV/Excel** — pandas ile `GET /projects/{id}/soil-layers/export`
- [ ] **Analiz Sonucu CSV** — tork, süre, yakıt verilerini export et
- [ ] **Tarayıcı baskı stili** — `@media print` CSS

---

## 🔲 FAZ 5 — Görselleştirme

- [ ] **Zemin profili diyagramı** — derinliğe göre renklendirilmiş katman çizimi (SVG veya Canvas)
- [ ] **Tork-derinlik grafiği** — her katman için hesaplanan tork değerinin grafiği (Recharts)
- [ ] **Gantt şeması** — toplam proje zaman çizelgesi
- [ ] **Senaryo karşılaştırması** — farklı ekipman/çap kombinasyonlarını yan yana kıyasla

---

## 🔲 FAZ 6 — Refactor & Kalite

- [ ] **Tailwind CSS** — ~7600 satır inline stili Tailwind class'larıyla değiştir
- [ ] **useMemo optimizasyonu** — AnalizSonucu her render'da tüm hesapları yeniden yapıyor
- [ ] **Vitest** — AnalizSonucu hesaplama fonksiyonları için birim testleri
- [ ] **pytest** — backend API için entegrasyon testleri
- [ ] **Mobil uyumluluk** — 900–1000px min-width tablolar, kapanmayan sidebar
- [ ] **Erişilebilirlik** — ARIA label, klavye navigasyonu

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
