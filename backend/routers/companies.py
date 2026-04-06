"""
Company / workspace management router.

Endpoints:
  POST /companies                  — create company (becomes owner)
  GET  /companies/me               — get current user's company + subscription
  PUT  /companies/me               — update company name
  POST /companies/me/join/{slug}   — join an existing company (member role)
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
import models
import schemas

router = APIRouter(prefix="/companies", tags=["companies"])

PLAN_LIMITLER = {"free": 5, "pro": 100, "enterprise": 0}


def _slug_from_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:80]


@router.post("", response_model=schemas.CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: schemas.CompanyCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.company_id:
        raise HTTPException(400, detail="Zaten bir şirkete üyesiniz. Önce ayrılmanız gerekiyor.")

    slug = payload.slug or _slug_from_name(payload.name)
    if db.query(models.Company).filter(models.Company.slug == slug).first():
        raise HTTPException(400, detail=f"'{slug}' slug'ı zaten kullanımda. Farklı bir isim deneyin.")

    company = models.Company(name=payload.name, slug=slug, plan="free")
    db.add(company)
    db.flush()   # get company.id

    sub = models.Subscription(
        company_id=company.id,
        plan="free",
        analyses_used=0,
        analyses_limit=PLAN_LIMITLER["free"],
    )
    db.add(sub)

    current_user.company_id = company.id
    current_user.role = "owner"
    db.commit()
    db.refresh(company)
    return company


@router.get("/me", response_model=dict)
def get_my_company(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.company_id:
        return {"company": None, "subscription": None}

    company = db.query(models.Company).filter(
        models.Company.id == current_user.company_id
    ).first()
    if not company:
        return {"company": None, "subscription": None}

    sub = db.query(models.Subscription).filter(
        models.Subscription.company_id == company.id
    ).first()

    return {
        "company": schemas.CompanyOut.model_validate(company).model_dump(),
        "subscription": schemas.SubscriptionOut.model_validate(sub).model_dump() if sub else None,
    }


@router.put("/me", response_model=schemas.CompanyOut)
def update_company(
    payload: schemas.CompanyCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.company_id:
        raise HTTPException(404, detail="Şirket bulunamadı")
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, detail="Bu işlem için yetkiniz yok")

    company = db.query(models.Company).filter(
        models.Company.id == current_user.company_id
    ).first()
    if not company:
        raise HTTPException(404, detail="Şirket bulunamadı")

    company.name = payload.name
    db.commit()
    db.refresh(company)
    return company


@router.post("/me/join/{slug}", response_model=schemas.CompanyOut)
def join_company(
    slug: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.company_id:
        raise HTTPException(400, detail="Zaten bir şirkete üyesiniz.")

    company = db.query(models.Company).filter(models.Company.slug == slug).first()
    if not company:
        raise HTTPException(404, detail=f"'{slug}' slug'ına sahip şirket bulunamadı.")

    current_user.company_id = company.id
    current_user.role = "member"
    db.commit()
    db.refresh(company)
    return company


@router.post("/me/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_company(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.company_id:
        raise HTTPException(400, detail="Bir şirkete üye değilsiniz.")
    if current_user.role == "owner":
        raise HTTPException(400, detail="Şirket sahibi ayrılamaz. Önce sahipliği devredin.")
    current_user.company_id = None
    current_user.role = "member"
    db.commit()
