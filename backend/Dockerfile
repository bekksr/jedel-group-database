FROM python:3.13-slim
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ /app/backend/
COPY database/ /app/database/
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
