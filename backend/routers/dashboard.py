"""
Dashboard aggregate endpoint.

Returns a single JSON object with all data needed to render the
firm-level dashboard in one round-trip.

GET /dashboard
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth import get_current_user
from database import get_db
import models
import schemas

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=schemas.DashboardOut)
def get_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ── Project counts ────────────────────────────────────────────────────────
    projeler = (
        db.query(models.Project)
        .filter(models.Project.owner_id == current_user.id)
        .order_by(models.Project.updated_at.desc())
        .all()
    )
    proje_sayisi = len(projeler)
    toplam_kazik = sum(p.kazik_adedi or 0 for p in projeler)
    son_aktivite = projeler[0].updated_at if projeler else None

    # ── Analysis counts + risk distribution ───────────────────────────────────
    analizler = (
        db.query(models.Analysis)
        .join(models.Project, models.Analysis.project_id == models.Project.id)
        .filter(models.Project.owner_id == current_user.id)
        .all()
    )
    analiz_sayisi = len(analizler)

    risk_dagilim = {"Yüksek": 0, "Orta": 0, "Düşük": 0}
    for a in analizler:
        r = a.risk_ozeti or "Düşük"
        if r in risk_dagilim:
            risk_dagilim[r] += 1

    # ── Plan / subscription info ──────────────────────────────────────────────
    plan = "free"
    analyses_used = 0
    analyses_limit = 5

    if current_user.company_id:
        sub = db.query(models.Subscription).filter(
            models.Subscription.company_id == current_user.company_id
        ).first()
        if sub:
            plan = sub.plan
            analyses_used = sub.analyses_used
            analyses_limit = sub.analyses_limit

    # ── Recent projects (top 5) ───────────────────────────────────────────────
    son_projeler = projeler[:5]

    return schemas.DashboardOut(
        proje_sayisi=proje_sayisi,
        analiz_sayisi=analiz_sayisi,
        toplam_kazik=toplam_kazik,
        son_aktivite=son_aktivite,
        risk_dagilim=risk_dagilim,
        plan=plan,
        analyses_used=analyses_used,
        analyses_limit=analyses_limit,
        son_projeler=[schemas.ProjectSummary.model_validate(p) for p in son_projeler],
    )
