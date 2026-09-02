"""
CAD (DWG/DXF) structural-element analysis.
Endpoints:
  POST /projects/{project_id}/cad/analyze   — pile/anchor detection
  POST /projects/{project_id}/cad/inspect   — raw layer/block/entity diagnostic dump

Follows the same shape as routers/soil_import.py: multipart upload, JWT auth,
per-user project ownership check, rate limiting, in-memory processing (no
persisted upload) — nothing here is stored to disk beyond the CAD pipeline's
own throwaway temp directory used for DWG->DXF conversion.
"""
import logging
import os
import sys

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models import Project
from auth import get_current_user
from routers.auth import limiter
from modules.cad.analyzer import CadAnalyzer, inspect_document
from modules.cad.parser import CadParseError

router = APIRouter()
logger = logging.getLogger("geodrill.cad")


def _get_owned_project(db: Session, project_id: int, user) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(404, "Proje bulunamadı.")
    return project


async def _read_upload(file: UploadFile) -> bytes:
    if not file.filename:
        raise HTTPException(400, "Dosya adı eksik.")
    return await file.read()


@router.post("/projects/{project_id}/cad/analyze")
@limiter.limit("5/minute")
async def analyze_cad(
    request: Request,
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_owned_project(db, project_id, current_user)
    data = await _read_upload(file)
    try:
        result = CadAnalyzer().analyze(data, file.filename)
    except CadParseError as e:
        raise HTTPException(400, str(e))
    except Exception:
        logger.exception("CAD analyze failed for project %s, file=%r", project_id, file.filename)
        raise HTTPException(400, "CAD dosyası işlenemedi. Dosya bozuk veya desteklenmeyen bir formatta olabilir.")
    return result


@router.post("/projects/{project_id}/cad/inspect")
@limiter.limit("10/minute")
async def inspect_cad(
    request: Request,
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_owned_project(db, project_id, current_user)
    data = await _read_upload(file)
    try:
        result = inspect_document(data, file.filename)
    except CadParseError as e:
        raise HTTPException(400, str(e))
    except Exception:
        logger.exception("CAD inspect failed for project %s, file=%r", project_id, file.filename)
        raise HTTPException(400, "CAD dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.")
    return result
