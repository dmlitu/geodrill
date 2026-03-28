from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from auth import get_current_user
from database import get_db
import models
import schemas

router = APIRouter(tags=["soil-layers"])


def _get_project_or_404(project_id: int, user_id: int, db: Session) -> models.Project:
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == user_id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    return project


@router.get("/projects/{project_id}/soil-layers", response_model=List[schemas.SoilLayerOut])
def list_soil_layers(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_project_or_404(project_id, current_user.id, db)
    return (
        db.query(models.SoilLayer)
        .filter(models.SoilLayer.project_id == project_id)
        .order_by(models.SoilLayer.baslangic)
        .all()
    )


@router.put(
    "/projects/{project_id}/soil-layers/bulk",
    response_model=List[schemas.SoilLayerOut],
    summary="Tüm zemin katmanlarını toplu güncelle (mevcut katmanları sil, yenilerini ekle)",
)
def bulk_replace_soil_layers(
    project_id: int,
    layers: List[schemas.SoilLayerCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_project_or_404(project_id, current_user.id, db)
    db.query(models.SoilLayer).filter(models.SoilLayer.project_id == project_id).delete()
    new_layers = [
        models.SoilLayer(**layer.model_dump(), project_id=project_id)
        for layer in layers
    ]
    db.add_all(new_layers)
    db.commit()
    for layer in new_layers:
        db.refresh(layer)
    return new_layers
