# Fluxon — AI Media Studio

Microservice web app: React frontend, 4 backend services on Docker (local) / AWS Fargate (production).

## Services

| Service | Role | Database / AWS |
|---------|------|----------------|
| `auth-service` | Register & login | **Amazon Cognito** |
| `job-service` | Processing jobs | **RDS PostgreSQL** (`jobs_db`) |
| `media-service` | Upload & download files | **DynamoDB** + **S3** (MinIO locally) |
| `notification-service` | User notifications | **DynamoDB** + **SNS** |
| `api-gateway` | Routes `/api/*` to services | nginx |
| `frontend` | UI | static nginx |

## Deploy on AWS (from zero)

```bash
cd terraform && terraform init && terraform apply
cd .. && bash terraform/scripts/deploy.sh
```

Details: [terraform/README.md](terraform/README.md)

## Local run

1. Copy env and fill Cognito + AWS credentials (DynamoDB tables must exist in AWS):

```bash
cp .env.example .env
```

2. In Cognito User Pool (for dev): enable **USER_PASSWORD_AUTH**, and either auto-confirm users or confirm email manually.

3. Create DynamoDB tables (or use Terraform later):

- `fluxon-files` — partition key `userId` (S), sort key `id` (S)
- `fluxon-notifications` — partition key `userId` (S), sort key `createdAt` (S)

4. Start stack:

```bash
docker compose up -d --build
```

- App: http://localhost:5173  
- API: http://localhost:8080  
- MinIO console: http://localhost:9001  

## API (via gateway :8080)

| Method | Path |
|--------|------|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/media/upload` |
| GET | `/api/media/:id` |
| GET | `/api/media/:id/meta` |
| POST | `/api/jobs` |
| GET | `/api/jobs` |
| GET | `/api/jobs/:id` |
| GET | `/api/notifications` |

Internal (not via gateway): `POST /api/notifications/internal`, `POST /api/media/internal/processed`

## AWS / Terraform checklist

Terraform should create and pass to ECS tasks:

| Variable | Service |
|----------|---------|
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | auth, job, media, notification |
| `DATABASE_URL` | job-service (RDS) |
| `FILES_TABLE`, `NOTIFICATIONS_TABLE` | media, notification |
| `S3_BUCKET` | media (uses S3 instead of MinIO) |
| `SNS_TOPIC_ARN` | notification |
| `INTERNAL_WEBHOOK_SECRET` | job, media, notification |
| `NOTIFICATION_SERVICE_URL`, `MEDIA_SERVICE_URL` | job (internal URLs) |
| `AWS_REGION` | all |

Use **IAM task roles** on Fargate instead of hard-coded `AWS_ACCESS_KEY_ID` when possible.

Each Fargate service: min **2 tasks**, target tracking autoscaling, health check on `/health`.

## Storage switch

- **Local:** MinIO (`MINIO_*` vars, no `S3_BUCKET`)
- **AWS:** set `S3_BUCKET` — media-service uses AWS S3 SDK automatically
