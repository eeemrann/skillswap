FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 6000

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-6000} app:app"]