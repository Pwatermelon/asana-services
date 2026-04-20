FROM python:3.12

ENV PIP_DEFAULT_TIMEOUT=120

RUN mkdir /app
WORKDIR /app

COPY requirements.txt .

RUN pip install --retries 10 -r requirements.txt
RUN pip install --retries 10 python-dotenv
RUN apt-get update && apt install -y libgl1

COPY . .

CMD ["sh", "-c", "python main.py"]
