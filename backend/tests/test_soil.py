PROJE_PAYLOAD = {
    "proje_adi": "Zemin Test", "proje_kodu": "", "saha_kodu": "", "lokasyon": "",
    "is_tipi": "Fore Kazık", "kazik_boyu": 18.0, "kazik_capi": 800,
    "kazik_adedi": 10, "yeralti_suyu": 4.0, "proje_notu": "", "teklif_notu": "",
}

KATMAN_1 = {"baslangic": 0, "bitis": 5, "formasyon": "Dolgu", "zem_tipi": "Dolgu",
            "kohezyon": "Kohezyonsuz", "spt": 10, "ucs": 0, "rqd": 0, "aciklama": ""}
KATMAN_2 = {"baslangic": 5, "bitis": 18, "formasyon": "Kil", "zem_tipi": "Kil",
            "kohezyon": "Kohezyonlu", "spt": 25, "ucs": 0, "rqd": 0, "aciklama": ""}


def _proje_id(client, auth_headers):
    return client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()["id"]


def test_bulk_replace_soil_layers(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    res = client.put(f"/projects/{pid}/soil-layers/bulk",
                     json=[KATMAN_1, KATMAN_2], headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_soil_layer_in_project_response(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    client.put(f"/projects/{pid}/soil-layers/bulk", json=[KATMAN_1], headers=auth_headers)
    res = client.get(f"/projects/{pid}", headers=auth_headers)
    assert len(res.json()["soil_layers"]) == 1


def test_bulk_replace_removes_old_layers(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    client.put(f"/projects/{pid}/soil-layers/bulk", json=[KATMAN_1, KATMAN_2], headers=auth_headers)
    client.put(f"/projects/{pid}/soil-layers/bulk", json=[KATMAN_1], headers=auth_headers)
    res = client.get(f"/projects/{pid}", headers=auth_headers)
    assert len(res.json()["soil_layers"]) == 1


def test_soil_layer_bitis_lte_baslangic_rejected(client, auth_headers):
    """Bitiş ≤ başlangıç olan katman 422 döndürmeli."""
    pid = _proje_id(client, auth_headers)
    gecersiz = {**KATMAN_1, "baslangic": 5, "bitis": 3}  # bitis < baslangic
    res = client.put(f"/projects/{pid}/soil-layers/bulk", json=[gecersiz], headers=auth_headers)
    assert res.status_code == 422


def test_soil_layer_spt_out_of_range(client, auth_headers):
    """SPT > 300 olan katman 422 döndürmeli."""
    pid = _proje_id(client, auth_headers)
    gecersiz = {**KATMAN_1, "spt": 999}
    res = client.put(f"/projects/{pid}/soil-layers/bulk", json=[gecersiz], headers=auth_headers)
    assert res.status_code == 422
