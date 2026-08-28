"""
Schemas Pydantic V2 para validação e serialização.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator
from zoneinfo import ZoneInfo

from backend.models import BreastSide, FeedingType


# ── Feeding ──────────────────────────────────────────────────────────────────

class FeedingCreate(BaseModel):
    feeding_type: FeedingType = FeedingType.bottle
    ml_offered: Optional[int] = Field(None, ge=0, le=500)
    ml_consumed: Optional[int] = Field(None, ge=0, le=500)
    breast_side: Optional[BreastSide] = None

    @model_validator(mode="after")
    def validate_feeding(self) -> "FeedingCreate":
        if self.feeding_type == FeedingType.bottle:
            if self.ml_offered is None:
                raise ValueError("ml_offered é obrigatório para mamadeira")
        if self.feeding_type in (FeedingType.Breast, FeedingType.breast):
            if self.breast_side is None:
                raise ValueError("breast_side é obrigatório para amamentação no peito")
        return self


class FeedingBreastStart(BaseModel):
    breast_side: BreastSide


class FeedingResponse(BaseModel):
    id: int
    recorded_at: datetime
    date: date
    feeding_type: FeedingType
    ml_offered: Optional[int] = None
    ml_consumed: Optional[int] = None
    breast_side: Optional[BreastSide] = None
    end_time: Optional[datetime] = None
    duration_min: Optional[float] = None
    is_active: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def ensure_timezone(self) -> "FeedingResponse":
        self.is_active = (self.feeding_type in (FeedingType.Breast, FeedingType.breast) and self.end_time is None)
        if self.recorded_at and self.recorded_at.tzinfo is None:
            self.recorded_at = self.recorded_at.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
        if self.end_time and self.end_time.tzinfo is None:
            self.end_time = self.end_time.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
        return self


# ── Diaper ───────────────────────────────────────────────────────────────────

class DiaperCreate(BaseModel):
    has_poop: bool = False
    has_pee: bool = True

    @model_validator(mode="after")
    def validate_diaper(self) -> "DiaperCreate":
        if not self.has_poop and not self.has_pee:
            raise ValueError("Deve registrar pelo menos xixi ou coco")
        return self


class DiaperResponse(BaseModel):
    id: int
    recorded_at: datetime
    date: date
    has_poop: bool
    has_pee: bool

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def ensure_timezone(self) -> "DiaperResponse":
        if self.recorded_at and self.recorded_at.tzinfo is None:
            self.recorded_at = self.recorded_at.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
        return self


# ── Sleep ─────────────────────────────────────────────────────────────────────

class SleepResponse(BaseModel):
    id: int
    date: date
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_min: Optional[float] = None
    is_active: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def set_is_active_and_tz(self) -> "SleepResponse":
        self.is_active = self.end_time is None
        if self.start_time and self.start_time.tzinfo is None:
            self.start_time = self.start_time.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
        if self.end_time and self.end_time.tzinfo is None:
            self.end_time = self.end_time.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
        return self


# ── Bath ──────────────────────────────────────────────────────────────────────

class BathResponse(BaseModel):
    id: int
    recorded_at: datetime
    date: date

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def ensure_timezone(self) -> "BathResponse":
        if self.recorded_at and self.recorded_at.tzinfo is None:
            self.recorded_at = self.recorded_at.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
        return self


# ── Summary ───────────────────────────────────────────────────────────────────

class DaySummary(BaseModel):
    date: date
    feedings: list[FeedingResponse]
    diapers: list[DiaperResponse]
    sleeps: list[SleepResponse]
    baths: list[BathResponse]
    total_ml_offered: int
    total_ml_consumed: int
    total_diaper_changes: int
    total_sleep_min: float
    total_awake_min: float
    current_awake_time_min: float | None = None
    current_fasting_time_min: float | None = None
    total_breast_feedings: int = 0

class ReportDay(BaseModel):
    date: date
    total_ml_offered: int = 0
    total_ml_consumed: int = 0
    total_diaper_changes: int = 0
    total_sleep_min: float = 0
    total_baths: int = 0
    total_breast_feedings: int = 0
    total_awake_min: float = 0
    feedings_count: int = 0
    sleeps_count: int = 0
    avg_sleep_min: float = 0
    max_fasting_min: float = 0

# Adicione isso na seção ── Feeding ── (perto de FeedingCreate)
class FeedingUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    end_time: Optional[datetime] = None
    ml_offered: Optional[int] = Field(None, ge=0, le=500)
    ml_consumed: Optional[int] = Field(None, ge=0, le=500)
    breast_side: Optional[BreastSide] = None


# Adicione isso na seção ── Diaper ── (perto de DiaperCreate)
class DiaperUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    has_poop: Optional[bool] = None
    has_pee: Optional[bool] = None


# Adicione isso na seção ── Sleep ── (perto de SleepResponse)
class SleepUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


# Adicione isso na seção ── Bath ── (perto de BathResponse)
class BathUpdate(BaseModel):
    recorded_at: Optional[datetime] = None