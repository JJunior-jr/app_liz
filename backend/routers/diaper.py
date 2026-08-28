"""Router de troca de fraldas."""
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import DiaperChange
from backend.schemas import DiaperCreate, DiaperResponse

from backend.schemas import DiaperCreate, DiaperResponse, DiaperUpdate # <--- Adicione DiaperUpdate

router = APIRouter(prefix="/api/diaper", tags=["Troca de Fralda"])


@router.post("", response_model=DiaperResponse, status_code=201)
async def create_diaper(
    payload: DiaperCreate,
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> DiaperChange:
    """Registra uma troca de fralda. Horário é automático (agora)."""
    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    if target_date and target_date != now.date():
        recorded_at = datetime.combine(target_date, now.time(), tzinfo=ZoneInfo('America/Sao_Paulo'))
        db_date = target_date
    else:
        recorded_at = now
        db_date = now.date()

    record = DiaperChange(
        recorded_at=recorded_at,
        date=db_date,
        has_poop=payload.has_poop,
        has_pee=payload.has_pee,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.get("", response_model=list[DiaperResponse])
async def list_diapers(
    date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
) -> list[DiaperChange]:
    """Lista trocas do dia."""
    result = await db.execute(
        select(DiaperChange)
        .where(DiaperChange.date == date)
        .order_by(DiaperChange.recorded_at)
    )
    return list(result.scalars().all())


@router.delete("/{record_id}", status_code=204)
async def delete_diaper(
    record_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove um registro de troca."""
    record = await db.get(DiaperChange, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    await db.delete(record)

@router.put("/{record_id}", response_model=DiaperResponse) 
async def update_diaper(
    record_id: int,
    payload: DiaperUpdate,
    db: AsyncSession = Depends(get_db),
) -> DiaperChange:
    """Atualiza as informações e/ou horário de uma troca de fralda."""
    record = await db.get(DiaperChange, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    
    if payload.recorded_at is not None:
        record.recorded_at = payload.recorded_at
        record.date = payload.recorded_at.date()
        
    if payload.has_poop is not None:
        record.has_poop = payload.has_poop
        
    if payload.has_pee is not None:
        record.has_pee = payload.has_pee
        
    await db.flush()
    await db.refresh(record)
    return record