import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
import models

_SECRET_KEY_ENV = os.getenv("SECRET_KEY")
_ENV = os.getenv("ENV", "dev").lower()
_DATABASE_URL = os.getenv("DATABASE_URL", "")
_IS_PROD = _ENV not in ("dev", "test", "local") or (
    _DATABASE_URL and not _DATABASE_URL.startswith("sqlite")
)

if _SECRET_KEY_ENV:
    SECRET_KEY = _SECRET_KEY_ENV
elif _IS_PROD:
    raise RuntimeError(
        "SECRET_KEY ortam değişkeni production'da zorunludur. "
        "Render dashboard → Environment → SECRET_KEY ekleyin (generateValue: true)."
    )
else:
    import warnings
    warnings.warn(
        "SECRET_KEY ortam değişkeni ayarlı değil — yalnızca geliştirme için "
        "varsayılan anahtar kullanılıyor.",
        stacklevel=1,
    )
    SECRET_KEY = "geodrill-dev-xK9mPqR7vW3nJ5tL8yB2dF4hS6"  # nosec — dev only

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 saat

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Geçersiz veya süresi dolmuş token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_username(db, username)
    if user is None or not user.is_active:
        raise credentials_exception
    return user
