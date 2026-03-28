from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from auth import get_current_user
from database import get_db
import models
import schemas

router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.get("", response_model=List[schemas.EquipmentOut])
def list_equipment(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Equipment).filter(models.Equipment.owner_id == current_user.id).all()


@router.put(
    "/bulk",
    response_model=List[schemas.EquipmentOut],
    summary="Ekipman listesini toplu güncelle",
)
def bulk_replace_equipment(
    items: List[schemas.EquipmentCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Equipment).filter(models.Equipment.owner_id == current_user.id).delete()
    new_items = []
    for item in items:
        data = item.model_dump(by_alias=False)
        # "not_" alanını model sütunuyla eşleştir
        eq = models.Equipment(owner_id=current_user.id, **data)
        new_items.append(eq)
    db.add_all(new_items)
    db.commit()
    for eq in new_items:
        db.refresh(eq)
    return new_items


@router.post("", response_model=schemas.EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: schemas.EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = payload.model_dump(by_alias=False)
    eq = models.Equipment(owner_id=current_user.id, **data)
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return eq


@router.put("/{equipment_id}", response_model=schemas.EquipmentOut)
def update_equipment(
    equipment_id: int,
    payload: schemas.EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    eq = db.query(models.Equipment).filter(
        models.Equipment.id == equipment_id,
        models.Equipment.owner_id == current_user.id,
    ).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Ekipman bulunamadı")
    for key, value in payload.model_dump(by_alias=False).items():
        setattr(eq, key, value)
    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    eq = db.query(models.Equipment).filter(
        models.Equipment.id == equipment_id,
        models.Equipment.owner_id == current_user.id,
    ).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Ekipman bulunamadı")
    db.delete(eq)
    db.commit()
