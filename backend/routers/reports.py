import io
import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
import models

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


# ─── Hesaplama (AnalizSonucu.jsx ile aynı mantık) ─────────────────────────────

def gerekli_tork(zemin, cap_mm):
    cap_m = cap_mm / 1000
    max_tork = 0
    for row in zemin:
        spt = float(row.spt or 0)
        ucs = float(row.ucs or 0)
        rqd = float(row.rqd or 0)
        if ucs > 0:
            tau = (ucs * 1000) / 10
        elif row.kohezyon == "Kohezyonlu":
            tau = max(spt * 4, 20)
        else:
            tau = max(spt * 2, 15)
        if rqd > 0:
            if rqd < 25:
                tau *= 1.35
            elif rqd < 50:
                tau *= 1.20
            elif rqd < 75:
                tau *= 1.10
        t = tau * math.pi * (cap_m ** 3) / 8 * 1.25
        if t > max_tork:
            max_tork = t
    return round(max_tork * 10) / 10


def stabilite_riski(tip, kohezyon, spt, yas):
    if tip in ("Kum", "Çakıl") and yas >= 0:
        return "Yüksek"
    if kohezyon == "Kohezyonsuz" and spt <= 10:
        return "Yüksek"
    if kohezyon == "Kohezyonsuz" and spt <= 30:
        return "Orta"
    if tip == "Dolgu":
        return "Orta"
    return "Düşük"


def casing_metre(zemin, yas):
    toplam = 0
    for row in zemin:
        kalinlik = row.bitis - row.baslangic
        risk = stabilite_riski(row.zem_tipi, row.kohezyon, row.spt, yas)
        if risk == "Yüksek":
            toplam += kalinlik
        elif risk == "Orta":
            toplam += kalinlik * 0.5
    return round(toplam * 10) / 10


def casing_durum(zemin, yas):
    zorunlu = False
    for row in zemin:
        spt = float(row.spt or 0)
        if row.zem_tipi in ("Kum", "Çakıl") and (row.bitis - row.baslangic) > 0.5:
            zorunlu = True
        if row.kohezyon == "Kohezyonsuz" and yas > 0 and row.baslangic >= yas:
            zorunlu = True
        if spt < 10 and row.kohezyon == "Kohezyonsuz":
            zorunlu = True
    return "Gerekli" if zorunlu else "Gerekmeyebilir"


def rop_hesapla(tip, ucs, cap_mm):
    cap_m = cap_mm / 1000
    baz = {"Dolgu": 8, "Kil": 6, "Silt": 6.5, "Kum": 5, "Çakıl": 3.5,
           "Ayrışmış Kaya": 2, "Kumtaşı": 1.2, "Kireçtaşı": 0.9, "Sert Kaya": 0.5}.get(tip, 3)
    if ucs > 0:
        baz *= max(0.25, 1 - (ucs / 100) * 0.75)
    baz *= max(0.45, 1 - (cap_m - 0.8) * 0.5)
    return max(baz, 0.25)


def kazik_suresi(zemin, cap_mm, kazik_boyu, casing_m):
    sure = 0.75
    uc_deg = 0
    onceki_tip = None
    KAYA_TIPLER = ("Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya")
    for row in zemin:
        kalinlik = row.bitis - row.baslangic
        rop = rop_hesapla(row.zem_tipi, row.ucs, cap_mm)
        sure += kalinlik / rop
        if row.zem_tipi in KAYA_TIPLER and row.zem_tipi != onceki_tip:
            uc_deg += 1
        onceki_tip = row.zem_tipi
    sure += uc_deg * 0.6
    sure += casing_m * 0.1
    cap_m = cap_mm / 1000
    sure += math.pi * ((cap_m / 2) ** 2) * kazik_boyu * (20 / 60)
    if kazik_boyu >= 30:
        sure += 1.5
    elif kazik_boyu >= 20:
        sure += 0.8
    return round(sure * 10) / 10


def mazot_tahmini(tork, kazik_boyu):
    if tork < 100:
        m_basi = 8 + tork * 0.04
    elif tork < 200:
        m_basi = 12 + (tork - 100) * 0.08
    else:
        m_basi = 20 + (tork - 200) * 0.075
    m_basi = round(m_basi * 10) / 10
    return m_basi, round(m_basi * kazik_boyu * 10) / 10


def makine_uygunluk(makine, tork, kazik_boyu, kazik_capi, casing_zorunlu):
    if makine.max_derinlik < kazik_boyu:
        return "Uygun Değil"
    if makine.max_cap < kazik_capi:
        return "Uygun Değil"
    if makine.tork < tork * 0.80:
        return "Uygun Değil"
    if casing_zorunlu and makine.casing == "Hayır":
        return "Şartlı Uygun"
    if makine.tork < tork:
        return "Riskli"
    return "Uygun"


# ─── CSV Export ───────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/soil-layers/export")
def export_soil_layers_csv(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    import pandas as pd
    project = _get_project(project_id, current_user.id, db)
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
        "Stabilite Riski": stabilite_riski(l.zem_tipi, l.kohezyon, l.spt, project.yeralti_suyu),
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


# ─── PDF Report ───────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/report")
def generate_pdf_report(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )

    project = _get_project(project_id, current_user.id, db)
    layers = (
        db.query(models.SoilLayer)
        .filter(models.SoilLayer.project_id == project_id)
        .order_by(models.SoilLayer.baslangic)
        .all()
    )
    equipment = (
        db.query(models.Equipment)
        .filter(models.Equipment.owner_id == current_user.id)
        .all()
    )

    # Hesaplamalar
    tork = gerekli_tork(layers, project.kazik_capi)
    c_m = casing_metre(layers, project.yeralti_suyu)
    c_dur = casing_durum(layers, project.yeralti_suyu)
    sure = kazik_suresi(layers, project.kazik_capi, project.kazik_boyu, c_m)
    m_basi, tek_mazot = mazot_tahmini(tork, project.kazik_boyu)
    toplam_gun = round((sure * project.kazik_adedi) / 10 * 10) / 10

    # Casing zorunlu mu?
    c_zorunlu = c_dur == "Gerekli"

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
                stabilite_riski(l.zem_tipi, l.kohezyon, l.spt, project.yeralti_suyu),
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
