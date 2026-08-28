"""
Modelos ORM — tabelas do banco de dados.
"""
import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


# ── Enums ───────────────────────────────────────────────────────────────────

class FeedingType(str, enum.Enum):
    bottle = "bottle"
    Breast = "Breast"
    breast = "breast"


class BreastSide(str, enum.Enum):
    left = "left"
    right = "right"
    both = "both"


# ── Modelos ─────────────────────────────────────────────────────────────────

class FeedingRecord(Base):
    """Registro de amamentação (mamadeira ou Breast)."""

    __tablename__ = "feeding_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Mamadeira
    feeding_type: Mapped[str] = mapped_column(
        Enum(FeedingType), nullable=False, default=FeedingType.bottle
    )
    ml_offered: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ml_consumed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Breast
    breast_side: Mapped[str | None] = mapped_column("Breast_side", Enum(BreastSide), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_min: Mapped[float | None] = mapped_column(Float, nullable=True)


class DiaperChange(Base):
    """Registro de troca de fralda."""

    __tablename__ = "diaper_changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    has_poop: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_pee: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class SleepRecord(Base):
    """Registro de sono (início automático, fim manual)."""

    __tablename__ = "sleep_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_min: Mapped[float | None] = mapped_column(Float, nullable=True)


class BathRecord(Base):
    """Registro de banho."""

    __tablename__ = "bath_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
