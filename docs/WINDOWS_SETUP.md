# Windows 10/11 setup

Follow [the complete development guide](DEVELOPMENT.md#windows-native) for first-time Python, PostgreSQL, environment variables and account bootstrap. For Docker Desktop use [the Docker procedure](DEVELOPMENT.md#docker-windows-or-macos):

```powershell
Copy-Item .env.example .env
# Fill both secrets locally, then:
docker compose up --build
# In a second terminal:
docker compose exec backend python manage.py createsuperuser
```

For an already configured isolated native environment:

```powershell
cd backend
.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

In a second terminal from the repository root:

```powershell
cd frontend
npm.cmd ci
npm.cmd start
```

Use approved individual accounts at localhost:4200/login. Stop native servers with Ctrl+C. No startup command applies migrations to jedel_group_db. See [test evidence and environment limitations](VERIFICATION.md).
