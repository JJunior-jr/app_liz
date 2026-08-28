"""Router de sono."""
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import SleepRecord
from backend.schemas import SleepResponse

from backend.schemas import SleepResponse, SleepUpdate # <--- Adicione SleepUpdate

router = APIRouter(prefix="/api/sleep", tags=["Sono"])


@router.post("/start", response_model=SleepResponse, status_code=201)
async def start_sleep(
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> SleepRecord:
    """Inicia um registro de sono. Horário de início é automático (agora)."""
    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    if target_date and target_date != now.date():
        start_time = datetime.combine(target_date, now.time(), tzinfo=ZoneInfo('America/Sao_Paulo'))
        db_date = target_date
    else:
        start_time = now
        db_date = now.date()

    record = SleepRecord(
        date=db_date,
        start_time=start_time,
        end_time=None,
        duration_min=None,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.patch("/{record_id}/end", response_model=SleepResponse)
async def end_sleep(
    record_id: int,
    db: AsyncSession = Depends(get_db),
) -> SleepRecord:
    """Finaliza um sono em andamento. Horário de fim é automático (agora)."""
    record = await db.get(SleepRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro de sono não encontrado")
    if record.end_time is not None:
        raise HTTPException(status_code=400, detail="Este sono já foi finalizado")

    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    record.end_time = now

    # SQLite devolve datetimes sem timezone (naive); normaliza antes de subtrair
    start = record.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
    delta = now - start
    record.duration_min = round(delta.total_seconds() / 60, 1)

    await db.flush()
    await db.refresh(record)
    return record


@router.get("", response_model=list[SleepResponse])
async def list_sleeps(
    date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
) -> list[SleepRecord]:
    """Lista sonos do dia."""
    result = await db.execute(
        select(SleepRecord)
        .where(SleepRecord.date == date)
        .order_by(SleepRecord.start_time)
    )
    return list(result.scalars().all())


@router.get("/active", response_model=SleepResponse | None)
async def get_active_sleep(
    db: AsyncSession = Depends(get_db),
) -> SleepRecord | None:
    """Retorna o sono ativo (sem horário de fim), se houver."""
    result = await db.execute(
        select(SleepRecord).where(SleepRecord.end_time.is_(None))
    )
    return result.scalars().first()


@router.delete("/{record_id}", status_code=204)
async def delete_sleep(
    record_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove um registro de sono."""
    record = await db.get(SleepRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    await db.delete(record)

@router.put("/{record_id}", response_model=SleepResponse)
async def update_sleep(
    record_id: int,
    payload: SleepUpdate,
    db: AsyncSession = Depends(get_db),
) -> SleepRecord:
    """Atualiza os horários de início e/ou fim de uma soneca, recalculando a duração."""
    record = await db.get(SleepRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Registro de sono não encontrado")
    
    if payload.start_time is not None:
        record.start_time = payload.start_time
        record.date = payload.start_time.date()
        
    if payload.end_time is not None:
        record.end_time = payload.end_time

    # Se a soneca já tiver terminado, recalcula a duração atualizada
    if record.end_time is not None:
        start = record.start_time
        end = record.end_time
        
        # Garante tratamento do timezone vindo do SQLite
        if start.tzinfo is None:
            start = start.replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
        if end.tzinfo is None:
            end = end.replace(tzinfo=ZoneInfo('America/Sao_Paulo'))
            
        if end < start:
            raise HTTPException(status_code=400, detail="O horário de término não pode ser menor que o de início")
            
        delta = end - start
        record.duration_min = round(delta.total_seconds() / 60, 1)
        
    await db.flush()
    await db.refresh(record)
    return record
