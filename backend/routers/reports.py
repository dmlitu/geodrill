"""
Reports router — PDF ve CSV dışa aktarma.

PDF: Kurumsal mühendislik raporu formatı (A4)
  - Kapak sayfası (proje bilgileri, tarih, hazırlayan)
  - Yönetici özeti
  - Teknik analiz (tork, casing, süre, güven sınıfı)
  - Zemin logu tablosu (renk kodlu risk)
  - Ekipman uygunluk matrisi (4-band)
  - Maliyet analizi (varsa)
  - Yasal uyarı + hesap güven beyanı

CSV: Zemin logu ham verisi
"""
import io
import logging
import sys
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
import models

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.calculations.engine import (
    gerekli_tork_aralik, stabilite_riski,
    casing_durum as _casing_durum_full, casing_metre,
    kazik_suresi, mazot_tahmini as _mazot_tahmini, makine_uygunluk,
    tam_cevrim_suresi, guven_analizi, aciklama_uret, kritik_katman,
)

logger = logging.getLogger("geodrill.reports")
router = APIRouter(tags=["reports"])

# ── Colour palette (matches frontend CSS vars) ────────────────────────────────
_DARK   = "#0C3B6E"   # dark navy
_BLUE   = "#0369A1"   # primary blue
_ACCENT = "#0EA5E9"   # light blue
_GREEN  = "#16A34A"
_AMBER  = "#D97706"
_RED    = "#DC2626"
_GRAY   = "#64748B"
_LGRAY  = "#E2E8F0"
_FAINT  = "#F8FAFC"
_WHITE  = "#FFFFFF"


# ─── ORM helpers ─────────────────────────────────────────────────────────────

def _get_project(project_id: int, user_id: int, db: Session) -> models.Project:
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == user_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    return project


def _layer_to_dict(l) -> dict:
    return {
        "baslangic": l.baslangic, "bitis": l.bitis,
        "zem_tipi": l.zem_tipi, "kohezyon": l.kohezyon,
        "spt": l.spt, "ucs": l.ucs, "rqd": l.rqd,
        "cpt_qc": getattr(l, "cpt_qc", 0) or 0,
        "su": getattr(l, "su", 0) or 0,
        "formasyon": l.formasyon, "aciklama": l.aciklama,
    }


def _equipment_to_dict(m) -> dict:
    return {
        "ad": m.ad, "tip": m.tip, "marka": m.marka or "",
        "max_derinlik": m.max_derinlik, "max_cap": m.max_cap,
        "tork": m.tork, "casing": m.casing,
        "crowd_force": getattr(m, "crowd_force", 0) or 0,
        "dar_alan": getattr(m, "dar_alan", "Hayır") or "Hayır",
        "yakit_sinifi": getattr(m, "yakit_sinifi", "Orta") or "Orta",
        "kelly_uzunluk": getattr(m, "kelly_uzunluk", 0) or 0,
    }


def casing_durum(zemin_orm, yas):
    return _casing_durum_full([_layer_to_dict(l) for l in zemin_orm], yas)["durum"]


def mazot_tahmini(tork, kazik_boyu):
    r = _mazot_tahmini(tork, kazik_boyu)
    return r["m_basi"], r["toplam"]


# ─── CSV Export ───────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/soil-layers/export")
def export_soil_layers_csv(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    import pandas as pd
    project = _get_project(project_id, current_user.id, db)
    try:
        layers = (
            db.query(models.SoilLayer)
            .filter(models.SoilLayer.project_id == project_id)
            .order_by(models.SoilLayer.baslangic)
            .all()
        )
        rows = [{
            "Baslangic (m)": l.baslangic, "Bitis (m)": l.bitis,
            "Formasyon": l.formasyon, "Zemin Tipi": l.zem_tipi,
            "Kohezyon": l.kohezyon, "SPT": l.spt,
            "UCS (MPa)": l.ucs, "RQD (%)": l.rqd,
            "CPT qc (MPa)": getattr(l, "cpt_qc", 0) or 0,
            "Su (kPa)": getattr(l, "su", 0) or 0,
            "Aciklama": l.aciklama,
            "Stabilite Riski": stabilite_riski(
                l.zem_tipi, l.kohezyon,
                float(l.spt or 0), project.yeralti_suyu,
                l.baslangic, float(getattr(l, "su", 0) or 0),
            ),
        } for l in layers]
        import pandas as pd
        df = pd.DataFrame(rows)
        buf = io.StringIO()
        df.to_csv(buf, index=False, encoding="utf-8-sig")
        buf.seek(0)
        filename = f"zemin_logu_{project.proje_kodu or project_id}.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.error(f"CSV export failed for project {project_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="CSV dışa aktarma sırasında hata oluştu")


# ─── PDF Report ───────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/report")
def generate_pdf_report(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = _get_project(project_id, current_user.id, db)
    try:
        return _build_pdf_report(project, current_user, db)
    except Exception as e:
        logger.error(f"PDF generation failed for project {project_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="PDF rapor oluşturulurken hata oluştu")


# ─── PDF Builder ─────────────────────────────────────────────────────────────

def _build_pdf_report(project, current_user, db):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak, KeepTogether,
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT, TA_JUSTIFY

    W, H = A4
    MARGIN = 2.0 * cm

    # ── Veri yükleme ──────────────────────────────────────────────────────────
    layers = (
        db.query(models.SoilLayer)
        .filter(models.SoilLayer.project_id == project.id)
        .order_by(models.SoilLayer.baslangic)
        .all()
    )
    equipment = (
        db.query(models.Equipment)
        .filter(models.Equipment.owner_id == current_user.id)
        .all()
    )

    layer_dicts = [_layer_to_dict(l) for l in layers]
    yas = float(project.yeralti_suyu or 0)

    # ── Hesaplamalar ──────────────────────────────────────────────────────────
    tork_aralik = gerekli_tork_aralik(layer_dicts, project.kazik_capi, project.is_tipi, yas)
    tork      = tork_aralik["nominal"]
    tork_min  = tork_aralik["min"]
    tork_max  = tork_aralik["max"]
    tork_guv  = tork_aralik["guven"]
    kat_det   = tork_aralik.get("katman_detaylari", [])

    casing_full = _casing_durum_full(layer_dicts, yas)
    c_dur    = casing_full["durum"]
    c_m      = casing_metre(layer_dicts, yas)
    c_zorunlu = casing_full["zorunlu"]
    c_gerekce = casing_full.get("gerekce", [])

    sure     = kazik_suresi(layer_dicts, project.kazik_capi, project.kazik_boyu, c_m)
    cevrim   = tam_cevrim_suresi(layer_dicts, project.kazik_capi, project.kazik_boyu, c_m, project.is_tipi)
    guven    = guven_analizi(layer_dicts, yas, project.kazik_boyu)
    m_basi, tek_mazot = mazot_tahmini(tork, project.kazik_boyu)
    krit     = kritik_katman(layer_dicts)

    gunluk_uretim = cevrim.get("gunluk_uretim_adet", 1)
    toplam_gun    = max(1, round(project.kazik_adedi / max(gunluk_uretim, 0.1)))

    # Risk sayacı
    risk_say = {"Yüksek": 0, "Orta": 0, "Düşük": 0}
    for l in layers:
        r = stabilite_riski(l.zem_tipi, l.kohezyon, float(l.spt or 0),
                            yas, l.baslangic, float(getattr(l, "su", 0) or 0))
        risk_say[r] = risk_say.get(r, 0) + 1

    # Ekipman değerlendirme
    eq_sonuclar = []
    for m in equipment:
        md = _equipment_to_dict(m)
        uyg = makine_uygunluk(md, tork, project.kazik_boyu,
                               project.kazik_capi, c_zorunlu,
                               project.is_tipi, layer_dicts, yas)
        aciklama = aciklama_uret(m.ad, uyg["karar"], uyg["tork_oran"],
                                  krit, guven, project.is_tipi, layer_dicts, yas)
        eq_sonuclar.append({**md, **uyg, "aciklama": aciklama})

    uygun_say = sum(1 for e in eq_sonuclar if e["karar"] in ("Uygun", "Rahat Uygun"))

    # ── Renk nesneleri ────────────────────────────────────────────────────────
    C_DARK   = colors.HexColor(_DARK)
    C_BLUE   = colors.HexColor(_BLUE)
    C_ACCENT = colors.HexColor(_ACCENT)
    C_GREEN  = colors.HexColor(_GREEN)
    C_AMBER  = colors.HexColor(_AMBER)
    C_RED    = colors.HexColor(_RED)
    C_GRAY   = colors.HexColor(_GRAY)
    C_LGRAY  = colors.HexColor(_LGRAY)
    C_FAINT  = colors.HexColor(_FAINT)
    C_WHITE  = colors.white

    RISK_BG = {
        "Yüksek": colors.HexColor("#FEF2F2"),
        "Orta":   colors.HexColor("#FFFBEB"),
        "Düşük":  colors.HexColor("#F0FDF4"),
    }
    RISK_FG = {
        "Yüksek": C_RED,
        "Orta":   C_AMBER,
        "Düşük":  C_GREEN,
    }
    KARAR_BG = {
        "Rahat Uygun":  colors.HexColor("#ECFDF5"),
        "Uygun":        colors.HexColor("#F0FDF4"),
        "Şartlı Uygun": colors.HexColor("#FFFBEB"),
        "Sınırda":      colors.HexColor("#FFFBEB"),
        "Uygun Değil":  colors.HexColor("#FEF2F2"),
    }
    KARAR_FG = {
        "Rahat Uygun":  C_GREEN,
        "Uygun":        C_GREEN,
        "Şartlı Uygun": C_AMBER,
        "Sınırda":      C_AMBER,
        "Uygun Değil":  C_RED,
    }

    # ── Stil tanımları ────────────────────────────────────────────────────────
    def _ps(name, **kw):
        return ParagraphStyle(name, **kw)

    sKapakBaslik = _ps("kapakBaslik", fontSize=26, fontName="Helvetica-Bold",
                       textColor=C_DARK, alignment=TA_CENTER, spaceAfter=6)
    sKapakAlt    = _ps("kapakAlt", fontSize=11, fontName="Helvetica",
                       textColor=C_GRAY, alignment=TA_CENTER, spaceAfter=4)
    sBolum       = _ps("bolum", fontSize=12, fontName="Helvetica-Bold",
                       textColor=C_DARK, spaceBefore=16, spaceAfter=6)
    sNormal      = _ps("normal", fontSize=9, fontName="Helvetica",
                       textColor=colors.HexColor("#374151"), leading=14)
    sNormalJ     = _ps("normalJ", fontSize=9, fontName="Helvetica",
                       textColor=colors.HexColor("#374151"), leading=14,
                       alignment=TA_JUSTIFY)
    sFooter      = _ps("footer", fontSize=7.5, fontName="Helvetica",
                       textColor=C_GRAY, alignment=TA_CENTER)
    sUyari       = _ps("uyari", fontSize=7.5, fontName="Helvetica-Oblique",
                       textColor=C_GRAY, leading=11, spaceAfter=4)
    sKutu        = _ps("kutu", fontSize=9, fontName="Helvetica",
                       textColor=colors.HexColor("#374151"), leading=14,
                       backColor=colors.HexColor("#F0F9FF"),
                       borderPad=10, borderWidth=0.5,
                       borderColor=colors.HexColor("#BAE6FD"),
                       spaceAfter=10)
    sGuven       = _ps("guven", fontSize=9, fontName="Helvetica-Bold",
                       textColor=C_BLUE)

    def HR(thickness=1, color=C_LGRAY, space=8):
        return HRFlowable(width="100%", thickness=thickness, color=color,
                          spaceBefore=space, spaceAfter=space)

    # ── Tablo yardımcısı ──────────────────────────────────────────────────────
    def simple_table(data, col_w, header=True, zebra=True):
        t = Table(data, colWidths=col_w)
        style = [
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("GRID", (0, 0), (-1, -1), 0.25, C_LGRAY),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        if header:
            style += [
                ("BACKGROUND", (0, 0), (-1, 0), C_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), C_WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8.5),
            ]
        if zebra:
            style += [("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1),
                       [C_WHITE, C_FAINT])]
        return t, style

    # ── Sayfa numarası callback ───────────────────────────────────────────────
    def _on_page(canvas, doc_obj):
        canvas.saveState()
        # Sol alt — firma + proje
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(C_GRAY)
        canvas.drawString(MARGIN, 1.3 * cm,
            f"GeoDrill Insight  |  {project.proje_adi or '—'}  |  {project.lokasyon or '—'}")
        # Sağ alt — sayfa
        canvas.drawRightString(W - MARGIN, 1.3 * cm,
            f"Sayfa {doc_obj.page}  |  {datetime.now().strftime('%d.%m.%Y')}")
        # Üst şerit
        canvas.setFillColor(C_DARK)
        canvas.rect(0, H - 6 * mm, W, 6 * mm, fill=1, stroke=0)
        canvas.setFillColor(C_ACCENT)
        canvas.rect(0, H - 6 * mm, 6 * mm, 6 * mm, fill=1, stroke=0)
        canvas.restoreState()

    # ── Belge ────────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 0.8 * cm, bottomMargin=2.2 * cm,
        title=f"GeoDrill — {project.proje_adi}",
        author="GeoDrill Insight",
    )

    content = []

    # ════════════════════════════════════════════════════════════════════════
    # KAPAK SAYFASI
    # ════════════════════════════════════════════════════════════════════════
    content.append(Spacer(1, 2 * cm))

    # Logo blok (metin tabanlı)
    logo_data = [["GeoDrill", "INSIGHT"]]
    logo_t = Table(logo_data, colWidths=[6 * cm, 4 * cm])
    logo_t.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTNAME",  (1, 0), (1, 0), "Helvetica"),
        ("FONTSIZE",  (0, 0), (0, 0), 28),
        ("FONTSIZE",  (1, 0), (1, 0), 10),
        ("TEXTCOLOR", (0, 0), (0, 0), C_DARK),
        ("TEXTCOLOR", (1, 0), (1, 0), C_ACCENT),
        ("VALIGN",    (0, 0), (-1, -1), "BOTTOM"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 2),
    ]))
    content.append(Table([[logo_t]], colWidths=[W - 2 * MARGIN]))
    content.append(HR(thickness=3, color=C_DARK, space=4))
    content.append(HR(thickness=1, color=C_ACCENT, space=0))
    content.append(Spacer(1, 1.5 * cm))

    content.append(Paragraph("GEOTEKNİK ANALİZ RAPORU", sKapakBaslik))
    content.append(Spacer(1, 0.4 * cm))
    content.append(Paragraph(project.proje_adi or "—", _ps("pAdi",
        fontSize=18, fontName="Helvetica-Bold", textColor=C_BLUE,
        alignment=TA_CENTER, spaceAfter=6)))

    if project.lokasyon:
        content.append(Paragraph(project.lokasyon, sKapakAlt))

    content.append(Spacer(1, 1.5 * cm))

    # Kapak bilgi kutusu
    tarih_str = datetime.now().strftime("%d %B %Y")
    haz_str   = getattr(current_user, "full_name", None) or current_user.username
    kapak_data = [
        ["Proje Kodu",   project.proje_kodu or "—"],
        ["Saha Kodu",    project.saha_kodu  or "—"],
        ["İş Tipi",      project.is_tipi],
        ["Hazırlayan",   haz_str],
        ["Rapor Tarihi", tarih_str],
    ]
    kapak_t = Table(kapak_data, colWidths=[4.5 * cm, 10 * cm])
    kapak_t.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",  (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",  (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), C_GRAY),
        ("TEXTCOLOR", (1, 0), (1, -1), C_DARK),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [C_FAINT, C_WHITE]),
        ("GRID",     (0, 0), (-1, -1), 0.25, C_LGRAY),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    content.append(kapak_t)
    content.append(Spacer(1, 2 * cm))

    # Kazık özeti kutu
    k_data = [[
        f"Kazık: Ø{project.kazik_capi} mm × {project.kazik_boyu} m",
        f"Adet: {project.kazik_adedi}",
        f"YAS: {project.yeralti_suyu} m",
        f"Motor: v3.1"
    ]]
    k_t = Table(k_data, colWidths=[(W - 2 * MARGIN) / 4] * 4)
    k_t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), C_DARK),
        ("TEXTCOLOR",   (0, 0), (-1, -1), C_WHITE),
        ("FONTNAME",    (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",  (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0),(-1, -1), 7),
    ]))
    content.append(k_t)
    content.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════════
    # YÖNETİCİ ÖZETİ
    # ════════════════════════════════════════════════════════════════════════
    content.append(Paragraph("1. Yönetici Özeti", sBolum))
    content.append(HR())

    # Risk değerlendirmesi
    yuksek_var  = risk_say.get("Yüksek", 0) > 0
    orta_var    = risk_say.get("Orta", 0) > 0
    risk_metin  = ("yüksek riskli zemin katmanları içermektedir. Casing ve stabilizasyon önlemleri kritiktir."
                   if yuksek_var else
                   "orta düzey riskli katmanlar içermektedir. Standart önlemler yeterli olacaktır."
                   if orta_var else
                   "genel olarak düşük riskli zemin koşulları sunmaktadır.")
    _seviye_tr  = {"HIGH": "Yüksek Güven", "MEDIUM": "Orta Güven", "LOW": "Düşük Güven"}
    guven_str   = (f"Sınıf {tork_guv} — {_seviye_tr.get(guven.get('seviye',''), guven.get('seviye','?'))} ({guven['puan']}/100 puan)" if guven else "—")
    ozet = (
        f"{project.proje_adi or 'Bu proje'} kapsamında <b>{project.kazik_adedi} adet</b>, "
        f"<b>{project.kazik_boyu} m</b> derinliğinde ve <b>Ø{project.kazik_capi} mm</b> çapında "
        f"fore kazık planlanmaktadır. "
        f"Zemin profili <b>{len(layers)} katman</b>dan oluşmakta olup {risk_metin} "
        f"Hesaplanan nominal sondaj torku <b>{tork} kNm</b> (bant: {tork_min}–{tork_max} kNm), "
        f"hesap güven düzeyi <b>{guven_str}</b>dir. "
        f"Muhafaza borusu durumu <b>'{c_dur}'</b> olarak değerlendirilmiştir. "
        f"Tek kazık delme süresi yaklaşık <b>{sure} saat</b>, "
        f"toplam iş süresi <b>{toplam_gun} iş günü</b> olarak öngörülmektedir."
    )
    if equipment:
        ozet += (
            f" Makine parkındaki {len(equipment)} makinenin <b>{uygun_say} tanesi</b> "
            f"bu proje için uygun kapasiteye sahiptir."
        )
    content.append(Paragraph(ozet, sKutu))

    # Özet metrik tablosu
    guven_sinif = tork_guv or "?"
    sinif_renk = {
        "A": C_GREEN, "B": C_GREEN, "C": C_AMBER, "D": C_RED
    }.get(guven_sinif, C_GRAY)

    ozet_data = [
        ["PARAMETRE", "HESAPLANAN DEĞER", "AÇIKLAMA"],
        ["Nominal Tork", f"{tork} kNm", f"Bant: {tork_min}–{tork_max} kNm"],
        ["Muhafaza Borusu", c_dur, f"{c_m} m tahmini uzunluk"],
        ["1 Kazık Delme Süresi", f"{sure} saat", f"Çevrim: {cevrim.get('t_toplam_cevrim', '—')} saat"],
        ["Günlük Üretim", f"~{gunluk_uretim} kazık/gün", "9 saatlik iş günü"],
        ["Toplam Süre", f"{toplam_gun} iş günü", f"{project.kazik_adedi} kazık"],
        ["Yakıt (metre başı)", f"{m_basi} L/m", f"Toplam: {round(tek_mazot * project.kazik_adedi)} L"],
        ["Hesap Güveni", guven_str, f"Motor v3.1 / FHWA GEC 10"],
    ]
    t, s = simple_table(ozet_data, [4.5 * cm, 4.5 * cm, 8.5 * cm])
    # Güven satırına renk
    s.append(("TEXTCOLOR", (1, -1), (1, -1), sinif_renk))
    s.append(("FONTNAME",  (1, -1), (1, -1), "Helvetica-Bold"))
    t.setStyle(TableStyle(s))
    content.append(t)
    content.append(Spacer(1, 0.3 * cm))

    # ════════════════════════════════════════════════════════════════════════
    # PROJE BİLGİLERİ
    # ════════════════════════════════════════════════════════════════════════
    content.append(Paragraph("2. Proje Bilgileri", sBolum))
    content.append(HR())
    prj_data = [
        ["Proje Adı",   project.proje_adi or "—",   "Proje Kodu",  project.proje_kodu or "—"],
        ["Saha Kodu",   project.saha_kodu  or "—",  "Lokasyon",    project.lokasyon   or "—"],
        ["İş Tipi",     project.is_tipi,             "YAS Derinliği", f"{project.yeralti_suyu} m"],
        ["Kazık Boyu",  f"{project.kazik_boyu} m",   "Kazık Çapı",  f"{project.kazik_capi} mm"],
        ["Kazık Adedi", str(project.kazik_adedi),    "Toplam Metre", f"{project.kazik_boyu * project.kazik_adedi} m"],
    ]
    prj_t = Table(prj_data, colWidths=[3.2 * cm, 5.3 * cm, 3.2 * cm, 5.8 * cm])
    prj_t.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",  (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE",  (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), C_GRAY),
        ("TEXTCOLOR", (2, 0), (2, -1), C_GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [C_FAINT, C_WHITE]),
        ("GRID",     (0, 0), (-1, -1), 0.25, C_LGRAY),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 7),
    ]))
    content.append(prj_t)

    if project.proje_notu:
        content.append(Spacer(1, 0.2 * cm))
        content.append(Paragraph(f"<b>Proje Notu:</b> {project.proje_notu}", sNormal))

    # ════════════════════════════════════════════════════════════════════════
    # ZEMİN LOGU
    # ════════════════════════════════════════════════════════════════════════
    if layers:
        content.append(Paragraph("3. Zemin Logu", sBolum))
        content.append(HR())

        zl_header = ["Baş. (m)", "Bit. (m)", "Formasyon", "Zemin Tipi", "SPT", "UCS\n(MPa)", "RQD\n(%)", "Su\n(kPa)", "Stabilite"]
        zl_rows   = [zl_header]
        risk_rows = []
        for l in layers:
            risk = stabilite_riski(
                l.zem_tipi, l.kohezyon, float(l.spt or 0),
                yas, l.baslangic, float(getattr(l, "su", 0) or 0)
            )
            risk_rows.append(risk)
            zl_rows.append([
                f"{l.baslangic:.1f}", f"{l.bitis:.1f}",
                (l.formasyon or "—")[:18],
                l.zem_tipi,
                str(l.spt) if l.spt else "—",
                f"{l.ucs:.1f}" if l.ucs else "—",
                f"{l.rqd:.0f}" if l.rqd else "—",
                f"{getattr(l,'su',0) or 0:.0f}" if getattr(l,"su",0) else "—",
                risk,
            ])

        col_w = [1.6*cm, 1.6*cm, 3.2*cm, 2.6*cm, 1.2*cm, 1.6*cm, 1.4*cm, 1.4*cm, 2.6*cm]
        zl_t, zl_s = simple_table(zl_rows, col_w)
        for i, risk in enumerate(risk_rows, start=1):
            zl_s.append(("BACKGROUND", (8, i), (8, i), RISK_BG.get(risk, C_WHITE)))
            zl_s.append(("TEXTCOLOR",  (8, i), (8, i), RISK_FG.get(risk, C_GRAY)))
            zl_s.append(("FONTNAME",   (8, i), (8, i), "Helvetica-Bold"))
        zl_t.setStyle(TableStyle(zl_s))
        content.append(zl_t)

        # Risk dağılımı özeti
        content.append(Spacer(1, 0.2 * cm))
        risk_ozet = (
            f"Risk dağılımı: <font color='#DC2626'><b>Yüksek: {risk_say.get('Yüksek',0)}</b></font>  "
            f"<font color='#D97706'><b>Orta: {risk_say.get('Orta',0)}</b></font>  "
            f"<font color='#16A34A'><b>Düşük: {risk_say.get('Düşük',0)}</b></font>"
        )
        content.append(Paragraph(risk_ozet, sNormal))

    # ════════════════════════════════════════════════════════════════════════
    # TEKNİK ANALİZ
    # ════════════════════════════════════════════════════════════════════════
    content.append(Paragraph("4. Teknik Analiz", sBolum))
    content.append(HR())

    # 4.1 Tork
    content.append(Paragraph("4.1 Sondaj Torku Hesabı", _ps("h3", fontSize=10,
        fontName="Helvetica-Bold", textColor=C_BLUE, spaceBefore=8, spaceAfter=4)))
    tork_acik = (
        f"Tork hesabı FHWA GEC 10 §7.4 formülüne göre yapılmıştır: "
        f"T = τ_eff × (π×D³/12) × K_app × K_method × K_gw × K_depth × K_unc. "
        f"Direnç hiyerarşisi: Kaya > YAS > CPT > SPT > çıkarımsal. "
        f"Nominal tork <b>{tork} kNm</b>, güvenli tasarım için <b>{tork_max} kNm</b> önerilir."
    )
    content.append(Paragraph(tork_acik, sNormalJ))
    content.append(Spacer(1, 0.2 * cm))

    if kat_det:
        kat_header = ["Katman", "Zemin Tipi", "SPT", "UCS (MPa)", "Tork (kNm)", "Ağırlık"]
        kat_rows   = [kat_header]
        for kd in kat_det:
            kat_rows.append([
                f"{kd.get('baslangic','?')}–{kd.get('bitis','?')} m",
                kd.get("tip", "—"),
                str(kd.get("spt", "—")),
                f"{kd.get('ucs', 0):.1f}" if kd.get("ucs") else "—",
                f"{kd.get('tork', 0):.1f}",
                f"{kd.get('kalinlik_m', 0):.1f} m",
            ])
        kat_t, kat_s = simple_table(kat_rows, [3.5*cm, 3.5*cm, 1.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
        kat_t.setStyle(TableStyle(kat_s))
        content.append(kat_t)

    # 4.2 Casing
    content.append(Paragraph("4.2 Muhafaza Borusu Kararı", _ps("h3", fontSize=10,
        fontName="Helvetica-Bold", textColor=C_BLUE, spaceBefore=10, spaceAfter=4)))
    c_renk = C_RED if c_zorunlu else C_AMBER if "Şartlı" in c_dur else C_GREEN
    content.append(Paragraph(
        f"Karar: <font color='{_RED if c_zorunlu else _AMBER}'><b>{c_dur}</b></font>  |  Tahmini uzunluk: <b>{c_m} m</b>",
        sNormal
    ))
    if c_gerekce:
        content.append(Spacer(1, 0.1 * cm))
        for g in c_gerekce:
            content.append(Paragraph(f"• {g}", _ps("bullet", fontSize=8.5,
                fontName="Helvetica", textColor=C_GRAY, leading=12, leftIndent=10)))

    # 4.3 Süre & Üretim
    content.append(Paragraph("4.3 Süre ve Üretim Planlaması", _ps("h3", fontSize=10,
        fontName="Helvetica-Bold", textColor=C_BLUE, spaceBefore=10, spaceAfter=4)))
    sure_data = [
        ["Faaliyet", "Süre"],
        ["Delme + casing (tek kazık)",    f"{sure} saat"],
        ["Tam çevrim (beton + lojistik)", f"{cevrim.get('t_toplam_cevrim','—')} saat"],
        ["Günlük üretim (9 sa iş günü)",  f"~{gunluk_uretim} kazık/gün"],
        ["Toplam proje süresi",           f"{toplam_gun} iş günü"],
    ]
    sure_t, sure_s = simple_table(sure_data, [12 * cm, 5.5 * cm])
    sure_t.setStyle(TableStyle(sure_s))
    content.append(sure_t)

    # 4.4 Güven
    content.append(Paragraph("4.4 Hesap Güveni", _ps("h3", fontSize=10,
        fontName="Helvetica-Bold", textColor=C_BLUE, spaceBefore=10, spaceAfter=4)))
    if guven:
        guven_acik = (
            f"Hesap güveni puanı: <b>{guven['puan']}/100</b>  |  "
            f"Sınıf: <b>{tork_guv or '?'}</b>  |  "
            f"Seviye: <b>{_seviye_tr.get(guven.get('seviye', ''), guven.get('seviye', '?'))}</b>. "
            f"Sınıf A/B: üst sınır hesap güvenilirdir. "
            f"Sınıf C: arazi doğrulaması önerilir. "
            f"Sınıf D: kapsamlı zemin araştırması gereklidir."
        )
        content.append(Paragraph(guven_acik, sNormalJ))

    # ════════════════════════════════════════════════════════════════════════
    # EKİPMAN UYGUNLUK MATRİSİ
    # ════════════════════════════════════════════════════════════════════════
    if eq_sonuclar:
        content.append(Paragraph("5. Ekipman Uygunluk Değerlendirmesi", sBolum))
        content.append(HR())

        eq_header = ["Makine", "Marka", "Tork\n(kNm)", "Max D.\n(m)", "Casing", "Oran", "KARAR"]
        eq_rows = [eq_header]
        karar_rows = []
        for e in eq_sonuclar:
            oran_pct = f"%{round(e.get('tork_oran', 0) * 100)}"
            karar_rows.append(e["karar"])
            eq_rows.append([
                e["ad"][:20], e.get("marka", "—")[:12],
                str(e["tork"]), f"{e['max_derinlik']}",
                e.get("casing", "—"), oran_pct, e["karar"],
            ])

        col_w = [3.5*cm, 2.5*cm, 2*cm, 2*cm, 2*cm, 1.8*cm, 3.7*cm]
        eq_t, eq_s = simple_table(eq_rows, col_w)
        for i, karar in enumerate(karar_rows, start=1):
            eq_s.append(("BACKGROUND", (6, i), (6, i), KARAR_BG.get(karar, C_WHITE)))
            eq_s.append(("TEXTCOLOR",  (6, i), (6, i), KARAR_FG.get(karar, C_GRAY)))
            eq_s.append(("FONTNAME",   (6, i), (6, i), "Helvetica-Bold"))
        eq_t.setStyle(TableStyle(eq_s))
        content.append(eq_t)

        # Açıklamalar
        content.append(Spacer(1, 0.4 * cm))
        for e in eq_sonuclar:
            if e.get("aciklama"):
                content.append(KeepTogether([
                    Paragraph(f"<b>{e['ad']}</b> ({e['karar']})", _ps("mAdAsiklama",
                        fontSize=9, fontName="Helvetica-Bold", textColor=C_DARK, spaceAfter=2)),
                    Paragraph(e["aciklama"], _ps("aciklamaText",
                        fontSize=8.5, fontName="Helvetica", textColor=C_GRAY,
                        leading=12, spaceAfter=6, leftIndent=8)),
                ]))

    # ════════════════════════════════════════════════════════════════════════
    # MİNİMUM MAKİNE GEREKSİNİMLERİ (uygun makine yoksa)
    # ════════════════════════════════════════════════════════════════════════
    if equipment and uygun_say == 0:
        content.append(Paragraph("5a. Gerekli Minimum Makine Özellikleri", sBolum))
        content.append(HR())
        gerek_data = [
            ["Parametre", "Minimum Değer", "Açıklama"],
            ["Sondaj Torku", f"≥ {tork_max} kNm", "Güvenli üst bant değeri"],
            ["Max Derinlik", f"≥ {project.kazik_boyu + 2} m", "Proje derinliği + 2 m emniyet"],
            ["Max Çap",      f"≥ {project.kazik_capi} mm", "Kazık çapı"],
            ["Casing",       "Gerekli" if c_zorunlu else "Şartlı", c_dur],
        ]
        gerek_t, gerek_s = simple_table(gerek_data, [4*cm, 4*cm, 9.5*cm])
        gerek_t.setStyle(TableStyle(gerek_s))
        content.append(gerek_t)
        content.append(Paragraph(
            "Yukarıdaki minimum özelliklere sahip bir makine kiralama veya satın alma değerlendirmesi yapılmalıdır.",
            sNormal
        ))

    # ════════════════════════════════════════════════════════════════════════
    # YASAL UYARI
    # ════════════════════════════════════════════════════════════════════════
    content.append(Spacer(1, 0.5 * cm))
    content.append(HR(thickness=0.5, color=C_LGRAY, space=4))
    uyari_metin = (
        "YASAL UYARI: Bu rapor GeoDrill Insight platformu tarafından otomatik olarak üretilmiş "
        "bir mühendislik destek belgesidir. Hesaplamalar FHWA GEC 10, EN 1536, Eurocode 7 ve "
        "ilgili Türk standartlarına dayalı yarı-ampirik modeller kullanmaktadır. "
        "Sonuçlar ön tasarım ve makine seçimi aşamaları için referans niteliğindedir; "
        "kesin tasarım kararları için tescilli bir geoteknik mühendisi tarafından onaylanmalıdır. "
        "GeoDrill, bu rapordaki hesap hatalarından kaynaklanabilecek doğrudan veya dolaylı zararlardan sorumlu tutulamaz. "
        f"Hesap motoru: GeoDrill Engine v3.1  |  Rapor ID: {project.id}-{datetime.now().strftime('%Y%m%d')}"
    )
    content.append(Paragraph(uyari_metin, sUyari))

    # ── Build ────────────────────────────────────────────────────────────────
    doc.build(content, onFirstPage=_on_page, onLaterPages=_on_page)
    buf.seek(0)
    proje_kodu = (project.proje_kodu or str(project.id)).replace(" ", "_")
    filename = f"geodrill_rapor_{proje_kodu}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
