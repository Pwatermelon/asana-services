FROM python:3.12

ENV PIP_DEFAULT_TIMEOUT=120

RUN mkdir /app
WORKDIR /app

COPY requirements.txt .

RUN pip install --retries 10 -r requirements.txt
RUN apt-get update

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
