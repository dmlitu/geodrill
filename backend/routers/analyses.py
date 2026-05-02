"""
Analysis snapshot router.

Every time a user saves an analysis from the frontend, a snapshot of the
tam_analiz() output is stored here. This enables:
  - Analysis history per project
  - Comparison between runs
  - PDF report generation from archived results
  - Dashboard aggregate metrics

Endpoints:
  GET  /projects/{project_id}/analyses          — list saved analyses for project
  POST /projects/{project_id}/analyses          — save a new analysis snapshot
  GET  /projects/{project_id}/analyses/{id}     — get full analysis with JSON
  DELETE /projects/{project_id}/analyses/{id}   — delete analysis snapshot
  GET  /analyses/recent                         — last N analyses across all projects
"""
import sys, os
from datetime import datetime, timezone
from typing import List, Optional


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
import models
import schemas
from routers.auth import limiter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter(tags=["analyses"])


def _check_project_access(project_id: int, user_id: int, db: Session) -> models.Project:
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == user_id,
    ).first()
    if not project:
        raise HTTPException(404, detail="Proje bulunamadı")
    return project


def _check_plan_limit(user: models.User, db: Session):
    """Raise 402 if free-plan user has hit monthly analysis limit."""
    if not user.company_id:
        return  # no company = no subscription enforcement (legacy / dev users)

    sub = db.query(models.Subscription).filter(
        models.Subscription.company_id == user.company_id
    ).first()
    if not sub or sub.analyses_limit == 0:
        return  # enterprise unlimited or no subscription

    # Monthly reset check — naive ↔ aware uyumu için utc-naive karşılaştırması
    now = _utcnow().replace(tzinfo=None)
    if sub.reset_date and (now - sub.reset_date).days >= 30:
        sub.analyses_used = 0
        sub.reset_date = now
        db.flush()

    if sub.analyses_used >= sub.analyses_limit:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Aylık analiz limitine ulaştınız ({sub.analyses_limit} analiz). "
                f"Pro plana geçerek limiti artırabilirsiniz."
            )
        )


def _increment_usage(user: models.User, db: Session):
    if not user.company_id:
        return
    sub = db.query(models.Subscription).filter(
        models.Subscription.company_id == user.company_id
    ).first()
    if sub:
        sub.analyses_used += 1


# ── List analyses for project ──────────────────────────────────────────────────

@router.get(
    "/projects/{project_id}/analyses",
    response_model=List[schemas.AnalysisSummary],
)
def list_analyses(
    project_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(project_id, current_user.id, db)
    rows = (
        db.query(models.Analysis)
        .filter(models.Analysis.project_id == project_id)
        .order_by(models.Analysis.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows


# ── Save analysis snapshot ─────────────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/analyses",
    response_model=schemas.AnalysisSummary,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("60/minute")
def save_analysis(
    request: Request,
    project_id: int,
    payload: schemas.AnalysisCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(project_id, current_user.id, db)
    _check_plan_limit(current_user, db)

    analysis = models.Analysis(
        project_id=project_id,
        user_id=current_user.id,
        ad=payload.ad or f"Analiz {_utcnow().strftime('%d.%m.%Y %H:%M')}",
        notlar=payload.notlar,
        motor_version=payload.motor_version,
        tork_nominal=payload.tork_nominal,
        tork_max=payload.tork_max,
        casing_m=payload.casing_m,
        sure_saat=payload.sure_saat,
        guven_seviyesi=payload.guven_seviyesi,
        guven_puan=payload.guven_puan,
        risk_ozeti=payload.risk_ozeti,
        analiz_json=payload.analiz_json,
        maliyet_json=payload.maliyet_json,
    )
    db.add(analysis)
    _increment_usage(current_user, db)
    db.commit()
    db.refresh(analysis)
    return analysis


# ── Get full analysis ──────────────────────────────────────────────────────────

@router.get(
    "/projects/{project_id}/analyses/{analysis_id}",
    response_model=schemas.AnalysisOut,
)
def get_analysis(
    project_id: int,
    analysis_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(project_id, current_user.id, db)
    analysis = db.query(models.Analysis).filter(
        models.Analysis.id == analysis_id,
        models.Analysis.project_id == project_id,
    ).first()
    if not analysis:
        raise HTTPException(404, detail="Analiz bulunamadı")
    return analysis


# ── Delete analysis ────────────────────────────────────────────────────────────

@router.delete(
    "/projects/{project_id}/analyses/{analysis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_analysis(
    project_id: int,
    analysis_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_project_access(project_id, current_user.id, db)
    analysis = db.query(models.Analysis).filter(
        models.Analysis.id == analysis_id,
        models.Analysis.project_id == project_id,
    ).first()
    if not analysis:
        raise HTTPException(404, detail="Analiz bulunamadı")
    db.delete(analysis)
    db.commit()


# ── Recent analyses (across all user projects) ─────────────────────────────────

@router.get(
    "/analyses/recent",
    response_model=List[schemas.AnalysisSummary],
)
def recent_analyses(
    limit: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Join through projects to enforce ownership
    rows = (
        db.query(models.Analysis)
        .join(models.Project, models.Analysis.project_id == models.Project.id)
        .filter(models.Project.owner_id == current_user.id)
        .order_by(models.Analysis.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows
