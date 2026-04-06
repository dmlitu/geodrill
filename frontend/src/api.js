const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
const REQUEST_TIMEOUT_MS = 30_000

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem("gd_token")
}

export function setToken(token) {
  localStorage.setItem("gd_token", token)
}

export function clearToken() {
  localStorage.removeItem("gd_token")
}

// ─── Unauthorized callback ─────────────────────────────────────────────────────
// Register a handler from App.jsx so 401s trigger a soft React logout
// instead of window.location.reload() which destroys all component state.

let _onUnauthorized = null
export function setOnUnauthorized(fn) {
  _onUnauthorized = fn
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function _doFetch(path, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, { ...options, signal: controller.signal })
  } catch (err) {
    if (err.name === "AbortError") throw new Error("İstek zaman aşımına uğradı (30 s). Bağlantınızı kontrol edin.")
    if (!navigator.onLine) throw new Error("İnternet bağlantısı yok.")
    throw new Error("Sunucuya ulaşılamıyor. Lütfen daha sonra tekrar deneyin.")
  } finally {
    clearTimeout(timer)
  }
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { "Content-Type": "application/json", ...options.headers }
  if (token) headers["Authorization"] = `Bearer ${token}`

  let res = await _doFetch(path, { ...options, headers })

  // 1 retry on transient server errors (502/503/504)
  if (res.status >= 500) {
    await new Promise(r => setTimeout(r, 1000))
    res = await _doFetch(path, { ...options, headers })
  }

  if (res.status === 401) {
    clearToken()
    if (_onUnauthorized) _onUnauthorized()
    throw new Error("Oturum süresi doldu. Lütfen tekrar giriş yapın.")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Sunucu hatası (HTTP ${res.status})`)
  }

  if (res.status === 204) return null
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || "Giriş başarısız")
  }
  const data = await res.json()
  setToken(data.access_token)
  return data
}

export function logout() {
  clearToken()
}

export async function register(username, email, fullName, password) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, full_name: fullName, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || "Kayıt başarısız")
  }
  return res.json()
}

export async function getMe() {
  return request("/auth/me")
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects() {
  return request("/projects")
}

export async function createProject(payload) {
  return request("/projects", { method: "POST", body: JSON.stringify(toSnake(payload)) })
}

export async function getProject(id) {
  return request(`/projects/${id}`)
}

export async function updateProject(id, payload) {
  return request(`/projects/${id}`, { method: "PUT", body: JSON.stringify(toSnake(payload)) })
}

export async function deleteProject(id) {
  return request(`/projects/${id}`, { method: "DELETE" })
}

// ─── Soil Layers ──────────────────────────────────────────────────────────────

export async function bulkReplaceSoilLayers(projectId, layers) {
  return request(`/projects/${projectId}/soil-layers/bulk`, {
    method: "PUT",
    body: JSON.stringify(layers.map(toSnakeLayer)),
  })
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export async function listEquipment() {
  return request("/equipment")
}

export async function bulkReplaceEquipment(items) {
  return request("/equipment/bulk", {
    method: "PUT",
    body: JSON.stringify(items.map(toSnakeMakine)),
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function downloadPdfReport(projectId) {
  const token = getToken()
  const res = await fetch(`${BASE}/projects/${projectId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `geodrill_rapor_${projectId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadSoilLayersCsv(projectId) {
  const token = getToken()
  const res = await fetch(`${BASE}/projects/${projectId}/soil-layers/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `zemin_logu_${projectId}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Excel (xlsx) client-side export — zemin, analiz ve fiyat verileri
export async function downloadExcelReport(proje, zemin, analizSonuclari, projeKodu) {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()

  // Sheet 1: Zemin Logu
  const zeminRows = [
    ["Başlangıç (m)", "Bitiş (m)", "Formasyon", "Zemin Tipi", "Kohezyon", "SPT", "UCS (MPa)", "RQD (%)"],
    ...zemin.map(r => [r.baslangic, r.bitis, r.formasyon, r.zemTipi, r.kohezyon, r.spt, r.ucs, r.rqd]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zeminRows), "Zemin Logu")

  // Sheet 2: Proje & Analiz
  const projeRows = [
    ["Alan", "Değer"],
    ["Proje Adı", proje.projeAdi || ""],
    ["Proje Kodu", proje.projeKodu || ""],
    ["Lokasyon", proje.lokasyon || ""],
    ["İş Tipi", proje.isTipi || ""],
    ["Kazık Boyu (m)", proje.kazikBoyu],
    ["Kazık Çapı (mm)", proje.kazikCapi],
    ["Kazık Adedi", proje.kazikAdedi],
    ["Yeraltı Suyu (m)", proje.yeraltiSuyu],
    [],
    ["Metrik", "Değer"],
    ...(analizSonuclari ? [
      ["Gerekli Tork (kNm)", analizSonuclari.tork],
      ["Casing Durumu", analizSonuclari.casingDur],
      ["Tahmini Casing (m)", analizSonuclari.casingM],
      ["1 Kazık Süresi (saat)", analizSonuclari.sure],
      ["Toplam İş Süresi (gün)", analizSonuclari.toplamGun],
      ["Metre Başı Mazot (L/m)", analizSonuclari.mBasi],
      ["Toplam Mazot (L)", Math.round((analizSonuclari.topMazot || 0) * proje.kazikAdedi)],
    ] : []),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projeRows), "Proje ve Analiz")

  // Sheet 3: Tork Derinlik (katman bazlı)
  if (analizSonuclari?.katmanCiktilar) {
    const torkRows = [
      ["Derinlik Başlangıç (m)", "Derinlik Bitiş (m)", "Zemin Tipi", "SPT", "UCS (MPa)", "Beklenen Tork (kNm)", "Önerilen Uç"],
      ...analizSonuclari.katmanCiktilar.map(r => [r.baslangic, r.bitis, r.zemTipi, r.spt, r.ucs, r.katmanTork, r.uc]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(torkRows), "Tork ve Uç Analizi")
  }

  const dosyaAdi = `geodrill_${projeKodu || "rapor"}.xlsx`
  XLSX.writeFile(wb, dosyaAdi)
}

// ─── Field name mapping (camelCase ↔ snake_case) ──────────────────────────────

function toSnake(proje) {
  return {
    proje_adi: proje.projeAdi ?? "",
    proje_kodu: proje.projeKodu ?? "",
    saha_kodu: proje.sahaKodu ?? "",
    lokasyon: proje.lokasyon ?? "",
    is_tipi: proje.isTipi ?? "Fore Kazık",
    kazik_boyu: Number(proje.kazikBoyu) || 18,
    kazik_capi: Number(proje.kazikCapi) || 800,
    kazik_adedi: Number(proje.kazikAdedi) || 30,
    yeralti_suyu: Number(proje.yeraltiSuyu) || 0,
    proje_notu: proje.projeNotu ?? "",
    teklif_notu: proje.teklifNotu ?? "",
  }
}

export function fromSnake(p) {
  return {
    projeAdi: p.proje_adi ?? "",
    projeKodu: p.proje_kodu ?? "",
    sahaKodu: p.saha_kodu ?? "",
    lokasyon: p.lokasyon ?? "",
    isTipi: p.is_tipi ?? "Fore Kazık",
    kazikBoyu: p.kazik_boyu ?? 18,
    kazikCapi: p.kazik_capi ?? 800,
    kazikAdedi: p.kazik_adedi ?? 30,
    yeraltiSuyu: p.yeralti_suyu ?? 4,
    projeNotu: p.proje_notu ?? "",
    teklifNotu: p.teklif_notu ?? "",
  }
}

function toSnakeLayer(r) {
  return {
    baslangic: Number(r.baslangic) || 0,
    bitis: Number(r.bitis) || 0,
    formasyon: r.formasyon ?? "",
    zem_tipi: r.zemTipi ?? r.zem_tipi ?? "Kil",
    kohezyon: r.kohezyon ?? "Kohezyonlu",
    spt: Number(r.spt) || 0,
    ucs: Number(r.ucs) || 0,
    rqd: Number(r.rqd) || 0,
    cpt_qc: Number(r.cptQc) || 0,
    su: Number(r.su) || 0,
    aciklama: r.aciklama ?? "",
  }
}

export function fromSnakeLayer(r) {
  return {
    id: r.id,
    baslangic: r.baslangic,
    bitis: r.bitis,
    formasyon: r.formasyon ?? "",
    zemTipi: r.zem_tipi ?? "Kil",
    kohezyon: r.kohezyon ?? "Kohezyonlu",
    spt: r.spt ?? 0,
    ucs: r.ucs ?? 0,
    rqd: r.rqd ?? 0,
    cptQc: r.cpt_qc ?? 0,
    su: r.su ?? 0,
    aciklama: r.aciklama ?? "",
  }
}

function toSnakeMakine(m) {
  return {
    ad: m.ad ?? "",
    tip: m.tip ?? "Fore Kazık",
    marka: m.marka ?? "",
    max_derinlik: Number(m.maxDerinlik) || 24,
    max_cap: Number(m.maxCap) || 1000,
    tork: Number(m.tork) || 180,
    crowd_force: Number(m.crowdForce) || 0,
    casing: m.casing ?? "Evet",
    dar_alan: m.darAlan ?? m.dar_alan ?? "Hayır",
    yakit_sinifi: m.yakitSinifi ?? m.yakit_sinifi ?? "Orta",
    not: m.not ?? m.not_ ?? "",
  }
}

export function fromSnakeMakine(m) {
  return {
    id: m.id,
    ad: m.ad ?? "",
    tip: m.tip ?? "Fore Kazık",
    marka: m.marka ?? "",
    maxDerinlik: m.max_derinlik ?? 24,
    maxCap: m.max_cap ?? 1000,
    tork: m.tork ?? 180,
    crowdForce: m.crowd_force ?? 0,
    casing: m.casing ?? "Evet",
    darAlan: m.dar_alan ?? "Hayır",
    yakitSinifi: m.yakit_sinifi ?? "Orta",
    not: m.not ?? m.not_ ?? "",
  }
}
