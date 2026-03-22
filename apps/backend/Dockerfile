FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml .
COPY README.md .
COPY src/ src/

RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["finly-backend-api"]
