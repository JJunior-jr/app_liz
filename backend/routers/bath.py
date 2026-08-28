"""Router de banho."""
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import BathRecord
from backend.schemas import BathResponse

from backend.schemas import BathResponse, BathUpdate

router = APIRouter(prefix="/api/bath", tags=["Banho"])


@router.post("", response_model=BathResponse, status_code=201)
async def create_bath(
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> BathRecord:
    """Registra um banho. Horário é automático (agora)."""
    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    if target_date and target_date != now.date():
        recorded_at = datetime.combine(target_date, now.time(), tzinfo=ZoneInfo('America/Sao_Paulo'))
        db_date = target_date
    else:
        recorded_at = now
        db_date = now.date()

    record = BathRecord(
        recorded_at=recorded_at,
        date=db_date,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.get("", response_model=list[BathResponse])
async def list_baths(
    date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
) -> list[BathRecord]:
    """Lista banhos do dia."""
    result = await db.execute(
        select(BathRecord)
        .where(BathRecord.date == date)
        .order_by(BathRecord.recorded_at)
    )
    return list(result.scalars().all())


@router.delete("/{record_id}", status_code=204)
async def delete_bath(
    record_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove um registro de banho."""
    record = await db.get(BathRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    await db.delete(record)


@router.put("/{record_id}", response_model=BathResponse)
async def update_bath(
    record_id: int,
    payload: BathUpdate,
    db: AsyncSession = Depends(get_db),
) -> BathRecord:
    """Atualiza as informações e/ou horário de um registro de banho."""
    record = await db.get(BathRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    
    if payload.recorded_at is not None:
        record.recorded_at = payload.recorded_at
        record.date = payload.recorded_at.date()  # Sincroniza a data caso mude o dia
        
    await db.flush()
    await db.refresh(record)
    return record