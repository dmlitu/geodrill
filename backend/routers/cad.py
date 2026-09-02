"""
CAD (DWG/DXF) structural-element analysis.
Endpoints:
  POST /projects/{project_id}/cad/analyze   — pile/anchor detection
  POST /projects/{project_id}/cad/inspect   — raw layer/block/entity diagnostic dump

Follows the same shape as routers/soil_import.py: multipart upload, JWT auth,
per-user project ownership check, rate limiting, in-memory processing (no
persisted upload) — nothing here is stored to disk beyond the CAD pipeline's
own throwaway temp directory used for DWG->DXF conversion.

CadAnalyzer.analyze() / inspect_document() are synchronous, CPU-bound calls
(DWG conversion subprocess + pure-Python DXF parsing can run several seconds
on a real engineering drawing). Both handlers run them in Starlette's worker
thread pool via run_in_threadpool — otherwise a single slow CAD upload would
block FastAPI's event loop and stall every other concurrent request on this
process (health checks included) for the same duration.
"""
import asyncio
import logging
import os
import sys

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from models import Project
from auth import get_current_user
from routers.auth import limiter
from modules.cad.analyzer import CadAnalyzer, inspect_document
from modules.cad.parser import CadParseError

router = APIRouter()
logger = logging.getLogger("geodrill.cad")

# Outer safety net, independent of the DWG-converter subprocess's own
# timeout (GEODRILL_DWG_CONVERT_TIMEOUT, default 60s): bounds the *whole*
# analyze/inspect call, including the pure-Python DXF parse and detection
# stages that have no timeout of their own. Generous relative to measured
# real-file timings (a few seconds) — this exists for a pathological/
# adversarial file, not normal operation.
CAD_PROCESSING_TIMEOUT_SECONDS = int(os.environ.get("GEODRILL_CAD_PROCESSING_TIMEOUT", "180"))


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
        result = await asyncio.wait_for(
            run_in_threadpool(CadAnalyzer().analyze, data, file.filename),
            timeout=CAD_PROCESSING_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "CAD analyze exceeded %ss for project %s, file=%r — aborting",
            CAD_PROCESSING_TIMEOUT_SECONDS, project_id, file.filename,
        )
        raise HTTPException(503, "CAD dosyasının işlenmesi beklenenden çok uzun sürdü. Lütfen tekrar deneyin.")
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
        result = await asyncio.wait_for(
            run_in_threadpool(inspect_document, data, file.filename),
            timeout=CAD_PROCESSING_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "CAD inspect exceeded %ss for project %s, file=%r — aborting",
            CAD_PROCESSING_TIMEOUT_SECONDS, project_id, file.filename,
        )
        raise HTTPException(503, "CAD dosyasının işlenmesi beklenenden çok uzun sürdü. Lütfen tekrar deneyin.")
    except CadParseError as e:
        raise HTTPException(400, str(e))
    except Exception:
        logger.exception("CAD inspect failed for project %s, file=%r", project_id, file.filename)
        raise HTTPException(400, "CAD dosyası okunamadı. Dosya bozuk veya desteklenmeyen bir formatta olabilir.")
    return result
