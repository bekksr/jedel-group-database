# macOS Apple Silicon and Intel setup

macOS execution is unverified in this Windows environment. Follow [the complete native setup](DEVELOPMENT.md#macos-native-apple-silicon-or-intel) for Python 3.13, PostgreSQL 17, Node 22, environment variables and explicit isolated initialization. Docker uses portable images; choose Docker Desktop for your hardware.

After configuring .env locally:

```sh
docker compose up --build
# In a second terminal:
docker compose exec backend python manage.py createsuperuser
```

For an already configured native isolated environment, from the repository root:

```sh
bash backend/scripts/start-development.sh
```

In another terminal:

```sh
cd frontend
npm ci
npm start
```

Visit localhost:4200/login. Stop native servers with Ctrl+C, or Docker with `docker compose down`. Restart Docker with `docker compose up` to retain the database volume. Do not use `down -v` for data you need. The guide covers bash/zsh password input differences and PostgreSQL tools on PATH.
