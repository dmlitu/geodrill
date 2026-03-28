const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

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

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const token = getToken()
  const headers = { "Content-Type": "application/json", ...options.headers }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error("Oturum süresi doldu")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
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
    yeralti_suyu: Number(proje.yeraltiSuyu) ?? 4,
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
    casing: m.casing ?? "Evet",
    darAlan: m.dar_alan ?? "Hayır",
    yakitSinifi: m.yakit_sinifi ?? "Orta",
    not: m.not ?? m.not_ ?? "",
  }
}
