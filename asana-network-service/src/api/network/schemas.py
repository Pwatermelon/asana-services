from pydantic import BaseModel


class PredictIn(BaseModel):
    image: str


class PredictOut(BaseModel):
    classes: list[int]

