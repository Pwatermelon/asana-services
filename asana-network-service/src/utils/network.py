import logging
import os
from io import BytesIO
from typing import Optional, Tuple

from PIL import Image

logger = logging.getLogger("asana_network.utils")

_MODEL_PATH = os.getenv(
    "YOLO_MODEL_PATH",
    "./runs/classify/train/weights/best.pt",
)

# Ленивая инициализация модели: import ultralytics при сборке без CUDA может быть тяжёлым,
# а в тестах/health-check грузить веса не нужно.
_model = None
_model_load_failed = False


def _get_model():
    global _model, _model_load_failed
    if _model is not None:
        return _model
    if _model_load_failed:
        return None
    try:
        from ultralytics import YOLO  # type: ignore

        _model = YOLO(_MODEL_PATH)
        logger.info("Loaded YOLO model from %s", _MODEL_PATH)
    except Exception as e:  # noqa: BLE001
        _model_load_failed = True
        logger.warning("Failed to load YOLO model from %s: %s", _MODEL_PATH, e)
        _model = None
    return _model


def predict_model(path_to_image: str):
    """Top-5 классов (legacy)."""
    model = _get_model()
    if model is None:
        return []
    try:
        results = model.predict([path_to_image])
        for result in results:
            probs = getattr(result, "probs", None)
            if probs is None:
                continue
            top5 = getattr(probs, "top5", None) or []
            return list(top5)
    except Exception as e:  # noqa: BLE001
        logger.warning("predict_model failed: %s", e)
    return []


def predict_top1_class(image_bytes: bytes) -> Tuple[Optional[int], float]:
    """
    Возвращает (top1_class_index, top1_confidence) от YOLO-cls.
    Если модель недоступна — (None, 0.0).
    """
    model = _get_model()
    if model is None or not image_bytes:
        return None, 0.0
    try:
        im = Image.open(BytesIO(image_bytes))
        results = model.predict(im, verbose=False)
        for result in results:
            probs = getattr(result, "probs", None)
            if probs is None:
                continue
            top1 = getattr(probs, "top1", None)
            top1conf = getattr(probs, "top1conf", None)
            if top1 is None:
                continue
            try:
                conf = float(top1conf) if top1conf is not None else 0.0
            except Exception:  # noqa: BLE001
                conf = 0.0
            return int(top1), conf
    except Exception as e:  # noqa: BLE001
        logger.warning("predict_top1_class failed: %s", e)
    return None, 0.0
