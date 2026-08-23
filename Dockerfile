FROM node:22-alpine AS web-build
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=80
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web-build /build/web/dist/ ./app/static/
RUN mkdir -p /app/media
EXPOSE 80
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-80} --workers 1"]
