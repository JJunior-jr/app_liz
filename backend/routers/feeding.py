"""Router de amamentação."""
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import FeedingRecord
from backend.schemas import FeedingCreate, FeedingResponse, FeedingUpdate, FeedingBreastStart

router = APIRouter(prefix="/api/feeding", tags=["Amamentação"])


@router.post("", response_model=FeedingResponse, status_code=201)
async def create_feeding(
    payload: FeedingCreate,
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> FeedingRecord:
    """Registra uma nova alimentação. Horário é automático (agora)."""
    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    if target_date and target_date != now.date():
        recorded_at = datetime.combine(target_date, now.time(), tzinfo=ZoneInfo('America/Sao_Paulo'))
        db_date = target_date
    else:
        recorded_at = now
        db_date = now.date()

    record = FeedingRecord(
        recorded_at=recorded_at,
        date=db_date,
        feeding_type=payload.feeding_type,
        ml_offered=payload.ml_offered,
        ml_consumed=payload.ml_consumed,
        breast_side=payload.breast_side,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.get("", response_model=list[FeedingResponse])
async def list_feedings(
    date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
) -> list[FeedingRecord]:
    """Lista todos os registros de alimentação de um dia."""
    result = await db.execute(
        select(FeedingRecord)
        .where(FeedingRecord.date == date)
        .order_by(FeedingRecord.recorded_at)
    )
    return list(result.scalars().all())


@router.delete("/{record_id}", status_code=204)
async def delete_feeding(
    record_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove um registro de alimentação."""
    record = await db.get(FeedingRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    await db.delete(record)

@router.get("/active", response_model=FeedingResponse | None)
async def get_active_breast(
    db: AsyncSession = Depends(get_db),
) -> FeedingRecord | None:
    """Retorna a amamentação de peito ativa (sem horário de término), se houver."""
    result = await db.execute(
        select(FeedingRecord).where(
            FeedingRecord.feeding_type.in_(("Breast", "breast")),
            FeedingRecord.end_time.is_(None)
        )
    )
    return result.scalars().first()


@router.post("/start", response_model=FeedingResponse, status_code=201)
async def start_breast(
    payload: FeedingBreastStart,
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> FeedingRecord:
    """Inicia um registro de amamentação no peito (esquerdo/direito)."""
    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    if target_date and target_date != now.date():
        recorded_at = datetime.combine(target_date, now.time(), tzinfo=ZoneInfo('America/Sao_Paulo'))
        db_date = target_date
    else:
        recorded_at = now
        db_date = now.date()

    record = FeedingRecord(
        recorded_at=recorded_at,
        date=db_date,
        feeding_type="Breast",
        breast_side=payload.breast_side,
        end_time=None,
        duration_min=None,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.patch("/{record_id}/end", response_model=FeedingResponse)
async def end_breast(
    record_id: int,
    db: AsyncSession = Depends(get_db),
) -> FeedingRecord:
    """Finaliza uma amamentação ativa no peito, calculando a duração."""
    record = await db.get(FeedingRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    if record.feeding_type not in ("Breast", "breast"):
        raise HTTPException(status_code=400, detail="Este registro não é de amamentação no peito")
    if record.end_time is not None:
        raise HTTPException(status_code=400, detail="Esta amamentação já foi finalizada")

    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    record.end_time = now

    start = record.recorded_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
    delta = now - start
    record.duration_min = round(max(0.0, delta.total_seconds() / 60), 1)

    await db.flush()
    await db.refresh(record)
    return record


@router.put("/{record_id}", response_model=FeedingResponse)
async def update_feeding(
    record_id: int,
    payload: FeedingUpdate,
    db: AsyncSession = Depends(get_db),
) -> FeedingRecord:
    """Atualiza as informações e/ou horário de um registro de amamentação."""
    record = await db.get(FeedingRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    
    if payload.recorded_at is not None:
        record.recorded_at = payload.recorded_at
        record.date = payload.recorded_at.date()
        
    if payload.end_time is not None:
        record.end_time = payload.end_time
        
    if payload.ml_offered is not None:
        record.ml_offered = payload.ml_offered
        
    if payload.ml_consumed is not None:
        record.ml_consumed = payload.ml_consumed
        
    if payload.breast_side is not None:
        record.breast_side = payload.breast_side

    # Se for amamentação no peito e tiver fim, recalcula a duração
    if record.feeding_type in ("Breast", "breast") and record.end_time is not None:
        start = record.recorded_at
        end = record.end_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
        if end.tzinfo is None:
            end = end.replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
        if end < start:
            raise HTTPException(status_code=400, detail="O horário de término não pode ser menor que o de início")
        delta = end - start
        record.duration_min = round(max(0.0, delta.total_seconds() / 60), 1)
        
    await db.flush()
    await db.refresh(record)
    return record