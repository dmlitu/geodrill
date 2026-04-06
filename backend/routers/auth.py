import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from auth import authenticate_user, create_access_token, get_current_user, hash_password
from database import get_db
import models
import schemas

logger = logging.getLogger("geodrill.auth")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f"Failed login attempt for username: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info(f"User logged in: {user.username}")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(
    request: Request,
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
):
    import re as _re

    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(400, detail="Bu kullanıcı adı zaten kullanılıyor")

    if payload.email:
        if db.query(models.User).filter(models.User.email == payload.email).first():
            raise HTTPException(400, detail="Bu e-posta adresi zaten kayıtlı")

    user = models.User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        email=payload.email,
        full_name=payload.full_name,
        role="owner",
    )
    db.add(user)
    db.flush()  # get user.id

    # Auto-create company if company_name provided
    if payload.company_name:
        slug = payload.company_slug or _re.sub(r"[^a-z0-9]+", "-", payload.company_name.lower()).strip("-")[:80]
        if db.query(models.Company).filter(models.Company.slug == slug).first():
            slug = f"{slug}-{user.id}"

        company = models.Company(name=payload.company_name, slug=slug, plan="free")
        db.add(company)
        db.flush()

        sub = models.Subscription(
            company_id=company.id,
            plan="free",
            analyses_used=0,
            analyses_limit=5,
        )
        db.add(sub)
        user.company_id = company.id

    db.commit()
    db.refresh(user)
    logger.info(f"New user registered: {user.username}")
    return user


@router.get("/me/full", response_model=schemas.UserWithCompany)
def me_full(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Extended /me with company info. Used by frontend on login."""
    db.refresh(current_user)
    return current_user
