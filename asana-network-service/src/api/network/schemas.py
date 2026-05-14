from typing import List, Optional

from pydantic import BaseModel, Field


class PredictIn(BaseModel):
    image: str


class PredictOut(BaseModel):
    classes: list[int]


# ============================================
# Сканирование на похожие фото для модерации
# ============================================
class PhotoIn(BaseModel):
    """Описание одного фото из каталога для пакетного анализа."""

    asana_id: str = Field(..., description="URI асаны, к которой относится фото")
    photo_id: str = Field(..., description="URI фото внутри асаны")
    image_url: Optional[str] = Field(
        None, description="URL изображения (HTTP/S3 через nginx)."
    )
    image_base64: Optional[str] = Field(
        None,
        description="Base64-содержимое изображения (используется, если URL недоступен)",
    )
    dedup_fp: Optional[str] = Field(
        None,
        description=(
            "Уже посчитанный rotation-invariant pHash (см. asana-dict-service "
            "photo_dedup.compute_photo_dedup_fingerprint). Если задан — pHash "
            "не пересчитывается."
        ),
    )


class ScanIn(BaseModel):
    """Входные данные для пакетного поиска дубликатов фото между разными асанами."""

    photos: List[PhotoIn] = Field(default_factory=list)
    """Минимальный score (0..1), при котором сообщать о совпадении (для YOLO-класса)."""
    yoga_class_threshold: float = Field(0.55, ge=0.0, le=1.0)
    """Включать ли совпадения по совпадающему yoga-классу YOLO (top-1)."""
    use_yoga_class: bool = Field(True)


class ProposalOut(BaseModel):
    """Кандидат на связь isSameAs между двумя асанами."""

    asana_a_id: str
    asana_b_id: str
    photo_a_id: str
    photo_b_id: str
    score: float
    reason: str  # "phash_exact" | "yoga_class"
    detail: Optional[str] = None


class ScanOut(BaseModel):
    proposals: List[ProposalOut] = Field(default_factory=list)
    photos_processed: int = 0
    photos_failed: int = 0
