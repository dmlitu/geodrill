import io
import logging
import sys
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
import models

# Allow importing from project root and configs/modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.calculations.engine import (
    gerekli_tork_aralik, gerekli_tork, stabilite_riski,
    casing_durum as _casing_durum_full, casing_metre,
    kazik_suresi, mazot_tahmini as _mazot_tahmini, makine_uygunluk,
)

logger = logging.getLogger("geodrill.reports")
router = APIRouter(tags=["reports"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_project(project_id: int, user_id: int, db: Session) -> models.Project:
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == user_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    return project


def _layer_to_dict(l) -> dict:
    """Convert ORM SoilLayer to plain dict for engine functions."""
    return {
        "baslangic": l.baslangic, "bitis": l.bitis,
        "zem_tipi": l.zem_tipi, "kohezyon": l.kohezyon,
        "spt": l.spt, "ucs": l.ucs, "rqd": l.rqd,
        "formasyon": l.formasyon, "aciklama": l.aciklama,
    }


def casing_durum(zemin_orm, yas):
    """Backward-compatible wrapper: accepts ORM objects."""
    return _casing_durum_full([_layer_to_dict(l) for l in zemin_orm], yas)["durum"]


def mazot_tahmini(tork, kazik_boyu):
    result = _mazot_tahmini(tork, kazik_boyu)
    return result["m_basi"], result["toplam"]


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
            "Aciklama": l.aciklama,
            "Stabilite Riski": stabilite_riski(l.zem_tipi, l.kohezyon, float(l.spt or 0), project.yeralti_suyu, l.baslangic),
        } for l in layers]
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


def _build_pdf_report(project, current_user, db):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )

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

    # Hesaplamalar — engine v2.0 (reference-driven, confidence-scored)
    layer_dicts = [_layer_to_dict(l) for l in layers]
    tork_aralik = gerekli_tork_aralik(layer_dicts, project.kazik_capi, project.is_tipi)
    tork = tork_aralik["nominal"]
    tork_min = tork_aralik["min"]
    tork_max = tork_aralik["max"]
    tork_guven = tork_aralik["guven"]
    casing_full = _casing_durum_full(layer_dicts, project.yeralti_suyu)
    c_dur = casing_full["durum"]
    c_m = casing_metre(layer_dicts, project.yeralti_suyu)
    sure = kazik_suresi(layer_dicts, project.kazik_capi, project.kazik_boyu, c_m)
    m_basi, tek_mazot = mazot_tahmini(tork, project.kazik_boyu)
    toplam_gun = round(sure * project.kazik_adedi * 10) / 10
    c_zorunlu = casing_full["zorunlu"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    # Stiller
    styles = getSampleStyleSheet()
    DARK = colors.HexColor("#1B3A6B")
    BLUE = colors.HexColor("#2D5BA3")
    GRAY = colors.HexColor("#64748B")

    h1 = ParagraphStyle("h1", fontSize=18, fontName="Helvetica-Bold", textColor=DARK, spaceAfter=4)
    h2 = ParagraphStyle("h2", fontSize=13, fontName="Helvetica-Bold", textColor=DARK, spaceBefore=14, spaceAfter=6)
    sub = ParagraphStyle("sub", fontSize=10, textColor=GRAY, spaceAfter=12)
    normal = styles["Normal"]
    normal.fontSize = 10

    content = []

    # Başlık
    content.append(Paragraph("GeoDrill — Analiz Raporu", h1))
    content.append(Paragraph(
        f"{project.proje_adi} | {project.lokasyon} | {datetime.now().strftime('%d.%m.%Y')}", sub
    ))
    content.append(HRFlowable(width="100%", thickness=2, color=BLUE, spaceAfter=12))

    # Yönetici Özeti
    uygun_makine_sayisi = sum(
        1 for m in equipment
        if makine_uygunluk(m, tork, project.kazik_boyu, project.kazik_capi, c_zorunlu) == "Uygun"
    ) if equipment else 0
    risk_durumu = "yüksek riskli zemin katmanları içermektedir" if any(
        stabilite_riski(l.zem_tipi, l.kohezyon, l.spt, project.yeralti_suyu, l.baslangic) == "Yüksek" for l in layers
    ) else "genel olarak stabil zemin koşulları sunmaktadır"
    ozet_metin = (
        f"{project.proje_adi or 'Bu proje'} kapsamında {project.kazik_adedi} adet, "
        f"{project.kazik_boyu} m derinliğinde ve {project.kazik_capi} mm çapında fore kazık planlanmaktadır. "
        f"Zemin profili {len(layers)} katmandan oluşmakta olup {risk_durumu}. "
        f"Hesaplanan minimum sondaj torku {tork} kNm olup muhafaza borusu durumu '{c_dur}' olarak değerlendirilmiştir. "
        f"Tek kazık delme süresi yaklaşık {sure} saat, toplam iş süresi {toplam_gun} gün olarak öngörülmektedir. "
        f"Toplam yakıt tüketimi {round(tek_mazot * project.kazik_adedi)} litre olarak tahmin edilmiştir."
    )
    if equipment:
        ozet_metin += f" Makine parkındaki {len(equipment)} makinenin {uygun_makine_sayisi} tanesi bu proje için uygun kapasiteye sahiptir."
    content.append(Paragraph("Yönetici Özeti", h2))
    content.append(Paragraph(
        ozet_metin,
        ParagraphStyle("ozet", fontSize=10, leading=16, textColor=colors.HexColor("#374151"),
                       backColor=colors.HexColor("#F0F9FF"),
                       borderPad=10, borderWidth=1, borderColor=colors.HexColor("#BAE6FD"),
                       spaceAfter=14, leftIndent=4, rightIndent=4)
    ))

    # Proje Bilgileri
    content.append(Paragraph("Proje Bilgileri", h2))
    prj_data = [
        ["Proje Adı", project.proje_adi, "Proje Kodu", project.proje_kodu or "—"],
        ["Saha Kodu", project.saha_kodu or "—", "Lokasyon", project.lokasyon or "—"],
        ["İş Tipi", project.is_tipi, "Yeraltı Suyu", f"{project.yeralti_suyu} m"],
        ["Kazık Boyu", f"{project.kazik_boyu} m", "Kazık Çapı", f"{project.kazik_capi} mm"],
        ["Kazık Adedi", str(project.kazik_adedi), "", ""],
    ]
    prj_table = Table(prj_data, colWidths=[3.5*cm, 5*cm, 3.5*cm, 5*cm])
    prj_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("TEXTCOLOR", (2, 0), (2, -1), GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    content.append(prj_table)

    # Analiz Sonuçları
    content.append(Paragraph("Analiz Sonuçları", h2))
    ana_data = [
        ["Metrik", "Değer"],
        ["Gerekli Minimum Tork", f"{tork} kNm"],
        ["Muhafaza Borusu Durumu", c_dur],
        ["Tahmini Casing Uzunluğu", f"{c_m} m"],
        ["1 Kazık Delme Süresi", f"{sure} saat"],
        ["Toplam İş Süresi", f"{toplam_gun} gün"],
        ["Metre Başı Mazot", f"{m_basi} L/m"],
        ["Toplam Mazot (tüm kazıklar)", f"{round(tek_mazot * project.kazik_adedi)} L"],
    ]
    ana_table = Table(ana_data, colWidths=[8*cm, 9*cm])
    ana_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    content.append(ana_table)

    # Zemin Logu
    if layers:
        content.append(Paragraph("Zemin Logu", h2))
        zl_header = ["Başlangıç (m)", "Bitiş (m)", "Formasyon", "Zemin Tipi", "SPT", "UCS (MPa)", "RQD (%)", "Stabilite"]
        zl_rows = [zl_header] + [
            [
                str(l.baslangic), str(l.bitis), l.formasyon or "—", l.zem_tipi,
                str(l.spt), str(l.ucs), str(l.rqd),
                stabilite_riski(l.zem_tipi, l.kohezyon, l.spt, project.yeralti_suyu, l.baslangic),
            ]
            for l in layers
        ]
        col_w = [2.2*cm, 2.0*cm, 2.8*cm, 2.5*cm, 1.5*cm, 2.2*cm, 2.0*cm, 2.2*cm]
        zl_table = Table(zl_rows, colWidths=col_w)
        risk_colors = {"Yüksek": colors.HexColor("#FEF2F2"), "Orta": colors.HexColor("#FFFBEB"), "Düşük": colors.HexColor("#F0FDF4")}
        zl_style = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]
        for idx, l in enumerate(layers, start=1):
            risk = stabilite_riski(l.zem_tipi, l.kohezyon, l.spt, project.yeralti_suyu)
            bg = risk_colors.get(risk, colors.white)
            zl_style.append(("BACKGROUND", (7, idx), (7, idx), bg))
        zl_table.setStyle(TableStyle(zl_style))
        content.append(zl_table)

    # Ekipman Uygunluk
    if equipment:
        content.append(Paragraph("Ekipman Uygunluk Değerlendirmesi", h2))
        eq_header = ["Makine Adı", "Marka", "Tork (kNm)", "Max Derinlik", "Casing", "Karar"]
        eq_rows = [eq_header] + [
            [
                m.ad, m.marka or "—", str(m.tork), f"{m.max_derinlik} m",
                m.casing, makine_uygunluk(m, tork, project.kazik_boyu, project.kazik_capi, c_zorunlu),
            ]
            for m in equipment
        ]
        eq_table = Table(eq_rows, colWidths=[3.5*cm, 3.5*cm, 2.5*cm, 3*cm, 2.5*cm, 3*cm])
        eq_style = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]
        karar_colors = {
            "Uygun": colors.HexColor("#F0FDF4"),
            "Şartlı Uygun": colors.HexColor("#FFFBEB"),
            "Riskli": colors.HexColor("#FFFBEB"),
            "Uygun Değil": colors.HexColor("#FEF2F2"),
        }
        for idx, m in enumerate(equipment, start=1):
            karar = makine_uygunluk(m, tork, project.kazik_boyu, project.kazik_capi, c_zorunlu)
            eq_style.append(("BACKGROUND", (5, idx), (5, idx), karar_colors.get(karar, colors.white)))
        eq_table.setStyle(TableStyle(eq_style))
        content.append(eq_table)

    # Footer notu
    content.append(Spacer(1, 20))
    content.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
    content.append(Paragraph(
        f"GeoDrill Insight — Rapor Tarihi: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        ParagraphStyle("footer", fontSize=8, textColor=GRAY, spaceBefore=6)
    ))

    doc.build(content)
    buf.seek(0)
    filename = f"geodrill_rapor_{project.proje_kodu or project_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
