FROM python:3.13-slim
WORKDIR /app/backend
<<<<<<< Updated upstream
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
=======
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev libpq-dev && rm -rf /var/lib/apt/lists/*
>>>>>>> Stashed changes
COPY backend/requirements.txt backend/constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ /app/backend/
COPY database/ /app/database/
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
