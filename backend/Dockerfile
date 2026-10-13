FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Run as a non-root user; uploads live in a mounted volume.
RUN useradd -m app && mkdir -p /data/uploads && chown -R app /app /data
USER app
ENV UPLOAD_DIR=/data/uploads
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health')"
# Apply migrations, then serve. (For multiple replicas run migrations as a separate release step.)
CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed --categories-only && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
