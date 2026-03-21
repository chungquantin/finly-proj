FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/agents/pyproject.toml .
COPY apps/agents/README.md .
COPY apps/agents/src/ src/

RUN pip install --no-cache-dir -e .

EXPOSE 8001

CMD ["finly-agent-server"]
