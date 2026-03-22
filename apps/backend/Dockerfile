FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/backend/pyproject.toml .
COPY apps/backend/README.md .
COPY apps/backend/src/ src/

RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["finly-backend-api"]
