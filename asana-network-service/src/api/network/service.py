import base64
import os
from datetime import datetime
from io import BytesIO
from PIL import Image
from src.api.network.schemas import PredictIn, PredictOut
from src.utils.network import predict_model


class NetworkService:
    def base64_to_image(self, image: str):
        image_data = base64.b64decode(image.split(',')[1])
        image = Image.open(BytesIO(image_data))

        now = datetime.now()
        timestamp = int(now.timestamp() * 1000)
        fileName = f"./images_for_predict/image{timestamp}.png"

        image.save(fileName)

        return f"./images_for_predict/image{timestamp}.png"

    def predict(self, image: PredictIn) -> PredictOut:
        path_to_image = self.base64_to_image(image.image)
        classes = predict_model(path_to_image)
        os.remove(path_to_image)
        return PredictOut(classes=classes)