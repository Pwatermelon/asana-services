import asyncio
from pathlib import Path

import cv2
from ultralytics import YOLO

model_predict = YOLO("./runs/classify/train/weights/last.pt")


def learn_model():
    model = YOLO("./runs/classify/train/weights/last.pt")
    results = model.train(data="./resources/yoga-82-dataset", epochs=100, imgsz=419, resume=True)


def predict_model(path_to_image):
    results = model_predict.predict([path_to_image])

    for result in results:
        probs = result.probs
        return probs.top5


if __name__ == "__main__":
    asyncio.run(predict_model())
