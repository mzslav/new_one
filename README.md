# Fluxon — AI Media Studio

A B2B media processing platform implemented as a Docker Compose monorepo. The
local stack mimics an AWS Fargate deployment: MinIO substitutes for S3, an
internal webhook substitutes for SNS, and PostgreSQL / MongoDB stand in for
RDS / DocumentDB.

## Architecture

| Component | Tech | Role |
|-----------|------|------|
| `frontend` | React + Vite + Tailwind, served by nginx | UI: login, dashboard, upload, polling |
| `api-gateway` | nginx | Routes `/api/*` to the right microservice, handles CORS |
| `auth-service` | Node.js / Express + PostgreSQL (`auth_db`) | Register & login, issues JWTs |
| `job-service` | Node.js / Express + PostgreSQL (`jobs_db`) | Creates jobs, runs the 10 s mock AI step, posts webhook |
| `media-service` | Node.js / Express + MongoDB (`media_metadata_db`) + MinIO | Multipart upload, streams files back |
| `notification-service` | Node.js / Express + MongoDB (`notifications_db`) | Receives webhooks, serves notifications |
| `postgres` / `mongo` / `minio` | Infra containers | Persistence + S3-compatible object storage |

All HTTP traffic from the browser goes through `http://localhost:8080`
(the API gateway). Internal service-to-service calls use Docker DNS, e.g.
`http://notification-service:3004/api/notifications/internal`.

## Run

```bash
cp .env.example .env   # optional, defaults work for local dev
docker compose up -d --build
```

Then open:

- App: http://localhost:5173
- API gateway: http://localhost:8080
- MinIO console: http://localhost:9001 (user/pass from `.env.example`)

To stop and clean up volumes:

```bash
docker compose down -v
```

## User flow

1. Register or sign in (auth-service).
2. Click "Upload new media", pick a file and an action type. The frontend
   uploads via media-service, then creates a job via job-service.
3. The job starts as `Pending`. After ~10 seconds the job-service flips it to
   `Completed` and pushes a notification through the internal webhook.
4. The dashboard auto-polls every 5 seconds while any job is pending, so the
   status and the notifications bell update on their own.

## Endpoints (through the gateway)

- `POST /api/auth/register` – `{ email, password }` → `{ token, user }`
- `POST /api/auth/login` – `{ email, password }` → `{ token, user }`
- `POST /api/media/upload` – `multipart/form-data` field `file` → `{ fileId }`
- `GET /api/media/:id` – streams the uploaded file back
- `POST /api/jobs` – `{ fileId, actionType }` → job (status: `Pending`)
- `GET /api/jobs` – list of the user's jobs
- `GET /api/jobs/:id` – one job
- `GET /api/notifications` – list of the user's notifications

`POST /api/notifications/internal` is intentionally blocked at the gateway and
is only reachable from inside the Docker network.
