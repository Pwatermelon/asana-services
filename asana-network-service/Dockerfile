FROM python:3.12

RUN mkdir /app
WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt
RUN pip install python-dotenv
RUN apt-get update && apt install -y libgl1

COPY . .

CMD ["sh", "-c", "python main.py"]
