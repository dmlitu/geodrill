"""
Integration tests for /projects/{id}/cost router.
"""

PROJE_PAYLOAD = {
    "proje_adi": "Maliyet Test",
    "proje_kodu": "MT-001",
    "saha_kodu": "SH-01",
    "lokasyon": "İzmir",
    "is_tipi": "Fore Kazık",
    "kazik_boyu": 18.0,
    "kazik_capi": 800,
    "kazik_adedi": 20,
    "yeralti_suyu": 4.0,
    "proje_notu": "",
    "teklif_notu": "",
}

ZEMIN_PAYLOAD = [
    {
        "baslangic": 0.0, "bitis": 6.0,
        "formasyon": "Alüvyon", "zem_tipi": "Kil",
        "kohezyon": "Kohezyonlu", "spt": 8, "ucs": 0.0, "rqd": 0,
        "cpt_qc": 0.0, "su": 0.0, "aciklama": "",
    },
    {
        "baslangic": 6.0, "bitis": 18.0,
        "formasyon": "Kum", "zem_tipi": "Kum",
        "kohezyon": "Kohezyonsuz", "spt": 25, "ucs": 0.0, "rqd": 0,
        "cpt_qc": 0.0, "su": 0.0, "aciklama": "",
    },
]

MALIYET_PAYLOAD = {
    "mazot_fiyati": 45.0,
    "makine_kirasi": 800.0,
    "iscilik_saat": 200.0,
    "sarf_malzeme": 150.0,
    "mobilizasyon": 5000.0,
    "beton_m3_fiyat": 0.0,
    "donati_kg_fiyat": 0.0,
    "donati_kg_m": 0.0,
    "genel_gider_pct": 15.0,
    "kar_pct": 10.0,
    "kaydet": False,
}


def _setup(client, auth_headers):
    """Proje oluştur + zemin ekle, proje_id döndür."""
    proje = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()
    client.put(
        f"/projects/{proje['id']}/soil-layers/bulk",
        json=ZEMIN_PAYLOAD,
        headers=auth_headers,
    )
    return proje["id"]


def test_calculate_cost(client, auth_headers):
    proje_id = _setup(client, auth_headers)
    res = client.post(f"/projects/{proje_id}/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["toplam"] > 0
    assert data["metre_basi"] > 0
    assert data["kazik_basi"] > 0
    assert len(data["kalemler"]) > 0


def test_cost_breakdown_includes_fuel(client, auth_headers):
    proje_id = _setup(client, auth_headers)
    res = client.post(f"/projects/{proje_id}/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    kalemler = {k["ad"]: k for k in res.json()["kalemler"]}
    assert "Yakıt (Mazot)" in kalemler
    assert kalemler["Yakıt (Mazot)"]["tutar"] > 0


def test_cost_mobilizasyon_included(client, auth_headers):
    proje_id = _setup(client, auth_headers)
    res = client.post(f"/projects/{proje_id}/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    kalemler = {k["ad"]: k for k in res.json()["kalemler"]}
    assert "Mobilizasyon" in kalemler
    assert kalemler["Mobilizasyon"]["tutar"] == 5000


def test_cost_beton_excluded_when_zero(client, auth_headers):
    proje_id = _setup(client, auth_headers)
    res = client.post(f"/projects/{proje_id}/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    kalemler = {k["ad"] for k in res.json()["kalemler"]}
    assert "Beton" not in kalemler


def test_cost_with_concrete(client, auth_headers):
    proje_id = _setup(client, auth_headers)
    payload = {**MALIYET_PAYLOAD, "beton_m3_fiyat": 2500.0}
    res = client.post(f"/projects/{proje_id}/cost", json=payload, headers=auth_headers)
    kalemler = {k["ad"] for k in res.json()["kalemler"]}
    assert "Beton" in kalemler


def test_cost_benchmark_present(client, auth_headers):
    proje_id = _setup(client, auth_headers)
    res = client.post(f"/projects/{proje_id}/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    data = res.json()
    assert data["benchmark_min"] > 0
    assert data["benchmark_max"] > 0
    assert "benchmark_yorum" in data
    assert len(data["benchmark_yorum"]) > 10


def test_cost_no_soil_layers(client, auth_headers):
    """Zemin verisi olmayan projede 400 dönmeli."""
    proje = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()
    res = client.post(f"/projects/{proje['id']}/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    assert res.status_code == 400


def test_cost_project_not_found(client, auth_headers):
    res = client.post("/projects/9999/cost", json=MALIYET_PAYLOAD, headers=auth_headers)
    assert res.status_code == 404


def test_get_cost_no_saved(client, auth_headers):
    """Kaydedilmiş maliyet yokken 404 dönmeli."""
    proje_id = _setup(client, auth_headers)
    res = client.get(f"/projects/{proje_id}/cost", headers=auth_headers)
    assert res.status_code == 404


def test_cost_saves_to_analysis(client, auth_headers):
    """kaydet=True olduğunda mevcut analize kaydedilmeli."""
    proje_id = _setup(client, auth_headers)

    # Önce analiz oluştur (cost kaydı için gerekli)
    analiz_payload = {
        "ad": "Kaydet Test",
        "notlar": "",
        "motor_version": "v3.1",
        "tork_nominal": 150.0,
        "tork_max": 210.0,
        "casing_m": 6.0,
        "sure_saat": 3.0,
        "guven_seviyesi": "Orta",
        "guven_puan": 70,
        "risk_ozeti": "Orta",
        "analiz_json": {},
        "maliyet_json": None,
    }
    client.post(f"/projects/{proje_id}/analyses", json=analiz_payload, headers=auth_headers)

    # Maliyet kaydet
    res = client.post(
        f"/projects/{proje_id}/cost",
        json={**MALIYET_PAYLOAD, "kaydet": True},
        headers=auth_headers,
    )
    assert res.status_code == 200

    # GET ile alınabilmeli
    res2 = client.get(f"/projects/{proje_id}/cost", headers=auth_headers)
    assert res2.status_code == 200
    assert res2.json()["toplam"] > 0
